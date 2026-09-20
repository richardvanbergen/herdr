import { Outlet, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { jobQueryOptions } from '#/job/queries/job-query-options'
import { boardQueryOptions } from '#/board/queries/board-query-options'
import { DetailLayout } from '#/components/DetailLayout'
import { client } from '#/orpc/client'
import { JobLoader } from './Job'

export function JobLayout({ columnId, jobId }: { columnId: number; jobId: number }) {
  const job = useQuery(jobQueryOptions(jobId, true))
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => client.job.delete({ id: jobId }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: jobQueryOptions(jobId, true).queryKey })
      await queryClient.invalidateQueries({ queryKey: boardQueryOptions.queryKey })
      await navigate({ to: '/column/$columnId', params: { columnId: String(columnId) } })
    },
  })

  return <section className="absolute inset-x-0 top-14 bottom-0 z-20">
    <DetailLayout nested title={job.data?.title ?? 'Job'} closeTo="/column/$columnId" closeParams={{ columnId: String(columnId) }} closeLabel="Close job"
      actions={<button type="button" className="text-sm text-[#8892b0] hover:text-[#ff00aa]" disabled={remove.isPending} onClick={() => remove.mutate()}>Delete job</button>}>
      <JobLoader jobId={jobId} columnId={columnId} eager fullPage />
      {remove.isError ? <p role="status" className="text-sm text-[#ff00aa]">Could not delete job.</p> : null}
    </DetailLayout>
    <Outlet />
  </section>
}
