import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { backupRenderState, restoreRenderState, verifyRenderBackup } from '../tools/backup-render-state.mjs';

async function fixture(t, profile = 'product') {
  const base = await mkdtemp(join(tmpdir(), 'croupier-render-backup-test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const source = join(base, 'source'), snapshot = join(base, 'snapshot'), target = join(base, 'target');
  await mkdir(source); await mkdir(target);
  if (profile === 'product') {
    await mkdir(join(source, 'players'));
    for (const name of ['croupier.db', 'craig.db']) {
      const db = new DatabaseSync(join(source, 'players', name));
      db.exec('CREATE TABLE state (value TEXT NOT NULL)');
      db.prepare('INSERT INTO state VALUES (?)').run(`${name}-fixture`);
      db.close();
    }
    await mkdir(join(source, 'studio', 'history'), { recursive: true });
    await writeFile(join(source, 'studio', 'project.json'), '{"synthetic":true}\n');
    await writeFile(join(source, 'studio', 'history', 'one.json'), '{"revision":1}\n');
    await writeFile(join(source, 'players', 'bo.json'), '{"synthetic":true}\n');
  } else if (profile === 'director') {
    const db = new DatabaseSync(join(source, 'companion.sqlite'));
    db.exec('CREATE TABLE memories (name TEXT)'); db.prepare('INSERT INTO memories VALUES (?)').run('fixture'); db.close();
    await writeFile(join(source, 'catalog.json'), '{"fixture":true}\n');
  } else {
    await writeFile(join(source, 'openclaw.json'), '{"fixture":true}\n');
    await mkdir(join(source, 'agents', 'croupier-chat', 'sessions'), { recursive: true });
    await writeFile(join(source, 'agents', 'croupier-chat', 'sessions', `${randomUUID()}.jsonl`), '{"fixture":true}\n');
    const db = new DatabaseSync(join(source, 'companion-search.sqlite'));
    db.exec('CREATE TABLE receipts (id INTEGER)'); db.prepare('INSERT INTO receipts VALUES (1)').run(); db.close();
  }
  return { base, source, snapshot, target };
}

for (const profile of ['product', 'director', 'gateway']) {
  test(`${profile}: verified backup and restore preserve only synthetic state`, async t => {
    const f = await fixture(t, profile);
    const result = await backupRenderState({ profile, source: f.source, destination: f.snapshot, quiesced: true });
    assert.ok(result.files >= 2);
    const manifest = await verifyRenderBackup(f.snapshot);
    assert.equal(manifest.profile, profile);
    assert.deepEqual((await restoreRenderState({ profile, snapshot: f.snapshot, destination: f.target, quiesced: true })).files, manifest.files.length);
    for (const item of manifest.files) assert.deepEqual(
      await readFile(join(f.target, ...item.path.split('/'))),
      await readFile(join(f.snapshot, ...item.path.split('/'))));
    assert.equal((await readdir(f.target)).some(name => name.startsWith('.croupier-restore-')), false);
  });
}

test('a committed WAL transaction is captured as a complete SQLite database', async t => {
  const f = await fixture(t);
  const path = join(f.source, 'players', 'croupier.db');
  const writer = new DatabaseSync(path);
  try {
    writer.exec('PRAGMA journal_mode=WAL');
    writer.prepare('INSERT INTO state VALUES (?)').run('committed-wal-fixture');
    await backupRenderState({ profile: 'product', source: f.source, destination: f.snapshot, quiesced: true });
    const copy = new DatabaseSync(join(f.snapshot, 'players', 'croupier.db'), { readOnly: true });
    try { assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM state').get().n, 2); }
    finally { copy.close(); }
  } finally { writer.close(); }
});

test('tampering, extra entries and a nonempty restore root are rejected', async t => {
  const f = await fixture(t);
  await backupRenderState({ profile: 'product', source: f.source, destination: f.snapshot, quiesced: true });
  await writeFile(join(f.target, 'existing.txt'), 'must survive');
  await assert.rejects(restoreRenderState({ profile: 'product', snapshot: f.snapshot, destination: f.target, quiesced: true }), { code: 'destination_not_empty' });
  assert.equal(await readFile(join(f.target, 'existing.txt'), 'utf8'), 'must survive');
  await writeFile(join(f.snapshot, 'studio', 'project.json'), 'tampered');
  await assert.rejects(verifyRenderBackup(f.snapshot), { code: 'backup_hash_mismatch' });
  await writeFile(join(f.snapshot, 'extra.txt'), 'unexpected');
  await assert.rejects(verifyRenderBackup(f.snapshot), { code: 'unexpected_backup_entry' });
});

test('wrong profile, missing required SQLite and unacknowledged live state are rejected', async t => {
  const f = await fixture(t);
  await assert.rejects(backupRenderState({ profile: 'product', source: f.source, destination: f.snapshot }), { code: 'quiesced_required' });
  await assert.rejects(backupRenderState({ profile: 'gateway', source: f.source, destination: f.snapshot, quiesced: true }), { code: 'required_state_missing' });
  await assert.rejects(backupRenderState({ profile: 'director', source: f.source, destination: f.snapshot, quiesced: true }), { code: 'required_state_missing' });
  await backupRenderState({ profile: 'product', source: f.source, destination: f.snapshot, quiesced: true });
  await assert.rejects(restoreRenderState({ profile: 'gateway', snapshot: f.snapshot, destination: f.target, quiesced: true }), { code: 'profile_mismatch' });
});

test('symlinks are refused without copying outside data', async t => {
  const f = await fixture(t);
  const outside = join(f.base, 'private.txt');
  await writeFile(outside, 'synthetic secret');
  try { await symlink(outside, join(f.source, 'studio', 'linked.txt'), 'file'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('symlinks unavailable'); return; } throw error; }
  await assert.rejects(backupRenderState({ profile: 'product', source: f.source, destination: f.snapshot, quiesced: true }), { code: 'unsafe_source_entry' });
  await assert.rejects(readdir(f.snapshot), { code: 'ENOENT' });
});

test('corrupt SQLite and reserved source names never publish a snapshot', async t => {
  const f = await fixture(t);
  await writeFile(join(f.source, 'players', 'croupier.db'), 'not sqlite');
  await assert.rejects(backupRenderState({ profile: 'product', source: f.source, destination: f.snapshot, quiesced: true }), { code: 'sqlite_backup_failed' });
  await assert.rejects(readdir(f.snapshot), { code: 'ENOENT' });
  await writeFile(join(f.source, 'manifest.json'), 'reserved');
  await assert.rejects(backupRenderState({ profile: 'product', source: f.source, destination: f.snapshot, quiesced: true }), { code: 'reserved_source_entry' });
});

test('manifest traversal is rejected before restoring any file', async t => {
  const f = await fixture(t);
  await backupRenderState({ profile: 'product', source: f.source, destination: f.snapshot, quiesced: true });
  const path = join(f.snapshot, 'manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  manifest.files[0].path = '../outside.txt';
  await writeFile(path, JSON.stringify(manifest));
  await assert.rejects(restoreRenderState({ profile: 'product', snapshot: f.snapshot, destination: f.target, quiesced: true }), { code: 'invalid_manifest' });
  assert.deepEqual(await readdir(f.target), []);
});
