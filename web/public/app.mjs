import { DealerEngine } from './dealer-engine.mjs';
import { Round, handValue } from './blackjack.mjs';

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CURRENCIES = { USD: 'en-US', EUR: 'de-DE', SEK: 'sv-SE' };
let currency = 'USD';
const fmt = n => n.toLocaleString(CURRENCIES[currency], { style: 'currency', currency, minimumFractionDigits: 2 });

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
soundBtn.onclick = () => {
  voice.muted = !voice.muted; localStorage.setItem('croupier-muted', voice.muted ? '1' : '0'); renderSound();
  if (voice.muted) sfx.stopAmbience(); else sfx.startAmbience();
};
renderSound();
// idle chatter — she talks on her own now and then
setInterval(() => {
  if (!round && !busy && voice.greeted && Math.random() < 0.5) voice.say(Math.random() < 0.5 ? 'chatter1' : 'chatter2');
}, 48000);

// ---------- sound system ----------
const sfx = {
  files: {},
  load() {
    const el = new Audio('sfx/ambience.mp3'); el.preload = 'auto';
    el.loop = true; el.volume = 0.16; this.files.ambience = el;
  },
  // everything except the ambience loop is synthesized: generated foley assets
  // were noise-washes (or, boosted, pure hiss), and synthesis has zero latency
  play(n) {
    if (voice.muted) return;
    if (n === 'chip') return synthChip();
    if (n === 'deal') return synthDeal();
    if (n === 'knock') return synthKnock();
    if (n === 'win') return synthWin();
    if (n === 'bigwin') return synthBigWin();
  },
  startAmbience() { if (!voice.muted) this.files.ambience?.play().catch(() => {}); },
  stopAmbience() { this.files.ambience?.pause(); },
};
sfx.load();
// hover ticks: tiny synth click, no asset needed
let actx = null;
function hoverTick() {
  if (voice.muted) return;
  try {
    actx = actx ?? new AudioContext();
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = 1400; o.type = 'sine';
    g.gain.setValueAtTime(0.045, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.05);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.06);
  } catch { /* ignore */ }
}
document.addEventListener('mouseover', e => {
  if (e.target.closest?.('button, .chip, .spot, .side')) hoverTick();
});

