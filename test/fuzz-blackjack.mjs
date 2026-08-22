// fuzz-blackjack.mjs — fuzz/invariant test for web/public/blackjack.mjs
// Covers the main game plus the Perfect Pairs and 21+3 side bets.
//
// Usage: node test/fuzz-blackjack.mjs [seed] [fuzzRounds] [rtpRounds]
//
// The engine draws randomness from crypto.getRandomValues. We replace the
// global with a seeded sfc32 PRNG BEFORE importing the engine so every run is
// exactly reproducible from the printed seed (the engine's own rejection
// sampling in randInt still runs on top of it).

const SEED = (Number(process.argv[2]) || 20260822) >>> 0;
const FUZZ_ROUNDS = Number(process.argv[3]) || 200000;
const RTP_ROUNDS = Number(process.argv[4]) || 500000;

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

// Engine randomness (shoe shuffles)
const engineU32 = sfc32(SEED ^ 0x9e3779b9, SEED ^ 0x243f6a88, SEED ^ 0xb7e15162, SEED ^ 0xdeadbeef);
for (let i = 0; i < 16; i++) engineU32();
Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: {
    getRandomValues(buf) {
      for (let i = 0; i < buf.length; i++) buf[i] = engineU32();
      return buf;
    },
  },
});

// Driver randomness (stakes, action choices, insurance choices) — separate
// stream so driver decisions don't perturb the card stream ordering.
const drvU32 = sfc32(SEED ^ 0xa5a5a5a5, SEED ^ 0x0f0f0f0f, SEED ^ 0x5a5a5a5a, SEED ^ 0x33333333);
for (let i = 0; i < 16; i++) drvU32();
const rand = () => drvU32() / 4294967296;
const randi = (n) => Math.floor(rand() * n);

const { Round, handValue } = await import('../web/public/blackjack.mjs');

// ---------------------------------------------------------------- helpers ---
const cardStr = (c) => (c ? c.r + c.s : null);
const isBJ = (cards) => cards.length === 2 && handValue(cards).total === 21;

// Box entries are either a plain number (main only, legacy form) or {main, pp, tp}.
const mainOf = (e) => (typeof e === 'number' ? e : e.main);
const ppOf = (e) => (typeof e === 'number' ? 0 : e.pp);
const tpOf = (e) => (typeof e === 'number' ? 0 : e.tp);

// ------------------------- independent side-bet reference implementations ---
// Written from the paytable spec, NOT from the engine's code. Return the
// paytable multiplier N (payout = stake * (N + 1)) or 0 on a miss.
function refPerfectPairs(c1, c2) {
  if (c1.r !== c2.r) return 0;
  if (c1.s === c2.s) return 25; // perfect: same rank AND suit
  const red = (c) => c.s === '♥' || c.s === '♦';
  return red(c1) === red(c2) ? 12 : 6; // colored : mixed
}
const TP_ORDER = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
function refTwentyOnePlusThree(c1, c2, c3) {
  const cs = [c1, c2, c3];
  const flush = c1.s === c2.s && c2.s === c3.s;
  if (c1.r === c2.r && c2.r === c3.r) return flush ? 100 : 30; // (suited) trips
  const v = cs.map((c) => TP_ORDER.indexOf(c.r) + 1).sort((a, b) => a - b);
  const distinct = v[0] !== v[1] && v[1] !== v[2];
  const straight =
    distinct &&
    ((v[1] === v[0] + 1 && v[2] === v[1] + 1) || // ace-low / no ace (A-2-3 ok)
      (v[0] === 1 && v[1] === 12 && v[2] === 13)); // ace-high Q-K-A; K-A-2 is NOT one
  if (straight) return flush ? 40 : 10;
  return flush ? 5 : 0;
}

function snap(r, log, roundNo) {
  if (!r) return { note: 'round object unavailable (constructor threw)', log, seed: SEED, roundNo };
  return {
    seed: SEED,
    roundNo,
    phase: r.phase,
    active: r.active,
    dealer: r.dealer.map(cardStr),
    dealerTotal: r.dealer.length ? handValue(r.dealer) : null,
    holeCard: cardStr(r.holeCard),
    boxes: r.boxes.map((b) => ({
      stake: b.stake,
      pp: b.pp,
      tp: b.tp,
      cards: b.cards.map(cardStr),
      total: b.cards.length ? handValue(b.cards) : null,
      doubled: b.doubled,
      insured: b.insured,
      done: b.done,
      result: b.result,
      sideReturn: b.sideReturn,
      sideLabels: b.sideLabels,
    })),
    actionLog: log,
  };
}

