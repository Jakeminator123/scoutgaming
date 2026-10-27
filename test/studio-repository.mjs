import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { createSeedProject, createEmptyProject, addDealer } from '../packages/presentation/contracts/studio-model.mjs';
import { mediaTimingSpeechIdentity } from '../packages/presentation/contracts/media-timing.mjs';
import { normalizeRecordedSpeech, recordedSpeechIdentity, recordedSpeechForVideo } from '../packages/presentation/contracts/recorded-speech.mjs';
import { lifecycleProject } from '../apps/studio/lib/dealer-lifecycle.mjs';
import { historicalDealerProject } from './fixtures/historical-dealer-project.mjs';
import { createOperatorStore } from '../packages/operators/server/operator-store.mjs';
import { createStudioRepository } from '../packages/studio-registry/server/document-repository.mjs';
import { StudioStorageError, cloneStudioJson, studioStorageFailure, validateStudioScope, STUDIO_JSON_LIMIT } from '../packages/studio-registry/server/document-contract.mjs';
import { createStudioMemoryPool } from './fixtures/studio-memory-pool.mjs';
import {readRuntimeCatalogFixture} from './fixtures/runtime-media-catalog.mjs';
import {RETAINED_BANK_VARIANTS,createRetainedStudioMedia} from '../packages/studio-registry/server/document-contract.mjs';

test('unsupported media MIME rejects before opening SQL and cannot be accepted by the memory pool',async()=>{
  for(const contentType of ['image/png','audio/wav','audio/mpeg']){
    const pool=createStudioMemoryPool(),repo=repository(pool),id='11111111-1111-4111-8111-111111111111',sha256='a'.repeat(64);
    const classification=contentType==='image/png'?{dealerId:'astrid',eventId:'roulette.reference',kind:'idle',role:'alternative',situation:'VILA',label:'Reference',notes:'',mediaType:'image',game:'roulette',action:'reference',startPose:'VILA',endPose:'VILA',compositing:{mode:'alpha'}}:{dealerId:'astrid',eventId:'speak.goodluck',kind:'speech',role:'alternative',situation:'goodluck',label:'Audio',notes:'',mediaType:'audio'};
    const ext=contentType==='image/png'?'png':contentType==='audio/wav'?'wav':'mp3';
    await assert.rejects(repo.registerMedia({id,sha256,size:32,contentType,classification,pathname:`croupier/media/dealers/astrid/review/uploads/${id}/${sha256}.${ext}`},{actor:'tester'}),e=>e.code==='studio_media_content_type_unsupported'&&e.statusCode===415);
    assert.equal(pool.calls.length,0);assert.equal(pool.snapshot().media.size,0);assert.equal(pool.snapshot().audits.length,0);
  }
});

test('explicit retained originals are scoped immutable records with audited idempotent registration',async()=>{
  const pool=createStudioMemoryPool(),repo=repository(pool),other=createStudioRepository({pool,scope:{...scope,workspaceId:'other'}});
  for(const tuple of RETAINED_BANK_VARIANTS){
    const record=createRetainedStudioMedia(tuple.id),first=await repo.registerMedia(record,{actor:'explicit-retention-import'});
    assert.deepEqual(await repo.registerMedia(record,{actor:'explicit-retention-import'}),{media:first.media,duplicate:true});
    const before=pool.snapshot();
    await assert.rejects(repo.classifyMedia(tuple.id,{sha256:record.sha256,expectedRevision:first.media.revision,metadata:record.classification,actor:'operator'}),error=>error.code==='studio_retained_media_immutable'&&error.statusCode===410);
    assert.deepEqual(pool.snapshot(),before);
    await assert.rejects(repo.registerMedia({...record,size:record.size+1},{actor:'operator'}),error=>error.code==='studio_invalid_retained_media');
    assert.equal(await other.getMedia(tuple.id),null);
  }
  assert.equal((await repo.listMedia()).length,6);assert.equal((await other.listMedia()).length,0);
  assert.equal(pool.snapshot().audits.length,6);assert.ok(pool.snapshot().audits.every(row=>row.actor==='explicit-retention-import'));
});

const scope = Object.freeze({ environment: 'test', workspaceId: 'workspace-1' });
const repository = pool => createStudioRepository({ pool, scope });
const rejection = (code, status) => error => error instanceof StudioStorageError && error.code === code && (status === undefined || error.statusCode === status);
const initialize = repo => repo.initializeDocument('administration', { value: { rooms: [] }, actor: 'tester', revision: 'initial' });

async function timingFixture({ speech = false, project = true, archived = false } = {}) {
  const pool = createStudioMemoryPool(), repo = repository(pool);
  if (project) await repo.initializeDocument('project', { value: addDealer(createEmptyProject(), 'nora', 'Nora'), actor: 'tester' });
  const id = '40000000-0000-4000-8000-000000000001', sha256 = 'a'.repeat(64);
  const record = { id, sha256, size: 4096, contentType: 'video/mp4',
    pathname: `croupier/media/dealers/nora/review/uploads/${id}/${sha256}.mp4`,
    classification: { dealerId: 'nora', eventId: speech ? 'speak.goodluck' : 'idle.ready', kind: speech ? 'speech' : 'idle',
      role: 'alternative', situation: speech ? 'goodluck' : '', label: 'Synthetic timing fixture', notes: 'Retain me', playback: 'once', ...(archived ? { archived: true } : {}) } };
  if (speech) record.classification.recordedSpeech = { schemaVersion: 1, dealerId: 'nora', lineId: 'goodluck', takeId: 'take_1', language: 'sv',
    exactText: 'Lycka till.', videoSha256: sha256, audioSha256: 'b'.repeat(64), indexSha256: 'c'.repeat(64), fps: 24, frameCount: 72,
    audioDelayMs: 0, entryPose: 'VILA', exitPose: 'VILA', calibrationRevision: 'fixture-1', recording: { status: 'pending' }, review: { status: 'pending' } };
  if (speech === 'embedded') record.classification.recordedSpeech = { schemaVersion: 2, sourceKind: 'embedded-mp4-av',
    dealerId: 'nora', lineId: 'goodluck', takeId: 'take_1', language: 'sv', exactText: 'Lycka till.', videoSha256: sha256,
    fps: 24, frameCount: 72, videoTrackId: 1, audioTrackId: 2, entryPose: 'VILA', exitPose: 'VILA',
    source: { status: 'pending' }, review: { status: 'pending' } };
  const registered = (await repo.registerMedia(record, { actor: 'Uploader' })).media;
  const mediaTiming = { schemaVersion: 1, mediaId: id, sha256, size: record.size,
    recordedSpeechIdentitySha256: speech ? createHash('sha256').update(mediaTimingSpeechIdentity(record.classification.recordedSpeech)).digest('hex') : null,
    video: { trackId: 1, frameCount: 72, fps: 24, firstPtsUs: 0, lastPtsUs: 2958333, endUs: 3000000 },
    audio: [{ trackId: 2, firstPtsUs: 0, endUs: 3200000 }], endUs: 3200000, audioTailUs: 200000 };
  const save = (changes = {}) => repo.saveMediaTiming(id, { sha256, expectedRevision: registered.revision, mediaTiming, actor: 'Inspector', ...changes });
  return { pool, repo, record, registered, mediaTiming, save };
}

