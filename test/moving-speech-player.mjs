import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setImmediate as turn, setTimeout as delay } from 'node:timers/promises';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { prepareMovingSpeechPlan } from '../web/moving-speech-plan.mjs';
import { createMovingSpeechFrameLayer } from '../web/public/moving-speech-frame-layer.mjs';
import { validateMovingSpeechStream, playMovingSpeech, loadMovingSpeechRest, movingSpeechSocketURL } from '../web/public/moving-speech-player.mjs';

const hash = value => createHash('sha256').update(value).digest('hex'), h = 'a'.repeat(64);
const text = 'Hej Jakob.', id = 'b'.repeat(32), requestId = 'chat-1';
function descriptor() {
  const expiresAt = Date.now() + 55000, attemptId = 'attempt-1', nonce = 'nonce-1';
  const ticket = Buffer.from(JSON.stringify({ sessionId: id, exp: expiresAt, attemptId, nonce })).toString('base64url') + '.' + 'a'.repeat(43);
  return { schemaVersion: 1, kind: 'moving-speech-stream', id, requestId, dealerId: 'dragan', exactText: text,
    textSha256: hash(text), reviewStatus: 'pending', url: '/moving-speech-stream', ticket, expiresAt,
    profileRevision: h, avatarSha256: h, attemptId, nonce, compositing: null };
}
const options = { exactText: text, dealerId: 'dragan', requestId };
function messages(speech = descriptor(), samples = 30000) {
  const pcm = new Uint8Array(samples * 2), frames = Math.floor((samples + 18000) / 1000);
  const plan = prepareMovingSpeechPlan({ binding: { dealerId: speech.dealerId, workerAvatar: 'dragan', sessionId: id,
    talkId: requestId, revision: 1, profileRevision: h, textSha256: hash(text), audioSha256: hash(pcm), avatarSha256: h },
    clips: [{ dealerId: 'dragan', take: 'vila', sha256: h, fps: 24, frameCount: 1, kind: 'still' }],
    frames: Array.from({ length: frames }, () => ({ take: 'vila', frame: 0 })) });
  const ready = { t: 'ready', protocol: 1, id, attemptId: speech.attemptId, nonce: speech.nonce,
    plan: JSON.parse(JSON.stringify(plan)), rest: { videoId: '12345678-1234-1234-1234-123456789abc', sha256: h,
      sourceFrame: 7, fps: 24, frameCount: 12, width: 320, height: 240, bytes: 100, url: `/api/moving-speech/${id}/rest` },
    audio: { format: 's16le', sampleRate: 24000, channels: 1, byteLength: pcm.byteLength } };
  return { ready, pcm, plan, chunk: (from = 0, n = 12) => ({ t: 'lapp', id: plan.start.id, del: from / 12, fran: from,
    rutor: Array.from({ length: n }, () => ({ tagning: 'vila', ruta: 0, rect: [10, 20, 40, 60] })) }) };
}
// WebCrypto completes on another thread: a fixed number of immediate turns can
// expire before its result reaches the event loop, especially on Linux CI.
async function until(check, state) {
  const deadline = performance.now() + 1000;
  while (!check()) {
    assert.ok(performance.now() < deadline, `fixture did not reach ${state} within 1000 ms`);
    await delay(5);
  }
}
function fixture({ samples = 30000, overrides = {}, dependencies = {} } = {}) {
  const speech = descriptor(), m = messages(speech, samples), sent = [], receipts = [], observations = [], decoded = [], rafs = new Map();
  let socket, activeLayer, n = 0, current = true, ended = false, result;
  const audio = { currentTime: 0, paused: true, muted: false, plays: 0,
    async play() { this.plays++; this.paused = false; }, pause() { this.paused = true; }, removeAttribute() {}, load() {} };
  const doc = { createElement(tag) {
    if (tag === 'audio') return audio;
    const context = { clearRect() {}, drawImage() {}, putImageData() {}, getImageData() { return { data: new Uint8ClampedArray(256 * 256 * 4) }; } };
    return { width: 320, height: 240, videoWidth: 320, videoHeight: 240, getContext: () => context };
  } };
  const promise = playMovingSpeech(speech, { ...options, prepareRendering: async () => {},
    assertCurrent: () => { if (!current) throw Error('stale_pose'); },
    renderFrame: (base, shown) => { observations.push(shown); if (shown) assert.notEqual(activeLayer.paint(base, shown), base); return true; },
    setMovingSpeechLayer: layer => { activeLayer = layer; }, onReceipt: receipt => receipts.push(receipt), ...overrides }, {
    document: doc, connect: (url, protocols) => {
      assert.equal(url, '/moving-speech-stream'); assert.deepEqual(protocols, ['moving-v1', `ticket.${speech.ticket}`]);
      socket = { readyState: 1, send: text => sent.push(JSON.parse(text)), close() { this.readyState = 3; } }; return socket;
    }, loadRest: async rest => { assert.equal(rest.sourceFrame, 7); return doc.createElement('canvas'); },
    makeLayer: args => createMovingSpeechFrameLayer({ ...args, decode: async bytes => Array.from({ length: bytes[0] }, () => {
      const frame = { displayWidth: 256, displayHeight: 512, closed: 0, close() { this.closed++; } }; decoded.push(frame); return frame;
    }) }), createURL: () => 'blob:verified-pcm', revokeURL: () => {},
    requestAnimationFrame: fn => { rafs.set(++n, fn); return n; }, cancelAnimationFrame: key => rafs.delete(key), ...dependencies,
  });
  promise.then(value => { ended = true; result = value; }, error => { ended = true; result = error; });
  const send = data => socket.onmessage({ data: data instanceof Uint8Array ? data.slice().buffer : JSON.stringify(data) });
  return { speech, m, audio, sent, receipts, observations, decoded, promise, get socket() { return socket; }, get layer() { return activeLayer; },
    get ended() { return ended; }, get result() { return result; }, send, stale() { current = false; },
    async ready() { await until(() => socket, 'socket connection'); send(m.ready); await until(() => activeLayer, 'verified rest layer'); },
    async pcm() { send({ t: 'pcm', id, byteLength: m.pcm.byteLength }); send(m.pcm); await until(() => sent.length, 'PCM credit'); },
    async chunk(from = 0, n = 12, mutate) { const meta = m.chunk(from, n); mutate?.(meta); send(meta); send(Uint8Array.of(n)); await turn(); await turn(); },
    async tick(time) { audio.currentTime = time; const [key, callback] = rafs.entries().next().value ?? []; rafs.delete(key); callback?.(); await turn(); },
  };
}

