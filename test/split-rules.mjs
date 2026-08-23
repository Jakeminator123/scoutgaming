// split-rules.mjs — deterministic rule tests for SPLITTING in
// web/public/blackjack.mjs, plus a seeded randomized invariant sweep.
//
// Usage: node test/split-rules.mjs [seed] [sweepRounds]
//
// Part 1 drives the engine with STACKED shoes: every scenario overrides
// round.shoe with an exact draw order, so each rule is asserted on known
// cards rather than on luck. Part 2 plays random rounds (splitting freely)
// and checks the money/ordering/payout invariants that must hold everywhere.
//
// Shoe mechanics the stacking relies on: draw() pops off the END of the array,
// and deal() takes, in order: first card to each live box RIGHT TO LEFT, the
// dealer upcard, second card to each live box right to left, then the hole
// card. stack() takes the draws in the order they come out and reverses them.

const SEED = (Number(process.argv[2]) || 20260823) >>> 0;
const SWEEP_ROUNDS = Number(process.argv[3]) || 50000;

function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };
}
const engineU32 = sfc32(SEED ^ 0x9e3779b9, SEED ^ 0x243f6a88, SEED ^ 0xb7e15162, SEED ^ 0xdeadbeef);
for (let i = 0; i < 16; i++) engineU32();
Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: { getRandomValues(buf) { for (let i = 0; i < buf.length; i++) buf[i] = engineU32(); return buf; } },
});
const drvU32 = sfc32(SEED ^ 0xa5a5a5a5, SEED ^ 0x0f0f0f0f, SEED ^ 0x5a5a5a5a, SEED ^ 0x33333333);
for (let i = 0; i < 16; i++) drvU32();
const rand = () => drvU32() / 4294967296;
const randi = (n) => Math.floor(rand() * n);

const { Round, handValue } = await import('../web/public/blackjack.mjs');

