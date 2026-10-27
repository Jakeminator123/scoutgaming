import test from 'node:test';
import assert from 'node:assert/strict';
import { createTableCoordinator } from '../services/game/games/blackjack/table/coordinator.mjs';
import { createMemoryTableStore } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

// K07 port of Kevin's agent's test/table-behaviours-kevin.mjs from origin/codex/kevin-k07-tester @ c17cdba2 (stacked on his K04 branch).
// Runs unchanged against main as it is: K02 core.mjs, the K03 coordinator.mjs/ports.mjs and the memory-store fixture
// test/fixtures/blackjack-table-memory-store.mjs. Nothing here depends on K04-only code (outbox payload.presentation, media
// catalogue, material-revision), so no assertion was dropped. Required by .githooks/pre-commit-full in gameplay/shared-blackjack. Kevin's original notes follow.

// K07 gap (K06-K07-forberedelse §2.1): five table behaviours Kevin's test/shared-table.test.mjs @ 5aa7ed10 covers and the
// K03 suite did not name: repeat bet, a returning player sitting down mid-hand, changing boxes mid-round, dropping an
// unbet box, opening a free box by betting on it, and a rename that keeps boxes, bets and a pending box change.
// Same harness shape as test/blackjack-table.mjs (memory store, deterministic random, explicit clock); no SQL.
function setup({ funds = { kevin: 1000, john: 1000, guest: 1000 } } = {}) {
  const store = createMemoryTableStore();
  let time = 100000, n = 0;
  const clock = { now: () => time };
  const table = createTableCoordinator({ store, clock, random: deterministicRandom('k07-behaviours') });
  for (const [p, amount] of Object.entries(funds)) store.test.fund(p, amount);
  const t = {
    store, table, get time() { return time; }, set time(v) { time = v; },
    snap: (who = 'kevin', room = 'party') => table.snapshot(room, who),
    send: (who, op, extra = {}, { room = 'party', name = null } = {}) => table.command({ actorId: who, ...(name ? { name } : {}) }, { roomId: room, op, commandId: `c${++n}`, ...extra }),
    async join(who, seats, { name = null } = {}) {
      const s = await t.snap(who);
      return t.send(who, 'join', { seats, seatGens: Object.fromEntries(seats.map(i => [i, s?.seatGen[i] ?? 0])), memberGen: s?.me.memberGen ?? 0 }, { name });
    },
    async bet(who, seat, chip, field = 'main') { return t.send(who, 'bet', { seat, field, chip, windowId: (await t.snap(who)).windowId }); },
    async ready(who) { return t.send(who, 'ready', { windowId: (await t.snap(who)).windowId }); },
    async act(who, action) {
      const s = await t.snap(who); time = Math.max(time, s.plan.turnAt);
      return t.send(who, 'act', { action, roundId: s.roundId, turnSeq: s.turnSeq, box: s.round.hands[s.round.active].box, handIndex: s.round.active });
    },
    async drain() { for (let i = 0; i < 100; i++) { const due = await table.dueTicks(); if (!due.length) return; for (const d of due) await table.tick(d); } throw new Error('scheduler did not settle'); },
    setShoe(ranks) { store.test.mutateRoom('party', r => { const c = r.game.shoe.cards; c.splice(-ranks.length, ranks.length, ...ranks.map((x, i) => ({ r: x, s: ['♠', '♦', '♥', '♣'][i % 4], serial: 900 + i })).reverse()); }); },
    // Everyone stands until the round is settled (the plan's end, then the settle tick).
    async standAll() {
      for (let i = 0; i < 20; i++) {
        const s = await t.snap();
        if (s.phase === 'settled') return s;
        if (s.phase === 'round' && s.round?.phase === 'decisions' && s.round.hands?.[s.round.active]) { await t.act(s.owners[s.round.hands[s.round.active].box], 'stand'); continue; }
        time = Math.max(time, s.plan?.endAt ?? time, s.actionDeadline ?? time); await t.drain();
      }
      throw new Error('round did not settle');
    },
    room: () => store.read.room('party'),
    members: () => store.read.members('party'),
  };
  return t;
}
const rejects = (promise, code) => assert.rejects(promise, e => e.code === code || assert.fail(`expected ${code}, got ${e.code}: ${e.message}`));