test('descriptor binds exact text, dealer, ticket attempt/nonce and same-origin endpoint before connecting', async () => {
  assert.equal((await validateMovingSpeechStream(descriptor(), options)).dealerId, 'dragan');
  for (const change of [d => d.dealerId = 'astrid', d => d.requestId = 'other', d => d.nonce = 'other', d => d.attemptId = 'other',
    d => d.exactText = 'Other text', d => d.textSha256 = h, d => d.url = 'https://other.example/moving-speech-stream',
    d => d.reviewStatus = 'approved', d => d.extra = true, d => d.compositing = { mode: 'none' }]) {
    const d = descriptor(); change(d); await assert.rejects(validateMovingSpeechStream(d, options), /moving_speech/);
  }
});

test('tickets use only secure same-origin sockets, with explicit localhost support for isolated fixtures', () => {
  assert.equal(movingSpeechSocketURL('/moving-speech-stream', 'https://www.scoutgaming.tech'), 'wss://www.scoutgaming.tech/moving-speech-stream');
  assert.equal(movingSpeechSocketURL('/moving-speech-stream', 'http://127.0.0.1:4200'), 'ws://127.0.0.1:4200/moving-speech-stream');
  for (const origin of ['http://elsewhere.example', 'file:///C:/test']) assert.throws(() => movingSpeechSocketURL('/moving-speech-stream', origin));
  assert.throws(() => movingSpeechSocketURL('https://elsewhere.example/moving-speech-stream', 'https://www.scoutgaming.tech'));
});

