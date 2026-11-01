// Semantic observation shared by the regression test and its historical-vector
// capture. No game rules or production imports: only an explicit selection of
// card identities, decisions, outcomes and wallet effects. Diagnostic events,
// display labels, extra metadata and object insertion order are not behavior.
const card = c => c == null ? null : { rank: c.r, suit: c.s, serial: c.serial, draw: c.shoeDraw ?? null };
const sideBet = s => s == null ? null : { stake: s.stake, returned: s.returned, profit: s.profit, draws: s.draws };
const hand = h => ({
  box: h.box, splitFrom: h.splitFrom, stake: h.stake, pp: h.pp, tp: h.tp,
  cards: h.cards.map(card), done: h.done, doubled: h.doubled, busted: h.busted === true,
  insured: h.insured, result: h.result, sideReturn: h.sideReturn,
  sideResults: { pp: sideBet(h.sideResults?.pp), tp: sideBet(h.sideResults?.tp) },
});
const round = r => r == null ? null : ({
  phase: r.phase, active: r.active, boxes: r.boxes.map(hand), hands: r.hands.map(hand),
  dealer: r.dealer.map(card), holeCard: card(r.holeCard), holeDraw: r.holeDraw ?? null,
  legalActions: r.legalActions == null ? null : [...r.legalActions].sort(),
});

export function behaviorObservation({ state, view }) {
  return {
    round: round(state.round), visibleRound: round(view.round), paid: state.paid,
    shoe: { cards: state.shoe.cards.map(card), dealt: state.shoe.dealt, cutReached: state.shoe.cutReached },
  };
}

export function moneyObservation({ effects }) {
  // Keep each recipient and funding source, not only the net table balance:
  // moving a payout between boxes can leave the total unchanged.
  return effects.map(e => ({
    kind: e.kind, direction: e.direction, source: e.source ?? null,
    box: e.box, hand: e.hand ?? null, amount: e.amount,
  }));
}
