import { DealerEngine } from './dealer-engine.mjs';
import { Round, handValue } from './blackjack.mjs';

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2 });

// ---------- dealer engine ----------
const CLIP = {
  idle: 'idle-1/idle/idle',
  headTilt: 'idle-1/idle/idle-breathe-head-tilt',
  deal: 'idle-1/actions/action-deal',
  dealWatch: 'idle-1/actions/action-deal-watch',
  think: 'idle-1/actions/action-think',
  gest: 'idle-1/actions/gesticulate1',
};
const engine = new DealerEngine($('#dealer'), 'dealer', { log: m => console.info('[dealer]', m) });
let engineUp = false;
engine.onIdlePick = () => {
  const extras = [CLIP.headTilt, CLIP.gest].filter(k => engine.index.clips[k]);
  if (extras.length && Math.random() < 0.25) return extras[Math.floor(Math.random() * extras.length)];
  return CLIP.idle;
};
const trigger = k => { if (engineUp && engine.index.clips[k]) engine.trigger(k); };

try {
  await engine.init();
  await engine.start();
  engineUp = true;
} catch (e) {
  console.warn('dealer engine offline:', e.message);
  const ctx = $('#dealer').getContext('2d');
  const img = new Image();
  img.onload = () => { $('#dealer').width = 1440; $('#dealer').height = 1440; ctx.drawImage(img, 0, 0, 1440, 1440); };
  img.src = 'dealer-fallback.png';
}

// debug HUD (?debug)
if (location.search.includes('debug')) {
  document.body.classList.add('debug');
  setInterval(() => {
    $('#engine-hud').textContent =
      `clip ${engine.currentClip ?? '-'}\nsubmitted ${engine.stats.submitted} decoded ${engine.stats.decoded}` +
      `\nqueue ${engine.decoder?.decodeQueueSize ?? '-'} display ${engine.display.length}` +
      `\nsplices ${engine.stats.splices} errors ${engine.stats.errors}`;
  }, 500);
}

// ---------- clock ----------
setInterval(() => { $('#clock').textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }, 1000);

// ---------- betting ----------
const CHIPS = [1, 5, 10, 25, 50, 100, 500, 1000];
const LIMITS = { min: 5, max: 2000 };
let balance = 1000;
const ledger = (why, delta) => console.info('[ledger]', why, delta, '->', balance);
let selected = 5;
let bets = [0, 0, 0];
let round = null;
let busy = false; // true while the deal/reveal choreography runs

let undoStack = []; // [{box, value}] so ⟲ can peel chips off in order

const chipsEl = $('#chips');
for (const v of CHIPS) {
  const el = document.createElement('div');
  el.className = `chip c${v}` + (v === selected ? ' sel' : '');
  el.textContent = v >= 1000 ? '1K' : v;
  el.onclick = () => { selected = v; chipsEl.querySelectorAll('.chip').forEach(c => c.classList.remove('sel')); el.classList.add('sel'); };
  chipsEl.appendChild(el);
}

const chipClassFor = v => `c${[...CHIPS].reverse().find(c => c <= v) ?? 1}`;

// visual: a chip lifts off the picker and lands on the spot
function flyChip(value, targetEl) {
  const src = chipsEl.querySelector(`.chip.c${value}`) ?? chipsEl.firstChild;
  const a = src.getBoundingClientRect();
  const b = targetEl.getBoundingClientRect();
  const ghost = src.cloneNode(true);
  ghost.classList.add('chip-fly');
  ghost.style.left = `${a.x}px`; ghost.style.top = `${a.y}px`;
  document.body.appendChild(ghost);
  requestAnimationFrame(() => {
    ghost.style.transform = `translate(${b.x + b.width / 2 - a.x - a.width / 2}px, ${b.y + b.height / 2 - a.y - a.height / 2}px) scale(.9)`;
    ghost.style.opacity = '0.9';
  });
  setTimeout(() => ghost.remove(), 480);
}

