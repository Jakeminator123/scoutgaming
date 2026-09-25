import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { loadGeneratedSpeech, playGeneratedSpeech } from '../web/public/generated-speech-player.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const audioBytes = Buffer.from('fixture exact WAV bytes');
const videoBytes = Buffer.from('fixture exact MP4 bytes');
const text = 'Good evening, your visible cards are an ace and a nine.';
const artifact = 'a'.repeat(32);
function packet() {
  return {
    schemaVersion: 2, packageId: `generated-${artifact}`, revision: 'preview-v1', dealerId: 'astrid', exactText: text,
    source: { kind: 'generatedText', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
    audio: { url: `/api/generated-speech/${artifact}/audio`, sha256: hash(audioBytes), durationMs: 1000 },
    video: { videoId: `generated-${artifact}-video`, url: `/api/generated-speech/${artifact}/video`, sha256: hash(videoBytes), fps: 24, frameCount: 24, presentation: 'lipsync' },
    audioDelayMs: 0, entryPose: 'standard-idle', exitPose: 'standard-idle', calibrationRevision: 'unreviewed-fixed-24fps', reviewStatus: 'pending',
    generation: { requestId: 'fixture-speech-request', provider: 'elevenlabs-runpod', modelId: 'eleven_multilingual_v2', avatarId: 'astrid_spel2x',
      profileRevision: 'astrid-spel2x-preview-v1', textSha256: hash(text), audioSha256: hash(audioBytes) },
  };
}
const options = extra => ({ exactText: text, dealerId: 'astrid', ...extra });
function mediaResponse(url, patches = {}) {
  const audio = url.endsWith('/audio');
  return new Response(patches.bytes ?? (audio ? audioBytes : videoBytes), {
    status: patches.status ?? 200, headers: { 'content-type': audio ? 'audio/wav' : 'video/mp4', ...patches.headers },
  });
}

test('loader accepts only a bound pending v2 take and returns exact hash-checked blobs', async () => {
  const calls = [], controller = new AbortController();
  const value = packet();
  const loaded = await loadGeneratedSpeech(value, options({ signal: controller.signal, fetchImpl: async (url, init) => { calls.push({ url, ...init }); return mediaResponse(url); } }));
  assert.deepEqual(loaded.speech, value);
  assert.equal(loaded.speech.reviewStatus, 'pending');
  assert.deepEqual(Buffer.from(await loaded.audio.arrayBuffer()), audioBytes);
  assert.deepEqual(Buffer.from(await loaded.video.arrayBuffer()), videoBytes);
  assert.equal(loaded.audio.type, 'audio/wav'); assert.equal(loaded.video.type, 'video/mp4');
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.signal, controller.signal); assert.equal(call.credentials, 'same-origin');
    assert.equal(call.redirect, 'error'); assert.equal(call.cache, 'no-store');
  }
});

test('wrong dealer/text/profile, approval state and schema are rejected before fetching media', async () => {
  for (const mutate of [
    p => { p.dealerId = 'vera'; }, p => { p.exactText = 'Other words.'; }, p => { p.reviewStatus = 'approved'; },
    p => { p.reviewStatus = 'rejected'; }, p => { p.source.voiceId = 'wrong-voice'; },
    p => { p.generation.avatarId = 'wrong-avatar'; }, p => { p.generation.profileRevision = 'wrong-profile'; },
    p => { p.audioDelayMs = 20; }, p => { p.entryPose = 'dealing'; }, p => { p.audio.durationMs = 25001; },
    p => { p.video.fps = 30; }, p => { p.video.frameCount = 100; },
    p => { p.schemaVersion = 1; p.video.presentation = 'neutral'; delete p.generation; },
  ]) {
    const value = packet(); mutate(value);
    let calls = 0;
    await assert.rejects(loadGeneratedSpeech(value, options({ fetchImpl: async () => { calls++; return mediaResponse('audio'); } })));
    assert.equal(calls, 0);
  }
  await assert.rejects(loadGeneratedSpeech(packet(), options({ dealerId: 'vera', fetchImpl: () => assert.fail('wrong dealer must not fetch') })));
});

