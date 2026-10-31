import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { blueprintNames, compareKeys, fixedEnvironmentUses, hardcodedNameReferences, hardcodedNames, hasEnvChange, parseEnvNames, referencedNames, templateNames, validateRegistry } from '../tools/check-environment-variables.mjs';

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

test('detects semantic environment edits, including defaults, but ignores comments and descriptions', () => {
  assert.equal(hasEnvChange('env.OLD;', 'env.NEW;'), true);
  assert.equal(hasEnvChange('env.PORT;', 'env.PORT; env.PORT;'), true);
  assert.equal(hasEnvChange('const x = 1;', 'const x = 2;'), false);
  assert.equal(hasEnvChange('const x = env.PORT ?? "1";', 'const x = env.PORT ?? "2";'), true);
  assert.equal(hasEnvChange('const x = env.PORT;', '// process.env.FIXED_FLAG\nconst x = env.PORT; const text = "env.FIXED_FLAG";'), false);
  assert.equal(hasEnvChange('const x = env.PORT;', 'const x = env.PORT /* explanation */;'), false);
  assert.equal(hasEnvChange('if (env.PORT) {}', 'if (env.PORT) { const text = "process.env.FIXED_FLAG"; }'), false);
  assert.equal(hasEnvChange('export default env.PORT;', 'export default env.PORT; const text = "env.FIXED_FLAG";'), false);
  assert.equal(hasEnvChange('# LAB_REMOTE_URL=old', '# LAB_REMOTE_URL=new', true), true);
  assert.equal(hasEnvChange('      - key: OLD', '      - key: NEW', true), true);
  assert.equal(hasEnvChange('        value: old', '        value: new', true), true);
});

test('separates Blueprint service environment keys', () => {
  const source = 'services:\n  - type: web\n    name: first\n    envVars:\n      - key: FIRST\n  - type: pserv\n    name: second\n    envVars:\n      - key: SECOND\n';
  assert.deepEqual([...blueprintNames(source, 'second')], ['SECOND']);
});

test('tracked code and configuration do not use fixed names as environment variables', () => {
  const names = hardcodedNames(committedRegistry());
  assert.ok(names.length > 0);
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
    'apps/web/vercel.json': `{"build":{"env":{"${name}":"1"}}}\n`,
    'services/example/.env.example': `# ${name}=\n`,
    'services/example/.env': `${name}=1\n`,
    'services/example/render.yaml': `services:\n  - type: web\n    envVars:\n      - key: ${name}\n`,
    'packages/example/comment.mjs': `// process.env.${name} is retired.\nexport const description = "process.env.${name}";\nexport const metadata = { ${name}: 'historical' };\n`,
    'packages/example/description.json': `{"description":"process.env.${name}","${name}":"historical"}\n`,
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
  execFileSync('git', ['-c', 'core.autocrlf=false', 'add', '.'], { cwd: repository });
  const found = hardcodedNameReferences([name], { cwd: repository });
  assert.deepEqual(found.map(row => row.path).sort(), ['apps/studio/next.config.mjs', 'apps/web/vercel.json', 'packages/example/runtime.mjs', 'services/example/.env', 'services/example/.env.example', 'services/example/render.yaml', 'test/example.mjs', 'vercel.json']);
  assert.ok(found.every(row => row.line > 0 && row.names.length === 1 && row.names[0] === name));
  assert.deepEqual(hardcodedNameReferences([], { cwd: repository }), []);
  writeFileSync(join(repository, 'vercel.json'), `{"env":{"${name}":private-env-value}}`);
  assert.throws(() => hardcodedNameReferences([name], { cwd: repository }), error => {
    assert.match(error.message, /vercel\.json: Invalid environment configuration syntax/);
    assert.equal(error.message.includes('private-env-value'), false);
    return true;
  });
});

