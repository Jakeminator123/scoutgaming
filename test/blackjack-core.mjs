import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BlackjackCoreError, CONTRACT_VERSION, SHOE_RULES, newGame, publicView, step } from '../services/game/games/blackjack/core.mjs';
import { handValue } from '../services/game/games/blackjack/round.mjs';
import { digest, verifyShoe } from '../services/game/games/blackjack/shoe-proof.mjs';
import { secureRandom } from '../services/game/games/blackjack/secure-random.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';
import * as kevinGame from './fixtures/kevin-5aa7ed1/shoe-game.mjs';
import * as kevinProof from './fixtures/kevin-5aa7ed1/shoe-proof.mjs';

const EMPTY = { main: 0, pp: 0, tp: 0 };
const ONE_BOX = [{ main: 5, pp: 0, tp: 0 }, ...Array.from({ length: 6 }, () => ({ ...EMPTY }))];
const TWO_BOXES = [{ main: 10, pp: 5, tp: 5 }, { ...EMPTY }, { ...EMPTY }, { main: 25, pp: 0, tp: 2 }, { ...EMPTY }, { ...EMPTY }, { ...EMPTY }];
const code = expected => error => error instanceof BlackjackCoreError && error.code === expected;
const serials = value => JSON.stringify(value).match(/"serial":\d+/g)?.map(s => Number(s.slice(9))) ?? [];

// Drives the core like a coordinator: explicit inputs, wallet applied from effects,
// and a check that the caller's state is never mutated.
function table(seed = 'k02', config = {}) {
  const random = deterministicRandom(seed);
  const opened = newGame({ random });
  const t = { random, config, state: opened.state, log: [...opened.events], publicLog: [...opened.publicEvents], views: [opened.view], wallet: 1000 };
  t.send = (command, available = t.wallet) => {
    const before = JSON.stringify(t.state);
    const out = step(t.state, command, t.config, { random: t.random, available });
    assert.equal(JSON.stringify(t.state), before, 'input state is not mutated');
    t.state = out.state; t.log.push(...out.events); t.publicLog.push(...out.publicEvents); t.views.push(out.view);
    for (const e of out.effects) t.wallet += e.direction === 'debit' ? -e.amount : e.amount;
    return out;
  };
  t.act = action => {
    const r = t.state.round;
    return t.send({ op: 'act', action, roundId: t.state.roundId, turnSeq: t.state.turnSeq, handIndex: r.active, box: r.hands[r.active].box });
  };
  t.complete = () => {
    if (t.state.round.phase === 'insurance') t.send({ op: 'insurance', take: false, roundId: t.state.roundId });
    while (t.state.round.phase === 'decisions') t.act('stand');
    return t.send({ op: 'collect', roundId: t.state.roundId });
  };
  // What Kevin's game-audit sync attaches: every engine.* draw for that shoe, in order.
  t.commandDraws = shoeId => t.log.filter(e => e.type.startsWith('engine.') && e.payload.shoeId === shoeId).flatMap(e => e.payload.draws);
  return t;
}
// Rewrites the top of the shoe (next cards to deal), as Kevin's croupier-shoe test does.
function stack(t, cards) {
  const s = structuredClone(t.state);
  s.shoe.cards.splice(-cards.length, cards.length, ...cards.map(([r, suit]) => ({ r, s: suit })).reverse());
  t.state = s;
}

test('frozen Kevin fixtures are byte-identical to 5aa7ed1', () => {
  const blob = path => {
    const bytes = readFileSync(new URL(`./fixtures/kevin-5aa7ed1/${path}`, import.meta.url));
    return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  };
  assert.equal(blob('shoe-game.mjs'), 'b59177421de2a6fe203e4e0bdf0676a4bb9b25ef');
  assert.equal(blob('shoe-proof.mjs'), '54e9737a3d89fe763d907f20282bd298480b7f35');
  assert.equal(blob('public/blackjack.mjs'), '5ce0fe431186bd11c2a893766a2ce6c63b1cc6dc');
});

