import { validateSpeechPackage } from './speech-package.mjs';
import { SpeechStreamPlayer } from './speech-stream-client.mjs';
import {createLayerComposition} from './presentation-composition.mjs';
import {effectiveDealerCompositing} from '../../packages/presentation/contracts/dealer-compositing.mjs';
import { playMovingSpeech } from './moving-speech-player.mjs';

function speechRenderer(mount, prepareRendering, renderFrame) {
  if (typeof prepareRendering === 'function' && typeof renderFrame === 'function') return {prepareRendering,renderFrame,close(){}};
  if (prepareRendering || renderFrame) throw Error('Dealer background removal unavailable');
  // Native and legacy speech callers use the same compositor even when they
  // have no independently configured room planes. Media/audio ownership stays
  // with this player; this adapter only draws the presented video frame.
  const composition=createLayerComposition({documentElement:document.documentElement,defaultView:document.defaultView,
    querySelector:()=>mount,createElement:tag=>document.createElement(tag)},null);
  if (!composition) throw Error('Dealer background removal unavailable');
  return {prepareRendering:value=>composition.prepareClip(value),renderFrame:video=>composition.renderFrame(video),close:()=>composition.close()};
}

const mediaPath = /^\/api\/generated-speech\/[a-f0-9-]{32,64}\/(audio|video)$/;
const abortError = () => new DOMException('Speech cancelled', 'AbortError');
const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
const abortable = (pending, signal) => new Promise((resolve, reject) => {
  const stop = () => reject(abortError());
  signal.addEventListener('abort', stop, { once: true });
  Promise.resolve(pending).then(resolve, reject).finally(() => signal.removeEventListener('abort', stop));
  if (signal.aborted) stop();
});

/** A live preview has text/session provenance, not final audio/video hashes. */
export async function validateGeneratedSpeechStream(value, { exactText, dealerId, requestId, now = Date.now() } = {}) {
  const keys = ['schemaVersion', 'kind', 'id', 'requestId', 'dealerId', 'exactText', 'textSha256', 'reviewStatus', 'url', 'ticket', 'expiresAt'];
  if(value?.schemaVersion===2) keys.push('profileRevision','imageSha256','compositing');
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length
    || keys.some(key => !Object.hasOwn(value, key))) throw new Error('invalid_speech_stream_descriptor');
  const speech = { ...value };
  if (![1,2].includes(speech.schemaVersion) || speech.kind !== 'generated-speech-stream' || !/^[a-f0-9]{32}$/.test(speech.id)
    || typeof speech.requestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(speech.requestId)
    || (requestId !== undefined && speech.requestId !== requestId) || (speech.schemaVersion===1 ? speech.dealerId !== 'astrid' : !/^[a-z][a-z0-9-]{0,63}$/.test(speech.dealerId) || !/^[a-f0-9]{64}$/.test(speech.profileRevision) || !/^[a-f0-9]{64}$/.test(speech.imageSha256)) || speech.dealerId !== dealerId
    || typeof exactText !== 'string' || !exactText || exactText.length > 500 || exactText !== exactText.trim()
    || /[\u0000-\u001f\u007f-\u009f]/.test(exactText) || speech.exactText !== exactText || !/^[a-f0-9]{64}$/.test(speech.textSha256)
    || speech.reviewStatus !== 'pending' || speech.url !== '/speech-stream' || typeof speech.ticket !== 'string'
    || speech.ticket.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(speech.ticket)
    || !Number.isSafeInteger(speech.expiresAt) || speech.expiresAt <= now || speech.expiresAt > now + 60000) throw new Error('invalid_speech_stream_descriptor');
  if(speech.schemaVersion===2&&speech.compositing!==null){
    const c=speech.compositing;
    if(!c||Object.keys(c).sort().join(',')!=='despill,mode,softness,threshold'||c.mode!=='green-screen'
      ||!Number.isFinite(c.threshold)||c.threshold<0||c.threshold>1||!Number.isFinite(c.softness)||c.softness<=0||c.softness>1
      ||!Number.isFinite(c.despill)||c.despill<0||c.despill>1)throw new Error('invalid_speech_stream_compositing');
    speech.compositing=Object.freeze({...speech.compositing});
  }
  let claims;
  try { claims = JSON.parse(atob(speech.ticket.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))); }
  catch { throw new Error('invalid_speech_stream_ticket'); }
  // Only the server verifies the signature and cookie owner. The browser also
  // rejects an accidentally substituted ticket before any paid work starts.
  if (claims.sessionId !== speech.id || claims.exp !== speech.expiresAt) throw new Error('speech_stream_ticket_mismatch');
  if (await sha256(new TextEncoder().encode(exactText)) !== speech.textSha256) throw new Error('speech_stream_text_hash_mismatch');
  return Object.freeze(speech);
}

