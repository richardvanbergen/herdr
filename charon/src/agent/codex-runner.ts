import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import type { AgentEvent, AgentRunner } from './runner'
import { contextRoot } from '#/context/server/store'
import { codexToolEvent } from './codex-events'

type RpcMessage = {
  id?: number
  method?: string
  result?: Record<string, any>
  error?: { message?: string }
  params?: Record<string, any>
}

const writeMessage = (stdin: NodeJS.WritableStream, message: unknown) => {
  stdin.write(`${JSON.stringify(message)}\n`)
}

/** Adapts Codex app-server JSON-RPC notifications to Charon's task stream. */
export class CodexRunner implements AgentRunner {
  async *run(prompt: string, signal?: AbortSignal): AsyncIterable<AgentEvent> {
    // Docker supplies the isolation boundary; nested bubblewrap cannot create
    // namespaces under its default seccomp policy. Host runs retain Codex's sandbox.
    const externalSandbox = (process.env.CHARON_CODEX_SANDBOX ?? (existsSync('/.dockerenv') ? 'external' : 'workspace-write')) === 'external'
    const child = spawn(process.env.CODEX_PATH ?? 'codex', ['app-server', '--stdio'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stderr = ''
    let processError: Error | undefined
    child.on('error', (error) => { processError = error })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => { stderr += chunk })
    const abort = () => child.kill()
    signal?.addEventListener('abort', abort, { once: true })

    writeMessage(child.stdin, {
      method: 'initialize',
      id: 1,
      params: {
        clientInfo: { name: 'charon', title: 'Charon', version: '0.1.0' },
        capabilities: { experimentalApi: true, requestAttestation: false },
      },
    })

    let completed = false
    try {
      const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
      for await (const line of lines) {
        if (!line) continue
        const message = JSON.parse(line) as RpcMessage
        if (message.error) throw new Error(message.error.message ?? 'Codex app server request failed')

        if (message.id === 1) {
          writeMessage(child.stdin, { method: 'initialized', params: {} })
          writeMessage(child.stdin, {
            method: 'thread/start',
            id: 2,
            params: {
              cwd: process.cwd(),
              approvalPolicy: 'never',
              sandbox: 'workspace-write',
              config: { 'sandbox_workspace_write.writable_roots': [contextRoot()] },
              ephemeral: true,
            },
          })
        } else if (message.id === 2) {
          const threadId = message.result?.thread?.id
          if (!threadId) throw new Error('Codex app server did not return a thread ID')
          writeMessage(child.stdin, {
            method: 'turn/start',
            id: 3,
            params: {
              threadId,
              ...(externalSandbox ? { sandboxPolicy: { type: 'externalSandbox', networkAccess: 'enabled' } } : {}),
              input: [{ type: 'text', text: prompt, text_elements: [] }],
            },
          })
        }

        if (message.method === 'turn/started') yield { type: 'status', message: 'Thinking…' }
        if (message.method === 'item/agentMessage/delta' && typeof message.params?.delta === 'string') {
          yield { type: 'text', delta: message.params.delta }
        }
        if ((message.method === 'item/started' || message.method === 'item/completed') && message.params?.item) {
          const event = codexToolEvent(message.method, message.params.item)
          if (event) yield event
        }
        if (message.method === 'error') throw new Error(message.params?.error?.message ?? message.params?.message ?? 'Codex run failed')
        if (message.method === 'turn/completed') {
          if (message.params?.turn?.status === 'failed') throw new Error(message.params.turn.error?.message ?? 'Codex turn failed')
          completed = true
          break
        }
      }
      if (!completed) throw processError ?? new Error(stderr.trim() || 'Codex ended without completing the turn')
    } finally {
      signal?.removeEventListener('abort', abort)
      child.kill()
    }
  }
}
