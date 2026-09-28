// Product adapters: presentation-only values, never game decisions or payouts.
export const suitColor = suit => ['♥', '♦'].includes(suit) ? '#AE2025' : '#171B1B';
export function svgNode(tag, attributes = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
export function total(cards) {
  let value = 0, aces = 0;
  for (const card of cards) {
    if (card.r === 'A') { value += 11; aces++; }
    else value += ['J', 'Q', 'K'].includes(card.r) ? 10 : Number(card.r);
  }
  while (value > 21 && aces) { value -= 10; aces--; }
  return value;
}