test('repeat puts the previous round\'s stakes back on the player\'s own boxes, never on another player\'s box (Kevin: CH feedback)', async () => {
  const t = setup();
  await t.join('kevin', [2, 3]); await t.join('john', [4]);
  await rejects(t.send('kevin', 'repeat', { windowId: (await t.snap()).windowId }), 'NO_REPEAT');
  t.setShoe(['10', '10', '10', '9', '9', '9', '8', '8']);
  await t.bet('kevin', 2, 25); await t.bet('kevin', 3, 10); await t.bet('kevin', 3, 5, 'pp'); await t.bet('john', 4, 100);
  await t.ready('kevin'); await t.ready('john');
  const settled = await t.standAll();
  assert.equal(settled.phase, 'settled');
  await t.send('kevin', 'next', { roundId: settled.roundId });
  const fresh = await t.snap(); assert.equal(fresh.phase, 'bets'); assert.notEqual(fresh.windowId, settled.windowId);
  const v = await t.send('kevin', 'repeat', { windowId: fresh.windowId });
  assert.deepEqual(v.snapshot.bets[2], { main: 25, pp: 0, tp: 0 }); assert.deepEqual(v.snapshot.bets[3], { main: 10, pp: 5, tp: 0 });
  assert.equal(v.snapshot.bets[4].main, 0, 'never touches another player\'s box');
  assert.equal(v.result.reserved, 40, 'the repeat is reserved like a fresh bet');
});

test('a returning player with no boxes can sit down while another hand is played (Kevin: CH report)', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.join('john', [4]);
  await t.send('john', 'leave', { memberGen: (await t.snap('john')).me.memberGen });
  assert.deepEqual((await t.snap('john')).me.seats, []);
  await t.bet('kevin', 3, 5); await t.ready('kevin');
  assert.equal((await t.snap()).phase, 'round');
  const v = await t.join('john', [4]);
  assert.deepEqual(v.result.seats, [4]); assert.equal((await t.snap('john')).me.active, true);
  assert.deepEqual((await t.snap()).round.hands.map(h => h.box), [3], 'the late box is not dealt into the running hand');
});

test('changing boxes mid-round gets the free ones now; a box still in play is released after the round (Kevin: feedback #7)', async () => {
  const t = setup();
  await t.join('kevin', [3, 4]);
  t.setShoe(['10', '9', '10', '7']);
  await t.bet('kevin', 3, 5); await t.ready('kevin');
  assert.equal((await t.snap()).phase, 'round');
  const v = await t.join('kevin', [4, 5]);
  assert.deepEqual([...v.result.seats].sort(), [3, 4, 5], 'box 3 holds a live hand, so it stays until the round ends');
  assert.deepEqual((await t.room()).boxesAfterRound.kevin, [4, 5]);
  const settled = await t.standAll();
  await t.send('kevin', 'next', { roundId: settled.roundId });
  const s = await t.snap();
  assert.deepEqual([...s.me.seats].sort(), [4, 5]); assert.equal(s.owners[3], null); assert.deepEqual((await t.room()).boxesAfterRound, {});
});

test('a player with two boxes can bet on one and drop the other, mid-round: the unbet box is released at once (Kevin: Serhiy)', async () => {
  const t = setup();
  await t.join('kevin', [3, 4]);
  t.setShoe(['10', '9', '10', '7']);
  await t.bet('kevin', 3, 5); await t.ready('kevin');
  const s = await t.snap();
  assert.equal(s.phase, 'round'); assert.deepEqual(s.round.hands.map(h => h.box), [3], 'the unbet box is simply not dealt');
  const v = await t.join('kevin', [3]);
  assert.equal(v.snapshot.owners[4], null, 'the empty box is released at once'); assert.deepEqual(v.result.seats, [3]);
  assert.equal(v.snapshot.seatGen[4], s.seatGen[4] + 1, 'its generation moves on, so a stale claim of box 4 is refused');
});

