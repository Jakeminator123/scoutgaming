import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDocumentationPath } from './documentation-paths.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexingFiles = new Set(['.ignore', '.cursorignore']);
// The orphan audit knows which tests a runner registers. CI's sparse classifier
// checkout and copied fixtures carry only this file; then no consumers are added.
const orphanAudit = existsSync(fileURLToPath(new URL('./check-orphan-tests.mjs', import.meta.url)))
  ? await import('./check-orphan-tests.mjs') : null;

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

function stagedDiff(root, env, base = []) {
  const result = spawnSync('git', [
    '-c', 'diff.relative=false', 'diff', '--cached', '--name-status', '-z',
    '--no-renames', '--no-ext-diff', '--no-textconv', ...base, '--',
  ], { cwd: root, encoding: 'utf8', env });
  if (result.error || result.status !== 0) {
    throw Error('Cannot inspect staged changes: ' + (result.error?.message || result.stderr || result.signal || result.status));
  }
  return parseStagedChanges(result.stdout);
}

// The merged commit (MERGE_HEAD) while `git merge` is in progress, else null.
export function readMergeHead(root, { env = isolatedGitEnvironment() } = {}) {
  const result = spawnSync('git', ['rev-parse', '-q', '--verify', 'MERGE_HEAD^{commit}'], { cwd: root, encoding: 'utf8', env });
  if (result.error) throw Error('Cannot inspect merge state: ' + result.error.message);
  const value = result.status === 0 ? result.stdout.trim() : '';
  if (result.status === 0 && !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(value)) throw Error('Cannot inspect merge state: unexpected MERGE_HEAD');
  return value || null;
}

// During a merge the index holds everything the merged branch changed since the
// fork point. Those paths were already checked there, so only paths whose index
// entry differs from BOTH HEAD and MERGE_HEAD are this commit's own work:
// conflict resolutions and edits made during the merge. A deletion counts when
// one side still has the file. This only holds when the merged commit is main
// (or older main): any other branch was never checked, so all paths stay. An
// octopus merge compares with the first head, which can only keep more paths.
// Full CI still checks everything.
export function readStagedChanges(root, { env = isolatedGitEnvironment() } = {}) {
  const changes = stagedDiff(root, env);
  const mergeHead = changes.length ? readMergeHead(root, { env }) : null;
  if (!mergeHead) return changes;
  const onMain = spawnSync('git', ['merge-base', '--is-ancestor', mergeHead, 'refs/remotes/origin/main'], { cwd: root, encoding: 'utf8', env });
  if (onMain.error || onMain.status !== 0) return changes;
  const differsFromMerged = new Set(stagedDiff(root, env, [mergeHead]).map(change => change.path));
  return changes.filter(change => differsFromMerged.has(change.path));
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

// --pr-diff: the committed diff HEAD^1..HEAD instead of the index. In CI that is
// the PR merge commit against main (draft PRs run only these targeted checks);
// locally it is the last commit. CI environment flags do not force --full there.
export function parseArgs(args) {
  if (args.some(arg => !['--full', '--plan', '--pr-diff'].includes(arg)) || (args.includes('--full') && args.includes('--pr-diff'))) {
    throw Error('Usage: node tools/precommit-checks.mjs [--full | --pr-diff] [--plan]');
  }
  return { forceFull: args.includes('--full'), planOnly: args.includes('--plan'), prDiff: args.includes('--pr-diff') };
}

export const PR_DIFF = Object.freeze(['HEAD^1', 'HEAD']);

export function readCommittedChanges(root, { env = isolatedGitEnvironment(), range = PR_DIFF } = {}) {
  const result = spawnSync('git', ['-c', 'diff.relative=false', 'diff', '--name-status', '-z',
    '--no-renames', '--no-ext-diff', '--no-textconv', ...range, '--'], { cwd: root, encoding: 'utf8', env });
  if (result.error || result.status !== 0) {
    throw Error('Cannot inspect committed changes: ' + (result.error?.message || result.stderr || result.signal || result.status));
  }
  return parseStagedChanges(result.stdout);
}

// A new test file that no runner lists fails CI's orphan audit (admin-contracts leg);
// the same audit runs here as soon as a commit adds one. Mirrors isTestFile in
// tools/check-orphan-tests.mjs for the discovery roots it walks.
export function addsTestFile(changes) {
  return changes.some(({ status, path }) => status === 'A'
    && /^(?:test|apps|services|packages|ops|tools\/media)\//.test(path)
    && !path.split('/').some(part => ['fixtures', '__fixtures__', 'node_modules'].includes(part))
    && /\.(?:mjs|js|cjs|ts|mts|cts)$/.test(path)
    && (/\.(?:test|spec)\.[^.]+$/.test(path) || path.split('/').slice(0, -1).some(part => part === 'test' || part === 'tests')
      || (path.startsWith('tools/media/') && basename(path).startsWith('test-'))));
}

// Printed after a failed check whose plain output does not say what to do.
const CHECK_HINTS = Object.freeze({
  'tools/check-orphan-tests.mjs': 'Orphan tests: add each listed file to a run_node_tests line in .githooks/pre-commit-full '
    + '(the suite that owns its area: studio, admin, contracts, database, presentation, access, speech, gameplay, engine or container), '
    + 'or classify a helper/opt-in module in tools/orphan-tests-exceptions.json. CI fails the admin-contracts leg otherwise.',
});

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

// Text sources a test can load by path; documentation keeps its quick path.
const consumerSource = /\.(?:[cm]?[jt]sx?|css|html|json)$/;
// A source named by more tests than this is a shared contract (studio-model.mjs is
// named by over a hundred). The full regression runs all of them; a subset chosen
// here would only look complete, so such a source adds no consumers.
export const SOURCE_CONSUMER_LIMIT = 8;

// String literals outside comments. A template literal counts only without
// placeholders: a computed path is unknown.
function* stringLiterals(source) {
  for (const { 0: token, index } of source.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|`(?:\\.|[^`\\])*`/g)) {
    if (token[0] !== '/' && !(token[0] === '`' && token.includes('${'))) yield { value: token.slice(1, -1), index };
  }
}

