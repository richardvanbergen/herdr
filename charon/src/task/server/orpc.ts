import { touchJob } from "#/workflow/server/store";
import { ORPCError, os } from "@orpc/server";
import { asc, desc, eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "#/db";
import { jobs } from "#/job/server/schema";
import { tasks, taskRuns } from "#/task/server/schema";

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
	touchJob(input.jobId);
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
	touchJob(task.jobId);
	return task;
});

export const deleteTask = os.input(taskId).handler(({ input }) => {
	const task = db.delete(tasks).where(eq(tasks.id, input.id)).returning().get();
	if (!task) throw new ORPCError("NOT_FOUND");
	touchJob(task.jobId);
	return task;
});

export const taskRouter = {
	runs: os.input(taskId).handler(({ input }) =>
		db.select().from(taskRuns).where(eq(taskRuns.taskId, input.id)).orderBy(desc(taskRuns.id)).limit(20).all()),
	setJobContext: os.input(taskId.extend({ enabled: z.boolean() })).handler(({ input }) => {
		const task = db.update(tasks).set({ useJobContext: input.enabled }).where(eq(tasks.id, input.id)).returning().get();
		if (!task) throw new ORPCError("NOT_FOUND");
		return task;
	}),
	list: listTasks,
	create: createTask,
	update: updateTask,
	delete: deleteTask,
};
