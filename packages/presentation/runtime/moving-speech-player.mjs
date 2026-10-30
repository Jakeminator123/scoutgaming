import { createMovingSpeechFrameLayer } from '../../../packages/presentation/runtime/moving-speech-frame-layer.mjs';
import { effectiveDealerCompositing } from '../../../packages/presentation/contracts/dealer-compositing.mjs';
import {createMovingSourceFrames} from '../../../packages/presentation/runtime/moving-speech-source-frames.mjs';
import { chatFailureCode } from '../../../packages/presentation/contracts/chat-response.mjs';

const HASH = /^[a-f0-9]{64}$/, ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
// Keep the frame layer's 48-frame ceiling. Slow providers must finish producing
// the reply before audio starts; their encoded reply has a separate hard cap.
const MAX_DECODED_FRAMES = 48, MAX_STAGED_BYTES = 4 * 1024 * 1024;
const TRANSPORT_TIMEOUT_MS = 45000, PLAYBACK_GRACE_MS = 5000;
const fail = code => { throw Error(code); };
const integer = n => Number.isSafeInteger(n) && n >= 0;
const abortError = () => new DOMException('Speech cancelled', 'AbortError');
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
const abortable = (promise, signal) => new Promise((resolve, reject) => {
  const abort = () => reject(abortError());
  signal.addEventListener('abort', abort, { once: true });
  Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  if (signal.aborted) abort();
});
const keys = (value, names) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...names].sort().join(',');

export function movingSpeechSocketURL(path, origin) {
  if (path !== '/moving-speech-stream') fail('invalid_moving_speech_url');
  const url = new URL(path, origin);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) fail('moving_speech_requires_secure_transport');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}

/** The cookie owner and ticket signature are checked at the server. This also
 * rejects substituted descriptors before opening a socket or starting work. */
export async function validateMovingSpeechStream(value, { exactText, dealerId, requestId, now = Date.now() } = {}) {
  if (!keys(value, ['schemaVersion', 'kind', 'id', 'requestId', 'dealerId', 'exactText', 'textSha256',
    'reviewStatus', 'url', 'ticket', 'expiresAt', 'profileRevision', 'avatarSha256', 'attemptId', 'nonce', 'compositing',
    ...(value?.sequenceKind!==undefined?['sequenceKind','sequenceSha256']:value?.presentationVersion!==undefined?['presentationVersion','sequenceSha256']:[])])
    || value.schemaVersion !== 1 || value.kind !== 'moving-speech-stream' || !/^[a-f0-9]{32}$/.test(value.id)
    || !ID.test(value.requestId) || value.requestId !== requestId || value.dealerId !== dealerId
    || !/^[a-z][a-z0-9-]{0,63}$/.test(value.dealerId) || !ID.test(value.attemptId) || !ID.test(value.nonce)
    || ![value.textSha256, value.profileRevision, value.avatarSha256].every(v => typeof v === 'string' && HASH.test(v))
    || typeof exactText !== 'string' || !exactText || exactText.length > 500 || exactText !== exactText.trim()
    || /[\u0000-\u001f\u007f-\u009f]/.test(exactText) || value.exactText !== exactText
    || value.reviewStatus !== 'pending' || value.url !== '/moving-speech-stream'
    || typeof value.ticket !== 'string' || value.ticket.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value.ticket)
    || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + 60000) fail('invalid_moving_speech_descriptor');
  const c = value.compositing;
  if(value.presentationVersion!==undefined&&(!integer(value.presentationVersion)||!value.presentationVersion||!HASH.test(value.sequenceSha256)))fail('invalid_moving_speech_sequence');
  if(value.sequenceKind!==undefined&&(value.sequenceKind!=='idle'||value.presentationVersion!==undefined
    ||!HASH.test(value.sequenceSha256)))fail('invalid_moving_speech_sequence');
  if (c !== null && (!keys(c, ['mode', 'threshold', 'softness', 'despill']) || c.mode !== 'green-screen'
    || !Number.isFinite(c.threshold) || c.threshold < 0 || c.threshold > 1 || !Number.isFinite(c.softness)
    || c.softness <= 0 || c.softness > 1 || !Number.isFinite(c.despill) || c.despill < 0 || c.despill > 1)) fail('invalid_moving_speech_compositing');
  let claims;
  try { claims = JSON.parse(atob(value.ticket.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))); }
  catch { fail('invalid_moving_speech_ticket'); }
  if (claims.sessionId !== value.id || claims.exp !== value.expiresAt || claims.attemptId !== value.attemptId
    || claims.nonce !== value.nonce) fail('moving_speech_ticket_mismatch');
  if (await digest(new TextEncoder().encode(exactText)) !== value.textSha256) fail('moving_speech_text_hash_mismatch');
  return Object.freeze({ ...value, compositing: c && Object.freeze({ ...c }) });
}