test('a seated player opens a free box by betting on it; another player\'s box, a side bet alone and an unseated guest cannot (Kevin: CH)', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.join('john', [5]);
  const v = await t.bet('kevin', 2, 25);
  assert.deepEqual([...v.snapshot.me.seats].sort(), [2, 3]); assert.equal(v.snapshot.bets[2].main, 25);
  await rejects(t.bet('kevin', 5, 5), 'NOT_YOUR_BOX');
  await rejects(t.bet('kevin', 6, 5, 'pp'), 'NOT_YOUR_BOX');
  assert.equal((await t.snap()).owners[6], null, 'a side bet alone does not open a box');
  await rejects(t.bet('guest', 1, 5), 'NOT_SEATED');
  assert.equal((await t.snap()).owners[1], null);
});

test('joining again with the boxes held renames the member and keeps bets, reservation, a live hand and a pending box change (Kevin: Emil #9)', async () => {
  const t = setup();
  await t.join('kevin', [3, 4], { name: 'Kevin' }); await t.join('john', [6], { name: 'John' });
  await t.bet('kevin', 3, 5);
  const before = await t.snap();
  const renamed = await t.join('kevin', [3, 4], { name: 'Kev' });
  assert.equal(renamed.result.memberGen, before.me.memberGen, 'an active member keeps its generation');
  assert.deepEqual(renamed.result.seats, [3, 4]); assert.equal(renamed.snapshot.bets[3].main, 5); assert.equal(renamed.snapshot.me.available, 995);
  assert.deepEqual((await t.members()).filter(m => m.active).map(m => [m.actorId, m.name]).sort(), [['john', 'John'], ['kevin', 'Kev']]);
  await t.send('john', 'leave', { memberGen: (await t.snap('john')).me.memberGen });
  t.setShoe(['10', '9', '10', '7']);
  await t.ready('kevin'); assert.equal((await t.snap()).phase, 'round');
  const changed = await t.join('kevin', [4, 5], { name: 'Kev' });
  assert.deepEqual((await t.room()).boxesAfterRound.kevin, [4, 5]);
  const hands = JSON.stringify(changed.snapshot.round.hands);
  const again = await t.join('kevin', [4, 5], { name: 'Kevin' });
  assert.equal(JSON.stringify(again.snapshot.round.hands), hands, 'the live hand is untouched by a rename');
  assert.deepEqual((await t.room()).boxesAfterRound.kevin, [4, 5], 'the pending box change stays');
  assert.equal((await t.members()).find(m => m.actorId === 'kevin').name, 'Kevin');
});

// Selective conversion from Kevin's branch (kevin @ f664c54d), behaviour only, in main's coordinator.
// 7ddb7de4d 'Table is full bugg': after a round the boxes not bet on in it are released; a box chosen during the round
// stays (a new claim, or a changed box set while a hand is live). Re-sending the same boxes, e.g. a rename, is no
// choice. The wait-queue half (at most 3 boxes while a viewer waits) is not ported: main's snapshot never writes.
test('after a round the boxes not bet on are released, a box chosen during the round stays (Kevin 24 Oct: table is full)', async () => {
  const t = setup();
  await t.join('guest', [0, 1, 2]); await t.join('john', [6]);
  t.setShoe(['10', '9', '10', '7']);
  await t.bet('guest', 1, 5);
  t.time = (await t.snap()).deadline; await t.drain();       // john sits in but bets nothing: the deadline starts it
  assert.deepEqual((await t.snap()).round.hands.map(h => h.box), [1]);
  await t.join('kevin', [5]);                                  // sits down during the round
  const settled = await t.standAll();
  assert.deepEqual(settled.owners, ['guest', 'guest', 'guest', null, null, 'kevin', 'john'], 'nothing is taken from a round in play');
  await t.send('guest', 'next', { roundId: settled.roundId });
  const s = await t.snap('john');
  assert.deepEqual(s.owners, [null, 'guest', null, null, null, 'kevin', null], 'only played boxes and the box taken mid-round stay');
  for (const i of [0, 2, 6]) assert.equal(s.seatGen[i], settled.seatGen[i] + 1, `box ${i}: a stale claim is refused`);
  assert.equal(s.me.active, false, 'john lost his last box, so his membership ends like a release');
  assert.equal(s.me.memberGen, 2);
  assert.deepEqual(s.players.map(p => p.id).sort(), ['guest', 'kevin']);
  await t.join('john', [6]);
  assert.deepEqual((await t.snap('john')).me.seats, [6], 'he can sit down again with the new generation');
  await t.bet('guest', 1, 5);
  assert.equal((await t.snap()).bets[1].main, 5, 'the player keeps betting on the box he played');
});