test('embedded AV measurement stamps only the server source and preserves pending review', async () => {
  const f = await timingFixture({ speech: 'embedded' }), before = structuredClone(f.registered.classification);
  const started = Date.now(), saved = await f.save(), speech = saved.classification.recordedSpeech;
  assert.equal(speech.source.status, 'verified-embedded-av'); assert.equal(speech.source.by, 'Inspector');
  assert.ok(Date.parse(speech.source.at) >= started && Date.parse(speech.source.at) <= Date.now());
  assert.equal(new Date(speech.source.at).toISOString(), speech.source.at);
  assert.deepEqual(speech.source.identity, recordedSpeechIdentity(speech));
  assert.deepEqual(speech.review, before.recordedSpeech.review);
  assert.deepEqual({ ...saved.classification, recordedSpeech: { ...speech, source: before.recordedSpeech.source } }, before);
  assert.deepEqual(saved.mediaTiming, f.mediaTiming);
  assert.equal(recordedSpeechForVideo(saved, { dealerId: 'nora', lineId: 'goodluck', language: 'sv' }), null);
  assert.deepEqual(await f.repo.getMedia(saved.id), saved);
  assert.equal(f.pool.snapshot().audits.at(-1).actor, 'Inspector');
});

test('embedded AV registration and classification cannot mint a verified source or change its attribution', async () => {
  const f = await timingFixture({ speech: 'embedded' }), before = f.pool.snapshot();
  const metadata = structuredClone(f.record.classification), speech = metadata.recordedSpeech;
  speech.source = { status: 'verified-embedded-av', by: 'Untrusted', at: '2026-10-26T00:00:00.000Z', identity: recordedSpeechIdentity(speech) };
  const classify = value => f.repo.classifyMedia(f.record.id, { sha256: f.record.sha256, expectedRevision: f.registered.revision, metadata: value, actor: 'Editor' });
  await assert.rejects(classify(metadata), rejection('studio_invalid_media', 422));
  assert.deepEqual(f.pool.snapshot(), before);
  const forged = { ...f.record, id: '40000000-0000-4000-8000-000000000002', classification: metadata };
  forged.pathname = forged.pathname.replace(f.record.id, forged.id);
  const connections = f.pool.connects;
  await assert.rejects(f.repo.registerMedia(forged, { actor: 'Uploader' }), rejection('studio_invalid_media', 422));
  await assert.rejects(f.repo.registerMedia({ ...forged, mediaTiming: { ...f.mediaTiming, mediaId: forged.id } }, { actor: 'Uploader' }), rejection('studio_invalid_media', 422));
  assert.equal(f.pool.connects, connections); assert.deepEqual(f.pool.snapshot(), before);
  const saved = await f.save(), stable = f.pool.snapshot();
  for (const change of [source => { source.by = 'Another inspector'; }, source => { source.at = '2026-10-25T00:00:00.000Z'; }]) {
    const next = structuredClone(saved.classification); change(next.recordedSpeech.source);
    await assert.rejects(f.repo.classifyMedia(saved.id, { sha256: saved.sha256, expectedRevision: saved.revision, metadata: next, actor: 'Editor' }), rejection('studio_invalid_media', 422));
    assert.deepEqual(f.pool.snapshot(), stable);
  }
  const reset = structuredClone(saved.classification); reset.recordedSpeech.source = { status: 'pending' };
  const pending = await f.repo.classifyMedia(saved.id, { sha256: saved.sha256, expectedRevision: saved.revision, metadata: reset, actor: 'Editor' });
  const resetState = f.pool.snapshot();
  assert.deepEqual(pending.mediaTiming, saved.mediaTiming);
  await assert.rejects(f.repo.classifyMedia(saved.id, { sha256: saved.sha256, expectedRevision: pending.revision,
    metadata: saved.classification, actor: 'Editor' }), rejection('studio_invalid_media', 422));
  assert.deepEqual(f.pool.snapshot(), resetState, 'a prior source stamp cannot be replayed after it was cleared');
});

test('embedded AV review can approve measured bytes while preserving the exact source and timing', async () => {
  const f = await timingFixture({ speech: 'embedded' }); let saved = await f.save();
  let source = structuredClone(saved.classification.recordedSpeech.source);
  const identity = recordedSpeechIdentity(saved.classification.recordedSpeech), expectedIdentity = structuredClone(identity);
  const forged = structuredClone(saved.classification), stable = f.pool.snapshot();
  forged.recordedSpeech.review = { status: 'approved', by: 'Reviewer', at: '2026-10-26T00:00:01.000Z', identity };
  await assert.rejects(f.repo.classifyMedia(saved.id, { sha256: saved.sha256, expectedRevision: saved.revision, metadata: forged, actor: 'Reviewer' }),
    rejection('studio_invalid_media', 422), 'ordinary metadata cannot mint an attributed AV review');
  assert.deepEqual(f.pool.snapshot(), stable);
  const pending = f.repo.reviewRecordedSpeech(saved.id, { sha256: saved.sha256, expectedRevision: saved.revision, expectedIdentity, verdict: 'approved', actor: 'Reviewer' });
  expectedIdentity.exactText = 'Caller changed during SQL';
  saved = await pending;
  assert.deepEqual(saved.classification.recordedSpeech.source, source);
  assert.deepEqual(saved.mediaTiming, f.mediaTiming);
  assert.equal(saved.classification.recordedSpeech.review.by, 'Reviewer');
  assert.ok(recordedSpeechForVideo(saved, { dealerId: 'nora', lineId: 'goodluck', language: 'sv' }));
  const review = structuredClone(saved.classification.recordedSpeech.review);
  const relabeled = structuredClone(saved.classification); relabeled.label = 'Reviewed label';
  saved = await f.repo.classifyMedia(saved.id, { sha256: saved.sha256, expectedRevision: saved.revision, metadata: relabeled, actor: 'Editor' });
  assert.deepEqual(saved.classification.recordedSpeech.review, review, 'an exact review survives an ordinary label edit');
  saved = await f.save({ expectedRevision: saved.revision, actor: 'Second inspector' });
  assert.deepEqual(saved.classification.recordedSpeech.review, review, 'remeasurement preserves an existing exact review');
  assert.equal(saved.classification.recordedSpeech.source.by, 'Second inspector');
  source = structuredClone(saved.classification.recordedSpeech.source);
  for (const verdict of [null, 'rejected']) {
    saved = await f.repo.reviewRecordedSpeech(saved.id, { sha256: saved.sha256, expectedRevision: saved.revision, expectedIdentity: identity, verdict, actor: 'Reviewer' });
    assert.deepEqual(saved.mediaTiming, f.mediaTiming); assert.deepEqual(saved.classification.recordedSpeech.source, source);
    assert.equal(recordedSpeechForVideo(saved, { dealerId: 'nora', lineId: 'goodluck', language: 'sv' }), null);
  }
});

