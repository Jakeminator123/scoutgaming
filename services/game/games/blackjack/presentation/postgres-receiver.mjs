// K04: durable presentation receiver for the shared-table outbox (sink contract in table/ports.mjs,
// O01 2.9). The version check is one locked check-and-set per room in PostgreSQL, so it holds
// across receivers, processes and restarts: ver > last accepted -> stored ('applied'); exactly the
// last accepted ver with identical content -> 'applied' without a second write; lower -> 'stale'.
// The same ver with different content is a failed delivery (throws), so the row stays pending.
// Nothing here writes game state: the receiver has no port into rooms, wallet, shoe or audit.
// Authenticated transport to viewers (root) and J08 publication read `current(roomId)`.
import { createHash } from 'node:crypto';
import { fingerprint } from '../table/ports.mjs';
import { presentationForRow } from './outbox-presentation.mjs';
import { sharedPostgresTransaction, sharedPostgresClient, poisonSharedPostgresTransaction } from '../../../../../packages/storage/server/postgres-transaction-context.mjs';

const table = 'croupier_game.shared_table_presentation_receiver';
const lockId = id => {
  const bytes = createHash('sha256').update(`croupier-presentation-receiver\0${id}`).digest();
  return [bytes.readInt32BE(0), bytes.readInt32BE(4)];
};

export function createPostgresPresentationReceiver({ pool, lockTimeoutMs = 5000, statementTimeoutMs = 15000 } = {}) {
  if (!pool?.connect || !pool?.query) throw new TypeError('PostgreSQL pool required');
  for (const timeout of [lockTimeoutMs, statementTimeoutMs]) if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60000) throw new TypeError('Invalid SQL timeout');
  // Same transaction discipline as the J07 store: transaction-local timeouts, one client, no nesting.
  async function transaction(work, { readOnly = false } = {}) {
    const client = await pool.connect();
    let releaseError;
    try {
      await client.query(readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
      await client.query("SELECT set_config('lock_timeout',$1,true),set_config('statement_timeout',$2,true)", [`${lockTimeoutMs}ms`, `${statementTimeoutMs}ms`]);
      const value = await work(client);
      const result = await client.query('COMMIT');
      if (result.command === 'ROLLBACK') throw new Error('PostgreSQL transaction rolled back');
      return value;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) { releaseError = rollbackError; }
      throw error;
    } finally { client.release(releaseError); }
  }

  async function sink(row) {
    if (typeof row?.roomId !== 'string' || !row.roomId || !Number.isSafeInteger(row.ver) || row.ver < 1) throw new TypeError('Invalid outbox row');
    const print = fingerprint(row), body = JSON.stringify({ row, presentation: presentationForRow(row) });
    return transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)', lockId(row.roomId));
      const last = (await client.query(`SELECT ver,fingerprint FROM ${table} WHERE room_id=$1`, [row.roomId])).rows[0];
      const lastVer = last ? Number(last.ver) : 0;
      if (row.ver < lastVer) return 'stale';
      if (row.ver === lastVer) {
        if (last.fingerprint !== print) throw new Error('presentation_version_conflict');
        return 'applied'; // ack was lost: acknowledged, not applied twice
      }
      await client.query(`INSERT INTO ${table}(room_id,ver,fingerprint,body) VALUES($1,$2,$3,$4)
        ON CONFLICT(room_id) DO UPDATE SET ver=EXCLUDED.ver,fingerprint=EXCLUDED.fingerprint,body=EXCLUDED.body`, [row.roomId, row.ver, print, body]);
      return 'applied';
    });
  }

  // Reads use the same bounded discipline (review 6328762858 finding 2): one client, a read-only
  // transaction with the transaction-local lock/statement timeouts, never a bare pool.query.
  const read = (sql, args) => transaction(async client => (await client.query(sql, args)).rows[0], { readOnly: true });

  return {
    sink,
    async assertInstalled() {
      if ((await read('SELECT to_regclass($1) AS name', [table])).name === null) throw new Error('Presentation receiver schema is not installed');
    },
    lastAccepted: async roomId => Number((await read(`SELECT ver FROM ${table} WHERE room_id=$1`, [roomId]))?.ver ?? 0),
    // The room's current accepted presentation (reconnect and transport read this; no game read).
    async current(roomId) {
      const value = await read(`SELECT body FROM ${table} WHERE room_id=$1`, [roomId]);
      return value ? JSON.parse(value.body).presentation : null;
    },
    async currentLocked(roomId) {
      const shared = sharedPostgresTransaction(pool);
      if (!shared || !shared.serialize || !shared.tablePlan?.rooms.includes(roomId)) throw poisonSharedPostgresTransaction(new Error('Shared presentation read requires its locked room'), shared);
      const value = (await sharedPostgresClient(pool).query(`SELECT body FROM ${table} WHERE room_id=$1 FOR SHARE`, [roomId])).rows[0];
      try { return value ? JSON.parse(value.body).presentation : null; }
      catch (error) { throw poisonSharedPostgresTransaction(error, shared); }
    },
  };
}
