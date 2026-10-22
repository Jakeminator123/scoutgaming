// Real SQL checks, invoked only by tools/run-shared-table-qa.mjs on its owned cluster.
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createTableCoordinator } from '../services/game/games/blackjack/table/coordinator.mjs';
import { createPostgresTableStore } from '../services/game/games/blackjack/table/postgres-store.mjs';
import { ledgerKey, WalletDenied } from '../services/game/games/blackjack/table/ports.mjs';
import { DEFAULT_CONFIG } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

function worker(port, time) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(CROUPIER_|DATABASE_|PG|BLOB_|RESEND_|RUNPOD_|CARTESIA_|OPENCLAW_)/.test(key)) delete env[key];
  const child = fork(fileURLToPath(new URL('./fixtures/postgres-shared-table-process.mjs', import.meta.url)), [],
    { env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
  let n = 0, output = '', exited = false;
  const pending = new Map();
  child.stdout.on('data', value => { output = (output + value).slice(-2000); });
  child.stderr.on('data', value => { output = (output + value).slice(-2000); });
  child.on('message', message => {
    const waiter = pending.get(message.id); if (!waiter) return;
    pending.delete(message.id); clearTimeout(waiter.timer);
    if (message.error) waiter.reject(Object.assign(new Error(message.error.message), { code: message.error.code }));
    else waiter.resolve(message.result);
  });
  const exit = new Promise(resolve => child.once('exit', (code, signal) => {
    exited = true;
    for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(Error(`fixture_child_exited:${code}:${signal}:${output}`)); }
    pending.clear(); resolve({ code, signal });
  }));
  child.once('error', error => { for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(error); } pending.clear(); });
  const request = message => new Promise((resolve, reject) => {
    const id = ++n, timer = setTimeout(() => { pending.delete(id); reject(Error(`fixture_child_timeout:${output}`)); }, 15000);
    pending.set(id, { resolve, reject, timer }); child.send({ id, ...message });
  });
  return {
    pid: child.pid,
    ready: request({ op: 'open', port, time }), request,
    async loseResponse(message) {
      child.send({ id: ++n, ...message });
      let timer;
      try {
        const result = await Promise.race([exit, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`fixture_child_exit_timeout:${output}`)), 15000); })]);
        assert.deepEqual(result, { code: 0, signal: null }, output);
      } finally { clearTimeout(timer); }
    },
    async close() {
      if (exited) return;
      try { await request({ op: 'close' }); }
      finally {
        let timer;
        try { await Promise.race([exit, new Promise(resolve => { timer = setTimeout(() => { child.kill('SIGTERM'); resolve(); }, 3000); })]); await exit; }
        finally { clearTimeout(timer); }
      }
    },
  };
}

export async function checkPostgresSharedTableGuards({ pool }) {
  assert.throws(() => createPostgresTableStore({ pool, walletMode: 'external' }), /explicit demo wallet/);
  await assert.rejects(createPostgresTableStore({ pool, walletMode: 'demo' }).assertInstalled(), /schema is not installed/);
  assert.equal((await pool.query("SELECT to_regclass('croupier_game.shared_table_rooms') AS name")).rows[0].name, null);
  return { checks: ['shared-table-external-wallet-refused', 'shared-table-missing-schema-refused-without-startup-ddl'] };
}

