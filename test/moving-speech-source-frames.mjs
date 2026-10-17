import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMovingSourceFrames, readMovingSourceSamples} from '../packages/presentation/runtime/moving-speech-source-frames.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const u32 = value => { const b = Buffer.alloc(4); b.writeUInt32BE(value); return b; };
const box = (name, ...data) => { const b = Buffer.concat(data); return Buffer.concat([u32(b.length + 8), Buffer.from(name), b]); };
const table = (name, rows) => box(name, u32(0), u32(rows.length), ...rows.flat().map(u32));
function mp4({count = 80, reordered = true} = {}) {
  const order = Array.from({length: count}, (_, i) => i);
  if (reordered && count >= 5) order.splice(0, 5, 0, 4, 2, 1, 3);
  const tkhd = Buffer.alloc(84); [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000].forEach((v, i) => tkhd.writeUInt32BE(v, 40 + i * 4));
  tkhd.writeUInt32BE(320 * 65536, 76); tkhd.writeUInt32BE(240 * 65536, 80);
  const mdhd = Buffer.alloc(20); mdhd.writeUInt32BE(12288, 12);
  const mvhd = Buffer.alloc(20); mvhd.writeUInt32BE(1000, 12);
  const hdlr = Buffer.alloc(12); hdlr.write('vide', 8);
  const avc = Buffer.alloc(78); avc.writeUInt16BE(320, 24); avc.writeUInt16BE(240, 26);
  const payload = Buffer.concat(order.map(frame => Buffer.from([frame, 7, 9])));
  return Buffer.concat([box('mdat', payload), box('moov', box('mvhd', mvhd), box('trak', box('tkhd', tkhd),
    box('edts', box('elst', u32(0), u32(1), u32(Math.round(count * 1000 / 24)), u32(1024), u32(0x10000))),
    box('mdia', box('mdhd', mdhd), box('hdlr', hdlr), box('minf', box('stbl',
      box('stsd', u32(0), u32(1), box('avc1', avc, box('avcC', Buffer.from([1, 100, 0, 50, 255, 225, 0])))),
      box('stsz', u32(0), u32(3), u32(count)), table('stts', [[count, 512]]),
      table('ctts', order.map((frame, i) => [1, (frame - i + 2) * 512])),
      table('stsc', [[1, count, 1]]), table('stco', [[8]]), table('stss', [[1]]))))))]);
}
function fixture({badHash = false, stalled = false, badTimestamp = false, missing = false, dimensions = false, copiesThrow = false} = {}) {
  const bytes = mp4(), decoded = [], copies = [], decoders = [], drawn = [];
  const descriptor = {videoId: 'one', sha256: badHash ? 'a'.repeat(64) : hash(bytes), bytes: bytes.length, url: '/fixture', fps: 24, frameCount: 80, width: 320, height: 240};
  const sequence = {sources: [descriptor], frames: Array.from({length: 80}, (_, frame) => ({take: 'clip-one', frame, sourceSha256: descriptor.sha256}))};
  const frame = (index, timestamp) => ({frame: index, timestamp, displayWidth: 320, displayHeight: 240, closes: 0, close() { this.closes++; }});
  const document = {createElement(tag) { assert.equal(tag, 'canvas'); return {getContext: () => ({drawImage(f) { drawn.push(f.frame); }})}; }};
  const deps = {document, fetchImpl: async () => new Response(bytes, {headers: {'content-type': 'video/mp4'}}),
    makeFrame(input) { if (copiesThrow) throw Error('copy_failed'); const f = frame(input.frame, input.timestamp); copies.push(f); return f; },
    Chunk: class {constructor(input) {Object.assign(this, input);}},
    Decoder: class {
      constructor(init) { this.init = init; this.state = 'unconfigured'; this.chunks = []; decoders.push(this); }
      configure(config) { assert.equal(config.codec, 'avc1.640032'); this.state = 'configured'; }
      decode(chunk) { if (!this.chunks.length) assert.equal(chunk.type, 'key'); this.chunks.push(chunk); }
      async flush() {
        if (stalled) return new Promise(() => {});
        for (const chunk of this.chunks.toSorted((a, b) => a.timestamp - b.timestamp)) {
          if (missing && chunk.data[0] === 2) continue;
          const f = frame(chunk.data[0], chunk.timestamp + (badTimestamp ? 1 : 0));
          if (dimensions) f.displayHeight++;
          decoded.push(f); this.init.output(f);
          // Model a finite decoder-surface pool: every delivered surface must
          // be released immediately, even while 24 independent copies remain.
          assert.equal(f.closes, 1);
        }
      }
      close() { this.state = 'closed'; }
    }};
  return {bytes, descriptor, sequence, deps, decoded, copies, decoders, drawn};
}
const edit = (bytes, name, offset, value) => { const result = Buffer.from(bytes); result.writeUInt32BE(value, result.indexOf(name) + 4 + offset); return result; };

