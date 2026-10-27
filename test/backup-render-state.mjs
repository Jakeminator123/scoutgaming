import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { backupRenderState, restoreRenderState, verifyRenderBackup } from '../tools/backup-render-state.mjs';
import { createCompanionStore, COMPANION_STORE_FILE } from '../packages/director/node/companion-store.mjs';
import { createSearchService, SEARCH_STORE_FILE } from '../services/openclaw/lab/deploy/companion-search-server.mjs';

const runFile = promisify(execFile);
const cliPath = fileURLToPath(new URL('../tools/backup-render-state.mjs', import.meta.url));
async function cli(...args) {
  // 45 s: each CLI call spawns Node and hashes the fixture; 15 s tripped under hook load on 8 Oct.
  const { stdout } = await runFile(process.execPath, [cliPath, ...args], { windowsHide: true, timeout: 45000 });
  return JSON.parse(stdout);
}

const identity = 'a'.repeat(64), searchId = 'b'.repeat(64);
const LEGACY = Buffer.from('retired companion.sqlite fixture bytes');
// The provider refuses, so the durable receipt is the reserved 0.50 SEK 'unavailable'.
const searchOptions = (directory, fetchImpl = async () => new Response('', { status: 500 })) =>
  ({ directory, key: 'fixture-model-key', now: () => Date.parse('2026-09-21T04:00:00Z'), fetchImpl });

