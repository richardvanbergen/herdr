# Charon code organisation

## Domain-first structure

Organise feature code by domain, using singular directories at `src/<domain>/`, for example `src/job/` and `src/board/`.

A domain owns and co-locates its:

- feature components;
- query definitions and data loaders;
- local interaction state, types, fixtures, and helpers;
- once explicitly defined, its server routes and oRPC configuration.

Do not split one feature across generic technical-layer directories. Keep route files thin: they compose domain entry components rather than implementing domain behavior.

## Shared UI primitives

Use Tailwind utility classes for all application styling and the existing `cn` helper for conditional classes. Use shadcn/ui primitives where they fit. Do not add custom CSS rules; `src/styles.css` is only for Tailwind imports and `@theme` tokens.

Use TanStack Router layout routes and URL parameters for column, job, and task pages. Do not mirror route selection in client state.

`src/components/ui/` is reserved exclusively for reusable, domain-agnostic Shadcn-style UI primitives. Do not put domain components such as `Board`, `Column`, or `Job` there.

Place shared code outside a domain only when it is genuinely domain-agnostic and used by more than one domain.

## Job model: first backend primitive

The job backend is deliberately small until its contract expands:

- The persisted job content model is `id`, `title`, and nullable `description` only. Board placement, ordering, labels, and filter state do not belong to a job's content record.
- Put the Drizzle table, job-specific oRPC procedures, job query options, and job presentation components under `src/job/`.
- Use oRPC's `queryOptions` helper with TanStack Query. A job component receives only `jobId`; it does not own a second job cache or fetch data imperatively.
- TanStack Query controls query lifecycle and caching. It has no per-element IntersectionObserver primitive, so use the native `IntersectionObserver` only to derive query eligibility, then pass that boolean to the query's `enabled` option.
- Preserve the native observer hook as a focused DOM subscription. Do not use `useEffect` for fetching job data.

## Task model

Tasks are ordered text entries under a job. Persist each task with its own ID, parent `job_id`, text, and position. Keep task schema, procedures, query options, and editing UI under `src/task/`.

## Release workflow

- Development is the bind-mounted Vite server on host port `7000`. Stable production is an immutable, production-built image on host port `80`, reached through the existing Tailscale Serve proxy.
- When Richard says **“Release Charon”** or **“release”** in an unambiguous Charon context, run the committed `charon/scripts/release` workflow. Do not replace it with a manual deployment sequence.
- The release workflow must refuse a dirty, uncommitted, unpushed, or non-`origin/main` checkout. It builds from `git archive HEAD`, so the released image is exactly one commit and cannot contain development-only files.
- A release backs up production SQLite before migration, runs the production image through the Nix-declared service, waits for `/healthz`, and records its exact Git SHA and image tag.
- Do not deploy the development container to port `80` or expose it through Tailscale Serve.

## Backend scope

Do not create or extend backend behavior until its contract has been explicitly defined. When backend work is authorised, co-locate its domain-specific routes and oRPC configuration inside the relevant domain directory.

## Agent workflow direction

Charon is a workspace for a self-improving agent system. The web UI is the human-facing place to create jobs and tasks, review work, and read results. A task run is the unit of agent execution. Its prompt includes the task text and parent job context; add project context when projects exist. Persist the latest output on the task so it can be reviewed in the task detail and previewed in lists.

The current Codex CLI runner is a proof of concept behind the `AgentRunner.run(prompt)` interface. Keep provider-specific process handling in `src/agent/`; future Hermes, OpenRouter, and other adapters should implement the same seam. Longer term, new items should be evaluated by focused agents, routed, labelled, researched, and discussed with the human through Hermes orchestration. This direction does not imply those orchestration features already exist.