// The call a string is passed to: resolve(root, 'x') gives resolve, new URL('x', base)
// gives URL. A string in an array, an object, a comparison or an assignment is data.
function calleeOf(source, index) {
  let depth = 0;
  for (let i = index - 1; i >= 0 && index - i <= 400; i--) {
    const ch = source[i];
    if (')]}'.includes(ch)) depth++;
    else if ('([{'.includes(ch) && depth) depth--;
    else if (ch === '(') return source.slice(Math.max(0, i - 80), i).match(/([\w$]+)\s*$/)?.[1] ?? '';
    else if ('[{;'.includes(ch) || (ch === '=' && !depth)) return '';
  }
  return '';
}
const pathLoaders = new Set(['import', 'require', 'resolve', 'join', 'read', 'readdir', 'load', 'compile', 'transform',
  'tsx', 'jsx', 'url', 'source', 'module', 'file', 'path', 'stat', 'exists']);
const loadsPath = name => (name.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+/g) ?? []).some(word => pathLoaders.has(word.toLowerCase()));

// Registered tests in another folder or under another name that load a changed
// source by path, e.g. client/admin/lib/*.test.mjs compiling
// new URL('../components/studio/x.tsx', import.meta.url). Only for sources that
// got no test above; static text, nothing is evaluated.
// Exact: a './' or '../' string resolved from the test's folder, or the path from
// the repository root passed to a loader (import, require, resolve, join, readFile,
// compile, URL, ...; checked by calleeOf/loadsPath), with or without extension.
// Only without an exact name, and only passed to a loader: a trailing part of at
// least two segments ('components/x.tsx', 'ui/kit'), the file name with extension,
// or a hyphenated name without extension (tsx('dealer-directory')). Path lists in
// classification tests and single words such as 'dialog' or 'error' are data.
function sourceConsumerTests(paths, root) {
  if (!paths.length || !orphanAudit) return [];
  const targets = paths.map(path => {
    const stemPath = path.replace(/\.[^./]+$/, ''), stem = basename(stemPath);
    const trailing = [path, stemPath].flatMap(key => key.split('/').map((_, i, parts) => parts.slice(i).join('/')).slice(1, -1));
    if (/^[\w.]+(?:[-_][\w.]+)+$/.test(stem)) trailing.push(stem);
    return { path, exact: new Set([path, stemPath]), loose: new Set([...trailing, basename(path)]), stem,
      exactTests: new Set(), looseTests: new Set() };
  });
  for (const { file } of orphanAudit.auditOrphanTests({ root }).covered) {
    const source = readFileSync(resolve(root, file), 'utf8');
    // Every rule ends in the file name, so only tests containing it are parsed.
    const relevant = targets.filter(target => target.path !== file && source.includes(target.stem));
    if (!relevant.length) continue;
    for (const { value, index } of stringLiterals(source)) {
      if (!value || value.startsWith('/') || /[\s\\?#*]/.test(value)) continue;
      const relative = /^\.\.?\//.test(value);
      if (!relative && value.startsWith('.')) continue;
      const named = relative ? posix.normalize(posix.join(posix.dirname(file), value)) : value;
      let loader;
      const loaded = () => loader ??= loadsPath(calleeOf(source, index));
      for (const target of relevant) {
        if (relative ? target.exact.has(named) : target.exact.has(value) && loaded()) target.exactTests.add(file);
        else if (!relative && target.loose.has(value) && loaded()) target.looseTests.add(file);
      }
    }
  }
  const tests = new Set();
  for (const { exactTests, looseTests } of targets) {
    const found = exactTests.size ? exactTests : looseTests;
    if (found.size <= SOURCE_CONSUMER_LIMIT) for (const test of found) tests.add(test);
  }
  return [...tests];
}

export function focusedTests(changes, root = repositoryRoot) {
  const selected = new Set();
  const withoutOwnTests = [];
  let own = 0;
  const add = path => { if (existsSync(resolve(root, path))) { selected.add(path); own++; } };
  for (const { path } of changes) {
    // Only repository-relative paths, never options or traversal from a diff.
    if (path.startsWith('-') || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => ['', '.', '..'].includes(part))) {
      throw Error('Invalid changed path');
    }
    own = 0;
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
    // The merge guard shares the freeze prefixes and the branch policy.
    if (/^tools\/(?:o02-freeze-check\.mjs|repository-policy\.json)$/.test(path)) add('test/merge-pr.mjs');
    if (!own && consumerSource.test(path) && !isDocumentationPath(path)) withoutOwnTests.push(path);
  }
  for (const path of fixtureConsumerTests(changes, root)) selected.add(path);
  for (const path of sourceConsumerTests(withoutOwnTests, root)) selected.add(path);
  return [...selected].sort();
}

// committed: plan for the committed range PR_DIFF (--pr-diff) instead of the index.
export function checkPlan(mode, { changes = [], root = repositoryRoot, testWorkers = 4, committed = false } = {}) {
  if (mode === 'full') return [['sh', '.githooks/pre-commit-full']];
  if (!['documentation', 'focused'].includes(mode)) throw Error('Unknown verification mode');
  if (!Number.isInteger(testWorkers) || testWorkers < 1 || testWorkers > 4) throw Error('Focused test workers must be an integer from 1 to 4');
  const tests = focusedTests(changes, root);
  const commands = [committed ? ['git', 'diff', '--check', ...PR_DIFF] : ['git', 'diff', '--cached', '--check']];
  // Repo growth (files over 1 MB, new media binaries, living-document limits) on the staged diff only.
  if (changes.length && existsSync(resolve(root, 'tools/check-repo-limits.mjs'))) {
    commands.push([process.execPath, 'tools/check-repo-limits.mjs', ...(committed ? ['--tree', 'HEAD', '--changed-since', 'HEAD^1'] : ['--cached'])]);
  }
  if (mode === 'focused' && addsTestFile(changes) && existsSync(resolve(root, 'tools/check-orphan-tests.mjs'))) {
    commands.push([process.execPath, 'tools/check-orphan-tests.mjs']);
  }
  for (const { status, path } of changes) {
    if (status === 'D' || !existsSync(resolve(root, path))) continue;
    if (/\.[cm]?js$/.test(path)) commands.push([process.execPath, '--check', path]);
    if (/\.json$/.test(path)) commands.push([process.execPath, '-e',
      "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))", path]);
  }
  if (changes.some(({path}) => ['migrering/status.json', 'migrering/status.mjs', 'migrering/STATUS.md'].includes(path))) {
    commands.push([process.execPath, 'migrering/status.mjs', '--check']);
  }
  if (changes.some(({path}) => /^(?:docs\/environment-variables\.json|tools\/check-environment-variables\.mjs)$/.test(path))) {
    commands.push([process.execPath, 'tools/check-environment-variables.mjs']);
  }
  if (changes.some(({path}) => /^apps\/web\/.+\.[cm]?[jt]sx?$/.test(path))) {
    commands.push([process.execPath, 'apps/web/node_modules/typescript/bin/tsc',
      '--project', 'apps/web/tsconfig.json', '--noEmit', '--incremental', 'false']);
  }
  if (tests.length) commands.push([process.execPath, '--test', `--test-concurrency=${testWorkers}`, ...tests]);
  return commands;
}

export function runChecks(commands, { cwd = repositoryRoot, run = spawnSync } = {}) {
  for (const [command, ...args] of commands) {
    const env = isolatedGitEnvironment();
    // Index readers keep the commit's own index (for example git commit --only); other checks stay isolated.
    const readsIndex = args.includes('--cached') && (command === 'git' || args[0] === 'tools/check-repo-limits.mjs');
    if (readsIndex && process.env.GIT_INDEX_FILE) env.GIT_INDEX_FILE = process.env.GIT_INDEX_FILE;
    const result = run(command, args, { cwd, stdio: 'inherit', env });
    if (result.error) {
      console.error('Verification could not start: ' + result.error.message);
      return 1;
    }
    if (result.status !== 0) {
      if (result.signal) console.error('Verification interrupted by ' + result.signal);
      if (CHECK_HINTS[args[0]]) console.error(CHECK_HINTS[args[0]]);
      return Number.isInteger(result.status) && result.status > 0 ? result.status : 1;
    }
  }
  return 0;
}

export function main(args = process.argv.slice(2)) {
  const { forceFull, planOnly, prDiff } = parseArgs(args);
  const indexEnv = isolatedGitEnvironment();
  // The invoking Git commit can own a temporary index (for example --only).
  // Keep that exact index only for this hook's own inspection, never its checks.
  if (process.env.GIT_INDEX_FILE) indexEnv.GIT_INDEX_FILE = process.env.GIT_INDEX_FILE;
  const changes = prDiff ? readCommittedChanges(repositoryRoot) : readStagedChanges(repositoryRoot, { env: indexEnv });
  // --pr-diff is the targeted CI path for draft PRs: never the full product there.
  const mode = prDiff ? verificationMode(changes, { env: {} }) : verificationMode(changes, { forceFull });
  // Limit simultaneous disposable servers on constrained local machines.
  // This changes scheduling only: CI/full checks and every test stay intact.
  const workerSetting = mode === 'focused' ? process.env.CROUPIER_PRECOMMIT_TEST_WORKERS : undefined;
  if (workerSetting !== undefined && !['1','2','3','4'].includes(workerSetting)) throw Error('CROUPIER_PRECOMMIT_TEST_WORKERS must be 1, 2, 3 or 4');
  const commands = checkPlan(mode, { changes, committed: prDiff, testWorkers: workerSetting === undefined ? 4 : Number(workerSetting) });
  if (planOnly) {
    console.log(JSON.stringify({ mode, commands }));
    return 0;
  }
  console.log(mode === 'full'
    ? 'Full regression: CI or explicit --full.'
    : prDiff ? `Targeted ${mode} checks on ${PR_DIFF.join('..')}: changed files and available related tests. The full regression runs when the PR is ready for review.`
    : `Local ${mode} checks: changed files and available related tests. Full regression runs in CI; use --full locally when needed.`);
  return runChecks(commands);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
