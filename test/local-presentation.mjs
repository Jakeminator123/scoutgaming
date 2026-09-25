import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { createPresentationApi, presentationInput } from '../web/presentation-api.mjs';
import { createSeedProject } from '../lab/lib/studio-model.mjs';
import { playLocalFilm } from '../web/public/local-film-player.mjs';
import { createLocalPresentation } from '../web/public/local-presentation.mjs';
import { loadVideoRegistry } from '../lab/lib/video-registry.mjs';

const source = { type: 'deal', to: 'box', box: 3, handIndex: 1, shoeDraw: 7, faceDown: false, card: { r: 'A', s: '♠' }, clip: { action: 'deal-centre' } };
test('a browser can identify a deal but cannot change its card, hand or hidden state', () => {
  assert.deepEqual(presentationInput({ ...source, card: { r: 'K', s: '♥' }, handIndex: 0 }, [source]), source);
  const hole = { ...source, to: 'dealer', box: null, faceDown: true, card: { r: 'Q', s: '♠' } };
  assert.equal(presentationInput(hole, [hole]).card, null);
  assert.throws(() => presentationInput({ ...source, box: 2 }, [source]), /committed/);
  assert.throws(() => presentationInput({ ...source, shoeDraw: 8 }, [source]), /committed/);
});

test('native endpoint selects the same exact family, deduplicates requests and rejects another player or revision', async t => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE native_presentations (player_id TEXT, version INTEGER, payload TEXT)');
  db.prepare('INSERT INTO native_presentations VALUES (?,?,?)').run('qa', 2, JSON.stringify([source]));
  const handler = createPresentationApi({ db, env: {}, store: { load: async () => createSeedProject() } });
  const server = createServer(async (req, res) => { if (!await handler(req, res, new URL(req.url, 'http://local').pathname, req.headers['x-fixture-player'] ?? 'qa')) { res.writeHead(404); res.end(); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); db.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const choose = (patch = {}, headers = {}) => fetch(`${origin}/api/presentation/select`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ dealerId: 'astrid', version: 2, mode: 'off', event: { ...source, card: { r: 'K', s: '♥' } }, ...patch }) });
  const response = await choose(); assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.owner, 'web'); assert.equal(result.video.fileName, 'deal_pos4.mp4');
  assert.equal(result.decision.sourceEvent.card.r, 'A'); assert.equal(result.decision.sourceEvent.handIndex, 1);
  assert.deepEqual(await (await choose()).json(), result);
  assert.equal((await choose({ version: 1 })).status, 409);
  assert.equal((await choose({}, { 'x-fixture-player': 'somebody-else' })).status, 409);
  const media = await fetch(origin + result.video.src, { headers: { range: 'bytes=0-15' } });
  assert.equal(media.status, 206); assert.equal((await media.arrayBuffer()).byteLength, 16);
  assert.equal(media.headers.get('cache-control'), 'private, no-store');
  const missing = await choose({ event: { type: 'speak', line: 'unknownline' } });
  assert.equal(missing.status, 200); assert.equal((await missing.json()).video, null);
  const at = new Date().toISOString();
  const idle = await fetch(`${origin}/api/presentation/idle-advice`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    requestId: 'native-idle-fixture', dealerId: 'astrid', mode: 'active', project: { untrusted: 'must use saved project instead' },
    sourceRef: { kind: 'renderer-idle', channel: 'native-qa-channel', revision: 2, messageId: 'native-qa-message', at },
    observedChat: { source: 'native-observation', before: at, messages: [{ role: 'user', text: 'Hello Astrid', at }] },
  }) });
  assert.equal(idle.status, 200); const advice = await idle.json();
  assert.equal(advice.videoId, null); assert.equal(advice.provider, 'openclaw_not_configured');
});

class Video extends EventTarget {
  constructor() { super(); this.style = {}; this.ended = false; this.videoWidth = 1080; this.videoHeight = 1920; this.frames = new Map(); this.serial = 0; }
  requestVideoFrameCallback(fn) { this.frames.set(++this.serial, fn); return this.serial; }
  cancelVideoFrameCallback(id) { this.frames.delete(id); }
  play() { return Promise.resolve(); }
  pause() { this.paused = true; }
  load() {}
  removeAttribute() {}
  remove() { this.removed = true; }
  emit(type) { this.dispatchEvent(new Event(type)); }
  frame() { for (const callback of this.frames.values()) callback(0, { mediaTime: 1 }); this.frames.clear(); }
}
function filmFixture(t) {
  const original = globalThis.document;
  const media = [];
  globalThis.document = { createElement: () => { const video = new Video(); media.push(video); return video; } };
  t.after(() => { globalThis.document = original; });
  return { media, host: { append() {} } };
}
test('a selected or playing film is not completed until a real presented frame and ended event', async t => {
  const { media, host } = filmFixture(t); const receipts = []; let complete = false;
  const finished = playLocalFilm({ host, src: '/fixture.mp4', onReceipt: r => receipts.push(r), hold() {} }).then(() => { complete = true; });
  const video = media[0]; video.emit('playing'); await Promise.resolve(); assert.equal(complete, false);
  video.frame(); await Promise.resolve(); assert.equal(complete, false);
  video.ended = true; video.emit('ended'); await finished;
  assert.deepEqual(receipts.map(r => r.state), ['start', 'presented', 'end']); assert.equal(video.removed, true);
});
test('interruption cleans the old film and delayed callbacks cannot complete a new owner', async t => {
  const { media, host } = filmFixture(t); const controller = new AbortController(), receipts = [];
  const first = playLocalFilm({ host, src: '/one', signal: controller.signal, onReceipt: r => receipts.push(r) });
  const oldFrame = [...media[0].frames.values()][0]; media[0].emit('playing'); controller.abort();
  await assert.rejects(first, { name: 'AbortError' });
  const secondReceipts = [], second = playLocalFilm({ host, src: '/two', onReceipt: r => secondReceipts.push(r) });
  oldFrame(); media[0].ended = true; media[0].emit('ended');
  assert.deepEqual(receipts.map(r => r.state), ['start', 'interrupted']); assert.deepEqual(secondReceipts, []);
  media[1].emit('playing'); media[1].frame(); media[1].ended = true; media[1].emit('ended'); await second;
});
test('an ended event with no presented picture remains a failure', async t => {
  const { media, host } = filmFixture(t);
  const result = playLocalFilm({ host, src: '/broken' }); media[0].emit('playing'); media[0].ended = true; media[0].emit('ended');
  await assert.rejects(result, /without a presented frame/);
});

