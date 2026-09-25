import {
  DragDropProvider,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/react'
import { PointerActivationConstraints } from '@dnd-kit/dom'
import { isSortable } from '@dnd-kit/react/sortable'

import { useState } from 'react'
import { JobDragPreview, type JobDragPreviewData } from '#/job/components/JobDragPreview'

import { Column } from './Column'

import type { BoardView } from '#/board/board-types'

export interface BoardProps {
  board: BoardView
  getDragPreview: (jobId: number) => JobDragPreviewData
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
export function Board({ board, onMoveJob, getDragPreview }: BoardProps) {
  const [dropPosition, setDropPosition] = useState<{ columnId: number; index: number } | null>(null)
  const [dragPreview, setDragPreview] = useState<JobDragPreviewData | null>(null)
  function handleDragStart({ operation }: DragStartEvent) {
    const jobId = operation.source?.data.jobId
    setDragPreview(typeof jobId === 'number' ? getDragPreview(jobId) : null)
  }

  function handleDragOver(event: DragOverEvent) {
    const { source, target } = event.operation
    if (isSortable(source) && isSortable(target) && source.group !== target.group) {
      // OptimisticSortingPlugin reparents DOM nodes across lists. React still
      // owns those nodes under the original Column and would remove them there
      // on commit. Keep that parent intact; React moves the job after the drop.
      event.preventDefault()
    }
    const columnId = typeof target?.data.columnId === 'number'
      ? target.data.columnId
      : isSortable(target) ? columnIdFromGroup(target.group) : null
    const next = isSortable(source) && columnId !== null && columnId !== columnIdFromGroup(source.group)
      ? { columnId, index: isSortable(target) ? target.index : board.columns.find(column => column.id === columnId)?.jobIds.length ?? 0 }
      : null
    setDropPosition(current => current?.columnId === next?.columnId && current?.index === next?.index ? current : next)
  }

  function handleDragEnd({ operation }: DragEndEvent) {
    setDragPreview(null)
    setDropPosition(null)
    const source = operation.source
    if (operation.canceled || !source || !isSortable(source)) return

    const jobId = source.data.jobId
    const target = operation.target
    if (!target) return
    // A column target also exists when there are no sortable jobs in it.
    const targetColumnId = target.data.columnId
    const crossColumnItem = isSortable(target) && target.group !== source.group
    const destinationColumnId = typeof targetColumnId === 'number'
      ? targetColumnId
      : columnIdFromGroup(crossColumnItem ? target.group : source.group)
    const destinationIndex = typeof targetColumnId === 'number'
      ? board.columns.find(column => column.id === targetColumnId)?.jobIds.filter(id => id !== jobId).length ?? 0
      : crossColumnItem ? target.index : source.index
    if (typeof jobId !== 'number' || destinationColumnId === null) return

    requestAnimationFrame(() => {
      onMoveJob(jobId, destinationColumnId, destinationIndex)
    })
  }

  return (
    <DragDropProvider
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
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
      <div className="flex min-h-0 min-w-0 flex-1 overflow-auto">
        <div className="grid min-h-full flex-1 grid-cols-1 items-stretch gap-px bg-border md:grid-cols-2 xl:grid-cols-4">
          {board.columns.map((column) => (
            <Column
              dropIndex={dropPosition?.columnId === column.id ? dropPosition.index : undefined}
              jobDndId={jobDndId}
              column={column}
              group={columnGroup(column.id)}
              key={column.id}
            />
          ))}
        </div>
      </div>

      <DragOverlay className="cursor-grabbing" dropAnimation={null}>
        {dragPreview ? <JobDragPreview preview={dragPreview} /> : null}
      </DragOverlay>
    </DragDropProvider>
  )
}
