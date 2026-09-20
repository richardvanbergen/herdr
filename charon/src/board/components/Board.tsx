import {
  DragDropProvider,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
} from '@dnd-kit/react'
import { PointerActivationConstraints } from '@dnd-kit/dom'
import { isSortable } from '@dnd-kit/react/sortable'

import { JobLoader } from '#/job/components/Job'

import { Column } from './Column'

import type { BoardView } from '#/board/board-types'

export interface BoardProps {
  board: BoardView
  onMoveJob: (jobId: number, destinationColumnId: number, destinationIndex: number) => void
}

function jobDndId(jobId: number) {
  return `job:${jobId}`
}

function columnGroup(columnId: number) {
  return `column:${columnId}`
}

function columnIdFromGroup(group: string | number | undefined) {
  if (typeof group !== 'string' || !group.startsWith('column:')) return null

  const columnId = Number(group.slice('column:'.length))
  return Number.isInteger(columnId) ? columnId : null
}

/** DnD owns only ordered job IDs; each job resolves its own queried content. */
export function Board({ board, onMoveJob }: BoardProps) {
  function handleDragEnd({ operation }: DragEndEvent) {
    const source = operation.source
    if (operation.canceled || !source || !isSortable(source)) return

    const jobId = source.data.jobId
    const destinationColumnId = columnIdFromGroup(source.group)
    if (typeof jobId !== 'number' || destinationColumnId === null) return

    requestAnimationFrame(() => {
      onMoveJob(jobId, destinationColumnId, source.index)
    })
  }

  return (
    <DragDropProvider
      onDragEnd={handleDragEnd}
      sensors={[
        PointerSensor.configure({
          activationConstraints: [
            new PointerActivationConstraints.Distance({ value: 6 }),
          ],
        }),
        KeyboardSensor,
      ]}
    >
      <div className="flex min-w-0 flex-1">
        <div className="flex flex-1 items-start gap-4 overflow-x-auto px-6 py-5 overscroll-x-contain">
          {board.columns.map((column) => (
            <Column
              jobDndId={jobDndId}
              column={column}
              group={columnGroup(column.id)}
              key={column.id}
            />
          ))}
        </div>
      </div>

      <DragOverlay className="cursor-grabbing shadow-2xl" dropAnimation={null}>
        {(source) => {
          const jobId = source.data.jobId
          return typeof jobId === 'number' ? <JobLoader jobId={jobId} eager /> : null
        }}
      </DragOverlay>
    </DragDropProvider>
  )
}
