import {initPresentation} from './game-presentation.js';
import {enqueueSynchronizedReply} from './chat-response-sync.js';
import {pickQueued,clipDuration} from './chat-priority.js';
// Astrid demo 2.0 - klient.
//
// Scenen: stillbild + två <video> som växlar. Alla klipp (idle, prat, utdelning) börjar och slutar i
// startbilden, så ett byte vid klippgräns syns inte. När inget annat spelas går idle-klippen i en viktad
// slumpföljd så att Astrid lever. Svar och spelhändelser köas och spelas vid nästa klippgräns.
// Medan Astrid "tänker" startas ingen ny idle efter det pågående - svaret ska inte behöva vänta på ett
// helt idle-klipp. Blir tänkandet långt (kallstart) går idle igång igen.

import { createGameAudio } from "./game-audio.js";
import { createTableBoxes } from "./table-boxes.js";
import { createSharedGameTable,tableSession } from "./shared-table.js";
import { createVideoBuffer, tableVideoSources } from "./video-buffer.js";
import { createMediaFetch } from "./media-fetch.js";
import { createLipTracks } from "./lip-layer.js";
import { createVideoPreloader, initialVideoOffset } from "./video-preloader.js";
import { createPlaybackRecovery } from "./playback-recovery.js";
import { dealer, isAlternative, dealerClipUrl, dealerClipVariants, readyVariant, dealerLineUrl, dealerExtraLineUrl, unusedLine, chooseDealer, DEALERS, ROOMS, savedRoom, chooseRoom, tableDealer, PUBLIC_HIDDEN } from "./dealers.js";
import { createDealerLayer } from "./dealer-layer.js";
import { greetingFor } from "./dealer-remarks.js";
import { faceAtTime } from "./card-face-projection.js";

const $ = (s) => document.querySelector(s);
const A = $("#va"), B = $("#vb");
if(new URLSearchParams(location.search).get("diagnostics")==="1")
  import("./playback-diagnostics.js").then(m=>m.installPlaybackDiagnostics());
initPresentation();
const logEl = $("#log"), caption = $("#caption"), statusEl = $("#status"), here = $("#here");
const thinkingEl = $("#thinking"), input = $("#input"), who = $("#who"), soundChip = $("#soundChip");

const esc = (s) => String(s ?? "").replace(/—/g, ", ").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
                set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

let manifest = { idle: [], repliker: [], deal: [] };
let me = "";
let unlocked = false;       // har besökaren rört sidan (ljud tillåtet)
let tableBoxes, gameTable;
let finishCurrent = null;
let playing = null;              // the clip play() is on, and whether it has started (chat answers yield to the table)
const voiceOvers = new Set();    // answers still talking as sound after the table took the screen
// A ready dealer speaking his lines over his clips (server/rorlig-lipsync.mjs): the mouth patches for the dealer layer.
const lips = dealer.ready ? createLipTracks() : null;

// ------------------------------------------------------------------ spelaren ---
const queue = [];           // { url, sound, text, kind }
let cur = null;             // synlig video
let running = false;        // ett klipp spelas
let holdUntil = 0;          // ingen ny idle före denna tid (Astrid tänker)
let lastIdle = "";
let currentItem = null;
let loading = false;
let playToken = 0;
// Use the native HTTP media path on iOS. Keep full-file preparation in the
// browser cache, but do not route its hardware decoder through Blob URLs.
const nativeIOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
// Dealer clips can come from a cache in front of this host (Kevin 12 Oct: media.scoutgg.dev through Cloudflare). The
// server names it in /api/clips (MEDIA_BASE_URL, empty = this host). iOS plays the clip URL itself, so it stays here.
let mediaBase='';
const mediaUrl=u=>mediaBase&&/^\/media\/[^?]+\.mp4(\?|$)/.test(u)?mediaBase+u:u;
const mediaFetch=createMediaFetch(mediaUrl,()=>{if(mediaBase)console.warn('clip cache unavailable here, clips come from this host');mediaBase='';});
const videoBuffer=createVideoBuffer(nativeIOS?{createURL:(_blob,source)=>source,revokeURL:()=>{}}:{fetchImpl:mediaFetch});
const videoPreloader=createVideoPreloader(videoBuffer);
let tableMediaReady=false;
function warmIdle(){if(!tableMediaReady||gameTable?.playing||document.hidden)return;const next=manifest.idle.find(c=>!videoBuffer.has(c.url));if(next)videoBuffer.load(next.url,10).catch(()=>{});}