document.querySelectorAll('.box').forEach(box => {
  const i = Number(box.dataset.box);
  box.querySelector('.spot').onclick = () => {
    if (round || busy) return;
    const next = bets[i] + selected;
    if (next > LIMITS.max || totalBet() + selected > balance) return;
    flyChip(selected, box.querySelector('.spot'));
    bets[i] = next;
    undoStack.push({ box: i, value: selected });
    renderBets();
  };
  box.querySelector('.clear-box').onclick = () => {
    if (round || busy) return;
    bets[i] = 0;
    undoStack = undoStack.filter(u => u.box !== i);
    renderBets();
  };
});
const totalBet = () => bets.reduce((a, b) => a + b, 0);

$('#undo-btn').onclick = () => {
  if (round || busy || !undoStack.length) return;
  const u = undoStack.pop();
  bets[u.box] = Math.max(0, bets[u.box] - u.value);
  renderBets();
};
$('#double-btn').onclick = () => {
  if (round || busy) return;
  const add = totalBet();
  if (!add || add > balance - 0 || totalBet() * 2 > balance || bets.some(b => b * 2 > LIMITS.max)) return;
  bets = bets.map(b => b * 2);
  undoStack.push(...bets.map((b, i) => ({ box: i, value: b / 2 })).filter(u => u.value > 0));
  renderBets();
};

function renderBets() {
  document.querySelectorAll('.box').forEach(box => {
    const i = Number(box.dataset.box);
    const spot = box.querySelector('.spot');
    if (bets[i]) {
      spot.classList.add('staked');
      spot.innerHTML = `<div class="stack-chip ${chipClassFor(bets[i])}">${bets[i] >= 1000 ? (bets[i] / 1000) + 'K' : bets[i]}</div>`;
    } else {
      spot.classList.remove('staked');
      spot.textContent = '+';
    }
    box.querySelector('.stake').textContent = bets[i] ? fmt(bets[i]) : '';
    box.querySelector('.clear-box').hidden = !bets[i] || !!round || busy;
  });
  $('#total-bet').textContent = fmt(totalBet());
  $('#balance').textContent = fmt(balance);
  const staked = bets.filter(b => b > 0);
  const playable = staked.length > 0 && staked.every(b => b >= LIMITS.min);
  $('#deal-now').disabled = !playable || !!round || busy;
  $('#clear-btn').disabled = totalBet() === 0 || !!round || busy;
  $('#undo-btn').disabled = !undoStack.length || !!round || busy;
  $('#double-btn').disabled = !totalBet() || totalBet() * 2 > balance || bets.some(b => b * 2 > LIMITS.max) || !!round || busy;
}
$('#clear-btn').onclick = () => { if (!round && !busy) { bets = [0, 0, 0]; undoStack = []; renderBets(); } };

// ---------- card rendering ----------
function cardEl(card, faceDown = false) {
  const el = document.createElement('div');
  if (faceDown) { el.className = 'card back'; return el; }
  const red = card.s === '♥' || card.s === '♦';
  el.className = 'card' + (red ? ' red' : '');
  el.innerHTML = `<div class="corner">${card.r}<br>${card.s}</div><div class="pip">${card.s}</div>`;
  return el;
}

// Cards are dealt FROM THE SHOE: after the element lands in the layout we
// compute the vector back to the shoe and animate from there.
function flyFromShoe(el) {
  const shoe = $('#shoe').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  el.style.setProperty('--dx', `${shoe.x + shoe.width / 2 - (r.x + r.width / 2)}px`);
  el.style.setProperty('--dy', `${shoe.y + shoe.height / 2 - (r.y + r.height / 2)}px`);
  el.classList.add('fly');
}

function updateBadge(container, cards) {
  let badge = container.querySelector('.hand-total');
  if (!cards.length) { badge?.remove(); return; }
  if (!badge) { badge = document.createElement('div'); badge.className = 'hand-total'; container.appendChild(badge); }
  container.appendChild(badge); // keep it last
  const { total, soft } = handValue(cards);
  badge.textContent = soft && total <= 21 ? `${total - 10}/${total}` : String(total);
}

