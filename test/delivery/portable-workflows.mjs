import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../../tools/portable-workflows.mjs';

const cli = fileURLToPath(new URL('../../tools/portable-workflows.mjs', import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'portable-workflows-'));
  t.after(() => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.match(basename(root), /^portable-workflows-/);
    rmSync(root, { recursive: true, force: true });
  });
  const repo = join(root, 'repo med mellanslag ö & $()');
  mkdirSync(repo);
  const git = (...args) => execFileSync('git', ['-c', `core.hooksPath=${join(root, 'empty-hooks')}`, '-C', repo, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Workflow test');
  git('config', 'user.email', 'workflow@example.invalid');
  writeFileSync(join(repo, '.gitignore'), '/.worktrees/\n');
  writeFileSync(join(repo, 'code.txt'), 'initial\n');
  git('add', '.gitignore', 'code.txt');
  git('commit', '-m', 'fixture');
  const worktree = join(repo, '.worktrees', 'arbete ö & $()');
  git('worktree', 'add', '-b', 'task/portable', worktree);
  const file = join(repo, '.worktrees', '.handoffs', 'demo.json');
  const record = (...extra) => run(['record', '--repo', repo, '--task', 'demo', '--worktree', worktree, '--owner', 'Jakob / Codex', '--status', 'paused', '--goal', 'Finish the change', '--scope', 'code.txt', '--verified', 'Fixture commit only', '--next', 'Inspect pending diff', ...extra]);
  const resume = () => run(['resume', '--repo', repo, '--task', 'demo']);
  const mutate = fields => writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), ...fields }));
  return { root, repo, worktree, file, git, record, resume, mutate };
}

test('resume reports clean and dirty Git state without changing files, index, HEAD or handoff', t => {
  const f = fixture(t);
  f.record();
  const clean = f.resume();
  assert.equal(clean.current.dirty, false);
  assert.deepEqual(clean.warnings, []);
  writeFileSync(join(f.worktree, 'code.txt'), 'pending change\n');
  writeFileSync(join(f.worktree, 'untracked ö & $.txt'), 'local work\n');
  execFileSync('git', ['-C', f.worktree, 'add', 'code.txt']);
  writeFileSync(join(f.worktree, 'code.txt'), 'pending change plus unstaged work\n');
  const index = execFileSync('git', ['-C', f.worktree, 'rev-parse', '--path-format=absolute', '--git-path', 'index'], { encoding: 'utf8' }).trim();
  const before = { handoff: readFileSync(f.file), index: readFileSync(index) };
  const dirty = f.resume();
  assert.equal(dirty.current.head, clean.current.head);
  assert.equal(dirty.current.branch, 'task/portable');
  assert.equal(dirty.current.dirty, true);
  assert.deepEqual(dirty.current.changes, [{ code: 'MM', path: 'code.txt' }, { code: '??', path: 'untracked ö & $.txt' }]);
  assert.deepEqual(readFileSync(f.file), before.handoff);
  assert.deepEqual(readFileSync(index), before.index);
  assert.equal(readFileSync(join(f.worktree, 'code.txt'), 'utf8'), 'pending change plus unstaged work\n');
  assert.equal(readFileSync(join(f.worktree, 'untracked ö & $.txt'), 'utf8'), 'local work\n');
});