const audio = createGameAudio({onChange: settings => {
  for(const v of [A,B]) {v.muted=!(v===cur && currentItem?.sound && unlocked && settings.enabled);v.volume=settings.voice;}
  $('#muteAudio').setAttribute('aria-pressed',String(!settings.enabled));
  $('#muteAudio').setAttribute('aria-label',settings.enabled?'Mute audio':'Unmute audio');
  $('#muteAudio').textContent=settings.enabled?'Sound on':'Sound off';
}});
for(const key of ['voice','ambience','effects']) {
  const slider=$(`#${key}Volume`);slider.value=audio.settings[key]*100;
  slider.addEventListener('input',()=>{unlock();audio.set(key,Number(slider.value)/100);});
}
$('#muteAudio').setAttribute('aria-pressed',String(!audio.settings.enabled));
$('#muteAudio').textContent=audio.settings.enabled?'Sound on':'Sound off';
$('#muteAudio').addEventListener('click',()=>{unlock();audio.set('enabled',!audio.settings.enabled);});
const recoverPlayback = createPlaybackRecovery({
  getState: () => ({ video: cur, item: currentItem, running, loading, queued: queue.length }),
  isVisible: () => !document.hidden,
  advance: () => {
    if (finishCurrent) finishCurrent();
    else next();
  },
  onSoundBlocked: () => { soundChip.hidden = false; },
});

function playbackFeedback() {
  const label = (id) => ["deal_posdealer","deal_hole","deal_flip"].includes(id) ? dealer.name : `box ${id.replace("deal_pos", "")}`;
  const waiting = queue.filter((item) => item.id?.startsWith("deal_"));
  $("#playbackState").textContent = currentItem?.id?.startsWith("deal_")
    ? `Dealing to ${label(currentItem.id)}${waiting.length ? ` · ${waiting.length} queued` : ""}`
    : waiting.length ? `Deal to ${label(waiting[0].id)} starts after this clip`
    : gameTable?.preview ? "Choose a box to preview its deal." : "Shared table connected · recorded dealer voice";
}

function pickIdle() {
  const cached = manifest.idle.filter(c=>videoBuffer.has(c.url));
  const pool = (cached.length?cached:manifest.idle.slice(0,1)).filter((c) => !(c.id === lastIdle && c.vikt < 10));   // aldrig samma gest två gånger i rad
  let r = Math.random() * pool.reduce((s, c) => s + c.vikt, 0);
  for (const c of pool) { if ((r -= c.vikt) <= 0) { lastIdle = c.id; return c; } }
  return pool[0];
}

function next() {
  if (loading) return;
  if(gameTable?.busy) { running=false; return; }
  // Mid-round only the dealer's own remarks may play, and only between deals (the plan has ended
  // while the player decides); everything else waits for the round to finish. A chat answer starts only when it
  // can end before the table may need the screen (Emil: answers were cut by the next deal), else it waits.
  const at = pickQueued(queue, { playing: Boolean(gameTable?.playing), quietMs: gameTable?.quietMs ?? Infinity });
  let item = at >= 0 ? queue.splice(at, 1)[0] : null;
  if (!item) {
    // Emil 12 Oct: a ready dealer standing frozen while the players decide looked stiff, so his idles play then too
    // (never while a deal runs: busy above). A card that comes in the middle of one no longer snaps his face back to rest
    // (Kevin 11 Oct): the dealer layer fades the idle's last frame out under the next take.
    if (!manifest.idle.length || Date.now() < holdUntil) { running = false; return; }   // står på stillbilden
    const c = pickIdle();
    item = { url: c.url, sound: false, kind: "idle" };
  }
  running = true;
  play(item);
}

