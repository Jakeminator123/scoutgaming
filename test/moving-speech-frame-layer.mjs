import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMovingSpeechPlan } from '../web/moving-speech-plan.mjs';
import { createMovingSpeechFrameLayer, splitMovingSpeechAccessUnits, decodeMovingSpeechChunk } from '../packages/presentation/runtime/moving-speech-frame-layer.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';

const hash = 'a'.repeat(64);
function plan(overrides = {}) {
  return prepareMovingSpeechPlan({
    binding: { dealerId: 'paow', workerAvatar: 'paow', sessionId: 'session-1', talkId: 'talk-1', revision: 1,
      profileRevision: hash, textSha256: hash, audioSha256: hash, avatarSha256: hash, ...overrides },
    clips: [{ dealerId: 'paow', take: 'pos1', sha256: hash, fps: 24, frameCount: 60, kind: 'video' }],
    frames: Array.from({ length: 60 }, (_, frame) => ({ take: 'pos1', frame })),
  });
}
const bytes = Uint8Array.of(0, 0, 0, 1, 9, 0xF0, 0, 0, 1, 0x65, 1);
const packet = (p, from = 0, n = 12, del = from / 12) => ({ t: 'lapp', id: p.start.id, del, fran: from,
  rutor: Array.from({ length: n }, (_, i) => ({ tagning: 'pos1', ruta: from + i, rect: [10, 20, 40, 60] })) });
const shown = (p, k = 5) => ({ binding: { ...p.binding }, planSha256: p.planSha256, take: 'pos1', frame: k,
  sourceSha256: hash, audioPlaying: true, audioTimeSeconds: (k + .5) / 24 - .22 });
function fixture() {
  const output = [], canvases = [];
  const decode = async () => Array.from({ length: 12 }, () => {
    const frame = { displayWidth: 256, displayHeight: 512, closes: 0, close() { this.closes++; } }; output.push(frame); return frame;
  });
  const document = { createElement() {
    const context = { draws: [], clearRect() {}, drawImage(...args) { this.draws.push(args); },
      getImageData(_x, y) { const data = new Uint8ClampedArray(256 * 256 * 4); data.fill(y ? 128 : 255); return { data }; },
      putImageData(value) { this.image = value; } };
    const canvas = { width: 0, height: 0, getContext: () => context }; canvases.push(canvas); return canvas;
  } };
  return { decode, document, output, canvases, video: { videoWidth: 320, videoHeight: 240 } };
}

test('Annex-B requires AUDs, IDR start, bounded complete frames and bytes', () => {
  assert.equal(splitMovingSpeechAccessUnits(bytes)[0].key, true);
  const delta = Uint8Array.of(0, 0, 1, 9, 0xf0, 0, 0, 1, 0x41, 1);
  assert.deepEqual(splitMovingSpeechAccessUnits(Uint8Array.from([...bytes, ...delta])).map(x => x.key), [true, false]);
  for (const bad of [new Uint8Array(), delta, bytes.subarray(6), Uint8Array.of(0, 0, 1, 9),
    Uint8Array.from([...bytes, 0, 0, 0, 1]), new Uint8Array(2 * 1024 * 1024 + 1),
    Uint8Array.from(Array.from({ length: 13 }, () => [...bytes]).flat())]) assert.throws(() => splitMovingSpeechAccessUnits(bad));
});

test('plan digest binds dealer, revision, source files and timeline before decoding', async () => {
  const p = plan();
  for (const change of [x => x.binding.audioSha256 = 'b'.repeat(64), x => x.timeline[0].frame = 2,
    x => x.start.fran_ruta = 1, x => x.binding.revision++, x => x.fps = 30]) {
    const copy = JSON.parse(JSON.stringify(p)); change(copy);
    await assert.rejects(createMovingSpeechFrameLayer({ plan: copy }), /moving_speech/);
  }
});

test('only the exact playing audio/body/source/binding frame is painted, with pixel alpha before framing', async () => {
  const p = plan(), f = fixture(), layer = await createMovingSpeechFrameLayer({ plan: p, ...f });
  await layer.push(packet(p), bytes);
  for (const changed of [x => x.binding.dealerId = 'dragge', x => x.binding.revision++, x => x.binding.audioSha256 = 'b'.repeat(64),
    x => x.binding.avatarSha256 = 'b'.repeat(64), x => x.binding.sessionId = 'old', x => x.planSha256 = 'b'.repeat(64),
    x => x.frame++, x => x.take = 'pos2', x => x.sourceSha256 = 'b'.repeat(64), x => x.audioPlaying = false,
    x => x.audioPlaying = 'true', x => x.audioTimeSeconds = NaN]) {
    const value = shown(p); changed(value); assert.equal(layer.paint(f.video, value), f.video);
  }
  const canvas = layer.paint(f.video, shown(p));
  assert.notEqual(canvas, f.video); assert.deepEqual([canvas.width, canvas.height], [320, 240]);
  const calls = canvas.getContext().draws;
  assert.equal(calls[0][0], f.video); assert.deepEqual(calls[1].slice(1), [10, 20, 40, 60]);
  assert.equal(calls[1][0].getContext().image.data[3], 128);
  assert.equal(f.output[0].closes, 1, 'earlier frames are released');
  assert.equal(layer.paint(f.video, shown(p, 20)), f.video, 'late data is not replaced by a nearby mouth');
  layer.close(); assert(f.output.every(x => x.closes === 1)); assert(f.canvases.every(x => !x.width && !x.height));
  assert.equal(layer.paint(f.video, shown(p)), f.video); assert.equal(await layer.push(packet(p), bytes), false);
});

