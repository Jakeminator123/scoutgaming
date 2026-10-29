import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { blueprintNames, compareKeys, hardcodedNameReferences, hardcodedNames, hasEnvChange, parseEnvNames, referencedNames, templateNames, validateRegistry } from '../tools/check-environment-variables.mjs';

const committedRegistry = () => JSON.parse(readFileSync(new URL('../docs/environment-variables.json', import.meta.url), 'utf8'));

test('the committed registry is structurally valid and every listed source exists', () => {
  // Structural only: service keys and variable names are not locked here.
  const registry = JSON.parse(readFileSync(new URL('../docs/environment-variables.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateRegistry(registry), []);
  assert.ok(Object.keys(registry.services).length > 0);
  for (const [service, entry] of Object.entries(registry.services)) {
    for (const file of entry.sources) assert.ok(existsSync(new URL('../' + file, import.meta.url)), `${service}: ${file}`);
  }
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

test('the five fixed flags are named nowhere in tracked code, tests, build scripts or config', () => {
  const names = hardcodedNames(committedRegistry());
  assert.equal(names.length, 5);
  assert.deepEqual(hardcodedNameReferences(names), []);
  // A fixed name is never also listed as read by a service.
  const registry = committedRegistry();
  registry.services['vercel-lab-ui'].conditional.push(names[0]);
  assert.match(validateRegistry(registry).join(' '), /is hard-coded and must not be listed as read/);
});

test('a reintroduced read of a fixed flag is caught in source, test, build script and Next config, but not in docs', t => {
  const [name] = hardcodedNames(committedRegistry());
  const repository = mkdtempSync(join(tmpdir(), 'croupier-hardcoded-guard-'));
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  const files = {
    'packages/example/runtime.mjs': `export const on = process.env.${name} === '1';\n`,
    'test/example.mjs': `const env = { ${name}: '0' };\n`,
    'apps/studio/next.config.mjs': `export default { basePath: process.env['${name}'] };\n`,
    'vercel.json': `{"env":{"${name}":"1"}}\n`,
    'docs/ENVIRONMENT-VARIABLES.md': `| \`${name}\` | fixed |\n`,
    'services/game/README.md': `${name} is gone.\n`,
    '.github/workflows/check.yml': `env:\n  ${name}: '1'\n`,
    'packages/example/other.mjs': `export const similar = process.env.${name}_EXTRA;\n`,
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(repository, dirname(path)), { recursive: true });
    writeFileSync(join(repository, path), text);
  }
  execFileSync('git', ['init', '-q'], { cwd: repository });
  execFileSync('git', ['add', '.'], { cwd: repository });
  const found = hardcodedNameReferences([name], { cwd: repository });
  assert.deepEqual(found.map(row => row.path).sort(), ['apps/studio/next.config.mjs', 'packages/example/runtime.mjs', 'test/example.mjs', 'vercel.json']);
  assert.ok(found.every(row => row.line === 1 && row.names.length === 1 && row.names[0] === name));
  assert.deepEqual(hardcodedNameReferences([], { cwd: repository }), []);
});
