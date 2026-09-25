import { orpc } from "#/orpc/client";

export const taskRunQueryOptions = (taskId: number) =>
	orpc.task.runs.queryOptions({ input: { id: taskId } });
