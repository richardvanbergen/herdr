import { useSortable } from '@dnd-kit/react/sortable'

import type { Card } from '#/store/boardStore'

export interface CardPreviewProps {
  card: Card
  className?: string
}

/** Presentational card used in the board and DnD Kit's DragOverlay. */
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
  group: string
  index: number
}

export function SortableCard({ card, dndId, group, index }: SortableCardProps) {
  const { isDragSource, ref } = useSortable({
    data: {
      card,
      cardId: card.id,
    },
    group,
    id: dndId,
    index,
    transition: {
      duration: 140,
      easing: 'ease-out',
    },
  })

  return (
    <div
      className={`sortable-card${isDragSource ? ' is-drag-source' : ''}`}
      ref={ref}
    >
      <CardPreview card={card} />
    </div>
  )
}