let violations = 0;
const samples = [];
function report(msg, r, log, roundNo) {
  violations++;
  if (samples.length < 5) samples.push({ msg, detail: snap(r, log, roundNo) });
}

// ------------------------------------------------- invariant 7 unit checks ---
const H = (ranks) => ranks.map((r) => ({ r, s: '♠' }));
const unitCases = [
  [['A', 'A', '9'], 21, true],
  [['A', 'A'], 12, true],
  [['A', 'K'], 21, true],
  [['K', 'Q', 'A'], 21, false],
  [['A', 'A', 'A', '9'], 12, false],
  [['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'], 21, true],
  [['K', 'Q', 'J'], 30, false],
  [['10', '9', '2'], 21, false],
  [['9', '9', '9'], 27, false],
];
for (const [ranks, expTotal, expSoft] of unitCases) {
  const hv = handValue(H(ranks));
  if (hv.total !== expTotal || hv.soft !== expSoft) {
    report(
      `handValue unit: [${ranks}] => {total:${hv.total}, soft:${hv.soft}} expected {total:${expTotal}, soft:${expSoft}}`,
      null, [], -1
    );
  }
}

// ------------------------------------------ side-bet deterministic checks ---
// Stack the shoe so deal() (one live box) pops: player c1, upcard, player c2,
// hole. Only sideReturn/sideLabels are asserted; the round is not played out.
const C = (str) => ({ r: str.slice(0, -1), s: str.slice(-1) });
function stackedDeal(entry, c1, up, c2, hole = '5♣') {
  const r = new Round([entry]);
  const pad = Array.from({ length: 24 }, () => C('5♣'));
  r.shoe = [...pad, C(hole), C(c2), C(up), C(c1)];
  r.deal();
  return r.boxes[0];
}
const sideUnitCases = [
  // [entry, c1, up, c2, expSideReturn, expLabels]
  [{ main: 1, pp: 1, tp: 1 }, 'A♠', 'K♥', 'A♠', 26, ['Perfect Pair 25:1']],
  [{ main: 1, pp: 1, tp: 1 }, 'K♥', '5♦', 'K♦', 13, ['Colored Pair 12:1']],
  [{ main: 1, pp: 1, tp: 1 }, 'K♥', '5♦', 'K♠', 7, ['Mixed Pair 6:1']],
  [{ main: 1, pp: 1, tp: 0 }, 'K♥', '5♦', 'Q♥', 0, []],
  [{ main: 1, pp: 1, tp: 1 }, '7♠', '7♠', '7♠', 127, ['Perfect Pair 25:1', 'Suited Three of a Kind 100:1']],
  [{ main: 1, pp: 1, tp: 1 }, '7♠', '7♦', '7♥', 38, ['Mixed Pair 6:1', 'Three of a Kind 30:1']],
  [{ main: 1, pp: 0, tp: 1 }, 'A♠', '3♠', '2♠', 41, ['Straight Flush 40:1']],   // ace low
  [{ main: 1, pp: 0, tp: 1 }, 'Q♠', 'K♥', 'A♦', 11, ['Straight 10:1']],          // ace high
  [{ main: 1, pp: 0, tp: 1 }, 'A♠', 'K♦', '2♥', 0, []],                           // K-A-2 wraparound MISSES
  [{ main: 1, pp: 0, tp: 1 }, '2♠', 'K♠', '9♠', 6, ['Flush 5:1']],
  [{ main: 1, pp: 0, tp: 2 }, '10♣', 'J♦', 'Q♥', 22, ['Straight 10:1']],
  [{ main: 1, pp: 0, tp: 5 }, '8♥', '2♣', '8♦', 0, []],  // pair dealt but pp not staked
  [5, 'K♥', '5♦', 'K♦', 0, []],                          // legacy number form: no side bets
];
for (const [entry, c1, up, c2, expRet, expLabels] of sideUnitCases) {
  const b = stackedDeal(entry, c1, up, c2);
  const ok =
    b.sideReturn === expRet &&
    Array.isArray(b.sideLabels) &&
    JSON.stringify([...b.sideLabels].sort()) === JSON.stringify([...expLabels].sort()) &&
    b.pp === ppOf(entry) && b.tp === tpOf(entry);
  if (!ok) {
    report(
      `side unit: [${c1} ${c2} | up ${up}] entry ${JSON.stringify(entry)} => ` +
      `sideReturn ${b.sideReturn} labels ${JSON.stringify(b.sideLabels)} pp=${b.pp} tp=${b.tp}, ` +
      `expected ${expRet} ${JSON.stringify(expLabels)}`,
      null, [], -1
    );
  }
}

