import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGeneratedSpeechProvider, GENERATED_SPEECH_DEFAULTS, GENERATED_SPEECH_LIMITS } from '../web/generated-speech-provider.mjs';

const config = () => ({ elevenLabsApiKey: 'test-eleven-key', runpodApiKey: 'test-runpod-key', runpodEndpointId: 'test-endpoint' });
const input = (requestId = 'speech-1') => ({ requestId, text: 'Good evening.' });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pcm = () => Buffer.alloc(48000, 4);
function mp4() { const bytes = Buffer.alloc(32); bytes.writeUInt32BE(32); bytes.write('ftypisom', 4); return bytes; }
const json = body => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
const complete = (output = {}) => ({ id: 'job-1', status: 'COMPLETED', output: { frames: 24, mp4_b64: mp4().toString('base64'), ...output } });
function fixture({ ttsResponse, startResponse, statusResponse, options = {} } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, ...init });
    if (url.includes('api.elevenlabs.io')) return ttsResponse?.(url, init) ?? new Response(pcm(), { headers: { 'content-type': 'audio/pcm' } });
    if (url.endsWith('/run')) return startResponse?.(url, init) ?? json({ id: 'job-1', status: 'IN_QUEUE' });
    if (url.includes('/status/')) return statusResponse?.(url, init) ?? json(complete());
    if (url.includes('/cancel/')) return json({ status: 'CANCELLED' });
    assert.fail('unexpected network target');
  };
  return { calls, provider: createGeneratedSpeechProvider({ ...config(), ...options }, { fetchImpl, sleep: async (_ms, signal) => signal.throwIfAborted() }) };
}
const starts = calls => calls.filter(call => call.method === 'POST' && !call.url.includes('/cancel/'));

test('construction/import does not read configuration from env or start providers; defaults are explicit', () => {
  let calls = 0;
  const provider = createGeneratedSpeechProvider(config(), { fetchImpl: () => { calls++; assert.fail(); } });
  assert.deepEqual(provider.status(), { configured: true, busy: false, requests: 0, retainedBytes: 0 });
  assert.equal(calls, 0);
  assert.equal(GENERATED_SPEECH_DEFAULTS.voiceId, 'EXAVITQu4vr4xnSDxMaL');
  assert.equal(GENERATED_SPEECH_DEFAULTS.modelId, 'eleven_multilingual_v2');
  assert.throws(() => createGeneratedSpeechProvider({}), { code: 'generated_speech_not_configured' });
  assert.throws(() => createGeneratedSpeechProvider({ ...config(), runpodEndpointId: 'https://attacker.example' }), { code: 'generated_speech_not_configured' });
  assert.throws(() => createGeneratedSpeechProvider({ ...config(), timeoutMs: 300001 }), { code: 'generated_speech_not_configured' });
});

test('exact ElevenLabs PCM becomes the same WAV sent to RunPod and returned with hashes', async () => {
  const { provider, calls } = fixture();
  const result = await provider.generate(input());
  assert.equal(result.exactText, input().text);
  assert.equal(calls[0].url, `https://api.elevenlabs.io/v1/text-to-speech/${GENERATED_SPEECH_DEFAULTS.voiceId}?output_format=pcm_24000`);
  assert.deepEqual(JSON.parse(calls[0].body), { text: input().text, model_id: GENERATED_SPEECH_DEFAULTS.modelId });
  assert.equal(calls[0].headers['xi-api-key'], config().elevenLabsApiKey);
  const sent = JSON.parse(calls[1].body);
  assert.deepEqual(Object.keys(sent.input).sort(), ['crf', 'op', 'preset', 'wav_b64']);
  assert.equal(sent.input.op, 'lipsync');
  const wav = Buffer.from(sent.input.wav_b64, 'base64');
  assert.deepEqual(wav, result.audio.bytes);
  assert.deepEqual(wav.subarray(44), pcm());
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(result.audio.sha256, hash(wav));
  assert.equal(result.audio.durationMs, 1000);
  assert.equal(result.video.sha256, hash(mp4()));
  assert.equal(result.video.frameCount, 24);
  assert.equal(result.video.fps, 24);
  assert.deepEqual(result.provider, { kind: 'elevenlabs-runpod' });
  assert.equal(JSON.stringify(result).includes('test-eleven-key'), false);
  assert.equal(JSON.stringify(result).includes('test-runpod-key'), false);
  assert.ok(calls.every(call => call.redirect === 'error'));
});

