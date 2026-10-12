import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import { createPresentationApi } from '../web/presentation-api.mjs';
import { createSeedProject, addDealer, normalizeProject } from '../lab/lib/studio-model.mjs';
import { selectPresentation } from '../presentation-runtime/selection.mjs';
import { loadVideoRegistry } from '../lab/lib/video-registry.mjs';

const source = { type: 'deal', to: 'box', box: 3, handIndex: 1, shoeDraw: 7, faceDown: false, card: { r: 'A', s: '♠' }, clip: { action: 'deal-centre' } };
const golden = JSON.parse(await readFile(new URL('./fixtures/astrid-select-off.json', import.meta.url), 'utf8'));

test('Astrid select stays byte-identical, including when Vera legacy rules are in the same project', async () => {
  const registry = await loadVideoRegistry({archiveDir:fileURLToPath(new URL('../media/dealers/astrid/runtime/presentation',import.meta.url))});
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
  assert.equal(vera.variant.videoGenerationId, null, 'historical policy never creates an active standard binding');
  assert.equal(vera.videoGenerationId, null);
});

test('select accepts every active registered dealer and does not reuse another dealer cache', async t => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE native_presentations (player_id TEXT, version INTEGER, payload TEXT)');
  const seen = [];
  const project = addDealer(createSeedProject(), 'paow', 'Paow');
  const handler = createPresentationApi({
    db, env: {}, store: { load: async () => project }, registryLoader: async () => ({ videos: [], families: [], summary: {} }),
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
  for (const dealerId of ['astrid', 'vera', 'mei', 'paow']) {
    const response = await post(dealerId);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).decision.variantId, dealerId);
  }
  assert.deepEqual(seen, ['astrid', 'vera', 'mei', 'paow']);
  assert.equal((await post('amira')).status, 400);
  const rejected = await post('nora');
  assert.equal(rejected.status, 400);
});
