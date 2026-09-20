import { Link, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { taskQueryOptions } from '#/task/queries/task-query-options'
import type { Task } from '#/task/server/schema'
import { client } from '#/orpc/client'
import { ItemList } from '#/components/ItemList'
import { Item, ItemContent } from '#/components/ui/item'

const taskInputClass = 'w-full border border-transparent bg-transparent p-2 text-sm text-[#e8eaf6] outline-none placeholder:text-[#8892b0] focus:border-[#00d4ff]'

function TaskRow({ task, columnId }: { task: Task; columnId?: number }) {
  const content = <span className="block min-w-0"><span className="block truncate text-sm text-[#8892b0]">{task.text}</span>
    {task.output ? <span className="mt-1 block truncate text-xs text-[#00d4ff]">{task.output}</span> : null}</span>

  return <li className="min-w-0">
    <Item className="border-x-0 border-t-0 p-3">
    {columnId === undefined ? content : <Link
      className="min-w-0 flex-1 focus-visible:outline focus-visible:outline-[#00d4ff]"
      to="/column/$columnId/job/$jobId/task/$taskId"
      params={{ columnId: String(columnId), jobId: String(task.jobId), taskId: String(task.id) }}
      aria-label={`Open task ${task.text}`}
    >{content}</Link>}
    </Item>
  </li>
}

export function TaskDetail({ task }: { task: Task }) {
  const queryClient = useQueryClient()
  const queryKey = taskQueryOptions(task.jobId).queryKey
  const update = useMutation({
    mutationFn: (text: string) => client.task.update({ id: task.id, text }),
    scope: { id: `task-${task.id}` },
    onSuccess: (saved) => queryClient.setQueryData<Task[]>(queryKey, (current) =>
      current?.map((item) => item.id === saved.id ? saved : item)),
  })
  const run = useMutation({
    mutationFn: (text: string) => client.task.run({ id: task.id, text }),
    scope: { id: `task-${task.id}` },
    onSuccess: (saved) => queryClient.setQueryData<Task[]>(queryKey, (current) =>
      current?.map((item) => item.id === saved.id ? saved : item)),
  })
  const form = useForm({
    defaultValues: { text: task.text },
    validators: { onChange: ({ value }) => value.text.trim() ? undefined : 'Task is required' },
    listeners: {
      onChangeDebounceMs: 600,
      onChange: ({ formApi }) => {
        if (formApi.state.isValid) void formApi.handleSubmit()
      },
    },
    onSubmit: ({ value }) => update.mutate(value.text.trim()),
  })

  return <Item className="items-stretch"><ItemContent>
    <form.Field name="text">
      {(field) => <textarea
        aria-label="Task text"
        autoFocus={task.text === 'New task'}
        onFocus={(event) => { if (task.text === 'New task') event.currentTarget.select() }}
        className={`${taskInputClass} min-h-40 resize-y text-base`}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />}
    </form.Field>
    <div className="flex justify-end pt-2">
      <button type="button" disabled={run.isPending || !form.state.values.text.trim()} onClick={() => run.mutate(form.state.values.text.trim())}
        className="border border-[#00d4ff] px-3 py-1.5 text-sm text-[#00d4ff] hover:bg-[#00d4ff]/10 disabled:cursor-not-allowed disabled:opacity-50">
        {run.isPending ? 'Running…' : '▶ Run task'}
      </button>
    </div>
    {run.isError ? <span className="text-xs text-[#ff00aa]" role="status">Task run failed: {run.error.message}</span> : null}
    {update.isError ? <span className="text-xs text-[#ff00aa]" role="status">Task save failed.</span> : null}
  </ItemContent></Item>
}

export function TaskList({ jobId, columnId }: { jobId: number; columnId?: number }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const queryKey = taskQueryOptions(jobId).queryKey
  const tasks = useQuery(taskQueryOptions(jobId))
  const create = useMutation({
    mutationFn: () => client.task.create({ jobId, text: 'New task' }),
    onSuccess: async (task) => {
      queryClient.setQueryData<Task[]>(queryKey, (current) => current ? [...current, task] : [task])
      if (columnId !== undefined) {
        await navigate({ to: '/column/$columnId/job/$jobId/task/$taskId', params: {
          columnId: String(columnId), jobId: String(jobId), taskId: String(task.id),
        } })
      }
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  return <div className="mt-2 border-t border-[#1b2745]">
    {tasks.isError ? <span className="text-xs text-[#ff00aa]" role="status">Could not load tasks.</span> : null}
    {tasks.data?.length ? <ItemList><ul className="m-0 list-none p-0">{tasks.data.map((task) => <TaskRow key={task.id} task={task} columnId={columnId} />)}</ul></ItemList> : null}
    {columnId !== undefined ? <button type="button" className="w-full px-3 py-2 text-left text-sm text-[#8892b0] hover:bg-[#121a30] hover:text-[#e8eaf6]"
      disabled={create.isPending} onClick={() => create.mutate()}>+ Add task</button> : null}
    {create.isError ? <span className="text-xs text-[#ff00aa]" role="status">Could not add task. Edit to retry.</span> : null}
  </div>
}