async function playGeneratedSpeechStream(value, { exactText, dealerId, requestId, mount, signal,
  beforeStart = async () => {}, onStart = () => {}, onFirstFrame = () => {}, onReceipt = () => {}, streamObserver, prepareRendering, renderFrame } = {}) {
  if (!mount || signal?.aborted) throw abortError();
  const controller = new AbortController();
  const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 45000);
  let player, surface, video, renderHandle, renderKind, renderer, started = false, completed = false;
  try {
    const speech = await validateGeneratedSpeechStream(value, { exactText, dealerId, requestId });
    // Admission starts TTS/GPU work. Revalidate the shared queue/pose before
    // opening the socket, then again immediately before its first play().
    await abortable(Promise.resolve().then(beforeStart), controller.signal);
    renderer=speechRenderer(mount,prepareRendering,renderFrame);
    await abortable(Promise.resolve().then(()=>renderer.prepareRendering(effectiveDealerCompositing(speech.compositing??undefined))),controller.signal);
    if (controller.signal.aborted) throw abortError();
    if (speech.expiresAt <= Date.now()) throw new Error('speech_stream_ticket_expired');
    surface = document.createElement('div'); surface.className = 'generated-speech-surface';
    surface.style.cssText = 'position:absolute;inset:0;z-index:var(--generated-speech-layer,25);background:#101618;overflow:hidden;pointer-events:none;';
    surface.style.visibility = 'hidden';
    video = document.createElement('video'); video.muted = false; video.playsInline = true; video.preload = 'auto';
    video.setAttribute('aria-label', dealerId + ' · strömmad läppsynk, labbprov');
    video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;';
    const label = document.createElement('span'); label.textContent = 'Strömmad läppsynk · labbprov · ej visuellt godkänt';
    label.style.cssText = 'position:absolute;top:var(--generated-speech-label-top,8px);left:8px;padding:5px 8px;background:#101618dd;color:#eee;font:11px sans-serif;';
    surface.append(video, label); mount.append(surface);
    // Draw each decoded frame with the same compositor as the published idle.
    // The video remains the single audio clock; no separately timed mouth layer.
    const draw = () => {
      if(controller.signal.aborted)return;
      try{
        if(renderer.renderFrame(video)!==true)throw Error('Dealer background removal unavailable');
        surface.style.background='transparent';video.style.opacity='0';
        {
          if(video.requestVideoFrameCallback){renderKind='video';renderHandle=video.requestVideoFrameCallback(draw);}
          else if(globalThis.requestAnimationFrame){renderKind='animation';renderHandle=requestAnimationFrame(draw);}
        }
      }catch(error){player.fail(error);}
    };
    player = new SpeechStreamPlayer(video, { signal: controller.signal, beforePlay: beforeStart,
      onBinary: streamObserver?.onBinary,
      onFirstFrame: info => { if (!controller.signal.aborted) {
        draw();if(controller.signal.aborted||player.stopped)return;
        surface.style.visibility = ''; onFirstFrame(); streamObserver?.onFrame?.({ info, video, surface, player });
      } },
      onStart: () => {
        started = true; onStart(exactText);
        onReceipt({ state: 'start', streamId: speech.id, requestId: speech.requestId, evidence: 'media-playing', reviewStatus: 'pending',
          timings: { ...player.timings } });
      },
    });
    streamObserver?.onPlayer?.({ player, video, surface });
    await player.connect(speech.url, speech.ticket);
    await player.done;
    completed = true;
  } finally {
    clearTimeout(timer); controller.abort(); signal?.removeEventListener('abort', abort);
    renderer?.close();
    if(renderHandle!==undefined){if(renderKind==='video')video?.cancelVideoFrameCallback?.(renderHandle);else globalThis.cancelAnimationFrame?.(renderHandle);}
    player?.abort(); surface?.remove();
    onReceipt({ state: completed ? 'end' : 'interrupted', streamId: value?.id, requestId: value?.requestId,
      evidence: 'media-lifecycle', started, reviewStatus: 'pending', timings: { ...player?.timings } });
  }
}

