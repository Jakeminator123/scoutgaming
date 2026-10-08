import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { createPresentationApi } from '../web/presentation-api.mjs';
import { createSeedProject, normalizeProject } from '../lab/lib/studio-model.mjs';
import { selectPresentation } from '../presentation-runtime/selection.mjs';
import { loadVideoRegistry } from '../lab/lib/video-registry.mjs';
import { SPEECH_LINES } from '../web/public/speech-lines.mjs';

const source = { type: 'deal', to: 'box', box: 3, handIndex: 1, shoeDraw: 7, faceDown: false, card: { r: 'A', s: '♠' }, clip: { action: 'deal-centre' } };
const golden = JSON.parse(await readFile(new URL('./fixtures/astrid-select-off.json', import.meta.url), 'utf8'));

test('Astrid select stays byte-identical, including when Vera legacy rules are in the same project', async () => {
  const registry = await loadVideoRegistry();
  const choose = project => selectPresentation({
    requestId: 'snapshot-c5b', project, dealerId: 'astrid', eventId: 'deal.player.centre', sourceEvent: source, mode: 'off',
  }, { videoRegistry: registry, random: () => 0 });
  assert.deepEqual(await choose(createSeedProject()), golden);
  const migrated = normalizeProject({ ...structuredClone(createSeedProject()), legacyClipPolicy: [
    { dealerId: 'vera', part: 'box3', clipId: 'vera:legacy/box3' },
    { dealerId: 'vera', part: 'idle', clipId: 'vera:legacy/idle' },
  ] });
  assert.deepEqual(await choose(migrated), golden);
  const vera = await selectPresentation({
    requestId: 'vera-box3', project: migrated, dealerId: 'vera', eventId: 'deal.player.centre', sourceEvent: source, mode: 'off',
  }, { videoRegistry: registry, random: () => 0 });
  assert.equal(vera.decision.variantId, 'vera.deal.player.centre.standard');
  assert.equal(vera.variant.videoGenerationId, 'vera:legacy/box3');
  assert.equal(vera.videoGenerationId, null);
});

test('select accepts every saved dealer and does not reuse another dealer cache', async t => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE native_presentations (player_id TEXT, version INTEGER, payload TEXT)');
  const seen = [];
  const handler = createPresentationApi({
    db, env: {}, store: { load: async () => createSeedProject() }, registryLoader: async () => ({ videos: [], families: [], summary: {} }),
    select: async body => {
      seen.push(body.dealerId);
      return { decision: { requestId: body.requestId, variantId: body.dealerId, reason: 'ai_disabled', mode: body.mode, sourceEvent: body.sourceEvent, media: null, context: {}, simulated: false, presentationReplay: true },
        trace: [], eligible: [], variant: { id: body.dealerId, videoGenerationId: null }, asset: null, videoGenerationId: null, provider: 'off',
        contextReceipt: { contractVersion: null, observedChatMessages: null } };
    },
  });
  const server = createServer(async (req, res) => { await handler(req, res, '/api/presentation/select', 'dealer-qa'); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); db.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = dealerId => fetch(`${origin}/api/presentation/select`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dealerId, version: 1, mode: 'off', event: { type: 'speak', line: 'win' } }) });
  for (const dealerId of ['astrid', 'vera', 'amira', 'mei', 'dragge', 'paow']) {
    const response = await post(dealerId);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).decision.variantId, dealerId);
  }
  assert.deepEqual(seen, ['astrid', 'vera', 'amira', 'mei', 'dragge', 'paow']);
  const rejected = await post('nova');
  assert.equal(rejected.status, 400);
});

test("Dragge's speech select serves his own standard film for every line, and Paow gets no film", async t => {
  const registry = await loadVideoRegistry();
  const manifest = JSON.parse(await readFile(new URL('../media/dealers/dragge/runtime/presentation/lab-video-manifest.json', import.meta.url), 'utf8'));
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE native_presentations (player_id TEXT, version INTEGER, payload TEXT)');
  const handler = createPresentationApi({ db, env: {}, store: { load: async () => createSeedProject() }, registryLoader: async () => registry });
  const server = createServer(async (req, res) => { await handler(req, res, '/api/presentation/select', 'dealer-qa'); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); db.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = (dealerId, line) => fetch(`${origin}/api/presentation/select`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dealerId, version: 1, mode: 'off', event: { type: 'speak', line } }) });
  assert.equal(Object.keys(SPEECH_LINES).length, 17);
  for (const line of Object.keys(SPEECH_LINES)) {
    const response = await post('dragge', line);
    // The request accepts letter-only line ids, so chatter1 and chatter2 cannot be asked for, for any dealer.
    if (/\d/.test(line)) { assert.equal(response.status, 400, line); continue; }
    assert.equal(response.status, 200, line);
    const body = await response.json();
    const standard = manifest.items.find(item => item.relativePath === `repliker/${line}/${line}.mp4`);
    assert.deepEqual([body.video?.id, body.video?.sha256, body.standard?.id], [standard.id, standard.sha256, standard.id], line);
  }
  const paow = await post('paow', 'win');
  assert.equal(paow.status, 200);
  assert.equal((await paow.json()).video, null);
});
