// Roulette table page (Kevin 14 Oct). The server (server/roulette.mjs) owns the round, the pocket and the wallet; this page
// only shows them: bets on the felt, the wheel spinning to the pocket the server drew, the result and the balance.
import { BETS, BET_BY_ID, pocketColor } from './rules.js';
import { tableBetGeometry, polygonButtonStyle, tableArtwork } from './table-layout.js';
import { mountRouletteWheel } from './wheel.js';

const DESIGN = 'roulette-anna-v1';
const $ = s => document.querySelector(s);
const money = n => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const session = /^[a-z0-9_-]{1,40}$/i.test(new URLSearchParams(location.search).get('session') ?? '') ? new URLSearchParams(location.search).get('session') : 'roulette';
const CHIP_COLORS = { 1: ['#e8e2d4', '#5a554c', '#1c1a16'], 5: ['#D6FF3A', '#0A0B0D', '#0A0B0D'], 25: ['#F2F1ED', '#0A0B0D', '#0A0B0D'],
  100: ['#26282c', '#DBC18A', '#DBC18A'], 500: ['#DBC18A', '#fff5da', '#201c13'], 1000: ['#d6b46a', '#fff5da', '#201c13'] };

const spots = {}, spotAt = bet => spots[bet.id] ?? null;
let state = null, chip = null, busy = false, spunRound = null, fetchedAt = 0, poll;
const wheel = mountRouletteWheel($('#wheel'), { designId: DESIGN, placement: { x: 0, y: 0, width: 1 } });

async function api(op, extra = {}) {
  const res = await fetch('/api/roulette', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify({ session, op, ...(op === 'state' ? {} : { requestId: crypto.randomUUID() }), ...extra }) });
  const body = await res.json().catch(() => ({ error: 'The table did not answer' }));
  if (!res.ok) throw new Error(body.error ?? 'The table did not answer');
  return body;
}
function showError(message) {
  const el = $('#error'); el.textContent = message; el.hidden = false;
  clearTimeout(showError.t); showError.t = setTimeout(() => { el.hidden = true; }, 3500);
}
async function act(op, extra) {
  if (busy) return; busy = true;
  try { render(await api(op, extra)); } catch (e) { showError(e.message); } finally { busy = false; }
}