export async function loadGeneratedSpeech(value, { exactText, dealerId, signal, fetchImpl = fetch, media: suppliedMedia } = {}) {
  const speech = validateSpeechPackage(value, { requireApproved: false });
  if (speech.schemaVersion !== 2 || speech.source.kind !== 'generatedText' || speech.video.presentation !== 'lipsync'
    || speech.reviewStatus !== 'pending' || speech.exactText !== exactText || speech.dealerId !== dealerId || speech.audioDelayMs !== 0
    || speech.audio.durationMs > 25000 || !mediaPath.test(speech.audio.url) || !mediaPath.test(speech.video.url)) throw new Error('Generated speech does not match this lab reply');
  if (await sha256(new TextEncoder().encode(exactText)) !== speech.generation.textSha256) throw new Error('Generated speech text hash mismatch');
  if (suppliedMedia) {
    if (!(suppliedMedia.audio instanceof ArrayBuffer) || !(suppliedMedia.video instanceof ArrayBuffer)
      || suppliedMedia.audio.byteLength > 2 * 1024 * 1024 || suppliedMedia.video.byteLength > 30 * 1024 * 1024) throw new Error('Invalid transferred speech media');
    // The explicit native/lab bridge supplies bytes, never credentials or a new
    // network URL. The normal same-artifact, MIME, size and hash checks still run.
    fetchImpl = async url => new Response(url === speech.audio.url ? suppliedMedia.audio : suppliedMedia.video,
      { headers: { 'content-type': url === speech.audio.url ? 'audio/wav' : 'video/mp4' } });
  }
  async function read(media, maximum, mime) {
    const response = await fetchImpl(media.url, { signal, credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== mime || Number(response.headers.get('content-length')) > maximum) {
      await response.body?.cancel(); throw new Error('Generated speech media is unavailable');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Generated speech media is empty');
    const chunks = []; let size = 0;
    try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length;
      if (size > maximum) { await reader.cancel(); throw new Error('Generated speech media is too large'); }
      chunks.push(part.value);
    } } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (!size || await sha256(bytes) !== media.sha256) throw new Error('Generated speech media hash mismatch');
    return new Blob([bytes], { type: mime });
  }
  const [audio, video] = await Promise.all([read(speech.audio, 2 * 1024 * 1024, 'audio/wav'), read(speech.video, 30 * 1024 * 1024, 'video/mp4')]);
  if (signal?.aborted) throw abortError();
  return { speech, audio, video };
}

/** The caller owns the pose gate and single speech queue. This owns one exact,
 * hash-checked audio/video pair, never a substitute recorded sentence. */
