import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { SortableCard } from './Card'

import type { Column as ColumnType } from '#/store/boardStore'

export interface ColumnProps {
  cardDndId: (cardId: number) => string
  column: ColumnType
}

export function Column({ cardDndId, column }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    data: {
      columnId: column.id,
      type: 'column',
    },
    id: `column:${column.id}`,
  })

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
          {column.cards.map((card) => (
            <SortableCard
              card={card}
              dndId={cardDndId(card.id)}
              key={card.id}
            />
          ))}
        </SortableContext>
      </div>
    </section>
  )
}
