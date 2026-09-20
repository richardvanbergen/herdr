import {
  DragDropProvider,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
} from '@dnd-kit/react'
import { PointerActivationConstraints } from '@dnd-kit/dom'
import { isSortable } from '@dnd-kit/react/sortable'

import { CardLoader } from '#/card/components/Card'

import { Column } from './Column'

import type { BoardView } from '#/board/board-store'

export interface BoardProps {
  board: BoardView
  onMoveCard: (cardId: number, destinationColumnId: number, destinationIndex: number) => void
}

function cardDndId(cardId: number) {
  return `card:${cardId}`
}

function columnGroup(columnId: number) {
  return `column:${columnId}`
}

function columnIdFromGroup(group: string | number | undefined) {
  if (typeof group !== 'string' || !group.startsWith('column:')) return null

  const columnId = Number(group.slice('column:'.length))
  return Number.isInteger(columnId) ? columnId : null
}

/** DnD owns only ordered card IDs; each card resolves its own queried content. */
export function Board({ board, onMoveCard }: BoardProps) {
  function handleDragEnd({ operation }: DragEndEvent) {
    const source = operation.source
    if (operation.canceled || !source || !isSortable(source)) return

    const cardId = source.data.cardId
    const destinationColumnId = columnIdFromGroup(source.group)
    if (typeof cardId !== 'number' || destinationColumnId === null) return

    requestAnimationFrame(() => {
      onMoveCard(cardId, destinationColumnId, source.index)
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
      <div className="kanban-board">
        <div className="board-columns">
          {board.columns.map((column) => (
            <Column
              cardDndId={cardDndId}
              column={column}
              group={columnGroup(column.id)}
              key={column.id}
            />
          ))}
        </div>
      </div>

      <DragOverlay className="drag-overlay" dropAnimation={null}>
        {(source) => {
          const cardId = source.data.cardId
          return typeof cardId === 'number' ? <CardLoader cardId={cardId} eager /> : null
        }}
      </DragOverlay>
    </DragDropProvider>
  )
}
