// Memory behavior and instrumented PostgreSQL reads. SQL tests prove the selected
// client and query order, not database isolation or live PostgreSQL row locks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTableCoordinator, TABLE_CONTRACT } from '../../services/game/games/blackjack/table/coordinator.mjs';
import { createPostgresTableStore } from '../../services/game/games/blackjack/table/postgres-store.mjs';
import { createPostgresStore } from '../../packages/storage/server/postgres-store.mjs';
import { createStudioRepository } from '../../packages/studio-registry/server/document-repository.mjs';
import { createMemoryTableStore, DEFAULT_CONFIG } from '../fixtures/blackjack/table-memory-store.mjs';
import { createPglitePool } from '../fixtures/pglite-pool.mjs';
import { deterministicRandom } from '../fixtures/blackjack/deterministic-random.mjs';

const roomId = 'party', actorId = 'alice';
const clock = { now: () => 100000 };
const join = { roomId, commandId: 'join-1', op: 'join', seats: [0], seatGens: { 0: 0 }, memberGen: 0 };
const settings = (configVersion, config = DEFAULT_CONFIG) => ({ configVersion, language: config.language,
  betMs: config.betMs, actionMs: config.actionMs, limits: { ...config.limits }, chips: [...config.chips], refill: config.refill });
const forbidden = () => assert.fail('A read-only snapshot must not invoke a writer or randomness');

async function durable(store) {
  return { rooms: await store.read.rooms(), members: await store.read.members(roomId), presence: await store.read.presence(roomId, actorId),
    balance: store.test.balance(actorId), walletGen: await store.read.walletGen(actorId), reservations: store.test.reservations(),
    ledger: store.test.ledger(), audit: store.test.audit(), ticks: store.test.ticks(), receipts: store.test.receipts(),
    outbox: store.test.outbox(), pause: await store.read.pausedUntil(actorId), units: store.test.stats.units };
}

test('default absent snapshots and client snapshots without an actor retain null without new reads', async () => {
  const base = createMemoryTableStore();
  const store = { ...base, read: { ...base.read, config: forbidden, funds: forbidden, available: forbidden, pausedUntil: forbidden },
    runLocked: forbidden, presence: { touch: forbidden } };
  const table = createTableCoordinator({ store, clock: { now: forbidden }, random: new Proxy({}, { get: forbidden }) });
  assert.equal(await table.snapshot(roomId, actorId), null);
  assert.equal(await table.snapshot(roomId, actorId, { client: 'true' }), null);
  assert.equal(await table.snapshot(roomId, null, { client: true }), null);
});

test('unopened client snapshot is a virtual read with server funds and pause, without room, wallet, presence or RNG writes', async () => {
  const base = createMemoryTableStore();
  base.test.fund(actorId, 500);
  base.test.mutateReservations(rows => { rows.other = { playerId: actorId, roomId: 'other', amount: 125 }; });
  await base.runLocked({ rooms: [], players: [actorId] }, tx => tx.pause.extend(actorId, 200000));
  base.test.publish('v2', { language: 'sv', material: { secret: 'private' }, ledger: ['private'] });
  const before = await durable(base);
  const store = { ...base, runLocked: forbidden, presence: { touch: forbidden }, outbox: { ...base.outbox, ack: forbidden } };
  const table = createTableCoordinator({ store, clock, random: new Proxy({}, { get: forbidden }) });
  assert.deepEqual(await table.snapshot(roomId, actorId, { client: true }), {
    contract: TABLE_CONTRACT, roomId, version: 0, configVersion: 'v2', windowId: 'unopened', phase: 'bets', roundId: null, turnSeq: 0,
    owners: Array(7).fill(null), seatGen: Array(7).fill(0), bets: Array.from({ length: 7 }, () => ({ main: 0, pp: 0, tp: 0 })),
    deadline: null, actionDeadline: null, plan: null, round: null, shoe: null, presentationVer: 0, players: [], serverNow: clock.now(),
    me: { id: actorId, seats: [], memberGen: 0, active: false, available: 375, currency: 'USD', pausedUntil: 200000, insuranceDue: false, lastSettlement: null },
    unopened: true, settings: settings('v2', { ...DEFAULT_CONFIG, language: 'sv' }),
  });
  assert.deepEqual(await durable(base), before);
  assert.equal(await table.snapshot(roomId, actorId), null);
});

