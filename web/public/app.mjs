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
const engine = new DealerEngine($('#dealer'), 'dealer', {
  log: m => console.info('[dealer]', m),
  handsCanvas: $('#dealer-hands'),
});
let engineUp = false;
let speaking = false;
// Speaking clips with their real lengths. Cutting between different clips
// mid-sentence reads as a jump cut, so one clip is chosen to cover the whole
// line - the closest length at or above the audio - and held for its duration.
const SPEAK_POOL = [
  ['idle-1/speak/greeting', 6.04], ['idle-1/speak/dealerbust', 5.04],
  ['idle-1/speak/insurance', 5.04], ['idle-1/speak/lose', 5.04],
  ['idle-1/speak/goodluck', 4.04], ['idle-1/speak/win', 4.04],
  ['idle-1/speak/push', 4.04], ['idle-1/speak/blackjack', 4.04],
];
let heldSpeakClip = null;
function clipForDuration(secs) {
  const avail = SPEAK_POOL.filter(([k]) => engine.index?.clips?.[k]);
  if (!avail.length) return null;
  const covering = avail.filter(([, d]) => d >= secs).sort((a, b) => a[1] - b[1]);
  return (covering[0] ?? avail.sort((a, b) => b[1] - a[1])[0])[0];
}
const someSpeakClip = () => heldSpeakClip ?? clipForDuration(5);
engine.onIdlePick = () => {
  if (speaking) {
    // the decoder reaches this boundary ~1s before paint: only replay the
    // speak clip while the voice still has that much runway, else a whole
    // silent playthrough gets queued before the audio-end handler can act
    const rem = bankAudio && !bankAudio.ended && bankAudio.duration
      ? bankAudio.duration - bankAudio.currentTime : 0;
    const c = someSpeakClip();
    if (c && rem > 1.2) return c;
    return CLIP.idle;
  }
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
// ---------- global speech gate ----------
// One voice, one caption, one mouth at a time. Every speaker (game-flow
// lines, chat takes, chat commentary) runs as a queued turn; without this
// they overlap at round settle and the captions stomp each other.
let speechActive = 0;
let speechChain = Promise.resolve();
function speechTurn(fn) {
  speechActive++;
  const run = speechChain.then(() => Promise.resolve(fn())).catch(() => {}).finally(() => { speechActive--; });
  speechChain = run;
  return run;
}

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
    if (speechActive > 0 && !force) return;   // something's talking: drop optional chatter
    speechTurn(() => new Promise(resolve => {
      if (this.muted) return resolve();
      this.playing = true;
      const cap = $('#caption');
      cap.textContent = LINES[t] ?? '';
      cap.classList.add('show');
      const done = () => { this.playing = false; cap.classList.remove('show'); resolve(); };
      // lip-synced speaking clip when we have one: same synced path as chat
      // lines - painted-frame wait + this clip's measured voice delay
      const speakClip = `idle-1/speak/${t}`;
      if (engineUp && engine.index.clips[speakClip]) {
        // only cut back to idle if her take is still on screen and no round is
        // running - mid-round the game logic owns the video
        const stop = () => { done(); speaking = false; heldSpeakClip = null; if (engineUp && engine.presentedClip === speakClip && !busy) engine.interrupt(CLIP.idle); };
        a.onended = stop; a.onerror = stop;
        bankAudio?.pause(); bankAudio = a;      // the boundary guard watches this
        (async () => {
          try { await cutToTake(speakClip); a.currentTime = 0; await a.play(); }
          catch { stop(); }
        })();
        setTimeout(() => { if (this.playing) stop(); }, 15000); // safety
      } else {
        a.currentTime = 0;
        a.play().catch(() => {});
        if (Math.random() < 0.6) trigger(Math.random() < 0.5 ? CLIP.gest : CLIP.headTilt);
        a.onended = done;
        setTimeout(done, 8000); // safety
      }
    }));
  },
};
voice.load();
const soundBtn = $('#sound-btn');
const renderSound = () => { soundBtn.classList.toggle('muted', voice.muted); soundBtn.textContent = voice.muted ? '🔇' : '🔊'; };
soundBtn.onclick = () => {
  if (!voice.muted) { bankAudio?.pause(); speaking = false; }
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
  // The room tone kept dying: autoplay can refuse it before the first gesture,
  // a hidden tab or another app taking audio focus pauses it, and nothing ever
  // restarted it. Nudge it back on any gesture and whenever the tab returns.
  keepAmbience() {
    const a = this.files.ambience;
    if (!a || voice.muted) return;
    if (a.paused || a.ended) { a.currentTime = a.currentTime || 0; a.play().catch(() => {}); }
  },
};
sfx.load();
for (const ev of ['pointerdown', 'keydown', 'visibilitychange']) {
  document.addEventListener(ev, () => { if (!document.hidden) sfx.keepAmbience(); }, { passive: true });
}
setInterval(() => { if (!document.hidden) sfx.keepAmbience(); }, 4000);
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

