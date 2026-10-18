import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { playGeneratedSpeech, validateGeneratedSpeechStream } from '../packages/presentation/runtime/generated-speech-player.mjs';
import { createChatPlaybackDiagnostic } from '../services/game/public/chat-playback-diagnostic.mjs';

const text = 'Good evening. Your next hand is ready.';
const hash = value => createHash('sha256').update(value).digest('hex');
const mime = 'video/mp4; codecs="avc1.64002a, mp4a.40.2"';
const options = extra => ({ exactText: text, dealerId: 'astrid', requestId: 'request-a',prepareRendering:async()=>{},renderFrame:()=>true,...extra });
function descriptor() {
  const id = 'a'.repeat(32), expiresAt = Date.now() + 30000;
  const body = Buffer.from(JSON.stringify({ sessionId: id, userId: 'owner', nonce: 'nonce', exp: expiresAt })).toString('base64url');
  return { schemaVersion: 1, kind: 'generated-speech-stream', id, requestId: 'request-a', dealerId: 'astrid', exactText: text,
    textSha256: hash(text), reviewStatus: 'pending', url: '/speech-stream', ticket: `${body}.${'s'.repeat(43)}`, expiresAt };
}

function browser(t, { play, autoDecode = true } = {}) {
  const media = [], sockets = [], sources = [], revoked = [], frames = new Map(); let nextFrame = 0;
  const install = (name, value) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name]);
  };
  class Element extends EventTarget {
    constructor(kind) { super(); this.kind = kind; this.style = {}; this.children = []; }
    append(...nodes) { this.children.push(...nodes); for (const node of nodes) node.parent = this; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
    setAttribute() {}
    removeAttribute(name) { delete this[name]; }
  }
  class Video extends Element {
    constructor() { super('video'); this.currentTime = 0; this.playCalls = 0; this.paused = true; media.push(this); }
    play() { this.playCalls++; this.paused = false; return play?.() ?? Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
    requestVideoFrameCallback(callback) { const id = ++nextFrame; frames.set(id, callback); return id; }
    cancelVideoFrameCallback(id) { frames.delete(id); }
  }
  class SourceBuffer extends EventTarget {
    constructor() { super(); this.buffered = { length: 0, start: () => 0, end: () => .5 }; }
    appendBuffer(bytes) { this.appendedBytes = new Uint8Array(bytes.slice(0)); this.updating = true; if (autoDecode) queueMicrotask(() => this.decode()); }
    decode() { this.updating = false; this.buffered.length = 1; this.dispatchEvent(new Event('updateend')); }
    abort() { this.updating = false; }
  }
  class MediaSource extends EventTarget {
    static isTypeSupported(type) { return type === mime; }
    constructor() { super(); sources.push(this); this.readyState = 'closed'; queueMicrotask(() => { this.readyState = 'open'; this.dispatchEvent(new Event('sourceopen')); }); }
    addSourceBuffer() { this.buffer = new SourceBuffer(); return this.buffer; }
    endOfStream() { this.readyState = 'ended'; }
  }
  class Socket extends EventTarget {
    static OPEN = 1;
    constructor(url, protocols) { super(); Object.assign(this, { url, protocols, readyState: 1, sent: [] }); sockets.push(this); }
    message(value) { this.dispatchEvent(new MessageEvent('message', { data: typeof value === 'object' && !(value instanceof ArrayBuffer) ? JSON.stringify(value) : value })); }
    send(data) { this.sent.push(JSON.parse(data)); }
    close() { this.readyState = 3; this.dispatchEvent(new Event('close')); }
  }
  install('location', { origin: 'https://game.example' }); install('MediaSource', MediaSource); install('WebSocket', Socket);
  install('Audio', class { constructor() { assert.fail('stream must never create a parallel audio element'); } });
  install('document', { createElement: kind => kind === 'video' ? new Video() : new Element(kind) });
  t.mock.method(URL, 'createObjectURL', () => 'blob:stream'); t.mock.method(URL, 'revokeObjectURL', value => revoked.push(value));
  t.mock.method(globalThis, 'fetch', () => assert.fail('stream must not fetch VOD or neutral TTS'));
  return { mount: new Element('mount'), sockets, sources, revoked, frames, media,
    present() { for (const [id, callback] of [...frames]) { frames.delete(id); callback(0, { mediaTime: 0 }); } },
    feed() {
      sockets[0].message({ t: 'ready', id: 'transport-uuid', protocol: 2 });
      sockets[0].message({ t: 'stream', id: 'transport-uuid', mime });
      sockets[0].message(new ArrayBuffer(16));
    },
    done() { sockets[0].message({ t: 'done', id: 'transport-uuid', frames: 24, ms: {} }); },
  };
}
async function until(predicate) {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await pause(1); }
  assert.fail('stream lifecycle did not reach expected state');
}

