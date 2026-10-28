// K03 contract tests: the shared table coordinator against the in-memory reference adapter.
// Covers AKTIVITETER K03 "Verifiering/bevis" and O01-svar 2.12 without SQL or a database.
// Real Postgres atomicity and locks are J07's to prove (and K07's to co-test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createTableCoordinator } from '../services/game/games/blackjack/table/coordinator.mjs';
import { chainRow, GENESIS } from '../services/game/games/blackjack/table/audit-chain.mjs';
import { createPresentationGate, tickIdOf, WalletDenied, LockSetExceeded } from '../services/game/games/blackjack/table/ports.mjs';
import { createMemoryTableStore } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';
import { nativeRoomMaterialFixture, withNativeFilmTransitions } from './fixtures/native-room-game-material.mjs';
import { resolveNativeRoomGameMaterial } from '../packages/presentation/server/native-room-game-material.mjs';
import { presentationForRow } from '../services/game/games/blackjack/presentation/outbox-presentation.mjs';

function setup({ hooks, funds = { kevin: 1000, john: 1000, ana: 1000 } } = {}) {
  const store = createMemoryTableStore({ hooks });
  let time = 100000, n = 0;
  const clock = { now: () => time };
  const random = deterministicRandom('k03-table');
  let table = createTableCoordinator({ store, clock, random });
  for (const [p, amount] of Object.entries(funds)) store.test.fund(p, amount);
  const t = {
    store, get table() { return table; }, get time() { return time; }, set time(v) { time = v; },
    restart() { table = createTableCoordinator({ store, clock, random }); },
    snap: (who = 'kevin', room = 'party') => table.snapshot(room, who),
    send: (who, op, extra = {}, room = 'party', commandId = `c${++n}`) => table.command({ actorId: who }, { roomId: room, op, commandId, ...extra }),
    async join(who, seats, room = 'party') {
      const s = await t.snap(who, room);
      const seatGens = Object.fromEntries(seats.map(i => [i, s?.seatGen[i] ?? 0]));
      return t.send(who, 'join', { seats, seatGens, memberGen: s?.me.memberGen ?? 0 }, room);
    },
    async bet(who, seat, chip, room = 'party', field = 'main') { return t.send(who, 'bet', { seat, field, chip, windowId: (await t.snap(who, room)).windowId }, room); },
    async ready(who, room = 'party') { return t.send(who, 'ready', { windowId: (await t.snap(who, room)).windowId }, room); },
    async act(who, action, room = 'party') {
      const s = await t.snap(who, room);
      time = Math.max(time, s.plan.turnAt);
      return t.send(who, 'act', { action, roundId: s.roundId, turnSeq: s.turnSeq, box: s.round.hands[s.round.active].box, handIndex: s.round.active }, room);
    },
    async insurance(who, take, room = 'party') {
      const s = await t.snap(who, room);
      time = Math.max(time, s.plan.turnAt);
      return t.send(who, 'insurance', { take, roundId: s.roundId, phase: 'insurance' }, room);
    },
    // The independent scheduler: run everything due now, until nothing is due.
    async drain() {
      const ran = [];
      for (let i = 0; i < 100; i++) {
        const due = await table.dueTicks();
        if (!due.length) return ran;
        for (const d of due) ran.push(await table.tick(d));
      }
      throw new Error('scheduler did not settle');
    },
    async finish(room = 'party') { const s = await t.snap('kevin', room); time = Math.max(time, s.plan.endAt); return t.drain(); },
    setShoe(room, ranks) {
      store.test.mutateRoom(room, r => { const c = r.game.shoe.cards; c.splice(-ranks.length, ranks.length, ...ranks.map((x, i) => ({ r: x, s: ['♠', '♦', '♥', '♣'][i % 4], serial: 900 + i })).reverse()); });
    },
    auditTypes: room => store.test.audit().filter(e => !room || e.room === room).map(e => e.type),
  };
  return t;
}
const rejects = (promise, code) => assert.rejects(promise, e => e.code === code || assert.fail(`expected ${code}, got ${e.code}: ${e.message}`));

// Built once (Brotli-packed fixture material is slow to encode); every caller gets its own deep copy.
const nativeBase = (() => {
  const fixture = nativeRoomMaterialFixture(), material = resolveNativeRoomGameMaterial(fixture.input);
  return { material, language: material.language, leadMs: material.leadMs, cardMs: material.cardMs };
})();
function nativeConfig() { return structuredClone(nativeBase); }
async function durableState(t) {
  return { room: await t.store.read.room('party'), members: await t.store.read.members('party'),
    balance: t.store.test.balance('kevin'), ledger: t.store.test.ledger(), reservations: t.store.test.reservations(),
    audit: t.store.test.audit(), outbox: t.store.test.outbox(), receipts: t.store.test.receipts(), ticks: t.store.test.ticks() };
}

test('native material drives real start, double, insurance and next-window presentation without changing wallet ownership', async () => {
  for (const scenario of ['double', 'insurance']) {
    const t = setup(), cfg = nativeConfig(); t.store.test.publish('native-v1', cfg);
    await t.join('kevin', [0]); await t.bet('kevin', 0, 25);
    t.setShoe('party', scenario === 'double' ? ['5','6','6','10','10','10'] : ['10','A','9','9','2']);
    await t.ready('kevin');
    const first = await t.snap();
    assert.equal(first.plan.endAt - first.plan.startAt, cfg.leadMs + 4 * cfg.cardMs);
    if (scenario === 'double') await t.act('kevin', 'double');
    else { await t.insurance('kevin', false); await t.act('kevin', 'stand'); }
    await t.finish();
    const settled = await t.snap(); assert.equal(settled.phase, 'settled');
    await t.send('kevin', 'next', { roundId: settled.roundId });
    const rows = t.store.test.outbox(), plans = rows.filter(row => row.payload.presentation.kind === 'plan');
    assert.ok(plans.length >= 2);
    for (const row of plans) {
      const events = presentationForRow(row).events, draws = events.filter(event => event.type === 'deal').length;
      assert.equal(row.payload.endAt - row.payload.startAt, cfg.leadMs + draws * cfg.cardMs);
    }
    assert.deepEqual(presentationForRow(rows.at(-1)).events.map(({type,line}) => ({type,...(line ? {line} : {})})),
      [{type:'speak',line:'placebets'},{type:'idle'}]);
    assert.equal(t.store.test.balance('kevin'), 1000 + t.store.test.ledger().reduce((sum,row) => sum + row.amountCents / 100, 0));
    assert.equal((await t.store.audit.verifyChain()).ok, true);
  }
});

test('native budget failure rolls back ready and due-tick shoe, wallet, audit, receipt and outbox effects', async () => {
  for (const trigger of ['ready', 'tick']) {
    const t = setup(), cfg = nativeConfig(); t.store.test.publish('native-v1', {...cfg, cardMs: cfg.cardMs - 1});
    await t.join('kevin', [0]); await t.bet('kevin', 0, 25);
    t.setShoe('party', ['8','6','9','10','5']);
    if (trigger === 'tick') t.time = (await t.snap()).deadline;
    const before = await durableState(t);
    const invoke = trigger === 'ready' ? () => t.ready('kevin') : async () => t.table.tick((await t.table.dueTicks()).find(row => row.kind === 'window.close'));
    await rejects(invoke(), 'native_room_sequence_unsupported');
    assert.deepEqual(await durableState(t), before);
    t.store.test.publish('native-v1', cfg);
    await invoke(); assert.equal(t.store.test.ledger().filter(row => row.kind === 'consume:stake').length, 1);
  }
});