test('recorded speech review writes a valid identity-bound proof with CAS, audit and exact refusals', async () => {
  const f = await timingFixture({ speech: 'embedded' }), unmeasured = f.registered;
  const identity = recordedSpeechIdentity(unmeasured.classification.recordedSpeech);
  const review = (record, changes = {}) => f.repo.reviewRecordedSpeech(record.id, { sha256: record.sha256, expectedRevision: record.revision,
    expectedIdentity: identity, verdict: 'approved', actor: 'Jakob', ...changes });
  let before = f.pool.snapshot();
  await assert.rejects(review(unmeasured), rejection('studio_speech_source_unverified', 409));
  assert.deepEqual(f.pool.snapshot(), before);
  const saved = await f.save();
  before = f.pool.snapshot();
  await assert.rejects(review(saved, { expectedIdentity: { ...identity, takeId: 'take_2' } }), rejection('studio_speech_identity_changed', 409));
  await assert.rejects(review(saved, { expectedRevision: unmeasured.revision }), rejection('studio_conflict', 409));
  await assert.rejects(review(saved, { sha256: 'f'.repeat(64) }), rejection('studio_conflict', 409));
  await assert.rejects(review({ ...saved, id: '40000000-0000-4000-8000-000000000009' }), rejection('studio_media_missing', 404));
  for (const verdict of ['pending', 'maybe', undefined]) await assert.rejects(review(saved, { verdict }), rejection('studio_invalid_request', 400));
  assert.deepEqual(f.pool.snapshot(), before);
  f.pool.failNext('audit');
  await assert.rejects(review(saved));
  assert.deepEqual(f.pool.snapshot(), before, 'a failed audit rolls back the review');
  const approved = await review(saved), speech = approved.classification.recordedSpeech;
  assert.deepEqual(normalizeRecordedSpeech(speech, { dealerId: 'nora', lineId: 'goodluck', videoSha256: approved.sha256 }), speech);
  assert.deepEqual(speech.review, { status: 'approved', by: 'Jakob', at: speech.review.at, identity });
  assert.equal(new Date(speech.review.at).toISOString(), speech.review.at);
  assert.deepEqual({ ...approved, revision: saved.revision, updatedAt: saved.updatedAt,
    classification: { ...approved.classification, recordedSpeech: { ...speech, review: saved.classification.recordedSpeech.review } } }, saved);
  const audit = f.pool.snapshot().audits.at(-1);
  assert.deepEqual([audit.action, audit.subject, audit.revision, audit.actor], ['classify_media', approved.id, approved.revision, 'Jakob']);
  const idle = await timingFixture(), idleMeasured = await idle.save();
  await assert.rejects(idle.repo.reviewRecordedSpeech(idleMeasured.id, { sha256: idleMeasured.sha256, expectedRevision: idleMeasured.revision,
    expectedIdentity: identity, verdict: 'rejected', actor: 'Jakob' }), rejection('studio_speech_take_missing', 404));
});

test('embedded AV identity changes require pending source and discard the previous measurement', async () => {
  for (const [key, value] of Object.entries({ exactText: 'En annan replik.', takeId: 'take_2', language: 'en',
    fps: 25, frameCount: 73, videoTrackId: 3, audioTrackId: 3, entryPose: 'REDO', exitPose: 'REDO' })) {
    const f = await timingFixture({ speech: 'embedded' }), saved = await f.save(), before = f.pool.snapshot();
    const metadata = structuredClone(saved.classification), speech = metadata.recordedSpeech;
    speech[key] = value;
    speech.source = { ...speech.source, identity: recordedSpeechIdentity(speech) };
    await assert.rejects(f.repo.classifyMedia(saved.id, { sha256: saved.sha256, expectedRevision: saved.revision, metadata, actor: 'Editor' }), rejection('studio_invalid_media', 422));
    assert.deepEqual(f.pool.snapshot(), before);
    speech.source = { status: 'pending' }; speech.review = { status: 'pending' };
    const changed = await f.repo.classifyMedia(saved.id, { sha256: saved.sha256, expectedRevision: saved.revision, metadata, actor: 'Editor' });
    assert.equal(Object.hasOwn(changed, 'mediaTiming'), false, key);
    assert.deepEqual(changed.classification.recordedSpeech.source, { status: 'pending' });
    await assert.rejects(f.save({ expectedRevision: changed.revision }), rejection('studio_invalid_media', 422));
  }
});

test('embedded AV timing must identify exactly the declared video and single audio track', async () => {
  const f = await timingFixture({ speech: 'embedded' }), before = f.pool.snapshot();
  for (const change of [timing => { timing.video.trackId = 3; }, timing => { timing.audio[0].trackId = 3; },
    timing => { timing.audio = []; timing.endUs = timing.video.endUs; timing.audioTailUs = 0; },
    timing => { timing.audio.push({ ...timing.audio[0], trackId: 3 }); }]) {
    const mediaTiming = structuredClone(f.mediaTiming); change(mediaTiming);
    await assert.rejects(f.save({ mediaTiming }), rejection('studio_invalid_media', 422));
    assert.deepEqual(f.pool.snapshot(), before);
  }
});

test('embedded AV source, timing and audit share one CAS outcome and rollback', async () => {
  const f = await timingFixture({ speech: 'embedded' }), before = f.pool.snapshot();
  f.pool.failNext('audit');
  await assert.rejects(f.save(), rejection('studio_storage_unavailable', 503));
  assert.deepEqual(f.pool.snapshot(), before);
  assert.deepEqual((await f.repo.getMedia(f.record.id)).classification.recordedSpeech.source, { status: 'pending' });
  const outcomes = await Promise.allSettled([f.save(), f.save()]);
  const saved = outcomes.find(row => row.status === 'fulfilled').value;
  assert.equal(saved.classification.recordedSpeech.source.status, 'verified-embedded-av');
  assert.equal(outcomes.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(row => row.status === 'rejected' && rejection('studio_conflict')(row.reason)).length, 1);
  assert.equal(f.pool.snapshot().audits.length, before.audits.length + 1);
  assert.equal(f.pool.connects, f.pool.releases);
});

test('server timing writer preserves the exact record and audits one scoped CAS revision', async () => {
  const f = await timingFixture({ speech: true }), offset = f.pool.calls.length;
  const expected = structuredClone(f.mediaTiming), pending = f.save();
  f.mediaTiming.audio[0].endUs = 9; // Async SQL must not observe later caller mutation.
  const saved = await pending;
  assert.notEqual(saved.revision, f.registered.revision);
  assert.deepEqual(saved.mediaTiming, expected);
  assert.deepEqual(saved.classification, f.registered.classification);
  const { revision, updatedAt, mediaTiming, ...unchanged } = saved;
  const { revision: oldRevision, updatedAt: oldAt, ...original } = f.registered;
  assert.deepEqual(unchanged, original);
  assert.deepEqual(await f.repo.getMedia(f.record.id), saved);
  const calls = f.pool.calls.slice(offset, f.pool.calls.findIndex((call, index) => index >= offset && call.sql === 'COMMIT') + 1);
  assert.equal(new Set(calls.map(call => call.client)).size, 1);
  assert.ok(calls.findIndex(call => call.sql.includes('pg_advisory_xact_lock')) < calls.findIndex(call => call.marker === 'read-media'));
  for (const call of calls.filter(call => ['read-media', 'read-document', 'save-media-timing', 'audit'].includes(call.marker))) {
    assert.deepEqual(call.values.slice(0, 2), [scope.environment, scope.workspaceId]);
  }
  const audit = f.pool.snapshot().audits.at(-1);
  assert.equal(audit.action, 'classify_media'); assert.equal(audit.subject, saved.id);
  assert.equal(audit.revision, saved.revision); assert.equal(audit.actor, 'Inspector');
  assert.equal(recordedSpeechForVideo(saved, { dealerId: 'nora', lineId: 'goodluck', language: 'sv' }), null);
});