test('new game commits the shoe before the first draw and exposes only the commitment', () => {
  const t = table();
  assert.equal(t.state.contract, CONTRACT_VERSION);
  assert.equal(t.state.version, 0);
  assert.equal(t.state.shoe.cards.length, 415, 'one face-down burn');
  assert.deepEqual(t.state.shoe.proof.draws.map(d => d.kind), ['burn']);
  const [opened] = t.log;
  assert.equal(opened.type, 'shoe.opened');
  const p = t.state.shoe.proof;
  // The commitment covers only shuffle material, so it is fixed before the burn and every deal.
  assert.equal(opened.payload.commitment, digest({ version: p.version, shoeId: p.shoeId, rules: p.rules, nonce: p.nonce, samples: p.samples }));
  assert.equal(t.views[0].shoe.commitment, opened.payload.commitment);
  const text = JSON.stringify([t.views[0], t.publicLog]);
  for (const secret of [p.nonce, '"samples"', '"cards"', '"draws"']) assert.ok(!text.includes(secret));
  assert.deepEqual(serials(t.views[0]), [], 'burn card and shoe order are private');
});

test('valid round: stake, decisions, exactly one settlement', () => {
  const t = table();
  const started = t.send({ op: 'start', bets: TWO_BOXES });
  assert.deepEqual(started.effects, [
    { kind: 'stake', direction: 'debit', box: 0, amount: 20 },
    { kind: 'stake', direction: 'debit', box: 3, amount: 27 },
  ]);
  assert.equal(t.wallet, 953);
  assert.equal(t.state.turnSeq, 1);
  assert.match(t.state.roundId, /^[0-9a-f-]{36}$/);
  assert.throws(() => t.send({ op: 'start', bets: TWO_BOXES }), code('ROUND_IN_PROGRESS'));
  if (t.state.round.phase === 'insurance') t.send({ op: 'insurance', take: false, roundId: t.state.roundId });
  while (t.state.round.phase === 'decisions') t.act('stand');
  assert.throws(() => t.send({ op: 'act', action: 'hit', roundId: t.state.roundId, turnSeq: t.state.turnSeq, handIndex: 0, box: 0 }), code('ILLEGAL_ACTION'));
  const settled = structuredClone(t.state.round.hands);
  const collected = t.complete();
  assert.deepEqual(collected.effects, settled.map((h, i) => ({ kind: 'payout', direction: 'credit', box: h.box, hand: i, amount: h.result + h.sideReturn })));
  assert.equal(collected.view.round, null);
  assert.equal(collected.events.at(-1).payload.phase, 'collected');
  assert.throws(() => t.send({ op: 'collect', roundId: t.state.roundId }), code('NO_ACTIVE_ROUND'), 'no second settlement');
  assert.equal(t.log.filter(e => e.type === 'engine.collect').length, 1);
});

