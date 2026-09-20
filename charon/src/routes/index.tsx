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
  return <div className="flex min-h-dvh flex-col">
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#1b2745] bg-[#090d1d] px-6">
      <div className="text-lg font-bold tracking-tight text-[#00ff88]">Charon</div>
      <nav className="flex items-center gap-4">
        <span className="text-sm text-[#8892b0]">ready</span>
      </nav>
    </header>
    <main className="flex min-h-0 flex-1"><BoardContainer /></main>
  </div>
}
