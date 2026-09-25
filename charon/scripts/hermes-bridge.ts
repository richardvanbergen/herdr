import { chmodSync, existsSync, lstatSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { createConnection } from 'node:net'
import { createHermesBridge } from '../src/agent/hermes-bridge'

const socket = process.env.CHARON_HERMES_SOCKET ?? join(process.cwd(), '.hermes-runner.sock')
if (existsSync(socket)) {
  if (!lstatSync(socket).isSocket()) throw new Error(`Refusing to replace a non-socket file: ${socket}`)
  const active = await new Promise<boolean>((resolve) => {
    const probe = createConnection(socket)
    probe.once('connect', () => { probe.destroy(); resolve(true) })
    probe.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code !== 'ECONNREFUSED') { console.error(error.message); process.exit(1) }
      resolve(false)
    })
  })
  if (active) throw new Error('A Hermes bridge is already listening on this socket')
  unlinkSync(socket)
}
const server = createHermesBridge({ workspace: process.cwd(), clientWorkspace: process.env.CHARON_HERMES_CLIENT_WORKSPACE })
server.listen(socket, () => { chmodSync(socket, 0o600); console.log(`Hermes bridge listening on ${socket}`) })
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000).unref()
})