test('stream descriptor binds exact text, dealer, request, ticket and relative admission URL', async () => {
  const input = descriptor(), result = await validateGeneratedSpeechStream(input, options());
  assert.deepEqual(result, input); assert.notEqual(result, input); assert.ok(Object.isFrozen(result));
  for (const change of [
    p => { p.dealerId = 'vera'; }, p => { p.exactText = 'Changed words'; }, p => { p.textSha256 = 'b'.repeat(64); },
    p => { p.requestId = 'other'; }, p => { p.id = 'b'.repeat(32); }, p => { p.reviewStatus = 'approved'; },
    p => { p.url = 'https://elsewhere.example/speech-stream'; }, p => { p.url = '//elsewhere.example/speech-stream'; },
    p => { p.url += '?ticket=secret'; }, p => { p.expiresAt = Date.now()-1; }, p => { p.ticket = 'secret\r\n'; },
    p => { p.packageId = 'fake-finalized-media'; }, p => { p.schemaVersion = 2; },
  ]) {
    const value = descriptor(); change(value);
    await assert.rejects(validateGeneratedSpeechStream(value, options()));
  }
});

test('single audible video, gates before admission and play, frame reveal, end waits for playback', async t => {
  const env = browser(t), receipts = []; let gates = 0, settled = false, firstFrames = 0;
  const status = { dataset: {} }, diagnostic = createChatPlaybackDiagnostic(() => status);
  diagnostic.begin('request-a');
  const readReceipt = () => JSON.parse(status.dataset.playbackReceipt);
  const playback = playGeneratedSpeech(descriptor(), options({ mount: env.mount,
    beforeStart: () => { if (++gates === 1) assert.equal(env.sockets.length, 0); else assert.equal(env.media[0].playCalls, 0); },
    onFirstFrame: () => { firstFrames++; }, onReceipt: value => { receipts.push(value); diagnostic.stream('request-a', value); } })).then(() => { settled = true; });
  await until(() => env.sockets.length); env.feed();
  await until(() => receipts.some(value => value.state === 'start'));
  assert.equal(gates, 2); assert.equal(env.media.length, 1); assert.equal(env.media[0].muted, false);
  assert.equal(env.sockets[0].url, 'wss://game.example/speech-stream');
  const surface = env.mount.children[0]; assert.equal(surface.style.visibility, 'hidden');
  env.present(); assert.equal(surface.style.visibility, ''); assert.equal(firstFrames, 1);
  env.done(); await pause(5);
  assert.equal(env.sources[0].readyState, 'ended'); assert.equal(settled, false, 'input done must not remove playing video');
  assert.equal(readReceipt().state, 'playing'); assert.equal(readReceipt().completed, false);
  env.media[0].ended = true; env.media[0].dispatchEvent(new Event('ended')); await playback;
  assert.deepEqual(receipts.map(v => v.state), ['start', 'end']);
  assert.equal(readReceipt().state, 'ended'); assert.equal(readReceipt().completed, true);
  diagnostic.finish('request-a', 'unverified');
  assert.equal(readReceipt().completed, true, 'normal gate completion preserves the actual media receipt');
  assert.ok(Number.isSafeInteger(receipts[0].timings.first_playing_ms));
  assert.ok(Number.isSafeInteger(receipts[1].timings.first_visible_frame_ms));
  assert.ok(receipts.every(v => v.reviewStatus === 'pending' && v.streamId && !v.packageId));
  assert.equal(env.mount.children.length, 0); assert.deepEqual(env.revoked, ['blob:stream']); assert.equal(env.frames.size, 0);
});

