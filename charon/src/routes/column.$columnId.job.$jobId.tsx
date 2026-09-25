import { createFileRoute, notFound } from '@tanstack/react-router'
import { boardQueryOptions } from '#/board/queries/board-query-options'
import { jobQueryOptions } from '#/job/queries/job-query-options'
import { JobLayout } from '#/job/components/JobLayout'
import { contextQueryOptions } from '#/context/queries/context-query-options'

export const Route = createFileRoute('/column/$columnId/job/$jobId')({
  validateSearch: (search): { context?: string } => ({
    context: typeof search.context === 'string' && search.context.length <= 1000 ? search.context : undefined,
  }),
  loader: async ({ context, params }) => {
    const columnId = Number(params.columnId)
    const jobId = Number(params.jobId)
    if (!Number.isSafeInteger(jobId) || jobId <= 0) throw notFound()
    const board = await context.queryClient.ensureQueryData(boardQueryOptions)
    if (!board.columns.find((column) => column.id === columnId)?.jobIds.includes(jobId)) throw notFound()
    await context.queryClient.ensureQueryData(jobQueryOptions(jobId, true))
    await context.queryClient.ensureQueryData(contextQueryOptions(jobId))
    return { columnId, jobId }
  },
  component: JobRoute,
})

function JobRoute() {
  const { columnId, jobId } = Route.useLoaderData()
  const { context } = Route.useSearch()
  return <JobLayout columnId={columnId} jobId={jobId} contextFile={context} />
}
