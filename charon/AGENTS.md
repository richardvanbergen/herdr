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

## Backend scope

Do not create or extend backend behavior until its contract has been explicitly defined. When backend work is authorised, co-locate its domain-specific routes and oRPC configuration inside the relevant domain directory.