// The product profile (players/croupier.db, craig.db) left with the engine's SQLite path.
// Director and Gateway state is written by the real companion stores.
async function fixture(t, profile = 'director') {
  const base = await mkdtemp(join(tmpdir(), 'croupier-render-backup-test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const source = join(base, 'source'), snapshot = join(base, 'snapshot'), target = join(base, 'target');
  await mkdir(source); await mkdir(target);
  if (profile === 'director') {
    const store = createCompanionStore(source);
    store.rename(identity, 'Jakob'); store.close();
    await writeFile(join(source, 'catalog.json'), '{"fixture":true}\n');
    await mkdir(join(source, 'history'));
    await writeFile(join(source, 'history', 'one.json'), '{"revision":1}\n');
    // A retired SQLite store left on the disk is preserved as opaque bytes.
    await writeFile(join(source, 'companion.sqlite'), LEGACY);
  } else {
    await writeFile(join(source, 'openclaw.json'), '{"fixture":true}\n');
    await mkdir(join(source, 'agents', 'croupier-chat', 'sessions'), { recursive: true });
    await writeFile(join(source, 'agents', 'croupier-chat', 'sessions', `${randomUUID()}.jsonl`), '{"fixture":true}\n');
    const service = createSearchService(searchOptions(source));
    try { assert.equal((await service.search({ id: searchId, query: 'Public query' })).status, 'unavailable'); }
    finally { service.close(); }
  }
  return { base, source, snapshot, target };
}

// Reopening proves the restored bytes are a working store, not only a matching hash.
async function assertStoreReopens(profile, directory) {
  if (profile === 'director') {
    const store = createCompanionStore(directory);
    try { assert.equal(store.profile(identity).name, 'Jakob'); } finally { store.close(); }
    assert.deepEqual(await readFile(join(directory, 'companion.sqlite')), LEGACY);
    return;
  }
  const service = createSearchService(searchOptions(directory, () => assert.fail('a restored receipt must not spend again')));
  try {
    const receipt = await service.search({ id: searchId, query: 'Public query' });
    assert.deepEqual([receipt.status, receipt.reason, receipt.costSek], ['unavailable', 'provider_http_500', 0.5]);
    assert.equal((await service.search({ id: searchId, query: 'Changed query' })).status, 'request_conflict');
  } finally { service.close(); }
}

for (const profile of ['director', 'gateway']) {
  test(`${profile}: verified backup and restore preserve only synthetic state`, async t => {
    const f = await fixture(t, profile);
    const result = await backupRenderState({ profile, source: f.source, destination: f.snapshot, quiesced: true });
    assert.ok(result.files >= 2);
    const manifest = await verifyRenderBackup(f.snapshot);
    assert.equal(manifest.profile, profile);
    assert.ok(manifest.files.some(item => item.path === (profile === 'director' ? COMPANION_STORE_FILE : SEARCH_STORE_FILE)));
    assert.deepEqual((await restoreRenderState({ profile, snapshot: f.snapshot, destination: f.target, quiesced: true })).files, manifest.files.length);
    for (const item of manifest.files) assert.deepEqual(
      await readFile(join(f.target, ...item.path.split('/'))),
      await readFile(join(f.snapshot, ...item.path.split('/'))));
    assert.equal((await readdir(f.target)).some(name => name.startsWith('.croupier-restore-')), false);
  });
}

test('an interrupted atomic write leaves the committed store in the snapshot', async t => {
  const f = await fixture(t);
  // A crash between writing the temporary file and the rename leaves this behind.
  const partial = Buffer.from('{"schema":"croupier-companion-v1","profiles":[');
  await writeFile(join(f.source, `${COMPANION_STORE_FILE}.tmp`), partial);
  await backupRenderState({ profile: 'director', source: f.source, destination: f.snapshot, quiesced: true });
  await assertStoreReopens('director', f.snapshot);
  assert.deepEqual(await readFile(join(f.snapshot, `${COMPANION_STORE_FILE}.tmp`)), partial);
});

test('tampering, extra entries and a nonempty restore root are rejected', async t => {
  const f = await fixture(t);
  await backupRenderState({ profile: 'director', source: f.source, destination: f.snapshot, quiesced: true });
  await writeFile(join(f.target, 'existing.txt'), 'must survive');
  await assert.rejects(restoreRenderState({ profile: 'director', snapshot: f.snapshot, destination: f.target, quiesced: true }), { code: 'destination_not_empty' });
  assert.equal(await readFile(join(f.target, 'existing.txt'), 'utf8'), 'must survive');
  await writeFile(join(f.snapshot, 'history', 'one.json'), 'tampered');
  await assert.rejects(verifyRenderBackup(f.snapshot), { code: 'backup_hash_mismatch' });
  await writeFile(join(f.snapshot, 'extra.txt'), 'unexpected');
  await assert.rejects(verifyRenderBackup(f.snapshot), { code: 'unexpected_backup_entry' });
});

test('wrong or retired profile, missing required state and unacknowledged live state are rejected', async t => {
  const f = await fixture(t), gateway = await fixture(t, 'gateway');
  await assert.rejects(backupRenderState({ profile: 'director', source: f.source, destination: f.snapshot }), { code: 'quiesced_required' });
  await assert.rejects(backupRenderState({ profile: 'gateway', source: f.source, destination: f.snapshot, quiesced: true }), { code: 'required_state_missing' });
  await assert.rejects(backupRenderState({ profile: 'director', source: gateway.source, destination: gateway.snapshot, quiesced: true }), { code: 'required_state_missing' });
  await assert.rejects(backupRenderState({ profile: 'product', source: f.source, destination: f.snapshot, quiesced: true }), { code: 'invalid_profile' });
  await backupRenderState({ profile: 'director', source: f.source, destination: f.snapshot, quiesced: true });
  await assert.rejects(restoreRenderState({ profile: 'gateway', snapshot: f.snapshot, destination: f.target, quiesced: true }), { code: 'profile_mismatch' });
  // An old product snapshot is no longer a verifiable profile here (see ENVIRONMENT-RESTORATION).
  const manifestPath = join(f.snapshot, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify({ ...JSON.parse(await readFile(manifestPath, 'utf8')), profile: 'product' }));
  await assert.rejects(verifyRenderBackup(f.snapshot), { code: 'invalid_manifest' });
});

test('symlinks are refused without copying outside data', async t => {
  const f = await fixture(t);
  const outside = join(f.base, 'private.txt');
  await writeFile(outside, 'synthetic secret');
  try { await symlink(outside, join(f.source, 'history', 'linked.txt'), 'file'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('symlinks unavailable'); return; } throw error; }
  await assert.rejects(backupRenderState({ profile: 'director', source: f.source, destination: f.snapshot, quiesced: true }), { code: 'unsafe_source_entry' });
  await assert.rejects(readdir(f.snapshot), { code: 'ENOENT' });
});

test('corrupt stores and reserved source names never publish a snapshot', async t => {
  for (const profile of ['director', 'gateway']) {
    const f = await fixture(t, profile);
    await writeFile(join(f.source, profile === 'director' ? COMPANION_STORE_FILE : SEARCH_STORE_FILE), 'not json');
    await assert.rejects(backupRenderState({ profile, source: f.source, destination: f.snapshot, quiesced: true }), { code: 'store_integrity_failed' });
    await assert.rejects(readdir(f.snapshot), { code: 'ENOENT' });
    await writeFile(join(f.source, 'manifest.json'), 'reserved');
    await assert.rejects(backupRenderState({ profile, source: f.source, destination: f.snapshot, quiesced: true }), { code: 'reserved_source_entry' });
  }
});

test('manifest traversal is rejected before restoring any file', async t => {
  const f = await fixture(t);
  await backupRenderState({ profile: 'director', source: f.source, destination: f.snapshot, quiesced: true });
  const path = join(f.snapshot, 'manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  manifest.files[0].path = '../outside.txt';
  await writeFile(path, JSON.stringify(manifest));
  await assert.rejects(restoreRenderState({ profile: 'director', snapshot: f.snapshot, destination: f.target, quiesced: true }), { code: 'invalid_manifest' });
  assert.deepEqual(await readdir(f.target), []);
});

test('a structurally damaged store is rejected even when JSON parsing and hashes pass', async t => {
  const f = await fixture(t, 'director');
  await backupRenderState({ profile: 'director', source: f.source, destination: f.snapshot, quiesced: true });
  const path = join(f.snapshot, COMPANION_STORE_FILE);
  const damaged = JSON.parse(await readFile(path, 'utf8'));
  damaged.requests = {};
  await writeFile(path, JSON.stringify(damaged));
  // A valid hash is not evidence of a usable store.
  const manifestPath = join(f.snapshot, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const bytes = await readFile(path);
  Object.assign(manifest.files.find(item => item.path === COMPANION_STORE_FILE), {
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(verifyRenderBackup(f.snapshot), { code: 'store_integrity_failed' });
  await assert.rejects(restoreRenderState({ profile: 'director', snapshot: f.snapshot, destination: f.target, quiesced: true }), { code: 'store_integrity_failed' });
  assert.deepEqual(await readdir(f.target), []);
  await cp(path, join(f.source, COMPANION_STORE_FILE));
  const rejected = join(f.base, 'rejected-snapshot');
  await assert.rejects(backupRenderState({ profile: 'director', source: f.source, destination: rejected, quiesced: true }), { code: 'store_integrity_failed' });
  await assert.rejects(readdir(rejected), { code: 'ENOENT' });
  assert.equal((await readdir(f.base)).some(name => name.startsWith('.rejected-snapshot.partial-')), false);
});

for (const profile of ['director', 'gateway']) {
  test(`${profile}: CLI export, external copy and restore survive loss of the source and a second reopen`, async t => {
    const f = await fixture(t, profile);
    const external = await mkdtemp(join(tmpdir(), 'croupier-render-external-test-'));
    t.after(() => rm(external, { recursive: true, force: true }));
    const received = join(external, 'received');

    const backup = await cli('backup', '--profile', profile, '--source', f.source, '--destination', f.snapshot, '--quiesced', 'yes');
    assert.equal(backup.status, 'verified');
    assert.equal(backup.profile, profile);
    assert.ok(backup.files >= 2);
    await cp(f.snapshot, received, { recursive: true, errorOnExist: true, force: false });
    const transferred = await cli('verify', '--snapshot', received);
    assert.equal(transferred.profile, profile);
    assert.equal(transferred.files, backup.files);
    const manifest = await verifyRenderBackup(received);

    // These exact synthetic fixture paths are owned by this test. The received
    // copy must stand alone after both the source and original snapshot disappear.
    for (const owned of [f.source, f.snapshot]) {
      assert.equal(dirname(owned), f.base);
      await rm(owned, { recursive: true });
    }
    const restored = await cli('restore', '--profile', profile, '--snapshot', received, '--destination', f.target, '--quiesced', 'yes');
    assert.deepEqual(restored, { status: 'verified', profile, files: manifest.files.length });
    for (const item of manifest.files) assert.deepEqual(await readFile(join(f.target, ...item.path.split('/'))), await readFile(join(received, ...item.path.split('/'))));
    assert.equal((await readdir(f.target)).some(name => name.startsWith('.croupier-restore-')), false);

    for (let reopen = 0; reopen < 2; reopen++) await assertStoreReopens(profile, f.target);
    const beforeRejectedRestore = await readdir(f.target);
    await assert.rejects(cli('restore', '--profile', profile, '--snapshot', received, '--destination', f.target, '--quiesced', 'yes'), error => error.code === 1 && error.stderr.includes('destination_not_empty'));
    assert.deepEqual(await readdir(f.target), beforeRejectedRestore);
    t.diagnostic(`${profile}: ${manifest.files.length} synthetic files; external transfer, source loss, CLI restore, two reopens and non-overwrite verified`);
  });
}
