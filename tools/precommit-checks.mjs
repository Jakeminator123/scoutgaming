import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const documentationFiles = new Set([
  'README.md', 'AGENTS.md', 'CLAUDE.md',
  'lab/README.md', 'lab/docs/README.md',
  // Folder guides describe source ownership; runtime prompts, package metadata
  // and arbitrary Markdown outside docs/ still require the full regression.
  'apps/croupier-frontend/README.md',
  'packages/presentation/README.md', 'packages/design-preview/README.md',
  'packages/presentation/docs/INTEGRATION.md',
  'pipeline/README.md', 'ops/cloud/CONTAINER-CONTEXT.md',
  'services/astrid-gpu-worker/README.md', 'services/astrid-gpu-worker/SOURCE.md',
  'services/astrid-gpu-worker/gateway/README.md',
  'web/README.md', 'web/public/README.md', 'web/storage/README.md',
  'open-claw/README.md', 'open-claw/lab/README.md', 'open-claw/lab/docs/README.md',
  '.ignore', '.cursorignore', '.cursorindexingignore',
]);

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
  if (forceFull || env.CI || env.GITHUB_ACTIONS || changes.length === 0) return 'full';
  return changes.every(change =>
    /^[AMD]$/.test(change.status) &&
    !change.path.split('/').some(part => part === '.' || part === '..') &&
    !change.path.includes('\\') &&
    (documentationFiles.has(change.path) || /^docs\/.+\.md$/.test(change.path))
  ) ? 'documentation' : 'full';
}

export function parseArgs(args) {
  if (args.some(arg => !['--full', '--plan'].includes(arg))) {
    throw Error('Usage: node tools/precommit-checks.mjs [--full] [--plan]');
  }
  return { forceFull: args.includes('--full'), planOnly: args.includes('--plan') };
}

export function checkPlan(mode) {
  if (mode === 'full') return [['sh', '.githooks/pre-commit-full']];
  if (mode !== 'documentation') throw Error('Unknown verification mode');
  return [
    [process.execPath, 'tools/check-environment-variables.mjs'],
    [process.execPath, '--test', 'test/check-environment-variables.mjs', 'test/github-workflow.mjs', 'test/precommit-checks.mjs', 'test/inbox.mjs'],
    ['git', 'diff', '--cached', '--check'],
  ];
}

export function runChecks(commands, { cwd = repositoryRoot, run = spawnSync } = {}) {
  for (const [command, ...args] of commands) {
    const result = run(command, args, { cwd, stdio: 'inherit', env: isolatedGitEnvironment() });
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
  const mode = verificationMode(readStagedChanges(repositoryRoot, { env: indexEnv }), { forceFull });
  const commands = checkPlan(mode);
  if (planOnly) {
    console.log(JSON.stringify({ mode, commands }));
    return 0;
  }
  console.log(mode === 'documentation'
    ? 'Documentation-only commit: environment, delivery-policy and hook checks.'
    : 'Full regression: code/configuration/media, empty index, CI or --full.');
  return runChecks(commands);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