test('failed initial pose recheck opens no socket or media', async t => {
  const env = browser(t);
  await assert.rejects(playGeneratedSpeech(descriptor(), options({ mount: env.mount, beforeStart: () => { throw new Error('stale_pose'); } })), /stale_pose/);
  assert.equal(env.sockets.length, 0); assert.equal(env.media.length, 0);
});

test('optional observer follows the same player/frame and cannot mutate accepted decoder bytes', async t => {
  const env = browser(t), observed = []; let player;
  const playback = playGeneratedSpeech(descriptor(), options({ mount: env.mount, streamObserver: {
    onPlayer: value => { player = value.player; assert.equal(value.video, env.media[0]); observed.push('player'); },
    onBinary: value => { assert.equal(value.player, player); new Uint8Array(value.bytes).fill(255); observed.push('bytes'); },
    onFrame: value => { assert.equal(value.player, player); assert.equal(value.video, env.media[0]);
      assert.equal(value.info.mediaTime, 0); observed.push('frame'); },
  } }));
  await until(() => env.sockets.length); env.feed(); await until(() => env.media[0].playCalls === 1);
  assert.deepEqual([...env.sources[0].buffer.appendedBytes], Array(16).fill(0));
  env.present(); env.done(); await pause(5); env.media[0].ended = true; env.media[0].dispatchEvent(new Event('ended')); await playback;
  assert.deepEqual(observed, ['player', 'bytes', 'frame']); assert.equal(env.sockets.length, 1); assert.equal(env.media.length, 1);
});

test('aborting audible playback removes completion evidence and ignores a late video end', async t => {
  const env = browser(t), controller = new AbortController(), status = { dataset: {} };
  const diagnostic = createChatPlaybackDiagnostic(() => status);
  diagnostic.begin('request-a');
  const read = () => JSON.parse(status.dataset.playbackReceipt);
  const playback = playGeneratedSpeech(descriptor(), options({ mount: env.mount, signal: controller.signal,
    onReceipt: receipt => diagnostic.stream('request-a', receipt) }));
  const rejected = assert.rejects(playback, { name: 'AbortError' });
  await until(() => env.sockets.length); env.feed();
  await until(() => read().state === 'playing');
  controller.abort(); diagnostic.finish('request-a', 'cancelled'); await rejected;
  env.media[0].ended = true; env.media[0].dispatchEvent(new Event('ended'));
  assert.equal(read().state, 'cancelled'); assert.equal(read().completed, false);
  assert.equal(read().streamId, undefined); assert.equal(read().timings, undefined);
  assert.equal(env.mount.children.length, 0);
});

test('abort during initial gate does not wait for an unresolved callback', async t => {
  const env = browser(t), controller = new AbortController(); let gated = false;
  const playback = playGeneratedSpeech(descriptor(), options({ mount: env.mount, signal: controller.signal,
    beforeStart: () => { gated = true; return new Promise(() => {}); } }));
  const rejected = assert.rejects(playback, { name: 'AbortError' });
  await until(() => gated); controller.abort(); await rejected;
  assert.equal(env.sockets.length, 0);
});

