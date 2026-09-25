import { readFile, readdir, realpath } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { stepCountIs, streamText, tool } from 'ai'
import * as z from 'zod'
import type { AgentEvent, AgentRunner } from './runner'

async function workspacePath(path: string) {
  const target = resolve(process.cwd(), path)
  const relation = relative(process.cwd(), target)
  const restricted = (part: string) => part.startsWith('.') || part === 'node_modules'
  if (relation.startsWith('..') || relation.startsWith('/') || relation.split('/').some(restricted)) {
    throw new Error('Path is outside the available project files')
  }
  const actual = await realpath(target)
  const actualRelation = relative(process.cwd(), actual)
  if (actualRelation.startsWith('..') || actualRelation.startsWith('/') || actualRelation.split('/').some(restricted)) {
    throw new Error('Path is outside the available project files')
  }
  return actual
}

/** AI SDK model runner. The tools are deliberately read-only until a write contract is defined. */
export class OpenRouterRunner implements AgentRunner {
  async *run(prompt: string, signal?: AbortSignal): AsyncIterable<AgentEvent> {
    if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not configured')
    const provider = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
    const result = streamText({
      model: provider.chat(process.env.OPENROUTER_MODEL ?? 'openai/gpt-4.1-mini'),
      prompt,
      abortSignal: signal,
      stopWhen: stepCountIs(8),
      tools: {
        listProjectFiles: tool({
          description: 'List files in a project directory',
          inputSchema: z.object({ path: z.string().default('.') }),
          execute: async ({ path }) => (await readdir(await workspacePath(path), { withFileTypes: true }))
            .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
            .slice(0, 100).map((entry) => `${entry.isDirectory() ? 'directory' : 'file'}: ${entry.name}`),
        }),
        readProjectFile: tool({
          description: 'Read a UTF-8 project file',
          inputSchema: z.object({ path: z.string() }),
          execute: async ({ path }) => (await readFile(await workspacePath(path), 'utf8')).slice(0, 30_000),
        }),
      },
    })
    yield { type: 'status', message: 'Thinking…' }
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') yield { type: 'text', delta: part.text }
      else if (part.type === 'tool-call') yield { type: 'tool', id: part.toolCallId, name: part.toolName, status: 'running', detail: JSON.stringify(part.input, null, 2) }
      else if (part.type === 'tool-result') yield { type: 'tool', id: part.toolCallId, name: part.toolName, status: 'completed', detail: JSON.stringify(part.input, null, 2), output: JSON.stringify(part.output, null, 2) }
      else if (part.type === 'tool-error') yield { type: 'tool', id: part.toolCallId, name: part.toolName, status: 'failed', detail: JSON.stringify(part.input, null, 2), output: part.error instanceof Error ? part.error.message : String(part.error) }
      else if (part.type === 'error') throw part.error instanceof Error ? part.error : new Error('OpenRouter stream failed')
    }
  }
}
