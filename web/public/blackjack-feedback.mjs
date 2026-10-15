// Presentation only: consume server-issued returns, never calculate payouts.
// Adapted from Kevin's positive-profit feedback at f15b2af.
export function sideBetWin(hand) {
  const staked = hand.pp + hand.tp;
  const profit = hand.sideReturn - staked;
  return staked > 0 && profit > 0 ? { profit } : null;
}

export function roundWin(hands) {
  const profit = hands.reduce((sum, hand) => sum + hand.result + hand.sideReturn
    - hand.stake - hand.pp - hand.tp - (hand.insured ?? 0), 0);
  if (!(profit > 0)) return null;
  const blackjack = hands.some(hand => hand.splitFrom === null && hand.cards.length === 2
    && hand.cards.some(card => card.r === 'A')
    && hand.cards.some(card => ['10', 'J', 'Q', 'K'].includes(card.r))
    && hand.result > hand.stake + (hand.insured ?? 0));
  return { profit, blackjack };
}
