// Compatibility facade for the native/partner table and standalone simulations.
// Shared V3 and this facade execute the SAME hand rules; only the older constructor
// default and serialized side-bet shape live here. The browser uses handValue for
// display, never as authority over the server's cards, decisions or payouts.
import { Round as RuleRound, RANKS, SUITS } from '../games/blackjack/round.mjs';
export { handValue } from '../games/blackjack/round.mjs';

// Preserve the native shoe's existing RNG calls, card shape and rejection threshold.
// V3's explicit random port and commit/reveal transcript remain in core.mjs.
function randInt(n) {
  const max = Math.floor(0xFFFFFFFF / n) * n;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= max);
  return buf[0] % n;
}
export function freshShoe(decks = 8) {
  const shoe = [];
  for (let d = 0; d < decks; d++)
    for (const s of SUITS) for (const r of RANKS) shoe.push({ r, s });
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

export class Round extends RuleRound {
  constructor(boxes, shoe = freshShoe()) { super(boxes, shoe); }

  settleSideBets() {
    super.settleSideBets();
    // Native saved hands and API responses predate V3's per-side-bet audit details.
    // Preserve their exact shape; V3 callers retain the details on RuleRound.
    for (const hand of this.live()) delete hand.sideResults;
  }
}
