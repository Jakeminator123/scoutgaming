// When the alternative dealer comments on the viewer's own play. Only sometimes, so it
// stays a remark and never becomes a lecture. Pure: the random source is injected.

function handValue(cards) {
  let value = 0, aces = 0;
  for (const card of cards) {
    if (card.r === 'A') { value += 11; aces++; }
    else value += ['J', 'Q', 'K'].includes(card.r) ? 10 : Number(card.r);
  }
  while (value > 21 && aces) { value -= 10; aces--; }
  return { value, soft: aces > 0 };
}

export function remarkForAction(action, cards, rand = Math.random) {
  if (!cards?.length || cards.some(c => !c.r)) return null;
  const { value, soft } = handValue(cards);
  if (action === 'hit' && !soft && value === 20) return rand() < .9 ? 'remark_hit20_1' : null;
  if (action === 'hit' && !soft && value >= 17 && value <= 19) return rand() < .75 ? (rand() < .5 ? 'remark_hit17_1' : 'remark_hit17_2') : null;
  if (action === 'stand' && value <= 11) return rand() < .75 ? 'remark_stand11_1' : null;
  return null;
}

// "Things are going really well for you, lend me some money?" once a streak reaches n wins.
export function createWinStreak(n = 2) {
  let streak = 0;
  return won => { streak = won ? streak + 1 : 0; return streak === n ? 'banter_1' : null; };
}

// Greeting when the viewer sits down: a named take when one was recorded for that first
// name (made in advance, so no visitor name ever reaches a voice provider), else the guest one.
const NAMED = ['kevin', 'axel', 'john', 'emil', 'fredrik', 'jakob', 'ian'];
export function greetingFor(name) {
  const first = String(name ?? '').trim().split(/\s+/)[0].toLowerCase();
  return NAMED.includes(first) ? `greet_${first}` : 'greet_guest';
}

// Table talk when two or more players sit at the table: known recorded lines, one at random.
export const TABLE_TALK = ['table_trust_1', 'table_cash_1'];   // "Du kan inte lita på någon i det här spelet." / "Alla tänker på sig själva och cashen i första hand."
export function tableTalkFor(players, rand = Math.random) {
  return players >= 2 && rand() < .4 ? TABLE_TALK[Math.floor(rand() * TABLE_TALK.length) % TABLE_TALK.length] : null;
}
