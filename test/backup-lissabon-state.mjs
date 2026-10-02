import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backupLissabonState, verifyLissabonBackup } from '../tools/backup-lissabon-state.mjs';
import { acquireLocalSession } from '../open-claw/lab/deploy/local-session.mjs';

async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'croupier-lissabon-backup-test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const repoRoot = join(base, 'checkout');
  const data = join(repoRoot, 'lab', 'data');
  const players = join(data, 'players');
  const history = join(data, 'history');
  const destination = join(base, 'private', 'snapshot');
  await mkdir(players, { recursive: true });
  await mkdir(history);
  await mkdir(join(base, 'private'));
  await writeFile(join(players, 'croupier.db'), 'synthetic player state\n');
  await writeFile(join(players, 'craig.db'), 'synthetic auth state\n');
  await writeFile(join(players, 'bo.json'), '{"tiers":{"classic":"astrid"}}\n');
  await writeFile(join(data, 'project.json'), '{"revision":"synthetic"}\n');
  await writeFile(join(data, 'qa-recovery.json'), '{"fixture":"not production state"}\n');
  await writeFile(join(data, 'private-token.env'), 'SYNTHETIC_SECRET=do-not-copy\n');
  const historyName = `${Date.now()}-${randomUUID()}.json`;
  await writeFile(join(history, historyName), '{"revision":"older"}\n');
  return { base, repoRoot, data, players, history, historyName, destination };
}

test('offline backup copies fixed persistent state, verifies hashes, and leaves source untouched', async t => {
  const f = await fixture(t);
  const before = await readFile(join(f.players, 'croupier.db'));
  const result = await backupLissabonState({ repoRoot: f.repoRoot, destination: f.destination });
  assert.equal(result.files, 5);
  const manifest = await verifyLissabonBackup(f.destination);
  assert.deepEqual(manifest.files.map(item => item.path), [
    `history/${f.historyName}`, 'players/bo.json', 'players/craig.db', 'players/croupier.db', 'project.json',
  ].sort());
  assert.deepEqual(await readFile(join(f.players, 'croupier.db')), before);
  assert.deepEqual(await readFile(join(f.destination, 'players', 'croupier.db')), before);
  assert.deepEqual(await readFile(join(f.destination, 'project.json')), await readFile(join(f.data, 'project.json')));
  await assert.rejects(readFile(join(f.destination, 'qa-recovery.json')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(f.destination, 'private-token.env')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(f.destination, '.local-session.sqlite')), { code: 'ENOENT' });
  await writeFile(join(f.destination, 'project.json'), 'tampered');
  await assert.rejects(verifyLissabonBackup(f.destination), { code: 'backup_hash_mismatch' });
});

test('backup includes uploaded video bytes, index and classification metadata', async t => {
  const f = await fixture(t);
  const videos = join(f.data, 'videos');
  await mkdir(videos);
  const id = randomUUID(), media = Buffer.from('synthetic uploaded video bytes');
  const videoName = `${id}.mp4`;
  await writeFile(join(videos, videoName), media);
  await writeFile(join(videos, 'index.json'), JSON.stringify({ schemaVersion: 1, videos: [{ id, size: media.length }] }));
  await writeFile(join(videos, 'classifications.json'), JSON.stringify({ schemaVersion: 1, entries: [] }));

  const result = await backupLissabonState({ repoRoot: f.repoRoot, destination: f.destination });
  assert.equal(result.files, 8);
  const manifest = await verifyLissabonBackup(f.destination);
  assert.deepEqual(manifest.files.filter(item => item.path.startsWith('videos/')).map(item => item.path), [
    'videos/classifications.json', 'videos/index.json', `videos/${videoName}`,
  ].sort());
  assert.deepEqual(await readFile(join(f.destination, 'videos', videoName)), media);
  await writeFile(join(f.destination, 'videos', videoName), 'tampered');
  await assert.rejects(verifyLissabonBackup(f.destination), { code: 'backup_hash_mismatch' });
});

test('unexpected upload entries stop backup before publication', async t => {
  const f = await fixture(t);
  const videos = join(f.data, 'videos');
  await mkdir(videos);
  await writeFile(join(videos, 'unknown-upload.txt'), 'private fixture');
  await assert.rejects(backupLissabonState({ repoRoot: f.repoRoot, destination: f.destination }), { code: 'unexpected_video_entry' });
  await assert.rejects(readFile(join(f.destination, 'manifest.json')), { code: 'ENOENT' });
});

test('uploaded video symlinks are refused without copying their target', async t => {
  const f = await fixture(t);
  const videos = join(f.data, 'videos');
  await mkdir(videos);
  const target = join(f.base, 'private', 'secret.txt');
  await writeFile(target, 'private fixture');
  try { await symlink(target, join(videos, `${randomUUID()}.mp4`), 'file'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('symlink creation unavailable'); return; } throw error; }
  await assert.rejects(backupLissabonState({ repoRoot: f.repoRoot, destination: f.destination }), { code: 'unexpected_video_entry' });
  await assert.rejects(readFile(join(f.destination, 'manifest.json')), { code: 'ENOENT' });
});

test('a live coordinated session prevents the backup and leaves its destination absent', async t => {
  const f = await fixture(t);
  const live = await acquireLocalSession({ repoRoot: f.repoRoot, labPort: 4211 });
  try {
    await assert.rejects(backupLissabonState({ repoRoot: f.repoRoot, destination: f.destination }), { code: 'CROUPIER_SESSION_ACTIVE' });
    await assert.rejects(readFile(join(f.destination, 'manifest.json')), { code: 'ENOENT' });
  } finally { await live.release(); }
});

test('database sidecars stop backup before publication', async t => {
  const f = await fixture(t);
  await writeFile(join(f.players, 'croupier.db-wal'), 'write in progress');
  await assert.rejects(backupLissabonState({ repoRoot: f.repoRoot, destination: f.destination }), { code: 'database_sidecar_present' });
  await assert.rejects(readFile(join(f.destination, 'manifest.json')), { code: 'ENOENT' });
});

test('existing destination and destinations inside checkout are refused', async t => {
  const f = await fixture(t);
  await mkdir(f.destination);
  await assert.rejects(backupLissabonState({ repoRoot: f.repoRoot, destination: f.destination }), { code: 'destination_already_exists' });
  await assert.rejects(backupLissabonState({ repoRoot: f.repoRoot, destination: join(f.repoRoot, 'private') }), { code: 'destination_must_be_outside_checkout' });
});

test('source history links are refused without copying their target', async t => {
  const f = await fixture(t);
  const name = `${Date.now()}-${randomUUID()}.json`;
  try { await symlink(join(f.base, 'private', 'secret.txt'), join(f.history, name), 'file'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('symlink creation unavailable'); return; } throw error; }
  await assert.rejects(backupLissabonState({ repoRoot: f.repoRoot, destination: f.destination }), { code: 'unexpected_history_entry' });
  await assert.rejects(readFile(join(f.destination, 'manifest.json')), { code: 'ENOENT' });
});
