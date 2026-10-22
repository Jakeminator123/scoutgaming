// Real PostgreSQL acceptance, invoked only by the existing owned-loopback QA
// harness after product-schema.sql + 008 + 009. No DDL or connection discovery.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createPostgresStore } from '../packages/storage/server/postgres-store.mjs';
import { createStudioRepository } from '../packages/studio-registry/server/document-repository.mjs';
import { canonicalStudioJson } from '../packages/studio-registry/server/document-contract.mjs';
import { createPostgresTableStore } from '../services/game/games/blackjack/table/postgres-store.mjs';
import { createTableCoordinator } from '../services/game/games/blackjack/table/coordinator.mjs';
import { createSharedCommandAuth } from '../services/game/storage/shared-command-auth.mjs';
import { projectSharedRoomCommandResult } from '../services/game/shared-room-command-contract.mjs';
import { DEFAULT_CONFIG } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const observe = promise => { promise.catch(() => {}); return promise; };
async function bounded(promise, message, timeout = 5000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeout);
    })]);
  } finally { clearTimeout(timer); }
}

// Synchronization depends on PostgreSQL's observed lock wait, not elapsed time.
// The harness pool's spare connection only observes the two participants.
async function blockedBy(pool, waiter, blocker, expectedQuery) {
  const deadline = Date.now() + 2000;
  do {
    const row = (await pool.query(`SELECT query,wait_event_type,pg_blocking_pids(pid) AS blockers,
      EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND NOT granted) AS waiting_lock
      FROM pg_stat_activity WHERE pid=$1`, [waiter])).rows[0];
    if (row?.wait_event_type === 'Lock' && row.waiting_lock && row.blockers.includes(blocker)) {
      assert.match(row.query, expectedQuery, 'the expected protected row is the blocking point');
      return;
    }
    await delay(10);
  } while (Date.now() < deadline);
  assert.fail(`PID ${waiter} did not wait for PID ${blocker}`);
}

async function advisoryLocks(pool, pid, { classId, objectId, subId }) {
  return (await pool.query(`SELECT mode,granted FROM pg_locks
    WHERE pid=$1 AND locktype='advisory' AND classid=$2::oid AND objid=$3::oid AND objsubid=$4`,
  [pid, classId, objectId, subId])).rows;
}

function tracedPool(pool, onConnect) {
  const trace = [];
  return {
    trace,
    adapter: {
      async connect() {
        const client = await pool.connect(), pid = client.processID;
        trace.push({ kind: 'connect', pid });
        onConnect?.(pid);
        return {
          query(sql, values) { trace.push({ kind: 'sql', pid, sql }); return client.query(sql, values); },
          release(error) { trace.push({ kind: 'release', pid }); client.release(error); },
        };
      },
      query(sql, values) { trace.push({ kind: 'pool', sql }); return pool.query(sql, values); },
    },
  };
}

function assertSingleTransaction(trace, { committed = true, admitted = true } = {}) {
  const sql = trace.filter(row => row.kind === 'sql'), connections = trace.filter(row => row.kind === 'connect');
  assert.equal(connections.length, 1, 'all command, authority and snapshot work uses one checked-out client');
  assert.ok(sql.every(row => row.pid === connections[0].pid));
  assert.equal(trace.filter(row => row.kind === 'pool').length, 0, 'no raw pool query escapes the unit');
  assert.equal(sql.filter(row => row.sql === 'BEGIN').length, 1);
  assert.equal(sql.filter(row => row.sql === 'COMMIT').length, committed ? 1 : 0);
  assert.equal(sql.filter(row => row.sql === 'ROLLBACK').length, committed ? 0 : 1);
  const sessionLock = sql.findIndex(row => /FROM croupier_game\.player_sessions\b/.test(row.sql) && /FOR SHARE/.test(row.sql));
  const receipt = sql.findIndex(row => /FROM croupier_game\.shared_table_receipts\b/.test(row.sql));
  if (admitted) assert.ok(sessionLock >= 0 && receipt > sessionLock, 'locked session authority precedes receipt/replay access');
  else assert.equal(receipt, -1, 'rejected authority cannot read an existing receipt');
}