test('verified rest, PCM and first24 decoded frames gate audio; credits follow audio clock and completion removes mouth', async () => {
  const f = fixture(); await f.ready(); assert.equal(f.audio.plays, 0);
  await f.pcm(); assert.deepEqual(f.sent, [{ t: 'credit', id: f.m.plan.start.id, frames: 24 }]);
  await f.chunk(0); assert.equal(f.audio.plays, 0);
  await f.chunk(12); await until(() => f.audio.plays === 1, 'audio playback');
  assert.equal(f.receipts[0].state, 'start'); assert.equal(f.observations.at(-1).frame, 0);
  assert.equal(f.observations.at(-1).sourceSha256, h); assert.equal(f.layer.bufferedFrames, 19);
  await f.tick(.5); await f.chunk(24); await f.tick(.8); await f.chunk(36);
  f.send({ t: 'done', id: f.m.plan.start.id, frames: 48 }); await turn();
  assert.equal(f.ended, false); f.audio.onended(); await f.promise;
  assert.equal(f.audio.paused, true); assert.equal(f.layer, null); assert.equal(f.observations.at(-1), undefined);
  assert.equal(f.receipts.at(-1).state, 'end'); assert.ok(f.decoded.every(frame => frame.closed === 1));
  assert.ok(f.sent.filter(x => x.t === 'credit').every(x => x.frames <= 24));
});

test('trailing worker padding drains after audio ended without replaying audio or holding its mouth frame', async () => {
  const f = fixture(); await f.ready(); await f.pcm(); await f.chunk(0); await f.chunk(12); await f.tick(.5); await f.chunk(24);
  f.audio.currentTime = 1.25; f.audio.onended(); await f.chunk(36);
  assert.equal(f.ended, false); assert.equal(f.observations.at(-1), undefined); assert.equal(f.audio.plays, 1);
  f.send({ t: 'done', id: f.m.plan.start.id, frames: 48 }); await f.promise;
});

test('pose changes and missing exact next frames silence the audio and close the session', async () => {
  for (const reason of ['pose', 'underrun']) {
    const f = fixture(); await f.ready(); await f.pcm(); await f.chunk(0); await f.chunk(12);
    if (reason === 'pose') f.stale(); await f.tick(reason === 'pose' ? .1 : 1);
    await assert.rejects(f.promise, reason === 'pose' ? /stale_pose/ : /frame_unavailable/);
    assert.equal(f.audio.paused, true); assert.equal(f.audio.muted, true); assert.equal(f.socket.readyState, 3);
    assert.equal(f.receipts.at(-1).state, 'interrupted'); assert.equal(f.sent.at(-1).t, 'abort');
  }
});

test('wrong nonce, plan binding, original rest, PCM hash and unmatched chunk never start audio', async () => {
  for (const change of [r => r.nonce = 'stale', r => r.plan.binding.dealerId = 'astrid', r => r.plan.binding.audioSha256 = h,
    r => r.rest.sha256 = 'c'.repeat(64), r => r.rest.url = '//elsewhere/rest', r => r.rest.sourceFrame = 99,
    r => r.plan.timeline[0].frame = 1, r => r.audio.byteLength -= 24000]) {
    const f = fixture(); await until(() => f.socket, 'socket connection'); change(f.m.ready); f.send(f.m.ready);
    await assert.rejects(f.promise, /moving_speech/); assert.equal(f.audio.plays, 0);
  }
  const f = fixture(); await f.ready(); f.send({ t: 'pcm', id, byteLength: f.m.pcm.byteLength }); const bad = f.m.pcm.slice(); bad[0] = 1; f.send(bad);
  await assert.rejects(f.promise, /pcm_hash_mismatch/); assert.equal(f.sent.some(x => x.t === 'credit'), false); assert.equal(f.audio.plays, 0);
});