// hint(): one short transient line explaining what a control just did (or why
// it stopped). Cheaper than a toast and it never covers the felt.
let hintTimer = null;
function hint(tag, text) {
  let el = document.querySelector('#hint');
  if (!el) { el = document.createElement('div'); el.id = 'hint'; document.body.appendChild(el); }
  el.innerHTML = `<b>${tag}</b><span>${text}</span>`;
  el.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// Round summary: what went in, what came back, per box and in total. The seat
// badges alone were ambiguous - a badge reading "WIN $100" on a $50 stake is a
// $50 profit, not a $100 one - so the money is spelled out here.
function showSettlement(rows, staked, back) {
  if (!rows.length) return;
  let el = document.querySelector('#settlement');
  if (!el) { el = document.createElement('div'); el.id = 'settlement'; document.body.appendChild(el); }
  const net = back - staked;
  const line = r => {
    const parts = [`<span class="s-box">BOX ${r.box + 1}</span>`,
                   `<span class="s-stake">${fmt(r.stake)}</span>`];
    parts.push('<span class="s-side"></span>');   // sides get their own row below
    const mainCls = r.outcome === 'win' ? 'up' : r.outcome === 'push' ? 'flat' : 'down';
    const label = r.outcome === 'push' ? 'push' : (r.net > 0 ? '+' : '') + fmt(r.net);
    parts.push(`<span class="s-net ${mainCls}">${label}</span>`);
    return `<div class="s-row">${parts.join('')}</div>`;
  };
  const sideRows = rows.filter(r => r.sides).map(r =>
    `<div class="s-row sub"><span class="s-box">side ${r.box + 1}</span><span class="s-stake">${fmt(r.sides)}</span><span class="s-side"></span>` +
    `<span class="s-net ${r.sideNet > 0 ? 'up' : 'down'}">${r.sideNet > 0 ? '+' : ''}${fmt(r.sideNet)}</span></div>`).join('');
  el.innerHTML = `
    <div class="s-head"><b>ROUND</b><span>staked ${fmt(staked)} &middot; returned ${fmt(back)}</span></div>
    ${rows.map(line).join('')}${sideRows}
    <div class="s-row total"><span class="s-box">NET</span><span class="s-stake"></span><span class="s-side"></span>
      <span class="s-net ${net > 0 ? 'up' : net === 0 ? 'flat' : 'down'}">${net > 0 ? '+' : ''}${fmt(net)}</span></div>`;
  el.classList.add('show');
  clearTimeout(showSettlement.t);
  showSettlement.t = setTimeout(() => el.classList.remove('show'), 7000);
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
// Table tiers. Picking a table sets both the limits and the chip ladder, so a
// VIP box is bet in 250K chips rather than 250 clicks of a 1K chip.
const TABLES = [
  { id: 'classic', name: 'CLASSIC',     min: 5,    max: 2000,      chips: [1, 5, 10, 25, 50, 100, 500, 1000] },
  { id: 'high',    name: 'HIGH ROLLER', min: 100,  max: 50000,     chips: [25, 100, 500, 1000, 5000, 10000, 25000] },
  { id: 'vip',     name: 'VIP SALON',   min: 1000, max: 1000000,   chips: [500, 1000, 5000, 25000, 100000, 250000, 500000] },
];
let table = TABLES[0];
let CHIPS = table.chips;
const LIMITS = { get min() { return table.min; }, get max() { return table.max; } };
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
    if (reply) speechTurn(() => new Promise(res => {
      showCaption(reply); speakFor(reply);
      setTimeout(res, Math.min(9000, 1200 + reply.length * 55));
    }));
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
      <g class="arc-g">
        <path class="side pp" d="M -26.9 -26.9 A 38 38 0 0 0 -26.9 26.9 L -36.8 36.8 A 52 52 0 0 1 -36.8 -36.8 Z"><title>Perfect Pairs — needs a main bet</title></path>
        <path class="side tp" d="M 26.9 -26.9 A 38 38 0 0 1 26.9 26.9 L 36.8 36.8 A 52 52 0 0 0 36.8 -36.8 Z"><title>21+3 — needs a main bet</title></path>
      </g>
      <g class="label-g">
        <text class="side-label pp-label" x="-45" y="0" text-anchor="middle" dominant-baseline="middle">PP</text>
        <text class="side-label tp-label" x="45" y="0" text-anchor="middle" dominant-baseline="middle">21+3</text>
      </g>
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
  const num = (name, fb) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)); return Number.isFinite(v) ? v : fb; };
  const CX = num('--arc-cx', 0.5), CY = num('--arc-cy', compactSeats ? 0.17 : 0.13);
  const RX = num('--arc-rx', 0.365), RY = num('--arc-ry', compactSeats ? 0.33 : 0.445);
  const boxes = playedBoxes();
  const span = num('--arc-span', compactSeats ? 84 : 110);   // degrees of arc the boxes occupy
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
// chip colours cycle through the eight painted denominations, so a VIP ladder
// still reads as a normal rack instead of eight identical discs
const CHIP_SKINS = [1, 5, 10, 25, 50, 100, 500, 1000];
let chipSkin = new Map();
function buildChips() {
  chipsEl.innerHTML = '';
  chipSkin = new Map(CHIPS.map((v, i) => [v, CHIP_SKINS[i % CHIP_SKINS.length]]));
  if (!CHIPS.includes(selected)) selected = CHIPS[0];
  for (const v of CHIPS) {
    const el = document.createElement('div');
    el.className = `chip c${chipSkin.get(v)}` + (v === selected ? ' sel' : '');
    el.textContent = chipFace(v);
    el.dataset.v = v;
    el.onclick = () => {
      selected = v;
      chipsEl.querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
      el.classList.add('sel');
    };
    chipsEl.appendChild(el);
  }
}
const chipClassFor = v => `c${chipSkin.get([...CHIPS].reverse().find(c => c <= v) ?? CHIPS[0]) ?? 1}`;

