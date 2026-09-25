import { requireActiveTask } from "#/task/server/active";
import type { AgentRunner } from "#/agent/runner";
import { createRouterClient, ORPCError, os } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "#/db";
import { tasks, taskRuns } from "#/task/server/schema";
import { jobWorkflow, jobMessages, workflowDispatches } from "./schema";
import {
	claim,
	finish,
	queue,
	recoverExpired,
	readJob,
	reply,
	requireClaim,
	setReady,
	touchJob,
	workflow,
} from "./store";
import { boardRouter } from "#/board/server/orpc";
import { contextRouter } from "#/context/server/orpc";
import { executeTaskRun } from "#/task/server/execute-task";
import { runnerIds } from "#/agent/runner-options";

const id = z.number().int().positive();
const job = z.object({ jobId: id });
const leased = job.extend({ token: z.string().min(1) });
const requestId = z.string().min(1).max(200);
const content = z.string().trim().min(1).max(30_000);
const api = createRouterClient({ board: boardRouter, context: contextRouter });
const actions = {
	set_ready: job.extend({ ready: z.boolean() }),
	record_human_reply: job.extend({ content, requestId, taskId: id.optional() }),
	complete_job: leased.extend({ approvalMessageId: id, content, requestId }),
	queue: z.object({}),
	read: job,
	claim: job,
	heartbeat: leased,
	create_job: z.object({
		columnId: id,
		title: z.string().min(1),
		description: z.string().nullable().default(null),
	}),
	create_task: leased.extend({
		text: content,
		assignee: z.enum(["human", "agent"]).default("agent"),
		requestId,
	}),
	update_task: leased.extend({
		taskId: id,
		text: content.optional(),
		assignee: z.enum(["human", "agent"]).optional(),
		state: z.enum(["todo", "done"]).optional(),
	}),
	delete_task: leased.extend({ taskId: id }),
	wait_run: leased.extend({ taskId: id }),
	run_task: leased.extend({ taskId: id, requestId }),
	reply: leased.extend({ content, requestId, taskId: id.optional() }),
	finish: leased.extend({
		status: z.enum(["blocked", "review", "queued"]),
		content,
		requestId,
	}),
	set_outcome: leased.extend({ doneWhen: content }),
	board: z.object({}),
	move_job: leased.extend({
		columnId: id,
		index: z.number().int().nonnegative().default(0),
	}),
	context_list: job,
	context_read: job.extend({ path: z.string() }),
	context_save: leased.extend({
		path: z.string().optional(),
		version: z.string().optional(),
		title: z.string().min(1),
		description: z.string().default(""),
		body: z.string(),
	}),
};
const descriptions: Record<keyof typeof actions, string> = {
	set_ready:
		"Toggle readiness only when the human explicitly asks. Never enable drafts autonomously.",
	record_human_reply:
		"Record an actual human message from Telegram verbatim on its job. Never invent human messages or record your own words as human. A ready job is automatically queued.",
	complete_job:
		"Close a job only on explicit human approval recorded in approvalMessageId. Your own successful execution is review, not human approval.",
	wait_run:
		"Wait up to 15 seconds for a task run to finish, extending the job claim. Returns persisted run state; call again while running.",
	queue: "List ready queued jobs. Claim before doing work.",
	read: "Read brief, workflow, discussions, task outputs and run evidence.",
	claim: "Atomically claim a ready job for 15 minutes; retain token.",
	heartbeat: "Extend your claim while working.",
	create_job:
		"Create a draft job in a board column. Ready remains off until the human enables it.",
	create_task: "Create a task idempotently. Reuse requestId on retries.",
	update_task: "Edit or complete an existing task.",
	delete_task:
		"Remove a task when requested or superseded; preserve useful results.",
	run_task:
		"Start the selected job runner in the background. Reuse requestId on retries; read the job to poll results.",
	reply: "Post an agent message without requeueing the job.",
	finish:
		"Release claim: blocked asks for human input; review requests approval; queued continues on next tick. Never finish while a task run is active.",
	set_outcome: "Record what done looks like, based on the discussion.",
	board: "List board columns and job placements.",
	move_job: "Move job using normal board ordering.",
	context_list: "Discover job context files.",
	context_read: "Read a context file, including metadata and body.",
	context_save:
		"Create context or update it using path and version from context_read. Preserve existing content when appending.",
};
const agentInput = z.discriminatedUnion("action", [
	z.object({ action: z.literal("set_ready"), input: actions.set_ready }),
	z.object({
		action: z.literal("record_human_reply"),
		input: actions.record_human_reply,
	}),
	z.object({ action: z.literal("complete_job"), input: actions.complete_job }),
	z.object({ action: z.literal("queue"), input: actions.queue }),
	z.object({ action: z.literal("read"), input: actions.read }),
	z.object({ action: z.literal("claim"), input: actions.claim }),
	z.object({ action: z.literal("heartbeat"), input: actions.heartbeat }),
	z.object({ action: z.literal("create_job"), input: actions.create_job }),
	z.object({ action: z.literal("create_task"), input: actions.create_task }),
	z.object({ action: z.literal("update_task"), input: actions.update_task }),
	z.object({ action: z.literal("delete_task"), input: actions.delete_task }),
	z.object({ action: z.literal("wait_run"), input: actions.wait_run }),
	z.object({ action: z.literal("run_task"), input: actions.run_task }),
	z.object({ action: z.literal("reply"), input: actions.reply }),
	z.object({ action: z.literal("finish"), input: actions.finish }),
	z.object({ action: z.literal("set_outcome"), input: actions.set_outcome }),
	z.object({ action: z.literal("board"), input: actions.board }),
	z.object({ action: z.literal("move_job"), input: actions.move_job }),
	z.object({ action: z.literal("context_list"), input: actions.context_list }),
	z.object({ action: z.literal("context_read"), input: actions.context_read }),
	z.object({ action: z.literal("context_save"), input: actions.context_save }),
]);