test('invalid commands are rejected with typed errors and leave state untouched', () => {
  const t = table();
  const bad = bets => () => t.send({ op: 'start', bets });
  assert.throws(bad(ONE_BOX.slice(1)), code('INVALID_BETS'));
  assert.throws(bad(Array.from({ length: 7 }, () => ({ ...EMPTY }))), code('INVALID_BETS'));
  assert.throws(bad([{ main: -5, pp: 0, tp: 0 }, ...ONE_BOX.slice(1)]), code('INVALID_BETS'));
  assert.throws(bad([{ main: 5, pp: -1, tp: 0 }, ...ONE_BOX.slice(1)]), code('INVALID_STAKE'));
  assert.throws(bad(ONE_BOX.map(b => ({ ...b, main: b.main ? 2001 : 0 }))), code('INVALID_STAKE'));
  assert.throws(bad([{ main: 5.001, pp: 0, tp: 0 }, ...ONE_BOX.slice(1)]), code('INVALID_STAKE'));
  assert.throws(bad([{ main: 4, pp: 0, tp: 0 }, ...ONE_BOX.slice(1)]), code('INVALID_STAKE'));
  assert.throws(bad([{ main: 5, pp: 0, tp: 0 }, { main: 0, pp: 5, tp: 0 }, ...ONE_BOX.slice(2)]), code('INVALID_STAKE'));
  assert.throws(() => t.send({ op: 'teleport' }), code('UNKNOWN_COMMAND'));
  assert.throws(() => t.send({ op: 'act', action: 'hit' }), code('NO_ACTIVE_ROUND'));
  assert.throws(() => step({ ...t.state, contract: 'other' }, { op: 'start', bets: ONE_BOX }, {}, { random: t.random, available: 1000 }), code('INVALID_STATE'));
  // Frozen table config, not the command, sets limits.
  t.config = { limits: { min: 10, max: 100, sideMax: 20 } };
  assert.throws(bad(ONE_BOX), code('INVALID_STAKE'));
  assert.throws(bad([{ main: 10, pp: 21, tp: 0 }, ...ONE_BOX.slice(1)]), code('INVALID_STAKE'));
  t.send({ op: 'start', bets: [{ main: 100, pp: 20, tp: 0 }, ...ONE_BOX.slice(1)] });
  assert.equal(t.state.version, 1);
  assert.throws(() => t.send({ op: 'collect', roundId: 'another-round' }), code('STALE_COMMAND'));
  if (t.state.round.phase === 'insurance') {
    assert.throws(() => t.send({ op: 'insurance', takeBoxes: [4], roundId: t.state.roundId }), code('INSURANCE_UNAVAILABLE'));
    t.send({ op: 'insurance', take: false, roundId: t.state.roundId });
  } else assert.throws(() => t.send({ op: 'insurance', take: true, roundId: t.state.roundId }), code('INSURANCE_UNAVAILABLE'));
  if (t.state.round.phase === 'decisions') {
    const r = t.state.round, base = { op: 'act', action: 'stand', roundId: t.state.roundId, turnSeq: t.state.turnSeq, handIndex: r.active, box: r.hands[r.active].box };
    assert.throws(() => t.send({ ...base, turnSeq: base.turnSeq - 1 }), code('STALE_COMMAND'), 'late command for an earlier turn');
    assert.throws(() => t.send({ ...base, box: base.box + 1 }), code('STALE_COMMAND'));
    assert.throws(() => t.send({ ...base, handIndex: base.handIndex + 1 }), code('STALE_COMMAND'));
    assert.throws(() => t.send({ ...base, action: 'surrender' }), code('ILLEGAL_ACTION'));
    assert.throws(() => t.send({ op: 'collect', roundId: t.state.roundId }), code('ROUND_NOT_SETTLED'));
  }
});

test('balance limit is an explicit server input, never a core-owned balance', () => {
  const t = table();
  assert.throws(() => t.send({ op: 'start', bets: TWO_BOXES }, 46.99), code('INSUFFICIENT_BALANCE'));
  assert.throws(() => t.send({ op: 'start', bets: TWO_BOXES }, null), code('AVAILABLE_REQUIRED'));
  assert.throws(() => t.send({ op: 'start', bets: TWO_BOXES }, '1000'), code('AVAILABLE_REQUIRED'));
  assert.equal(t.state.version, 0);
  t.send({ op: 'start', bets: TWO_BOXES }, 47);
  assert.ok(!('balance' in t.state) && !('wallet' in t.state));
  // Double needs the stake again; a zero-cost stand needs no balance at all.
  const s = table('double-limit');
  stack(s, [['6','♠'],['9','♦'],['5','♥'],['7','♣']]);
  s.send({ op: 'start', bets: ONE_BOX });
  assert.equal(s.state.round.phase, 'decisions');
  const r = s.state.round, base = { op: 'act', roundId: s.state.roundId, turnSeq: s.state.turnSeq, handIndex: r.active, box: 0 };
  assert.throws(() => s.send({ ...base, action: 'double' }, 4.99), code('INSUFFICIENT_BALANCE'));
  assert.deepEqual(s.send({ ...base, action: 'stand' }, null).effects, []);
});