test('timing rejects forged byte and speech bindings, bad input and registration bypass without writes', async () => {
  const f = await timingFixture({ speech: true }), before = f.pool.snapshot();
  for (const change of [
    value => { value.mediaId = '50000000-0000-4000-8000-000000000001'; },
    value => { value.sha256 = 'd'.repeat(64); }, value => { value.size++; },
    value => { value.recordedSpeechIdentitySha256 = 'd'.repeat(64); }, value => { value.recordedSpeechIdentitySha256 = null; },
    value => { value.video.fps = 25; }, value => { value.video.frameCount++; },
    value => { value.approved = true; },
  ]) {
    const value = structuredClone(f.mediaTiming); change(value);
    await assert.rejects(f.save({ mediaTiming: value }), rejection('studio_invalid_media', 422));
    assert.deepEqual(f.pool.snapshot(), before);
  }
  for (const changes of [{ mediaTiming: null }, { sha256: 'not-a-hash' }, { actor: '' }, { expectedRevision: '' }]) {
    await assert.rejects(f.save(changes)); assert.deepEqual(f.pool.snapshot(), before);
  }
  await assert.rejects(f.save({ sha256: 'd'.repeat(64), mediaTiming: { ...f.mediaTiming, sha256: 'd'.repeat(64) } }), rejection('studio_conflict'));
  await assert.rejects(f.repo.saveMediaTiming('invalid', { sha256: f.record.sha256, expectedRevision: f.registered.revision, actor: 'Inspector', mediaTiming: f.mediaTiming }), rejection('studio_invalid_media'));
  const connections = f.pool.connects;
  await assert.rejects(f.repo.registerMedia({ ...f.record, mediaTiming: f.mediaTiming }, { actor: 'Uploader' }), rejection('studio_invalid_media'));
  assert.equal(f.pool.connects, connections); assert.deepEqual(f.pool.snapshot(), before);
});

test('timing CAS has one concurrent winner and update/audit failure rolls back the complete write', async () => {
  const f = await timingFixture(), before = f.pool.snapshot();
  f.pool.failNext('audit');
  await assert.rejects(f.save(), rejection('studio_storage_unavailable', 503));
  assert.deepEqual(f.pool.snapshot(), before);
  f.pool.failNext('save-media-timing');
  await assert.rejects(f.save(), rejection('studio_storage_unavailable', 503));
  assert.deepEqual(f.pool.snapshot(), before);
  const outcomes = await Promise.allSettled([f.save(), f.save()]);
  assert.equal(outcomes.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(row => row.status === 'rejected' && rejection('studio_conflict')(row.reason)).length, 1);
  assert.equal(f.pool.snapshot().audits.length, before.audits.length + 1);
  assert.equal(f.pool.connects, f.pool.releases);
});

test('timing requires current active ownership and cannot cross scope, trash, retained or deletion fences', async () => {
  const missingProject = await timingFixture({ project: false });
  await assert.rejects(missingProject.save(), rejection('studio_dealer_inactive'));
  const f = await timingFixture(), other = createStudioRepository({ pool: f.pool, scope: { ...scope, workspaceId: 'other' } });
  await assert.rejects(other.saveMediaTiming(f.record.id, { sha256: f.record.sha256, expectedRevision: f.registered.revision, actor: 'Inspector', mediaTiming: f.mediaTiming }), rejection('studio_media_missing', 404));
  const project = await f.repo.readDocument('project');
  await f.repo.saveDealerLifecycle(createEmptyProject(), { expectedRevision: project.revision, actor: 'Admin' });
  await assert.rejects(f.save(), rejection('studio_dealer_inactive'));
  const trashed = await timingFixture(), beforeTrash = await trashed.repo.readDocument('project');
  await trashed.repo.saveDealerLifecycle(lifecycleProject(beforeTrash.value, { dealerId: 'nora', archived: true, records: [trashed.registered] }),
    { expectedRevision: beforeTrash.revision, actor: 'Admin' });
  await assert.rejects(trashed.save(), rejection('studio_dealer_archived'));
  const archived = await timingFixture({ archived: true });
  await assert.rejects(archived.save(), rejection('studio_media_archived'));
  const deleted = await archived.repo.setMediaDeletion(archived.record.id, { expectedRevision: archived.registered.revision, sha256: archived.record.sha256,
    deletion: { state: 'pending', requestedAt: '2026-10-26T00:00:00.000Z' }, actor: 'Admin' });
  await assert.rejects(archived.save({ expectedRevision: deleted.revision }), rejection('studio_media_deletion_pending'));
  const retained = createRetainedStudioMedia(RETAINED_BANK_VARIANTS[0].id), repo = repository(createStudioMemoryPool());
  const saved = (await repo.registerMedia(retained, { actor: 'explicit-retention-import' })).media;
  await assert.rejects(repo.saveMediaTiming(saved.id, { sha256: saved.sha256, expectedRevision: saved.revision, actor: 'Inspector',
    mediaTiming: { ...f.mediaTiming, mediaId: saved.id, sha256: saved.sha256, size: saved.size } }), rejection('studio_retained_media_immutable', 410));
});

test('classification keeps timing for the same speech identity while review still controls runtime permission', async () => {
  const f = await timingFixture({ speech: true }); let saved = await f.save();
  const metadata = structuredClone(saved.classification), identity = recordedSpeechIdentity(metadata.recordedSpeech);
  metadata.label = 'New visible label'; metadata.notes = 'Updated note';
  metadata.recordedSpeech.recording = { status: 'verified-recording', by: 'Recorder', at: '2026-10-26T00:00:00.000Z', identity };
  metadata.recordedSpeech.review = { status: 'approved', by: 'Reviewer', at: '2026-10-26T00:00:01.000Z', identity };
  saved = await f.repo.classifyMedia(saved.id, { sha256: saved.sha256, expectedRevision: saved.revision, metadata, actor: 'Reviewer' });
  assert.deepEqual(saved.mediaTiming, f.mediaTiming);
  assert.ok(recordedSpeechForVideo(saved, { dealerId: 'nora', lineId: 'goodluck', language: 'sv' }));
  for (const review of [{ status: 'pending' }, { status: 'rejected', by: 'Reviewer', at: '2026-10-26T00:00:02.000Z', identity }]) {
    metadata.recordedSpeech.review = review;
    saved = await f.repo.classifyMedia(saved.id, { sha256: saved.sha256, expectedRevision: saved.revision, metadata, actor: 'Reviewer' });
    assert.deepEqual(saved.mediaTiming, f.mediaTiming);
    assert.equal(recordedSpeechForVideo(saved, { dealerId: 'nora', lineId: 'goodluck', language: 'sv' }), null);
  }
});

test('classification invalidates timing on changed, removed or newly added speech identity', async () => {
  for (const [key, value] of Object.entries({ exactText: 'En annan replik.', takeId: 'take_2', language: 'en', audioSha256: 'd'.repeat(64),
    indexSha256: 'e'.repeat(64), fps: 25, frameCount: 73, audioDelayMs: 1, entryPose: 'REDO', exitPose: 'REDO', calibrationRevision: 'fixture-2' })) {
    const f = await timingFixture({ speech: true }), saved = await f.save(), metadata = structuredClone(saved.classification);
    metadata.recordedSpeech[key] = value;
    const changed = await f.repo.classifyMedia(saved.id, { sha256: saved.sha256, expectedRevision: saved.revision, metadata, actor: 'Editor' });
    assert.equal(Object.hasOwn(changed, 'mediaTiming'), false, key);
    assert.equal(changed.classification.recordedSpeech[key], value);
    await assert.rejects(f.save({ expectedRevision: changed.revision }), rejection('studio_invalid_media'));
  }
  const speech = await timingFixture({ speech: true }), measured = await speech.save(), metadata = structuredClone(measured.classification);
  delete metadata.recordedSpeech;
  const removed = await speech.repo.classifyMedia(measured.id, { sha256: measured.sha256, expectedRevision: measured.revision, metadata, actor: 'Editor' });
  assert.equal(Object.hasOwn(removed, 'mediaTiming'), false);
  const plain = await timingFixture(), measuredPlain = await plain.save();
  const added = await plain.repo.classifyMedia(measuredPlain.id, { sha256: measuredPlain.sha256, expectedRevision: measuredPlain.revision,
    metadata: speech.record.classification, actor: 'Editor' });
  assert.equal(Object.hasOwn(added, 'mediaTiming'), false);
});