// ------------------------------------------------------------- fuzz stats ---
const stats = {
  rounds: 0, boxesPlayed: 0, insOffered: 0, insTaken: 0, dealerBJ: 0,
  playerBJ: 0, doubles: 0, playerBusts: 0, dealerBusts: 0,
  pushes: 0, wins: 0, losses: 0, maxActions: 0, totalActions: 0,
  zeroStakeBoxes: 0,
  ppStaked: 0, tpStaked: 0, ppHits: 0, tpHits: 0,
};

const STAKE_VALUES = [1, 2, 3, 5, 7, 10, 25, 50, 100];

// Mixed constructor forms: legacy plain numbers AND {main, pp, tp} objects,
// with random side stakes (including 0), up to 7 boxes.
function makeBoxes() {
  const n = 1 + randi(7); // 1..7 boxes
  const entries = [];
  for (let i = 0; i < n; i++) {
    const main = rand() < 0.1 ? 0 : STAKE_VALUES[randi(STAKE_VALUES.length)]; // 10% empty box
    if (rand() < 0.3) {
      entries.push(main); // legacy number form
    } else {
      entries.push({
        main,
        pp: rand() < 0.5 ? 0 : STAKE_VALUES[randi(STAKE_VALUES.length)],
        tp: rand() < 0.5 ? 0 : STAKE_VALUES[randi(STAKE_VALUES.length)],
      });
    }
  }
  if (entries.every((e) => mainOf(e) === 0)) entries[0] = STAKE_VALUES[randi(STAKE_VALUES.length)];
  return entries;
}

