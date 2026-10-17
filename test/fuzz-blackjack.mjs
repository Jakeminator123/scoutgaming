// Invariant fuzz against the server shoe (web/shoe-game.mjs), decision 53.
// The client module is not the authority. Rules below are the ones shoe-game
// actually runs via web/public/blackjack.mjs: 8 decks, cut after 312, one burn,
// S17, blackjack 3:2, insurance 2:1, double any first two, split to 4 hands
// (aces take one card), double after split, no surrender, Perfect Pairs and 21+3.
//
//   node --test test/fuzz-blackjack.mjs
//   FUZZ_ROUNDS=100000 FUZZ_SEED=1 node --test test/fuzz-blackjack.mjs
//   node test/fuzz-blackjack.mjs [seed] [rounds]
//
// FUZZ_SEED / FUZZ_ROUNDS win over argv. Defaults: seed 20260822, 3000 rounds.
// A failure prints the seed, the round and the command list.

import assert from 'node:assert/strict';
import test from 'node:test';
import { SHOE_RULES } from '../packages/shared/blackjack-shoe-rules.mjs';

const underRunner = process.env.NODE_TEST_CONTEXT != null;

function readInt(name, fallback) {
  const raw = process.env[name];
  const text = raw != null && raw !== '' ? raw : fallback;
  if (text == null || text === '') return null;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer, got ${text}`);
  return n;
}

const seed = readInt('FUZZ_SEED', underRunner ? null : process.argv[2]) ?? 20260822;
const rounds = readInt('FUZZ_ROUNDS', underRunner ? null : process.argv[3]) ?? 3000;

function sfc32(a, b, c, d) {
  return function next() {
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

const engineU32 = sfc32(seed ^ 0x9e3779b9, seed ^ 0x243f6a88, seed ^ 0xb7e15162, seed ^ 0xdeadbeef);
const driveU32 = sfc32(seed ^ 0xa5a5a5a5, seed ^ 0x0f0f0f0f, seed ^ 0x5a5a5a5a, seed ^ 0x33333333);
for (let i = 0; i < 16; i++) { engineU32(); driveU32(); }
const rand = () => driveU32() / 4294967296;
const randi = (n) => Math.floor(rand() * n);

const originalCrypto = globalThis.crypto;
function randomUUID() {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = engineU32() & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const seededCrypto = new Proxy({
  getRandomValues(buf) {
    if (buf instanceof Uint32Array) {
      for (let i = 0; i < buf.length; i++) buf[i] = engineU32();
      return buf;
    }
    const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    for (let i = 0; i < bytes.length; i++) bytes[i] = engineU32() & 0xff;
    return buf;
  },
  randomUUID,
}, {
  get(target, prop) {
    if (prop in target) return target[prop];
    const value = originalCrypto[prop];
    return typeof value === 'function' ? value.bind(originalCrypto) : value;
  },
});
Object.defineProperty(globalThis, 'crypto', { configurable: true, writable: true, value: seededCrypto });

const { command, newGame, gameView, shoeView } = await import('../web/shoe-game.mjs');

const BANK = 1_000_000_000_000;
const TEN = new Set(['10', 'J', 'Q', 'K']);
const RANK_HARD = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 10, Q: 10, K: 10 };
const ctx = { round: '', label: '', log: [] };
let seq = 0;

function fuzzFail(message, extra = {}) {
  const lines = [
    message,
    `seed=${seed}`,
    `rounds=${rounds}`,
    `at=${ctx.label}#${ctx.round}`,
    `commands=${JSON.stringify(ctx.log)}`,
  ];
  if (extra.expected !== undefined) lines.push(`expected=${JSON.stringify(extra.expected)}`);
  if (extra.actual !== undefined) lines.push(`actual=${JSON.stringify(extra.actual)}`);
  throw new Error(lines.join('\n'));
}

function cents(n) {
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
function sameMoney(a, b) {
  const x = cents(a);
  const y = cents(b);
  return x === y && Number.isFinite(x);
}

function handTotal(cards) {
  let hard = 0;
  let aces = 0;
  for (const c of cards) {
    if (!(c.r in RANK_HARD) || typeof c.s !== 'string') fuzzFail('card outside the deck', { actual: c });
    if (c.r === 'A') aces += 1;
    hard += RANK_HARD[c.r];
  }
  const soft = aces > 0 && hard + 10 <= 21;
  return { total: soft ? hard + 10 : hard, soft };
}

function selfCheckHandTotal() {
  const H = (text) => text.split(' ').map((textCard) => card(textCard.includes('♠') ? textCard : `${textCard}♠`));
  const cases = [
    ['A A 9', 21, true],
    ['A A', 12, true],
    ['A K', 21, true],
    ['K Q A', 21, false],
    ['A A A 9', 12, false],
    ['A A A A A A A A A A A', 21, true],
    ['K Q J', 30, false],
    ['10 9 2', 21, false],
    ['A 6', 17, true],
    ['A 6 K', 17, false],
  ];
  for (const [text, total, soft] of cases) {
    const got = handTotal(H(text));
    if (got.total !== total || got.soft !== soft) {
      fuzzFail(`hand total helper drifted on ${text}`, { expected: { total, soft }, actual: got });
    }
  }
}

function card(text) {
  return { r: text.slice(0, -1), s: text.slice(-1) };
}
function isRed(c) {
  return c.s === '♥' || c.s === '♦';
}
function perfectPairs(c1, c2) {
  if (c1.r !== c2.r) return null;
  if (c1.s === c2.s) return { name: 'Perfect Pair', pays: 25 };
  if (isRed(c1) === isRed(c2)) return { name: 'Colored Pair', pays: 12 };
  return { name: 'Mixed Pair', pays: 6 };
}
function isStraight3(cards) {
  const order = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13 };
  const v = cards.map((c) => order[c.r]).sort((a, b) => a - b);
  if (v[0] === v[1] || v[1] === v[2]) return false;
  if (v[0] + 1 === v[1] && v[1] + 1 === v[2]) return true;
  return v[0] === 1 && v[1] === 12 && v[2] === 13;
}
function twentyOnePlusThree(c1, c2, up) {
  const cards = [c1, c2, up];
  const suited = cards.every((c) => c.s === cards[0].s);
  if (cards.every((c) => c.r === cards[0].r)) {
    return suited
      ? { name: 'Suited Three of a Kind', pays: 100 }
      : { name: 'Three of a Kind', pays: 30 };
  }
  const straight = isStraight3(cards);
  if (straight && suited) return { name: 'Straight Flush', pays: 40 };
  if (straight) return { name: 'Straight', pays: 10 };
  if (suited) return { name: 'Flush', pays: 5 };
  return null;
}
function sideOf(hand, up) {
  let ret = 0;
  const labels = [];
  if (hand.pp > 0) {
    const hit = perfectPairs(hand.cards[0], hand.cards[1]);
    if (hit) {
      ret += hand.pp * (hit.pays + 1);
      labels.push(`${hit.name} ${hit.pays}:1`);
    }
  }
  if (hand.tp > 0) {
    const hit = twentyOnePlusThree(hand.cards[0], hand.cards[1], up);
    if (hit) {
      ret += hand.tp * (hit.pays + 1);
      labels.push(`${hit.name} ${hit.pays}:1`);
    }
  }
  return { ret, labels };
}

