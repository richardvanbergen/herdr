import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card as CardType } from '#/store/boardStore'

export interface CardProps {
  card: CardType
}

export function Card({ card }: CardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const formattedDate = new Date(card.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card ${isDragging ? 'dragging' : ''}`}
    >
      <div className="card-header">
        <span className="card-position">{card.position}</span>
        <span className="card-date">{formattedDate}</span>
      </div>
      <h3 className="card-title">{card.title}</h3>
      {card.description && (
        <div className="card-preview">
          {card.description.substring(0, 80)}
          {card.description.length > 80 && '...'}
        </div>
      )}
    </div>
  )
}