export async function playGeneratedSpeech(value, { exactText, dealerId, requestId, mount, signal, media, beforeStart = async () => {}, assertCurrent,
  onStart = () => {}, onFirstFrame = () => {}, onReceipt = () => {}, streamObserver, prepareRendering, renderFrame, setMovingSpeechLayer,
  onSequenceReady,onSequenceFrame,onSequenceEnd } = {}) {
  if (value?.kind === 'moving-speech-stream') {
    if (media) throw new Error('Stream playback cannot substitute transferred media');
    return playMovingSpeech(value, { exactText, dealerId, requestId, signal, beforeStart, assertCurrent,
      onStart, onFirstFrame, onReceipt, prepareRendering, renderFrame, setMovingSpeechLayer,onSequenceReady,onSequenceFrame,onSequenceEnd });
  }
  if (value?.kind === 'generated-speech-stream') {
    if (media) throw new Error('Stream playback cannot substitute transferred media');
    return playGeneratedSpeechStream(value, { exactText, dealerId, requestId, mount, signal, beforeStart, onStart, onFirstFrame, onReceipt, streamObserver, prepareRendering, renderFrame });
  }
  if (!mount || signal?.aborted) throw abortError();
  const controller = new AbortController();
  const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), 45000);
  let audio, video, surface, frame, presentedFrame, audioUrl, videoUrl, renderer;
  let started = false, completed = false;
  try {
    const loaded = await loadGeneratedSpeech(value, { exactText, dealerId, signal: controller.signal, media });
    renderer=speechRenderer(mount,prepareRendering,renderFrame);
    await abortable(Promise.resolve().then(()=>renderer.prepareRendering(effectiveDealerCompositing())),controller.signal);
    audioUrl = URL.createObjectURL(loaded.audio); videoUrl = URL.createObjectURL(loaded.video);
    audio = new Audio(audioUrl); audio.preload = 'auto';
    surface = document.createElement('div'); surface.className = 'generated-speech-surface';
    // Each renderer supplies its film layer; local presentation keeps cards above it.
    surface.style.cssText = 'position:absolute;inset:0;z-index:var(--generated-speech-layer,25);background:#101618;overflow:hidden;pointer-events:none;';
    // Keep the previous dealer image visible while this opaque film layer
    // decodes and the caller revalidates its turn. Reveal only a real frame.
    surface.style.visibility = 'hidden';
    video = document.createElement('video'); video.src = videoUrl; video.muted = true; video.playsInline = true; video.preload = 'auto';
    video.setAttribute('aria-label', 'Astrid · genererad läppsynk, labbprov');
    // Match the local film's scene bounds. An in-flow grid video can retain
    // its intrinsic portrait height and overflow before object-fit is applied.
    video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;';
    const label = document.createElement('span'); label.textContent = 'Genererad läppsynk · labbprov · ej visuellt godkänt';
    label.style.cssText = 'position:absolute;top:var(--generated-speech-label-top,8px);bottom:var(--generated-speech-label-bottom,auto);left:8px;padding:5px 8px;background:#101618dd;color:#eee;font:11px sans-serif;';
    surface.append(video, label); mount.append(surface);
    async function ready(media) {
      if (media.readyState >= 3) return;
      await new Promise((resolve, reject) => {
        const clean = () => { media.removeEventListener('canplay', done); media.removeEventListener('error', fail); controller.signal.removeEventListener('abort', fail); };
        const done = () => { clean(); resolve(); }, fail = () => { clean(); reject(new Error('Generated speech decoding failed or was cancelled')); };
        media.addEventListener('canplay', done, { once: true }); media.addEventListener('error', fail, { once: true }); controller.signal.addEventListener('abort', fail, { once: true });
        if (controller.signal.aborted) fail(); else media.load();
      });
    }
    await Promise.all([ready(audio), ready(video)]);
    if (controller.signal.aborted) throw abortError();
    if (!Number.isFinite(audio.duration) || audio.duration > 25.05 || Math.abs(audio.duration * 1000 - loaded.speech.audio.durationMs) > 150
      || !Number.isFinite(video.duration) || Math.abs(video.duration - audio.duration) > 1) throw new Error('Generated speech duration mismatch');
    // Proactive speech revalidates its reservation after media transfer/decoding.
    // This callback is optional for the existing shared playback callers.
    await beforeStart();
    if (controller.signal.aborted) throw abortError();
    const finished = new Promise((resolve, reject) => {
      const clean = () => { audio.removeEventListener('ended', end); audio.removeEventListener('error', fail); video.removeEventListener('error', fail); controller.signal.removeEventListener('abort', fail); };
      const end = () => { clean(); completed = true; resolve(); }, fail = () => { clean(); reject(new Error('Generated speech interrupted')); };
      audio.addEventListener('ended', end, { once: true }); audio.addEventListener('error', fail, { once: true }); video.addEventListener('error', fail, { once: true }); controller.signal.addEventListener('abort', fail, { once: true });
    });
    // Attach a rejection handler before play() so an abort during autoplay
    // cannot leave an unhandled media-completion promise.
    void finished.catch(() => {});
    audio.currentTime = 0; video.currentTime = 0;
    let pictured=false;
    const draw=()=>{
      if(controller.signal.aborted||completed)return;
      try {
        if(renderer.renderFrame(video)!==true)throw Error('Dealer background removal unavailable');
        surface.style.background='transparent';video.style.opacity='0';surface.style.visibility='';
        if(!pictured){pictured=true;onFirstFrame();}
        if(video.requestVideoFrameCallback)presentedFrame=video.requestVideoFrameCallback(draw);
      } catch { controller.abort(); }
    };
    if (video.requestVideoFrameCallback) presentedFrame = video.requestVideoFrameCallback(draw);
    await new Promise((resolve, reject) => {
      const cancel = () => reject(abortError());
      controller.signal.addEventListener('abort', cancel, { once: true });
      Promise.all([video.play(), audio.play()]).then(resolve, reject).finally(() => controller.signal.removeEventListener('abort', cancel));
      if (controller.signal.aborted) cancel();
    });
    if (controller.signal.aborted) throw abortError();
    // Older browsers lack frame callbacks; their decoded playing image is the
    // earliest supported boundary, never the initial empty media element.
    if (!video.requestVideoFrameCallback) draw();
    started = true; onStart(exactText); onReceipt({ state: 'start', packageId: loaded.speech.packageId, evidence: 'media-playing', reviewStatus: 'pending' });
    const sync = () => {
      if (controller.signal.aborted || audio.ended) return;
      if(!video.requestVideoFrameCallback)draw();
      if(controller.signal.aborted)return;
      const delta = video.currentTime - audio.currentTime;
      if (Math.abs(delta) > .2) video.currentTime = audio.currentTime;
      video.playbackRate = delta > .04 ? .97 : delta < -.04 ? 1.03 : 1;
      frame = requestAnimationFrame(sync);
    };
    frame = requestAnimationFrame(sync);
    await finished;
  } finally {
    clearTimeout(timer); controller.abort(); signal?.removeEventListener('abort', abort);
    renderer?.close();
    if (frame != null) cancelAnimationFrame(frame);
    if (presentedFrame != null) video.cancelVideoFrameCallback(presentedFrame);
    audio?.pause(); video?.pause(); surface?.remove();
    if (audioUrl) URL.revokeObjectURL(audioUrl); if (videoUrl) URL.revokeObjectURL(videoUrl);
    onReceipt({ state: completed ? 'end' : 'interrupted', packageId: value?.packageId, evidence: 'media-lifecycle', started, reviewStatus: 'pending' });
  }
}