async function play(item) {
  if (isAlternative) {
    // His recorded lines play in the table's language (Swedish or English); anything else he has no take for is skipped.
    const line = item.kind === 'remark' || item.own ? item.url : dealerLineUrl(item.url, document.querySelector('#dealerLanguage')?.value);
    // Not played (no take of it): the caller shows a chat reply as plain text instead. A dealer with no recorded lines
    // at all (Mårten) shows a game line's words as the caption for as long as the line would have run.
    if (!line && (item.kind === 'answer' || item.sound)) {
      if (!dealer.lines && item.text && item.kind !== 'answer') { const ms = Math.max(2500, (Number(item.dur) || 3) * 1000); showCaption(item.text); captionUntil = Date.now() + ms; setTimeout(() => { if (Date.now() >= captionUntil) showCaption(null); }, ms + 50); }
      item.complete?.(false); setTimeout(() => { if (!running && !loading) next(); }, 0); running = false; return; }
    // A manual deal event stands alone: from rest, the card, back to rest.
    item = { ...item, url: line ?? dealerClipUrl(item.url, item.variant ?? (item.kind === 'event' ? 'iu' : '')) };
  }
  loading = true;
  playing = { item, started: false };
  const token = ++playToken;
  const v = cur === A ? B : A;
  v.onended = v.oncanplay = v.onerror = v.ontimeupdate = null;
  v.playbackRate = 1;
  v.muted = !(item.sound && unlocked && audio.settings.enabled);
  v.volume=audio.settings.voice;
  let started = false, done = false, frameId;
  const tick = (_now, frame) => {
    if (done || token !== playToken) return;
    if(item.timelineTime){
      const target=item.timelineTime();
      if(target>=item.dur){finish(true);return;}
      // Catch up after buffering/backgrounding; never replay the beginning of an expired turn.
      if(!v.seeking&&Math.abs(v.currentTime-target)>.4){v.currentTime=target;}
    }
    if(!v.seeking)item.onFrame?.(frame?.mediaTime ?? v.currentTime, Number.isFinite(v.duration) ? v.duration : item.dur);
    if (v.requestVideoFrameCallback) frameId = v.requestVideoFrameCallback(tick);
  };
  const finish = (ok = true) => {
    if (done || token !== playToken) return;
    done = true; loading = false; running = false;
    clearTimeout(loadTimeout);
    if (frameId != null) v.cancelVideoFrameCallback?.(frameId);
    v.onended = v.oncanplay = v.onerror = v.ontimeupdate = null;
    finishCurrent = null;
    if (Date.now() >= captionUntil) showCaption(null); audio.speech(false);
    item.complete?.(ok);
    // Give the game sequencer a microtask to queue the next draw before idle.
    setTimeout(() => { if (!running && !loading) next(); }, 0);
  };
  finishCurrent = finish;
  const loadTimeout = setTimeout(() => {
    if (!started) { sys("The clip could not load. Reconnecting to the table.", "err"); finish(false); }
  }, 60000);
  const start = () => {
    if (started || done || token !== playToken) return;
    started = true;
    // A ready dealer's take runs a little slower so it ends with its slot: no frozen gap before the next card.
    // Card faces follow the clip's own time (onFrame), so they stay with his hand.
    if (item.fit && Number.isFinite(v.duration) && Math.abs(v.duration - item.fit) > 0.02) {
      // Shorter clip: stretch it to the slot. Longer (Emil's takes at their own pace, slotted on Astrid's): speed it up.
      const rate = Math.min(2, Math.max(.6, v.duration / item.fit)), wall = item.timelineTime;
      v.playbackRate = rate; item.dur = v.duration;
      if (wall) item.timelineTime = () => wall() * rate;
    }
    const offset=item.timelineTime?.()??item.startOffset;
    if(item.timelineTime&&offset>=item.dur){finish(true);return;}
    const seek=initialVideoOffset(offset,v.duration||item.dur);
    if(seek) v.currentTime=seek;
    // Show the prepared layer BEFORE play(), so mobile WebKit does not start
    // decoding into an invisible layer and retain its first displayed frame.
    v.classList.add("on");
    if(cur&&cur!==v){cur.classList.remove("on");cur.pause();}
    v.play().then(() => {
      if (done || token !== playToken) return;
      clearTimeout(loadTimeout);
      v.classList.add("on");
      if (cur && cur !== v) { cur.classList.remove("on"); cur.pause(); }
      cur = v; currentItem = item; loading = false; audio.speech(Boolean(item.sound) || voiceOvers.size > 0); if (playing?.item === item) playing.started = true;
      if(item.kind==='idle')warmIdle();
      document.querySelector('#stage').dataset.clip = item.id ?? item.kind;
      // A dealer with a voice is heard, not captioned over the table (Kevin 10 Oct); Mårten (no voice yet) keeps his words.
      playbackFeedback(); tableBoxes?.setActive(item.id); if (item.text || Date.now() >= captionUntil) showCaption(isAlternative && !dealer.lines ? item.text : null);
      gameTable?.sourceStarted(item.id);
      item.onStart?.();
      if (v.requestVideoFrameCallback) frameId = v.requestVideoFrameCallback(tick);
      else v.ontimeupdate = tick;
      if (item.sound && !unlocked) soundChip.hidden = false;
    }).catch(() => {
      if (done || token !== playToken) return;
      if (!v.muted) { v.muted = true; started = false; start(); soundChip.hidden = false; }
      else { sys("Unable to play the clip", "err"); finish(false); }
    });
  };
  v.oncanplay = start;
  v.onended = () => finish(true);
  v.onerror = () => { if (item.kind !== "idle") sys("Unable to play the clip", "err"); finish(false); };
  try {
    const ready=await videoPreloader.consume(v,item.url);
    if(!ready||done||token!==playToken)return;
    if(v.readyState>=3)start();
  } catch {if(!done&&token===playToken){sys("Video loading failed. Check your connection and retry.","err");finish(false);}}
}