test('pending and completed duplicates use one paid pipeline; another ID is rejected while busy', async () => {
  let release;
  const { provider, calls } = fixture({ ttsResponse: () => new Promise(resolve => { release = resolve; }) });
  const first = provider.generate(input());
  assert.strictEqual(provider.generate(input()), first);
  await assert.rejects(provider.generate(input('speech-2')), { code: 'generated_speech_busy', statusCode: 429 });
  await assert.rejects(provider.generate({ ...input(), text: 'Changed text.' }), { code: 'generated_speech_request_conflict' });
  release(new Response(pcm()));
  const result = await first;
  assert.strictEqual(await provider.generate(input()), result);
  assert.equal(starts(calls).length, 2);
  assert.equal(provider.status().busy, false);
});

test('progress distinguishes voice, queue, rendering and download without provider data', async () => {
  let polls = 0;
  const { provider } = fixture({ statusResponse: () => ++polls === 1 ? json({ id: 'job-1', status: 'IN_PROGRESS' }) : json(complete()) });
  const stages = [];
  await provider.generate({ ...input(), onProgress: stage => stages.push(stage) });
  assert.deepEqual(stages, ['voice', 'video-submit', 'video-queue', 'video-render', 'media']);
});

test('failed and uncertain requests retain tombstones and do not retry either paid POST', async () => {
  const { provider, calls } = fixture({ startResponse: () => { throw new Error('secret URL and token must not surface'); } });
  await assert.rejects(provider.generate(input()), { code: 'generated_speech_provider_unavailable' });
  await assert.rejects(provider.generate(input()), { code: 'generated_speech_provider_unavailable' });
  await assert.rejects(provider.generate({ ...input(), text: 'Other words.' }), { code: 'generated_speech_request_conflict' });
  assert.equal(starts(calls).length, 2);
  assert.equal(calls.some(call => call.url.includes('/cancel/')), false);
});

test('provider error content and raw exception details never enter public errors', async () => {
  const { provider, calls } = fixture({ ttsResponse: () => new Response('private provider error / token', { status: 401 }) });
  await assert.rejects(provider.generate(input()), error => {
    assert.equal(error.message, 'generated_speech_tts_failed');
    assert.equal(JSON.stringify(error).includes('private'), false);
    return true;
  });
  await assert.rejects(provider.generate(input()), { code: 'generated_speech_tts_failed' });
  assert.equal(calls.length, 1);
});

test('empty, overlong, noncanonical and control-character text is rejected before any provider', async () => {
  const { provider, calls } = fixture();
  for (const text of ['', ' ', ' padded ', 'a'.repeat(501), 'text\u0000injection', 'text\r\nline']) {
    await assert.rejects(provider.generate({ ...input(), text }), { code: 'invalid_generated_speech_request' });
  }
  await assert.rejects(provider.generate({ ...input(), requestId: '../../bad' }), { code: 'invalid_generated_speech_request' });
  assert.equal(calls.length, 0);
});

test('audio is capped at 25 seconds by headers and streamed byte count before RunPod', async () => {
  const maxPcm = GENERATED_SPEECH_LIMITS.sampleRate * 2 * 25;
  const tooLargeHeader = fixture({ ttsResponse: () => new Response(new Uint8Array(2), { headers: { 'content-length': String(maxPcm + 2) } }) });
  await assert.rejects(tooLargeHeader.provider.generate(input()), { code: 'generated_speech_response_too_large' });
  assert.equal(tooLargeHeader.calls.length, 1);
  const streamed = fixture({ ttsResponse: () => new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(maxPcm)); controller.enqueue(new Uint8Array(2)); controller.close();
  } })) });
  await assert.rejects(streamed.provider.generate(input()), { code: 'generated_speech_response_too_large' });
  assert.equal(streamed.calls.length, 1);
});

test('odd PCM bytes and encoded/wrong content types cannot be passed off as raw audio', async () => {
  for (const response of [new Response(new Uint8Array(49)), new Response(pcm(), { headers: { 'content-type': 'audio/mpeg' } }), new Response('{}', { headers: { 'content-type': 'application/json' } })]) {
    const { provider, calls } = fixture({ ttsResponse: () => response });
    await assert.rejects(provider.generate(input()), { code: 'invalid_generated_speech_pcm' });
    assert.equal(calls.length, 1);
  }
});

