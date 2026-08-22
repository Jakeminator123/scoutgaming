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

// ---------- dealer voice ----------
const LINES = {
  greeting: "Welcome to Priv\u00e9 Blackjack. Take a seat, I'll be your dealer tonight.",
  placebets: 'Place your bets, please.',
  goodluck: 'Bets are closed. Good luck!',
  insurance: 'Insurance is open. Would you like to protect your hand?',
  peek: 'Let me take a look at my hand.',
  blackjack: 'Blackjack! That is beautifully done. Congratulations!',
  bust: "Bust. I'm sorry, that hand is over.",
  dealerbust: 'Dealer busts! Congratulations, the table wins.',
  win: 'Well played! Enjoy your winnings.',
  lose: 'Dealer wins this one. Better luck next round.',
  push: "It's a push. Your stake is returned.",
  dealerblackjack: 'Dealer has blackjack. This round goes to the house.',
  sidebet: 'Your side bet pays! Nicely done.',
  chatter1: 'The cards have been kind tonight.',
  chatter2: "Take your time. There's no rush at my table.",
  farewell: 'Thanks for playing with me. Come back soon.',
  double: "Doubling down. One card, let's make it count.",
};
const VOICE_LINES = Object.keys(LINES);
const voice = {
  muted: localStorage.getItem('croupier-muted') === '1',
  audio: new Map(),
  playing: false,
  greeted: false,
  load() { for (const t of VOICE_LINES) { const a = new Audio(`dealer/audio/en/${t}.mp3`); a.preload = 'auto'; this.audio.set(t, a); } },
  say(t, { force = false } = {}) {
    if (this.muted) return;
    const a = this.audio.get(t);
    if (!a) return;
    if (this.playing && !force) return;
    this.playing = true;
    const cap = $('#caption');
    cap.textContent = LINES[t] ?? '';
    cap.classList.add('show');
    const done = () => { this.playing = false; cap.classList.remove('show'); };
    // lip-synced speaking clip when we have one: cut the video to it, then
    // start the audio a beat later so lips and voice line up
    const speakClip = `idle-1/speak/${t}`;
    if (engineUp && engine.index.clips[speakClip]) {
      engine.interrupt(speakClip);
      setTimeout(() => { a.currentTime = 0; a.play().catch(() => {}); }, 350);
    } else {
      a.currentTime = 0;
      a.play().catch(() => {});
      if (Math.random() < 0.6) trigger(Math.random() < 0.5 ? CLIP.gest : CLIP.headTilt);
    }
    a.onended = done;
    setTimeout(done, 8000); // safety
  },
};
voice.load();
const soundBtn = $('#sound-btn');
const renderSound = () => { soundBtn.classList.toggle('muted', voice.muted); soundBtn.textContent = voice.muted ? '🔇' : '🔊'; };
soundBtn.onclick = () => { voice.muted = !voice.muted; localStorage.setItem('croupier-muted', voice.muted ? '1' : '0'); renderSound(); };
renderSound();
// idle chatter — she talks on her own now and then
setInterval(() => {
  if (!round && !busy && voice.greeted && Math.random() < 0.5) voice.say(Math.random() < 0.5 ? 'chatter1' : 'chatter2');
}, 48000);

// ---------- clock ----------
setInterval(() => { $('#clock').textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }, 1000);

// ---------- state ----------
const SEATS = 7;
const CHIPS = [1, 5, 10, 25, 50, 100, 500, 1000];
const LIMITS = { min: 5, max: 2000 };
let balance = 1000;
const ledger = (why, delta) => console.info('[ledger]', why, delta, '->', balance);
let selected = 5;
let bets = Array.from({ length: SEATS }, () => ({ main: 0, pp: 0, tp: 0 }));
let undoStack = []; // [{box, field, value}]
let round = null;
let busy = false;

const betTotal = () => bets.reduce((a, b) => a + b.main + b.pp + b.tp, 0);
const mains = () => bets.map(b => b.main);