async function controllerFixture(t) {
  const originalDocument = globalThis.document, originalFetch = globalThis.fetch;
  const inventory = await loadVideoRegistry(), jobs = [], receipts = [];
  const element = () => ({ style: {}, dataset: {}, setAttribute() {}, append() {}, remove() {}, getContext: () => ({ drawImage() {} }) });
  globalThis.document = { hidden: false, createElement: element, addEventListener() {}, removeEventListener() {} };
  const selected = inventory.videos.find(video => video.fileName === 'deal_pos4.mp4');
  globalThis.fetch = async url => new Response(JSON.stringify(url.endsWith('/config') ? { inventory, idlePolicy: createSeedProject().idlePolicy }
    : { video: selected, standard: selected, decision: { sourceEvent: source, media: { familyId: selected.familyId } } }), { headers: { 'content-type': 'application/json' } });
  let proofs = 0;
  const player = { playLocalClip(take, options) { return new Promise((resolve, reject) => {
    const job = { take, options, resolve, reject }; jobs.push(job);
    options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
  }); } };
  const controller = await createLocalPresentation({ player, host: element(), dealerId: 'astrid', version: () => 2,
    receipt: value => receipts.push(value), onIdle: () => proofs++, onBusy() {}, muted: () => false });
  t.after(() => { controller.close(); globalThis.document = originalDocument; globalThis.fetch = originalFetch; });
  return { controller, jobs, receipts, get proofs() { return proofs; } };
}
test('deal interrupts idle; neither selection nor a stale idle frame opens the speech gate', async t => {
  const fixture = await controllerFixture(t); const { controller, jobs } = fixture;
  controller.start(); assert.equal(jobs.length, 1); assert.equal(fixture.proofs, 0);
  jobs[0].options.onReceipt({ state: 'start' }); assert.equal(fixture.proofs, 0);
  controller.state({ action: true }); assert.equal(jobs[0].options.signal.aborted, true);
  jobs[0].options.onReceipt({ state: 'presented' }); assert.equal(fixture.proofs, 0);
  const deal = controller.present(source); await new Promise(resolve => setImmediate(resolve));
  assert.equal(jobs.length, 2);
  controller.state({ speech: false }); // Late cleanup from interrupted chat.
  assert.equal(jobs[1].options.signal.aborted, false);
  controller.state({ ready: true }); // Generation finishes while the card is moving.
  assert.equal(jobs[1].options.signal.aborted, false);
  assert.equal(fixture.proofs, 0);
  jobs[1].resolve({ completed: true }); assert.equal(await deal, true);
  controller.state({ action: false }); assert.equal(jobs.length, 3); assert.equal(fixture.proofs, 0);
  jobs[2].options.onReceipt({ state: 'presented' }); assert.equal(fixture.proofs, 1);
});
test('a shared media download cancelled by the old owner does not poison the new owner', async t => {
  const { PerformancePlayer } = await import('../web/public/performance-player.mjs');
  const previousFetch = globalThis.fetch;
  const bytes = new TextEncoder().encode('shared local MP4 fixture');
  const sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
  let fetches = 0;
  globalThis.fetch = async (url, { signal }) => {
    if (++fetches === 1) return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    return new Response(bytes);
  };
  const player = Object.create(PerformancePlayer.prototype); player.assets = new Map();
  t.after(() => { globalThis.fetch = previousFetch; for (const url of player.assets.values()) URL.revokeObjectURL(url); });
  const take = { media: { sha256, src: '/fixture.mp4' } }, old = new AbortController(), next = new AbortController();
  const first = player.source(take, old.signal), second = player.source(take, next.signal);
  old.abort(); await assert.rejects(first, { name: 'AbortError' });
  const url = await second; assert.match(url, /^blob:/); assert.equal(fetches, 2);
  assert.equal(await player.source(take, next.signal), url); assert.equal(fetches, 2);
});

test('a newer ownership change discards a late selection before it can start a film', async t => {
  const { controller, jobs } = await controllerFixture(t);
  let respond;
  globalThis.fetch = () => new Promise(resolve => { respond = resolve; });
  controller.state({ action: true });
  const pending = controller.present(source);
  controller.state({ action: false }); // New renderer boundary while selection is pending.
  const count = jobs.length;
  respond(new Response(JSON.stringify({ video: { id: 'old' }, decision: {} })));
  assert.equal(await pending, false); assert.equal(jobs.length, count);
});
