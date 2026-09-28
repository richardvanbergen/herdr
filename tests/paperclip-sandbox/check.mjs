// Run with Node against a packaged adapter-utils/dist/local-process-sandbox.js.
// Executes real bwrap without model requests; must run outside another sandbox.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const { buildLocalProcessSandboxSpawnTarget } = await import(pathToFileURL(path.resolve(process.argv[2])));
const { prepareHeartbeatRunScratch, cleanupHeartbeatRunScratch, buildHeartbeatRunScratchEnv } = await import(pathToFileURL(path.resolve(path.dirname(process.argv[2]), '../../server/dist/services/run-scratch.js')));
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paperclip-bwrap-test-'));
const workspace = path.join(root, 'workspace');
const hidden = path.join(root, 'outside.txt');
await fs.mkdir(workspace);
await fs.writeFile(path.join(workspace, 'AGENTS.md'), 'sandbox fixture instructions');
const scratch = await prepareHeartbeatRunScratch({ companyId: 'test-company', agentId: 'test-agent', runId: 'sandbox-test-run' });
const scratchEnv = buildHeartbeatRunScratchEnv({}, scratch).env;
await fs.writeFile(hidden, 'host-only');
const probe = `
  const fs = require('node:fs');
  const assert = require('node:assert/strict');
  assert.equal(fs.existsSync(${JSON.stringify(hidden)}), false);
  assert.equal(fs.existsSync('/run/current-system/sw/bin/bash'), true);
  assert.equal(fs.existsSync('/etc/ssl/certs/ca-certificates.crt'), true);
  const storeMount = fs.readFileSync('/proc/self/mountinfo', 'utf8').split('\\n').find(line => line.split(' ')[4] === '/nix/store');
  assert.ok(storeMount?.split(' ')[5].split(',').includes('ro'));
  const codex = require('node:child_process').spawnSync('/run/current-system/sw/bin/codex', ['sandbox', '--', '/run/current-system/sw/bin/bash', '-c', 'pwd; cat AGENTS.md; test -d "$TMPDIR"'], { encoding: 'utf8' });
  assert.equal(codex.status, 0, codex.stderr);
  assert.ok(codex.stdout.includes(${JSON.stringify(workspace)}));
  assert.match(codex.stdout, /sandbox fixture instructions/);
  fs.writeFileSync(require('node:path').join(process.env.TMPDIR, 'active-run'), 'scratch write');
  fs.writeFileSync('output.txt', 'sandbox write');
  console.log('sandbox runtime OK');
`;
try {
  for (const networkScope of ['deny', 'allowlist']) {
    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: '/run/current-system/sw/bin/node', args: ['-e', probe], cwd: workspace,
      options: { filesystemScope: 'workspace', workspaceDir: workspace, networkScope,
        managedPaths: [{path: scratch.dir, access: 'rw'}],
        networkAllowlist: networkScope === 'allowlist' ? ['example.com'] : [] },
    });
    try {
      const env = { ...process.env, ...scratchEnv, CODEX_HOME: workspace, ...target.env };
      for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
      const child = spawnSync(target.command, target.args, { cwd: target.cwd, env, encoding: 'utf8', timeout: 15000 });
      assert.equal(child.status, 0, `${child.error ?? ''}\n${child.stderr}`);
      assert.equal(await fs.readFile(path.join(workspace, 'output.txt'), 'utf8'), 'sandbox write');
      assert.equal(await fs.readFile(path.join(scratch.dir, 'active-run'), 'utf8'), 'scratch write');
      const cleanup = await cleanupHeartbeatRunScratch({scratch, processGroupId: 123, isProcessGroupAlive: () => true});
      assert.equal(cleanup.reason, 'process_group_alive');
      assert.ok((await fs.stat(scratch.dir)).isDirectory());
      console.log(`PASS ${networkScope}: Codex executes pwd and reads instructions, scratch shared and retained while active, CA certificates available, store read-only, workspace writable, outside file hidden`);
    } finally { await target.cleanup?.(); }
  }
} finally {
  const cleanup = await cleanupHeartbeatRunScratch({scratch, isProcessGroupAlive: () => false});
  assert.equal(cleanup.removed, true);
  await assert.rejects(fs.stat(scratch.dir), {code: 'ENOENT'});
  await fs.rm(root, { recursive: true, force: true });
}
