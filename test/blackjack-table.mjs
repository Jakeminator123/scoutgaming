// K03 contract tests: the shared table coordinator against the in-memory reference adapter.
// Covers AKTIVITETER K03 "Verifiering/bevis" and O01-svar 2.12 without SQL or a database.
// Real Postgres atomicity and locks are J07's to prove (and K07's to co-test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createTableCoordinator } from '../services/game/games/blackjack/table/coordinator.mjs';
import { chainRow, GENESIS } from '../services/game/games/blackjack/table/audit-chain.mjs';
import { createMemoryTableStore } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

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
      return t.send(who, 'join', { seats, seatGens, memberGen: s?.me.active ? s.me.memberGen : undefined }, room);
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
    t.send('kevin', 'join', { seats: [3], seatGens: { 3: 0 } }), t.send('john', 'join', { seats: [3], seatGens: { 3: 0 } })]);
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
  const ok = await t.table.deliverOutbox(async row => { seen.push([row.talkId, row.ver]); });
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

test('ledger keys are scoped per room: the same commandId in two rooms gives two rows; replay gives none', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.join('kevin', [3], 'lounge');
  await t.send('kevin', 'refill', {}, 'party', 'same'); await t.send('kevin', 'refill', {}, 'lounge', 'same');
  await t.send('kevin', 'refill', {}, 'party', 'same');
  const rows = t.store.test.ledger().filter(r => r.kind === 'refill');
  assert.equal(rows.length, 2); assert.notEqual(rows[0].key, rows[1].key);
  assert.equal(t.store.test.balance('kevin'), 3000);
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