// The alternative dealer's own lines (greeting, remarks, banter) in the table's language.
let greeted = false;
function remarkNow(id) {
  if (gameTable?.talking) return;   // he is already speaking over his clips (state.talk): no second voice on top
  const url = id && dealerExtraLineUrl(id, $('#dealerLanguage').value);
  if (url) enqueue({ url, sound: true, kind: 'remark', text: null });
}

// The table's next step takes the screen now (shared timeline, it never waits). An answer already speaking talks on as
// sound only while the dealer's film goes on; one that had not started yet goes back to the front of the queue.
function yieldAnswer() {
  const p = playing;
  if (!p || p.item.kind !== 'answer' || !finishCurrent) return;
  if (!p.started) { queue.unshift({ ...p.item }); return; }
  const v = cur;
  if (!v || v.paused || v.ended || v.muted) return;
  const a = new Audio(p.item.url), from = v.currentTime, at = performance.now();
  a.volume = v.volume; a.preload = 'auto'; a.dataset.voiceOver = '1';
  a.addEventListener('loadedmetadata', () => { a.currentTime = Math.min(from + (performance.now() - at) / 1000, a.duration || from); }, { once: true });
  const end = () => { voiceOvers.delete(a); if (!voiceOvers.size && !currentItem?.sound) audio.speech(false); };
  a.onended = a.onerror = end;
  voiceOvers.add(a);
  a.play().then(() => audio.speech(true)).catch(end);
}

function enqueue(item) {
  return new Promise(resolve => {
    queue.push({ ...item, complete: resolve });
    playbackFeedback();
    if (!running && !loading) next();
    else recoverPlayback();
  });
}

// Återuppta även när webbläsaren har pausat videon utan att skicka ended.
setInterval(() => {
  if (!running && Date.now() >= holdUntil) next();
  else recoverPlayback();
}, 400);
document.addEventListener("visibilitychange", () => { if (!document.hidden) recoverPlayback(); });

let captionUntil = 0;   // a text-only line's caption stays this long (dealer without recorded lines)
let talkCaption = null, talkCaptionUntil = 0;   // a line spoken over the clips keeps its caption while the clips change under it
function showCaption(text) {
  if (!text && Date.now() < talkCaptionUntil) text = talkCaption;
  caption.textContent = (text ?? "").replace(/—/g, ", ");
  caption.classList.toggle("on", Boolean(text));
}

// ------------------------------------------------------------------ ljud och grind ---
/** iOS knyter ljudrätten till element som spelats under en riktig gest - båda videorna låses upp här. */
function unlock() {
  audio.unlock();
  if (unlocked) return;
  unlocked = true;
  for (const v of [A, B]) {
    v.muted = !(v===cur && currentItem?.sound && audio.settings.enabled);
    if (v.paused && v.src) v.play().then(() => { if (v !== cur) v.pause(); }).catch(() => {});
  }
}

soundChip.addEventListener("click", () => {
  unlock();
  soundChip.hidden = true;
  audio.set('enabled',true);
  if (cur) { cur.muted = !currentItem?.sound; cur.play().catch(() => {}); }
});
for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => { if (!$("#gate").classList.contains("off")) return; unlock(); recoverPlayback(); }, { passive: true });

// ------------------------------------------------------------------ chatten ---
const pending = new Map();   // svar-id → text som väntar på att matchande klipp ska börja

function bubble(cls, html) {
  const near = logEl.scrollTop + logEl.clientHeight > logEl.scrollHeight - 80;
  const d = document.createElement("div");
  d.className = "msg " + cls;
  d.innerHTML = html;
  logEl.append(d);
  // A reply taller than the log (a phone with the chat docked) shows from its first line, not cut off at the top.
  if (near) logEl.scrollTop = d.offsetHeight > logEl.clientHeight ? d.offsetTop - logEl.offsetTop : logEl.scrollHeight;
  return d;
}
function sys(t, cls = "sys") { const d = document.createElement("div"); d.className = cls; d.textContent = t; logEl.append(d); logEl.scrollTop = logEl.scrollHeight; }

const secs = (ms) => ms == null ? "–" : (ms / 1000).toFixed(1) + " s";
// Kevin 12 Oct: players never see the timings under a dealer reply ("hide"); ?timing shows them for us.
const SHOW_TIMING = new URLSearchParams(location.search).has("timing");
function metaLine(ms) {
  if (!ms || !SHOW_TIMING) return "";
  const parts = ms.llm != null ? [`text ${secs(ms.llm)}`] : [];
  parts.push(`voice ${secs(ms.tts)}`, `lip sync ${secs(ms.lipsync)}`, `total ${secs(ms.total)}`);
  return `<div class="meta">${parts.join(" · ")}</div>`;
}

