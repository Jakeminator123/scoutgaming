// Transactional stand-in for the native table's PostgreSQL driver contract. It never
// connects to Neon or reads local product databases; failures discard every write in the command.
export function fakeNativeTablePool({ state, failOn = '' } = {}) {
  const store = { state: { players: {}, tables: {}, transactions: [], presentations: {}, ...state }, queries: [], releases: 0 };
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
