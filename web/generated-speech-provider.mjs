import { createHash } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { ASTRID_VOICE_PROFILE } from './public/astrid-voice-profile.mjs';

// Provider-only adapter. No env, filesystem, browser, room broadcast or game state.
// Wire-contract provenance (not vendored implementation):
// https://gitlab.com/EmaCodeHero/astrid-lipsync-demo-2/-/blob/133f2e4392d43de1c30dc5edd1b1f6762934efcb/server/serverless.mjs
// That demo's INTEGRATION.md describes astrid_spel2x as a full 1080x1920
// portrait start-image scene, including its table, not an alpha/head-only layer.
// 24 fps is the declared worker contract, not a probe of a generated artifact.
// The caller must ffprobe actual dimensions/fps/frame count/audio tracks and
// review entry/exit pose before admitting a take; no compositor mask is supplied.
export const GENERATED_SPEECH_DEFAULTS = Object.freeze({
  voiceId: ASTRID_VOICE_PROFILE.voiceId, modelId: ASTRID_VOICE_PROFILE.modelId, timeoutMs: 180000, pollMs: 500,
});
export const GENERATED_SPEECH_LIMITS = Object.freeze({
  textChars: 500, durationMs: 25000, sampleRate: 24000, fps: 24,
  videoBytes: 30 * 1024 * 1024, retainedBytes: 64 * 1024 * 1024,
  requestLedger: 1024, maxTimeoutMs: 300000,
});
const PCM_BYTES = GENERATED_SPEECH_LIMITS.sampleRate * 2 * GENERATED_SPEECH_LIMITS.durationMs / 1000;
const BASE64_BYTES = 4 * Math.ceil(GENERATED_SPEECH_LIMITS.videoBytes / 3);
const JSON_BYTES = BASE64_BYTES + 65536;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const token = value => typeof value === 'string' && value.length > 0 && value.length <= 2048 && !/[\s\u0000-\u001f\u007f]/.test(value);

export class GeneratedSpeechError extends Error {
  constructor(code, statusCode = 502) { super(code); this.name = 'GeneratedSpeechError'; this.code = code; this.statusCode = statusCode; }
}
const fail = (code, statusCode) => { throw new GeneratedSpeechError(code, statusCode); };

function settings(value = {}) {
  const config = {
    cartesiaApiKey: value.cartesiaApiKey, runpodApiKey: value.runpodApiKey,
    runpodEndpointId: value.runpodEndpointId,
    voiceId: value.voiceId || GENERATED_SPEECH_DEFAULTS.voiceId,
    modelId: value.modelId || GENERATED_SPEECH_DEFAULTS.modelId,
    timeoutMs: value.timeoutMs ?? GENERATED_SPEECH_DEFAULTS.timeoutMs,
    pollMs: value.pollMs ?? GENERATED_SPEECH_DEFAULTS.pollMs,
  };
  if (!token(config.cartesiaApiKey) || !token(config.runpodApiKey)
    || typeof config.runpodEndpointId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(config.runpodEndpointId)
    || !identifier(config.voiceId) || !identifier(config.modelId)
    || !Number.isInteger(config.timeoutMs) || config.timeoutMs < 1000 || config.timeoutMs > GENERATED_SPEECH_LIMITS.maxTimeoutMs
    || !Number.isInteger(config.pollMs) || config.pollMs < 100 || config.pollMs > 5000) fail('generated_speech_not_configured', 503);
  return Object.freeze(config);
}

function request(value) {
  if (!value || !identifier(value.requestId) || typeof value.text !== 'string'
    || !value.text.trim() || value.text !== value.text.trim() || value.text.length > GENERATED_SPEECH_LIMITS.textChars
    || /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(value.text)
    || (value.signal !== undefined && !(value.signal instanceof AbortSignal))) fail('invalid_generated_speech_request', 400);
  return { requestId: value.requestId, text: value.text, signal: value.signal,
    beforeCostly: typeof value.beforeCostly === 'function' ? value.beforeCostly : async () => {},
    onProgress: typeof value.onProgress === 'function' ? value.onProgress : () => {} };
}

