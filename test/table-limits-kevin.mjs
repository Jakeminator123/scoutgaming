import test from 'node:test';
import assert from 'node:assert/strict';
import { createTableCoordinator } from '../services/game/games/blackjack/table/coordinator.mjs';
import { createMemoryTableStore, DEFAULT_CONFIG } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

// K07 port of Kevin's agent's test/table-limits-kevin.mjs from origin/codex/kevin-k07-tester @ c17cdba2 (stacked on his K04 branch).
// Runs unchanged against main as it is: K02 core.mjs, the K03 coordinator.mjs/ports.mjs and the memory-store fixture
// test/fixtures/blackjack-table-memory-store.mjs. Nothing here depends on K04-only code (outbox payload.presentation, media
// catalogue, material-revision), so no assertion was dropped. Required by .githooks/pre-commit-full in gameplay/shared-blackjack. Kevin's original notes follow.

// K07 gap (K06-K07-forberedelse §2.1, table-limits): Kevin's limit presets (server/studio-tables.mjs:8-12 @ 5aa7ed10, the
// same numbers O01's Admin matrix fixes for J08) enforced by the K03 coordinator from the frozen config, one case per
// preset; a new window binds the newest published config; a seated player who sat a round out keeps the receipt of
// their own last completed round. Presets are written out here because room-game-config.mjs is not on this branch.
const PRESETS = {
  casual: { limits: { min: 1, max: 500, sideMax: 50 }, chips: [1, 5, 10, 25, 50, 100], refill: 500 },
  prive: { limits: { min: 5, max: 2000, sideMax: 200 }, chips: [5, 10, 25, 50, 100, 500], refill: 1000 },
  high: { limits: { min: 100, max: 25000, sideMax: 1000 }, chips: [100, 500, 1000, 5000, 10000, 25000], refill: 50000 },
};
function setup({ preset = 'prive', funds = { kevin: 100000, john: 100000 } } = {}) {
  const store = createMemoryTableStore();
  store.test.publish('v-' + preset, PRESETS[preset]);
  let time = 100000, n = 0;
  const clock = { now: () => time };
  const table = createTableCoordinator({ store, clock, random: deterministicRandom('k07-limits') });
  for (const [p, amount] of Object.entries(funds)) store.test.fund(p, amount);
  const t = {
    store, table, get time() { return time; }, set time(v) { time = v; },
    snap: (who = 'kevin') => table.snapshot('party', who),
    send: (who, op, extra = {}) => table.command({ actorId: who }, { roomId: 'party', op, commandId: `c${++n}`, ...extra }),
    async join(who, seats) { const s = await t.snap(who); return t.send(who, 'join', { seats, seatGens: Object.fromEntries(seats.map(i => [i, s?.seatGen[i] ?? 0])), memberGen: s?.me.memberGen ?? 0 }); },
    async bet(who, seat, chip, field = 'main') { return t.send(who, 'bet', { seat, field, chip, windowId: (await t.snap(who)).windowId }); },
    async ready(who) { return t.send(who, 'ready', { windowId: (await t.snap(who)).windowId }); },
    async act(who, action) { const s = await t.snap(who); time = Math.max(time, s.plan.turnAt); return t.send(who, 'act', { action, roundId: s.roundId, turnSeq: s.turnSeq, box: s.round.hands[s.round.active].box, handIndex: s.round.active }); },
    async drain() { for (let i = 0; i < 100; i++) { const due = await table.dueTicks(); if (!due.length) return; for (const d of due) await table.tick(d); } throw new Error('scheduler did not settle'); },
    setShoe(ranks) { store.test.mutateRoom('party', r => { const c = r.game.shoe.cards; c.splice(-ranks.length, ranks.length, ...ranks.map((x, i) => ({ r: x, s: ['♠', '♦', '♥', '♣'][i % 4], serial: 900 + i })).reverse()); }); },
    async standAll() {
      for (let i = 0; i < 20; i++) {
        const s = await t.snap();
        if (s.phase === 'settled') return s;
        if (s.phase === 'round' && s.round?.phase === 'decisions' && s.round.hands?.[s.round.active]) { await t.act(s.owners[s.round.hands[s.round.active].box], 'stand'); continue; }
        // bets with a seated non-bettor: the window closes on its deadline, not on ready (window.close tick starts the round)
        time = Math.max(time, s.plan?.endAt ?? time, s.actionDeadline ?? time, s.deadline ?? time); await t.drain();
      }
      throw new Error('round did not settle');
    },
  };
  return t;
}
const rejects = (promise, code) => assert.rejects(promise, e => e.code === code || assert.fail(`expected ${code}, got ${e.code}: ${e.message}`));