test('memory config reads select latest or an explicit frozen version and return independent data', async () => {
  const store = createMemoryTableStore();
  store.test.publish('v2', { chips: [2, 20], limits: { min: 2, max: 20, sideMax: 10 } });
  const latest = await store.read.config(roomId);
  assert.equal(latest.configVersion, 'v2');
  latest.chips.push(999); latest.limits.min = 999;
  assert.deepEqual((await store.read.config(roomId)).chips, [2, 20]);
  assert.equal((await store.read.config(roomId)).limits.min, 2);
  assert.deepEqual(await store.read.config(roomId, 'v1'), { configVersion: 'v1', ...DEFAULT_CONFIG });
  await assert.rejects(store.read.config(roomId, 'missing'), /configuration is missing/);
});

test('opened client snapshot uses the room frozen version, whitelists settings and preserves the complete default view', async () => {
  const base = createMemoryTableStore();
  base.test.fund(actorId, 1000);
  base.test.publish('v1', { material: { private: true }, ledger: ['private'], surprise: 'private' });
  const table = createTableCoordinator({ store: base, clock, random: deterministicRandom('client-snapshot') });
  await table.command({ actorId }, join);
  const original = await table.snapshot(roomId, actorId);
  base.test.publish('v2', { language: 'sv', chips: [10], refill: 25 });
  const snapshot = await table.snapshot(roomId, actorId, { client: true });
  const { unopened, settings: actualSettings, ...unchanged } = snapshot;
  assert.equal(unopened, false);
  assert.deepEqual(actualSettings, settings('v1'));
  assert.deepEqual(unchanged, original);
  actualSettings.chips.push(999); actualSettings.limits.min = 999;
  assert.deepEqual((await table.snapshot(roomId, actorId, { client: true })).settings, settings('v1'));
  const defaultOnly = createTableCoordinator({ store: { ...base, read: { ...base.read, config: forbidden } }, clock,
    random: new Proxy({}, { get: forbidden }) });
  assert.deepEqual(await defaultOnly.snapshot(roomId, actorId), original);
});

test('command client view is selected only by strict server context, including receipt replay', async () => {
  for (const flag of [undefined, false, 'true', true]) {
    const store = createMemoryTableStore();
    store.test.fund(actorId, 1000);
    const table = createTableCoordinator({ store, clock, random: deterministicRandom('command-client-view') });
    const input = { ...join, clientSnapshot: true };
    for (let replay = 0; replay < 2; replay++) {
      const response = await table.command({ actorId, clientSnapshot: flag }, input);
      assert.equal(response.replay, Boolean(replay));
      assert.equal(Object.hasOwn(response.snapshot, 'settings'), flag === true);
      assert.equal(Object.hasOwn(response.snapshot, 'unopened'), flag === true);
      if (flag === true) assert.deepEqual(response.snapshot.settings, settings('v1'));
    }
  }
});

function postgresFixture({ noHead = false, missingVersion, readError, accounts = {} } = {}) {
  const calls = [], clients = [];
  const configs = { v1: { configVersion: 'v1', ...structuredClone(DEFAULT_CONFIG) },
    v2: { configVersion: 'v2', ...structuredClone(DEFAULT_CONFIG), language: 'sv' } };
  const pool = {
    async query() { assert.fail('Reads must use the transaction client'); },
    async connect() {
      const client = {
        id: clients.length + 1, released: false,
        async query(sql, values = []) {
          calls.push({ client: this.id, sql, values });
          if (sql.includes('FROM croupier_game.players p WHERE p.id=$1')) return { rows: accounts[values[0]] ? [accounts[values[0]]] : [] };
          if (sql.includes('FROM croupier_game.shared_table_config_heads')) return { rows: noHead ? [] : [{ version: 'v2' }] };
          if (sql.includes('FROM croupier_game.shared_table_configs')) {
            if (readError) throw readError;
            const value = values[0] === roomId && values[1] !== missingVersion ? configs[values[1]] : null;
            return { rows: value ? [{ body: JSON.stringify(value) }] : [] };
          }
          return { rows: [], command: sql === 'COMMIT' ? 'COMMIT' : undefined };
        },
        release() { assert.equal(this.released, false); this.released = true; },
      };
      clients.push(client); return client;
    },
  };
  return { pool, calls, clients, configs, store: createPostgresTableStore({ pool, walletMode: 'demo' }) };
}

