import { requireActiveTask } from "#/task/server/active";
import { ORPCError, os } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "#/db";
import { conversationMessages, conversationThreads } from "./schema";
import { runnerIds } from "#/agent/runner-options";

function requireActiveThread(id: number) {
	const thread = db
		.select()
		.from(conversationThreads)
		.where(eq(conversationThreads.id, id))
		.get();
	if (!thread) throw new ORPCError("NOT_FOUND");
	requireActiveTask(thread.taskId);
	return thread;
}
const id = z.number().int().positive();

export const conversationRouter = {
	listThreads: os.input(z.object({ taskId: id })).handler(({ input }) => {
		requireActiveTask(input.taskId);
		return db
			.select()
			.from(conversationThreads)
			.where(eq(conversationThreads.taskId, input.taskId))
			.orderBy(asc(conversationThreads.createdAt), asc(conversationThreads.id))
			.all();
	}),
	createThread: os
		.input(
			z.object({
				taskId: id,
				title: z.string().trim().min(1).max(120).default("New conversation"),
			}),
		)
		.handler(({ input }) => {
			requireActiveTask(input.taskId);
			return db
				.insert(conversationThreads)
				.values({
					taskId: input.taskId,
					title: input.title,
					createdAt: Date.now(),
				})
				.returning()
				.get();
		}),
	updateThread: os
		.input(z.object({ id, runner: z.enum(runnerIds) }))
		.handler(({ input }) => {
			requireActiveThread(input.id);
			const thread = db
				.update(conversationThreads)
				.set({ runner: input.runner })
				.where(eq(conversationThreads.id, input.id))
				.returning()
				.get();
			if (!thread) throw new ORPCError("NOT_FOUND");
			return thread;
		}),
	listMessages: os.input(z.object({ threadId: id })).handler(({ input }) => {
		requireActiveThread(input.threadId);
		return db
			.select()
			.from(conversationMessages)
			.where(eq(conversationMessages.threadId, input.threadId))
			.orderBy(asc(conversationMessages.id))
			.all();
	}),
};
