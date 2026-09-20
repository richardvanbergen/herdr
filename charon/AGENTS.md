# Charon code organisation

## Domain-first structure

Organise feature code by domain, using singular directories at `src/<domain>/`, for example `src/card/` and `src/board/`.

A domain owns and co-locates its:

- feature components;
- query definitions and data loaders;
- local interaction state, types, fixtures, and helpers;
- once explicitly defined, its server routes and oRPC configuration.

Do not split one feature across generic technical-layer directories. Keep route files thin: they compose domain entry components rather than implementing domain behavior.

## Shared UI primitives

`src/components/ui/` is reserved exclusively for reusable, domain-agnostic Shadcn-style UI primitives. Do not put domain components such as `Board`, `Column`, or `Card` there.

Place shared code outside a domain only when it is genuinely domain-agnostic and used by more than one domain.

## Card model: first backend primitive

The card backend is deliberately small until its contract expands:

- The persisted card content model is `id`, `title`, and nullable `description` only. Board placement, ordering, labels, and filter state do not belong to a card's content record.
- Put the Drizzle table, card-specific oRPC procedures, card query options, and card presentation components under `src/card/`.
- Use oRPC's `queryOptions` helper with TanStack Query. A card component receives only `cardId`; it does not own a second card cache or fetch data imperatively.
- TanStack Query controls query lifecycle and caching. It has no per-element IntersectionObserver primitive, so use the native `IntersectionObserver` only to derive query eligibility, then pass that boolean to the query's `enabled` option.
- Preserve the native observer hook as a focused DOM subscription. Do not use `useEffect` for fetching card data.

## Backend scope

Do not create or extend backend behavior until its contract has been explicitly defined. When backend work is authorised, co-locate its domain-specific routes and oRPC configuration inside the relevant domain directory.