export async function runPostgresSharedTableChecks({ pool, createPool, restart }) {
  const target = (await pool.query('SELECT current_user AS role,current_database() AS database,inet_server_addr()::text AS address,inet_server_port() AS port')).rows[0];
  assert.equal(target.role, 'studio_qa'); assert.equal(target.database, 'postgres');
  assert.ok(['127.0.0.1', '127.0.0.1/32'].includes(target.address));
  assert.equal(typeof createPool, 'function'); assert.equal(typeof restart, 'function');
  let time = 100000, command = 0, generation = 0;
  const clock = { now: () => time }, checks = [], children = [];
  let secondPool = createPool(), store, second, table, other;
  const reopen = () => {
    store = createPostgresTableStore({ pool, walletMode: 'demo', lockTimeoutMs: 250 });
    second = createPostgresTableStore({ pool: secondPool, walletMode: 'demo', lockTimeoutMs: 250 });
    table = createTableCoordinator({ store, clock, random: deterministicRandom(`sql-first-${++generation}`) });
    other = createTableCoordinator({ store: second, clock, random: deterministicRandom(`sql-second-${generation}`) });
  };
  reopen(); await store.assertInstalled();
  const check = async (name, work) => { await work(); checks.push(name); console.log(`ok - ${name}`); };
  const send = (actorId, op, fields = {}, roomId = 'party', coordinator = table, commandId = `sql-${++command}`) =>
    coordinator.command({ actorId }, { roomId, commandId, op, ...fields });
  const join = (actor, seat, room = 'party', coordinator = table) => send(actor, 'join', { seats: [seat], seatGens: { [seat]: 0 }, memberGen: 0 }, room, coordinator);
  const bet = async (actor, seat, chip, room = 'party', coordinator = table, id) =>
    send(actor, 'bet', { seat, field: 'main', chip, windowId: (await coordinator.snapshot(room, actor)).windowId }, room, coordinator, id);
  const balance = async actor => Number((await pool.query('SELECT balance FROM croupier_game.players WHERE id=$1', [actor])).rows[0].balance);
  const journal = async actor => (await pool.query('SELECT id,type,amount,currency,meta FROM croupier_game.transactions WHERE player_id=$1 ORDER BY id', [actor])).rows;
  const stable = async (room, actor) => ({ room: await store.read.room(room), members: await store.read.members(room),
    available: await store.read.available(actor), walletGen: await store.read.walletGen(actor), balance: await balance(actor), journal: await journal(actor),
    audit: await store.audit.verifyChain(), outbox: await store.outbox.pending(),
    receipts: (await pool.query('SELECT count(*)::integer AS n FROM croupier_game.shared_table_receipts')).rows[0].n });
  const stack = async (room, ranks) => store.runLocked({ global: false, rooms: [room], players: [] }, async tx => {
    const value = await tx.rooms.read(room);
    value.game.shoe.cards.splice(-ranks.length, ranks.length, ...ranks.map((r, i) => ({ r, s: ['♠', '♦', '♥', '♣'][i % 4], serial: 900 + i })).reverse());
    await tx.rooms.write(room, value);
  });
  try {
    for (const id of ['first', 'second', 'third', 'shared', 'block', 'blocked-a', 'blocked-b', 'process'])
      await pool.query('INSERT INTO croupier_game.players(id,name,balance,created_at) VALUES($1,$2,$3,$4)', [`table-${id}`, 'Synthetic SQL player', id === 'shared' ? 100 : 1000, '2026-10-22T00:00:00.000Z']);
    for (const room of ['party', 'room-11111111-1111-4111-8111-111111111111', 'race', 'shared-a', 'shared-b', 'timeout', 'blocked', 'process'])
      await store.config.publish(room, 'v1', structuredClone(DEFAULT_CONFIG));

    await check('shared-table-two-clients-two-rooms-single-debit-and-global-audit', async () => {
      await Promise.all([join('table-first', 3), join('table-second', 4, 'party', other), join('table-third', 2, 'room-11111111-1111-4111-8111-111111111111', other)]);
      await Promise.all([bet('table-first', 3, 25), bet('table-second', 4, 25, 'party', other), bet('table-third', 2, 25, 'room-11111111-1111-4111-8111-111111111111', other)]);
      const a = await table.snapshot('party', 'table-first'), b = await other.snapshot('party', 'table-second');
      assert.deepEqual(a.bets, b.bets); assert.deepEqual(a.shoe, b.shoe); assert.equal(a.deadline, b.deadline);
      assert.deepEqual((await table.snapshot('room-11111111-1111-4111-8111-111111111111', 'table-third')).owners.filter(Boolean), ['table-third']);
      await send('table-first', 'ready', { windowId: a.windowId });
      const result = await Promise.all([send('table-second', 'ready', { windowId: a.windowId }, 'party', table, 'start-once'), send('table-second', 'ready', { windowId: a.windowId }, 'party', other, 'start-once')]);
      assert.deepEqual(result.map(value => value.replay).sort(), [false, true]); assert.deepEqual(result[0].result, result[1].result);
      assert.equal(await balance('table-first'), 975); assert.equal(await balance('table-second'), 975);
      assert.equal((await journal('table-first')).length, 1); assert.equal((await journal('table-second')).length, 1);
      assert.equal((await table.snapshot('room-11111111-1111-4111-8111-111111111111', 'table-third')).phase, 'bets');
      assert.equal((await store.audit.verifyChain()).ok, true);
    });
    await check('shared-table-outbox-ack-sql-timeout-without-driver-timeout-and-recovery', async () => {
      const untimedPool = createPool({ queryTimeoutMs: null });
      assert.equal(untimedPool.options.query_timeout, undefined);
      assert.equal((await untimedPool.query('SHOW statement_timeout')).rows[0].statement_timeout, '0');
      assert.equal((await untimedPool.query('SHOW lock_timeout')).rows[0].lock_timeout, '0');
      const bounded = createPostgresTableStore({ pool: untimedPool, walletMode: 'demo', lockTimeoutMs: 100, statementTimeoutMs: 250 });
      const row = (await bounded.outbox.pending()).find(value => value.roomId === 'party'); assert.ok(row);
      const delivered = await bounded.outbox.deliveredVer(row.roomId);
      const holder = await secondPool.connect(); let ack, timer;
      try {
        await holder.query('BEGIN');
        const locked = await holder.query('SELECT ver FROM croupier_game.shared_table_outbox WHERE room_id=$1 AND ver=$2 FOR UPDATE', [row.roomId, row.ver]);
        assert.equal(locked.rowCount, 1);
        ack = bounded.outbox.ack(row, 'delivered');
        // This watchdog only fails the test; it does not cancel the SQL or supply its timeout.
        await assert.rejects(Promise.race([ack, new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error('adapter_ack_sql_timeout_missing')), 3000);
        })]), error => ['55P03', '57014'].includes(error.code));
        assert.deepEqual((await bounded.outbox.pending()).find(value => value.roomId === row.roomId && value.ver === row.ver), row);
        assert.equal(await bounded.outbox.deliveredVer(row.roomId), delivered);
      } finally {
        clearTimeout(timer);
        try { await holder.query('ROLLBACK'); } finally { holder.release(); }
        if (ack) await ack.catch(() => {});
      }
      await bounded.outbox.ack(row, 'delivered');
      assert.equal((await bounded.outbox.pending()).some(value => value.roomId === row.roomId && value.ver === row.ver), false);
      assert.equal(await bounded.outbox.deliveredVer(row.roomId), Math.max(delivered, row.ver));
    });
    await check('shared-table-concurrent-seat-claim-has-one-owner', async () => {
      const results = await Promise.allSettled([join('table-first', 0, 'race'), join('table-second', 0, 'race', other)]);
      assert.deepEqual(results.map(value => value.status).sort(), ['fulfilled', 'rejected']);
      assert.equal(results.find(value => value.status === 'rejected').reason.code, 'SEAT_TAKEN');
      assert.equal((await table.snapshot('race', 'table-first')).owners.filter(Boolean).length, 1);
    });
    await check('shared-table-concurrent-rooms-share-global-reservations', async () => {
      await join('table-shared', 0, 'shared-a'); await join('table-shared', 0, 'shared-b', other);
      const results = await Promise.allSettled([bet('table-shared', 0, 100, 'shared-a'), bet('table-shared', 0, 100, 'shared-b', other)]);
      assert.deepEqual(results.map(value => value.status).sort(), ['fulfilled', 'rejected']);
      assert.equal(results.find(value => value.status === 'rejected').reason.code, 'INSUFFICIENT_BALANCE');
      assert.equal(await store.read.available('table-shared'), 0); assert.equal(await balance('table-shared'), 100);
    });
    await check('shared-table-rollback-reverts-state-wallet-receipt-audit-and-outbox', async () => {
      const before = await stable('party', 'table-first');
      await assert.rejects(store.runLocked({ global: false, rooms: ['party'], players: ['table-first'] }, async tx => {
        const room = await tx.rooms.read('party'); room.version++; await tx.rooms.write('party', room);
        await tx.wallet.debit('table-first', { amount: 7, kind: 'test-rollback', key: ledgerKey({ namespace: 'command', roomId: 'party', actorId: 'table-first', identity: 'rollback-only', playerId: 'table-first', effect: 'test-rollback' }) });
        await tx.receipts.put({ roomId: 'party', actorId: 'table-first', commandId: 'rollback-only' }, { fingerprint: 'synthetic', result: {} });
        const audit = await tx.audit.append({ room: 'party', roundId: room.roundId, at: time, parent: null, type: 'test.rollback', payload: {} });
        await tx.outbox.put({ roomId: 'party', auditSeq: audit.seq, talkId: 'rollback-only', ver: 999, payload: {} });
        throw Error('intentional shared table rollback');
      }), /intentional shared table rollback/);
      assert.deepEqual(await stable('party', 'table-first'), before);
    });
    await check('shared-table-real-row-lock-timeout-rolls-back-and-same-command-retries', async () => {
      await join('table-block', 0, 'timeout');
      const holder = await secondPool.connect();
      const before = await stable('timeout', 'table-block');
      try {
        await holder.query('BEGIN'); await holder.query('SELECT id FROM croupier_game.players WHERE id=$1 FOR UPDATE', ['table-block']);
        await assert.rejects(bet('table-block', 0, 5, 'timeout', table, 'timed-bet'), error => error.code === '55P03' || /lock timeout/.test(error.message));
      } finally { await holder.query('ROLLBACK'); holder.release(); }
      assert.deepEqual(await stable('timeout', 'table-block'), before);
      assert.equal((await bet('table-block', 0, 5, 'timeout', table, 'timed-bet')).replay, false);
    });
    await check('shared-table-blocked-savepoint-retains-player-locks-and-generation-gated-retry', async () => {
      await join('table-blocked-a', 3, 'blocked'); await join('table-blocked-b', 4, 'blocked', other);
      await bet('table-blocked-a', 3, 25, 'blocked'); await bet('table-blocked-b', 4, 25, 'blocked', other);
      const before = await table.snapshot('blocked', 'table-blocked-a');
      const reservation = `blocked:${before.windowId}:table-blocked-b:stake`;
      const firstReservation = await store.read.reservation(`blocked:${before.windowId}:table-blocked-a:stake`);
      assert.ok(firstReservation);
      let consumedFirst = false, provedLock = false;
      const refusingStore = { ...store, runLocked: (plan, work) => store.runLocked(plan, tx => work({ ...tx,
        wallet: { ...tx.wallet, consume: async (actor, input) => {
          if (actor === 'table-blocked-b') throw new WalletDenied({ playerId: actor, reservationId: input.reservationId,
            walletGen: await tx.wallet.gen(actor), reason: 'synthetic domain refusal after first consume' });
          const result = await tx.wallet.consume(actor, input); consumedFirst = true; return result;
        } },
        rollbackTo: async savepoint => {
          await tx.rollbackTo(savepoint);
          const competitor = await secondPool.connect();
          try {
            await competitor.query('BEGIN'); await competitor.query("SET LOCAL lock_timeout='100ms'");
            await assert.rejects(competitor.query('SELECT id FROM croupier_game.players WHERE id=$1 FOR UPDATE', ['table-blocked-a']), error => error.code === '55P03');
            provedLock = true;
          } finally { await competitor.query('ROLLBACK'); competitor.release(); }
        },
      })) };
      const refusing = createTableCoordinator({ store: refusingStore, clock, random: deterministicRandom('sql-blocked-consume') });
      time = before.deadline;
      const due = (await refusing.dueTicks()).filter(row => row.roomId === 'blocked'); assert.equal(due.length, 1);
      const blocked = await refusing.tick(due[0]);
      assert.equal(blocked.outcome, 'blocked'); assert.ok(consumedFirst); assert.ok(provedLock);
      assert.equal(await balance('table-blocked-a'), 1000); assert.equal(await balance('table-blocked-b'), 1000);
      assert.deepEqual(await journal('table-blocked-a'), []); assert.deepEqual(await journal('table-blocked-b'), []);
      assert.deepEqual(await store.read.reservation(`blocked:${before.windowId}:table-blocked-a:stake`), firstReservation);
      assert.equal((await store.read.reservation(reservation)).amount, 25);
      const loaded = createTableCoordinator({ store: createPostgresTableStore({ pool: secondPool, walletMode: 'demo' }), clock, random: deterministicRandom('sql-reload-blocked') });
      const after = await loaded.snapshot('blocked', 'table-blocked-a');
      assert.equal(after.phase, 'bets'); assert.equal(after.windowId, before.windowId); assert.equal(after.deadline, before.deadline); assert.deepEqual(after.bets, before.bets);
      assert.deepEqual((await loaded.dueTicks()).filter(row => row.roomId === 'blocked'), [], 'reconstruction does not retry unchanged blocked generation');
      assert.equal((await store.read.tick(blocked.tickId)).outcome, 'blocked');
      await store.runLocked({ global: false, rooms: ['blocked'], players: ['table-blocked-b'] }, tx => tx.wallet.credit('table-blocked-b', {
        amount: 1, kind: 'refill', key: ledgerKey({ namespace: 'command', roomId: 'blocked', actorId: 'table-blocked-b', identity: 'recovery-credit', playerId: 'table-blocked-b', effect: 'refill' }),
      }));
      const retry = (await loaded.dueTicks()).filter(row => row.roomId === 'blocked'); assert.equal(retry.length, 1);
      assert.equal(retry[0].tickId, `${blocked.tickId}:retry:1`);
      assert.equal((await loaded.tick(retry[0])).outcome, 'applied');
      assert.equal((await loaded.tick(retry[0])).replay, true);
      assert.equal(await balance('table-blocked-a'), 975); assert.equal(await balance('table-blocked-b'), 976);
      assert.equal((await journal('table-blocked-a')).length, 1); assert.equal((await journal('table-blocked-b')).length, 2);
      assert.equal((await loaded.snapshot('blocked', 'table-blocked-a')).phase, 'round');
    });
    await check('shared-table-process-response-loss-restart-replay-and-pg-restart', async () => {
      await join('table-process', 3, 'process'); await bet('table-process', 3, 25, 'process');
      await stack('process', ['10', '9', '10', '7', '2']);
      const initial = await table.snapshot('process', 'table-process');
      const input = { roomId: 'process', op: 'ready', commandId: 'process-start', windowId: initial.windowId };
      const first = worker(target.port, time); children.push(first); await first.ready;
      await first.loseResponse({ op: 'commit-without-response', actorId: 'table-process', input, time });
      assert.equal(await balance('table-process'), 975); assert.equal((await journal('table-process')).length, 1);
      const committed = await stable('process', 'table-process');
      const second = worker(target.port, time); children.push(second); await second.ready; assert.notEqual(first.pid, second.pid);
      const replay = await second.request({ op: 'command', actorId: 'table-process', input, time });
      assert.equal(replay.replay, true); assert.equal(replay.result.started, true);
      assert.deepEqual(await stable('process', 'table-process'), committed);
      await assert.rejects(second.request({ op: 'command', actorId: 'table-process', input: { ...input, windowId: 'different' }, time }), error => error.code === 'REQUEST_REUSED');
      const state = await second.request({ op: 'snapshot', roomId: 'process', actorId: 'table-process', time });
      assert.equal(state.actionDeadline, replay.snapshot.actionDeadline);
      time = state.plan.turnAt;
      await second.request({ op: 'command', actorId: 'table-process', time,
        input: { roomId: 'process', op: 'act', commandId: 'process-stand', action: 'stand', roundId: state.roundId, turnSeq: state.turnSeq, box: 3, handIndex: state.round.active } });
      await second.close();
      time = (await table.snapshot('process', 'table-process')).plan.endAt;
      for (const tick of (await table.dueTicks()).filter(row => row.roomId === 'process')) await table.tick(tick);
      assert.equal((await table.snapshot('process', 'table-process')).phase, 'settled');
      assert.equal(await balance('table-process'), 1025); assert.equal((await journal('table-process')).length, 2);
      const saved = await stable('process', 'table-process');
      const aborted = worker(target.port, time); children.push(aborted); await aborted.ready;
      await aborted.loseResponse({ op: 'abort-uncommitted', roomId: 'process', actorId: 'table-process', time });
      assert.deepEqual(await stable('process', 'table-process'), saved, 'process exit before COMMIT rolls back wallet and ledger');
      pool = await restart(); secondPool = createPool(); reopen();
      assert.deepEqual(await stable('process', 'table-process'), saved);
      assert.equal((await table.command({ actorId: 'table-process' }, input)).replay, true);
      assert.deepEqual(await stable('process', 'table-process'), saved);
      const failed = await table.deliverOutbox(async () => { throw Error('synthetic media unavailable'); });
      assert.ok(failed.failed.length > 0); assert.deepEqual(await stable('process', 'table-process'), saved);
    });
    assert.equal((await store.audit.verifyChain()).ok, true);
    return { pool, checks };
  } finally { for (const child of children) await child.close(); }
}
