import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrateLabState, verifyLabMigrationBackup } from '../tools/migrate-lab-state.mjs';
import { acquireLocalSession } from '../open-claw/lab/deploy/local-session.mjs';
async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'croupier-lab-migration-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const repoRoot = join(base, 'checkout'), data = join(repoRoot, 'lissabon/data'), target = join(repoRoot, 'lab/data');
  await mkdir(join(data, 'players'), { recursive: true }); await mkdir(join(data, 'history')); await mkdir(target, { recursive: true });
  await writeFile(join(data, 'project.json'), '{"revision":"preserve"}\n');
  await writeFile(join(data, 'players/croupier.db'), 'synthetic player bytes');
  await writeFile(join(data, 'players/craig.db'), 'synthetic auth bytes');
  await writeFile(join(data, 'history/old.json'), '{"revision":"old"}');
  await writeFile(join(data, 'qa-recovery.json'), 'private recovery');
  await writeFile(join(repoRoot, 'lissabon/README.md'), 'retired guide');
  await writeFile(join(target, 'unrelated.json'), 'keep Lab data');
  return { repoRoot, data, target, destination: join(base, 'backup') };
}
test('verified full backup preserves history and players, merges Lab data, deletes entire source and is idempotent', async t => {
  const f = await fixture(t), before = await readFile(join(f.data, 'players/croupier.db'));
  assert.equal((await migrateLabState(f)).status, 'ready');
  await assert.rejects(readFile(join(f.destination, 'manifest.json')), { code: 'ENOENT' });
  const result = await migrateLabState({ ...f, apply: true });
  assert.equal(result.files, 5); assert.equal(result.backupFiles, 6);
  assert.deepEqual(await readFile(join(f.target, 'players/croupier.db')), before);
  assert.equal(await readFile(join(f.target, 'history/old.json'), 'utf8'), '{"revision":"old"}');
  assert.equal(await readFile(join(f.target, 'unrelated.json'), 'utf8'), 'keep Lab data');
  await assert.rejects(readdir(join(f.repoRoot, 'lissabon')), { code: 'ENOENT' });
  assert.equal((await verifyLabMigrationBackup(f.destination)).files.length, 6);
  assert.equal((await migrateLabState({ ...f, apply: true })).status, 'already_migrated');
  await writeFile(join(f.destination, 'lissabon/data/project.json'), 'tampered');
  await assert.rejects(verifyLabMigrationBackup(f.destination), { code: 'hash_mismatch' });
});
test('a conflicting destination aborts without overwriting or deleting source', async t => {
  const f = await fixture(t); await writeFile(join(f.target, 'project.json'), 'existing edits');
  await assert.rejects(migrateLabState({ ...f, apply: true }), { code: 'target_conflict' });
  assert.equal(await readFile(join(f.target, 'project.json'), 'utf8'), 'existing edits');
  assert.equal(await readFile(join(f.data, 'project.json'), 'utf8'), '{"revision":"preserve"}\n');
  await assert.rejects(readdir(f.destination), { code: 'ENOENT' });
});
test('equal existing files are preserved and missing ones copied', async t => {
  const f = await fixture(t); await writeFile(join(f.target, 'project.json'), await readFile(join(f.data, 'project.json')));
  assert.equal((await migrateLabState({ ...f, apply: true })).status, 'migrated');
});
test('active session, DB sidecar and backup inside Git prevent migration', async t => {
  const f = await fixture(t), session = await acquireLocalSession({ repoRoot: f.repoRoot, labPort: 4211 });
  try { await assert.rejects(migrateLabState({ ...f, apply: true }), { code: 'CROUPIER_SESSION_ACTIVE' }); }
  finally { await session.release(); }
  await writeFile(join(f.data, 'players/croupier.db-wal'), 'busy');
  await assert.rejects(migrateLabState({ ...f, apply: true }), { code: 'database_sidecar_present' });
  await assert.rejects(migrateLabState({ ...f, destination: join(f.repoRoot, 'backup'), apply: true }), { code: 'backup_must_be_outside_checkout' });
  assert.equal(await readFile(join(f.data, 'players/croupier.db'), 'utf8'), 'synthetic player bytes');
});