test('PostgreSQL latest config reads head then frozen body on one client with no data writes or table locks', async () => {
  const h = postgresFixture();
  assert.deepEqual(await h.store.read.config(roomId), h.configs.v2);
  assert.equal(h.clients.length, 1); assert.equal(h.clients[0].released, true);
  assert.deepEqual(h.calls.filter(call => call.sql.includes('FROM ')).map(call => call.values), [[roomId], [roomId, 'v2']]);
  assert.equal(h.calls.filter(call => call.sql === 'BEGIN').length, 1);
  assert.equal(h.calls.filter(call => call.sql === 'COMMIT').length, 1);
  assert.equal(h.calls.some(call => /INSERT|UPDATE|DELETE|pg_advisory|FOR SHARE|FOR UPDATE/.test(call.sql)), false);
});

test('PostgreSQL explicit version bypasses head and missing config or SQL failure rolls back', async () => {
  const explicit = postgresFixture({ noHead: true });
  assert.deepEqual(await explicit.store.read.config(roomId, 'v1'), explicit.configs.v1);
  assert.equal(explicit.calls.some(call => call.sql.includes('config_heads')), false);
  const readError = Object.assign(new Error('database unavailable'), { code: '08006' });
  for (const [options, expected] of [[{ noHead: true }, /No published table configuration/],
    [{ missingVersion: 'v2' }, /configuration is missing/], [{ readError }, error => error === readError]]) {
    const h = postgresFixture(options);
    await assert.rejects(h.store.read.config(roomId), expected);
    assert.equal(h.calls.at(-1).sql, 'ROLLBACK'); assert.equal(h.clients[0].released, true);
    assert.equal(h.calls.some(call => call.sql === 'COMMIT'), false);
  }
});

test('PostgreSQL config reads inside the shared runner reuse the active client and outer commit', async () => {
  const h = postgresFixture();
  const storage = createPostgresStore({ pool: h.pool });
  const store = createPostgresTableStore({ pool: storage.gamePool, walletMode: 'demo' });
  const repository = createStudioRepository({ pool: h.pool, scope: { environment: 'test', workspaceId: 'client-config' } });
  await repository.sharedTransaction(async () => {
    assert.deepEqual(await store.read.config(roomId), h.configs.v2);
    assert.deepEqual(await store.read.config(roomId, 'v1'), h.configs.v1);
    assert.equal(h.calls.some(call => call.sql === 'COMMIT'), false);
  }, { serialize: true });
  assert.equal(h.clients.length, 1); assert.equal(h.clients[0].released, true);
  assert.equal(h.calls.filter(call => call.sql === 'BEGIN').length, 1);
  assert.equal(h.calls.filter(call => call.sql === 'COMMIT').length, 1);
  assert.equal(new Set(h.calls.map(call => call.client)).size, 1);
  const firstRead = h.calls.findIndex(call => call.sql.includes('shared_table_config'));
  const lastFence = h.calls.findLastIndex(call => call.sql.includes('pg_advisory_xact_lock'));
  assert.ok(firstRead > lastFence && lastFence >= 0);
});

test('snapshot funds keep the account currency and available amount in one PostgreSQL read', async () => {
  const accounts = { alice: { available: '375.25', currency: 'EUR' }, bob: { available: '12.50', currency: 'USD' } };
  const h = postgresFixture({ accounts });
  for (const [actor, row] of Object.entries(accounts)) {
    const before = h.calls.length;
    assert.deepEqual(await h.store.read.funds(actor), { available: Number(row.available), currency: row.currency });
    const reads = h.calls.slice(before).filter(call => call.sql.includes('FROM '));
    assert.equal(reads.length, 1, 'currency and available cannot come from different account revisions');
    assert.deepEqual(reads[0].values, [actor]);
  }
  await assert.rejects(h.store.read.funds('missing'), error => error.code === 'PLAYER_UNAVAILABLE');
  assert.equal(h.calls.some(call => /INSERT|UPDATE|DELETE|pg_advisory|FOR SHARE|FOR UPDATE/.test(call.sql)), false);
});

