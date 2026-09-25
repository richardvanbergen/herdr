import { orpc } from "#/orpc/client";

export const contextQueryOptions = (jobId: number) =>
	orpc.context.list.queryOptions({ input: { jobId } });
export const contextFileQueryOptions = (jobId: number, path: string) =>
	orpc.context.read.queryOptions({ input: { jobId, path } });
