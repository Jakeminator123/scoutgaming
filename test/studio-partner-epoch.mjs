import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { playerAuth } from '../services/game/storage/async-player-auth.mjs';
import { installPartnerApi } from '../services/game/storage/async-partner-api.mjs';

const stamp = secret => createHash('sha256').update(secret).digest('hex');
function fixture(t, { legacy = false } = {}) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  sqlite.exec(`CREATE TABLE players (id TEXT PRIMARY KEY,name TEXT,currency TEXT,balance REAL,created_at TEXT,status TEXT DEFAULT 'active');
    CREATE TABLE api_keys (id TEXT PRIMARY KEY,name TEXT,key TEXT UNIQUE,secret TEXT,scopes TEXT,wallet_url TEXT,ip_allow TEXT,created_by TEXT,created_at TEXT,last_used TEXT,revoked_at TEXT);
    CREATE TABLE partner_players (key_id TEXT,partner_player TEXT,player_id TEXT,PRIMARY KEY(key_id,partner_player));
    CREATE TABLE player_sessions (digest TEXT PRIMARY KEY,player_id TEXT,expires INTEGER,source_stamp TEXT,display_name TEXT);`);
  const context = new AsyncLocalStorage(); let tail = Promise.resolve(), beforeTransaction;
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql.replace(/ FOR UPDATE\b/g, ''));
      return Object.fromEntries(['get','all','run'].map(method => [method, async (...args) => statement[method](...args)]));
    },
    transaction(work) {
      if (context.getStore()) return work();
      const pending = tail.then(async () => {
        if (beforeTransaction) { const hook = beforeTransaction; beforeTransaction = undefined; await hook(); }
        sqlite.exec('BEGIN');
        try { const result = await context.run(true, work); sqlite.exec('COMMIT'); return result; }
        catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      }); tail = pending.catch(() => {}); return pending;
    },
  };
  const claims = [];
  const partner = installPartnerApi({ db, boDb: db, getPlayer: id => db.prepare('SELECT * FROM players WHERE id=?').get(id),
    logTx: async () => {}, jwtSign: value => { claims.push(value); return 'fixture-token'; }, publicUrl: 'https://game.example.invalid',
    publicGamePath: '/game', root: '', allowLegacyPartnerSessions: legacy });
  const authOptions = { allowLegacyPartnerSessions: legacy, partnerAuthority: id => db.prepare('SELECT * FROM api_keys WHERE id=?').get(id) };
  const auth = playerAuth(db, () => { throw Error('No real account creation'); }, null, authOptions);
  const request = cookie => ({ headers: { cookie }, socket: {} });
  async function signed(key, path, body = { playerId: 'fixture-player' }) {
    const raw = JSON.stringify(body), timestamp = String(Math.floor(Date.now() / 1000));
    const req = Readable.from([raw]); req.method = 'POST'; req.headers = {
      'x-api-key': key.key, 'x-timestamp': timestamp,
      'x-signature': createHmac('sha256', key.secret).update(`${timestamp}.POST.${path}.${raw}`).digest('hex'),
    };
    const response = { writeHead(status) { this.status = status; }, end(text) { this.body = JSON.parse(text); } };
    await partner.handle(req, response, path); return response;
  }
  return { db, sqlite, auth, authOptions, partner, claims, request, signed,
    set beforeTransaction(hook) { beforeTransaction = hook; } };
}

test('both native and signed partner launch paths bind claims to the current key credential', async t => {
  const f = fixture(t), key = await f.partner.keys.create({ name: 'fixture', scopes: ['launch','play'] });
  await f.partner.keys.mintLaunch(key.id, { playerId: 'fixture-player' });
  assert.equal((await f.signed(key, '/api/v1/launch')).status, 200);
  assert.equal(f.claims.length, 2);
  for (const claims of f.claims) {
    assert.equal(claims.partner_key_stamp, stamp(key.secret));
    assert.equal(JSON.stringify(claims).includes(key.secret), false);
  }
});

test('rotation invalidates issued sessions and saved launch URLs; a fresh credential works after restart', async t => {
  const f = fixture(t), key = await f.partner.keys.create({ name: 'fixture', scopes: ['launch','play'] });
  await f.partner.keys.mintLaunch(key.id, { playerId: 'fixture-player' }); const oldClaims = f.claims.at(-1);
  const oldCookie = await f.auth.fromPartner(f.request(''), oldClaims);
  assert.equal((await f.auth.session(f.request(oldCookie))).partnerKeyStamp, stamp(key.secret));
  const rotated = await f.partner.keys.rotate(key.id);
  assert.equal(await f.auth.session(f.request(oldCookie)), null);
  await assert.rejects(f.auth.fromPartner(f.request(''), oldClaims), /unavailable/);
  assert.equal((await f.signed(key, '/api/v1/launch')).status, 401);
  await f.partner.keys.mintLaunch(key.id, { playerId: 'fixture-player' });
  const fresh = f.claims.at(-1); assert.equal(fresh.partner_key_stamp, stamp(rotated.secret));
  const restarted = playerAuth(f.db, () => { throw Error('No account creation'); }, null, f.authOptions);
  const cookie = await restarted.fromPartner(f.request(''), fresh);
  assert.equal((await restarted.session(f.request(cookie))).playerId, fresh.sub);
  await f.partner.keys.revoke(key.id);
  assert.equal(await restarted.session(f.request(cookie)), null);
  await assert.rejects(restarted.fromPartner(f.request(''), fresh), /unavailable/);
});

