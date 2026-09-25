import { ContextReferenceView } from "./ContextReferenceView";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "#/orpc/client";
import { taskQueryOptions } from "#/task/queries/task-query-options";
import type { Task } from "#/task/server/schema";

export function TaskContextReference({
	task,
	columnId,
}: {
	task: Task;
	columnId: number;
}) {
	const queryClient = useQueryClient();
	const update = useMutation({
		mutationFn: (enabled: boolean) =>
			client.task.setJobContext({ id: task.id, enabled }),
		onSuccess: (saved) =>
			queryClient.setQueryData<Task[]>(
				taskQueryOptions(task.jobId).queryKey,
				(current) =>
					current?.map((item) => (item.id === saved.id ? saved : item)),
			),
	});
	return (
		<ContextReferenceView
			task={task}
			columnId={columnId}
			pending={update.isPending}
			error={update.error?.message}
			onChange={(enabled) => update.mutate(enabled)}
		/>
	);
}