function checkRound(r, origBoxes, insOffered, insFlags, log, roundNo) {
  const dHV = handValue(r.dealer);
  const dealerBJ = isBJ(r.dealer);
  if (dealerBJ) stats.dealerBJ++;
  if (dHV.total > 21) stats.dealerBusts++;

  // Invariant 7: no hand total ever exceeds 31 (post-demotion)
  if (dHV.total > 31) report(`dealer handValue ${dHV.total} > 31`, r, log, roundNo);
  for (const b of r.live()) {
    const t = handValue(b.cards).total;
    if (t > 31) report(`player handValue ${t} > 31`, r, log, roundNo);
  }

  // Invariant 2: S17 dealer discipline
  const anyLiveNonBJ = r.live().some((b) => handValue(b.cards).total <= 21 && !isBJ(b.cards));
  if (anyLiveNonBJ) {
    if (dHV.total < 17) {
      report(`dealer stopped at ${dHV.total} (<17) with a live non-BJ player hand`, r, log, roundNo);
    }
    for (let k = 2; k < r.dealer.length; k++) {
      const pre = handValue(r.dealer.slice(0, k)).total;
      if (pre >= 17) {
        report(`dealer drew card #${k + 1} after already holding ${pre} (>=17, S17 breach)`, r, log, roundNo);
      }
    }
  }

  // Per-box payout invariants 3/4/5/6
  r.live().forEach((b, i) => {
    stats.boxesPlayed++;
    const entry = origBoxes[i];
    const os = mainOf(entry);
    const p = handValue(b.cards).total;
    const playerBJ = isBJ(b.cards);
    if (playerBJ) stats.playerBJ++;
    if (p > 21) stats.playerBusts++;
    if (b.doubled) stats.doubles++;

    if (b.result === null || b.result === undefined) {
      report(`box ${i}: settled round but result is ${b.result}`, r, log, roundNo);
      return;
    }

    // stake integrity (invariant 4's "after any double, stake is the doubled stake")
    const expStake = b.doubled ? os * 2 : os;
    if (b.stake !== expStake) {
      report(`box ${i}: stake ${b.stake} expected ${expStake} (orig ${os}, doubled=${b.doubled})`, r, log, roundNo);
    }

    // Invariant 5: insured amount
    const expIns = insOffered && insFlags[i] ? os / 2 : 0;
    if (b.insured !== expIns) {
      report(`box ${i}: insured ${b.insured} expected ${expIns}`, r, log, roundNo);
    }
    if (expIns > 0) stats.insTaken++;

    // Insurance pays insured*3 into result only on dealer BJ
    const insPay = b.insured > 0 && dealerBJ ? b.insured * 3 : 0;
    const main = b.result - insPay;

    let expMain;
    if (playerBJ) expMain = dealerBJ ? b.stake : b.stake * 2.5; // invariant 3
    else if (p > 21) expMain = 0;                               // invariant 3 (bust)
    else if (dealerBJ) expMain = 0;
    else if (dHV.total > 21 || p > dHV.total) expMain = b.stake * 2; // invariant 4 (win)
    else if (p === dHV.total) expMain = b.stake;                     // invariant 4 (push)
    else expMain = 0;

    if (main !== expMain) {
      report(
        `box ${i}: main payout ${main} (result ${b.result} - insurancePay ${insPay}) expected ${expMain} ` +
        `[p=${p} pBJ=${playerBJ} d=${dHV.total} dBJ=${dealerBJ} stake=${b.stake}]`,
        r, log, roundNo
      );
    }
    if (expMain === b.stake && !playerBJ) stats.pushes++;
    else if (expMain > b.stake) stats.wins++;
    else if (expMain === 0) stats.losses++;

    // Invariant 6: bounds
    if (!(b.result >= 0 && b.result <= b.stake * 2.5 + b.insured * 3)) {
      report(`box ${i}: result ${b.result} outside [0, ${b.stake * 2.5 + b.insured * 3}]`, r, log, roundNo);
    }

    // ---------------- side-bet invariants 8-10 ----------------
    const pp = ppOf(entry), tp = tpOf(entry);
    if (pp > 0) stats.ppStaked++;
    if (tp > 0) stats.tpStaked++;
    if (b.pp !== pp || b.tp !== tp) {
      report(`box ${i}: engine pp/tp ${b.pp}/${b.tp} expected ${pp}/${tp}`, r, log, roundNo);
    }

    // Invariant 8: no side stakes => zero side return, no labels
    if (pp === 0 && tp === 0 && (b.sideReturn !== 0 || (b.sideLabels && b.sideLabels.length))) {
      report(`box ${i}: sideReturn ${b.sideReturn} labels ${JSON.stringify(b.sideLabels)} with no side stakes`, r, log, roundNo);
    }

    // Invariant 9: independently recomputed payout must match exactly.
    // b.cards[0..1] are still the first two dealt cards (hits only append).
    const ppMult = refPerfectPairs(b.cards[0], b.cards[1]);
    const tpMult = refTwentyOnePlusThree(b.cards[0], b.cards[1], r.dealer[0]);
    let expSide = 0;
    const expMults = [];
    if (pp > 0 && ppMult) { expSide += pp * (ppMult + 1); expMults.push(ppMult); stats.ppHits++; }
    if (tp > 0 && tpMult) { expSide += tp * (tpMult + 1); expMults.push(tpMult); stats.tpHits++; }
    if (b.sideReturn !== expSide) {
      report(
        `box ${i}: sideReturn ${b.sideReturn} expected ${expSide} ` +
        `[cards ${cardStr(b.cards[0])} ${cardStr(b.cards[1])} up ${cardStr(r.dealer[0])} pp=${pp} tp=${tp} ppMult=${ppMult} tpMult=${tpMult}]`,
        r, log, roundNo
      );
    }
    const labelsOk =
      Array.isArray(b.sideLabels) &&
      b.sideLabels.length === expMults.length &&
      expMults.every((m) => b.sideLabels.some((l) => typeof l === 'string' && l.endsWith(` ${m}:1`)));
    if (!labelsOk) {
      report(`box ${i}: sideLabels ${JSON.stringify(b.sideLabels)} expected multipliers [${expMults}]`, r, log, roundNo);
    }

    // Invariant 10: bounds
    if (!(b.sideReturn >= 0 && b.sideReturn <= pp * 26 + tp * 101)) {
      report(`box ${i}: sideReturn ${b.sideReturn} outside [0, ${pp * 26 + tp * 101}]`, r, log, roundNo);
    }
  });
}