test('second gate failure and autoplay denial are terminal and clean the shared surface', async t => {
  for (const mode of ['gate', 'autoplay']) {
    await t.test(mode, async t => {
      const env = browser(t, { play: mode === 'autoplay' ? () => Promise.reject(new Error('blocked')) : undefined });
      const receipts = []; let gates = 0;
      const status = { dataset: {} }, diagnostic = createChatPlaybackDiagnostic(() => status);
      diagnostic.begin('request-a');
      const playback = playGeneratedSpeech(descriptor(), options({ mount: env.mount,
        beforeStart: () => { if (++gates === 2 && mode === 'gate') throw new Error('stale_pose'); },
        onReceipt: value => { receipts.push(value); diagnostic.stream('request-a', value); } }));
      const rejected = assert.rejects(playback, mode === 'gate' ? /stale_pose/ : /speech_autoplay_blocked/);
      await until(() => env.sockets.length); env.feed(); await rejected;
      assert.deepEqual(receipts.map(v => v.state), ['interrupted']); assert.equal(receipts[0].started, false);
      assert.equal(JSON.parse(status.dataset.playbackReceipt).state, 'interrupted');
      assert.equal(JSON.parse(status.dataset.playbackReceipt).completed, false);
      assert.equal(env.mount.children.length, 0); assert.equal(env.frames.size, 0); assert.equal(env.sockets[0].readyState, 3);
    });
  }
});

test('diagnostic rejects unpaired/stale endings and retains only bounded, nonsecret current-request evidence', () => {
  const status = { dataset: {} }; let time = 100;
  const diagnostic = createChatPlaybackDiagnostic(() => status, () => time);
  const read = () => JSON.parse(status.dataset.playbackReceipt);
  const base = { requestId: 'request-a', streamId: 'a'.repeat(32), reviewStatus: 'pending' };
  const start = { ...base, state: 'start', evidence: 'media-playing' };
  const end = { ...base, state: 'end', evidence: 'media-lifecycle', started: true };
  diagnostic.begin('request-a');
  diagnostic.stream('request-a', end);
  assert.equal(read().state, 'pending'); assert.equal(read().completed, false);
  diagnostic.stream('request-a', { ...start, ticket: 'secret', exactText: 'private words',
    timings: { first_media_ms: 42, socket_open_ms: -1, first_visible_frame_ms: Infinity, arbitrary: 'secret' } });
  assert.deepEqual(read().timings, { first_media_ms: 42 });
  assert.doesNotMatch(status.dataset.playbackReceipt, /secret|private words|arbitrary|ticket|exactText/);
  diagnostic.stream('request-a', { ...end, streamId: 'b'.repeat(32) });
  assert.equal(read().completed, false);
  time = 350; diagnostic.stream('request-a', end);
  assert.equal(read().elapsedMs, 250); assert.equal(read().completed, true); assert.equal(read().reviewStatus, 'pending');
  diagnostic.begin('request-b');
  assert.deepEqual(read(), { requestId: 'request-b', state: 'pending', completed: false });
  diagnostic.stream('request-a', end); diagnostic.finish('request-a', 'failed');
  assert.equal(read().requestId, 'request-b'); assert.equal(read().state, 'pending');
  diagnostic.finish('request-b', 'cancelled');
  diagnostic.stream('request-b', { ...start, requestId: 'request-b' });
  diagnostic.stream('request-b', { ...end, requestId: 'request-b' });
  assert.equal(read().state, 'cancelled'); assert.equal(read().completed, false);
  for (const state of ['failed', 'cancelled', 'text-only', 'silent', 'unverified']) {
    diagnostic.begin('request-a'); diagnostic.stream('request-a', start);
    diagnostic.finish('request-a', state); diagnostic.stream('request-a', end);
    assert.equal(read().state, state); assert.equal(read().completed, false);
  }
});

