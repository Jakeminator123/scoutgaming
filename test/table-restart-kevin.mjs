import test from 'node:test';
import assert from 'node:assert/strict';
import { createTableCoordinator } from '../services/game/games/blackjack/table/coordinator.mjs';
import { createMemoryTableStore } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

// K07 port of Kevin's agent's test/table-restart-kevin.mjs from origin/codex/kevin-k07-tester @ c17cdba2 (stacked on his K04 branch).
// Runs unchanged against main as it is: K02 core.mjs, the K03 coordinator.mjs/ports.mjs and the memory-store fixture
// test/fixtures/blackjack-table-memory-store.mjs. Nothing here depends on K04-only code (outbox payload.presentation, media
// catalogue, material-revision), so no assertion was dropped. Registered opt-in in tools/orphan-tests-exceptions.json like the
// source branch. Kevin's original notes follow.

// K07 gap (K06-K07-forberedelse §2.5 row 10, "explicit"): a process restart in the middle of a round with two players,
// after a split hand and an insurance yes. The committed state must come back whole from the store, no debit or
// consume may happen twice, a stored request id must still replay, and the round must finish with exactly one
// settlement per player. Same harness shape as test/blackjack-table.mjs (memory store, deterministic random, clock).
function setup({ funds = { kevin: 1000, john: 1000 } } = {}) {
  const store = createMemoryTableStore();
  let time = 100000, n = 0;
  const clock = { now: () => time };
  const random = deterministicRandom('k07-restart');
  let table = createTableCoordinator({ store, clock, random });
  for (const [p, amount] of Object.entries(funds)) store.test.fund(p, amount);
  const t = {
    store, get table() { return table; }, get time() { return time; }, set time(v) { time = v; },
    restart() { table = createTableCoordinator({ store, clock, random }); },
    snap: (who = 'kevin') => table.snapshot('party', who),
    send: (who, op, extra = {}, commandId = `c${++n}`) => table.command({ actorId: who }, { roomId: 'party', op, commandId, ...extra }),
    async join(who, seats) {
      const s = await t.snap(who);
      return t.send(who, 'join', { seats, seatGens: Object.fromEntries(seats.map(i => [i, s?.seatGen[i] ?? 0])), memberGen: s?.me.memberGen ?? 0 });
    },
    async bet(who, seat, chip) { return t.send(who, 'bet', { seat, field: 'main', chip, windowId: (await t.snap(who)).windowId }); },
    async ready(who) { return t.send(who, 'ready', { windowId: (await t.snap(who)).windowId }); },
    actInput: s => ({ roundId: s.roundId, turnSeq: s.turnSeq, box: s.round.hands[s.round.active].box, handIndex: s.round.active }),
    async act(who, action, commandId) {
      const s = await t.snap(who); time = Math.max(time, s.plan.turnAt);
      return t.send(who, 'act', { action, ...t.actInput(s) }, commandId);
    },
    async insurance(who, take) {
      const s = await t.snap(who); time = Math.max(time, s.plan.turnAt);
      return t.send(who, 'insurance', { take, roundId: s.roundId, phase: 'insurance' });
    },
    async drain() { for (let i = 0; i < 100; i++) { const due = await table.dueTicks(); if (!due.length) return; for (const d of due) await table.tick(d); } throw new Error('scheduler did not settle'); },
    setShoe(ranks) { store.test.mutateRoom('party', r => { const c = r.game.shoe.cards; c.splice(-ranks.length, ranks.length, ...ranks.map((x, i) => ({ r: x, s: ['♠', '♦', '♥', '♣'][i % 4], serial: 900 + i })).reverse()); }); },
    async standAll() {
      for (let i = 0; i < 20; i++) {
        const s = await t.snap();
        if (s.phase === 'settled') return s;
        if (s.phase === 'round' && s.round?.phase === 'decisions' && s.round.hands?.[s.round.active]) { await t.act(s.owners[s.round.hands[s.round.active].box], 'stand'); continue; }
        time = Math.max(time, s.plan?.endAt ?? time, s.actionDeadline ?? time); await t.drain();
      }
      throw new Error('round did not settle');
    },
    ledger: (who, kind) => store.test.ledger().filter(r => r.playerId === who && (!kind || r.kind === kind)),
  };
  return t;
}
const rejects = (promise, code) => assert.rejects(promise, e => e.code === code || assert.fail(`expected ${code}, got ${e.code}: ${e.message}`));