test('Studio factory is inert; missing cloud rows stay missing and SQL scope is bound', async () => {
  const pool = createStudioMemoryPool(), mutable = { ...scope }, repo = createStudioRepository({ pool, scope: mutable });
  mutable.workspaceId = 'another-workspace';
  assert.equal(pool.connects, 0); assert.ok(Object.isFrozen(repo.scope));
  assert.equal(await repo.readDocument('project'), null);
  assert.equal(await repo.readDocument('administration'), null);
  assert.equal(pool.snapshot().documents.size, 0); assert.equal(pool.snapshot().audits.length, 0);
  const reads = pool.calls.filter(call => call.marker === 'read-document');
  assert.deepEqual(reads.map(call => call.values.slice(0, 2)), [[scope.environment, scope.workspaceId], [scope.environment, scope.workspaceId]]);
  assert.ok(reads.every(call => !call.sql.includes(scope.workspaceId)));
  assert.equal(pool.connects, pool.releases);
});

test('Studio save is CAS plus previous revision history and audit in the same transaction', async () => {
  const pool = createStudioMemoryPool(), repo = repository(pool), initial = await initialize(repo);
  assert.equal(initial.revision, 'initial');
  const saved = await repo.saveDocument('administration', { value: { rooms: ['new'] }, expectedRevision: initial.revision, actor: 'tester' });
  assert.notEqual(saved.revision, initial.revision);
  assert.deepEqual((await repo.readDocument('administration')).value, { rooms: ['new'] });
  const history = await repo.listDocumentHistory('administration');
  assert.equal(history.length, 1); assert.equal(history[0].revision, initial.revision);
  assert.equal(history[0].updatedAt, initial.updatedAt); assert.equal(history[0].replacedBy, saved.revision);
  const changes = pool.calls.filter(call => ['history', 'save-document', 'audit'].includes(call.marker)).slice(-3);
  assert.equal(new Set(changes.map(call => call.client)).size, 1);
  assert.deepEqual(pool.snapshot().audits.map(row => row.action), ['initialize_document', 'save_document']);
  await assert.rejects(repo.saveDocument('administration', { value: {}, expectedRevision: initial.revision, actor: 'tester' }), rejection('studio_conflict', 409));
  assert.equal(pool.snapshot().history.length, 1); assert.equal(pool.snapshot().audits.length, 2);
});

test('concurrent writers of the same revision have exactly one winner', async () => {
  const pool = createStudioMemoryPool(), first = repository(pool), second = repository(pool), initial = await initialize(first);
  const outcomes = await Promise.allSettled([first, second].map((repo, index) => repo.saveDocument('administration', {
    value: { rooms: [index] }, expectedRevision: initial.revision, actor: 'tester',
  })));
  assert.equal(outcomes.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(row => row.status === 'rejected' && rejection('studio_conflict')(row.reason)).length, 1);
  assert.equal(pool.snapshot().history.length, 1); assert.equal(pool.snapshot().audits.length, 2);
  assert.equal(pool.connects, pool.releases);
});

test('audit failure rolls back document and history, exposing only a fixed safe error', async () => {
  const pool = createStudioMemoryPool(), repo = repository(pool), initial = await initialize(repo);
  const before = pool.snapshot();
  pool.failNext('audit', new Error('postgres://secret:password@live.example/database provider private path'));
  await assert.rejects(repo.saveDocument('administration', { value: {}, expectedRevision: initial.revision, actor: 'tester' }), error => {
    assert.equal(error.message, 'studio_storage_unavailable'); assert.equal(error.statusCode, 503); assert.equal(error.cause, undefined); return true;
  });
  assert.deepEqual(pool.snapshot(), before); assert.equal(pool.connects, pool.releases);
});

test('nested operations reuse one client; a caught inner conflict poisons and rolls back the outer unit', async () => {
  const pool = createStudioMemoryPool(), repo = repository(pool), initial = await initialize(repo), before = pool.snapshot(), connections = pool.connects;
  await assert.rejects(repo.transaction(async nested => {
    await nested.saveDocument('administration', { value: { rooms: ['intermediate'] }, expectedRevision: initial.revision, actor: 'tester' });
    await assert.rejects(nested.transaction(() => nested.saveDocument('administration', { value: {}, expectedRevision: initial.revision, actor: 'tester' })), rejection('studio_conflict'));
    return 'caller incorrectly swallowed conflict';
  }), rejection('studio_conflict'));
  assert.equal(pool.connects - connections, 1); assert.deepEqual(pool.snapshot(), before);
});

test('nested cross-scope work cannot invert locks; caught errors still poison the original transaction', async () => {
  const pool = createStudioMemoryPool(), repo = repository(pool), other = createStudioRepository({ pool, scope: { environment: 'test', workspaceId: 'workspace-2' } });
  await assert.rejects(repo.transaction(async () => {
    await repo.initializeDocument('administration', { value: {}, actor: 'tester' });
    await assert.rejects(other.readDocument('administration'), rejection('studio_scope_mismatch'));
  }), rejection('studio_scope_mismatch'));
  assert.equal(pool.snapshot().documents.size, 0);
  await initialize(repo); assert.equal(await other.readDocument('administration'), null);
});

test('COMMIT returning ROLLBACK and connect/driver failures are not reported as successful persistence', async () => {
  const pool = createStudioMemoryPool(), repo = repository(pool);
  pool.commitRollback = true;
  await assert.rejects(initialize(repo), rejection('studio_transaction_rolled_back', 503));
  assert.equal(pool.snapshot().documents.size, 0);
  const unavailable = createStudioRepository({ pool: { connect: async () => { throw new Error('secret dsn'); } }, scope });
  await assert.rejects(unavailable.readDocument('project'), rejection('studio_storage_unavailable', 503));
  assert.equal(studioStorageFailure({ code: '23505', message: 'private detail' }).code, 'studio_conflict');
  assert.equal(new StudioStorageError('not a code: secret').message, 'studio_storage_unavailable');
});

test('detached asynchronous work cannot reuse a released transaction client', async () => {
  const pool = createStudioMemoryPool(), repo = repository(pool); let pending;
  await repo.transaction(() => { pending = nextTurn().then(() => repo.readDocument('project')).catch(error => error); });
  const error = await pending;
  assert.ok(rejection('studio_invalid_transaction', 503)(error));
  assert.equal(pool.connects, 1); assert.equal(pool.releases, 1);
});