test('reject stale jobs, mutable metadata, overlaps, out-of-source rectangles and silent frames safely', async () => {
  const p = plan(), f = fixture(), layer = await createMovingSpeechFrameLayer({ plan: p, ...f });
  assert.equal(await layer.push(packet(plan({ revision: 2 })), bytes), false);
  const bad = packet(p); bad.rutor[0].ruta++;
  await assert.rejects(layer.push(bad, bytes), /tag/);
  const m = packet(p); m.rutor[5] = null; m.rutor[6].rect = [300, 0, 40, 60];
  const pending = layer.push(m, bytes); m.rutor[7].rect[0] = 9999;
  await pending;
  assert.equal(layer.hasFrame(5),true,'explicit null patch is a decoded no-change sample');
  assert.equal(layer.hasFrame(20),false,'absent packet is never treated as silence');
  assert.equal(layer.paint(f.video, shown(p)), f.video);
  assert.equal(layer.paint(f.video, shown(p, 6)), f.video);
  assert.notEqual(layer.paint(f.video, shown(p, 7)), f.video, 'metadata was copied before async decode');
  assert.equal(await layer.push(packet(p), bytes), false);
  await assert.rejects(layer.push(packet(p, 7, 12, 8), bytes), /overlap/);
  layer.close(); assert(f.output.every(x => x.closes === 1));
});

test('decoded resources close on malformed output and cancellation during decode; queued work is bounded', async () => {
  const p = plan(), f = fixture(); let release;
  const layer = await createMovingSpeechFrameLayer({ plan: p, ...f, decode: () => new Promise(r => release = r) });
  const jobs = [0, 12, 24, 36].map(n => layer.push(packet(p, n), bytes));
  await assert.rejects(layer.push(packet(p, 48), bytes), /buffer_full/);
  layer.close(); release(await f.decode()); await Promise.all(jobs);
  assert(f.output.every(x => x.closes === 1));
  let shortClosed=0;
  const short = await createMovingSpeechFrameLayer({ plan: p, ...f,
    decode: async () => [{ displayWidth:256, displayHeight:512, close(){ shortClosed++; } }] });
  await assert.rejects(short.push(packet(p), bytes), /decoded_frames/); short.close();assert.equal(shortClosed,1);
});

test('WebCodecs validates dimensions and closes frames and decoder after failure', async t => {
  const oldDecoder = globalThis.VideoDecoder, oldChunk = globalThis.EncodedVideoChunk;
  t.after(() => { if (oldDecoder) globalThis.VideoDecoder = oldDecoder; else delete globalThis.VideoDecoder;
    if (oldChunk) globalThis.EncodedVideoChunk = oldChunk; else delete globalThis.EncodedVideoChunk; });
  let closed = 0, decoderClosed = 0;
  globalThis.EncodedVideoChunk = class { constructor(input) { Object.assign(this, input); } };
  globalThis.VideoDecoder = class {
    state = 'unconfigured'; constructor({ output }) { this.output = output; }
    configure() { this.state = 'configured'; }
    decode({ timestamp }) { this.output({ timestamp, displayWidth: 128, displayHeight: 512, close() { closed++; } }); }
    async flush() {} close() { this.state = 'closed'; decoderClosed++; }
  };
  await assert.rejects(decodeMovingSpeechChunk(bytes), /decoded_frames/);
  assert.equal(closed, 1); assert.equal(decoderClosed, 1);
});

// Opt-in real codec verification, with a generated colour/mask fixture. This is
// deliberately not acceptance of a person's mouth, speech or deployed GPU.
test('real browser decodes and composites two consecutive synthetic worker chunks', {
  skip: !process.env.CROUPIER_BROWSER_FIXTURE_MODULE && 'Browser codec check not run: supply the installed Playwright module.',
  timeout: 60000,
}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'moving-speech-codec-'));
  let browser, server;
  try {
    const h264 = join(dir, 'mouth.h264');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i',
      'color=c=red:s=256x512:r=24,drawbox=x=0:y=256:w=128:h=256:color=white:t=fill,drawbox=x=128:y=256:w=128:h=256:color=black:t=fill',
      '-frames:v', '12', '-c:v', 'libx264', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p',
      '-x264-params', 'aud=1:keyint=12:bframes=0', '-f', 'h264', h264], { stdio: 'pipe' });
    const require = createRequire(new URL('../lab/package.json', import.meta.url));
    const { outputFiles } = await require('esbuild').build({ entryPoints: [new URL('./fixtures/moving-speech-frame-layer.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')], bundle: true, write: false, format: 'esm' });
    server = createServer((req, res) => { res.setHeader('Content-Type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html');
      res.end(req.url === '/fixture.js' ? outputFiles[0].contents : '<script type="module">import {run} from "/fixture.js"; window.run=run;</script>'); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { chromium } = await import(pathToFileURL(process.env.CROUPIER_BROWSER_FIXTURE_MODULE).href);
    browser = await chromium.launch({ headless: true, channel: process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL || undefined });
    const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}`); await page.waitForFunction(() => window.run);
    const p = plan(), encoded = [...await readFile(h264)];
    const results = await page.evaluate(async args => window.run(args), { plan: JSON.parse(JSON.stringify(p)), encoded, meta: packet(p), presented: shown(p) });
    assert.equal(results.length, 2);
    for (const result of results) { assert(result.red[0] > 230 && result.red[2] < 25); assert(result.blue[2] > 230 && result.blue[0] < 25);
      assert.equal(result.mismatch, true); assert.equal(result.closed, true); }
  } finally { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
});