test('hidden hole card and future cards never reach the public view or public events', () => {
  const t = table('hidden');
  for (let round = 0; round < 40; round++) {
    t.send({ op: 'start', bets: TWO_BOXES });
    while (t.state.round.phase === 'insurance' || t.state.round.phase === 'decisions') {
      const hole = t.state.round.holeCard, view = t.views.at(-1), privateSerials = new Set([hole.serial, ...t.state.shoe.cards.map(c => c.serial), t.state.shoe.proof.draws[0].card.serial]);
      assert.ok(serials(view).every(s => !privateSerials.has(s)), 'no hole, burn or future card in view');
      assert.ok(!JSON.stringify(view).includes('holeCard'));
      assert.equal(view.round.holeDraw, hole.shoeDraw, 'only the draw position of the hole card is public');
      assert.ok(serials(t.publicLog.at(-1)).every(s => !privateSerials.has(s)), 'engine draws are hidden until settlement');
      if (t.state.round.phase === 'insurance') t.send({ op: 'insurance', take: round % 2 === 0, roundId: t.state.roundId });
      else t.act(handValue(t.state.round.hands[t.state.round.active].cards).total < 13 ? 'hit' : 'stand');
    }
    // Once settled, the hole card is part of the dealer hand.
    assert.ok(serials(t.state.round.dealer).includes(t.state.round.holeCard.serial));
    t.send({ op: 'collect', roundId: t.state.roundId });
  }
  const privateEngine = t.log.find(e => e.type === 'engine.start' && e.payload.phase !== 'settled');
  assert.ok(privateEngine.payload.draws.every(d => typeof d.card === 'object'), 'audit events keep the private draws');
});

test('shoe transition: no mid-round shuffle, closed proof only after cut, new commitment before new draws', () => {
  const t = table('transition');
  const first = t.state.shoe.id, nonce = t.state.shoe.proof.nonce;
  let rounds = 0;
  while (!t.state.shoe.cutReached) {
    t.send({ op: 'start', bets: TWO_BOXES });
    assert.equal(t.state.shoe.id, first, 'same shoe for every round before the cut, including the round that crosses it');
    assert.ok(!JSON.stringify(t.log).includes(nonce) && !t.log.some(e => e.type === 'shoe.closed'), 'no early reveal');
    t.complete(); rounds++;
    assert.equal(t.state.shoe.cards.length + t.state.shoe.dealt, SHOE_RULES.total, 'card conservation');
  }
  assert.ok(rounds > 10 && t.state.shoe.dealt >= SHOE_RULES.cutAfter);
  assert.ok(!JSON.stringify([t.views, t.publicLog]).includes(nonce), 'nonce private until close');
  const out = t.send({ op: 'start', bets: TWO_BOXES });
  assert.deepEqual(out.events.map(e => e.type), ['shoe.closed', 'shoe.opened', 'engine.start']);
  assert.equal(out.view.shuffled, true);
  const [closed, opened, engine] = out.events;
  assert.equal(closed.payload.shoeId, first);
  assert.equal(closed.payload.proof.nonce, nonce);
  assert.notEqual(opened.payload.shoeId, first);
  assert.equal(engine.payload.shoeId, opened.payload.shoeId);
  assert.ok(engine.payload.draws.every(d => d.position > 1), 'new burn is not a command draw');
  assert.equal(t.state.shoe.cards.length + t.state.shoe.dealt, SHOE_RULES.total);
  assert.ok(t.state.shoe.dealt < 20);
  // Kevin's shape and key order, which existing stored proofs and verifyShoe rely on.
  assert.deepEqual(Object.keys(closed.payload.proof), ['version','shoeId','rules','nonce','samples','draws','commitment','closed','reason','remaining']);
  assert.equal(JSON.stringify(closed.payload.proof.rules), '{"decks":8,"cutAfter":312,"total":416,"burn":1}');
  const proof = { ...closed.payload.proof, commandDraws: t.commandDraws(first) };
  assert.equal(verifyShoe(proof, t.log[0].payload.commitment).status, 'verified');
  assert.equal(kevinProof.verifyShoe(structuredClone(proof), t.log[0].payload.commitment).status, 'verified', "Kevin's verifier accepts the core proof");
});