test('explicit bridge bytes avoid network access and retain the same hash, size and abort checks', async () => {
  const bytes = value => new Uint8Array(value).buffer;
  const media = { audio: bytes(audioBytes), video: bytes(videoBytes) };
  const noFetch = () => assert.fail('transferred media must not fetch using lab credentials');
  const loaded = await loadGeneratedSpeech(packet(), options({ media, fetchImpl: noFetch }));
  assert.deepEqual(Buffer.from(await loaded.audio.arrayBuffer()), audioBytes);
  assert.deepEqual(Buffer.from(await loaded.video.arrayBuffer()), videoBytes);
  await assert.rejects(loadGeneratedSpeech(packet(), options({ media: { ...media, video: bytes(Buffer.from('wrong')) }, fetchImpl: noFetch })), /hash mismatch/);
  await assert.rejects(loadGeneratedSpeech(packet(), options({ media: { ...media, audio: new ArrayBuffer(2 * 1024 * 1024 + 1) }, fetchImpl: noFetch })), /Invalid transferred/);
  await assert.rejects(loadGeneratedSpeech(packet(), options({ media, signal: AbortSignal.abort(), fetchImpl: noFetch })), { name: 'AbortError' });
});

test('media cannot escape its same-origin artifact pair or substitute another artifact or media kind', async () => {
  for (const url of ['https://attacker.example/video', '//attacker.example/video', '/api/generated-speech/../video',
    `/api/generated-speech/${'b'.repeat(32)}/video`, `/api/generated-speech/${artifact}/audio`,
    `/api/generated-speech/${artifact}/video?token=secret`, `/api/generated-speech/${artifact}/video#fragment`]) {
    const value = packet(); value.video.url = url;
    await assert.rejects(loadGeneratedSpeech(value, options({ fetchImpl: () => assert.fail('unbound URL must not fetch') })));
  }
});

test('either media hash mismatch rejects the take, with no attempt to substitute old media', async () => {
  for (const kind of ['audio', 'video']) {
    const value = packet(); value[kind].sha256 = 'b'.repeat(64);
    if (kind === 'audio') value.generation.audioSha256 = value.audio.sha256;
    const urls = [];
    await assert.rejects(loadGeneratedSpeech(value, options({ fetchImpl: async url => { urls.push(url); return mediaResponse(url); } })), /hash mismatch/);
    assert.equal(urls.length, 2);
    assert.ok(urls.every(url => url.startsWith(`/api/generated-speech/${artifact}/`)));
  }
});

test('text provenance hash must match the exact text, not merely contain 64 hex characters', async () => {
  const value = packet(); value.generation.textSha256 = 'b'.repeat(64);
  await assert.rejects(loadGeneratedSpeech(value, options({ fetchImpl: async url => mediaResponse(url) })), /hash|match|package/i);
});

test('wrong media type, HTTP failure, empty media and declared excessive length are rejected', async () => {
  for (const patches of [
    { headers: { 'content-type': 'text/html' } }, { status: 404 }, { bytes: new Uint8Array() },
    { headers: { 'content-length': String(31 * 1024 * 1024) } },
  ]) {
    await assert.rejects(loadGeneratedSpeech(packet(), options({ fetchImpl: async url => mediaResponse(url, patches) })));
  }
});

test('streamed bytes are bounded independently of Content-Length and the stream is cancelled', async () => {
  let cancelled = false;
  const overLimitAudio = () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)); },
    cancel() { cancelled = true; },
  }), { headers: { 'content-type': 'audio/wav' } });
  await assert.rejects(loadGeneratedSpeech(packet(), options({ fetchImpl: async url => url.endsWith('/audio') ? overLimitAudio() : mediaResponse(url) })), /too large/);
  assert.equal(cancelled, true);
});

test('aborted load cannot return playable blobs even when a mock fetch still resolves', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadGeneratedSpeech(packet(), options({ signal: controller.signal, fetchImpl: async url => mediaResponse(url) })), { name: 'AbortError' });
});

