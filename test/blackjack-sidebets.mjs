// P-E (docs/plans/KEVIN-PORT.md, K9): fixed paytable for the side bets, written against main's own
// rule code (services/game/games/blackjack/round.mjs) and core ledger (core.mjs). It complements the
// fuzz oracle in test/fuzz-blackjack.mjs: the fuzz re-implements the rules, this file locks the numbers.
//
// Main's table ("N:1" pays stake × N in profit; the total return includes the winning stake):
//   Perfect Pairs, player's first two cards:  Perfect Pair 25:1 · Colored Pair 12:1 · Mixed Pair 6:1
//   21+3, first two cards + dealer upcard:     Suited Three of a Kind 100:1 · Straight Flush 40:1 ·
//                                              Three of a Kind 30:1 · Straight 10:1 · Flush 5:1
// Straights: ace low (A-2-3) and ace high (Q-K-A); no wraparound (K-A-2). The hole card never counts.
import assert from 'node:assert/strict';
import test from 'node:test';
import { BlackjackCoreError, newGame, step } from '../services/game/games/blackjack/core.mjs';
import { Round } from '../services/game/games/blackjack/round.mjs';
import { ROOM_LIMIT_PRESETS } from '../packages/presentation/contracts/room-game-config.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

const c = (r, s) => ({ r, s });
const HOLE = c('10', '♣');
const EMPTY = { main: 0, pp: 0, tp: 0 };
const PAYS = { 'Perfect Pair': 25, 'Colored Pair': 12, 'Mixed Pair': 6,
  'Suited Three of a Kind': 100, 'Straight Flush': 40, 'Three of a Kind': 30, Straight: 10, Flush: 5 };

// Deals one box straight off a fixed shoe: player first card, dealer upcard, player second card, hole.
function deal(first, second, up, bets, hole = HOLE) {
  const r = new Round([{ main: 5, ...bets }], [hole, second, up, first]);
  r.deal();
  return r;
}

// [label, first, second, upcard, Perfect Pairs hit or null, 21+3 hit or null]
const CASES = [
  ['perfect pair', c('8', '♠'), c('8', '♠'), c('2', '♥'), 'Perfect Pair', null],
  ['perfect pair of aces', c('A', '♦'), c('A', '♦'), c('5', '♣'), 'Perfect Pair', null],
  ['colored pair, both black', c('8', '♠'), c('8', '♣'), c('2', '♥'), 'Colored Pair', null],
  ['colored pair, both red', c('8', '♥'), c('8', '♦'), c('2', '♠'), 'Colored Pair', null],
  ['mixed pair', c('8', '♠'), c('8', '♥'), c('2', '♦'), 'Mixed Pair', null],
  ['two ten-valued cards of different rank are no pair', c('K', '♠'), c('Q', '♠'), c('2', '♦'), null, null],
  ['a pair made with the upcard is no Perfect Pairs hit', c('8', '♠'), c('9', '♠'), c('8', '♠'), null, 'Flush'],
  ['suited three of a kind', c('8', '♠'), c('8', '♠'), c('8', '♠'), 'Perfect Pair', 'Suited Three of a Kind'],
  ['three of a kind', c('8', '♠'), c('8', '♥'), c('8', '♦'), 'Mixed Pair', 'Three of a Kind'],
  ['three of a kind with two suits only is not suited', c('8', '♠'), c('8', '♠'), c('8', '♥'), 'Perfect Pair', 'Three of a Kind'],
  ['three ten-valued cards of different rank are no trips', c('10', '♠'), c('J', '♥'), c('K', '♦'), null, null],
  ['suited ten-valued cards of different rank are a flush', c('10', '♠'), c('J', '♠'), c('K', '♠'), null, 'Flush'],
  ['straight flush, ace low A-2-3', c('A', '♠'), c('2', '♠'), c('3', '♠'), null, 'Straight Flush'],
  ['straight flush, ace high Q-K-A', c('Q', '♥'), c('K', '♥'), c('A', '♥'), null, 'Straight Flush'],
  ['straight flush in any card order', c('3', '♠'), c('A', '♠'), c('2', '♠'), null, 'Straight Flush'],
  ['straight flush 9-10-J', c('9', '♣'), c('10', '♣'), c('J', '♣'), null, 'Straight Flush'],
  ['straight, ace high Q-K-A', c('Q', '♠'), c('K', '♥'), c('A', '♦'), null, 'Straight'],
  ['straight, ace low A-2-3', c('A', '♣'), c('2', '♦'), c('3', '♥'), null, 'Straight'],
  ['straight 10-J-Q', c('10', '♠'), c('J', '♥'), c('Q', '♦'), null, 'Straight'],
  ['straight with the upcard in the middle', c('K', '♠'), c('J', '♥'), c('Q', '♦'), null, 'Straight'],
  ['no wraparound straight K-A-2', c('K', '♠'), c('A', '♥'), c('2', '♦'), null, null],
  ['suited K-A-2 is a flush, not a straight flush', c('K', '♠'), c('A', '♠'), c('2', '♠'), null, 'Flush'],
  ['a gap is no straight A-2-4', c('A', '♠'), c('2', '♥'), c('4', '♦'), null, null],
  ['flush', c('2', '♠'), c('7', '♠'), c('J', '♠'), null, 'Flush'],
  ['both side bets lost', c('9', '♠'), c('7', '♥'), c('5', '♦'), null, null],
];

