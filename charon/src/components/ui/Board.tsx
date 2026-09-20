import { DragDropProvider, DragOverlay, type DragEndEvent } from '@dnd-kit/react'
import { isSortable } from '@dnd-kit/react/sortable'

import { CardPreview } from './Card'
import { Column } from './Column'

import type { Board as BoardType, Card } from '#/store/boardStore'

export interface BoardProps {
  board: BoardType
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

/**
 * Uses DnD Kit's current sortable primitives. OptimisticSortingPlugin supplies
 * the insertion preview by moving sortable DOM nodes during the drag; DragOverlay
 * supplies the separate, top-layer card following the pointer.
 */
export function Board({ board, onMoveCard }: BoardProps) {
  function handleDragEnd({ operation }: DragEndEvent) {
    const source = operation.source
    if (operation.canceled || !source || !isSortable(source)) return

    const cardId = source.data.cardId
    const destinationColumnId = columnIdFromGroup(source.group)
    if (typeof cardId !== 'number' || destinationColumnId === null) return

    onMoveCard(cardId, destinationColumnId, source.index)
  }

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
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
          const card = source.data.card as Card | undefined
          return card ? <CardPreview card={card} /> : null
        }}
      </DragOverlay>
    </DragDropProvider>
  )
}