test('tampered nonce, draw, remaining shoe or action log fail verification', () => {
  const t = table('tamper');
  while (!t.state.shoe.cutReached) { t.send({ op: 'start', bets: ONE_BOX }); t.complete(); }
  const commitment = t.log[0].payload.commitment, shoeId = t.state.shoe.id;
  const closed = t.send({ op: 'start', bets: ONE_BOX }).events[0].payload.proof;
  const proof = { ...closed, commandDraws: t.commandDraws(shoeId) };
  assert.equal(verifyShoe(proof, commitment).status, 'verified');
  const failed = (mutate, check) => {
    const copy = structuredClone(proof); mutate(copy);
    const result = verifyShoe(copy, commitment);
    assert.equal(result.status, 'failed');
    assert.equal(result.checks.find(c => c.name === check)?.pass, false, check);
    assert.equal(kevinProof.verifyShoe(copy, commitment).status, 'failed');
  };
  failed(p => { p.nonce = p.nonce.slice(0, -1) + (p.nonce.endsWith('0') ? '1' : '0'); }, 'Opening commitment');
  failed(p => { p.samples[0] = (p.samples[0] + 1) % 0x100000000; }, 'Opening commitment');
  failed(p => { [p.draws[5].card, p.draws[6].card] = [p.draws[6].card, p.draws[5].card]; }, 'Contiguous draws match RNG order');
  failed(p => { [p.remaining[0], p.remaining[1]] = [p.remaining[1], p.remaining[0]]; }, 'Unused cards match remaining shoe');
  failed(p => { p.remaining.pop(); }, 'Cut reached; complete accounting');
  failed(p => { p.commandDraws.pop(); }, 'Action log matches every dealt card');
  failed(p => { p.rules = { cutAfter: 312, decks: 8, total: 416, burn: 1 }; }, 'Eight decks / 416 cards / one burn / cut at 312');
  assert.equal(verifyShoe(proof, 'f'.repeat(64)).status, 'failed', 'a different stored commitment is rejected');
});

test('same explicit inputs reproduce outcome and public events; other randomness varies', () => {
  const run = seed => {
    const t = table(seed);
    for (let i = 0; i < 8; i++) { t.send({ op: 'start', bets: TWO_BOXES }); t.complete(); }
    return t;
  };
  const a = run('seed-a'), b = run('seed-a'), c = run('seed-b');
  assert.deepEqual(b.state, a.state);
  assert.deepEqual(b.log, a.log);
  assert.deepEqual(b.publicLog, a.publicLog);
  assert.deepEqual(b.views, a.views);
  assert.equal(b.wallet, a.wallet);
  assert.notEqual(c.state.shoe.proof.commitment, a.state.shoe.proof.commitment);
  assert.notDeepEqual(c.state.shoe.cards, a.state.shoe.cards);
  assert.notDeepEqual(c.publicLog, a.publicLog);
});

test('randomness, ids and nonce come only from explicit inputs; production adapter uses crypto', t => {
  assert.throws(() => newGame({}), code('INPUTS_REQUIRED'));
  assert.throws(() => newGame(), code('INPUTS_REQUIRED'));
  const g = table();
  assert.throws(() => step(g.state, { op: 'start', bets: ONE_BOX }, {}, { available: 1000 }), code('INPUTS_REQUIRED'));
  const broken = { ...deterministicRandom('x'), uint32: () => 2 ** 32 };
  assert.throws(() => newGame({ random: broken }), code('INVALID_INPUT'));
  assert.throws(() => newGame({ random: { ...deterministicRandom('x'), uint32: () => 0xFFFFFFFF } }), code('INVALID_INPUT'), 'a stuck source cannot loop forever');
  assert.throws(() => newGame({ random: { ...deterministicRandom('x'), nonce: () => 'short' } }), code('INVALID_INPUT'));
  // Ambient clock and randomness are never read by the core.
  for (const [object, name] of [[Math, 'random'], [Date, 'now'], [globalThis.crypto, 'getRandomValues'], [globalThis.crypto, 'randomUUID'], [globalThis, 'setTimeout'], [globalThis, 'fetch']]) {
    t.mock.method(object, name, () => { throw Error(`ambient ${name} used`); });
  }
  const pure = table('ambient');
  for (let i = 0; i < 3; i++) { pure.send({ op: 'start', bets: TWO_BOXES }); pure.complete(); }
  t.mock.restoreAll();
  // Production adapter: valid outputs, two adapters never share a shoe.
  const one = newGame({ random: secureRandom() }), two = newGame({ random: secureRandom() });
  assert.notEqual(one.state.shoe.proof.commitment, two.state.shoe.proof.commitment);
  assert.equal(one.state.shoe.cards.length, 415);
});