// --------------------------------------------------------------- fuzz loop ---
console.log(`seed=${SEED} fuzzRounds=${FUZZ_ROUNDS} rtpRounds=${RTP_ROUNDS}`);
const t0 = Date.now();

for (let n = 0; n < FUZZ_ROUNDS; n++) {
  const log = [];
  let r;
  try {
    const entries = makeBoxes();
    stats.zeroStakeBoxes += entries.filter((e) => mainOf(e) === 0).length;
    log.push(`new Round(${JSON.stringify(entries)})`);
    r = new Round(entries);
    r.deal();

    let actions = 0;
    let insOffered = false;
    let insFlags = [];
    if (r.phase === 'insurance') {
      insOffered = true;
      stats.insOffered++;
      insFlags = r.live().map(() => rand() < 0.5);
      log.push(`resolveInsurance(${JSON.stringify(insFlags)})`);
      r.resolveInsurance(insFlags);
      actions++;
    }
    const origBoxes = entries.filter((e) => mainOf(e) > 0); // live() order == filtered constructor order

    while (r.phase === 'decisions' && actions <= 40) {
      const acts = r.legal();
      if (!acts.length) {
        report(`legal() returned [] while phase==='decisions'`, r, log, n);
        break;
      }
      const a = acts[randi(acts.length)];
      log.push(`act('${a}') box=${r.active}`);
      r.act(a);
      actions++;
    }

    stats.totalActions += actions;
    if (actions > stats.maxActions) stats.maxActions = actions;

    // Invariant 1
    if (r.phase !== 'settled') {
      report(`round did not reach 'settled' (phase='${r.phase}' after ${actions} actions)`, r, log, n);
    } else if (actions > 30) {
      report(`round settled but needed ${actions} actions (>30)`, r, log, n);
    } else {
      checkRound(r, origBoxes, insOffered, insFlags, log, n);
    }
  } catch (err) {
    report(`EXCEPTION: ${err && err.stack ? err.stack : err}`, r, log, n); // invariant 1
  }
  stats.rounds++;
  if ((n + 1) % 50000 === 0) console.log(`  fuzz ${n + 1}/${FUZZ_ROUNDS} (${violations} violations)`);
}

const fuzzSecs = ((Date.now() - t0) / 1000).toFixed(1);

// ------------------------------------------------------- house-edge / RTP ---
// Fixed simple strategy: stand on hard 17+, stand on soft 18+, hit otherwise,
// never double, never take insurance.
function rtpSim(rounds, standRule) {
  let wagered = 0, returned = 0, sum = 0, sumSq = 0;
  for (let n = 0; n < rounds; n++) {
    const r = new Round([1]);
    r.deal();
    if (r.phase === 'insurance') r.resolveInsurance([false]);
    let guard = 0;
    while (r.phase === 'decisions' && guard++ < 40) {
      const hv = handValue(r.live()[r.active].cards);
      r.act(standRule(hv) ? 'stand' : 'hit');
    }
    if (r.phase !== 'settled') throw new Error(`RTP sim: round stuck in '${r.phase}'`);
    const b = r.live()[0];
    wagered += b.stake;
    returned += b.result;
    sum += b.result;
    sumSq += b.result * b.result;
  }
  const mean = sum / rounds;
  const se = Math.sqrt((sumSq / rounds - mean * mean) / rounds);
  return { rtp: (returned / wagered) * 100, se: se * 100 };
}

const t1 = Date.now();
const main = rtpSim(RTP_ROUNDS, (hv) => (hv.soft ? hv.total >= 18 : hv.total >= 17));
const alt = rtpSim(RTP_ROUNDS, (hv) => hv.total >= 17); // stand on ANY 17 (incl. soft 17)
const rtpSecs = ((Date.now() - t1) / 1000).toFixed(1);

