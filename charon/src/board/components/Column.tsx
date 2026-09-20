import { JobLoader, SortableJob } from '#/job/components/Job'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { boardQueryOptions } from '#/board/queries/board-query-options'
import { jobQueryOptions } from '#/job/queries/job-query-options'
import { client } from '#/orpc/client'
import { cn } from '#/lib/utils'
import { ItemList } from '#/components/ItemList'
import type { BoardView } from '#/board/board-types'

import type { BoardColumn } from '#/board/board-types'

export interface ColumnProps {
  jobDndId: (jobId: number) => string
  column: BoardColumn
  group: string
  fullPage?: boolean
}

export function Column({ jobDndId, column, group, fullPage = false }: ColumnProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const add = useMutation({
    mutationFn: () => client.board.addJob({ columnId: column.id, title: 'New job', description: null }),
    onSuccess: async (job) => {
      queryClient.setQueryData(jobQueryOptions(job.id, true).queryKey, job)
      queryClient.setQueryData<BoardView>(boardQueryOptions.queryKey, (current) => current ? {
        columns: current.columns.map((item) => item.id === column.id ? { ...item, jobIds: [...item.jobIds, job.id] } : item),
      } : current)
      await navigate({ to: '/column/$columnId/job/$jobId', params: { columnId: String(column.id), jobId: String(job.id) } })
      void queryClient.invalidateQueries({ queryKey: boardQueryOptions.queryKey })
    },
  })
  return (
    <section className={cn('flex w-80 shrink-0 flex-col overflow-hidden rounded-lg border border-[#1b2745] bg-[#090d1d]/70', fullPage && 'h-full w-full rounded-none border-0 bg-[#090d1d]')}>
      {!fullPage ? <header className="flex items-center justify-between border-b border-[#1b2745] bg-[#090d1d]/50 p-4">
        <h2 className="m-0 text-sm font-semibold">{column.name}</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-none bg-[#121a30] px-2 py-0.5 text-xs text-[#8892b0]">{column.jobIds.length}</span>
          <Link className="rounded-none px-1.5 py-0.5 text-[#8892b0] hover:bg-[#121a30] hover:text-[#00d4ff] focus-visible:outline focus-visible:outline-[#00d4ff]" to="/column/$columnId" params={{ columnId: String(column.id) }} aria-label={`Open ${column.name}`}>↗</Link>
        </div>
      </header> : null}
      <ItemList className={cn('min-h-0 flex-1 gap-3 overflow-y-auto p-3', fullPage && 'gap-0 p-0')}>
        {column.jobIds.length === 0 ? <div className={cn('py-8 text-center text-sm text-[#8892b0]', fullPage && 'py-12')}>
          <p className="font-medium text-[#00ff88]">All clear here ✨</p>
          <p className="mt-1">{column.name === 'Backlog' ? 'Nothing in the queue yet.' : 'No jobs here yet.'}</p>
        </div> : null}
        {column.jobIds.map((jobId, index) => (
          fullPage ? <JobLoader jobId={jobId} columnId={column.id} eager flat key={jobId} /> : <SortableJob
            jobId={jobId}
            columnId={column.id}
            dndId={jobDndId(jobId)}
            group={group}
            index={index}
            key={jobId}
          />
        ))}
      </ItemList>
      <div className={cn('border-t border-[#1b2745] p-3', fullPage && 'px-0 py-3')}>
        <button type="button" className="w-full rounded-none border border-[#1b2745] bg-[#090d1d] px-3 py-2 text-left text-sm text-[#8892b0] hover:border-[#00d4ff] hover:text-[#e8eaf6]"
          disabled={add.isPending} onClick={() => add.mutate()}>+ Add job</button>
        {add.isError ? <span className="text-xs text-[#ff00aa]" role="status">Could not add job. Edit to retry.</span> : null}
      </div>
    </section>
  )
}