// The generator is drained by the server, never by the HTTP client. Its start
// event is persisted before returning the receipt. No detached work in the UI.
export async function dispatchTask(
	jobId: number,
	taskId: number,
	key: string,
	runner?: AgentRunner,
) {
	requireActiveTask(taskId);
	const existing = db
		.select()
		.from(workflowDispatches)
		.where(eq(workflowDispatches.requestId, key))
		.get();
	if (existing) {
		if (existing.jobId !== jobId || existing.taskId !== taskId)
			throw new ORPCError("CONFLICT");
		return existing;
	}
	const task = db
		.select()
		.from(tasks)
		.where(and(eq(tasks.id, taskId), eq(tasks.jobId, jobId)))
		.get();
	if (!task || task.assignee !== "agent")
		throw new ORPCError("BAD_REQUEST", { message: "Select an agent task." });
	if (
		db
			.select()
			.from(taskRuns)
			.where(and(eq(taskRuns.taskId, taskId), eq(taskRuns.status, "running")))
			.get()
	)
		throw new ORPCError("CONFLICT", { message: "Task already running." });
	db.insert(workflowDispatches).values({ requestId: key, jobId, taskId }).run();
	const stream = executeTaskRun(
		{ id: taskId, text: task.text, runner: workflow(jobId).runner },
		runner,
	);
	try {
		const started = await stream.next();
		if (started.value?.type !== "started") throw new Error("Run did not start");
		const receipt = db
			.update(workflowDispatches)
			.set({ runId: started.value.runId })
			.where(eq(workflowDispatches.requestId, key))
			.returning()
			.get()!;
		void (async () => {
			try {
				for await (const _ of stream) {
					/* execution persists all evidence */
				}
			} catch (error) {
				console.error("Background task failed", error);
			}
		})();
		return receipt;
	} catch (error) {
		await stream.return(undefined);
		throw error;
	}
}

