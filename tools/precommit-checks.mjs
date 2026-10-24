import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDocumentationPath } from './documentation-paths.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexingFiles = new Set(['.ignore', '.cursorignore', '.cursorindexingignore']);

// Git exports repository-local variables to hooks. Child commands must discover
// the repository from their explicit cwd, including temporary Git fixtures.
export function isolatedGitEnvironment(env = process.env) {
  const result = { ...env };
  for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_PREFIX',
    'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_SHALLOW_FILE',
    'GIT_GRAFT_FILE', 'GIT_REPLACE_REF_BASE', 'GIT_NO_REPLACE_OBJECTS',
    'GIT_IMPLICIT_WORK_TREE', 'GIT_INTERNAL_SUPER_PREFIX', 'GIT_CONFIG',
    'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT']) delete result[name];
  for (const name of Object.keys(result)) if (/^GIT_CONFIG_(?:KEY|VALUE)_\d+$/.test(name)) delete result[name];
  return result;
}

export function parseStagedChanges(output) {
  if (output === '') return [];
  if (!output.endsWith('\0')) throw Error('Invalid staged-file output: missing NUL terminator');
  const tokens = output.slice(0, -1).split('\0');
  if (tokens.length % 2 !== 0) throw Error('Invalid staged-file output: incomplete status/path pair');
  const changes = [];
  for (let i = 0; i < tokens.length; i += 2) {
    if (!/^[A-Z]$/.test(tokens[i]) || tokens[i + 1] === '') {
      throw Error('Invalid staged-file output: unexpected status/path');
    }
    changes.push({ status: tokens[i], path: tokens[i + 1] });
  }
  return changes;
}

export function readStagedChanges(root, { env = isolatedGitEnvironment() } = {}) {
  const result = spawnSync('git', [
    '-c', 'diff.relative=false', 'diff', '--cached', '--name-status', '-z',
    '--no-renames', '--no-ext-diff', '--no-textconv', '--',
  ], { cwd: root, encoding: 'utf8', env });
  if (result.error || result.status !== 0) {
    throw Error('Cannot inspect staged changes: ' + (result.error?.message || result.stderr || result.signal || result.status));
  }
  return parseStagedChanges(result.stdout);
}

export function verificationMode(changes, { forceFull = false, env = process.env } = {}) {
  if (forceFull || env.CI || env.GITHUB_ACTIONS) return 'full';
  return changes.every(change =>
    /^[AMD]$/.test(change.status) &&
    !change.path.split('/').some(part => part === '.' || part === '..') &&
    !change.path.includes('\\') &&
    (indexingFiles.has(change.path) || isDocumentationPath(change.path))
  ) ? 'documentation' : 'focused';
}

export function parseArgs(args) {
  if (args.some(arg => !['--full', '--plan'].includes(arg))) {
    throw Error('Usage: node tools/precommit-checks.mjs [--full] [--plan]');
  }
  return { forceFull: args.includes('--full'), planOnly: args.includes('--plan') };
}