// Side-bet RTP: 1 unit PP on box 0, 1 unit 21+3 on box 1, fresh 8-deck shoe
// per round. Side bets settle at deal(), so no play-out is needed.
function sideRtpSim(rounds) {
  let ppSum = 0, ppSq = 0, tpSum = 0, tpSq = 0;
  for (let n = 0; n < rounds; n++) {
    const r = new Round([{ main: 1, pp: 1, tp: 0 }, { main: 1, pp: 0, tp: 1 }]);
    r.deal();
    const a = r.boxes[0].sideReturn, b = r.boxes[1].sideReturn;
    ppSum += a; ppSq += a * a;
    tpSum += b; tpSq += b * b;
  }
  const mk = (sum, sq) => {
    const mean = sum / rounds;
    return { rtp: mean * 100, se: Math.sqrt((sq / rounds - mean * mean) / rounds) * 100 };
  };
  return { pp: mk(ppSum, ppSq), tp: mk(tpSum, tpSq) };
}

const t2 = Date.now();
const side = sideRtpSim(RTP_ROUNDS);
const sideRtpSecs = ((Date.now() - t2) / 1000).toFixed(1);

// Gross-error tripwire (8 decks: PP theoretical ~95.9%, 21+3 ~96.3%)
if (!(side.pp.rtp >= 90 && side.pp.rtp <= 100)) {
  report(`Perfect Pairs RTP ${side.pp.rtp.toFixed(3)}% outside [90, 100]`, null, [], -2);
}
if (!(side.tp.rtp >= 90 && side.tp.rtp <= 100)) {
  report(`21+3 RTP ${side.tp.rtp.toFixed(3)}% outside [90, 100]`, null, [], -2);
}

// ------------------------------------------------------------------ report ---
console.log('\n================ FUZZ RESULT ================');
console.log(`rounds:            ${stats.rounds} (${fuzzSecs}s)`);
console.log(`boxes played:      ${stats.boxesPlayed} (+${stats.zeroStakeBoxes} empty boxes dealt around)`);
console.log(`insurance offered: ${stats.insOffered} rounds, taken on ${stats.insTaken} boxes`);
console.log(`dealer BJ:         ${stats.dealerBJ}   player BJ: ${stats.playerBJ}`);
console.log(`doubles:           ${stats.doubles}   player busts: ${stats.playerBusts}   dealer busts: ${stats.dealerBusts}`);
console.log(`box outcomes:      wins ${stats.wins} / pushes ${stats.pushes} / losses ${stats.losses}`);
console.log(`side bets:         PP staked on ${stats.ppStaked} boxes (${stats.ppHits} hits), 21+3 staked on ${stats.tpStaked} boxes (${stats.tpHits} hits)`);
console.log(`actions/round:     max ${stats.maxActions}, mean ${(stats.totalActions / stats.rounds).toFixed(2)}`);
console.log(`VIOLATIONS:        ${violations}`);
for (const s of samples) {
  console.log(`\n--- VIOLATION: ${s.msg}`);
  console.log(JSON.stringify(s.detail, null, 1));
}

console.log('\n================ RTP ESTIMATE ================');
console.log(`strategy A (stand hard 17+ / soft 18+, no double, no insurance):`);
console.log(`  RTP = ${main.rtp.toFixed(3)}% +/- ${main.se.toFixed(3)} (1 s.e.), house edge ${(100 - main.rtp).toFixed(3)}%  [${RTP_ROUNDS} rounds]`);
console.log(`strategy B (stand on ANY 17+ incl. soft 17):`);
console.log(`  RTP = ${alt.rtp.toFixed(3)}% +/- ${alt.se.toFixed(3)} (1 s.e.), house edge ${(100 - alt.rtp).toFixed(3)}%  [${RTP_ROUNDS} rounds]`);
console.log(`Perfect Pairs (25/12/6):`);
console.log(`  RTP = ${side.pp.rtp.toFixed(3)}% +/- ${side.pp.se.toFixed(3)} (1 s.e.), house edge ${(100 - side.pp.rtp).toFixed(3)}%  [${RTP_ROUNDS} rounds, theory ~95.90%]`);
console.log(`21+3 (100/40/30/10/5):`);
console.log(`  RTP = ${side.tp.rtp.toFixed(3)}% +/- ${side.tp.se.toFixed(3)} (1 s.e.), house edge ${(100 - side.tp.rtp).toFixed(3)}%  [${RTP_ROUNDS} rounds, theory ~96.30%]`);
console.log(`rtp sim time: ${rtpSecs}s main + ${sideRtpSecs}s side`);

console.log(violations === 0 ? '\nALL INVARIANTS PASSED' : `\nFAILED: ${violations} violations`);
process.exit(violations === 0 ? 0 : 1);
