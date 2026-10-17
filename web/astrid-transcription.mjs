import { createHash } from 'node:crypto';
import { isDealerId } from '../packages/presentation/contracts/dealer-identity.mjs';
import { CAMERA_AUDIO_MAX_BYTES, CAMERA_AUDIO_SECONDS } from './public/astrid-camera-audio.mjs';

const REVISION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const fail = (code, statusCode = 400) => { throw Object.assign(new Error(code), { code, statusCode }); };

export function validateCameraWav(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 44 || bytes.length > CAMERA_AUDIO_MAX_BYTES) fail('invalid_camera_audio');
  const sampleRate = bytes.readUInt32LE(24), count = bytes.readUInt32LE(40);
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.readUInt32LE(4) !== bytes.length - 8
    || bytes.toString('ascii', 8, 16) !== 'WAVEfmt ' || bytes.readUInt32LE(16) !== 16
    || bytes.readUInt16LE(20) !== 1 || bytes.readUInt16LE(22) !== 1
    || sampleRate < 8000 || sampleRate > 48000 || bytes.readUInt32LE(28) !== sampleRate * 2
    || bytes.readUInt16LE(32) !== 2 || bytes.readUInt16LE(34) !== 16
    || bytes.toString('ascii', 36, 40) !== 'data' || count !== bytes.length - 44 || count % 2
    || count < sampleRate * 2 / 10 || count > sampleRate * 2 * CAMERA_AUDIO_SECONDS) fail('invalid_camera_audio');
  return { durationMs: count / (sampleRate * 2) * 1000 };
}

export function validateTranscriptionHeaders(headers, expectedProfileRevision, expectedDealerId = 'astrid') {
  const origin = headers.origin;
  if (!origin || !URL.canParse(origin) || !['http:', 'https:'].includes(new URL(origin).protocol)
    || new URL(origin).origin !== origin || new URL(origin).host !== headers.host || headers['sec-fetch-site'] === 'cross-site') {
    fail('transcription_same_origin_required', 403);
  }
  if (headers['content-type'] !== 'audio/wav' || !isDealerId(expectedDealerId) || headers['x-astrid-dealer'] !== expectedDealerId
    || !['auto', 'sv', 'en'].includes(headers['x-astrid-language'])
    || !REVISION.test(headers['x-astrid-request-id'] ?? '')
    || !REVISION.test(headers['x-astrid-session-revision'] ?? '') || !REVISION.test(headers['x-astrid-round-revision'] ?? '')) {
    fail('invalid_transcription_context');
  }
  if (!/^[a-f0-9]{64}$/.test(headers['x-astrid-profile-revision'] ?? '')
    || headers['x-astrid-profile-revision'] !== expectedProfileRevision) fail('stale_transcription_profile', 409);
  return { requestId: headers['x-astrid-request-id'], language: headers['x-astrid-language'],
    dealerId: expectedDealerId, sessionRevision: headers['x-astrid-session-revision'], roundRevision: headers['x-astrid-round-revision'] };
}

function readAudio(req, signal) {
  const length = req.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > CAMERA_AUDIO_MAX_BYTES)) fail('camera_audio_too_large', 413);
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    const cleanup = () => {
      req.removeListener('data', data); req.removeListener('end', end); req.removeListener('error', error);
      req.removeListener('aborted', aborted); signal.removeEventListener('abort', aborted);
    };
    const error = () => { cleanup(); for (const chunk of chunks) chunk.fill(0); chunks.length = 0; req.resume(); reject(Object.assign(new Error('camera_audio_upload_failed'), { code: 'camera_audio_upload_failed', statusCode: 400 })); };
    const aborted = () => { cleanup(); for (const chunk of chunks) chunk.fill(0); chunks.length = 0; req.resume(); reject(Object.assign(new Error('transcription_cancelled'), { code: 'transcription_cancelled', statusCode: 499 })); };
    const data = chunk => {
      size += chunk.length;
      if (size > CAMERA_AUDIO_MAX_BYTES) {
        cleanup(); for (const saved of chunks) saved.fill(0); chunks.length = 0; req.resume();
        reject(Object.assign(new Error('camera_audio_too_large'), { code: 'camera_audio_too_large', statusCode: 413 }));
      } else chunks.push(chunk);
    };
    const end = () => {
      cleanup(); const bytes = Buffer.concat(chunks, size);
      for (const chunk of chunks) chunk.fill(0); chunks.length = 0; resolve(bytes);
    };
    req.on('data', data); req.once('end', end); req.once('error', error); req.once('aborted', aborted);
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
  });
}

