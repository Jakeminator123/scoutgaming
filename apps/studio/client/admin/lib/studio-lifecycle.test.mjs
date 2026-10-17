import test from 'node:test';
import assert from 'node:assert/strict';
import { addDealer, createEmptyProject, defaultPresentationLane } from '../../../../../packages/presentation/contracts/studio-model.mjs';
import { createLifecycleClient, lifecycleBank, lifecycleClipReferences, lifecycleFingerprint, clipLifecycleBlocker } from './studio-lifecycle.mjs';
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
const sha256 = 'a'.repeat(64), token = 'b'.repeat(64);
function fixture() {
  const project = addDealer(createEmptyProject(), 'paow-v2', 'PAOW');
  const video = { id: a, label: 'POW3 is a label', sha256, revision: 'studio.clip.1', available: true, integrity: 'verified',
    classification: { label: 'POW3 is a label', dealerId: 'paow-v2', eventId: 'idle.ready', kind: 'idle', role: 'standard', situation: '', notes: '' } };
  const inventory = { videos: [video] };
  const catalog = { source: 'registered', administration: { dealers: [{ id: 'paow-v2', name: 'PAOW', archived: false }], rooms: [], operators: [] } };
  return { project, video, inventory, catalog };
}
test('registry ownership never manufactures POW3 or aliases paow-v2 from labels', () => {
  const f = fixture();
  f.inventory.videos.push({ ...f.video, id: b, label: 'PAOW', classification: { ...f.video.classification, dealerId: 'other' } });
  assert.equal(lifecycleBank(f.project, f.inventory, f.catalog, 'pow3'), null);
  assert.equal(lifecycleBank(f.project, f.inventory, f.catalog, 'paow'), null);
  assert.deepEqual(lifecycleBank(f.project, f.inventory, f.catalog, 'paow-v2').videos.map(row => row.id), [a]);
  assert.equal(lifecycleBank(f.project, f.inventory, { ...f.catalog, source: 'demo' }, 'paow-v2'), null);
});
test('exact usage includes another dealer, loops, policy and composition; same text in a label is harmless', () => {
  const f = fixture(), line = f.project.lines.find(row => row.dealerId === 'paow-v2');
  line.label = a;
  assert.deepEqual(lifecycleClipReferences(f.project, a), []);
  line.variants[0].videoGenerationId = a;
  f.project.dealerIdlePolicies = [{ dealerId: 'other', policy: { base: [{ videoId: a }], variants: [] } }];
  f.project.mediaPolicy = [{ familyId: 'unrelated-family', variants: [{ videoId: a }] }];
  const lane = defaultPresentationLane('paow-v2'); lane.idle = { variants: [a] }; f.project.lanes = [lane];
  assert.deepEqual(lifecycleClipReferences(f.project, a).map(row => row.kind), ['line', 'idle', 'family', 'composition']);
  assert.equal(clipLifecycleBlocker(f.project, f.video, 'paow-v2', 'archive'), 'studio_media_in_use');
});
test('batch preflight preserves every file if any selected clip belongs elsewhere or is protected', async () => {
  for (const patch of [{ classification: { ...fixture().video.classification, dealerId: 'other' } }, { retainedBank: true }, { bindingScope: 'shared-local' }, { revision: undefined }, { sha256: undefined }]) {
    const f = fixture(); f.inventory.videos.push({ ...f.video, id: b, ...patch });
    let calls = 0;
    const client = createLifecycleClient({ fetchImpl: async () => { calls++; return Response.json({}); } });
    await assert.rejects(client.archiveClips({ ...f, dealerId: 'paow-v2', ids: [a, b], archived: true }));
    assert.equal(calls, 0);
    assert.equal(f.video.classification.archived, undefined);
  }
});
test('duplicate media IDs and a speech reference fail closed before archive requests', async () => {
  const f = fixture(); let calls = 0;
  const client = createLifecycleClient({ fetchImpl: async () => { calls++; return Response.json({}); } });
  f.inventory.videos.push(structuredClone(f.video));
  await assert.rejects(client.archiveClips({ ...f, dealerId: 'paow-v2', ids: [a], archived: true }), /studio_media_snapshot_incomplete/);
  f.inventory.videos.pop();
  f.project.dealers[0].speechProfile = { reference: { videoId: a } };
  assert.equal(lifecycleClipReferences(f.project, a)[0].kind, 'speech');
  await assert.rejects(client.archiveClips({ ...f, dealerId: 'paow-v2', ids: [a], archived: true }), /studio_media_in_use/);
  assert.equal(calls, 0);
});
test('archive sends exact previous metadata and hash; partial batch stops without repeating a write', async () => {
  const f = fixture(); f.inventory.videos.push({ ...f.video, id: b });
  const calls = [];
  const client = createLifecycleClient({ fetchImpl: async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), init });
    if (calls.length === 2) return Response.json({ code: 'studio_media_published' }, { status: 409 });
    return Response.json({ videos: [{ ...f.video, classification: { ...f.video.classification, archived: true } }] });
  } });
  await assert.rejects(client.archiveClips({ ...f, dealerId: 'paow-v2', ids: [a, b], archived: true }), error => {
    assert.deepEqual(error.completed, [a]); return error.code === 'studio_media_published';
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, '/studio/api/videos/archive');
  assert.deepEqual(calls[0].body, { id: a, sha256, previous: f.video.classification, archived: true });
  assert.equal(calls[0].init.redirect, 'error'); assert.equal(calls[0].init.credentials, 'same-origin');
});
test('changed selection/hash/revision invalidates review and stale actions make no request', async () => {
  const f = fixture(), before = lifecycleFingerprint(f.project, f.inventory, 'paow-v2', [a]);
  f.video.revision = 'studio.clip.2';
  assert.notEqual(lifecycleFingerprint(f.project, f.inventory, 'paow-v2', [a]), before);
  f.video.classification.archived = true;
  let calls = 0;
  const client = createLifecycleClient({ fetchImpl: async () => { calls++; return Response.json({}); } });
  await assert.rejects(client.archiveClips({ ...f, dealerId: 'paow-v2', ids: [a], archived: false, stillCurrent: () => false }), /studio_conflict/);
  await assert.rejects(client.deleteClip(f.project, f.inventory, 'paow-v2', a, () => false), /studio_conflict/);
  assert.equal(calls, 0);
});
test('archived dealer must be restored before individual media; archive drafts protect permanent deletion', () => {
  const f = fixture(), dealer = f.project.dealers.pop();
  f.video.classification.archived = true;
  f.project.dealerTrash = [{ dealer, lines: [{ label: 'Archived speech', dealerId: dealer.id, variants: [{ label: 'Exact take', videoGenerationId: a }] }] }];
  assert.equal(clipLifecycleBlocker(f.project, f.video, dealer.id, 'restore'), 'studio_dealer_not_registered');
  assert.equal(clipLifecycleBlocker(f.project, f.video, dealer.id, 'delete'), 'studio_media_in_use');
});
test('dealer cascade requires a valid matching impact token; malformed checks authorize no action', async () => {
  const f = fixture(); let calls = 0;
  const client = createLifecycleClient({ fetchImpl: async () => { calls++; return Response.json({ impact: { token, dealerId: 'other', mediaCount: 1, speechEnabled: false, compositions: [], rooms: [], operators: [] } }); } });
  await assert.rejects(client.checkDealerArchive(f.project, 'paow-v2'), /studio_lifecycle_response_invalid/);
  await assert.rejects(client.dealerLifecycle(f.project, 'paow-v2', true, { token: 'bad', dealerId: 'paow-v2' }), /studio_invalid_request/);
  assert.equal(calls, 1);
  f.video.classification.archived = true;
  await assert.rejects(client.checkClipDeletion(f.project, f.inventory, 'paow-v2', a), /studio_lifecycle_response_invalid/);
});
test('unconfirmed response stays uncertain and is not counted as a completed clip', async () => {
  const f = fixture(); let calls = 0;
  const client = createLifecycleClient({ fetchImpl: async () => { calls++; return Response.json({ videos: [{ ...f.video, sha256: 'c'.repeat(64), classification: { ...f.video.classification, archived: true } }] }); } });
  await assert.rejects(client.archiveClips({ ...f, dealerId: 'paow-v2', ids: [a], archived: true }), error => { assert.deepEqual(error.completed, []); return error.code === 'studio_lifecycle_response_invalid'; });
  assert.equal(calls, 1);
});
