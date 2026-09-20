import { useQuery } from '@tanstack/react-query'
import { useSortable } from '@dnd-kit/react/sortable'

import { fetchCardContent } from '#/card/data/mock-card-content'
import { useInView } from '#/card/hooks/use-in-view'

import type { CardContent } from '#/card/data/mock-card-content'

export interface CardPreviewProps {
  card: CardContent
}

export function CardPreview({ card }: CardPreviewProps) {
  const formattedDate = new Date(card.createdAt).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  })

  return (
    <article className="kanban-card">
      <div className="card-header">
        <span className="card-position">#{card.id}</span>
        <span className="card-date">{formattedDate}</span>
      </div>
      <h3 className="card-title">{card.title}</h3>
      {card.description ? <p className="card-preview">{card.description}</p> : null}
    </article>
  )
}

function CardSkeleton() {
  return (
    <article className="kanban-card card-skeleton" aria-label="Loading card">
      <div className="skeleton-line skeleton-meta" />
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-copy" />
      <div className="skeleton-line skeleton-copy short" />
    </article>
  )
}

export interface CardLoaderProps {
  cardId: number
  eager?: boolean
}

/** Resolves card content by ID through TanStack Query; it owns no local card data. */
export function CardLoader({ cardId, eager = false }: CardLoaderProps) {
  const { isInView, ref } = useInView<HTMLDivElement>()
  const query = useQuery({
    enabled: eager || isInView,
    queryFn: () => fetchCardContent(cardId),
    queryKey: ['card', cardId],
    staleTime: Infinity,
  })

  return (
    <div ref={ref}>
      {query.data ? <CardPreview card={query.data} /> : <CardSkeleton />}
    </div>
  )
}

export interface SortableCardProps {
  cardId: number
  dndId: string
  group: string
  index: number
}

export function SortableCard({ cardId, dndId, group, index }: SortableCardProps) {
  const { isDragSource, ref } = useSortable({
    data: { cardId },
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
      <CardLoader cardId={cardId} />
    </div>
  )
}
