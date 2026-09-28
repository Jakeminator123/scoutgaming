import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { CAMERA_AUDIO_PREROLL_MAX_MS, createCameraAudioActivity, encodeCameraWav, createAstridAudioRecorder } from '../web/public/astrid-camera-audio.mjs';
import { validateCameraWav } from '../web/astrid-transcription.mjs';

test('local activity rejects quiet room and single clicks but follows a voice-length burst', () => {
  const activity = createCameraAudioActivity();
  for (let i = 0; i < 100; i++) assert.equal(activity(0.003), false);
  assert.equal(activity(0.4), false); assert.equal(activity(0.003), false);
  assert.equal(activity(0.05), false); assert.equal(activity(0.04), true);
  assert.equal(activity(0.002), true); assert.equal(activity(0.002), false);
});

test('PCM encoding is exact mono PCM16 and enforces duration at every allowed rate', () => {
  for (const rate of [8000, 16000, 44100, 48000]) {
    const pcm = new Int16Array(rate).fill(-2345);
    const wav = Buffer.from(encodeCameraWav([pcm], rate));
    assert.deepEqual(validateCameraWav(wav), { durationMs: 1000 });
    assert.equal(wav.readInt16LE(44), -2345);
    assert.throws(() => encodeCameraWav([new Int16Array(rate * 30 + 1)], rate));
  }
  assert.throws(() => encodeCameraWav([new Int16Array(10)], 16000));
});

test('audio worklet is silent, clamps PCM and stops producing bytes at 30 seconds', async () => {
  let Processor; const messages = [];
  const context = vm.createContext({ sampleRate: 8000, Int16Array,
    AudioWorkletProcessor: class { port = { postMessage: data => messages.push(new Int16Array(data)) }; },
    registerProcessor: (name, value) => { assert.equal(name, 'astrid-camera-audio'); Processor = value; } });
  vm.runInContext(await readFile(new URL('../web/public/astrid-camera-audio-worklet.mjs', import.meta.url), 'utf8'), context);
  const processor = new Processor();
  const output = new Float32Array(128);
  processor.process([[Float32Array.of(-2, -0.5, 0.5, 2)]], [[output]]);
  assert.deepEqual([...messages[0]], [-32768, -16384, 16384, 32767]);
  for (let i = 0; i < 2000; i++) processor.process([[new Float32Array(128).fill(0.1)]], [[output]]);
  assert.equal(messages.reduce((sum, pcm) => sum + pcm.length, 0), 8000 * 30);
  assert.ok(output.every(value => value === 0), 'no microphone feedback output');
});

async function preRollWorklet(preRollMs = CAMERA_AUDIO_PREROLL_MAX_MS) {
  let Processor; const messages = [];
  const context = vm.createContext({ sampleRate: 8000, Int16Array,
    AudioWorkletProcessor: class { port = { postMessage: data => messages.push(data) }; },
    registerProcessor: (_name, value) => { Processor = value; } });
  vm.runInContext(await readFile(new URL('../web/public/astrid-camera-audio-worklet.mjs', import.meta.url), 'utf8'), context);
  const processor = new Processor({ processorOptions: { armed: true, preRollMs } });
  return { processor, messages, command: type => processor.port.onmessage({ data: { type } }) };
}

test('armed worklet retains only the latest three seconds, exports nothing before wake and continues without a sample gap', async () => {
  const h = await preRollWorklet();
  for (let second = 1; second <= 60; second++) h.processor.process([[new Float32Array(8000).fill(second / 100)]]);
  assert.equal(h.messages.length, 0, 'No pre-wake audio even crosses into the UI thread.');
  assert.equal(h.processor.ring.length, 8000 * 3); assert.equal(h.processor.ringCount, 8000 * 3);
  h.command('activate');
  assert.equal(h.messages[0].type, 'pre-roll');
  const prefix = new Int16Array(h.messages[0].pcm);
  assert.equal(prefix.length, 8000 * 3);
  for (let second = 0; second < 3; second++) {
    const expected = Math.round(new Float32Array([(58 + second) / 100])[0] * 32767);
    assert.ok(prefix.subarray(second * 8000, (second + 1) * 8000).every(sample => sample === expected));
  }
  assert.equal(h.processor.ring, null, 'The old ring is erased and released at handoff.');
  h.processor.process([[new Float32Array(8000).fill(0.75)]]);
  assert.ok(new Int16Array(h.messages[1]).every(sample => sample === Math.round(0.75 * 32767)));
  for (let second = 0; second < 35; second++) h.processor.process([[new Float32Array(8000).fill(0.1)]]);
  const total = h.messages.reduce((sum, data) => sum + new Int16Array(data.pcm ?? data).length, 0);
  assert.equal(total, 8000 * 30, 'Pre-roll is included in the existing 30-second audio limit.');
  h.command('activate'); assert.equal(h.messages.filter(data => data.type === 'pre-roll').length, 1);
});