// Starts a round in which kevin bets on box 3 only; seated players without a bet hold their boxes through it.
async function roundWithBystanders(t) {
  t.setShoe(['10', '9', '10', '7', '9', '8']);
  await t.bet('kevin', 3, 5);
  t.time = (await t.snap()).deadline; await t.drain();         // a seated non-bettor is online, so the deadline starts it
  assert.equal((await t.snap()).phase, 'round');
}

test('joining again with the same boxes, mid-round or once it is settled, does not keep a box that was not bet on', async () => {
  const t = setup();
  await t.join('kevin', [3, 4]); await t.join('john', [5, 6], { name: 'John' });
  await roundWithBystanders(t);
  await t.join('john', [5, 6], { name: 'Johnny' });            // rename mid-round
  await t.join('kevin', [3, 4]);                                // a bettor re-sends his boxes mid-round
  const settled = await t.standAll();
  await t.join('john', [5, 6], { name: 'J' });                 // and again in the settled phase
  await t.send('kevin', 'next', { roundId: settled.roundId });
  const s = await t.snap('john');
  assert.deepEqual(s.owners, [null, null, null, 'kevin', null, null, null], 'only the played box stays');
  assert.equal(s.me.active, false); assert.equal(s.me.memberGen, 2);
  assert.equal((await t.members()).find(m => m.actorId === 'john').name, 'J', 'the renames themselves were applied');
});

test('an unbet box given up mid-round and claimed again in the same round stays: that is a choice made during it', async () => {
  const t = setup();
  await t.join('kevin', [3, 4]);
  await roundWithBystanders(t);
  await t.join('kevin', [3]);
  assert.equal((await t.snap()).owners[4], null, 'given up at once');
  await t.join('kevin', [3, 4]);
  const settled = await t.standAll();
  await t.send('kevin', 'next', { roundId: settled.roundId });
  assert.deepEqual((await t.snap()).me.seats, [3, 4]);
});

test('a seat holder who bet nothing and leaves mid-round is released; next still opens the window', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.join('john', [6]);
  await roundWithBystanders(t);
  await t.send('john', 'leave', { memberGen: (await t.snap('john')).me.memberGen });
  assert.ok((await t.snap()).players.find(p => p.id === 'john').leaving);
  const settled = await t.standAll();
  await t.send('kevin', 'next', { roundId: settled.roundId });
  const s = await t.snap('john');
  assert.equal(s.phase, 'bets'); assert.notEqual(s.windowId, settled.windowId);
  assert.deepEqual(s.owners, [null, null, null, 'kevin', null, null, null]);
  assert.equal(s.me.active, false); assert.equal(s.me.memberGen, 2, 'ended once, not twice');
});

test('the last owner released by a tick after a round with an unbet box resets the table without locking anyone else', async () => {
  const t = setup();
  await t.join('kevin', [3, 4]); await t.join('john', [6]);
  await roundWithBystanders(t);
  await t.send('john', 'leave', { memberGen: (await t.snap('john')).me.memberGen });
  const settled = await t.standAll();                           // its drain also runs john's leave release
  assert.equal(settled.phase, 'settled'); assert.deepEqual(settled.owners, [null, null, null, 'kevin', 'kevin', null, null]);
  t.time = (await t.store.read.presence('party', 'kevin')) + 120000; await t.drain();   // kevin absent: seat.release
  const s = await t.snap();
  assert.equal(s.phase, 'bets', 'the release of the last owner reset the table'); assert.notEqual(s.windowId, settled.windowId);
  assert.deepEqual(s.owners, Array(7).fill(null));
  for (const p of ['kevin', 'john']) assert.deepEqual([(await t.snap(p)).me.active, (await t.snap(p)).me.memberGen], [false, 2], p);
  const releases = t.store.test.ticks().filter(x => x.kind === 'seat.release');
  assert.deepEqual(releases.map(x => x.outcome), ['applied', 'applied']);
  assert.equal(t.store.test.stats.lockRetries, 0, 'no tick needed a lock outside its plan');
});