test('out-of-order, over-credit, missing-patch and metadata-without-binary messages fail closed', async () => {
  for (const send of [
    f => f.send(Uint8Array.of(12)), f => f.send(f.m.chunk(12)),
    f => { const meta = f.m.chunk(); meta.rutor[0] = null; f.send(meta); },
    f => { f.send(f.m.chunk()); f.send(f.m.chunk(12)); },
    f => { const meta = f.m.chunk(); meta.rutor[0].rect[2] = 1000; f.send(meta); },
  ]) {
    const f = fixture(); await f.ready(); await f.pcm(); send(f); await assert.rejects(f.promise, /moving_speech/); assert.equal(f.audio.plays, 0);
  }
  const f = fixture(); await f.ready(); await f.pcm(); await f.chunk(0); await f.chunk(12); f.send(f.m.chunk(24));
  await assert.rejects(f.promise, /invalid_moving_speech_chunk/); assert.equal(f.audio.paused, true);
});

test('abort interrupts pending pre-start ownership checks, including before any socket exists', async () => {
  const controller = new AbortController(); let entered = false;
  const f = fixture({ overrides: { signal: controller.signal, beforeStart: () => { entered = true; return new Promise(() => {}); } } });
  await until(() => entered, 'pre-start ownership check'); controller.abort(); await assert.rejects(f.promise, { name: 'AbortError' }); assert.equal(f.socket, undefined);
});

test('bounded encoded queue rejects a producer flood while the rest original is still loading', async () => {
  let release;
  const f = fixture({ dependencies: { loadRest: () => new Promise(resolve => { release = resolve; }) } });
  await until(() => f.socket, 'socket connection'); f.send(f.m.ready); await until(() => release, 'pending rest load');
  for (let n = 0; n < 9 && f.socket.onmessage; n++) f.send({ t: 'pcm', id, byteLength: f.m.pcm.byteLength });
  await assert.rejects(f.promise, /queue_full/); assert.equal(f.audio.plays, 0); release({ width: 320, height: 240 });
});

test('rest original fetch is bounded and hash verified before any video decoder is created', async () => {
  const rest = messages().ready.rest;
  for (const body of [new Uint8Array(101), new Uint8Array(100)]) {
    await assert.rejects(loadMovingSpeechRest(rest, { document: { createElement: () => assert.fail('unverified original') },
      fetchImpl: async (url, init) => { assert.equal(url, rest.url); assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'same-origin');
        return new Response(body, { headers: { 'content-type': 'video/mp4' } }); } }), /rest_size|rest_hash_mismatch/);
  }
});