test('invalid JSON, scope, actor, domain or forged document kinds cause no database I/O', async () => {
  const pool = createStudioMemoryPool(), repo = repository(pool);
  const sparse = new Array(2); sparse[0] = 1; sparse.extra = 2;
  const cycle = {}; cycle.self = cycle;
  const getter = {}; Object.defineProperty(getter, 'value', { enumerable: true, get() { throw new Error('must not invoke'); } });
  const hidden = {}; Object.defineProperty(hidden, 'secret', { value: 1 });
  for (const value of [sparse, cycle, getter, hidden, new Date(), { n: Infinity }, { x: undefined }, { x: '\0' }, { x: '\ud800' }, JSON.parse('{"__proto__":{}}')]) {
    assert.throws(() => cloneStudioJson(value), rejection('studio_invalid_data', 422));
  }
  assert.throws(() => validateStudioScope({ environment: 'test', workspaceId: 'w', playerId: 'untrusted' }), rejection('studio_invalid_scope', 422));
  await assert.rejects(repo.readDocument('credentials'), rejection('studio_invalid_document_kind', 422));
  await assert.rejects(repo.initializeDocument('administration', { value: { token: 'private' }, actor: 'tester' }), rejection('studio_invalid_document', 422));
  await assert.rejects(repo.initializeDocument('administration', { value: {}, actor: 'bad\nactor' }), rejection('studio_invalid_actor', 422));
  await assert.rejects(repo.initializeDocument('project', { value: {}, actor: 'tester' }), rejection('studio_invalid_document', 422));
  assert.equal(pool.connects, 0);
});

test('project saves use the existing policy validator and reject corrupted persisted revisions', async () => {
  const pool = createStudioMemoryPool(), repo = repository(pool);
  const project = await repo.initializeDocument('project', { value: createSeedProject(), actor: 'tester' });
  assert.equal(project.value.revision, project.revision);
  pool.corruptDocument(scope, 'project', row => ({ ...row, revision: 'different' }));
  await assert.rejects(repo.readDocument('project'), rejection('studio_corrupt_document', 503));
});

test('current-document snapshot import preserves revisions/times/hash, is exact-replay-safe, and never overwrites', async () => {
  const source = repository(createStudioMemoryPool()); await initialize(source);
  const snapshot = await source.exportSnapshot(), pool = createStudioMemoryPool(), target = repository(pool);
  assert.deepEqual(await target.importSnapshot(snapshot, { actor: 'tester', expectedTargetEmpty: true }), { imported: 1, replayed: false });
  assert.deepEqual(await target.exportSnapshot(), snapshot);
  assert.deepEqual(await target.importSnapshot(snapshot, { actor: 'tester', expectedTargetEmpty: true }), { imported: 0, replayed: true });
  assert.equal(pool.snapshot().audits.length, 1);
  const edited = structuredClone(snapshot); edited.documents[0].revision = 'changed';
  await assert.rejects(target.importSnapshot(edited, { actor: 'tester', expectedTargetEmpty: true }), rejection('studio_import_target_conflict'));
  await assert.rejects(target.importSnapshot(snapshot, { actor: 'tester' }), rejection('studio_import_requires_empty_target'));
  assert.deepEqual(await target.exportSnapshot(), snapshot);
});

test('snapshots reject scope/hash/date tampering and a later insert failure rolls back the whole import', async () => {
  const source = repository(createStudioMemoryPool()); await initialize(source);
  await source.initializeDocument('project', { value: createSeedProject(), actor: 'tester' });
  const snapshot = await source.exportSnapshot(), pool = createStudioMemoryPool(), target = repository(pool);
  for (const change of [copy => { copy.scope.workspaceId = 'other'; }, copy => { copy.documents[0].checksum = '0'.repeat(64); },
    copy => { copy.documents[0].updatedAt = '2024-01-01'; }]) {
    const copy = structuredClone(snapshot); change(copy);
    await assert.rejects(target.importSnapshot(copy, { actor: 'tester', expectedTargetEmpty: true }), error => error instanceof StudioStorageError && error.statusCode === 422);
  }
  assert.equal(pool.connects, 0);
  pool.failNext('audit', undefined, 1); // First imported document is written before the second audit fails.
  await assert.rejects(target.importSnapshot(snapshot, { actor: 'tester', expectedTargetEmpty: true }), rejection('studio_storage_unavailable'));
  assert.equal(pool.calls.filter(call => call.marker === 'insert-document').length, 2);
  assert.equal(pool.snapshot().documents.size, 0); assert.equal(pool.snapshot().audits.length, 0);
});

test('the bounded snapshot envelope accepts multiple individually bounded documents', async () => {
  const source = repository(createStudioMemoryPool()), large = 'x'.repeat(STUDIO_JSON_LIMIT - 2048);
  await source.initializeDocument('administration', { value: { rooms: [large] }, actor: 'tester' });
  await source.initializeDocument('project', { value: createSeedProject(), actor: 'tester' });
  const snapshot = await source.exportSnapshot();
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) > STUDIO_JSON_LIMIT);
  const target = repository(createStudioMemoryPool());
  assert.equal((await target.importSnapshot(snapshot, { actor: 'tester', expectedTargetEmpty: true })).imported, 2);
});

test('snapshot envelopes preserve the deepest allowed document without loosening the per-document bound', async () => {
  const source = repository(createStudioMemoryPool());
  const value = { rooms: {} }; let nested = value.rooms;
  for (let depth = 1; depth < 24; depth++) { nested.next = {}; nested = nested.next; }
  await source.initializeDocument('administration', { value, actor: 'tester' });
  const target = repository(createStudioMemoryPool()), snapshot = await source.exportSnapshot();
  assert.equal((await target.importSnapshot(snapshot, { actor: 'tester', expectedTargetEmpty: true })).imported, 1);
  nested.next = { tooDeep: true };
  await assert.rejects(source.initializeDocument('administration', { value, actor: 'tester' }), rejection('studio_invalid_data', 422));
});

test('social policy uses its exact existing validator and has a separate revision/history stream', async () => {
  const pool = createStudioMemoryPool(), repo = repository(pool);
  const policy = { schemaVersion: 1, revision: 'ignored-input-revision', cooldownMs: 1000,
    trigger: { id: 'social.ledsen', label: 'Supportive', enabled: true, directive: 'Be supportive.', threshold: 0.5 },
    response: { mode: 'fixed', fixedText: 'Hello.' } };
  const initial = await repo.initializeDocument('social-policy', { value: policy, actor: 'tester' });
  assert.equal(initial.value.revision, initial.revision);
  assert.ok(initial.revision.startsWith('social-'));
  const saved = await repo.saveDocument('social-policy', { value: { ...policy, cooldownMs: 2000 }, expectedRevision: initial.revision, actor: 'tester' });
  assert.notEqual(saved.revision, initial.revision);
  assert.equal((await repo.listDocumentHistory('social-policy')).length, 1);
  assert.equal((await repo.listDocumentHistory('project')).length, 0);
  await assert.rejects(repo.saveDocument('social-policy', { value: { ...policy, gatewayKey: 'must not persist' }, expectedRevision: saved.revision, actor: 'tester' }), rejection('studio_invalid_document', 422));
});