async function readReady(message, speech) {
  if (!keys(message, ['t', 'protocol', 'id', 'attemptId', 'nonce', 'plan', 'rest', 'audio',...(speech.sequenceSha256!==undefined?['sequence']:[])]) || message.t !== 'ready'
    || message.protocol !== 1 || message.id !== speech.id || message.attemptId !== speech.attemptId || message.nonce !== speech.nonce) fail('invalid_moving_speech_ready');
  const { plan, rest, audio } = message, b = plan?.binding;
  if (!b || b.sessionId !== speech.id || b.talkId !== speech.requestId || b.dealerId !== speech.dealerId
    || b.profileRevision !== speech.profileRevision || b.textSha256 !== speech.textSha256 || b.avatarSha256 !== speech.avatarSha256
    || b.revision !== 1 || plan.start?.fran_ruta !== 0 || !Array.isArray(plan.timeline) || !plan.timeline.length
    || !keys(rest, ['videoId', 'sha256', 'sourceFrame', 'fps', 'frameCount', 'width', 'height', 'bytes', 'url'])
    || !UUID.test(rest.videoId) || !HASH.test(rest.sha256) || rest.fps !== 24 || !integer(rest.sourceFrame)
    || !integer(rest.frameCount) || rest.sourceFrame >= rest.frameCount || !integer(rest.width) || !integer(rest.height)
    || !rest.width || !rest.height || rest.width > 4096 || rest.height > 4096 || !integer(rest.bytes) || !rest.bytes || rest.bytes > 32 * 1024 * 1024
    || rest.url !== `/api/moving-speech/${speech.id}/rest`
    || (!message.sequence&&plan.timeline.some(row => row.take !== 'vila' || row.frame !== 0 || row.sourceSha256 !== rest.sha256))
    || !keys(audio, ['format', 'sampleRate', 'channels', 'byteLength']) || audio.format !== 's16le' || audio.sampleRate !== 24000
    || audio.channels !== 1 || !integer(audio.byteLength) || !audio.byteLength || audio.byteLength % 2 || audio.byteLength > 1200000
    || plan.timeline.length !== Math.floor((audio.byteLength / 2 + 18000) / 1000)
    || (audio.byteLength / 48000 + .22) * 24 > plan.timeline.length) fail('invalid_moving_speech_ready');
  const sequence=message.sequence;
  if(sequence){
    const idle=speech.sequenceKind==='idle';
    if((idle?sequence.kind!=='idle':sequence.version!==speech.presentationVersion)||await digest(new TextEncoder().encode(JSON.stringify(sequence)))!==speech.sequenceSha256
      ||!keys(sequence,[idle?'kind':'version','steps','sources','frames'])||!Array.isArray(sequence.frames)||!sequence.frames.length||sequence.frames.length>1000
      ||!Array.isArray(sequence.steps)||!sequence.steps.length||sequence.steps.length>32||!Array.isArray(sequence.sources)||sequence.sources.length>32)fail('invalid_moving_speech_sequence');
    const sources=new Map();
    for(const s of sequence.sources){
      if(!UUID.test(s.videoId)||s.take!=='clip-'+s.videoId||sources.has(s.take)||!HASH.test(s.sha256)||s.fps!==24
        ||!integer(s.frameCount)||!s.frameCount||s.frameCount>600||s.width!==rest.width||s.height!==rest.height
        ||!integer(s.bytes)||!s.bytes||s.bytes>32*1024*1024||typeof s.url!=='string'||!s.url.startsWith('/api/presentation/registered-video/')
        ||s.url.includes('\\')||s.url.includes('#'))fail('invalid_moving_speech_source');
      sources.set(s.take,s);
    }
    let end=0;
    if(idle&&(sequence.sources.length!==1||sequence.steps.length!==1))fail('invalid_moving_speech_steps');
    for(const step of sequence.steps){
      const s=sources.get('clip-'+step.video?.id);
      if(!s||step.first!==end||step.video.sha256!==s.sha256)fail('invalid_moving_speech_steps');
      if(idle){
        if(!keys(step,['first','end','video'])||step.video.filmedTake||step.end!==Math.ceil(plan.timeline.length/s.frameCount)*s.frameCount)
          fail('invalid_moving_speech_steps');
      }else if(step.end!==end+s.frameCount||!step.video.filmedTake||step.event?.type!=='deal'
        ||!integer(step.event.shoeDraw)||step.event.shoeDraw<1)fail('invalid_moving_speech_steps');
      for(let k=step.first;k<step.end;k++){const f=sequence.frames[k];if(!f||f.take!==s.take
        ||f.frame!==(idle?k%s.frameCount:k-step.first)||f.sourceSha256!==s.sha256)fail('invalid_moving_speech_steps');}
      end=step.end;
    }
    if(end!==sequence.frames.length)fail('invalid_moving_speech_steps');
    for(let k=0;k<plan.timeline.length;k++){
      const expected=sequence.frames[k]??{take:'vila',frame:0,sourceSha256:rest.sha256},actual=plan.timeline[k];
      if(actual.take!==expected.take||actual.frame!==expected.frame||actual.sourceSha256!==expected.sourceSha256)fail('moving_speech_body_plan_mismatch');
    }
  }
  return { plan, rest, audio, sequence };
}

