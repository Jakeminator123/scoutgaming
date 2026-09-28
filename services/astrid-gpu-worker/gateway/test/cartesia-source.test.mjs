import test from 'node:test';
import assert from 'node:assert/strict';
import { createCartesiaSource } from '../cartesia-source.mjs';
const config = { apiKey: 'private-test-key', voiceId: 'voice-id', modelId: 'sonic-3' };
const text = 'A short test reply.';

test('yields before EOF and preserves samples across odd HTTP boundaries', async () => {
  let controller, request, ended = false;
  const body = new ReadableStream({ start(c) { controller = c; c.enqueue(new Uint8Array([1, 2, 3])); } });
  const source = createCartesiaSource(config, { fetchImpl: async (_, init) => { request = init; return new Response(body, { headers: { 'content-type': 'audio/pcm' } }); } });
  const iterator = source({ text });
  assert.deepEqual((await iterator.next()).value, new Uint8Array([1, 2]));
  assert.equal(ended, false);
  controller.enqueue(new Uint8Array(45).fill(4)); controller.close(); ended = true;
  const second = (await iterator.next()).value;
  assert.equal(second.length, 46); assert.equal(second[0], 3); assert.equal(second[1], 4);
  assert.equal((await iterator.next()).done, true);
  assert.equal(request.headers['Cartesia-Version'], '2026-08-14');
  assert.equal(JSON.parse(request.body).output_format.encoding, 'pcm_s16le');
});

test('abort interrupts pending read and cancels source', async () => {
  let cancelled = false;
  const controller = new AbortController();
  const source = createCartesiaSource(config, { fetchImpl: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } })) });
  const next = source({ text, signal: controller.signal }).next();
  await new Promise(resolve => setTimeout(resolve, 10)); controller.abort();
  await assert.rejects(next, /TTS cancelled/); assert.equal(cancelled, true);
});

test('bounds duration, rejects odd final sample, hides provider failures without retry', async () => {
  let calls = 0;
  for (const bytes of [new Uint8Array(1200002), new Uint8Array(49)]) {
    const source = createCartesiaSource(config, { fetchImpl: async () => { calls++; return new Response(bytes); } });
    await assert.rejects(async () => { for await (const _ of source({ text })) {} }, /TTS stream failed/);
  }
  const failing = createCartesiaSource(config, { fetchImpl: async () => { calls++; throw new Error('sensitive provider diagnostics'); } });
  await assert.rejects(async () => { for await (const _ of failing({ text })) {} }, /^Error: TTS stream failed$/);
  assert.equal(calls, 3);
});

test('timeout terminates stalled stream; consumer stop cancels response', async () => {
  const stalled = createCartesiaSource({ ...config, timeoutMs: 10 }, { fetchImpl: async () => new Response(new ReadableStream()) });
  await assert.rejects(stalled({ text }).next(), /TTS timed out/);
  let cancelled = false;
  const early = createCartesiaSource(config, { fetchImpl: async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(48)); }, cancel() { cancelled = true; } })) });
  for await (const _ of early({ text })) break;
  assert.equal(cancelled, true);
});