// tabletop foley, synthesized so every hit is instant and dry
function noiseBurst(t, { dur, gain, type, freq, q = 1.5, decay = 2 }) {
  const len = Math.max(8, Math.floor(actx.sampleRate * dur));
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  const src = actx.createBufferSource(); src.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = actx.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(actx.destination); src.start(t);
}
function synthChip() {
  // ceramic chip landing on a stack: bright click + softer settle click
  try {
    actx = actx ?? new AudioContext();
    const t0 = actx.currentTime;
    const f = 3600 + Math.random() * 1400;
    noiseBurst(t0, { dur: 0.045, gain: 0.75, type: 'bandpass', freq: f, q: 2.5, decay: 2.6 });
    noiseBurst(t0 + 0.04 + Math.random() * 0.025, { dur: 0.035, gain: 0.35, type: 'bandpass', freq: f * 0.85, q: 2.5, decay: 2.6 });
  } catch { /* ignore */ }
}
function synthDeal() {
  // card snapped onto felt: short high snap + faint slide
  try {
    actx = actx ?? new AudioContext();
    const t0 = actx.currentTime;
    noiseBurst(t0, { dur: 0.03, gain: 0.5, type: 'highpass', freq: 2600, q: 0.8, decay: 1.6 });
    noiseBurst(t0 + 0.012, { dur: 0.07, gain: 0.16, type: 'bandpass', freq: 1400, q: 0.9, decay: 3 });
  } catch { /* ignore */ }
}
function synthKnock() {
  // knuckles on the table edge. No pitch sweep and no long tail (that reads as
  // a kick drum): a hard lowpassed contact click plus inharmonic wood modes
  // with <60ms decay, second knock slightly softer and earlier-damped.
  try {
    actx = actx ?? new AudioContext();
    const knock = (t, vel) => {
      noiseBurst(t, { dur: 0.011, gain: 0.55 * vel, type: 'lowpass', freq: 800, q: 0.7, decay: 1.1 });
      for (const [freq, gain, dec] of [[97, 0.34, 0.06], [176, 0.24, 0.05], [287, 0.13, 0.04], [520, 0.06, 0.03]]) {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = freq * (0.97 + Math.random() * 0.06);
        g.gain.setValueAtTime(gain * vel, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dec);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dec + 0.01);
      }
    };
    const t0 = actx.currentTime;
    knock(t0, 1);
    knock(t0 + 0.125 + Math.random() * 0.03, 0.8);
  } catch { /* ignore */ }
}
function chime(t, freq, dur, gain) {
  // soft bell: fundamental + quiet detuned octave partial, exponential decay
  const o = actx.createOscillator(), o2 = actx.createOscillator();
  const g = actx.createGain(), g2 = actx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  o2.type = 'sine'; o2.frequency.value = freq * 2.01; g2.gain.value = 0.16;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); o2.connect(g2).connect(g); g.connect(actx.destination);
  o.start(t); o.stop(t + dur); o2.start(t); o2.stop(t + dur);
}
function synthWin() {
  // two-note payout chime
  try {
    actx = actx ?? new AudioContext();
    const t0 = actx.currentTime;
    chime(t0, 880, 0.5, 0.28);
    chime(t0 + 0.1, 1174.7, 0.7, 0.28);
  } catch { /* ignore */ }
}
function synthBigWin() {
  // ascending E-major arpeggio with a sparkle on top
  try {
    actx = actx ?? new AudioContext();
    const t0 = actx.currentTime;
    [659.3, 830.6, 987.8, 1318.5].forEach((f, i) => chime(t0 + i * 0.1, f, 0.8, 0.3));
    chime(t0 + 0.52, 1661.2, 1.2, 0.2);
  } catch { /* ignore */ }
}

// win toasts: stacked notifications so wins and their amounts are unmissable
function toast(title, amount, big = false) {
  let stack = document.querySelector('#toasts');
  if (!stack) { stack = document.createElement('div'); stack.id = 'toasts'; document.body.appendChild(stack); }
  const t = document.createElement('div');
  t.className = big ? 'toast big' : 'toast';
  t.innerHTML = `<b>${title}</b><span>+${fmt(amount)}</span>`;
  stack.appendChild(t);
  setTimeout(() => t.classList.add('out'), 4200);
  setTimeout(() => t.remove(), 4800);
}

// celebration bursts
function burstAt(x, y, big = false) {
  const b = document.createElement('div');
  b.className = 'burst'; b.style.left = `${x}px`; b.style.top = `${y}px`;
  const n = big ? 26 : 14;
  const colors = ['#d9c06a', '#f0dfa8', '#D6FF3A', '#fff'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    const ang = Math.random() * Math.PI * 2, r = (big ? 130 : 80) * (0.5 + Math.random() * 0.8);
    p.style.setProperty('--bx', `${Math.cos(ang) * r}px`);
    p.style.setProperty('--by', `${Math.sin(ang) * r - 30}px`);
    p.style.setProperty('--bc', colors[i % colors.length]);
    p.style.animationDelay = `${Math.random() * 0.12}s`;
    b.appendChild(p);
  }
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 1400);
}
function bjFlash(text) {
  const el = document.createElement('div');
  el.className = 'bj-flash'; el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

// ---------- clock ----------
setInterval(() => { $('#clock').textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }, 1000);

// ---------- state ----------
const SEATS = 7;
const CHIPS = [1, 5, 10, 25, 50, 100, 500, 1000];
const LIMITS = { min: 5, max: 2000 };
let balance = 1000;

// ---------- player account: server-persisted demo money (SQLite) ----------
let player = null;
async function api(path, payload) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error ?? `api ${r.status}`);
  return out;
}
async function loadPlayer() {
  try {
    player = await api('/api/player', { id: localStorage.getItem('croupier-player'), name: 'Kevin' });
    localStorage.setItem('croupier-player', player.id);
    balance = player.balance; currency = player.currency;
    renderBets(); renderCurrency();
  } catch { /* server db unavailable: play on with the local demo balance */ }
}
function syncBalance(reason) {
  if (!player) return;
  fetch('/api/balance', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: player.id, balance, reason }),
  }).catch(() => {});
}