// ---------- seat layout on the oval ----------
const seatsEl = $('#seats');
const seatEls = [];
for (let i = 0; i < SEATS; i++) {
  const el = document.createElement('div');
  el.className = 'seat';
  el.dataset.box = i;
  el.innerHTML = `<div class="seat-inner">
    <div class="cards"></div>
    <button class="clear-box" hidden>×</button>
    <div class="side pp" title="Perfect Pairs — needs a main bet">PP</div>
    <div class="spot">+</div>
    <div class="side tp" title="21+3 — needs a main bet">21+3</div>
    <div class="stake"></div>
    <div class="sideresult"></div>
    <div class="result"></div>
  </div>`;
  seatsEl.appendChild(el);
  seatEls.push(el);
}
// screen-space seat positions measured from the expected-results screenshot:
// x fractions of the viewport, y on a shallow arc bowing toward the player
function layoutSeats() {
  const P = [0.185, 0.28, 0.39, 0.50, 0.61, 0.72, 0.815];
  const table = document.querySelector('#table2d').getBoundingClientRect();
  for (let i = 0; i < SEATS; i++) {
    const p = P[i];
    // measured from the ER: chip row bows from .57 (edges) to .78 (center) of table height
    const yRel = 0.72 - 0.185 * ((p - 0.5) / 0.315) ** 2;
    seatEls[i].style.left = `${p * innerWidth}px`;
    seatEls[i].style.top = `${yRel * table.height}px`;
    seatEls[i].querySelector('.seat-inner').style.setProperty('--tang', `${(p - 0.5) * 38}deg`);
  }
}
layoutSeats();
addEventListener('resize', layoutSeats);

// ---------- chip picker ----------
const chipsEl = $('#chips');
for (const v of CHIPS) {
  const el = document.createElement('div');
  el.className = `chip c${v}` + (v === selected ? ' sel' : '');
  el.textContent = v >= 1000 ? '1K' : v;
  el.onclick = () => {
    selected = v;
    chipsEl.querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
    el.classList.add('sel');
  };
  chipsEl.appendChild(el);
}
const chipClassFor = v => `c${[...CHIPS].reverse().find(c => c <= v) ?? 1}`;

function flyChip(value, targetEl) {
  const src = chipsEl.querySelector(`.chip.c${value}`) ?? chipsEl.firstChild;
  const a = src.getBoundingClientRect();
  const b = targetEl.getBoundingClientRect();
  const ghost = src.cloneNode(true);
  ghost.classList.add('chip-fly');
  ghost.style.left = `${a.x}px`; ghost.style.top = `${a.y}px`;
  document.body.appendChild(ghost);
  requestAnimationFrame(() => {
    ghost.style.transform = `translate(${b.x + b.width / 2 - a.x - a.width / 2}px, ${b.y + b.height / 2 - a.y - a.height / 2}px) scale(.72)`;
    ghost.style.opacity = '0.9';
  });
  setTimeout(() => ghost.remove(), 480);
}

// ---------- betting ----------
function placeBet(i, field, targetEl) {
  console.info('[bet]', i, field, 'round=', !!round, 'busy=', busy);
  if (round || busy) return;
  if (field !== 'main' && bets[i].main === 0) return; // side bets ride on a main bet
  const cap = field === 'main' ? LIMITS.max : LIMITS.max / 2;
  const next = bets[i][field] + selected;
  if (next > cap || betTotal() + selected > balance) return;
  flyChip(selected, targetEl);
  bets[i][field] = next;
  undoStack.push({ box: i, field, value: selected });
  renderBets();
}
seatEls.forEach((seat, i) => {
  seat.querySelector('.spot').onclick = e => { console.info('[click-src]', i, 'trusted=', e.isTrusted); placeBet(i, 'main', e.currentTarget); };
  seat.querySelector('.side.pp').onclick = e => placeBet(i, 'pp', e.currentTarget);
  seat.querySelector('.side.tp').onclick = e => placeBet(i, 'tp', e.currentTarget);
  seat.querySelector('.clear-box').onclick = () => {
    if (round || busy) return;
    bets[i] = { main: 0, pp: 0, tp: 0 };
    undoStack = undoStack.filter(u => u.box !== i);
    renderBets();
  };
});
$('#undo-btn').onclick = () => {
  if (round || busy || !undoStack.length) return;
  const u = undoStack.pop();
  bets[u.box][u.field] = Math.max(0, bets[u.box][u.field] - u.value);
  if (bets[u.box].main === 0) { bets[u.box].pp = 0; bets[u.box].tp = 0; undoStack = undoStack.filter(x => x.box !== u.box); }
  renderBets();
};
$('#double-btn').onclick = () => {
  if (round || busy) return;
  const add = betTotal();
  if (!add || add * 2 > balance + add - add || betTotal() * 2 > balance || bets.some(b => b.main * 2 > LIMITS.max)) return;
  for (const [i, b] of bets.entries()) {
    if (b.main) undoStack.push({ box: i, field: 'main', value: b.main });
    if (b.pp) undoStack.push({ box: i, field: 'pp', value: b.pp });
    if (b.tp) undoStack.push({ box: i, field: 'tp', value: b.tp });
  }
  bets = bets.map(b => ({ main: b.main * 2, pp: b.pp * 2, tp: b.tp * 2 }));
  renderBets();
};
$('#clear-btn').onclick = () => {
  if (round || busy) return;
  bets = bets.map(() => ({ main: 0, pp: 0, tp: 0 }));
  undoStack = [];
  renderBets();
};