test('new-upload registration is idempotent, classification is CAS, and reference lookup is explicitly incomplete', async () => {
  const pool = createStudioMemoryPool(), repo = repository(pool), id = '00000000-0000-4000-8000-000000000001', sha256 = 'a'.repeat(64);
  const record = { id, sha256, size: 100, contentType: 'video/mp4', pathname: `croupier/media/dealers/astrid/review/uploads/${id}/${sha256}.mp4`,
    classification: { dealerId: 'astrid', eventId: 'speak.goodluck', kind: 'speech', role: 'alternative', situation: 'goodluck', label: 'New', notes: '', playback: 'once' } };
  const first = await repo.registerMedia(record, { actor: 'tester' }); assert.equal(first.duplicate, false);
  assert.deepEqual(await repo.registerMedia(record, { actor: 'tester' }), { media: first.media, duplicate: true });
  await assert.rejects(repo.registerMedia({ ...record, size: 101 }, { actor: 'tester' }), rejection('studio_conflict'));
  const updated = await repo.classifyMedia(id, { sha256, expectedRevision: first.media.revision, metadata: { ...record.classification, label: 'Renamed' }, actor: 'tester' });
  assert.equal(updated.classification.label, 'Renamed');
  await assert.rejects(repo.classifyMedia(id, { sha256, expectedRevision: first.media.revision, metadata: record.classification, actor: 'tester' }), rejection('studio_conflict'));
  await repo.initializeDocument('administration', { value: { voiceReview: { selected: id } }, actor: 'tester' });
  const references = await repo.findMediaReferences(id); assert.equal(references.references.length, 1); assert.equal(references.complete, false);
  assert.deepEqual(references.checked, ['documents', 'document_history']);
  assert.equal(typeof repo.deleteMedia, 'undefined');
});

test('a stale upload or classification cannot restore media ownership to an unregistered dealer', async () => {
  const repo = repository(createStudioMemoryPool());
  const id = '00000000-0000-4000-8000-000000000099', sha256 = 'a'.repeat(64);
  const record = { id, sha256, size: 100, contentType: 'video/mp4', pathname: `croupier/media/dealers/astrid/review/uploads/${id}/${sha256}.mp4`,
    classification: { dealerId: 'astrid', eventId: 'speak.goodluck', kind: 'speech', role: 'alternative', situation: 'goodluck', label: 'New', notes: '', playback: 'once' } };
  const registered = await repo.registerMedia(record, { actor: 'tester' });
  await repo.initializeDocument('project', { value: createEmptyProject(), actor: 'tester' });
  await assert.rejects(repo.registerMedia(record, { actor: 'tester' }), rejection('studio_dealer_inactive'));
  await assert.rejects(repo.classifyMedia(id, { sha256, expectedRevision: registered.media.revision, metadata: record.classification, actor: 'tester' }), rejection('studio_dealer_inactive'));
    await assert.rejects(repo.classifyMedia(id, { sha256, expectedRevision: registered.media.revision, metadata: { ...record.classification, archived: true }, actor: 'tester' }), rejection('studio_dealer_inactive'));
  assert.deepEqual(await repo.getMedia(id), registered.media);
});

test('native media listing is scope-bound, complete, validated and never seeds or silently truncates', async () => {
  const pool = createStudioMemoryPool(), repo = repository(pool);
  const other = createStudioRepository({ pool, scope: { ...scope, workspaceId: 'other' } });
  assert.deepEqual(await repo.listMedia({ limit: 5000 }), []);
  const record = (id, dealerId = 'astrid') => ({ id, sha256: 'a'.repeat(64), size: 100, contentType: 'video/mp4',
    pathname: `croupier/media/dealers/${dealerId}/review/uploads/${id}/${'a'.repeat(64)}.mp4`,
    classification: { dealerId, eventId: 'speak.goodluck', kind: 'speech', role: 'alternative', situation: 'goodluck', label: 'New', notes: '', playback: 'once' } });
  const first = await repo.registerMedia(record('00000000-0000-4000-8000-000000000001'), { actor: 'tester' });
  const second = await repo.registerMedia(record('00000000-0000-4000-8000-000000000002'), { actor: 'tester' });
  await other.registerMedia(record('00000000-0000-4000-8000-000000000003', 'vera'), { actor: 'tester' });
  assert.deepEqual(await repo.listMedia({ limit: 2 }), [first.media, second.media]);
  await assert.rejects(repo.listMedia({ limit: 1 }), rejection('studio_media_limit_exceeded', 503));
  const before = pool.connects;
  for (const limit of [0, -1, 5001, 1.1, '100']) await assert.rejects(repo.listMedia({ limit }), rejection('studio_invalid_data', 422));
  assert.equal(pool.connects, before);
  const calls = pool.calls.filter(call => call.marker === 'list-media');
  assert.ok(calls.every(call => call.values[0] === scope.environment && call.values[1] === scope.workspaceId));
  assert.equal(pool.snapshot().audits.length, 3); // Listing never initializes or rewrites anything.
  const connect = pool.connect.bind(pool);
  pool.connect = async () => {
    const client = await connect(), query = client.query.bind(client);
    client.query = async (sql, values) => {
      const result = await query(sql, values);
      if (sql.includes('studio:list-media')) result.rows[0].record.pathname = 'untrusted/different-object.mp4';
      return result;
    };
    return client;
  };
  await assert.rejects(repo.listMedia(), rejection('studio_corrupt_media', 503));
});


test('a shared SQL facade is writable only in its live same-scope transaction and cannot escape or hide failure', async () => {
  const pool = createStudioMemoryPool(), repo = repository(pool), other = createStudioRepository({ pool, scope: { ...scope, workspaceId: 'other' } });
  await initialize(repo);
  await assert.rejects(repo.withTransactionClient(() => {}), rejection('studio_invalid_transaction', 503));
  let escaped;
  await repo.transaction(async () => {
    await repo.withTransactionClient(async client => {
      escaped = client;
      const result = await client.query('/* studio:read-document */ SELECT kind,revision,value,updated_at FROM croupier_studio.documents WHERE environment_id=$1 AND workspace_id=$2 AND kind=$3', [scope.environment, scope.workspaceId, 'administration']);
      assert.equal(result.rows[0].revision, 'initial');
    });
  });
  await assert.rejects(escaped.query('SELECT 1'), rejection('studio_invalid_transaction', 503));
  await assert.rejects(repo.transaction(() => repo.withTransactionClient(() => {}), { readOnly: true }), rejection('studio_invalid_transaction', 503));
  await assert.rejects(repo.transaction(() => other.withTransactionClient(() => {})), rejection('studio_invalid_transaction', 503));
  const before = pool.snapshot();
  await assert.rejects(repo.transaction(async () => {
    const saved = await repo.readDocument('administration');
    await repo.saveDocument('administration', { value: { rooms: [{ id: 'changed' }] }, expectedRevision: saved.revision, actor: 'tester' });
    try { await repo.withTransactionClient(async () => { throw new StudioStorageError('studio_conflict', 409); }); } catch {}
  }), rejection('studio_conflict', 409));
  assert.deepEqual(pool.snapshot(), before);
});


test('shared SQL cannot replace either bound scope parameter and caught rejection rolls back', async () => {
  const pool = createStudioMemoryPool(), repo = repository(pool);
  await initialize(repo);
  const otherScope = { ...scope, workspaceId: 'workspace-south' };
  await createStudioRepository({ pool, scope: otherScope }).initializeDocument('administration', { value: { rooms: ['private-south'] }, actor: 'tester', revision: 'south' });
  const before = pool.snapshot();
  for (const parameters of [[scope.environment, otherScope.workspaceId, 'administration'], ['foreign-env', scope.workspaceId, 'administration']]) {
    await assert.rejects(repo.transaction(async () => {
      const saved = await repo.readDocument('administration');
      await repo.saveDocument('administration', { value: { rooms: ['should-rollback'] }, expectedRevision: saved.revision, actor: 'tester' });
      try {
        await repo.withTransactionClient(client => client.query('/* studio:read-document */ SELECT kind,revision,value,updated_at FROM croupier_studio.documents WHERE environment_id=$1 AND workspace_id=$2 AND kind=$3', parameters));
        assert.fail('cross-scope query was accepted');
      } catch (error) { assert.equal(error.code, 'studio_scope_mismatch'); }
    }), rejection('studio_scope_mismatch', 409));
    assert.deepEqual(pool.snapshot(), before);
  }
});

