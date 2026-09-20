import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createProjectStore } from '../lib/project-store.mjs';
import { createSeedProject } from '../lib/studio-model.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-studio-project-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, store: createProjectStore(directory) };
}

test('missing project returns independent seed without writing to disk', async t => {
  const { directory, store } = await fixture(t);
  const first = await store.load();
  first.events[0].label = 'Only this clone';
  const second = await store.load();
  assert.notEqual(first.events[0].label, second.events[0].label);
  assert.deepEqual(second, createSeedProject());
  assert.deepEqual(await readdir(directory), []);
});

test('save persists new revision atomically and preserves prior revision in history', async t => {
  const { directory, store } = await fixture(t);
  const initial = await store.load();
  const draft = structuredClone(initial);
  draft.events[0].label = 'Mitt eventnamn';
  const saved = await store.save(draft, initial.revision);
  assert.notEqual(saved.revision, initial.revision);
  assert.equal(draft.revision, initial.revision, 'Caller draft is not mutated.');
  assert.equal(saved.events[0].label, 'Mitt eventnamn');
  assert.deepEqual(await store.load(), saved);
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'project.json'), 'utf8')), saved);
  const history = await readdir(join(directory, 'history'));
  assert.equal(history.length, 1);
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'history', history[0]), 'utf8')), initial);
  assert.ok(!(await readdir(directory)).some(name => name.endsWith('.tmp')));
});

test('stale expected revision is rejected and never overwrites a newer edit', async t => {
  const { directory, store } = await fixture(t);
  const first = await store.load();
  const newer = await store.save({ ...first, events: first.events.map((event, index) => index === 0 ? { ...event, label: 'Nyare namn' } : event) }, first.revision);
  await assert.rejects(store.save(first, first.revision), error => error.statusCode === 409);
  assert.deepEqual(await store.load(), newer);
  assert.equal((await readdir(join(directory, 'history'))).length, 1);
  const next = await store.save(newer, newer.revision);
  assert.notEqual(next.revision, newer.revision, 'Conflict must release its lock.');
});

test('invalid draft is rejected without creating project or history files', async t => {
  const { directory, store } = await fixture(t);
  const invalid = createSeedProject(); invalid.lines[0].variants = [];
  await assert.rejects(store.save(invalid, invalid.revision), error => error.statusCode === 400);
  assert.deepEqual(await readdir(directory), []);
});

test('malformed or invalid existing file is preserved, never silently replaced by seed', async t => {
  const { directory, store } = await fixture(t);
  for (const contents of ['{ broken JSON', JSON.stringify({ schemaVersion: 99 })]) {
    await writeFile(join(directory, 'project.json'), contents);
    await assert.rejects(store.load(), error => error.statusCode === 422);
    const draft = createSeedProject();
    await assert.rejects(store.save(draft, draft.revision), error => error.statusCode === 422);
    assert.equal(await readFile(join(directory, 'project.json'), 'utf8'), contents);
  }
});

test('concurrent writers cannot both commit the same expected revision', async t => {
  const { directory, store } = await fixture(t);
  const secondStore = createProjectStore(directory);
  const base = await store.load();
  const a = structuredClone(base), b = structuredClone(base);
  a.events[0].label = 'Writer A'; b.events[0].label = 'Writer B';
  const results = await Promise.allSettled([store.save(a, base.revision), secondStore.save(b, base.revision)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const failed = results.find(result => result.status === 'rejected');
  assert.ok([409, 423].includes(failed.reason.statusCode));
  const succeeded = results.find(result => result.status === 'fulfilled').value;
  assert.deepEqual(await store.load(), succeeded);
  assert.equal((await readdir(join(directory, 'history'))).length, 1);
  // The losing request must not release the winner's lock or leave a lock behind.
  const latest = await store.save(succeeded, succeeded.revision);
  assert.notEqual(latest.revision, succeeded.revision);
});

test('a fresh writer lock is respected; an abandoned stale lock is recovered after restart', async t => {
  const { directory, store } = await fixture(t);
  const base = await store.load();
  const lock = join(directory, '.project.lock');
  await mkdir(lock);
  await assert.rejects(store.save(base, base.revision), error => error.statusCode === 423);
  assert.ok((await readdir(directory)).includes('.project.lock'), 'An active writer lock is not removed.');
  const abandonedAt = new Date(Date.now() - 60_000);
  await utimes(lock, abandonedAt, abandonedAt);
  const restarted = createProjectStore(directory);
  const saved = await restarted.save(base, base.revision);
  assert.notEqual(saved.revision, base.revision);
  assert.deepEqual(await restarted.load(), saved);
  assert.ok(!(await readdir(directory)).includes('.project.lock'));
});
