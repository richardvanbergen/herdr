import { workflow, touchJob } from "#/workflow/server/store";
import { ORPCError, os } from "@orpc/server";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { jobs } from "#/job/server/schema";
import { jobPlacements } from "#/board/server/schema";
import { tasks } from "#/task/server/schema";
import { db } from "#/db";

const jobIdInput = z.object({
	id: z.number().int().positive(),
});

/** Retrieves job content only; placement is intentionally not part of this API. */
export const getJob = os.input(jobIdInput).handler(({ input }) => {
	const job = db.select().from(jobs).where(eq(jobs.id, input.id)).get();

	if (!job) {
		throw new ORPCError("NOT_FOUND");
	}

	return { ...job, workflow: workflow(job.id) };
});

export const updateJob = os
	.input(jobIdInput.extend({
		title: z.string().trim().min(1),
		description: z.string().nullable(),
	}))
	.handler(({ input }) => {
		const job = db.update(jobs)
			.set({ title: input.title, description: input.description })
			.where(eq(jobs.id, input.id))
			.returning()
			.get();

		if (!job) throw new ORPCError("NOT_FOUND");
		touchJob(job.id);
		return { ...job, workflow: workflow(job.id) };
	});

export const deleteJob = os.input(jobIdInput).handler(({ input }) => db.transaction((tx) => {
	const job = tx.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, input.id)).get();
	if (!job) throw new ORPCError("NOT_FOUND");
	tx.delete(tasks).where(eq(tasks.jobId, input.id)).run();
	tx.delete(jobPlacements).where(eq(jobPlacements.jobId, input.id)).run();
	tx.delete(jobs).where(eq(jobs.id, input.id)).run();
	return { success: true };
}));

export const jobRouter = {
	get: getJob,
	update: updateJob,
	delete: deleteJob,
};
