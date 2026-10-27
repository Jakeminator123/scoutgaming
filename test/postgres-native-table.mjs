import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPostgresNativeTableCommand } from '../services/game/postgres-native-table.mjs';
import { fakeNativeTablePool } from './fixtures/native-table-fake-pool.mjs';

const bets = [{ main: 5, pp: 0, tp: 0 }, ...Array.from({ length: 6 }, () => ({ main: 0, pp: 0, tp: 0 }))];

const fixture = ({ failOn = '' } = {}) => fakeNativeTablePool({ failOn,
  state: { players: { p1: { id: 'p1', name: 'Fixture', currency: 'USD', balance: '1000.00' } } } });

test('Postgres command commits wallet, shoe, ledger and presentation together; replay is idempotent', async () => {
  const { pool, store } = fixture();
  const published = [];
  const command = createPostgresNativeTableCommand({ pool, publish: o => published.push(o) });
  const request = { id: 'p1', op: 'start', version: 0, requestId: 'round-1', bets };
  const first = await command(request);
  assert.equal(first.balance, 995);
  assert.equal(first.version, 1);
  assert.ok(first.presentation.length > 0);
  assert.equal(store.state.transactions.length, 1);
  assert.equal(store.state.transactions[0][2], -5);
  assert.equal(store.state.players.p1.balance, '995');
  assert.equal(JSON.parse(store.state.tables.p1).version, 1);
  assert.equal(published.length, 1);
  const replay = await command(request);
  assert.deepEqual(replay, first);
  assert.equal(store.state.transactions.length, 1);
  assert.equal(published.length, 1);
  assert.equal(store.releases, 2);
  assert.ok(store.queries.indexOf('SELECT id, name, currency, balance, status FROM players WHERE id=$1 FOR UPDATE') < store.queries.indexOf('UPDATE players SET balance=$1 WHERE id=$2'));
});

test('failed ledger write rolls back wallet and shoe, without publishing an observation', async () => {
  const { pool, store } = fixture({ failOn: 'INSERT INTO transactions' });
  let published = false;
  const command = createPostgresNativeTableCommand({ pool, publish: () => { published = true; } });
  await assert.rejects(command({ id: 'p1', op: 'start', version: 0, requestId: 'round-1', bets }), /synthetic SQL failure/);
  assert.equal(store.state.players.p1.balance, '1000.00');
  assert.equal(store.state.tables.p1, undefined);
  assert.equal(store.state.transactions.length, 0);
  assert.equal(published, false);
  assert.ok(store.queries.includes('ROLLBACK'));
  assert.equal(store.releases, 1);
});

test('a stale request rolls back and cannot charge twice', async () => {
  const { pool, store } = fixture();
  const command = createPostgresNativeTableCommand({ pool });
  await command({ id: 'p1', op: 'start', version: 0, requestId: 'round-1', bets });
  await assert.rejects(command({ id: 'p1', op: 'start', version: 0, requestId: 'round-2', bets }), /Table changed/);
  assert.equal(store.state.players.p1.balance, '995');
  assert.equal(store.state.transactions.length, 1);
  assert.equal(JSON.parse(store.state.tables.p1).version, 1);
});
