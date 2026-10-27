// Public HTTP surface of the real engine on PostgreSQL. These assertions came from
// the retired SQLite comparison fixture (test/game-entry-offline.mjs,
// test/local-comparison-fixture.mjs and the HTTP half of test/generation-media.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { installPartnerApi } from '../services/game/storage/async-partner-api.mjs';
import { ENGINE_QA_SKIP, backofficeCookie, createEngineDatabase, freePort, insertCraigUser, startEngine } from './fixtures/engine-qa.mjs';

const known = '11111111-2222-3333-4444-555555555555';
const readToken = randomBytes(32).toString('base64url');

test('engine without a published presentation refuses dealer queries, retired local media and BO generation aliases', { skip: ENGINE_QA_SKIP }, async t => {
  const database = await createEngineDatabase(t);
  const admin = await insertCraigUser(database, { username: 'comparison-qa', email: 'comparison@example.invalid', password: randomBytes(24).toString('base64url'), role: 'superadmin' });
  const port = await freePort(), origin = `http://127.0.0.1:${port}`;
  const engine = await startEngine(t, { database, port, env: { NODE_ENV: 'development', DEMO_GUEST_ACCESS: '1', PUBLIC_URL: origin, BO_URL: origin,
    GENERATIONS_READ_TOKENS: createHash('sha256').update(readToken).digest('hex') } });
  const get = (path, { headers = {}, method = 'GET' } = {}) => fetch(engine.origin + path, { method, headers, redirect: 'manual' });

  for (const dealer of ['astrid', 'vera', 'amira', 'mei']) for (const path of ['/', '/game']) {
    const response = await get(path + '?dealer=' + dealer + '&rehearsal=1');
    assert.equal(response.status, 503, `${path} ${dealer}`);
    const html = await response.text();
    assert.match(html, /<h1>Ingen presentation vald<\/h1>/);
    assert.match(html, /Starta ett publicerat bord/);
    assert.doesNotMatch(html, /data-game-dealer=|<video|<script|data-game-entry|src="app.mjs"/);
  }
  for (const path of ['/dealer/streams/index.json', '/dealers/astrid/streams/index.json', '/dealers/amira/audio/en/bank.json', '/dealers/mei/poster.jpg',
    '/Dealers/AsTrId/streams/index.json', '/dealers./vera./poster.jpg', '/%64ealers/%61strid/streams/index.json']) {
    const response = await get(path);
    assert.equal(response.status, 410, path);
    assert.deepEqual(await response.json(), { error: 'local_dealer_retired' });
  }
  assert.equal((await get('/api/auth/session')).status, 200);

  // Encoded separators, casing and Windows trailing dots/spaces are still the retired
  // BO package: BO login first, then 405 for writes and 410 for reads, never a file.
  const aliases = [`/bo/gen/${known}.mp4`, `/bo%2fgen%2f${known}.mp4`, `/bo%5cgen%5c${known}.mp4`, '/bo/generations.json',
    ...['/BO/GEN/', '/Bo/gEn/', '/BO%2fGEN%2f', '/BO%5cGEN%5c', '/bo./gen./', '/bo%20/gen%20/', '/BO.%20/Gen%20./'].map(prefix => `${prefix}${known}.mp4`)];
  for (const path of aliases) {
    const response = await get(path);
    assert.equal(response.status, 302, `${path} requires BO auth`);
    assert.equal(response.headers.get('location'), '/admin/login');
  }
  const cookie = await backofficeCookie(database, admin.id);
  for (const path of aliases) {
    const write = await get(path, { headers: { Cookie: cookie }, method: 'POST' });
    // Only literal /bo/ paths are BO requests before decoding; encoded or case aliases
    // stop earlier as unauthenticated player writes. Neither may reach a file.
    if (path.startsWith('/bo/')) { assert.equal(write.status, 405, path); assert.equal(write.headers.get('allow'), 'GET, HEAD'); }
    else assert.ok([401, 405].includes(write.status), `${path} write refused (${write.status})`);
    const read = await get(path, { headers: { Cookie: cookie } });
    assert.equal(read.status, 410, path); assert.deepEqual(await read.json(), { error: 'legacy generation catalog retired' });
  }
  const auth = { Authorization: `Bearer ${readToken}` };
  for (const path of [`/api/v1/generations/${known}/video`, '/api/v1/generations']) {
    const response = await get(path, { headers: auth });
    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), { error: 'legacy generation catalog retired' });
  }
  assert.equal((await get(`/api/v1/generations/${known}/video`, { headers: auth, method: 'POST' })).status, 405);
  const mapping = await get('/api/v1/generations/mapping', { headers: auth });
  assert.equal(mapping.status, 200);
  assert.equal((await mapping.json()).actualPlayback, false);
  const rooms = await get('/api/operators/sg-test/rooms');
  assert.equal(rooms.status, 503); assert.deepEqual(await rooms.json(), { error: 'operator_rooms_unavailable' });
  assert.equal(rooms.headers.get('cache-control'), 'no-store'); assert.equal(rooms.headers.has('set-cookie'), false);
});

