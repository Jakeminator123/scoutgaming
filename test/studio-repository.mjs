import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createSeedProject, createEmptyProject } from '../packages/presentation/contracts/studio-model.mjs';
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
