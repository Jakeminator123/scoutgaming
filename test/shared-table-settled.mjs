import test from 'node:test';
import assert from 'node:assert/strict';
import { createPglitePool } from './fixtures/pglite-pool.mjs';
import { createPostgresTableStore } from '../services/game/games/blackjack/table/postgres-store.mjs';
import { createTableCoordinator } from '../services/game/games/blackjack/table/coordinator.mjs';
import { LockSetExceeded, TableError } from '../services/game/games/blackjack/table/ports.mjs';
import { DEFAULT_CONFIG } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

// Preview 28 Oct 2026 (Johns Bet, Studion, audit seq 2786-3040): a player sat on boxes 3-5, played one round
// and stayed online without pressing Nästa runda. From 19:37:46 to 20:43:02 the room stood in `settled`. A
// player without a box could not take one there (the client offers join only in a betting window) and his
// Nästa runda got 409 NOT_SEATED. The republish 17 -> 18 meanwhile waited for the next window, so the room
// kept the old table. A finished round must never wait for one particular player: anyone at the table may
// open the next window, and that window binds the newest published configuration (O02 V6).
const ROOM = 'settled-room', T0 = 1_800_000_000_000;

async function setup(t, players = ['alice', 'bob']) {
  const pool = await createPglitePool();
  t.after(() => pool.end());
  for (const id of players) await pool.query('INSERT INTO croupier_game.players(id,name,balance,created_at) VALUES($1,$2,$3,$4)',
    [id, `Synthetic ${id}`, 1000, '2026-10-28T00:00:00.000Z']);
  const store = createPostgresTableStore({ pool, walletMode: 'demo' });
  await store.config.publish(ROOM, 'v1', structuredClone(DEFAULT_CONFIG));
  let time = T0, n = 0, exceeded = 0;
  const table = createTableCoordinator({ store, clock: { now: () => time }, random: deterministicRandom('settled-room') });
  const plans = [], runLocked = store.runLocked;
  store.runLocked = async (plan, work) => {
    plans.push(plan);
    try { return await runLocked(plan, work); } catch (error) { if (error instanceof LockSetExceeded) exceeded++; throw error; }
  };
  const rows = async sql => (await pool.query(sql, [ROOM])).rows.map(row => JSON.parse(row.body));
  const h = {
    store, table, plans, get exceeded() { return exceeded; }, get time() { return time; }, set time(value) { time = value; },
    snap: (who = 'alice') => table.snapshot(ROOM, who),
    send: (who, op, fields = {}, commandId = `c${++n}`) => table.command({ actorId: who }, { roomId: ROOM, op, commandId, ...fields }),
    async join(who, seats) {
      const s = await h.snap(who);
      return h.send(who, 'join', { seats, seatGens: Object.fromEntries(seats.map(i => [i, s?.seatGen[i] ?? 0])), memberGen: s?.me.memberGen ?? 0 });
    },
    async drain() {
      for (let i = 0; i < 100; i++) { const due = await table.dueTicks(); if (!due.length) return; for (const d of due) await table.tick(d); }
      throw new Error('scheduler did not settle');
    },
    async standAll() {
      for (let i = 0; i < 40; i++) {
        const s = await h.snap();
        if (s.phase === 'settled') return s;
        const hand = s.round?.hands?.[s.round.active];
        if (s.phase === 'round' && s.round.phase === 'decisions' && hand) {
          time = Math.max(time, s.plan.turnAt);
          await h.send(s.owners[hand.box], 'act', { action: 'stand', roundId: s.roundId, turnSeq: s.turnSeq, box: hand.box, handIndex: s.round.active });
          continue;
        }
        time = Math.max(time, s.plan?.endAt ?? time, s.actionDeadline ?? time); await h.drain();
      }
      throw new Error('round did not settle');
    },
    async next(who) { return h.send(who, 'next', { roundId: (await h.snap(who)).roundId }); },
    audit: async type => (await rows('SELECT body FROM croupier_game.shared_table_audit WHERE room_id=$1 ORDER BY seq'))
      .filter(row => row.type === type).map(row => JSON.parse(row.payload)),
    member: async who => (await rows('SELECT body FROM croupier_game.shared_table_members WHERE room_id=$1')).find(m => m.actorId === who),
    rejection: async (who, op, fields) => { try { await h.send(who, op, fields); } catch (error) { if (error instanceof TableError) return error.code; throw error; } return null; },
  };
  return h;
}

