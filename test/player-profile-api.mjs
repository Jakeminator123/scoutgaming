import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePlayerProfile, readPlayerProfile} from '../services/game/player-profile.mjs';
import {createStatementDb} from './fixtures/statement-db.mjs';

// Postgres-shaped players table. Without the profile columns, any statement that
// names them fails like Postgres does (SQLSTATE 42703, undefined column).
function database(columns) {
  const tables = {players: new Map([['player-1', {id: 'player-1', name: 'ada', currency: 'SEK', balance: 1000,
    ...(columns ? {display_name: null, locale: null} : {})}]])};
  const undefinedColumn = () => Object.assign(new Error('column "display_name" does not exist'), {code: '42703'});
  const pick = (id, fields) => (tables.players.has(id) ? [tables.players.get(id)] : [])
    .map(row => Object.fromEntries(fields.map(field => [field, row[field]])));
  const update = 'UPDATE players SET display_name=?, locale=? WHERE id=?';
  return createStatementDb({tables, transactional: [update], statements: {
    'SELECT name, currency, balance, display_name, locale FROM players WHERE id=?': id => {
      if (!columns) throw undefinedColumn();
      return pick(id, ['name', 'currency', 'balance', 'display_name', 'locale']);
    },
    'SELECT name, currency, balance FROM players WHERE id=?': id => pick(id, ['name', 'currency', 'balance']),
    // Profile writes run inside a transaction.
    [update]: (displayName, locale, id) => {
      if (!columns) throw undefinedColumn();
      const row = tables.players.get(id);
      if (!row) return {changes: 0};
      Object.assign(row, {display_name: displayName, locale});
      return {changes: 1};
    },
  }});
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
  assert.equal(db.tables.players.get('player-1').balance, 1000);
  assert.equal(db.tables.players.get('player-1').display_name, null);

  const saved = await call(db, {body: JSON.stringify({displayName: '  Bo  ', locale: 'en', balance: 1, currency: 'USD'})});
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body, {displayName: 'Bo', locale: 'en', currency: 'SEK', balance: 1000, editable: true});
  const row = db.tables.players.get('player-1');
  assert.equal(row.name, 'ada');
  assert.equal(row.balance, 1000);
  assert.equal(row.display_name, 'Bo');
  assert.equal(row.locale, 'en');
  const read = await readPlayerProfile(db, 'player-1');
  assert.equal(read.displayName, 'Bo');
  assert.equal(read.balance, 1000);
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
  assert.equal(db.tables.players.get('player-1').balance, 1000);
  assert.equal(Object.hasOwn(db.tables.players.get('player-1'), 'display_name'), false);
});

test('profile PATCH rejects a foreign origin before it writes', async () => {
  const db = database(true);
  const denied = await call(db, {originOk: false, body: JSON.stringify({displayName: 'Bo', locale: 'sv'})});
  assert.equal(denied.status, 403);
  assert.equal(denied.body, null);
  assert.equal(db.tables.players.get('player-1').display_name, null);
});
