import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { useState } from 'react'
import { Column } from './Column'
import type { Board, Card } from '#/store/boardStore'

export interface BoardProps {
  board: Board
  onMoveCard: (cardId: number, toColumnId: number, toPosition: number) => void
}

export function Board({ board, onMoveCard }: BoardProps) {
  const [activeCard, setActiveCard] = useState<Card | null>(null)

  const allCards = board.columns.flatMap((col) => col.cards)

  function handleDragStart(event: any) {
    const card = allCards.find((c) => c.id === event.active.id)
    setActiveCard(card || null)
  }

  function handleDragEnd(event: any) {
    const { active, over } = event
    setActiveCard(null)

    if (!over || active.id === over.id) return

    const activeCard = allCards.find((c) => c.id === active.id)
    if (!activeCard) return

    // Find which column the card was dropped into
    const overCard = allCards.find((c) => c.id === over.id)
    const targetColumn = overCard
      ? board.columns.find((col) => col.cards.some((c) => c.id === overCard.id))
      : board.columns.find((col) => col.id === over.id)

    if (targetColumn) {
      const newPosition = overCard ? overCard.position : targetColumn.cards.length + 1
      onMoveCard(activeCard.id, targetColumn.id, newPosition)
    }
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board">
        <div className="board-columns">
          {board.columns.map((column) => (
            <Column key={column.id} column={column} />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeCard ? (
          <div className="kanban-card drag-overlay">
            <h3 className="card-title">{activeCard.title}</h3>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
