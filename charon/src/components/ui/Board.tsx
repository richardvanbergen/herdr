import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useState } from 'react'

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

export function Board({ board, onMoveCard }: BoardProps) {
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function collisionDetectionStrategy(args: Parameters<typeof pointerWithin>[0]) {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      const cardCollision = pointerCollisions.find(({ id }) =>
        args.droppableContainers.find((container) => container.id === id)?.data.current
          ?.type === 'card',
      )
      return cardCollision ? [cardCollision] : pointerCollisions
    }

    return closestCorners(args)
  }

  function handleDragStart({ active }: DragStartEvent) {
    const cardId = active.data.current?.cardId
    const card = board.columns
      .flatMap((column) => column.cards)
      .find((candidate) => candidate.id === cardId)

    setActiveCard(card ?? null)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveCard(null)

    const cardId = active.data.current?.cardId
    const sourceColumnId = active.data.current?.columnId
    if (typeof cardId !== 'number' || typeof sourceColumnId !== 'number' || !over) return

    const overData = over.data.current
    const destinationColumnId = overData?.columnId
    if (typeof destinationColumnId !== 'number') return

    const destinationColumn = board.columns.find(
      (column) => column.id === destinationColumnId,
    )
    if (!destinationColumn) return

    const overCardId = overData?.type === 'card' ? overData.cardId : undefined
    const destinationIndex =
      typeof overCardId === 'number'
        ? destinationColumn.cards.findIndex((card) => card.id === overCardId)
        : destinationColumn.cards.length

    if (destinationIndex < 0) return

    onMoveCard(cardId, destinationColumnId, destinationIndex)
  }

  return (
    <DndContext
      id="kanban-board"
      autoScroll={{
        layoutShiftCompensation: false,
        threshold: { x: 0.2, y: 0.2 },
      }}
      collisionDetection={collisionDetectionStrategy}
      onDragCancel={() => setActiveCard(null)}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <div className="kanban-board">
        <div className="board-columns">
          {board.columns.map((column) => (
            <Column key={column.id} column={column} cardDndId={cardDndId} />
          ))}
        </div>
      </div>

      <DragOverlay adjustScale={false} dropAnimation={null}>
        {activeCard ? <CardPreview card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