test('native sequence guard rejects a core draw/public-event disagreement atomically', async () => {
  const t = setup(); t.store.test.publish('native-v1', nativeConfig());
  await t.join('kevin', [0]); await t.bet('kevin', 0, 25);
  t.setShoe('party', ['8','6','9','10','5']);
  // Deliberately corrupt this test-only proof: the core audit now reports one
  // additional draw that its authoritative public card view cannot present.
  t.store.test.mutateRoom('party', room => room.game.shoe.proof.draws.push({ position: 100000, kind: 'deal', card: {r:'2',s:'h',serial:100000} }));
  const before = await durableState(t);
  await rejects(t.ready('kevin'), 'native_room_sequence_unsupported');
  assert.deepEqual(await durableState(t), before);
});

test('native next-window guard rolls back a reset when the newly frozen budget is inconsistent', async () => {
  const t = setup(), cfg = nativeConfig(); t.store.test.publish('native-v1', cfg);
  await t.join('kevin', [0]); await t.bet('kevin', 0, 25);
  t.setShoe('party', ['A','9','K','7']); await t.ready('kevin'); await t.finish();
  const settled = await t.snap(); assert.equal(settled.phase, 'settled');
  t.store.test.publish('native-v2', {...cfg, leadMs: cfg.leadMs - 1});
  const before = await durableState(t);
  await rejects(t.send('kevin', 'next', {roundId:settled.roundId}), 'native_room_sequence_unsupported');
  assert.deepEqual(await durableState(t), before);
  t.store.test.publish('native-v2', cfg);
  await t.send('kevin', 'next', {roundId:settled.roundId});
  assert.equal((await t.snap()).configVersion, 'native-v2');
});

test('tick actor metadata is captured once from the successful lock attempt, never rollback or replay',async()=>{
  const h=setup();await h.join('kevin',[0]);await h.bet('kevin',0,25);
  h.time=(await h.snap()).deadline;const desc=(await h.table.dueTicks()).find(row=>row.kind==='window.close');
  const original=h.store.runLocked;let attempts=0;
  h.store.runLocked=(plan,work)=>original(plan,async tx=>{const result=await work(tx);if(++attempts===1)throw new LockSetExceeded({players:['kevin']});return result;});
  const captures=[];const result=await h.table.tick(desc,{captureActors:actors=>captures.push(actors)});
  assert.equal(result.outcome,'applied');assert.equal(attempts,2);assert.deepEqual(captures,[['kevin']]);assert.ok(Object.isFrozen(captures[0]));
  await h.table.tick(desc,{captureActors:actors=>captures.push(actors)});assert.equal(captures.length,1);
  assert.equal(h.store.test.ledger().length,1,'the rolled-back attempt did not debit twice');
});

test('post-commit actor observers cannot reject a durable tick on sync throw or async rejection',async()=>{
  for(const asynchronous of [false,true]){
    const h=setup();await h.join('kevin',[0]);await h.bet('kevin',0,25);
    h.time=(await h.snap()).deadline;const desc=(await h.table.dueTicks()).find(row=>row.kind==='window.close');
    const failure=Error('capture observer failed');let calls=0;
    const captureActors=()=>{calls++;if(asynchronous)return Promise.reject(failure);throw failure;};
    const result=await h.table.tick(desc,{captureActors});assert.equal(result.outcome,'applied');
    assert.equal(h.store.test.ledger().length,1);assert.equal((await h.snap()).phase,'round');
    const replay=await h.table.tick(desc,{captureActors});assert.equal(replay.replay,true);assert.equal(calls,1);
    assert.equal(h.store.test.ledger().length,1);
  }
});

test('two players in two rooms: shared shoe and deadline per room, isolated rooms, one global chain', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.join('john', [4]); await t.join('ana', [2], 'lounge');
  await t.bet('kevin', 3, 5); await t.bet('john', 4, 25); await t.bet('ana', 2, 100, 'lounge');
  const k = await t.snap('kevin'), j = await t.snap('john');
  assert.equal(k.deadline, j.deadline); assert.deepEqual(k.shoe, j.shoe); assert.deepEqual(k.bets, j.bets);
  assert.equal(k.me.available, 995, 'the bet is a reservation, not a debit'); assert.equal(t.store.test.balance('kevin'), 1000);
  assert.deepEqual((await t.snap('ana', 'lounge')).players.map(p => p.id), ['ana'], 'rooms do not share players');
  assert.equal((await t.ready('john')).result.started, false);
  const started = await t.ready('kevin');
  assert.equal(started.result.started, true); assert.equal(started.snapshot.phase, 'round');
  assert.equal(t.store.test.balance('kevin'), 995); assert.equal(t.store.test.balance('john'), 975);
  assert.equal((await t.snap('ana', 'lounge')).phase, 'bets', 'the other room is untouched');
  // Event sequence for the start, parented to the player's command.
  const party = t.auditTypes('party');
  assert.deepEqual(party.slice(party.indexOf('player.ready', party.indexOf('player.ready') + 1)), ['player.ready', 'round.started', 'engine.start', 'presentation.plan']);
  // The other room's window closes by the scheduler, not by any command.
  t.time = (await t.snap('ana', 'lounge')).deadline;
  const ran = await t.drain();
  assert.deepEqual(ran.filter(r => r.room === 'lounge').map(r => [r.kind, r.outcome]), [['window.close', 'applied']]);
  assert.equal(t.store.test.balance('ana'), 900);
  assert.deepEqual(t.store.test.ledger().map(r => [r.playerId, r.kind, r.amountCents]),
    [['john', 'consume:stake', -2500], ['kevin', 'consume:stake', -500], ['ana', 'consume:stake', -10000]], 'expected ledger, no personal data');
  assert.equal((await t.store.audit.verifyChain()).ok, true);
});

test('concurrent seat claims: one wins, the other is refused; stale seat generation is refused', async () => {
  const t = setup();
  await t.join('ana', [0]);
  const [a, b] = await Promise.allSettled([
    t.send('kevin', 'join', { seats: [3], seatGens: { 3: 0 }, memberGen: 0 }), t.send('john', 'join', { seats: [3], seatGens: { 3: 0 }, memberGen: 0 })]);
  assert.deepEqual([a.status, b.status].sort(), ['fulfilled', 'rejected']);
  assert.equal([a, b].find(x => x.status === 'rejected').reason.code, 'SEAT_TAKEN');
  const s = await t.snap('ana');
  assert.equal(s.seatGen[3], 1); assert.equal(s.owners.filter(Boolean).length, 2);
  const winner = s.owners[3];
  await t.send(winner, 'leave', { memberGen: (await t.snap(winner)).me.memberGen });
  await rejects(t.send('ana', 'join', { seats: [0, 3], seatGens: { 3: 1 }, memberGen: 1 }), 'STALE_COMMAND');
  await t.send('ana', 'join', { seats: [0, 3], seatGens: { 3: 2 }, memberGen: 1 });
  assert.deepEqual((await t.snap('ana')).me.seats, [0, 3]);
});