function render(m) {
  if (m.who === "astrid") return bubble("her", `<span class="name">${esc(dealer.name)}</span>${esc(m.text)}${metaLine(m.ms)}`);
  const mine = m.who === me;
  return bubble(mine ? "me" : "them", (mine ? "" : `<span class="name">${esc(m.who)}</span>`) + esc(m.text));
}

function setThinking(on, queued) {
  thinkingEl.textContent = on ? (queued ? `thinking · ${queued} queued` : "thinking...") : (queued ? `${queued} queued` : "");
  if (on) holdUntil = Math.max(holdUntil, Date.now() + 8000);   // max 8 s stillbild, sedan idle igen
  else holdUntil = Date.now() + 600;                             // svaret är på väg (kommer strax efter)
}

// ------------------------------------------------------------------ rummet ---
let ws, tries = 0;
// While Dragge is chosen, keep his lip-sync GPU awake (it sleeps after 5 quiet minutes); the server
// sends at most one tiny warm-up job per 4 minutes.
setInterval(()=>{ if (["dragge", "paow"].includes(dealer.id) && ws?.readyState === 1 && !document.hidden) ws.send(JSON.stringify({ t: "warm", dealer: dealer.id })); }, 120000);
function connect() {
  ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + `/?session=${encodeURIComponent(tableSession)}`);
  ws.onopen = () => { tries = 0; const n = store.get("astrid.name"); if (n) ws.send(JSON.stringify({ t: "name", name: n }));
    if (["dragge", "paow"].includes(dealer.id)) ws.send(JSON.stringify({ t: "warm", dealer: dealer.id })); };   // wakes his lip-sync GPU before the first question
  ws.binaryType = "arraybuffer";
  let lipMeta = null;   // a {t:'lip'} piece whose bytes come in the next binary frame
  ws.onmessage = (ev) => {
    if (ev.data instanceof ArrayBuffer) { if (lipMeta) lips?.push(lipMeta, new Uint8Array(ev.data)); lipMeta = null; return; }
    const j = JSON.parse(ev.data);
    if (j.t === "lip" && j.bytes) { lipMeta = j; return; }
    switch (j.t) {
      case "hello":
        me = j.name; if (!who.value) who.value = me;
        logEl.innerHTML = ""; j.log.forEach(render);
        // No "Everyone at the table shares this chat." line: the panel stays quiet until someone speaks (John, 9 Oct).
        setThinking(j.thinking, j.queued);
        break;
      case "notice": sys(j.text); break;
      case "lip": lips?.push(j); break;
      case "named": me=j.name;who.value=me;break;
      case "said": render(j); break;
      case "reply":   // håll texten tills den färdiga röst/läppsynken kan börja spelas
        pending.set(j.id, j.text);
        break;
      case "answer": {
        pending.delete(j.id);
        // A dealer's own clip (Dragge) only plays for viewers who chose that dealer; others just read the text.
        if ((j.dealer ?? 'astrid') !== dealer.id) { render({ who: "astrid", text: j.text, ms: j.ms }); break; }
        // Spoken over his clips (state.talk): the words appear when he starts saying them (speak above); no idle starts first.
        if (j.talk) { holdUntil = Math.max(holdUntil, Date.now() + 15000); break; }
        // No clip (Paow, or his voice was not ready in time): show the words now, never behind a deal.
        if (isAlternative && !j.url) { render({ who: "astrid", text: j.text, ms: j.ms }); break; }
        // Its length decides when it may start (chat-priority.js); Astrid's answers carry it, the others' clips are read.
        (Number(j.dur) > 0 ? Promise.resolve(Number(j.dur)) : clipDuration(j.url)).then(dur =>
          enqueueSynchronizedReply(enqueue, { url: j.url, sound: true, text: j.text, kind: "answer", own: Boolean(j.dealer), dur }, () => {
            render({ who: "astrid", text: j.text, ms: j.ms });
          }));
        break;
      }
      case "play":    // Shared manual review must not interrupt a private game round.
        if (gameTable?.playing || gameTable?.busy) break;
        enqueue({ id: j.id, url: j.url, sound: j.sound, text: j.text, kind: "event" });
        if (!j.text) sys(`deal: ${j.id.replace("deal_", "")}`);
        break;
      case "thinking": setThinking(j.on, j.queued); break;
      case "here": break;
      case "status": statusEl.textContent = ""; statusEl.classList.remove("on"); break;
      case "greeting-unavailable": { if(pending.delete(j.id))sys(j.text,"err");break; }
      case "error": if(j.id)pending.delete(j.id);sys("The voice connection is unavailable. Please try again.", "err"); break;
    }
  };
  ws.onclose = () => { setThinking(false, 0); sys("Connection lost. Reconnecting..."); setTimeout(connect, Math.min(800 * ++tries, 5000)); };
  ws.onerror = () => { try { ws.close(); } catch {} };
}