export async function runPostgresSharedCommandChecks({ pool, createPool }) {
  assert.equal(typeof createPool, 'function');
  const targetSql = 'SELECT current_user AS role,current_database() AS database,inet_server_addr()::text AS address,inet_server_port() AS port';
  const target = (await pool.query(targetSql)).rows[0];
  assert.equal(target.role, 'studio_qa'); assert.equal(target.database, 'postgres');
  assert.ok(['127.0.0.1', '127.0.0.1/32'].includes(target.address), 'requires the existing owned-loopback QA cluster');
  const checks = [], secondPool = createPool();
  assert.deepEqual((await secondPool.query(targetSql)).rows[0], target, 'both participants use the same isolated cluster');
  const check = async (name, work) => { await work(); checks.push(name); console.log(`ok - ${name}`); };

  async function fixture() {
    const id = randomUUID(), actorId = `command-${id}`, roomId = `command_${id.replaceAll('-', '')}`;
    const scope = { environment: 'test', workspaceId: `command-${id}` };
    const digest = createHash('sha256').update(`synthetic-session:${id}`).digest('hex');
    const sessionId = `player-${digest}`, salt = `synthetic-salt:${id}`, hash = `synthetic-hash:${id}`;
    const fingerprint = createHash('sha256').update(`${salt}:${hash}`).digest('hex');
    const time = 100000, expires = time + 3600000;
    await pool.query('INSERT INTO croupier_game.players(id,name,balance,created_at) VALUES($1,$2,$3,$4)',
      [actorId, 'Synthetic shared-command player', 1000, '2026-10-22T00:00:00.000Z']);
    const userId = String((await pool.query(`INSERT INTO croupier_auth.users(username,salt,hash,created_at)
      VALUES($1,$2,$3,$4) RETURNING id`, [`command-${id}`, salt, hash, '2026-10-22T00:00:00.000Z'])).rows[0].id);
    await pool.query('INSERT INTO croupier_auth.bo_auth_epochs(user_id,epoch) VALUES($1,0)', [userId]);
    await pool.query('INSERT INTO croupier_game.craig_player_links(craig_user_id,player_id) VALUES($1,$2)', [userId, actorId]);
    await pool.query(`INSERT INTO croupier_game.player_sessions(digest,player_id,expires,source_stamp,display_name)
      VALUES($1,$2,$3,$4,$5)`, [digest, actorId, expires, `bo:0:${fingerprint}`, 'Synthetic player']);
    const traced = tracedPool(pool), storage = createPostgresStore({ pool: traced.adapter });
    // Construction and sharedTransaction take only G/S; no Studio table is read.
    const repository = createStudioRepository({ pool: traced.adapter, scope });
    const store = createPostgresTableStore({ pool: storage.gamePool, walletMode: 'demo' });
    const auth = createSharedCommandAuth({ db: storage.db, boDb: storage.boDb, scope, now: () => time });
    const capture = () => storage.db.prepare('SELECT pg_backend_pid() AS pid,txid_current()::text AS txid').get();
    const admissions = [];
    const coordinator = createTableCoordinator({ store, clock: { now: () => time }, random: deterministicRandom(id),
      async authorizeCommand(_tx, request) {
        const authority = request.authority;
        assert.equal(request.actorId, actorId);
        const binding = await auth.bindingById(authority.sessionId, { actorId: request.actorId });
        if (!binding) return false;
        assert.deepEqual(binding, { actorId, sessionId, expiresAt: expires, partnerKeyId: null });
        const current = await capture();
        assert.deepEqual(current, authority.transaction, 'authority is inside the command transaction');
        admissions.push({ commandId: request.commandId, ...current });
        return true;
      },
    });
    await store.config.publish(roomId, 'v1', structuredClone(DEFAULT_CONFIG));
    let sequence = 0;
    const input = (op, fields = {}) => ({ roomId, commandId: `command-${++sequence}`, op, ...fields });
    async function invoke(command, { onStarted, afterMutation } = {}) {
      const start = traced.trace.length;
      const authority = { sessionId };
      try {
        const result = await repository.sharedTransaction(async () => {
          authority.transaction = await capture();
          assert.deepEqual(await storage.boDb.prepare('SELECT pg_backend_pid() AS pid,txid_current()::text AS txid').get(),
            authority.transaction, 'both schemas share the same PostgreSQL transaction');
          await onStarted?.(authority.transaction);
          const response = await coordinator.command({ actorId, authority }, command);
          await afterMutation?.(response);
          return { ...response, result: projectSharedRoomCommandResult(response.result) };
        }, { serialize: true });
        return { response: result, trace: traced.trace.slice(start), transaction: authority.transaction };
      } catch (error) {
        error.commandTrace = traced.trace.slice(start);
        throw error;
      }
    }
    const join = () => invoke(input('join', { seats: [0], seatGens: { 0: 0 }, memberGen: 0 }));
    async function durable() {
      const queries = {
        balance: ['SELECT balance::text AS balance,wallet_gen::text AS wallet_gen FROM croupier_game.players WHERE id=$1', [actorId]],
        ledger: ['SELECT id,type,amount::text AS amount,source_key,source_fingerprint FROM croupier_game.transactions WHERE player_id=$1 ORDER BY id', [actorId]],
        reservations: ['SELECT * FROM croupier_game.shared_wallet_reservations WHERE player_id=$1 ORDER BY reservation_id', [actorId]],
        receipts: ['SELECT command_id,body FROM croupier_game.shared_table_receipts WHERE room_id=$1 AND player_id=$2 ORDER BY command_id', [roomId, actorId]],
        room: ['SELECT body FROM croupier_game.shared_table_rooms WHERE room_id=$1', [roomId]],
        members: ['SELECT player_id,active,body FROM croupier_game.shared_table_members WHERE room_id=$1 ORDER BY player_id', [roomId]],
        presence: ['SELECT player_id,seen FROM croupier_game.shared_table_presence WHERE room_id=$1 ORDER BY player_id', [roomId]],
        audit: ['SELECT seq,body FROM croupier_game.shared_table_audit WHERE room_id=$1 ORDER BY seq', [roomId]],
        outbox: ['SELECT ver,body,status FROM croupier_game.shared_table_outbox WHERE room_id=$1 ORDER BY ver', [roomId]],
      };
      const result = {};
      for (const [key, [sql, values]] of Object.entries(queries)) result[key] = (await pool.query(sql, values)).rows;
      return result;
    }
    return { actorId, roomId, userId, digest, scope, store, storage, invoke, input, join, durable, admissions };
  }

  await check('shared-command-real-pg-one-transaction-auth-before-receipt-and-replay', async () => {
    const h = await fixture(), joined = await h.join();
    assertSingleTransaction(joined.trace);
    const command = h.input('refill'), first = await h.invoke(command);
    assertSingleTransaction(first.trace);
    assert.equal(first.response.replay, false);
    assert.equal(first.response.result.op, 'refill');
    assert.equal(Object.hasOwn(first.response.result, 'ledgerId'), false);
    const before = await h.durable();
    assert.equal(Number(before.balance[0].balance), 2000); assert.equal(before.ledger.length, 1);
    const replay = await h.invoke(command);
    assertSingleTransaction(replay.trace);
    assert.equal(replay.response.replay, true);
    assert.deepEqual(replay.response.result, first.response.result);
    assert.deepEqual(await h.durable(), before);
    assert.equal(h.admissions.filter(row => row.commandId === command.commandId).length, 2);
  });

  await check('shared-command-real-pg-projection-and-response-failures-roll-back-wallet-receipt-and-state', async () => {
    const h = await fixture(); await h.join();
    for (const mode of ['projection', 'response']) {
      const before = await h.durable(), expected = new Error('synthetic response serialization failure');
      let mutationObserved = false;
      await assert.rejects(h.invoke(h.input('refill'), { async afterMutation(response) {
        const row = await h.storage.db.prepare('SELECT balance FROM players WHERE id=?').get(h.actorId);
        assert.equal(row.balance, 2000, 'the real wallet update has occurred before failure');
        assert.equal(response.replay, false); mutationObserved = true;
        if (mode === 'projection') projectSharedRoomCommandResult({ ...response.result, version: -1 });
        throw expected;
      } }), error => {
        if (mode === 'projection') assert.equal(error.code, 'shared_room_invalid_result');
        else assert.equal(error, expected);
        assertSingleTransaction(error.commandTrace, { committed: false });
        return true;
      });
      assert.equal(mutationObserved, true);
      assert.deepEqual(await h.durable(), before, `${mode} failure leaves no financial, receipt, room or presentation changes`);
    }
  });

  await check('shared-command-real-pg-session-delete-waits-until-commit-and-blocks-replay', async () => {
    const h = await fixture(); await h.join();
    const writer = await secondPool.connect(), held = deferred(), release = deferred();
    let active = false, pending, deleting, deleteFinished = false, transaction;
    const command = h.input('refill');
    try {
      await writer.query('BEGIN'); active = true;
      await writer.query("SET LOCAL lock_timeout='8000ms'; SET LOCAL statement_timeout='12000ms'");
      pending = observe(h.invoke(command, {
        onStarted: current => { transaction = current; },
        // The coordinator, presence write, snapshot and inner savepoint have
        // finished. Only the outer projection/COMMIT still waits here.
        async afterMutation() { held.resolve(); await release.promise; },
      }));
      await bounded(Promise.race([held.promise, pending.then(() => assert.fail('pre-commit gate was not reached'))]), 'pre-commit gate timeout');
      deleting = observe(writer.query('DELETE FROM croupier_game.player_sessions WHERE digest=$1', [h.digest])
        .then(result => { deleteFinished = true; return result; }));
      await blockedBy(pool, writer.processID, transaction.pid, /DELETE FROM croupier_game\.player_sessions/);
      assert.equal(deleteFinished, false, 'FOR SHARE holds the session until the outer commit');
      release.resolve();
      const accepted = await bounded(pending, 'command commit timeout'); assertSingleTransaction(accepted.trace);
      assert.equal((await bounded(deleting, 'session deletion timeout')).rowCount, 1);
      await writer.query('COMMIT'); active = false;
      const before = await h.durable();
      assert.equal(Number(before.balance[0].balance), 2000); assert.equal(before.ledger.length, 1);
      await assert.rejects(h.invoke(command), error => {
        assert.equal(error.code, 'AUTHORITY_REJECTED');
        assertSingleTransaction(error.commandTrace, { committed: false, admitted: false });
        return true;
      });
      assert.deepEqual(await h.durable(), before, 'revoked replay cannot return its old receipt or change wallet/state');
    } finally {
      release.resolve();
      await pending?.catch(() => {}); await deleting?.catch(() => {});
      if (active) await writer.query('ROLLBACK').catch(() => {});
      writer.release();
    }
  });

  for (const revoke of ['credential', 'epoch', 'status']) {
    await check(`shared-command-real-pg-${revoke}-revocation-while-command-waits-rejects-before-receipt`, async () => {
      const h = await fixture(); await h.join();
      const before = await h.durable(), writer = await secondPool.connect(), started = deferred();
      let active = false, pending;
      try {
        await writer.query('BEGIN'); active = true;
        await writer.query("SET LOCAL lock_timeout='8000ms'; SET LOCAL statement_timeout='12000ms'");
        if (revoke === 'credential') await writer.query('UPDATE croupier_auth.users SET hash=$2 WHERE id=$1', [h.userId, `rotated-${randomUUID()}`]);
        else if (revoke === 'epoch') await writer.query('UPDATE croupier_auth.bo_auth_epochs SET epoch=epoch+1 WHERE user_id=$1', [h.userId]);
        else await writer.query("UPDATE croupier_game.players SET status='blocked' WHERE id=$1", [h.actorId]);
        // The uncommitted revocation owns the row. The command must wait, then
        // validate the committed value rather than reuse its initial identity.
        pending = observe(h.invoke(h.input('refill'), { onStarted: transaction => started.resolve(transaction) }));
        const transaction = await bounded(Promise.race([started.promise, pending.then(() => assert.fail('transaction did not start'))]), 'command start timeout');
        const waitingQuery = revoke === 'credential' ? /FROM croupier_auth\.users\b.*FOR SHARE/
          : revoke === 'epoch' ? /FROM croupier_auth\.bo_auth_epochs\b.*FOR SHARE/
            : /FROM croupier_game\.players\b.*FOR UPDATE/;
        await blockedBy(pool, transaction.pid, writer.processID, waitingQuery);
        await writer.query('COMMIT'); active = false;
        await assert.rejects(bounded(pending, 'revoked command timeout'), error => {
          assert.equal(error.code, 'AUTHORITY_REJECTED');
          assertSingleTransaction(error.commandTrace, { committed: false, admitted: false });
          return true;
        });
        // The existing status trigger intentionally advances wallet_gen once;
        // the denied command must add no further wallet/state/receipt effect.
        if (revoke === 'status') before.balance[0].wallet_gen = String(BigInt(before.balance[0].wallet_gen) + 1n);
        assert.deepEqual(await h.durable(), before, 'only the intentional auth/status revocation commits');
      } finally {
        if (active) await writer.query('ROLLBACK').catch(() => {});
        await pending?.catch(() => {});
        writer.release();
      }
    });
  }

  for (const kind of ['G', 'S']) {
    await check(`shared-command-real-pg-${kind}-lock-blocks-competing-scope-publication-until-commit`, async () => {
      const h = await fixture(); await h.join();
      const held = deferred(), release = deferred(), connected = deferred();
      const scopeHash = createHash('sha256').update(`croupier-studio\0${canonicalStudioJson(h.scope)}`).digest();
      // pg_locks exposes the unsigned bit patterns of the two int32 keys.
      const key = kind === 'G' ? { classId: 0, objectId: 1129467984, subId: 1 }
        : { classId: scopeHash.readUInt32BE(0), objectId: scopeHash.readUInt32BE(4), subId: 2 };
      const otherTrace = tracedPool(secondPool, pid => connected.resolve(pid));
      const otherStorage = createPostgresStore({ pool: otherTrace.adapter });
      const otherRepository = createStudioRepository({ pool: otherTrace.adapter, scope: h.scope });
      const otherTable = createPostgresTableStore({ pool: otherStorage.gamePool, walletMode: 'demo' });
      let holder, pending, publishing, enteredPublisher = false, published = false;
      try {
        pending = observe(h.invoke(h.input('refill'), {
          onStarted: transaction => { holder = transaction; },
          async afterMutation() { held.resolve(); await release.promise; },
        }));
        await bounded(Promise.race([held.promise, pending.then(() => assert.fail('pre-commit gate not reached'))]), 'G/S holder timeout');
        assert.deepEqual(await advisoryLocks(pool, holder.pid, key), [{ mode: 'ExclusiveLock', granted: true }],
          `the command owns the actual ${kind} advisory lock before commit`);
        publishing = observe(otherRepository.sharedTransaction(async () => {
          enteredPublisher = true;
          await otherTable.config.publish(h.roomId, 'v2', structuredClone(DEFAULT_CONFIG));
          published = true;
        }, { serialize: kind === 'G' }));
        const waiter = await bounded(Promise.race([connected.promise, publishing.then(() => assert.fail('publisher did not connect'))]), 'G/S publisher timeout');
        const lockQuery = kind === 'G' ? /pg_advisory_xact_lock\(1129467984\)/
          : /pg_advisory_xact_lock\(\$1::integer, \$2::integer\)/;
        await blockedBy(pool, waiter, holder.pid, lockQuery);
        assert.deepEqual(await advisoryLocks(pool, waiter, key), [{ mode: 'ExclusiveLock', granted: false }],
          `the publisher waits for the exact ${kind} lock, not an unrelated row`);
        assert.equal(enteredPublisher, false); assert.equal(published, false);
        assert.equal((await pool.query('SELECT version FROM croupier_game.shared_table_config_heads WHERE room_id=$1', [h.roomId])).rows[0].version, 'v1');
        release.resolve();
        assertSingleTransaction((await bounded(pending, 'G/S holder commit timeout')).trace);
        await bounded(publishing, 'G/S publisher completion timeout');
        assert.equal(published, true);
        assert.equal((await pool.query('SELECT version FROM croupier_game.shared_table_config_heads WHERE room_id=$1', [h.roomId])).rows[0].version, 'v2');
        assert.deepEqual(await advisoryLocks(pool, holder.pid, key), [], 'outer commit releases its transaction advisory lock');
      } finally {
        release.resolve();
        await pending?.catch(() => {}); await publishing?.catch(() => {});
      }
    });
  }
  // createPool belongs to the harness, which closes all pools and its cluster.
  return { pool, checks };
}