for (const [name, preset] of Object.entries(PRESETS)) {
  test(`${name}: only its chips, main between min and max, side bets under sideMax, refill adds the preset amount`, async () => {
    const t = setup({ preset: name });
    await t.join('kevin', [3]);
    assert.equal((await t.snap()).configVersion, 'v-' + name);
    const foreign = [1, 5, 10, 25, 50, 100, 500, 1000, 5000, 10000, 25000].find(c => !preset.chips.includes(c));
    await rejects(t.bet('kevin', 3, foreign), 'INVALID_CHIP');
    if (preset.chips[0] < preset.limits.min) await rejects(t.bet('kevin', 3, preset.chips[0]), 'LIMITS');
    const smallest = preset.chips.find(c => c >= preset.limits.min);
    await t.bet('kevin', 3, smallest);
    assert.equal((await t.snap()).bets[3].main, smallest);
    // over max: keep adding the largest chip until the table refuses, and the refusal leaves the bet as it was
    const largest = preset.chips.at(-1); let main = smallest;
    for (let i = 0; i < 40 && main + largest <= preset.limits.max; i++) { await t.bet('kevin', 3, largest); main += largest; }
    await rejects(t.bet('kevin', 3, largest), 'LIMITS');
    assert.equal((await t.snap()).bets[3].main, main);
    // side bet above sideMax
    const sideChip = preset.chips.find(c => c > preset.limits.sideMax) ?? null;
    if (sideChip) await rejects(t.bet('kevin', 3, sideChip, 'pp'), 'LIMITS');
    else { let side = 0; for (let i = 0; i < 40 && side + largest <= preset.limits.sideMax; i++) { await t.bet('kevin', 3, largest, 'pp'); side += largest; } await rejects(t.bet('kevin', 3, largest, 'pp'), 'LIMITS'); }
    // refill credits exactly the preset amount, once per command id
    const before = t.store.test.balance('kevin');
    const refill = await t.send('kevin', 'refill');
    assert.equal(t.store.test.balance('kevin'), before + preset.refill);
    assert.ok(refill.result.ledgerId);
    assert.deepEqual(t.store.test.ledger().filter(r => r.kind === 'refill').map(r => r.amountCents), [preset.refill * 100]);
  });
}

test('a new window binds the newest published config; a publish during an open window leaves that window and its bets alone', async () => {
  const t = setup({ preset: 'casual' });
  await t.join('kevin', [3]); await t.join('john', [4]);
  t.setShoe(['10', '10', '9', '10', '10', '7']);
  await t.bet('kevin', 3, 25); await t.bet('john', 4, 25);
  t.store.test.publish('v-high', PRESETS.high);
  assert.equal((await t.snap()).configVersion, 'v-casual', 'the open window keeps its version');
  await t.bet('kevin', 3, 25);
  assert.equal((await t.snap()).bets[3].main, 50, 'casual chips still accepted in the open window');
  await t.ready('kevin'); await t.ready('john');
  const settled = await t.standAll();
  await t.send('kevin', 'next', { roundId: settled.roundId });
  const fresh = await t.snap();
  assert.equal(fresh.configVersion, 'v-high'); assert.notEqual(fresh.windowId, settled.windowId);
  await rejects(t.bet('kevin', 3, 25), 'INVALID_CHIP');
  await t.bet('kevin', 3, 100); assert.equal((await t.snap()).bets[3].main, 100);
});

test('a seated player who sat the round out keeps the receipt of their own last completed round', async () => {
  const t = setup({ preset: 'prive' });
  await t.join('kevin', [3]); await t.join('john', [4]);
  t.setShoe(['10', '10', '9', '10', '10', '7']);
  await t.bet('kevin', 3, 25); await t.bet('john', 4, 25);
  await t.ready('kevin'); await t.ready('john');
  const first = await t.standAll();
  const johnFirst = (await t.snap('john')).me.lastSettlement;
  assert.equal(johnFirst.roundId, first.roundId); assert.equal(johnFirst.staked, 25);
  await t.send('kevin', 'next', { roundId: first.roundId });
  t.setShoe(['10', '9', '10', '7']);
  await t.bet('kevin', 3, 10); await t.ready('kevin');
  const second = await t.standAll();
  assert.notEqual(second.roundId, first.roundId);
  const kevinSecond = (await t.snap('kevin')).me.lastSettlement;
  assert.equal(kevinSecond.roundId, second.roundId); assert.deepEqual(kevinSecond.hands.map(h => h.box), [3], 'john sat this one out');
  assert.deepEqual((await t.snap('john')).me.lastSettlement, johnFirst, 'the stored receipt is the previous round, not this one');
  assert.equal(DEFAULT_CONFIG.limits.min, 5, 'fixture default is prive-like; presets above override it explicitly');
});