async function readTranscript(response, signal) {
  if (!response.ok) {
    await response.body?.cancel();
    fail([401, 403].includes(response.status) ? 'transcription_authentication_failed' : 'transcription_provider_failed', 502);
  }
  if (!response.body?.getReader) fail('invalid_transcription_response', 502);
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  try {
    for (;;) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) fail('invalid_transcription_response', 502);
      chunks.push(Buffer.from(value));
    }
    let data;
    try { data = JSON.parse(Buffer.concat(chunks, size).toString('utf8')); }
    catch { fail('invalid_transcription_response', 502); }
    if (!data || Array.isArray(data) || typeof data.text !== 'string' || data.text.length > 1000
      || /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/.test(data.text)) fail('invalid_transcription_response', 502);
    return data.text.trim();
  } finally { try { await reader.cancel(); } catch {} reader.releaseLock(); }
}

/** No filesystem, conversation storage, audio cache or retries. Whisper's
 * translations endpoint detects input language and always returns English.
 * https://developers.openai.com/api/reference/resources/audio/subresources/translations/methods/create
 * Checked 2026-09-28. A legacy sv/en header is accepted but never forwarded.
 */
export function createAstridTranscriptionApi({ apiKey, fetchImpl = fetch, clock = Date.now } = {}) {
  const configured = typeof apiKey === 'string' && apiKey.length > 0 && apiKey.length <= 2048 && !/[\s\x00-\x1f]/.test(apiKey);
  const used = new Map(), active = new Set();
  async function handle(req, res, { enabled, profileRevision, checkCurrent, dealerId = 'astrid' }) {
    const json = (code, value) => {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(value));
    };
    const controller = new AbortController();
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    const deadline = setTimeout(() => controller.abort(), 30000);
    res.once('close', disconnected);
    let audio = null, acquired = false;
    try {
      if (req.method !== 'POST') fail('method_not_allowed', 405);
      if (!enabled) fail('transcription_disabled', 403);
      if (!configured) fail('transcription_not_configured', 503);
      const context = validateTranscriptionHeaders(req.headers, profileRevision, dealerId);
      await checkCurrent(context); controller.signal.throwIfAborted();
      const now = clock();
      for (const [id, at] of used) if (now - at > 300000) used.delete(id);
      const key = createHash('sha256').update(`${profileRevision}\n${context.requestId}`).digest('hex');
      if (used.has(key)) fail('transcription_already_attempted', 409);
      if (active.has(profileRevision) || active.size >= 2 || used.size >= 128) fail('transcription_busy', 429);
      active.add(profileRevision); acquired = true;
      audio = await readAudio(req, controller.signal);
      const { durationMs } = validateCameraWav(audio);
      await checkCurrent(context); controller.signal.throwIfAborted();
      used.set(key, now); // Only a digest/time tombstone; never retain raw audio.
      const form = new FormData();
      form.append('file', new Blob([audio], { type: 'audio/wav' }), 'utterance.wav');
      form.append('model', 'whisper-1'); form.append('response_format', 'json');
      const response = await fetchImpl('https://api.openai.com/v1/audio/translations', {
        method: 'POST', headers: { authorization: `Bearer ${apiKey}` },
        body: form, signal: controller.signal, redirect: 'error',
      });
      const text = await readTranscript(response, controller.signal);
      await checkCurrent(context); controller.signal.throwIfAborted();
      json(200, { text, durationMs, provider: 'openai', model: 'whisper-1', language: 'en', inputLanguage: 'auto' });
    } catch (error) {
      // Never echo upstream bodies, credentials, URLs or raw error messages.
      const safe = typeof error.code === 'string' && /^(?:transcription_|invalid_(?:camera_audio|transcription_)|camera_audio_|stale_transcription_|method_not_allowed)/.test(error.code);
      json(controller.signal.aborted ? 504 : safe ? error.statusCode : error.statusCode === 401 || error.statusCode === 409 ? error.statusCode : 503,
        { error: controller.signal.aborted ? 'transcription_timeout_or_cancelled' : safe ? error.code : error.statusCode === 401 || error.statusCode === 409 ? 'stale_transcription_context' : 'transcription_unavailable' });
    } finally {
      audio?.fill(0); if (acquired) active.delete(profileRevision);
      clearTimeout(deadline); res.removeListener('close', disconnected);
    }
  }
  return { configured, handle };
}