export const workflowRouter = {
	task: os
		.input(
			z.object({
				id,
				assignee: z.enum(["human", "agent"]),
				state: z.enum(["todo", "done"]),
			}),
		)
		.handler(({ input }) => {
			const task = db.select().from(tasks).where(eq(tasks.id, input.id)).get();
			if (!task) throw new ORPCError("NOT_FOUND");
			requireActiveTask(task.id);
			if (
				db
					.select()
					.from(taskRuns)
					.where(
						and(eq(taskRuns.taskId, task.id), eq(taskRuns.status, "running")),
					)
					.get()
			)
				throw new ORPCError("CONFLICT", { message: "Task is running." });
			const updated = db
				.update(tasks)
				.set({ assignee: input.assignee, state: input.state })
				.where(eq(tasks.id, task.id))
				.returning()
				.get();
			touchJob(task.jobId);
			return updated;
		}),
	get: os.input(job).handler(({ input }) => readJob(input.jobId)),
	ready: os
		.input(job.extend({ ready: z.boolean() }))
		.handler(({ input }) => setReady(input.jobId, input.ready)),
	settings: os
		.input(
			job.extend({
				doneWhen: z.string().max(30_000),
				runner: z.enum(runnerIds),
			}),
		)
		.handler(({ input }) => {
			workflow(input.jobId);
			db.update(jobWorkflow)
				.set({ doneWhen: input.doneWhen, runner: input.runner })
				.where(eq(jobWorkflow.jobId, input.jobId))
				.run();
			touchJob(input.jobId);
			return workflow(input.jobId);
		}),
	reply: os
		.input(job.extend({ content, requestId, taskId: id.optional() }))
		.handler(({ input }) =>
			reply(input.jobId, input.content, "human", input.requestId, input.taskId),
		),
	complete: os.input(job).handler(({ input }) => {
		const row = workflow(input.jobId);
		if (row.token)
			throw new ORPCError("CONFLICT", {
				message: "Wait for current agent work to stop.",
			});
		db.update(jobWorkflow)
			.set({ ready: false, status: "done", updatedAt: Date.now() })
			.where(eq(jobWorkflow.jobId, input.jobId))
			.run();
		return workflow(input.jobId);
	}),
	tools: os.handler(() =>
		Object.entries(actions).map(([name, schema]) => ({
			name: `charon_${name}`,
			description: descriptions[name as keyof typeof actions],
			inputSchema: z.toJSONSchema(schema),
		})),
	),
	agent: os.input(agentInput).handler(async ({ input: request }) => {
		const { action, input: data } = request;
		if ("token" in data)
			requireClaim(data.jobId, data.token, action === "finish");
		switch (action) {
			case "set_ready":
				return setReady(data.jobId, data.ready);
			case "record_human_reply":
				return reply(
					data.jobId,
					data.content,
					"human",
					data.requestId,
					data.taskId,
				);
			case "complete_job": {
				const approval = db
					.select()
					.from(jobMessages)
					.where(
						and(
							eq(jobMessages.id, data.approvalMessageId),
							eq(jobMessages.jobId, data.jobId),
							eq(jobMessages.role, "human"),
						),
					)
					.get();
				if (!approval)
					throw new ORPCError("BAD_REQUEST", {
						message: "Record explicit human approval first.",
					});
				if (
					db
						.select()
						.from(taskRuns)
						.innerJoin(tasks, eq(tasks.id, taskRuns.taskId))
						.where(
							and(eq(tasks.jobId, data.jobId), eq(taskRuns.status, "running")),
						)
						.get()
				)
					throw new ORPCError("CONFLICT", { message: "Wait for active runs." });
				return finish(
					data.jobId,
					data.token,
					"done",
					data.content,
					data.requestId,
				);
			}
			case "queue": {
				const notices = recoverExpired();
				return { jobs: queue(), notices };
			}
			case "read":
				return readJob(data.jobId);
			case "claim":
				return claim(data.jobId);
			case "heartbeat":
				return workflow(data.jobId);
			case "board":
				return api.board.get();
			case "create_job":
				return api.board.addJob(data);
			case "move_job":
				return api.board.moveJob(data);
			case "create_task": {
				const existing = db
					.select()
					.from(tasks)
					.where(eq(tasks.requestId, data.requestId))
					.get();
				if (existing) {
					if (existing.jobId !== data.jobId) throw new ORPCError("CONFLICT");
					return existing;
				}
				return db.transaction(() => {
					const last = db
						.select()
						.from(tasks)
						.where(eq(tasks.jobId, data.jobId))
						.all();
					return db
						.insert(tasks)
						.values({
							jobId: data.jobId,
							text: data.text,
							assignee: data.assignee,
							requestId: data.requestId,
							position: Math.max(-1, ...last.map((t) => t.position)) + 1,
						})
						.returning()
						.get();
				});
			}
			case "update_task":
			case "delete_task": {
				const task = db
					.select()
					.from(tasks)
					.where(and(eq(tasks.id, data.taskId), eq(tasks.jobId, data.jobId)))
					.get();
				if (!task) throw new ORPCError("NOT_FOUND");
				if (
					db
						.select()
						.from(taskRuns)
						.where(
							and(
								eq(taskRuns.taskId, data.taskId),
								eq(taskRuns.status, "running"),
							),
						)
						.get()
				)
					throw new ORPCError("CONFLICT", { message: "Task is running." });
				if (action === "delete_task")
					return db
						.delete(tasks)
						.where(eq(tasks.id, data.taskId))
						.returning()
						.get();
				return db
					.update(tasks)
					.set({
						text: data.text ?? task.text,
						assignee: data.assignee ?? task.assignee,
						state: data.state ?? task.state,
					})
					.where(eq(tasks.id, task.id))
					.returning()
					.get();
			}
			case "wait_run": {
				const task = db
					.select()
					.from(tasks)
					.where(and(eq(tasks.id, data.taskId), eq(tasks.jobId, data.jobId)))
					.get();
				if (!task) throw new ORPCError("NOT_FOUND");
				for (let i = 0; i < 30; i++) {
					const run = task.latestRunId
						? db
								.select()
								.from(taskRuns)
								.where(eq(taskRuns.id, task.latestRunId))
								.get()
						: null;
					if (!run || run.status !== "running") return run;
					await Bun.sleep(500);
				}
				return task.latestRunId
					? db
							.select()
							.from(taskRuns)
							.where(eq(taskRuns.id, task.latestRunId))
							.get()
					: null;
			}
			case "run_task":
				return dispatchTask(data.jobId, data.taskId, data.requestId);
			case "reply":
				return reply(
					data.jobId,
					data.content,
					"agent",
					data.requestId,
					data.taskId,
				);
			case "finish": {
				const active = db
					.select()
					.from(taskRuns)
					.innerJoin(tasks, eq(tasks.id, taskRuns.taskId))
					.where(
						and(eq(tasks.jobId, data.jobId), eq(taskRuns.status, "running")),
					)
					.get();
				if (active)
					throw new ORPCError("CONFLICT", {
						message: "Task still running. Poll results before finishing.",
					});
				return finish(
					data.jobId,
					data.token,
					data.status,
					data.content,
					data.requestId,
				);
			}
			case "set_outcome":
				return db
					.update(jobWorkflow)
					.set({ doneWhen: data.doneWhen })
					.where(eq(jobWorkflow.jobId, data.jobId))
					.returning()
					.get();
			case "context_list":
				return api.context.list(data);
			case "context_read":
				return api.context.read(data);
			case "context_save": {
				const input = {
					jobId: data.jobId,
					content: {
						type: "text" as const,
						title: data.title,
						description: data.description,
						body: data.body,
					},
				};
				if (data.path)
					return api.context.update({
						...input,
						path: data.path,
						version: data.version ?? "",
					});
				return api.context.create(input);
			}
		}
	}),
};
