import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { blueprintNames, compareKeys, hasEnvChange, parseEnvNames, referencedNames, templateNames, validateRegistry } from '../tools/check-environment-variables.mjs';

test('active media sources belong to their deployed service inventories', () => {
  const registry = JSON.parse(readFileSync(new URL('../docs/environment-variables.json', import.meta.url), 'utf8'));
  const studio = registry.services['vercel-lab-ui'];
  for (const file of ['apps/studio/lib/cloud-media-store.mjs', 'apps/studio/lib/video-registry.mjs']) assert.ok(studio.sources.includes(file), 'vercel-lab-ui: ' + file);
  const game = registry.services['render-game'];
  for (const file of ['services/game/blob-media.mjs', 'services/game/storage/video-registry.mjs', 'services/game/storage/legacy-clip-inventory.mjs', 'services/game/storage/studio-media-runtime.mjs']) assert.ok(game.sources.includes(file), file);
  assert.ok(game.conditional.includes('NEXT_PUBLIC_LAB_BASE_PATH'));
  assert.ok(studio.sources.includes('apps/studio/lib/legacy-clip-inventory.mjs'));
  for (const name of ['LAB_PUBLIC_URL', 'CROUPIER_DATA_DIR']) assert.ok(studio.conditional.includes(name), name);
});

test('detects newly read deployment variable names', () => {
  assert.deepEqual([...referencedNames('env.NEW_KEY; process.env.PORT; env["BRACKET_KEY"]; env[name];')].sort(), ['BRACKET_KEY', 'NEW_KEY', 'PORT']);
});

test('parses names only and never exposes values', () => {
  const names = parseEnvNames('# SECRET=no\nexport TOKEN=private-secret\nURL=https://example.test\n');
  assert.deepEqual([...names].sort(), ['TOKEN', 'URL']);
  assert.equal([...names].includes('private-secret'), false);
});

test('recognizes commented example keys but not commentary', () => {
  assert.deepEqual([...templateNames('# LAB_REMOTE_URL=\n# Explanation only\nTOKEN=\n')].sort(), ['LAB_REMOTE_URL', 'TOKEN']);
});

test('compares required and unlisted names', () => {
  const entry = { required: ['A'], firstBoot: [], conditional: ['B'], managed: [], blocked: [] };
  assert.deepEqual(compareKeys(entry, new Set(['B', 'C'])), { missing: ['A'], unlisted: ['C'] });
});

test('rejects duplicate registry names', () => {
  const registry = { schema: 1, services: { sample: { sources: [], required: ['A'], firstBoot: ['A'], conditional: [], managed: [], blocked: [] } } };
  assert.match(validateRegistry(registry).join(' '), /duplicate A/);
});

test('detects staged environment edits, not patch metadata', () => {
  assert.equal(hasEnvChange('+++ b/file.mjs\n@@ -1 +1 @@\n-env.OLD\n+env.NEW'), true);
  assert.equal(hasEnvChange('+++ b/file.mjs\n@@ -1 +1 @@\n-const x = 1\n+const x = 2'), false);
  assert.equal(hasEnvChange('@@ -1 +1 @@\n-# LAB_REMOTE_URL=old\n+# LAB_REMOTE_URL=new', true), true);
  assert.equal(hasEnvChange('@@ -1 +1 @@\n-      - key: OLD\n+      - key: NEW', true), true);
  assert.equal(hasEnvChange('@@ -1 +1 @@\n-        value: old\n+        value: new', true), true);
});

test('separates Blueprint service environment keys', () => {
  const source = 'services:\n  - type: web\n    name: first\n    envVars:\n      - key: FIRST\n  - type: pserv\n    name: second\n    envVars:\n      - key: SECOND\n';
  assert.deepEqual([...blueprintNames(source, 'second')], ['SECOND']);
});
