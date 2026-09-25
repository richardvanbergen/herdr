import { TaskEditorView } from "./TaskEditorView";
import { TaskListView } from "./TaskListView";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taskQueryOptions } from "#/task/queries/task-query-options";
import type { Task } from "#/task/server/schema";
import { client } from "#/orpc/client";
import { useState } from "react";
import type { RunnerId } from "#/agent/registry";

const taskInputClass =
	"w-full border border-border bg-white/[.025] p-3 text-xs leading-6 text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-primary/50";

export function TaskDetail({
	task,
	onRun,
	isRunning,
}: {
	task: Task;
	onRun: (text: string, runner: RunnerId) => void;
	isRunning: boolean;
}) {
	const queryClient = useQueryClient();
	const [runner, setRunner] = useState<RunnerId>("codex");
	const queryKey = taskQueryOptions(task.jobId).queryKey;
	const update = useMutation({
		mutationFn: (text: string) => client.task.update({ id: task.id, text }),
		scope: { id: `task-${task.id}` },
		onSuccess: (saved) =>
			queryClient.setQueryData<Task[]>(queryKey, (current) =>
				current?.map((item) => (item.id === saved.id ? saved : item)),
			),
	});
	const form = useForm({
		defaultValues: { text: task.text },
		validators: {
			onChange: ({ value }) =>
				value.text.trim() ? undefined : "Task is required",
		},
		listeners: {
			onChangeDebounceMs: 600,
			onChange: ({ formApi }) => {
				if (formApi.state.isValid) void formApi.handleSubmit();
			},
		},
		onSubmit: ({ value }) => update.mutate(value.text.trim()),
	});

	return (
		<form.Subscribe selector={(state) => !!state.values.text.trim()}>
			{(canRun) => (
				<TaskEditorView
					taskId={task.id}
					field={
						<form.Field name="text">
							{(field) => (
								<textarea
									aria-label="Task text"
									autoFocus={task.text === "New task"}
									onFocus={(event) => {
										if (task.text === "New task") event.currentTarget.select();
									}}
									className={`${taskInputClass} min-h-40 resize-y`}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
								/>
							)}
						</form.Field>
					}
					runner={runner}
					onRunnerChange={setRunner}
					onRun={() => onRun(form.state.values.text.trim(), runner)}
					isRunning={isRunning}
					canRun={canRun}
					saveError={update.isError}
				/>
			)}
		</form.Subscribe>
	);
}

export function TaskList({
	poll = false,
	jobId,
	columnId,
}: {
	jobId: number;
	columnId?: number;
	poll?: boolean;
}) {
	const navigate = useNavigate();
	const tasks = useQuery({
		...taskQueryOptions(jobId),
		refetchInterval: poll ? 5000 : false,
	});

	return (
		<TaskListView
			tasks={tasks.data ?? []}
			columnId={columnId}
			loadError={tasks.isError}
			adding={false}
			addError={false}
			onAdd={() => {
				if (columnId !== undefined)
					void navigate({
						to: "/column/$columnId/job/$jobId/task/new",
						params: { columnId: String(columnId), jobId: String(jobId) },
					});
			}}
		/>
	);
}