// Vera reacts to table events through her live brain (throttled, text captions)
let veraBusy = false, lastVeraComment = 0;
function showCaption(text, ms = 6500) {
  const cap = $('#caption');
  cap.textContent = text; cap.classList.add('show');
  clearTimeout(showCaption.t);
  showCaption.t = setTimeout(() => cap.classList.remove('show'), ms);
}
async function veraEvent(text, { minGap = 18000 } = {}) {
  const now = Date.now();
  if (veraBusy || now - lastVeraComment < minGap) return;
  veraBusy = true; lastVeraComment = now;
  try {
    const r = await fetch('/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, event: true }),
    });
    const { reply } = await r.json();
    if (reply) { showCaption(reply); trigger(CLIP.gest); }
  } catch { /* brain offline: stay quiet */ }
  finally { veraBusy = false; }
}
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
    <svg class="sidearcs" viewBox="-64 -50 128 100" aria-hidden="false">
      <g transform="scale(1 0.74)">
        <path class="side pp" d="M -26.9 -26.9 A 38 38 0 0 0 -26.9 26.9 L -36.8 36.8 A 52 52 0 0 1 -36.8 -36.8 Z"><title>Perfect Pairs — needs a main bet</title></path>
        <path class="side tp" d="M 26.9 -26.9 A 38 38 0 0 1 26.9 26.9 L 36.8 36.8 A 52 52 0 0 0 36.8 -36.8 Z"><title>21+3 — needs a main bet</title></path>
      </g>
      <text class="side-label" x="-44" y="3" text-anchor="middle" transform="rotate(-75 -44 0)">PP</text>
      <text class="side-label" x="44" y="3" text-anchor="middle" transform="rotate(75 44 0)">21+3</text>
    </svg>
    <div class="spot">+</div>
    <div class="side-chip pp-chip" hidden></div>
    <div class="side-chip tp-chip" hidden></div>
    <div class="stake"></div>
    <div class="sideresult"></div>
    <div class="result"></div>
  </div>`;
  seatsEl.appendChild(el);
  seatEls.push(el);
}
// screen-space seat positions measured from the expected-results screenshot:
// x fractions of the viewport, y on a shallow arc bowing toward the player
// Seats live on the TABLE IMAGE, not the viewport: equal angular spacing
// along an ellipse concentric with the felt's near rail, constant inset.
// Narrow viewports play the three centre boxes only: seven boxes on a phone
// leaves ~50px each, which cannot hold a chip stack and two cards.
const COMPACT_BOXES = [2, 3, 4];
const compactQuery = matchMedia('(max-width: 860px) and (orientation: portrait)');
let compactSeats = compactQuery.matches;
const playedBoxes = () => (compactSeats ? COMPACT_BOXES : seatEls.map((_, i) => i));

function layoutSeats() {
  const imgEl = document.querySelector('#tableimg');
  const img = imgEl?.getBoundingClientRect();
  const table = document.querySelector('#table2d').getBoundingClientRect();
  if (!img || !img.width) return;
  // compact mode flattens the arc so the centre box's cards stay on the felt
  const CX = 0.5, CY = compactSeats ? 0.17 : 0.13;
  const RX = 0.365, RY = compactSeats ? 0.33 : 0.445;
  const boxes = playedBoxes();
  const span = compactSeats ? 84 : 110;          // degrees of arc the boxes occupy
  const step = span / (boxes.length - 1);
  seatEls.forEach((el, i) => el.classList.toggle('seat-off', !boxes.includes(i)));
  boxes.forEach((i, k) => {
    const phi = (90 + span / 2 - k * step) * Math.PI / 180;
    const fx = CX + RX * Math.cos(phi);
    const fy = CY + RY * Math.sin(phi);
    seatEls[i].style.left = `${img.left + fx * img.width - table.left}px`;
    seatEls[i].style.top = `${img.top + fy * img.height - table.top}px`;
    seatEls[i].querySelector('.seat-inner').style.setProperty('--tang', `${(fx - 0.5) * 61}deg`);
  });
}
layoutSeats();
compactQuery.addEventListener('change', e => {
  compactSeats = e.matches;
  // boxes that just left the table must not keep money on them
  if (!round && !busy) {
    const boxes = playedBoxes();
    bets = bets.map((b, i) => (boxes.includes(i) ? b : { main: 0, pp: 0, tp: 0 }));
    undoStack = undoStack.filter(u => boxes.includes(u.box));
  }
  layoutSeats(); renderBets(); activeBoxHighlight();
});
addEventListener('resize', () => { layoutSeats(); activeBoxHighlight(); });
document.querySelector('#tableimg')?.addEventListener('load', layoutSeats);

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
let allSides = false;
function placeBet(i, field, targetEl) {
  console.info('[bet]', i, field, 'round=', !!round, 'busy=', busy);
  if (round || busy) return;
  // ALL SEATS mode: one click on any side-bet crescent bets it on every staked box
  if (field !== 'main' && allSides && !placeBet.bulk) {
    placeBet.bulk = true;
    for (let j = 0; j < SEATS; j++) {
      if (bets[j].main > 0) placeBet(j, field, seatEls[j].querySelector(field === 'pp' ? '.side.pp' : '.side.tp'));
    }
    placeBet.bulk = false;
    return;
  }
  if (field !== 'main' && bets[i].main === 0) return; // side bets ride on a main bet
  const cap = field === 'main' ? LIMITS.max : LIMITS.max / 2;
  const next = bets[i][field] + selected;
  if (next > cap || betTotal() + selected > balance) return;
  flyChip(selected, targetEl);
  sfx.play('chip');
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
// MAX: scale every staked box up as far as the balance and the table cap
// allow, keeping the boxes' relative sizes. Nothing staked yet -> the centre
// box takes the whole affordable maximum.
$('#max-btn').onclick = () => {
  if (round || busy) return;
  let idx = bets.map((_, i) => i).filter(i => bets[i].main > 0);
  const seed = bets.map(b => ({ ...b }));
  if (!idx.length) { idx = [Math.floor(SEATS / 2)]; seed[idx[0]] = { main: LIMITS.min, pp: 0, tp: 0 }; }
  const unit = idx.reduce((a, i) => a + seed[i].main + seed[i].pp + seed[i].tp, 0);
  if (!unit || balance < LIMITS.min) return;
  // largest scale that keeps the total inside the balance and every box inside its cap
  let k = balance / unit;
  for (const i of idx) {
    if (seed[i].main) k = Math.min(k, LIMITS.max / seed[i].main);
    if (seed[i].pp) k = Math.min(k, (LIMITS.max / 2) / seed[i].pp);
    if (seed[i].tp) k = Math.min(k, (LIMITS.max / 2) / seed[i].tp);
  }
  const snap = (v, cap) => Math.min(cap, Math.floor((v + 1e-9) / LIMITS.min) * LIMITS.min);
  const next = bets.map(b => ({ ...b }));
  for (const i of idx) {
    next[i] = {
      main: snap(seed[i].main * k, LIMITS.max),
      pp: snap(seed[i].pp * k, LIMITS.max / 2),
      tp: snap(seed[i].tp * k, LIMITS.max / 2),
    };
  }
  const total = next.reduce((a, b) => a + b.main + b.pp + b.tp, 0);
  if (!total || total > balance) return;
  if (total === betTotal()) return; // already maxed
  for (const [i, b] of bets.entries()) {
    for (const f of ['main', 'pp', 'tp']) {
      const delta = next[i][f] - b[f];
      if (delta > 0) undoStack.push({ box: i, field: f, value: delta });
    }
  }
  bets = next;
  sfx.play('chip');
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
    else { spot.classList.remove('staked'); spot.innerHTML = '<svg width="24" height="22" viewBox="-11 -12 27 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="-2" cy="-5" r="4.2"/><path d="M -9.5 8 c 1 -4.4 4 -6.8 7.5 -6.8 s 6.5 2.4 7.5 6.8"/><path d="M 8 -6 h 7 M 11.5 -9.5 v 7"/></svg>'; }
    for (const f of ['pp', 'tp']) {
      const arc = seat.querySelector(`.side.${f}`);
      const chip = seat.querySelector(`.${f}-chip`);
      arc.classList.toggle('staked', !!b[f]);
      chip.hidden = !b[f];
      if (b[f]) chip.innerHTML = stackChip(b[f]);
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
  $('#max-btn').disabled = balance < LIMITS.min || !!round || busy;
}

// ---------- demo cashier ----------
let depositAmt = 500;
const setDeposit = amt => {
  depositAmt = amt;
  $('#cashier-pay').textContent = Number.isFinite(amt) && amt >= 1 ? `ADD ${fmt(amt)}` : 'ADD FUNDS';
};
$('#add-funds').onclick = () => { $('#cashier').hidden = false; };
$('#cashier-close').onclick = () => { $('#cashier').hidden = true; };
$('#cashier').onclick = e => { if (e.target.id === 'cashier') $('#cashier').hidden = true; };
document.querySelectorAll('#cashier .amt').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#cashier .amt').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel');
    $('#cc-amount').value = '';
    setDeposit(Number(b.dataset.amt));
  };
});
$('#cc-amount').addEventListener('input', e => {
  e.target.classList.remove('bad');
  document.querySelectorAll('#cashier .amt').forEach(x => x.classList.remove('sel'));
  setDeposit(Math.floor(Number(e.target.value.replace(',', '.'))));
});
function renderCurrency() {
  document.querySelectorAll('#cashier .cur').forEach(b => b.classList.toggle('sel', b.dataset.cur === currency));
  setDeposit(depositAmt);
}
document.querySelectorAll('#cashier .cur').forEach(b => {
  b.onclick = async () => {
    if (b.dataset.cur === currency || round || busy) return;
    try {
      if (player) {
        const out = await api('/api/currency', { id: player.id, currency: b.dataset.cur });
        balance = out.balance; currency = out.currency;
      } else currency = b.dataset.cur;
      renderCurrency(); renderBets();
      toast('CURRENCY', balance, false);
    } catch { /* keep current currency */ }
  };
});
$('#cc-num').addEventListener('input', e => {
  e.target.classList.remove('bad');
  const d = e.target.value.replace(/\D/g, '').slice(0, 16);
  e.target.value = d.replace(/(.{4})/g, '$1 ').trim();
});
$('#cashier-pay').onclick = async () => {
  if ($('#cc-num').value.replace(/\D/g, '').length < 12) { $('#cc-num').classList.add('bad'); return; }
  if (!(Number.isFinite(depositAmt) && depositAmt >= 1 && depositAmt <= 100000)) { $('#cc-amount').classList.add('bad'); return; }
  const amt = depositAmt;
  try {
    if (player) balance = (await api('/api/deposit', { id: player.id, amount: amt })).balance;
    else { balance += amt; }
  } catch { balance += amt; }
  ledger('deposit', amt);
  $('#cashier').hidden = true;
  sfx.play('chip');
  toast('FUNDS ADDED', amt, amt >= 5000);
  void veraEvent(`${player?.name ?? 'The player'} just added ${fmt(amt)} at the cashier.`, { minGap: 30000 });
  renderBets();
};

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
  sfx.play('deal');
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
  // center the bar under the hand it controls, caret pointing at the chip
  bar.hidden = false;
  const w = bar.offsetWidth || 190;
  bar.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.x - w / 2))}px`;
  bar.style.top = `${r.y + 84}px`;
}