// Emil 11 Oct (#9): the name box looked editable but was read-only. Enter or leaving the box renames you at the table
// (shared-table.js rename); the chat name follows. Escape keeps the old name.
who.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); who.blur(); }   // commits the name, never sends the chat line
  else if (e.key === "Escape") { who.value = me; who.blur(); }
});
who.addEventListener("change", async () => {
  const n = who.value.trim().replace(/\s+/g, " ");
  if (!n || n === me) { who.value = me; return; }
  const name = await gameTable?.rename(n);
  if (!name) { who.value = me; return; }   // taken or invalid: the server's reason is in the game status
  me = name; who.value = name; store.set("astrid.name", name);
  if (ws?.readyState === 1) ws.send(JSON.stringify({ t: "name", name }));
});
$("#form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || ws?.readyState !== 1) return;
  unlock();
  input.value = "";
  ws.send(JSON.stringify({ t: "say", text, dealer: dealer.id }));   // the reply comes in this viewer's dealer's voice
});

// Serhiy: after a round where this viewer's boxes ended differently, ask the dealer they watch for
// the box-by-box result (the server builds it from their own settlement and voices it lip-synced).
// John 12 Oct: the dealer no longer reads out the box-by-box summary after each round ("Förra rundan: Box 4: 25,
// tjock…"); the win/lose lines and the receipt on the table stay. Flip to true to bring the summary back.
const SPEAK_ROUND_SUMMARY = false;
window.addEventListener("dealer:round-result", (e) => {
  if (SPEAK_ROUND_SUMMARY && ws?.readyState === 1) ws.send(JSON.stringify({ t: "roundResult", roundId: e.detail?.roundId, dealer: dealer.id }));
});

// ------------------------------------------------------------------ spelhändelser ---
$("#toggleEvents").addEventListener("click", (e) => {
  const open = $("#events").hidden;
  $("#events").hidden = !open;
  e.currentTarget.setAttribute("aria-expanded", String(open));
});

function requestEvent(id) {
  if (gameTable?.busy || gameTable?.playing) { sys("Finish the round before previewing clips."); return; }
  unlock();
  if (ws?.readyState === 1) ws.send(JSON.stringify({ t: "event", id }));
  else sys("Reconnecting to the table. Please try again shortly.");
}

function eventButtons() {
  // en knapp per spelhändelse - servern slumpar bland variantsna (aldrig samma två gånger i rad)
  const ev = manifest.handelser ?? Object.fromEntries(manifest.repliker.map((l) => [l.id, { handelse: l.handelse, varianter: [l.id] }]));
  $("#lines").innerHTML = Object.entries(ev).map(([id, e]) =>
    `<button data-id="${esc(id)}" title="${e.varianter.length} variants">${esc(id)}<small>${esc(id.replaceAll("_"," "))}</small></button>`).join("");
  $("#deals").innerHTML = manifest.deal.map((d) =>
    `<button data-id="${esc(d.id)}">${esc(d.id.replace("deal_", ""))}<small>${esc(d.id==='deal_hole'?'Face down':d.id==='deal_flip'?'Flip':d.id==='deal_posdealer'?'Dealer':`Box ${d.id.replace('deal_pos','')}`)}</small></button>`).join("");
  for (const b of document.querySelectorAll(".grid button")) {
    b.addEventListener("click", () => requestEvent(b.dataset.id));
  }
}

