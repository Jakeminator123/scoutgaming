import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handlePlayerProfile, readPlayerProfile} from '../services/game/player-profile.mjs';

function database(columns) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE players (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, currency TEXT NOT NULL, balance REAL NOT NULL
    ${columns ? ', display_name TEXT, locale TEXT' : ''}
  )`);
  db.prepare('INSERT INTO players (id, name, currency, balance) VALUES (?,?,?,?)').run('player-1', 'ada', 'SEK', 1000);
  return db;
}

function response() {
  return {status: 0, body: '', writeHead(status) { this.status = status; }, end(body) { this.body = body ?? ''; }};
}

function request(method, body) {
  const bytes = Buffer.from(body ?? '');
  return {method, async *[Symbol.asyncIterator]() { if (bytes.length) yield bytes; }};
}

async function call(db, {method = 'PATCH', body = '{}', playerId = 'player-1', originOk = true} = {}) {
  const res = response();
  await handlePlayerProfile(request(method, body), res, {db, playerId, originOk});
  const text = res.body ?? '';
  return {status: res.status, body: text.startsWith('{') ? JSON.parse(text) : null, text};
}

test('PATCH /api/profile is 401 without a session, 422 for a bad value, and 200 with only the profile fields', async () => {
  const db = database(true);
  assert.equal((await call(db, {playerId: null})).status, 401);
  assert.equal((await call(db, {body: JSON.stringify({displayName: 'A', locale: 'sv'})})).status, 422);
  assert.equal((await call(db, {body: JSON.stringify({displayName: 'Bo', locale: 'de'})})).status, 422);
  assert.equal((await call(db, {body: JSON.stringify({displayName: 'Bo\u0001', locale: 'sv'})})).status, 422);
  assert.equal((await call(db, {body: JSON.stringify({displayName: 'B'.repeat(41), locale: 'en'})})).status, 422);
  assert.equal(db.prepare('SELECT name, balance, display_name FROM players WHERE id=?').get('player-1').balance, 1000);

  const saved = await call(db, {body: JSON.stringify({displayName: '  Bo  ', locale: 'en', balance: 1, currency: 'USD'})});
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body, {displayName: 'Bo', locale: 'en', currency: 'SEK', balance: 1000, editable: true});
  const row = db.prepare('SELECT name, balance, display_name, locale FROM players WHERE id=?').get('player-1');
  assert.equal(row.name, 'ada');
  assert.equal(row.balance, 1000);
  assert.equal(row.display_name, 'Bo');
  assert.equal(row.locale, 'en');
  const read = await readPlayerProfile(db, 'player-1');
  assert.equal(read.displayName, 'Bo');
  assert.equal(read.balance, 1000);
  db.close();
});

test('profile stays readable and refuses writes when the columns are missing', async () => {
  const db = database(false);
  const res = response();
  await handlePlayerProfile(request('GET'), res, {db, playerId: 'player-1'});
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(res.body).editable, false);
  assert.match(JSON.parse(res.body).displayName, /ada|Spelare/);
  const denied = await call(db, {body: JSON.stringify({displayName: 'Bo', locale: 'sv'})});
  assert.equal(denied.status, 503);
  assert.equal(denied.body.error, 'profile_unavailable');
  assert.equal(db.prepare('SELECT balance, name FROM players WHERE id=?').get('player-1').balance, 1000);
  db.close();
});

test('profile PATCH rejects a foreign origin before it writes', async () => {
  const db = database(true);
  const denied = await call(db, {originOk: false, body: JSON.stringify({displayName: 'Bo', locale: 'sv'})});
  assert.equal(denied.status, 403);
  assert.equal(denied.body, null);
  assert.equal(db.prepare('SELECT display_name FROM players WHERE id=?').get('player-1').display_name, null);
  db.close();
});