// ------------------------------------------------------------------ harness ---
let pass = 0, fail = 0;
const failures = [];
function ok(label, cond) {
  if (cond) { pass++; console.log(`  ok    ${label}`); }
  else { fail++; failures.push(label); console.log(`  FAIL  ${label}`); }
}
function eq(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ok    ${label} = ${a}`); }
  else { fail++; failures.push(label); console.log(`  FAIL  ${label} = ${a}   expected ${e}`); }
}
function throws(label, fn) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  ok(label, threw);
}
function rule(n, text) { console.log(`\nRULE ${n} — ${text}`); }

// ---------------------------------------------------------------- utilities ---
const C = (s) => ({ r: s.slice(0, -1), s: s.slice(-1) });
const cs = (c) => (c ? c.r + c.s : String(c));
const cards = (h) => h.cards.map(cs);
const total = (h) => handValue(h.cards).total;
const TEN = (c) => ['10', 'J', 'Q', 'K'].includes(c.r);

// Build a round whose shoe hands out exactly `order`, then filler.
function stacked(entries, order, filler = '5♣') {
  const r = new Round(entries);
  const pad = Array.from({ length: 80 }, () => C(filler));
  r.shoe = [...pad, ...order.map(C).reverse()];
  return r;
}
const stakeSum = (r, box) => r.live().filter((h) => h.box === box).reduce((a, h) => a + h.stake, 0);
const handsOf = (r, box) => r.live().filter((h) => h.box === box);

console.log(`seed=${SEED} sweepRounds=${SWEEP_ROUNDS}`);
console.log('\n================ PART 1: STACKED-SHOE RULE TESTS ================');

// --------------------------------------------------------------------- R1 ---
rule(1, 'split only on the first two cards, same rank OR any two ten-valued');
{
  const r = stacked([10], ['8♠', '6♦', '8♥', '9♣', '3♦', '2♠']);
  r.deal();
  eq('8♠ 8♥ vs 6♦ — legal()', r.legal(), ['hit', 'stand', 'double', 'split']);
}
{
  const r = stacked([10], ['10♠', '6♦', 'K♦', '9♣']);
  r.deal();
  ok('10♠ K♦ (different ranks, both ten-valued) — split offered', r.legal().includes('split'));
}
{
  const r = stacked([10], ['9♠', '6♦', '8♦', '9♣']);
  r.deal();
  ok('9♠ 8♦ — split NOT offered', !r.legal().includes('split'));
  throws('act("split") on 9♠ 8♦ throws', () => r.act('split'));
}
{
  const r = stacked([10], ['8♠', '6♦', '8♥', '9♣', '2♦']);
  r.deal();
  r.act('hit'); // 8 8 2 = 18, still the player's turn
  eq('8♠ 8♥ after a hit — cards', cards(r.live()[0]), ['8♠', '8♥', '2♦']);
  eq('8♠ 8♥ after a hit — legal()', r.legal(), ['hit', 'stand']);
  throws('act("split") after a hit throws', () => r.act('split'));
}

// --------------------------------------------------------------------- R2 ---
rule(2, 'the split hand costs another bet the same size as the hand it came from');
let R2;
{
  const r = R2 = stacked([10], ['8♠', '6♦', '8♥', '9♣', '3♦', '2♠']);
  r.deal();
  r.act('split');
  eq('hands after splitting 8s', r.live().map(cards), [['8♠', '3♦'], ['8♥', '2♠']]);
  eq('each hand keeps one 8 plus one new card', r.live().map((h) => h.cards.length), [2, 2]);
  eq('stakes', r.live().map((h) => h.stake), [10, 10]);
  eq('total staked on the box', stakeSum(r, 0), 20);
  eq('box index on both hands', r.live().map((h) => h.box), [0, 0]);
  eq('splitFrom on both hands', r.live().map((h) => h.splitFrom), [0, 0]);
  ok('boxes[0] is still the first hand of the box (same object)', r.boxes[0] === r.live()[0]);
  eq('sibling carries no side bets / insurance',
    [r.live()[1].pp, r.live()[1].tp, r.live()[1].sideReturn, r.live()[1].insured], [0, 0, 0, 0]);
  eq('active hand after the split (rightmost of the box)', r.active, 1);
}

// --------------------------------------------------------------------- R3 ---
rule(3, 'up to 4 hands per box, resplitting allowed until the cap');
{
  const r = stacked([10], ['8♠', '6♦', '8♥', '9♣', '8♦', '8♣', '8♠', '8♥', '8♦', '8♣']);
  r.deal();
  const seq = [];
  r.act('split'); seq.push(handsOf(r, 0).length);
  r.act('split'); seq.push(handsOf(r, 0).length);
  r.act('split'); seq.push(handsOf(r, 0).length);
  eq('hand count after each of 3 splits', seq, [2, 3, 4]);
  eq('every hand is a pair of 8s', r.live().map(cards),
    [['8♠', '8♦'], ['8♥', '8♠'], ['8♣', '8♦'], ['8♥', '8♣']]);
  ok('4th hand is a pair yet split is NOT offered (cap)', !r.legal().includes('split'));
  eq('legal() at the cap', r.legal(), ['hit', 'stand', 'double']);
  throws('act("split") at the cap throws', () => r.act('split'));
  eq('total staked on the box', stakeSum(r, 0), 40);
  const order = [];
  while (r.phase === 'decisions') { order.push(r.active); r.act('stand'); }
  eq('the 4 hands act right to left', order, [3, 2, 1, 0]);
  eq('all 4 hands settled', r.live().map((h) => h.result), [0, 0, 0, 0]);
}

// --------------------------------------------------------------------- R4 ---
rule(4, 'split aces: exactly one card each, then done — no hit, no double, no resplit');
{
  const r = stacked([10], ['A♠', '6♦', 'A♥', '9♣', 'A♦', '7♣']);
  r.deal();
  ok('A♠ A♥ — split offered', r.legal().includes('split'));
  r.act('split');
  eq('one card to each ace', r.live().map(cards), [['A♠', 'A♦'], ['A♥', '7♣']]);
  eq('both hands done', r.live().map((h) => h.done), [true, true]);
  eq('the round moved straight past the player', r.phase, 'settled');
  eq('legal() offers nothing', r.legal(), []);
  throws('act("hit") on a split ace throws', () => r.act('hit'));
  eq('the re-paired aces (A♠ A♦) did NOT resplit — hand count', handsOf(r, 0).length, 2);
}

// --------------------------------------------------------------------- R5 ---
rule(5, 'a two-card 21 after a split is NOT a blackjack: 1:1, not 3:2');
{
  const r = stacked([10], ['A♠', '6♦', 'A♥', '9♣', 'K♦', 'Q♣']);
  r.deal();
  r.act('split');
  eq('both split hands hold a two-card 21', r.live().map((h) => [cards(h).join(' '), total(h)]),
    [['A♠ K♦', 21], ['A♥ Q♣', 21]]);
  eq('dealer had to play them out (6♦ 9♣ 15 -> draws)', r.dealer.map(cs), ['6♦', '9♣', '5♣']);
  eq('dealer total', handValue(r.dealer).total, 20);
  eq('payout per hand is 1:1 (stake x2), NOT 3:2 (x2.5)', r.live().map((h) => h.result), [20, 20]);
}
{
  const r = stacked([10], ['A♠', '6♦', 'K♦', '9♣']);
  r.deal();
  eq('control: an UNSPLIT natural still pays 3:2', r.live()[0].result, 25);
  eq('control: dealer does not draw behind a natural', r.dealer.map(cs), ['6♦', '9♣']);
}
{
  // Dealer blackjack is resolved at the peek, before any decision, so a split
  // hand can never meet one: a post-split 21 gets no special push either way.
  const r = stacked([{ main: 10 }], ['8♠', 'A♦', '8♥', 'K♣']);
  r.deal();
  eq('dealer ace — insurance offered first', r.phase, 'insurance');
  r.resolveInsurance([true]);
  eq('dealer blackjack ends the round at the peek', r.phase, 'settled');
  eq('the pair never got the chance to split', r.live().length, 1);
  eq('box loses 10, insurance returns 5 x 3', r.live()[0].result, 15);
}

// --------------------------------------------------------------------- R6 ---
rule(6, 'double after split is allowed, and doubles only that hand');
{
  const r = stacked([10], ['8♠', '6♦', '8♥', '9♣', '3♦', '2♠', '9♥', 'K♦']);
  r.deal();
  r.act('split');
  eq('active hand 8♥ 2♠ — legal()', r.legal(), ['hit', 'stand', 'double']);
  r.act('double');
  eq('doubled hand', cards(r.live()[1]), ['8♥', '2♠', '9♥']);
  eq('doubled flags', r.live().map((h) => h.doubled), [false, true]);
  eq('stakes: only the doubled hand grew', r.live().map((h) => h.stake), [10, 20]);
  r.act('stand');
  eq('dealer busts', [r.dealer.map(cs), handValue(r.dealer).total], [['6♦', '9♣', 'K♦'], 25]);
  eq('payouts follow each hand own stake', r.live().map((h) => h.result), [20, 40]);
  eq('total debited = 10 main + 10 split + 10 double', stakeSum(r, 0), 30);
  eq('total returned', r.live().reduce((a, h) => a + h.result, 0), 60);
}

// --------------------------------------------------------------------- R7 ---
rule(7, 'every hand of a box plays, right to left, before the box to its left');
{
  const r = stacked([10, 20], ['8♠', '9♠', '6♦', '8♥', '9♥', '5♥', '3♦', '4♠']);
  r.deal();
  eq('box 0 (left) cards', cards(r.live()[0]), ['9♠', '9♥']);
  eq('box 1 (right) cards', cards(r.live()[1]), ['8♠', '8♥']);
  eq('rightmost box acts first', r.live()[r.active].box, 1);
  const seen = [];
  seen.push(r.live()[r.active].box); r.act('split');
  while (r.phase === 'decisions') { seen.push(r.live()[r.active].box); r.act('stand'); }
  eq('box of each acting hand, in order', seen, [1, 1, 1, 0]);
  eq('hand -> box map of the settled table', r.live().map((h) => h.box), [0, 1, 1]);
  eq('the split hands sit next to each other', r.live().map(cards),
    [['9♠', '9♥'], ['8♠', '3♦'], ['8♥', '4♠']]);
}

// --------------------------------------------------------------------- R8 ---
rule(8, 'side bets settle at the deal on the original two cards and are never paid twice');
{
  const r = stacked([{ main: 10, pp: 5, tp: 5 }], ['8♥', '8♣', '8♦', '9♠', '3♦', '2♠']);
  r.deal();
  eq('side labels off 8♥ 8♦ + upcard 8♣', r.live()[0].sideLabels, ['Colored Pair 12:1', 'Three of a Kind 30:1']);
  eq('side return at the deal', r.live()[0].sideReturn, 220);
  r.act('split');
  eq('side money stays on the box hand', r.live().map((h) => h.sideReturn), [220, 0]);
  eq('side stakes stay on the box hand', r.live().map((h) => [h.pp, h.tp]), [[5, 5], [0, 0]]);
  eq('sibling has no labels', r.live()[1].sideLabels, []);
  r.act('stand'); r.act('stand');
  eq('after settlement the side bet is still paid exactly once',
    r.live().reduce((a, h) => a + h.sideReturn, 0), 220);
}

// --------------------------------------------------------------------- R9 ---
rule(9, 'insurance is half the ORIGINAL box stake, paid once, not per split hand');
{
  const r = stacked([{ main: 100 }], ['8♠', 'A♦', '8♥', '6♣', 'Q♦', 'K♠']);
  r.deal();
  eq('insurance offered', r.phase, 'insurance');
  r.resolveInsurance([true]);
  eq('insured = stake / 2', r.live()[0].insured, 50);
  eq('no dealer blackjack behind the ace', r.phase, 'decisions');
  r.act('split');
  eq('insurance stays on the box hand only', r.live().map((h) => h.insured), [50, 0]);
  eq('total insurance on the box after splitting', r.live().reduce((a, h) => a + h.insured, 0), 50);
  r.act('stand'); r.act('stand');
  eq('dealer stands on soft 17 (S17)', [r.dealer.map(cs), handValue(r.dealer).total], [['A♦', '6♣'], 17]);
  eq('both 18s win 1:1, insurance pays nothing', r.live().map((h) => h.result), [200, 200]);
  eq('total debited = 200 stakes + 50 insurance', stakeSum(r, 0) + 50, 250);
}

// -------------------------------------------------------------------- R10 ---
rule(10, 'the dealer plays if ANY hand on ANY box can still be paid');
{
  // Box 0 busts both its split hands; box 1 stands on 13. The dealer must
  // still draw for box 1.
  const r = stacked([10, 10], ['9♠', '8♠', '6♦', '9♥', '8♥', '4♣', 'K♦', 'K♣', '5♦']);
  r.deal();
  eq('box 1 (right) holds 9♠ 9♥', cards(r.live()[1]), ['9♠', '9♥']);
  r.act('split');                       // box 1 splits its 9s
  r.act('hit'); r.act('hit');           // each hand is 9 + K = 19, then hits a 5 = 24
  eq('both split hands busted', handsOf(r, 1).map(total), [24, 24]);
  r.act('stand');                       // box 0: 8♠ 8♥ = 16... stands
  ok('dealer drew for the surviving box', r.dealer.length > 2);
  ok('dealer reached 17+', handValue(r.dealer).total >= 17);
  eq('busted split hands pay 0', handsOf(r, 1).map((h) => h.result), [0, 0]);
}
{
  // Mirror image: every remaining hand is a post-split 21. Those are NOT
  // naturals, so the dealer must still play (asserted under RULE 5 too).
  const r = stacked([10], ['A♠', '9♦', 'A♥', '6♣', 'K♦', 'Q♣']);
  r.deal();
  r.act('split');
  ok('dealer played behind two post-split 21s', r.dealer.length > 2);
  eq('dealer drew to 20 (9♦ 6♣ 5♣)', [r.dealer.map(cs), handValue(r.dealer).total], [['9♦', '6♣', '5♣'], 20]);
  eq('both hands beat the dealer at 1:1', r.live().map((h) => h.result), [20, 20]);
}

console.log(`\nPart 1: ${pass} checks passed, ${fail} failed`);

// ==================================================================== PART 2 ===
console.log('\n================ PART 2: RANDOMIZED INVARIANT SWEEP ================');

const STAKES = [1, 2, 5, 10, 25, 100];
function randomEntries() {
  const n = 1 + randi(4);
  const e = [];
  for (let i = 0; i < n; i++) {
    const main = rand() < 0.15 ? 0 : STAKES[randi(STAKES.length)];
    e.push(rand() < 0.3 ? main : { main, pp: rand() < 0.5 ? 0 : STAKES[randi(STAKES.length)], tp: rand() < 0.5 ? 0 : STAKES[randi(STAKES.length)] });
  }
  const mainOf = (x) => (typeof x === 'number' ? x : x.main);
  if (e.every((x) => mainOf(x) === 0)) e[0] = STAKES[randi(STAKES.length)];
  return e;
}

const sweep = {
  rounds: 0, hands: 0, splits: 0, resplits: 0, aceSplits: 0, capHits: 0,
  doubles: 0, post21: 0, maxHandsOnBox: 0, dealerBJ: 0,
};
const bad = [];
function fatal(msg, ctx) {
  fail++;
  if (bad.length < 5) bad.push({ msg, ctx });
}

for (let n = 0; n < SWEEP_ROUNDS; n++) {
  const entries = randomEntries();
  const r = new Round(entries);
  r.deal();

  let mainDebit = r.live().reduce((a, h) => a + h.stake, 0);
  let insDebit = 0;
  if (r.phase === 'insurance') {
    const flags = r.live().map(() => rand() < 0.5);
    insDebit = r.live().reduce((a, h, i) => a + (flags[i] ? h.stake / 2 : 0), 0);
    r.resolveInsurance(flags);
  }

  const aceSplitBoxes = [];
  let guard = 0;
  while (r.phase === 'decisions' && guard++ < 100) {
    const acts = r.legal();
    if (!acts.length) { fatal('legal() empty during decisions', { n }); break; }
    const i = r.active;
    const h = r.live()[i];
    const pairish = h.cards.length === 2 && (h.cards[0].r === h.cards[1].r || (TEN(h.cards[0]) && TEN(h.cards[1])));
    if (!pairish && acts.includes('split')) fatal('split offered on a non-pair', { n, cards: cards(h) });
    if (pairish && !acts.includes('split')) {
      const cnt = handsOf(r, h.box).length;
      if (cnt !== 4) fatal(`split withheld on a pair with only ${cnt} hands on the box`, { n, cards: cards(h) });
      else sweep.capHits++;
    }
    if (acts.includes('double') && h.cards.length !== 2) fatal('double offered on 3+ cards', { n, cards: cards(h) });

    const a = acts[randi(acts.length)];
    const aceSplit = a === 'split' && h.cards[0].r === 'A';
    if (a === 'split') {
      mainDebit += h.stake; sweep.splits++;
      if (h.splitFrom !== null) sweep.resplits++;
    }
    if (a === 'double') { mainDebit += h.stake; sweep.doubles++; }
    r.act(a);
    if (a === 'split') {
      const p = r.live()[i], q = r.live()[i + 1];
      if (!(p === h && q && q.box === h.box && q.splitFrom === h.box && p.splitFrom === h.box)) {
        fatal('split did not seat the sibling beside its parent', { n });
      } else if (q.stake !== p.stake) {
        fatal('split sibling has a different stake', { n, a: p.stake, b: q.stake });
      }
      if (aceSplit) {
        sweep.aceSplits++;
        aceSplitBoxes.push(h.box);
        if (!(p.done && q.done && p.cards.length === 2 && q.cards.length === 2)) {
          fatal('split aces did not stop at one card each', { n, p: cards(p), q: cards(q) });
        }
      }
    }
  }

  if (r.phase !== 'settled') { fatal(`round stuck in phase ${r.phase}`, { n }); continue; }

  const d = handValue(r.dealer).total;
  const dealerBJ = r.dealer.length === 2 && d === 21;
  if (dealerBJ) sweep.dealerBJ++;
  let stakeTotal = 0, insTotal = 0;
  const byBox = new Map();
  r.live().forEach((h, idx) => {
    sweep.hands++;
    stakeTotal += h.stake;
    insTotal += h.insured;
    if (!byBox.has(h.box)) byBox.set(h.box, []);
    byBox.get(h.box).push(idx);
    if (!(r.boxes[h.box] && r.boxes[h.box].stake > 0)) fatal('hand points at a dead box', { n, box: h.box });
    if (h !== r.boxes[h.box]) {
      if (h.pp || h.tp || h.sideReturn || h.sideLabels.length || h.insured) {
        fatal('split sibling carries box-level money', { n, pp: h.pp, tp: h.tp, side: h.sideReturn, ins: h.insured });
      }
      if (h.splitFrom === null) fatal('split sibling has splitFrom === null', { n });
    }
    const p = handValue(h.cards).total;
    const natural = h.splitFrom === null && h.cards.length === 2 && p === 21;
    let expected = 0;
    if (h.insured) expected += dealerBJ ? h.insured * 3 : 0;
    if (natural) expected += dealerBJ ? h.stake : h.stake * 2.5;
    else if (dealerBJ || p > 21) expected += 0;
    else if (d > 21 || p > d) expected += h.stake * 2;
    else if (p === d) expected += h.stake;
    if (h.result !== expected) {
      fatal(`payout ${h.result} != ${expected}`, { n, cards: cards(h), p, d, natural, stake: h.stake, ins: h.insured });
    }
    if (h.splitFrom !== null && h.cards.length === 2 && p === 21) {
      sweep.post21++;
      if (h.result === h.stake * 2.5) fatal('post-split 21 paid 3:2', { n, cards: cards(h) });
    }
  });

  if (stakeTotal !== mainDebit) fatal(`staked ${stakeTotal} != debited ${mainDebit}`, { n });
  if (insTotal !== insDebit) fatal(`insured ${insTotal} != debited ${insDebit}`, { n });

  for (const [box, idxs] of byBox) {
    if (idxs.length > 4) fatal(`box ${box} ended with ${idxs.length} hands`, { n });
    if (idxs.length > sweep.maxHandsOnBox) sweep.maxHandsOnBox = idxs.length;
    if (idxs[idxs.length - 1] - idxs[0] !== idxs.length - 1) fatal(`box ${box} hands are not contiguous in live()`, { n, idxs });
    const virgins = idxs.filter((i) => r.live()[i].splitFrom === null).length;
    if (idxs.length === 1 ? virgins !== 1 : virgins !== 0) fatal(`box ${box} splitFrom marking is wrong`, { n, virgins, hands: idxs.length });
  }
  for (const box of new Set(aceSplitBoxes)) {
    if (handsOf(r, box).length !== 2) fatal(`aces resplit: box ${box} ended with ${handsOf(r, box).length} hands`, { n });
  }

  const anyLive = r.live().some((h) => {
    const p = handValue(h.cards).total;
    return p <= 21 && !(h.splitFrom === null && h.cards.length === 2 && p === 21);
  });
  if (anyLive && !dealerBJ) {
    if (d < 17) fatal(`dealer stood on ${d} with a payable hand still out`, { n });
    for (let k = 2; k < r.dealer.length; k++) {
      if (handValue(r.dealer.slice(0, k)).total >= 17) fatal('dealer drew on 17+ (S17 breach)', { n });
    }
  }
  sweep.rounds++;
}

console.log(`rounds:            ${sweep.rounds}`);
console.log(`hands settled:     ${sweep.hands}  (max ${sweep.maxHandsOnBox} on one box)`);
console.log(`splits:            ${sweep.splits}  (resplits ${sweep.resplits}, ace splits ${sweep.aceSplits})`);
console.log(`4-hand cap hit:    ${sweep.capHits} times (pair held, split correctly withheld)`);
console.log(`doubles:           ${sweep.doubles}   dealer blackjacks: ${sweep.dealerBJ}`);
console.log(`post-split 21s:    ${sweep.post21} (each checked NOT to pay 3:2)`);
console.log(`sweep violations:  ${bad.length ? bad.length + '+' : 0}`);
for (const b of bad) console.log(`  !! ${b.msg}  ${JSON.stringify(b.ctx)}`);

console.log('\n================ RESULT ================');
console.log(`${pass} passed, ${fail} failed`);
for (const f of failures) console.log(`  failed: ${f}`);
console.log(fail === 0 ? 'ALL SPLIT RULES HOLD' : `FAILED: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
