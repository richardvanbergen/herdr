# Plan: context folders

Status: first delivery implemented, 2026-09-24. Optional preload, other runner integrations, project/task scopes, and additional types remain follow-ups.

## Delivered implementation

`src/context/` owns the filesystem store, oRPC procedures, query options, and editor. The job page lists context and uses `?context=new` or `?context=<relative-file-path>` to select its editor. Text files have optional YAML metadata; plain Markdown and nested files also appear. Unsupported or malformed metadata is reported without hiding other files.

`CHARON_CONTEXT_ROOT` defaults to a `context` directory beside the configured SQLite database. Production Compose uses `/data/context` in its persistent volume. Include these files in backups; job deletion leaves the folder on disk for recovery.

Migration `0008_solid_richard_fisk.sql` adds the task's `use_job_context` flag, defaulting existing and new tasks to true. Task runs and conversation replies both call `jobContextPrompt`. The task switch removes/restores the supplied reference. Replies and runs invalidate the job context list on completion or failure.

The Codex runner retains the project working directory. Host execution adds the context root to workspace-write. Docker execution uses the documented external sandbox mode because Docker already isolates the process and disallows nested bubblewrap namespaces. `CHARON_CODEX_SANDBOX` can explicitly select the mode. OpenRouter's existing read-only tools have not yet been extended for context writing.

Verification includes filesystem/API tests covering CRUD, ordinary agent files, stale edits, invalid metadata, path validation, and persistent reference removal/restoration. See `src/context/server/store.test.ts`.

Browser verification passed for manual create/edit/reload/delete, reference removal/restoration, a real Codex conversation that read and saved context, and a separate task run that discovered the saved value and persisted its streamed output. Temporary verification records and files were removed afterward. Typecheck, production build, and the context domain's Biome checks also pass.

## Direction

Store context in physical folders. Give the agent the current context folder path and let it discover relevant files using its existing file tools. Trust the agent to navigate the folder and save context when asked.

The first version needs no generated catalog, custom context tool protocol, or MCP server. Folder contents are authoritative. Conversations remain discussions; deliberately saved files become shared context.

Existing application entities and conversations keep their current database storage.

## First delivery

- A persistent context folder for each job.
- A job Context section where the human can create, edit, and delete text files.
- A type selector with Text as its initial option.
- The job context path in both task-run and conversation prompts.
- Codex reads and writes that folder with its existing file tools.
- Other tasks under the job receive the same path and can discover saved context.

Use a configurable context root outside application build output:

```text
context/
  jobs/
    42/
      writing-conventions.md
      implementation-plan.md
```

Use the job ID for folder ownership. File paths identify individual context items. The application resolves paths as seen by the runner, including any container mounts. Keep the agent's working directory in the project; supply the context directory separately.

Task-owned and project-owned folders can use the same convention later.

## Prompt contract

Add a short section to the existing job/task/conversation prompt:

```text
Job context folder: /absolute/path/context/jobs/42

Explore this folder and read context relevant to the current work.
When asked to remember something for this job, create or update a
Markdown file here so other tasks can find it.
```

Build this section in one place shared by conversations and task runs. A new turn receives the current folder path. The agent discovers current file contents when it reads them; there is no index to regenerate.

The default prompt includes the folder path and instructions, without enumerating files or injecting their bodies. The previously requested Preload checkbox can remain an optional follow-up for files the human explicitly wants loaded every time.

## Text files and the UI

Use Markdown files with small frontmatter metadata for the manual editor:

```markdown
---
type: text
title: Writing conventions
description: Spelling and tone for customer-facing material.
---

Use British spelling.
```

The manual form contains type, title, short description, and body. Keep these metadata fields in the file itself. A simple mapping from type to editor/renderer supports additional types later.

Agents can create ordinary Markdown files too. Display those as Text, deriving a fallback title from the filename. Metadata improves the UI without becoming a prerequisite for discovery.

The UI reads the folder on load, after its own saves, and after an agent turn completes. Provide refresh for edits made by a separate agent or editor. File watching can follow if needed.

Use the existing Tailwind/shadcn primitives. Layouts own surrounding padding; shared items and forms keep their established roles.

## Inheritance

The initial shared scope is the job. A task receives its parent's job context path by default. Preserve the proposed remove/restore control as a reference to that folder; once removed, omit the path from future prompts until restored.

When project and task context are introduced, provide their folder paths alongside the job path. Store explicit references so each can be removed independently. No recursive catalog expansion is required.

These references control which locations Charon supplies to the agent. They do not prevent a trusted agent from exploring elsewhere, and removing a reference does not erase prior conversation messages.

## Agent integration

The current Codex runner already uses a local app-server process with file access. Keep its streaming interface and add the folder instructions to its prompt.

The existing OpenRouter runner has server-executed project file tools. Before using it for this flow, give those tools access to the context root and add file writing. A folder path is useful only when the runner has tools to read it. Native tools and server-executed tools should operate on the same files and conventions.

The AI SDK can remain inside the OpenRouter adapter, and AI Elements can continue rendering the conversation. Context storage does not require either framework. MCP can be added when an integration actually needs it.

## Saves and revisions

The UI writes files through a small filesystem service. Agents use their normal file tools against the same folder.

Use atomic replacement for UI saves. Compare the file version read by the UI with the current file before saving and report an intervening change. This is best-effort conflict detection; agents editing files directly do not participate in the UI's write lock.

Full history, diffs, rollback, and Git integration are later features. A content hash can detect a stale UI edit but does not retain previous versions.

## Implementation sequence

1. Define the persistent context root, job folder mapping, and text file format.
2. Add filesystem operations and the job Context list/editor.
3. Supply the job context path to conversations and task runs through a shared prompt builder.
4. Verify Codex discovery and saves; refresh the UI after a reply.
5. Add remove/restore controls for the supplied job reference and document delivered behavior.
6. Follow with optional preload, other runners, project/task scopes, and additional context types.

## Acceptance checks

- A manually saved text file survives a page reload.
- The default prompt includes the correct folder path and excludes saved file bodies.
- Codex can read an existing file and use its contents.
- Asking Codex to save a decision creates a file visible in the UI.
- A fresh conversation on another task under the same job can discover that decision.
- Direct file edits appear on UI refresh and subsequent agent reads.
- Removing/restoring a reference omits/restores the supplied path.
- Existing conversation and task-run streaming continue to work.

Verify actual files and reads, rather than relying on an agent's claim that it remembered something.
