import { useState } from "react";
import { DeleteJobDialog } from "./DeleteJobDialog";
import type { BoardView } from "#/board/board-types";
import { JobWorkflow } from "#/workflow/components/JobWorkflow";
import {
	Outlet,
	useNavigate,
	useMatches,
	useRouter,
} from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { jobQueryOptions } from "#/job/queries/job-query-options";
import { boardQueryOptions } from "#/board/queries/board-query-options";
import { DetailLayout } from "#/components/DetailLayout";
import { client } from "#/orpc/client";
import { JobLoader } from "./Job";
import { JobContext } from "#/context/components/JobContext";

export function JobLayout({
	columnId,
	jobId,
	contextFile,
}: {
	columnId: number;
	jobId: number;
	contextFile?: string;
}) {
	const nested = useMatches().some((match) =>
		match.routeId.startsWith("/column/$columnId/job/$jobId/task/"),
	);
	const job = useQuery(jobQueryOptions(jobId, true));
	const navigate = useNavigate();
	const router = useRouter();
	const [confirmDelete, setConfirmDelete] = useState(false);
	const queryClient = useQueryClient();
	const remove = useMutation({
		mutationFn: () => client.job.delete({ id: jobId }),
		scope: { id: `job-${jobId}` },
		onSuccess: async () => {
			await queryClient.cancelQueries({ queryKey: boardQueryOptions.queryKey });
			queryClient.setQueryData<BoardView>(
				boardQueryOptions.queryKey,
				(board) =>
					board && {
						columns: board.columns.map((column) => ({
							...column,
							jobIds: column.jobIds.filter((id) => id !== jobId),
						})),
					},
			);
			await navigate({
				to: "/column/$columnId",
				params: { columnId: String(columnId) },
				replace: true,
			});
			// The deleted page has unmounted; clearing its cache cannot restart its queries.
			queryClient.removeQueries({
				queryKey: jobQueryOptions(jobId, true).queryKey,
			});
			await queryClient.invalidateQueries({
				queryKey: boardQueryOptions.queryKey,
			});
			await router.invalidate();
		},
	});

	if (nested) return <Outlet />;
	return (
		<DetailLayout
			title={job.data?.title ?? "Job"}
			actions={
				<button
					type="button"
					className="text-xs text-muted-foreground hover:text-destructive"
					disabled={remove.isPending}
					onClick={() => {
						remove.reset();
						setConfirmDelete(true);
					}}
				>
					Delete job
				</button>
			}
		>
			<DeleteJobDialog
				title={job.data?.title ?? "Job"}
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				pending={remove.isPending}
				onConfirm={() => remove.mutate()}
				error={remove.error?.message}
			/>
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				<div className="space-y-8">
					<JobLoader jobId={jobId} columnId={columnId} eager fullPage />
					<JobWorkflow jobId={jobId} />
				</div>
				<JobContext jobId={jobId} columnId={columnId} selected={contextFile} />
			</div>
			{remove.isError ? (
				<p role="status" className="text-sm text-destructive">
					Could not delete job.
				</p>
			) : null}
		</DetailLayout>
	);
}