// bet targets on the printed felt (straight 0–36, dozens, outside); columns have no printed 2:1 box, so they sit in the dock
function buildTargets() {
  const host = $('#targets'), art = tableArtwork(DESIGN);
  for (const bet of BETS) {
    const { polygon } = tableBetGeometry(bet, DESIGN);
    if (!polygon) continue;
    const st = polygonButtonStyle(polygon, DESIGN), b = document.createElement('button');
    b.type = 'button'; b.dataset.bet = bet.id;
    b.setAttribute('aria-label', `Bet on ${bet.label}, pays ${bet.payout} to 1`);
    Object.assign(b.style, { left: st.left + '%', top: st.top + '%', width: st.width + '%', height: st.height + '%', clipPath: `polygon(${st.clip})` });
    b.addEventListener('click', () => placeOn(bet.id));
    host.append(b);
  }
  // inside bets between numbers (split, street, corner, line): a small spot on the line between them, above the numbers
  for (const bet of BETS) {
    if (!['split', 'street', 'corner', 'line'].includes(bet.type)) continue;
    const { anchor: at } = tableBetGeometry(bet, DESIGN); if (!at) continue;
    // a line sits on the same edge as its streets, half a row away: move it further out so the two never overlap
    // the first four (0–3) would land on the 0/2 split: it goes on the outer corner of 0 and 1 instead
    const corner = tableBetGeometry(BET_BY_ID['straight-1'], DESIGN).polygon[0];
    const anchor = bet.type === 'line' ? [at[0] - 24, at[1]] : bet.id === 'first-four' ? [corner[0] - 30, corner[1]] : at;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'rl-spot'; b.dataset.bet = bet.id;
    b.setAttribute('aria-label', `Bet on ${bet.label}, pays ${bet.payout} to 1`); b.title = `${bet.label} · ${bet.payout}:1`;
    spots[bet.id] = anchor;
    b.style.left = 100 * anchor[0] / art.width + '%'; b.style.top = 100 * anchor[1] / art.height + '%';
    b.addEventListener('click', () => placeOn(bet.id));
    host.append(b);
  }
  // a flat board for phones, where the felt in perspective is too small to hit: zero, 1–36 in three columns, dozens, outside
  const board = $('#board'), cellBtn = (id, text, cls = '') => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.bet = id; b.className = cls;
    b.setAttribute('aria-label', `Bet on ${BET_BY_ID[id].label}, pays ${BET_BY_ID[id].payout} to 1`);
    b.innerHTML = `<span>${text}</span><b hidden></b>`; b.addEventListener('click', () => placeOn(id)); return b;
  };
  // laid out like the felt turned sideways: zero on the left, 3 rows of 12 (3, 6 … 36 on top), dozens and outside below
  board.append(cellBtn('straight-0', '0', 'zero green'));
  for (const row of [3, 2, 1]) for (let c = 0; c < 12; c++) { const n = c * 3 + row; board.append(cellBtn(`straight-${n}`, n, pocketColor(n))); }
  for (const n of [1, 2, 3]) board.append(cellBtn(`dozen-${n}`, BET_BY_ID[`dozen-${n}`].label, 'dozen'));
  for (const [id, text] of [['low', '1–18'], ['even', 'Even'], ['red', '◆'], ['black', '◆'], ['odd', 'Odd'], ['high', '19–36']])
    board.append(cellBtn(id, text, 'out ' + (id === 'red' || id === 'black' ? id + '-mark' : '')));
  for (const n of [1, 2, 3]) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.bet = `column-${n}`;
    b.innerHTML = `Column ${n} · 2:1<b hidden></b>`; b.addEventListener('click', () => placeOn(`column-${n}`));
    $('#columns').append(b);
  }
}
function placeOn(betId) {
  if (!state?.me || state.phase !== 'bets') return;
  if (!chip) return showError('Choose a chip');
  act('bet', { bet: betId, chip });
}
function chipSvg(v) {
  const [fill, rim, ink] = CHIP_COLORS[v] ?? CHIP_COLORS[25], label = v >= 1000 ? v / 1000 + 'K' : String(v);
  return `<svg viewBox="-22 -22 44 44" aria-hidden="true"><circle r="21.5" fill="${fill}" stroke="#0a0b0d59"/>${[0, 60, 120, 180, 240, 300].map(a =>
    `<rect x="-3" y="-21.5" width="6" height="7" rx="1" fill="${rim}" transform="rotate(${a})"/>`).join('')}<circle r="14" fill="none" stroke="${rim}" stroke-opacity=".45"/>` +
    `<text y="4.5" text-anchor="middle" font-weight="700" font-size="${label.length > 2 ? 11 : 13}" fill="${ink}" font-family="Inter,sans-serif">${label}</text></svg>`;
}
function buildChips(chips) {
  const host = $('#chips');
  if (host.dataset.values === chips.join()) return;
  host.dataset.values = chips.join(); host.replaceChildren();
  for (const v of chips) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.chip = v; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', money(v) + ' chip');
    b.innerHTML = chipSvg(v); b.addEventListener('click', () => { chip = v; markChip(); }); host.append(b);
  }
  if (!chips.includes(chip)) chip = chips[1] ?? chips[0];
  markChip();
}
const markChip = () => document.querySelectorAll('#chips button').forEach(b => b.setAttribute('aria-checked', String(Number(b.dataset.chip) === chip)));