test('unopened, joined and reconnected snapshots expose only the requested player currency', async () => {
  const base = createMemoryTableStore();
  base.test.fund(actorId, 500); base.test.fund('bob', 800);
  base.test.setCurrency(actorId, 'EUR'); base.test.setCurrency('bob', 'SEK');
  const table = createTableCoordinator({ store: base, clock, random: deterministicRandom('snapshot-currency') });
  const before = await durable(base);
  const unopened = await table.snapshot(roomId, actorId, { client: true });
  assert.equal(unopened.me.currency, 'EUR'); assert.equal(unopened.me.available, 500);
  assert.deepEqual(await durable(base), before);
  const joined = await table.command({ actorId, clientSnapshot: true }, join);
  assert.equal(joined.snapshot.me.currency, 'EUR');
  const bob = await table.snapshot(roomId, 'bob', { client: true });
  assert.equal(bob.me.currency, 'SEK'); assert.equal(bob.me.available, 800);
  assert.equal(bob.players.some(player => Object.hasOwn(player, 'currency')), false);
  base.test.setCurrency(actorId, 'USD');
  const reconnect = createTableCoordinator({ store: base, clock, random: new Proxy({}, { get: forbidden }) });
  assert.equal((await reconnect.snapshot(roomId, actorId, { client: true })).me.currency, 'USD');
});

// Membership is independent of the last empty betting box. PGlite verifies SQL rollback;
// cross-connection races also run in postgres-shared-table.mjs.
async function spotsSetup(t, sql = false, funds = { alice: 1000, bob: 1000, carol: 1000, dave: 1000 }) {
  let store;
  if (sql) {
    const pool = await createPglitePool(); t.after(() => pool.end());
    for (const [id, balance] of Object.entries(funds)) await pool.query(
      'INSERT INTO croupier_game.players(id,name,balance,created_at) VALUES($1,$2,$3,$4)', [id, 'Synthetic betting test', balance, '2026-10-31T00:00:00.000Z']);
    store = createPostgresTableStore({ pool, walletMode: 'demo' });
    await store.assertInstalled(); await store.config.publish('spots', 'v1', structuredClone(DEFAULT_CONFIG));
  } else {
    store = createMemoryTableStore();
    for (const [id, balance] of Object.entries(funds)) store.test.fund(id, balance);
  }
  let time = 100000, n = 0, table;
  const restart = () => { table = createTableCoordinator({ store, clock: { now: () => time }, random: deterministicRandom('betting-spots') }); };
  restart();
  const h = {
    store, restart, get table() { return table; }, get time() { return time; }, set time(value) { time = value; }, snap: actor => table.snapshot('spots', actor),
    editRoom: change => store.runLocked({ rooms: ['spots'], players: [] }, async tx => { const room = await tx.rooms.read('spots'); change(room); await tx.rooms.write('spots', room); }),
    send: (actorId, op, args = {}) => table.command({ actorId }, { roomId: 'spots', op, commandId: `spots-${++n}`, ...args }),
    async join(actor, seats) { const s = await h.snap(actor); return h.send(actor, 'join', { seats, memberGen: s?.me.memberGen ?? 0,
      seatGens: Object.fromEntries(seats.map(i => [i, s?.seatGen[i] ?? 0])) }); },
    async bet(actor, seat, chip = 5, field = 'main') { return h.send(actor, 'bet', { seat, field, chip, windowId: (await h.snap(actor)).windowId }); },
    async ready(actor) { return h.send(actor, 'ready', { windowId: (await h.snap(actor)).windowId }); },
    async leave(actor) { return h.send(actor, 'leave', { memberGen: (await h.snap(actor)).me.memberGen }); },
    async finish() {
      for (let count = 0; count < 40; count++) {
        const s = await h.snap('alice'); if (s.phase === 'settled') return s;
        time = Math.max(time, s.plan?.turnAt ?? 0);
        if (s.round?.phase === 'decisions') {
          const handIndex = s.round.active, box = s.round.hands[handIndex].box;
          await h.send(s.owners[box], 'act', { roundId: s.roundId, turnSeq: s.turnSeq, box, handIndex, action: 'stand' });
        } else if (s.round?.phase === 'insurance') {
          for (const player of s.players) if ((await h.snap(player.id)).me.insuranceDue)
            await h.send(player.id, 'insurance', { roundId: s.roundId, phase: 'insurance', take: false });
        } else {
          time = Math.max(time, s.plan?.endAt ?? 0, s.actionDeadline ?? 0);
          for (const tick of await table.dueTicks()) await table.tick(tick);
        }
      }
      assert.fail('round did not settle');
    },
  };
  return h;
}

