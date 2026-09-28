import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createCameraAudioActivity, encodeCameraWav, createAstridAudioRecorder } from '../web/public/astrid-camera-audio.mjs';
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

function recorderHarness({ delayed = false } = {}) {
  let node, context, load, sourceStream;
  const blocks = [], samples = [], controller = new AbortController();
  class AudioContext {
    constructor() { context = this; this.sampleRate = 16000; this.closed = false; this.destination = {}; }
    audioWorklet = { addModule: () => delayed ? new Promise(resolve => { load = resolve; }) : Promise.resolve() };
    resume() { return Promise.resolve(); }
    close() { this.closed = true; return Promise.resolve(); }
    createMediaStreamSource(stream) { sourceStream = stream; return { connect() {}, disconnect() {} }; }
  }
  class Worklet {
    constructor() { node = this; }
    port = { close() {}, onmessage: null }; connect() {} disconnect() {}
  }
  const stream = { synthetic: true };
  const promise = createAstridAudioRecorder({ stream, AudioContextClass: AudioContext, AudioWorkletNodeClass: Worklet,
    signal: controller.signal, onSample: value => samples.push(value) });
  return { promise, controller, samples, blocks, stream, sourceStream: () => sourceStream, context: () => context, load: () => load(),
    feed: value => { const pcm = new Int16Array(1600).fill(value); blocks.push(pcm); node.port.onmessage({ data: pcm.buffer }); } };
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