function boxContainer(liveIdx) {
  // liveIdx counts staked boxes in DOM order
  let n = -1;
  for (const box of document.querySelectorAll('.box')) {
    const i = Number(box.dataset.box);
    if (bets[i]) { n++; if (n === liveIdx) return box.querySelector('.cards'); }
  }
  return null;
}

function dealCardTo(container, card, { faceDown = false } = {}) {
  const el = cardEl(card, faceDown);
  const badge = container.querySelector('.hand-total');
  container.insertBefore(el, badge ?? null);
  flyFromShoe(el);
  return el;
}

function revealHole(container, card) {
  const back = container.querySelector('.card.back');
  if (!back) return;
  const el = cardEl(card);
  el.classList.add('flip');
  back.replaceWith(el);
}

function clearTable() {
  document.querySelectorAll('.cards').forEach(c => (c.innerHTML = ''));
  document.querySelectorAll('.result').forEach(r => { r.textContent = ''; r.className = 'result'; });
}

// ---------- round flow ----------
function setBanner(text) { const b = $('#banner'); if (!text) b.classList.add('hidden'); else { b.classList.remove('hidden'); b.textContent = text; } }
function activeBoxHighlight() {
  document.querySelectorAll('.box').forEach(b => b.classList.remove('active'));
  if (!round || round.phase !== 'decisions') return;
  let n = -1;
  document.querySelectorAll('.box').forEach(box => {
    const i = Number(box.dataset.box);
    if (bets[i]) { n++; if (n === round.active) box.classList.add('active'); }
  });
}
function showActions() {
  const legal = round?.legal() ?? [];
  $('#actions').hidden = legal.length === 0;
  const stake = round?.live()[round.active]?.stake ?? Infinity;
  document.querySelectorAll('#actions button').forEach(b => {
    b.disabled = !legal.includes(b.dataset.act) ||
      (b.dataset.act === 'double' && balance < stake); // doubling costs another stake
  });
}

$('#deal-now').onclick = () => { if (!round && !busy) void dealSequence(); };

async function dealSequence() {
  busy = true;
  document.body.classList.add('in-round');
  balance -= totalBet(); ledger('deal', -totalBet());
  round = new Round(bets);
  round.deal(); // game logic resolves instantly; the choreography below is visual
  renderBets(); setBanner(null); clearTable();

  trigger(CLIP.deal);
  await sleep(700); // her hand starts the sweep

  const live = round.live();
  const PACE = 340;
  // first card to each box
  for (let i = 0; i < live.length; i++) {
    dealCardTo(boxContainer(i), live[i].cards[0]);
    updateBadge(boxContainer(i), live[i].cards.slice(0, 1));
    await sleep(PACE);
  }
  // dealer upcard
  dealCardTo($('#dealer-cards'), round.dealer[0]);
  updateBadge($('#dealer-cards'), [round.dealer[0]]);
  await sleep(PACE);
  // second card to each box
  for (let i = 0; i < live.length; i++) {
    dealCardTo(boxContainer(i), live[i].cards[1]);
    updateBadge(boxContainer(i), live[i].cards.slice(0, 2));
    await sleep(PACE);
  }
  // dealer hole card, face down
  dealCardTo($('#dealer-cards'), null, { faceDown: true });
  await sleep(PACE);

  trigger(CLIP.dealWatch);

  if (round.phase === 'insurance') {
    const cost = round.live().reduce((a, b) => a + b.stake / 2, 0);
    $('#ins-yes').disabled = balance < cost; // never let insurance overdraw
    $('#insurance').hidden = false; busy = false; renderBets(); return;
  }
  await afterDealChoreo();
}

$('#ins-yes').onclick = () => resolveIns(true);
$('#ins-no').onclick = () => resolveIns(false);
function resolveIns(yes) {
  if (!round || round.phase !== 'insurance') return;
  $('#insurance').hidden = true;
  busy = true;
  if (yes) {
    const cost = round.live().reduce((a, b) => a + b.stake / 2, 0);
    if (balance < cost) yes = false; // belt-and-braces on top of the disabled button
    else { balance -= cost; ledger('insurance', -cost); }
  }
  round.resolveInsurance(round.live().map(() => yes));
  renderBets();
  void afterDealChoreo();
}

