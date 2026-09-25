import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
const temporary = mkdtempSync(join(tmpdir(), "charon-workflow-"));
process.env.CHARON_DB_PATH = join(temporary, "test.sqlite");
process.env.CHARON_CONTEXT_ROOT = join(temporary, "context");
const { db } = await import("#/db");
const { jobs } = await import("#/job/server/schema");
const { tasks, taskRuns } = await import("#/task/server/schema");
const { jobWorkflow } = await import("./schema");
const { workflowRouter, dispatchTask } = await import("./orpc");
const {
	workflow,
	queue,
	setReady,
	claim,
	reply,
	finish,
	readJob,
	recoverExpired,
} = await import("./store");
migrate(db, { migrationsFolder: "drizzle" });
const api = createRouterClient(workflowRouter);
const make = () =>
	db.insert(jobs).values({ title: "Poem about Greek gods" }).returning().get()
		.id;
const uid = () => crypto.randomUUID();
afterAll(() => rmSync(temporary, { recursive: true, force: true }));

test("drafts stay out of queue; ready persists across blocked/reply cycles; duplicate replies do not requeue", () => {
	const id = make();
	expect(workflow(id).ready).toBe(false);
	expect(queue().some((row) => row.jobId === id)).toBe(false);
	setReady(id, true);
	const lease = claim(id);
	expect(() => claim(id)).toThrow();
	finish(id, lease.token!, "blocked", "Which style?", uid());
	expect(workflow(id).ready).toBe(true);
	expect(queue().some((row) => row.jobId === id)).toBe(false);
	const key = uid();
	reply(id, "Epic. Include Hephaestus.", "human", key);
	expect(workflow(id).status).toBe("queued");
	const second = claim(id);
	reply(id, "Epic. Include Hephaestus.", "human", key);
	expect(workflow(id).revision).toBe(second.claimRevision!);
	finish(id, second.token!, "review", "Poem is ready.", uid());
	expect(workflow(id).status).toBe("review");
});
test("new human reply during execution is not lost when agent finishes", () => {
	const id = make();
	setReady(id, true);
	const lease = claim(id);
	reply(id, "Also include Athena.", "human", uid());
	const result = finish(id, lease.token!, "review", "First version.", uid());
	expect(result.status).toBe("queued");
	expect(result.notification).toBeNull();
});
test("pause rejects further agent mutations; expired claims require review rather than duplicate execution", async () => {
	const id = make();
	setReady(id, true);
	const lease = claim(id);
	setReady(id, false);
	await expect(
		api.agent({
			action: "create_task",
			input: {
				jobId: id,
				token: lease.token!,
				text: "Do work",
				requestId: uid(),
			},
		}),
	).rejects.toThrow();
	db.update(jobWorkflow)
		.set({ leaseUntil: Date.now() - 1 })
		.where(eq(jobWorkflow.jobId, id))
		.run();
	recoverExpired();
	expect(workflow(id).status).toBe("blocked");
	expect(readJob(id).messages.at(-1)?.content).toContain("stopped responding");
});
test("agent task creation is idempotent and cannot mutate another job", async () => {
	const id = make();
	setReady(id, true);
	const lease = claim(id);
	const input = {
		jobId: id,
		token: lease.token!,
		text: "Write the poem",
		requestId: uid(),
	};
	const first = (await api.agent({ action: "create_task", input })) as {
		id: number;
	};
	const second = (await api.agent({ action: "create_task", input })) as {
		id: number;
	};
	expect(first.id).toBe(second.id);
	await expect(
		api.agent({
			action: "update_task",
			input: {
				jobId: make(),
				token: lease.token!,
				taskId: first.id,
				state: "done",
			},
		}),
	).rejects.toThrow();
	await expect(
		api.agent({
			action: "finish",
			input: {
				jobId: id,
				token: lease.token!,
				status: "review",
				content: "Done",
				requestId: uid(),
			},
		}),
	).rejects.toThrow();
});
test("background execution survives receipt return, preserves context and does not duplicate a run", async () => {
	const id = make();
	setReady(id, true);
	db.update(jobWorkflow)
		.set({ doneWhen: "Hephaestus must feature prominently." })
		.where(eq(jobWorkflow.jobId, id))
		.run();
	reply(id, "Use an epic voice.", "human", uid());
	const task = db
		.insert(tasks)
		.values({ jobId: id, text: "Write a poem", position: 0 })
		.returning()
		.get();
	let release!: () => void;
	const wait = new Promise<void>((resolve) => {
		release = resolve;
	});
	const runner = {
		async *run(prompt: string) {
			expect(prompt).toContain("Hephaestus");
			expect(prompt).toContain("epic voice");
			await wait;
			yield { type: "text" as const, delta: "Hephaestus lit the forge." };
		},
	};
	const key = uid();
	const receipt = await dispatchTask(id, task.id, key, runner);
	expect(receipt.runId).toBeNumber();
	expect((await dispatchTask(id, task.id, key, runner)).runId).toBe(
		receipt.runId,
	);
	release();
	for (let i = 0; i < 30; i++) {
		if (
			db.select().from(taskRuns).where(eq(taskRuns.id, receipt.runId!)).get()
				?.status === "completed"
		)
			break;
		await Bun.sleep(10);
	}
	const result = readJob(id).tasks[0];
	expect(result.output).toContain("Hephaestus");
	expect(result.latestRun?.status).toBe("completed");
	expect(
		db.select().from(taskRuns).where(eq(taskRuns.taskId, task.id)).all(),
	).toHaveLength(1);
});
test("deleting a job cascades workflow records", () => {
	const id = make();
	workflow(id);
	reply(id, "Draft", "human", uid());
	db.delete(jobs).where(eq(jobs.id, id)).run();
	expect(
		db.select().from(jobWorkflow).where(eq(jobWorkflow.jobId, id)).get(),
	).toBeUndefined();
});

