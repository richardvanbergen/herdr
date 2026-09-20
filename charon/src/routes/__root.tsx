import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'

import appCss from '../styles.css?url'
import TanstackQueryProvider from '../integrations/tanstack-query/root-provider'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Charon' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="app-shell">
          <header className="app-header">
            <div className="app-logo">Charon</div>
            <nav className="app-nav">
              <span className="nav-status">ready</span>
            </nav>
          </header>
          <main className="app-main">
            <TanstackQueryProvider>{children}</TanstackQueryProvider>
          </main>
        </div>
        <Scripts />
      </body>
    </html>
  )
}
