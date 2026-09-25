import { workflow } from "#/workflow/server/store";
import { ORPCError, os } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import * as z from "zod";
import { jobPlacements, columns } from "#/board/server/schema";
import { jobs } from "#/job/server/schema";
import { db } from "#/db";

export const getBoard = os.handler(() => {
	const columnRows = db.select().from(columns).orderBy(asc(columns.position)).all();
	const placements = db.select().from(jobPlacements)
		.orderBy(asc(jobPlacements.position)).all();
	return {
		columns: columnRows.map((column) => ({
			...column,
			jobIds: placements.filter((placement) => placement.columnId === column.id)
				.map((placement) => placement.jobId),
		})),
	};
});

export const addJob = os.input(z.object({
	columnId: z.number().int().positive(),
	title: z.string().trim().min(1),
	description: z.string().nullable().default(null),
})).handler(({ input }) => db.transaction((tx) => {
	const column = tx.select({ id: columns.id }).from(columns)
		.where(eq(columns.id, input.columnId)).get();
	if (!column) throw new ORPCError("NOT_FOUND");
	const job = tx.insert(jobs).values({
		title: input.title,
		description: input.description,
	}).returning().get();
	const placement = tx.select({ position: jobPlacements.position })
		.from(jobPlacements).where(eq(jobPlacements.columnId, input.columnId))
		.orderBy(asc(jobPlacements.position)).all();
	tx.insert(jobPlacements).values({
		jobId: job.id,
		columnId: input.columnId,
		position: placement.length,
	}).run();
	return { ...job, workflow: workflow(job.id) };
}));

export const moveJob = os.input(z.object({
	jobId: z.number().int().positive(),
	columnId: z.number().int().positive(),
	index: z.number().int().nonnegative(),
})).handler(({ input }) => db.transaction((tx) => {
	const placement = tx.select().from(jobPlacements)
		.where(eq(jobPlacements.jobId, input.jobId)).get();
	const destination = tx.select({ id: columns.id }).from(columns)
		.where(eq(columns.id, input.columnId)).get();
	if (!placement || !destination) throw new ORPCError("NOT_FOUND");

	const placements = tx.select().from(jobPlacements)
		.orderBy(asc(jobPlacements.position)).all();
	const sourceIds = placements.filter((item) => item.columnId === placement.columnId && item.jobId !== input.jobId)
		.map((item) => item.jobId);
	const destinationIds = placement.columnId === input.columnId
		? sourceIds
		: placements.filter((item) => item.columnId === input.columnId).map((item) => item.jobId);
	destinationIds.splice(Math.min(input.index, destinationIds.length), 0, input.jobId);

	if (placement.columnId !== input.columnId) {
		for (const [position, jobId] of sourceIds.entries()) {
			tx.update(jobPlacements).set({ position })
				.where(eq(jobPlacements.jobId, jobId)).run();
		}
	}
	for (const [position, jobId] of destinationIds.entries()) {
		tx.update(jobPlacements).set({ columnId: input.columnId, position })
			.where(eq(jobPlacements.jobId, jobId)).run();
	}
	return { success: true };
}));

export const boardRouter = {
	get: getBoard,
	addJob,
	moveJob,
};
