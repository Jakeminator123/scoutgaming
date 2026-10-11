import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { readFile, mkdtemp } from 'node:fs/promises';
import { WebSocket, WebSocketServer } from 'ws';
process.env.HOME = await mkdtemp(path.join(os.tmpdir(), 'pod-home-'));   // no RunPod key file: Paow can only speak via the pod
process.env.ELEVENLABS_VIDEO_KEY = 'test-key'; delete process.env.DRAGGE_RUNPOD_API_KEY; delete process.env.RUNPOD_API_KEY;
const { PodLipsyncPool } = await import('../server/pod-lipsync.mjs');
const { draggeSay, draggeVoiceReady, useLipsyncPod } = await import('../server/dragge-voice.mjs');

const TOKEN = 'test-token-0123456789';
const quiet = () => {};

// The game's /lipsync-worker route with the pool behind it, as in server.mjs.
async function game(pool) {
  const server = http.createServer();
  const workers = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/lipsync-worker') workers.handleUpgrade(req, socket, head, ws => pool.adoptWorker(ws, url));
    else socket.destroy();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: `ws://127.0.0.1:${server.address().port}/lipsync-worker`, close: () => { pool.close(); workers.close(); server.close(); } };
}

// One engine of Emil's pod: dials up, says pong, answers each start/PCM/end with done + an mp4 naming itself.
function engine(base, { avatar, token = TOKEN, ms = 30 } = {}) {
  const ws = new WebSocket(`${base}?token=${token}${avatar ? `&avatar=${avatar}` : ''}`);
  const seen = []; let job = null;
  ws.on('open', () => ws.send(JSON.stringify({ t: 'pong', avatar: avatar ?? 'astrid_spel2x', encoder: 'h264_nvenc' })));
  ws.on('message', (m, binary) => {
    if (binary) { job.bytes += m.length; return; }
    const j = JSON.parse(m.toString());
    if (j.t === 'start') job = { id: j.id, rate: j.rate, bytes: 0 };
    if (j.t === 'end') {
      const done = job; seen.push(done);
      setTimeout(() => { ws.send(JSON.stringify({ t: 'done', id: done.id, frames: 7, ms: { total: ms } })); ws.send(Buffer.from(`mp4 ${avatar ?? 'astrid_spel2x'} ${done.bytes}`)); }, ms);
    }
  });
  const closed = new Promise(r => ws.on('close', code => r(code)));
  return { ws, seen, closed, ready: new Promise(r => ws.on('open', r)) };
}
const settle = () => new Promise(r => setTimeout(r, 150));   // pong + _prime round trip

test('one pod, one engine per dealer: each dealer is lip-synced by its own avatar, Astrid and Paow at the same time', async () => {
  const pool = new PodLipsyncPool({ token: TOKEN, log: quiet });
  const g = await game(pool);
  try {
    const engines = Object.fromEntries(['astrid_spel2x', 'dragan_vila2x', 'paow_vila2x'].map(a => [a, engine(g.url, { avatar: a, ms: 120 })]));
    await Promise.all(Object.values(engines).map(e => e.ready)); await settle();
    assert.equal(pool.sessionReady, true);
    assert.match(pool.status, /astrid_spel2x h264_nvenc.*dragan_vila2x.*paow_vila2x/);
    const t0 = Date.now();
    const [a, p] = await Promise.all([pool.for('astrid_spel2x').lipsync(Buffer.alloc(4800), 24000), pool.for('paow_vila2x').lipsync(Buffer.alloc(9600), 24000)]);
    assert.equal(a.mp4.toString(), 'mp4 astrid_spel2x 4800');
    assert.equal(p.mp4.toString(), 'mp4 paow_vila2x 9600');
    assert.ok(Date.now() - t0 < 230, 'two engines work in parallel, not one after the other');
    assert.equal(engines.dragan_vila2x.seen.filter(j => j.id !== '_prime').length, 0, 'Dragge engine untouched');
  } finally { g.close(); }
});

test('the old pod script dials without &avatar and still serves Astrid; a wrong token is turned away', async () => {
  const pool = new PodLipsyncPool({ token: TOKEN, log: quiet });
  const g = await game(pool);
  try {
    const old = engine(g.url); await old.ready; await settle();
    const r = await pool.for('astrid_spel2x').lipsync(Buffer.alloc(480), 24000);
    assert.equal(r.mp4.toString(), 'mp4 astrid_spel2x 480');
    const bad = engine(g.url, { avatar: 'paow_vila2x', token: 'wrong-token-0123456789' });
    assert.equal(await bad.closed, 4403);
    assert.equal(pool.for('paow_vila2x').sessionReady, false);
    assert.throws(() => pool.for('../etc'), /ogiltigt avatar-id/);
  } finally { g.close(); }
});

test('Dragge and Paow on the pod: LIPSYNC_POD_DEALERS picks who, replies to one dealer queue instead of failing', async () => {
  const pool = new PodLipsyncPool({ token: TOKEN, log: quiet });
  const g = await game(pool);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pod-answers-'));
  const runpod = [];
  const fetchImpl = async (url, opts) => {
    if (url.includes('elevenlabs')) return { ok: true, arrayBuffer: async () => new ArrayBuffer(4800) };
    runpod.push(url); return { json: async () => ({ status: 'COMPLETED', output: { mp4_b64: '', frames: 1 } }) };
  };
  try {
    assert.equal(draggeVoiceReady('paow'), false, 'no pod and no RunPod key: Paow stays silent');
    useLipsyncPod(pool, ['paow']);
    assert.equal(draggeVoiceReady('paow'), true);
    assert.equal(draggeVoiceReady('dragge'), false, 'Dragge is not on the pod list and has no RunPod key');
    const paow = engine(g.url, { avatar: 'paow_vila2x', ms: 60 }); await paow.ready; await settle();
    const [one, two] = await Promise.all(['Good luck!', 'Nice hand.'].map(text => draggeSay(text, 'en', dir, { fetchImpl, dealer: 'paow' })));
    for (const clip of [one, two]) {
      assert.match(clip.url, /^\/answers\/[0-9a-f-]{36}\.mp4$/);
      assert.equal(clip.frames, 7);
      assert.match(await readFile(path.join(dir, path.basename(clip.url)), 'utf8'), /^mp4 paow_vila2x \d+$/);
    }
    assert.equal(paow.seen.filter(j => j.id !== '_prime').length, 2);
    assert.equal(runpod.length, 0, 'Paow never touches her RunPod endpoint while on the pod');
    process.env.DRAGGE_RUNPOD_API_KEY = 'test-key';
    await draggeSay('Place your bets.', 'en', dir, { fetchImpl, dealer: 'dragge' });
    assert.equal(runpod.length, 1, 'Dragge, not listed, keeps his RunPod endpoint');
  } finally { delete process.env.DRAGGE_RUNPOD_API_KEY; useLipsyncPod(null); g.close(); }
});
