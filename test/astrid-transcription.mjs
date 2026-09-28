import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createAstridTranscriptionApi, validateCameraWav } from '../web/astrid-transcription.mjs';
import { encodeCameraWav, CAMERA_AUDIO_MAX_BYTES } from '../web/public/astrid-camera-audio.mjs';

const profileRevision = 'a'.repeat(64);
const audio = () => Buffer.from(encodeCameraWav([new Int16Array(16000).fill(100)], 16000));
const headers = () => ({ host: 'camera.test:4220', origin: 'http://camera.test:4220', 'content-type': 'audio/wav',
  'x-astrid-dealer': 'astrid', 'x-astrid-language': 'auto', 'x-astrid-request-id': 'synthetic-1',
  'x-astrid-profile-revision': profileRevision, 'x-astrid-session-revision': 'session-1', 'x-astrid-round-revision': '0' });
const transcript = text => Response.json({ text });
class ResponseSink extends EventEmitter {
  destroyed = false; writableEnded = false;
  writeHead(status, headers) { this.status = status; this.headers = headers; }
  end(body) { this.body = JSON.parse(body); this.writableEnded = true; }
}
function request(api, { body = audio(), replaceHeaders = {}, enabled = true, method = 'POST', checkCurrent = async () => {} } = {}) {
  const req = new PassThrough(); req.method = method; req.headers = { ...headers(), ...replaceHeaders };
  const res = new ResponseSink();
  const done = api.handle(req, res, { enabled, profileRevision, checkCurrent });
  req.end(body);
  return { done, req, res };
}

test('batch translation uses bounded memory WAV, automatic input and fixed English provider URL/model; no retry', async () => {
  let calls = 0, checked = 0, receivedAudio;
  const api = createAstridTranscriptionApi({ apiKey: 'synthetic-key', fetchImpl: async (url, init) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/audio/translations'); assert.equal(init.redirect, 'error');
    assert.deepEqual(init.headers, { authorization: 'Bearer synthetic-key' });
    assert.equal(init.body.get('model'), 'whisper-1'); assert.equal(init.body.get('response_format'), 'json');
    assert.equal(init.body.has('language'), false); assert.equal(init.body.has('prompt'), false);
    receivedAudio = Buffer.from(await init.body.get('file').arrayBuffer()); assert.equal(validateCameraWav(receivedAudio).durationMs, 1000);
    return transcript(' Hello Astrid ');
  } });
  const result = request(api, { checkCurrent: async context => { checked++; assert.equal(context.dealerId, 'astrid'); } });
  await result.done;
  assert.equal(result.res.status, 200);
  assert.deepEqual(result.res.body, { text: 'Hello Astrid', durationMs: 1000, provider: 'openai', model: 'whisper-1', language: 'en', inputLanguage: 'auto' });
  assert.equal(result.res.headers['Cache-Control'], 'private, no-store');
  assert.equal(calls, 1); assert.equal(checked, 3);
  const duplicate = request(api); await duplicate.done;
  assert.equal(duplicate.res.status, 409); assert.equal(calls, 1);
});

test('legacy Swedish and English client hints never restrict automatic input or change the English output contract', async () => {
  for (const language of ['sv', 'en']) {
    let calls = 0;
    const api = createAstridTranscriptionApi({ apiKey: 'synthetic-key', fetchImpl: async (url, init) => {
      calls++; assert.equal(init.body.has('language'), false); return transcript('Hello Astrid');
    } });
    const result = request(api, { replaceHeaders: { 'x-astrid-language': language } }); await result.done;
    assert.equal(result.res.status, 200); assert.equal(calls, 1);
    assert.equal(result.res.body.language, 'en'); assert.equal(result.res.body.inputLanguage, 'auto');
  }
});

test('off, wrong method or missing key rejects before provider work', async () => {
  let calls = 0;
  const api = createAstridTranscriptionApi({ apiKey: 'synthetic-key', fetchImpl: async () => { calls++; } });
  for (const [options, expected] of [[{ enabled: false }, 403], [{ method: 'GET' }, 405]]) {
    const result = request(api, options); await result.done; assert.equal(result.res.status, expected);
  }
  const unconfigured = request(createAstridTranscriptionApi()); await unconfigured.done;
  assert.equal(unconfigured.res.status, 503); assert.equal(calls, 0);
});

test('origin, Astrid-only, language and profile guards reject before reading/forwarding audio', async () => {
  let calls = 0;
  const api = createAstridTranscriptionApi({ apiKey: 'synthetic-key', fetchImpl: async () => { calls++; } });
  for (const replacement of [
    { origin: undefined }, { origin: 'http://other.test:4220' }, { origin: 'http://camera.test:4220/path' },
    { 'sec-fetch-site': 'cross-site' }, { 'x-astrid-dealer': 'vera' }, { 'x-astrid-language': 'untrusted' },
    { 'x-astrid-profile-revision': 'b'.repeat(64) }, { 'x-astrid-round-revision': '' }, { 'content-type': 'audio/webm' },
  ]) {
    const result = request(api, { replaceHeaders: replacement }); await result.done;
    assert.ok([400, 403, 409].includes(result.res.status));
  }
  assert.equal(calls, 0);
});

