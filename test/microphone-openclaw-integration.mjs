import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { createAstridTranscriptionApi } from '../services/game/astrid-transcription.mjs';
import { openClawChat } from '../services/game/openclaw-chat.mjs';
import { createProductSpeechService } from '../packages/director/product-speech.mjs';
import { completeChatWithSpeech } from '../services/game/generated-speech-chat.mjs';
import { createDealerSpeechRuntime } from '../services/game/dealer-speech-runtime.mjs';
import { createMovingSpeechSourceSet } from '../services/game/moving-speech-bank.mjs';
import { createMovingSpeechRuntime } from '../services/game/moving-speech-runtime.mjs';
import { readChatResponse } from '../packages/presentation/contracts/chat-response.mjs';
import { validateMovingSpeechStream } from '../packages/presentation/runtime/moving-speech-player.mjs';
import { microphoneControl, until } from './fixtures/microphone-control.mjs';
// The single-dealer fixture is one lane of the per-dealer runtime.
const oneLane = ({ bank, sessions, admissionCheck, ...options }) => ({ ...options, lanes: [{ bank, sessions, admissionCheck }] });

const { WebSocket } = createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const videoId = '11111111-1111-4111-8111-111111111111', profileRevision = 'a'.repeat(64);
const owner = 'fixture-player-one', sessionId = '1'.repeat(32);
const context = { dealerId: 'dragan' };
const json = (res, code, value) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
const readJson = async req => { let text = ''; for await (const chunk of req) text += chunk; return JSON.parse(text); };
const authority = () => ({ dealerId: 'dragan', sessionRevision: 'session-one', roundRevision: '7', displayName: 'Synthetic player',
  playerId: 'private-player', wallet: { balance: 999 }, futureShoe: [{ r: 'A', s: '♠' }], cookie: 'private-cookie',
  occupiedBoxes: [3], policy: { recordedLines: [], generatedText: true, silence: true, mediaFamilies: [] },
  round: { phase: 'decisions', hands: [{ box: 3, cards: [{ r: '8', s: '♥', shoeDraw: 1 }] }],
    dealer: [{ r: '6', s: '♦', shoeDraw: 2 }, { r: 'K', s: '♣', shoeDraw: 4, faceDown: true }] },
  publishedEvents: [{ type: 'deal', to: 'dealer', faceDown: true, shoeDraw: 4, card: { r: 'K', s: '♣' } }] });

