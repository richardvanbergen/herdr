import { useQuery } from "@tanstack/react-query";
import { taskRunQueryOptions } from "../queries/task-run-query-options";
import { TaskRunHistoryView } from "./TaskRunHistoryView";
export function TaskRunDebug({ taskId }: { taskId: number }) {
	const runs = useQuery(taskRunQueryOptions(taskId));
	return (
		<TaskRunHistoryView
			runs={runs.data ?? []}
			loading={runs.isPending}
			refreshing={runs.isFetching}
			error={runs.error?.message}
			onRefresh={() => {
				void runs.refetch();
			}}
		/>
	);
}
