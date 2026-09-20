import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { boardQueryOptions } from '#/board/queries/board-query-options'
import { client } from '#/orpc/client'
import { Board } from './Board'
import type { BoardColumn, BoardView } from '#/board/board-types'

function moveJobId(columns: BoardColumn[], jobId: number, columnId: number, index: number) {
  const source = columns.find((column) => column.jobIds.includes(jobId))
  const destination = columns.find((column) => column.id === columnId)
  if (!source || !destination) return columns
  const sourceIds = source.jobIds.filter((id) => id !== jobId)
  const destinationIds = source.id === columnId ? sourceIds : [...destination.jobIds]
  destinationIds.splice(Math.min(index, destinationIds.length), 0, jobId)
  return columns.map((column) => {
    if (column.id === source.id && column.id === columnId) return { ...column, jobIds: destinationIds }
    if (column.id === source.id) return { ...column, jobIds: sourceIds }
    if (column.id === columnId) return { ...column, jobIds: destinationIds }
    return column
  })
}

export function BoardContainer() {
  const queryClient = useQueryClient()
  const { data: board } = useSuspenseQuery(boardQueryOptions)
  const move = useMutation({
    mutationFn: (input: { jobId: number; columnId: number; index: number }) => client.board.moveJob(input),
    scope: { id: 'board-order' },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: boardQueryOptions.queryKey })
      const previous = queryClient.getQueryData<BoardView>(boardQueryOptions.queryKey)
      queryClient.setQueryData<BoardView>(boardQueryOptions.queryKey, (current) => current
        ? { columns: moveJobId(current.columns, input.jobId, input.columnId, input.index) }
        : current)
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(boardQueryOptions.queryKey, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardQueryOptions.queryKey }),
  })

  return <Board
    board={board}
    onMoveJob={(jobId, columnId, index) => move.mutate({ jobId, columnId, index })}
  />
}
