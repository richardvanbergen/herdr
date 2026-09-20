import { Fragment } from 'react'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { CardDropPlaceholder, SortableCard } from './Card'

import type { DropPreview } from './Board'
import type { Card, Column as ColumnType } from '#/store/boardStore'

export interface ColumnProps {
  activeCard: Card | null
  cardDndId: (cardId: number) => string
  column: ColumnType
  dropPreview: DropPreview | null
}

export function Column({ activeCard, cardDndId, column, dropPreview }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    data: {
      columnId: column.id,
      type: 'column',
    },
    id: `column:${column.id}`,
  })
  const placeholderIndex =
    activeCard && dropPreview?.columnId === column.id ? dropPreview.index : null

  return (
    <section className="kanban-column" ref={setNodeRef}>
      <header className="column-header">
        <h2 className="column-title">{column.name}</h2>
        <span className="column-count">{column.cards.length}</span>
      </header>
      <div className="column-content">
        <SortableContext
          items={column.cards.map((card) => cardDndId(card.id))}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card, index) => (
            <Fragment key={card.id}>
              {placeholderIndex === index && activeCard ? (
                <CardDropPlaceholder
                  card={activeCard}
                  columnId={column.id}
                  index={placeholderIndex}
                />
              ) : null}
              <SortableCard card={card} dndId={cardDndId(card.id)} />
            </Fragment>
          ))}
          {placeholderIndex === column.cards.length && activeCard ? (
            <CardDropPlaceholder
              card={activeCard}
              columnId={column.id}
              index={placeholderIndex}
            />
          ) : null}
        </SortableContext>
      </div>
    </section>
  )
}