test('partner key pings, launches into its own credited wallet and keeps its secret out of the engine', { skip: ENGINE_QA_SKIP }, async t => {
  const database = await createEngineDatabase(t);
  const port = await freePort(), origin = `http://127.0.0.1:${port}`;
  const engine = await startEngine(t, { database, port, env: { NODE_ENV: 'development', DEMO_GUEST_ACCESS: '1', PUBLIC_URL: origin, BO_URL: origin } });
  const { db, boDb } = database.store;
  // Key issuance only, through the engine's async partner module and its own CRAIG secret.
  const [{ v }] = await database.query("SELECT v FROM croupier_auth.meta WHERE k='jwt_secret'");
  const jwtSign = payload => {
    const text = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
    return text + '.' + createHmac('sha256', Buffer.from(v, 'hex')).update(text).digest('base64url');
  };
  const partner = installPartnerApi({ db, boDb, jwtSign, publicUrl: engine.origin, root: fileURLToPath(new URL('../services/game/public/', import.meta.url)),
    getPlayer: id => db.prepare('SELECT id,name,currency,balance,status FROM players WHERE id=?').get(id),
    logTx: (playerId, type, amount, currency, meta) => db.prepare('INSERT INTO transactions(player_id,type,amount,currency,meta,at) VALUES(?,?,?,?,?,?)')
      .run(playerId, type, amount, currency, meta, new Date().toISOString()) });
  const key = await partner.keys.create({ name: 'Isolated comparison QA', scopes: ['launch', 'events'] }, 'comparison-qa');
  const playerId = 'comparison-' + randomUUID();
  const launch = await partner.keys.mintLaunch(key.id, { playerId, currency: 'USD' });
  await partner.keys.credit(key.id, { playerId, amount: 1000 });
  const ts = String(Math.floor(Date.now() / 1000)), body = '{}', path = '/api/v1/ping';
  const pinged = await fetch(engine.origin + path, { method: 'POST', body, headers: { 'Content-Type': 'application/json', Origin: engine.origin,
    'X-Api-Key': key.key, 'X-Timestamp': ts, 'X-Signature': createHmac('sha256', key.secret).update(`${ts}.POST.${path}.${body}`).digest('hex') } });
  assert.deepEqual((await pinged.json()).scopes, ['launch', 'events']);
  const launched = await fetch(launch.url, { redirect: 'manual' });
  assert.equal(launched.status, 303);
  const cookie = launched.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const player = await (await fetch(engine.origin + '/api/player', { method: 'POST', body: '{}',
    headers: { 'Content-Type': 'application/json', Origin: engine.origin, Cookie: cookie } })).json();
  assert.equal(player.id, launch.playerRef);
  assert.equal(player.balance, 1000);
  assert.ok(!engine.output().includes(key.secret), 'partner secret never reaches engine output');
});
