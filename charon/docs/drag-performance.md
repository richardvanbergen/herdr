# Drag performance investigation

## Findings before the preview change

- `Board` mounts `JobLoader` inside `DragOverlay`. Starting a drag therefore mounts
  another job query observer, job form/autosave controller, and `TaskList` query and
  mutation controller. Cached data may prevent a request, but this still duplicates
  component and subscription work. Task queries can refetch when mounted if stale.
- The live job remains mounted beneath that preview. A pure preview could receive
  a snapshot of cached title, description and task summaries, without forms or queries.
- The board mutation runs on drop, not on every pointer move. Board invalidation is
  a potential release-time cost, not a demonstrated explanation of pointer lag.
- Cross-column optimistic DOM reparenting is intentionally prevented to avoid the
  reproduced React `removeChild` crash. Cross-column placement commits on drop;
  this changes hover feedback but is distinct from dropped animation frames.
- `useSortable` wraps the data-heavy card. React Compiler is already enabled, so
  adding memo wrappers everywhere without profiling would be speculative.
- The handle uses Lucide `GripVertical` and dnd-kit's `handleRef`. Only the handle
  disables touch scrolling; the rest of the card remains available for interaction.

## Recommended next step

1. Profile drag start, continuous movement, column crossing and release separately
   in a correctly styled production build with synthetic jobs and task summaries.
   Capture input delay, frame gaps, long tasks, layout/paint and React commits.
2. Replace the overlay's data container with a small prop-driven preview using a
   cache snapshot. Compare the same trace before and after this single change.
3. If movement remains slow, isolate rerendering card content from sortable and
   droppable subscriptions where profiling shows work. Inspect repeated layout
   measurement and transition restarts before changing animation settings.
4. Preserve empty-column drops, keyboard operation, cancellation, persistence and
   repeated round trips. The saved browser regression verifies pointer behavior;
   it is not a performance benchmark or a touch-device test.

No material steady-state frame-rate improvement has been demonstrated. Virtualization or a replacement
library is not justified by the current evidence.

## Primary references

- [Current DragOverlay API](https://dndkit.com/react/components/drag-overlay/):
  supports a custom simplified visual representation.
- [Current feedback guide](https://dndkit.com/react/guides/feedback/): feedback
  modes, default-plugin preservation and interactions with external state.
- [Sortable state management](https://dndkit.com/react/guides/sortable-state-management/):
  warns about optimistic DOM moves and refetches during dragging.
- [Current useSortable API](https://dndkit.com/react/hooks/use-sortable/): dedicated
  handle refs, separate source/target refs and transition controls.

Older `@dnd-kit/core`/`@dnd-kit/sortable` performance issues describe a different API
from Charon's `@dnd-kit/react`; they are not evidence of the same bottleneck here.


## Implemented: cached presentation-only preview

`BoardContainer` reads the existing job/task query cache once at drag start and
passes a snapshot to `JobDragPreview`. It contains title, a short description,
task count and at most three shortened task summaries. No forms, query observers,
mutations, task output bodies or interactive controls mount in the overlay.
The snapshot is discarded on drop/cancel. Missing cache entries use a label
fallback and do not start a fetch. Existing ordering and DOM ownership are unchanged.

### Before/after measurements

Same headless Chromium and styled production builds, 1440 × 1000 viewport,
eight generated jobs with three tasks each. Five cancelled drags per build:

| Measure | Before | After |
| --- | ---: | ---: |
| Mounted job editors while dragging | 9 | 8 |
| Task-list requests per drag | 1 | 0 |
| Median scripting time per drag sequence | 61.0 ms | 56.3 ms |
| Median layout time per drag sequence | 12.0 ms | 11.1 ms |
| Median input-dispatch round trip | 62.0 ms | 57.7 ms |

Each sequence contains 35 pointer moves with 16 ms pauses. Input-dispatch timings
include automation overhead and are not pure input latency. Frame intervals were
largely unchanged. This is a small, sequential headless sample, not proof of the
same speedup on the user's device. The reliable result is removal of redundant
editor mounting and requests. Real-device profiling remains appropriate if dragging
still feels slow.

Raw samples are in `docs/drag-preview-measurements.json`. To repeat, run
`scripts/benchmark-board-drag.mjs` against an isolated server with empty seeded
columns and a Chromium debugging endpoint. Supply `CHARON_DRAG_TEST_ORIGIN`,
`CHARON_DRAG_TEST_CDP`, and `BENCH_OUTPUT`. It verifies styles and removes its
synthetic jobs in `finally`.

### Cross-column insertion feedback

Cross-column hover now shows a React-owned insertion line and “Drop here” label
at the proposed destination, including empty columns. It does not reparent the
source DOM node or change card geometry during hover. State changes only when the
proposed column/index changes; persistence still happens on drop. JobLoader is
memoized so sortable and board preview updates do not also rerender its editors
when their props are unchanged. Query and form updates still render normally.

The browser regression now asserts that the indicator exists before release,
that hovering has not persisted a move, and that the indicator clears after drop.
The earlier timing measurements predate this change; no additional speedup is
claimed for this patch.