test('split, double and insurance effects match Kevin engine amounts', () => {
  const t = table('stacked');
  stack(t, [['8','♠'],['6','♦'],['8','♥'],['10','♣'],['3','♦'],['2','♣'],['9','♦'],['K','♥'],['5','♠']]);
  t.send({ op: 'start', bets: ONE_BOX });
  assert.equal(t.wallet, 995);
  assert.deepEqual(t.act('split').effects, [{ kind: 'split', direction: 'debit', box: 0, hand: 0, amount: 5 }]);
  assert.equal(t.state.shoe.dealt, 7); assert.equal(t.wallet, 990); assert.equal(t.state.round.hands.length, 2);
  t.act('hit'); t.act('stand');
  assert.deepEqual(t.act('double').effects, [{ kind: 'double', direction: 'debit', box: 0, hand: 0, amount: 5 }]);
  assert.equal(t.state.shoe.dealt, 10); assert.equal(t.wallet, 985); assert.equal(t.state.round.phase, 'settled');
  t.send({ op: 'collect', roundId: t.state.roundId });
  assert.equal(t.state.round.boxes[0].sideReturn, t.state.round.hands[0].sideReturn);

  const i = table('insurance');
  stack(i, [['8','♠'],['A','♦'],['8','♥'],['K','♣']]);
  const started = i.send({ op: 'start', bets: ONE_BOX });
  assert.equal(started.view.round.dealer.length, 1);
  assert.deepEqual(i.send({ op: 'insurance', takeBoxes: [0], roundId: i.state.roundId }).effects, [{ kind: 'insurance', direction: 'debit', box: 0, hand: 0, amount: 2.5 }]);
  assert.equal(i.wallet, 992.5); assert.equal(i.state.round.dealer.length, 2);
  i.send({ op: 'collect', roundId: i.state.roundId });
  assert.equal(i.wallet, 1000);
});

test('shoe exhaustion fails without a quiet replacement', () => {
  const t = table();
  const s = structuredClone(t.state); s.shoe.cards = []; t.state = s;
  assert.throws(() => t.send({ op: 'start', bets: ONE_BOX }), code('SHOE_EXHAUSTED'));
  assert.equal(publicView(t.state).shoe.remaining, 0);
});