test('strict cutover rejects legacy launch claims and persisted legacy partner sessions', async t => {
  const f = fixture(t), key = await f.partner.keys.create({ name: 'fixture', scopes: ['launch'] });
  await f.partner.keys.mintLaunch(key.id, { playerId: 'fixture-player' });
  const { partner_key_stamp, ...legacyClaims } = f.claims.at(-1);
  await assert.rejects(f.auth.fromPartner(f.request(''), legacyClaims), /unavailable/);
  const token = 'a'.repeat(64);
  await f.db.prepare('INSERT INTO player_sessions VALUES (?,?,?,?,?)').run(stamp(token), legacyClaims.sub, Date.now()+60000, `partner:${key.id}`, 'fixture');
  assert.equal(await f.auth.session(f.request(`player_session=${token}`)), null);
  assert.equal(await f.auth.partnerAllowed(key.id), false);
  for (const invalid of ['', 'bad', '0'.repeat(64), 3]) await assert.rejects(f.auth.fromPartner(f.request(''), { ...legacyClaims, partner_key_stamp: invalid }), /unavailable/);
});

test('flag-off compatibility admits legacy claims while all newly minted claims stay stamped', async t => {
  const f = fixture(t, { legacy: true }), key = await f.partner.keys.create({ name: 'fixture', scopes: ['launch'] });
  await f.partner.keys.mintLaunch(key.id, { playerId: 'fixture-player' });
  const { partner_key_stamp, ...legacyClaims } = f.claims.at(-1);
  assert.equal(partner_key_stamp, stamp(key.secret));
  const cookie = await f.auth.fromPartner(f.request(''), legacyClaims);
  assert.equal((await f.auth.session(f.request(cookie))).partnerKeyId, key.id);
});

test('rotation or revocation while session issuance waits for its transaction cannot create a bearer', async t => {
  for (const operation of ['rotate', 'revoke']) {
    const f = fixture(t), key = await f.partner.keys.create({ name: 'fixture', scopes: ['launch'] });
    await f.partner.keys.mintLaunch(key.id, { playerId: 'fixture-player' }); const claims = f.claims.at(-1);
    f.beforeTransaction = () => f.partner.keys[operation](key.id);
    await assert.rejects(f.auth.fromPartner(f.request(''), claims), /unavailable/);
    assert.equal((await f.db.prepare('SELECT * FROM player_sessions').all()).length, 0);
  }
});

test('queued partner credits recheck the authenticated credential inside the game transaction', async t => {
  const f = fixture(t), key = await f.partner.keys.create({ name: 'fixture', scopes: ['launch','wallet'] });
  await f.partner.keys.mintLaunch(key.id, { playerId: 'fixture-player' }); const player = f.claims.at(-1).sub;
  f.beforeTransaction = () => f.partner.keys.rotate(key.id);
  const response = await f.signed(key, '/api/v1/demo-credit', { playerId: 'fixture-player', amount: 100 });
  assert.equal(response.status, 400);
  assert.equal((await f.db.prepare('SELECT balance FROM players WHERE id=?').get(player)).balance, 0);
});

test('native partner events reject old stamps and legacy provenance after cutover', async t => {
  const f = fixture(t), key = await f.partner.keys.create({ name: 'fixture', scopes: ['launch','events'] });
  await f.partner.keys.mintLaunch(key.id, { playerId: 'fixture-player' }); const claims = f.claims.at(-1);
  const observation = { playerId: claims.sub, previousView: { round: null }, view: { round: null },
    command: { op: 'collect', requestId: 'fixture' }, balance: 0 };
  assert.equal(await f.partner.publishNativeRound({ ...observation, session: { playerId: claims.sub, partnerKeyId: key.id, partnerKeyStamp: stamp(key.secret) } }), true);
  await f.partner.keys.rotate(key.id);
  for (const session of [{ playerId: claims.sub, partnerKeyId: key.id, partnerKeyStamp: stamp(key.secret) }, { playerId: claims.sub, partnerKeyId: key.id }]) {
    assert.equal(await f.partner.publishNativeRound({ ...observation, session }), false);
  }
});
