import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentRunner } from './runner'

/** Runs in the Charon workspace so Codex can inspect the project and its AGENTS.md. */
export class CodexRunner implements AgentRunner {
  async run(prompt: string): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'charon-agent-'))
    const outputPath = join(directory, 'response.txt')
    try {
      const child = Bun.spawn([
        'codex', 'exec', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'workspace-write',
        '--output-last-message', outputPath, '-',
      ], {
        cwd: process.cwd(),
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
      })
      child.stdin.write(prompt)
      child.stdin.end()
      const timeout = setTimeout(() => child.kill(), 5 * 60 * 1000)
      const [exitCode, stderr] = await Promise.all([
        child.exited,
        new Response(child.stderr).text(),
        new Response(child.stdout).text(),
      ])
      clearTimeout(timeout)
      if (exitCode !== 0) throw new Error(`Codex exited with code ${exitCode}: ${stderr.slice(-500)}`)
      const output = (await readFile(outputPath, 'utf8')).trim()
      if (!output) throw new Error('Codex returned an empty response')
      return output
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
}

export const taskRunner: AgentRunner = new CodexRunner()