test('abort during append or pending play prevents late start and frame reveal', async t => {
  for (const mode of ['decode', 'play']) {
    await t.test(mode, async t => {
      let release;
      const env = browser(t, { autoDecode: mode !== 'decode', play: mode === 'play' ? () => new Promise(resolve => { release = resolve; }) : undefined });
      const controller = new AbortController(), receipts = [];
      const playback = playGeneratedSpeech(descriptor(), options({ mount: env.mount, signal: controller.signal, onReceipt: value => receipts.push(value) }));
      const rejected = assert.rejects(playback, { name: 'AbortError' });
      await until(() => env.sockets.length); env.feed();
      await until(() => mode === 'decode' ? env.sources[0].buffer?.updating : release);
      const surface = env.mount.children[0], lateFrame = [...env.frames.values()][0];
      controller.abort(); await rejected; release?.(); lateFrame?.(0, {}); await pause(1);
      assert.deepEqual(receipts.map(v => v.state), ['interrupted']); assert.equal(receipts[0].started, false);
      assert.equal(env.mount.children.length, 0); assert.equal(surface.style.visibility, 'hidden'); assert.equal(env.frames.size, 0);
    });
  }
});

test('normal chat advertises stream support while native lab bridge keeps finalized-byte contract', async () => {
  const source = await readFile(new URL('../services/game/public/app.mjs', import.meta.url), 'utf8');
  const normal = source.slice(source.indexOf('async function sendChat('), source.indexOf('const labSpeechBridge'));
  const bridge = source.slice(source.indexOf('const labSpeechBridge'), source.indexOf('if (localPresentationEnabled', source.indexOf('const labSpeechBridge')));
  assert.match(normal, /acceptsSpeechStream: true/); assert.doesNotMatch(bridge, /acceptsSpeechStream: true/);
  assert.match(source, /generated-lipsync-stream-preview/); assert.match(source, /beforeStart: beforeStreamStart/);
  assert.match(normal, /chatPlaybackDiagnostic\.begin\(requestId\)/);
  assert.match(normal, /chatPlaybackDiagnostic\.finish\(requestId, 'cancelled'\)/);
  assert.match(normal, /chatPlaybackDiagnostic\.finish\(requestId, 'failed'\)/);
  assert.match(source, /chatPlaybackDiagnostic\.stream\(jobId, receipt\)/);
});

test('registered stream requires v2 exact profile/image binding and cannot borrow legacy Astrid descriptor',async()=>{
  const p={...descriptor(),schemaVersion:2,dealerId:'paow',profileRevision:'b'.repeat(64),imageSha256:'c'.repeat(64),compositing:null};
  const opts=options({dealerId:'paow'});
  assert.deepEqual(await validateGeneratedSpeechStream(p,opts),p);
  for(const patch of [{schemaVersion:1},{dealerId:'astrid'},{profileRevision:'legacy'},{imageSha256:null},{reviewStatus:'approved'},{avatarUrl:'https://elsewhere.invalid'},{compositing:{mode:'green-screen',threshold:0,softness:0,despill:0}}])await assert.rejects(validateGeneratedSpeechStream({...p,...patch},opts));
  await assert.rejects(validateGeneratedSpeechStream({...descriptor(),dealerId:'paow'},opts));
});

test('registered speech frames use the existing composition and preserve one audible clock',async t=>{
  const env=browser(t);let draws=0,prepared=false;
  const p={...descriptor(),schemaVersion:2,dealerId:'paow',profileRevision:'b'.repeat(64),imageSha256:'c'.repeat(64),compositing:{mode:'green-screen',threshold:.2,softness:.1,despill:.5}};
  const playback=playGeneratedSpeech(p,options({dealerId:'paow',mount:env.mount,prepareRendering:async key=>{assert.deepEqual(key,p.compositing);assert.equal(env.sockets.length,0);prepared=true;},renderFrame:video=>{assert.equal(prepared,true);assert.equal(video,env.media[0]);draws++;return true;}}));
  await until(()=>env.sockets.length);env.feed();await until(()=>env.media[0].playCalls);
  env.present();assert.equal(draws,1);assert.equal(env.mount.children[0].style.background,'transparent');assert.equal(env.media[0].style.opacity,'0');assert.equal(env.media[0].muted,false);
  env.present();assert.equal(draws,2);env.done();await pause(5);env.media[0].ended=true;env.media[0].dispatchEvent(new Event('ended'));await playback;
  assert.equal(env.frames.size,0);assert.equal(env.mount.children.length,0);
});