// Full browser adapter with synthetic media: real rVFC source-frame selection,
// PCM audio clock, WebSocket credit, WebCodecs and compositor. No provider calls
// or visual acceptance of a dealer's speech is implied by these colour checks.
test('real browser plays hash-bound PCM over the exact bank rest and bounded WebCodecs chunks', {
  skip: !process.env.CROUPIER_BROWSER_FIXTURE_MODULE && 'Supply the installed Playwright module for real browser verification.', timeout: 60000,
}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'moving-speech-player-'));
  let server, browser, wss;
  try {
    const originalPath = join(dir, 'rest.mp4'), patchPath = join(dir, 'mouth.h264');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i',
      "color=c=blue:s=320x240:r=24,drawbox=x=0:y=0:w=320:h=240:color=green:t=fill:enable='gte(n,7)'",
      '-frames:v', '24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', originalPath], { stdio: 'pipe' });
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i',
      'color=c=red:s=256x512:r=24,drawbox=x=0:y=256:w=256:h=256:color=white:t=fill',
      '-frames:v', '12', '-c:v', 'libx264', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p',
      '-x264-params', 'aud=1:keyint=12:bframes=0', '-f', 'h264', patchPath], { stdio: 'pipe' });
    const original = await readFile(originalPath), encoded = await readFile(patchPath), speech = descriptor(), m = messages(speech, 18000);
    // This explicit rest is frame7, not the superficially similar first frame.
    m.ready.rest = { ...m.ready.rest, bytes: original.byteLength, sha256: hash(original), frameCount: 24 };
    m.ready.plan = JSON.parse(JSON.stringify(prepareMovingSpeechPlan({ binding: m.plan.binding,
      clips: [{ dealerId: 'dragan', take: 'vila', sha256: hash(original), fps: 24, frameCount: 1, kind: 'still' }],
      frames: Array.from({ length: 36 }, () => ({ take: 'vila', frame: 0 })) })));
    const require = createRequire(new URL('../lab/package.json', import.meta.url));
    const { outputFiles } = await require('esbuild').build({ entryPoints: [new URL('./fixtures/moving-speech-player.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')], bundle: true, write: false, format: 'esm', external: ['/composition-runtime/compositor.js'] });
    server = createServer((req, res) => {
      if (req.url === m.ready.rest.url) { res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': original.length }); return res.end(original); }
      res.setHeader('Content-Type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html');
      res.end(req.url === '/fixture.js' ? outputFiles[0].contents : '<script type="module">import {run} from "/fixture.js"; window.run=run;</script>');
    });
    const { WebSocketServer } = createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
    wss = new WebSocketServer({ server, path: '/moving-speech-stream', handleProtocols: protocols => protocols.has('moving-v1') ? 'moving-v1' : false });
    const credits = [];
    wss.on('connection', socket => {
      let credit = 0, from = 0;
      socket.send(JSON.stringify(m.ready)); socket.send(JSON.stringify({ t: 'pcm', id, byteLength: m.pcm.byteLength })); socket.send(m.pcm);
      socket.on('message', data => {
        const message = JSON.parse(data.toString());
        if (message.t !== 'credit') return;
        credits.push(message.frames); credit += message.frames;
        while (credit >= 12 && from < 36) {
          const meta = m.chunk(from); meta.id = m.ready.plan.start.id;
          socket.send(JSON.stringify(meta)); socket.send(encoded); from += 12; credit -= 12;
        }
        if (from === 36) { socket.send(JSON.stringify({ t: 'done', id: m.ready.plan.start.id, frames: 36 })); from++; }
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { chromium } = await import(pathToFileURL(process.env.CROUPIER_BROWSER_FIXTURE_MODULE).href);
    browser = await chromium.launch({ headless: true, channel: process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL || undefined,
      args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}`); await page.waitForFunction(() => window.run);
    const result = await page.evaluate(speech => window.run(speech), speech);
    assert.equal(result.first, 1); assert.equal(result.closed, true); assert.deepEqual(result.receipts.map(r => r.state), ['start', 'end']);
    const moving = result.frames.filter(f => f.patched); assert.ok(moving.length >= 2); assert.ok(moving.some(f => f.time > .3));
    for (const f of result.frames) assert.ok(f.body[1] > 100 && f.body[0] < 30 && f.body[2] < 30, 'body must be exact green source frame7');
    for (const f of moving) assert.ok(f.mouth[0] > 230 && f.mouth[1] < 30, 'decoded patch must be red');
    assert.equal(result.frames.at(-1).patched, false); assert.equal(credits[0], 24); assert.equal(credits.reduce((a, b) => a + b, 0), 36);
  } finally {
    await browser?.close(); for (const socket of wss?.clients ?? []) socket.terminate();
    if (wss) await new Promise(resolve => wss.close(resolve));
    if (server) await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true });
  }
});
