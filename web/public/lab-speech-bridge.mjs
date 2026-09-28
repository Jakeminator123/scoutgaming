import { validateSpeechPackage } from './speech-package.mjs';

// Deliberately separate from the read-only native observation protocol. This
// capability permits one chat request, never game commands or browser-owned state.
export const LAB_SPEECH_BRIDGE_LIMITS = Object.freeze({ audioBytes: 2 * 1024 * 1024, videoBytes: 30 * 1024 * 1024,
  textChars: 500, requestCount: 512, timeoutMs: 300000, maximumTimeoutMs: 360000 });
const TYPE = 'croupier-lab-speech';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const channelId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value);
const nonceId = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const text = value => typeof value === 'string' && value.length > 0 && value.length <= LAB_SPEECH_BRIDGE_LIMITS.textChars
  && value === value.trim() && !/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(value);
const revision = value => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(value);
const sha = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', value))].map(byte => byte.toString(16).padStart(2, '0')).join('');
const safeCall = (callback, ...args) => { try { const result = callback?.(...args); if (result?.catch) void result.catch(() => {}); return result; } catch { return undefined; } };
const loopbackOrigin = value => {
  try { const url = new URL(value); return value === url.origin && ['http:', 'https:'].includes(url.protocol)
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.username && !url.password; } catch { return false; }
};
const timeout = value => Number.isSafeInteger(value) && value > 0 && value <= LAB_SPEECH_BRIDGE_LIMITS.maximumTimeoutMs
  ? value : LAB_SPEECH_BRIDGE_LIMITS.timeoutMs;

function packet(event, binding, nonce = null) {
  const value = event?.data;
  if (event?.source !== binding.source || event?.origin !== binding.origin
    || !exact(value, ['type', 'version', 'channel', 'nonce', 'kind', 'payload']) || value.type !== TYPE || value.version !== 1
    || value.channel !== binding.channel || !nonceId(value.nonce) || (nonce !== null && value.nonce !== nonce)
    || !object(value.payload)) return null;
  return value;
}

function send(binding, nonce, kind, payload, transfer = []) {
  try { binding.source.postMessage({ type: TYPE, version: 1, channel: binding.channel, nonce, kind, payload }, binding.origin, transfer); return true; }
  catch { return false; }
}

// Native HTTP response is projected, not serialized wholesale. In particular no
// cookies, history, auth hints, arbitrary URLs or unbounded provider errors cross.
function decision(value) {
  if (!object(value) || !['generatedText', 'recordedLine', 'silence'].includes(value.kind) || !id(value.requestId)
    || !['astrid', 'vera', 'amira', 'mei'].includes(value.dealerId) || !revision(value.sessionRevision) || !revision(value.roundRevision)) throw Error('invalid-decision');
  // This bridge transfers finalized media bytes between two local origins.
  // A native-origin WebSocket ticket cannot be used by the lab-origin player.
  // Reject unsupported delivery before projecting fields or loading media.
  if (value.speechStream != null || value.visualMode === 'generated-lipsync-stream-preview') throw Error('unsupported-speech-stream');
  const result = { kind: value.kind, requestId: value.requestId, dealerId: value.dealerId,
    sessionRevision: value.sessionRevision, roundRevision: value.roundRevision };
  if (value.kind === 'silence') return result;
  if (!text(value.exactText)) throw Error('invalid-decision');
  result.exactText = value.exactText;
  if (value.kind === 'recordedLine') {
    if (!id(value.lineId) || !id(value.familyId) || !(value.variantId === null || id(value.variantId))) throw Error('invalid-decision');
    return { ...result, lineId: value.lineId, familyId: value.familyId, variantId: value.variantId };
  }
  if (value.speechPackage != null) {
    const speech = validateSpeechPackage(value.speechPackage, { requireApproved: false });
    if (speech.schemaVersion !== 2 || speech.dealerId !== result.dealerId || speech.exactText !== result.exactText
      || speech.generation.requestId !== result.requestId) throw Error('invalid-decision');
    return { ...result, visualMode: 'generated-lipsync-preview', speechPackage: speech };
  }
  return { ...result, visualMode: 'neutral' };
}

async function mediaBytes(value, maximum) {
  // Only byte material returned by the native loader is accepted, never URLs.
  if (value instanceof Blob) {
    if (!value.size || value.size > maximum) throw Error('invalid-media');
    return value.arrayBuffer();
  }
  if (!(value instanceof ArrayBuffer) || !value.byteLength || value.byteLength > maximum) throw Error('invalid-media');
  return value.slice(0);
}

