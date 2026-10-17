import test from 'node:test';
import assert from 'node:assert/strict';
import { addDealer, buildRuntimeCatalog, createEmptyProject, normalizeProject, validateProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { createDealerSet, editDealerSet, removeDealerSet, validateDealerSetBindings } from '../../packages/presentation/contracts/dealer-sets.mjs';
import { createStudioProjectBindings } from '../../packages/presentation/server/studio-project-bindings.mjs';
import { lifecycleProject } from './dealer-lifecycle.mjs';
import { createNeonProjectStore } from './neon-project-store.mjs';
import { createStudioRepository } from '../../web/storage/studio-repository.mjs';
import { createStudioMemoryPool } from '../../test/fixtures/studio-memory-pool.mjs';
import { createStudioMediaApi } from './studio-media-api.mjs';
const id = '11111111-1111-4111-8111-111111111111', sha256 = 'a'.repeat(64);
const scope = { environment: 'test', workspaceId: 'dealer-sets' };
const classification = { dealerId: 'paow-v2', eventId: 'speak.goodluck', kind: 'speech', role: 'alternative', situation: 'goodluck', label: 'Exact take', notes: '', playback: 'once' };
const project = () => addDealer(createEmptyProject(), 'paow-v2', 'PAOW');
const set = value => createDealerSet(value, { id: 'paow3', name: 'PAOW3', dealerId: 'paow-v2', clipIds: [id] });
const video = () => ({ id, sha256, revision: 'studio-media-1', bytes: 100, dealer: 'paow-v2', available: true, integrity: 'verified', classification: { ...classification } });
const denied = code => error => error.code === code;
async function fixture() {
  const pool = createStudioMemoryPool(), repo = createStudioRepository({ pool, scope });
  const saved = await repo.initializeDocument('project', { value: project(), revision: 'studio-original', actor: 'fixture' });
  const { media } = await repo.registerMedia({ id, sha256, size: 100, contentType: 'video/mp4', pathname: `croupier/media/dealers/paow-v2/review/uploads/${id}/${sha256}.mp4`, classification }, { actor: 'fixture' });
  const store = createNeonProjectStore({ repository: repo, scope, actor: 'tester' });
  return { pool, repo, store, saved, media };
}
test('category archive/restore retains clips and exact runtime semantics; name never registers PAOW3', () => {
  const original = project(), draft = set(original), archived = editDealerSet(draft, 'paow3', { archived: true });
  assert.deepEqual(archived.dealerSets[0].clipIds, [id]);
  assert.deepEqual(buildRuntimeCatalog(archived, 'paow-v2'), buildRuntimeCatalog(original, 'paow-v2'));
  assert.deepEqual(archived.dealers, original.dealers);
  const restored = editDealerSet(archived, 'paow3', { archived: false });
  assert.deepEqual(restored, draft);
  assert.deepEqual(original, project());
  assert.equal(normalizeProject(original).dealerSets, undefined);
  assert.throws(() => createDealerSet(original, { id: 'fake', name: 'PAOW3', dealerId: 'paow3' }), denied('studio_dealer_set_invalid'));
});
test('strict schema rejects hidden versions, unknown owners, duplicate set/clip IDs and dealer reassignment', () => {
  const draft = set(project());
  for (const patch of [{ version: 'published-v3' }, { dealerId: 'other' }, { clipIds: [id, id] }, { clipIds: ['../secret'] }, { archived: 'yes' }]) {
    assert.throws(() => validateProject({ ...draft, dealerSets: [{ ...draft.dealerSets[0], ...patch }] }));
  }
  assert.throws(() => validateProject({ ...draft, dealerSets: [draft.dealerSets[0], draft.dealerSets[0]] }));
  assert.throws(() => editDealerSet(draft, 'paow3', { dealerId: 'nora' }), denied('studio_dealer_set_invalid'));
});
test('server binding verifier checks exact registered raw ownership, including protected retained originals', async () => {
  const draft = set(project()), registry = { videos: [video()], families: [] };
  validateDealerSetBindings(draft, registry);
  validateDealerSetBindings(draft, { videos: [{ ...video(), retainedBank: true }] });
  for (const changed of [{ classification: { ...classification, dealerId: 'other' } }, { dealer: 'other' }, { revision: undefined }, { classification: undefined }, { classification: { ...classification, archived: true } }, { deletion: { state: 'pending' } }, { available: false }]) {
    assert.throws(() => validateDealerSetBindings(draft, { videos: [{ ...video(), ...changed }] }), denied('studio_dealer_set_binding_invalid'));
  }
  const verify = createStudioProjectBindings({ videoRegistry: async () => registry });
  await verify(draft);
  registry.videos[0].classification.dealerId = 'other';
  await assert.rejects(verify(draft), denied('studio_media_binding_invalid'));
});
test('CAS save/read roundtrip preserves archived category and shared references', async () => {
  const f = await fixture();
  let draft = createDealerSet(set(f.saved.value), { id: 'shared', name: 'Shared', dealerId: 'paow-v2', clipIds: [id] });
  draft = editDealerSet(draft, 'paow3', { archived: true });
  const saved = await f.store.save(draft, f.saved.revision);
  assert.deepEqual((await f.store.load()).dealerSets, draft.dealerSets);
  assert.notEqual(saved.revision, f.saved.revision);
  assert.equal((await f.repo.findMediaReferences(id)).references.some(row => !row.historical), true);
  const same = await f.repo.getMedia(id);
  await assert.rejects(f.repo.classifyMedia(id, { sha256, expectedRevision: same.revision, metadata: { ...classification, archived: true }, actor: 'tester' }), denied('studio_media_in_use'));
  let detached = removeDealerSet(saved, 'paow3');
  const shared = await f.store.save(detached, saved.revision);
  await assert.rejects(f.repo.classifyMedia(id, { sha256, expectedRevision: same.revision, metadata: { ...classification, archived: true }, actor: 'tester' }), denied('studio_media_in_use'));
  detached = removeDealerSet(shared, 'shared');
  await f.store.save(detached, shared.revision);
  await f.repo.classifyMedia(id, { sha256, expectedRevision: same.revision, metadata: { ...classification, archived: true }, actor: 'tester' });
  assert.equal((await f.repo.getMedia(id)).classification.archived, true);
});
test('HTTP media archive preserves category-owned files; category unlink does not erase bytes', async () => {
  const f = await fixture(), saved = await f.store.save(set(f.saved.value), f.saved.revision);
  const config = { scope, apiBase: '/studio/api/admin', authBase: '/studio/api/auth', allowedOrigins: ['https://studio.example.invalid', 'https://lab.example.invalid'], publicHosts: ['studio.example.invalid', 'lab.example.invalid'] };
  const api = createStudioMediaApi({ repository: f.repo, config, authorize: async () => ({ user: 'tester', role: 'admin', scope }), mutationTransaction: work => f.repo.transaction(work), videoRegistry: async () => ({ videos: [video()], families: [] }) });
  const response = await api.handle(new Request('https://studio.example.invalid/studio/api/videos/archive', { method: 'POST', headers: { origin: 'https://studio.example.invalid', 'sec-fetch-site': 'same-origin', 'Content-Type': 'application/json' }, body: JSON.stringify({ id, sha256, previous: classification, archived: true }) }));
  assert.equal(response.status, 409); assert.equal((await response.json()).error, 'studio_media_in_use');
  assert.equal((await f.repo.getMedia(id)).classification.archived, undefined);
  const detached = editDealerSet(saved, 'paow3', { clipIds: [] });
  await f.store.save(detached, saved.revision);
  assert.equal((await f.repo.getMedia(id)).sha256, sha256);
  assert.equal((await f.repo.getMedia(id)).deletion, undefined);
});
test('concurrent category writers have one CAS winner and retain membership', async () => {
  const f = await fixture(), saved = await f.store.save(set(f.saved.value), f.saved.revision);
  const results = await Promise.allSettled(['A', 'B'].map(name => f.store.save(editDealerSet(saved, 'paow3', { name }), saved.revision)));
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(results.filter(row => row.status === 'rejected' && row.reason.code === 'studio_conflict').length, 1);
  assert.deepEqual((await f.store.load()).dealerSets[0].clipIds, [id]);
});
test('transactional ownership guard prevents reclassification while any category references the clip', async () => {
  const f = await fixture();
  await f.store.save(set(f.saved.value), f.saved.revision);
  const before = f.pool.snapshot();
  await assert.rejects(f.repo.classifyMedia(id, { sha256, expectedRevision: f.media.revision, metadata: { ...classification, dealerId: 'nora' }, actor: 'tester' }), denied('studio_media_in_use'));
  assert.deepEqual(f.pool.snapshot(), before);
  assert.equal((await f.repo.getMedia(id)).classification.dealerId, 'paow-v2');
});
test('transaction rejects stale membership inventory if a clip archives before project CAS', async () => {
  const f = await fixture(), draft = set(f.saved.value);
  validateDealerSetBindings(draft, { videos: [video()] });
  await f.repo.classifyMedia(id, { sha256, expectedRevision: f.media.revision, metadata: { ...classification, archived: true }, actor: 'tester' });
  const before = f.pool.snapshot();
  await assert.rejects(f.store.save(draft, f.saved.revision), denied('studio_media_in_use'));
  assert.deepEqual(f.pool.snapshot(), before);
  assert.equal((await f.store.load()).dealerSets, undefined);
});
test('dealer archive keeps categories in its trash snapshot and restores them with the identity', () => {
  const draft = editDealerSet(set(project()), 'paow3', { archived: true });
  const records = [{ id, classification }];
  const archived = lifecycleProject(draft, { dealerId: 'paow-v2', archived: true, records });
  assert.equal(archived.dealerSets, undefined);
  assert.deepEqual(archived.dealerTrash[0].dealerSets,draft.dealerSets);
  const restored = lifecycleProject(archived, { dealerId: 'paow-v2', archived: false, records: [{ id, classification: { ...classification, archived: true } }] });
  assert.deepEqual(restored.dealers, draft.dealers);
  assert.deepEqual(restored.lines, draft.lines);
  assert.deepEqual(restored.dealerSets,draft.dealerSets);
});
