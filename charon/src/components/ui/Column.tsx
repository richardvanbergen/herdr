import { SortableCard } from './Card'

import type { Column as ColumnType } from '#/store/boardStore'

export interface ColumnProps {
  cardDndId: (cardId: number) => string
  column: ColumnType
  group: string
}

export function Column({ cardDndId, column, group }: ColumnProps) {
  return (
    <section className="kanban-column">
      <header className="column-header">
        <h2 className="column-title">{column.name}</h2>
        <span className="column-count">{column.cards.length}</span>
      </header>
      <div className="column-content">
        {column.cards.map((card, index) => (
          <SortableCard
            card={card}
            dndId={cardDndId(card.id)}
            group={group}
            index={index}
            key={card.id}
          />
        ))}
      </div>
    </section>
  )
}
