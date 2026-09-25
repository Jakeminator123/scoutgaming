import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createLissabonProfiles } from '../web/lissabon-profiles.mjs';
import { createPlayerChatMemory } from '../web/player-chat-memory.mjs';

test('local profiles retain independent server-owned memory after restart and revoke the previous session on switch', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'lissabon-profiles-'));
  let db, server, api, memory, origin;
  const switched = [];
  let now = Date.now();
  async function start() {
    db = new DatabaseSync(join(dir, 'profiles.db'));
    db.exec('CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY, name TEXT); CREATE TABLE IF NOT EXISTS blackjack_tables(player_id TEXT PRIMARY KEY, state TEXT);');
    memory = createPlayerChatMemory(db);
    api = createLissabonProfiles({ db, enabled: true, now: () => now, onSwitch: id => switched.push(id),
      createPlayer: ({ name }) => { const id = randomUUID(); db.prepare('INSERT INTO players VALUES (?,?)').run(id, name); return { id, name }; },
    });
    server = createServer((req, res) => api.handle(req, res, '/api/lissabon/profiles', api.session(req)?.playerId));
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { server.closeAllConnections(); await new Promise(done => server.close(done)); db.close(); }
  t.after(async () => { await stop(); assert.equal(dirname(resolve(dir)), resolve(tmpdir())); assert.ok(basename(dir).startsWith('lissabon-profiles-')); await rm(dir, { recursive: true, force: true }); });
  await start();
  const request = (cookie = '', value, headers = {}) => fetch(`${origin}/api/lissabon/profiles`, {
    method: value ? 'POST' : 'GET', headers: { cookie, origin, 'content-type': 'application/json', ...headers }, body: value && JSON.stringify(value),
  });
  const sessionRequest = cookie => ({ headers: { cookie, host: new URL(origin).host }, socket: { remoteAddress: '127.0.0.1' } });
  let response = await request('', { action: 'create', name: 'Demo Alfa' });
  assert.equal(response.status, 200);
  const alfa = (await response.json()).current;
  const alfaCookie = response.headers.get('set-cookie').split(';')[0];
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.equal(api.session(sessionRequest(alfaCookie)).displayName, 'Demo Alfa');
  memory.begin({ playerId: alfa.id, dealerId: 'astrid', requestId: 'remember-alfa', message: 'Jag gillar skogspromenader.' }).commit({ kind: 'generatedText', exactText: 'Det ska jag komma ihåg.' });

  response = await request(alfaCookie, { action: 'create', name: 'Demo Beta' });
  const beta = (await response.json()).current;
  const betaCookie = response.headers.get('set-cookie').split(';')[0];
  assert.notEqual(alfa.id, beta.id);
  assert.equal(api.session(sessionRequest(alfaCookie)), null, 'old generation ownership is revoked');
  assert.deepEqual(switched, [alfa.id]);
  assert.equal(memory.profile({ playerId: beta.id, dealerId: 'astrid' }).history.length, 0);
  assert.equal(memory.profile({ playerId: alfa.id, dealerId: 'vera' }).history.length, 0);
  assert.equal((await request(betaCookie, { action: 'create', name: 'DEMO ALFA' })).status, 409, 'same name cannot silently select another profile');
  db.prepare('INSERT INTO players VALUES (?,?)').run('ordinary-player', 'Unrelated');
  assert.equal((await request(betaCookie, { action: 'select', id: 'ordinary-player' })).status, 404);
  assert.equal((await request(betaCookie, { action: 'select', id: alfa.id }, { origin: 'https://foreign.example' })).status, 403);
  assert.equal((await request(betaCookie, { action: 'select', id: alfa.id }, { origin: '' })).status, 403);
  assert.equal(api.session({ ...sessionRequest(betaCookie), headers: { cookie: betaCookie, host: 'foreign.example' } }), null);
  assert.equal(api.session({ ...sessionRequest(betaCookie), socket: { remoteAddress: '192.168.1.2' } }), null);
  db.prepare('INSERT INTO blackjack_tables VALUES (?,?)').run(beta.id, JSON.stringify({ round: { phase: 'decisions' } }));
  assert.equal((await request(betaCookie, { action: 'select', id: alfa.id })).status, 409);
  assert.equal(api.session(sessionRequest(betaCookie)).playerId, beta.id);
  db.prepare('DELETE FROM blackjack_tables WHERE player_id=?').run(beta.id);

  await stop(); await start();
  assert.equal(api.session(sessionRequest(betaCookie)).playerId, beta.id, 'profile cookie survives server restart');
  response = await request(betaCookie, { action: 'select', id: alfa.id });
  assert.equal(response.status, 200);
  const restored = (await response.json()).current;
  assert.deepEqual(restored, alfa);
  const restoredCookie = response.headers.get('set-cookie').split(';')[0];
  assert.equal(memory.profile({ playerId: restored.id, dealerId: 'astrid' }).history[0].text, 'Jag gillar skogspromenader.');
  assert.equal(memory.profile({ playerId: beta.id, dealerId: 'astrid' }).history.length, 0);
  response = await request(restoredCookie, { action: 'guest' });
  assert.equal((await response.json()).current, null);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(api.session(sessionRequest(restoredCookie)), null);
  response = await request('', { action: 'select', id: alfa.id });
  const expiringCookie = response.headers.get('set-cookie').split(';')[0];
  now += 31 * 86400000;
  assert.equal(api.session(sessionRequest(expiringCookie)), null);
});

test('disabled profile API cannot create demo access or touch production tables', async () => {
  const api = createLissabonProfiles({ enabled: false, db: { exec: () => assert.fail('disabled API must not write') } });
  let status;
  const res = { writeHead: value => { status = value; }, end() {} };
  assert.equal(await api.handle({}, res, '/api/lissabon/profiles'), true);
  assert.equal(status, 404);
  assert.equal(api.session({}), null);
  assert.equal(await api.handle({}, res, '/api/player'), false);
});
