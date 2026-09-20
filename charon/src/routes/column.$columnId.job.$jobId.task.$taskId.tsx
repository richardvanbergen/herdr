import { createFileRoute, notFound } from '@tanstack/react-router'
import { taskQueryOptions } from '#/task/queries/task-query-options'
import { TaskPage } from '#/task/components/TaskPage'

export const Route = createFileRoute('/column/$columnId/job/$jobId/task/$taskId')({
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
  return <TaskPage columnId={columnId} jobId={jobId} taskId={taskId} />
}
