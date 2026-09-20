import { Outlet } from '@tanstack/react-router'
import { DetailLayout } from '#/components/DetailLayout'
import { useQuery } from '@tanstack/react-query'
import { boardQueryOptions } from '#/board/queries/board-query-options'
import { Column } from './Column'

export function ColumnLayout({ columnId }: { columnId: number }) {
  const board = useQuery(boardQueryOptions)
  const column = board.data?.columns.find((item) => item.id === columnId)
  if (!column) return <div className="p-5 text-[#8892b0]">Loading column…</div>

  return <section className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
    <DetailLayout title={column.name} closeTo="/" closeLabel="Close column">
      <Column column={column} jobDndId={(id) => `job:${id}`} group="column" fullPage />
    </DetailLayout>
    <Outlet />
  </section>
}
