import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { requireActiveJob } from "#/job/server/active";
import { tasks } from "./schema";

export function requireActiveTask(id: number) {
	const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
	if (!task) throw new ORPCError("NOT_FOUND");
	requireActiveJob(task.jobId);
	return task;
}
