import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Card } from './Card'
import type { Column as ColumnType } from '#/store/boardStore'

export interface ColumnProps {
  column: ColumnType
}

export function Column({ column }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  })

  return (
    <div className="kanban-column" ref={setNodeRef}>
      <div className="column-header">
        <h2 className="column-title">{column.name}</h2>
        <span className="column-count">{column.cards.length}</span>
      </div>
      <div className="column-content">
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <Card
              key={card.id}
              card={card}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