// alice sits on boxes 3-5, bets on 3 and 5, plays the round and stays online without pressing Nästa runda.
async function settledWithIdleOwner(h) {
  await h.join('alice', [3, 4, 5]);
  const s = await h.snap();
  for (const seat of [3, 5]) await h.send('alice', 'bet', { seat, field: 'main', chip: 5, windowId: s.windowId });
  await h.send('alice', 'ready', { windowId: s.windowId });
  const settled = await h.standAll();
  assert.equal(settled.phase, 'settled');
  // Her socket keeps her present (shared-room-channel.mjs touch), so no absence tick ever releases her boxes.
  for (let i = 0; i < 6; i++) { h.time += 60_000; await h.table.seen(ROOM, 'alice'); await h.drain(); }
  assert.equal((await h.snap()).phase, 'settled', 'nothing time-driven leaves a settled round while its owner is present');
  return settled;
}

test('a player without a box opens the next window of a settled round that a present, idle owner holds', async t => {
  const h = await setup(t);
  const settled = await settledWithIdleOwner(h);
  assert.deepEqual((await h.snap('bob')).me.seats, []);
  const plansBefore = h.plans.length;
  const reply = await h.next('bob');
  assert.equal(reply.replay, false);
  const s = await h.snap('bob');
  assert.equal(s.phase, 'bets');
  assert.notEqual(s.windowId, settled.windowId, 'a new betting window');
  assert.deepEqual(s.owners, [null, null, null, 'alice', null, 'alice', null], 'alice keeps the boxes she played; the unplayed box 4 is free');
  assert.deepEqual((await h.audit('seat.release')).map(({ playerId, boxes, reason, memberEnded }) => ({ playerId, boxes, reason, memberEnded })),
    [{ playerId: 'alice', boxes: [4], reason: 'unplayed', memberEnded: false }]);
  assert.deepEqual((await h.audit('player.next')).map(row => row.playerId), ['bob'], 'the next is audited with its actor');
  assert.equal(await h.member('bob'), undefined, 'the viewer gets no membership from it');
  assert.equal((await h.member('alice')).active, true);
  assert.deepEqual(h.plans.slice(plansBefore).map(p => p.players), [['bob']], 'next keeps its lock plan: its actor, leavers and the memberships the reset ends');
  assert.equal(h.exceeded, 0);
  // The new window is stamped (#547): alice gives up her boxes after FULL_TABLE.idleSeatMs without a bet.
  const room = (await h.store.read.room(ROOM));
  assert.deepEqual(room.windowAt, { windowId: s.windowId, at: h.time });
  assert.equal(room.lastAct.bob, undefined, 'a viewer has no seat clock');
  // bob now takes the free box and plays.
  assert.deepEqual((await h.join('bob', [4])).result.seats, [4]);
});

test('a republish during a settled round reaches the window a viewer opens; the settled round kept its own configuration', async t => {
  const h = await setup(t);
  await settledWithIdleOwner(h);
  await h.store.config.publish(ROOM, 'v2', { ...structuredClone(DEFAULT_CONFIG), chips: [5, 10, 25] });
  assert.equal((await h.snap()).configVersion, 'v1', 'the finished hand keeps the configuration it was played with');
  await h.next('bob');
  const s = await h.snap('bob');
  assert.equal(s.phase, 'bets');
  assert.equal(s.configVersion, 'v2', 'the next hand gets the newly published configuration');
  assert.deepEqual((await h.audit('presentation.window')).at(-1), { windowId: s.windowId, configVersion: 'v2' });
});

test('a viewer\'s next follows the same rules as a seated player\'s: settled, the plan over and the same round', async t => {
  const h = await setup(t);
  await h.join('alice', [2]);
  const open = await h.snap();
  assert.equal(await h.rejection('bob', 'next', { roundId: open.roundId }), 'ROUND_IN_PROGRESS', 'not in a betting window');
  await h.send('alice', 'bet', { seat: 2, field: 'main', chip: 5, windowId: open.windowId });
  await h.send('alice', 'ready', { windowId: open.windowId });
  const round = await h.snap();
  assert.equal(round.phase, 'round');
  assert.equal(await h.rejection('bob', 'next', { roundId: round.roundId }), 'ROUND_IN_PROGRESS', 'not during the round');
  const settled = await h.standAll();
  assert.equal(await h.rejection('bob', 'next', { roundId: 'another-round' }), 'STALE_COMMAND');
  assert.equal(await h.rejection('bob', 'bet', { seat: 3, field: 'main', chip: 5, windowId: settled.windowId }), 'NOT_SEATED',
    'every other command still needs a box');
  await h.next('bob');
  assert.equal((await h.snap()).phase, 'bets');
});

test('a player who takes a box in a settled round may also open the next window, and keeps that box', async t => {
  const h = await setup(t);
  await settledWithIdleOwner(h);
  await h.join('bob', [0]);
  await h.next('bob');
  const s = await h.snap('bob');
  assert.equal(s.phase, 'bets');
  assert.deepEqual(s.owners, ['bob', null, null, 'alice', null, 'alice', null]);
});