function flyChip(value, targetEl) {
  const src = chipsEl.querySelector(`.chip[data-v="${value}"]`) ?? chipsEl.firstChild;
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
  if (next > cap) { hint('LIMIT', `${field === 'main' ? 'box' : 'side bet'} caps at ${fmt(cap)}`); return; }
  if (betTotal() + selected > balance) { hint('BALANCE', `${fmt(selected)} more than you have — add funds`); return; }
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
// MAX: fill the boxes you have chosen with the chip you have selected, as many
// as fit inside the table cap and your balance. The chip sets the granularity
// (pick 1K and boxes fill in 1K steps), and the hint says what stopped it so
// the button never looks like it did nothing.
$('#max-btn').onclick = () => {
  if (round || busy) return;
  const step = selected;
  const perBox = Math.floor(LIMITS.max / step) * step;   // biggest whole-chip stack inside the cap
  let idx = bets.map((_, i) => i).filter(i => bets[i].main > 0);
  if (!idx.length) idx = [playedBoxes()[Math.floor(playedBoxes().length / 2)]];  // none chosen -> centre box
  if (!perBox) { hint('MAX', `${fmt(step)} chip is over this table's ${fmt(LIMITS.max)} cap`); return; }
  if (balance < step) { hint('MAX', `balance is under one ${fmt(step)} chip — add funds`); return; }

  const next = bets.map(b => ({ ...b }));
  for (const i of idx) next[i].main = 0;                 // recompute the maximum from scratch
  let total = next.reduce((a, b) => a + b.main + b.pp + b.tp, 0);

  // round-robin so several chosen boxes fill evenly rather than front to back
  let stop = null, moved = true;
  while (moved) {
    moved = false;
    for (const i of idx) {
      if (next[i].main + step > perBox) { stop = stop ?? 'table'; continue; }
      if (total + step > balance) { stop = 'balance'; continue; }
      next[i].main += step; total += step; moved = true;
    }
  }

  const before = betTotal();
  bets = next;
  for (const [i, b] of bets.entries()) {
    const delta = b.main - (idx.includes(i) ? 0 : b.main);
    if (idx.includes(i) && b.main) undoStack.push({ box: i, field: 'main', value: b.main });
  }
  if (betTotal() !== before) sfx.play('chip');
  hint('MAX', stop === 'balance' ? 'all in — balance spent'
     : stop === 'table' ? `table cap ${fmt(LIMITS.max)} a box`
     : `${fmt(betTotal())} staked`);
  renderBets();
};

$('#clear-btn').onclick = () => {
  if (round || busy) return;
  bets = bets.map(() => ({ main: 0, pp: 0, tp: 0 }));
  undoStack = [];
  renderBets();
};

const chipFace = v => v >= 1e6 ? (v / 1e6) + 'M' : v >= 1000 ? (v / 1000) + 'K' : String(v);
// A bet is shown as the chips it is actually made of: break it into
// denominations from the current rack, biggest at the bottom, so adding money
// visibly grows the stack instead of just changing a number on one disc.
function chipBreakdown(total) {
  const out = [];
  let left = Math.round(total * 100) / 100;
  for (const d of [...CHIPS].sort((a, b) => b - a)) {
    while (left >= d - 1e-9 && out.length < 9) { out.push(d); left = Math.round((left - d) * 100) / 100; }
  }
  if (left > 0 && out.length < 9) out.push(CHIPS[0]);   // remainder under the smallest chip
  return out;
}
function stackChip(v) {
  const chips = chipBreakdown(v);
  if (!chips.length) return '';
  const discs = chips.map((d, i) => `<i class="c${chipSkin.get(d) ?? 1}" style="--n:${i}"></i>`).join('');
  return `<div class="chipstack" style="--h:${chips.length}">${discs}<b>${chipFace(v)}</b></div>`;
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
$('#add-funds').onclick = () => { refreshCashierAmounts(); $('#cashier').hidden = false; };
$('#cashier-close').onclick = () => { $('#cashier').hidden = true; };
$('#cashier').onclick = e => { if (e.target.id === 'cashier') $('#cashier').hidden = true; };
// deposit presets scale with the table: a VIP box cannot be funded $500 at a time
function refreshCashierAmounts() {
  const base = table.max;
  const presets = [base / 2, base * 2, base * 10, base * 50].map(v => Math.max(100, Math.round(v / 100) * 100));
  document.querySelectorAll('#cashier .amt').forEach((b, i) => {
    b.dataset.amt = presets[i];
    b.textContent = chipFace(presets[i]);
  });
  const sel = document.querySelector('#cashier .amt.sel') ?? document.querySelector('#cashier .amt');
  document.querySelectorAll('#cashier .amt').forEach(x => x.classList.remove('sel'));
  sel.classList.add('sel');
  depositAmt = Number(sel.dataset.amt);
  $('#cashier-pay').textContent = `ADD ${fmt(depositAmt)}`;
}

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
  const depositCap = Math.max(100000, table.max * 100);   // must be able to fund the table you chose
  if (!(Number.isFinite(depositAmt) && depositAmt >= 1 && depositAmt <= depositCap)) {
    $('#cc-amount').classList.add('bad');
    hint('CASHIER', `deposits up to ${fmt(depositCap)}`);
    return;
  }
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
  // the badge is parented OUTSIDE the cards container: inside it, it inherited
  // the hand's rotation and flattening and drifted whenever the hand was posed
  const isSub = container.classList?.contains('subhand');
  const host = isSub ? container.closest('.seat-inner') ?? container.parentNode.parentNode : container.parentNode;
  const key = isSub ? container.dataset.h : '';
  let badge = host.querySelector(`:scope > .hand-total[data-h="${key}"]`);
  if (!cards.length) { badge?.remove(); return; }
  if (!badge) { badge = document.createElement('div'); badge.className = 'hand-total'; badge.dataset.h = key; }
  if (isSub) badge.style.setProperty('--badge-x', container.style.getPropertyValue('--shx') || '0px');
  host.appendChild(badge);
  badge.style.setProperty('--cn', Math.max(0, container.querySelectorAll('.card').length - 1));
  const { total, soft } = handValue(cards);
  badge.textContent = soft && total <= 21 ? `${total - 10}/${total}` : String(total);
}
function seatOfLive(liveIdx) {
  // hands carry .box = the SEAT index (the engine is handed all seven boxes);
  // live indices shift when a box splits, so the seat must come from the box
  const boxIdx = round?.live()?.[liveIdx]?.box;
  if (boxIdx !== undefined) return seatEls[boxIdx] ?? null;
  let n = -1;
  for (let i = 0; i < SEATS; i++) if (bets[i].main) { n++; if (n === liveIdx) return seatEls[i]; }
  return null;
}
function boxContainer(liveIdx) {
  const seat = seatOfLive(liveIdx);
  if (!seat || !round) return seat?.querySelector('.cards') ?? null;
  const hand = round.live()[liveIdx];
  const sibs = round.live().filter(h => h.box === hand.box);
  const cardsEl = seat.querySelector('.cards');
  if (sibs.length === 1) return cardsEl;
  return subhandEl(cardsEl, sibs.indexOf(hand), sibs.length);
}
// a split box shows its hands side by side: each hand gets its own fan,
// offset around the seat centre
function subhandEl(cardsEl, k, count) {
  let sub = cardsEl.querySelector(`:scope > .subhand[data-h="${k}"]`);
  if (!sub) { sub = document.createElement('div'); sub.className = 'subhand'; sub.dataset.h = k; cardsEl.appendChild(sub); }
  const shift = (k - (count - 1) / 2) * 84;
  sub.style.setProperty('--shx', `${shift}px`);
  return sub;
}
// rebuild one box's card DOM from round state (used right after a split: the
// dealer visibly separates the pair into two fans)
function renderBoxHands(boxIdx) {
  const hands = round.live().filter(h => h.box === boxIdx);
  const firstLive = round.live().findIndex(h => h.box === boxIdx);
  const seat = seatOfLive(firstLive);
  if (!seat) return;
  const cardsEl = seat.querySelector('.cards');
  cardsEl.innerHTML = '';
  seat.querySelectorAll('.hand-total').forEach(b => b.remove());
  hands.forEach((hand, k) => {
    const cont = hands.length === 1 ? cardsEl : subhandEl(cardsEl, k, hands.length);
    hand.cards.forEach((card, ci) => {
      const el = cardEl(card, false);
      el.style.setProperty('--ci', ci);
      cont.appendChild(el);
    });
    updateBadge(cont, hand.cards);
  });
}
function dealCardTo(container, card, { faceDown = false } = {}) {
  sfx.play('deal');
  const el = cardEl(card, faceDown);
  const n = container.querySelectorAll('.card').length;
  el.style.setProperty('--ci', n);
  // squeeze the fan once a hand runs long, so it stays over its own box
  const total = n + 1;
  container.style.setProperty('--cn', total);
  container.style.setProperty('--fan', Math.min(1, 3.2 / Math.max(2, total)).toFixed(3));
  container.appendChild(el);
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
  document.querySelectorAll('.hand-total').forEach(b => b.remove());
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
      ((b.dataset.act === 'double' || b.dataset.act === 'split') && balance < stake);
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
  // let "Bets are closed" land before the first card flies — the cards were
  // beating her to it, which read as the line arriving late ("good luck"
  // rides over the first cards, like a real table)
  await sleep(2000);

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
    if (btn.dataset.act === 'split') {
      if (balance < hand.stake) return;
      balance -= hand.stake; ledger('split', -hand.stake);
      sfx.play('chip');
    }
    document.querySelectorAll('#actions button').forEach(b => { b.disabled = true; });
    if (btn.dataset.act === 'hit') sfx.play('knock');
    round.act(btn.dataset.act);
    if (btn.dataset.act === 'split') { renderBoxHands(hand.box); syncBalance('split'); }
    else if (hand.cards.length > before) {
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
  const rows = [];
  seatEls.forEach((seat, i) => {
    const b = bets[i];
    if (!b.main) return;
    n++;
    // a split box settles as the SUM of its hands - live[] can hold several
    // hands per box, and every one of them pays or loses
    const handsHere = live.filter(h => h.box === i);
    let stakeSum = 0, backSum = 0, insSum = 0;
    for (const hand of handsHere) {
      ret += hand.result;
      stakeSum += hand.stake; backSum += hand.result; insSum += hand.insured;
      if (hand.splitFrom === null && hand.cards.length === 2 && handValue(hand.cards).total === 21) anyPlayerBJ = true;
    }
    sideRet += handsHere[0]?.sideReturn ?? 0;   // side bets ride the original hand only
    const el = seat.querySelector('.result');
    const net = backSum - stakeSum - insSum;
    // show the NET, signed: "WIN $100" used to mean the total returned, which
    // reads as profit and is not
    const sideNet = (handsHere[0]?.sideReturn ?? 0) - (b.pp + b.tp);
    rows.push({ box: i, stake: stakeSum, sides: b.pp + b.tp, back: backSum, net, sideNet,
                outcome: net > 0 ? 'win' : net === 0 ? 'push' : 'lose' });
    if (net > 0) {
      el.textContent = '+' + fmt(net); el.classList.add('win'); anyWin = true;
      el.title = `staked ${fmt(stakeSum)}, returned ${fmt(backSum)}`;
      const r = seat.getBoundingClientRect();
      burstAt(r.x, r.y, backSum >= stakeSum * 2.4);
    }
    else if (net === 0) { el.textContent = 'PUSH ' + fmt(stakeSum); el.classList.add('push'); anyPush = true; el.title = 'stake returned'; }
    else { el.textContent = fmt(net); el.classList.add('lose'); anyLose = true; el.title = `staked ${fmt(stakeSum)}`; }
  });
  const staked = betTotal();
  balance += ret; ledger('settle', ret);
  if (sideRet) { balance += sideRet; ledger('sidebets', sideRet); }
  const totalWin = ret + sideRet;
  const lw = $('#last-win');
  lw.textContent = fmt(totalWin);
  lw.classList.toggle('won', totalWin > 0);
  showSettlement(rows, staked, totalWin);
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
  // a big collect brings the pit boss over, same as a real floor
  const bigCollect = totalWin >= staked * 4 && totalWin > 0;
  setTimeout(() => supervisorMayLook({ force: bigCollect }), 1200);
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

// ---------- chat: Vera's live brain ----------
// Posts to /chat, which relays to the headless-claude subscription on
// scout-hel1. While her reply is on screen a speak clip runs, so her mouth
// moves for the duration she is "talking" (the baked clips are lip-synced to
// their own recorded lines; arbitrary chat text is mouth-movement, not visemes).
const SPEAK_CLIPS = ['idle-1/speak/greeting', 'idle-1/speak/goodluck', 'idle-1/speak/win', 'idle-1/speak/push'];
let chatHistory = [];
let chatBusy = false;

function chatLog(role, text, pending = false) {
  const panel = $('#chat-log');
  const row = document.createElement('div');
  row.className = `msg ${role}` + (pending ? ' pending' : '');
  row.innerHTML = `<b>${role === 'user' ? (player?.name ?? 'You') : 'Vera'}</b><p>${text}</p>`;
  panel.appendChild(row);
  panel.classList.add('open');
  panel.scrollTop = panel.scrollHeight;
  while (panel.children.length > 24) panel.firstChild.remove();
  clearTimeout(chatLog.t);
  chatLog.t = setTimeout(() => panel.classList.remove('open'), 26000);
  return row;
}

// Vera only ever speaks in her OWN voice. Every spoken line is a recorded
// Vera take (dealer/audio/en/*.mp3); the brain picks which one fits, and
// anything off-book is shown as text without a voice. A synthetic system
// voice would break the illusion worse than staying quiet.
const VERA_BANK_URL = 'dealer/audio/en';
let veraBank = {};
fetch(`${VERA_BANK_URL}/bank.json`).then(r => r.ok ? r.json() : {}).then(b => { veraBank = b; }).catch(() => {});

let bankAudio = null;
// The one synced way to cut to a recorded take. Sync order matters: the VIDEO
// leads. Fetch and decode first, wait for the clip's first frame to be
// PAINTED (the engine buffers up to 24 frames between decode and paint), then
// wait that clip's measured voice delay. Only after all that may audio start.
async function cutToTake(clip) {
  await engine.fetchClip(clip).catch(() => {});
  speaking = true;
  heldSpeakClip = clip;
  const painted = new Promise(resolve => {
    const t0 = performance.now();
    const prev = engine.onPresentClip;
    const done = () => { engine.onPresentClip = prev; resolve(); };
    engine.onPresentClip = k => { prev?.(k); if (k === clip) done(); };
    const poll = () => {
      if (engine.presentedClip === clip) return done();
      if (performance.now() - t0 > 3000) return done();   // never hang the voice
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
  engine.interrupt(clip);
  await painted;
  // per-clip measured delay (pipeline/apply-lipsync.py); CSS var is the fallback
  const lead = engine.index?.clips?.[clip]?.audioDelayMs
    ?? (Number(getComputedStyle(document.documentElement).getPropertyValue('--lipsync-offset')) || 0);
  if (lead > 0) await new Promise(r => setTimeout(r, lead));
}

function sayLine(id) {
  const line = veraBank[id];
  if (!line) return false;
  if (voice.muted) { showCaption(line.text, Math.min(13000, 3500 + line.text.length * 70)); return true; }
  speechTurn(() => new Promise(resolveTurn => {
  showCaption(line.text, Math.min(13000, 3500 + line.text.length * 70));

  // A line has its OWN clip when one was baked from that exact audio; those are
  // lip-synced to the words. Otherwise fall back to a generic speaking clip.
  const own = `idle-1/speak/${id}`;
  const clip = engine.index?.clips?.[own] ? own : null;

  // interrupt, don't queue: a queued idle waits for the next clip boundary,
  // which after a replay is a full clip away (the crossfade hides the cut)
  const stop = () => { speaking = false; heldSpeakClip = null; if (engineUp) engine.interrupt(CLIP.idle); else trigger(CLIP.idle); resolveTurn(); };
  setTimeout(stop, 20000);  // safety: a turn must always end

  const startAudio = () => {
    try {
      bankAudio?.pause();
      bankAudio = new Audio(`${VERA_BANK_URL}/${id}.mp3`);
      bankAudio.volume = 0.95;
      bankAudio.onended = stop;
      bankAudio.onerror = stop;
      bankAudio.play().catch(stop);
    } catch { stop(); }
  };

  (async () => {
    try {
      if (!clip) {                       // no matching clip: mouth movement only
        heldSpeakClip = clipForDuration(5);
        speaking = true;
        if (heldSpeakClip) engine.interrupt(heldSpeakClip); else trigger(CLIP.gest);
        startAudio();
        return;
      }
      await cutToTake(clip);
      startAudio();
    } catch { stop(); }
  })();
  }));
  return true;
}

function speakFor(text) {
  // free text has no recorded take and no audio - a talking mouth with no
  // sound reads as broken, so she considers instead: think/gesture clips
  // while the caption carries the words
  const clip = [CLIP.think, CLIP.gest, CLIP.headTilt].find(k => engine.index?.clips?.[k]);
  if (!clip) { trigger(CLIP.gest); return; }
  engine.interrupt?.(clip);
  const ms = Math.min(9000, 1200 + text.length * 55);
  clearTimeout(speakFor.t);
  speakFor.t = setTimeout(() => trigger(CLIP.idle), ms);
}

$('#chat-send').onclick = sendChat;
$('#chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

async function sendChat() {
  const input = $('#chat-input');
  const message = input.value.trim();
  if (!message || chatBusy) return;
  input.value = '';
  chatBusy = true;
  chatLog('user', message);
  const pending = chatLog('vera', '<i>thinking…</i>', true);
  try {
    const r = await fetch('/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: chatHistory.slice(-12) }),
    });
    const { reply, say } = await r.json();
    if (reply || say) {
      pending.classList.remove('pending');
      // when she has a recorded take for this, the spoken words and the words
      // on screen are the same line - never a voice saying something else
      const spoken = say && veraBank[say] ? veraBank[say].text : null;
      const shown = spoken ?? reply;
      pending.querySelector('p').textContent = shown;
      chatHistory.push({ role: 'user', text: message }, { role: 'vera', text: shown });
      if (spoken) sayLine(say);
      else speechTurn(() => new Promise(res => {
        showCaption(shown, Math.min(13000, 3500 + shown.length * 70)); speakFor(shown);
        setTimeout(res, Math.min(9000, 1200 + shown.length * 55));
      }));
    } else {
      pending.querySelector('p').textContent = 'I have lost my earpiece for a moment — try me again.';
      pending.classList.remove('pending');
    }
  } catch {
    pending.querySelector('p').textContent = 'I have lost my earpiece for a moment — try me again.';
    pending.classList.remove('pending');
  } finally { chatBusy = false; }
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

function setTable(id) {
  const next = TABLES.find(x => x.id === id);
  if (!next || next === table || round || busy) return;
  table = next; CHIPS = table.chips;
  bets = bets.map(() => ({ main: 0, pp: 0, tp: 0 }));   // old stakes are off-limits here
  undoStack = [];
  buildChips();
  document.querySelectorAll('#table-pick .tbl').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  $('#limits').textContent = `${fmt(table.min)} \u2013 ${fmt(table.max)}`;
  hint(table.name, balance < table.min
    ? `min is ${fmt(table.min)} — add funds to play here`
    : `${fmt(table.min)} to ${fmt(table.max)} a box`);
  renderBets();
}
document.querySelectorAll('#table-pick .tbl').forEach(b => { b.onclick = () => setTable(b.dataset.id); });

buildChips();
$('#limits').textContent = `${fmt(table.min)} \u2013 ${fmt(table.max)}`;
// calibration overlay: applies any saved tweaks, then lies dormant until `C`
import('./calibrate.mjs').then(m => { m.applySavedSeats?.(); if (m.applySaved()) layoutSeats(); }).catch(() => {});

// ---------- floor supervisor ----------
// Kevin walks the pit: he looks in between rounds, never mid-hand, on a loose
// schedule plus straight after an unusually large payout - which is exactly
// when a real pit boss appears.
let roundsSinceLook = 0, nextLookAfter = 4 + Math.floor(Math.random() * 4);
const supEl = $('#supervisor');
let supBusy = false;
function supervisorMayLook({ force = false } = {}) {
  if (round || busy || supBusy || !supEl) return false;
  if (!force && ++roundsSinceLook < nextLookAfter) return false;
  roundsSinceLook = 0;
  nextLookAfter = 4 + Math.floor(Math.random() * 4);
  supBusy = true;
  supEl.currentTime = 0;
  supEl.classList.add('show');
  const done = () => {
    supEl.classList.remove('show');
    supBusy = false;
    setTimeout(() => { try { supEl.pause(); } catch { /* ignore */ } }, 600);
  };
  supEl.onended = done;
  clearTimeout(supervisorMayLook.t);
  supervisorMayLook.t = setTimeout(done, 12000);   // safety if 'ended' never fires
  supEl.play().catch(done);
  showCaption(force
    ? 'Floor supervisor checking the table.'
    : 'Floor supervisor on his rounds.', 4200);
  return true;
}

// Call him over on demand. Warm the clip first so the first press does not
// sit on a cold 1.2MB fetch and look like nothing happened.
const pitBtn = $('#pitboss');
if (pitBtn) {
  // the cutout is a normal <video>; preload="auto" already warms it
  pitBtn.onclick = () => {
    if (round || busy) { hint('PIT BOSS', 'he waits for the hand to finish'); return; }
    pitBtn.disabled = true;
    const ok = supervisorMayLook({ force: true });
    if (!ok) hint('PIT BOSS', 'he is already at the table');
    setTimeout(() => { pitBtn.disabled = false; }, 9000);
  };
}

// QA hook: lets a test drive the table without playing 20 rounds first
window.__croupier = { engine, CLIP, supervisorMayLook, supEl, sayLine, veraBank, get round() { return round; } };

renderBets();
setBanner('PLEASE PLACE BETS');
void loadPlayer();
