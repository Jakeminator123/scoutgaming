import {readCardView,saveCardView} from '../../../packages/presentation/contracts/card-view.mjs';
import {createOperatorAppearanceBoundary, preserveAppearanceBets, consumeAppearanceBets} from './operator-appearance-boundary.mjs';
import {chatPresentationContext} from './chat-presentation-context.mjs';
import { createStudioPreviewClient, studioPreviewFromDocument, STUDIO_PREVIEW_NOTICE, requestEmbeddedStudioPreviewClose } from './studio-preview-client.mjs';
import {createLayerComposition} from '../../../packages/presentation/runtime/presentation-composition.mjs';
import {layoutGameOverlay,BLACKJACK_COMPACT_QUERY} from '../../../packages/presentation/runtime/game-overlay-layout.mjs';
import { dealerVersionPath } from './dealer-version-switcher.mjs';
import { createNativeObservation } from './native-observation.mjs';
import { SPEECH_LINES } from '../../../packages/presentation/contracts/speech-lines.mjs';
import { createSpeechQueue } from './speech-queue.mjs';
import { createProbeClient, probePresentationQuiet } from './probe-client.mjs';
import { createAstridCameraControl } from './astrid-camera-control.mjs';
import { createSpeechPoseGate } from '../../../packages/presentation/runtime/speech-pose-gate.mjs';
import { CHAT_STAGES, readChatResponse, chatFailureMessage, chatFailureCode } from '../../../packages/presentation/contracts/chat-response.mjs';
import { playGeneratedSpeech, loadGeneratedSpeech } from '../../../packages/presentation/runtime/generated-speech-player.mjs';
import { createChatPlaybackDiagnostic } from './chat-playback-diagnostic.mjs';
import { createNativeSpeechBridge } from '../../../packages/presentation/runtime/lab-speech-bridge.mjs';
import { installNativeP6GamePlayback, createNativeP6GameQueueDelivery, nativeP6GameAvailability, NATIVE_P6_GAME_ORIGIN } from './native-p6-game-playback.mjs';
import { createTableAudio } from './table-audio.mjs';
import {gameLaneFromDocument} from '../../../packages/presentation/contracts/game-selection.mjs';
import { applyTableColor, mountPlayerChoices, readChoices, resolvePlayerSelection, writeChoices } from '../../../packages/presentation/runtime/player-choices.mjs';
import { createPresentationStartup } from './presentation-startup.mjs';
import { registeredFilmedProfile } from './dealer-filmed-profiles.mjs';
import { handValue } from './blackjack.mjs';
import { sideBetWin, roundWin } from './blackjack-feedback.mjs';
import { totalLabel } from './card-presentation/renderer-support.js';
import { placeActions, placeDealControl } from './action-placement.mjs';
import { cardFaceArt } from './card-art.mjs';
import { movingDealCard } from './moving-speech-sequence.mjs';

