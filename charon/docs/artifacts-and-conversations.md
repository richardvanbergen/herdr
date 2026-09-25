# Artifacts and conversations

## Delivered first slice

Tasks have multiple conversation threads. Each thread stores ordered human and agent messages and a runner choice. The task URL selects a thread. Replies stream through the existing `AgentRunner` adapter and render with AI Elements. Task instructions and task run output stay separate from conversation history.

## Delivered job context

Update, 2026-09-24: [context folders](job-context-plan.md) are implemented for jobs. Both task runs and conversations receive the job context folder path. Codex discovers and edits files with its existing file tools. The human UI edits the same files, and each task can remove or restore the supplied reference.

This replaces the earlier proposal for an artifacts table, a generated context index, and mandatory MCP access. The first delivery provides job-owned text context with a type-aware manual editor and shared folder instructions for conversations and task runs.

## Later possibilities

- Optional preload for explicitly selected files.
- Project and task context folders with removable references.
- Additional artifact types, revision history, and visual diffs.
- Hermes workflow tools for listing actionable work, moving items, creating jobs/tasks, and posting replies. Choose the transport when implementing that integration.
- Explicit turn ownership and a last processed message cursor so Hermes can pick up new work, ask questions, and resume after a human reply.

Existing application entities and conversations keep their current database storage. See the context folder plan for the current implementation sequence.