test('restart mid-round after a split and an insurance yes: the state comes back whole, nothing is paid twice, the request id replays, one settlement each', async () => {
  const t = setup();
  await t.join('kevin', [3]); await t.join('john', [4]);
  await t.bet('kevin', 3, 10); await t.bet('john', 4, 10);
  // Boxes are dealt right to left: john, kevin, dealer up, john, kevin, dealer hole. Both get a pair, the dealer shows an
  // ace (insurance), the hole card is no blackjack. Then the cards the split hands and the dealer draw.
  t.setShoe(['8', '9', 'A', '8', '9', '6', '3', '4', 'K', 'K', 'K']);
  await t.ready('kevin'); await t.ready('john');
  assert.equal((await t.snap()).round.phase, 'insurance');
  await t.insurance('kevin', true); await t.insurance('john', false);
  const dealt = await t.snap('kevin');
  assert.equal(dealt.round.phase, 'decisions', 'no dealer blackjack: the round goes on');
  assert.deepEqual(t.ledger('kevin', 'consume:insurance').map(r => r.amountCents), [-500], 'the yes is consumed when the phase resolves');
  // Hands play right to left too: John's box 4 acts first and stands; then it is Kevin's pair.
  assert.equal(dealt.round.hands[dealt.round.active].box, 4);
  await t.act('john', 'stand');
  const pair = await t.snap('kevin');
  assert.equal(pair.round.hands[pair.round.active].box, 3); assert.ok(pair.round.legalActions.includes('split'));
  const splitId = 'split-once';
  const split = await t.act('kevin', 'split', splitId);
  assert.equal(split.replay, false);
  const before = await t.snap('kevin');
  assert.deepEqual(before.round.hands.map(h => [h.box, h.splitFrom]), [[3, 3], [3, 3], [4, null]], 'two hands on box 3, John untouched');
  assert.deepEqual(t.ledger('kevin', 'split').map(r => r.amountCents), [-1000], 'the second stake is debited once, from available');
  const dueBefore = await t.table.dueTicks();

  t.restart();

  const after = await t.snap('kevin');
  for (const k of ['version', 'roundId', 'turnSeq', 'windowId', 'configVersion', 'owners', 'bets', 'actionDeadline', 'plan', 'round']) assert.deepEqual(after[k], before[k], k);
  assert.equal(after.me.insuranceDue, false); assert.equal((await t.snap('john')).me.insuranceDue, false);
  assert.deepEqual(await t.table.dueTicks(), dueBefore, 'the restarted scheduler sees the same due ticks');
  assert.equal(t.store.test.reservations()[`party:${after.roundId}:kevin:insurance`], undefined, 'the consumed insurance reservation is not revived');
  // The stored receipt still answers the same request id after the restart: no second split, no second debit.
  const again = await t.send('kevin', 'act', { action: 'split', ...t.actInput(pair) }, splitId);
  assert.equal(again.replay, true);
  assert.equal((await t.snap()).round.hands.length, 3);
  assert.deepEqual(t.ledger('kevin', 'split').length, 1);
  // A stale identity from before the split is still refused after the restart (once the new plan's cards are on the felt).
  t.time = Math.max(t.time, after.plan.turnAt);
  await rejects(t.send('kevin', 'act', { action: 'stand', ...t.actInput(pair) }), 'STALE_COMMAND');
  // John cannot act on Kevin's split hand.
  await rejects(t.send('john', 'act', { action: 'stand', ...t.actInput(after) }), 'NOT_YOUR_TURN');

  const settled = await t.standAll();
  assert.equal(settled.phase, 'settled');
  const kevin = (await t.snap('kevin')).me.lastSettlement, john = (await t.snap('john')).me.lastSettlement;
  assert.equal(kevin.hands.filter(h => h.box === 3).length, 2, 'both split hands are in Kevin\'s one receipt');
  assert.equal(john.hands.length, 1);
  // A payout row exists exactly when the receipt returns money, never twice; the receipt's stake is every debit of the round.
  for (const [p, receipt, staked] of [['kevin', kevin, 25], ['john', john, 10]]) {
    assert.equal(t.ledger(p, 'payout').length, receipt.returned > 0 ? 1 : 0, `${p} payout rows`);
    assert.equal(receipt.staked, staked, `${p} staked main + split + insurance`);
    assert.equal(t.ledger(p, 'payout').reduce((n, r) => n + r.amountCents, 0), receipt.returned * 100, `${p} payout equals the receipt`);
  }
  assert.deepEqual(t.ledger('kevin', 'consume:insurance').length, 1);
  assert.deepEqual(t.ledger('kevin', 'consume:stake').length, 1); assert.deepEqual(t.ledger('john', 'consume:stake').length, 1);
  // Every cent is accounted for: the balance equals the start plus the ledger.
  for (const p of ['kevin', 'john']) assert.equal(t.store.test.balance(p) * 100, 100000 + t.ledger(p).reduce((n, r) => n + r.amountCents, 0), `${p} balance follows the ledger`);
  assert.equal(t.store.test.audit().filter(e => e.type === 'engine.act' && JSON.parse(e.payload).action === 'split').length, 1, 'one split in the audit chain');
});