for (const sql of [false, true]) test(`${sql ? 'SQL' : 'memory'}: taking an empty box preserves membership, reconnect and betting without another join`, async t => {
  const h = await spotsSetup(t, sql);
  await h.join('alice', [3]); const member = (await h.snap('alice')).me.memberGen;
  await h.editRoom(room => { room.ready = ['alice']; }); // Defensive old-state case: no real stake backs ready.
  await h.join('bob', [3]);
  assert.deepEqual((await h.snap('alice')).me.seats, []);
  assert.equal((await h.snap('alice')).me.memberGen, member);
  assert.equal((await h.snap('alice')).me.active, true);
  assert.equal((await h.snap('alice')).players.find(player => player.id === 'alice').ready, false);
  await h.bet('alice', 3);
  await assert.rejects(h.bet('bob', 3), { code: 'NOT_YOUR_BOX' });
  await assert.rejects(h.join('bob', [3]), { code: 'SEAT_TAKEN' });
  h.restart();
  const bob = await h.snap('bob');
  assert.equal(bob.me.active, true); assert.deepEqual(bob.me.seats, []);
  assert.ok(bob.players.some(player => player.id === 'bob' && player.seats.length === 0));
  await h.bet('bob', 4); assert.deepEqual((await h.snap('bob')).me.seats, [4]);
  await h.join('carol', [6]); await h.bet('alice', 6); await h.join('dave', [2]);
  assert.equal((await h.ready('alice')).result.started, false, 'another player with a real stake must still become ready');
  assert.equal((await h.ready('bob')).result.started, true, 'members without a stake do not block ready, with or without an empty box');
  await h.leave('carol');
  assert.equal((await h.snap('carol')).me.active, false, 'a member without a hand leaves immediately during a round');
  await assert.rejects(h.bet('carol', 5), { code: 'NOT_SEATED' });
  const settled = await h.finish();
  assert.equal(settled.phase, 'settled');
  assert.deepEqual(settled.me.lastSettlement.hands.map(hand => hand.box).sort(), [3, 6]);
  assert.deepEqual((await h.snap('bob')).me.lastSettlement.hands.map(hand => hand.box), [4]);
  assert.equal((await h.snap('carol')).me.active, false);
  await h.leave('alice'); await h.leave('bob'); await h.leave('dave');
  const empty = await h.snap('carol');
  assert.equal(empty.phase, 'bets'); assert.deepEqual(empty.owners, Array(7).fill(null));
  await h.join('carol', [2]); assert.equal((await h.snap('carol')).me.active, true, 'the empty table can be entered again');
});

for (const sql of [false, true]) for (const claim of ['join', 'bet']) test(`${sql ? 'SQL' : 'memory'}: ${claim} claims cannot restore a previous owner's stake through undo`, async t => {
  const h = await spotsSetup(t, sql);
  await h.join('alice', [0]); await h.join('bob', [1]);
  await h.bet('alice', 0, 100); await h.bet('bob', 1);
  await h.send('alice', 'clear', { windowId: (await h.snap('alice')).windowId });
  if (claim === 'join') await h.join('bob', [0, 1]);
  await h.bet('bob', 0);
  assert.deepEqual((await h.snap('bob')).me.seats, [0, 1]);
  assert.equal((await h.store.read.funds('bob')).available, 990);
  await h.send('bob', 'undo', { windowId: (await h.snap('bob')).windowId });
  assert.deepEqual((await h.snap('bob')).bets.map(b => b.main), [0, 5, 0, 0, 0, 0, 0]);
  assert.equal((await h.store.read.funds('bob')).available, 995);
  await h.send('bob', 'undo', { windowId: (await h.snap('bob')).windowId });
  assert.deepEqual((await h.snap('bob')).bets, Array.from({ length: 7 }, () => ({ main: 0, pp: 0, tp: 0 })));
  assert.equal((await h.store.read.funds('bob')).available, 1000, 'earlier own bets still undo, without importing another player’s money');
});

