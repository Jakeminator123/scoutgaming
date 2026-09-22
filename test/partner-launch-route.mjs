import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { createHmac } from 'node:crypto';
import { installPartnerApi } from '../web/partner-api.mjs';

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
