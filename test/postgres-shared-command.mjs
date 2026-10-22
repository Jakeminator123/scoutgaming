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
import { createPostgresTableRuntime } from '../services/game/games/blackjack/table/postgres-runtime.mjs';
import { createPostgresPresentationReceiver } from '../services/game/games/blackjack/presentation/postgres-receiver.mjs';
import { createSharedRoomPresentationAccess } from '../services/game/shared-room-presentation-access.mjs';
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

  async function fixture({ presentation = false } = {}) {
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
    const publication = { roomId, operatorId: `operator-${id}`, packageRevision: 1 };
    const config = structuredClone(DEFAULT_CONFIG);
    if (presentation) Object.assign(config, publication, { material: {
      revision: 'synthetic-material-v1', dealerId: 'astrid', language: config.language,
      leadMs: config.leadMs, cardMs: config.cardMs, media: [{ id: 'synthetic-video', sha256: 'a'.repeat(64) }],
    } });
    await store.config.publish(roomId, 'v1', config);
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
    return { actorId, roomId, userId, digest, sessionId, expires, scope, store, storage, repository, auth, traced, publication,
      invoke, input, join, durable, admissions };
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
  // Publication admission is injected here; session/provenance, both captures,
  // the coordinator's committed presentation and every SQL lock are real PG.
  for (const change of ['none', 'session', 'material', 'version']) {
    await check(`shared-select-real-pg-unlocked-callback-${change === 'none' ? 'returns-after-revalidation' : change + '-change-rejects-before-response'}`, async () => {
      const h = await fixture({ presentation: true }), joined = await h.join();
      const windowId = joined.response.snapshot.windowId;
      await h.invoke(h.input('bet', { seat: 0, field: 'main', chip: 5, windowId }));
      const ready = await h.invoke(h.input('ready', { windowId }));
      assert.equal(ready.response.result.started, true);
      const runtime = createPostgresTableRuntime({ pool: h.storage.gamePool, walletMode: 'demo', random: deterministicRandom('select-reader') });
      const receiver = createPostgresPresentationReceiver({ pool: h.storage.gamePool });
      const rows = (await pool.query('SELECT body FROM croupier_game.shared_table_outbox WHERE room_id=$1 ORDER BY ver', [h.roomId])).rows;
      assert.equal(rows.length, 1, 'the real ready command committed exactly one plan');
      await receiver.sink(JSON.parse(rows[0].body));
      const presentation = await receiver.current(h.roomId);
      assert.equal(presentation.status, 'ready'); assert.equal(presentation.ver, 1);
      assert.equal(presentation.events.filter(event => event.type === 'speak' && event.line === 'goodluck').length, 1);
      const context = { operatorSlug: 'synthetic-operator', roomId: h.roomId, packageRevision: 1, dealerId: 'astrid' };
      const binding = { actorId: h.actorId, sessionId: h.sessionId, expiresAt: h.expires, ...h.publication };
      const body = { dealerId: 'astrid', mode: 'rules', version: presentation.ver, event: { type: 'speak', line: 'goodluck' },
        presentationContext: context, sharedRoom: { roomId: h.roomId, ver: presentation.ver, talkId: presentation.talkId } };
      const entered = deferred(), release = deferred(), phases = [];
      const hashKey = value => { const hash = createHash('sha256').update(value).digest(); return [hash.readInt32BE(0), hash.readInt32BE(4)]; };
      const keys = [hashKey(`croupier-studio\0${canonicalStudioJson(h.scope)}`),
        hashKey(`croupier-shared-table\0room\0${h.roomId}`), hashKey('croupier-shared-table\0audit\0global')];
      const transactions = [], start = h.traced.trace.length, before = await h.durable();
      let active = false, pending, writer, responseReleased = false, callbackCount = 0;
      try {
        writer = await secondPool.connect();
        const helper = createSharedRoomPresentationAccess({ repository: h.repository, withLockedRead: runtime.withLockedRead,
          // Only the already-admitted publication binding is synthetic. Revalidation
          // uses the production session/provenance reader after real R/P/A locks.
          access: { async authorize() { return structuredClone(binding); }, async revalidateLocked(value, { signal }) {
            assert.deepEqual(value, binding);
            transactions.push(await h.storage.db.prepare('SELECT pg_backend_pid() AS pid,txid_current()::text AS txid').get());
            const fresh = await h.auth.bindingById(value.sessionId, { actorId: value.actorId, signal });
            if (!fresh) return null;
            assert.deepEqual(fresh, { actorId: h.actorId, sessionId: h.sessionId, expiresAt: h.expires, partnerKeyId: null });
            return { actorId: fresh.actorId, sessionId: fresh.sessionId, expiresAt: fresh.expiresAt, ...h.publication };
          } },
          async readPresentationLocked(roomId) {
            const current = await receiver.currentLocked(roomId), transaction = transactions.at(-1);
            assert.notEqual(transaction.pid, writer.processID);
            assert.deepEqual(await advisoryLocks(writer, transaction.pid, { classId: 0, objectId: 1129467984, subId: 1 }),
              [{ mode: 'ExclusiveLock', granted: true }], 'each capture really holds G');
            for (const key of keys) assert.deepEqual(await advisoryLocks(writer, transaction.pid,
              { classId: key[0] >>> 0, objectId: key[1] >>> 0, subId: 2 }), [{ mode: 'ExclusiveLock', granted: true }],
            'each capture really holds its S, R and A advisory locks');
            phases.push(transaction); return current;
          },
        });
        pending = observe(helper.withSharedCommittedReceipt({ request: new Request('http://127.0.0.1/shared-select'), playerId: h.actorId, body },
          async (capture, { signal }) => {
            callbackCount++; assert.equal(signal.aborted, false); assert.equal(phases.length, 1);
            assert.equal(Object.isFrozen(capture.material.media[0]), true);
            assert.deepEqual(capture.sourceEvent, presentation.events.find(event => event.type === 'speak' && event.line === 'goodluck'));
            entered.resolve(); await release.promise;
            return { video: { id: capture.material.media[0].id, sha256: capture.material.media[0].sha256 } };
          }).then(result => { responseReleased = true; return result; }));
        await bounded(Promise.race([entered.promise, pending.then(() => assert.fail('selector gate was skipped'))]), 'shared selector callback timeout');
        const first = transactions[0];
        assert.equal((await writer.query('SELECT xact_start FROM pg_stat_activity WHERE pid=$1', [first.pid])).rows[0].xact_start, null);
        assert.deepEqual((await writer.query('SELECT locktype,mode FROM pg_locks WHERE pid=$1', [first.pid])).rows, [],
          'first capture has committed and released every SQL lock while media work is pending');
        assert.equal(responseReleased, false);
        await writer.query('BEGIN'); active = true;
        await writer.query("SET LOCAL lock_timeout='1000ms'; SET LOCAL statement_timeout='3000ms'");
        assert.equal((await writer.query('SELECT pg_try_advisory_xact_lock(1129467984) AS acquired')).rows[0].acquired, true);
        for (const key of keys) assert.equal((await writer.query('SELECT pg_try_advisory_xact_lock($1::integer,$2::integer) AS acquired', key)).rows[0].acquired, true);
        // A second client can take the exact write locks while the callback waits.
        for (const [sql, values] of [
          ['SELECT id FROM croupier_game.players WHERE id=$1 FOR UPDATE NOWAIT', [h.actorId]],
          ['SELECT player_id FROM croupier_game.craig_player_links WHERE player_id=$1 FOR UPDATE NOWAIT', [h.actorId]],
          ['SELECT id FROM croupier_auth.users WHERE id=$1 FOR UPDATE NOWAIT', [h.userId]],
          ['SELECT user_id FROM croupier_auth.bo_auth_epochs WHERE user_id=$1 FOR UPDATE NOWAIT', [h.userId]],
          ['SELECT digest FROM croupier_game.player_sessions WHERE digest=$1 FOR UPDATE NOWAIT', [h.digest]],
          ['SELECT room_id FROM croupier_game.shared_table_presentation_receiver WHERE room_id=$1 FOR UPDATE NOWAIT', [h.roomId]],
        ]) assert.equal((await writer.query(sql, values)).rowCount, 1);
        if (change === 'session') {
          assert.equal((await writer.query('DELETE FROM croupier_game.player_sessions WHERE digest=$1', [h.digest])).rowCount, 1);
        } else if (change === 'material') {
          // Deliberately change this synthetic frozen row to prove the selector
          // refuses a hash change even when version and media id are unchanged.
          const config = JSON.parse((await writer.query('SELECT body FROM croupier_game.shared_table_configs WHERE room_id=$1 AND version=$2 FOR UPDATE NOWAIT', [h.roomId, 'v1'])).rows[0].body);
          config.material.media[0].sha256 = 'b'.repeat(64);
          assert.equal((await writer.query('UPDATE croupier_game.shared_table_configs SET body=$3 WHERE room_id=$1 AND version=$2', [h.roomId, 'v1', JSON.stringify(config)])).rowCount, 1);
        } else if (change === 'version') {
          const accepted = JSON.parse((await writer.query('SELECT body FROM croupier_game.shared_table_presentation_receiver WHERE room_id=$1', [h.roomId])).rows[0].body);
          const room = JSON.parse((await writer.query('SELECT body FROM croupier_game.shared_table_rooms WHERE room_id=$1 FOR UPDATE NOWAIT', [h.roomId])).rows[0].body);
          accepted.row.ver++; accepted.presentation.ver++; room.presentationVer++;
          assert.equal((await writer.query('UPDATE croupier_game.shared_table_presentation_receiver SET ver=$2,body=$3 WHERE room_id=$1', [h.roomId, accepted.presentation.ver, JSON.stringify(accepted)])).rowCount, 1);
          assert.equal((await writer.query('UPDATE croupier_game.shared_table_rooms SET body=$2 WHERE room_id=$1', [h.roomId, JSON.stringify(room)])).rowCount, 1);
        }
        await writer.query('COMMIT'); active = false;
        assert.equal(responseReleased, false, 'a selected value cannot escape before the second capture');
        release.resolve();
        if (change === 'none') assert.deepEqual(await bounded(pending, 'shared selector final capture timeout'),
          { video: { id: 'synthetic-video', sha256: 'a'.repeat(64) } });
        else await assert.rejects(bounded(pending, 'shared selector denial timeout'), error => {
          assert.equal(error.code, change === 'session' ? 'shared_room_presentation_forbidden' : 'shared_room_presentation_stale');
          assert.equal(error.statusCode, change === 'session' ? 403 : 409); return true;
        });
        assert.equal(responseReleased, change === 'none'); assert.equal(callbackCount, 1);
        assert.equal(transactions.length, 2); assert.notEqual(transactions[0].txid, transactions[1].txid);
        assert.equal(phases.length, change === 'session' ? 1 : 2);
        const trace = h.traced.trace.slice(start), sql = trace.filter(row => row.kind === 'sql');
        assert.equal(trace.filter(row => row.kind === 'connect').length, 2);
        assert.equal(trace.filter(row => row.kind === 'release').length, 2);
        assert.equal(trace.filter(row => row.kind === 'pool').length, 0);
        assert.equal(sql.filter(row => row.sql === 'BEGIN').length, 2);
        assert.equal(sql.filter(row => row.sql === 'COMMIT').length, change === 'none' ? 2 : 1);
        assert.equal(sql.filter(row => row.sql === 'ROLLBACK').length, change === 'none' ? 0 : 1);
        const after = await h.durable();
        for (const key of ['balance', 'ledger', 'reservations', 'receipts', 'members', 'presence', 'audit', 'outbox'])
          assert.deepEqual(after[key], before[key], 'selection and denied selection cannot write game/wallet/receipts');
        if (change !== 'version') assert.deepEqual(after.room, before.room);
      } finally {
        if (active) await writer.query('ROLLBACK').catch(() => {});
        release.resolve(); await pending?.catch(() => {});
        writer?.release(); await runtime.stop();
      }
    });
  }
  // createPool belongs to the harness, which closes all pools and its cluster.
  return { pool, checks };
}
