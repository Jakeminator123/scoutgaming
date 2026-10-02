import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const documentationFiles = new Set([
  'README.md', 'AGENTS.md', 'CLAUDE.md',
  'lab/README.md', 'lab/docs/README.md',
  'open-claw/README.md', 'open-claw/lab/README.md', 'open-claw/lab/docs/README.md',
  '.ignore', '.cursorignore', '.cursorindexingignore',
]);

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

export function readStagedChanges(root) {
  const result = spawnSync('git', [
    '-c', 'diff.relative=false', 'diff', '--cached', '--name-status', '-z',
    '--no-renames', '--no-ext-diff', '--no-textconv', '--',
  ], { cwd: root, encoding: 'utf8' });
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
    [process.execPath, '--test', 'test/check-environment-variables.mjs', 'test/github-workflow.mjs', 'test/precommit-checks.mjs'],
    ['git', 'diff', '--cached', '--check'],
  ];
}

export function runChecks(commands, { cwd = repositoryRoot, run = spawnSync } = {}) {
  for (const [command, ...args] of commands) {
    const result = run(command, args, { cwd, stdio: 'inherit' });
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
  const mode = verificationMode(readStagedChanges(repositoryRoot), { forceFull });
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
