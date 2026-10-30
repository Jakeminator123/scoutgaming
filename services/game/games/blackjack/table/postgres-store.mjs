import { createHash } from 'node:crypto';
import { sharedPostgresTransaction, sharedPostgresClient, poisonSharedPostgresTransaction, runPostgresTransactionOwner } from '../../../../../packages/storage/server/postgres-transaction-context.mjs';
import { GENESIS, chainRow, verifyChain } from './audit-chain.mjs';
import { LockSetExceeded, fingerprint } from './ports.mjs';
import { createPostgresTableWallet } from './postgres-wallet.mjs';

const schema = 'croupier_game';
const sorted = ids => [...new Set(ids)].sort();
const safeNumber = value => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('Unsafe stored integer');
  return n;
};
const first = async (client, sql, args = []) => (await client.query(sql, args)).rows[0] ?? null;
const decode = row => row ? JSON.parse(row.body) : null;
const body = async (client, sql, args = []) => decode(await first(client, sql, args));
const lockId = (kind, id) => {
  const bytes = createHash('sha256').update(`croupier-shared-table\0${kind}\0${id}`).digest();
  return [bytes.readInt32BE(0), bytes.readInt32BE(4)];
};
const advisory = (client, kind, id) => client.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)', lockId(kind, id));

// A raw application-owned pg pool is required. This adapter never opens a second
// client inside a unit of work, installs schemas, or selects a SQLite fallback.
export function createPostgresTableStore({ pool, walletMode, lockTimeoutMs = 5000, statementTimeoutMs = 15000 } = {}) {
  if (walletMode !== 'demo') throw new Error('Shared PostgreSQL tables require the explicit demo wallet');
  if (!pool?.connect || !pool?.query) throw new TypeError('PostgreSQL pool required');
  for (const timeout of [lockTimeoutMs, statementTimeoutMs]) if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60000) throw new TypeError('Invalid SQL timeout');
  // Use transaction-local server timeouts for every query, including poll reads,
  // presence and outbox delivery. A caller-owned pool need not set query_timeout.
  // Locked work keeps this same client throughout; no nested pool checkout.
  async function transaction(work, lockPlan) {
    const shared = sharedPostgresTransaction(pool);
    if (shared) {
      if (shared.readOnly) throw poisonSharedPostgresTransaction(new Error('Shared table transaction must be writable'), shared);
      const before = shared.tablePlan ?? null;
      if (lockPlan && (lockPlan.global && !shared.serialize
        || before && (lockPlan.global && !before.global || lockPlan.rooms.some(id => !before.rooms.includes(id))
          || lockPlan.players.some(id => !before.players.includes(id))))) {
        throw poisonSharedPostgresTransaction(new Error('Shared table lock escalation'), shared);
      }
      const client = sharedPostgresClient(pool);
      if (!lockPlan) {
        try { return await work(client); }
        catch (error) { throw poisonSharedPostgresTransaction(error, shared); }
      }
      const savepoint = 'shared_table_unit_' + (shared.tableSavepointSeq = (shared.tableSavepointSeq ?? 0) + 1);
      await client.query('SAVEPOINT ' + savepoint);
      let attemptOpen = true;
      const attemptClient = Object.freeze({ query(sql, values) {
        if (!attemptOpen) throw poisonSharedPostgresTransaction(new Error('Shared table attempt is closed'), shared);
        return client.query(sql, values);
      } });
      try {
        const value = await work(attemptClient);
        if (shared.failed) throw shared.failed;
        attemptOpen = false;
        await client.query('RELEASE SAVEPOINT ' + savepoint);
        return value;
      } catch (error) {
        attemptOpen = false;
        // Only a declared lock-plan retry may recover inside the outer S unit.
        // Rollback releases this attempt's R/P/A locks, while S remains held.
        let rollbackError;
        try {
          await shared.client.query('ROLLBACK TO SAVEPOINT ' + savepoint);
          await shared.client.query('RELEASE SAVEPOINT ' + savepoint);
        } catch (failure) { rollbackError = failure; }
        shared.tablePlan = before;
        if (rollbackError) throw poisonSharedPostgresTransaction(rollbackError, shared);
        if (!(error instanceof LockSetExceeded)) poisonSharedPostgresTransaction(error, shared);
        throw error;
      } finally { attemptOpen = false; }
    }
    const client = await pool.connect();
    let releaseError;
    const owner = { pool, client, failed: null, closed: false };
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('lock_timeout',$1,true),set_config('statement_timeout',$2,true)", [`${lockTimeoutMs}ms`, `${statementTimeoutMs}ms`]);
      const value = await runPostgresTransactionOwner(owner, () => work(client));
      if (owner.failed) throw owner.failed;
      const result = await client.query('COMMIT');
      if (result.command === 'ROLLBACK') throw new Error('PostgreSQL transaction rolled back');
      return value;
    } catch (error) {
      try { await client.query('ROLLBACK'); }
      catch (rollbackError) { releaseError = rollbackError; }
      throw error; // Preserve SQL/infrastructure errors; never turn them into wallet refusals.
    } finally {
      owner.closed = true;
      // A connection that could not roll back must not re-enter the pool.
      client.release(releaseError);
    }
  }
  const queryClient = { query: (sql, args) => transaction(client => client.query(sql, args)) };
  const readRoom = (client, id) => body(client, `SELECT body FROM ${schema}.shared_table_rooms WHERE room_id=$1`, [id]);
  const members = async (client, id) => (await client.query(`SELECT body FROM ${schema}.shared_table_members WHERE room_id=$1 ORDER BY player_id`, [id])).rows.map(decode);
  const memberRooms = async (client, id) => (await client.query(`SELECT room_id FROM ${schema}.shared_table_members WHERE player_id=$1 AND active ORDER BY room_id`, [id])).rows.map(r => r.room_id);
  const presence = async (client, room, player) => {
    const row = await first(client, `SELECT seen FROM ${schema}.shared_table_presence WHERE room_id=$1 AND player_id=$2`, [room, player]);
    return row ? safeNumber(row.seen) : null;
  };
  const readTick = (client, id) => body(client, `SELECT body FROM ${schema}.shared_table_ticks WHERE tick_id=$1`, [id]);
  const configHead = async (client, room) => {
    const row = await first(client, `SELECT version FROM ${schema}.shared_table_config_heads WHERE room_id=$1`, [room]);
    if (!row) throw new Error('No published table configuration');
    return row.version;
  };
  const frozenConfig = async (client, room, version) => {
    const value = await body(client, `SELECT body FROM ${schema}.shared_table_configs WHERE room_id=$1 AND version=$2`, [room, version]);
    if (!value) throw new Error('Published table configuration is missing');
    return value;
  };
  const pausedUntil = async (client, id) => safeNumber((await first(client, `SELECT until_ms FROM ${schema}.shared_table_pauses WHERE player_id=$1`, [id]))?.until_ms ?? 0);
  // Read-only wallet operations do not acquire or mutate anything. Mutating port
  // operations are only exposed on tx, whose declared P locks have been taken.
  const readWallet = () => createPostgresTableWallet({ client: queryClient, assertPlayer() {}, assertRoom() {} });

  async function runLocked(input, work) {
    let plan;
    try {
      if (!input || !Array.isArray(input.rooms) || !Array.isArray(input.players)) throw new TypeError('Declared lock plan required');
      plan = { global: Boolean(input.global), rooms: sorted(input.rooms), players: sorted(input.players) };
      if ([...plan.rooms, ...plan.players].some(id => typeof id !== 'string' || !id)) throw new TypeError('Invalid lock identity');
    } catch (error) { throw poisonSharedPostgresTransaction(error); }
    return transaction(async client => {
      // In a shared unit S (and optional G) already precedes these locks.
      const shared = sharedPostgresTransaction(pool);
      if (!shared?.tablePlan) {
        if (plan.global && !shared) await client.query('SELECT pg_advisory_xact_lock(1129467984)');
        for (const id of plan.rooms) await advisory(client, 'room', id);
        for (const id of plan.players) {
          const row = await first(client, `SELECT id FROM ${schema}.players WHERE id=$1 FOR UPDATE`, [id]);
          if (!row) throw new Error('Authenticated player no longer exists');
        }
        await advisory(client, 'audit', 'global');
        if (shared) shared.tablePlan = plan;
      }
      const assertRoom = id => { if (!plan.rooms.includes(id)) throw new LockSetExceeded({ rooms: [id] }); };
      const assertPlayer = id => { if (!plan.players.includes(id)) throw new LockSetExceeded({ players: [id] }); };
      const wallet = createPostgresTableWallet({ client, assertPlayer, assertRoom });
      let savepointCounter = 0;
      const savepoints = new Set();
      const tx = {
        async publishConfig(room, version, value) {
          assertRoom(room);
          const prior = await body(client, `SELECT body FROM ${schema}.shared_table_configs WHERE room_id=$1 AND version=$2`, [room, version]);
          if (prior && fingerprint(prior) !== fingerprint(value)) throw new Error('Published configuration is immutable');
          if (!prior) await client.query(`INSERT INTO ${schema}.shared_table_configs(room_id,version,body) VALUES($1,$2,$3)`, [room, version, value]);
          await client.query(`INSERT INTO ${schema}.shared_table_config_heads(room_id,version) VALUES($1,$2) ON CONFLICT(room_id) DO UPDATE SET version=EXCLUDED.version`, [room, version]);
        },
        async savepoint() {
          const name = `shared_table_${++savepointCounter}`;
          await client.query(`SAVEPOINT ${name}`); savepoints.add(name); return name;
        },
        async rollbackTo(name) {
          if (!savepoints.has(name)) throw new Error('Unknown savepoint');
          await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
        },
        rooms: {
          read: id => { assertRoom(id); return readRoom(client, id); },
          async write(id, state) {
            assertRoom(id);
            if (state.roomId !== id) throw new Error('Room state identity mismatch');
            // Protect currency/account lifecycle while a consumed stake is in a
            // live hand. This helper verifies every changed player's P lock.
            await wallet.syncHands(id, state.phase === 'round' ? sorted(state.owners.filter((p, i) => p && Object.values(state.bets[i]).reduce((a, b) => a + b, 0) > 0)) : []);
            await client.query(`INSERT INTO ${schema}.shared_table_rooms(room_id,body) VALUES($1,$2) ON CONFLICT(room_id) DO UPDATE SET body=EXCLUDED.body`, [id, state]);
          },
        },
        members: {
          get: (room, player) => { assertRoom(room); return body(client, `SELECT body FROM ${schema}.shared_table_members WHERE room_id=$1 AND player_id=$2`, [room, player]); },
          list: room => { assertRoom(room); return members(client, room); },
          async put(room, member) {
            assertRoom(room); assertPlayer(member.actorId);
            const value = { ...member, roomId: room };
            await client.query(`INSERT INTO ${schema}.shared_table_members(room_id,player_id,active,body) VALUES($1,$2,$3,$4) ON CONFLICT(room_id,player_id) DO UPDATE SET active=EXCLUDED.active,body=EXCLUDED.body`, [room, member.actorId, member.active, value]);
          },
          roomsOf: player => { assertPlayer(player); return memberRooms(client, player); },
        },
        presence: { get: (room, player) => { assertRoom(room); return presence(client, room, player); } },
        receipts: {
          get: key => { assertRoom(key.roomId); return body(client, `SELECT body FROM ${schema}.shared_table_receipts WHERE room_id=$1 AND player_id=$2 AND command_id=$3`, [key.roomId, key.actorId, key.commandId]); },
          async put(key, value) {
            assertRoom(key.roomId); assertPlayer(key.actorId);
            await client.query(`INSERT INTO ${schema}.shared_table_receipts(room_id,player_id,command_id,body) VALUES($1,$2,$3,$4)`, [key.roomId, key.actorId, key.commandId, value]);
          },
        },
        ticks: {
          async get(id) { const value = await readTick(client, id); if (value) assertRoom(value.room); return value; },
          async put(value) { assertRoom(value.room); await client.query(`INSERT INTO ${schema}.shared_table_ticks(tick_id,room_id,body) VALUES($1,$2,$3)`, [value.tickId, value.room, value]); },
        },
        pause: {
          get: player => { assertPlayer(player); return pausedUntil(client, player); },
          async extend(player, until) {
            assertPlayer(player); safeNumber(until);
            return safeNumber((await first(client, `INSERT INTO ${schema}.shared_table_pauses(player_id,until_ms) VALUES($1,$2) ON CONFLICT(player_id) DO UPDATE SET until_ms=GREATEST(shared_table_pauses.until_ms,EXCLUDED.until_ms) RETURNING until_ms`, [player, until])).until_ms);
          },
        },
        wallet,
        audit: {
          async append(value) {
            assertRoom(value.room);
            const head = await first(client, `SELECT seq,body FROM ${schema}.shared_table_audit ORDER BY seq DESC LIMIT 1`);
            const row = { seq: safeNumber(head?.seq ?? 0) + 1, ...chainRow(decode(head)?.hash ?? GENESIS, value) };
            await client.query(`INSERT INTO ${schema}.shared_table_audit(seq,room_id,body) VALUES($1,$2,$3)`, [row.seq, value.room, row]);
            return { seq: row.seq, hash: row.hash };
          },
          async openShoe(value) { assertRoom(value.room); await client.query(`INSERT INTO ${schema}.shared_table_shoes(shoe_id,room_id,body) VALUES($1,$2,$3)`, [value.shoeId, value.room, value]); },
          async closeShoe(value) {
            assertRoom(value.room);
            const prior = await body(client, `SELECT body FROM ${schema}.shared_table_shoes WHERE shoe_id=$1 AND room_id=$2`, [value.shoeId, value.room]);
            const result = await client.query(`UPDATE ${schema}.shared_table_shoes SET body=$3 WHERE shoe_id=$1 AND room_id=$2`, [value.shoeId, value.room, JSON.stringify({ ...prior, ...value })]);
            if (result.rowCount !== 1) throw new Error('Shoe commitment is missing');
          },
          async shoe(id) { const row = await first(client, `SELECT room_id,body FROM ${schema}.shared_table_shoes WHERE shoe_id=$1`, [id]); if (row) assertRoom(row.room_id); return decode(row); },
          async engineDraws(room, shoeId) {
            assertRoom(room);
            const rows = (await client.query(`SELECT body FROM ${schema}.shared_table_audit WHERE room_id=$1 AND body::jsonb->>'type' LIKE 'engine.%' ORDER BY seq`, [room])).rows;
            return rows.map(r => JSON.parse(decode(r).payload)).filter(p => p.shoeId === shoeId).flatMap(p => p.draws ?? []);
          },
        },
        outbox: { async put(value) { assertRoom(value.roomId); await client.query(`INSERT INTO ${schema}.shared_table_outbox(room_id,ver,body) VALUES($1,$2,$3)`, [value.roomId, value.ver, value]); } },
        config: {
          async latest(room) {
            assertRoom(room);
            return configHead(client, room);
          },
          async frozen(room, version) {
            assertRoom(room);
            return frozenConfig(client, room, version);
          },
        },
      };
      return work(tx);
    }, plan);
  }

  return {
    runLocked,
    async assertInstalled() {
      const tables = ['rooms','members','presence','receipts','ticks','pauses','configs','config_heads','audit','shoes','outbox','delivery'];
      const names = [...tables.map(name => 'croupier_game.shared_table_' + name), 'croupier_game.shared_wallet_reservations','croupier_game.shared_wallet_hands'];
      const missing = (await queryClient.query('SELECT name FROM unnest($1::text[]) AS name WHERE to_regclass(name) IS NULL', [names])).rows;
      if (missing.length) throw new Error('Shared table PostgreSQL schema is not installed');
      await queryClient.query('SELECT wallet_gen FROM croupier_game.players LIMIT 0');
      await queryClient.query('SELECT source_key,source_fingerprint FROM croupier_game.transactions LIMIT 0');
    },
    read: {
      room: id => readRoom(queryClient, id),
      // Capture the head and its immutable body on one client, including when
      // the caller already holds the shared Studio transaction.
      config: (room, version) => transaction(async client => frozenConfig(client, room, version === undefined ? await configHead(client, room) : version)),
      rooms: async () => (await queryClient.query(`SELECT room_id FROM ${schema}.shared_table_rooms ORDER BY room_id`)).rows.map(r => r.room_id),
      members: id => members(queryClient, id), memberRooms: id => memberRooms(queryClient, id),
      presence: (room, player) => presence(queryClient, room, player), tick: id => readTick(queryClient, id),
      walletGen: id => readWallet().gen(id), reservation: id => readWallet().reservation(id),
      funds: id => readWallet().funds(id), available: id => readWallet().available(id), pausedUntil: id => pausedUntil(queryClient, id),
    },
    presence: { async touch(room, player, at) {
      safeNumber(at);
      await queryClient.query(`INSERT INTO ${schema}.shared_table_presence(room_id,player_id,seen) VALUES($1,$2,$3) ON CONFLICT(room_id,player_id) DO UPDATE SET seen=GREATEST(shared_table_presence.seen,EXCLUDED.seen)`, [room, player, at]);
    } },
    outbox: {
      pending: async () => (await queryClient.query(`SELECT body FROM ${schema}.shared_table_outbox WHERE status='pending' ORDER BY room_id,ver`)).rows.map(decode),
      deliveredVer: async room => safeNumber((await first(queryClient, `SELECT ver FROM ${schema}.shared_table_delivery WHERE room_id=$1`, [room]))?.ver ?? 0),
      async ack(row, status) {
        if (!['delivered','superseded'].includes(status)) throw new Error('Invalid outbox acknowledgement');
        // One SQL statement atomically marks this row and advances the delivery hint.
        await queryClient.query(`WITH acked AS (UPDATE ${schema}.shared_table_outbox SET status=$3 WHERE room_id=$1 AND ver=$2 AND status='pending' RETURNING room_id,ver) INSERT INTO ${schema}.shared_table_delivery(room_id,ver) SELECT room_id,ver FROM acked WHERE $3='delivered' ON CONFLICT(room_id) DO UPDATE SET ver=GREATEST(shared_table_delivery.ver,EXCLUDED.ver)`, [row.roomId, row.ver, status]);
      },
    },
    audit: { async verifyChain(from = 1, to = Number.MAX_SAFE_INTEGER) {
      const rows = (await queryClient.query(`SELECT body FROM ${schema}.shared_table_audit WHERE seq >= $1 AND seq <= $2 ORDER BY seq`, [from, to])).rows.map(decode);
      const previous = from === 1 ? GENESIS : (await body(queryClient, `SELECT body FROM ${schema}.shared_table_audit WHERE seq=$1`, [from - 1]))?.hash;
      if (!previous) throw new Error('Audit predecessor missing');
      return verifyChain(rows, previous);
    } },
    // Trusted publication adapter only: callers must perform existing N1/room
    // grant checks before this port. Commands, join and poll never call it.
    config: { async publish(room, version, value) {
      if (typeof version !== 'string' || !version || !['en','sv'].includes(value.language) || value.betMs !== 20000 || value.actionMs !== 15000) throw new Error('Invalid published demo configuration');
      const frozen = { ...value, configVersion: version };
      await runLocked({ rooms: [room], players: [] }, async tx => {
        // Immutability is enforced by the PK; reuse must have identical content.
        // The query is intentionally on tx's client through a narrow helper below.
        await tx.publishConfig(room, version, frozen);
      });
    } },
  };
}