function browser(t, { ready = true, audioDuration = 1, videoDuration = 1, play, fetchImpl } = {}) {
  const created = [], revoked = [], frames = new Map(); let nextFrame = 0;
  class Element extends EventTarget {
    constructor(kind) { super(); this.kind = kind; this.style = {}; this.children = []; this.attributes = {}; }
    append(...nodes) { this.children.push(...nodes); for (const node of nodes) node.parent = this; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; this.removed = true; }
    setAttribute(name, value) { this.attributes[name] = value; }
  }
  class Media extends Element {
    constructor(kind, src) { super(kind); this.src = src; this.readyState = ready ? 3 : 0; this.duration = kind === 'audio' ? audioDuration : videoDuration;
      this.currentTime = 0; this.paused = true; this.ended = false; this.playCalls = 0; this.pauseCalls = 0; created.push(this); }
    play() { this.playCalls++; this.paused = false; return play?.(this) ?? Promise.resolve(); }
    pause() { this.pauseCalls++; this.paused = true; }
    load() { this.loadCalls = (this.loadCalls ?? 0) + 1; }
  }
  const setGlobal = (name, value) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name]);
  };
  setGlobal('Audio', class extends Media { constructor(src) { super('audio', src); } });
  setGlobal('document', { createElement: kind => kind === 'video' ? new Media(kind) : new Element(kind) });
  setGlobal('requestAnimationFrame', callback => { const id = ++nextFrame; frames.set(id, callback); return id; });
  setGlobal('cancelAnimationFrame', id => frames.delete(id));
  t.mock.method(globalThis, 'fetch', fetchImpl ?? (async url => mediaResponse(url)));
  let objectId = 0;
  t.mock.method(URL, 'createObjectURL', () => `blob:fixture-${++objectId}`);
  t.mock.method(URL, 'revokeObjectURL', url => revoked.push(url));
  const mount = new Element('mount');
  return { mount, created, revoked, frames, audio: () => created.find(node => node.kind === 'audio'), video: () => created.find(node => node.kind === 'video') };
}
async function until(predicate) {
  for (let attempts = 0; attempts < 200; attempts++) { if (predicate()) return; await pause(1); }
  assert.fail('mock media lifecycle did not reach its expected state');
}

test('player starts once, mutes muxed video, ends on exact audio and releases media/URLs/RAF', async t => {
  const env = browser(t), receipts = [], starts = [];
  const playback = playGeneratedSpeech(packet(), options({ mount: env.mount, onStart: value => starts.push(value), onReceipt: value => receipts.push(value) }));
  await until(() => receipts.some(value => value.state === 'start'));
  assert.deepEqual(starts, [text]);
  assert.equal(env.audio().playCalls, 1); assert.equal(env.video().playCalls, 1);
  assert.equal(env.video().muted, true, 'the separate exact WAV must be the only audible track');
  assert.equal(env.mount.children.length, 1);
  assert.match(env.mount.children[0].children[1].textContent, /ej visuellt godkänt/);
  env.audio().ended = true; env.audio().dispatchEvent(new Event('ended')); env.audio().dispatchEvent(new Event('ended'));
  await playback;
  assert.deepEqual(receipts.map(value => value.state), ['start', 'end']);
  assert.ok(receipts.every(value => value.reviewStatus === 'pending'));
  assert.equal(env.audio().paused, true); assert.equal(env.video().paused, true);
  assert.equal(env.mount.children.length, 0); assert.equal(env.revoked.length, 2); assert.equal(env.frames.size, 0);
});

test('abort after start interrupts once and performs cleanup, never claiming completion', async t => {
  const env = browser(t), controller = new AbortController(), receipts = [];
  const playback = playGeneratedSpeech(packet(), options({ mount: env.mount, signal: controller.signal, onReceipt: value => receipts.push(value) }));
  const rejected = assert.rejects(playback, /interrupted|cancel/i);
  await until(() => receipts.some(value => value.state === 'start'));
  controller.abort(); await rejected;
  env.audio().dispatchEvent(new Event('ended'));
  assert.deepEqual(receipts.map(value => value.state), ['start', 'interrupted']);
  assert.equal(env.mount.children.length, 0); assert.equal(env.revoked.length, 2); assert.equal(env.frames.size, 0);
});

