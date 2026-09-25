import { jobMessages, jobWorkflow } from "#/workflow/server/schema";
import { and, eq } from "drizzle-orm";
import { db } from "#/db";
import { getRunner } from "#/agent/registry";
import { taskPrompt, type AgentRunner } from "#/agent/runner";
import { jobs } from "#/job/server/schema";
import { jobContextPrompt } from "#/context/server/prompt";
import { taskRuns, tasks } from "./schema";
import type { RunActivity, TaskRunInput, TaskStreamEvent } from "../run-types";

export async function* executeTaskRun(
	data: TaskRunInput,
	runner: AgentRunner = getRunner(data.runner),
): AsyncGenerator<TaskStreamEvent> {
	const task = db.select().from(tasks).where(eq(tasks.id, data.id)).get();
	if (!task) throw new Error("Task not found");
	const job = db.select().from(jobs).where(eq(jobs.id, task.jobId)).get();
	if (!job) throw new Error("Parent job not found");

	const run = db.transaction(() => {
		if (
			db
				.select()
				.from(taskRuns)
				.where(
					and(eq(taskRuns.taskId, task.id), eq(taskRuns.status, "running")),
				)
				.get()
		)
			throw new Error("Task already running");
		const run = db
			.insert(taskRuns)
			.values({
				taskId: task.id,
				runner: data.runner,
				status: "running",
				startedAt: Date.now(),
			})
			.returning()
			.get();
		db.update(tasks)
			.set({
				text: data.text,
				output: null,
				latestRunId: run.id,
				state: "todo",
			})
			.where(eq(tasks.id, task.id))
			.run();
		return run;
	});

	let output = "";
	let finished = false;
	const activity: RunActivity[] = [];
	try {
		const workflow = db
			.select()
			.from(jobWorkflow)
			.where(eq(jobWorkflow.jobId, job.id))
			.get();
		const discussion = db
			.select()
			.from(jobMessages)
			.where(eq(jobMessages.jobId, job.id))
			.all();
		const prompt = taskPrompt({
			job,
			task: data.text,
			contextInstructions: [
				jobContextPrompt(task),
				workflow?.doneWhen ? `What done looks like: ${workflow.doneWhen}` : "",
				...discussion.map((message) => `${message.role}: ${message.content}`),
			]
				.filter(Boolean)
				.join("\n\n"),
		});
		db.update(taskRuns).set({ prompt }).where(eq(taskRuns.id, run.id)).run();
		yield { type: "started", runId: run.id };
		yield { type: "status", message: "Thinking…" };
		for await (const event of runner.run(
			prompt,
			AbortSignal.timeout(10 * 60 * 1000),
		)) {
			if (event.type === "text") output += event.delta;
			else {
				activity.push({ at: Date.now(), event });
				db.update(taskRuns)
					.set({ activity: [...activity] })
					.where(eq(taskRuns.id, run.id))
					.run();
			}
			yield event;
		}
		if (!output.trim()) throw new Error("Runner completed without an output");
		db.update(taskRuns)
			.set({ status: "completed", output, endedAt: Date.now() })
			.where(eq(taskRuns.id, run.id))
			.run();
		db.update(tasks)
			.set({ output })
			.where(and(eq(tasks.id, task.id), eq(tasks.latestRunId, run.id)))
			.run();
		finished = true;
		yield { type: "completed", output };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Task run failed";
		console.error(`Task run ${run.id} failed:`, error);
		db.update(taskRuns)
			.set({ status: "failed", output, error: message, endedAt: Date.now() })
			.where(eq(taskRuns.id, run.id))
			.run();
		finished = true;
		yield { type: "failed", message };
	} finally {
		if (!finished)
			db.update(taskRuns)
				.set({
					status: "failed",
					output,
					error: "Run interrupted",
					endedAt: Date.now(),
				})
				.where(eq(taskRuns.id, run.id))
				.run();
	}
}
