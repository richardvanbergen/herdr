import { SortableCard } from './Card'

import type { BoardColumn } from '#/store/boardStore'

export interface ColumnProps {
  cardDndId: (cardId: number) => string
  column: BoardColumn
  group: string
}

export function Column({ cardDndId, column, group }: ColumnProps) {
  return (
    <section className="kanban-column">
      <header className="column-header">
        <h2 className="column-title">{column.name}</h2>
        <span className="column-count">{column.cardIds.length}</span>
      </header>
      <div className="column-content">
        {column.cardIds.map((cardId, index) => (
          <SortableCard
            cardId={cardId}
            dndId={cardDndId(cardId)}
            group={group}
            index={index}
            key={cardId}
          />
        ))}
      </div>
    </section>
  )
}