function stackChip(v) {
  return `<div class="chipimg ${chipClassFor(v)}"><img src="assets/chip-gold.png" alt=""><b>${v >= 1000 ? (v / 1000) + 'K' : v}</b></div>`;
}
function renderBets() {
  seatEls.forEach((seat, i) => {
    const b = bets[i];
    const spot = seat.querySelector('.spot');
    if (b.main) { spot.classList.add('staked'); spot.innerHTML = stackChip(b.main); }
    else { spot.classList.remove('staked'); spot.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="8" r="3.6"/><path d="M3.5 20c.8-3.6 3.4-5.6 6.5-5.6s5.7 2 6.5 5.6"/><path d="M18 8.5h5M20.5 6v5"/></svg>'; }
    for (const f of ['pp', 'tp']) {
      const el = seat.querySelector(`.side.${f}`);
      if (b[f]) { el.classList.add('staked'); el.innerHTML = stackChip(b[f]); }
      else { el.classList.remove('staked'); el.textContent = f === 'pp' ? 'PP' : '21+3'; }
    }
    const parts = [];
    if (b.main) parts.push(fmt(b.main));
    if (b.pp || b.tp) parts.push(`+${fmt(b.pp + b.tp)} side`);
    seat.querySelector('.stake').textContent = parts.join(' ');
    seat.querySelector('.clear-box').hidden = !(b.main || b.pp || b.tp) || !!round || busy;
  });
  $('#total-bet').textContent = fmt(betTotal());
  $('#balance').textContent = fmt(balance);
  const staked = bets.filter(b => b.main > 0);
  const playable = staked.length > 0 && staked.every(b => b.main >= LIMITS.min);
  $('#deal-now').disabled = !playable || !!round || busy;
  $('#clear-btn').disabled = betTotal() === 0 || !!round || busy;
  $('#undo-btn').disabled = !undoStack.length || !!round || busy;
  $('#double-btn').disabled = !betTotal() || betTotal() * 2 > balance || bets.some(b => b.main * 2 > LIMITS.max) || !!round || busy;
}

// ---------- card rendering ----------
function cardEl(card, faceDown = false) {
  const el = document.createElement('div');
  if (faceDown) { el.className = 'card back'; return el; }
  const red = card.s === '♥' || card.s === '♦';
  el.className = 'card' + (red ? ' red' : '');
  el.innerHTML = `<div class="corner">${card.r}<br>${card.s}</div><div class="pip">${card.s}</div>`;
  return el;
}
function flyFromShoe(el) {
  const shoe = $('#shoe2d').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  el.style.setProperty('--dx', `${shoe.x + shoe.width / 2 - (r.x + r.width / 2)}px`);
  el.style.setProperty('--dy', `${shoe.y + shoe.height / 2 - (r.y + r.height / 2)}px`);
  el.classList.add('fly');
}
function updateBadge(container, cards) {
  let badge = container.querySelector('.hand-total');
  if (!cards.length) { badge?.remove(); return; }
  if (!badge) { badge = document.createElement('div'); badge.className = 'hand-total'; }
  container.appendChild(badge);
  badge.style.setProperty('--cn', Math.max(0, container.querySelectorAll('.card').length - 1));
  const { total, soft } = handValue(cards);
  badge.textContent = soft && total <= 21 ? `${total - 10}/${total}` : String(total);
}
function seatOfLive(liveIdx) {
  let n = -1;
  for (let i = 0; i < SEATS; i++) if (bets[i].main) { n++; if (n === liveIdx) return seatEls[i]; }
  return null;
}
const boxContainer = liveIdx => seatOfLive(liveIdx)?.querySelector('.cards');
function dealCardTo(container, card, { faceDown = false } = {}) {
  const el = cardEl(card, faceDown);
  el.style.setProperty('--ci', container.querySelectorAll('.card').length);
  const badge = container.querySelector('.hand-total');
  container.insertBefore(el, badge ?? null);
  flyFromShoe(el);
  return el;
}
function revealHole(container, card) {
  const back = container.querySelector('.card.back');
  if (!back) return;
  const el = cardEl(card);
  el.style.setProperty('--ci', back.style.getPropertyValue('--ci') || 1);
  el.classList.add('flip');
  back.replaceWith(el);
}
function clearTable() {
  document.querySelectorAll('.cards').forEach(c => (c.innerHTML = ''));
  document.querySelectorAll('.result, .sideresult').forEach(r => { r.textContent = ''; r.className = r.className.split(' ')[0]; });
}

// ---------- round flow ----------
function setBanner(text) { const b = $('#banner'); if (!text) b.classList.add('hidden'); else { b.classList.remove('hidden'); b.textContent = text; } }
function activeBoxHighlight() {
  seatEls.forEach(s => s.classList.remove('active'));
  $('#actions').hidden = true;
  $('#actions-top').hidden = true;
  if (!round || round.phase !== 'decisions') return;
  const seat = seatOfLive(round.active);
  if (!seat) return;
  seat.classList.add('active');
  showActions(seat);
}
function showActions(seat) {
  const legal = round?.legal() ?? [];
  const bar = $('#actions');
  bar.hidden = legal.length === 0;
  const top = $('#actions-top');
  top.hidden = legal.length === 0;
  const stake = round?.live()[round.active]?.stake ?? Infinity;
  for (const b of [...bar.querySelectorAll('button'), ...top.querySelectorAll('button')]) {
    b.disabled = !legal.includes(b.dataset.act) ||
      (b.dataset.act === 'double' && balance < stake);
  }
  if (bar.hidden) return;
  const r = (seat ?? seatOfLive(round.active)).getBoundingClientRect();
  bar.style.left = `${Math.min(innerWidth - 190, r.x + 56)}px`;
  bar.style.top = `${Math.max(60, r.y + 18)}px`;
}

$('#deal-now').onclick = () => { if (!round && !busy) void dealSequence(); };

async function dealSequence() {
  busy = true;
  document.body.classList.add('in-round');
  balance -= betTotal(); ledger('deal', -betTotal());
  round = new Round(bets.map(b => ({ ...b })));
  round.deal();
  renderBets(); setBanner(null); clearTable();
  voice.say('goodluck', { force: true });
  trigger(CLIP.deal);
  await sleep(700);

  const live = round.live();
  const PACE = 320;
  for (let i = 0; i < live.length; i++) {
    dealCardTo(boxContainer(i), live[i].cards[0]);
    updateBadge(boxContainer(i), live[i].cards.slice(0, 1));
    await sleep(PACE);
  }
  dealCardTo($('#dealer-cards'), round.dealer[0]);
  updateBadge($('#dealer-cards'), [round.dealer[0]]);
  await sleep(PACE);
  for (let i = 0; i < live.length; i++) {
    dealCardTo(boxContainer(i), live[i].cards[1]);
    updateBadge(boxContainer(i), live[i].cards.slice(0, 2));
    await sleep(PACE);
  }
  dealCardTo($('#dealer-cards'), null, { faceDown: true });
  await sleep(PACE);

  // side bets resolve on the deal, like the real game
  let sideWin = false;
  live.forEach((b, i) => {
    if (!(b.pp || b.tp)) return;
    const el = seatOfLive(i).querySelector('.sideresult');
    if (b.sideReturn > 0) { sideWin = true; el.textContent = `${b.sideLabels.join(' · ')} +${fmt(b.sideReturn)}`; }
    else el.textContent = 'side lost';
  });
  if (sideWin) voice.say('sidebet', { force: true });

  trigger(CLIP.dealWatch);

  if (round.phase === 'insurance') {
    const cost = round.live().reduce((a, b) => a + b.stake / 2, 0);
    $('#ins-yes').disabled = balance < cost;
    $('#insurance').hidden = false; busy = false; renderBets();
    voice.say('insurance', { force: true });
    return;
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
    if (balance < cost) yes = false;
    else { balance -= cost; ledger('insurance', -cost); }
  }
  round.resolveInsurance(round.live().map(() => yes));
  renderBets();
  void afterDealChoreo();
}

async function afterDealChoreo() {
  if (round.phase === 'settled') { await dealerRevealChoreo(); await finish(); return; }
  busy = false;
  renderBets(); activeBoxHighlight();
  if (round.phase === 'decisions') trigger(CLIP.think);
}

document.querySelectorAll('#actions button, #actions-top button').forEach(btn => {
  btn.onclick = async e => {
    console.info('[act]', btn.dataset.act, 'trusted=', e?.isTrusted, 'phase=', round?.phase, 'busy=', busy);
    if (!round || round.phase !== 'decisions' || busy) return;
    const liveIdx = round.active;
    const hand = round.live()[liveIdx];
    const before = hand.cards.length;
    if (btn.dataset.act === 'double') {
      if (balance < hand.stake) return;
      balance -= hand.stake; ledger('double', -hand.stake);
      voice.say('double', { force: true });
    }
    document.querySelectorAll('#actions button').forEach(b => { b.disabled = true; });
    round.act(btn.dataset.act);
    if (hand.cards.length > before) {
      dealCardTo(boxContainer(liveIdx), hand.cards.at(-1));
      updateBadge(boxContainer(liveIdx), hand.cards);
      if (handValue(hand.cards).total > 21) voice.say('bust');
    }
    renderBets();
    if (round.phase === 'decisions') {
      trigger(CLIP.think);
      setTimeout(() => { if (round && round.phase === 'decisions' && !busy) activeBoxHighlight(); }, 280);
      activeBoxHighlight();
    } else {
      $('#actions').hidden = true;
      $('#actions-top').hidden = true;
      seatEls.forEach(s => s.classList.remove('active'));
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
  if (round.dealer.length >= 2) {
    revealHole(dc, round.dealer[1]);
    updateBadge(dc, round.dealer.slice(0, 2));
    await sleep(650);
  }
  for (let i = 2; i < round.dealer.length; i++) {
    dealCardTo(dc, round.dealer[i]);
    updateBadge(dc, round.dealer.slice(0, i + 1));
    await sleep(560);
  }
}

async function finish() {
  $('#actions').hidden = true;
  $('#actions-top').hidden = true;
  seatEls.forEach(s => s.classList.remove('active'));
  const live = round.live();
  let ret = 0, sideRet = 0, anyWin = false, anyPush = false, anyLose = false, anyPlayerBJ = false;
  let n = -1;
  seatEls.forEach((seat, i) => {
    if (!bets[i].main) return;
    n++;
    const hand = live[n];
    ret += hand.result;
    sideRet += hand.sideReturn ?? 0;
    const el = seat.querySelector('.result');
    const net = hand.result - hand.stake - hand.insured;
    if (hand.cards.length === 2 && handValue(hand.cards).total === 21) anyPlayerBJ = true;
    if (net > 0) { el.textContent = 'WIN ' + fmt(hand.result); el.classList.add('win'); anyWin = true; }
    else if (net === 0) { el.textContent = 'PUSH'; el.classList.add('push'); anyPush = true; }
    else { el.textContent = 'LOSE'; el.classList.add('lose'); anyLose = true; }
  });
  balance += ret; ledger('settle', ret);
  if (sideRet) { balance += sideRet; ledger('sidebets', sideRet); }
  renderBets();
  const dealerTotal = handValue(round.dealer).total;
  const dealerBJ = round.dealer.length === 2 && dealerTotal === 21;
  if (dealerBJ) voice.say('dealerblackjack', { force: true });
  else if (anyPlayerBJ && anyWin) voice.say('blackjack', { force: true });
  else if (dealerTotal > 21) voice.say('dealerbust', { force: true });
  else if (anyWin) voice.say('win', { force: true });
  else if (anyPush && !anyLose) voice.say('push', { force: true });
  else voice.say('lose', { force: true });
  trigger(anyWin ? CLIP.gest : CLIP.headTilt);
  await sleep(3600);
  round = null; busy = false;
  bets = bets.map(() => ({ main: 0, pp: 0, tp: 0 }));
  undoStack = [];
  clearTable();
  document.body.classList.remove('in-round');
  renderBets(); setBanner('PLEASE PLACE BETS');
  voice.say('placebets');
}

// ---------- chat stub ----------
const CANNED = [
  "I'm your AI dealer — cards land as the RNG decides, I just keep you company.",
  'Dealer stands on all 17s here, and blackjack pays 3 to 2.',
  'Perfect Pairs pays up to 25 to 1, and 21+3 up to 100 to 1.',
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
  voice.say(Math.random() < 0.5 ? 'chatter1' : 'chatter2');
  setBanner(CANNED[Math.floor(Math.random() * CANNED.length)]);
  setTimeout(() => { if (!round && !busy) setBanner('PLEASE PLACE BETS'); else setBanner(null); }, 4000);
}

$('#gate-enter').onclick = () => {
  $('#gate').classList.add('hidden');
  voice.greeted = true;
  voice.say('greeting', { force: true });
};

renderBets();
setBanner('PLEASE PLACE BETS');
