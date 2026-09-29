import assert from 'node:assert/strict';
import test from 'node:test';
import { blueprintNames, compareKeys, hasEnvChange, parseEnvNames, referencedNames, templateNames, validateRegistry } from '../tools/check-environment-variables.mjs';

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