function wav(pcm, totalFrames) {
  if(totalFrames!==undefined){const padded=new Uint8Array(totalFrames*2000);padded.set(pcm,5280*2);pcm=padded;}
  const bytes = new Uint8Array(44 + pcm.byteLength), view = new DataView(bytes.buffer);
  const word = (offset, text) => [...text].forEach((c, i) => { bytes[offset + i] = c.charCodeAt(0); });
  word(0, 'RIFF'); view.setUint32(4, 36 + pcm.byteLength, true); word(8, 'WAVE'); word(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true); view.setUint32(28, 48000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  word(36, 'data'); view.setUint32(40, pcm.byteLength, true); bytes.set(pcm, 44);
  return new Blob([bytes], { type: 'audio/wav' });
}

/** Verify the original bytes, then observe the exact decoded source frame. No
 * approximate-duration video or independently looping body clock is used. */
export async function loadMovingSpeechRest(rest, { signal, document = globalThis.document, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(rest.url, { signal, credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
  if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'video/mp4'
    || Number(response.headers.get('content-length')) > rest.bytes) { await response.body?.cancel(); fail('moving_speech_rest_unavailable'); }
  const reader = response.body?.getReader(), parts = []; let size = 0;
  if (!reader) fail('moving_speech_rest_unavailable');
  try { for (;;) { const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > rest.bytes) { await reader.cancel(); fail('moving_speech_rest_size'); } parts.push(value);
  } } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  if (size !== rest.bytes || await digest(bytes) !== rest.sha256) fail('moving_speech_rest_hash_mismatch');
  if (signal?.aborted) throw abortError();
  // A delayed rVFC describes a presented frame, but drawImage(video) can see
  // newer pixels once play() advances. Reuse the exact MP4 sample decoder and
  // retain only the declared rest frame; there is no independent video clock.
  const cache = createMovingSourceFrames({ sources: [rest], frames: [
    { take: 'clip-' + rest.videoId, frame: rest.sourceFrame, sourceSha256: rest.sha256 },
  ] }, { signal, document, limit: 1,
    // Reuse the bytes already fetched and verified above. This does not make
    // another network request or bypass the shared decoder's hash validation.
    fetchImpl: async () => new Response(bytes, { headers: { 'content-type': 'video/mp4' } }),
  });
  try {
    await cache.prefetch(0);
    if (signal?.aborted) throw abortError();
    const frame = cache.get(0), canvas = document.createElement('canvas');
    canvas.width = canvas.videoWidth = rest.width; canvas.height = canvas.videoHeight = rest.height;
    canvas.getContext('2d').drawImage(frame, 0, 0);
    return canvas; // Independent pixels survive cache.close().
  } finally { cache.close(); }
}

/** One authenticated, bounded session. Caller retains the existing queue/pose
 * ownership; assertCurrent is also checked on every audio-clock repaint. */
export async function playMovingSpeech(value, { exactText, dealerId, requestId, signal, beforeStart = async () => {}, assertCurrent = () => {},
  prepareRendering, renderFrame, setMovingSpeechLayer, onSequenceReady, onSequenceFrame, onSequenceEnd,
  onStart = () => {}, onFirstFrame = () => {}, onReceipt = () => {} } = {}, dependencies = {}) {
  const doc = dependencies.document ?? globalThis.document;
  const connect = dependencies.connect ?? ((url, protocols) => new WebSocket(movingSpeechSocketURL(url, location.origin), protocols));
  const makeLayer = dependencies.makeLayer ?? createMovingSpeechFrameLayer;
  const loadRest = dependencies.loadRest ?? loadMovingSpeechRest;
  const raf = dependencies.requestAnimationFrame ?? globalThis.requestAnimationFrame;
  const caf = dependencies.cancelAnimationFrame ?? globalThis.cancelAnimationFrame;
  const scheduleTimeout = dependencies.setTimeout ?? globalThis.setTimeout, cancelTimeout = dependencies.clearTimeout ?? globalThis.clearTimeout;
  const createURL = dependencies.createURL ?? URL.createObjectURL, revokeURL = dependencies.revokeURL ?? URL.revokeObjectURL;
  const now = dependencies.now ?? (() => performance.now()), timings = {};
  let connectedAt, socketOpenedAt;
  const mark = key => { timings[key] = Math.max(0, Math.round(now() - connectedAt)); };
  const controller = new AbortController(), audio = doc.createElement('audio');
  let socket, layer, restCanvas, bodyFrames, ready, speech, pendingBinary, frameHandle, audioURL, queued = 0, queuedBytes = 0;
  let received = 0, receivedParts = 0, credited = 0, released = 0, pcmReady = false, workerDone = false, audioEnded = false;
  let starting = false, started = false, firstFrame = false, completed = false, terminal = false, tail = Promise.resolve();
  const staged = [];
  let stagedBytes = 0, decoding, playbackDurationMs, playbackTimeout;
  let resolveDone, rejectDone, failureCode;
  const noteFailure = error => { failureCode ??= chatFailureCode(error?.name === 'AbortError' ? 'chat_cancelled' : error?.message); };
  const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
  // Rejection can happen while awaiting descriptor validation or beforeStart.
  done.catch(() => {});
  const send = message => { if (socket?.readyState === 1) socket.send(JSON.stringify(message)); else if (!workerDone || ready?.sequence) fail('moving_speech_socket_closed'); };
  const stop = error => {
    if (terminal) return; noteFailure(error); terminal = true; audio.pause(); audio.muted = true; controller.abort();
    if (frameHandle !== undefined) caf(frameHandle);
    rejectDone(error);
  };
  const abort = () => stop(abortError());
  signal?.addEventListener('abort', abort, { once: true });
  const transportTimeout = scheduleTimeout(() => stop(Error('moving_speech_timeout')), TRANSPORT_TIMEOUT_MS);
  const check = () => { if (signal?.aborted || controller.signal.aborted) throw abortError(); assertCurrent(); };
  const credit = count => {
    const frames = Math.min(count, ready.plan.timeline.length - credited);
    if (frames > 0) { send({ t: 'credit', id: ready.plan.start.id, frames }); credited += frames; }
  };
  const finish = () => { if (audioEnded && workerDone && !terminal) {
    if(ready.sequence)send({t:'played',id:ready.plan.start.id});
    completed = terminal = true; resolveDone(); } };
  const finishAudioPlayback = () => {
    if (terminal) return;
    try {
      check(); audioEnded = true; if (frameHandle !== undefined) caf(frameHandle);
      if(ready.sequence){
        if(released<ready.sequence.frames.length-2)fail('moving_speech_sequence_incomplete');
        if(released===ready.sequence.frames.length-2){
          const k=ready.sequence.frames.length-1,source=bodyFrames.get(k);
          if(renderFrame(source)!==true)fail('moving_speech_render_failed');onSequenceFrame?.(ready.sequence,k);
        }
        onSequenceEnd?.(ready.sequence);
      }
      if (renderFrame(restCanvas) !== true) fail('moving_speech_render_failed'); finish();
    } catch (error) { stop(error); }
  };
  const decodeAhead = () => {
    if (decoding) return decoding;
    decoding = (async () => {
      while (!terminal && staged.length && layer.bufferedFrames + staged[0].meta.rutor.length <= MAX_DECODED_FRAMES) {
        check(); const chunk = staged.shift();
        try {
          if (!await layer.push(chunk.meta, chunk.bytes)) fail('moving_speech_rejected_chunk');
          check();
        } finally { stagedBytes -= chunk.bytes.byteLength; chunk.bytes.fill(0); }
      }
    })().finally(() => { decoding = null; });
    return decoding;
  };
  const tick = () => {
    if (terminal || audioEnded) return;
    try {
      check();
      // Native ended/paused state can precede the queued DOM ended event.
      if (audio.ended) { finishAudioPlayback(); return; }
      if (audio.paused) fail('moving_speech_audio_paused');
      const k = Math.floor((audio.currentTime + (ready.sequence?0:.22)) * 24 + 1e-7);
      if (k < released || (k<ready.plan.timeline.length&&!layer.hasFrame(k))) fail('moving_speech_frame_unavailable');
      layer.releaseBefore(Math.min(k,ready.plan.timeline.length)); released = k;
      void decodeAhead().catch(stop);
      const row=ready.sequence?.frames[k]??{take:'vila',frame:0,sourceSha256:ready.rest.sha256};
      const source=ready.sequence?.frames[k]?bodyFrames.get(k):restCanvas;
      if (renderFrame(source, { binding: ready.plan.binding, planSha256: ready.plan.planSha256,
        ...row, audioPlaying: true, audioTimeSeconds: audio.currentTime-(ready.sequence ? .22 : 0),
        ...(ready.sequence?{speechFrame:k}:{}) }) !== true) fail('moving_speech_render_failed');
      if(ready.sequence?.frames[k]){onSequenceFrame?.(ready.sequence,k);void bodyFrames.prefetch(k).catch(stop);}
      else if(ready.sequence)onSequenceEnd?.(ready.sequence);
      if (!firstFrame) { firstFrame = true; mark('first_visible_frame_ms'); onFirstFrame(); }
      frameHandle = raf(tick);
    } catch (error) { stop(error); }
  };
  const maybeStart = async () => {
    if (starting || started || !pcmReady || !workerDone) return;
    starting = true;
    await decodeAhead(); check();
    for (let k = ready.sequence?0:5; k < Math.min(24, ready.plan.timeline.length); k++) if (!layer.hasFrame(k)) fail('moving_speech_frame_unavailable');
    check(); await abortable(beforeStart(), controller.signal); check();
    if(ready.sequence&&renderFrame(bodyFrames.get(0))!==true)fail('moving_speech_render_failed');
    await abortable(audio.play(), controller.signal); check();
    if (audio.paused) fail('moving_speech_audio_paused');
    // Generation/download and actual playback each need their own bounded budget.
    cancelTimeout(transportTimeout);
    playbackTimeout = scheduleTimeout(() => stop(Error('moving_speech_timeout')), Math.ceil(playbackDurationMs) + PLAYBACK_GRACE_MS);
    started = true; mark('first_playing_ms'); onStart(exactText); onReceipt({ state: 'start', streamId: speech.id, requestId: speech.requestId,
      evidence: 'media-playing', planSha256: ready.plan.planSha256, reviewStatus: 'pending', timings: { ...timings } });
    tick();
  };
  const processMessage = async data => {
    check();
    if (typeof data !== 'string') {
      if (!(data instanceof ArrayBuffer) || !pendingBinary) fail('moving_speech_unpaired_binary');
      const pending = pendingBinary; pendingBinary = null; const bytes = new Uint8Array(data);
      if (pending.t === 'pcm') {
        if (bytes.byteLength !== ready.audio.byteLength || await digest(bytes) !== ready.plan.binding.audioSha256) fail('moving_speech_pcm_hash_mismatch');
        check(); mark('first_media_ms');
        if (socketOpenedAt !== undefined) timings.socket_to_media_ms = Math.max(0, Math.round(now() - socketOpenedAt));
        const audioBlob = wav(bytes,ready.sequence?Math.max(ready.sequence.frames.length,ready.plan.timeline.length):undefined);
        playbackDurationMs = (audioBlob.size - 44) / 48000 * 1000;
        audioURL = createURL(audioBlob); audio.src = audioURL; audio.preload = 'auto'; pcmReady = true; credit(24);
      } else {
        if (!bytes.byteLength) fail('invalid_moving_speech_bytes');
        if (stagedBytes + bytes.byteLength > MAX_STAGED_BYTES) fail('moving_speech_queue_full');
        staged.push({ meta: pending, bytes }); stagedBytes += bytes.byteLength;
        received += pending.rutor.length; receivedParts++;
        // Replenish only the chunk just retained, not the whole plan. Outstanding
        // network credit stays at most 24 without depending on audio playback.
        credit(pending.rutor.length);
      }
      return;
    }
    if (pendingBinary) fail('moving_speech_missing_binary');
    let message; try { message = JSON.parse(data); } catch { fail('invalid_moving_speech_message'); }
    if (keys(message, ['t', 'code']) && message.t === 'error' && message.code === 'moving_speech_unavailable') fail(message.code);
    if (!ready) {
      ready = await readReady(message, speech);
      const createdLayer = await makeLayer({ plan: ready.plan, document: doc });
      if (controller.signal.aborted) createdLayer.close();
      check(); layer = createdLayer;
      const loadedRest = await loadRest(ready.rest, { signal: controller.signal, document: doc });
      if (controller.signal.aborted) loadedRest.width = loadedRest.height = 0;
      check(); restCanvas = loadedRest;
      if(ready.sequence){
        if(speech.presentationVersion!==undefined&&(typeof onSequenceReady!=='function'||typeof onSequenceFrame!=='function'||typeof onSequenceEnd!=='function'))fail('moving_speech_sequence_owner_missing');
        await onSequenceReady?.(ready.sequence);check();
        const firstVideo=ready.sequence.steps[0].video;
        if(ready.sequence.steps.some(s=>JSON.stringify(s.video.compositing??null)!==JSON.stringify(firstVideo.compositing??null)
          ||JSON.stringify(s.video.framing??null)!==JSON.stringify(firstVideo.framing??null)))fail('moving_speech_geometry_changed');
        await prepareRendering(effectiveDealerCompositing(firstVideo.compositing??undefined),firstVideo.framing);check();
        bodyFrames=(dependencies.createSourceFrames??createMovingSourceFrames)(ready.sequence,{signal:controller.signal,document:doc});
        await bodyFrames.prefetch(0);check();
      }
      setMovingSpeechLayer(layer);
      if (renderFrame(restCanvas) !== true) fail('moving_speech_render_failed');
    } else if (message.t === 'pcm' && !pcmReady && keys(message, ['t', 'id', 'byteLength'])
      && message.id === speech.id && message.byteLength === ready.audio.byteLength) pendingBinary = message;
    else if (message.t === 'lapp' && pcmReady && !workerDone) {
      if (message.id !== ready.plan.start.id || message.fran !== received || message.del !== receivedParts
        || !Array.isArray(message.rutor) || !message.rutor.length || message.rutor.length > 12
          || received + message.rutor.length > credited || received + message.rutor.length > ready.plan.timeline.length
          || message.rutor.some((tag, i) => tag!==null&&(!tag || tag.tagning !== ready.plan.timeline[received+i].take
          || tag.ruta !== ready.plan.timeline[received+i].frame || !Array.isArray(tag.rect)
          || tag.rect.length !== 4 || tag.rect.some(n => !Number.isFinite(n) || n < 0) || tag.rect[2] <= 0 || tag.rect[3] <= 0
          || tag.rect[0] + tag.rect[2] > ready.rest.width || tag.rect[1] + tag.rect[3] > ready.rest.height))) fail('invalid_moving_speech_chunk');
      // Retain only bounded protocol fields, not arbitrary JSON extensions.
      pendingBinary = { t: message.t, id: message.id, del: message.del, fran: message.fran,
        rutor: message.rutor.map(tag => tag === null ? null : { tagning: tag.tagning, ruta: tag.ruta, rect: [...tag.rect] }) };
    } else if (message.t === 'done' && keys(message, ['t', 'id', 'frames']) && !workerDone
      && message.id === ready.plan.start.id && message.frames === ready.plan.timeline.length && received === message.frames) {
      workerDone = true; mark('reply_ready_ms'); await maybeStart(); finish();
    } else fail('invalid_moving_speech_message');
  };
  try {
    if (typeof prepareRendering !== 'function' || typeof renderFrame !== 'function' || typeof setMovingSpeechLayer !== 'function'
      || typeof raf !== 'function' || typeof caf !== 'function') fail('moving_speech_renderer_unavailable');
    check(); speech = await validateMovingSpeechStream(value, { exactText, dealerId, requestId }); check();
    if (!dependencies.makeLayer && typeof VideoDecoder !== 'function') fail('moving_speech_decoder_unavailable');
    await abortable(beforeStart(), controller.signal); check();
    await abortable(prepareRendering(effectiveDealerCompositing(speech.compositing ?? undefined)), controller.signal); check();
    if (speech.expiresAt <= Date.now()) fail('moving_speech_ticket_expired');
    audio.onended = finishAudioPlayback;
    audio.onerror = () => stop(Error('moving_speech_audio_failed'));
    connectedAt = now();
    socket = connect(speech.url, ['moving-v1', `ticket.${speech.ticket}`]); socket.binaryType = 'arraybuffer';
    socket.onopen = () => { socketOpenedAt = now(); mark('socket_open_ms'); };
    socket.onmessage = event => {
      if (terminal) return;
      // The initial envelope includes up to 1000 sequence frames plus the speech plan.
      const size = typeof event.data === 'string' ? event.data.length * 2 : event.data?.byteLength;
      if (!integer(size) || size > (typeof event.data === 'string' ? (ready ? 256 : 1024) * 1024 : 2 * 1024 * 1024)
        || queued >= 8 || queuedBytes + size > 4 * 1024 * 1024) return stop(Error('moving_speech_queue_full'));
      queued++; queuedBytes += size;
      tail = tail.then(() => processMessage(event.data)).catch(stop).finally(() => { queued--; queuedBytes -= size; });
    };
    socket.onerror = () => stop(Error('moving_speech_socket_failed'));
    socket.onclose = () => { tail.then(() => { if (!workerDone||(ready?.sequence&&!audioEnded)) stop(Error('moving_speech_socket_closed')); }); };
    await done;
  } catch (error) {
    noteFailure(error); throw error;
  } finally {
    terminal = true; cancelTimeout(transportTimeout); cancelTimeout(playbackTimeout); signal?.removeEventListener('abort', abort); controller.abort();
    audio.pause(); audio.muted = true; audio.onended = audio.onerror = null;
    if (frameHandle !== undefined) caf(frameHandle);
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      if (socket.readyState === 1 && !completed) socket.send(JSON.stringify({ t: 'abort', id: speech?.id }));
      socket.close();
    }
    setMovingSpeechLayer?.(null); layer?.close(); bodyFrames?.close();
    for (const chunk of staged) chunk.bytes.fill(0);
    staged.length = 0;
    // Clear the last mouth patch with the explicitly verified bank rest only.
    if (restCanvas) { try { assertCurrent(); renderFrame(restCanvas); } catch { /* A new pose now owns the compositor. */ }
      restCanvas.width = restCanvas.height = 0; }
    audio.removeAttribute('src'); audio.load(); if (audioURL) revokeURL(audioURL);
    onReceipt({ state: completed ? 'end' : 'interrupted', streamId: value?.id, requestId: value?.requestId,
      evidence: 'media-lifecycle', started, firstFrame, reviewStatus: 'pending',
      timings: { ...timings },
      ...(failureCode ? { failureCode } : {}),
      frameCounts: { received, released, total: ready?.plan.timeline.length ?? 0 } });
  }
}
