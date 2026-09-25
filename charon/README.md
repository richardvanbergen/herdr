Welcome to your new TanStack Start app!

# Getting Started

To run this application:

```bash
bun install
bun --bun run dev
```

# Building For Production

To build this application for production:

```bash
bun --bun run build
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

Use Tailwind utilities and the shared shadcn primitives for application styling.

## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting. The following scripts are available:


```bash
bun --bun run lint
bun --bun run format
bun --bun run check
```


## Shadcn

Add components using the latest version of [Shadcn](https://ui.shadcn.com/).

```bash
pnpm dlx shadcn@latest add button
```



## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).


# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.


## Task runners

**Hermes** is available in the task Runner selector and each conversation's Runner selector. It uses your installed Hermes profile's model, tools, and credentials. Text streams as it arrives; tool inputs/results appear in task run debugging. Hermes CLI currently caps tool-result previews at 5,000 characters.

For a direct host installation, put `hermes` on `PATH` or set `HERMES_PATH`. Hermes must support `chat --query-file - --format stream-json` (verified with the installed 0.21.3 version).

For this Docker development setup, the host bridge reuses the existing Hermes installation:

```bash
cd /code/herdr/charon
bun run hermes:bridge
```

It listens on `.hermes-runner.sock`, visible inside the existing workspace bind mount. There is no TCP listener or copied credential file. The bridge keeps its host working directory and explains the `/workspace` → host-directory mapping to Hermes. `CHARON_HERMES_SOCKET` overrides the socket path on either side; `CHARON_HERMES_CLIENT_WORKSPACE` changes the bridge's expected client path (default `/workspace`). Custom context roots must also be accessible on the host.

The supplied host user service can run it persistently on this NixOS machine:

```bash
systemctl --user link /code/herdr/charon/scripts/charon-hermes.service
systemctl --user enable --now charon-hermes.service
sudo loginctl enable-linger "$USER"
```

Use `journalctl --user -u charon-hermes` for startup failures. Restart the service after changing bridge/CLI adapter code. For a production container, explicitly mount the socket directory and shared context storage and configure its client workspace; the production release workflow does not automatically deploy this development bridge.

Hermes adapter checks: `bun test src/agent/hermes-runner.test.ts` (requires local Unix socket access).

The task screen streams status, tool activity, and output from a runner. Codex uses the authenticated CLI in the Charon container. To use OpenRouter, set `OPENROUTER_API_KEY` in the environment used by Docker Compose and recreate the container. `OPENROUTER_MODEL` optionally selects a model; it defaults to `openai/gpt-4.1-mini`. OpenRouter currently has read-only project file tools. Both runners use the same task event interface in `src/agent/`. Each run is recorded in `task_runs`, and a completed run replaces the task's latest output.

## Job context folders

### Inspecting task runs

The task page's **Run debugging** section retains the 20 most recent runs, with their exact submitted application prompt, timestamped status/tool events, returned tool output, and command exit codes. Expand a run and its tool entries to see the contents returned by a context read. Failed and interrupted runs keep their evidence. Older runs predate this capture and are labelled accordingly. The prompt shown is Charon's submission; it does not include every internal runtime instruction added by a model runner. Codex runs currently start fresh ephemeral sessions.

Apply migration `0009_lowly_adam_warlock.sql` with `bun run db:migrate` to enable capture. Conversation replies use the improved context discovery instructions too; persisted run debugging currently covers **Run task** executions.

### Managing context

Open a job and choose **Add context** to save a text note with a title, short description, and body. Notes are real Markdown files shared by every task in the job. The editor URL can be bookmarked. Agents can also create plain Markdown files, including files in subfolders, without any registration step.

Both task runs and conversation replies receive the job context folder path. With Codex selected, ask it to read relevant context or remember a decision for the job. It uses its normal file tools. The context list refreshes after the turn; **Refresh context** picks up edits from external agents and editors. **Use job context** on a task removes/restores the supplied folder reference for future turns.

Inside Docker, the Codex adapter uses app-server's `externalSandbox` mode: Docker provides isolation, and the agent can use the container's filesystem and mounted workspace. This avoids nesting bubblewrap inside Docker's namespace restrictions. Direct host runs use Codex's `workspace-write` sandbox with the context root added. `CHARON_CODEX_SANDBOX=workspace-write` explicitly selects the internal sandbox; `external` is for an already isolated runtime. See [Codex app-server sandbox configuration](https://learn.chatgpt.com/docs/app-server).

`CHARON_CONTEXT_ROOT` configures storage. By default it is `context/` beside the SQLite file selected by `CHARON_DB_PATH`, so development uses `/workspace/context` and production uses `/data/context` in the persistent data volume. Paths must be accessible to the application and runner. Back up this directory alongside SQLite; SQLite backups alone do not contain these files. Deleting a job retains its files on disk, but removes their UI entry.

Run `bun run db:migrate` for the task reference flag. Existing tasks default to using job context. UI saves detect intervening edits and preserve the draft on a conflict. Full revision history, preload, and project/task folders are not included yet. OpenRouter context read/write tools are a later adapter extension; use Codex for this first context flow.

Verification: `bun test src/context/server/store.test.ts`, `bunx tsc --noEmit`, and `bun --bun run build`.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