test('duplicate commands: stored result, no second effect; other input is refused; a refused command leaves nothing', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.join('john', [4]);
  const windowId = (await t.snap()).windowId;
  const bet = { seat: 3, field: 'main', chip: 25, windowId };
  const audits = () => t.store.test.audit().length;
  const first = await t.send('kevin', 'bet', bet, 'party', 'b1');
  const before = audits();
  const again = await t.send('kevin', 'bet', bet, 'party', 'b1');
  assert.equal(again.replay, true); assert.deepEqual(again.result, first.result);
  assert.equal(audits(), before, 'replay writes no audit'); assert.equal((await t.snap()).bets[3].main, 25);
  await rejects(t.send('kevin', 'bet', { ...bet, chip: 5 }, 'party', 'b1'), 'REQUEST_REUSED');
  // Refused: no receipt, no audit; the same id may then be used with corrected input.
  const receipts = t.store.test.receipts(), a0 = audits();
  await rejects(t.send('kevin', 'bet', { ...bet, chip: 7 }, 'party', 'b2'), 'INVALID_CHIP');
  assert.equal(t.store.test.receipts(), receipts); assert.equal(audits(), a0);
  await t.send('kevin', 'bet', { ...bet, chip: 5 }, 'party', 'b2');
  // Two concurrent identical commands: one effect.
  const ready = { windowId };
  const pair = await Promise.all([t.send('john', 'bet', { ...bet, seat: 4 }, 'party', 'j1'), t.send('john', 'bet', { ...bet, seat: 4 }, 'party', 'j1')]);
  assert.deepEqual(pair.map(x => x.replay).sort(), [false, true]);
  assert.equal((await t.snap()).bets[4].main, 25);
  // Over the deadline: the replay returns the stored result and drives no time (no tick, no audit).
  t.time = (await t.snap()).deadline + 1;
  const a1 = audits();
  const late = await Promise.all([t.send('john', 'bet', { ...bet, seat: 4 }, 'party', 'j1'), t.send('john', 'bet', { ...bet, seat: 4 }, 'party', 'j1')]);
  assert.ok(late.every(x => x.replay)); assert.equal(audits(), a1); assert.equal(t.store.test.ticks().length, 0);
  assert.equal((await t.snap()).phase, 'bets', 'only the scheduler starts the round');
  await rejects(t.send('john', 'ready', ready), 'BETTING_CLOSED');
  const ran = await t.drain();
  assert.deepEqual(ran.map(r => r.outcome), ['applied']);
  assert.equal(t.store.test.balance('john'), 975);
  assert.equal((await t.send('john', 'bet', { ...bet, seat: 4 }, 'party', 'j1')).replay, true, 'replay after the start still answers from the receipt');
  assert.equal(t.store.test.balance('john'), 975);
});

test('stale identity is refused per command: window, round, turn, member generation', async () => {
  const t = setup();
  await t.join('kevin', [3]);
  const oldWindow = (await t.snap()).windowId;
  t.setShoe('party', ['10', '9', '10', '7']);
  await t.bet('kevin', 3, 25); await t.ready('kevin');
  const s = await t.snap();
  t.time = s.plan.turnAt;
  await rejects(t.send('kevin', 'bet', { seat: 3, field: 'main', chip: 5, windowId: oldWindow }), 'BETTING_CLOSED');
  await rejects(t.send('kevin', 'act', { action: 'stand', roundId: 'other', turnSeq: s.turnSeq, box: 3, handIndex: 0 }), 'STALE_COMMAND');
  await rejects(t.send('kevin', 'act', { action: 'stand', roundId: s.roundId, turnSeq: s.turnSeq - 1, box: 3, handIndex: 0 }), 'STALE_COMMAND');
  await rejects(t.send('kevin', 'leave', { memberGen: 7 }), 'STALE_COMMAND');
  await t.act('kevin', 'stand'); await t.finish();
  const settled = await t.snap();
  assert.equal(settled.phase, 'settled');
  await rejects(t.send('kevin', 'next', { roundId: 'other' }), 'STALE_COMMAND');
  await t.send('kevin', 'next', { roundId: settled.roundId });
  assert.notEqual((await t.snap()).windowId, oldWindow);
  await rejects(t.send('kevin', 'bet', { seat: 3, field: 'main', chip: 5, windowId: oldWindow }), 'STALE_COMMAND');
});

test('disconnect: snapshot and deadlines are reconstructed after restart; absence, auto-stand, settle and release are ticks', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.join('john', [4]);
  await t.bet('kevin', 3, 25); await t.bet('john', 4, 25);
  const before = await t.snap('kevin');
  t.restart();
  const after = await t.snap('kevin');
  for (const k of ['deadline', 'windowId', 'bets', 'owners', 'seatGen', 'version', 'configVersion']) assert.deepEqual(after[k], before[k], k);
  assert.equal(after.me.available, 975);
  t.time = before.deadline - 1; assert.deepEqual(await t.table.dueTicks(), []);
  t.time = before.deadline; await t.drain();
  const round = await t.snap('john');
  assert.equal(round.phase, 'round');
  t.restart();
  assert.equal((await t.snap('john')).actionDeadline, round.actionDeadline, 'action deadline survives restart');
  // Kevin disconnects mid-round (last seen at his bet, t=100000); John keeps polling (seen).
  t.time = 100000 + 120000 + 1; await t.table.seen('party', 'john'); await t.drain();
  for (let i = 0; i < 8 && (await t.snap('john')).phase !== 'bets'; i++) { t.time += 30000; await t.table.seen('party', 'john'); await t.drain(); }
  const kinds = t.store.test.ticks().filter(x => x.outcome === 'applied').map(x => x.kind);
  for (const kind of ['window.close', 'seat.absent', 'turn.autostand', 'round.settle', 'seat.release']) assert.ok(kinds.includes(kind), kind);
  const end = await t.snap('kevin');
  assert.equal(end.owners[3], null); assert.equal(end.owners[4], 'john');
  assert.equal(end.me.active, false); assert.equal(end.me.memberGen, 2, 'final release bumps memberGen');
  assert.ok(end.me.lastSettlement, 'the settlement receipt is kept for the reconnecting player');
});

test('ticks are idempotent: the same tickId twice (also concurrently) gives one effect', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.bet('kevin', 3, 25);
  t.time = (await t.snap()).deadline;
  const [due] = await t.table.dueTicks();
  assert.equal(due.tickId, `party:window.close:${(await t.snap()).windowId}:${t.time}`);
  const [a, b] = await Promise.all([t.table.tick(due), t.table.tick(due)]);
  assert.equal(a.outcome, 'applied'); assert.equal(b.replay, true);
  assert.equal((await t.table.tick(due)).replay, true);
  assert.equal(t.store.test.ticks().length, 1);
  assert.equal(t.auditTypes().filter(x => x === 'table.tick').length, 1);
  assert.equal(t.store.test.ledger().length, 1); assert.equal(t.store.test.balance('kevin'), 975);
});

test('a tick called before it is due writes nothing and still runs when due', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.bet('kevin', 3, 25);
  const deadline = (await t.snap()).deadline;
  t.time = deadline;
  const [due] = await t.table.dueTicks();
  t.time = deadline - 1;
  assert.equal((await t.table.tick(due)).outcome, 'not_due');
  assert.equal(t.store.test.ticks().length, 0); assert.ok(!t.auditTypes().includes('table.tick'));
  t.time = deadline;
  assert.equal((await t.table.tick(due)).outcome, 'applied');
});

test('blocked consume: choices and reservations stay, no retry loop, restart keeps the stop, retry only after a change', async () => {
  const t = setup({ funds: { kevin: 100, john: 100 } });
  await t.join('kevin', [3]); await t.join('john', [4]);
  await t.bet('kevin', 3, 100); await t.bet('john', 4, 100);
  t.store.test.uncoveredDebit('john', 50);               // a writer outside the reservation contract
  t.time = (await t.snap()).deadline;
  const [blocked] = await t.drain();
  assert.equal(blocked.outcome, 'blocked'); assert.equal(blocked.blockedOn[0].playerId, 'john');
  const s = await t.snap();
  assert.equal(s.phase, 'bets'); assert.equal(s.bets[3].main, 100); assert.equal(s.bets[4].main, 100);
  assert.equal(Object.keys(t.store.test.reservations()).length, 2, 'no reservation released');
  assert.equal(t.store.test.ledger().filter(r => r.kind.startsWith('consume')).length, 0, 'no debit, no round start');
  assert.ok(!t.auditTypes().includes('round.started'));
  assert.deepEqual(JSON.parse(t.store.test.audit().at(-1).payload), { tickId: blocked.tickId, kind: 'window.close', outcome: 'blocked' });
  assert.deepEqual(await t.drain(), [], 'the same state is never tried twice');
  t.restart(); t.time += 60000;
  assert.deepEqual(await t.drain(), [], 'restart reads the same stop');
  await rejects(t.bet('kevin', 3, 5), 'BETTING_CLOSED');
  t.store.test.fund('john', 10);                         // a change, still not enough
  const [retry1] = await t.drain();
  assert.equal(retry1.tickId, `${blocked.tickId}:retry:1`); assert.equal(retry1.outcome, 'blocked');
  assert.deepEqual(await t.drain(), []);
  await t.send('john', 'refill');
  const [retry2] = await t.drain();
  assert.equal(retry2.tickId, `${blocked.tickId}:retry:2`); assert.equal(retry2.outcome, 'applied');
  assert.equal((await t.snap()).phase, 'round');
  assert.equal(t.store.test.ledger().filter(r => r.kind === 'consume:stake').length, 2);
});