test('the CLI rejects an env read and passes when it becomes a comment and descriptive string', t => {
  const repository = mkdtempSync(join(tmpdir(), 'croupier-hardcoded-cli-'));
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  const registry = { schema: 1, hardcodedNames: { names: ['FIXED_FLAG'] },
    services: { sample: { sources: ['packages/example/runtime.mjs'], required: [], firstBoot: [], conditional: [], managed: [], blocked: [] } } };
  const files = {
    'tools/check-environment-variables.mjs': readFileSync(new URL('../tools/check-environment-variables.mjs', import.meta.url), 'utf8'),
    'docs/environment-variables.json': JSON.stringify(registry),
    'docs/ENVIRONMENT-VARIABLES.md': 'Synthetic environment inventory.\n',
    'packages/example/runtime.mjs': "export const on = process.env.FIXED_FLAG === '1';\n",
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(repository, dirname(path)), { recursive: true });
    writeFileSync(join(repository, path), text);
  }
  mkdirSync(join(repository, 'apps/studio'), { recursive: true });
  writeFileSync(join(repository, '.gitignore'), 'node_modules/\n');
  symlinkSync(fileURLToPath(new URL('../apps/studio/node_modules', import.meta.url)), join(repository, 'apps/studio/node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const git = (...args) => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: repository });
  git('init', '-q'); git('add', '.');
  const cli = () => spawnSync(process.execPath, ['tools/check-environment-variables.mjs'], { cwd: repository, encoding: 'utf8' });
  const failed = cli();
  assert.equal(failed.status, 1, failed.stdout);
  assert.match(failed.stderr, /^packages\/example\/runtime\.mjs:1 names FIXED_FLAG, which is hard-coded/m);
  assert.match(failed.stderr, /FIXED_FLAG is read .* but missing from registry/);
  writeFileSync(join(repository, 'packages/example/runtime.mjs'), '// process.env.FIXED_FLAG was removed\nexport const description = "process.env.FIXED_FLAG";\n');
  const passed = cli();
  assert.equal(passed.status, 0, passed.stderr);
  writeFileSync(join(repository, 'packages/example/runtime.mjs'), 'export const port = process.env.ACTIVE_PORT;\n');
  const unlisted = cli();
  assert.equal(unlisted.status, 1);
  assert.match(unlisted.stderr, /ACTIVE_PORT is read .* but missing from registry/);
});

test('a real staged comment passes without inventory edits; env reads, defaults and template changes require both inventories', t => {
  const repository = mkdtempSync(join(tmpdir(), 'croupier-env-staged-'));
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  const runtime = 'packages/example/runtime.mjs';
  const baseline = 'export const port = process.env.ACTIVE_PORT ?? "1";\n';
  const registry = { schema: 1, hardcodedNames: { names: ['FIXED_FLAG'] }, services: {
    sample: { sources: [runtime], templates: ['.env.example'], required: [], firstBoot: [],
      conditional: ['ACTIVE_PORT', 'OTHER_PORT'], managed: [], blocked: [] },
  } };
  const files = {
    '.gitignore': 'node_modules/\n',
    '.env.example': 'ACTIVE_PORT=1\n',
    'tools/check-environment-variables.mjs': readFileSync(new URL('../tools/check-environment-variables.mjs', import.meta.url), 'utf8'),
    'docs/environment-variables.json': JSON.stringify(registry),
    'docs/ENVIRONMENT-VARIABLES.md': 'Synthetic environment inventory.\n',
    [runtime]: baseline,
  };
  for (const [path, source] of Object.entries(files)) {
    mkdirSync(join(repository, dirname(path)), { recursive: true });
    writeFileSync(join(repository, path), source);
  }
  mkdirSync(join(repository, 'apps/studio'), { recursive: true });
  symlinkSync(fileURLToPath(new URL('../apps/studio/node_modules', import.meta.url)), join(repository, 'apps/studio/node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const git = (...args) => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: repository, stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q'); git('add', '.');
  git('-c', 'user.name=Environment guard fixture', '-c', 'user.email=env-guard@example.test', 'commit', '-qm', 'synthetic baseline');
  const cli = () => spawnSync(process.execPath, ['tools/check-environment-variables.mjs'], { cwd: repository, encoding: 'utf8' });
  writeFileSync(join(repository, runtime), baseline + '// process.env.FIXED_FLAG was retired\nconst text = "process.env.FIXED_FLAG";\n');
  git('add', runtime);
  const comment = cli();
  assert.equal(comment.status, 0, comment.stderr);
  for (const source of [baseline.replace('"1"', '"2"'), baseline + 'export const other = process.env.OTHER_PORT;\n']) {
    writeFileSync(join(repository, runtime), source); git('add', runtime);
    const result = cli();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /stage both environment inventory files in the same commit/);
  }
  writeFileSync(join(repository, runtime), baseline); git('add', runtime);
  writeFileSync(join(repository, '.env.example'), 'ACTIVE_PORT=2\n'); git('add', '.env.example');
  assert.match(cli().stderr, /stage both environment inventory files in the same commit/);
  writeFileSync(join(repository, 'docs/ENVIRONMENT-VARIABLES.md'), 'Updated synthetic inventory.\n');
  git('add', 'docs/ENVIRONMENT-VARIABLES.md');
  assert.equal(cli().status, 1, 'one inventory alone is insufficient');
  writeFileSync(join(repository, 'docs/environment-variables.json'), JSON.stringify(registry, null, 2));
  git('add', 'docs/environment-variables.json');
  const passed = cli();
  assert.equal(passed.status, 0, passed.stderr);
});

test('fixed env syntax includes optional reads, destructuring, env objects and scoped const aliases', () => {
  for (const source of [
    'process.env.FIXED_FLAG;', 'env["FIXED_FLAG"];', 'process["env"]?.[`FIXED_FLAG`];',
    'const { FIXED_FLAG: enabled = "0" } = process.env;', '({ FIXED_FLAG: enabled } = env);',
    'const vars = process.env; const second = vars; second.FIXED_FLAG;',
    'const vars = process.env; const { FIXED_FLAG } = vars;',
    'import proc from "node:process"; proc.env.FIXED_FLAG;',
    'import { env as vars } from "node:process"; vars.FIXED_FLAG;',
    'export default { env: { FIXED_FLAG: "1" } };', 'process.env = { FIXED_FLAG: "1" };',
    'Object.assign(process.env, { FIXED_FLAG: "1" });',
    'const vars = {}; function read() { const vars = process.env; return vars.FIXED_FLAG; }',
  ]) assert.deepEqual(fixedEnvironmentUses(source, 'source.mjs', ['FIXED_FLAG']), [{ line: 1, names: ['FIXED_FLAG'] }], source);
});

test('descriptions, types, unrelated properties and shadowed aliases do not become env reads', () => {
  for (const source of [
    '// process.env.FIXED_FLAG\nconst text = "env.FIXED_FLAG";',
    'const text = `process.env.FIXED_FLAG`; const metadata = { FIXED_FLAG: "old" };',
    'process.env.FIXED_FLAG_EXTRA;', 'const key = "FIXED_FLAG"; metadata[key];',
    'function example(process) { return process.env.FIXED_FLAG; }',
    'const vars = process.env; function example(vars) { return vars.FIXED_FLAG; }',
    'const vars = {}; { const vars = process.env; } vars.FIXED_FLAG;',
    'const vars = process.env; function example() { { var vars = {}; } return vars.FIXED_FLAG; }',
    'const vars = process.env; try {} catch (vars) { vars.FIXED_FLAG; }',
    'type Example = { FIXED_FLAG: string }; const text: Example = { FIXED_FLAG: "old" };',
  ]) assert.deepEqual(fixedEnvironmentUses(source, 'source.ts', ['FIXED_FLAG']), [], source);
  assert.deepEqual(fixedEnvironmentUses('declare const env: { FIXED_FLAG: string };', 'types.d.ts', ['FIXED_FLAG']), []);
});
