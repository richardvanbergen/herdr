import { useSortable } from "@dnd-kit/react/sortable";
import { useQuery } from "@tanstack/react-query";

import { useInView } from "#/card/hooks/use-in-view";
import { cardQueryOptions } from "#/card/queries/card-query-options";

import type { Card } from "#/card/server/schema";

export interface CardPreviewProps {
	card: Card;
}

/** Presentational card content: only title and description are rendered. */
export function CardPreview({ card }: CardPreviewProps) {
	return (
		<article className="kanban-card">
			<h3 className="card-title">{card.title}</h3>
			{card.description ? (
				<p className="card-preview">{card.description}</p>
			) : null}
		</article>
	);
}

function CardSkeleton() {
	return (
		<article className="kanban-card card-skeleton" aria-label="Loading card">
			<div className="skeleton-line skeleton-title" />
			<div className="skeleton-line skeleton-copy" />
			<div className="skeleton-line skeleton-copy short" />
		</article>
	);
}

function CardLoadError() {
	return (
		<article className="kanban-card card-error">Unable to load card.</article>
	);
}

export interface CardLoaderProps {
	cardId: number;
	eager?: boolean;
}

/**
 * Card content is query-owned, not component-owned. The IntersectionObserver
 * only enables the query when this card is visible or near-visible.
 */
export function CardLoader({ cardId, eager = false }: CardLoaderProps) {
	const { isInView, ref } = useInView<HTMLDivElement>();
	const query = useQuery(cardQueryOptions(cardId, eager || isInView));

	return (
		<div ref={ref}>
			{query.data ? <CardPreview card={query.data} /> : null}
			{query.isError ? <CardLoadError /> : null}
			{!query.data && !query.isError ? <CardSkeleton /> : null}
		</div>
	);
}

export interface SortableCardProps {
	cardId: number;
	dndId: string;
	group: string;
	index: number;
}

export function SortableCard({
	cardId,
	dndId,
	group,
	index,
}: SortableCardProps) {
	const { isDragSource, ref } = useSortable({
		data: { cardId },
		group,
		id: dndId,
		index,
		transition: {
			duration: 140,
			easing: "ease-out",
		},
	});

	return (
		<div
			className={`sortable-card${isDragSource ? " is-drag-source" : ""}`}
			ref={ref}
		>
			<CardLoader cardId={cardId} />
		</div>
	);
}