for (const [label, change] of [['missing', (all, id) => { delete all[id]; }], ['too small', (all, id) => { all[id].amount = 50; }]]) {
  test(`stake reservation ${label} at window.close: blocked, no effect, no retry loop, one retry once restored`, async () => {
    const t = setup();
    await t.join('kevin', [3]); await t.join('john', [4]);
    await t.bet('kevin', 3, 100); await t.bet('john', 4, 100);
    const johnRes = `party:${(await t.snap()).windowId}:john:stake`;
    const saved = t.store.test.reservations()[johnRes];
    t.store.test.mutateReservations(all => change(all, johnRes));   // another wallet writer
    t.time = (await t.snap()).deadline;
    const before = { ledger: t.store.test.ledger().length, balances: ['kevin', 'john'].map(p => t.store.test.balance(p)), outbox: t.store.test.outbox().length };
    const [blocked, ...more] = await t.drain();
    assert.equal(more.length, 0);
    assert.equal(blocked.outcome, 'blocked'); assert.deepEqual(blocked.result, { waitingOn: 'john' });
    assert.deepEqual(blocked.blockedOn, [{ playerId: 'john', reservationId: johnRes, walletGen: 1, reservationGen: label === 'missing' ? null : saved.gen }]);
    const s = await t.snap();
    assert.equal(s.phase, 'bets'); assert.equal(s.roundId, null); assert.ok(!t.auditTypes().includes('round.started'));
    assert.ok(!t.auditTypes().some(x => x.startsWith('engine.')), 'no game effect');
    assert.deepEqual({ ledger: t.store.test.ledger().length, balances: ['kevin', 'john'].map(p => t.store.test.balance(p)), outbox: t.store.test.outbox().length }, before, 'no wallet effect');
    // Generations unchanged: never offered again, and a direct retry call writes nothing.
    for (let i = 0; i < 5; i++) { t.time += 1000; assert.deepEqual(await t.table.dueTicks(), []); }
    t.restart();
    assert.deepEqual(await t.table.dueTicks(), [], 'restart reads the same stop');
    const forced = await t.table.tick({ ...blocked, tickId: `${blocked.tickId}:retry:1`, roomId: 'party', kind: 'window.close',
      baseTickId: blocked.tickId, retry: 1, blockedPlayers: ['john'] });
    assert.equal(forced.outcome, 'not_due'); assert.equal(t.store.test.ticks().length, 1);
    // Restored reservation (new generation): exactly one successful retry.
    t.store.test.mutateReservations(all => { all[johnRes] = { ...saved, gen: saved.gen + 1 }; });
    const due = await t.table.dueTicks();
    assert.deepEqual(due.map(d => d.tickId), [`${blocked.tickId}:retry:1`]);
    const ran = await t.drain();
    assert.deepEqual(ran.map(r => [r.tickId, r.outcome]), [[`${blocked.tickId}:retry:1`, 'applied']]);
    assert.equal((await t.snap()).phase, 'round');
    assert.equal(t.store.test.ledger().filter(r => r.kind === 'consume:stake').length, 2);
    assert.equal(t.store.test.balance('john'), 900);
    assert.equal(t.store.test.ticks().filter(x => x.kind === 'window.close').length, 2);
  });
}

test('an infrastructure error at window.close rolls back fully and writes no blocked receipt', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.bet('kevin', 3, 25);
  t.time = (await t.snap()).deadline;
  const audits = t.store.test.audit().length, before = await t.snap();
  const [due] = await t.table.dueTicks();
  t.store.test.failOnce('wallet.reservation');
  await assert.rejects(t.table.tick(due), /injected failure: wallet.reservation/);
  assert.equal(t.store.test.ticks().length, 0, 'no tick receipt, blocked or otherwise');
  assert.equal(t.store.test.audit().length, audits, 'no audit row');
  assert.equal(t.store.test.ledger().length, 0); assert.equal(t.store.test.balance('kevin'), 1000);
  assert.deepEqual(await t.snap(), before);
  const [again] = await t.table.dueTicks();
  assert.equal(again.tickId, due.tickId, 'the same tick is offered again');
  assert.equal((await t.table.tick(again)).outcome, 'applied');
});

test('insurance yes is binding across pause and leave and is consumed when the phase resolves', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.join('john', [4]);
  await t.bet('kevin', 3, 10); await t.bet('john', 4, 10);
  t.setShoe('party', ['8', '9', 'A', '8', '9', '5']);
  await t.ready('kevin'); await t.ready('john');
  assert.equal((await t.snap()).me.insuranceDue, true);
  await t.insurance('kevin', true);
  assert.equal((await t.snap()).me.available, 985);
  await t.send('kevin', 'pause', {});
  await t.send('kevin', 'leave', { memberGen: (await t.snap()).me.memberGen });
  assert.equal(Object.values(t.store.test.reservations()).filter(r => r.kind === 'insurance').length, 1, 'pause and leave keep the yes');
  t.time = (await t.snap()).actionDeadline;
  const ran = await t.drain();
  assert.equal(ran[0].kind, 'insurance.timeout');
  const ins = t.store.test.ledger().filter(r => r.kind === 'consume:insurance');
  assert.deepEqual(ins.map(r => [r.playerId, r.amountCents]), [['kevin', -500]]);
  assert.equal(Object.keys(t.store.test.reservations()).length, 0);
});

// Kevin takes insurance (box 3), John's choice is still open; the dealer shows an ace.
async function insuranceRound(funds) {
  const t = setup(funds && { funds });
  await t.join('kevin', [3]); await t.join('john', [4]);
  await t.bet('kevin', 3, 10); await t.bet('john', 4, 10);
  t.setShoe('party', ['8', '9', 'A', '8', '9', '5']);
  await t.ready('kevin'); await t.ready('john');
  await t.insurance('kevin', true);
  const kevinRes = `party:${(await t.snap()).roundId}:kevin:insurance`;
  assert.equal(t.store.test.reservations()[kevinRes].amount, 5);
  const effects = () => ({ ledger: t.store.test.ledger().length, balances: ['kevin', 'john'].map(p => t.store.test.balance(p)),
    outbox: t.store.test.outbox().length, engine: t.auditTypes().filter(x => x === 'engine.insurance').length });
  return { t, kevinRes, effects };
}
// The last choice (John's no) is refused atomically; Kevin's accepted yes and its reservation stay.
async function refusedLastChoice(t, kevinRes) {
  const receipts = t.store.test.receipts(), reservation = t.store.test.reservations()[kevinRes] ?? null;
  await rejects(t.insurance('john', false), 'INSURANCE_NOT_FUNDED');
  assert.equal(t.store.test.receipts(), receipts, 'no accepted receipt for the refused last choice');
  assert.equal((await t.snap('john')).me.insuranceDue, true, 'John may still choose');
  assert.equal((await t.snap('kevin')).me.insuranceDue, false, 'Kevin keeps his yes');
  assert.deepEqual(t.store.test.reservations()[kevinRes] ?? null, reservation, 'Kevin\'s commitment is untouched');
}