function natural(hand) {
  return hand.splitFrom === null && !hand.doubled && hand.cards.length === 2 && handTotal(hand.cards).total === 21;
}
function mainPayout(hand, dealer) {
  const p = handTotal(hand.cards).total;
  const d = handTotal(dealer).total;
  const dealerBJ = dealer.length === 2 && d === 21;
  let payout = 0;
  if (hand.insured) payout += dealerBJ ? hand.insured * 3 : 0;
  if (p > 21) return payout;
  if (natural(hand)) return payout + (dealerBJ ? hand.stake : hand.stake * 2.5);
  if (dealerBJ) return payout;
  if (d > 21 || p > d) return payout + hand.stake * 2;
  if (p === d) return payout + hand.stake;
  return payout;
}
function canSplit(hand, hands) {
  if (hand.cards.length !== 2 || hand.doubled) return false;
  if (hands.filter((h) => h.box === hand.box).length >= 4) return false;
  const [a, b] = hand.cards;
  return a.r === b.r || (TEN.has(a.r) && TEN.has(b.r));
}
function expectedLegal(hand, hands) {
  const acts = ['hit', 'stand'];
  if (hand.cards.length === 2 && !hand.doubled) acts.push('double');
  if (canSplit(hand, hands)) acts.push('split');
  return acts;
}

function blankBets() {
  return Array.from({ length: 7 }, () => ({ main: 0, pp: 0, tp: 0 }));
}
function seats(list) {
  const bets = blankBets();
  for (const s of list) bets[s.box] = { main: s.main, pp: s.pp || 0, tp: s.tp || 0 };
  return bets;
}
function moveToEnd(cards, wants) {
  const chosen = [];
  for (const w of wants) {
    const i = cards.findIndex((c) => c.r === w.r && c.s === w.s && !chosen.includes(c));
    if (i < 0) fuzzFail(`stacked card ${w.r}${w.s} is not in the shoe`);
    chosen.push(cards[i]);
    cards.splice(i, 1);
  }
  for (let i = chosen.length - 1; i >= 0; i--) cards.push(chosen[i]);
}

function cloneGame(g) {
  return {
    version: g.version,
    paid: g.paid,
    last: g.last ? { id: g.last.id, input: g.last.input, view: g.last.view } : null,
    round: g.round ? JSON.parse(JSON.stringify(g.round)) : null,
    shoe: g.shoe ? {
      id: g.shoe.id,
      dealt: g.shoe.dealt,
      cutReached: g.shoe.cutReached,
      cards: g.shoe.cards.slice(),
    } : null,
  };
}
function picture(g) {
  const shoe = g.shoe;
  let hash = shoe ? shoe.cards.length : 0;
  if (shoe) {
    for (let i = 0; i < shoe.cards.length; i++) {
      const c = shoe.cards[i];
      hash = Math.imul(hash ^ (i + 1), 16777619) ^ (c.r.charCodeAt(0) * 4 + c.s.codePointAt(0));
    }
  }
  const r = g.round;
  return JSON.stringify({
    version: g.version,
    paid: g.paid,
    last: g.last ? `${g.last.id}:${g.last.input}` : null,
    shoe: shoe ? [shoe.id, shoe.dealt, shoe.cutReached, hash >>> 0] : null,
    round: r ? {
      phase: r.phase,
      active: r.active,
      hole: r.holeCard ? `${r.holeCard.r}${r.holeCard.s}:${r.holeCard.shoeDraw}` : null,
      dealer: r.dealer.map((c) => `${c.r}${c.s}:${c.shoeDraw}`),
      hands: r.hands.map((h) => [
        h.box, h.stake, h.pp, h.tp, h.doubled, h.insured, h.done, h.result, h.sideReturn, h.splitFrom,
        h.cards.map((c) => `${c.r}${c.s}:${c.shoeDraw}`).join(','),
      ].join('|')),
    } : null,
  });
}
function rid(label) {
  seq += 1;
  return `${label}-${seq}`;
}
function createTable() {
  return {
    g: newGame(),
    wallet: BANK,
    shoeId: null,
    pendingCut: false,
    tracker: { id: null, map: new Map() },
    lastReq: null,
    lastView: null,
  };
}

function hasKey(node, key) {
  if (!node || typeof node !== 'object') return false;
  if (Object.hasOwn(node, key)) return true;
  return Object.values(node).some((value) => hasKey(value, key));
}
function eachCard(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.r === 'string' && typeof node.s === 'string' && typeof node.shoeDraw === 'number') {
    fn(node);
    return;
  }
  for (const value of Object.values(node)) eachCard(value, fn);
}