async function checkedMedia(speech, value, buffersOnly = false) {
  if (!object(value) || (buffersOnly && (!exact(value, ['audio', 'video']) || !(value.audio instanceof ArrayBuffer) || !(value.video instanceof ArrayBuffer)))) throw Error('invalid-media');
  const [audio, video] = await Promise.all([mediaBytes(value.audio, LAB_SPEECH_BRIDGE_LIMITS.audioBytes), mediaBytes(value.video, LAB_SPEECH_BRIDGE_LIMITS.videoBytes)]);
  const [audioHash, videoHash, textHash] = await Promise.all([sha(audio), sha(video), sha(new TextEncoder().encode(speech.exactText))]);
  if (audioHash !== speech.audio.sha256 || videoHash !== speech.video.sha256 || textHash !== speech.generation.textSha256) throw Error('invalid-media');
  return { audio, video };
}

/** Explicitly opt-in, loopback-only bridge. The host wires accept to its window
 * message listener and close to navigation/unload. onSubmit owns authenticated
 * /chat and must re-check the native session/round before any paid generation. */
export function createNativeSpeechBridge({ href = '', opener = null, onSubmit, onCancel = () => {}, loadMedia, timeoutMs } = {}) {
  let binding = null;
  try {
    const url = new URL(href), origin = url.searchParams.get('labObserverOrigin'), channel = url.searchParams.get('labObserverChannel');
    if (opener && typeof opener.postMessage === 'function' && loopbackOrigin(url.origin) && loopbackOrigin(origin) && channelId(channel)
      && typeof onSubmit === 'function') binding = { source: opener, origin, channel };
  } catch { /* An ordinary game launch grants no chat capability. */ }
  let nonce = null, closed = false, current = null;
  const seen = new Set();
  const status = (state, requestId) => binding && nonce && send(binding, nonce, 'status', { state, ...(requestId ? { requestId } : {}) });
  function end(reason, notify = true) {
    const job = current;
    if (!job) return false;
    current = null; clearTimeout(job.timer); job.controller.abort(reason);
    if (reason !== 'complete') safeCall(onCancel, { requestId: job.requestId, reason });
    if (notify) status(reason === 'complete' ? 'completed' : reason === 'failed' ? 'failed' : 'cancelled', job.requestId);
    return true;
  }
  function close() { if (closed) return; end('closed'); status('closed'); closed = true; }
  function accept(event) {
    if (!binding || closed) return false;
    const data = packet(event, binding, nonce);
    if (!data) return false;
    if (data.kind === 'attach' && exact(data.payload, [])) {
      nonce ??= data.nonce; status('attached'); return true;
    }
    if (!nonce) return false;
    if (data.kind === 'close' && exact(data.payload, [])) { close(); return true; }
    if (['cancel', 'complete'].includes(data.kind) && exact(data.payload, ['requestId']) && id(data.payload.requestId)) {
      if (current?.requestId !== data.payload.requestId || (data.kind === 'complete' && current.state !== 'ready')) return false;
      return end(data.kind === 'complete' ? 'complete' : 'cancelled');
    }
    if (data.kind !== 'submit' || !exact(data.payload, ['requestId', 'text']) || !id(data.payload.requestId) || !text(data.payload.text)
      || current || seen.has(data.payload.requestId) || seen.size >= LAB_SPEECH_BRIDGE_LIMITS.requestCount) return false;
    const job = { requestId: data.payload.requestId, text: data.payload.text, controller: new AbortController(), state: 'submitted' };
    seen.add(job.requestId); current = job;
    job.timer = setTimeout(() => { if (current === job) end('timeout'); }, timeout(timeoutMs));
    job.timer.unref?.(); status('accepted', job.requestId);
    Promise.resolve().then(() => {
      if (current !== job || job.controller.signal.aborted) return;
      return onSubmit({ requestId: job.requestId, text: job.text, signal: job.controller.signal });
    }).catch(() => { if (current === job) end('failed'); });
    return true;
  }
  async function ready(value) {
    const job = current;
    if (!job || closed || job.state !== 'submitted' || value?.requestId !== job.requestId) return false;
    job.state = 'preparing';
    try {
      const safe = decision(value);
      let media = null;
      if (safe.speechPackage) {
        if (typeof loadMedia !== 'function') throw Error('missing-loader');
        const loaded = await loadMedia(safe.speechPackage, { exactText: safe.exactText, dealerId: safe.dealerId, signal: job.controller.signal });
        if (current !== job || job.controller.signal.aborted) return false;
        media = await checkedMedia(safe.speechPackage, loaded);
      }
      if (current !== job || job.controller.signal.aborted) return false;
      job.state = 'ready';
      if (!send(binding, nonce, 'ready', { decision: safe, media }, media ? [media.audio, media.video] : [])) throw Error('closed-peer');
      return true;
    } catch { if (current === job) end('failed'); return false; }
  }
  return Object.freeze({ enabled: Boolean(binding), accept, ready, close,
    fail(requestId) { return current?.requestId === requestId ? end('failed') : false; } });
}