test('discard before wake erases the ring and emits no audio', async () => {
  const h = await preRollWorklet();
  h.processor.process([[new Float32Array(8000).fill(0.5)]]);
  const memory = h.processor.ring;
  h.command('discard'); h.command('activate');
  assert.ok(memory.every(sample => sample === 0));
  assert.equal(h.processor.process([[new Float32Array(128).fill(0.5)]]), false);
  assert.equal(h.messages.length, 0);
});

function recorderHarness({ delayed = false, armed = false, preRollMs = CAMERA_AUDIO_PREROLL_MAX_MS } = {}) {
  let node, context, load, sourceStream;
  const blocks = [], samples = [], commands = [], limits = [], controller = new AbortController();
  class AudioContext {
    constructor() { context = this; this.sampleRate = 16000; this.closed = false; this.destination = {}; }
    audioWorklet = { addModule: () => delayed ? new Promise(resolve => { load = resolve; }) : Promise.resolve() };
    resume() { return Promise.resolve(); }
    close() { this.closed = true; return Promise.resolve(); }
    createMediaStreamSource(stream) { sourceStream = stream; return { connect() {}, disconnect() {} }; }
  }
  class Worklet {
    constructor(_context, _name, options) { node = this; this.options = options; }
    port = { close() {}, onmessage: null, postMessage: value => commands.push(value) }; connect() {} disconnect() {}
  }
  const stream = { synthetic: true };
  const promise = createAstridAudioRecorder({ stream, AudioContextClass: AudioContext, AudioWorkletNodeClass: Worklet,
    signal: controller.signal, armed, preRollMs, onSample: value => samples.push(value), onLimit: () => limits.push(true) });
  return { promise, controller, samples, blocks, commands, limits, stream, sourceStream: () => sourceStream, context: () => context, load: () => load(), node: () => node,
    feed: value => { const pcm = new Int16Array(1600).fill(value); blocks.push(pcm); node.port.onmessage({ data: pcm.buffer }); },
    prefixPcm: pcm => { blocks.push(pcm); node.port.onmessage({ data: { type: 'pre-roll', pcm: pcm.buffer } }); },
    prefix: (value, milliseconds = preRollMs) => { const pcm = new Int16Array(16000 * milliseconds / 1000).fill(value); blocks.push(pcm); node.port.onmessage({ data: { type: 'pre-roll', pcm: pcm.buffer } }); } };
}

test('recorder uses acquired stream, emits bounded samples, releases and erases PCM after stop', async () => {
  const h = recorderHarness(), recorder = await h.promise;
  assert.equal(h.sourceStream(), h.stream);
  h.feed(4000); h.feed(4000); h.feed(4000);
  assert.equal(h.samples.at(-1).speaking, true);
  const wav = recorder.stop();
  assert.equal(validateCameraWav(Buffer.from(wav)).durationMs, 300);
  assert.equal(h.context().closed, true);
  assert.ok(h.blocks.every(chunk => chunk.every(value => value === 0)));
  assert.equal(recorder.stop(), null);
});

test('late worklet load after cancellation cannot reconnect a stopped context', async () => {
  const h = recorderHarness({ delayed: true });
  h.controller.abort(); h.load();
  await assert.rejects(h.promise, { name: 'AbortError' });
  assert.equal(h.context().closed, true); assert.equal(h.sourceStream(), undefined);
});