test('next locks only the players who lose their last box, never one who keeps a box', async () => {
  const t = setup();
  await t.join('guest', [0, 1, 2]); await t.join('kevin', [3]); await t.join('john', [6]);
  await t.bet('guest', 1, 5);
  await roundWithBystanders(t);
  const settled = await t.standAll();
  const plans = [], runLocked = t.store.runLocked;
  t.store.runLocked = (plan, work) => { plans.push(plan); return runLocked(plan, work); };
  await t.send('kevin', 'next', { roundId: settled.roundId });
  assert.deepEqual(plans.map(p => p.players), [['john', 'kevin']], 'guest keeps box 1, so only john (and the actor) is locked');
  const s = await t.snap('guest');
  assert.deepEqual(s.owners, [null, 'guest', null, 'kevin', null, null, null]);
  assert.equal(s.me.active, true); assert.equal((await t.snap('john')).me.active, false);
});

// fd6e7dd17 'tick skips quiet rooms': main's scheduler never loads and saves a room just to look at it (dueTicks is
// read-only), but it still read every member and presence row of a room nobody sits at. A quiet room costs one read.
test('dueTicks reads no members or presence of a room nobody sits at, and still runs the table that plays (Kevin 24 Oct: prod CPU)', async () => {
  const store = createMemoryTableStore();
  let time = 100000, n = 0;
  const reads = [];
  const counted = { ...store, read: Object.fromEntries(Object.entries(store.read).map(([k, f]) => [k, (...a) => { reads.push([k, ...a]); return f(...a); }])) };
  const table = createTableCoordinator({ store: counted, clock: { now: () => time }, random: deterministicRandom('k07-quiet') });
  for (const p of ['kevin', 'john', 'guest']) store.test.fund(p, 1000);
  const send = (who, room, op, extra = {}) => table.command({ actorId: who }, { roomId: room, op, commandId: `q${++n}`, ...extra });
  const join = async (who, room, seats) => { const s = await table.snapshot(room, who);
    return send(who, room, 'join', { seats, seatGens: Object.fromEntries(seats.map(i => [i, s?.seatGen[i] ?? 0])), memberGen: s?.me.memberGen ?? 0 }); };
  for (let i = 0; i < 20; i++) {                            // studio tables someone once sat at and left
    const room = `quiet-${i}`;
    await join('guest', room, [0]); await send('guest', room, 'leave', { memberGen: (await table.snapshot(room, 'guest')).me.memberGen });
  }
  await join('john', 'party', [4]); await send('john', 'party', 'leave', { memberGen: (await table.snapshot('party', 'john')).me.memberGen });
  await join('kevin', 'party', [3]); await send('kevin', 'party', 'bet', { seat: 3, field: 'main', chip: 5, windowId: (await table.snapshot('party', 'kevin')).windowId });
  const { deadline } = await table.snapshot('party', 'kevin');
  reads.length = 0;
  assert.deepEqual(await table.dueTicks(deadline - 1), []);
  assert.deepEqual(reads.filter(([k]) => k === 'members').map(([, room]) => room), ['party'], 'members are read only where someone sits');
  assert.deepEqual(reads.filter(([k]) => k === 'presence').map(([, room, p]) => [room, p]), [['party', 'kevin']], 'presence only of a seated member');
  time = deadline;
  const due = await table.dueTicks();
  assert.deepEqual(due.map(d => [d.roomId, d.kind]), [['party', 'window.close']]);
  assert.equal((await table.tick(due[0])).outcome, 'applied');
  assert.equal((await table.snapshot('party', 'kevin')).phase, 'round', 'the seated table still starts its round');
});
