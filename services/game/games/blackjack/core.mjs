// K02: pure blackjack rule core with explicit randomness.
// Ported from Kevin's vendor/croupier/shoe-game.mjs @ 5aa7ed1. The core performs no SQL,
// file, network, timer, wallet, video or lipsync work and reads no clock or ambient
// randomness. Every random sample, nonce and id comes from `inputs.random`; the caller
// (K03 coordinator) owns balances, receipts, audit writes and timing.
import { SHOE_RULES } from '../../../../packages/shared/blackjack-shoe-rules.mjs';
import { Round, RANKS, SUITS } from './round.mjs';
import { openProof } from './shoe-proof.mjs';

export const CONTRACT_VERSION = 'blackjack-core/1';
export { SHOE_RULES };

export class BlackjackCoreError extends Error {
  constructor(code, message) { super(message); this.name = 'BlackjackCoreError'; this.code = code; }
}
const fail = (code, message) => { throw new BlackjackCoreError(code, message); };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_SHUFFLE_SAMPLES = 10000; // replayShuffle rejects longer transcripts

// Validates the explicit random port. There is no default and no fallback source.
function randomPort(random) {
  if (!random || typeof random.uint32 !== 'function' || typeof random.nonce !== 'function' || typeof random.uuid !== 'function') {
    fail('INPUTS_REQUIRED', 'Explicit random, nonce and id inputs are required');
  }
  return {
    uint32() {
      const value = random.uint32();
      if (!Number.isInteger(value) || value < 0 || value > 0xFFFFFFFF) fail('INVALID_INPUT', 'Random source returned an invalid 32-bit sample');
      return value;
    },
    nonce() {
      const value = random.nonce();
      if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('INVALID_INPUT', 'Random source returned an invalid shoe nonce');
      return value;
    },
    uuid() {
      const value = random.uuid();
      if (typeof value !== 'string' || !UUID.test(value)) fail('INVALID_INPUT', 'Random source returned an invalid id');
      return value;
    },
  };
}

function readLimits(config) {
  const lim = config?.limits ?? {};
  // Kevin's defaults when a table has no explicit limits: 5 / 2000 / 2000.
  const limits = { min: lim.min ?? 5, max: lim.max ?? 2000, sideMax: lim.sideMax ?? 2000 };
  if (Object.values(limits).some(v => !Number.isFinite(v) || v <= 0) || limits.min > limits.max) fail('INVALID_CONFIG', 'Invalid table limits');
  return limits;
}

