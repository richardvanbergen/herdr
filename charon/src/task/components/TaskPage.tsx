import { JobWorkflow } from "#/workflow/components/JobWorkflow";
import { JobContext } from "#/context/components/JobContext";
import { TaskWorkspaceView, type TaskPanel } from "./TaskWorkspaceView";
import {
	TaskOutputView,
	LiveToolActivity,
	type LiveRun,
} from "./TaskOutputView";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskQueryOptions } from "#/task/queries/task-query-options";
import { client } from "#/orpc/client";
import { TaskDetail } from "./TaskList";
import { runTaskStream } from "#/task/server/run-task";
import type { RunnerId } from "#/agent/registry";
import type { Task } from "#/task/server/schema";
import { useState } from "react";
import { TaskRunDebug } from "./TaskRunDebug";
import { taskRunQueryOptions } from "#/task/queries/task-run-query-options";
import { TaskConversation } from "#/conversation/components/TaskConversation";
import { TaskContextReference } from "#/context/components/TaskContextReference";
import { contextQueryOptions } from "#/context/queries/context-query-options";

export function TaskPage({
	columnId,
	jobId,
	taskId,
	threadId,
	panel = "output",
}: {
	columnId: number;
	jobId: number;
	taskId: number;
	threadId?: number;
	panel?: TaskPanel;
}) {
	const tasks = useQuery({ ...taskQueryOptions(jobId), refetchInterval: 5000 });
	const task = tasks.data?.find((item) => item.id === taskId);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [live, setLive] = useState<LiveRun | null>(null);
	async function runTask(text: string, runner: RunnerId) {
		setLive({ phase: "running", status: "Starting…", output: "", tools: [] });
		queryClient.setQueryData<Task[]>(
			taskQueryOptions(jobId).queryKey,
			(current) =>
				current?.map((item) =>
					item.id === taskId ? { ...item, text, output: null } : item,
				),
		);
		try {
			let finished = false;
			for await (const event of await runTaskStream({
				data: { id: taskId, text, runner },
			})) {
				if (event.type === "started")
					void queryClient.invalidateQueries({
						queryKey: taskRunQueryOptions(taskId).queryKey,
					});
				if (event.type === "status")
					setLive(
						(current) => current && { ...current, status: event.message },
					);
				else if (event.type === "text")
					setLive(
						(current) =>
							current && {
								...current,
								status: "Writing…",
								output: current.output + event.delta,
							},
					);
				else if (event.type === "tool")
					setLive(
						(current) =>
							current && {
								...current,
								status:
									event.status === "running"
										? `Using ${event.name}…`
										: "Thinking…",
								tools: [
									...current.tools.filter((tool) => tool.id !== event.id),
									event,
								],
							},
					);
				else if (event.type === "completed") {
					finished = true;
					setLive(
						(current) =>
							current && {
								...current,
								phase: "completed",
								status: "Completed",
								output: event.output,
							},
					);
					queryClient.setQueryData<Task[]>(
						taskQueryOptions(jobId).queryKey,
						(current) =>
							current?.map((item) =>
								item.id === taskId ? { ...item, output: event.output } : item,
							),
					);
				} else if (event.type === "failed") {
					finished = true;
					setLive(
						(current) =>
							current && {
								...current,
								phase: "failed",
								status: "Failed",
								error: event.message,
							},
					);
				}
			}
			if (!finished)
				setLive(
					(current) =>
						current && {
							...current,
							phase: "failed",
							status: "Failed",
							error: "Run stream ended before completion",
						},
				);
		} catch (error) {
			setLive(
				(current) =>
					current && {
						...current,
						phase: "failed",
						status: "Failed",
						error:
							error instanceof Error
								? error.message
								: "Could not start task run",
					},
			);
		} finally {
			void queryClient.invalidateQueries({
				queryKey: contextQueryOptions(jobId).queryKey,
			});
			void queryClient.invalidateQueries({
				queryKey: taskRunQueryOptions(taskId).queryKey,
			});
		}
	}
	const remove = useMutation({
		mutationFn: () => client.task.delete({ id: taskId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: taskQueryOptions(jobId).queryKey,
			});
			await navigate({
				to: "/column/$columnId/job/$jobId",
				params: { columnId: String(columnId), jobId: String(jobId) },
			});
		},
	});

	if (!task) return <p className="p-4 text-muted-foreground">Loading task…</p>;
	return (
		<TaskWorkspaceView
			title={task.text}
			taskId={task.id}
			status={live?.status ?? (task.output ? "Output saved" : "Ready")}
			panel={panel}
			onPanelChange={(panel) => {
				void navigate({
					to: "/column/$columnId/job/$jobId/task/$taskId",
					params: {
						columnId: String(columnId),
						jobId: String(jobId),
						taskId: String(taskId),
					},
					search: (previous) => ({ ...previous, panel }),
				});
			}}
			onDelete={() => remove.mutate()}
			deleting={remove.isPending}
			deleteError={remove.isError}
			editor={
				<TaskDetail
					key={task.id}
					task={task}
					onRun={runTask}
					isRunning={live?.phase === "running"}
				/>
			}
			output={<TaskOutputView output={task.output} live={live} />}
			discussion={
				<>
					<JobWorkflow jobId={jobId} taskId={taskId} />
					<details className="mt-6">
						<summary className="text-sm text-muted-foreground">
							Direct runner conversations
						</summary>
						<TaskConversation
							useJobContext={task.useJobContext}
							columnId={columnId}
							jobId={jobId}
							taskId={taskId}
							threadId={threadId}
						/>
					</details>
				</>
			}
			activity={
				<>
					<LiveToolActivity live={live} />
					<TaskRunDebug taskId={taskId} />
				</>
			}
			context={
				<>
					<TaskContextReference task={task} columnId={columnId} />
					<JobContext jobId={jobId} columnId={columnId} />
				</>
			}
		/>
	);
}