function wavFromPcm(pcm) {
  if (pcm.length < 48 || pcm.length > PCM_BYTES || pcm.length % 2) fail('invalid_generated_speech_pcm');
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(GENERATED_SPEECH_LIMITS.sampleRate, 24);
  header.writeUInt32LE(GENERATED_SPEECH_LIMITS.sampleRate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function discard(response) { try { await response.body?.cancel(); } catch {} }

async function boundedBody(response, limit, signal) {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) {
    await discard(response); fail('generated_speech_response_too_large');
  }
  if (!response.body?.getReader) fail('invalid_generated_speech_response');
  const reader = response.body.getReader();
  const chunks = []; let bytes = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      const next = await reader.read();
      signal.throwIfAborted();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > limit) fail('generated_speech_response_too_large');
      chunks.push(Buffer.from(next.value));
    }
    return Buffer.concat(chunks, bytes);
  } catch (error) {
    try { await reader.cancel(); } catch {}
    throw error;
  } finally { reader.releaseLock(); }
}

function decodeVideo(output, audioDurationMs) {
  const b64 = output?.mp4_b64;
  if (typeof b64 !== 'string' || !b64 || b64.length > BASE64_BYTES || b64.length % 4
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) fail('invalid_generated_speech_video');
  if (!Number.isInteger(output.frames) || output.frames < 1
    || Math.abs(output.frames / GENERATED_SPEECH_LIMITS.fps * 1000 - audioDurationMs) > 1000) {
    fail('generated_speech_duration_mismatch');
  }
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length < 16 || bytes.length > GENERATED_SPEECH_LIMITS.videoBytes
    || bytes.toString('ascii', 4, 8) !== 'ftyp' || bytes.toString('base64') !== b64) fail('invalid_generated_speech_video');
  // Container/track verification and human review are intentionally the caller's
  // responsibility; an ftyp box does not prove a valid/synced/muxed speech take.
  return { bytes, sha256: digest(bytes), frameCount: output.frames, fps: GENERATED_SPEECH_LIMITS.fps, contentType: 'video/mp4' };
}

/** All credentials are injected. Constructing the adapter makes no network calls.
 * Same request ID + text deduplicates successes AND failures for this instance.
 * Once a retained result expires from the byte budget its tombstone still prevents
 * paying for that ID again. The caller owns durable idempotency across restarts.
 */
