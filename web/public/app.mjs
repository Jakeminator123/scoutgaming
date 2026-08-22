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
let selected = 5;
let bets = [0, 0, 0];
let round = null;
let roundBusy = false;

const chipsEl = $('#chips');
for (const v of CHIPS) {
  const el = document.createElement('div');
  el.className = `chip c${v}` + (v === selected ? ' sel' : '');
  el.textContent = v >= 1000 ? '1K' : v;
  el.onclick = () => { selected = v; chipsEl.querySelectorAll('.chip').forEach(c => c.classList.remove('sel')); el.classList.add('sel'); };
  chipsEl.appendChild(el);
}

document.querySelectorAll('.box .spot').forEach((spot, i) => {
  spot.onclick = () => {
    if (round) return;
    const next = bets[i] + selected;
    if (next > LIMITS.max || totalBet() + selected > balance) return;
    bets[i] = next;
    renderBets();
  };
});
const totalBet = () => bets.reduce((a, b) => a + b, 0);
function renderBets() {
  document.querySelectorAll('.box').forEach((box, i) => {
    box.querySelector('.stake').textContent = bets[i] ? fmt(bets[i]) : '';
  });
  $('#total-bet').textContent = fmt(totalBet());
  $('#balance').textContent = fmt(balance);
  const playable = bets.some(b => b >= LIMITS.min);
  $('#deal-btn').disabled = !playable || !!round;
  $('#clear-btn').disabled = totalBet() === 0 || !!round;
}
$('#clear-btn').onclick = () => { if (!round) { bets = [0, 0, 0]; renderBets(); } };

// ---------- card rendering ----------
function cardEl(card, faceDown = false) {
  const el = document.createElement('div');
  if (faceDown) { el.className = 'card back'; return el; }
  const red = card.s === '♥' || card.s === '♦';
  el.className = 'card' + (red ? ' red' : '');
  el.innerHTML = `<div class="corner">${card.r}<br>${card.s}</div><div class="pip">${card.s}</div>`;
  return el;
}
function totalBadge(cards) {
  const el = document.createElement('div');
  el.className = 'hand-total';
  const { total, soft } = handValue(cards);
  el.textContent = soft && total <= 21 ? `${total - 10}/${total}` : total;
  return el;
}
function renderHands(revealHole) {
  const d = $('#dealer-cards'); d.innerHTML = '';
  round.dealer.forEach(c => d.appendChild(cardEl(c)));
  if (!revealHole && round.dealer.length === 1) d.appendChild(cardEl(null, true));
  if (round.dealer.length > 1 || revealHole) d.appendChild(totalBadge(round.dealer));
  const live = round.live();
  document.querySelectorAll('.box').forEach((box, i) => {
    const cardsBox = box.querySelector('.cards'); cardsBox.innerHTML = '';
    if (!bets[i]) return;
    const hand = live[bets.slice(0, i).filter(Boolean).length]; // live() keeps order of staked boxes
    if (!hand || !hand.cards.length) return;
    hand.cards.forEach(c => cardsBox.appendChild(cardEl(c)));
    cardsBox.appendChild(totalBadge(hand.cards));
  });
}

// ---------- round flow ----------
function setBanner(text) { const b = $('#banner'); if (!text) b.classList.add('hidden'); else { b.classList.remove('hidden'); b.textContent = text; } }
function activeBoxHighlight() {
  document.querySelectorAll('.box').forEach(b => b.classList.remove('active'));
  if (!round || round.phase !== 'decisions') return;
  const liveIdx = round.active;
  let n = -1;
  document.querySelectorAll('.box').forEach((box, i) => {
    if (bets[i]) { n++; if (n === liveIdx) box.classList.add('active'); }
  });
}
function showActions() {
  const legal = round.legal();
  $('#actions').hidden = legal.length === 0;
  document.querySelectorAll('#actions button').forEach(b => { b.disabled = !legal.includes(b.dataset.act); });
}

$('#deal-btn').onclick = async () => {
  if (round || roundBusy) return;
  roundBusy = true;
  balance -= totalBet();
  round = new Round(bets);
  renderBets(); setBanner(null);
  document.querySelectorAll('.result').forEach(r => { r.textContent = ''; r.className = 'result'; });
  trigger(CLIP.deal);
  round.deal();
  // staged reveal for drama
  renderHands(false);
  await sleep(700);
  trigger(CLIP.dealWatch);
  if (round.phase === 'insurance') { $('#insurance').hidden = false; roundBusy = false; return; }
  continueAfterDeal();
};

$('#ins-yes').onclick = () => resolveIns(true);
$('#ins-no').onclick = () => resolveIns(false);
function resolveIns(yes) {
  $('#insurance').hidden = true;
  if (yes) {
    const cost = round.live().reduce((a, b) => a + b.stake / 2, 0);
    balance -= cost; renderBets();
  }
  round.resolveInsurance(round.live().map(() => yes));
  continueAfterDeal();
}

function continueAfterDeal() {
  renderHands(false);
  if (round.phase === 'settled') { finish(); return; }
  activeBoxHighlight(); showActions();
  if (round.phase === 'decisions') trigger(CLIP.think);
}

document.querySelectorAll('#actions button').forEach(btn => {
  btn.onclick = async () => {
    if (!round || round.phase !== 'decisions') return;
    if (btn.dataset.act === 'double') balance -= round.live()[round.active].stake; // engine doubles the stake; the added amount equals the original
    round.act(btn.dataset.act);
    renderHands(false); activeBoxHighlight();
    if (round.phase === 'decisions') { showActions(); trigger(CLIP.think); }
    else if (round.phase === 'settled' || round.phase === 'dealer') {
      $('#actions').hidden = true;
      trigger(CLIP.dealWatch);
      await sleep(500);
      renderHands(true);
      finish();
    }
    renderBets();
  };
});

function finish() {
  renderHands(true);
  $('#actions').hidden = true;
  activeBoxHighlight();
  const live = round.live();
  let ret = 0, anyWin = false;
  let n = -1;
  document.querySelectorAll('.box').forEach((box, i) => {
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
  balance += ret;
  trigger(anyWin ? CLIP.gest : CLIP.headTilt);
  setTimeout(() => {
    round = null; roundBusy = false;
    bets = [0, 0, 0];
    document.querySelectorAll('.cards').forEach(c => c.innerHTML = '');
    document.querySelectorAll('.result').forEach(r => { r.textContent = ''; r.className = 'result'; });
    renderBets(); setBanner('PLEASE PLACE BETS');
  }, 3800);
  renderBets();
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
  setTimeout(() => { if (!round) setBanner('PLEASE PLACE BETS'); else setBanner(null); }, 4000);
}

renderBets();
setBanner('PLEASE PLACE BETS');