for (const [label, change] of [['missing', (all, id) => { delete all[id]; }], ['too small', (all, id) => { all[id].amount = 2; }]]) {
  test(`insurance reservation ${label}: last choice refused, insurance.timeout blocked without effect or retry loop, one resolution once restored`, async () => {
    const { t, kevinRes, effects } = await insuranceRound();
    const saved = t.store.test.reservations()[kevinRes];
    t.store.test.mutateReservations(all => change(all, kevinRes));   // another wallet writer
    await refusedLastChoice(t, kevinRes);
    t.time = (await t.snap()).actionDeadline;
    const before = effects(), audits = t.store.test.audit().length, snap = await t.snap();
    // An infrastructure error first: full rollback, no receipt, the same tick stays due.
    const [due] = await t.table.dueTicks();
    assert.equal(due.kind, 'insurance.timeout');
    t.store.test.failOnce('wallet.reservation');
    await assert.rejects(t.table.tick(due), /injected failure: wallet.reservation/);
    assert.equal(t.store.test.ticks().length, 0); assert.equal(t.store.test.audit().length, audits);
    assert.deepEqual(effects(), before); assert.deepEqual(await t.snap(), snap);
    const [blocked, ...more] = await t.drain();
    assert.equal(more.length, 0);
    assert.equal(blocked.tickId, due.tickId); assert.equal(blocked.outcome, 'blocked'); assert.deepEqual(blocked.result, { waitingOn: 'kevin' });
    assert.deepEqual(blocked.blockedOn, [{ playerId: 'kevin', reservationId: kevinRes, walletGen: 2, reservationGen: label === 'missing' ? null : saved.gen }]);
    assert.deepEqual(JSON.parse(t.store.test.audit().at(-1).payload), { tickId: blocked.tickId, kind: 'insurance.timeout', outcome: 'blocked' });
    assert.deepEqual(effects(), before, 'no game or wallet effect');
    const s = await t.snap();
    assert.equal(s.round.phase, 'insurance'); assert.equal(s.me.insuranceDue, false);
    assert.equal((await t.snap('john')).me.insuranceDue, true, 'the timeout default for John was rolled back too');
    for (let i = 0; i < 5; i++) { t.time += 1000; assert.deepEqual(await t.table.dueTicks(), []); }
    t.restart();
    assert.deepEqual(await t.table.dueTicks(), [], 'restart reads the same stop');
    const forced = await t.table.tick({ ...due, tickId: `${due.tickId}:retry:1`, baseTickId: due.tickId, retry: 1, blockedPlayers: ['kevin'] });
    assert.equal(forced.outcome, 'not_due'); assert.equal(t.store.test.ticks().length, 1);
    // Restored reservation (new generation): exactly one resolution and one insurance consume.
    t.store.test.mutateReservations(all => { all[kevinRes] = { ...saved, gen: saved.gen + 1 }; });
    const ran = await t.drain();
    assert.deepEqual(ran.map(r => [r.tickId, r.outcome]), [[`${due.tickId}:retry:1`, 'applied']]);
    assert.deepEqual(t.store.test.ledger().filter(r => r.kind === 'consume:insurance').map(r => [r.playerId, r.amountCents]), [['kevin', -500]]);
    assert.equal(t.auditTypes().filter(x => x === 'engine.insurance').length, 1);
    assert.notEqual((await t.snap()).round.phase, 'insurance');
    assert.equal(t.store.test.ticks().filter(x => x.kind === 'insurance.timeout').length, 2);
  });
}

test('denied insurance consume: accepted yes survives the refused last choice, pause and leave; blocked until the wallet changes', async () => {
  const { t, kevinRes, effects } = await insuranceRound();
  const reservation = t.store.test.reservations()[kevinRes];
  t.store.test.uncoveredDebit('kevin', 990);             // the reservation stays, the balance no longer covers it
  await t.send('kevin', 'pause', {});
  await t.send('kevin', 'leave', { memberGen: (await t.snap()).me.memberGen });
  await refusedLastChoice(t, kevinRes);
  t.time = (await t.snap()).actionDeadline;
  const before = effects();
  const [blocked, ...more] = await t.drain();
  assert.equal(more.length, 0);
  assert.equal(blocked.kind, 'insurance.timeout'); assert.equal(blocked.outcome, 'blocked');
  assert.deepEqual(blocked.blockedOn, [{ playerId: 'kevin', reservationId: kevinRes, walletGen: 3, reservationGen: reservation.gen }]);
  assert.deepEqual(effects(), before, 'partial consumes are rolled back');
  assert.deepEqual(t.store.test.reservations()[kevinRes], reservation);
  assert.deepEqual(await t.drain(), []);
  t.restart(); t.time += 5000;
  assert.deepEqual(await t.drain(), [], 'no retry loop after restart');
  t.store.test.fund('kevin', 10);                        // another wallet writer: a new wallet generation
  const ran = await t.drain();
  assert.deepEqual(ran.map(r => [r.tickId, r.outcome]), [[`${blocked.tickId}:retry:1`, 'applied']]);
  assert.deepEqual(t.store.test.ledger().filter(r => r.kind === 'consume:insurance').map(r => [r.playerId, r.amountCents]), [['kevin', -500]]);
  assert.equal(t.store.test.balance('kevin'), 5);
  assert.ok(!(kevinRes in t.store.test.reservations()));
});

test('a paused player may decline insurance and stand, but not take insurance, hit or double (PR #323)', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.bet('kevin', 3, 10);
  t.setShoe('party', ['8', 'A', '8', '5']);
  await t.ready('kevin');
  await t.send('kevin', 'pause', {});
  await rejects(t.insurance('kevin', true), 'PAUSED');
  assert.equal((await t.snap()).me.insuranceDue, true);
  await t.insurance('kevin', false);
  t.time = (await t.snap()).plan.turnAt;
  await rejects(t.act('kevin', 'hit'), 'PAUSED'); await rejects(t.act('kevin', 'double'), 'PAUSED');
  await t.act('kevin', 'stand'); await t.finish();
  assert.equal((await t.snap()).phase, 'settled');
  assert.equal(t.store.test.balance('kevin'), 990 + ((await t.snap()).me.lastSettlement.returned));
});

test('pause is never stale, applies at once in every room, a replay does not extend it, membership races replan', async () => {
  let race = null;
  const t = setup({ hooks: { beforeLock: async () => { if (race) { const r = race; race = null; await r(); } } } });
  await t.join('kevin', [3]); await t.join('kevin', [1], 'lounge');
  await t.bet('kevin', 3, 100); await t.bet('kevin', 1, 200, 'lounge');
  assert.equal((await t.snap()).me.available, 700);
  race = () => t.join('kevin', [5], 'third');           // a concurrent join between pre-read and lock
  const start = t.time;
  const p = await t.send('kevin', 'pause', { memberGen: 99 }, 'party', 'p1');
  assert.deepEqual(p.result.rooms, ['lounge', 'party', 'third'], 'the replanned lock set includes the new room');
  assert.equal(t.store.test.stats.lockRetries, 1);
  assert.equal(p.result.pausedUntil, start + 86400000);
  assert.equal((await t.snap()).me.available, 1000, 'stake reservations released in every room');
  assert.equal((await t.snap('kevin', 'lounge')).bets[1].main, 0);
  assert.equal(t.auditTypes().filter(x => x === 'player.pause').length, 3);
  t.time += 3600000;
  const replay = await t.send('kevin', 'pause', { memberGen: 99 }, 'party', 'p1');
  assert.equal(replay.replay, true); assert.equal(replay.snapshot.me.pausedUntil, start + 86400000, 'replay does not extend');
  const second = await t.send('kevin', 'pause', {}, 'lounge');
  assert.equal(second.result.pausedUntil, t.time + 86400000, 'a new pause is MAX with the existing one');
  await rejects(t.join('kevin', [6]), 'PAUSED');
});