test('25-second audio succeeds at the boundary; video frame length must agree within one second', async () => {
  const boundary = fixture({ ttsResponse: () => new Response(Buffer.alloc(1200000)), statusResponse: () => json(complete({ frames: 600 })) });
  assert.equal((await boundary.provider.generate(input())).audio.durationMs, 25000);
  const mismatch = fixture({ statusResponse: () => json(complete({ frames: 49 })) });
  await assert.rejects(mismatch.provider.generate(input()), { code: 'generated_speech_duration_mismatch' });
});

test('output must be bounded canonical base64 with an MP4 signature and positive integer frame count', async () => {
  for (const output of [
    { mp4_b64: 'not-base64' }, { mp4_b64: Buffer.from('not an mp4 file, still many bytes').toString('base64') },
    { frames: 1.5 }, { frames: 0 }, { mp4_b64: null, url: 'https://attacker.example/clip.mp4' },
  ]) {
    const { provider } = fixture({ statusResponse: () => json(complete(output)) });
    await assert.rejects(provider.generate(input()), error => ['invalid_generated_speech_video', 'generated_speech_duration_mismatch'].includes(error.code));
  }
  const huge = fixture({ statusResponse: () => new Response('{}', { headers: { 'content-length': String(4 * Math.ceil(GENERATED_SPEECH_LIMITS.videoBytes / 3) + 65537) } }) });
  await assert.rejects(huge.provider.generate(input()), { code: 'generated_speech_response_too_large' });
});

test('polling uses the started job only; mismatch cancels that job without starting another', async () => {
  const { provider, calls } = fixture({ statusResponse: () => json({ ...complete(), id: 'other-job' }) });
  await assert.rejects(provider.generate(input()), { code: 'generated_speech_job_mismatch' });
  assert.equal(calls.at(-1).url, 'https://api.runpod.ai/v2/test-endpoint/cancel/job-1');
  assert.equal(starts(calls).length, 2);
  assert.equal(calls.some(call => call.url.includes('other-job')), false);
});

test('cancel while waiting stops and cancels only the known own job, preserving failure dedup', async () => {
  const controller = new AbortController();
  const calls = [];
  const provider = createGeneratedSpeechProvider(config(), {
    fetchImpl: async (url, init) => {
      calls.push({ url, ...init });
      if (url.includes('elevenlabs')) return new Response(pcm());
      if (url.endsWith('/run')) return json({ id: 'own-job', status: 'IN_QUEUE' });
      if (url.endsWith('/cancel/own-job')) return json({ status: 'CANCELLED' });
      assert.fail('must not poll after abort');
    },
    sleep: async (_ms, signal) => { controller.abort(); signal.throwIfAborted(); },
  });
  await assert.rejects(provider.generate({ ...input(), signal: controller.signal }), { code: 'generated_speech_cancelled' });
  await assert.rejects(provider.generate(input()), { code: 'generated_speech_cancelled' });
  assert.equal(calls.at(-1).url, 'https://api.runpod.ai/v2/test-endpoint/cancel/own-job');
  assert.equal(calls.length, 3);
  assert.equal(provider.status().busy, false);
});

test('already aborted input performs no provider call', async () => {
  const { provider, calls } = fixture();
  await assert.rejects(provider.generate({ ...input(), signal: AbortSignal.abort() }), { code: 'generated_speech_cancelled' });
  assert.equal(calls.length, 0);
});

test('terminal provider failure does not retry or cancel completed/failed jobs', async () => {
  const { provider, calls } = fixture({ statusResponse: () => json({ id: 'job-1', status: 'FAILED', error: 'must not leak' }) });
  await assert.rejects(provider.generate(input()), { code: 'generated_speech_runpod_failed' });
  await assert.rejects(provider.generate(input()), { code: 'generated_speech_runpod_failed' });
  assert.equal(calls.length, 3);
});

test('already completed /run returns without unnecessary polling', async () => {
  const { provider, calls } = fixture({ startResponse: () => json(complete()) });
  await provider.generate(input());
  assert.equal(calls.length, 2);
});

test('deadline abort is classified without leaking network details or retrying paid calls', async () => {
  const { provider, calls } = fixture({ options: { timeoutMs: 1000 }, ttsResponse: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('raw credential-bearing transport error')), { once: true });
  }) });
  await assert.rejects(provider.generate(input()), { code: 'generated_speech_timeout', statusCode: 504 });
  await assert.rejects(provider.generate(input()), { code: 'generated_speech_timeout' });
  assert.equal(calls.length, 1);
});