test('resume warns about changed head, branch and active owner; does not take ownership', t => {
  const f = fixture(t);
  f.record();
  f.mutate({ status: 'active', owner: 'Other active editor' });
  execFileSync('git', ['-C', f.worktree, '-c', `core.hooksPath=${join(f.root, 'empty-hooks')}`, 'commit', '--allow-empty', '-m', 'later']);
  execFileSync('git', ['-C', f.worktree, 'branch', '-m', 'task/renamed']);
  const result = f.resume();
  assert.equal(result.warnings.length, 3);
  assert.match(result.warnings.join('\n'), /Aktiv ägare.*Other active editor/);
  assert.notEqual(result.current.head, result.handoff.head);
  assert.equal(result.current.branch, 'task/renamed');
  assert.equal(JSON.parse(readFileSync(f.file, 'utf8')).owner, 'Other active editor');
  const child = spawnSync(process.execPath, [cli, 'resume', '--repo', f.repo, '--task', 'demo'], { cwd: f.root, encoding: 'utf8' });
  assert.equal(child.status, 2, child.stderr);
  assert.equal(JSON.parse(child.stdout).current.head, result.current.head);
  const updated = f.record();
  assert.match(updated.warnings.join(), /uttrycklig record/);
  assert.equal(updated.handoff.owner, 'Jakob / Codex');
  assert.equal(updated.handoff.previousOwner, 'Other active editor');
  assert.equal(updated.current.head, result.current.head);
  assert.deepEqual(updated.current.changes, []);
  assert.equal(f.record().handoff.previousOwner, 'Other active editor');
});

test('repo identity, unknown records and malformed metadata fail before following paths', t => {
  const f = fixture(t), other = fixture(t);
  f.record();
  other.record();
  writeFileSync(other.file, readFileSync(f.file));
  assert.throws(other.resume, /annat repo/);
  assert.throws(() => run(['resume', '--repo', f.repo, '--task', 'missing']), /Ingen överlämning/);
  f.mutate({ version: 99 });
  assert.throws(f.resume, /Okänt eller ogiltigt/);
  f.mutate({ version: 1, worktree: other.repo });
  const result = f.resume();
  assert.equal(result.current, null);
  assert.match(result.warnings.join(), /inte registrerad/);
  const before = readFileSync(f.file);
  assert.throws(() => run(['record', '--repo', f.repo, '--task', 'demo', '--worktree', other.repo,
    '--owner', 'Caller', '--status', 'paused', '--goal', 'Change', '--scope', 'code.txt', '--verified', 'None', '--next', 'Inspect']), /inte registrerad/);
  assert.deepEqual(readFileSync(f.file), before);
  assert.throws(() => run(['list', '--repo', f.worktree]), /huvudsaklig checkout/);
  assert.throws(() => run(['list', '--repo', '.']), /absolut sökväg/);
});

test('list reads task names only and CLI works from another directory with literal paths', t => {
  const f = fixture(t);
  f.record();
  writeFileSync(join(dirname(f.file), 'unrelated.json'), 'private invalid content');
  const result = run(['list', '--repo', f.repo]);
  assert.deepEqual(result.tasks, ['demo', 'unrelated']);
  assert.equal(result.worktrees.length, 2);
  assert.equal(f.resume().handoff.task, 'demo');
  const child = spawnSync(process.execPath, [cli, 'resume', '--repo', f.repo, '--task', 'demo'], { cwd: f.root, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(JSON.parse(child.stdout).current.worktree, f.worktree);
});

test('record refuses unignored metadata, unsafe names, scope traversal and linked metadata', t => {
  const f = fixture(t);
  writeFileSync(join(f.repo, '.gitignore'), '');
  assert.throws(f.record, /Ignorera/);
  assert.equal(existsSync(dirname(f.file)), false);
  writeFileSync(join(f.repo, '.gitignore'), '/.worktrees/\n');
  for (const task of ['../escape', 'a/b', 'CON', 'con', 'demo.json', 'x:y']) {
    assert.throws(() => run(['resume', '--repo', f.repo, '--task', task]), /Uppdragsnamnet/);
  }
  assert.throws(() => f.record('--scope', '../outside'), /ogiltigt/);
  const outside = join(f.root, 'metadata elsewhere');
  mkdirSync(outside);
  symlinkSync(outside, dirname(f.file), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(f.record, /länk eller junction/);
  assert.equal(existsSync(join(outside, 'demo.json')), false);
});

test('handoff survives IDE changes and a missing checkout is reported, not recreated', t => {
  const f = fixture(t);
  f.record();
  f.git('worktree', 'remove', f.worktree);
  const result = f.resume();
  assert.equal(result.current, null);
  assert.match(result.warnings.join(), /inte registrerad/);
  assert.equal(existsSync(f.file), true);
  assert.equal(existsSync(f.worktree), false);
});
