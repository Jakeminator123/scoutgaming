// Public, deterministic board definitions. Randomness and settlement stay on Render.
export const WHEEL = Object.freeze([0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]);
const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const pocketColor = number => number === 0 ? 'green' : reds.has(number) ? 'red' : 'black';
export const LIMITS = Object.freeze({ min: 1, maxPerBet: 2000, maxTotal: 10000 });
const bets = [];
const add = (id, label, type, numbers) => bets.push(Object.freeze({ id, label, type,
  numbers: Object.freeze(numbers), payout: 36 / numbers.length - 1 }));
for (let n = 0; n <= 36; n++) add(`straight-${n}`, String(n), 'straight', [n]);
for (let n = 1; n <= 36; n++) {
  if (n % 3 !== 0) add(`split-${n}-${n+1}`, `${n} / ${n+1}`, 'split', [n,n+1]);
  if (n <= 33) add(`split-${n}-${n+3}`, `${n} / ${n+3}`, 'split', [n,n+3]);
  if (n % 3 === 1) {
    add(`street-${n}`, `${n}–${n+2}`, 'street', [n,n+1,n+2]);
    if (n <= 31) add(`line-${n}`, `${n}–${n+5}`, 'line', [n,n+1,n+2,n+3,n+4,n+5]);
  }
  if (n <= 32 && n % 3 !== 0) add(`corner-${n}`, `${n} / ${n+1} / ${n+3} / ${n+4}`, 'corner', [n,n+1,n+3,n+4]);
}
for (let n = 1; n <= 3; n++) add(`split-0-${n}`, `0 / ${n}`, 'split', [0,n]);
add('trio-1', '0 / 1 / 2', 'trio', [0,1,2]);
add('trio-2', '0 / 2 / 3', 'trio', [0,2,3]);
add('first-four', '0 / 1 / 2 / 3', 'corner', [0,1,2,3]);
const numbers = Array.from({ length:36 }, (_,i) => i+1);
for (let n = 1; n <= 3; n++) {
  add(`dozen-${n}`, `${1+(n-1)*12}–${n*12}`, 'dozen', numbers.slice((n-1)*12,n*12));
  add(`column-${n}`, `Kolumn ${n}`, 'column', numbers.filter(v => (v-1)%3 === n-1));
}
for (const [id,label,predicate] of [
  ['red','Röd',n=>reds.has(n)], ['black','Svart',n=>!reds.has(n)],
  ['even','Jämnt',n=>n%2===0], ['odd','Udda',n=>n%2===1],
  ['low','1–18',n=>n<=18], ['high','19–36',n=>n>=19],
]) add(id,label,'outside',numbers.filter(predicate));
export const BETS = Object.freeze(bets);
export const BET_BY_ID = Object.freeze(Object.fromEntries(BETS.map(bet => [bet.id,bet])));
