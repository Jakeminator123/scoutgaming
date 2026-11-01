import {initializePreviewControls,mountPlayerReturn} from './player-entry-controls.mjs';
import {createBlackjackBetControls,CHIPS,LIMITS} from './blackjack-bet-controls.mjs';
import {createBlackjackTableClient} from './blackjack-table-client.mjs';
import {createFilmedActionControls} from './filmed-action-controls.mjs';
import {createPlayerChatController} from './player-chat-controller.mjs';
import {mountDealerPicker} from './dealer-picker.mjs';
import {mountDealerRehearsal} from './dealer-rehearsal.mjs';
import {createOperatorAppearanceBoundary, preserveAppearanceBets, consumeAppearanceBets} from './operator-appearance-boundary.mjs';
import {chatPresentationContext} from './chat-presentation-context.mjs';
import { createLinkedChatSubmit } from './chat-requests.mjs';
import { createStudioPreviewClient, studioPreviewFromDocument } from './studio-preview-client.mjs';
import {createLayerComposition} from '../../../packages/presentation/runtime/presentation-composition.mjs';
import { createGameInterface } from './game-interface.mjs';
import { dealerVersionPath } from './dealer-version-switcher.mjs';
import { createNativeObservation } from './native-observation.mjs';
import { SPEECH_LINES } from '../../../packages/presentation/contracts/speech-lines.mjs';
import { createSpeechQueue } from './speech-queue.mjs';
import { createProbeClient, probePresentationQuiet } from './probe-client.mjs';
import { createDealerChatVisibility, mountDealerVoiceControl } from './dealer-chat-controls.mjs';
import { createSpeechPoseGate } from '../../../packages/presentation/runtime/speech-pose-gate.mjs';
import { chatFailureMessage } from '../../../packages/presentation/contracts/chat-response.mjs';
import { playGeneratedSpeech, loadGeneratedSpeech } from '../../../packages/presentation/runtime/generated-speech-player.mjs';
import { createChatPlaybackDiagnostic } from './chat-playback-diagnostic.mjs';
import { displayChatDecision, cancelChatDecision, playChatDecision as playProductChatDecision } from './chat-decision-player.mjs';
import { createNativeSpeechBridge } from '../../../packages/presentation/runtime/lab-speech-bridge.mjs';
import { createTableAudio } from './table-audio.mjs';
import {gameLaneFromDocument} from '../../../packages/presentation/contracts/game-selection.mjs';
import { applyTableColor, mountPlayerChoices, readChoices, resolvePlayerSelection, writeChoices } from '../../../packages/presentation/runtime/player-choices.mjs';
import { createPresentationStartup } from './presentation-startup.mjs';
import { registeredFilmedProfile, frozenFilmedProfile } from './dealer-filmed-profiles.mjs';
import { handValue } from './blackjack.mjs';
import { sideBetWin, roundWin, announceRound } from './blackjack-feedback.mjs';
import { totalLabel } from './card-presentation/renderer-support.js';
import { cardFaceArt } from './card-art.mjs';
import { createMovingDealPlayback } from './moving-speech-sequence.mjs';

