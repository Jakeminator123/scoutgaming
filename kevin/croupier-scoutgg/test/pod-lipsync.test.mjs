import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PodLipsync } from '../server/pod-lipsync.mjs';

class WorkerSocket extends EventEmitter {
  readyState = 1;
  sent = [];
  send(value) { this.sent.push(Buffer.isBuffer(value) ? Buffer.from(value) : String(value)); }
  close(code, reason) { this.closeArgs = [code, reason]; this.readyState = 3; }
  message(value, binary = false) { this.emit('message', Buffer.isBuffer(value) ? value : Buffer.from(value), binary); }
}

const workerUrl = token => new URL(`wss://game.example/lipsync-worker?token=${token}`);

test('PodLipsync requires a strong shared token', () => {
  assert.throws(() => new PodLipsync({ token: '' }), /LIPSYNC_POD_TOKEN/);
  assert.throws(() => new PodLipsync({ token: 'short' }), /LIPSYNC_POD_TOKEN/);
});

test('authorized worker receives PCM and returns the generated clip', async () => {
  const lip = new PodLipsync({ token: 'a'.repeat(24), log() {} });
  const ws = new WorkerSocket();
  lip.adoptWorker(ws, workerUrl('a'.repeat(24)));
  assert.equal(lip.status, 'pod uppkopplad (?, ?)');

  ws.message(JSON.stringify({ t: 'pong', avatar: 'astrid_spel2x', encoder: 'libx264-session' }));
  assert.equal(lip.status, 'pod uppkopplad (astrid_spel2x, libx264-session)');
  const pcm = Buffer.from([1, 2, 3, 4]);
  const resultPromise = lip.lipsync(pcm, 24000);
  const start = ws.sent.find(value => typeof value === 'string' && JSON.parse(value).t === 'start' && JSON.parse(value).id !== '_prime');
  assert.ok(start);
  const id = JSON.parse(start).id;
  assert.deepEqual(ws.sent.find(value => Buffer.isBuffer(value) && value.length === pcm.length), pcm);
  assert.ok(ws.sent.some(value => typeof value === 'string' && JSON.parse(value).t === 'end' && JSON.parse(value).id === id));

  ws.message(JSON.stringify({ t: 'done', id, dur: 1.2, frames: 36, ms: { render: 400 } }));
  ws.message(Buffer.from('mp4-data'), true);
  const result = await resultPromise;
  assert.equal(result.mp4.toString(), 'mp4-data');
  assert.equal(result.meta.frames, 36);
  lip.close();
});

test('worker with wrong token is rejected and never becomes active', () => {
  const lip = new PodLipsync({ token: 'a'.repeat(24), log() {} });
  const ws = new WorkerSocket();
  lip.adoptWorker(ws, workerUrl('b'.repeat(24)));
  assert.deepEqual(ws.closeArgs, [4403, 'fel token']);
  assert.equal(lip.sessionReady, false);
});

test('worker disconnect rejects an in-flight speech job', async () => {
  const lip = new PodLipsync({ token: 'a'.repeat(24), log() {} });
  const ws = new WorkerSocket();
  lip.adoptWorker(ws, workerUrl('a'.repeat(24)));
  ws.message(JSON.stringify({ t: 'pong', avatar: 'astrid_spel2x', encoder: 'libx264-session' }));
  const resultPromise = lip.lipsync(Buffer.from([1, 2]), 24000);
  ws.readyState = 3;
  ws.emit('close');
  await assert.rejects(resultPromise, /podden kopplade ner/);
  assert.equal(lip.sessionReady, false);
});