test("explicit human approval closes a ready job; agents cannot supply their own approval message", async () => {
	const jobId = make();
	setReady(jobId, true);
	const approval = reply(jobId, "Looks good, done.", "human", uid());
	const lease = claim(jobId);
	const agent = reply(jobId, "I think it is done.", "agent", uid());
	await expect(
		api.agent({
			action: "complete_job",
			input: {
				jobId,
				token: lease.token!,
				approvalMessageId: agent.id,
				content: "Closed",
				requestId: uid(),
			},
		}),
	).rejects.toThrow();
	await api.agent({
		action: "complete_job",
		input: {
			jobId,
			token: lease.token!,
			approvalMessageId: approval.id,
			content: "Closed as requested.",
			requestId: uid(),
		},
	});
	expect(workflow(jobId).status).toBe("done");
	expect(workflow(jobId).ready).toBe(false);
});

test("pausing allows the current worker to release its claim without publishing a completion", () => {
	const jobId = make();
	setReady(jobId, true);
	const lease = claim(jobId);
	setReady(jobId, false);
	const result = finish(
		jobId,
		lease.token!,
		"blocked",
		"Stopped as requested.",
		uid(),
	);
	expect(result.status).toBe("draft");
	expect(result.notification).toBeNull();
	expect(workflow(jobId).token).toBeNull();
});

test("manual execution cannot overlap a scheduled run", async () => {
	const { executeTaskRun } = await import("#/task/server/execute-task");
	const jobId = make();
	const task = db
		.insert(tasks)
		.values({ jobId, text: "Poem", position: 0 })
		.returning()
		.get();
	const runner = {
		async *run() {
			yield { type: "text" as const, delta: "Poem" };
		},
	};
	const input = { id: task.id, text: task.text, runner: "codex" as const };
	const first = executeTaskRun(input, runner);
	await first.next();
	const second = executeTaskRun(input, runner);
	await expect(second.next()).rejects.toThrow("Task already running");
	await first.return(undefined);
});
