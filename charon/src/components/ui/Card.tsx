import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { Card } from '#/store/boardStore'

export interface CardPreviewProps {
  card: Card
  className?: string
}

/** Presentational card used by both the sortable item and its drag overlay. */
export function CardPreview({ card, className = '' }: CardPreviewProps) {
  const formattedDate = new Date(card.createdAt).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  })

  return (
    <article className={`kanban-card ${className}`.trim()}>
      <div className="card-header">
        <span className="card-position">{card.position}</span>
        <span className="card-date">{formattedDate}</span>
      </div>
      <h3 className="card-title">{card.title}</h3>
      {card.description ? (
        <p className="card-preview">
          {card.description.substring(0, 80)}
          {card.description.length > 80 ? '...' : ''}
        </p>
      ) : null}
    </article>
  )
}

export interface SortableCardProps {
  card: Card
  dndId: string
}

export function SortableCard({ card, dndId }: SortableCardProps) {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useSortable({
    animateLayoutChanges: () => false,
    data: {
      cardId: card.id,
      columnId: card.columnId,
      type: 'card',
    },
    id: dndId,
    transition: null,
  })

  return (
    <div
      {...attributes}
      {...listeners}
      className="sortable-card"
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: undefined,
        visibility: isDragging ? 'hidden' : undefined,
      }}
    >
      <CardPreview card={card} />
    </div>
  )
}
