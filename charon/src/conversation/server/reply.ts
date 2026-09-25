import { contextActionInstruction } from "#/context/actions";
import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "#/db";
import { getRunner, type RunnerId } from "#/agent/registry";
import { jobs } from "#/job/server/schema";
import { tasks } from "#/task/server/schema";
import { conversationMessages, conversationThreads } from "./schema";
import { jobContextPrompt } from "#/context/server/prompt";

const input = z.object({
	threadId: z.number().int().positive(),
	content: z.string().trim().min(1).max(30_000),
});

export type ReplyEvent =
	| { type: "started"; messageId: number }
	| { type: "status"; message: string }
	| { type: "text"; delta: string }
	| { type: "completed"; messageId: number; output: string }
	| { type: "failed"; message: string };

export const replyToThread = createServerFn({ method: "POST" })
	.validator(input)
	.handler(async function* ({ data }): AsyncGenerator<ReplyEvent> {
		const thread = db
			.select()
			.from(conversationThreads)
			.where(eq(conversationThreads.id, data.threadId))
			.get();
		if (!thread) throw new Error("Conversation not found");
		const task = db
			.select()
			.from(tasks)
			.where(eq(tasks.id, thread.taskId))
			.get();
		const job =
			task && db.select().from(jobs).where(eq(jobs.id, task.jobId)).get();
		if (!task || !job) throw new Error("Conversation context not found");

		const actionInstruction = contextActionInstruction(
			data.content,
			task.useJobContext,
			thread.runner,
		);

		const human = db
			.insert(conversationMessages)
			.values({
				threadId: thread.id,
				role: "human",
				content: data.content,
				createdAt: Date.now(),
			})
			.returning()
			.get();
		if (thread.title === "New conversation") {
			db.update(conversationThreads)
				.set({ title: data.content.slice(0, 60) })
				.where(eq(conversationThreads.id, thread.id))
				.run();
		}
		yield { type: "started", messageId: human.id };

		const history = db
			.select()
			.from(conversationMessages)
			.where(eq(conversationMessages.threadId, thread.id))
			.orderBy(asc(conversationMessages.id))
			.all();
		let output = "";
		try {
			const prompt = [
				"You are discussing this task with the human. Use the project workspace as context when useful.",
				`Job: ${job.title}\n${job.description ?? ""}`,
				`Task: ${task.text}`,
				jobContextPrompt(task),
				actionInstruction,
				"Conversation:",
				...history.map(
					(message) =>
						`${message.role === "human" ? "Human" : "Assistant"}: ${message.content}`,
				),
				"Assistant:",
			]
				.filter(Boolean)
				.join("\n\n");
			for await (const event of getRunner(thread.runner as RunnerId).run(
				prompt,
				AbortSignal.timeout(10 * 60 * 1000),
			)) {
				if (event.type === "text") {
					output += event.delta;
					yield event;
				} else if (event.type === "status") yield event;
			}
			if (!output.trim()) throw new Error("Agent completed without a reply");
			const agent = db
				.insert(conversationMessages)
				.values({
					threadId: thread.id,
					role: "agent",
					content: output,
					createdAt: Date.now(),
				})
				.returning()
				.get();
			yield { type: "completed", messageId: agent.id, output };
		} catch (error) {
			yield {
				type: "failed",
				message:
					error instanceof Error ? error.message : "Could not complete reply",
			};
		}
	});
