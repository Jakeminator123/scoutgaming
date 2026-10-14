// Presentation only: every card and result below comes from the server snapshot.
export function total(cards) {
  let value = 0, aces = 0;
  for (const card of cards) {
    if (card.r === "A") { value += 11; aces++; }
    else value += ["J", "Q", "K"].includes(card.r) ? 10 : Number(card.r);
  }
  while (value > 21 && aces) { value -= 10; aces--; }
  return value;
}

// What the table counter shows: while an ace still counts as 11 the hand reads both ways ("7/17").
export function totalLabel(cards) {
  const value = total(cards), hard = total(cards.map(c => c.r === "A" ? { r: "1" } : c));
  return value < 21 && hard + 10 === value ? `${hard}/${value}` : String(value);
}

export function cardsIn(round) {
  if (!round) return [];
  return [
    ...round.hands.flatMap(hand => hand.cards.map(card => ({ card, seat: hand.box + 1 }))),
    ...round.dealer.map(card => ({ card, seat: "dealer" })),
  ];
}

// calls (a ready dealer with the lines, Emil 14 Oct): a hand that reaches 21 is called as its card lands, like a bust:
// "blackjack" for a natural, "twentyone" for 21 on more cards (or after a split)
export function planDraws(before, after, opening = false, { calls = false } = {}) {
  if (!after) return [];
  const known = new Set(cardsIn(before).map(({ card }) => card.shoeDraw));
  if (before?.holeDraw) known.add(before.holeDraw);
  const added = cardsIn(after).filter(({ card }) => !known.has(card.shoeDraw));
  if (opening) {
    // Even an immediate dealer blackjack first receives its hole card face down.
    const hole = added.findIndex(({ card }) => card.shoeDraw === after.holeDraw);
    if (hole >= 0) added.splice(hole, 1);
    added.push({ card: null, seat: "dealer", shoeDraw: after.holeDraw });
  }
  added.sort((a, b) => (a.card?.shoeDraw ?? a.shoeDraw) - (b.card?.shoeDraw ?? b.shoeDraw));
  const reveal = after.dealer.length > 1 && (opening || before?.dealer.length === 1);
  let revealed = !reveal;
  const steps = [];
  for (const entry of added) {
    const draw = entry.card?.shoeDraw ?? entry.shoeDraw;
    if (!revealed && entry.seat === "dealer" && draw > after.holeDraw) {
      steps.push({ kind: "reveal", card: after.dealer[1] }); revealed = true;
    }
    const hole = opening && entry.seat === "dealer" && draw === after.holeDraw;
    steps.push({ kind: "deal", ...entry, shoeDraw: draw, clipId: hole ? "deal_hole" : `deal_pos${entry.seat}`, track: hole ? "hole" : String(entry.seat) });
    const hand = after.hands.find(h => h.cards.at(-1)?.shoeDraw === draw && total(h.cards) > 21);
    if (hand) steps.push({ kind: "speech", event: "bust" });
    const made = calls && after.hands.find(h => h.cards.at(-1)?.shoeDraw === draw && h.cards.length >= 2 && total(h.cards) === 21);
    if (made) steps.push({ kind: "speech", event: made.cards.length === 2 && made.splitFrom === null ? "blackjack" : "twentyone" });
  }
  if (!revealed) steps.push({ kind: "reveal", card: after.dealer[1] });
  return steps;
}

export function outcomeSpeech(round) {
  const dealer = total(round.dealer);
  if (round.dealer.length === 2 && dealer === 21) return "dealerblackjack";
  const won = round.hands.some(h => h.result > h.stake);
  if (won && round.hands.some(h => h.splitFrom === null && h.cards.length === 2 && total(h.cards) === 21)) return "blackjack";
  // "winners all round" right after a bust at the table grates (CH): cheer only when nobody busted
  if (won && dealer > 21 && !round.hands.some(h => total(h.cards) > 21)) return "dealerbust";
  if (won) return "win";
  // busted hands were already voiced on the draw: a push beside a bust is a push
  const standing = round.hands.filter(h => total(h.cards) <= 21);
  if (standing.length && standing.every(h => h.result === h.stake)) return "push";
  return "lose";
}
