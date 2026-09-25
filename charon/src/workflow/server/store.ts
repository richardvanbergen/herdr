import { requireActiveJob } from "#/job/server/active";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, lt, sql } from "drizzle-orm";
import { db } from "#/db";
import { jobs } from "#/job/server/schema";
import { tasks, taskRuns } from "#/task/server/schema";
import { jobPlacements } from "#/board/server/schema";
import {
	conversationThreads,
	conversationMessages,
} from "#/conversation/server/schema";
import { jobWorkflow, jobMessages } from "./schema";

export function workflow(jobId: number) {
	requireActiveJob(jobId);
	db.insert(jobWorkflow)
		.values({ jobId, updatedAt: Date.now() })
		.onConflictDoNothing()
		.run();
	return db
		.select()
		.from(jobWorkflow)
		.where(eq(jobWorkflow.jobId, jobId))
		.get()!;
}
export function touchJob(jobId: number) {
	const current = workflow(jobId);
	db.update(jobWorkflow)
		.set({
			revision: sql`${jobWorkflow.revision} + 1`,
			status: current.token ? "working" : current.ready ? "queued" : "draft",
			updatedAt: Date.now(),
		})
		.where(eq(jobWorkflow.jobId, jobId))
		.run();
}
export function setReady(jobId: number, ready: boolean) {
	const current = workflow(jobId);
	db.update(jobWorkflow)
		.set({
			ready,
			status: current.token ? "working" : ready ? "queued" : "draft",
			revision: sql`${jobWorkflow.revision} + 1`,
			updatedAt: Date.now(),
		})
		.where(eq(jobWorkflow.jobId, jobId))
		.run();
	return workflow(jobId);
}
export function jobUrl(jobId: number) {
	const placement = db
		.select()
		.from(jobPlacements)
		.where(eq(jobPlacements.jobId, jobId))
		.get();
	return `${process.env.CHARON_PUBLIC_URL ?? "http://herdr"}/column/${placement?.columnId ?? 1}/job/${jobId}`;
}
export function recoverExpired() {
	const notices: string[] = [];
	// A server restart may strand a running row. Keep its evidence, fail it visibly.
	db.update(taskRuns)
		.set({
			status: "failed",
			error:
				"Run interrupted or exceeded its execution deadline. Review evidence before retrying.",
			endedAt: Date.now(),
		})
		.where(
			and(
				eq(taskRuns.status, "running"),
				lt(taskRuns.startedAt, Date.now() - 11 * 60_000),
			),
		)
		.run();
	// Never replay an uncertain run: require human review of its persisted evidence.
	for (const row of db
		.select()
		.from(jobWorkflow)
		.where(
			and(
				eq(jobWorkflow.status, "working"),
				lt(jobWorkflow.leaseUntil, Date.now()),
			),
		)
		.all()) {
		db.update(jobWorkflow)
			.set({
				status: "blocked",
				token: null,
				leaseUntil: null,
				updatedAt: Date.now(),
			})
			.where(eq(jobWorkflow.jobId, row.jobId))
			.run();
		notices.push(
			`I'm blocked: the agent stopped responding. Review run history and reply to retry. ${jobUrl(row.jobId)}`,
		);
		db.insert(jobMessages)
			.values({
				jobId: row.jobId,
				role: "agent",
				content:
					"The agent stopped responding. Review the run history, then reply to retry.",
				createdAt: Date.now(),
			})
			.run();
	}
	return notices;
}
export function queue() {
	return db
		.select()
		.from(jobWorkflow)
		.where(and(eq(jobWorkflow.ready, true), eq(jobWorkflow.status, "queued")))
		.orderBy(asc(jobWorkflow.updatedAt))
		.all();
}
export function claim(jobId: number) {
	workflow(jobId);
	recoverExpired();
	const row = db
		.update(jobWorkflow)
		.set({
			status: "working",
			token: crypto.randomUUID(),
			claimRevision: sql`${jobWorkflow.revision}`,
			leaseUntil: Date.now() + 15 * 60_000,
			updatedAt: Date.now(),
		})
		.where(
			and(
				eq(jobWorkflow.jobId, jobId),
				eq(jobWorkflow.ready, true),
				eq(jobWorkflow.status, "queued"),
			),
		)
		.returning()
		.get();
	if (!row)
		throw new ORPCError("CONFLICT", {
			message: "Job is not available to claim.",
		});
	return row;
}
export function requireClaim(
	jobId: number,
	token: string,
	allowPaused = false,
) {
	const row = workflow(jobId);
	if (
		row.token !== token ||
		!row.leaseUntil ||
		row.leaseUntil < Date.now() ||
		(!row.ready && !allowPaused)
	)
		throw new ORPCError("CONFLICT", {
			message: "Claim expired or job paused. Stop work.",
		});
	db.update(jobWorkflow)
		.set({ leaseUntil: Date.now() + 15 * 60_000 })
		.where(eq(jobWorkflow.jobId, jobId))
		.run();
	return row;
}
export function readJob(jobId: number) {
	const state = workflow(jobId);
	const jobTasks = db
		.select()
		.from(tasks)
		.where(eq(tasks.jobId, jobId))
		.orderBy(asc(tasks.position))
		.all();
	return {
		job: db.select().from(jobs).where(eq(jobs.id, jobId)).get()!,
		workflow: state,
		url: jobUrl(jobId),
		messages: db
			.select()
			.from(jobMessages)
			.where(eq(jobMessages.jobId, jobId))
			.orderBy(asc(jobMessages.id))
			.all(),
		tasks: jobTasks.map((task) => ({
			...task,
			latestRun: task.latestRunId
				? db
						.select()
						.from(taskRuns)
						.where(eq(taskRuns.id, task.latestRunId))
						.get()
				: null,
		})),
		discussions: db
			.select({ thread: conversationThreads, message: conversationMessages })
			.from(conversationThreads)
			.innerJoin(
				conversationMessages,
				eq(conversationThreads.id, conversationMessages.threadId),
			)
			.innerJoin(tasks, eq(tasks.id, conversationThreads.taskId))
			.where(eq(tasks.jobId, jobId))
			.orderBy(asc(conversationMessages.id))
			.all(),
	};
}
export function reply(
	jobId: number,
	content: string,
	role: "human" | "agent",
	requestId: string,
	taskId?: number,
) {
	return db.transaction(() => {
		workflow(jobId);
		const existing = db
			.select()
			.from(jobMessages)
			.where(eq(jobMessages.requestId, requestId))
			.get();
		if (existing) {
			if (
				existing.jobId !== jobId ||
				existing.role !== role ||
				existing.content !== content
			)
				throw new ORPCError("CONFLICT");
			return existing;
		}
		if (
			taskId &&
			!db
				.select()
				.from(tasks)
				.where(and(eq(tasks.id, taskId), eq(tasks.jobId, jobId)))
				.get()
		)
			throw new ORPCError("NOT_FOUND");
		const message = db
			.insert(jobMessages)
			.values({
				jobId,
				content,
				role,
				requestId,
				taskId,
				createdAt: Date.now(),
			})
			.returning()
			.get();
		if (role === "human") touchJob(jobId);
		return message;
	});
}
export function finish(
	jobId: number,
	token: string,
	status: "blocked" | "review" | "queued" | "done",
	content: string,
	requestId: string,
) {
	return db.transaction(() => {
		const current = requireClaim(jobId, token, true);
		if (
			status === "review" &&
			db
				.select()
				.from(tasks)
				.where(and(eq(tasks.jobId, jobId), eq(tasks.state, "todo")))
				.get()
		)
			throw new ORPCError("CONFLICT", {
				message: "Finish tasks or explain blockers before requesting review.",
			});
		reply(jobId, content, "agent", requestId);
		const next = !current.ready
			? "draft"
			: current.revision !== current.claimRevision
				? "queued"
				: status;
		db.update(jobWorkflow)
			.set({
				status: next,
				ready: next === "done" ? false : current.ready,
				token: null,
				leaseUntil: null,
				updatedAt: Date.now(),
			})
			.where(eq(jobWorkflow.jobId, jobId))
			.run();
		return {
			status: next,
			url: jobUrl(jobId),
			notification:
				next === "queued" || next === "draft"
					? null
					: `${status === "blocked" ? "I'm blocked" : status === "done" ? "Done — closed as requested" : "I'm done with this — ready for your review"}: ${content}\n${jobUrl(jobId)}`,
		};
	});
}