test('presentation outbox: delivery failure changes no outcome and never debits again; redelivery keeps talkId/ver', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.join('john', [4]);
  await t.bet('kevin', 3, 25); await t.bet('john', 4, 25);
  t.setShoe('party', ['10', '10', '9', '10', '10', '7']);
  await t.ready('kevin'); await t.ready('john');
  const round = (await t.snap()).round, ledger = t.store.test.ledger();
  const failed = await t.table.deliverOutbox(async () => { throw new Error('worker down'); });
  assert.equal(failed.failed.length, 1);
  assert.deepEqual((await t.snap()).round, round); assert.deepEqual(t.store.test.ledger(), ledger);
  // Crash after COMMIT and after sending, before the ack: a restart redelivers the same identity.
  const [pending] = await t.store.outbox.pending();
  t.restart();
  const seen = [];
  const ok = await t.table.deliverOutbox(async row => { seen.push([row.talkId, row.ver]); return 'applied'; });
  assert.deepEqual(seen, [[pending.talkId, pending.ver]]); assert.equal(ok.delivered.length, 1);
  assert.deepEqual(t.store.test.ledger(), ledger, 'no second debit');
  // Two newer plans; once the newest is delivered, the older one is never sent.
  await t.act((await t.snap()).owners[(await t.snap()).round.hands[(await t.snap()).round.active].box], 'stand');
  await t.act((await t.snap()).owners[(await t.snap()).round.hands[(await t.snap()).round.active].box], 'stand');
  const rows = await t.store.outbox.pending();
  assert.deepEqual(rows.map(r => r.ver), [pending.ver + 1, pending.ver + 2]);
  await t.store.outbox.ack(rows[1], 'delivered');
  const none = await t.table.deliverOutbox(async () => assert.fail('an older plan version must not be delivered'));
  assert.equal(none.delivered.length, 0);
  assert.equal(t.store.test.outbox().find(r => r.ver === rows[0].ver).status, 'superseded');
});

test('presentation ordering: parallel delayed deliveries never apply an older plan after a newer one', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.bet('kevin', 3, 25);
  t.setShoe('party', ['10', '9', '10', '7']);
  await t.ready('kevin');
  // A controllable network: every send waits until the test lets it arrive (or fail) at the
  // receiver, which applies through the atomic version gate. No store lock is involved.
  const gate = createPresentationGate(), applied = [], held = [];
  const sink = row => new Promise((resolve, reject) => held.push({ ver: row.ver,
    arrive: () => { const g = gate.accept(row); if (g === 'new') applied.push(row.ver); resolve(g === 'stale' ? 'stale' : 'applied'); },
    fail: () => reject(new Error('connection reset')) }));
  const until = async n => { for (let i = 0; i < 1000 && held.length < n; i++) await new Promise(r => setImmediate(r)); assert.equal(held.length, n); };
  const a = t.table.deliverOutbox(sink);                 // deliverer A sends ver 1 and stalls
  await until(1);
  const v1 = held[0].ver;
  await t.act('kevin', 'stand');                         // a newer plan is committed meanwhile
  const b = t.table.deliverOutbox(sink);                 // deliverer B also sees ver 1 pending
  await until(2);
  assert.equal(held[1].ver, v1); held[1].fail();         // B's copy of ver 1 is lost
  await until(3);
  assert.equal(held[2].ver, v1 + 1); held[2].arrive();   // B's ver 2 arrives first
  const rb = await b;
  held[0].arrive();                                      // A's ver 1 arrives after ver 2
  const ra = await a;
  assert.deepEqual(applied, [v1 + 1], 'ver 1 is never applied after ver 2');
  assert.equal(gate.lastAccepted('party'), v1 + 1);
  assert.deepEqual(rb.delivered.map(r => r.ver), [v1 + 1]); assert.deepEqual(ra.superseded.map(r => r.ver), [v1]);
  assert.deepEqual(t.store.test.outbox().map(r => [r.ver, r.status]), [[v1, 'superseded'], [v1 + 1, 'delivered']]);
  // An ack lost after applying: the same ver again is not applied twice but counts as delivered.
  assert.equal(gate.accept({ roomId: 'party', ver: v1 + 1 }), 'duplicate');
  // A sink outside the contract is a failed delivery, never an ack.
  await t.finish(); await t.send('kevin', 'next', { roundId: (await t.snap()).roundId });
  await t.bet('kevin', 3, 25); await t.ready('kevin');
  const bad = await t.table.deliverOutbox(async () => undefined);
  assert.ok(bad.failed.length > 0 && bad.delivered.length === 0);
});

test('absence ticks carry the actor: two players absent at the same time are both released', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.join('john', [4]);  // same joinedAt, same memberGen, same last seen
  t.time = 100000 + 120000;
  const due = await t.table.dueTicks();
  assert.equal(due.length, 2); assert.notEqual(due[0].tickId, due[1].tickId);
  const ran = await t.drain();
  assert.deepEqual(ran.map(r => [r.kind, r.outcome]), [['seat.release', 'applied'], ['seat.release', 'applied']]);
  const s = await t.snap();
  assert.equal(s.owners[3], null); assert.equal(s.owners[4], null);
  for (const p of ['kevin', 'john']) assert.equal((await t.snap(p)).me.active, false, p);
  // The anchor encoding is unambiguous whatever the actor id contains.
  assert.notEqual(tickIdOf('party', 'seat.release', ['absent', 'a,b', 1], 5), tickIdOf('party', 'seat.release', ['absent', 'a', 'b,1'], 5));
  assert.notEqual(tickIdOf('party', 'seat.release', ['absent', 'a:1', 2], 5), tickIdOf('party', 'seat.release', ['absent', 'a', '1:2'], 5));
});

test('next after settlement still carries out a pending leave before the release tick', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.join('john', [4]);
  await t.bet('kevin', 3, 25); await t.bet('john', 4, 25);
  t.setShoe('party', ['10', '10', '9', '10', '10', '7']);
  await t.ready('kevin'); await t.ready('john');
  const turn = async () => { const s = await t.snap(); return s.owners[s.round.hands[s.round.active].box]; };
  const A = await turn(), B = A === 'kevin' ? 'john' : 'kevin', boxA = A === 'kevin' ? 3 : 4, boxB = 7 - boxA;
  await t.act(A, 'stand');
  await t.send(A, 'leave', { memberGen: (await t.snap(A)).me.memberGen });
  assert.ok((await t.snap()).players.find(p => p.id === A).leaving);
  assert.equal(await turn(), B); await t.act(B, 'stand');
  t.time = (await t.snap()).plan.endAt;
  const settle = (await t.table.dueTicks()).find(d => d.kind === 'round.settle');
  assert.equal((await t.table.tick(settle)).outcome, 'applied');
  const settled = await t.snap(B);
  assert.equal(settled.phase, 'settled');
  assert.ok((await t.table.dueTicks()).some(d => d.kind === 'seat.release' && d.playerId === A), 'release tick is due but not run');
  await t.send(B, 'next', { roundId: settled.roundId });         // B moves on first
  const after = await t.snap(A);
  assert.equal(after.phase, 'bets'); assert.equal(after.owners[boxA], null, 'A left'); assert.equal(after.owners[boxB], B);
  assert.equal(after.me.active, false); assert.equal(after.me.memberGen, 2);
  assert.deepEqual(after.players.map(p => p.id), [B]);
  assert.ok(after.me.lastSettlement, 'A keeps the settlement receipt');
  const ran = await t.drain();
  assert.ok(ran.every(r => r.outcome !== 'applied' || r.kind !== 'seat.release'), 'nothing left to release');
  await t.bet(B, boxB, 25);
  assert.equal((await t.snap(B)).bets[boxB].main, 25, 'the table keeps working');
});

