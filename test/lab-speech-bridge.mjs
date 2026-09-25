import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createNativeSpeechBridge, createLabSpeechBridge, LAB_SPEECH_BRIDGE_LIMITS } from '../web/public/lab-speech-bridge.mjs';

const channel = '7fb8a49e-8e28-41e4-a012-70ce56b72d7b';
const labOrigin = 'http://127.0.0.1:4197', nativeOrigin = 'http://127.0.0.1:4196';
const href = `${nativeOrigin}/?labObserverOrigin=${encodeURIComponent(labOrigin)}&labObserverChannel=${channel}`;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const tick = () => new Promise(resolve => setImmediate(resolve));
const bytes = value => new TextEncoder().encode(value).buffer;
const input = (requestId = 'request-1') => ({ requestId, text: 'Vad är mitt kort?' });
const choice = (requestId = 'request-1', extra = {}) => ({ kind: 'generatedText', requestId, dealerId: 'astrid',
  sessionRevision: 'session-1', roundRevision: '4', exactText: 'Du har en femma.', ...extra });
function generated(requestId = 'request-1') {
  const audio = bytes('test WAV bytes'), video = bytes('test MP4 bytes'), artifact = 'a'.repeat(32), reply = choice(requestId);
  const speechPackage = { schemaVersion: 2, packageId: `generated-${artifact}`, revision: 'revision-1', dealerId: 'astrid', exactText: reply.exactText,
    source: { kind: 'generatedText', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
    audio: { url: `/api/generated-speech/${artifact}/audio`, sha256: digest(Buffer.from(audio)), durationMs: 2000 },
    video: { videoId: 'video-1', url: `/api/generated-speech/${artifact}/video`, sha256: digest(Buffer.from(video)), fps: 24, frameCount: 48, presentation: 'lipsync' },
    audioDelayMs: 0, entryPose: 'standard-idle', exitPose: 'standard-idle', calibrationRevision: 'unreviewed-fixed-24fps', reviewStatus: 'pending',
    generation: { requestId, provider: 'elevenlabs-runpod', modelId: 'eleven_multilingual_v2', avatarId: 'astrid_spel2x',
      profileRevision: 'astrid-spel2x-preview-v1', textSha256: digest(reply.exactText), audioSha256: digest(Buffer.from(audio)) } };
  return { reply: { ...reply, speechPackage }, media: { audio, video } };
}

function harness(t, { nativeOptions = {}, labOptions = {} } = {}) {
  const wire = [], submitted = [], cancelled = [], received = [], statuses = [], loads = [];
  let native, lab;
  const nativeWindow = { postMessage(data, target, transfer) {
    assert.equal(target, nativeOrigin); wire.push({ to: 'native', event: { source: labWindow, origin: labOrigin, data: structuredClone(data, { transfer }) } });
  } };
  const labWindow = { postMessage(data, target, transfer) {
    assert.equal(target, labOrigin); wire.push({ to: 'lab', event: { source: nativeWindow, origin: nativeOrigin, data: structuredClone(data, { transfer }) } });
  } };
  native = createNativeSpeechBridge({ href, opener: labWindow, onSubmit: value => submitted.push(value), onCancel: value => cancelled.push(value),
    loadMedia: async (...args) => { loads.push(args); return generated(args[0].generation.requestId).media; }, ...nativeOptions });
  lab = createLabSpeechBridge({ source: nativeWindow, origin: nativeOrigin, channel, onReady: value => received.push(value), onStatus: value => statuses.push(value), ...labOptions });
  t.after(() => { lab.close(); native.close(); });
  const pump = async () => { while (wire.length) { const item = wire.shift(); await (item.to === 'native' ? native : lab).accept(item.event); } await tick(); };
  return { native, lab, wire, submitted, cancelled, received, statuses, loads, nativeWindow, labWindow, pump,
    async attach() { assert.equal(lab.attach(), true); await pump(); },
    async submit(requestId = 'request-1') { assert.equal(lab.submit(input(requestId)), true); await pump(); } };
}

test('bridge is separate, explicitly handshaken, loopback-only and never submits before attach', async t => {
  const h = harness(t);
  assert.equal(h.lab.submit(input()), false);
  await h.attach(); await h.submit();
  assert.equal(h.submitted.length, 1);
  assert.deepEqual(Object.keys(h.submitted[0]), ['requestId', 'text', 'signal']);
  assert.equal(h.submitted[0].signal.aborted, false);
  assert.equal(h.statuses[0].state, 'attached');
  for (const invalid of ['', 'https://game.example/', href.replace(nativeOrigin, 'https://external.example'), href.replace(encodeURIComponent(labOrigin), encodeURIComponent('https://external.example'))]) {
    assert.equal(createNativeSpeechBridge({ href: invalid, opener: h.labWindow, onSubmit() {} }).enabled, false);
  }
  assert.equal(createLabSpeechBridge({ source: h.nativeWindow, origin: 'https://external.example', channel, onReady() {} }).enabled, false);
});

test('every operation checks exact source, origin, channel, nonce, type and allowed fields', async t => {
  const h = harness(t); h.lab.attach(); const first = h.wire.shift();
  for (const alter of [e => { e.source = {}; }, e => { e.origin = 'http://localhost:4197'; }, e => { e.data.channel = 'different-channel-123'; },
    e => { e.data.nonce = 'guess'; }, e => { e.data.type = 'croupier-native-observation'; }, e => { e.data.version = 2; }, e => { e.data.payload.token = 'secret'; }]) {
    const event = { ...first.event, data: structuredClone(first.event.data) }; alter(event);
    assert.equal(h.native.accept(event), false);
  }
  assert.equal(h.native.accept(first.event), true); await h.pump();
  h.lab.submit(input()); const submission = h.wire.shift();
  for (const alter of [e => { e.data.nonce = crypto.randomUUID(); }, e => { e.data.payload.dealerId = 'vera'; },
    e => { e.data.payload.history = []; }, e => { e.data.payload.op = 'deal'; }, e => { e.data.kind = 'game-command'; }]) {
    const event = { ...submission.event, data: structuredClone(submission.event.data) }; alter(event);
    assert.equal(h.native.accept(event), false);
  }
  assert.equal(h.submitted.length, 0);
  assert.equal(h.native.accept(submission.event), true); await tick(); assert.equal(h.submitted.length, 1);
});

test('one request stays owned through prepared reply until complete; completed IDs cannot be charged again', async t => {
  const h = harness(t); await h.attach(); await h.submit();
  assert.equal(h.lab.submit(input('request-2')), false);
  assert.equal(await h.native.ready(choice('different-request')), false);
  assert.equal(await h.native.ready(choice()), true); await h.pump();
  assert.equal(h.received.length, 1); assert.equal(h.received[0].media, null);
  assert.equal(h.lab.submit(input('request-2')), false);
  assert.equal(h.lab.complete('request-1'), true); await h.pump();
  assert.equal(h.received[0].signal.aborted, true);
  assert.equal(h.lab.submit(input()), false);
  await h.submit('request-2'); assert.equal(h.submitted.length, 2);
});

test('server reply projects only closed contract; recorded/silence never invent new assets', async t => {
  const h = harness(t); await h.attach(); await h.submit();
  assert.equal(await h.native.ready(choice('request-1', { token: 'private', playerId: 'private', history: [], audioUrl: 'https://external.example/audio', provider: 'responded' })), true);
  await h.pump(); assert.equal(JSON.stringify(h.received[0]).includes('private'), false);
  assert.equal(JSON.stringify(h.received[0]).includes('external.example'), false);
  h.lab.complete('request-1'); await h.pump(); await h.submit('request-2');
  assert.equal(await h.native.ready(choice('request-2', { kind: 'recordedLine', lineId: 'goodluck', familyId: 'speak.goodluck', variantId: null })), true);
  await h.pump(); assert.equal(h.received[1].decision.lineId, 'goodluck'); assert.equal(h.loads.length, 0);
  h.lab.complete('request-2'); await h.pump(); await h.submit('request-3');
  assert.equal(await h.native.ready(choice('request-3', { kind: 'silence' })), true);
  await h.pump(); assert.equal(h.received[2].decision.exactText, undefined);
});

test('generated media is bound to exact package/request/text and validated on both ends', async t => {
  const h = harness(t); await h.attach(); await h.submit(); const { reply, media } = generated();
  assert.equal(await h.native.ready(reply), true); await h.pump();
  assert.equal(h.received.length, 1); assert.equal(h.received[0].decision.speechPackage.reviewStatus, 'pending');
  assert.deepEqual(h.received[0].media, media);
  assert.equal(h.loads[0][0].audio.url.startsWith('/api/generated-speech/'), true);
  assert.equal(h.loads[0][1].signal, h.submitted[0].signal);
  assert.equal(h.loads[0][1].exactText, reply.exactText);
  assert.equal(h.received[0].signal.aborted, false);
});

test('native refuses mismatched package ID/text/profile and arbitrary remote media URLs without loading', async t => {
  for (const mutate of [r => { r.speechPackage.generation.requestId = 'other-request'; }, r => { r.exactText = 'Olika text.'; },
    r => { r.speechPackage.audio.url = 'https://external.example/private'; }, r => { r.speechPackage.reviewStatus = 'approved'; },
    r => { r.dealerId = 'vera'; }]) {
    const h = harness(t); await h.attach(); await h.submit(); const { reply } = generated(); mutate(reply);
    assert.equal(await h.native.ready(reply), false); await h.pump();
    assert.equal(h.loads.length, 0); assert.equal(h.received.length, 0); assert.equal(h.submitted[0].signal.aborted, true);
  }
});

test('native hash failure/oversize/URL output fails once without automatic paid retry', async t => {
  for (const media of [ { audio: bytes('bad hash'), video: generated().media.video },
    { audio: new ArrayBuffer(LAB_SPEECH_BRIDGE_LIMITS.audioBytes + 1), video: generated().media.video },
    { audio: generated().media.audio, video: new ArrayBuffer(LAB_SPEECH_BRIDGE_LIMITS.videoBytes + 1) },
    { audio: '/api/private', video: 'https://remote.example/movie' } ]) {
    let calls = 0; const h = harness(t, { nativeOptions: { loadMedia: async () => { calls++; return media; } } });
    await h.attach(); await h.submit(); assert.equal(await h.native.ready(generated().reply), false); await h.pump();
    assert.equal(calls, 1); assert.equal(h.received.length, 0); assert.equal(h.lab.submit(input()), false);
    assert.equal(await h.native.ready(generated().reply), false); assert.equal(calls, 1);
  }
});

test('lab rejects corrupted transferred bytes, extra reply fields, wrong source and stale request', async t => {
  for (const mutate of [event => { new Uint8Array(event.data.payload.media.audio)[0] ^= 1; },
    event => { event.data.payload.decision.cookie = 'secret'; }, event => { event.source = {}; },
    event => { event.data.payload.decision.requestId = 'old-request'; }]) {
    const h = harness(t); await h.attach(); await h.submit(); await h.native.ready(generated().reply);
    const item = h.wire.shift(); mutate(item.event);
    assert.equal(await h.lab.accept(item.event), false); assert.equal(h.received.length, 0);
  }
});

test('cancel and close abort both pending loader and delivered-but-not-played reply', async t => {
  let resolveLoad; const h = harness(t, { nativeOptions: { loadMedia: () => new Promise(resolve => { resolveLoad = resolve; }) } });
  await h.attach(); await h.submit(); const ready = h.native.ready(generated().reply); await tick();
  assert.equal(h.lab.cancel('request-1'), true); await h.pump();
  assert.equal(h.submitted[0].signal.aborted, true); resolveLoad(generated().media);
  assert.equal(await ready, false); await h.pump(); assert.equal(h.received.length, 0);
  await h.submit('request-2'); await h.native.ready(choice('request-2')); await h.pump();
  h.lab.close(); await h.pump();
  assert.equal(h.received[0].signal.aborted, true); assert.equal(h.submitted[1].signal.aborted, true);
  assert.equal(h.lab.submit(input('request-3')), false); assert.equal(h.native.accept({}), false);
});

test('duplicate ready is at most once, stale nonce cannot replace the live channel', async t => {
  const h = harness(t); await h.attach(); await h.submit(); await h.native.ready(choice());
  const message = h.wire.shift(); assert.equal(await h.lab.accept(message.event), true);
  assert.equal(await h.lab.accept(message.event), false); assert.equal(h.received.length, 1);
  assert.equal(await h.native.ready(choice()), false);
  const alternate = createLabSpeechBridge({ source: h.nativeWindow, origin: nativeOrigin, channel, onReady() {} });
  alternate.attach(); const handshake = h.wire.shift(); assert.equal(h.native.accept(handshake.event), false);
  alternate.close();
});

test('short request deadline cancels generation, no late reply and no retry', async t => {
  const h = harness(t, { nativeOptions: { timeoutMs: 15 }, labOptions: { timeoutMs: 15 } });
  await h.attach(); await h.submit(); await new Promise(resolve => setTimeout(resolve, 30)); await h.pump();
  assert.equal(h.submitted[0].signal.aborted, true); assert.equal(await h.native.ready(choice()), false);
  assert.equal(h.lab.submit(input()), false); assert.equal(h.received.length, 0);
});

test('synchronous/async callback failures cannot leak raw errors or restart work', async t => {
  const h = harness(t, { nativeOptions: { onSubmit: async () => { throw Error('private-key-value'); } } });
  await h.attach(); await h.submit(); await tick(); await h.pump();
  assert.equal(h.statuses.some(value => value.state === 'failed'), true);
  assert.equal(JSON.stringify(h.statuses).includes('private-key-value'), false);
  assert.equal(h.lab.submit(input()), false);
  const other = harness(t, { labOptions: { onReady() { throw Error('UI failed'); } } });
  await other.attach(); await other.submit(); await other.native.ready(choice()); await other.pump();
  assert.equal(other.submitted[0].signal.aborted, true);
});

test('submit bounds text and request identifiers, no extra authority can hitchhike', async t => {
  const h = harness(t); await h.attach();
  for (const value of [{ ...input(), text: 'x'.repeat(501) }, { ...input(), text: '\ntrimmed' }, { ...input(), text: 'bad\u0000value' },
    { ...input(), requestId: '' }, { ...input(), requestId: '../private' }, { ...input(), roundRevision: '4' }, { ...input(), playerId: 'other' }]) {
    assert.equal(h.lab.submit(value), false);
  }
  assert.equal(h.submitted.length, 0);
});
