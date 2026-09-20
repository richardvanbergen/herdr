import { orpc } from "#/orpc/client";

/**
 * The canonical TanStack Query options for one job. oRPC owns the query key
 * and transport; callers supply only the job ID and lazy-load eligibility.
 */
export function jobQueryOptions(jobId: number, enabled: boolean) {
	return orpc.job.get.queryOptions({
		enabled,
		input: { id: jobId },
		staleTime: 60_000,
	});
}