test('clear withdraws ready and releases the own stake after a refused consume, also past the deadline', async () => {
  const t = setup({ funds: { kevin: 100, john: 100 } });
  await t.join('kevin', [3]); await t.join('john', [4]);
  await t.bet('kevin', 3, 100); await t.bet('john', 4, 100);
  t.store.test.uncoveredDebit('john', 50);
  assert.equal((await t.ready('kevin')).result.started, false);
  const refused = await t.ready('john');
  assert.equal(refused.result.started, false); assert.equal(refused.result.waitingOn, 'john');
  assert.equal(refused.snapshot.players.find(p => p.id === 'john').ready, true, 'ready stays after the refused consume');
  const windowId = refused.snapshot.windowId;
  t.time = refused.snapshot.deadline;
  const [blocked] = await t.drain();
  assert.equal(blocked.kind, 'window.close'); assert.equal(blocked.outcome, 'blocked');
  await rejects(t.send('john', 'bet', { seat: 4, field: 'main', chip: 5, windowId }), 'BETTING_CLOSED');
  await rejects(t.send('john', 'undo', { windowId }), 'BETTING_CLOSED');   // undo stays closed after the deadline
  const cleared = await t.send('john', 'clear', { windowId });
  assert.equal(cleared.result.reserved, 0);
  assert.equal(cleared.snapshot.players.find(p => p.id === 'john').ready, false);
  assert.equal(cleared.snapshot.bets[4].main, 0); assert.equal(cleared.snapshot.me.available, 50);
  assert.ok(!Object.keys(t.store.test.reservations()).some(id => id.includes(':john:')), 'own stake released');
  const [retry] = await t.drain();
  assert.equal(retry.tickId, `${blocked.tickId}:retry:1`); assert.equal(retry.outcome, 'applied');
  const s = await t.snap();
  assert.equal(s.phase, 'round'); assert.deepEqual(s.round.hands.map(h => h.box), [3]);
  assert.equal(t.store.test.balance('kevin'), 0); assert.equal(t.store.test.balance('john'), 50);
});

test('join compares memberGen with the stored generation, also for a late first join after leave', async () => {
  const t = setup();
  await rejects(t.send('john', 'join', { seats: [6], seatGens: { 6: 0 } }), 'STALE_COMMAND');      // missing, stored 0
  await t.send('john', 'join', { seats: [6], seatGens: { 6: 0 }, memberGen: 0 });
  await t.join('kevin', [3]);
  await t.send('kevin', 'leave', { memberGen: 1 });
  assert.deepEqual([(await t.snap('kevin')).me.active, (await t.snap('kevin')).me.memberGen], [false, 2]);
  assert.equal((await t.snap()).seatGen[5], 0, 'box 5 was never used');
  await rejects(t.send('kevin', 'join', { seats: [5], seatGens: { 5: 0 } }), 'STALE_COMMAND');     // missing
  await rejects(t.send('kevin', 'join', { seats: [5], seatGens: { 5: 0 }, memberGen: 1 }), 'STALE_COMMAND'); // stale
  const ok = await t.send('kevin', 'join', { seats: [5], seatGens: { 5: 0 }, memberGen: 2 });
  assert.equal(ok.result.memberGen, 3); assert.deepEqual(ok.snapshot.me.seats, [5]);
});

test('ledger keys are scoped per room: the same commandId in two rooms gives two rows; replay gives none', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.join('kevin', [3], 'lounge');
  await t.send('kevin', 'refill', {}, 'party', 'same'); await t.send('kevin', 'refill', {}, 'lounge', 'same');
  await t.send('kevin', 'refill', {}, 'party', 'same');
  const rows = t.store.test.ledger().filter(r => r.kind === 'refill');
  assert.equal(rows.length, 2); assert.notEqual(rows[0].key, rows[1].key);
  assert.equal(t.store.test.balance('kevin'), 3000);
});

test('refill on a blocked account is a TableError like other wallet refusals; nothing is written; infrastructure errors propagate', async () => {
  const t = setup();
  await t.join('kevin', [3]);
  // The wallet refuses the credit as the PG wallet does for a non-active account.
  const runLocked = t.store.runLocked;
  t.store.runLocked = (plan, work) => runLocked(plan, tx => work({ ...tx, wallet: { ...tx.wallet,
    credit: async (p, input) => { if (p === 'kevin' && input.kind === 'refill') throw new WalletDenied({ playerId: p, walletGen: 1, reason: 'player account is inactive' }); return tx.wallet.credit(p, input); } } }));
  const state = async () => ({ balance: t.store.test.balance('kevin'), ledger: t.store.test.ledger(), reservations: t.store.test.reservations(),
    receipts: t.store.test.receipts(), audit: t.store.test.audit().length, snap: await t.snap() });
  const before = await state();
  await rejects(t.send('kevin', 'refill', {}, 'party', 'r1'), 'REFILL_REFUSED');
  assert.deepEqual(await state(), before, 'no balance, ledger, reservation, receipt or audit change');
  // Like every rejected command there is no receipt, so the same id is refused the same way again.
  await rejects(t.send('kevin', 'refill', {}, 'party', 'r1'), 'REFILL_REFUSED');
  assert.deepEqual(await state(), before);
  // A real infrastructure error is not converted.
  t.store.runLocked = runLocked;
  t.store.test.failOnce('wallet.credit');
  await assert.rejects(t.send('kevin', 'refill', {}, 'party', 'r1'), e => !e.code && /injected failure: wallet.credit/.test(e.message));
  assert.deepEqual(await state(), before);
  const ok = await t.send('kevin', 'refill', {}, 'party', 'r1');
  assert.equal(ok.replay, false); assert.equal(t.store.test.balance('kevin'), 2000);
});

test('audit: a failed insert rolls back wallet, ledger and receipt; concurrent appends keep one verifiable global chain', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.bet('kevin', 3, 25);
  const snapshot = { ledger: t.store.test.ledger(), receipts: t.store.test.receipts(), reservations: t.store.test.reservations(), audit: t.store.test.audit().length };
  t.store.test.failOnce('audit.append', 2);              // player.ready, round.started ok; engine.start after consume fails
  await assert.rejects(t.ready('kevin'), /injected failure/);
  assert.deepEqual(t.store.test.ledger(), snapshot.ledger); assert.equal(t.store.test.receipts(), snapshot.receipts);
  assert.deepEqual(t.store.test.reservations(), snapshot.reservations); assert.equal(t.store.test.audit().length, snapshot.audit);
  assert.equal(t.store.test.balance('kevin'), 1000); assert.equal((await t.snap()).phase, 'bets');
  await t.join('john', [2], 'lounge');
  await Promise.all(Array.from({ length: 10 }, (_, i) => i % 2 ? t.bet('john', 2, 5, 'lounge') : t.bet('kevin', 3, 5)));
  const rows = t.store.test.audit();
  assert.deepEqual(rows.map(r => r.seq), rows.map((_, i) => i + 1));
  assert.deepEqual(await t.store.audit.verifyChain(), { ok: true, head: { seq: rows.length, hash: rows.at(-1).hash } });
  assert.equal((await t.store.audit.verifyChain(5, 9)).ok, true, 'a sub-range verifies from its predecessor hash');
  t.store.test.tamperAudit(4, '{"forged":true}');
  assert.equal((await t.store.audit.verifyChain()).ok, false);
});