test('armed recorder activates once, includes pre-roll PCM and starts VAD timing at wake', async () => {
  const h = recorderHarness({ armed: true }), recorder = await h.promise;
  assert.equal(recorder.recording, false);
  assert.deepEqual(h.node().options.processorOptions, { armed: true, preRollMs: 3000 });
  h.feed(8000); assert.equal(h.samples.length, 0); assert.equal(h.limits.length, 0);
  assert.ok(h.blocks[0].every(sample => sample === 0));
  assert.equal(recorder.activate(), true); assert.equal(recorder.activate(), false); assert.equal(recorder.recording, true);
  assert.deepEqual(h.commands, [{ type: 'activate' }]);
  h.prefix(-1234);
  assert.deepEqual(h.samples, [{ rms: 1234 / 32768, preRollSpeech: true, speaking: false, at: 0 }],
    'The prefix reports one summary at wake, never historical VAD/camera events.');
  h.feed(4000); h.feed(4000);
  assert.equal(h.samples[1].at, 100); assert.equal(h.samples[2].at, 200); assert.equal(h.samples[2].speaking, true);
  const wav = Buffer.from(recorder.stop());
  assert.equal(validateCameraWav(wav).durationMs, 3200);
  assert.equal(wav.readInt16LE(44), -1234); assert.equal(wav.readInt16LE(44 + 16000 * 3 * 2), 4000);
  assert.equal(recorder.recording, false); assert.equal(recorder.activate(), false);
  assert.ok(h.blocks.every(chunk => chunk.every(value => value === 0)));
});

test('a short completed phrase in pre-roll is reported once without replaying buffered silence', async () => {
  const h = recorderHarness({ armed: true }), recorder = await h.promise;
  recorder.activate();
  const pcm = new Int16Array(16000 * 3).fill(30);
  pcm.fill(4000, 16000 * 2, 16000 * 2.3);
  h.prefixPcm(pcm);
  assert.deepEqual(h.samples, [{ rms: 4000 / 32768, preRollSpeech: true, speaking: false, at: 0 }]);
  h.feed(30); h.feed(30);
  assert.deepEqual(h.samples.slice(1).map(({ speaking, at }) => ({ speaking, at })), [
    { speaking: false, at: 100 }, { speaking: false, at: 200 },
  ], 'Fresh silence starts after wake rather than at the old pause in the prefix.');
  assert.equal(validateCameraWav(Buffer.from(recorder.stop())).durationMs, 3200);
});

test('pre-roll summary does not turn quiet rooms, an isolated click or an empty buffer into speech', async () => {
  for (const kind of ['quiet', 'click', 'empty']) {
    const h = recorderHarness({ armed: true }), recorder = await h.promise;
    recorder.activate();
    const pcm = new Int16Array(kind === 'empty' ? 0 : 16000 * 3).fill(30);
    if (kind === 'click') pcm.fill(30000, 16000, 16000 + 200);
    h.prefixPcm(pcm);
    assert.equal(h.samples.length, 1); assert.equal(h.samples[0].preRollSpeech, false);
    assert.equal(h.samples[0].at, 0); assert.equal(h.samples[0].speaking, false);
    recorder.stop(true);
  }
});

test('pre-roll never increases the 30-second WAV cap and stopping while armed returns no audio', async () => {
  const h = recorderHarness({ armed: true }), recorder = await h.promise;
  recorder.activate(); h.prefix(1000);
  for (let i = 0; i < 280; i++) h.feed(2000);
  assert.equal(h.limits.length, 1);
  assert.equal(validateCameraWav(Buffer.from(recorder.stop())).durationMs, 30000);
  const unused = recorderHarness({ armed: true }), armed = await unused.promise;
  assert.equal(armed.stop(), null); assert.equal(armed.activate(), false);
  assert.deepEqual(unused.commands, [{ type: 'discard' }]); assert.equal(unused.context().closed, true);
  for (const value of [-1, 3001, Infinity, 0.5]) {
    await assert.rejects(recorderHarness({ armed: true, preRollMs: value }).promise, /invalid_audio_preroll/);
  }
});
