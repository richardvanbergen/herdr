import { orpc } from "#/orpc/client";

export function taskQueryOptions(jobId: number) {
	return orpc.task.list.queryOptions({ input: { jobId } });
}