for (const sql of [false, true]) test(`${sql ? 'SQL' : 'memory'}: failed empty-box bet rolls back ownership, generations, membership, ready, undo history and wallet`, async t => {
  const h = await spotsSetup(t, sql, { alice: 10, bob: 1000, carol: 1000, dave: 1000 });
  await h.join('alice', [0]); await h.join('bob', [1]); await h.join('carol', [6]); await h.join('dave', [3]);
  await h.bet('dave', 3, 100); await h.bet('alice', 0);
  await h.send('alice', 'clear', { windowId: (await h.snap('alice')).windowId });
  await h.send('dave', 'clear', { windowId: (await h.snap('dave')).windowId });
  await h.bet('carol', 6); await h.bet('bob', 0); await h.ready('carol');
  await h.editRoom(room => { room.ready.push('dave'); });
  const before = { room: await h.store.read.room('spots'), members: await h.store.read.members('spots'), funds: await h.store.read.funds('alice') };
  await assert.rejects(h.bet('alice', 3, 25), { code: 'INSUFFICIENT_BALANCE' });
  assert.deepEqual({ room: await h.store.read.room('spots'), members: await h.store.read.members('spots'), funds: await h.store.read.funds('alice') }, before);
  await h.bet('alice', 3, 5); assert.deepEqual((await h.snap('alice')).me.seats, [3]);
  assert.equal((await h.snap('dave')).players.find(player => player.id === 'dave').ready, false);
});

for (const sql of [false, true]) test(`${sql ? 'SQL' : 'memory'}: zero-box membership survives connected idleness, expires on absence and ignores stale ticks`, async t => {
  const h = await spotsSetup(t, sql);
  await h.join('alice', [3]); await h.join('bob', [3]); await h.leave('bob');
  assert.deepEqual((await h.snap('alice')).owners, Array(7).fill(null));
  h.time += 100000; await h.store.presence.touch('spots', 'alice', h.time);
  assert.deepEqual(await h.table.dueTicks(), [], 'connected member without a box is not evicted by the 90-second box-idle clock');
  h.time += 120000;
  const [old] = await h.table.dueTicks(); assert.equal(old.playerId, 'alice'); assert.equal(old.kind, 'seat.release');
  await h.store.presence.touch('spots', 'alice', h.time);
  assert.equal((await h.table.tick(old)).outcome, 'superseded', 'a reconnect supersedes the old presence deadline');
  h.time += 120000;
  const [due] = await h.table.dueTicks();
  assert.equal((await h.table.tick(due)).outcome, 'applied');
  assert.equal((await h.snap('alice')).me.active, false);
  await h.join('alice', [0]);
  assert.equal((await h.table.tick(due)).replay, true, 'a completed old generation cannot evict a new membership');
  assert.equal((await h.snap('alice')).me.active, true);
  assert.deepEqual((await h.store.read.members('spots', { activeOnly: true })).map(member => member.actorId), ['alice']);
  assert.equal((await h.store.read.members('spots')).length, 2, 'ordinary snapshot reads still retain inactive generations');
});

test('two members racing for one completely empty box: exactly one main bet wins; side bets cannot claim it', async t => {
  const h = await spotsSetup(t);
  await h.join('alice', [0]); await h.join('bob', [1]); await h.join('carol', [3]);
  await assert.rejects(h.bet('alice', 3, 5, 'pp'), { code: 'NOT_YOUR_BOX' });
  const results = await Promise.allSettled([h.bet('alice', 3), h.bet('bob', 3)]);
  assert.deepEqual(results.map(result => result.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'NOT_YOUR_BOX');
  const s = await h.snap('carol');
  assert.equal(s.bets[3].main, 5); assert.equal(s.me.active, true); assert.deepEqual(s.me.seats, []);
  assert.equal((await h.store.read.funds('alice')).available + (await h.store.read.funds('bob')).available, 1995);
  await h.leave('carol'); h.restart(); assert.equal((await h.snap('carol')).me.active, false);
});

test('any existing side stake also protects its box from join and main bet', async t => {
  const h = await spotsSetup(t); await h.join('alice', [0]); await h.join('bob', [3]);
  // Defensive legacy-state coverage: normal commands never allow a side bet without a main bet.
  h.store.test.mutateRoom('spots', room => { room.bets[3].tp = 5; });
  await assert.rejects(h.join('alice', [0, 3]), { code: 'SEAT_TAKEN' });
  await assert.rejects(h.bet('alice', 3), { code: 'NOT_YOUR_BOX' });
  assert.equal((await h.snap('bob')).bets[3].tp, 5);
});
