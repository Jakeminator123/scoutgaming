import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPostgresNativeTableCommand } from '../web/postgres-native-table.mjs';

const bets = [{ main: 5, pp: 0, tp: 0 }, ...Array.from({ length: 6 }, () => ({ main: 0, pp: 0, tp: 0 }))];

// Transactional stand-in for the driver contract. It never connects to Neon or
// reads local product databases; failures discard every write in the command.
function fixture({ failOn = '' } = {}) {
  const store = {
    state: { players: { p1: { id: 'p1', name: 'Fixture', currency: 'USD', balance: '1000.00' } },
      tables: {}, transactions: [], presentations: {} },
    queries: [], releases: 0,
  };
  const pool = { async connect() {
    let tx;
    return {
      async query(sql, args = []) {
        store.queries.push(sql);
        if (sql.startsWith('BEGIN;')) { tx = structuredClone(store.state); return { rows: [] }; }
        if (sql === 'COMMIT') { store.state = tx; tx = undefined; return { rows: [] }; }
        if (sql === 'ROLLBACK') { tx = undefined; return { rows: [] }; }
        if (sql.startsWith('SET LOCAL')) return {rows:[]};
        if (!tx) throw new Error('Query outside transaction');
        if (failOn && sql.includes(failOn)) throw new Error('synthetic SQL failure');
        if (sql.startsWith('SELECT id, name, currency, balance')) return { rows: tx.players[args[0]] ? [tx.players[args[0]]] : [] };
        if (sql.startsWith('SELECT state FROM blackjack_tables')) return { rows: tx.tables[args[0]] ? [{ state: tx.tables[args[0]] }] : [] };
        if (sql.startsWith('INSERT INTO blackjack_tables')) { tx.tables[args[0]] = args[1]; return { rows: [] }; }
        if (sql.startsWith('UPDATE players SET balance')) { tx.players[args[1]].balance = String(args[0]); return { rows: [] }; }
        if (sql.startsWith('INSERT INTO transactions')) { tx.transactions.push(args); return { rows: [] }; }
        if (sql.startsWith('INSERT INTO native_presentations')) {
          tx.presentations[args[0]] = { request_id: args[1], version: args[2], payload: args[3] };
          return { rows: [] };
        }
        if (sql.startsWith('SELECT payload FROM native_presentations')) {
          const row = tx.presentations[args[0]];
          return { rows: row && row.request_id === args[1] && row.version === args[2] ? [{ payload: row.payload }] : [] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
      release() { store.releases++; },
    };
  } };
  return { pool, store };
}

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
