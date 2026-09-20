import { ORPCError, os } from "@orpc/server";
import { asc, desc, eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "#/db";
import { jobs } from "#/job/server/schema";
import { tasks } from "#/task/server/schema";
import { taskPrompt } from "#/agent/runner";
import { taskRunner } from "#/agent/codex-runner";

const taskId = z.object({ id: z.number().int().positive() });
const jobId = z.object({ jobId: z.number().int().positive() });

export const listTasks = os.input(jobId).handler(({ input }) =>
	db.select().from(tasks).where(eq(tasks.jobId, input.jobId))
		.orderBy(asc(tasks.position), asc(tasks.id)).all()
);

export const createTask = os.input(jobId.extend({
	text: z.string().trim().min(1),
})).handler(({ input }) => db.transaction((tx) => {
	if (!tx.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, input.jobId)).get()) {
		throw new ORPCError("NOT_FOUND");
	}
	const last = tx.select({ position: tasks.position }).from(tasks)
		.where(eq(tasks.jobId, input.jobId)).orderBy(desc(tasks.position)).limit(1).get();
	return tx.insert(tasks).values({
		jobId: input.jobId,
		text: input.text,
		position: (last?.position ?? -1) + 1,
	}).returning().get();
}));

export const updateTask = os.input(taskId.extend({
	text: z.string().trim().min(1),
})).handler(({ input }) => {
	const task = db.update(tasks).set({ text: input.text })
		.where(eq(tasks.id, input.id)).returning().get();
	if (!task) throw new ORPCError("NOT_FOUND");
	return task;
});

export const deleteTask = os.input(taskId).handler(({ input }) => {
	const task = db.delete(tasks).where(eq(tasks.id, input.id)).returning().get();
	if (!task) throw new ORPCError("NOT_FOUND");
	return task;
});

export const runTask = os.input(taskId.extend({ text: z.string().trim().min(1) })).handler(async ({ input }) => {
	const task = db.select().from(tasks).where(eq(tasks.id, input.id)).get();
	if (!task) throw new ORPCError("NOT_FOUND");
	const job = db.select().from(jobs).where(eq(jobs.id, task.jobId)).get();
	if (!job) throw new ORPCError("NOT_FOUND");
	db.update(tasks).set({ text: input.text }).where(eq(tasks.id, task.id)).run();
	const output = await taskRunner.run(taskPrompt({ job, task: input.text }));
	return db.update(tasks).set({ output }).where(eq(tasks.id, task.id)).returning().get();
});

export const taskRouter = {
	list: listTasks,
	create: createTask,
	update: updateTask,
	delete: deleteTask,
	run: runTask,
};
