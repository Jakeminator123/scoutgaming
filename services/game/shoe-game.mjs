import { Round, freshShoe } from './public/blackjack.mjs';

import { SHOE_RULES } from '../../packages/shared/blackjack-shoe-rules.mjs';
export function newGame() { return { version: 0, shoe: null, round: null, paid: false, last: null }; }
function shuffle(g) {
  const cards = freshShoe(SHOE_RULES.decks);
  cards.pop(); // one face-down burn, excluded from playable cards
  g.shoe = { id: crypto.randomUUID(), cards, dealt: 1, cutReached: false };
}
export function shoeView(g) {
  const s = g.shoe;
  return s && { id: s.id, total: SHOE_RULES.total, remaining: s.cards.length,
    dealt: s.dealt, cutAfter: SHOE_RULES.cutAfter, cutReached: s.cutReached,
    shufflePending: s.cutReached, decks: SHOE_RULES.decks, burn: SHOE_RULES.burn };
}
function restoreRound(g) {
  const r = Object.assign(Object.create(Round.prototype), g.round);
  r.boxes = r.boxes.map(b => r.hands.find(h => h.box === b.box) ?? b);
  r.shoe = { draw() {
    if (!g.shoe.cards.length) throw new Error('Shoe exhausted; round paused. No mid-round shuffle.');
    const card = g.shoe.cards.pop(); g.shoe.dealt++;
    if (g.shoe.dealt >= SHOE_RULES.cutAfter) g.shoe.cutReached = true;
    return { ...card, shoeDraw: g.shoe.dealt };
  } };
  return r;
}
export function gameView(g) {
  let round = null;
  if (g.round && !g.paid) {
    const r = restoreRound(g);
    round = { boxes: r.boxes, hands: r.hands, dealer: r.dealer, phase: r.phase,
      active: r.active, holeDraw: r.holeCard?.shoeDraw, legalActions: r.phase === 'decisions' ? r.legal() : [] };
  }
  // Never send shoe order, burn, private holeCard or internal event payloads.
  return { version: g.version, shoe: shoeView(g), round };
}
export function command(g, req, balance) {
  if (!g.shoe) shuffle(g);
  if (req.op === 'state') return { delta: 0, view: gameView(g) };
  if (typeof req.requestId !== 'string' || req.requestId.length > 100) throw new Error('Request ID required');
  if (g.last?.id === req.requestId) {
    if (g.last.input !== JSON.stringify(req)) throw new Error('Request ID reused with different input');
    return { delta: 0, view: g.last.view };
  }
  if (req.version !== g.version) throw new Error('Table changed; reload to resume');
  let delta = 0, shuffled = false;
  if (req.op === 'start') {
    if (g.round && !g.paid) throw new Error('Finish the current round first');
    const b = req.bets;
    if (!Array.isArray(b) || b.length !== 7 || !b.some(x => x?.main > 0)) throw new Error('Place a main bet');
    for (const x of b) {
      for (const key of ['main','pp','tp']) if (!Number.isFinite(x?.[key]) || x[key] < 0 || x[key] > 2000 || !Number.isInteger(x[key] * 100)) throw new Error('Invalid stake');
      if ((x.main > 0 && x.main < 5) || (!x.main && (x.pp || x.tp))) throw new Error('Side bets require a main bet of at least 5');
    }
    delta = -b.reduce((n,x) => n+x.main+x.pp+x.tp, 0);
    if (balance + delta < 0) throw new Error('Insufficient balance');
    if (g.shoe.cutReached) { shuffle(g); shuffled = true; }
    const r = new Round(b, []); g.round = r; g.paid = false;
    const live = restoreRound(g); live.deal(); g.round = live;
  } else {
    if (!g.round || g.paid) throw new Error('No active round');
    const r = restoreRound(g);
    if (req.op === 'act') {
      if (r.phase !== 'decisions' || !r.legal().includes(req.action)) throw new Error('Illegal action');
      if (['double','split'].includes(req.action)) delta = -r.live()[r.active].stake;
      if (balance + delta < 0) throw new Error('Insufficient balance');
      r.act(req.action);
    } else if (req.op === 'insurance') {
      if (r.phase !== 'insurance' || typeof req.take !== 'boolean') throw new Error('Insurance is not available');
      if (req.take) delta = -r.live().reduce((n,h)=>n+h.stake/2,0);
      if (balance + delta < 0) throw new Error('Insufficient balance');
      r.resolveInsurance(r.live().map(()=>req.take));
    } else if (req.op === 'collect') {
      if (r.phase !== 'settled') throw new Error('Round is not settled');
      delta = r.live().reduce((n,h)=>n+h.result+h.sideReturn,0); g.paid = true;
    } else throw new Error('Unknown table command');
    g.round = r;
  }
  // The draw adapter is reconstructed server-side on every command.
  if (g.round) delete g.round.shoe;
  g.version++;
  const view = { ...gameView(g), shuffled };
  g.last = { id: req.requestId, input: JSON.stringify(req), view };
  return { delta, view };
}
