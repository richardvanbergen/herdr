// Run against the built package's adapter-utils/dist/acpx-engine/execute.js.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { finalizeLaunchEnvironment } = await import(pathToFileURL(resolve(process.argv[2])));
const inheritedEnv = { CODEX_PATH: '/run/current-system/sw/bin/codex', UNRELATED_SECRET: 'must-not-leak' };
const launch = (acpxAgent, inheritHostEnvironment, explicit = {}) =>
  finalizeLaunchEnvironment(explicit, [], { acpxAgent, inheritHostEnvironment, inheritedEnv }).env;
assert.equal(launch('codex', true).CODEX_PATH, inheritedEnv.CODEX_PATH);
assert.equal(launch('codex', true).UNRELATED_SECRET, undefined);
assert.equal(launch('codex', false).CODEX_PATH, undefined);
assert.equal(launch('claude', true).CODEX_PATH, undefined);
assert.equal(launch('codex', true, { CODEX_PATH: '/explicit/codex' }).CODEX_PATH, '/explicit/codex');
console.log('PASS: local Codex inherits configured executable; remote and other providers do not; explicit settings win; unrelated secrets stay filtered');