// Fisher-Yates with rejection sampling, identical to Kevin's freshShoe(decks, record, true):
// every sample, including rejected ones, is recorded so replayShuffle can rebuild the order.
function shuffle(g, rnd, events) {
  if (g.shoe) {
    const old = g.shoe;
    const proof = old.proof
      ? { ...old.proof, closed: true, reason: 'cut-card', remaining: [...old.cards].reverse() }
      : { shoeId: old.id, closed: true, reason: 'cut-card', legacy: true, dealt: old.dealt, remainingCount: old.cards.length };
    events.push({ type: 'shoe.closed', roundId: null, payload: { shoeId: old.id, proof } });
  }
  const samples = [], cards = [];
  for (let d = 0; d < SHOE_RULES.decks; d++) for (const s of SUITS) for (const r of RANKS) cards.push({ r, s, serial: cards.length + 1 });
  for (let i = cards.length - 1; i > 0; i--) {
    const n = i + 1, max = Math.floor(0xFFFFFFFF / n) * n;
    let value;
    do {
      if (samples.length >= MAX_SHUFFLE_SAMPLES) fail('INVALID_INPUT', 'Random source exceeded the shuffle transcript limit');
      value = rnd.uint32(); samples.push(value);
    } while (value >= max);
    const j = value % n;
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  const id = rnd.uuid(), proof = openProof(id, SHOE_RULES, samples, rnd.nonce());
  // The commitment exists before the burn and before any dealt card.
  proof.draws.push({ position: 1, kind: 'burn', card: cards.pop() });
  g.shoe = { id, cards, dealt: 1, cutReached: false, proof };
  events.push({ type: 'shoe.opened', roundId: null,
    payload: { shoeId: id, commitment: proof.commitment, rules: SHOE_RULES, coverage: 'complete from shuffle' } });
}

function restoreRound(g) {
  const r = Object.assign(Object.create(Round.prototype), g.round);
  r.boxes = r.boxes.map(b => r.hands.find(h => h.box === b.box) ?? b);
  r.shoe = { draw() {
    if (!g.shoe.cards.length) fail('SHOE_EXHAUSTED', 'Shoe exhausted; round paused. No mid-round shuffle.');
    const card = g.shoe.cards.pop(); g.shoe.dealt++;
    g.shoe.proof?.draws.push({ position: g.shoe.dealt, kind: 'deal', card: { ...card } });
    if (g.shoe.dealt >= SHOE_RULES.cutAfter) g.shoe.cutReached = true;
    return { ...card, shoeDraw: g.shoe.dealt };
  } };
  return r;
}

function shoeView(g) {
  const s = g.shoe;
  return s && { id: s.id, total: SHOE_RULES.total, remaining: s.cards.length,
    dealt: s.dealt, cutAfter: SHOE_RULES.cutAfter, cutReached: s.cutReached,
    commitment: s.proof?.commitment ?? null, shufflePending: s.cutReached, decks: SHOE_RULES.decks, burn: SHOE_RULES.burn };
}

// The only player-facing projection: never shoe order, burn, samples, nonce, the
// private hole card or the round's internal event log.
export function publicView(state) {
  const g = state;
  let round = null;
  if (g.round && !g.paid) {
    const r = restoreRound(g);
    round = { boxes: r.boxes, hands: r.hands, dealer: r.dealer, phase: r.phase,
      active: r.active, holeDraw: r.holeCard?.shoeDraw, legalActions: r.phase === 'decisions' ? r.legal() : [] };
  }
  return JSON.parse(JSON.stringify({ version: g.version, roundId: g.roundId, turnSeq: g.turnSeq, shoe: shoeView(g), round }));
}

// Same redaction as Kevin's audit read: engine draws stay hidden until the round is settled.
function publicEvent(event) {
  const phase = event.payload.phase;
  if (!event.type.startsWith('engine.') || phase === 'settled' || phase === 'collected') return event;
  return { ...event, payload: { ...event.payload,
    draws: event.payload.draws.map(d => ({ position: d.position, kind: d.kind, card: 'hidden until settlement' })) } };
}

function result(g, events, effects, shuffled) {
  const out = JSON.parse(JSON.stringify({ state: g, events, effects }));
  return { ...out, publicEvents: out.events.map(publicEvent), view: { ...publicView(out.state), shuffled } };
}

function load(state) {
  if (!state || state.contract !== CONTRACT_VERSION || !Number.isInteger(state.version)) fail('INVALID_STATE', 'Unsupported game state');
  return JSON.parse(JSON.stringify(state));
}

// Command funding (O01-svar 2.5). The caller (K03) reads it server-side from its WalletPort;
// client balances are never input and the core never stores or changes a balance.
//   inputs.funding = {
//     available,                         // balance - open reservations; funds NEW debits only
//     reserved: { stake: { [box]: n },   // open stake reservation per box, consumed at round start
//                 insurance: { [box]: n } } // open insurance reservation per box, consumed at insurance resolution
//   }
// Effects carry `source`: 'reservation' (K03 consumes that reservation) or 'available'
// (K03 debits against available). A pre-reserved amount is never checked against available.
function fund(inputs, effects) {
  const funding = inputs?.funding;
  const needed = {};
  for (const e of effects) if (e.direction === 'debit') {
    if (e.source === 'reservation') (needed[e.kind] ??= {})[e.box] = (needed[e.kind]?.[e.box] ?? 0) + e.amount;
    else needed.available = (needed.available ?? 0) + e.amount;
  }
  if (!Object.keys(needed).length) return;
  if (!funding || typeof funding !== 'object') fail('FUNDING_REQUIRED', 'Server-side command funding is required');
  for (const kind of ['stake', 'insurance']) {
    if (!needed[kind]) continue;
    const reserved = funding.reserved?.[kind];
    if (!reserved || typeof reserved !== 'object') fail('RESERVATION_REQUIRED', `Server-side ${kind} reservations are required`);
    for (const [box, amount] of Object.entries(needed[kind])) {
      const have = reserved[box] ?? 0;
      if (typeof have !== 'number' || !Number.isFinite(have) || have < 0) fail('INVALID_INPUT', `Invalid ${kind} reservation for box ${box}`);
      if (have < amount) fail('RESERVATION_INSUFFICIENT', `The ${kind} reservation for box ${box} does not cover ${amount}`);
    }
  }
  if (needed.available) {
    const available = funding.available;
    if (typeof available !== 'number' || !Number.isFinite(available)) fail('AVAILABLE_REQUIRED', 'Server-side available balance is required');
    if (available - needed.available < 0) fail('INSUFFICIENT_BALANCE', 'Insufficient balance');
  }
}

// Creates a game and opens (commits) its first shoe before any bet or draw.
export function newGame(inputs) {
  const rnd = randomPort(inputs?.random), events = [];
  const g = { contract: CONTRACT_VERSION, version: 0, shoe: null, round: null, paid: false, roundId: null, turnSeq: 0 };
  shuffle(g, rnd, events);
  return result(g, events, [], false);
}

// (state, command, frozen config, explicit inputs) -> { state, events, publicEvents, effects, view }.
// The input state is never mutated; a rejected command throws BlackjackCoreError.
export function step(state, command, config, inputs) {
  const g = load(state);
  if (!command || typeof command !== 'object') fail('UNKNOWN_COMMAND', 'Unknown table command');
  const events = [], effects = [], prior = g.shoe?.id, drawn = g.shoe?.dealt ?? 1;
  let params, shuffled = false;
  if (command.op === 'start') {
    if (g.round && !g.paid) fail('ROUND_IN_PROGRESS', 'Finish the current round first');
    const limits = readLimits(config), b = command.bets;
    if (!Array.isArray(b) || b.length !== 7 || !b.some(x => x?.main > 0)) fail('INVALID_BETS', 'Place a main bet');
    const cap = key => key === 'main' ? limits.max : limits.sideMax;
    for (const x of b) {
      for (const key of ['main','pp','tp']) if (!Number.isFinite(x?.[key]) || x[key] < 0 || x[key] > cap(key) || !Number.isInteger(x[key] * 100)) fail('INVALID_STAKE', 'Invalid stake');
      if ((x.main > 0 && x.main < limits.min) || (!x.main && (x.pp || x.tp))) fail('INVALID_STAKE', `Side bets require a main bet of at least ${limits.min}`);
    }
    const bets = b.map(x => ({ main: x.main, pp: x.pp, tp: x.tp }));
    bets.forEach((x, box) => { const amount = x.main + x.pp + x.tp; if (amount) effects.push({ kind: 'stake', direction: 'debit', source: 'reservation', box, amount }); });
    fund(inputs, effects);
    const rnd = randomPort(inputs?.random);
    if (!g.shoe) shuffle(g, rnd, events);
    else if (g.shoe.cutReached) { shuffle(g, rnd, events); shuffled = true; }
    g.roundId = rnd.uuid(); g.turnSeq = 0;
    g.round = new Round(bets, []); g.paid = false;
    const live = restoreRound(g); live.deal(); g.round = live;
    params = { bets, limits };
  } else {
    if (!['act', 'insurance', 'collect'].includes(command.op)) fail('UNKNOWN_COMMAND', 'Unknown table command');
    if (!g.round || g.paid) fail('NO_ACTIVE_ROUND', 'No active round');
    if (command.roundId !== g.roundId) fail('STALE_COMMAND', 'Command belongs to another round');
    const r = restoreRound(g);
    if (command.op === 'act') {
      if (r.phase !== 'decisions') fail('ILLEGAL_ACTION', 'Illegal action');
      const hand = r.live()[r.active];
      if (command.turnSeq !== g.turnSeq || command.handIndex !== r.active || command.box !== hand.box) fail('STALE_COMMAND', 'Turn changed; reload to resume');
      if (!r.legal().includes(command.action)) fail('ILLEGAL_ACTION', 'Illegal action');
      if (['double','split'].includes(command.action)) effects.push({ kind: command.action, direction: 'debit', source: 'available', box: hand.box, hand: r.active, amount: hand.stake });
      fund(inputs, effects);
      r.act(command.action);
      params = { action: command.action };
    } else if (command.op === 'insurance') {
      const boxes = command.takeBoxes;
      if (r.phase !== 'insurance' || (boxes == null ? typeof command.take !== 'boolean' : !Array.isArray(boxes) || boxes.some(i => !Number.isInteger(i) || !r.live().some(h => h.box === i)))) fail('INSURANCE_UNAVAILABLE', 'Insurance is not available');
      const choices = r.live().map(h => boxes == null ? command.take : boxes.includes(h.box));
      r.live().forEach((h, i) => { if (choices[i]) effects.push({ kind: 'insurance', direction: 'debit', source: 'reservation', box: h.box, hand: i, amount: h.stake / 2 }); });
      fund(inputs, effects);
      r.resolveInsurance(choices);
      params = boxes == null ? { take: command.take } : { takeBoxes: [...boxes] };
    } else {
      if (r.phase !== 'settled') fail('ROUND_NOT_SETTLED', 'Round is not settled');
      // Exactly one settlement: after this the round is paid and further collects are rejected.
      r.live().forEach((h, i) => effects.push({ kind: 'payout', direction: 'credit', box: h.box, hand: i, amount: h.result + h.sideReturn }));
      g.paid = true;
      params = {};
    }
    g.round = r;
  }
  // The draw adapter is reconstructed on every command and never stored.
  if (g.round) delete g.round.shoe;
  g.version++;
  if (command.op !== 'collect') g.turnSeq++;
  const phase = g.round && !g.paid ? g.round.phase : 'collected';
  events.push({ type: `engine.${command.op}`, roundId: g.roundId, payload: { ...params, shoeId: g.shoe.id, version: g.version,
    draws: g.shoe.proof?.draws.filter(d => d.position > (prior === g.shoe.id ? drawn : 1)) ?? [], phase } });
  return result(g, events, effects, shuffled);
}
