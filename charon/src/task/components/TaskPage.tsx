import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { taskQueryOptions } from '#/task/queries/task-query-options'
import { DetailLayout } from '#/components/DetailLayout'
import { client } from '#/orpc/client'
import { TaskDetail } from './TaskList'

export function TaskPage({ columnId, jobId, taskId }: { columnId: number; jobId: number; taskId: number }) {
  const tasks = useQuery(taskQueryOptions(jobId))
  const task = tasks.data?.find((item) => item.id === taskId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => client.task.delete({ id: taskId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskQueryOptions(jobId).queryKey })
      await navigate({ to: '/column/$columnId/job/$jobId', params: { columnId: String(columnId), jobId: String(jobId) } })
    },
  })

  return <section className="absolute inset-x-0 top-14 bottom-0 z-30">
    <DetailLayout nested title={task?.text ?? 'Task'} closeTo="/column/$columnId/job/$jobId"
      closeParams={{ columnId: String(columnId), jobId: String(jobId) }} closeLabel="Close task"
      actions={<button type="button" className="text-sm text-[#8892b0] hover:text-[#ff00aa]" disabled={remove.isPending} onClick={() => remove.mutate()}>Delete task</button>}>
      {task ? <div className="flex flex-col gap-5"><TaskDetail task={task} />
        <section aria-label="Task output"><h2 className="mb-2 text-sm font-semibold text-[#e8eaf6]">Output</h2>
          <div className="border border-[#1b2745] bg-[#0b1022]/80 p-4 text-sm whitespace-pre-wrap text-[#8892b0]">
            {task.output ?? 'Run this task to see its output.'}
          </div>
        </section></div> : <p className="text-[#8892b0]">Loading task…</p>}
      {remove.isError ? <p role="status" className="text-sm text-[#ff00aa]">Could not delete task.</p> : null}
    </DetailLayout>
  </section>
}