// ------------------------------------------------------------------ start ---
fetch("/api/clips").then((r) => r.json()).then((m) => {
  if (typeof m.mediaBase === 'string' && /^https:\/\/[a-z0-9.-]+$/.test(m.mediaBase)) mediaBase = m.mediaBase;
  if (isAlternative) m = { ...m, idle: dealer.idles || [], deal: m.deal.map(d => ({ ...d, url: dealerClipUrl(d.url) })),
    // A ready dealer's prop card is bigger than Emil's: the game's card takes its size so the handoff does not jump.
    ...(dealer.ready?.card ? { kort_storlek: { bredd: dealer.ready.card[0], hojd: dealer.ready.card[1] } } : {}) };
  manifest = m;
  tableBoxes = createTableBoxes($("#tableBoxes"), m, (id,field) => {
    if (gameTable?.preview) requestEvent(id); else gameTable?.select(id,field);
  });
  gameTable = createSharedGameTable({ manifest: m, boxes: tableBoxes, unlock, audio,
    // A ready dealer's takes come in four run variants (dealers.js); all are fetched before the table opens,
    // with the dealer's own lines (not Astrid's) so none has to download mid-round.
    prepareMedia:async(seats,onProgress,language)=>{await videoBuffer.prepare(tableVideoSources(m,seats,language).filter(url=>!unusedLine(url)).map(url=>dealerLineUrl(url,language)??url).flatMap(dealerClipVariants),onProgress);tableMediaReady=true;warmIdle();},
    preloadNext:clip=>{if(loading||!cur||unusedLine(clip.url))return;videoPreloader.prepare(cur===A?B:A,dealerLineUrl(clip.url,$('#dealerLanguage').value)??dealerClipUrl(clip.url,clip.variant)).catch(()=>{});},
    warmPlan:plan=>{for(const step of plan?.steps??[])if(step.clip&&!unusedLine(step.clip.url))videoBuffer.load(dealerLineUrl(step.clip.url,$('#dealerLanguage').value)??dealerClipUrl(step.clip.url,readyVariant(plan,step)),0).catch(()=>{});},
    playNow:item=>{yieldAnswer();if(finishCurrent)finishCurrent(true);holdUntil=0;running=true;play(item);},
    // A line over the clips: its sound plays on top of the deal, no idle starts until it ends. True when this viewer hears
    // the language the mouth was synced to (else the line plays without the mouth).
    lips,
    atRest:()=>!running&&!loading,
    hold:ms=>{holdUntil=Math.max(holdUntil,Date.now()+ms);},
    speak:(t,offsetMs,remainMs)=>{
      const lang=$('#dealerLanguage').value,url=t.ljud??dealerLineUrl(t.clip?.url,lang);
      if(!url)return false;
      if(t.kind==='answer')render({who:'astrid',text:t.text});   // the answer's words appear as he starts saying them
      // his mouth is synced to him resting or dealing, never to an idle gesture: an idle playing now fades to his still
      if(currentItem?.kind==='idle'&&finishCurrent){const v=cur;finishCurrent(true);v?.classList.remove('on');v?.pause();}
      // one voice at a time: a remark of his still waiting or playing gives way to the talk track
      for(let i=queue.length-1;i>=0;i--)if(queue[i].kind==='remark')queue.splice(i,1);
      if(currentItem?.kind==='remark'&&finishCurrent)finishCurrent(true);
      const a=new Audio(url),at=performance.now();a.preload='auto';a.dataset.voiceOver='1';a.volume=audio.settings.voice;a.muted=!(unlocked&&audio.settings.enabled);
      a.addEventListener('loadedmetadata',()=>{const o=(offsetMs+performance.now()-at)/1000;if(o>.15)a.currentTime=Math.min(o,a.duration||o);},{once:true});
      const end=()=>{voiceOvers.delete(a);if(!voiceOvers.size&&!currentItem?.sound)audio.speech(false);};
      a.onended=a.onerror=end;voiceOvers.add(a);a.play().then(()=>audio.speech(true)).catch(end);
      holdUntil=Math.max(holdUntil,Date.now()+remainMs+300);
      const words=t.clip?.text??t.text;
      if(words){talkCaption=words;talkCaptionUntil=Date.now()+remainMs;showCaption(words);setTimeout(()=>{if(Date.now()>=talkCaptionUntil&&caption.textContent===talkCaption.replace(/—/g,', '))showCaption(null);},remainMs+50);}
      return t.kind==='answer'||(dealer.lines?.includes(lang)?lang:'en')===t.lang;
    },
    // The alternative dealer's own remarks wait in the queue, so they never cut into a deal.
    remark:id=>remarkNow(id),
    onEnter:name=>{me=name;who.value=name;store.set('astrid.name',name);if(ws?.readyState===1)ws.send(JSON.stringify({t:'name',name}));if(!greeted){greeted=true;remarkNow(greetingFor(name));}},
    isReady:()=>$("#gate").classList.contains("off") && !loading && (!running || currentItem?.kind==='idle'),
    onBusy: busy => {
      for (const button of document.querySelectorAll('.grid button')) button.disabled = busy;
    },
  });
  $("#playerName").value=store.get("astrid.name")||"";
  // Manual event broadcasting is disabled on public tables.
  // Start one full-quality idle. Never flood the connection with decorative clips.
  next();
}).catch(() => sys("Unable to load the clip library", "err"));
connect();