test('MP4 B-frame decode order maps to exact edited CFR presentation samples and bytes', () => {
  const f = fixture(), result = readMovingSourceSamples(f.bytes, f.descriptor);
  assert.deepEqual(result.samples.slice(0, 5).map(s => s.frame), [0, 4, 2, 1, 3]);
  assert.equal(result.samples.length, 80);
  assert(result.samples.every(s => s.timestamp === Math.round(s.frame * 1e6 / 24) && s.data[0] === s.frame));
});

test('unsupported containers, malformed offsets, timing, dimensions and edit transforms fail closed', () => {
  const f = fixture();
  for (const bytes of [f.bytes.subarray(0, f.bytes.length - 1), edit(f.bytes, 'stco', 8, 0), edit(f.bytes, 'stts', 12, 500),
    edit(f.bytes, 'ctts', 12, 1025), edit(f.bytes, 'elst', 12, 0), edit(f.bytes, 'tkhd', 40, 0),
    edit(f.bytes, 'elst', 8, 1000), edit(f.bytes, 'stsc', 16, 2), edit(f.bytes, 'stsz', 8, 79),
    Buffer.concat([f.bytes, box('moof')])]) assert.throws(() => readMovingSourceSamples(bytes, f.descriptor), /moving_source_/);
  assert.throws(() => readMovingSourceSamples(f.bytes, {...f.descriptor, fps: 25}), /moving_source_/);
  assert.throws(() => readMovingSourceSamples(f.bytes, {...f.descriptor, width: 1080}), /moving_source_/);
});

test('24-frame cache refills in bounded batches, releases decoder surfaces and shows all exact indexes', async () => {
  const f = fixture(), cache = createMovingSourceFrames(f.sequence, f.deps);
  await cache.prefetch(0); assert.equal(cache.buffered, 24);
  assert.deepEqual(f.copies.map(f => f.frame), Array.from({length: 24}, (_, i) => i));
  for (let k = 0; k < 80; k++) { cache.get(k); await cache.prefetch(k); assert.ok(cache.buffered <= 24); }
  assert.deepEqual(f.drawn, Array.from({length: 80}, (_, i) => i));
  assert.ok(f.decoders.length < 10, 'refills must amortize dependency replay, not seek every frame');
  assert.equal(cache.has(0), false); assert.throws(() => cache.get(0), /unavailable/);
  cache.close(); assert(f.copies.every(f => f.closes === 1)); assert(f.decoded.every(f => f.closes === 1));
  assert(f.decoders.every(d => d.state === 'closed')); assert.throws(() => cache.get(79));
});

test('hash mismatch never creates a decoder and close aborts a pending batch', async () => {
  const bad = fixture({badHash: true}), cache = createMovingSourceFrames(bad.sequence, bad.deps);
  await assert.rejects(cache.prefetch(0), /hash/); assert.equal(bad.decoders.length, 0); cache.close();
  const f = fixture({stalled: true}), pending = createMovingSourceFrames(f.sequence, f.deps), job = pending.prefetch(0);
  await new Promise(resolve => setTimeout(resolve, 10)); pending.close(); await assert.rejects(job, /abort/i);
  assert.equal(pending.buffered, 0); assert(f.decoders.every(d => d.state === 'closed'));
});

for (const reason of ['badTimestamp', 'missing', 'dimensions', 'copiesThrow']) test(`decoder ${reason} stops and releases every owned frame`, async () => {
  const f = fixture({[reason]: true}), cache = createMovingSourceFrames(f.sequence, f.deps);
  await assert.rejects(cache.prefetch(0), /moving_source_|copy_failed/); cache.close();
  assert(f.decoded.every(f => f.closes === 1)); assert(f.copies.every(f => f.closes === 1));
  assert(f.decoders.every(d => d.state === 'closed'));
});

test('requested invalid source index fails before decode and cache size cannot exceed 24', async () => {
  const f = fixture(); f.sequence.frames[0].frame = 80;
  const cache = createMovingSourceFrames(f.sequence, f.deps);
  await assert.rejects(cache.prefetch(0), /frame_index/); assert.equal(f.decoders.length, 0); cache.close();
  assert.throws(() => createMovingSourceFrames(f.sequence, {...f.deps, limit: 25}), /buffer_limit/);
});

