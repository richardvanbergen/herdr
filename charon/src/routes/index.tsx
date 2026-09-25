import { createFileRoute } from '@tanstack/react-router'

import { BoardContainer } from '#/board/components/BoardContainer'
import { boardQueryOptions } from '#/board/queries/board-query-options'
import { jobQueryOptions } from '#/job/queries/job-query-options'

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    const board = await context.queryClient.ensureQueryData(boardQueryOptions)
    await Promise.all(board.columns.flatMap((column) => column.jobIds).map((id) =>
      context.queryClient.ensureQueryData(jobQueryOptions(id, true))))
  },
  component: BoardPage,
})

function BoardPage() {
  return <BoardContainer />
}