async function afterDealChoreo() {
  // dealer blackjack found on the peek ends the round immediately
  if (round.phase === 'settled') { await dealerRevealChoreo(); await finish(); return; }
  busy = false;
  renderBets(); activeBoxHighlight(); showActions();
  if (round.phase === 'decisions') trigger(CLIP.think);
}

document.querySelectorAll('#actions button').forEach(btn => {
  btn.onclick = async () => {
    if (!round || round.phase !== 'decisions' || busy) return;
    const liveIdx = round.active;
    const hand = round.live()[liveIdx];
    const before = hand.cards.length;
    if (btn.dataset.act === 'double') {
      if (balance < hand.stake) return; // engine doubles the stake; the added amount equals the original
      balance -= hand.stake; ledger('double', -hand.stake);
    }
    // disarm immediately so the second click of a double-click can't hit the next box
    document.querySelectorAll('#actions button').forEach(b => { b.disabled = true; });
    round.act(btn.dataset.act);
    // show any card the action drew
    if (hand.cards.length > before) {
      dealCardTo(boxContainer(liveIdx), hand.cards.at(-1));
      updateBadge(boxContainer(liveIdx), hand.cards);
    }
    renderBets(); activeBoxHighlight();
    if (round.phase === 'decisions') {
      trigger(CLIP.think);
      setTimeout(() => { if (round && round.phase === 'decisions' && !busy) showActions(); }, 280);
    } else {
      $('#actions').hidden = true;
      busy = true;
      await dealerRevealChoreo();
      await finish();
    }
  };
});

async function dealerRevealChoreo() {
  const dc = $('#dealer-cards');
  trigger(CLIP.dealWatch);
  await sleep(500);
  // reveal the hole card
  if (round.dealer.length >= 2) {
    revealHole(dc, round.dealer[1]);
    updateBadge(dc, round.dealer.slice(0, 2));
    await sleep(650);
  }
  // any further draws, one by one from the shoe
  for (let i = 2; i < round.dealer.length; i++) {
    dealCardTo(dc, round.dealer[i]);
    updateBadge(dc, round.dealer.slice(0, i + 1));
    await sleep(560);
  }
}

async function finish() {
  activeBoxHighlight();
  const live = round.live();
  let ret = 0, anyWin = false;
  let n = -1;
  document.querySelectorAll('.box').forEach(box => {
    const i = Number(box.dataset.box);
    if (!bets[i]) return;
    n++;
    const hand = live[n];
    ret += hand.result;
    const el = box.querySelector('.result');
    const net = hand.result - hand.stake - hand.insured;
    if (net > 0) { el.textContent = 'WIN ' + fmt(hand.result); el.classList.add('win'); anyWin = true; }
    else if (net === 0) { el.textContent = 'PUSH'; el.classList.add('push'); }
    else { el.textContent = 'LOSE'; el.classList.add('lose'); }
  });
  balance += ret; ledger('settle', ret);
  trigger(anyWin ? CLIP.gest : CLIP.headTilt);
  renderBets();
  await sleep(3600);
  round = null; busy = false;
  bets = [0, 0, 0];
  undoStack = [];
  clearTable();
  document.body.classList.remove('in-round');
  renderBets(); setBanner('PLEASE PLACE BETS');
}

// ---------- chat stub ----------
const CANNED = [
  "I'm your AI dealer — cards land as the RNG decides, I just keep you company.",
  'Dealer stands on all 17s here, and blackjack pays 3 to 2.',
  'Insurance pays 2 to 1, but mathematically it favours the house.',
  'Good luck — place your bets whenever you are ready.',
];
$('#chat-send').onclick = sendChat;
$('#chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
function sendChat() {
  const input = $('#chat-input');
  if (!input.value.trim()) return;
  input.value = '';
  trigger(CLIP.gest);
  setBanner(CANNED[Math.floor(Math.random() * CANNED.length)]);
  setTimeout(() => { if (!round && !busy) setBanner('PLEASE PLACE BETS'); else setBanner(null); }, 4000);
}

renderBets();
setBanner('PLEASE PLACE BETS');