async function setup(t, { transcript, reply, beforeTranscript = async () => {} }) {
  const state = { playerId: owner, stt: 0, model: 0, tts: [], previews: [], decisions: [], pcm: [], plans: [], cancelled: 0,
    failed: [], sessions: 0, uploads: [] };
  const original = Buffer.from('synthetic-dragan-original'), pcm = Buffer.alloc(36000, 1);
  const sourceSet = createMovingSpeechSourceSet({ dealerId: 'dragan',
    clips: [{ videoId, sha256: digest(original), bytes: original.length, fps: 24, frameCount: 48, width: 1080, height: 1920 }],
    rest: { videoId, frame: 7 } });
  const registry = { videos: [{ id: videoId, dealer: 'dragan', revision: 'fixture-media-1', sha256: digest(original),
    bytes: original.length, size: original.length, available: true, storage: 'private-blob', contentType: 'video/mp4',
    classification: { dealerId: 'dragan', eventId: 'idle.ready', kind: 'idle', role: 'standard', label: 'Idle', notes: '', situation: '', compositing: { mode: 'green-screen', threshold: .21, softness: .13, despill: .1 } } }] };
  const artifact = (extension, contentType, bytes) => ({ provider: 'vercel-blob',
    pathname: `croupier/media/dealers/dragan/runtime/moving-bank/${videoId}/${digest(bytes)}.${extension}`,
    contentType, size: bytes.length, sha256: digest(bytes) });
  const bank = { schemaVersion: 1, sourceSet, archive: artifact('bin', 'application/octet-stream', Buffer.from('bank')),
    receipt: artifact('json', 'application/json', Buffer.from('{}')) };
  const project = { dealers: [{ id: 'dragan', speechProfile: { schemaVersion: 2, state: 'enabled',
    voice: { provider: 'elevenlabs', voiceId: 'own-dragan-voice', modelId: 'eleven_multilingual_v2', language: 'sv' },
    reference: { kind: 'motion-video', videoId, sha256: digest(original), offsetMs: 0 } } }],
    dealerIdlePolicies: [{ dealerId: 'dragan', policy: { schemaVersion: 1, familyId: 'dragan/idle.ready/ready',
      base: [{ videoId, weight: 100, durationMs: 2000 }], variants: [] } }],
    lines: [{ dealerId: 'dragan', eventId: 'idle.ready', baselineVariantId: 'dragan.idle.ready.standard',
      variants: [{ id: 'dragan.idle.ready.standard', triggerIds: [], videoGenerationId: videoId }] }] };
  const dealerRuntime = createDealerSpeechRuntime({ readProject: async () => project, readVideoRegistry: async () => registry,
    referenceService: { prepare: async () => assert.fail('moving speech must not extract a still') },
    env: { CROUPIER_DEALER_SPEECH_PROFILES: '1', ELEVENLABS_API_KEY: 'fixture-only' },
    fetchImpl: async (url, input) => {
      if (input.method === 'GET') {
        assert.equal(url, 'https://api.elevenlabs.io/v1/voices/own-dragan-voice');
        return Response.json({ voice_id: 'own-dragan-voice' });
      }
      assert.equal(url, 'https://api.elevenlabs.io/v1/text-to-speech/own-dragan-voice/stream?output_format=pcm_24000');
      state.tts.push(JSON.parse(input.body));
      return new Response(pcm, { headers: { 'content-type': 'application/octet-stream' } });
    } });
  const stt = createAstridTranscriptionApi({ apiKey: 'fixture-only', fetchImpl: async (url, input) => {
    assert.equal(url, 'https://api.openai.com/v1/audio/transcriptions');
    assert.equal(input.body.get('model'), 'whisper-1');
    assert.equal(input.body.has('language'), false); assert.equal(input.body.has('prompt'), false);
    const bytes = Buffer.from(await input.body.get('file').arrayBuffer());
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF'); assert.equal(bytes.readUInt32LE(24), 16000);
    state.stt++; await beforeTranscript(); return Response.json({ text: transcript });
  } });
  const settings = { baseUrl: 'http://127.0.0.1/', gatewayKey: 'fixture-only', speechAgent: 'openclaw/croupier-speech',
    chatAgent: 'openclaw/croupier-chat', adviceTimeoutMs: 5000 };
  const director = createProductSpeechService({ settingsProvider: () => settings,
    fetchImpl: async () => assert.fail('model transport must remain synthetic'),
    completeImpl: async (_settings, body) => {
      state.model++; assert.equal(body.model, 'openclaw/croupier-speech'); assert.equal(body.tool_choice, 'none');
      const envelope = JSON.parse(body.messages[1].content);
      assert.equal(envelope.request.message, transcript); assert.equal(envelope.status.dealerId, 'dragan');
      const serialized = JSON.stringify(envelope.status);
      for (const secret of ['private-player', 'private-cookie', 'wallet', 'futureShoe']) assert.equal(serialized.includes(secret), false);
      assert.deepEqual(envelope.status.visibleCards.dealer.cards, [{ r: '6', s: '♦', shoeDraw: 2, faceDown: false }]);
      assert.equal(envelope.status.publishedEvents[0].card, null);
      return JSON.stringify({ kind: 'generatedText', requestId: envelope.request.requestId, dealerId: 'dragan',
        sessionRevision: 'session-one', roundRevision: '7', text: reply });
    } });
  const current = async () => {
    if (state.playerId !== owner) throw Object.assign(Error('stale_chat_session'), { statusCode: 409 });
    return authority();
  };
  let runtime, base, mic;
  const sockets = [];
  const server = createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/api/dealer/observation?')) {
        return json(res, 200, { enabled: true, profileRevision,
          transcription: { enabled: true, outputLanguage: 'original', acceptsAutoLanguage: true }, vision: { enabled: false } });
      }
      if (req.url === '/api/dealer/transcription') {
        assert.equal(req.headers['x-astrid-dealer'], 'dragan'); assert.equal(req.headers['x-astrid-language'], 'auto');
        assert.deepEqual(JSON.parse(req.headers['x-dealer-presentation-context']), context);
        state.uploads.push(req.headers['x-astrid-request-id']);
        return stt.handle(req, res, { enabled: true, profileRevision, dealerId: 'dragan', checkCurrent: async value => {
          await current(); assert.equal(value.sessionRevision, 'session-one'); assert.equal(value.roundRevision, '7');
        } });
      }
      if (req.url === '/api/product/speech') {
        assert.equal(req.headers.authorization, 'Bearer fixture-speech-token');
        return json(res, 200, await director.handle(await readJson(req)));
      }
      if (req.url === '/chat') {
        const input = await readJson(req), frames = [];
        const decision = await completeChatWithSpeech({ request: input, status: await current(), owner, playerId: owner,
          readOwner: async () => state.playerId, readStatus: current,
          decide: (request, status) => openClawChat(request, status, { settingsProvider: () => ({ ...settings,
            speechUrl: base, speechToken: 'fixture-speech-token' }), fetchImpl: loopbackFetch }),
          streamService: runtime.forContext(context, undefined, 'session-one'),
          onDecision: exactText => frames.push({ type: 'preview', exactText }),
          onProgress: stage => frames.push({ type: 'progress', stage, elapsedMs: 0 }) });
        frames.push({ type: 'result', decision });
        res.writeHead(200, { 'content-type': 'application/x-ndjson' });
        return res.end(frames.map(frame => JSON.stringify(frame) + '\n').join(''));
      }
      if (await runtime.handleHttp(req, res)) return;
      json(res, 404, {});
    } catch (error) {
      state.failed.push(error);
      if (!res.writableEnded) json(res, error.statusCode ?? 500, { error: 'fixture_failed' });
    }
  });
  t.after(async () => {
    mic?.restore(); sockets.forEach(socket => socket.terminate()); await runtime?.close();
    server.closeAllConnections(); if (server.listening) await new Promise(resolve => server.close(resolve));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const loopbackFetch = (url, input) => {
    const target = new URL(url, base); assert.equal(target.origin, base, 'fixture cannot contact a provider');
    return fetch(target, input);
  };
  runtime = createMovingSpeechRuntime(oneLane({ server, origin: base, workerOrigin: 'https://worker.fixture.test', bank, releaseSha256: profileRevision, dealerRuntime,
    ticketSecret: 'fixture-only-ticket-secret-32-characters', resolveOwner: async req => req.headers.cookie === 'owner=one' ? owner : 'other',
    readRegistry: async () => registry, readRest: async () => new Response(original),
    readEvidence: async () => ({ projectRevision: 1, mediaReferences: [{ id: videoId, sha256: digest(original) }],
      frozenContext: { schemaVersion: 3, context, dealer: { id: 'dragan' }, project, inventory: registry, records: registry.videos } }),
    publicVideo: (frozen, id) => {
      const video = frozen.records.find(row => row.id === id);
      return { id: video.id, sha256: video.sha256, src: '/api/presentation/registered-video/fixture/' + video.id };
    },
    bankRead: async () => assert.fail('no bank or provider download in this test'),
    onPreparationFailure: value => state.failed.push(value), onStreamFailure: value => state.failed.push(value),
    sessions: { async admit(input) {
      state.sessions++; await input.beforeCostly();
      const binding = { ...input.binding, schemaVersion: 1, sessionId, attemptId: 'attempt-1', nonce: '2'.repeat(64) };
      return { sessionId, binding, submit: input.beforeCostly, ready: input.beforeCostly,
        cancel: async () => { state.cancelled++; }, handleUpgrade: () => false,
        dispatch: async (prepared, { onChunk }) => {
          state.plans.push(prepared.plan);
          for (let offset = 0; offset < prepared.plan.timeline.length; offset += 12) {
            const rows = prepared.plan.timeline.slice(offset, offset + 12);
            await onChunk({ t: 'lapp', id: prepared.plan.start.id, del: offset / 12, fran: offset,
              rutor: rows.map(row => ({ tagning: row.take, ruta: row.frame, rect: [1, 2, 30, 40] })) }, Buffer.from([1, 2, 3]));
          }
        } };
    } } }));
  mic = microphoneControl({ identity: () => ({ playerId: state.playerId, dealerId: 'dragan', sessionRevision: 'session-one', roundRevision: '7' }),
    presentationContext: () => context,
    fetchImpl: (url, input = {}) => loopbackFetch(url, { ...input, headers: { ...input.headers, Origin: base, Cookie: 'owner=one' } }),
    send: async input => {
      const requestId = randomUUID();
      const response = await loopbackFetch('/chat', { method: 'POST', body: JSON.stringify({ requestId, message: input.message, history: [] }) });
      const decision = await readChatResponse(response, () => {}, text => state.previews.push(text));
      state.decisions.push(decision);
      const descriptor = await validateMovingSpeechStream(decision.speechStream, { dealerId: 'dragan', requestId, exactText: decision.exactText });
      const ws = new WebSocket(base.replace('http:', 'ws:') + descriptor.url, ['moving-v1', `ticket.${descriptor.ticket}`],
        { headers: { Origin: base, Cookie: 'owner=one' } });
      sockets.push(ws); const messages = [], closed = once(ws, 'close');
      ws.on('message', (data, binary) => messages.push(binary ? Buffer.from(data) : JSON.parse(data.toString())));
      await once(ws, 'open'); await until(() => messages.length >= 3);
      state.pcm.push(messages[2]);
      assert.equal(messages[0].plan.binding.audioSha256, digest(messages[2]));
      assert.equal(messages[0].plan.binding.textSha256, digest(decision.exactText));
      assert.equal(descriptor.sequenceKind, 'idle');
      assert.equal(messages[0].sequence.steps[0].video.id, videoId);
      assert.ok(messages[0].plan.timeline.every((row, index) =>
        row.take === 'clip-' + videoId && row.frame === index % 48 && row.sourceSha256 === digest(original)));
      ws.send(JSON.stringify({ t: 'credit', id: messages[0].plan.start.id, frames: messages[0].plan.timeline.length }));
      await until(() => messages.some(message => message.t === 'done'));
      assert.deepEqual(messages.at(-1), { t: 'done', id: messages[0].plan.start.id, frames: messages[0].plan.timeline.length });
      ws.send(JSON.stringify({ t: 'played', id: messages[0].plan.start.id }));
      assert.equal((await closed)[0], 1000);
      return true;
    } });
  return { state, mic, pcm };
}

for (const [name, transcript, reply] of [
  ['Swedish', 'Dragan, svara på svenska: hur går det?', 'Det går bra. Lycka till!'],
  ['English', 'Dragan, answer in English: how is it going?', 'It is going well. Good luck!'],
]) {
  test(`${name} microphone turn crosses original-language STT, real Director relay and registered moving PCM`, { timeout: 10000 }, async t => {
    const f = await setup(t, { transcript, reply }); await f.mic.recordTurn();
    await until(() => !f.mic.control.active && !f.mic.control.busy);
    assert.equal(f.state.stt, 1); assert.equal(f.state.model, 1); assert.equal(f.state.sessions, 1);
    assert.equal(f.mic.sent.length, 1); assert.equal(f.mic.sent[0].message, transcript);
    assert.deepEqual(f.state.previews, [reply]); assert.equal(f.state.decisions[0].exactText, reply);
    assert.equal(f.state.tts.length, 1); assert.equal(f.state.tts[0].text, reply);
    assert.equal(f.state.tts[0].model_id, 'eleven_multilingual_v2');
    assert.deepEqual(f.state.pcm, [f.pcm]); assert.equal(f.state.plans.length, 1);
    assert.ok(f.mic.tracks.every(track => track.stopped)); assert.deepEqual(f.state.failed, []);
  });
}

test('identity changes during transcription prevent any later Director, voice or moving admission', { timeout: 10000 }, async t => {
  const pending = Promise.withResolvers();
  const f = await setup(t, { transcript: 'Sent svar till fel spelare.', reply: 'Must not be generated.', beforeTranscript: () => pending.promise });
  t.after(() => pending.resolve());
  await f.mic.recordTurn(); await until(() => f.state.stt === 1);
  f.state.playerId = 'fixture-player-two'; pending.resolve();
  await until(() => !f.mic.control.active && !f.mic.control.busy);
  assert.equal(f.mic.sent.length, 0); assert.equal(f.state.model, 0); assert.equal(f.state.sessions, 0);
  assert.equal(f.state.tts.length, 0); assert.equal(f.state.pcm.length, 0);
  assert.ok(f.mic.tracks.every(track => track.stopped)); assert.deepEqual(f.state.failed, []);
});