export function createGeneratedSpeechProvider(configuration, { fetchImpl = fetch, sleep = (ms, signal) => pause(ms, undefined, { signal }) } = {}) {
  const config = settings(configuration);
  const ledger = new Map();
  let active = false; let retainedBytes = 0;
  const runpodBase = `https://api.runpod.ai/v2/${config.runpodEndpointId}`;

  async function execute(input) {
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), config.timeoutMs);
    const signal = input.signal ? AbortSignal.any([input.signal, deadline.signal]) : deadline.signal;
    let jobId = null; let terminal = false;
    async function call(url, init, code, limit) {
      signal.throwIfAborted();
      const response = await fetchImpl(url, { ...init, signal, redirect: 'error' });
      signal.throwIfAborted();
      if (!response.ok) { await discard(response); fail(code); }
      if (code === 'generated_speech_tts_failed' && /(?:json|text\/|mpeg|wav|flac)/i.test(response.headers.get('content-type') ?? '')) {
        await discard(response); fail('invalid_generated_speech_pcm');
      }
      return boundedBody(response, limit, signal);
    }
    async function runpod(route, init) {
      const data = await call(`${runpodBase}/${route}`, {
        ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${config.runpodApiKey}` },
      }, 'generated_speech_runpod_failed', JSON_BYTES);
      try { return JSON.parse(data.toString('utf8')); } catch { fail('invalid_generated_speech_response'); }
    }
    try {
      await input.beforeCostly();
      signal.throwIfAborted();
      input.onProgress('voice');
      const pcm = await call('https://api.cartesia.ai/tts/bytes', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.cartesiaApiKey}`, 'Cartesia-Version': '2026-08-14' },
        body: JSON.stringify({ transcript: input.text, voice: config.voiceId, model_id: config.modelId,
          output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: ASTRID_VOICE_PROFILE.sampleRate } }),
      }, 'generated_speech_tts_failed', PCM_BYTES);
      const wav = wavFromPcm(pcm);
      const durationMs = pcm.length / (GENERATED_SPEECH_LIMITS.sampleRate * 2) * 1000;
      signal.throwIfAborted();
      // Never retry either paid POST. An uncertain start remains a failed ID.
      await input.beforeCostly();
      signal.throwIfAborted();
      input.onProgress('video-submit');
      let job = await runpod('run', { method: 'POST', body: JSON.stringify({
        input: { op: 'lipsync', wav_b64: wav.toString('base64'), crf: 13, preset: 'ultrafast' },
        // RunPod's per-job policy remains effective if this process disconnects
        // before it receives a job ID and cannot send its usual cancellation.
        // https://docs.runpod.io/serverless/endpoints/send-requests#execution-policies
        policy: { executionTimeout: 120000, ttl: 180000 },
      }) });
      if (typeof job?.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(job.id)) fail('invalid_generated_speech_job');
      jobId = job.id;
      let lastStatus;
      for (;;) {
        signal.throwIfAborted();
        if (job.id !== jobId) fail('generated_speech_job_mismatch');
        if (['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(job.status)) { terminal = true; break; }
        if (!['IN_QUEUE', 'IN_PROGRESS'].includes(job.status)) fail('invalid_generated_speech_job');
        if (job.status !== lastStatus) input.onProgress(job.status === 'IN_QUEUE' ? 'video-queue' : 'video-render');
        lastStatus = job.status;
        await sleep(config.pollMs, signal);
        job = await runpod(`status/${encodeURIComponent(jobId)}`, { method: 'GET' });
      }
      if (job.status !== 'COMPLETED' || job.output?.error) fail('generated_speech_runpod_failed');
      const video = decodeVideo(job.output, durationMs);
      const metrics = { videoBytes: video.bytes.length };
      if (Number.isSafeInteger(job.delayTime) && job.delayTime >= 0) metrics.runpodDelayMs = job.delayTime;
      if (Number.isSafeInteger(job.executionTime) && job.executionTime >= 0) metrics.runpodExecutionMs = job.executionTime;
      input.onProgress('media', metrics);
      return {
        exactText: input.text, voiceId: config.voiceId, modelId: config.modelId,
        audio: { bytes: wav, sha256: digest(wav), durationMs: Math.round(durationMs), contentType: 'audio/wav' },
        video, provider: { kind: ASTRID_VOICE_PROFILE.provider },
      };
    } catch (error) {
      if (jobId && !terminal) {
        // Only this request's known job. Never purge a shared queue or stop workers.
        try {
          const response = await fetchImpl(`${runpodBase}/cancel/${encodeURIComponent(jobId)}`, {
            method: 'POST', headers: { authorization: `Bearer ${config.runpodApiKey}` },
            signal: AbortSignal.timeout(3000), redirect: 'error',
          });
          await discard(response);
        } catch {}
      }
      if (deadline.signal.aborted) fail('generated_speech_timeout', 504);
      if (input.signal?.aborted) fail('generated_speech_cancelled', 499);
      if (error instanceof GeneratedSpeechError) throw error;
      // Never propagate a provider URL, response body, headers or raw exception.
      fail('generated_speech_provider_unavailable', 503);
    } finally { clearTimeout(timer); }
  }

  function retain(entry, result) {
    entry.result = result;
    entry.bytes = result.audio.bytes.length + result.video.bytes.length;
    retainedBytes += entry.bytes;
    for (const old of ledger.values()) {
      if (retainedBytes <= GENERATED_SPEECH_LIMITS.retainedBytes) break;
      if (!old.result || old === entry) continue;
      retainedBytes -= old.bytes; old.bytes = 0; old.result = null;
      old.error = new GeneratedSpeechError('generated_speech_result_expired', 409);
    }
  }

  return Object.freeze({
    status: () => ({ configured: true, busy: active, requests: ledger.size, retainedBytes }),
    generate(value) {
      let input;
      try { input = request(value); } catch (error) { return Promise.reject(error); }
      const previous = ledger.get(input.requestId);
      if (previous) {
        if (previous.textHash !== digest(input.text)) return Promise.reject(new GeneratedSpeechError('generated_speech_request_conflict', 409));
        if (previous.promise) return previous.promise;
        return previous.error ? Promise.reject(previous.error) : Promise.resolve(previous.result);
      }
      if (input.signal?.aborted) return Promise.reject(new GeneratedSpeechError('generated_speech_cancelled', 499));
      if (active) return Promise.reject(new GeneratedSpeechError('generated_speech_busy', 429));
      if (ledger.size >= GENERATED_SPEECH_LIMITS.requestLedger) return Promise.reject(new GeneratedSpeechError('generated_speech_ledger_full', 503));
      const entry = { textHash: digest(input.text), promise: null, result: null, error: null, bytes: 0 };
      ledger.set(input.requestId, entry); active = true;
      entry.promise = execute(input).then(result => {
        retain(entry, result); entry.promise = null; active = false; return result;
      }, error => {
        entry.error = error; entry.promise = null; active = false; throw error;
      });
      return entry.promise;
    },
  });
}