function twoClips() {
  const f = fixture();
  f.sequence.sources.push({...f.descriptor, videoId: 'two', url: '/fixture-two'});
  f.sequence.frames = ['one', 'two'].flatMap(id => Array.from({length: 48}, (_, frame) => ({take: 'clip-' + id, frame, sourceSha256: f.descriptor.sha256})));
  return f;
}

test('initial prefetch waits for the delayed later clip before exposing any playback-ready frames', async () => {
  const f = twoClips(), fetched = []; let release, notify;
  const started = new Promise(resolve => { notify = resolve; });
  const delayed = new Promise(resolve => { release = resolve; });
  f.deps.fetchImpl = async url => { fetched.push(url); if (url === '/fixture-two') { notify(); await delayed; }
    return new Response(f.bytes, {headers: {'content-type': 'video/mp4'}}); };
  const cache = createMovingSourceFrames(f.sequence, f.deps); let ready = false;
  const pending = cache.prefetch(0).then(() => { ready = true; });
  try {
    await Promise.race([started, pending.then(() => { throw Error('later compressed source must load before audio can start'); })]);
    assert.equal(ready, false); assert.equal(f.decoders.length, 0); assert.equal(cache.buffered, 0);
    release(); await pending;
    assert.equal(cache.buffered, 24); assert.equal(f.copies.length, 24, 'preloading must not decode the whole sequence');
    for (let k = 0; k < 96; k++) { cache.get(k); await cache.prefetch(k); assert.ok(cache.buffered <= 24); }
    assert.deepEqual(fetched, ['/fixture', '/fixture-two'], 'playback refills must use verified in-memory bytes');
    assert.deepEqual(f.drawn, [...Array(48).keys(), ...Array(48).keys()]);
  } finally { release(); cache.close(); await pending.catch(() => {}); }
});

test('a later source hash mismatch fails startup before any body decoder is created', async () => {
  const f = twoClips(); f.sequence.sources[1].sha256 = 'a'.repeat(64);
  const cache = createMovingSourceFrames(f.sequence, f.deps);
  await assert.rejects(cache.prefetch(0), /hash/); assert.equal(f.decoders.length, 0); assert.equal(cache.buffered, 0); cache.close();
});

test('preload abort cancels the later fetch and never exposes frames or a decoder', {timeout: 1000}, async t => {
  const f = twoClips(); let notify, aborted = false;
  const started = new Promise(resolve => { notify = resolve; });
  f.deps.fetchImpl = async (url, {signal}) => {
    if (url === '/fixture-two') await new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, {once: true}); notify();
    });
    return new Response(f.bytes, {headers: {'content-type': 'video/mp4'}});
  };
  const cache = createMovingSourceFrames(f.sequence, f.deps), pending = cache.prefetch(0);
  t.after(() => cache.close());
  await started; cache.close(); await assert.rejects(pending, /abort/i);
  assert.equal(aborted, true); assert.equal(f.decoders.length, 0); assert.equal(cache.buffered, 0);
});

test('preload checks the complete 96 MiB budget before fetch and ignores unused source descriptors', async () => {
  const f = twoClips(); let fetches = 0;
  f.sequence.sources.forEach(s => { s.bytes = 49 * 1024 * 1024; });
  f.deps.fetchImpl = async () => { fetches++; throw Error('must_not_fetch'); };
  const cache = createMovingSourceFrames(f.sequence, f.deps);
  await assert.rejects(cache.prefetch(0), /budget/); assert.equal(fetches, 0); cache.close();
  const used = fixture(); used.sequence.sources.push({...used.descriptor, videoId: 'unused', url: '/unused', bytes: 97 * 1024 * 1024});
  const ready = createMovingSourceFrames(used.sequence, used.deps);
  await ready.prefetch(0); assert.equal(ready.buffered, 24); ready.close();
});

for (const kind of ['unavailable', 'size']) test(`later source ${kind} fails before playback decoding`, async () => {
  const f = twoClips();
  f.deps.fetchImpl = async url => new Response(url === '/fixture-two' && kind === 'size' ? Buffer.concat([f.bytes, Buffer.from([0])]) : f.bytes,
    {status: url === '/fixture-two' && kind === 'unavailable' ? 503 : 200, headers: {'content-type': 'video/mp4'}});
  const cache = createMovingSourceFrames(f.sequence, f.deps);
  await assert.rejects(cache.prefetch(0), new RegExp(kind)); assert.equal(f.decoders.length, 0); cache.close();
});
