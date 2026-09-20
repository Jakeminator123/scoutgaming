import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chef, registryLocation } from '../tools/croupier-chef.mjs';

const exec = promisify(execFile);
const owner = { owner: 'Jakob', title: 'Samordning', target: 'work', session: 'chef-a' };
const second = { ...owner, title: 'Andra chatten', session: 'chef-b' };
const runGit = (cwd, ...args) => exec('git', args, { cwd, windowsHide: true });

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'chef test '));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'repo'), worktree = path.join(directory, 'second worktree');
  await mkdir(root);
  await runGit(root, 'init', '--initial-branch=work');
  await runGit(root, 'config', 'user.name', 'Chef Test');
  await runGit(root, 'config', 'user.email', 'test@example.invalid');
  await writeFile(path.join(root, '.gitignore'), '.croupier-inbox/\n');
  await runGit(root, 'add', '.gitignore');
  await runGit(root, '-c', 'core.hooksPath=empty-test-hooks', 'commit', '-m', 'Fixture');
  await runGit(root, 'update-ref', 'refs/remotes/origin/work', 'HEAD');
  await runGit(root, 'worktree', 'add', '--detach', worktree, 'HEAD');
  return { root, worktree, directory, at: cwd => ({ cwd, env: {} }) };
}

test('read-only status writes nothing and main/linked worktree share one registry', async t => {
  const f = await fixture(t);
  const a = await registryLocation(f.root), b = await registryLocation(f.worktree);
  assert.deepEqual(a, b);
  assert.equal((await chef('status', {}, f.at(f.worktree))).status, 'inactive');
  await assert.rejects(access(path.dirname(a.file)));
});

test('activation is idempotent for same chat; a second chat cannot silently take over', async t => {
  const f = await fixture(t);
  const first = await chef('activate', owner, f.at(f.root));
  const repeated = await chef('activate', owner, f.at(f.worktree));
  assert.deepEqual(first, repeated);
  const refused = await chef('activate', second, f.at(f.worktree));
  assert.equal(refused.status, 'occupied'); assert.equal(refused.agent.id, first.agent.id);
  assert.equal((await chef('status', { session: owner.session }, f.at(f.worktree))).isSelf, true);
  assert.equal((await chef('status', { session: second.session }, f.at(f.root))).isSelf, false);
});

test('only own chat can release; another may activate after release', async t => {
  const f = await fixture(t);
  await chef('activate', owner, f.at(f.root));
  await assert.rejects(chef('release', second, f.at(f.worktree)), /Only the owning chat/);
  assert.equal((await chef('release', owner, f.at(f.worktree))).status, 'inactive');
  assert.equal((await chef('activate', second, f.at(f.root))).isSelf, true);
});

test('explicit takeover requires matching old ID; old chief then loses ownership', async t => {
  const f = await fixture(t), a = await chef('activate', owner, f.at(f.root));
  assert.equal((await chef('activate', { ...second, replace: 'jakob/0000000000000000' }, f.at(f.root))).status, 'occupied');
  const b = await chef('activate', { ...second, replace: a.agent.id }, f.at(f.worktree));
  assert.notEqual(a.agent.id, b.agent.id);
  assert.equal((await chef('status', owner, f.at(f.root))).isSelf, false);
  await assert.rejects(chef('release', owner, f.at(f.root)), /Only the owning chat/);
});

test('concurrent activation cannot produce two successful chiefs', async t => {
  const f = await fixture(t);
  const results = await Promise.allSettled([
    chef('activate', owner, f.at(f.root)), chef('activate', second, f.at(f.worktree)),
  ]);
  const successes = results.filter(r => r.status === 'fulfilled' && r.value.status === 'active');
  assert.equal(successes.length, 1);
  assert.equal((await chef('status', {}, f.at(f.root))).agent.id, successes[0].value.agent.id);
});

test('target/identity changes require release and unknown remote targets are rejected', async t => {
  const f = await fixture(t);
  await assert.rejects(chef('activate', { ...owner, target: 'missing' }, f.at(f.root)));
  assert.equal((await chef('status', {}, f.at(f.root))).status, 'inactive');
  await chef('activate', owner, f.at(f.root));
  await assert.rejects(chef('activate', { ...owner, owner: 'Kevin' }, f.at(f.root)), /Release/);
  await runGit(f.root, 'update-ref', 'refs/remotes/origin/other', 'HEAD');
  await assert.rejects(chef('activate', { ...owner, target: 'other' }, f.at(f.root)), /Release/);
});

test('missing session and damaged registry fail closed; registry stays outside Git', async t => {
  const f = await fixture(t), location = await registryLocation(f.root);
  await assert.rejects(chef('activate', { ...owner, session: undefined }, f.at(f.root)), /unique stable/);
  await chef('activate', owner, f.at(f.root));
  assert.equal((await runGit(f.root, 'status', '--porcelain')).stdout.trim(), '');
  const saved = await readFile(location.file, 'utf8');
  await writeFile(location.file, '{}');
  await assert.rejects(chef('status', {}, f.at(f.root)), /Invalid or relocated/);
  await writeFile(location.file, saved);
});

test('separate clone has a separate local chief even when branches are named alike', async t => {
  const f = await fixture(t), clone = path.join(f.directory, 'clone');
  await chef('activate', owner, f.at(f.root));
  await runGit(f.directory, 'clone', f.root, clone);
  assert.equal((await chef('status', {}, f.at(clone))).status, 'inactive');
});
