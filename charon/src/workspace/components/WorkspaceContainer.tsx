import { Fragment } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { boardQueryOptions } from "#/board/queries/board-query-options";
import { jobQueryOptions } from "#/job/queries/job-query-options";
import { taskQueryOptions } from "#/task/queries/task-query-options";
import { WorkspaceView } from "./WorkspaceView";

export function WorkspaceContainer({ children }: { children: ReactNode }) {
	const params = useParams({ strict: false });
	const columnId = Number(params.columnId);
	const jobId = Number(params.jobId);
	const taskId = Number(params.taskId);
	const board = useQuery(boardQueryOptions);
	const job = useQuery({ ...jobQueryOptions(jobId, true), enabled: !!jobId });
	const tasks = useQuery({ ...taskQueryOptions(jobId), enabled: !!taskId });
	const column = board.data?.columns.find((item) => item.id === columnId);
	const task = tasks.data?.find((item) => item.id === taskId);
	const crumbs = [
		<Link
			key="board"
			to="/"
			className="shrink-0 text-muted-foreground hover:text-foreground"
		>
			Board
		</Link>,
	];
	if (params.columnId)
		crumbs.push(
			<Link
				key="column"
				to="/column/$columnId"
				params={{ columnId: params.columnId }}
				className="max-w-32 shrink-0 truncate text-muted-foreground hover:text-foreground"
			>
				{column?.name ?? "Column"}
			</Link>,
		);
	if (params.jobId && params.columnId)
		crumbs.push(
			<Link
				key="job"
				to="/column/$columnId/job/$jobId"
				params={{ columnId: params.columnId, jobId: params.jobId }}
				title={job.data?.title}
				className="max-w-48 shrink-0 truncate text-muted-foreground hover:text-foreground"
			>
				{job.data?.title ?? "Job"}
			</Link>,
		);
	if (params.taskId)
		crumbs.push(
			<span
				key="task"
				aria-current="page"
				title={task?.text}
				className="max-w-56 truncate font-medium"
			>
				{task?.text ?? "Task"}
			</span>,
		);
	return (
		<WorkspaceView
			breadcrumbs={crumbs.map((crumb, index) => (
				<Fragment key={index}>
					{index > 0 && (
						<ChevronRight className="size-3 shrink-0 text-muted-foreground/50" />
					)}
					{crumb}
				</Fragment>
			))}
		>
			{children}
		</WorkspaceView>
	);
}
