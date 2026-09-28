// Run with Node against a packaged local-process-sandbox.js (or patched fixture).
// Executes real bwrap without model requests; must run outside another sandbox.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const { buildLocalProcessSandboxSpawnTarget } = await import(pathToFileURL(path.resolve(process.argv[2])));
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paperclip-bwrap-test-'));
const workspace = path.join(root, 'workspace');
const hidden = path.join(root, 'outside.txt');
await fs.mkdir(workspace);
await fs.writeFile(hidden, 'host-only');
const probe = `
  const fs = require('node:fs');
  const assert = require('node:assert/strict');
  assert.equal(fs.existsSync(${JSON.stringify(hidden)}), false);
  assert.equal(fs.existsSync('/run/current-system/sw/bin/bash'), true);
  assert.equal(fs.existsSync('/etc/ssl/certs/ca-certificates.crt'), true);
  const storeMount = fs.readFileSync('/proc/self/mountinfo', 'utf8').split('\\n').find(line => line.split(' ')[4] === '/nix/store');
  assert.ok(storeMount?.split(' ')[5].split(',').includes('ro'));
  const codex = require('node:child_process').spawnSync('/run/current-system/sw/bin/codex', ['--version'], { encoding: 'utf8' });
  assert.equal(codex.status, 0, codex.stderr);
  assert.match(codex.stdout, /codex-cli/);
  fs.writeFileSync('output.txt', 'sandbox write');
  console.log('sandbox runtime OK');
`;
try {
  for (const networkScope of ['deny', 'allowlist']) {
    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: '/run/current-system/sw/bin/node', args: ['-e', probe], cwd: workspace,
      options: { filesystemScope: 'workspace', workspaceDir: workspace, networkScope,
        networkAllowlist: networkScope === 'allowlist' ? ['example.com'] : [] },
    });
    try {
      const env = { ...process.env, ...target.env };
      for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
      const child = spawnSync(target.command, target.args, { cwd: target.cwd, env, encoding: 'utf8', timeout: 15000 });
      assert.equal(child.status, 0, `${child.error ?? ''}\n${child.stderr}`);
      assert.equal(await fs.readFile(path.join(workspace, 'output.txt'), 'utf8'), 'sandbox write');
      console.log(`PASS ${networkScope}: Node/Codex and CA certificates available, store read-only, workspace writable, outside file hidden`);
    } finally { await target.cleanup?.(); }
  }
} finally { await fs.rm(root, { recursive: true, force: true }); }