function auditShoe(table) {
  const shoe = table.g.shoe;
  if (!shoe) fuzzFail('missing shoe');
  if (SHOE_RULES.decks !== 8 || SHOE_RULES.total !== 416 || SHOE_RULES.cutAfter !== 312 || SHOE_RULES.burn !== 1) {
    fuzzFail('SHOE_RULES', { actual: SHOE_RULES });
  }
  if (shoe.cards.length + shoe.dealt !== 416) {
    fuzzFail('shoe conservation', { expected: 416, actual: shoe.cards.length + shoe.dealt });
  }
  if (shoe.cutReached !== shoe.dealt >= SHOE_RULES.cutAfter) fuzzFail('cutReached does not follow dealt');
  if (table.tracker.id !== shoe.id) {
    table.tracker.id = shoe.id;
    table.tracker.map = new Map();
  }
  const take = (c) => {
    if (!c || typeof c.shoeDraw !== 'number') return;
    const prev = table.tracker.map.get(c.shoeDraw);
    if (prev && (prev.r !== c.r || prev.s !== c.s)) {
      fuzzFail(`shoeDraw ${c.shoeDraw} used twice`, { expected: prev, actual: c });
    }
    if (c.shoeDraw < 2 || c.shoeDraw > shoe.dealt) fuzzFail('shoeDraw outside the dealt range', { actual: c.shoeDraw });
    table.tracker.map.set(c.shoeDraw, { r: c.r, s: c.s });
  };
  const round = table.g.round;
  if (round) {
    for (const h of round.hands) for (const c of h.cards) take(c);
    for (const c of round.dealer) take(c);
    if (round.holeCard) take(round.holeCard);
  }
  if (table.tracker.map.has(1)) fuzzFail('burn card entered play');
  if (table.tracker.map.size !== shoe.dealt - 1) {
    fuzzFail('drawn cards do not match dealt', { expected: shoe.dealt - 1, actual: table.tracker.map.size });
  }
  for (let draw = 2; draw <= shoe.dealt; draw++) {
    if (!table.tracker.map.has(draw)) fuzzFail(`missing shoeDraw ${draw}`);
  }
  const counts = new Map();
  const add = (c) => {
    const key = `${c.r}${c.s}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  };
  for (const c of table.tracker.map.values()) add(c);
  for (const c of shoe.cards) add(c);
  let total = 0;
  let short = 0;
  for (const n of counts.values()) {
    total += n;
    if (n !== 7 && n !== 8) fuzzFail('a rank-suit is not from eight decks minus one burn', { actual: n });
    if (n === 7) short += 1;
  }
  if (total !== 415 || counts.size !== 52 || short !== 1) {
    fuzzFail('burn/deck count', { expected: { total: 415, ranks: 52, short: 1 }, actual: { total, ranks: counts.size, short } });
  }
  const pub = shoeView(table.g);
  if (!pub || pub.cards || pub.remaining !== shoe.cards.length || pub.dealt !== shoe.dealt
    || pub.total !== 416 || pub.decks !== 8 || pub.burn !== 1 || pub.cutAfter !== 312
    || pub.cutReached !== shoe.cutReached || pub.shufflePending !== shoe.cutReached || pub.id !== shoe.id) {
    fuzzFail('shoeView', { actual: pub && Object.keys(pub) });
  }
}

function auditView(table, view) {
  if (typeof view.shuffled !== 'boolean' || view.version !== table.g.version) {
    fuzzFail('command view shape', { actual: { shuffled: view.shuffled, version: view.version } });
  }
  if (hasKey(view, 'holeCard') || hasKey(view, 'events')) fuzzFail('view leaked holeCard or events');
  const rendered = JSON.parse(JSON.stringify(gameView(table.g)));
  const { shuffled, ...rest } = view;
  if (JSON.stringify(rendered) !== JSON.stringify(rest)) fuzzFail('gameView diverged from the command view');
  if (!view.round) {
    if (!table.g.paid) fuzzFail('round hidden before collect');
    return;
  }
  const round = view.round;
  if (!['insurance', 'decisions', 'settled'].includes(round.phase)) fuzzFail('unexpected phase', { actual: round.phase });
  if (round.boxes.length !== 7) fuzzFail('box count', { actual: round.boxes.length });
  const hole = table.g.round.holeCard;
  const leaked = [];
  eachCard(round, (c) => { if (c.shoeDraw === hole.shoeDraw) leaked.push(`${c.r}${c.s}`); });
  if (round.phase === 'insurance' || round.phase === 'decisions') {
    if (round.dealer.length !== 1 || leaked.length || round.dealer[0].shoeDraw === hole.shoeDraw) {
      fuzzFail('dealer hole visible before reveal', { actual: { dealer: round.dealer, holeDraw: round.holeDraw, leaked } });
    }
  } else if (round.dealer.length < 2 || round.dealer[1].shoeDraw !== hole.shoeDraw
    || round.dealer[1].r !== hole.r || round.dealer[1].s !== hole.s) {
    fuzzFail('hole card was not revealed at settle', { actual: round.dealer });
  }
  for (const h of round.hands) {
    const hv = handTotal(h.cards);
    if (hv.total < 4 || hv.total > 30 || (hv.soft && (hv.total < 12 || hv.total > 21)) || (!hv.soft && hv.total > 30)) {
      fuzzFail('hand total out of range', { actual: hv, expected: h.cards.map((c) => c.r).join(' ') });
    }
  }
  if (round.dealer.length) {
    const hv = handTotal(round.dealer);
    if (hv.soft && hv.total > 21) fuzzFail('soft dealer total above 21', { actual: hv });
  }
}

function noteShoe(table, req, view) {
  if (req.op === 'start') {
    if (!table.shoeId) {
      if (view.shuffled !== false) fuzzFail('first shoe set shuffled', { actual: view.shuffled });
    } else if (table.pendingCut) {
      if (view.shuffled !== true || view.shoe.id === table.shoeId) fuzzFail('cut did not shuffle', { actual: view.shoe.id });
    } else if (view.shuffled || view.shoe.id !== table.shoeId) {
      fuzzFail('shoe changed before the cut', { expected: table.shoeId, actual: view.shoe.id });
    }
    table.shoeId = view.shoe.id;
  } else if (view.shoe.id !== table.shoeId || view.shuffled) {
    fuzzFail('shoe changed outside start', { actual: view.shoe.id });
  }
  table.pendingCut = table.g.shoe.cutReached;
}

function replay(table) {
  const before = picture(table.g);
  const version = table.g.version;
  const wallet = table.wallet;
  const clone = cloneGame(table.g);
  const out = command(clone, table.lastReq, wallet);
  if (!sameMoney(out.delta, 0) || clone.version !== version || picture(table.g) !== before || table.wallet !== wallet) {
    fuzzFail('replay changed the table or the balance', { expected: 0, actual: out.delta });
  }
  const view = JSON.parse(JSON.stringify(out.view));
  if (JSON.stringify(view) !== JSON.stringify(table.lastView)) {
    fuzzFail('replay view does not match the original response', { expected: table.lastView, actual: view });
  }
}

function send(table, req, expectDelta) {
  ctx.log.push(req.op === 'act' ? `act ${req.action}` : req.op === 'insurance' ? `insurance ${req.take}` : req.op);
  const prev = table.g.version;
  const next = cloneGame(table.g);
  let out;
  try {
    out = command(next, req, table.wallet);
  } catch (err) {
    fuzzFail(`command threw: ${err.message}`);
  }
  if (!sameMoney(out.delta, expectDelta)) fuzzFail('delta', { expected: expectDelta, actual: out.delta });
  const wallet = table.wallet + out.delta;
  if (!Number.isFinite(wallet) || cents(wallet) < 0) fuzzFail('wallet went negative', { actual: wallet });
  if (next.version !== prev + 1 || out.view.version !== next.version) {
    fuzzFail('version did not increase by 1', { expected: prev + 1, actual: next.version });
  }
  const view = JSON.parse(JSON.stringify(out.view));
  table.g = next;
  table.wallet = wallet;
  table.lastReq = req;
  table.lastView = view;
  auditShoe(table);
  auditView(table, view);
  noteShoe(table, req, view);
  if (ctx.label === 'fuzz') {
    if (expectDelta < 0) stats.wagered += -expectDelta;
    if (expectDelta > 0) stats.returned += expectDelta;
    if (view.shuffled) stats.shuffles += 1;
  }
  replay(table);
  return view;
}

function reject(table, req, pattern, balance = table.wallet) {
  const before = picture(table.g);
  const clone = cloneGame(table.g);
  if (picture(clone) !== before) fuzzFail('clone was not a faithful snapshot');
  let thrown = null;
  try {
    command(clone, req, balance);
  } catch (err) {
    thrown = err;
  }
  if (!thrown || !pattern.test(thrown.message)) {
    fuzzFail('invalid command was not rejected', { expected: String(pattern), actual: thrown ? thrown.message : 'no throw' });
  }
  if (picture(clone) !== before || picture(table.g) !== before) {
    fuzzFail('rejected command changed state', { expected: pattern.source, actual: thrown.message });
  }
}

function checkDealShape(view) {
  const hands = view.round.hands;
  const n = hands.length;
  if (!n || hands.some((h) => h.cards.length < 2)) fuzzFail('deal left a short hand');
  const first = hands[n - 1].cards[0].shoeDraw;
  for (let i = 0; i < n; i++) {
    if (hands[n - 1 - i].cards[0].shoeDraw !== first + i) fuzzFail('first-card order', { actual: hands.map((h) => h.cards[0].shoeDraw) });
    if (hands[n - 1 - i].cards[1].shoeDraw !== first + n + 1 + i) fuzzFail('second-card order');
  }
  if (view.round.dealer[0].shoeDraw !== first + n) fuzzFail('upcard order');
  if (view.round.holeDraw !== first + (n * 2) + 1) fuzzFail('holeDraw order', { expected: first + (n * 2) + 1, actual: view.round.holeDraw });
}

function snapshotDeal(view) {
  const up = view.round.dealer[0];
  return {
    up,
    holeDraw: view.round.holeDraw,
    hands: view.round.hands.map((h) => {
      const side = sideOf(h, up);
      if (!sameMoney(h.sideReturn, side.ret) || JSON.stringify(h.sideLabels) !== JSON.stringify(side.labels)) {
        fuzzFail('side bet at deal', { expected: side, actual: { ret: h.sideReturn, labels: h.sideLabels } });
      }
      return {
        first: h.cards[0].shoeDraw,
        pp: h.pp,
        tp: h.tp,
        side: h.sideReturn,
        labels: side.labels,
      };
    }),
  };
}

function assertDealer(hands, dealer) {
  const live = hands.some((h) => handTotal(h.cards).total <= 21 && !natural(h));
  if (!live) {
    if (dealer.length !== 2) fuzzFail('dealer drew with no live player hand', { actual: dealer.length });
    return;
  }
  const finalTotal = handTotal(dealer).total;
  if (finalTotal < 17) fuzzFail(`dealer stood on ${finalTotal}`);
  for (let i = 2; i < dealer.length; i++) {
    const pre = handTotal(dealer.slice(0, i)).total;
    if (pre >= 17) fuzzFail(`dealer hit from ${pre} (S17)`);
  }
}

function checkSettlement(view, deal, insuranceSnap, mainStakes) {
  const hands = view.round.hands;
  assertDealer(hands, view.round.dealer);
  let stakeSum = 0;
  const originals = new Map(deal.hands.map((h) => [h.first, h]));
  for (const h of hands) {
    stakeSum += h.stake;
    const expected = mainPayout(h, view.round.dealer);
    if (!sameMoney(h.result, expected)) {
      fuzzFail('main payout', {
        expected,
        actual: {
          result: h.result,
          stake: h.stake,
          insured: h.insured,
          splitFrom: h.splitFrom,
          cards: h.cards.map((c) => `${c.r}${c.s}`),
          dealer: view.round.dealer.map((c) => `${c.r}${c.s}`),
        },
      });
    }
    const origin = originals.get(h.cards[0].shoeDraw);
    if (origin) {
      if (h.pp !== origin.pp || h.tp !== origin.tp || !sameMoney(h.sideReturn, origin.side)
        || JSON.stringify(h.sideLabels) !== JSON.stringify(origin.labels)) {
        fuzzFail('side bet changed after the deal', { expected: origin, actual: { pp: h.pp, tp: h.tp, side: h.sideReturn, labels: h.sideLabels } });
      }
    } else if (h.pp || h.tp || h.sideReturn || (h.sideLabels && h.sideLabels.length) || h.insured) {
      fuzzFail('split hand inherited a box side bet or insurance', { actual: h });
    }
    if (insuranceSnap) {
      const row = insuranceSnap.find((item) => item.first === h.cards[0].shoeDraw);
      const insured = row ? row.insured : 0;
      if (!sameMoney(h.insured, insured)) fuzzFail('insurance stake', { expected: insured, actual: h.insured });
    } else if (h.insured) {
      fuzzFail('insurance without an ace upcard', { actual: h.insured });
    }
  }
  if (!sameMoney(stakeSum, mainStakes)) fuzzFail('stakes do not match charges', { expected: mainStakes, actual: stakeSum });
}

function snapActive(view) {
  const hands = view.round.hands;
  const active = view.round.active;
  return {
    index: active,
    count: hands.length,
    box: hands[active].box,
    stake: hands[active].stake,
    pp: hands[active].pp,
    tp: hands[active].tp,
    side: hands[active].sideReturn,
    insured: hands[active].insured,
    draws: hands[active].cards.map((c) => c.shoeDraw),
    ranks: hands[active].cards.map((c) => c.r),
  };
}

function checkAct(action, before, view, dealtBefore) {
  const hands = view.round.hands;
  if (action === 'split') {
    const parent = hands.find((h) => h.cards[0].shoeDraw === before.draws[0]);
    const child = hands.find((h) => h.cards[0].shoeDraw === before.draws[1]);
    if (!parent || !child || hands.length !== before.count + 1) fuzzFail('split did not open one hand');
    if (parent.cards.length !== 2 || child.cards.length !== 2) fuzzFail('split hands should have two cards');
    if (parent.cards[1].shoeDraw !== dealtBefore + 1 || child.cards[1].shoeDraw !== dealtBefore + 2) {
      fuzzFail('split draw order', { expected: [dealtBefore + 1, dealtBefore + 2], actual: [parent.cards[1].shoeDraw, child.cards[1].shoeDraw] });
    }
    if (!sameMoney(parent.stake, before.stake) || !sameMoney(child.stake, before.stake)) fuzzFail('split stake');
    if (parent.pp !== before.pp || parent.tp !== before.tp || !sameMoney(parent.sideReturn, before.side) || !sameMoney(parent.insured, before.insured)) {
      fuzzFail('split moved the box side bet or insurance');
    }
    if (child.pp || child.tp || child.sideReturn || child.insured || child.splitFrom !== before.box || parent.splitFrom !== before.box) {
      fuzzFail('split child did not stay a plain hand');
    }
    const aces = before.ranks[0] === 'A';
    if (aces && (!parent.done || !child.done)) fuzzFail('split aces remained actionable');
    return;
  }
  const hand = hands.find((h) => h.cards[0].shoeDraw === before.draws[0]);
  if (!hand) fuzzFail('acted hand disappeared');
  if (action === 'stand') {
    if (!hand.done || hand.cards.length !== before.draws.length || !sameMoney(hand.stake, before.stake)) fuzzFail('stand changed the hand');
    return;
  }
  if (hand.cards.length !== before.draws.length + 1 || hand.cards.at(-1).shoeDraw !== dealtBefore + 1) {
    fuzzFail(`${action} card`, { expected: dealtBefore + 1, actual: hand.cards.at(-1) && hand.cards.at(-1).shoeDraw });
  }
  if (action === 'double') {
    if (!hand.doubled || !hand.done || !sameMoney(hand.stake, before.stake * 2)) fuzzFail('double stake');
    return;
  }
  if (hand.doubled || !sameMoney(hand.stake, before.stake)) fuzzFail('hit changed the stake');
  const total = handTotal(hand.cards).total;
  if ((total >= 21) !== hand.done) fuzzFail('hit done-flag', { expected: total >= 21, actual: hand.done });
}

function checkLegal(view) {
  const hands = view.round.hands;
  const active = hands.findLastIndex((h) => !h.done);
  if (view.round.active !== active) fuzzFail('active hand', { expected: active, actual: view.round.active });
  const hand = hands[active];
  if (handTotal(hand.cards).total >= 21) fuzzFail('offering a decision on 21 or more');
  const legal = expectedLegal(hand, hands);
  if (JSON.stringify(legal) !== JSON.stringify(view.round.legalActions)) {
    fuzzFail('legal actions', { expected: legal, actual: view.round.legalActions });
  }
}

function nextStep(plan, kind) {
  if (!plan) return null;
  const step = plan.shift();
  if (!step || !step.startsWith(kind)) fuzzFail('scripted plan diverged', { expected: kind, actual: step ?? 'empty' });
  return step;
}

function play(table, opts) {
  const bets = opts.bets;
  ctx.label = opts.label;
  ctx.log = [];
  if (opts.stack) {
    if (!table.g.shoe) {
      const next = cloneGame(table.g);
      const out = command(next, { op: 'state' }, table.wallet);
      if (!sameMoney(out.delta, 0) || next.version !== table.g.version) fuzzFail('state command');
      table.g = next;
      table.shoeId = next.shoe.id;
      table.pendingCut = false;
      auditShoe(table);
    }
    moveToEnd(table.g.shoe.cards, opts.stack);
  }
  const start = { op: 'start', version: table.g.version, requestId: rid('start'), bets };
  const charged = bets.reduce((n, b) => n + b.main + b.pp + b.tp, 0);
  let view = send(table, start, -charged);
  checkDealShape(view);
  const deal = snapshotDeal(view);
  let mainStakes = bets.reduce((n, b) => n + b.main, 0);
  let insuranceSnap = null;
  const plan = opts.plan ? [...opts.plan] : null;

  const settleAndCollect = () => {
    if (view.round.phase !== 'settled') return false;
    if (opts.onSettled) opts.onSettled(table, view);
    checkSettlement(view, deal, insuranceSnap, mainStakes);
    const payout = table.g.round.hands.reduce((n, h) => n + h.result + h.sideReturn, 0);
    view = send(table, { op: 'collect', version: table.g.version, requestId: rid('collect') }, payout);
    if (view.round !== null || !table.g.paid) fuzzFail('collect did not hide the round');
    return true;
  };
  const finish = () => {
    if (plan && plan.length) fuzzFail('unused plan', { actual: plan });
    if (opts.net != null && !sameMoney(table.wallet, BANK + opts.net)) {
      fuzzFail('anchor wallet', { expected: BANK + opts.net, actual: table.wallet });
    }
    if (opts.label === 'fuzz') {
      stats.rounds += 1;
      if (table.g.round.dealer.length === 2 && handTotal(table.g.round.dealer).total === 21) stats.dealerBJ += 1;
      if (table.g.round.hands.some((h) => natural(h))) stats.naturals += 1;
    }
    return table;
  };

  if (settleAndCollect()) return finish();

  let guard = 0;
  while (view.round && (view.round.phase === 'insurance' || view.round.phase === 'decisions')) {
    if (++guard > 48) fuzzFail('round did not settle');
    if (opts.before) opts.before(table, view);
    if (view.round.phase === 'insurance') {
      if (view.round.active !== -1 || view.round.legalActions.length) fuzzFail('insurance offered a card decision');
      const planned = nextStep(plan, 'insurance');
      let take = planned ? planned.endsWith('yes') : rand() < 0.5;
      let cost = take ? view.round.hands.reduce((n, h) => n + h.stake / 2, 0) : 0;
      if (!planned && take && cost > table.wallet) { take = false; cost = 0; }
      insuranceSnap = view.round.hands.map((h) => ({ first: h.cards[0].shoeDraw, insured: take ? h.stake / 2 : 0 }));
      const dealt = table.g.shoe.dealt;
      view = send(table, { op: 'insurance', version: table.g.version, requestId: rid('ins'), take }, -cost);
      if (table.g.shoe.dealt !== dealt) fuzzFail('insurance drew a card');
    } else {
      checkLegal(view);
      let action;
      const planned = nextStep(plan, 'act');
      if (planned) {
        action = planned.slice(4);
        if (!view.round.legalActions.includes(action)) fuzzFail('plan asked for an illegal action', { actual: action, expected: view.round.legalActions });
      } else if (table.g.shoe.cards.length < 16 || !view.round.legalActions.includes('hit')) {
        action = 'stand';
      } else if (view.round.legalActions.includes('split') && rand() < 0.45) {
        action = 'split';
      } else if (view.round.legalActions.includes('double') && rand() < 0.35) {
        action = 'double';
      } else {
        action = view.round.legalActions[randi(view.round.legalActions.length)];
      }
      const before = snapActive(view);
      if (!planned && (action === 'double' || action === 'split') && before.stake > table.wallet) action = 'stand';
      const dealt = table.g.shoe.dealt;
      const extra = action === 'double' || action === 'split' ? before.stake : 0;
      mainStakes += extra;
      view = send(table, { op: 'act', version: table.g.version, requestId: rid(action), action }, -extra);
      checkAct(action, before, view, dealt);
      if (opts.label === 'fuzz' && action === 'double') stats.doubles += 1;
      if (opts.label === 'fuzz' && action === 'split') stats.splits += 1;
    }
    if (view.round && view.round.phase === 'settled') break;
  }
  if (!settleAndCollect()) fuzzFail('round stopped', { actual: view.round && view.round.phase });
  return finish();
}

const stats = {
  rounds: 0, doubles: 0, splits: 0, dealerBJ: 0, naturals: 0, shuffles: 0, wagered: 0, returned: 0, rejects: 0,
};

function randomBets() {
  const order = [0, 1, 2, 3, 4, 5, 6];
  for (let i = order.length - 1; i > 0; i--) {
    const j = randi(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const stakes = [5, 10, 25, 50, 100];
  const bets = blankBets();
  const n = 1 + randi(3);
  for (let i = 0; i < n; i++) {
    bets[order[i]] = {
      main: stakes[randi(stakes.length)],
      pp: rand() < 0.25 ? stakes[randi(stakes.length)] : 0,
      tp: rand() < 0.25 ? stakes[randi(stakes.length)] : 0,
    };
  }
  return bets;
}

function randomProbe(table, phase) {
  const version = table.g.version;
  const fresh = () => rid('probe');
  const choices = [
    [{ op: 'act', action: 'hit', version: version + 3, requestId: fresh() }, /Table changed/],
    [{ op: 'act', action: 'hit', version, requestId: 'x'.repeat(101) }, /Request ID required/],
    [{ op: 'fold', version, requestId: fresh() }, phase === 'idle' ? /No active round/ : /Unknown table command/],
  ];
  if (table.lastReq) {
    const tweaked = { ...table.lastReq, op: table.lastReq.op === 'collect' ? 'act' : 'collect' };
    choices.push([tweaked, /Request ID reused/]);
  }
  if (phase === 'idle') {
    choices.push([{ op: 'act', action: 'hit', version, requestId: fresh() }, /No active round/]);
    choices.push([{ op: 'collect', version, requestId: fresh() }, /No active round/]);
    choices.push([{ op: 'start', version, requestId: fresh(), bets: seats([{ box: 0, main: 2001 }]) }, /Invalid stake/]);
    choices.push([{ op: 'start', version, requestId: fresh(), bets: seats([{ box: 0, main: 5 }]) }, /Insufficient balance/, 0]);
  } else {
    choices.push([{ op: 'start', version, requestId: fresh(), bets: seats([{ box: 0, main: 5 }]) }, /Finish the current round/]);
  }
  if (phase === 'decisions') {
    choices.push([{ op: 'insurance', version, requestId: fresh(), take: false }, /Insurance is not available/]);
    choices.push([{ op: 'collect', version, requestId: fresh() }, /Round is not settled/]);
    choices.push([{ op: 'act', action: 'surrender', version, requestId: fresh() }, /Illegal action/]);
  }
  if (phase === 'insurance') {
    choices.push([{ op: 'act', action: 'hit', version, requestId: fresh() }, /Illegal action/]);
    choices.push([{ op: 'collect', version, requestId: fresh() }, /Round is not settled/]);
  }
  if (phase === 'settled') {
    choices.push([{ op: 'act', action: 'hit', version, requestId: fresh() }, /Illegal action/]);
    choices.push([{ op: 'act', action: 'double', version, requestId: fresh() }, /Illegal action/]);
    choices.push([{ op: 'insurance', version, requestId: fresh(), take: true }, /Insurance is not available/]);
  }
  const [req, pattern, balance] = choices[randi(choices.length)];
  reject(table, req, pattern, balance);
  stats.rejects += 1;
}

function exerciseRejects() {
  ctx.label = 'reject';
  ctx.round = 'setup';
  const table = createTable();
  const next = cloneGame(table.g);
  command(next, { op: 'state' }, table.wallet);
  table.g = next;
  table.shoeId = next.shoe.id;
  const version = () => table.g.version;
  const id = () => rid('bad');
  // Rejects start from an existing shoe. On a brand-new game, command()
  // shuffles before request validation and then throws; the table transaction
  // rolls that object back (web/native-table.mjs).
  const samples = [
    [{ op: 'start', version: version(), requestId: id(), bets: seats([{ box: 0, main: 5 }, { box: 1, main: -5 }]) }, /Invalid stake/],
    [{ op: 'start', version: version(), requestId: id(), bets: seats([{ box: 0, main: 2001 }]) }, /Invalid stake/],
    [{ op: 'start', version: version(), requestId: id(), bets: seats([{ box: 0, main: 5.001 }]) }, /Invalid stake/],
    [{ op: 'start', version: version(), requestId: id(), bets: seats([{ box: 0, main: 4 }]) }, /at least 5/],
    [{ op: 'start', version: version(), requestId: id(), bets: seats([{ box: 0, main: 5 }, { box: 1, main: 0, pp: 5 }]) }, /at least 5/],
    [{ op: 'start', version: version(), requestId: id(), bets: seats([]) }, /Place a main bet/],
    [{ op: 'start', version: version(), requestId: id(), bets: [{ main: 5, pp: 0, tp: 0 }] }, /Place a main bet/],
    [{ op: 'start', version: version(), bets: seats([{ box: 0, main: 5 }]) }, /Request ID required/],
    [{ op: 'start', version: version(), requestId: 'z'.repeat(101), bets: seats([{ box: 0, main: 5 }]) }, /Request ID required/],
    [{ op: 'fold', version: version(), requestId: id() }, /No active round/],
    [{ op: 'act', action: 'hit', version: version() + 1, requestId: id() }, /Table changed/],
    [{ op: 'start', version: version(), requestId: id(), bets: seats([{ box: 0, main: 5 }]) }, /Insufficient balance/, 0],
  ];
  for (const [req, pattern, balance] of samples) reject(table, req, pattern, balance);

  const seen = new Set();
  play(table, {
    label: 'reject-round',
    bets: seats([{ box: 3, main: 10 }]),
    stack: [card('10♠'), card('A♥'), card('6♦'), card('9♣')],
    plan: ['insurance:no', 'act:stand'],
    net: -10,
    onSettled(live) {
      const v = live.g.version;
      reject(live, { op: 'act', action: 'hit', version: v, requestId: id() }, /Illegal action/);
      reject(live, { op: 'act', action: 'double', version: v, requestId: id() }, /Illegal action/);
      reject(live, { op: 'insurance', version: v, requestId: id(), take: true }, /Insurance is not available/);
      reject(live, { op: 'start', version: v, requestId: id(), bets: seats([{ box: 0, main: 5 }]) }, /Finish the current round/);
    },
    before(live, view) {
      const phase = view.round.phase;
      if (phase !== 'insurance' && phase !== 'decisions') return;
      if (seen.has(phase)) return;
      seen.add(phase);
      const v = live.g.version;
      reject(live, { op: 'start', version: v, requestId: id(), bets: seats([{ box: 0, main: 5 }]) }, /Finish the current round/);
      reject(live, { op: 'collect', version: v, requestId: id() }, /Round is not settled/);
      if (phase === 'insurance') {
        reject(live, { op: 'act', action: 'hit', version: v, requestId: id() }, /Illegal action/);
        reject(live, { op: 'act', action: 'stand', version: v, requestId: id() }, /Illegal action/);
        reject(live, { op: 'fold', version: v, requestId: id() }, /Unknown table command/);
      } else {
        reject(live, { op: 'insurance', version: v, requestId: id(), take: true }, /Insurance is not available/);
        reject(live, { op: 'act', action: 'split', version: v, requestId: id() }, /Illegal action/);
        reject(live, { op: 'act', action: 'surrender', version: v, requestId: id() }, /Illegal action/);
        reject(live, { op: 'act', action: 'double', version: v, requestId: id() }, /Insufficient balance/, 0);
      }
    },
  });
  const v = table.g.version;
  reject(table, { op: 'act', action: 'hit', version: v, requestId: id() }, /No active round/);
  reject(table, { op: 'collect', version: v, requestId: id() }, /No active round/);
  reject(table, { op: 'insurance', version: v, requestId: id(), take: false }, /No active round/);
  const tweaked = { ...table.lastReq, action: 'hit' };
  reject(table, tweaked, /Request ID reused/);
}

function anchors() {
  const run = (label, opts) => play(createTable(), { label, ...opts });
  run('insurance-bj', {
    bets: seats([{ box: 3, main: 10 }]),
    stack: [card('9♠'), card('A♦'), card('7♣'), card('K♥')],
    plan: ['insurance:yes'],
    net: 0,
  });
  const soft = run('soft-17', {
    bets: seats([{ box: 3, main: 10 }]),
    stack: [card('10♠'), card('A♥'), card('9♠'), card('6♦')],
    plan: ['insurance:no', 'act:stand'],
    net: 10,
  });
  if (soft.g.round.dealer.length !== 2 || !handTotal(soft.g.round.dealer).soft || handTotal(soft.g.round.dealer).total !== 17) {
    fuzzFail('dealer did not stand on soft 17', { actual: soft.g.round.dealer });
  }
  const bj = run('natural-3-2', {
    bets: seats([{ box: 3, main: 10 }]),
    stack: [card('A♠'), card('9♥'), card('K♠'), card('8♦')],
    plan: [],
    net: 15,
  });
  if (!sameMoney(bj.g.round.hands[0].result, 25)) fuzzFail('blackjack did not pay 3:2', { actual: bj.g.round.hands[0].result });
  run('double', {
    bets: seats([{ box: 3, main: 10 }]),
    stack: [card('5♠'), card('6♦'), card('6♥'), card('9♣'), card('10♠'), card('7♥')],
    plan: ['act:double'],
    net: 20,
  });
  const split21 = run('split-21-pays-even', {
    bets: seats([{ box: 3, main: 10 }]),
    stack: [card('10♠'), card('7♥'), card('K♥'), card('10♦'), card('A♠'), card('9♣')],
    plan: ['act:split', 'act:stand'],
    net: 20,
  });
  const twentyOne = split21.g.round.hands.find((h) => handTotal(h.cards).total === 21);
  if (!twentyOne || twentyOne.splitFrom === null || !sameMoney(twentyOne.result, 20)) {
    fuzzFail('split 21 paid as a natural', { actual: split21.g.round.hands.map((h) => h.result) });
  }
  const aces = run('split-aces', {
    bets: seats([{ box: 3, main: 10 }]),
    stack: [card('A♠'), card('9♥'), card('A♥'), card('8♦'), card('K♠'), card('7♣')],
    plan: ['act:split'],
    net: 20,
  });
  if (aces.g.round.hands.some((h) => h.cards.length !== 2)) fuzzFail('split aces took extra cards');
  run('colored-pair', {
    bets: seats([{ box: 3, main: 10, pp: 10 }]),
    stack: [card('K♥'), card('5♠'), card('K♦'), card('9♣'), card('3♠')],
    plan: ['act:stand'],
    net: 130,
  });
  run('straight-flush', {
    bets: seats([{ box: 3, main: 10, tp: 5 }]),
    stack: [card('A♠'), card('3♠'), card('2♠'), card('9♥'), card('6♦')],
    plan: ['act:stand'],
    net: 190,
  });
  run('ace-wrap-miss', {
    bets: seats([{ box: 3, main: 10, tp: 5 }]),
    stack: [card('K♠'), card('A♦'), card('2♥'), card('6♣')],
    plan: ['insurance:no', 'act:stand'],
    net: -15,
  });
  run('flush', {
    bets: seats([{ box: 3, main: 10, tp: 5 }]),
    stack: [card('2♠'), card('K♠'), card('9♠'), card('8♥')],
    plan: ['act:stand'],
    net: 15,
  });
  run('two-box-order', {
    bets: seats([{ box: 1, main: 5 }, { box: 4, main: 5 }]),
    stack: [card('9♥'), card('10♠'), card('6♦'), card('8♥'), card('7♠'), card('K♣'), card('2♣')],
    plan: ['act:stand', 'act:stand'],
    net: -10,
  });
}

function fuzz() {
  const table = createTable();
  for (let n = 0; n < rounds; n++) {
    ctx.round = n;
    if (n > 0 && rand() < 0.5) randomProbe(table, 'idle');
    const seen = new Set();
    play(table, {
      label: 'fuzz',
      bets: randomBets(),
      before(live, view) {
        const phase = view.round.phase;
        if (phase !== 'insurance' && phase !== 'decisions') return;
        if (seen.has(phase) || rand() > 0.35) return;
        seen.add(phase);
        randomProbe(live, phase);
      },
      onSettled(live) {
        if (rand() < 0.35) randomProbe(live, 'settled');
      },
    });
    if (rounds >= 20000 && (n + 1) % 20000 === 0) {
      console.log(`  fuzz ${n + 1}/${rounds} seed=${seed}`);
    }
  }
}

test('server shoe invariants', { timeout: 900_000 }, () => {
  const started = Date.now();
  console.log(`seed=${seed} fuzzRounds=${rounds}`);
  selfCheckHandTotal();
  exerciseRejects();
  anchors();
  fuzz();
  const seconds = (Date.now() - started) / 1000;
  const rtp = stats.wagered ? (stats.returned / stats.wagered) * 100 : 0;
  console.log([
    `rounds=${stats.rounds} seconds=${seconds.toFixed(2)}`,
    `doubles=${stats.doubles} splits=${stats.splits} dealerBJ=${stats.dealerBJ} naturals=${stats.naturals} shuffles=${stats.shuffles} rejects=${stats.rejects}`,
    `random-play RTP ${rtp.toFixed(2)}% (informational, not asserted; includes side bets and insurance)`,
  ].join('\n'));
  assert.equal(stats.rounds, rounds);
  if (rounds >= 500) {
    assert.ok(stats.doubles > 0 && stats.splits > 0 && stats.shuffles > 0, 'fuzz did not reach double, split and a cut-card shuffle');
  }
});
