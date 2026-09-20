import { createFileRoute } from '@tanstack/react-router'

function health() {
  return Response.json({ status: 'ok' })
}

export const Route = createFileRoute('/healthz')({
  server: {
    handlers: {
      GET: health,
      HEAD: health,
    },
  },
})
