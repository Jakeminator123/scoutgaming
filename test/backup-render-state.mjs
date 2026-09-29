import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID, scryptSync } from 'node:crypto';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { backupRenderState, restoreRenderState, verifyRenderBackup } from '../tools/backup-render-state.mjs';
import { craigIdentity } from '../web/craig-identity.mjs';
import { playerAuth } from '../web/player-auth.mjs';
import { newGame, command, gameView } from '../web/shoe-game.mjs';

const runFile = promisify(execFile);
const cliPath = fileURLToPath(new URL('../tools/backup-render-state.mjs', import.meta.url));
async function cli(...args) {
  const { stdout } = await runFile(process.execPath, [cliPath, ...args], { windowsHide: true, timeout: 15000 });
  return JSON.parse(stdout);
}

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

test('declared SQLite foreign-key damage is rejected even when page integrity and hashes pass', async t => {
  const f = await fixture(t, 'director');
  await backupRenderState({ profile: 'director', source: f.source, destination: f.snapshot, quiesced: true });
  const path = join(f.snapshot, 'companion.sqlite');
  const db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA foreign_keys=OFF;
      CREATE TABLE parent (id INTEGER PRIMARY KEY);
      CREATE TABLE child (parent_id INTEGER REFERENCES parent(id));
      INSERT INTO child VALUES (999);`);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 1);
  } finally { db.close(); }
  // A valid hash is not evidence of a usable relational database.
  const manifestPath = join(f.snapshot, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const bytes = await readFile(path);
  Object.assign(manifest.files.find(item => item.path === 'companion.sqlite'), {
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(verifyRenderBackup(f.snapshot), { code: 'sqlite_integrity_failed' });
  await assert.rejects(restoreRenderState({ profile: 'director', snapshot: f.snapshot, destination: f.target, quiesced: true }), { code: 'sqlite_integrity_failed' });
  assert.deepEqual(await readdir(f.target), []);
  await cp(path, join(f.source, 'companion.sqlite'));
  const rejected = join(f.base, 'rejected-snapshot');
  await assert.rejects(backupRenderState({ profile: 'director', source: f.source, destination: rejected, quiesced: true }), { code: 'sqlite_integrity_failed' });
  await assert.rejects(readdir(rejected), { code: 'ENOENT' });
  assert.equal((await readdir(f.base)).some(name => name.startsWith('.rejected-snapshot.partial-')), false);
});

for (const profile of ['product', 'director', 'gateway']) {
  test(`${profile}: CLI export, external copy and restore survive loss of the source and a second reopen`, async t => {
    const f = await fixture(t, profile);
    const external = await mkdtemp(join(tmpdir(), 'croupier-render-external-test-'));
    t.after(() => rm(external, { recursive: true, force: true }));
    const received = join(external, 'received');
    let sessionCookie, expectedGame, expectedWallet;
    const password = 'Synthetic-restore-only-2026';
    if (profile === 'product') {
      const craig = new DatabaseSync(join(f.source, 'players', 'craig.db'));
      const players = new DatabaseSync(join(f.source, 'players', 'croupier.db'));
      try {
        craig.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,email TEXT,salt TEXT,hash TEXT,role TEXT)');
        craig.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(1, 'synthetic', 'synthetic@example.invalid', 'test-salt', scryptSync(password, 'test-salt', 64).toString('hex'), 'reader');
        players.exec('CREATE TABLE players(id TEXT PRIMARY KEY,name TEXT,balance REAL,game TEXT)');
        const game = newGame();
        command(game, { op: 'state', version: game.version, requestId: randomUUID() }, 1000);
        // Fixed cards keep an unpaid hand open for the restore acceptance check.
        const cards = [['8', '♠'], ['6', '♦'], ['8', '♥'], ['10', '♣']].map(([r, s]) => ({ r, s }));
        game.shoe.cards.splice(-cards.length, cards.length, ...cards.reverse());
        const bets = [{ main: 5, pp: 0, tp: 0 }, ...Array.from({ length: 6 }, () => ({ main: 0, pp: 0, tp: 0 }))];
        const dealt = command(game, { op: 'start', version: game.version, requestId: randomUUID(), bets }, 1000);
        expectedWallet = 1000 + dealt.delta;
        expectedGame = JSON.stringify(game);
        const identity = craigIdentity(craig);
        const auth = playerAuth(players, ({ name }) => {
          players.prepare('INSERT INTO players VALUES (?,?,?,?)').run('synthetic-player', name, expectedWallet, expectedGame);
          return { id: 'synthetic-player' };
        }, identity);
        sessionCookie = auth.fromBackoffice({ headers: {}, socket: { encrypted: false } }, identity.authenticate('synthetic', password));
        assert.equal(auth.user({ headers: { cookie: sessionCookie } }), 'synthetic-player');
      } finally { players.close(); craig.close(); }
    }

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

    for (let reopen = 0; reopen < 2; reopen++) {
      if (profile === 'product') {
        const craig = new DatabaseSync(join(f.target, 'players', 'craig.db'));
        const players = new DatabaseSync(join(f.target, 'players', 'croupier.db'));
        try {
          const identity = craigIdentity(craig);
          assert.equal(identity.authenticate('synthetic', password).id, '1');
          assert.equal(craig.prepare('SELECT role FROM users WHERE id=1').get().role, 'reader');
          const auth = playerAuth(players, () => assert.fail('restore must reuse the original player link'), identity);
          assert.equal(auth.user({ headers: { cookie: sessionCookie } }), 'synthetic-player');
          const saved = players.prepare('SELECT balance,game FROM players WHERE id=?').get('synthetic-player');
          assert.equal(saved.balance, expectedWallet);
          assert.equal(saved.game, expectedGame);
          const game = JSON.parse(saved.game);
          assert.equal(game.shoe.cards.length + game.shoe.dealt, 416);
          assert.equal(gameView(game).round.phase, 'decisions');
        } finally { players.close(); craig.close(); }
      } else {
        const db = new DatabaseSync(join(f.target, profile === 'director' ? 'companion.sqlite' : 'companion-search.sqlite'), { readOnly: true });
        try {
          const row = profile === 'director' ? db.prepare('SELECT name FROM memories').get() : db.prepare('SELECT id FROM receipts').get();
          assert.equal(profile === 'director' ? row.name : row.id, profile === 'director' ? 'fixture' : 1);
          assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
        } finally { db.close(); }
      }
    }
    const beforeRejectedRestore = await readdir(f.target);
    await assert.rejects(cli('restore', '--profile', profile, '--snapshot', received, '--destination', f.target, '--quiesced', 'yes'), error => error.code === 1 && error.stderr.includes('destination_not_empty'));
    assert.deepEqual(await readdir(f.target), beforeRejectedRestore);
    t.diagnostic(`${profile}: ${manifest.files.length} synthetic files; external transfer, source loss, CLI restore, two reopens and non-overwrite verified`);
  });
}
