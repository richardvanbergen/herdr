# Charon code organisation

## Domain-first structure

Organise feature code by domain, using singular directories at `src/<domain>/`, for example `src/job/` and `src/board/`.

A domain owns and co-locates its:

- feature components;
- query definitions and data loaders;
- local interaction state, types, fixtures, and helpers;
- once explicitly defined, its server routes and oRPC configuration.

Do not split one feature across generic technical-layer directories. Keep route files thin: they compose domain entry components rather than implementing domain behavior.

## Presentation and data containers

Keep Lumina-derived presentation separate from fetching, persistence, and orchestration. Domain containers own TanStack Query, mutations, form autosave, router decisions, and streams. Domain views receive values, callbacks, and composition slots through props; they must not import the API client or query hooks. Presentation may own transient display state. Keep this split inside each domain.

Preserve Charon's dnd-kit sensors, sortable IDs/groups, drop handling, and optimistic board-order mutation when changing presentation. Lumina's prototype drag behavior is not an implementation reference.

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

Tasks are ordered text entries under a job. Persist each task with its own ID, parent `job_id`, text, position, human/agent assignee, and todo/done state. Agent-created tasks carry an idempotency request ID. Keep task schema, procedures, query options, and editing UI under `src/task/`.

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

Task execution uses `AgentRunner.run(prompt)` as an async event stream. Keep runner-specific behavior in `src/agent/`; Codex app-server and AI SDK/OpenRouter adapters both emit Charon status, text, and tool events. The task page consumes those events and stores the latest final output. Persist each run's status and output separately in `task_runs`. New adapters must use the same event contract. Longer term, new items should be evaluated by focused agents, routed, labelled, researched, and discussed with the human through Hermes orchestration. This direction does not imply those orchestration features already exist.

Task runs persist the exact submitted application prompt and timestamped status/tool events, including returned tool output, working directory, and command exit codes where the adapter provides them. Keep this evidence when a run fails or is interrupted. `executeTaskRun` owns execution and persistence; the server function only exposes its stream. The task's Run debugging section shows recent runs after reload. Older runs have no captured prompt/activity; never reconstruct them and present them as recorded history. Codex sessions are currently ephemeral and separate from the developer's interactive Codex session.

Task conversations are separate from task runs. A task may have multiple threads, each with ordered human and agent messages and a selected runner. A conversation reply must not replace task instructions or task run output. The selected thread lives in the task URL search parameters. Conversation messages are discussion history; deliberately saved context files are shared job memory.

Runner IDs and display labels live in `src/agent/runner-options.ts`; task input validation, conversation persistence, and both selectors share them. Hermes executes the installed profile through `hermes chat --query-file - --oneshot --format stream-json --source tool`. Prompts travel on stdin, never through shell interpolation. Preserve Hermes text deltas and tool events in the same `AgentRunner` contract. Hermes currently caps tool-result output at 5,000 characters; the debugger shows what its CLI supplied.

When Hermes is on the host and Charon is in Docker, `scripts/hermes-bridge.ts` serves a private Unix socket in the bind-mounted workspace. The adapter discovers `.hermes-runner.sock` or uses `CHARON_HERMES_SOCKET`. The bridge maps Charon's `/workspace` paths to its host working directory in a runtime instruction and emits the mapping as a status event. It runs the existing host profile without copying credentials into Docker. Direct installations can use `HERMES_PATH` instead. The `charon-hermes` user service runs this bridge; it is separate from the Hermes messaging gateway.

## Job context

Context lives in physical job folders, managed by `src/context/`. `CHARON_CONTEXT_ROOT` selects the root; its default is `context/` beside `CHARON_DB_PATH` (or the local `charon.db`). Keep it on persistent storage and back it up with the database. Job IDs determine folders: `<root>/jobs/<id>/`.

The human editor and agents use the same files. Text context is Markdown with optional YAML `type: text`, `title`, and `description`. Plain Markdown/text files and nested folders are supported; no generated catalog or database copy is authoritative. The editor selection is the job URL's `context` search parameter. Use the shared Item primitive and TanStack Form for editing.

Both task runs and conversation replies use `jobContextPrompt` to supply the folder path and discovery/save instructions. Do not inject all file contents. Codex uses its native file tools; the runner permits the configured context root while retaining the project working directory. Each task's persisted `useJobContext` flag defaults to true and can be removed/restored by the human. It controls the supplied reference, not filesystem access or existing chat history.

When the reference is enabled, instruct the agent to discover relevant files before answering, read metadata as well as bodies, and apply their requirements. An empty body can still have meaningful title/description metadata. If file access fails or conflicts with a task instruction, report the conflict rather than silently proceeding. Confirm actual context reads using recorded tool results; including a folder path alone is not evidence that it was read.

Refresh the job context query after agent turns and UI saves. UI saves atomically replace files and check their content version to detect stale drafts. Direct agent/editor writes remain ordinary file operations. Preload, full revision history, project/task context scopes, and OpenRouter context writing are future work.

Codex runs inside Docker use app-server's external sandbox policy because Docker supplies isolation and nested bubblewrap cannot create namespaces under the default container policy. Host runs retain workspace-write plus the context root. `CHARON_CODEX_SANDBOX` can explicitly select `workspace-write` or `external`; external mode requires an already isolated runtime.

Conversation context actions use exact first-line commands: `/context remember`,
`/context append`, and `/context review`. The shared vocabulary lives in
`src/context/actions.ts`. Buttons only populate the draft; sending invokes the
selected runner's native file tools. Append preserves existing metadata/body and
asks for a file/content when ambiguous; review is read-only. Require an enabled
job context reference and a filesystem-capable runner (Codex or Hermes). Do not
present these prompt actions as deterministic API/MCP tools or claim saved changes
without file-tool confirmation. Scheduled workflow processing is defined below.


## Ready workflow and Hermes

`src/workflow/` owns job readiness, claims, discussion, and agent operations.
Ready is a persistent toggle. Human replies and edits queue a ready job; saving
an agent reply never queues itself. Keep board placement independent of readiness.
Jobs own the outcome ("What done looks like"); tasks own execution and human/agent
assignment. Preserve claim tokens, revision checks and idempotency keys. Never
replay uncertain runs automatically or treat a run receipt as completed work.

Hermes uses MCP via `hermes/charon/mcp_server.py` and the shared oRPC operations.
Nix owns that server's runtime/config and an idempotent cron registration service
in the gateway profile. The scheduled prompt is `hermes/charon/scheduled-prompt.md`.
It must report blockers/results with job links via cron's Telegram delivery, emit
[SILENT] when idle, and verify saved output/tool evidence before claiming success.
Do not set up a competing cron in Richard's CLI profile or manually edit cron JSON.
Keep NixOS activation separate from Charon's committed release workflow.
See `docs/hermes-workflow.md` for activation, recovery and testing.