test('audit serialization is Kevin\'s game-audit.mjs event() hash', () => {
  const row = { room: 'party', roundId: null, at: 123, parent: 7, type: 'player.bet', payload: { playerId: 'p', chip: 5 } };
  const previous = 'ab'.repeat(32);
  // game-audit.mjs @ 5aa7ed1 :20-22, verbatim formula
  const data = JSON.stringify(row.payload);
  const kevin = createHash('sha256').update(JSON.stringify({ room: row.room, roundId: row.roundId ?? null, at: row.at, parent: row.parent, type: row.type, payload: data, previous })).digest('hex');
  const out = chainRow(previous, row);
  assert.equal(out.hash, kevin); assert.equal(out.payload, data); assert.equal(out.previous_hash, previous);
  assert.equal(chainRow(GENESIS, { ...row, parent: undefined }).parent, null);
});

test('reservations across two tables and another debit writer; a fully reserved balance still starts (K02 funding)', async () => {
  const t = setup({ funds: { kevin: 100 } });
  await t.join('kevin', [3]); await t.join('kevin', [3], 'lounge');
  await t.bet('kevin', 3, 100);
  assert.equal((await t.snap()).me.available, 0);
  assert.equal(t.store.test.otherWriterDebit('kevin', 1), false, 'another main writer may not cut into the reservation');
  await rejects(t.bet('kevin', 3, 5, 'lounge'), 'INSUFFICIENT_BALANCE');
  const started = await t.ready('kevin');
  assert.equal(started.result.started, true, 'balance 100 / reserved 100 starts');
  assert.equal(t.store.test.balance('kevin'), 0); assert.equal((await t.snap()).me.available, 0);
});

test('configVersion is frozen per window; a publish applies from the next window and never changes accepted bets', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.bet('kevin', 3, 500);
  t.store.test.publish('v2', { limits: { min: 5, max: 100, sideMax: 100 } });
  await t.bet('kevin', 3, 100);
  assert.equal((await t.snap()).bets[3].main, 600, 'v1 limits still apply in this window');
  await t.ready('kevin');
  assert.equal(JSON.parse(t.store.test.audit().find(e => e.type === 'round.started').payload).configVersion, 'v1');
  for (let i = 0; i < 6 && (await t.snap()).phase === 'round'; i++) { const s = await t.snap(); if (s.round?.phase === 'decisions') await t.act('kevin', 'stand'); else { t.time = Math.max(t.time, s.plan.endAt, s.actionDeadline ?? 0); await t.drain(); } }
  const settled = await t.snap();
  await t.send('kevin', 'next', { roundId: settled.roundId });
  assert.equal((await t.snap()).configVersion, 'v2');
  await rejects(t.bet('kevin', 3, 500), 'LIMITS');
});

test('the coordinator reads no ambient clock, randomness or timers', async () => {
  const saved = { now: Date.now, random: Math.random, setTimeout: globalThis.setTimeout, setInterval: globalThis.setInterval };
  const t = setup();
  try {
    Date.now = Math.random = globalThis.setInterval = () => { throw new Error('ambient'); };
    globalThis.setTimeout = () => { throw new Error('ambient'); };
    await t.join('kevin', [3]); await t.bet('kevin', 3, 25);
    t.setShoe('party', ['10', '9', '10', '7']);
    await t.ready('kevin'); await t.act('kevin', 'stand'); await t.finish();
    assert.equal((await t.snap()).phase, 'settled');
  } finally { Object.assign(Date, { now: saved.now }); Math.random = saved.random; globalThis.setTimeout = saved.setTimeout; globalThis.setInterval = saved.setInterval; }
});

test('a closed shoe is verified against its commitment and the global audit draws', async () => {
  const t = setup({ funds: { kevin: 100000 } });
  await t.join('kevin', [0, 1, 2, 3, 4, 5, 6]);
  for (let round = 0; round < 40 && !t.auditTypes().includes('shoe.closed'); round++) {
    for (let i = 0; i < 7; i++) await t.bet('kevin', i, 5);
    await t.ready('kevin');
    for (let k = 0; k < 60 && (await t.snap()).phase === 'round'; k++) {
      const s = await t.snap(); t.time = Math.max(t.time, s.plan.endAt, s.actionDeadline ?? 0);
      await t.table.seen('party', 'kevin'); await t.drain();   // the client keeps polling
    }
    await t.send('kevin', 'next', { roundId: (await t.snap()).roundId });
  }
  const closed = t.store.test.audit().find(e => e.type === 'shoe.closed');
  assert.ok(closed, 'the cut card closed the first shoe');
  assert.equal(JSON.parse(closed.payload).verification.status, 'verified');
  assert.equal(t.auditTypes().filter(x => x === 'shoe.opened').length, 2);
  assert.equal((await t.store.audit.verifyChain()).ok, true);
});

test('missing reachable native film rolls back ready and tick before all durable effects',async()=>{
  for(const trigger of ['ready','tick']) {
    const t=setup(),f=withNativeFilmTransitions(nativeRoomMaterialFixture()),material=resolveNativeRoomGameMaterial(f.input,{version:2});
    const cfg={material,language:material.language,leadMs:material.leadMs,cardMs:material.cardMs};
    const broken=structuredClone(cfg),hash=f.profile.takes.find(take=>take.key==='1:base').sha256;
    broken.material.media=broken.material.media.filter(row=>row.sha256!==hash);
    t.store.test.publish('film-v2',broken);await t.join('kevin',[0]);await t.bet('kevin',0,25);
    t.setShoe('party',['8','6','9','10','5']);if(trigger==='tick')t.time=(await t.snap()).deadline;
    const before=await durableState(t),invoke=trigger==='ready'?()=>t.ready('kevin'):async()=>t.table.tick((await t.table.dueTicks()).find(row=>row.kind==='window.close'));
    await rejects(invoke(),'native_room_sequence_unsupported');assert.deepEqual(await durableState(t),before);
    t.store.test.publish('film-v2',cfg);await invoke();
    assert.equal(t.store.test.ledger().filter(row=>row.kind==='consume:stake').length,1);
    assert.equal((await t.store.audit.verifyChain()).ok,true);
  }
});

// F11: the scheduler's own room read reports each room's committed versions, so another engine
// instance's commits can reach this instance's sockets. The observer never changes what is due.
test('dueTicks reports every room\'s committed versions to observeRoom without altering the due list', async () => {
  const t = setup();
  await t.join('kevin', [0]); await t.bet('kevin', 0, 5);
  await t.join('john', [1], 'other');
  const seen = [], before = await t.snap();
  t.time = before.deadline;
  const plain = await t.table.dueTicks();
  const observed = await t.table.dueTicks(undefined, { observeRoom: (room, versions) => {
    assert.ok(Object.isFrozen(versions)); seen.push([room, versions]);
    if (room === 'other') throw new Error('a broken observer');
  } });
  assert.deepEqual(observed, plain); assert.equal(plain.length, 1);
  const other = await t.snap('john', 'other');
  assert.deepEqual(seen.sort(([a], [b]) => a < b ? -1 : 1), [['other', { version: other.version, presentationVer: other.presentationVer }],
    ['party', { version: before.version, presentationVer: before.presentationVer }]]);
  await t.table.tick(plain[0]);
  const after = await t.snap(); seen.length = 0;
  await t.table.dueTicks(undefined, { onRoomError: () => assert.fail('no room error'), observeRoom: (room, versions) => seen.push([room, versions]) });
  assert.deepEqual(seen.find(([room]) => room === 'party')[1], { version: after.version, presentationVer: after.presentationVer });
  assert.ok(after.version > before.version && after.presentationVer > before.presentationVer);
});
