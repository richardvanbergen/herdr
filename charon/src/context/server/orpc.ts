import { requireActiveJob } from "#/job/server/active";
import { os } from "@orpc/server";
import * as z from "zod";
import {
	createContext,
	deleteContext,
	listContext,
	readContext,
	updateContext,
} from "./store";

const jobInput = z.object({ jobId: z.number().int().positive() });
const fileInput = jobInput.extend({ path: z.string().min(1).max(1000) });
const versionInput = fileInput.extend({ version: z.string().length(64) });
const textInput = z.object({
	type: z.literal("text"),
	title: z.string().trim().min(1).max(200),
	description: z.string().trim().max(2000),
	body: z.string().max(1_000_000),
});
function withJob<T>(jobId: number, action: () => T): T {
	requireActiveJob(jobId);
	return action();
}

export const contextRouter = {
	list: os
		.input(jobInput)
		.handler(({ input }) =>
			withJob(input.jobId, () => listContext(input.jobId)),
		),
	read: os
		.input(fileInput)
		.handler(({ input }) =>
			withJob(input.jobId, () => readContext(input.jobId, input.path)),
		),
	create: os
		.input(jobInput.extend({ content: textInput }))
		.handler(({ input }) =>
			withJob(input.jobId, () => createContext(input.jobId, input.content)),
		),
	update: os
		.input(versionInput.extend({ content: textInput }))
		.handler(({ input }) =>
			withJob(input.jobId, () =>
				updateContext(input.jobId, input.path, input.version, input.content),
			),
		),
	delete: os
		.input(versionInput)
		.handler(({ input }) =>
			withJob(input.jobId, () =>
				deleteContext(input.jobId, input.path, input.version),
			),
		),
};
