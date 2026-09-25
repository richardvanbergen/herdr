// @ts-expect-error The generated server bundle does not publish declarations.
import app from '../dist/server/server.js'

const port = Number(process.env.PORT ?? 3000)

Bun.serve({
  fetch: app.fetch,
  hostname: '0.0.0.0',
  port,
})

console.log(`Charon production server listening on http://0.0.0.0:${port}`)