test('WAV validation enforces real PCM duration, format and exact length', () => {
  for (const corrupt of [
    bytes => bytes.writeUInt16LE(2, 22), bytes => bytes.writeUInt16LE(3, 20),
    bytes => bytes.writeUInt32LE(99999999, 24), bytes => bytes.writeUInt32LE(100, 40),
    bytes => bytes.writeUInt16LE(8, 34), bytes => bytes.write('JUNK', 36),
  ]) { const bytes = audio(); corrupt(bytes); assert.throws(() => validateCameraWav(bytes)); }
  const tooLong = Buffer.alloc(44 + 16000 * 2 * 31); audio().copy(tooLong, 0, 0, 44);
  tooLong.writeUInt32LE(tooLong.length - 8, 4); tooLong.writeUInt32LE(tooLong.length - 44, 40);
  assert.throws(() => validateCameraWav(tooLong));
});

test('declared and streamed oversized uploads never reach provider', async () => {
  let calls = 0;
  const api = createAstridTranscriptionApi({ apiKey: 'synthetic-key', fetchImpl: async () => { calls++; } });
  for (const options of [{ replaceHeaders: { 'content-length': String(CAMERA_AUDIO_MAX_BYTES + 1) } },
    { body: Buffer.alloc(CAMERA_AUDIO_MAX_BYTES + 1) }]) {
    const result = request(api, options); await result.done; assert.equal(result.res.status, 413);
  }
  assert.equal(calls, 0);
});

test('profile or round changes after upload and after transcription suppress results', async () => {
  for (const staleAt of [2, 3]) {
    let checks = 0, calls = 0;
    const api = createAstridTranscriptionApi({ apiKey: 'synthetic-key', fetchImpl: async () => { calls++; return transcript('private'); } });
    const result = request(api, { checkCurrent: async () => {
      if (++checks === staleAt) throw Object.assign(new Error('internal'), { statusCode: 409 });
    } }); await result.done;
    assert.equal(result.res.status, 409); assert.equal(result.res.body.error, 'stale_transcription_context');
    assert.equal(calls, staleAt === 2 ? 0 : 1); assert.equal(JSON.stringify(result.res.body).includes('private'), false);
  }
});

test('provider errors are redacted and paid attempts are never automatically repeated', async () => {
  let calls = 0;
  const api = createAstridTranscriptionApi({ apiKey: 'synthetic-key', fetchImpl: async () => {
    calls++; throw new Error('secret provider url or body');
  } });
  const first = request(api); await first.done;
  const second = request(api); await second.done;
  assert.equal(first.res.status, 503); assert.equal(second.res.status, 409); assert.equal(calls, 1);
  assert.deepEqual(first.res.body, { error: 'transcription_unavailable' });
});

test('provider authentication failures are specific but never expose upstream bodies or retry', async () => {
  for (const status of [401, 403]) {
    let calls = 0;
    const api = createAstridTranscriptionApi({ apiKey: 'synthetic-key', fetchImpl: async () => {
      calls++; return new Response('private upstream credential or body', { status });
    } });
    const first = request(api); await first.done;
    assert.equal(first.res.status, 502);
    assert.deepEqual(first.res.body, { error: 'transcription_authentication_failed' });
    const duplicate = request(api); await duplicate.done;
    assert.equal(duplicate.res.status, 409); assert.equal(calls, 1);
  }
});

test('one in-flight request per profile and disconnect cancels provider request', async () => {
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let signal;
  const api = createAstridTranscriptionApi({ apiKey: 'synthetic-key', fetchImpl: async (url, init) => {
    signal = init.signal; started();
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  const first = request(api); await ready;
  const second = request(api, { replaceHeaders: { 'x-astrid-request-id': 'synthetic-2' } }); await second.done;
  assert.equal(second.res.status, 429);
  first.res.destroyed = true; first.res.emit('close'); await first.done;
  assert.equal(signal.aborted, true);
});

test('bounded or malformed provider output is rejected; empty words remain empty', async () => {
  for (const [response, status, text] of [[transcript(''), 200, ''], [transcript('x'.repeat(1001)), 502],
    [new Response('x'.repeat(17000)), 502], [Response.json({ text: 1 }), 502], [Response.json(null), 502]]) {
    const api = createAstridTranscriptionApi({ apiKey: 'synthetic-key', fetchImpl: async () => response });
    const result = request(api); await result.done; assert.equal(result.res.status, status);
    if (status === 200) assert.equal(result.res.body.text, text);
  }
});
