import { createFileRoute, notFound } from '@tanstack/react-router'
import { taskQueryOptions } from '#/task/queries/task-query-options'
import type { TaskPanel } from '#/task/components/TaskWorkspaceView'
import { TaskPage } from '#/task/components/TaskPage'

export const Route = createFileRoute('/column/$columnId/job/$jobId/task/$taskId')({
  validateSearch: (search): { thread?: number; panel?: TaskPanel } => {
    const thread = Number(search.thread)
    const panel = ['output', 'discussion', 'activity', 'context'].includes(String(search.panel)) ? search.panel as TaskPanel : undefined
    return { thread: Number.isSafeInteger(thread) && thread > 0 ? thread : undefined, panel }
  },
  loader: async ({ context, params }) => {
    const columnId = Number(params.columnId)
    const jobId = Number(params.jobId)
    const taskId = Number(params.taskId)
    if (!Number.isSafeInteger(taskId) || taskId <= 0) throw notFound()
    const tasks = await context.queryClient.ensureQueryData(taskQueryOptions(jobId))
    if (!tasks.some((task) => task.id === taskId)) throw notFound()
    return { columnId, jobId, taskId }
  },
  component: TaskRoute,
})

function TaskRoute() {
  const { columnId, jobId, taskId } = Route.useLoaderData()
  const { thread, panel } = Route.useSearch()
  return <TaskPage key={taskId} panel={panel} columnId={columnId} jobId={jobId} taskId={taskId} threadId={thread} />
}