const $ = s => document.querySelector(s);
// Controllers read current document state, including replacements after server commands.
const clientState = {
  get round(){return round;},set round(value){round=value;},
  get busy(){return busy;},set busy(value){busy=value;},
  get bets(){return bets;},set bets(value){bets=value;},
  get selected(){return selected;},set selected(value){selected=value;},
  get balance(){return balance;},set balance(value){balance=value;},
  get undoStack(){return undoStack;},set undoStack(value){undoStack=value;},
  get allSides(){return allSides;},set allSides(value){allSides=value;},
  get seatEls(){return seatEls;},
  get localPresentation(){return localPresentation;},set localPresentation(value){localPresentation=value;},
  get localCards(){return localCards;},set localCards(value){localCards=value;},
  get performancePlayer(){return performancePlayer;},set performancePlayer(value){performancePlayer=value;},
  get speechPoseGate(){return speechPoseGate;},set speechPoseGate(value){speechPoseGate=value;},
  get player(){return player;},set player(value){player=value;},
  get tableVersion(){return tableVersion;},set tableVersion(value){tableVersion=value;},
  get nextDealChat(){return nextDealChat;},set nextDealChat(value){nextDealChat=value;},
  get movingSpeechAvailable(){return movingSpeechAvailable;},set movingSpeechAvailable(value){movingSpeechAvailable=value;},
  get probeClient(){return probeClient;},set probeClient(value){probeClient=value;},
  get observedTableView(){return observedTableView;},set observedTableView(value){observedTableView=value;},
  get activeDealSpeech(){return activeDealSpeech;},set activeDealSpeech(value){activeDealSpeech=value;},
  get nextDealControls(){return nextDealControls;},set nextDealControls(value){nextDealControls=value;},
  get chatBusy(){return chatBusy;},set chatBusy(value){chatBusy=value;},
  get chatStatus(){return chatStatus;},set chatStatus(value){chatStatus=value;},
  get chatElapsed(){return chatElapsed;},set chatElapsed(value){chatElapsed=value;},
  get chatHistory(){return chatHistory;},set chatHistory(value){chatHistory=value;},
  get speaking(){return speaking;},set speaking(value){speaking=value;},
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const CURRENCIES = { USD: 'en-US', EUR: 'de-DE', SEK: 'sv-SE' };
let currency = 'USD';
const fmt = n => n.toLocaleString(CURRENCIES[currency], { style: 'currency', currency, minimumFractionDigits: 2 });

// Dealers are supplied by the saved presentation, never by local profiles.
const DEALERS = {};
const presentationStartup = createPresentationStartup({document, dealerId: document.documentElement.dataset.gameDealer});
let entrySelection;
try { entrySelection = gameLaneFromDocument(document.documentElement.dataset); }
catch (error) { presentationStartup.fail(); throw error; }
window.addEventListener('pagehide', () => presentationStartup.close(), {once:true});
const studioPreview = studioPreviewFromDocument(document.documentElement.dataset, location.pathname);
const requestLogin=studioPreview?async()=>{throw Error('Starta provspel från Sammansättning.');}:(await import('./auth-modal.mjs')).requestLogin;
const gameApi = createStudioPreviewClient({context:studioPreview});
const apiFetch = gameApi.request;
const previewSession = await initializePreviewControls({studioPreview,document,gameApi});
const choiceStorage=studioPreview?sessionStorage:localStorage;
const previewSessionId=studioPreview?.sessionId??null;
const soundStorageKey=studioPreview?'croupier.studio-preview.'+studioPreview.sessionId+'.muted':'croupier-muted';
const playableChoices=previewSession&&entrySelection.choices?{...entrySelection.choices,dealers:entrySelection.choices.dealers.filter(id=>previewSession.dealerAvailability.some(row=>row.id===id&&row.playable))}:entrySelection.choices;
mountPlayerReturn({studioPreview,entrySelection,document,gameApi,choiceStorage,previewSessionId,soundStorageKey,location,window});
for (const {id,label} of entrySelection.registeredDealers ?? []) DEALERS[id] = {key:id,name:label,registered:true};
const DEALER = DEALERS[entrySelection.dealer];
if (!DEALER) { presentationStartup.fail(); throw new Error('Dealer is not registered'); }
if (entrySelection.presentation !== 'local') {
  presentationStartup.fail();
  throw new Error('Presentation requires registered cloud media');
}
const localPresentationEnabled = true;
if (entrySelection.lane === 'mobile-phone') document.title = 'Standardsammansättning · Croupier Blackjack';
let localPresentation = null;
let localCards = null;
// The dealer's landings from its locked configuration (frozenFilmedProfile); the code register until it has loaded.
let dealerFilmedProfile = null;
if (localPresentationEnabled) {
  document.documentElement.dataset.presentation = 'local';
  $('#supervisor')?.removeAttribute('src');
  $('#supervisor')?.load();
}
const clientSessionRevision = crypto.randomUUID();
let tableVersion = 0;
let movingSpeechAvailable=false, nextDealChat=null, nextDealControls=null, activeDealSpeech=null;
let speechPoseGate = null;
let probeClient = null;
let idlePresentationSequence = 0;
const nativeObservation = createNativeObservation(studioPreview?{}:{href:location.href,opener:window.opener});
nativeObservation.emit('status', { state: 'attached', dealer: DEALER.key, route: 'published', presentationOwner: localPresentationEnabled ? 'web-local' : 'indexed' });
const layerComposition = createLayerComposition(document,entrySelection.composition);
const playerChoice = entrySelection.choices ? resolvePlayerSelection({
  choices: playableChoices,
  search: location.search,
  stored: readChoices(choiceStorage, entrySelection.operator, previewSessionId),
  branding: entrySelection.branding,
  currentDealer: entrySelection.dealer,
  composition:entrySelection.composition,
}) : null;
if (playerChoice) {
  writeChoices(choiceStorage, entrySelection.operator, playerChoice.nextStored, previewSessionId);
  if (playerChoice.tableColor) applyTableColor(document, playerChoice.tableColor);
  if(playerChoice.backgroundValue)layerComposition?.setBackground(playerChoice.backgroundValue);
  if(playerChoice.tableValue)layerComposition?.setTable(playerChoice.tableValue);
  if (playerChoice.navigateDealer) await presentationStartup.navigate(dealerVersionPath(playerChoice.navigateDealer, 'original', location.search), url => location.replace(url));
}
{
  document.documentElement.dataset.dealer = DEALER.key;
  $('#chat-input')?.setAttribute('placeholder', `Talk to ${DEALER.name}…`);
  const disclosure = document.querySelector('#gate-panel p b');
  if (disclosure) disclosure.textContent = `${DEALER.name} is an AI dealer.`;
}

let performancePlayer=null;
const poseIdentity = () => ({ dealerId: DEALER.key, sessionRevision: clientSessionRevision, roundRevision: String(tableVersion) });
function updatePoseState(next, reason) {
  return speechPoseGate?.updateRendererState({ ...poseIdentity(), ...next }, reason);
}
function presentStandardIdle(source = 'renderer') {
  presentationStartup.ready(DEALER.key);
  if (!speechPoseGate) return;
  const presentationId = `${source}:${++idlePresentationSequence}`;
  updatePoseState({ dealerPose: 'standard-idle' }, 'standard-idle');
  speechPoseGate.presentStandardIdle({ ...poseIdentity(), presentationId });
}

let speaking = false;
const LINES = { ...SPEECH_LINES };
const VOICE_LINES = Object.keys(LINES);
// ---------- global speech gate ----------
// One voice, one caption, one mouth at a time. Every speaker (game-flow
// lines, chat takes, chat commentary) runs as a queued turn; without this
// they overlap at round settle and the captions stomp each other.
const speechQueue = createSpeechQueue({
  canPlay: () => !voice.muted && !document.hidden,
  beforePlay: () => { if(!performancePlayer?.ready)performancePlayer?.cancel(); },
});
const rawSpeechTurn = fn => speechQueue.enqueue(fn);
const speechTurn = fn => rawSpeechTurn(async signal => {
  localPresentation?.state({ speech: true });
  updatePoseState({ dealerPose: 'speech', speechOwner: 'game', idlePresented: null }, 'game-speech-started');
  try { return await fn(signal); }
  finally {
    updatePoseState({ dealerPose: 'unknown', speechOwner: 'none', idlePresented: null }, 'game-speech-completed');
    localPresentation?.state({ speech: false });
  }
});

const voice = {
  muted: choiceStorage.getItem(soundStorageKey) === '1',
  playing: false,
  greeted: false,
  say(t, { force = false } = {}) {
    // Decorative events follow the already selected game outcome even when
    // speech is muted. No background Promise enters the speech/game queues.
    // Living layers react to the same scoped speech event; each layer keeps its own budget.
    for(const layerEvent of ['backgroundEvent','tableEvent'])try{layerComposition?.[layerEvent]?.('speak.'+t,`${clientSessionRevision}:${entrySelection.roomId??entrySelection.lane}:${DEALER.key}:${tableVersion}:${t}`);}catch{}
    if (this.muted || speechQueue.pending > 0 && !force) return;
    return speechTurn(signal => localPresentation?.present({ type: 'speak', line: t }, { signal }));
  },
};
speechPoseGate = createSpeechPoseGate({
  enqueue: rawSpeechTurn,
  holdWhileHidden: localPresentationEnabled,
  initialState: {
    ...poseIdentity(), dealerPose: 'unknown', actionOwner: 'none', speechOwner: 'none', idlePresented: null,
    visible: !document.hidden, muted: voice.muted,
  },
  onDisplay: (decision, job) => displayChatDecision(chatDecisionRuntime(), decision, job),
  onSpeech: async (decision, { signal, job }) => playChatDecision(decision, signal, job.jobId),
  onCancel: (job, reason) => cancelChatDecision(chatDecisionRuntime(), job, reason),
  onTrace: entry => nativeObservation.emit('status', { state: 'chat-pose', ...entry }),
});
if (localPresentationEnabled) {
  try {
    const [{ PerformancePlayer }, { createLocalPresentation }, cardOverlay] = await Promise.all([
      import('./performance-player.mjs'),
      import('./local-presentation.mjs'),
      import('./local-card-overlay.mjs'),
    ]);
    performancePlayer = new PerformancePlayer({ host: $('#scene') });
    localPresentation = await createLocalPresentation({
      player: performancePlayer, host: $('#scene'), dealerId: DEALER.key, entry: entrySelection, transport: gameApi,
      version: () => tableVersion, muted: () => voice.muted, composition: layerComposition,
      idlePhase: () => ['decisions', 'insurance'].includes(round?.phase) ? 'decide' : 'bets',
      receipt: entry => nativeObservation.emit('playback', entry),
      onIdle: () => presentStandardIdle('local-primary-frame'),
      onError: () => presentationStartup.fail(),
      onGestureWait: waiting => presentationStartup.waitForGesture(DEALER.key, waiting),
      onBusy: () => updatePoseState({ dealerPose: 'action', idlePresented: null }, 'local-film-owner'),
    });
    dealerFilmedProfile = frozenFilmedProfile(DEALER.key,{filmedMaterial:localPresentation.filmedMaterial,filmedProfile:localPresentation.filmedProfile});
    localCards = cardOverlay.createLocalCardOverlay($('#scene'),{dealerLabel:DEALER.name,filmedProfile:dealerFilmedProfile});
    localPresentation.start();
    window.addEventListener('pagehide', () => { localCards?.close(); localPresentation.close(); layerComposition?.close(); }, { once: true });
  } catch (error) {
    presentationStartup.fail();
    console.error('[presentation]', error.message);
    const status = document.createElement('div'); status.className = 'local-presentation-status'; status.setAttribute('role', 'status');
    if(error.code==='studio_presentation_idle_package_changed'){ status.textContent=error.message+' '; const reload=document.createElement('button');reload.type='button';reload.textContent='Ladda om';reload.onclick=()=>location.reload();status.append(reload); }
    else status.textContent = 'Lokal video kunde inte startas.';
    $('#scene').append(status);
  }
}
const soundBtn = $('#sound-btn');
const renderSound = () => { soundBtn.classList.toggle('muted', voice.muted); soundBtn.textContent = voice.muted ? '🔇' : '🔊'; soundBtn.setAttribute('aria-label',voice.muted?'Turn sound on':'Mute sound'); };
function setMuted(muted) {
  if (muted) { speechQueue.cancel(); speaking = false; }
  voice.muted = muted; choiceStorage.setItem(soundStorageKey, muted ? '1' : '0'); renderSound();
  updatePoseState({ muted }, muted ? 'muted' : 'unmuted');
  if (muted) { tableAudio.reset(); sfx.stopAmbience(); }
  else { tableAudio.unlock(); sfx.startAmbience(); }
  astridCamera?.refreshPlayback();
}
soundBtn.onclick = () => setMuted(!voice.muted);
const tableAudio=createTableAudio({createContext:()=>new AudioContext(),canPlay:()=>!voice.muted&&!document.hidden,
  onState:state=>{soundBtn.dataset.audioState=state;}});
renderSound();
// Automatic small talk is paused while the core gameplay is being finished.

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
    if (voice.muted || document.hidden) return;
    if (n === 'chip') return synthChip();
    if (n === 'pickup' || n === 'land' || n === 'gather') return synthDeal(n);
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
document.addEventListener('visibilitychange', () => {
  layerComposition?.setBackgroundVisible(!document.hidden);
  updatePoseState({ visible: !document.hidden }, document.hidden ? 'hidden' : 'visible');
  if(document.hidden){speechQueue.cancel();sfx.stopAmbience();tableAudio.reset();}
});
addEventListener('pagehide', () => speechPoseGate?.navigate(), { once: true });
for (const ev of ['pointerdown', 'keydown', 'visibilitychange']) {
  document.addEventListener(ev, () => { if (!document.hidden) {tableAudio.unlock();sfx.keepAmbience();} }, { passive: true });
}
setInterval(() => { if (!document.hidden) sfx.keepAmbience(); }, 4000);
// hover ticks: tiny synth click, no asset needed
let actx = null;
function hoverTick() {
  if (voice.muted) return;
  try {
    actx = tableAudio.context; if (!actx) return;
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
    actx = tableAudio.context; if (!actx) return;
    const t0 = actx.currentTime;
    const f = 3600 + Math.random() * 1400;
    noiseBurst(t0, { dur: 0.045, gain: 0.75, type: 'bandpass', freq: f, q: 2.5, decay: 2.6 });
    noiseBurst(t0 + 0.04 + Math.random() * 0.025, { dur: 0.035, gain: 0.35, type: 'bandpass', freq: f * 0.85, q: 2.5, decay: 2.6 });
  } catch { /* ignore */ }
}
function synthDeal(phase) {
  // card snapped onto felt: short high snap + faint slide
  try {
    actx = tableAudio.context; if (!actx) return;
    const t0 = actx.currentTime;
    if (phase === 'pickup') {
      noiseBurst(t0, { dur: .06, gain: .12, type: 'bandpass', freq: 2400, q: .7, decay: 2 });
    } else if (phase === 'gather') {
      noiseBurst(t0, { dur: .16, gain: .07, type: 'bandpass', freq: 1500, q: .45, decay: 1.4 });
    } else {
      noiseBurst(t0, { dur: .024, gain: .25, type: 'lowpass', freq: 1800, q: .7, decay: 2 });
      noiseBurst(t0, { dur: .04, gain: .08, type: 'bandpass', freq: 3200, q: .8, decay: 3 });
    }
  } catch { /* ignore */ }
}
function synthKnock() {
  // knuckles on the table edge. No pitch sweep and no long tail (that reads as
  // a kick drum): a hard lowpassed contact click plus inharmonic wood modes
  // with <60ms decay, second knock slightly softer and earlier-damped.
  try {
    actx = tableAudio.context; if (!actx) return;
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
    actx = tableAudio.context; if (!actx) return;
    const t0 = actx.currentTime;
    chime(t0, 880, 0.5, 0.28);
    chime(t0 + 0.1, 1174.7, 0.7, 0.28);
  } catch { /* ignore */ }
}
function synthBigWin() {
  // ascending E-major arpeggio with a sparkle on top
  try {
    actx = tableAudio.context; if (!actx) return;
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
  if (!(amount > 0)) return;
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
// The server and partner contract support these Classic limits.
let balance = 1000;

// ---------- player account: server-persisted demo money (PostgreSQL) ----------
let player = null;
const {api,tableCommand,tableError}=createBlackjackTableClient({state:clientState,apiFetch,loadPlayer,DEALER,entrySelection,clientSessionRevision,
  cancelNextDealChat:()=>cancelNextDealChat(),setMovingSpeechAvailable:value=>setMovingSpeechAvailable(value),updatePoseState,nativeObservation,document,setBanner,setChatStatus,renderBets});
async function loadPlayer() {
  try {
    player = await api('/api/player', {  });
    // Identity is resolved from the server's HttpOnly session cookie.
    balance = player.balance; currency = player.currency;
    renderBets(); renderCurrency();
  } catch { /* server db unavailable: play on with the local demo balance */ }
}
function syncBalance() { /* Server table commands now persist the wallet. */ }
let shoeState = null, observedTableView = null;
function showShoe(state) {
  if (!state) return;
  shoeState = state;
  const label = $('#shoe-status');
  if (label) { label.dataset.remaining=state.remaining; label.textContent = state.cutReached ? 'CUT CARD · SHUFFLE AFTER ROUND' : `${state.decks} DECK SHOE`; }
}
function roundView(data) {
  return data && { ...data, live() { return this.hands; }, legal() { return this.legalActions; } };
}
async function ensureLogin(purpose) {
  await tableReady;
  const session=await gameApi.session();
  if((session.authenticated || session.guest) && player)return true;
  player=null;
  if(studioPreview)throw Error('Starta ett nytt provspel från Sammansättning.');
  if(!session.authenticated && !session.guest && !await requestLogin(purpose))return false;
  await prepareTable();return !!player;
}
async function prepareTable() {
  const session=await gameApi.session();
  $('#sign-out').hidden=Boolean(studioPreview)||!session.authenticated;
  if(!session.authenticated && !session.guest){player=null;busy=false;renderBets();return null;}
  const out = await tableCommand('state'); showShoe(out.shoe);
  if (out.round) {
    bets = out.round.boxes.map(b => ({main:b.stake,pp:b.pp,tp:b.tp}));
    round = roundView(out.round); balance = out.balance;
    document.body.classList.add('in-round'); setBanner(null); clearTable();
    [...new Set(round.hands.map(h=>h.box))].forEach(renderBoxHands);
    const dc = $('#dealer-cards');
    round.dealer.forEach((c,i)=>{ const el=cardEl(c); el.style.setProperty('--ci',i); dc.appendChild(el); });
    if (round.dealer.length === 1) { const el=cardEl(null,true); el.style.setProperty('--ci',1); dc.appendChild(el); }
    updateBadge(dc,round.dealer); renderBets();
    localCards?.restore(round);
    if (round.phase === 'insurance') { $('#insurance').hidden=false; busy=false; }
    else if (round.phase === 'settled') { busy=true; await finish(); }
    else { busy=false; activeBoxHighlight(); }
  }
  if (!out.round) { busy=false; renderBets(); }
  return out;
}

function showCaption(text, ms = 6500) {
  const cap = $('#caption');
  cap.textContent = text; cap.classList.add('show');
  clearTimeout(showCaption.t);
  showCaption.t = setTimeout(() => cap.classList.remove('show'), ms);
}
const ledger = (why, delta) => console.info('[ledger]', why, delta, '->', balance);
let selected = 5;
let bets = Array.from({ length: SEATS }, () => ({ main: 0, pp: 0, tp: 0 }));
if (!studioPreview) { try { bets = consumeAppearanceBets(sessionStorage, entrySelection, SEATS) ?? bets; } catch { /* Browser storage can be unavailable; normal startup remains available. */ } }
let undoStack = []; // [{box, field, value}]
let round = null;
let busy = true; // opens after the server table has loaded
const operatorAppearanceBoundary = createOperatorAppearanceBoundary({
  entry:studioPreview ? null : entrySelection,
  request:apiFetch,
  isIdle:()=>!round,
  refresh:revision=>{
    if (!preserveAppearanceBets(sessionStorage,entrySelection,revision,bets)) throw Error('Dina insatsval kunde inte sparas inför omladdning. Inga insatser har skickats.');
    hint('UTSEENDE','Utseendet har uppdaterats. Spelet laddas om före nästa runda.');
    location.reload();
  },
});

const {betTotal,placeBet,doubleBets,startRound,renderControls:renderBetControls}=createBlackjackBetControls({state:clientState,$,hint,fmt,flyChip,sfx,renderBets,ensureLogin,dealSequence,SEATS});
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
  </div><button class="bet-target bet-target-pp" data-bet="pp" aria-label="Perfect Pairs, plats ${i+1}"></button>
    <button class="bet-target bet-target-main" data-bet="main" aria-label="Insats, plats ${i+1}"></button>
    <button class="bet-target bet-target-tp" data-bet="tp" aria-label="21+3, plats ${i+1}"></button>`;
  seatsEl.appendChild(el);
  seatEls.push(el);
}
const gameInterface = createGameInterface({ document, viewport: window, layerComposition, studioPreview, seatEls,
  state: { get round() { return round; }, get balance() { return balance; }, get busy() { return busy; },
    get filmedProfile() { return dealerFilmedProfile ?? registeredFilmedProfile(DEALER.key); },
    get localCards() { return localCards; } }, seatOfLive, activeBoxHighlight });
const { playedBoxes, layoutSeats, layoutDealControl, showActions, scheduleInterfaceLayout } = gameInterface;
gameInterface.start({ startup: presentationStartup, onCompactChange: boxes => {
  // Boxes that just left the table must not keep selected stakes on them.
  if (!round && !busy) {
    bets = bets.map((b, i) => (boxes.includes(i) ? b : { main: 0, pp: 0, tp: 0 }));
    undoStack = undoStack.filter(u => boxes.includes(u.box));
  }
  layoutSeats(); renderBets(); activeBoxHighlight();
} });

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
seatEls.forEach((seat, i) => {
  seat.querySelector('.spot').onclick = e => { console.info('[click-src]', i, 'trusted=', e.isTrusted); placeBet(i, 'main', e.currentTarget); };
  for(const target of seat.querySelectorAll('.bet-target'))target.onclick=e=>placeBet(i,e.currentTarget.dataset.bet,e.currentTarget);
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
$('#double-btn').onclick = doubleBets;
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
  if (!round && !busy) $('#dealer-switch-status').textContent = '';
  seatEls.forEach((seat, i) => {
    const b = round ? {...bets[i],main:round.hands.filter(h=>h.box===i).reduce((sum,h)=>sum+h.stake,0)} : bets[i];
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
  // Splits/doubles change server hand stakes, not the original betting draft.
  $('#total-bet').textContent = fmt(round ? round.hands.reduce((sum,h)=>sum+h.stake+(h.pp??0)+(h.tp??0)+(h.insured??0),0) : betTotal());
  $('#balance').textContent = fmt(balance);
  renderBetControls();
  layoutDealControl();
}

// ---------- demo cashier ----------
let depositAmt = 500;
const setDeposit = amt => {
  depositAmt = amt;
  $('#cashier-pay').textContent = Number.isFinite(amt) && amt >= 1 ? `ADD ${fmt(amt)}` : 'ADD FUNDS';
};
$('#add-funds').onclick = async () => { if(studioPreview)return; try { if(!await ensureLogin('Sign in to add demo funds.'))return; refreshCashierAmounts(); $('#cashier').hidden = false; } catch(e){hint('SIGN IN',e.message);} };
$('#cashier-close').onclick = () => { $('#cashier').hidden = true; };
$('#cashier').onclick = e => { if (e.target.id === 'cashier') $('#cashier').hidden = true; };
// Demo deposit presets use the supported betting limit.
function refreshCashierAmounts() {
  const base = LIMITS.max;
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
    if (studioPreview || b.dataset.cur === currency || round || busy) return;
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
  if(studioPreview)return;
  try {if(!await ensureLogin('Sign in to add demo funds.'))return;}catch(e){hint('SIGN IN',e.message);return;}
  if ($('#cc-num').value.replace(/\D/g, '').length < 12) { $('#cc-num').classList.add('bad'); return; }
  const depositCap = Math.max(100000, LIMITS.max * 100);
  if (!(Number.isFinite(depositAmt) && depositAmt >= 1 && depositAmt <= depositCap)) {
    $('#cc-amount').classList.add('bad');
    hint('CASHIER', `deposits up to ${fmt(depositCap)}`);
    return;
  }
  const amt = depositAmt;
  try {
    balance = (await api('/api/deposit', { amount: amt })).balance;
  } catch(e) {hint('FUNDS NOT ADDED',e.message);return;}
  ledger('deposit', amt);
  $('#cashier').hidden = true;
  sfx.play('chip');
  toast('FUNDS ADDED', amt, amt >= 5000);
  renderBets();
};

// ---------- card rendering ----------
function cardEl(card, faceDown = false) {
  const el = document.createElement('div');
  if(!faceDown){el.dataset.rank=card.r;el.dataset.suit=card.s;}
  if (faceDown) { el.className = 'card back'; return el; }
  const red = card.s === '♥' || card.s === '♦';
  el.className = 'card' + (red ? ' red' : '');
  if(performancePlayer){
    el.style.backgroundImage=`url('${cardFaceArt(card).url}')`;el.style.backgroundSize='100% 100%';
    el.style.backgroundColor='transparent';el.setAttribute('aria-label',`${card.r}${card.s}`);return el;
  }
  el.innerHTML = `<div class="corner">${card.r}<br>${card.s}</div><div class="pip">${card.s}</div>`;
  return el;
}
function flyFromShoe(el, card, faceDown, cardMotion) {
  if (localPresentationEnabled && arguments[3]?.localCompleted) return Promise.resolve();
  const fallback = $('#shoe2d').getBoundingClientRect();
  const origin = { x:fallback.x+fallback.width/2, y:fallback.y+fallback.height/2 };
  const r = el.getBoundingClientRect();
  // Animate a viewport-level card, avoiding seat rotation/perspective changing
  // the meaning of the shoe's screen coordinates.
  const flying = el.cloneNode(true); flying.classList.add('dealing-card');
  Object.assign(flying.style, { left:`${r.x}px`, top:`${r.y}px`, width:`${r.width}px`, height:`${r.height}px` });
  document.body.appendChild(flying); el.style.visibility = 'hidden';
  const dx=origin.x-(r.x+r.width/2), dy=origin.y-(r.y+r.height/2);
  const motion = flying.animate([
    { transform:`translate(${dx}px,${dy}px) rotate(-28deg) scale(.72)` },
    { transform:`translate(${dx*.85}px,${dy*.86}px) rotate(-20deg) scale(.85)`, offset:.22 },
    { transform:'translate(0,0) rotate(0deg) scale(1)' }
  ], { duration:matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 460, easing:'cubic-bezier(.2,.65,.3,1)' });
  return new Promise(resolve => {
    let finished=false;
    const done=()=>{ if(finished)return; finished=true; flying.remove(); el.style.visibility=''; resolve(); };
    motion.onfinish=()=>{if(!finished)sfx.play('land');done();}; motion.oncancel=done;
  });
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
  badge.textContent = totalLabel(cards);
  layoutHandTotals();
}
function layoutHandTotals(){
  const badges=[...document.querySelectorAll('.seat:not(.seat-off) .hand-total')];
  for(const badge of badges)badge.style.setProperty('--badge-clear-y','0px');
  const obstacles=[...document.querySelectorAll('.seat:not(.seat-off) .sidearcs,.seat:not(.seat-off) .card')].map(el=>el.getBoundingClientRect());
  // A split fan can reach beneath a neighbouring seat's side-bet arc. Clear
  // that arc as well as the split's own chip, then keep each total separate.
  for(const parent of new Set(badges.map(b=>b.parentElement))){
    const group=badges.filter(b=>b.parentElement===parent),bounds=group.map(b=>b.getBoundingClientRect());
    const left=Math.min(...bounds.map(r=>r.left)),right=Math.max(...bounds.map(r=>r.right));
    let top=Math.max(...bounds.map(r=>r.top));
    for(const o of obstacles)if(left<o.right+6&&right>o.left-6)top=Math.max(top,o.bottom+8);
    const scale=parent.getBoundingClientRect().width/parent.offsetWidth||1;
    group.forEach((badge,i)=>badge.style.setProperty('--badge-clear-y',`${(top-bounds[i].top)/scale}px`));
    obstacles.push(...group.map(b=>b.getBoundingClientRect()));
  }
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
  let hand = round.live()[liveIdx];
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
  const shift = (k - (count - 1) / 2) * 64;
  sub.style.setProperty('--shx', `${shift}px`);
  return sub;
}
// A split, paced like a table: the pair separates into single-card fans
// first, then the dealer deals each new hand its second card - without this
// the cards appear instantly and it reads as the game hitting for you.
async function animateSplit(bHand) {
  localCards?.sync(round, round.hands.indexOf(bHand));
  const boxIdx = bHand.box;
  const sibs = round.live().filter(h => h.box === boxIdx);
  const nh = sibs[sibs.indexOf(bHand) + 1];
  const seat = seatEls[boxIdx];
  const cardsEl = seat.querySelector('.cards');
  cardsEl.innerHTML = '';
  seat.querySelectorAll('.hand-total').forEach(b => b.remove());
  const conts = sibs.map((h, k) => subhandEl(cardsEl, k, sibs.length));
  sibs.forEach((h, k) => {
    const upto = (h === bHand || h === nh) ? 1 : h.cards.length;
    h.cards.slice(0, upto).forEach((card, ci) => { const el = cardEl(card); el.style.setProperty('--ci', ci); conts[k].appendChild(el); });
    updateBadge(conts[k], h.cards.slice(0, upto));
  });
  await sleep(550);
  await beginDealingTake();
  for (const h of [bHand, nh]) {
    const k = sibs.indexOf(h);
    if (!h.cards[1]) continue;
    await deliverCard(conts[k], h.cards[1], {continues:h===bHand&&!!nh.cards[1]});
    updateBadge(conts[k], h.cards);
    await sleep(80);
  }
  await endDealingTake();
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
function dealCardTo(container, card, { faceDown = false, shoeDraw = card?.shoeDraw, motion } = {}) {
  if (shoeState && shoeDraw) showShoe({ ...shoeState, dealt:shoeDraw, remaining:shoeState.total-shoeDraw, cutReached:shoeDraw>=shoeState.cutAfter });
  const el = cardEl(card, faceDown);
  const n = container.querySelectorAll('.card').length;
  el.style.setProperty('--ci', n);
  // squeeze the fan once a hand runs long, so it stays over its own box
  const total = n + 1;
  container.style.setProperty('--cn', total);
  container.style.setProperty('--fan', Math.min(1, 3.2 / Math.max(2, total)).toFixed(3));
  container.appendChild(el);
  el.dealt = flyFromShoe(el, card, faceDown, motion);
  return el;
}
function clearTable() {
  localCards?.clear();
  document.querySelectorAll('.cards').forEach(c => (c.innerHTML = ''));
  document.querySelectorAll('.hand-total').forEach(b => b.remove());
  document.querySelectorAll('.result, .sideresult').forEach(r => { r.textContent = ''; r.className = r.className.split(' ')[0]; });
}

// ---------- round flow ----------
function setBanner(text) { const b = $('#banner'); if (!text) b.classList.add('hidden'); else { b.classList.remove('hidden'); b.textContent = text; } }
function activeBoxHighlight() {
  localCards?.sync(round);
  if(gameInterface.compactSeats)layoutSeats();
  seatEls.forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.subhand').forEach(su => su.classList.remove('waiting'));
  $('#actions').hidden = true;
  $('#actions-top').hidden = true;
  const actionNotice=$('#action-placement-warning');
  if(actionNotice)actionNotice.hidden=true;
  if (!round || round.phase !== 'decisions') return;
  const seat = seatOfLive(round.active);
  if (!seat) return;
  seat.classList.add('active');
  // on a split box, dim the hands that are waiting so HIT visibly belongs
  // to one fan
  const cont = boxContainer(round.active);
  if (cont?.classList.contains('subhand')) {
    cont.parentNode.querySelectorAll(':scope > .subhand').forEach(su => { if (su !== cont) su.classList.add('waiting'); });
  }
  showActions(seat);
}
$('#deal-now').onclick = startRound;

const {beginDealingTake,endDealingTake,deliverCard,revealHole}=createFilmedActionControls({state:clientState,localPresentationEnabled,speechQueue,updatePoseState,nativeObservation,cardEl,dealCardTo});

async function dealSequence() {
  busy = true;
  document.body.classList.add('in-round');
  let out;
  try {
    await tableReady;
    try {
      if (!await operatorAppearanceBoundary.beforeRound()) { busy=false; document.body.classList.remove('in-round'); renderBets(); return; }
    } catch (error) {
      busy=false; document.body.classList.remove('in-round'); renderBets();
      hint('UTSEENDE',error.message); return;
    }
    out = await tableCommand('start', {bets:bets.map(b=>({...b}))});
  } catch (e) { document.body.classList.remove('in-round'); tableError(e); return; }
  balance=out.balance; ledger('deal',-betTotal());
  if (out.shuffled) {
    clearTable(); setBanner('CHANGING SHOE · SHUFFLING');
    showShoe({...out.shoe,dealt:0,remaining:out.shoe.total,cutReached:false});
    await sleep(1800);
  }
  round = roundView(out.round);
  renderBets(); setBanner(null); clearTable();
  const queuedChat=nextDealChat;nextDealChat=null;refreshNextDealChat();
  let combined=false;
  if(queuedChat&&movingSpeechAvailable&&queuedChat.dealerId===DEALER.key&&queuedChat.sessionRevision===clientSessionRevision){
    const owned={version:tableVersion,lastFrame:-1,stepIndex:-1,completed:false,token:null,sequence:null};
    activeDealSpeech=owned;
    try{combined=await sendChat({message:queuedChat.message,dealSpeech:owned})&&owned.completed;}
    finally{activeDealSpeech=null;refreshNextDealChat();}
    if(!combined&&owned.lastFrame>=0){tableError(Error('Utdelningens tal avbröts. Ladda om för att visa serverns kort'));return;}
  }
  if(!combined){
  const dealOrder = [...round.live()].reverse();
  localPresentation?.prepareSequence([
    { type: 'speak', line: 'goodluck' },
    ...dealOrder.map(hand => ({ type: 'deal', to: 'box', box: hand.box, shoeDraw: hand.cards[0].shoeDraw })),
    { type: 'deal', to: 'dealer', faceDown: false, shoeDraw: round.dealer[0].shoeDraw },
    ...dealOrder.map(hand => ({ type: 'deal', to: 'box', box: hand.box, shoeDraw: hand.cards[1].shoeDraw })),
    { type: 'deal', to: 'dealer', faceDown: true, shoeDraw: round.holeDraw },
  ]);
  // Speech and action share a filmed body: wait for the actual sentence,
  // then begin the dealing take before releasing any server-issued cards.
  await voice.say('goodluck', { force: true });
  await beginDealingTake();

  const live = round.live();
  const PACE = 80;
  for (let i = live.length - 1; i >= 0; i--) {
    await deliverCard(boxContainer(i), live[i].cards[0], {continues:true});
    updateBadge(boxContainer(i), live[i].cards.slice(0, 1));
    await sleep(PACE);
  }
  await deliverCard($('#dealer-cards'), round.dealer[0], {continues:true});
  updateBadge($('#dealer-cards'), [round.dealer[0]]);
  await sleep(PACE);
  for (let i = live.length - 1; i >= 0; i--) {
    await deliverCard(boxContainer(i), live[i].cards[1], {continues:true});
    updateBadge(boxContainer(i), live[i].cards.slice(0, 2));
    await sleep(PACE);
  }
  await deliverCard($('#dealer-cards'), null, { faceDown: true, shoeDraw:round.holeDraw });
  await sleep(PACE);
  }
  const live=round.live();
  await endDealingTake();
  // side bets resolve on the deal, like the real game
  let sideWin = false;
  live.forEach((b, i) => {
    if (!(b.pp || b.tp)) return;
    const el = seatOfLive(i).querySelector('.sideresult');
    const win = sideBetWin(b);
    if (win) {
      sideWin = true;
      el.textContent = `${b.sideLabels.join(' · ')} +${fmt(win.profit)}`;
      const seatEl = seatOfLive(i);
      const r = seatEl.getBoundingClientRect();
      burstAt(r.x, r.y, win.profit >= b.stake * 10);
      const seatNo = seatEls.indexOf(seatEl) + 1;
      toast(`SEAT ${seatNo} · ${b.sideLabels.join(' + ')}`, win.profit, win.profit >= b.stake * 10);
    }
    else el.textContent = b.sideReturn > 0 ? `side returned ${fmt(b.sideReturn)}` : 'side lost';
  });
  if (sideWin) { sfx.play('bigwin'); voice.say('sidebet', { force: true }); }


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
async function resolveIns(yes) {
  if (!round || round.phase !== 'insurance') return;
  const beforeBalance=balance;
  $('#insurance').hidden = true;
  busy = true;
  if (yes) {
    const cost = round.live().reduce((a, b) => a + b.stake / 2, 0);
    if (balance < cost) yes = false;
    else { balance -= cost; ledger('insurance', -cost); }
  }
  try { const out=await tableCommand('insurance',{take:yes}); round=roundView(out.round); balance=out.balance; }
  catch(e) { balance=beforeBalance; tableError(e); return; }
  renderBets();
  void afterDealChoreo();
}

async function afterDealChoreo() {
  if (round.phase === 'settled') { await dealerRevealChoreo(); await finish(); return; }
  busy = false;
  renderBets(); activeBoxHighlight();
}

document.querySelectorAll('#actions button, #actions-top button').forEach(btn => {
  btn.onclick = async e => {
    console.info('[act]', btn.dataset.act, 'trusted=', e?.isTrusted, 'phase=', round?.phase, 'busy=', busy);
    if (!round || round.phase !== 'decisions' || busy) return;
    const beforeBalance = balance;
    const liveIdx = round.active;
    let hand = round.live()[liveIdx];
    const before = hand.cards.length;
    if (btn.dataset.act === 'double') {
      if (balance < hand.stake) return;
      balance -= hand.stake; ledger('double', -hand.stake);
    }
    if (btn.dataset.act === 'split') {
      if (balance < hand.stake) return;
      balance -= hand.stake; ledger('split', -hand.stake);
      sfx.play('chip');
    }
    document.querySelectorAll('#actions button, #actions-top button').forEach(b => { b.disabled = true; });
    // A hit request has no filmed table knock; sound follows card contact.
    busy=true;
    try { const out=await tableCommand('act',{action:btn.dataset.act}); round=roundView(out.round); balance=out.balance; hand=round.live()[liveIdx]; }
    catch(e) { balance=beforeBalance; tableError(e); return; }
    if (btn.dataset.act === 'double') await voice.say('double', { force: true });
    if (btn.dataset.act === 'split') { await animateSplit(hand); syncBalance('split'); }
    else if (hand.cards.length > before) {
      await beginDealingTake();
      await deliverCard(boxContainer(liveIdx), hand.cards.at(-1));
      updateBadge(boxContainer(liveIdx), hand.cards);
      await endDealingTake();
      if (handValue(hand.cards).total > 21) await voice.say('bust', { force:true });
      await sleep(80);
    }
    renderBets();
    if (round.phase === 'decisions') {
      localPresentation?.state({ action: false });
      updatePoseState({ actionOwner: 'none' }, 'player-action-completed');
      busy=false;
      setTimeout(() => { if (round && round.phase === 'decisions' && !busy) activeBoxHighlight(); }, 280);
      activeBoxHighlight();
    } else {
      $('#actions').hidden = true;
      $('#actions-top').hidden = true;
      const actionNotice=$('#action-placement-warning');
      if(actionNotice)actionNotice.hidden=true;
      seatEls.forEach(s => s.classList.remove('active'));
      busy = true;
      await dealerRevealChoreo();
      await finish();
    }
  };
});

async function dealerRevealChoreo() {
  const dc = $('#dealer-cards');
  await sleep(500);
  if (round.dealer.length >= 2) {
    await revealHole(dc, round.dealer[1]);
    updateBadge(dc, round.dealer.slice(0, 2));
    await sleep(650);
  }
  if (round.dealer.length > 2) await beginDealingTake();
  for (let i = 2; i < round.dealer.length; i++) {
    await deliverCard(dc, round.dealer[i], {continues:i<round.dealer.length-1});
    updateBadge(dc, round.dealer.slice(0, i + 1));
    await sleep(80);
  }
  await endDealingTake();
}

async function finish() {
  $('#actions').hidden = true;
  $('#actions-top').hidden = true;
  const actionNotice=$('#action-placement-warning');
  if(actionNotice)actionNotice.hidden=true;
  seatEls.forEach(s => s.classList.remove('active'));
  const live = round.live();
  let ret = 0, sideRet = 0, anyPush = false, anyLose = false;
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
    handsHere.forEach((hand, k) => {
      ret += hand.result;
      stakeSum += hand.stake; backSum += hand.result; insSum += hand.insured;
      // on a split box every hand shows its own verdict - the combined net
      // below can read as "my 21 didn't pay" when a sibling busted
      if (handsHere.length > 1) {
        const hnet = hand.result - hand.stake - hand.insured;
        const badge = seat.querySelector(`.hand-total[data-h="${k}"]`);
        if (badge) {
          const t = handValue(hand.cards).total;
          badge.textContent = `${t > 21 ? 'BUST' : t} ${hnet > 0 ? '+' : ''}${fmt(hnet)}`;
          badge.classList.add(hnet > 0 ? 'win' : hnet === 0 ? 'push' : 'lose');
        }
      }
    });
    sideRet += handsHere[0]?.sideReturn ?? 0;   // side bets ride the original hand only
    const el = seat.querySelector('.result');
    const net = backSum - stakeSum - insSum;
    // show the NET, signed: "WIN $100" used to mean the total returned, which
    // reads as profit and is not
    const sideNet = (handsHere[0]?.sideReturn ?? 0) - (b.pp + b.tp);
    rows.push({ box: i, stake: stakeSum, sides: b.pp + b.tp, back: backSum, net, sideNet,
                outcome: net > 0 ? 'win' : net === 0 ? 'push' : 'lose' });
    if (net > 0) {
      el.textContent = '+' + fmt(net); el.classList.add('win');
      el.title = `staked ${fmt(stakeSum)}, returned ${fmt(backSum)}`;
      const r = seat.getBoundingClientRect();
      burstAt(r.x, r.y, backSum >= stakeSum * 2.4);
    }
    else if (net === 0) { el.textContent = 'PUSH ' + fmt(stakeSum); el.classList.add('push'); anyPush = true; el.title = 'stake returned'; }
    else { el.textContent = fmt(net); el.classList.add('lose'); anyLose = true; el.title = `staked ${fmt(stakeSum)}`; }
  });
  // Include extra double/split stakes and insurance, not just opening bets.
  const staked = live.reduce((sum,h) => sum + h.stake + (h.insured ?? 0), 0)
    + bets.reduce((sum,b) => sum + b.pp + b.tp, 0);
  let collected;
  try { collected=await tableCommand('collect'); } catch(e) { tableError(e); return; }
  balance += ret; ledger('settle', ret);
  if (sideRet) { balance += sideRet; ledger('sidebets', sideRet); }
  balance=collected.balance; showShoe(collected.shoe);
  const totalReturned = ret + sideRet;
  const win = roundWin(live);
  const lw = $('#last-win');
  lw.textContent = fmt(totalReturned);
  lw.classList.toggle('won', Boolean(win));
  showSettlement(rows, staked, totalReturned);
  if (win) toast('ROUND PROFIT', win.profit, win.blackjack || win.profit >= 500);
  syncBalance('settle');
  renderBets();
  announceRound({live,dealer:round.dealer,anyPush,anyLose,voice,sfx,bjFlash});
  await Promise.all([sleep(1800), speechQueue.idle]);
  await endDealingTake({ deferIdle: true });
  updatePoseState({ dealerPose: 'unknown', actionOwner: 'none', idlePresented: null }, 'table-cleared');
  localPresentation?.state({ action: false });
  round = null; busy = false;
  bets = bets.map(() => ({ main: 0, pp: 0, tp: 0 }));
  undoStack = [];
  clearTable();
  document.body.classList.remove('in-round');
  layoutSeats();
  renderBets(); setBanner('PLEASE PLACE BETS');
  voice.say('placebets');
}

// ---------- chat: OpenClaw decision + renderer-owned pose gate ----------
let chatHistory = [];
let chatBusy = false;
const pendingChatReplies = new Map();
const compactChat = () => matchMedia('(max-width: 860px)').matches;
let chatToggle, chatStatus, chatElapsed;
const chatPlaybackDiagnostic = createChatPlaybackDiagnostic(() => chatStatus);
const { setChatOpen, noteChatMessage } = createDealerChatVisibility({ document, studioPreview,
  getToggle: () => chatToggle, scheduleInterfaceLayout });
function setChatStatus(text) {
  if (!chatStatus) return;
  chatElapsed.textContent = '';
  chatStatus.replaceChildren(...(text ? [document.createTextNode(text), chatElapsed] : []));
}
if (!studioPreview) {
  chatToggle = document.createElement('button'); chatToggle.id = 'chat-log-toggle';
  chatToggle.type = 'button'; chatToggle.textContent = 'Chatt';
  chatToggle.setAttribute('aria-label', 'Visa eller dölj chattloggen');
  chatToggle.setAttribute('aria-controls', 'chat-log'); chatToggle.setAttribute('aria-expanded', 'false');
  chatToggle.onclick = () => setChatOpen(!$('#chat-log').classList.contains('open'));
  $('#chat').append(chatToggle);
  chatStatus = document.createElement('span'); chatStatus.id = 'chat-status';
  chatElapsed = document.createElement('span'); chatElapsed.setAttribute('aria-hidden', 'true');
  chatStatus.setAttribute('role', 'status'); $('#chat').append(chatStatus);
  $('#chat').addEventListener('keydown', event => { if (event.key === 'Escape') setChatOpen(false); });
}

function chatLog(role, text, pending = false) {
  const panel = $('#chat-log');
  const row = document.createElement('div');
  row.className = `msg ${role}` + (pending ? ' pending' : '');
  const name = document.createElement('b');
  name.textContent = role === 'user' ? (player?.name ?? 'You') : DEALER.name;
  const message = document.createElement('p'); message.textContent = text;
  row.append(name, message);
  panel.appendChild(row);
  noteChatMessage(role);
  panel.scrollTop = panel.scrollHeight;
  while (panel.children.length > 24) panel.firstChild.remove();
  return row;
}

async function playRecorded(id, signal) {
  return localPresentation?.present({ type: 'speak', line: id }, { signal });
}

const {movingDealFrame,movingDealEnd}=createMovingDealPlayback({state:clientState,$,boxContainer,dealCardTo,updateBadge});
async function playChatDecision(decision, signal, jobId) {
  return playProductChatDecision(chatDecisionRuntime(), decision, signal, jobId);
}

// Read mutable client state when a callback runs, including after awaits.
function chatDecisionRuntime() {
  return {
    get studioPreview() { return studioPreview; }, get dealer() { return DEALER; },
    get pendingChatReplies() { return pendingChatReplies; }, get chatHistory() { return chatHistory; },
    get chatPlaybackDiagnostic() { return chatPlaybackDiagnostic; },
    get localPresentation() { return localPresentation; },
    get localPresentationEnabled() { return localPresentationEnabled; },
    get layerComposition() { return layerComposition; }, get poseGate() { return speechPoseGate; },
    get activeDealSpeech() { return activeDealSpeech; }, get tableVersion() { return tableVersion; },
    get localCards() { return localCards; }, get round() { return round; },
    get chatStatus() { return chatStatus; }, get nativeObservation() { return nativeObservation; },
    get scene() { return $('#scene'); },
    get speaking() { return speaking; }, set speaking(value) { speaking = value; },
    updatePoseState, poseIdentity, movingDealFrame, movingDealEnd,
    setChatStatus, showCaption, playGeneratedSpeech, chatLog,
    hideCaption: () => $('#caption').classList.remove('show'), now: () => performance.now(),
  };
}

const {sendChat,refreshNextDealChat,setMovingSpeechAvailable,cancelNextDealChat}=createPlayerChatController({state:clientState,studioPreview,$,DEALER,clientSessionRevision,entrySelection,compactChat,setChatStatus,localPresentationEnabled,nativeObservation,chatPlaybackDiagnostic,poseIdentity,chatLog,pendingChatReplies,apiFetch});

$('#chat-send').onclick = () => void sendChat();
$('#chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') void sendChat(); });
if(localPresentationEnabled&&!studioPreview){
  nextDealControls=document.createElement('div');nextDealControls.id='chat-next-deal-controls';nextDealControls.hidden=!movingSpeechAvailable;
  const label=document.createElement('label'),toggle=document.createElement('input'),cancel=document.createElement('button');
  toggle.type='checkbox';toggle.id='chat-next-deal';label.append(toggle,document.createTextNode(' Svara under nästa utdelning'));
  cancel.type='button';cancel.textContent='Avbryt';cancel.hidden=true;cancel.onclick=()=>{cancelNextDealChat();setChatStatus('Planerat svar avbrutet. Texten finns kvar.');};
  toggle.onchange=()=>{if(!toggle.checked)cancelNextDealChat();};nextDealControls.append(label,cancel);$('#chat').append(nextDealControls);
  $('#chat-input').addEventListener('input',()=>{if(nextDealChat&&$('#chat-input').value.trim()!==nextDealChat.message)cancelNextDealChat();});
  window.addEventListener('pagehide',cancelNextDealChat,{once:true});
}
const astridCamera = mountDealerVoiceControl({ document, studioPreview, dealer: DEALER, setChatOpen,
  identity: () => ({ ...poseIdentity(), playerId: player?.id }),
  presentationContext: () => chatPresentationContext(entrySelection, DEALER.key),
  getChatState: () => ({ busy: chatBusy, speaking }),
  onActivity: () => probeClient?.activity(),
  onPlaybackToggle: () => setMuted(!voice.muted),
  onPlaybackEnable: () => setMuted(false),
  getPlaybackEnabled: () => !voice.muted,
  send: ({ message, images, profileRevision }) => sendChat({ message, images, profileRevision }) });

// Memory belongs to the authenticated server player, not this tab's display log.
const chatMemory = document.createElement('details');
chatMemory.id = 'chat-memory';
const memorySummary = document.createElement('summary'); memorySummary.textContent = 'Minne';
const memoryPanel = document.createElement('div');
const memoryInfo = document.createElement('p');
memoryInfo.textContent = 'Upp till 30 chattinlägg, totalt 8 000 tecken per spelare och dealer, högst 30 dagar utan nya meddelanden. Sparade chattsvar kan ha genererats utan att spelas upp. Probes sparas först efter uppspelning. Belagda fakta har en separat livslängd på högst 30 dagar.';
const memoryStatus = document.createElement('p'); memoryStatus.setAttribute('role', 'status');
const memoryForget = document.createElement('button'); memoryForget.type = 'button'; memoryForget.textContent = 'Radera mitt minne hos denna dealer';
const memoryLimit = document.createElement('small'); memoryLimit.textContent = 'Raderar lokalt spelarchattminne, inte leverantörernas loggar. Stoppar ett pågående svar.';
memoryPanel.append(memoryInfo, memoryStatus, memoryForget, memoryLimit); chatMemory.append(memorySummary, memoryPanel); $('#chat').append(chatMemory);
if(studioPreview){chatMemory.hidden=true;memoryForget.disabled=true;}
chatMemory.addEventListener('toggle', async () => {
  if (studioPreview || !chatMemory.open) return;
  try {
    await tableReady;
    const context=chatPresentationContext(entrySelection,DEALER.key);
    const query=new URLSearchParams({dealer:DEALER.key,...(context?{presentationContext:JSON.stringify(context)}:{})});
    const response = await apiFetch('/api/chat/memory?'+query, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const profile = await response.json();
    memoryStatus.textContent = `${profile.history.length} sparade inlägg för ${DEALER.name}.`;
  } catch { memoryStatus.textContent = 'Minnet kunde inte läsas.'; }
});
memoryForget.onclick = async () => {
  if(studioPreview)return;
  probeClient?.cancel('memory_forgotten');
  memoryForget.disabled = true;
  try {
    const response = await apiFetch('/api/chat/memory/forget', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealer: DEALER.key, ...(chatPresentationContext(entrySelection,DEALER.key)?{presentationContext:chatPresentationContext(entrySelection,DEALER.key)}:{}) }) });
    if (!response.ok) throw new Error();
    for (const [requestId] of pendingChatReplies) speechPoseGate.cancel(requestId, 'chat-memory-forgotten');
    chatHistory = []; $('#chat-log').replaceChildren();
    memoryStatus.textContent = 'Minnet hos denna dealer är raderat.';
  } catch { memoryStatus.textContent = 'Minnet kunde inte raderas. Försök igen.'; }
  finally { memoryForget.disabled = false; }
};

$('#gate-enter').onclick = () => {
  $('#gate').classList.add('hidden');
  voice.greeted = true;
  sfx.startAmbience();
  voice.say('greeting', { force: true })?.catch(error=>console.warn('[speak] greeting',error.message));
};

$('#all-sides').onclick = () => {
  allSides = !allSides;
  $('#all-sides').classList.toggle('on', allSides);
};

if (playerChoice && entrySelection.choices) {
  const remember = patch => writeChoices(choiceStorage, entrySelection.operator, { ...playerChoice.nextStored, ...patch }, previewSessionId);
  mountPlayerChoices(document, {
    choices: entrySelection.choices,
    dealerAvailability: previewSession?.dealerAvailability ?? null,
    summaryLabel:studioPreview?'Bord och bakgrund':undefined,
    names: Object.fromEntries(Object.values(DEALERS).map(dealer => [dealer.key, dealer.name])),
    currentDealer: DEALER.key,
    tableColor: playerChoice.tableColor,
    backgroundValue: playerChoice.backgroundValue,
    composition:entrySelection.composition,
    tableValue:playerChoice.tableValue,
    onTable:id=>{playerChoice.nextStored={...playerChoice.nextStored,tableAsset:id};remember({tableAsset:id});layerComposition?.setTable(id);},
    isBusy: () => !!(round || busy),
    onDealer: key => {
      remember({ dealer: key });
      location.href = dealerVersionPath(key, 'original', location.search);
    },
    onTableColor: color => {
      playerChoice.nextStored = { ...playerChoice.nextStored, tableColor: color };
      playerChoice.tableColor = color;
      remember({ tableColor: color });
      applyTableColor(document, color);
    },
    onBackground: id => {
      playerChoice.nextStored = { ...playerChoice.nextStored, background: id };
      remember({ background: id });
      layerComposition?.setBackground(id);
      localPresentation?.setBackground?.(id);
    },
  });
}

// Dealer tables are available in the main controls, without a rehearsal URL.
// Every server-selected lane narrows the row, with or without an operator.
// An unavailable dealer must not be advertised and then reopen default Astrid.
mountDealerPicker({document,$,entrySelection,DEALERS,DEALER,previewSession,state:clientState,location});

buildChips();
$('#limits').textContent = `${fmt(LIMITS.min)} \u2013 ${fmt(LIMITS.max)}`;

$('#pitboss')?.remove();
$('#supervisor')?.remove();
// Diagnostics expose the shared player only.
window.__croupier = { speechPoseGate, get presentation() { return localPresentation; },
  get round() { return round; } };

renderBets();
setBanner('PLEASE PLACE BETS');
// prepareTable loads the player before opening the server-owned table.


const tableReady = prepareTable().catch(e=>{ tableError(e); throw e; });
tableReady.catch(()=>{});
const dealerRehearsal=mountDealerRehearsal({document,$,location,entrySelection,DEALERS,DEALER,VOICE_LINES,LINES,localPresentationEnabled,setMuted,speechTurn,playRecorded,state:clientState,tableReady,activeBoxHighlight});
window.addEventListener('pagehide',()=>dealerRehearsal?.close(),{once:true});
document.querySelector('#sign-out').onclick=async()=>{if(studioPreview)return;astridCamera?.stop('Utloggad · Av');await api('/api/auth/logout',{});location.reload();};

// Separate explicit chat capability for the bound local lab. It cannot issue
// table commands or supply cards/identity. Only this authenticated native server
// produces the response; the lab owns its own presentation/standard-idle gate.
const labSpeechBridge = studioPreview?null:createNativeSpeechBridge({ href: location.href, opener: window.opener,
  loadMedia: loadGeneratedSpeech,
  onSubmit: createLinkedChatSubmit({ request: apiFetch, tableReady, isBusy: () => chatBusy, setBusy: value => { chatBusy = value; },
    getIdentity: poseIdentity, getContext: () => ({ dealer: DEALER.key, entrySelection }),
    onChat: value => nativeObservation.emit('chat', value), onReady: decision => labSpeechBridge.ready(decision) }),
});
window.addEventListener('message', event => labSpeechBridge?.accept(event));
window.addEventListener('pagehide', () => labSpeechBridge?.close(), { once: true });

if (!studioPreview && DEALER.key === 'astrid') {
  await tableReady;
  probeClient = createProbeClient({
    identity: poseIdentity,
    flags: ownJobId => ({ present: !document.hidden, sound: !voice.muted,
      // Focus already starts a fresh inactivity period. An empty field must
      // not veto every later initiative just because focus remained after Send.
      typing: Boolean($('#chat-input').value.trim()) || Boolean(astridCamera?.busy),
      quiet: probePresentationQuiet({busy,round,chatBusy,speaking,pending:speechQueue.pending,gate:speechPoseGate,ownJobId,idleBackground:localPresentation?.idleBackground}) }),
    mount: memoryPanel,
    report: ({state,...entry}) => nativeObservation.emit('status', { ...entry, state:'probe', stage:state }),
    cancelDelivery: (id,reason) => speechPoseGate.cancel(id,reason),
    deliver: async (decision, options) => {
      const id=decision.requestId;
      const received=speechPoseGate.receive({jobId:id,...poseIdentity(),requestFingerprint:id});
      const pending={...options,probe:true,correlation:nativeObservation.context(),requestedAt:performance.now(),playbackReceipt:null};
      pendingChatReplies.set(id,pending);
      try {
        localPresentation?.state({ ready: true });
        speechPoseGate.responseReady(id,decision);
        const result=await received.completion;
        return {...result,playback:pending.playbackReceipt};
      }finally{pendingChatReplies.delete(id);if(!pendingChatReplies.size)localPresentation?.state({ready:false});}
    },
  });
  $('#chat-input').addEventListener('input',()=>probeClient.activity());
  $('#chat-input').addEventListener('focus',()=>probeClient.activity());
  $('#chat-input').addEventListener('blur',()=>void probeClient.refresh());
  window.addEventListener('pagehide',()=>probeClient.close(),{once:true});
  const params=new URLSearchParams(location.search);
  if(params.has('probeCase') && ['127.0.0.1','localhost','[::1]'].includes(location.hostname)) {
    const trial=document.createElement('details');trial.open=true;
    const title=document.createElement('summary');title.textContent='Probe · syntetiskt talprov';
    const description=document.createElement('p');description.textContent='Provet använder en påhittad spelare och skapar Victoria-ljud och läppsynkvideo. Inga provminnen sparas hos din profil. Avsluta handen och aktivera ljudet först.';
    const play=document.createElement('button');play.type='button';play.textContent='Generera och spela ett talprov';
    play.onclick=async()=>{play.disabled=true;try{await probeClient.test({caseId:params.get('probeCase'),model:params.get('probeModel')??'gateway-default'});}finally{play.disabled=false;}};
    trial.append(title,description,play);memoryPanel.append(trial);chatMemory.open=true;
  }
}
