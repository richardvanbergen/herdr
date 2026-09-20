import { orpc } from "#/orpc/client";

/**
 * The canonical TanStack Query options for one card. oRPC owns the query key
 * and transport; callers supply only the card ID and lazy-load eligibility.
 */
export function cardQueryOptions(cardId: number, enabled: boolean) {
	return orpc.card.get.queryOptions({
		enabled,
		input: { id: cardId },
		staleTime: 60_000,
	});
}
