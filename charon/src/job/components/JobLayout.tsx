import { Outlet, useNavigate, useMatches } from "@tanstack/react-router";
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
	const nested = useMatches().some(
		(match) => match.routeId === "/column/$columnId/job/$jobId/task/$taskId",
	);
	const job = useQuery(jobQueryOptions(jobId, true));
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const remove = useMutation({
		mutationFn: () => client.job.delete({ id: jobId }),
		onSuccess: async () => {
			queryClient.removeQueries({
				queryKey: jobQueryOptions(jobId, true).queryKey,
			});
			await queryClient.invalidateQueries({
				queryKey: boardQueryOptions.queryKey,
			});
			await navigate({
				to: "/column/$columnId",
				params: { columnId: String(columnId) },
			});
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
					onClick={() => remove.mutate()}
				>
					Delete job
				</button>
			}
		>
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				<JobLoader jobId={jobId} columnId={columnId} eager fullPage />
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
