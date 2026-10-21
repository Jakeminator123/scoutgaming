// Disposable child for the isolated PostgreSQL acceptance harness. No ambient DB config.
import { createRequire } from 'node:module';
import { createTableCoordinator } from '../../services/game/games/blackjack/table/coordinator.mjs';
import { createPostgresTableStore } from '../../services/game/games/blackjack/table/postgres-store.mjs';
import { ledgerKey } from '../../services/game/games/blackjack/table/ports.mjs';
import { deterministicRandom } from './blackjack-deterministic-random.mjs';
const { Pool } = createRequire(new URL('../../services/game/package.json', import.meta.url))('pg');
let pool, store, table, time;
async function handle(message) {
  const { id, op } = message;
  try {
    let result;
    if (op === 'open') {
      if (pool || !Number.isInteger(message.port) || message.port < 1024 || message.port > 65535) throw Error('fixture_target_refused');
      pool = new Pool({ host: '127.0.0.1', port: message.port, user: 'studio_qa', database: 'postgres', max: 2, connectionTimeoutMillis: 5000, query_timeout: 10000 });
      const target = (await pool.query('SELECT current_user AS role, current_database() AS database, inet_server_addr()::text AS address')).rows[0];
      if (target.role !== 'studio_qa' || target.database !== 'postgres' || !['127.0.0.1', '127.0.0.1/32'].includes(target.address)) throw Error('fixture_target_refused');
      store = createPostgresTableStore({ pool, walletMode: 'demo' });
      await store.assertInstalled();
      time = message.time;
      table = createTableCoordinator({ store, clock: { now: () => time }, random: deterministicRandom(`child-${process.pid}`) });
      result = { pid: process.pid };
    } else if (op === 'close') {
      await pool?.end(); pool = null;
      process.send?.({ id, result: 'closed' }, () => process.disconnect());
      return;
    } else {
      if (!table || !Number.isSafeInteger(message.time)) throw Error('fixture_not_open');
      time = message.time;
      if (op === 'abort-uncommitted') {
        await store.runLocked({ global: false, rooms: [message.roomId], players: [message.actorId] }, async tx => {
          await tx.wallet.debit(message.actorId, { amount: 3, kind: 'aborted-process', key: ledgerKey({ namespace: 'command', roomId: message.roomId, actorId: message.actorId, identity: 'aborted-process', playerId: message.actorId, effect: 'aborted-process' }) });
          process.exit(0); // The server must roll back the now-disconnected transaction.
        });
      } else if (op === 'command' || op === 'commit-without-response') {
        result = await table.command({ actorId: message.actorId }, message.input);
        if (op === 'commit-without-response') { await pool.end(); process.exit(0); }
      } else if (op === 'snapshot') result = await table.snapshot(message.roomId, message.actorId);
      else throw Error('fixture_operation_refused');
    }
    process.send?.({ id, result });
  } catch (error) { process.send?.({ id, error: { code: error.code ?? null, message: error.message } }); }
}
if (process.send) {
  // One operation per message; callers await its response before the next request.
  process.on('message', message => { void handle(message); });
  process.on('disconnect', () => { void pool?.end().finally(() => process.exit(0)); });
}