// Kevin's frozen engine and the core, fed the same random samples, shoe id and nonce,
// must produce byte-identical shoes, rounds, proofs and amounts through two cut cards.
test("compatibility: Kevin's frozen engine and the core stay byte-identical; proofs cross-verify", t => {
  // Kevin's engine draws from global crypto; seed it so the covered rounds are fixed.
  // (Its nonce still comes from node:crypto randomBytes and only affects the commitment.)
  const seeded = deterministicRandom('kevin-compat');
  t.mock.method(globalThis.crypto, 'getRandomValues', buf => { buf[0] = seeded.uint32(); return buf; });
  t.mock.method(globalThis.crypto, 'randomUUID', () => seeded.uuid());
  let g = kevinGame.newGame(), kevinVersion = 0;
  const kevinEngine = [], kevinClosed = [];
  const kevin = (op, extra = {}) => {
    const next = JSON.parse(JSON.stringify(g)), prior = next.shoe?.id, drawn = next.shoe?.dealt ?? 1;
    const out = kevinGame.command(next, { op, version: next.version, requestId: `r${kevinVersion++}`, ...extra }, Number.MAX_SAFE_INTEGER);
    kevinClosed.push(...(next.closedShoes ?? [])); delete next.closedShoes;
    if (op !== 'state') kevinEngine.push({ shoeId: next.shoe.id, draws: next.shoe.proof.draws.filter(d => d.position > (prior === next.shoe.id ? drawn : 1)) });
    g = JSON.parse(JSON.stringify(next));
    return out;
  };
  // Replays exactly the samples, shoe id and nonce that Kevin's engine drew for its current shoe.
  let roundIds = 0;
  const mirror = (shuffling) => {
    let cursor = 0; const ids = shuffling ? [g.shoe.id] : [];
    return { uint32: () => g.shoe.proof.samples[cursor++], nonce: () => g.shoe.proof.nonce,
      uuid: () => ids.shift() ?? `00000000-0000-4000-8000-${String(roundIds++).padStart(12, '0')}` };
  };
  kevin('state');
  let core = newGame({ random: mirror(true) });
  let state = core.state; const log = [...core.events], closed = [];
  const send = (command, shuffling = false) => {
    const out = step(state, command, {}, { random: mirror(shuffling), available: Number.MAX_SAFE_INTEGER });
    state = out.state; log.push(...out.events); closed.push(...out.events.filter(e => e.type === 'shoe.closed').map(e => e.payload.proof));
    return out;
  };
  const same = (kevinOut, coreOut) => {
    const { contract, roundId, turnSeq, ...rest } = state;
    assert.equal(JSON.stringify({ ...rest, last: null }), JSON.stringify({ ...g, last: null }), 'state matches Kevin byte for byte');
    assert.equal(coreOut.effects.reduce((n, e) => n + (e.direction === 'debit' ? -e.amount : e.amount), 0) + 0, kevinOut.delta + 0);
  };
  assert.equal(JSON.stringify(state.shoe), JSON.stringify(g.shoe));
  let rounds = 0, offers = 0; const seen = new Set();
  while (kevinClosed.length < 2) {
    const shuffling = g.shoe.cutReached;
    same(kevin('start', { bets: TWO_BOXES }), send({ op: 'start', bets: TWO_BOXES }, shuffling));
    for (let guard = 0; g.round.phase !== 'settled' && guard < 20; guard++) {
      if (g.round.phase === 'insurance') {
        const takeBoxes = offers++ % 2 ? [] : [0, 3];
        same(kevin('insurance', { takeBoxes }), send({ op: 'insurance', takeBoxes, roundId: state.roundId }));
        continue;
      }
      const r = g.round, hand = r.hands[r.active], legal = kevinGame.gameView(g).round.legalActions, total = handValue(hand.cards).total;
      const action = legal.includes('split') ? 'split' : legal.includes('double') && total >= 9 && total <= 11 ? 'double' : total < 17 ? 'hit' : 'stand';
      seen.add(action);
      same(kevin('act', { action }), send({ op: 'act', action, roundId: state.roundId, turnSeq: state.turnSeq, handIndex: r.active, box: hand.box }));
    }
    same(kevin('collect'), send({ op: 'collect', roundId: state.roundId }));
    rounds++;
  }
  assert.equal(closed.length, 2);
  assert.deepEqual([...seen].sort(), ['double', 'hit', 'split', 'stand']);
  assert.ok(log.some(e => e.type === 'engine.insurance' && e.payload.takeBoxes.length) && log.some(e => e.type === 'engine.insurance' && !e.payload.takeBoxes.length), 'insurance taken and declined');
  for (const [i, proof] of kevinClosed.entries()) {
    assert.equal(JSON.stringify(closed[i]), JSON.stringify(proof), 'closed proof is byte-identical');
    const commandDraws = kevinEngine.filter(e => e.shoeId === proof.shoeId).flatMap(e => e.draws);
    const coreDraws = log.filter(e => e.type.startsWith('engine.') && e.payload.shoeId === proof.shoeId).flatMap(e => e.payload.draws);
    assert.equal(JSON.stringify(coreDraws), JSON.stringify(commandDraws), 'engine event draws match the audit draws');
    const kevinMade = JSON.parse(JSON.stringify({ ...proof, commandDraws }));
    assert.equal(verifyShoe(kevinMade, proof.commitment).status, 'verified', 'Kevin-produced proof verifies with the core');
    assert.equal(kevinProof.verifyShoe({ ...closed[i], commandDraws: coreDraws }, proof.commitment).status, 'verified');
    assert.equal(kevinProof.digest(kevinMade), digest(kevinMade));
  }
});
