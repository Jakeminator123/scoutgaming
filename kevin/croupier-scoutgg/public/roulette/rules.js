// European roulette, single zero (back office spec: straight 35:1, split 17:1, red/black 1:1). Shared by the server,
// which alone draws and settles, and the table page, which only shows. Board after Jakob's web/games/roulette/rules.mjs.
export const WHEEL = Object.freeze([0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]);
const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const pocketColor = n => n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black';

const bets = [];
const add = (id, label, type, numbers) => bets.push(Object.freeze({ id, label, type, numbers: Object.freeze(numbers), payout: 36 / numbers.length - 1 }));
for (let n = 0; n <= 36; n++) add(`straight-${n}`, String(n), 'straight', [n]);
for (let n = 1; n <= 36; n++) {
  if (n % 3 !== 0) add(`split-${n}-${n + 1}`, `${n} / ${n + 1}`, 'split', [n, n + 1]);
  if (n <= 33) add(`split-${n}-${n + 3}`, `${n} / ${n + 3}`, 'split', [n, n + 3]);
  if (n % 3 === 1) {
    add(`street-${n}`, `${n}–${n + 2}`, 'street', [n, n + 1, n + 2]);
    if (n <= 31) add(`line-${n}`, `${n}–${n + 5}`, 'line', [n, n + 1, n + 2, n + 3, n + 4, n + 5]);
  }
  if (n <= 32 && n % 3 !== 0) add(`corner-${n}`, `${n} / ${n + 1} / ${n + 3} / ${n + 4}`, 'corner', [n, n + 1, n + 3, n + 4]);
}
for (let n = 1; n <= 3; n++) add(`split-0-${n}`, `0 / ${n}`, 'split', [0, n]);
add('first-four', '0 / 1 / 2 / 3', 'corner', [0, 1, 2, 3]);
const ALL = Array.from({ length: 36 }, (_, i) => i + 1);
for (let n = 1; n <= 3; n++) {
  add(`dozen-${n}`, ['1st 12', '2nd 12', '3rd 12'][n - 1], 'dozen', ALL.slice((n - 1) * 12, n * 12));
  add(`column-${n}`, `Column ${n}`, 'column', ALL.filter(v => (v - 1) % 3 === n - 1));
}
for (const [id, label, keep] of [['red', 'Red', n => REDS.has(n)], ['black', 'Black', n => !REDS.has(n)], ['even', 'Even', n => n % 2 === 0],
  ['odd', 'Odd', n => n % 2 === 1], ['low', '1–18', n => n <= 18], ['high', '19–36', n => n >= 19]]) add(id, label, 'outside', ALL.filter(keep));
export const BETS = Object.freeze(bets);
export const BET_BY_ID = Object.freeze(Object.fromEntries(BETS.map(b => [b.id, b])));

/** What a set of bets ({betId: amount}) returns when `number` comes up: stake plus winnings on every winning bet. */
export function settle(placed, number) {
  let returned = 0;
  const wins = [];
  for (const [id, amount] of Object.entries(placed)) {
    const bet = BET_BY_ID[id];
    if (bet?.numbers.includes(number)) { returned += amount * (bet.payout + 1); wins.push(id); }
  }
  return { returned: Math.round(returned * 100) / 100, wins };
}
