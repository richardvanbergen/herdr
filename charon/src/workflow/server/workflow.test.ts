import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'

// The application keeps one module-level SQLite connection. Run this database
// suite in its own process so it cannot share another suite's temporary database.
test('ready workflow integration scenarios', () => {
 const result = Bun.spawnSync([process.execPath, 'test', './src/workflow/server/workflow.cases.ts'], {
  cwd: fileURLToPath(new URL('../../../', import.meta.url)),
  stdout: 'pipe', stderr: 'pipe', timeout: 30_000,
 })
 if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr))
 expect(result.exitCode).toBe(0)
})