test('paytable: every Perfect Pairs and 21+3 outcome returns stake × (N + 1), a loss returns 0', () => {
  for (const [label, first, second, up, pp, tp] of CASES) for (const stake of [1, 5, 200]) {
    const hand = deal(first, second, up, { pp: stake, tp: stake }).hands[0];
    const ppReturn = pp ? stake * (PAYS[pp] + 1) : 0, tpReturn = tp ? stake * (PAYS[tp] + 1) : 0;
    assert.deepEqual(hand.sideResults.pp, { stake, returned: ppReturn, profit: ppReturn - stake,
      label: pp ?? 'Perfect Pairs lost', draws: [undefined, undefined] }, `${label}: Perfect Pairs at ${stake}`);
    assert.deepEqual(hand.sideResults.tp, { stake, returned: tpReturn, profit: tpReturn - stake,
      label: tp ?? '21+3 lost', draws: [undefined, undefined, undefined] }, `${label}: 21+3 at ${stake}`);
    assert.equal(hand.sideReturn, ppReturn + tpReturn, `${label}: total side return at ${stake}`);
    assert.deepEqual(hand.sideLabels, [pp, tp].filter(Boolean).map(name => `${name} ${PAYS[name]}:1`), label);
  }
});

test('paytable in numbers at stake 5, as Kevin K9 states it (total return including the winning stake)', () => {
  const at5 = (first, second, up) => {
    const { sideResults } = deal(first, second, up, { pp: 5, tp: 5 }).hands[0];
    return [sideResults.pp.returned, sideResults.tp.returned];
  };
  assert.deepEqual(at5(c('8', '♠'), c('8', '♠'), c('2', '♥')), [130, 0]);
  assert.deepEqual(at5(c('8', '♠'), c('8', '♣'), c('2', '♥')), [65, 0]);
  assert.deepEqual(at5(c('8', '♠'), c('8', '♥'), c('2', '♦')), [35, 0]);
  assert.deepEqual(at5(c('8', '♠'), c('8', '♠'), c('8', '♠')), [130, 505]);
  assert.deepEqual(at5(c('A', '♠'), c('2', '♠'), c('3', '♠')), [0, 205]);
  assert.deepEqual(at5(c('8', '♠'), c('8', '♥'), c('8', '♦')), [35, 155]);
  assert.deepEqual(at5(c('Q', '♠'), c('K', '♥'), c('A', '♦')), [0, 55]);
  assert.deepEqual(at5(c('2', '♠'), c('7', '♠'), c('J', '♠')), [0, 30]);
  assert.deepEqual(at5(c('K', '♠'), c('A', '♥'), c('2', '♦')), [0, 0]);
  assert.deepEqual(at5(c('9', '♠'), c('7', '♥'), c('5', '♦')), [0, 0]);
});

