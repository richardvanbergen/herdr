# Lumina presentation integration

Design reference: https://github.com/richardvanbergen/lumina at
`8f2277888a498536cff5fb08133da6cf7de0d98a`.

The charcoal/amber palette, compact shell, responsive columns, breadcrumb hierarchy,
and task/discussion/context panes are adapted from that prototype. Theme values are
Tailwind tokens in `src/styles.css`; no prototype CSS rules or Next.js runtime were imported.

## Boundaries

- `workspace`: query-backed breadcrumb container and prop-driven shell.
- `board`: existing drag orchestration and mutations; `ColumnView` renders slots.
- `job`: form/autosave container supplies fields and tasks to `JobView`.
- `task`: execution and query containers supply `TaskWorkspaceView`, `TaskEditorView`,
  `TaskOutputView`, `TaskListView`, and `TaskRunHistoryView`.
- `conversation`: thread/message queries and streaming remain in `TaskConversation`;
  `ConversationView` renders AI Elements and calls supplied callbacks.
- `context`: filesystem mutations, stale-draft checks and query invalidation stay in
  containers; browser, reference and editor views receive props and field slots.

Views do not import query hooks or the API client. Form field slots keep TanStack
Form ownership in the containers. Transient display state may live in presentation;
selected entities, thread and task pane use TanStack Router URLs.

The dnd-kit provider, sensors, sortable identifiers, groups, overlay, ordering
mutation and rollback are retained. Lumina's mock data, fake execution status,
local-history routing and conversation-to-output simulation are not imported.

## Drag ownership and regression check

The sortable plugin may reorder nodes within a column, but cross-column dragover
prevents its imperative DOM reparenting. React owns cross-column relocation when
the persisted board mutation updates query data. Cross-column drop indices come
from the target sortable; blank column targets append. Do not re-enable optimistic
cross-column DOM moves: React will try to remove a node from its former parent.

`scripts/check-board-drag.mjs` exercises same-column ordering, repeated populated
column round trips without reload, empty-column round trips, and persisted reload.
It requires an isolated running server with seeded columns and no jobs, plus a
Chromium debugging endpoint. Set `CHARON_DRAG_TEST_ORIGIN` and
`CHARON_DRAG_TEST_CDP` explicitly and run it with Bun. It refuses a nonempty board
and removes its synthetic jobs in `finally`.