$('#deal-now').onclick = () => { if (!round && !busy) void dealSequence(); };

async function dealSequence() {
  busy = true;
  document.body.classList.add('in-round');
  balance -= betTotal(); ledger('deal', -betTotal());
  syncBalance('deal');
  round = new Round(bets.map(b => ({ ...b })));
  round.deal();
  renderBets(); setBanner(null); clearTable();
  voice.say('goodluck', { force: true });
  trigger(CLIP.deal);
  await sleep(700);

  const live = round.live();
  const PACE = 320;
  for (let i = live.length - 1; i >= 0; i--) {
    dealCardTo(boxContainer(i), live[i].cards[0]);
    updateBadge(boxContainer(i), live[i].cards.slice(0, 1));
    await sleep(PACE);
  }
  dealCardTo($('#dealer-cards'), round.dealer[0]);
  updateBadge($('#dealer-cards'), [round.dealer[0]]);
  await sleep(PACE);
  for (let i = live.length - 1; i >= 0; i--) {
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
    if (b.sideReturn > 0) {
      sideWin = true;
      el.textContent = `${b.sideLabels.join(' · ')} +${fmt(b.sideReturn)}`;
      const seatEl = seatOfLive(i);
      const r = seatEl.getBoundingClientRect();
      burstAt(r.x, r.y, b.sideReturn >= b.stake * 10);
      const seatNo = seatEls.indexOf(seatEl) + 1;
      toast(`SEAT ${seatNo} · ${b.sideLabels.join(' + ')}`, b.sideReturn, b.sideReturn >= b.stake * 10);
    }
    else el.textContent = 'side lost';
  });
  if (sideWin) { sfx.play('bigwin'); voice.say('sidebet', { force: true }); }

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
    if (btn.dataset.act === 'hit') sfx.play('knock');
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
    if (net > 0) {
      el.textContent = 'WIN ' + fmt(hand.result); el.classList.add('win'); anyWin = true;
      const r = seat.getBoundingClientRect();
      burstAt(r.x, r.y, hand.result >= hand.stake * 2.4);
    }
    else if (net === 0) { el.textContent = 'PUSH'; el.classList.add('push'); anyPush = true; }
    else { el.textContent = 'LOSE'; el.classList.add('lose'); anyLose = true; }
  });
  balance += ret; ledger('settle', ret);
  if (sideRet) { balance += sideRet; ledger('sidebets', sideRet); }
  const totalWin = ret + sideRet;
  const lw = $('#last-win');
  lw.textContent = fmt(totalWin);
  lw.classList.toggle('won', totalWin > 0);
  if (totalWin > 0) toast('TOTAL WIN', totalWin, anyPlayerBJ || totalWin >= 500);
  syncBalance('settle');
  renderBets();
  const dealerTotal = handValue(round.dealer).total;
  const dealerBJ = round.dealer.length === 2 && dealerTotal === 21;
  if (dealerBJ) voice.say('dealerblackjack', { force: true });
  else if (anyPlayerBJ && anyWin) { sfx.play('bigwin'); bjFlash('BLACKJACK'); voice.say('blackjack', { force: true }); }
  else if (dealerTotal > 21) { sfx.play('win'); voice.say('dealerbust', { force: true }); }
  else if (anyWin) { sfx.play('win'); voice.say('win', { force: true }); }
  else if (anyPush && !anyLose) voice.say('push', { force: true });
  else voice.say('lose', { force: true });
  trigger(anyWin ? CLIP.gest : CLIP.headTilt);
  const who = player?.name ?? 'the player';
  if (totalWin > 0) void veraEvent(`Round settled: ${who} collected ${fmt(totalWin)} this round${anyPlayerBJ ? ' including a natural blackjack' : ''}.`);
  else void veraEvent(`Round settled: the house took this one; ${who} won nothing back.`, { minGap: 45000 });
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
  sfx.startAmbience();
  voice.say('greeting', { force: true });
  // personalized follow-up once the generic voice greeting has landed
  setTimeout(() => {
    void veraEvent(`${player?.name ?? 'A player'} just sat down at your table with a balance of ${fmt(balance)}. Greet them by name.`, { minGap: 0 });
  }, 5000);
};

$('#all-sides').onclick = () => {
  allSides = !allSides;
  $('#all-sides').classList.toggle('on', allSides);
};

renderBets();
setBanner('PLEASE PLACE BETS');
void loadPlayer();