test('the hole card never counts, an unplaced side bet has no result, and each box settles against the same upcard', () => {
  // 7♠ 8♠ with the 9♠ as hole card would be a straight flush; with the 9♠ as upcard it is one.
  assert.equal(deal(c('7', '♠'), c('8', '♠'), c('2', '♦'), { tp: 5 }, c('9', '♠')).hands[0].sideReturn, 0);
  assert.equal(deal(c('7', '♠'), c('8', '♠'), c('9', '♠'), { tp: 5 }, c('2', '♦')).hands[0].sideReturn, 205);
  const only = deal(c('8', '♠'), c('8', '♠'), c('8', '♠'), { pp: 5 }).hands[0];
  assert.deepEqual(Object.keys(only.sideResults), ['pp'], 'no 21+3 result without a 21+3 stake');
  assert.equal(only.sideReturn, 130, 'suited trips pay nothing on 21+3 that was not placed');
  const none = deal(c('8', '♠'), c('8', '♠'), c('8', '♠'), {}).hands[0];
  assert.deepEqual([none.sideResults, none.sideReturn, none.sideLabels], [{}, 0, []]);
  // Two boxes, dealt right to left: box 1 first card, box 0 first card, upcard, box 1 second, box 0 second, hole.
  const r = new Round([{ main: 5, pp: 5, tp: 5 }, { main: 5, pp: 5, tp: 5 }],
    [HOLE, c('3', '♥'), c('9', '♥'), c('J', '♥'), c('2', '♥'), c('10', '♥')]);
  r.deal();
  assert.deepEqual(r.hands.map(h => [h.sideResults.pp.label, h.sideResults.tp.label]),
    [['Perfect Pairs lost', 'Flush'], ['Perfect Pairs lost', 'Straight Flush']]);
  assert.deepEqual(r.hands.map(h => h.sideReturn), [30, 205]);
});

// ---- Ledger through the core: one stake debit per box (main + pp + tp), one payout credit per hand.

const code = expected => error => error instanceof BlackjackCoreError && error.code === expected;
function table(config = {}, wallet = 1000) {
  const random = deterministicRandom('p-e-sidebets');
  const t = { random, config, state: newGame({ random }).state, wallet, effects: [] };
  t.send = command => {
    const reserved = { stake: {}, insurance: {} };
    if (command.op === 'start') command.bets.forEach((b, box) => { const n = b.main + b.pp + b.tp; if (n) reserved.stake[box] = n; });
    if (command.op === 'insurance') for (const h of t.state.round.hands) if (command.takeBoxes.includes(h.box)) reserved.insurance[h.box] = h.stake / 2;
    const out = step(t.state, command, t.config, { random: t.random, funding: { available: t.wallet, reserved } });
    t.state = out.state; t.effects.push(...out.effects);
    for (const e of out.effects) t.wallet += e.direction === 'debit' ? -e.amount : e.amount;
    return out;
  };
  // Next cards to deal, in deal order (Kevin's croupier-shoe test rewrites the shoe top the same way).
  t.stack = cards => { t.state.shoe.cards.splice(-cards.length, cards.length, ...cards.map(([r, s]) => ({ r, s })).reverse()); };
  t.start = bets => t.send({ op: 'start', bets: [{ ...EMPTY, ...bets }, ...Array.from({ length: 6 }, () => ({ ...EMPTY }))] });
  t.act = action => { const r = t.state.round; return t.send({ op: 'act', action, roundId: t.state.roundId, turnSeq: t.state.turnSeq, handIndex: r.active, box: r.hands[r.active].box }); };
  t.standAll = () => { while (t.state.round.phase === 'decisions') t.act('stand'); };
  t.collect = () => t.send({ op: 'collect', roundId: t.state.roundId }).effects;
  return t;
}
const BETS = { main: 5, pp: 5, tp: 5 };
const stakeDebit = amount => ({ kind: 'stake', direction: 'debit', source: 'reservation', box: 0, amount });
const payout = (amount, hand = 0) => ({ kind: 'payout', direction: 'credit', box: 0, hand, amount });

test('ledger: a winning side bet is paid even when the main hand busts, in the single payout credit', () => {
  const t = table();
  t.stack([['8', '♠'], ['7', '♦'], ['8', '♠'], ['10', '♣'], ['K', '♥']]);
  assert.deepEqual(t.start(BETS).effects, [stakeDebit(15)], 'one debit for main + Perfect Pairs + 21+3');
  const { pp, tp } = t.state.round.hands[0].sideResults;
  assert.deepEqual([pp.label, pp.returned, pp.draws, tp.label, tp.returned, tp.draws], ['Perfect Pair', 130, [2, 4], '21+3 lost', 0, [2, 4, 3]]);
  t.act('hit');
  assert.equal(t.state.round.phase, 'settled');
  assert.equal(t.state.round.hands[0].busted, true);
  assert.deepEqual(t.collect(), [payout(130)], 'main lost (0) + side return 130, no separate side effect');
  assert.equal(t.wallet, 1115);
});