// Static ESM only: do not evaluate helpers, dynamic imports or require calls.
// Keep quoted strings as tokens so comments and example code cannot add edges.
function staticRelativeImports(source) {
  const tokens = [...source.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[\w$]+|[^\s]/g)]
    .map(match => match[0]).filter(token => !token.startsWith('//') && !token.startsWith('/*'));
  const imports = [];
  const add = token => {
    if (/^["']\.\.?\//.test(token) && !token.includes('\\')) imports.push(token.slice(1, -1));
  };
  for (let i = 0; i < tokens.length; i++) {
    const kind = tokens[i], next = tokens[i + 1];
    if (!['import', 'export'].includes(kind) || tokens[i - 1] === '.' || !next) continue;
    if (kind === 'import' && /^["']/.test(next)) { add(next); continue; }
    if (kind === 'import' ? !/^(?:\w|[$*{])/.test(next) : !['*', '{'].includes(next)) continue;
    for (let j = i + 2; j < tokens.length && ![';', 'import', 'export'].includes(tokens[j]); j++) {
      if (tokens[j] === 'from' && /^["']/.test(tokens[j + 1] ?? '')) { add(tokens[j + 1]); break; }
    }
  }
  return imports;
}

function fixtureConsumerTests(changes, root) {
  const changed = new Set(changes.map(change => change.path));
  if (![...changed].some(path => /\.[cm]?js$/.test(path))) return [];
  // Check every path component before reading. In particular, a fixture folder
  // may be a Windows junction even when the final module looks like a file.
  function safePath(path, { missing = false, directory = false } = {}) {
    let target = root;
    const parts = path.split('/');
    for (let i = 0; i < parts.length; i++) {
      target = resolve(target, parts[i]);
      let info;
      try { info = lstatSync(target); }
      catch (error) { if (error.code === 'ENOENT') return missing; throw error; }
      if (info.isSymbolicLink()) return false;
      if (i < parts.length - 1 || directory) { if (!info.isDirectory()) return false; }
      else if (!info.isFile()) return false;
    }
    return true;
  }
  if (!safePath('test', { directory: true })) return [];
  const dependencies = new Map();
  const forbidden = new Set(['node_modules', 'arkiv', 'random-stuff-jakob']);
  function imports(path) {
    if (dependencies.has(path)) return dependencies.get(path);
    const found = staticRelativeImports(readFileSync(resolve(root, path), 'utf8'))
      .map(specifier => posix.normalize(posix.join(posix.dirname(path), specifier)))
      .filter(target => !target.startsWith('../') && !target.split('/').some(part => forbidden.has(part) || part.startsWith('.')));
    dependencies.set(path, found);
    return found;
  }
  function reachesChange(path, seen = new Set()) {
    if (seen.has(path)) return false;
    seen.add(path);
    for (const target of imports(path)) {
      const fixture = target.startsWith('test/fixtures/') && /\.[cm]?js$/.test(target);
      if (fixture && !safePath(target, { missing: true })) continue;
      // Missing targets still count: deleting a used helper must run its tests.
      // Production modules are leaf dependencies and are never opened here.
      if (changed.has(target) && (fixture || path.startsWith('test/fixtures/'))) return true;
      if (fixture && safePath(target) && reachesChange(target, seen)) return true;
    }
    return false;
  }
  return readdirSync(resolve(root, 'test'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.mjs'))
    .map(entry => `test/${entry.name}`).filter(path => reachesChange(path));
}

export function focusedTests(changes, root = repositoryRoot) {
  const selected = new Set();
  const add = path => { if (existsSync(resolve(root, path))) selected.add(path); };
  for (const { path } of changes) {
    // Only repository-relative paths, never options or traversal from a diff.
    if (path.startsWith('-') || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => ['', '.', '..'].includes(part))) {
      throw Error('Invalid changed path');
    }
    if (/(?:\.test\.[cm]?js$|^(?:test|apps\/[^/]+\/test)\/[^/]+\.mjs$)/.test(path)) add(path);
    // Moved shared contracts keep their existing behavioral regression suites.
    const registryTests = {
      'runtime-catalog': ['test/runtime-media-catalog.mjs'],
      'registry-core': ['apps/studio/test/video-registry.test.mjs', 'apps/studio/test/blob-source-routing.test.mjs'],
      'registry-reader': ['apps/studio/test/neon-video-registry.test.mjs'],
      'blob-reader': ['apps/studio/test/cloud-media-store.test.mjs'],
      'private-media-contract': ['apps/studio/test/cloud-media-store.test.mjs'],
      'video-manifest': ['apps/studio/test/lab-video-manifest.test.mjs'],
      'storage-contract': ['test/studio-repository.mjs'],
      'video-dealer-registration': ['apps/studio/test/dealer-video-registration.test.mjs'],
    };
    if (path.startsWith('packages/studio-registry/server/')) {
      for (const candidate of registryTests[basename(path, '.mjs')] ?? []) add(candidate);
    }
    const stem = basename(path).replace(/\.[^.]+$/, '');
    const directory = dirname(path).replaceAll('\\', '/');
    for (const candidate of [
      `${directory}/${stem}.test.mjs`, `${directory}/${stem}.test.js`,
      `${directory}/test/${stem}.test.mjs`, `${directory}/test/${stem}.mjs`,
      `test/${stem}.mjs`,
      ...(path.startsWith('apps/studio/') ? [`apps/studio/test/${stem}.test.mjs`] : []),
      ...(path.startsWith('apps/') ? [`${path.split('/').slice(0, 2).join('/')}/test/${stem}.mjs`] : []),
    ]) add(candidate);
    if (/^(?:\.githooks\/|\.github\/workflows\/|tools\/(?:precommit-checks|ci-changes|documentation-paths|check-push-target|push-github-work)\.mjs$)/.test(path)) {
      for (const file of ['test/precommit-checks.mjs', 'test/ci-changes.mjs', 'test/github-workflow.mjs']) add(file);
    }
  }
  for (const path of fixtureConsumerTests(changes, root)) selected.add(path);
  return [...selected].sort();
}

export function checkPlan(mode, { changes = [], root = repositoryRoot } = {}) {
  if (mode === 'full') return [['sh', '.githooks/pre-commit-full']];
  if (!['documentation', 'focused'].includes(mode)) throw Error('Unknown verification mode');
  const tests = focusedTests(changes, root);
  const commands = [['git', 'diff', '--cached', '--check']];
  for (const { status, path } of changes) {
    if (status === 'D' || !existsSync(resolve(root, path))) continue;
    if (/\.[cm]?js$/.test(path)) commands.push([process.execPath, '--check', path]);
    if (/\.json$/.test(path)) commands.push([process.execPath, '-e',
      "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))", path]);
  }
  if (changes.some(({path}) => /^(?:docs\/environment-variables\.json|tools\/check-environment-variables\.mjs)$/.test(path))) {
    commands.push([process.execPath, 'tools/check-environment-variables.mjs']);
  }
  if (changes.some(({path}) => /^apps\/web\/.+\.[cm]?[jt]sx?$/.test(path))) {
    commands.push([process.execPath, 'apps/web/node_modules/typescript/bin/tsc',
      '--project', 'apps/web/tsconfig.json', '--noEmit', '--incremental', 'false']);
  }
  if (tests.length) commands.push([process.execPath, '--test', '--test-concurrency=4', ...tests]);
  return commands;
}

export function runChecks(commands, { cwd = repositoryRoot, run = spawnSync } = {}) {
  for (const [command, ...args] of commands) {
    const env = isolatedGitEnvironment();
    if (command === 'git' && args.includes('--cached') && process.env.GIT_INDEX_FILE) env.GIT_INDEX_FILE = process.env.GIT_INDEX_FILE;
    const result = run(command, args, { cwd, stdio: 'inherit', env });
    if (result.error) {
      console.error('Verification could not start: ' + result.error.message);
      return 1;
    }
    if (result.status !== 0) {
      if (result.signal) console.error('Verification interrupted by ' + result.signal);
      return Number.isInteger(result.status) && result.status > 0 ? result.status : 1;
    }
  }
  return 0;
}

export function main(args = process.argv.slice(2)) {
  const { forceFull, planOnly } = parseArgs(args);
  const indexEnv = isolatedGitEnvironment();
  // The invoking Git commit can own a temporary index (for example --only).
  // Keep that exact index only for this hook's own inspection, never its checks.
  if (process.env.GIT_INDEX_FILE) indexEnv.GIT_INDEX_FILE = process.env.GIT_INDEX_FILE;
  const changes = readStagedChanges(repositoryRoot, { env: indexEnv });
  const mode = verificationMode(changes, { forceFull });
  const commands = checkPlan(mode, { changes });
  if (planOnly) {
    console.log(JSON.stringify({ mode, commands }));
    return 0;
  }
  console.log(mode === 'full'
    ? 'Full regression: CI or explicit --full.'
    : `Local ${mode} checks: changed files and available related tests. Full regression runs in CI; use --full locally when needed.`);
  return runChecks(commands);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
