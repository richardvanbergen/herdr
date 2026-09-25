import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "#/db";
import { jobs } from "./schema";

export function requireActiveJob(id: number) {
	const job = db
		.select()
		.from(jobs)
		.where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
		.get();
	if (!job)
		throw new ORPCError("NOT_FOUND", { message: "Job not found or deleted." });
	return job;
}
