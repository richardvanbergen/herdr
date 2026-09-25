import { requireActiveJob } from "./active";
import { jobWorkflow } from "#/workflow/server/schema";
import { workflow, touchJob } from "#/workflow/server/store";
import { ORPCError, os } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import * as z from "zod";
import { jobs } from "#/job/server/schema";
import { db } from "#/db";

const jobIdInput = z.object({
	id: z.number().int().positive(),
});

/** Retrieves job content only; placement is intentionally not part of this API. */
export const getJob = os.input(jobIdInput).handler(({ input }) => {
	const job = requireActiveJob(input.id);

	return { ...job, workflow: workflow(job.id) };
});

export const updateJob = os
	.input(
		jobIdInput.extend({
			title: z.string().trim().min(1),
			description: z.string().nullable(),
		}),
	)
	.handler(({ input }) => {
		const job = db
			.update(jobs)
			.set({ title: input.title, description: input.description })
			.where(and(eq(jobs.id, input.id), isNull(jobs.deletedAt)))
			.returning()
			.get();

		if (!job) throw new ORPCError("NOT_FOUND");
		touchJob(job.id);
		return { ...job, workflow: workflow(job.id) };
	});

export const deleteJob = os.input(jobIdInput).handler(({ input }) =>
	db.transaction((tx) => {
		const job = tx
			.select({ id: jobs.id })
			.from(jobs)
			.where(eq(jobs.id, input.id))
			.get();
		if (!job) throw new ORPCError("NOT_FOUND");
		tx.update(jobs)
			.set({ deletedAt: Date.now() })
			.where(and(eq(jobs.id, input.id), isNull(jobs.deletedAt)))
			.run();
		// Retain tasks, runs, messages, context and placement for recovery. Revoke work.
		tx.update(jobWorkflow)
			.set({
				ready: false,
				status: "draft",
				token: null,
				leaseUntil: null,
				updatedAt: Date.now(),
			})
			.where(eq(jobWorkflow.jobId, input.id))
			.run();
		return { success: true };
	}),
);

export const restoreJob = os.input(jobIdInput).handler(({ input }) => {
	const job = db
		.update(jobs)
		.set({ deletedAt: null })
		.where(eq(jobs.id, input.id))
		.returning()
		.get();
	if (!job) throw new ORPCError("NOT_FOUND");
	return { ...job, workflow: workflow(job.id) };
});

export const jobRouter = {
	restore: restoreJob,
	get: getJob,
	update: updateJob,
	delete: deleteJob,
};
