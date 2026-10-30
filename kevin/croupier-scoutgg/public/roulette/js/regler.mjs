// Satsningskatalog, utbetalningar och gränser: kopierat ordagrant ur spelmotorn
// (scoutgaming origin/main: services/game/games/roulette/rules.mjs, läst 2026-10-29 med git show, ingen checkout).
// Ändras motorn ska den här delen kopieras om. Under linjen: prototypens egna hjälpfunktioner.
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

// ---------- prototypens hjälpfunktioner ----------
// motorns avräkning (room.mjs): returned = cents(amount) * (payout + 1) om numret träffas, i hela ören
export const cents = (v) => Math.round(v * 100);
export const retur = (id, belopp, nummer) => BET_BY_ID[id].numbers.includes(nummer) ? cents(belopp) * (BET_BY_ID[id].payout + 1) / 100 : 0;
export const fargOrd = (n) => n === 0 ? 'noll' : pocketColor(n) === 'red' ? 'röd' : 'svart';
const TYPNAMN = { straight: 'Rakt', split: 'Delning', street: 'Gata', line: 'Sexrad', corner: 'Hörn', trio: 'Trio', dozen: 'Dussin', column: 'Kolumn' };
export function etikett(id) {
  const b = BET_BY_ID[id];
  if (b.type === 'outside') return b.label;
  if (id === 'first-four') return 'Första fyra';
  if (b.type === 'column') return b.label;
  if (b.type === 'dozen' || b.type === 'street' || b.type === 'line') return `${TYPNAMN[b.type]} ${b.label}`;
  return `${TYPNAMN[b.type]} ${b.numbers.join('/')}`;
}
// slumpat utfall i prototypen (motorn drar med crypto.randomInt(0, 37) på servern)
export function dra() {
  const u = new Uint32Array(1), grans = Math.floor(2 ** 32 / 37) * 37;
  do crypto.getRandomValues(u); while (u[0] >= grans);
  return u[0] % 37;
}