$("#toggleChat").addEventListener("click", e => {
  const open = document.querySelector('.side').classList.toggle('chat-open');
  e.currentTarget.setAttribute('aria-expanded', String(open));
});

// ------------------------------------------------------------------ dealer ---
// Per-viewer dealer picker: swaps the filmed dealer, never the round or the shoe.
{
  if (isAlternative) {
    // Static copy names the dealer; show the one this viewer picked.
    document.title = document.title.replaceAll("Astrid", dealer.name);
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue.includes("Astrid") && !n.parentElement.closest("#log")) n.nodeValue = n.nodeValue.replaceAll("Astrid", dealer.name);
    for (const el of document.querySelectorAll("[aria-label*=Astrid],[placeholder*=Astrid]")) {
      for (const a of ["aria-label", "placeholder"]) if (el.getAttribute(a)) el.setAttribute(a, el.getAttribute(a).replaceAll("Astrid", dealer.name));
    }
  }
  const still = document.querySelector("#stage .still");
  // A phone taller than 9:16 leaves a band under the plate: fill it with a blurred copy of the room, not black.
  if (still) still.addEventListener("load", () => document.documentElement.style.setProperty("--plate-bg", `url("${still.currentSrc}")`));   // on <html>: the stage band and the desktop page both use it
  if (still) { still.src = dealer.keyed ? savedRoom().still : dealer.still; still.alt = `${dealer.name} at the blackjack table`; }
  if (dealer.keyed) fetch("/api/clips").then(r => r.json()).then(m => {
    const at = Object.fromEntries(m.deal.map(d => [d.id.replace("deal_pos", "").replace("deal_", ""), [d.kort.cx, d.kort.cy]]));
    at.dealer = at.dealer ?? [540, 895]; at.hole = [540, 895];
    createDealerLayer({ stage: document.querySelector("#stage"), still: dealer.keyed.still, land: dealer.land, cardAt: t => at[t], faceAt: faceAtTime, scale: dealer.layerScale ?? .8, inFrames: dealer.ready?.in ?? 0, finished: !!dealer.ready,
      keyHalf: dealer.ready?.card ? [Math.ceil(dealer.ready.card[0] / 2) + 4, Math.ceil(dealer.ready.card[1] / 2) + 4] : [38, 48], lips });
  }).catch(() => {});
  // A studio table keeps the dealer it was built with (its deals are timed on his takes).
  const dealerChoices = tableDealer ? [DEALERS[tableDealer]] : Object.values(DEALERS).filter(d => !PUBLIC_HIDDEN.includes(d.id));   // Mårten only on his own studio tables
  const picker = document.querySelector("#dealerPick");
  if (picker) {
    picker.innerHTML = dealerChoices.map(d => `<option value="${d.id}">${d.name}</option>`).join("");
    picker.value = dealer.id;
    picker.addEventListener("change", () => {
      if (gameTable?.playing) { picker.value = dealer.id; sys("Change dealer between rounds."); return; }
      chooseDealer(picker.value);
    });
  }
  // Left panel: pick the dealer by face, and the room behind a keyed dealer.
  const faces = document.querySelector("#studioDealers"), rooms = document.querySelector("#studioRooms"), note = document.querySelector("#studioNote");
  if (faces && rooms) {
    faces.innerHTML = dealerChoices.map(d => `<button type="button" class="studio-face" data-dealer="${d.id}" aria-pressed="${d.id === dealer.id}"><img src="${d.face}" alt=""><span>${d.name}</span></button>`).join("");
    faces.addEventListener("click", e => {
      const b = e.target.closest("[data-dealer]");
      if (!b || b.dataset.dealer === dealer.id) return;
      if (gameTable?.playing) { note.textContent = "Change dealer between rounds."; return; }
      chooseDealer(b.dataset.dealer);
    });
    const room = savedRoom();
    rooms.innerHTML = ROOMS.map(r => `<button type="button" class="studio-room" data-room="${r.id}" aria-pressed="${!!dealer.keyed && r.id === room.id}" ${dealer.keyed ? "" : "disabled"}><img src="${r.thumb}" alt=""><span>${r.name}</span></button>`).join("");
    note.textContent = dealer.keyed ? "" : `${dealer.name} is filmed in her own room.`;
    rooms.addEventListener("click", e => {
      const b = e.target.closest("[data-room]");
      if (!b || b.disabled) return;
      const r = ROOMS.find(x => x.id === b.dataset.room);
      chooseRoom(r.id); if (still) still.src = r.still;
      for (const x of rooms.children) x.setAttribute("aria-pressed", String(x === b));
    });
  }
}