function renderStacks(bets) {
  const host = $('#stacks'), art = tableArtwork(DESIGN); host.replaceChildren();
  for (const [id, amount] of Object.entries(bets)) {
    const bet = BET_BY_ID[id]; if (!bet) continue;
    const col = /^column-(\d)$/.exec(id);
    if (col) { const b = $(`#columns [data-bet="${id}"] b`); b.hidden = false; b.textContent = money(amount); continue; }
    const anchor = spotAt(bet) ?? tableBetGeometry(bet, DESIGN).anchor; if (!anchor) continue;
    const s = document.createElement('span'); s.className = 'rl-stack'; s.textContent = amount >= 1000 ? amount / 1000 + 'K' : amount;
    s.style.left = 100 * anchor[0] / art.width + '%'; s.style.top = 100 * anchor[1] / art.height + '%'; host.append(s);
  }
  document.querySelectorAll('#columns button b').forEach(b => { if (!bets[b.parentElement.dataset.bet]) b.hidden = true; });
  for (const b of document.querySelectorAll('#board button')) { const v = bets[b.dataset.bet], tag = b.querySelector('b'); tag.hidden = !v; if (v) tag.textContent = v >= 1000 ? v / 1000 + 'K' : v; }
}
function renderHistory(history) {
  $('#history').replaceChildren(...history.map(n => { const li = document.createElement('li'); li.className = pocketColor(n); li.textContent = n; return li; }));
}
function renderResult(s) {
  const el = $('#result');
  document.querySelectorAll('#targets button.win, #board button.win').forEach(b => b.classList.remove('win'));
  if (s.phase !== 'result') { el.hidden = true; return; }
  document.querySelectorAll(`#targets [data-bet="straight-${s.number}"], #board [data-bet="straight-${s.number}"]`).forEach(b => b.classList.add('win'));
  const r = s.me?.result, net = r ? r.returned - r.staked : 0;
  const name = { red: 'Red', black: 'Black', green: 'Zero' }[s.color];
  el.innerHTML = `<div class="num ${s.color}">${s.number}</div><div>${name}${s.number ? ' · ' + (s.number % 2 ? 'Odd' : 'Even') : ''}</div>` +
    (r ? `<div class="net ${net > 0 ? 'won' : ''}">${net > 0 ? 'You win ' + money(r.returned) : net === 0 ? 'Stake back' : r.returned ? 'Back ' + money(r.returned) : 'No win this time'}</div><small>Staked ${money(r.staked)}</small>` : '');
  el.hidden = false;
}

function render(s) {
  state = s; fetchedAt = performance.now();
  buildChips(s.limits.chips);
  const locked = s.phase !== 'bets';
  document.body.classList.toggle('rl-locked', locked);
  $('#tableName').textContent = `Roulette · European · ${money(s.limits.min)}–${money(s.limits.max)}`;
  $('#balance').textContent = s.me ? money(s.me.balance) : '–';
  $('#staked').textContent = money(s.me?.staked ?? 0);
  $('#players').textContent = s.players;
  renderStacks(s.me?.bets ?? {});
  renderHistory(s.history);
  const mine = Object.keys(s.me?.bets ?? {}).length > 0;
  $('#undo').disabled = $('#clear').disabled = locked || !mine;
  $('#repeat').disabled = locked || mine || !s.me?.canRepeat;
  const empty = s.me && s.me.balance < s.limits.min && !mine;
  $('#refill').hidden = !empty; $('#refill').textContent = '+ ' + money(s.limits.refill) + ' demo';
  for (const b of document.querySelectorAll('#targets button, #columns button, #board button')) b.disabled = locked;
  if (s.phase === 'spin' && spunRound !== s.roundId && wheel) {
    spunRound = s.roundId;
    const elapsed = s.spinMs - s.spinLeft, start = performance.now();
    wheel.play(s.number, s.roundId, { clock: () => elapsed + performance.now() - start });
  } else if (s.phase === 'result' && spunRound !== s.roundId && wheel) { spunRound = s.roundId; wheel.showOutcome(s.number, s.roundId); }
  renderResult(s);
  tick();
}
function tick() {
  if (!state) return;
  const s = state, since = performance.now() - fetchedAt;
  let text, timer = '', width = 0;
  if (s.phase === 'bets') {
    if (s.closesIn === null) text = 'Place your bets';
    else { const left = Math.max(0, s.closesIn - since); text = left > 0 ? 'Place your bets' : 'No more bets'; timer = Math.ceil(left / 1000) + ' s'; width = 100 * left / 15000; }
  } else if (s.phase === 'spin') text = 'No more bets · the wheel is spinning';
  else text = `${s.number} ${{ red: 'Red', black: 'Black', green: 'Zero' }[s.color]}`;
  $('#status').textContent = text; $('#timer').textContent = timer; $('#bar').style.width = width + '%';
}

async function refresh() {
  try { render(await api('state')); } catch (e) { showError(e.message); }
  clearTimeout(poll);
  poll = setTimeout(refresh, document.hidden ? 4000 : 1000);
}
$('#undo').addEventListener('click', () => act('undo'));
$('#clear').addEventListener('click', () => act('clear'));
$('#repeat').addEventListener('click', () => act('repeat'));
$('#refill').addEventListener('click', () => act('refill'));
setInterval(tick, 250);
buildTargets();
(async () => {
  try {
    let s = await api('state');
    if (!s.me) s = await api('join', { name: 'Guest ' + (100 + Math.floor(Math.random() * 900)) });
    render(s);
  } catch (e) { showError(e.message); }
  poll = setTimeout(refresh, 1000);
})();
