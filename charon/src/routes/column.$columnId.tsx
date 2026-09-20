import { createFileRoute, notFound } from '@tanstack/react-router'
import { boardQueryOptions } from '#/board/queries/board-query-options'
import { ColumnLayout } from '#/board/components/ColumnLayout'

export const Route = createFileRoute('/column/$columnId')({
  loader: async ({ context, params }) => {
    const columnId = Number(params.columnId)
    if (!Number.isSafeInteger(columnId) || columnId <= 0) throw notFound()
    const board = await context.queryClient.ensureQueryData(boardQueryOptions)
    if (!board.columns.some((column) => column.id === columnId)) throw notFound()
    return { columnId }
  },
  component: ColumnRoute,
})

function ColumnRoute() {
  const { columnId } = Route.useLoaderData()
  return <ColumnLayout columnId={columnId} />
}
