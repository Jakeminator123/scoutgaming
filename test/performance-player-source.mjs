import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
globalThis.window ??= { addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), devicePixelRatio: 1 };
globalThis.document ??= { hidden: false, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {}, remove() {} }) };
const { PerformancePlayer } = await import('../services/game/public/performance-player.mjs');

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
