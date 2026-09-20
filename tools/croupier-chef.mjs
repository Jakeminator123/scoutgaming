#!/usr/bin/env node
// Local, cooperative role registry only. Never fetches, merges, pushes or starts agents.
import { execFile } from 'node:child_process';
import { promisify, parseArgs } from 'node:util';
import { readFile, writeFile, mkdir, rename, unlink, realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identity, acquireLock } from './croupier-inbox.mjs';

const exec = promisify(execFile);
async function git(cwd, args) {
  return (await exec('git', args, { cwd, windowsHide: true, timeout: 10_000 })).stdout.trim();
}

export async function registryLocation(cwd) {
  const commonDir = await realpath(await git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
  const worktrees = await git(cwd, ['worktree', 'list', '--porcelain', '-z']);
  const first = worktrees.split('\0')[0];
  if (!first.startsWith('worktree ') || worktrees.split('\0\0')[0].includes('\0bare')) {
    throw new Error('Chef needs a non-bare repository with its main worktree available.');
  }
  const root = await realpath(first.slice('worktree '.length));
  return { commonDir, root, file: path.join(root, '.croupier-inbox', 'chef.json') };
}

async function readRegistry(location) {
  let state;
  try { state = JSON.parse(await readFile(location.file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (state.schema !== 1 || state.commonDir !== location.commonDir || typeof state.active !== 'boolean'
      || !/^(jakob|kevin|emil)\/[a-f0-9]{16}$/.test(state.agent?.id)) {
    throw new Error('Invalid or relocated chef registry. Inspect it; do not silently replace it.');
  }
  return state;
}

export async function chef(command, args = {}, { cwd = process.cwd(), env = process.env } = {}) {
  if (!['status', 'activate', 'release'].includes(command)) throw new Error('Use status, activate or release.');
  const location = await registryLocation(cwd);
  const session = args.session || env.CODEX_THREAD_ID || env.CROUPIER_AGENT_SESSION;
  const belongsToSession = state => Boolean(session && state?.agent?.key === identity('Jakob', 'session', session).key);
  const report = state => ({ status: state?.active ? 'active' : 'inactive',
    isSelf: Boolean(state?.active && belongsToSession(state)),
    ...(state?.active ? { agent: state.agent, target: state.target, activatedAt: state.activatedAt } : {}),
    scope: 'this local repository and its linked worktrees; not other clones or machines' });
  if (command === 'status') return report(await readRegistry(location));
  if (!session) throw new Error('Use CODEX_THREAD_ID or a unique stable --session.');
  // Resolve/validate the target before obtaining the short metadata lock; no network call.
  let agent;
  if (command === 'activate') {
    agent = identity(args.owner, args.title, session);
    if (!args.target) throw new Error('Choose --target BRANCH explicitly.');
    await git(cwd, ['check-ref-format', `refs/heads/${args.target}`]);
    await git(cwd, ['show-ref', '--verify', `refs/remotes/origin/${args.target}`]);
  }
  await mkdir(path.dirname(location.file), { recursive: true });
  const lock = await acquireLock(`${location.file}.lock`);
  try {
    const previous = await readRegistry(location);
    if (command === 'activate' && previous?.active) {
      if (belongsToSession(previous)) {
        if (previous.agent.owner !== agent.owner || previous.target !== args.target) {
          throw new Error('Release the existing role before changing owner or target.');
        }
        return report(previous);
      }
      if (args.replace !== previous.agent.id) return { ...report(previous), status: 'occupied' };
      // --replace records an explicit user-requested handover, not proof of permission.
    }
    if (command === 'release' && previous?.active && !belongsToSession(previous)) {
      throw new Error('Only the owning chat can release this role. Ask the user before a deliberate handover.');
    }
    if (command === 'release' && !previous?.active) return report(previous);
    const state = command === 'release'
      ? { ...previous, active: false, releasedAt: new Date().toISOString() }
      : { schema: 1, commonDir: location.commonDir, active: true, agent,
        target: args.target, activatedAt: new Date().toISOString() };
    const temp = `${location.file}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(state) + '\n', { mode: 0o600 });
    await rename(temp, location.file);
    return report(state);
  } finally { await lock.close(); await unlink(`${location.file}.lock`); }
}

export async function main(argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options:
    Object.fromEntries(['owner', 'title', 'session', 'target', 'replace'].map(key => [key, { type: 'string' }])) });
  const result = await chef(positionals[0] || 'status', values);
  console.log(JSON.stringify(result));
  if (result.status === 'occupied') process.exitCode = 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Git subprocess errors can include remote URLs; do not echo them or credentials.
    const reason = error.cmd ? 'Git scope/target check failed. Confirm the repository and fetched origin branch.' : error.message;
    console.error(JSON.stringify({ status: 'error', reason })); process.exitCode = 1;
  });
}
