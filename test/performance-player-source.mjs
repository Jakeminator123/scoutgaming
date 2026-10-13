import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { createVerifiedVideoBuffer } from '../web/public/verified-video-buffer.mjs';
globalThis.window ??= { addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), devicePixelRatio: 1 };
globalThis.document ??= { hidden: false, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {}, remove() {} }) };
const { PerformancePlayer } = await import('../web/public/performance-player.mjs');

const bytes = new TextEncoder().encode('same-bytes-for-centre-and-dealer');
const sha = createHash('sha256').update(bytes).digest('hex');
let fetches = 0, urls = 0;
globalThis.fetch = async () => { fetches++; await new Promise(r => setTimeout(r, 5)); return { ok: true, arrayBuffer: async () => bytes.buffer.slice(0) }; };
globalThis.URL.createObjectURL = () => `blob:${++urls}`;
globalThis.Blob ??= class { constructor(parts, opts) { this.parts = parts; this.type = opts?.type; } };

test('two concurrent loads of the same hash fetch once and share one blob url', async () => {
  const host = { classList: { add() {}, remove() {} } };
  const p = Object.create(PerformancePlayer.prototype); p.assets = new Map();
  const take = id => ({ id, media: { sha256: sha, src: '/x.mp4' } });
  const [a, b] = await Promise.all([p.source(take('centre')), p.source(take('dealer'))]);
  assert.equal(a, b); assert.equal(fetches, 1); assert.equal(urls, 1);
  assert.equal(await p.source(take('again')), a); assert.equal(fetches, 1);
  assert.equal(p.loading.size, 0);
});

test('local playback promotes the prepared transfer, reuses its video and retains frame receipts across two plays', async t => {
  const original = document.createElement, calls = [], pending = new Map(), videos = [], revoked = [];
  const turn = () => new Promise(resolve => setImmediate(resolve));
  document.createElement = () => {
    const listeners = new Map(); let frame;
    const video = { style:{}, src:'', ended:false, loads:0,
      addEventListener: (name, fn) => listeners.set(name,fn),
      requestVideoFrameCallback: fn => {frame=fn;return 1;}, cancelVideoFrameCallback() {},
      pause() {}, load() {this.loads++;}, removeAttribute() {this.src='';}, remove() {},
      async play() {listeners.get('playing')?.();},
      present() {frame(0,{mediaTime:0});}, end() {this.ended=true;listeners.get('ended')?.();},
    }; videos.push(video); return video;
  };
  const buffer = createVerifiedVideoBuffer({parallel:1,fetchImpl:src => new Promise(resolve => {
    calls.push(src);pending.set(src,() => resolve(new Response(src.slice(1))));
  }),createUrl:blob => 'blob:verified-'+blob.size,revokeUrl:url => revoked.push(url)});
  const take = id => ({media:{src:'/'+id,sha256:createHash('sha256').update(id).digest('hex')}});
  const player = Object.create(PerformancePlayer.prototype); player.localBuffer=buffer; player.host={append() {}};
  t.after(() => {player.cancelLocalPreparation();buffer.close();document.createElement=original;});
  const blocker = buffer.acquire(take('block').media); await turn();
  const decoration = buffer.acquire(take('decoration').media,undefined,{priority:1});
  player.prepareLocalClip(take('event'));
  let started;
  const ready = new Promise(resolve => {started=resolve;});
  const receipts = [], playback = player.playLocalClip(take('event'),{onReceipt:row=>{receipts.push(row);if(row.state==='start')started();}});
  pending.get('/block')(); (await blocker).release(); await turn();
  assert.deepEqual(calls,['/block','/event'],'prepared playback takes the next free slot');
  pending.get('/event')(); await ready;
  assert.equal(videos.length,1,'decoder element is reused');
  assert.deepEqual(receipts.map(row=>row.state),['start'],'load/play alone never proves presentation');
  videos[0].present(); videos[0].end(); await playback;
  assert.deepEqual(receipts.map(row=>row.state),['start','presented','end']);
  assert.ok(receipts.every(row=>row.preloadHit));
  assert.equal(videos[0].src,'','finished decoder releases its source');
  await turn(); pending.get('/decoration')(); (await decoration).release();
  player.prepareLocalClip(take('event')); await turn();
  const secondReceipts = [], second = player.playLocalClip(take('event'),{onReceipt:row=>secondReceipts.push(row)});
  await turn(); videos[1].present(); videos[1].end(); await second;
  assert.ok(secondReceipts.every(row=>row.cacheHit && row.preloadHit));
  assert.equal(calls.filter(src=>src==='/event').length,1,'second playback uses verified cached bytes');
  assert.deepEqual(revoked,[],'active leases are never revoked');
});