test('ledger: dealer blackjack does not touch a 21+3 already settled at the deal', () => {
  const t = table();
  t.stack([['10', '♠'], ['Q', '♠'], ['J', '♠'], ['A', '♥']]);
  t.start(BETS);
  assert.equal(t.state.round.phase, 'settled', 'dealer peeks a blackjack and settles at once');
  assert.equal(t.state.round.hands[0].result, 0);
  assert.equal(t.state.round.hands[0].sideReturn, 205, 'straight flush 10-J-Q, Perfect Pairs lost');
  assert.deepEqual(t.collect(), [payout(205)]);
  assert.equal(t.wallet, 1190);
});

test('ledger: side bets settle before insurance; push, lost insurance and side win land in one credit', () => {
  const t = table();
  t.stack([['Q', '♠'], ['A', '♠'], ['K', '♠'], ['9', '♦']]);
  t.start(BETS);
  assert.equal(t.state.round.phase, 'insurance');
  assert.equal(t.state.round.hands[0].sideReturn, 205, 'Q-K-A suited is settled before the insurance decision');
  assert.deepEqual(t.send({ op: 'insurance', takeBoxes: [0], roundId: t.state.roundId }).effects,
    [{ kind: 'insurance', direction: 'debit', source: 'reservation', box: 0, hand: 0, amount: 2.5 }]);
  t.standAll();
  assert.equal(t.state.round.hands[0].result, 5, 'player 20 against dealer soft 20 is a push; insurance lost');
  assert.deepEqual(t.collect(), [payout(210)]);
  assert.equal(t.wallet, 1192.5);
  assert.deepEqual(t.effects.map(e => e.kind), ['stake', 'insurance', 'payout'], 'exactly one effect per money movement');
});

test('ledger: when everything loses the hand still gets exactly one payout credit, of 0', () => {
  const t = table();
  t.stack([['9', '♠'], ['5', '♦'], ['7', '♥'], ['10', '♣'], ['6', '♣']]);
  t.start(BETS);
  t.standAll();
  assert.deepEqual(t.collect(), [payout(0)]);
  assert.equal(t.wallet, 985);
  assert.throws(() => t.collect(), code('NO_ACTIVE_ROUND'), 'no second settlement');
});

test('ledger: after a split the side bet stays on the first hand and is paid once', () => {
  const t = table();
  t.stack([['8', '♠'], ['6', '♦'], ['8', '♠'], ['10', '♣'], ['K', '♥'], ['9', '♦'], ['5', '♠']]);
  t.start({ main: 5, pp: 5, tp: 0 });
  t.act('split');
  assert.deepEqual(t.state.round.hands.map(h => [h.pp, h.sideReturn]), [[5, 130], [0, 0]]);
  t.standAll();
  assert.deepEqual(t.collect(), [payout(130, 0), payout(0, 1)], 'both hands lose to 21; Perfect Pair paid on hand 0 only');
  assert.equal(t.wallet, 1000 - 10 - 5 + 130);
});

test('limits: each profile accepts side bets up to sideMax, never above, and the most a box can win is sideMax × 127', () => {
  for (const [name, p] of Object.entries(ROOM_LIMIT_PRESETS)) {
    const t = table({ limits: { min: p.min, max: p.max, sideMax: p.sideMax } }, 1e7);
    for (const over of [{ pp: p.sideMax + 1 }, { tp: p.sideMax + 0.01 }])
      assert.throws(() => t.start({ main: p.min, pp: 0, tp: 0, ...over }), code('INVALID_STAKE'), `${name}: above sideMax`);
    // Suited trips imply a Perfect Pair, so both side bets win their top line at once: 26 + 101 = 127.
    t.stack([['8', '♠'], ['8', '♠'], ['8', '♠'], ['10', '♣']]);
    t.start({ main: p.min, pp: p.sideMax, tp: p.sideMax });
    const hand = t.state.round.hands[0];
    assert.deepEqual([hand.sideResults.pp.returned, hand.sideResults.tp.returned], [p.sideMax * 26, p.sideMax * 101], name);
    t.standAll();
    assert.deepEqual(t.collect(), [payout(p.sideMax * 127)], `${name}: main 16 loses to 18, side bets at their cap`);
  }
  // Across the whole paytable no side bet returns more than 101 × its stake.
  for (const [label, first, second, up] of CASES) {
    const { pp, tp } = deal(first, second, up, { pp: 7, tp: 7 }).hands[0].sideResults;
    assert.ok(pp.returned <= 7 * 26 && tp.returned <= 7 * 101, label);
  }
});
