import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { previewRetention, archiveRetention, restoreRetention, autoArchiveLocalArtifacts } from '../tools/retention-archive.mjs';

async function fixture(t, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-retention-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'tools'));
  await mkdir(join(root, 'lab/data/history'), { recursive: true });
  await mkdir(join(root, 'lab/data/observations'), { recursive: true });
  const policy = { maxEntries: 2, maxBytes: 10000, keepNewest: 2, ...overrides };
  await writeFile(join(root, 'tools/retention-policy.json'), JSON.stringify({ projectHistory: policy, observations: policy }));
  const snapshot = async (i, content = 'previous project') => {
    const path = `lab/data/history/${1791900000000 + i}-${randomUUID()}.json`;
    await writeFile(join(root, path), content); return path;
  };
  const observation = async (i, complete = true) => {
    const path = `lab/data/observations/2026-10-13T10-00-0${i}-000Z`;
    await mkdir(join(root, path));
    await writeFile(join(root, path, 'partner-events.jsonl'), 'sanitized events\n');
    if (complete) await writeFile(join(root, path, 'session.json'), JSON.stringify({ startedAt: '2026-10-13T10:00:00Z', endedAt: '2026-10-13T10:01:00Z' }));
    return path;
  };
  return { root, snapshot, observation };
}

test('preview selects oldest snapshots without mutation; archive and restore preserve bytes', async t => {
  const f = await fixture(t), first = await f.snapshot(0), second = await f.snapshot(1);
  await f.snapshot(2); await f.snapshot(3);
  const preview = await previewRetention(f);
  assert.deepEqual(preview.groups[0].selected.map(row => row.source), [first, second]);
  assert.equal((await readdir(join(f.root, 'lab/data/history'))).length, 4);
  await assert.rejects(readdir(join(f.root, 'arkiv')), { code: 'ENOENT' });
  const result = await archiveRetention(f);
  assert.equal(result.archivedEntries, 2);
  assert.equal((await readdir(join(f.root, 'lab/data/history'))).length, 2);
  const before = await readFile(join(f.root, result.batch, first));
  assert.equal((await restoreRetention({ ...f, batch: result.batch })).entries[0].status, 'ready');
  await assert.rejects(readFile(join(f.root, first)), { code: 'ENOENT' });
  await restoreRetention({ ...f, batch: result.batch, apply: true });
  assert.deepEqual(await readFile(join(f.root, first)), before);
  assert.deepEqual(await readFile(join(f.root, result.batch, first)), before);
  await assert.rejects(restoreRetention({ ...f, batch: result.batch, apply: true }), { code: 'retention_restore_target_exists' });
});

test('completed log sessions rotate as a whole; active captures and unrelated files stay untouched', async t => {
  const f = await fixture(t), oldest = await f.observation(0);
  await f.observation(1); await f.observation(2); const active = await f.observation(3, false);
  await writeFile(join(f.root, 'lab/data/history/do-not-touch.json'), 'unrelated');
  const result = await archiveRetention(f);
  assert.equal(result.archivedEntries, 1);
  assert.equal(await readFile(join(f.root, result.batch, oldest, 'partner-events.jsonl'), 'utf8'), 'sanitized events\n');
  assert.equal((await readdir(join(f.root, active))).length, 1);
  assert.equal(await readFile(join(f.root, 'lab/data/history/do-not-touch.json'), 'utf8'), 'unrelated');
});

test('byte threshold still retains two newest entries and reports remaining excess', async t => {
  const f = await fixture(t, { maxEntries: 100, maxBytes: 5 });
  for (let i = 0; i < 4; i++) await f.snapshot(i, 'large snapshot');
  const { groups } = await previewRetention(f);
  assert.equal(groups[0].selected.length, 2);
  assert.equal(groups[0].retainedEntries, 2);
  assert.equal(groups[0].thresholdStillExceeded, true);
});

test('archive lock prevents concurrent movers and is never stolen', async t => {
  const f = await fixture(t);
  await mkdir(join(f.root, 'arkiv/.retention.lock'), { recursive: true });
  await assert.rejects(archiveRetention(f), { code: 'retention_busy' });
  assert.deepEqual(await readdir(join(f.root, 'arkiv')), ['.retention.lock']);
});

test('changed archived bytes cannot be restored and manifest cannot escape allowlisted paths', async t => {
  const f = await fixture(t), first = await f.snapshot(0);
  await f.snapshot(1); await f.snapshot(2);
  const { batch } = await archiveRetention(f);
  const manifestPath = join(f.root, batch, 'manifest.json'), manifest = JSON.parse(await readFile(manifestPath));
  await writeFile(join(f.root, batch, first), 'changed');
  await assert.rejects(restoreRetention({ ...f, batch, apply: true }), { code: 'retention_archive_changed' });
  manifest.entries[0].category = 'constructor';
  manifest.entries[0].source = String(Object) + '/2026-10-13T10-00-00-000Z';
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(restoreRetention({ ...f, batch, apply: true }), { code: 'retention_manifest_invalid' });
  manifest.entries[0].category = 'projectHistory';
  manifest.entries[0].source = '../../outside.txt';
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(restoreRetention({ ...f, batch, apply: true }), { code: 'retention_manifest_invalid' });
  await assert.rejects(restoreRetention({ ...f, batch: '../outside', apply: true }), { code: 'retention_batch_invalid' });
});

test('directory links cannot redirect a source or the archive', async t => {
  const f = await fixture(t), outside = await mkdtemp(join(tmpdir(), 'croupier-retention-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(outside, join(f.root, 'arkiv'), 'junction');
  await assert.rejects(archiveRetention(f), { code: 'retention_link_refused' });
  assert.deepEqual(await readdir(outside), []);
});

test('failed or noncanonical automatic retention does not fail a project save', async t => {
  const f = await fixture(t), warnings = [];
  assert.deepEqual(await autoArchiveLocalArtifacts('projectHistory', { ...f, dataDir: join(f.root, 'elsewhere') }), { skipped: true });
  await writeFile(join(f.root, 'tools/retention-policy.json'), '{}');
  assert.deepEqual(await autoArchiveLocalArtifacts('projectHistory', { ...f, dataDir: join(f.root, 'lab/data'), warn: text => warnings.push(text) }), { deferred: true });
  assert.equal(warnings.length, 1);
});

test('automatic retention uses same policy and preserves current project', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 3; i++) await f.snapshot(i);
  await writeFile(join(f.root, 'lab/data/project.json'), 'active configuration');
  const result = await autoArchiveLocalArtifacts('projectHistory', { ...f, dataDir: join(f.root, 'lab/data') });
  assert.equal(result.archivedEntries, 1);
  assert.equal(await readFile(join(f.root, 'lab/data/project.json'), 'utf8'), 'active configuration');
});

test('planned crash manifest restores only entries that actually moved', async t => {
  const f = await fixture(t), first = await f.snapshot(0);
  await f.snapshot(1); await f.snapshot(2);
  const { batch } = await archiveRetention(f);
  const manifestPath = join(f.root, batch, 'manifest.json'), manifest = JSON.parse(await readFile(manifestPath));
  manifest.state = 'planned';
  const unmoved = await f.snapshot(3);
  manifest.entries.push({ ...manifest.entries[0], source: unmoved });
  await writeFile(manifestPath, JSON.stringify(manifest));
  const restored = await restoreRetention({ ...f, batch, apply: true });
  assert.deepEqual(restored.entries.map(entry => entry.status), ['restored', 'not-moved']);
  assert.equal(await readFile(join(f.root, first), 'utf8'), 'previous project');
});