const $ = s => document.querySelector(s);
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
let previewSession = null;
if (studioPreview) {
  const notice=document.createElement('details');notice.id='studio-preview-status';
  const summary=document.createElement('summary');summary.textContent='Provspel · separat testsaldo';summary.title=STUDIO_PREVIEW_NOTICE;
  const explanation=document.createElement('p');explanation.textContent=STUDIO_PREVIEW_NOTICE;
  notice.append(summary,explanation);$('#top-right').append(notice);
  $('#chat').hidden=true;$('#chat').inert=true;
  $('#chat-input').disabled=true;$('#chat-send').disabled=true;
  try { previewSession=await gameApi.session(); }
  catch(error){notice.open=true;explanation.textContent=error.message;explanation.setAttribute('role','alert');throw error;}
  const label=document.querySelector('#wallet label');if(label)label.textContent='TESTSALDO';
  $('#add-funds').hidden=true;$('#sign-out').hidden=true;
}
const choiceStorage=studioPreview?sessionStorage:localStorage;
const previewSessionId=studioPreview?.sessionId??null;
const soundStorageKey=studioPreview?'croupier.studio-preview.'+studioPreview.sessionId+'.muted':'croupier-muted';
const playableChoices=previewSession&&entrySelection.choices?{...entrySelection.choices,dealers:entrySelection.choices.dealers.filter(id=>previewSession.dealerAvailability.some(row=>row.id===id&&row.playable))}:entrySelection.choices;
const lobbyReturn = document.querySelector('.casino-return');
if(lobbyReturn){
  // Use the validated document context, never a return URL or room from the query.
  const returnQuery=new URLSearchParams(studioPreview
    ? {composition:studioPreview.presentationLaneId,...(entrySelection.dealer?{dealer:entrySelection.dealer}:{})}
    : entrySelection.operator?{operator:entrySelection.operator,...(entrySelection.roomId?{room:entrySelection.roomId}:{})}:{});
  lobbyReturn.href=(studioPreview?'/admin/compositions':'/lobby')+(returnQuery.size?'?'+returnQuery:'');
  if(studioPreview){
    lobbyReturn.textContent=window.parent===window?'Till Sammansättning':'Stäng provspel';
    lobbyReturn.onclick=async event=>{
      if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      try{await gameApi.close();}catch{ /* The expired session also permits returning to Studio. */ }
      try{writeChoices(choiceStorage,entrySelection.operator,{},previewSessionId);choiceStorage.removeItem(soundStorageKey);}catch{}
      if(!requestEmbeddedStudioPreviewClose(studioPreview))location.assign(lobbyReturn.href);
    };
  }
}
for (const {id,label} of entrySelection.registeredDealers ?? []) DEALERS[id] = {key:id,name:label,registered:true};
if (entrySelection.presentation === 'layered') for (const [id, name] of [['dragge', 'Dragge']]) DEALERS[id] = {key:id,name,registered:true};
const DEALER = DEALERS[entrySelection.dealer];
if (!DEALER) { presentationStartup.fail(); throw new Error('Dealer is not registered'); }
const layeredPresentationEnabled = entrySelection.presentation === 'layered';
if (!['local', 'layered'].includes(entrySelection.presentation)) {
  presentationStartup.fail();
  throw new Error('Presentation requires registered cloud media');
}
const localPresentationEnabled = true;
if (entrySelection.lane === 'mobile-phone') document.title = 'Standardsammansättning · Croupier Blackjack';
if (entrySelection.lane === 'layer-preview') document.title = 'Layer Preview Lane · Croupier Blackjack';
let localPresentation = null;
let localCards = null;
if (localPresentationEnabled) {
  document.documentElement.dataset.presentation = layeredPresentationEnabled ? 'layered' : 'local';
  $('#supervisor')?.removeAttribute('src');
  $('#supervisor')?.load();
}
if(!studioPreview) document.cookie = `croupier_layer_preview=${entrySelection.lane === 'layer-preview' ? '1' : '0'}; Path=/; Max-Age=3600; SameSite=Lax`;
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
    try{layerComposition?.backgroundEvent('speak.'+t,`${clientSessionRevision}:${entrySelection.roomId??entrySelection.lane}:${DEALER.key}:${tableVersion}:${t}`);}catch{}
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
  onDisplay: async (decision, job) => {
    const pending = pendingChatReplies.get(job.jobId);
    if (!pending || decision.kind === 'silence') return;
    await pending.beforeDisplay?.();
    if (pending.controller.signal.aborted) return;
    const text = decision.exactText;
    if (pending.previewRow?.isConnected && pending.previewText === text) pending.previewRow.classList.remove('pending');
    else chatLog('vera', text);
    nativeObservation.emit('chat', { role: 'assistant', text, line: decision.lineId ?? null,
      source: pending.probe ? 'probe' : 'openclaw-chat', synthetic: Boolean(pending.synthetic), speechKind: decision.kind }, pending.correlation);
    if (!pending.synthetic && !pending.probe) chatHistory.push({ role: 'assistant', text });
  },
  onSpeech: async (decision, { signal, job }) => playChatDecision(decision, signal, job.jobId),
  onCancel: (job, reason) => {
    chatPlaybackDiagnostic.finish(job.jobId, 'cancelled');
    const pending = pendingChatReplies.get(job.jobId);
    if (pending?.previewRow?.classList.contains('pending')) pending.previewRow.remove();
    pending?.controller?.abort(reason);
    nativeObservation.emit('chat', { role: 'assistant', state: 'cancelled', reason,
      requestId: job.jobId, source: 'openclaw-chat' });
  },
  onTrace: entry => nativeObservation.emit('status', { state: 'chat-pose', ...entry }),
});
if (localPresentationEnabled) {
  try {
    if (layeredPresentationEnabled) {
      const { createLayeredPresentation } = await import('./layered-presentation.mjs');
      localPresentation = await createLayeredPresentation({
        host: $('#scene'),
        dealerId: DEALER.key,
        rehearsal: new URLSearchParams(location.search).get('rehearsal') === '1',
        receipt: entry => nativeObservation.emit('playback', entry),
        onBusy: () => updatePoseState({ dealerPose: 'action', idlePresented: null }, 'layered-owner'),
        onReady: () => presentationStartup.ready(DEALER.key),
      });
      localCards = null;
    } else {
      const [{ PerformancePlayer }, { createLocalPresentation }, cardOverlay] = await Promise.all([
        import('./performance-player.mjs'),
        import('./local-presentation.mjs'),
        import('./local-card-overlay.mjs'),
      ]);
      performancePlayer = new PerformancePlayer({ host: $('#scene') });
      localPresentation = await createLocalPresentation({
        player: performancePlayer, host: $('#scene'), dealerId: DEALER.key, entry: entrySelection, transport: gameApi,
        version: () => tableVersion, muted: () => voice.muted, composition: layerComposition,
        receipt: entry => nativeObservation.emit('playback', entry),
        onIdle: () => presentStandardIdle('local-primary-frame'),
        onError: () => presentationStartup.fail(),
        onBusy: () => updatePoseState({ dealerPose: 'action', idlePresented: null }, 'local-film-owner'),
      });
      localCards = cardOverlay.createLocalCardOverlay($('#scene'),{dealerLabel:DEALER.name,filmedProfile:registeredFilmedProfile(DEALER.key)});
    }
    localPresentation.start();
    window.addEventListener('pagehide', () => { localCards?.close(); localPresentation.close(); layerComposition?.close(); }, { once: true });
  } catch (error) {
    presentationStartup.fail();
    console.error('[presentation]', error.message);
    const status = document.createElement('div'); status.className = 'local-presentation-status'; status.setAttribute('role', 'status');
    if(error.code==='studio_presentation_idle_package_changed'){ status.textContent=error.message+' '; const reload=document.createElement('button');reload.type='button';reload.textContent='Ladda om';reload.onclick=()=>location.reload();status.append(reload); }
    else status.textContent = layeredPresentationEnabled ? 'Lagerpaket saknas · 2D-reserv' : 'Lokal video kunde inte startas · 2D-reserv';
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
// Only Classic is supported by the authoritative server and partner contract.
// Keep the other presets unavailable until their limits are supported end to end.
const TABLES = [
  { id: 'classic', name: 'CLASSIC',     available: true,  min: 5,    max: 2000,      chips: [1, 5, 10, 25, 50, 100, 500, 1000] },
  { id: 'high',    name: 'HIGH ROLLER', available: false, min: 100,  max: 50000,     chips: [25, 100, 500, 1000, 5000, 10000, 25000] },
  { id: 'vip',     name: 'VIP SALON',   available: false, min: 1000, max: 1000000,   chips: [500, 1000, 5000, 25000, 100000, 250000, 500000] },
];
let table = TABLES.find(x => x.available);
let CHIPS = table.chips;
const LIMITS = { get min() { return table.min; }, get max() { return table.max; } };
let balance = 1000;

// ---------- player account: server-persisted demo money (SQLite) ----------
let player = null;
async function api(path, payload) {
  const r = await apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if(r.status===401) { player=null; throw new Error('Sign in required'); }
  const out = await r.json().catch(() => ({}));
  if (!r.ok || out.error) throw Object.assign(new Error(out.error ?? `api ${r.status}`), { status: r.status });
  return out;
}
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
async function tableCommand(op, extra = {}) {
  if(op!=='state'&&op!=='start')cancelNextDealChat();
  if (op !== 'state') probeClient?.activity();
  if (!player) await loadPlayer();
  if (!player) throw new Error('Cannot connect to the game server');
  if (op !== 'state') localPresentation?.state({ action: true });
  if (op !== 'state') updatePoseState({ dealerPose: 'action', actionOwner: `table-${op}`, idlePresented: null }, 'table-command-started');
  const payload = { id: player.id, op, version: tableVersion, requestId: crypto.randomUUID(), dealer: DEALER.key, ...extra,
    ...(op==='start'&&nextDealChat&&movingSpeechAvailable?{movingSpeech:{context:chatPresentationContext(entrySelection,DEALER.key),sessionRevision:clientSessionRevision}}:{}) };
  let out;
  for (let attempt=0; attempt<2; attempt++) {
    try { out = await api('/api/table', payload); break; }
    catch (e) {
      if (op === 'start' && payload.movingSpeech && e.status === 409 && e.message === 'moving_deal_speech_unavailable') {
        setMovingSpeechAvailable(false);
        // A previous network failure may have hidden a committed start. Only
        // an unambiguous first response can unlock the unchanged betting draft.
        e.dealSpeechUnavailable = attempt === 0;
      }
      if (attempt || !/fetch|network|load failed/i.test(e.message)) {
        if (op !== 'state') updatePoseState({ dealerPose: 'unknown', actionOwner: 'none', idlePresented: null }, 'table-command-failed');
        throw e;
      }
    }
  }
  if (layeredPresentationEnabled && Array.isArray(out.presentation)) {
    const consumed = localPresentation?.consume?.({ roundId: String(out.version), presentation: out.presentation });
    if (consumed?.unsupported?.length) {
      nativeObservation.emit('playback', {
        event: 'layered-unsupported',
        count: consumed.unsupported.length,
        types: [...new Set(consumed.unsupported.map(item => item.type))],
      });
    }
  }
  tableVersion = out.version;
  setMovingSpeechAvailable(out.movingSpeechAvailable===true);
  updatePoseState({ roundRevision: String(tableVersion),
    ...(op === 'state' ? { actionOwner: 'none' } : {}) }, 'table-version-committed');
  if (op === 'state') localPresentation?.state({ action: false });
  nativeObservation.command(payload, out, observedTableView, DEALER.key);
  observedTableView = out;
  return out;
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
function tableError(e) {
  if (e.dealSpeechUnavailable === true && !round) {
    busy = false;
    localPresentation?.state({ action: false });
    setBanner('Tal under utdelning är avstängt. Ingen insats drogs. Tryck DEAL igen för att spela utan tal.');
    setChatStatus('Det planerade svaret avbröts. Texten finns kvar.');
    renderBets();
    return;
  }
  busy = true; document.querySelectorAll('#actions button,#actions-top button').forEach(b=>b.disabled=true); setBanner(e.message + ' · Reload to resume'); renderBets();
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
  </div><button class="bet-target bet-target-pp" data-bet="pp" aria-label="Perfect Pairs, plats ${i+1}"></button>
    <button class="bet-target bet-target-main" data-bet="main" aria-label="Insats, plats ${i+1}"></button>
    <button class="bet-target bet-target-tp" data-bet="tp" aria-label="21+3, plats ${i+1}"></button>`;
  seatsEl.appendChild(el);
  seatEls.push(el);
}
// Bets and cards share the compositor's reference plane. Table artwork remains
// independently replaceable; its transparent border is not a gameplay anchor.
// Narrow viewports play the three centre boxes only: seven boxes on a phone
// leaves ~50px each, which cannot hold a chip stack and two cards.
// Presentation only: changing this never deals, submits a stake or reveals a card.
let cardView=readCardView({getItem:key=>localStorage.getItem(key)});
const cardViewChoice=document.createElement('label');cardViewChoice.className='card-view-choice';cardViewChoice.hidden=true;
cardViewChoice.append(document.createTextNode('Kort'));
const cardViewSelect=document.createElement('select');cardViewSelect.id='card-view';cardViewSelect.setAttribute('aria-label','Kortvisning');
for(const [value,label]of [['raised','Upplyfta'],['table','På bordet']]){const option=document.createElement('option');option.value=value;option.textContent=label;cardViewSelect.append(option);}
cardViewSelect.value=cardView;cardViewChoice.append(cardViewSelect);$('#scene').append(cardViewChoice);
cardViewSelect.addEventListener('change',()=>{cardView=saveCardView({setItem:(key,value)=>localStorage.setItem(key,value)},cardViewSelect.value);layoutSeats();});
const COMPACT_BOXES = [2, 3, 4];
const compactQuery = matchMedia(BLACKJACK_COMPACT_QUERY);
let compactSeats = compactQuery.matches;
const playedBoxes = () => {
  if(!compactSeats)return seatEls.map((_,i)=>i);
  // A seven-seat desktop hand may be resumed on a phone. Keep the current
  // server-owned hand in view instead of hiding seats 0, 1, 5 and 6 forever.
  const active=round?.live()?.[round.active]?.box;
  if(Number.isInteger(active)){
    const start=Math.max(0,Math.min(SEATS-3,active-1));return [start,start+1,start+2];
  }
  return COMPACT_BOXES;
};

function layoutSeats() {
    // Resize/compositor callbacks can arrive before MediaQueryList's change event.
    // Read the same current format before choosing the visible server boxes.
    compactSeats = compactQuery.matches;
    const banner=$('#banner');
    Object.assign(banner.style,{top:'',bottom:''});
    const scene=$('#scene').getBoundingClientRect(),plane=layerComposition?.referencePlane();
    cardViewChoice.hidden=!localCards||!plane;
    if(plane){
      const table=$('#table2d').getBoundingClientRect(),boxes=playedBoxes();
      const hud=$('#hud-bottom').getBoundingClientRect();
      const layout=layoutGameOverlay(plane,boxes,{left:12,right:scene.width-12,top:80,
        bottom:Math.min(scene.height-12,hud.height>0&&hud.top>scene.top+80?hud.top-scene.top-12:scene.height-12)},{compact:compactSeats,cardView});
      $('#scene').dataset.betPlacement=layout.followCards?'under-cards':'manual';
      let geometryNotice=$('#table-geometry-warning');
      if(!geometryNotice&&layout.geometryWarning){
        geometryNotice=document.createElement('p');geometryNotice.id='table-geometry-warning';geometryNotice.setAttribute('role','status');
        Object.assign(geometryNotice.style,{position:'absolute',top:'70px',left:'12px',right:'12px',zIndex:'20',padding:'8px',background:'#241c10',color:'#ffe1a3',pointerEvents:'none'});
        $('#scene').append(geometryNotice);
      }
      if(geometryNotice){geometryNotice.textContent=layout.geometryWarning??'';geometryNotice.hidden=!layout.geometryWarning;}
      seatEls.forEach((el,i)=>el.classList.toggle('seat-off',!boxes.includes(i)));
      for(const seat of layout.seats){
        Object.assign(seatEls[seat.box].style,{left:(scene.left+seat.x-table.left)+'px',top:(scene.top+seat.y-table.top)+'px'});
        seatEls[seat.box].style.setProperty('--game-seat-scale',layout.controlScale);
      }
      if(compactSeats)Object.assign(banner.style,{top:'auto',bottom:(scene.height-Math.min(...layout.seats.map(seat=>seat.y))+60*layout.controlScale+12)+'px'});
      Object.assign($('#dealer-cards').style,{left:(scene.left+layout.dealer.x-table.left)+'px',top:(scene.top+layout.dealer.y-table.top)+'px'});
      const filmedProfile=registeredFilmedProfile(DEALER.key);
      if(filmedProfile&&layout.sourcePlane&&layout.tableId&&!layout.geometryWarning)
        layout.filmedLayout={profileId:filmedProfile.id,tableId:layout.tableId,layout:layout.tableLayout,sourcePlane:layout.sourcePlane};
      localCards?.setProjection(layout,scene.width,scene.height);
      layoutDealControl();
      return;
    }
    delete $('#scene').dataset.betPlacement;
    layoutDealControl();
    const width = Math.min(innerWidth, innerHeight * 9 / 16), height = width * 16 / 9;
    const left = (innerWidth - width) / 2, top = (innerHeight - height) / 2;
    const table = $('#table2d').getBoundingClientRect(), boxes = playedBoxes();
    seatEls.forEach((el, i) => el.classList.toggle('seat-off', !boxes.includes(i)));
    boxes.forEach((box, k) => {
      const x = .13 + .74 * k / Math.max(1, boxes.length - 1);
      const y = .68 + .035 * Math.sin(Math.PI * k / Math.max(1, boxes.length - 1));
      Object.assign(seatEls[box].style, { left: (left + x * width - table.left) + 'px', top: (top + y * height - table.top) + 'px' });
    });
    Object.assign($('#dealer-cards').style, { left: (left + width * .5 - table.left) + 'px', top: (top + height * .58 - table.top) + 'px' });

}
layoutSeats();
layerComposition?.onGeometryChange(layoutSeats);
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
$('#double-btn').onclick = () => {
  if (round || busy) return;
  const add = betTotal();
  if (!add || add * 2 > balance + add - add || betTotal() * 2 > balance || bets.some(b => b.main * 2 > LIMITS.max || b.pp * 2 > LIMITS.max / 2 || b.tp * 2 > LIMITS.max / 2)) return;
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
  const staked = bets.filter(b => b.main > 0);
  const withinLimits = bets.every(b => b.main <= LIMITS.max && b.pp <= LIMITS.max / 2 && b.tp <= LIMITS.max / 2);
  const playable = staked.length > 0 && staked.every(b => b.main >= LIMITS.min) && withinLimits;
  $('#deal-now').title = withinLimits ? '' : 'Classic supports up to 2,000 per main bet and 1,000 per side bet. Reduce or clear your selected bets.';
  $('#deal-now').disabled = !playable || !!round || busy;
  $('#clear-btn').disabled = betTotal() === 0 || !!round || busy;
  $('#undo-btn').disabled = !undoStack.length || !!round || busy;
  $('#double-btn').disabled = !betTotal() || betTotal() * 2 > balance || bets.some(b => b.main * 2 > LIMITS.max || b.pp * 2 > LIMITS.max / 2 || b.tp * 2 > LIMITS.max / 2) || !!round || busy;
  $('#max-btn').disabled = balance < LIMITS.min || !!round || busy;
  layoutDealControl();
}

// Fixed viewport percentages can cover the centre betting position.
function layoutDealControl() {
  const control=$('#deal-now'),scene=$('#scene');
  let notice=$('#deal-placement-warning');
  if(scene.dataset.betPlacement!=='under-cards'){
    Object.assign(control.style,{position:'',left:'',top:'',bottom:'',transform:'',visibility:''});
    if(notice)notice.hidden=true;
    return;
  }
  if(control.disabled||getComputedStyle(control).display==='none'){if(notice)notice.hidden=true;return;}
  control.style.visibility='';
  const visible=el=>el.getClientRects().length&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
  const targets=seatEls.filter(el=>!el.classList.contains('seat-off')).flatMap(el=>[...el.querySelectorAll('.spot,.sidearcs,.bet-target,.clear-box,.stake')]).filter(visible).map(el=>el.getBoundingClientRect());
  const obstacles=[...document.querySelectorAll('#wallet,#chip-row,#bottom-right,#table-pick,#player-choices,#rehearsal,#hud-top,.card-view-choice,.local-presentation-mode')].filter(visible).map(el=>el.getBoundingClientRect());
  const placement=placeDealControl({width:control.offsetWidth,height:control.offsetHeight,
    viewport:{width:innerWidth,top:0,bottom:$('#dealer-picker').getBoundingClientRect().top},targets,obstacles});
  if(placement)Object.assign(control.style,{position:'fixed',left:placement.x+'px',top:placement.y+'px',bottom:'auto',transform:'none'});
  else control.style.visibility='hidden';
  if(!placement&&!notice){notice=document.createElement('p');notice.id='deal-placement-warning';notice.className='local-presentation-status';notice.setAttribute('role','status');scene.append(notice);}
  if(notice){notice.textContent='Givknappen ryms inte. Förstora spelytan eller justera bordsprofilen.';notice.hidden=!!placement;}
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
  const depositCap = Math.max(100000, table.max * 100);   // must be able to fund the table you chose
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
async function deliverCard(container, card, options={}) {
  const correlation=nativeObservation.context();
  let motion;
  const seatBox=container.closest('[data-box]')?.dataset.box;
  if (localPresentationEnabled) {
    const event = { type: 'deal', to: container.id === 'dealer-cards' ? 'dealer' : 'box',
      box: seatBox == null ? null : Number(seatBox), shoeDraw: options.shoeDraw ?? card?.shoeDraw };
    localCards?.sync(round);
    let token;
    const played = await localPresentation?.present(event, {
      onSelected: (video, committedEvent) => { token = localCards?.begin(video, committedEvent); },
      onFrame: time => localCards?.frame(token, time),
    });
    const calibratedContact = token == null ? false : localCards?.finish(token, event.shoeDraw, played);
    if (token == null) localCards?.show(event.shoeDraw);
    const element = dealCardTo(container, card, { ...options, motion: { localCompleted: played || !!localCards } });
    await element.dealt;
    nativeObservation.emit('playback', { event: 'deal', state: 'landed', ...event, type: undefined,
      renderer: localCards ? 'svg-local' : '2d', evidence: calibratedContact ? 'video-frame-track' : 'static-card-presented', calibratedContact: !!calibratedContact }, correlation);
    return;
  }

}

async function endDealingTake({ deferIdle = false } = {}) {
  // The filmed return owns the actor until its final pose and the matching
  // idle frame have both been presented. Speech/decisions wait for this.
  try {await performancePlayer?.finish({wait:['decisions','insurance'].includes(round?.phase)});}catch(error){console.warn('[performance] return',error.message);}
  if (!deferIdle) {
    updatePoseState({ dealerPose: 'unknown', actionOwner: 'none', idlePresented: null }, 'action-completed');
    localPresentation?.state({ action: false });
  }
}
async function revealHole(container, card) {
  const back = container.querySelector('.card.back');
  if (!back) return;
  if (localPresentationEnabled) {
    localPresentation?.state({ action: true });
    localCards?.sync(round);
    let token;
    const played = await localPresentation?.present({ type: 'reveal', to: 'dealer', shoeDraw: card.shoeDraw }, {
      onSelected: (video, event) => { token = localCards?.begin(video, event); },
      onFrame: time => localCards?.frame(token, time),
    });
    const calibrated = token != null && localCards?.finish(token, card.shoeDraw, played);
    if (token == null) localCards?.reveal(round);
    nativeObservation.emit('playback', { event: 'reveal', state: 'landed', shoeDraw: card.shoeDraw,
      renderer: 'svg-local', evidence: calibrated ? 'video-frame-track' : 'static-card-presented', calibratedContact: !!calibrated });
  }
  const el = cardEl(card);
  el.style.setProperty('--ci', back.style.getPropertyValue('--ci') || 1);
  el.classList.add('flip');
  back.replaceWith(el);
  localCards?.reveal(round);
  nativeObservation.emit('playback',{event:'reveal',state:'presented',card,evidence:'DOM-replacement'});
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
  if(compactSeats)layoutSeats();
  seatEls.forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.subhand').forEach(su => su.classList.remove('waiting'));
  $('#actions').hidden = true;
  $('#actions-top').hidden = true;
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
  const activeSeat=seat ?? seatOfLive(round.active),r=activeSeat.getBoundingClientRect();
  const compact=getComputedStyle(bar).display!=='none';
  // Only one action panel is needed. Both layouts keep the same legal moves.
  top.hidden=compact;
  const controls=compact?bar:top;
  const visible=el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
  const protectedEls=[...document.querySelectorAll('.card,.hand-total,.seat .spot.staked,.seat .sidearcs,.sideresult,#wallet,#bottom-right,#table-pick,#player-choices,#rehearsal')].filter(visible);
  const obstacles=protectedEls.map(el=>el.getBoundingClientRect());
  const totals=[...activeSeat.querySelectorAll('.hand-total')].map(el=>el.getBoundingClientRect());
  const anchor={x:r.x,bottom:Math.max(r.y,...totals.map(b=>b.bottom))};
  const placement=placeActions({width:controls.offsetWidth,height:controls.offsetHeight,
    viewport:{width:innerWidth,top:Math.min(innerHeight*.35,$('#table2d').getBoundingClientRect().top),bottom:$('#dealer-picker').getBoundingClientRect().top},anchor,obstacles,belowAnchor:true});
  if(placement){
    controls.style.position='fixed';controls.style.transform='none';controls.style.bottom='auto';
    controls.style.left=`${placement.x}px`;controls.style.top=`${placement.y}px`;
    controls.style.setProperty('--action-pointer-x',`${Math.max(16,Math.min(controls.offsetWidth-16,r.x-placement.x))}px`);
    controls.classList.toggle('above-hand',placement.y<r.y);
  }
}

$('#deal-now').onclick = async () => { if(round||busy)return; if(bets.some(b=>b.main>LIMITS.max||b.pp>LIMITS.max/2||b.tp>LIMITS.max/2)){hint('CLASSIC LIMIT','Reduce or clear your selected bets: 2,000 per main bet, 1,000 per side bet.');renderBets();return;} try { if(!await ensureLogin('Sign in to start this round. Your selected bets will stay in place.'))return; if(betTotal()>balance){hint('BALANCE','Add funds or reduce your bet.');renderBets();return;} if(!round&&!busy)void dealSequence(); } catch(e){hint('SIGN IN',e.message);} };

async function beginDealingTake() {
  try {
  const currentOwner = speechPoseGate?.state.actionOwner ?? 'none';
  updatePoseState({ dealerPose: 'action', actionOwner: currentOwner === 'none' ? 'dealer-action' : currentOwner,
    idlePresented: null }, 'action-started');
  await speechQueue.idle;
  // A previous player take may have released the controller before the dealer
  // continues. Reclaim it so late chat cleanup cannot interrupt this card run.
  localPresentation?.state({ action: true });
  if(performancePlayer){if(performancePlayer.joins)performancePlayer.beginSequence();console.info('[deal] Presented-frame performance sequence');return;}
  } catch (error) { console.warn('[deal] Filmed action unavailable:', error.message); }
}

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
  const dealerTotal = handValue(round.dealer).total;
  const dealerBJ = round.dealer.length === 2 && dealerTotal === 21;
  const allBusted = live.length > 0 && live.every(h => h.busted || handValue(h.cards).total > 21);
  if (dealerBJ) voice.say('dealerblackjack', { force: true });
  else if (win?.blackjack) { sfx.play('bigwin'); bjFlash('BLACKJACK'); voice.say('blackjack', { force: true }); }
  else if (allBusted) { /* already voiced on the hit; never celebrate a dealer bust the player didn't beat */ }
  else if (dealerTotal > 21 && win) { sfx.play('win'); voice.say('dealerbust', { force: true }); }
  else if (win) { sfx.play('win'); voice.say('win', { force: true }); }
  else if (anyPush && !anyLose) voice.say('push', { force: true });
  else voice.say('lose', { force: true });
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
function setChatOpen(open) {
  if(studioPreview)return;
  $('#chat-log').classList.toggle('open', open);
  chatToggle?.setAttribute('aria-expanded', String(open));
  if (open && chatToggle) delete chatToggle.dataset.unread;
}
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
  chatToggle.onclick = () => { clearTimeout(chatLog.t); setChatOpen(!$('#chat-log').classList.contains('open')); };
  $('#chat').append(chatToggle);
  chatStatus = document.createElement('span'); chatStatus.id = 'chat-status';
  chatElapsed = document.createElement('span'); chatElapsed.setAttribute('aria-hidden', 'true');
  chatStatus.setAttribute('role', 'status'); $('#chat').append(chatStatus);
  $('#chat').addEventListener('keydown', event => { if (event.key === 'Escape') setChatOpen(false); });
  matchMedia('(max-width: 860px)').addEventListener('change', event => { if (event.matches) setChatOpen(false); });
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
  setChatOpen(!compactChat());
  if (compactChat() && role !== 'user' && chatToggle) chatToggle.dataset.unread = 'true';
  panel.scrollTop = panel.scrollHeight;
  while (panel.children.length > 24) panel.firstChild.remove();
  clearTimeout(chatLog.t);
  chatLog.t = setTimeout(() => setChatOpen(false), 26000);
  return row;
}

async function playRecorded(id, signal) {
  return localPresentation?.present({ type: 'speak', line: id }, { signal });
}

function refreshNextDealChat(){
  if(!nextDealControls)return;
  nextDealControls.querySelector('button').hidden=!nextDealChat&&!activeDealSpeech;
}
function setMovingSpeechAvailable(available){
  movingSpeechAvailable=available===true;
  if(nextDealControls)nextDealControls.hidden=!movingSpeechAvailable;
  if(!movingSpeechAvailable){
    const toggle=$('#chat-next-deal');if(toggle)toggle.checked=false;
    cancelNextDealChat();
  }
}
function cancelNextDealChat(){
  nextDealChat=null;
  if(activeDealSpeech?.jobId)speechPoseGate?.cancel(activeDealSpeech.jobId,'explicit-interrupt');
  refreshNextDealChat();
}
function finishMovingDealStep(owned){
  const step=owned.sequence?.steps[owned.stepIndex];if(!step)return;
  if(owned.lastFrame<step.end-2)throw Error('moving_deal_card_frame_missing');
  localCards?.finish(owned.token,step.event.shoeDraw,true);
  const event=step.event,{card,liveIndex,visibleCards}=movingDealCard(round,event);
  const container=event.to==='dealer'?$('#dealer-cards'):boxContainer(liveIndex);
  dealCardTo(container,card,{faceDown:event.faceDown,shoeDraw:event.shoeDraw,motion:{localCompleted:true}});
  if(visibleCards?.length)updateBadge(container,visibleCards);
}
function movingDealFrame(owned,sequence,k){
  if(owned!==activeDealSpeech||owned.version!==tableVersion||sequence.version!==tableVersion||k<owned.lastFrame||k-owned.lastFrame>2)throw Error('stale_moving_deal_frame');
  const index=sequence.steps.findIndex(step=>k>=step.first&&k<step.end);
  if(index!==owned.stepIndex){
    if(index!==owned.stepIndex+1)throw Error('moving_deal_step_skipped');
    finishMovingDealStep(owned);owned.stepIndex=index;
    owned.token=localCards?.begin(sequence.steps[index].video,sequence.steps[index].event);
  }
  owned.lastFrame=k;
  localCards?.frame(owned.token,sequence.frames[k].frame/24);
}
function movingDealEnd(owned){
  if(owned.completed)return;
  if(owned.stepIndex!==owned.sequence.steps.length-1)throw Error('moving_deal_incomplete');
  finishMovingDealStep(owned);owned.completed=true;
}

async function playChatDecision(decision, signal, jobId) {
  if(studioPreview)throw Error('Genererat tal är avstängt i provspel.');
  if (decision.kind === 'silence') return;
  const dealSpeech=pendingChatReplies.get(jobId)?.dealSpeech;
  localPresentation?.state({ speech: true, ready: false });
  updatePoseState({ dealerPose: dealSpeech?'deal-speech':decision.kind === 'generatedText' && !decision.speechPackage && !decision.speechStream ? 'standard-idle' : 'speech',
    speechOwner: `chat-${jobId}`, idlePresented: null }, 'chat-speech-started');
  try {
    if (decision.kind === 'generatedText') {
      speaking = true;
      try {
        if (decision.visualMode === 'generated-lipsync-stream-preview' || decision.speechStream) {
          if (decision.visualMode !== 'generated-lipsync-stream-preview' || !decision.speechStream || decision.speechPackage
            || decision.requestId !== jobId) throw new Error('invalid_speech_stream_decision');
          const checkStreamPose = () => {
            const state = speechPoseGate.state, job = speechPoseGate.get(jobId), identity = poseIdentity();
            if (signal?.aborted || !job || job.status !== 'speaking' || job.dealerId !== identity.dealerId
              || job.sessionRevision !== identity.sessionRevision || job.roundRevision !== identity.roundRevision
              || state.speechOwner !== `chat-${jobId}` || state.actionOwner !== (dealSpeech?`deal-chat-${jobId}`:'none') || state.dealerPose !== (dealSpeech?'deal-speech':'speech')
              || (dealSpeech&&(activeDealSpeech!==dealSpeech||decision.speechStream.presentationVersion!==tableVersion))
              || !state.visible || state.muted) throw new Error('stale_speech_stream_pose');
          };
          const beforeStreamStart = async () => {
            checkStreamPose(); await pendingChatReplies.get(jobId)?.beforeStart?.(); checkStreamPose();
          };
          setChatStatus('Förbereder röst och läppsynk…');
          await playGeneratedSpeech(decision.speechStream, { exactText: decision.exactText, dealerId: DEALER.key,
            requestId: jobId, mount: $('#scene'), signal, beforeStart: beforeStreamStart, assertCurrent: checkStreamPose,
            prepareRendering: (compositing,framing) => layerComposition?.prepareClip(compositing ?? undefined,framing),
            renderFrame: (video, presented) => layerComposition?.renderFrame(video, presented) ?? false,
            setMovingSpeechLayer: layer => layerComposition?.setMovingSpeechLayer(layer),
            ...(dealSpeech?{
              onSequenceReady:sequence=>{checkStreamPose();if(sequence.version!==dealSpeech.version)throw Error('moving_deal_version');dealSpeech.sequence=sequence;localCards?.sync(round);},
              onSequenceFrame:(sequence,k)=>movingDealFrame(dealSpeech,sequence,k),
              onSequenceEnd:()=>movingDealEnd(dealSpeech),
            }:{}),
            streamObserver: pendingChatReplies.get(jobId)?.nativeP6Observer,
            onStart: text => {
              const pending = pendingChatReplies.get(jobId);
              if (chatStatus && pending) chatStatus.dataset.playbackMs = String(Math.round(performance.now() - pending.requestedAt));
              setChatStatus(`${DEALER.name} svarar`); showCaption(text, 27000);
            },
            onFirstFrame: () => {
              const pending = pendingChatReplies.get(jobId);
              if (chatStatus && pending) chatStatus.dataset.firstFrameMs = String(Math.round(performance.now() - pending.requestedAt));
            },
            onReceipt: receipt => {
              const pending = pendingChatReplies.get(jobId); if (pending) pending.playbackReceipt = receipt;
              pending?.nativeP6Receipt?.(receipt);
              chatPlaybackDiagnostic.stream(jobId, receipt);
              nativeObservation.emit('playback', { event: 'speech', source: 'generated-lipsync-stream',
                synthetic: Boolean(pending?.synthetic), ...receipt, requestId: jobId });
            },
          });
        } else
        if (decision.visualMode === 'generated-lipsync-preview' && decision.speechPackage) {
          setChatStatus('Förbereder röst och läppsynk…');
          await playGeneratedSpeech(decision.speechPackage, { exactText: decision.exactText, dealerId: DEALER.key, mount: $('#scene'), signal,
            beforeStart: pendingChatReplies.get(jobId)?.beforeStart,
            prepareRendering: compositing => layerComposition?.prepareClip(compositing ?? undefined),
            renderFrame: video => layerComposition?.renderFrame(video) ?? false,
            onStart: text => {
              const pending = pendingChatReplies.get(jobId);
              if (chatStatus && pending) chatStatus.dataset.playbackMs = String(Math.round(performance.now() - pending.requestedAt));
              setChatStatus(`${DEALER.name} svarar`); showCaption(text, 27000);
            },
            onReceipt: receipt => {
              const pending=pendingChatReplies.get(jobId);if(pending)pending.playbackReceipt=receipt;
              nativeObservation.emit('playback', { event: 'speech', source: pending?.probe ? 'probe' : 'generated-lipsync', synthetic: Boolean(pending?.synthetic), ...receipt, requestId: jobId });
            },
          });
        } else {
          // Registered dealers never silently inherit the browser's voice.
          // A preparation profile is not an exact generated audio/video package.
          const pending = pendingChatReplies.get(jobId);
          if (pending) pending.voiceUnavailable = true;
          chatPlaybackDiagnostic.finish(jobId, 'text-only');
          nativeObservation.emit('playback', { event: 'speech', state: 'fallback',
            reason: 'dealer-generated-media-unavailable', renderer: 'text-only', source: 'generated-lipsync', requestId: jobId });
        }
      }
      finally { speaking = false; }
      return;
    }
    if (localPresentationEnabled) {
      showCaption(decision.exactText, 5000);
      chatPlaybackDiagnostic.finish(jobId, 'text-only');
      nativeObservation.emit('playback', { event: 'speech', state: 'fallback', reason: 'recorded-chat-exact-text-unverified', renderer: 'text-only' });
      return;
    }
  } finally {
    $('#caption').classList.remove('show');
    updatePoseState({ dealerPose: 'unknown', speechOwner: 'none', idlePresented: null }, 'chat-speech-completed');
    localPresentation?.state({ speech: false, ready: false });
  }
}

$('#chat-send').onclick = () => void sendChat();
$('#chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') void sendChat(); });
if(localPresentationEnabled&&!studioPreview){
  nextDealControls=document.createElement('div');nextDealControls.hidden=!movingSpeechAvailable;
  const label=document.createElement('label'),toggle=document.createElement('input'),cancel=document.createElement('button');
  toggle.type='checkbox';toggle.id='chat-next-deal';label.append(toggle,document.createTextNode(' Svara under nästa utdelning'));
  cancel.type='button';cancel.textContent='Avbryt';cancel.hidden=true;cancel.onclick=()=>{cancelNextDealChat();setChatStatus('Planerat svar avbrutet. Texten finns kvar.');};
  toggle.onchange=()=>{if(!toggle.checked)cancelNextDealChat();};nextDealControls.append(label,cancel);$('#chat').append(nextDealControls);
  $('#chat-input').addEventListener('input',()=>{if(nextDealChat&&$('#chat-input').value.trim()!==nextDealChat.message)cancelNextDealChat();});
  window.addEventListener('pagehide',cancelNextDealChat,{once:true});
}
const astridCamera = !studioPreview
  ? createAstridCameraControl({ container: $('#chat'), identity: () => ({ ...poseIdentity(), playerId: player?.id }),
    dealerName: DEALER.name, wakeNames: [...new Set([DEALER.name, DEALER.key])],
    presentationContext: () => chatPresentationContext(entrySelection, DEALER.key),
    canStart: () => !chatBusy && !speaking,
    onActivity: () => probeClient?.activity(),
    onPlaybackToggle: () => setMuted(!voice.muted),
    onPlaybackEnable: () => setMuted(false),
    getPlaybackEnabled: () => !voice.muted,
    send: ({ message, images, profileRevision }) => sendChat({ message, images, profileRevision }) }) : null;
if (astridCamera) {
  document.body.classList.add('astrid-voice-ui');
  const voiceStyle = document.createElement('link'); voiceStyle.rel = 'stylesheet'; voiceStyle.href = '/astrid-voice-shell.css'; document.head.append(voiceStyle);
}

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
if (astridCamera) setChatOpen(false);
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

async function sendChat({ message: reviewedMessage, images = [], profileRevision = null, dealSpeech=null } = {}) {
  if(studioPreview){setChatStatus(STUDIO_PREVIEW_NOTICE);return false;}
  const input = $('#chat-input');
  const message = (reviewedMessage ?? input.value).trim();
  if (!message || chatBusy) return false;
  if(!dealSpeech&&reviewedMessage===undefined&&$('#chat-next-deal')?.checked&&movingSpeechAvailable){
    if(busy){setChatStatus('Vänta tills den pågående utdelningen är klar.');return false;}
    nextDealChat={message,dealerId:DEALER.key,sessionRevision:clientSessionRevision};refreshNextDealChat();
    setChatStatus('Frågan sparad för nästa utdelning. Du kan avbryta.');return true;
  }
  probeClient?.activity();
  if (reviewedMessage === undefined) input.value = '';
  chatBusy = true;
  $('#chat-send').disabled = true;
  if (compactChat()) input.blur();
  const requestedAt = performance.now();
  setChatStatus('Förbereder svar…');
  if (chatStatus) { chatStatus.dataset.stages = '[]'; delete chatStatus.dataset.playbackMs; delete chatStatus.dataset.firstFrameMs;
    delete chatStatus.dataset.failureCode; delete chatStatus.dataset.providerMetrics; chatStatus.title = ''; }
  const waitTimer = localPresentationEnabled ? setInterval(() => { chatElapsed.textContent = ` ${Math.floor((performance.now() - requestedAt) / 1000)} s`; }, 1000) : null;
  const chatCorrelation=nativeObservation.context();
  const history = chatHistory.slice(-30).map(({ role, text }) => ({ role, text }));
  const requestId = crypto.randomUUID();
  chatPlaybackDiagnostic.begin(requestId);
  const identity = poseIdentity();
  nativeObservation.emit('chat',{role:'user',text:message,source:'openclaw-chat',contextMessages:history},chatCorrelation);
  localPresentation?.observeChat(message);
  chatLog('user', message);
  chatHistory.push({ role: 'user', text: message });
  const received = speechPoseGate.receive({ jobId: requestId, ...identity, requestFingerprint: requestId });
  const controller = new AbortController();
  pendingChatReplies.set(requestId, { correlation: chatCorrelation, message, controller, requestedAt,dealSpeech });
  const stages = [];
  let previewRow = null;
  try {
    if (received.record.status === 'cancelled') throw new Error(received.record.reason);
    if(dealSpeech){dealSpeech.jobId=requestId;speechPoseGate.reserveDeal(requestId,dealSpeech.version);refreshNextDealChat();}
    const r = await apiFetch('/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: localPresentationEnabled ? 'application/x-ndjson' : 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ requestId, message, history, dealer: DEALER.key, acceptsSpeechStream: true,
        ...(chatPresentationContext(entrySelection,DEALER.key)?{presentationContext:chatPresentationContext(entrySelection,DEALER.key)}:{}),
        sessionRevision: identity.sessionRevision, roundRevision: identity.roundRevision,
        ...(dealSpeech?{presentationVersion:dealSpeech.version}:{}),
        ...(images.length ? { observation: { version: 1, turnId: requestId, consentTurnId: requestId, profileRevision, images } } : {}) }),
    });
    const decision = await readChatResponse(r, progress => {
      stages.push({ stage: progress.stage, elapsedMs: progress.elapsedMs, ...(progress.metrics ? { metrics: progress.metrics } : {}) });
      if (chatStatus) {
        chatStatus.dataset.stages = JSON.stringify(stages);
        if (progress.metrics) chatStatus.dataset.providerMetrics = JSON.stringify(progress.metrics);
        chatStatus.title = stages.map(item => `${CHAT_STAGES[item.stage]} ${(item.elapsedMs / 1000).toFixed(1)} s`).join('\n');
        if (chatStatus.dataset.providerMetrics) {
          const { runpodDelayMs, runpodExecutionMs } = JSON.parse(chatStatus.dataset.providerMetrics);
          if (runpodDelayMs !== undefined) chatStatus.title += `\nRunPod-kö ${(runpodDelayMs / 1000).toFixed(1)} s`;
          if (runpodExecutionMs !== undefined) chatStatus.title += `\nRunPod-körning ${(runpodExecutionMs / 1000).toFixed(1)} s`;
        }
      }
      setChatStatus(CHAT_STAGES[progress.stage]);
      nativeObservation.emit('status', { state: 'chat-progress', requestId, stage: progress.stage, elapsedMs: progress.elapsedMs,
        ...(progress.metrics ? { metrics: progress.metrics } : {}) }, chatCorrelation);
    }, exactText => {
      previewRow = chatLog('vera', exactText, true);
      previewRow.title = 'Svarstext klar · förbereder röst och läppsynk';
      const pending = pendingChatReplies.get(requestId);
      if (pending) { pending.previewRow = previewRow; pending.previewText = exactText; }
    });
    clearInterval(waitTimer);
    setChatStatus(decision.kind === 'silence' ? '' : 'Svar klart · väntar på ledigt bord');
    if (decision.kind !== 'silence'&&!dealSpeech) localPresentation?.state({ ready: true });
    speechPoseGate.responseReady(requestId, decision);
    const receipt = await received.completion;
    if (receipt.status === 'failed') throw new Error(receipt.reason || 'Speech failed');
    if (receipt.status === 'cancelled') {
      chatPlaybackDiagnostic.finish(requestId, 'cancelled', receipt.reason);
      if (chatStatus) chatStatus.dataset.failureCode = chatFailureCode(receipt.reason);
      setChatStatus(chatFailureMessage(receipt.reason));
    }
    else {
      if(dealSpeech&&input.value.trim()===message)input.value='';
      chatPlaybackDiagnostic.finish(requestId, decision.kind === 'silence' ? 'silent' : 'unverified');
      setChatStatus(decision.kind === 'silence' ? 'Astrid valde att inte svara på det meddelandet.'
        : pendingChatReplies.get(requestId)?.voiceUnavailable ? `${DEALER.name}s röstvideo saknas. Svaret visas som text.` : '');
    }
    return receipt.status==='completed';
  } catch (error) {
    if (previewRow?.classList.contains('pending')) previewRow.remove();
    const reason = speechPoseGate.get(requestId)?.reason || error.message || 'chat-failed';
    if (chatStatus) chatStatus.dataset.failureCode = chatFailureCode(reason);
    speechPoseGate.cancel(requestId, reason);
    chatPlaybackDiagnostic.finish(requestId, 'failed', reason);
    setChatStatus(reason === 'speech_autoplay_blocked'
      ? 'Webbläsaren blockerade ljudet. Tillåt ljud för sidan och skicka frågan igen.' : chatFailureMessage(reason));
    nativeObservation.emit('status', { state: 'chat-failed', requestId, reason }, chatCorrelation);
    return false;
  } finally {
    pendingChatReplies.delete(requestId);
    chatBusy = false;
    clearInterval(waitTimer);
    $('#chat-send').disabled = false;
  }
}

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

function setTable(id) {
  const next = TABLES.find(x => x.id === id && x.available) ?? TABLES.find(x => x.available);
  if (!next || next === table || round || busy) return;
  table = next; CHIPS = table.chips;
  bets = bets.map(() => ({ main: 0, pp: 0, tp: 0 }));   // old stakes are off-limits here
  undoStack = [];
  buildChips();
  document.querySelectorAll('#table-pick .tbl').forEach(b => b.classList.toggle('on', b.dataset.id === next.id));
  $('#limits').textContent = `${fmt(table.min)} \u2013 ${fmt(table.max)}`;
  hint(table.name, balance < table.min
    ? `min is ${fmt(table.min)} — add funds to play here`
    : `${fmt(table.min)} to ${fmt(table.max)} a box`);
  renderBets();
}
document.querySelectorAll('#table-pick .tbl').forEach(b => { b.onclick = () => setTable(b.dataset.id); });
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
const allowedDealerKeys = Array.isArray(entrySelection.choices?.dealers)
  ? new Set(entrySelection.choices.dealers) : new Set([DEALER.key]);
for (const dealer of Object.values(DEALERS)) {
  if (allowedDealerKeys && !allowedDealerKeys.has(dealer.key)) continue;
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.dealer = dealer.key;
  const available=previewSession?.dealerAvailability.find(row=>row.id===dealer.key);
  if(previewSession&&available?.playable!==true){button.disabled=true;button.title='Saknar spelbart grundklipp. Lägg till det under Dealers & klipp.';}
  button.setAttribute('aria-label', `${dealer.name}'s table`);
  button.setAttribute('aria-pressed', String(dealer.key === DEALER.key));
  const portrait = document.createElement('span');
  portrait.textContent = dealer.name.slice(0,1); portrait.setAttribute('aria-hidden','true');
  const name = document.createElement('span'); name.textContent = dealer.name;
  button.append(portrait, name);
  button.onclick = () => {
    if (button.disabled || dealer.key === DEALER.key) return;
    if (round || busy) {
      $('#dealer-switch-status').textContent = 'Finish this round to change tables.';
      return;
    }
    location.href = dealerVersionPath(dealer.key, 'original', location.search);
  };
  $('#dealer-options').appendChild(button);
}


buildChips();
$('#limits').textContent = `${fmt(table.min)} \u2013 ${fmt(table.max)}`;
// calibration overlay: applies any saved tweaks, then lies dormant until `C`
if(!studioPreview) import('./calibrate.mjs').then(m => { m.applySavedSeats?.(); if (m.applySaved()) layoutSeats(); }).catch(() => {});

$('#pitboss')?.remove();
$('#supervisor')?.remove();
// Diagnostics expose the shared player only.
window.__croupier = { speechPoseGate, get presentation() { return localPresentation; },
  get round() { return round; } };

renderBets();
setBanner('PLEASE PLACE BETS');
// prepareTable loads the player before opening the server-owned table.


// Optional rehearsal uses the exact in-game playback path, with no generation
// or chat request. This lets every dealer and recorded line be checked locally.
let settleRehearsalInitialization;
if (new URLSearchParams(location.search).get('rehearsal') === '1') {
  const panel = document.createElement('details'); panel.id = 'rehearsal'; panel.open = true;
  panel.addEventListener('toggle', () => { if(round&&!busy)activeBoxHighlight(); });
  panel.innerHTML = `<summary>Dealer rehearsal</summary>
    <label>Dealer<select id="rehearsal-dealer" aria-label="Rehearsal dealer" disabled></select></label>
    <label>Recorded line<select id="rehearsal-line" aria-label="Recorded line" disabled></select></label>
    <p id="rehearsal-status" aria-live="polite">Preparing the table for rehearsal…</p>
    <button id="rehearsal-play" disabled>Play line</button><button id="rehearsal-repeat" disabled>Play twice</button>`;
  $('#scene').appendChild(panel);
  const dealerSelect = panel.querySelector('#rehearsal-dealer');
  for (const d of Object.values(DEALERS)) {
    if (allowedDealerKeys && !allowedDealerKeys.has(d.key)) continue;
    dealerSelect.add(new Option(d.name, d.key));
  }
  dealerSelect.value = DEALER.key;
  dealerSelect.onchange = () => { location.href = dealerVersionPath(dealerSelect.value, 'original', location.search); };
  const lineSelect = panel.querySelector('#rehearsal-line');
  const bank = {};
  for (const id of new Set([...VOICE_LINES, ...Object.keys(bank)])) {
    lineSelect.add(new Option(id.replaceAll('_', ' '), id));
  }
  const status = panel.querySelector('#rehearsal-status');
  let rehearsalInitialized = false;
  const update = () => {
    if (!rehearsalInitialized) { status.textContent = 'Preparing the table for rehearsal…'; return; }
    const id = lineSelect.value;
    if (localPresentationEnabled) {
      status.textContent = (bank[id]?.text ?? LINES[id] ?? id) + ' — shared Studio presentation; exact clip selected at playback.';
      return;
    }
  };
  lineSelect.onchange = update; update();
  const play = async () => {
    const id = lineSelect.value;
    setMuted(false);
    let completed;
    await speechTurn(async signal => { completed = await playRecorded(id, signal); });
    if (localPresentationEnabled && completed !== true) throw new Error('Shared Studio clip did not complete; check playback status.');
    return completed;
  };
  const review = async count => {
    if (!rehearsalInitialized) return;
    const controls=[...panel.querySelectorAll('button,select')];
    controls.forEach(control=>control.disabled=true);
    update();
    if (localPresentationEnabled) status.textContent = `0/${count} completed — reviewing ${lineSelect.value} with the shared Studio presentation.`;
    try { for(let i=0;i<count;i++){
      // The first gesture can unlock the automatic greeting. Queue the
      // requested review behind it instead of silently dropping both plays.
      while(speaking)await new Promise(resolve=>setTimeout(resolve,50));
      const completed = await play();
      if (localPresentationEnabled && completed === true) status.textContent = `${i + 1}/${count} completed — ${lineSelect.value}, shared Studio clip.`;
    } }
    catch(error){status.textContent=`Playback failed: ${error.message}`;}
    finally{controls.forEach(control=>control.disabled=false);}
  };
  panel.querySelector('#rehearsal-play').onclick = () => review(1);
  panel.querySelector('#rehearsal-repeat').onclick = () => review(2);
  const initialControls = [...panel.querySelectorAll('button,select')];
  settleRehearsalInitialization = failed => {
    if (failed) { status.textContent = 'The table could not start. Sign in and reload to rehearse.'; return; }
    rehearsalInitialized = true;
    initialControls.forEach(control => { control.disabled = false; });
    update();
  };

}

const tableReady = prepareTable().catch(e=>{ tableError(e); throw e; });
tableReady.catch(()=>{});
tableReady.then(() => settleRehearsalInitialization?.(false), () => settleRehearsalInitialization?.(true));
if (!studioPreview && localPresentationEnabled) tableReady.then(async () => {
  const { installLissabonProfileUi } = await import('./lissabon-profile.mjs');
  await installLissabonProfileUi({ canSwitch: () => !round && !busy && !chatBusy, beforeSwitch: () => astridCamera?.stop('Profilbyte · Av') });
}).catch(error => console.warn('[Lissabon profile]', error.message));
document.querySelector('#sign-out').onclick=async()=>{if(studioPreview)return;astridCamera?.stop('Utloggad · Av');await api('/api/auth/logout',{});location.reload();};

// Separate explicit chat capability for the bound local lab. It cannot issue
// table commands or supply cards/identity. Only this authenticated native server
// produces the response; the lab owns its own presentation/standard-idle gate.
const labSpeechBridge = studioPreview?null:createNativeSpeechBridge({ href: location.href, opener: window.opener,
  loadMedia: loadGeneratedSpeech,
  onSubmit: async ({ requestId, text, signal }) => {
    if (chatBusy) throw new Error('A chat request is already active');
    await tableReady;
    if (signal.aborted) return;
    if (chatBusy) throw new Error('A chat request is already active');
    chatBusy = true;
    const identity = poseIdentity();
    nativeObservation.emit('chat', { role: 'user', text, source: 'linked-lab-chat', requestId });
    try {
      const response = await apiFetch('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
        body: JSON.stringify({ requestId, message: text, history: [], dealer: DEALER.key,
          ...(chatPresentationContext(entrySelection, DEALER.key) ? { presentationContext: chatPresentationContext(entrySelection, DEALER.key) } : {}),
          sessionRevision: identity.sessionRevision, roundRevision: identity.roundRevision }),
      });
      if (!response.ok) throw new Error('Linked chat unavailable');
      const decision = await response.json();
      const current = poseIdentity();
      if (signal.aborted || current.dealerId !== identity.dealerId || current.sessionRevision !== identity.sessionRevision || current.roundRevision !== identity.roundRevision) throw new Error('Stale linked chat');
      await labSpeechBridge.ready(decision);
    } finally { chatBusy = false; }
  },
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

// Explicit ownQA install. The cookie-owned endpoint must authorize the current
// user before an API is exposed; ordinary dealer launches perform no QA IO.
if (!studioPreview && location.origin === NATIVE_P6_GAME_ORIGIN && localPresentationEnabled
  && new URLSearchParams(location.search).get('nativeP6GamePlayback') === '1') {
  const readNativeP6Availability = () => {
    const state = speechPoseGate.state;
    return {busy:Boolean(busy),hasRound:Boolean(round),chatBusy:Boolean(chatBusy),speaking:Boolean(speaking),
      muted:Boolean(voice.muted),hidden:Boolean(document.hidden),queuePending:speechQueue.pending,
      posePending:speechPoseGate.pendingCount,actionNone:state.actionOwner==='none',speechNone:state.speechOwner==='none',
      standardIdle:state.dealerPose==='standard-idle',idlePresented:state.idlePresented!==null};
  };
  const quietForNativeP6 = () => nativeP6GameAvailability(readNativeP6Availability()).quiet;
  let nativeP6WasDisabled;
  const deliverNativeP6=createNativeP6GameQueueDelivery({identity:poseIdentity,isAvailable:quietForNativeP6,
    gate:speechPoseGate,pending:pendingChatReplies,pendingFields:()=>({correlation:nativeObservation.context()}),
    onAcquire:()=>{nativeP6WasDisabled=$('#chat-send').disabled;chatBusy=true;$('#chat-send').disabled=true;
      localPresentation?.state({ready:true});},
    onRelease:()=>{chatBusy=false;$('#chat-send').disabled=nativeP6WasDisabled;
      if(!pendingChatReplies.size)localPresentation?.state({ready:false});},
  });
  void installNativeP6GamePlayback({href:location.href,identity:poseIdentity,isAvailable:quietForNativeP6,
    readAvailability:readNativeP6Availability,mount:$('#scene'),deliver:deliverNativeP6}).then(api => {
    if (!api) return;
    Object.defineProperty(window, 'croupierNativeP6GamePlayback', { value: api, configurable: true });
    window.addEventListener('pagehide', () => { api.close(); delete window.croupierNativeP6GamePlayback; }, { once: true });
  }).catch(() => { /* Disabled/unauthorized/stale ownQA installs expose no capability. */ });
}
