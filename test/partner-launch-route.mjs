import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { createHmac } from 'node:crypto';
import { installPartnerApi } from '../services/game/partner-api.mjs';
import { normalizeDisplayName } from '../packages/studio-access/display-name.mjs';

test('Partner display names normalize as bounded untrusted presentation data', () => {
  assert.equal(normalizeDisplayName(undefined), 'spelaren');
  assert.equal(normalizeDisplayName(null), 'spelaren');
  assert.equal(normalizeDisplayName('  Ja\u0308kob\u00a0  Test  '), 'Jäkob Test');
  assert.equal(normalizeDisplayName('😀'.repeat(40)), '😀'.repeat(40));
  for (const value of ['', '   ', `Jakob\nAdmin`, `Jakob\u2028Admin`, `Jakob\u2029Admin`, `Jakob\u200bAdmin`, 'a'.repeat(41)]) {
    assert.throws(() => normalizeDisplayName(value), /displayName/);
  }
  for (const value of [42, {}, []]) assert.throws(() => normalizeDisplayName(value), /displayName/);
});

test('BO and signed Partner launch default to original Astrid, without review motion', async t => {
  const db = new DatabaseSync(':memory:'), boDb = new DatabaseSync(':memory:');
  t.after(() => { db.close(); boDb.close(); });
  db.exec('CREATE TABLE players (id TEXT PRIMARY KEY, name TEXT, currency TEXT, balance REAL, created_at TEXT)');
  const partner = installPartnerApi({ db, boDb, publicUrl: 'https://example.invalid',
    getPlayer: id => db.prepare('SELECT * FROM players WHERE id=?').get(id),
    jwtSign: () => 'isolated-test-token', logTx: () => {}, root: '' });
  const key = partner.keys.create({ name: 'route-test', scopes: ['launch'] }, null);
  const minted = partner.keys.mintLaunch(key.id, { playerId: 'qa' });
  const body = JSON.stringify({ playerId: 'qa' });
  const ts = String(Math.floor(Date.now() / 1000)), path = '/api/v1/launch';
  const req = Readable.from([body]);
  req.method = 'POST';
  req.headers = { 'x-api-key': key.key, 'x-timestamp': ts,
    'x-signature': createHmac('sha256', key.secret).update(`${ts}.POST.${path}.${body}`).digest('hex') };
  const res = { writeHead(status) { this.status = status; }, end(text) { this.body = JSON.parse(text); } };
  await partner.handle(req, res, path);
  assert.equal(res.status, 200);
  for (const result of [minted, res.body]) {
    const url = new URL(result.url);
    assert.equal(url.origin, 'https://example.invalid');
    assert.equal(url.pathname, '/');
    assert.equal(url.searchParams.get('dealer'), 'astrid');
    assert.equal(url.searchParams.get('launch'), 'isolated-test-token');
    assert.equal(url.searchParams.has('performance'), false);
    assert.equal(url.searchParams.has('motion'), false);
  }
});

test('renaming a Partner player preserves playerRef and never creates a synthetic key:id name', async t => {
  const db = new DatabaseSync(':memory:'), boDb = new DatabaseSync(':memory:');
  t.after(() => { db.close(); boDb.close(); });
  db.exec('CREATE TABLE players (id TEXT PRIMARY KEY, name TEXT, currency TEXT, balance REAL, created_at TEXT)');
  const claims = [];
  const partner = installPartnerApi({ db, boDb, publicUrl: 'https://example.invalid',
    getPlayer: id => db.prepare('SELECT * FROM players WHERE id=?').get(id),
    jwtSign: value => { claims.push(value); return `isolated-token-${claims.length}`; }, logTx: () => {}, root: '' });
  const key = partner.keys.create({ name: 'operator-private-name', scopes: ['launch'] }, null);
  async function launch(payload) {
    const body = JSON.stringify(payload), path = '/api/v1/launch', ts = String(Math.floor(Date.now() / 1000));
    const req = Readable.from([body]); req.method = 'POST'; req.headers = { 'x-api-key': key.key, 'x-timestamp': ts,
      'x-signature': createHmac('sha256', key.secret).update(`${ts}.POST.${path}.${body}`).digest('hex') };
    const res = { writeHead(status) { this.status = status; }, end(text) { this.body = JSON.parse(text); } };
    await partner.handle(req, res, path); return res;
  }
  const first = await launch({ playerId: 'stable-technical-id', displayName: '  Ja\u0308kob   Test  ', currency: 'EUR' });
  const renamed = await launch({ playerId: 'stable-technical-id', displayName: 'Jakob Ny', currency: 'EUR' });
  const neutral = await launch({ playerId: 'stable-technical-id', currency: 'EUR' });
  assert.equal(first.status, 200); assert.equal(renamed.status, 200); assert.equal(neutral.status, 200);
  assert.equal(first.body.playerRef, renamed.body.playerRef); assert.equal(first.body.playerRef, neutral.body.playerRef);
  assert.deepEqual(claims.map(value => value.displayName), ['Jäkob Test', 'Jakob Ny', 'spelaren']);
  assert.equal(new Set(claims.map(value => value.sub)).size, 1);
  assert.ok(claims.every(value => !JSON.stringify(value).includes('stable-technical-id')));
  const stored = db.prepare('SELECT id,name FROM players').all();
  assert.equal(stored.length, 1); assert.equal(stored[0].id, first.body.playerRef); assert.equal(stored[0].name, 'spelaren');
  assert.ok(!JSON.stringify(stored).includes('operator-private-name'));
  assert.ok(!JSON.stringify(stored).includes('stable-technical-id'));
  for (const displayName of [`Jakob\nAdmin`, 'a'.repeat(41)]) assert.equal((await launch({ playerId: 'stable-technical-id', displayName })).status, 400);
});