/** The lab receives a prepared reply, not an instruction to play immediately.
 * onReady must use the lab renderer's own standard-idle proof and pose gate.
 * complete releases the slot after presentation; cancel aborts queued playback. */
export function createLabSpeechBridge({ source, origin, channel, onReady, onStatus = () => {}, timeoutMs } = {}) {
  const enabled = Boolean(source && typeof source.postMessage === 'function' && loopbackOrigin(origin) && channelId(channel) && typeof onReady === 'function');
  const binding = { source, origin, channel }, nonce = crypto.randomUUID();
  let closed = false, attached = false, current = null;
  const seen = new Set();
  const emitStatus = (state, requestId) => safeCall(onStatus, { state, ...(requestId ? { requestId } : {}) });
  function release(reason) {
    const job = current;
    if (!job) return false;
    current = null; clearTimeout(job.timer); job.controller.abort(reason); emitStatus(reason, job.requestId); return true;
  }
  function cancel(requestId) {
    if (!current || current.requestId !== requestId) return false;
    send(binding, nonce, 'cancel', { requestId }); return release('cancelled');
  }
  function close() {
    if (closed) return;
    if (enabled) send(binding, nonce, 'close', {});
    release('closed'); closed = true; attached = false; emitStatus('closed');
  }
  async function accept(event) {
    if (!enabled || closed) return false;
    const data = packet(event, binding, nonce);
    if (!data) return false;
    const payload = data.payload;
    if (data.kind === 'status') {
      if (exact(payload, ['state']) && payload.state === 'attached') { attached = true; emitStatus('attached'); return true; }
      if (exact(payload, ['state']) && payload.state === 'closed') { release('closed'); closed = true; attached = false; emitStatus('closed'); return true; }
      if (!exact(payload, ['state', 'requestId']) || current?.requestId !== payload.requestId || !['accepted', 'failed', 'cancelled', 'completed'].includes(payload.state)) return false;
      if (payload.state === 'accepted') emitStatus('accepted', payload.requestId);
      else release(payload.state);
      return true;
    }
    if (!attached || data.kind !== 'ready' || !exact(payload, ['decision', 'media']) || !current || current.state !== 'submitted'
      || current.requestId !== payload.decision?.requestId) return false;
    const job = current; job.state = 'validating';
    try {
      const safe = decision(payload.decision);
      if (JSON.stringify(safe) !== JSON.stringify(payload.decision)) throw Error('invalid-decision');
      const media = safe.speechPackage ? await checkedMedia(safe.speechPackage, payload.media, true) : null;
      if (!safe.speechPackage && payload.media !== null) throw Error('unexpected-media');
      if (current !== job || job.controller.signal.aborted) return false;
      job.state = 'ready'; emitStatus('ready', job.requestId);
      await onReady({ decision: safe, media, signal: job.controller.signal });
      return current === job && !job.controller.signal.aborted;
    } catch { if (current === job) cancel(job.requestId); return false; }
  }
  return Object.freeze({ enabled, accept, close, cancel,
    attach() { return enabled && !closed && send(binding, nonce, 'attach', {}); },
    submit(value) {
      if (!enabled || closed || !attached || current || !exact(value, ['requestId', 'text']) || !id(value.requestId) || !text(value.text)
        || seen.has(value.requestId) || seen.size >= LAB_SPEECH_BRIDGE_LIMITS.requestCount) return false;
      const job = { requestId: value.requestId, controller: new AbortController(), state: 'submitted' };
      seen.add(job.requestId); current = job;
      job.timer = setTimeout(() => { if (current === job) { cancel(job.requestId); emitStatus('timeout', job.requestId); } }, timeout(timeoutMs));
      job.timer.unref?.();
      if (!send(binding, nonce, 'submit', { ...value })) { release('failed'); return false; }
      return true;
    },
    complete(requestId) {
      if (current?.requestId !== requestId || current.state !== 'ready') return false;
      send(binding, nonce, 'complete', { requestId }); return release('completed');
    },
  });
}