test('caught publisher input validation on a shared client rolls back earlier document/history/audit', async () => {
  const pool = createStudioMemoryPool(), repo = repository(pool);
  await initialize(repo); const before = pool.snapshot();
  await assert.rejects(repo.transaction(async () => {
    const saved = await repo.readDocument('administration');
    await repo.saveDocument('administration', { value: { rooms: ['changed'] }, expectedRevision: saved.revision, actor: 'tester' });
    await repo.withTransactionClient(async client => {
      const operators = await createOperatorStore({ sql: client, scope, transaction: work => repo.withTransactionClient(work) });
      try {
        await operators.publishPackage({ actor: 'tester', operatorId: 'north', lanes: ['mobile-phone', 'mobile-phone'], games: ['blackjack'], tables: [], branding: {} });
        assert.fail('invalid duplicate lanes were accepted');
      } catch (error) { assert.equal(error.code, 'studio_invalid_data'); }
    });
  }), rejection('studio_invalid_data', 422));
  assert.deepEqual(pool.snapshot(), before);
});

test('presentation snapshot reads project, administration and full media on one read-only MVCC client', async()=>{
  const pool=createStudioMemoryPool(),repo=repository(pool);
  pool.seedRuntimeCatalog(scope,readRuntimeCatalogFixture());
  const project=createSeedProject();
  await repo.initializeDocument('project',{value:project,revision:project.revision,actor:'tester'});
  await initialize(repo);
  const media={id:'10000000-0000-4000-8000-000000000001',sha256:'a'.repeat(64),size:4096,contentType:'video/mp4',
    pathname:'croupier/media/dealers/astrid/review/uploads/10000000-0000-4000-8000-000000000001/'+ 'a'.repeat(64)+'.mp4',
    classification:{dealerId:'astrid',eventId:'idle.ready',kind:'idle',role:'standard',situation:'',label:'Exact',notes:''}};
  await repo.registerMedia(media,{actor:'tester'});
  const before=pool.snapshot(),offset=pool.calls.length,captured=await repo.readPresentationSnapshot();
  assert.deepEqual(captured.scope,scope);assert.equal(captured.projectDocument.revision,project.revision);
  assert.equal(captured.administrationDocument.revision,'initial');assert.equal(captured.mediaRows[0].id,media.id);
  assert.equal(Object.isFrozen(captured.mediaRows[0].classification),true);
  assert.equal(Object.isFrozen(captured.runtimeCatalog.value.layout.files),true);
  assert.deepEqual(pool.snapshot(),before,'snapshot does not write or audit');
  const reads=pool.calls.slice(offset);
  assert.equal(new Set(reads.map(row=>row.client)).size,1);
  assert.match(reads[0].sql,/BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.equal(reads.some(row=>row.sql.includes('pg_advisory')),false);
  assert.deepEqual(reads.filter(row=>['read-document','list-media'].includes(row.marker)).map(row=>row.values.slice(0,2)),[scope,scope,scope].map(s=>[s.environment,s.workspaceId]));
});
test('presentation snapshot reuses an active write client and rejects cross-scope nesting',async()=>{
  const pool=createStudioMemoryPool(),repo=repository(pool),project=createSeedProject();
  pool.seedRuntimeCatalog(scope,readRuntimeCatalogFixture());
  await repo.initializeDocument('project',{value:project,revision:project.revision,actor:'tester'});await initialize(repo);
  const count=pool.connects;
  await repo.transaction(async bound=>{
    await bound.saveDocument('administration',{value:{rooms:['uncommitted']},expectedRevision:'initial',actor:'tester'});
    const snapshot=await bound.readPresentationSnapshot();assert.deepEqual(snapshot.administrationDocument.value.rooms,['uncommitted']);
  });
  assert.equal(pool.connects,count+1);
  const other=createStudioRepository({pool,scope:{...scope,workspaceId:'other'}});
  await assert.rejects(repo.transaction(()=>other.readPresentationSnapshot()),rejection('studio_scope_mismatch',409));
});
test('presentation snapshot does not mix a later document version into an earlier read-only snapshot',async()=>{
  const original=createStudioMemoryPool(),project=createSeedProject();let changed=false;
  original.seedRuntimeCatalog(scope,readRuntimeCatalogFixture());
  const pool={connect:async()=>{
    const client=await original.connect();return {release:()=>client.release(),query:async(sql,values)=>{
      const result=await client.query(sql,values);
      if(sql.includes('studio:read-document')&&values[2]==='project'&&!changed){
        changed=true;original.corruptDocument(scope,'administration',row=>({...row,revision:'later',value:{rooms:['later']}}));
      }
      return result;
    }};
  }};
  const repo=repository(pool);
  await repo.initializeDocument('project',{value:project,revision:project.revision,actor:'tester'});await initialize(repo);
  const snapshot=await repo.readPresentationSnapshot();
  assert.equal(snapshot.administrationDocument.revision,'initial');assert.deepEqual(snapshot.administrationDocument.value.rooms,[]);
  assert.equal((await repo.readDocument('administration')).revision,'later');
});
test('missing or unreadable capture documents/media fail closed without partial snapshots',async()=>{
  const pool=createStudioMemoryPool(),repo=repository(pool);
  await assert.rejects(repo.readPresentationSnapshot(),rejection('studio_document_missing',503));
  const project=createSeedProject();await repo.initializeDocument('project',{value:project,revision:project.revision,actor:'tester'});await initialize(repo);
  pool.failNext('list-media');await assert.rejects(repo.readPresentationSnapshot(),rejection('studio_storage_unavailable',503));
  await assert.rejects(repo.readPresentationSnapshot(),rejection('studio_runtime_catalog_missing',503));
  assert.equal(pool.connects,pool.releases);
});

for (const dealerId of ['vera','mei','amira','johanna']) test(`project PUT cannot add retired ${dealerId} and leaves its saved historical profile intact`,async()=>{
  const pool=createStudioMemoryPool(),repo=repository(pool),empty=createEmptyProject();
  const historical=historicalDealerProject(dealerId);
  const initial=await repo.initializeDocument('project',{value:empty,actor:'tester',revision:'empty'});
  const next=structuredClone(historical);
  assert.equal(next.dealers.length,1);assert.equal(next.dealers[0].id,dealerId);
  assert.equal(next.lines.length,next.events.length);
  const before=pool.snapshot();
  await assert.rejects(repo.saveDocument('project',{value:next,actor:'tester',expectedRevision:initial.revision}),rejection('studio_dealer_inactive',409));
  assert.deepEqual(pool.snapshot(),before);
  const oldPool=createStudioMemoryPool(),oldRepo=repository(oldPool);
  const old=await oldRepo.initializeDocument('project',{value:historical,actor:'historical-fixture',revision:'historical'});
  const edited=structuredClone(old.value);edited.events[0].label='Explicit unrelated edit';
  const saved=await oldRepo.saveDocument('project',{value:edited,actor:'tester',expectedRevision:old.revision});
  assert.deepEqual(saved.value.dealers,historical.dealers);assert.deepEqual(saved.value.lines,historical.lines);
  assert.equal((await oldRepo.listDocumentHistory('project')).length,1);
});