test('decode wait can be aborted before start and all created media are removed', async t => {
  const env = browser(t, { ready: false }), controller = new AbortController(), receipts = [];
  const playback = playGeneratedSpeech(packet(), options({ mount: env.mount, signal: controller.signal, onStart: () => assert.fail('cancelled decode cannot start'), onReceipt: value => receipts.push(value) }));
  const rejected = assert.rejects(playback, /decoding failed|cancel/i);
  await until(() => env.video()?.loadCalls > 0);
  controller.abort(); await rejected;
  assert.deepEqual(receipts.map(value => value.state), ['interrupted']);
  assert.equal(receipts[0].started, false); assert.equal(env.mount.children.length, 0); assert.equal(env.revoked.length, 2);
});

test('decoded duration mismatch cannot start either track and still cleans up both blobs', async t => {
  const env = browser(t, { audioDuration: 1.2 }), receipts = [];
  await assert.rejects(playGeneratedSpeech(packet(), options({ mount: env.mount, onStart: () => assert.fail(), onReceipt: value => receipts.push(value) })), /duration mismatch/);
  assert.equal(env.audio().playCalls, 0); assert.equal(env.video().playCalls, 0);
  assert.deepEqual(receipts.map(value => value.state), ['interrupted']);
  assert.equal(env.mount.children.length, 0); assert.equal(env.revoked.length, 2);
});

test('rejected autoplay does not emit started and releases the pending completion listener', async t => {
  const env = browser(t, { play: media => media.kind === 'audio' ? Promise.reject(new Error('autoplay denied')) : Promise.resolve() }), receipts = [];
  await assert.rejects(playGeneratedSpeech(packet(), options({ mount: env.mount, onStart: () => assert.fail(), onReceipt: value => receipts.push(value) })), /autoplay denied/);
  env.audio().dispatchEvent(new Event('ended'));
  assert.deepEqual(receipts.map(value => value.state), ['interrupted']);
  assert.equal(env.revoked.length, 2); assert.equal(env.mount.children.length, 0);
});

test('abort during pending play cannot deliver a late start when play promises later resolve', async t => {
  const resolvers = [], starts = [], receipts = [], controller = new AbortController();
  const env = browser(t, { play: () => new Promise(resolve => resolvers.push(resolve)) });
  const playback = playGeneratedSpeech(packet(), options({ mount: env.mount, signal: controller.signal, onStart: value => starts.push(value), onReceipt: value => receipts.push(value) }));
  const rejected = assert.rejects(playback, /interrupted|cancel/i);
  await until(() => resolvers.length === 2);
  controller.abort(); resolvers.forEach(resolve => resolve());
  await rejected;
  assert.deepEqual(starts, []);
  assert.deepEqual(receipts.map(value => value.state), ['interrupted']);
  assert.equal(env.mount.children.length, 0); assert.equal(env.revoked.length, 2);
});

test('abort does not wait for unresolved play promises before removing the media surface', async t => {
  const resolvers = [], controller = new AbortController();
  const env = browser(t, { play: () => new Promise(resolve => resolvers.push(resolve)) });
  const playback = playGeneratedSpeech(packet(), options({ mount: env.mount, signal: controller.signal }));
  const settled = playback.then(() => 'resolved', () => 'rejected');
  await until(() => resolvers.length === 2);
  controller.abort();
  try {
    assert.equal(await Promise.race([settled, pause(40).then(() => 'still-waiting-for-play')]), 'rejected');
    assert.equal(env.mount.children.length, 0); assert.equal(env.revoked.length, 2);
  } finally {
    // Even a regression must leave no long-lived timer/promise in the test run.
    resolvers.forEach(resolve => resolve()); await settled;
  }
});
