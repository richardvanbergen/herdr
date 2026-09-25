# Ready jobs and Hermes

## Human flow

Create a job, add its brief/context and turn **Ready on** in the job discussion.
Ready remains on across exchanges. Reply normally; each new human reply queues
another pass. No send-back or handoff button is required. Brief, settings and
human task edits also queue ready jobs. Context-only file edits do not wake the
agent: accompany them with a reply when it needs to act on them.

The job shows Agent queued, Agent working, Needs you, Ready for review or Done.
Tasks show whether they belong to the human or agent, and whether they are done.
Task Discussion contains the same Hermes discussion with replies tagged to that
task. Existing direct runner conversations remain available in a disclosure.
Their human messages also wake ready jobs, and Hermes can read their history.

Set **What done looks like** yourself or ask Hermes to propose it. The job's
runner selection controls scheduled task execution (Codex, Hermes or OpenRouter).
Review completed work, then Mark done; or reply with explicit approval and Hermes
can close it. Ready off prevents new claimed actions; a task already executing
can finish. Ordinary board dragging does not toggle readiness.

## Integration

`src/workflow/` owns workflow state, job discussion and agent operations. UI and
MCP invoke the same domain operations via oRPC. The Python MCP server uses the
Nix-pinned official MCP SDK (1.26), stdio transport and Charon HTTP; it never opens
SQLite. Tool schemas are generated from the API's Zod definitions.

Hermes uses its existing gateway profile, not Richard's separate CLI profile.
Nix configures the `charon` MCP server and `charon-hermes-schedule.service`.
The oneshot registers/updates `charon-ready-jobs` through Hermes's public cron CLI
at **every two minutes**, with delivery to **telegram** (the configured home
channel). It preserves unrelated schedules and an operator's paused state.
The gateway runs the schedule; no second OS polling timer is introduced.
The managed prompt lives in `hermes/charon/scheduled-prompt.md`.

The prompt claims at most one job each pass, reads discussion and relevant context,
creates/updates tasks, runs the selected adapter, checks actual results, and
records either a blocker or a review request. Idle passes emit Hermes's `[SILENT]`
sentinel. Actionable final responses include the job URL and are delivered by
Hermes cron itself, avoiding duplicate send_message calls. Check Hermes cron run
history for delivery failures; a stored Charon result alone does not prove Telegram
delivery. Chat messages from Telegram can be recorded with `record_human_reply`;
only actual human words may be recorded this way. `set_ready` is for explicit
human requests, not autonomous publication of draft jobs.

## Execution and recovery

Job claims are atomic with a 15-minute lease. Claimed operations extend it;
`heartbeat` explicitly extends it and `wait_run` polls for up to 15 seconds.
A revision counter preserves replies/edits arriving during work: finishing an
older revision requeues rather than swallowing the new input. Agent replies do
not requeue themselves. Review is refused while tasks remain unfinished.

Task creation, human/agent messages and run dispatch accept idempotency keys.
Reuse the key when retrying the same operation. A new intentional task revision
gets a new run key. Charon drains task execution on the server, independently of
HTTP/browser lifetime, using the existing runner and run-evidence pipeline.
Prompts also contain the job outcome and persisted job discussion.

Process restarts can interrupt execution: this is not a durable distributed worker.
Running rows older than the ten-minute execution limit plus one minute are marked
failed at the next queue check. Expired claims become blocked with a recovery
message; uncertain work is never automatically replayed. The cron pass reports
recovery notices. Review evidence before retrying. SQLite foreign-key enforcement
now removes workflow/message/dispatch rows when their parent is deleted.

## Activation

1. Rebuild NixOS as usual. This installs the MCP runtime/configuration and
   reconciles the gateway-profile schedule. It does not deploy a new Charon image.
2. Release Charon using `charon/scripts/release` from a clean, pushed checkout.
   The release backs up SQLite and applies migration `0010_oval_ravenous.sql`.
   Existing jobs default to Ready off; existing tasks default to agent/todo.
3. The MCP URL defaults to `http://127.0.0.1`, the production service. Public links
   default to `http://herdr`; `CHARON_PUBLIC_URL` overrides them at application runtime.
4. Check `systemctl status charon-hermes-schedule` and the gateway's cron history.
   For CLI inspection use the gateway user and `HERMES_HOME=/var/lib/hermes/.hermes`,
   not Richard's default wrapper/profile. The raw packaged Hermes CLI is recorded
   in the schedule unit's ExecStart.

The schedule needs the existing gateway's Telegram bot token and home channel.
MCP initially cannot discover tools if the new app is not deployed yet; Hermes
reconnects after the app becomes available. Existing runner credentials/runtime
requirements still apply; this integration does not provision model credentials.

## Verification

- `bun test src/workflow/server/workflow.test.ts` (nine scenarios in a separate process with isolated SQLite).
- `bunx tsc --noEmit` and `bun --bun run build`.
- `scripts/check-workflow.mjs` against an isolated seeded server and Chromium CDP:
  Ready, blocker, reply/requeue, reload, pause, mobile width and browser exceptions.
- MCP SDK client integration: initialize/discover/claim/block/reply/requeue through
  the real HTTP transport; no model calls or Telegram messages.
- Nix package/configuration evaluation and repeated cron registration against a
  temporary Hermes profile. No NixOS activation is performed by these tests.
