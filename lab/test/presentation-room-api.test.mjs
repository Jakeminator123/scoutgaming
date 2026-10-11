import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedProject, defaultPresentationLane, addDealer } from '../lib/studio-model.mjs';
import { createPresentationRoomApi } from '../lib/presentation-room-api.mjs';
import { createStudioAdminApi } from '../lib/studio-admin-api.mjs';
import { wrapNativePresentationRepository } from '../lib/presentation-runtime-readiness.mjs';
import { createStudioRepository } from '../../web/storage/studio-repository.mjs';
import { createOperatorStore } from '../../web/storage/operator-store.mjs';
import { buildPresentationPackage, layerAssetPath } from '../../web/presentation-layers.mjs';
import { readPackagePresentation, withPackagePresentation } from '../../web/storage/presentation-package.mjs';
import { defaultCompositionSettings } from '../../web/public/composition-settings.mjs';
import { BASE_DEALER_IDS } from '../../web/dealer-identity.mjs';
import { createGameEntrySelector } from '../../web/game-entry-operator.mjs';

const scope = { environment: 'room-fixture', workspaceId: 'isolated' };
const origin = 'https://studio.example.invalid';
const capability4 = { schemaVersion:4, registeredDealerIds:['nora'], compositing:'per-clip', rooms:'operator-owned-v2', registeredDealerMode:'saved-registry-idle-v1', frozenDealerIdle:'operator-package-v2', frozenDealerEvents:'operator-package-v3' };
const capability = { schemaVersion: 2, registeredDealerIds: ['nora'], compositing: 'per-clip', rooms: 'operator-owned-v2' };
const key = '0aaa0000-1111-4222-8333-444444444444';
const session = { user: 'room-admin', role: 'admin', scope };
const clone = value => structuredClone(value);
// One combined transactional fixture: documents, their history/audit and packages
// commit or roll back together on the same connection. No external data/services.
function idleRecord(dealerId = 'johanna', id = '00000000-0000-4000-8000-000000000001') {
  return { id, sha256: 'a'.repeat(64), size: 4096, contentType: 'video/mp4',
    pathname: `croupier/media/dealers/${dealerId}/review/uploads/${id}/${'a'.repeat(64)}.mp4`,
    classification: { dealerId, eventId: 'idle.ready', kind: 'idle', role: 'standard', situation: '', label: 'Grundloop', notes: '', playback: 'once', compositing: { mode: 'green-screen', threshold: .23, softness: .15, despill: 0 } } };
}
function combinedPool() {
  let state = { documents: new Map(), media: new Map(), history: [], audits: [], packages: [], operators: [
    { environment_id: scope.environment, workspace_id: scope.workspaceId, operator_id: 'north', slug: 'north', name: 'North', status: 'active', created_at_ms: 1 },
    { environment_id: scope.environment, workspace_id: scope.workspaceId, operator_id: 'other', slug: 'other', name: 'Other', status: 'active', created_at_ms: 1 },
  ] }, tail = Promise.resolve(), clientId = 0, tick = 0;
  const trace = [], faults = new Set();
  const sameScope = (row, values) => row.environment_id === values[0] && row.workspace_id === values[1];
  const documentKey = values => JSON.stringify(values.slice(0, 3));
  const result = (rows = [], command = 'SELECT') => ({ rows: clone(rows), command });
  const pool = { trace, active: 0, setMedia(record, revision = 'media-1') { state.media.set(record.id, { environment_id: scope.environment, workspace_id: scope.workspaceId, id: record.id, revision, record: clone(record), updated_at: '2026-10-09T00:00:00.000Z' }); }, snapshot: () => clone(state), fail: marker => faults.add(marker), async connect() {
    const id = ++clientId; let working, unlock, readOnly = false;
    return { async query(sql, values = []) {
      const marker = /\/\* (?:studio|operator-store|presentation-room):([a-z-]+) \*\//.exec(sql)?.[1] ?? sql.split(/\s/)[0];
      trace.push({ client: id, marker, values: clone(values) });
      if (faults.delete(marker)) throw Error('private forced failure');
      if (sql.startsWith('BEGIN')) { pool.active++; readOnly = sql.includes('READ ONLY'); working = readOnly ? clone(state) : undefined; return result([], 'BEGIN'); }
      if (sql.startsWith('SET LOCAL')) return result([], 'SET');
      if (sql.includes('pg_advisory_xact_lock')) {
        const previous = tail; tail = new Promise(resolve => { unlock = resolve; }); await previous; working = clone(state); return result();
      }
      if (sql === 'COMMIT' || sql === 'ROLLBACK') {
        pool.active--; if (sql === 'COMMIT' && !readOnly) state = working; working = undefined; unlock?.(); unlock = null; return result([], sql);
      }
      assert.ok(working, 'all domain queries use the repository transaction');
      const packages = () => working.packages.filter(row => sameScope(row, values) && row.operator_id === values[2]);
      if (marker === 'lock-operator' || marker === 'operator-by-id') return result(working.operators.filter(row => sameScope(row, values) && row.operator_id === values[2]));
      if (marker === 'current-package') return result(packages().sort((a, b) => b.package_revision - a.package_revision).slice(0, 1));
      if (marker === 'used-key') return result(packages().filter(row => JSON.parse(row.tables).includes(values[3])).slice(0, 1));
      if (marker === 'publish-package') {
        const row = { environment_id: values[0], workspace_id: values[1], operator_id: values[2], package_revision: Math.max(0, ...packages().map(row => row.package_revision)) + 1,
          lanes: values[3], games: values[4], tables: values[5], branding: values[6], published_at_ms: values[7] };
        working.packages.push(row); return result([row]);
      }
      if (marker === 'list-media') return result([...working.media.values()].filter(row => sameScope(row, values)));
      if (marker === 'read-media') return result(working.media.has(values[2]) ? [working.media.get(values[2])] : []);
      if (marker === 'read-document') return result(working.documents.has(documentKey(values)) ? [working.documents.get(documentKey(values))] : []);
      if (marker === 'insert-document') {
        const row = { environment_id: values[0], workspace_id: values[1], kind: values[2], revision: values[3], value: JSON.parse(values[4]), updated_at: new Date(1700000000000 + ++tick).toISOString() };
        working.documents.set(documentKey(values), row); return result([row]);
      }
      if (marker === 'save-document') {
        const previous = working.documents.get(documentKey(values)); if (previous?.revision !== values[5]) return result();
        const row = { ...previous, revision: values[3], value: JSON.parse(values[4]), updated_at: new Date(1700000000000 + ++tick).toISOString() };
        working.documents.set(documentKey(values), row); return result([row]);
      }
      if (marker === 'history') { working.history.push(clone(values)); return result(); }
      if (marker === 'audit') { working.audits.push(clone(values)); return result(); }
      throw Error(`unknown fixture query ${marker}`);
    }, release() { unlock?.(); } };
  } };
  return pool;
}
async function fixture(options = {}) {
  const pool = combinedPool(), repository = createStudioRepository({ pool, scope });
  const project = createSeedProject();
  const vip = defaultPresentationLane(); vip.id = 'vip-presentation'; vip.label = 'VIP';
  project.lanes.push(vip);
  const administration = { rooms: [{ id: 'legacy', name: 'Legacy', scene: 'classic', felt: 'green', dealer: 'astrid', state: 'live' }],
    tiers: { classic: 'vera', high: 'astrid', vip: 'amira' }, tournaments: [], pitboss: { payout10x: true, streak5: true, randomWalkMin: 45 } };
  await repository.initializeDocument('project', { value: project, revision: project.revision, actor: session.user });
  await repository.initializeDocument('administration', { value: administration, revision: 'admin-initial', actor: session.user });
  const videoRegistry = { async loadCaptured(snapshot) { assert.equal(pool.active, 0, 'inventory loading outside SQL'); return { videos: snapshot.mediaRows.map(record => ({ id: record.id, dealer: record.classification.dealerId, sha256: record.sha256, bytes: record.size, classification: clone(record.classification), available: true, integrity: 'verified' })) }; }, async verifyCapturedMedia() { assert.equal(pool.active, 0, 'provider HEAD outside SQL'); } };
  const roomApi = createPresentationRoomApi({ repository, scope, videoRegistry, runtimeCapabilities: async presentation => presentation?.schemaVersion === 3 ? capability4 : presentation?.schemaVersion === 2 ? { ...capability, schemaVersion: 3, registeredDealerMode: 'saved-registry-idle-v1', frozenDealerIdle: 'operator-package-v2' } : capability, now: () => 1700000000000, ...options });
  const context = body => ({ body, actor: session, scope });
  const prepare = (operatorId = 'north', presentationLaneId = vip.id) => roomApi.handlers.get('GET /studio/api/admin/presentation-room')({ ...context(null), request: new Request(`${origin}/studio/api/admin/presentation-room?operatorId=${operatorId}&presentationLaneId=${presentationLaneId}`) });
  const create = body => roomApi.handlers.get('POST /studio/api/admin/presentation-room')(context(body));
  const payload = async (overrides = {}) => { const ready = await prepare(); return { operatorId: 'north', presentationLaneId: vip.id, name: 'VIP room', idempotencyKey: key,
    expectedProjectRevision: ready.projectRevision, expectedAdministrationRevision: ready.administrationRevision, expectedPackageRevision: ready.packageRevision, ...overrides }; };
  const publish = async input => repository.transaction(() => repository.withTransactionClient(async client => {
    const store = await createOperatorStore({ sql: client, scope, transaction: work => repository.withTransactionClient(work), now: () => 1700000000000 }); return store.publishPackage(input);
  }));
  return { pool, repository, project, administration, roomApi, videoRegistry, prepare, create, payload, publish };
}
const status = expected => error => error.statusCode === expected;

test('preparation is read-only and returns actual nullable package revision plus verified runtime contract', async () => {
  const f = await fixture(), before = f.pool.snapshot(); const ready = await f.prepare();
  assert.equal(ready.ready, true); assert.equal(ready.conflictCode, null); assert.equal(ready.packageRevision, null); assert.equal(ready.projectRevision, f.project.revision);
  assert.equal(ready.administrationRevision, 'admin-initial'); assert.deepEqual(ready.capabilities, capability); assert.deepEqual(f.pool.snapshot(), before);
  await f.publish({ actor: session.user, operatorId: 'north', lanes: ['mobile-phone'], games: ['blackjack'], tables: ['legacy'], branding: withPackagePresentation({ name: 'Brand' }, buildPresentationPackage(f.project, ['mobile-phone'], [])) });
  assert.equal((await f.prepare()).packageRevision, 1);
  await assert.rejects(f.prepare('unknown'), status(404)); await assert.rejects(f.prepare('north', 'unknown'), status(404));
});

test('actual room creation publishes atomically, selects the different compatible lane and reaches the real entry reader', async () => {
  const f = await fixture(), body = await f.payload(), created = await f.create(body);
  assert.equal(created.duplicate, false); assert.equal(created.packageRevision, 1); assert.equal('projectRevision' in created, false);
  assert.match(created.room.id, /^room-[a-f0-9-]+$/); assert.equal(created.room.gameLaneId, 'mobile-phone'); assert.equal(created.room.presentationLaneId, 'vip-presentation');
  const saved = { project: (await f.repository.readDocument('project')).value, administration: (await f.repository.readDocument('administration')).value };
  const rawPack = f.pool.snapshot().packages[0];
  const pack = { operatorId: 'north', revision: 1, lanes: JSON.parse(rawPack.lanes), tables: JSON.parse(rawPack.tables), branding: JSON.parse(rawPack.branding) };
  const selector = createGameEntrySelector({ policy: { readSaved: async () => saved, readGameConfiguration: async () => saved.administration }, packages: { resolve: async slug => ({ operator: { id: slug, status: 'active' }, package: pack }) } });
  const entry = await selector(new URL(created.playUrl, origin).search);
  assert.equal(entry.status, 200); assert.equal(entry.selection.roomId, created.room.id); assert.equal(entry.selection.lane, 'mobile-phone');
  assert.equal((await selector(`?operator=other&table=${created.room.id}`)).status, 404);
  const writes = f.pool.trace.filter(row => ['save-document', 'publish-package'].includes(row.marker));
  assert.equal(new Set(writes.map(row => row.client)).size, 1); assert.equal(writes.length, 2);
});

test('each of the three stale revision preconditions rejects without any domain changes', async () => {
  for (const stale of [{ expectedProjectRevision: 'old-project' }, { expectedAdministrationRevision: 'old-admin' }, { expectedPackageRevision: 9 }]) {
    const f = await fixture(), body = await f.payload(stale), before = f.pool.snapshot();
    await assert.rejects(f.create(body), status(409)); assert.deepEqual(f.pool.snapshot(), before);
  }
});

test('duplicate retries precede CAS, return current revisions and never overwrite later project/package changes', async () => {
  const f = await fixture(), body = await f.payload(), first = await f.create(body);
  const project = await f.repository.readDocument('project'); await f.repository.saveDocument('project', { actor: session.user, expectedRevision: project.revision, value: { ...project.value, clipLabels: { newer: 'Unpublished' } } });
  const current = f.pool.snapshot().packages.at(-1);
  await f.publish({ actor: session.user, operatorId: 'north', expectedRevision: 1, lanes: JSON.parse(current.lanes), games: JSON.parse(current.games), tables: JSON.parse(current.tables), branding: { ...JSON.parse(current.branding), name: 'New brand' } });
  const before = f.pool.snapshot(), retried = await f.create(body);
  assert.equal(retried.duplicate, true); assert.equal(retried.packageRevision, 2); assert.deepEqual(retried.room, first.room); assert.deepEqual(f.pool.snapshot(), before);
  await assert.rejects(f.create({ ...body, name: 'Different intent' }), status(409)); assert.deepEqual(f.pool.snapshot(), before);
});

test('concurrent identical requests create once; distinct intents on the same revision have one winner', async () => {
  const f = await fixture(), body = await f.payload(); const both = await Promise.all([f.create(body), f.create(body)]);
  assert.deepEqual(both.map(row => row.duplicate).sort(), [false, true]); assert.equal(f.pool.snapshot().packages.length, 1);
  const g = await fixture(), next = await g.payload(); const outcomes = await Promise.allSettled([g.create(next), g.create({ ...next, idempotencyKey: '0bbb0000-1111-4222-8333-444444444444' })]);
  assert.equal(outcomes.filter(row => row.status === 'fulfilled').length, 1); assert.equal(outcomes.find(row => row.status === 'rejected').reason.statusCode, 409);
  assert.equal(g.pool.snapshot().packages.length, 1);
});

test('publish or audit failure rolls back room, package, previous-revision history and audit together', async () => {
  for (const marker of ['publish-package', 'audit', 'COMMIT']) {
    const f = await fixture(), body = await f.payload(), before = f.pool.snapshot(); f.pool.fail(marker);
    await assert.rejects(f.create(body), status(503)); assert.deepEqual(f.pool.snapshot(), before);
    assert.equal((await f.create(body)).duplicate, false);
  }
});

test('removed package membership and removed rooms cannot be repaired by idempotent retry', async () => {
  const f = await fixture(), body = await f.payload(), first = await f.create(body), current = f.pool.snapshot().packages.at(-1);
  await f.publish({ actor: session.user, operatorId: 'north', expectedRevision: 1, lanes: JSON.parse(current.lanes), games: ['blackjack'], tables: [], branding: JSON.parse(current.branding) });
  const before = f.pool.snapshot(); await assert.rejects(f.create(body), status(409)); assert.deepEqual(f.pool.snapshot(), before);
  const admin = await f.repository.readDocument('administration'); await f.repository.saveDocument('administration', { actor: session.user, expectedRevision: admin.revision, value: { ...admin.value, rooms: admin.value.rooms.filter(room => room.id !== first.room.id) } });
  const removed = f.pool.snapshot(); await assert.rejects(f.create(await f.payload()), status(409)); assert.deepEqual(f.pool.snapshot(), removed);
});

test('selected definition changes are isolated from other frozen lanes; branding and existing table IDs survive', async () => {
  const f = await fixture(), frozen = buildPresentationPackage(f.project, ['mobile-phone'], []);
  await f.publish({ actor: session.user, operatorId: 'north', lanes: ['mobile-phone'], games: ['blackjack'], tables: ['legacy'], branding: withPackagePresentation({ name: 'Brand', logo: 'https://example.invalid/logo.png' }, frozen) });
  const draft = await f.repository.readDocument('project'); const changed = clone(draft.value); changed.lanes[0].label = 'Unpublished change';
  await f.repository.saveDocument('project', { actor: session.user, expectedRevision: draft.revision, value: changed });
  const created = await f.create(await f.payload());
  const pack = f.pool.snapshot().packages.at(-1), published = readPackagePresentation({ lanes: JSON.parse(pack.lanes), branding: JSON.parse(pack.branding) });
  assert.equal(published.lanes[0].label, frozen.lanes[0].label); assert.equal(JSON.parse(pack.branding).name, 'Brand'); assert.equal(JSON.parse(pack.branding).logo, 'https://example.invalid/logo.png');
  assert.deepEqual(JSON.parse(pack.tables), ['legacy', created.room.id]);
  const selected = await f.repository.readDocument('project'); const next = clone(selected.value); next.lanes[1].label = 'VIP updated';
  await f.repository.saveDocument('project', { actor: session.user, expectedRevision: selected.revision, value: next });
  await f.create(await f.payload({ idempotencyKey: '0ccc0000-1111-4222-8333-444444444444', name: 'VIP second' }));
  const last = f.pool.snapshot().packages.at(-1), final = readPackagePresentation({ lanes: JSON.parse(last.lanes), branding: JSON.parse(last.branding) });
  assert.equal(final.lanes[0].label, frozen.lanes[0].label); assert.equal(final.lanes[1].label, 'VIP updated');
});

test('unavailable runtime refuses before writer locks; an unrelated layered catalogue can acquire an own portrait lane', async () => {
  const f = await fixture(); let version = 1, fetches = 0;
  const guarded = wrapNativePresentationRepository(f.repository, { env: { CROUPIER_BACKEND_ORIGIN: 'https://engine.example.invalid' }, fetchImpl: async () => { fetches++; return Response.json(version === 2 ? capability : { schemaVersion: 1, registeredDealerIds: ['nora'], compositing: 'per-clip' }); } });
  const blocked = createPresentationRoomApi({ repository: guarded, scope, runtimeCapabilities: () => guarded.withMutationContext(async () => capability, { kind: 'administration', value: { rooms: [{ schemaVersion: 2 }] } }) });
  const prep = () => blocked.handlers.get('GET /studio/api/admin/presentation-room')({ actor: session, scope, request: new Request(`${origin}/studio/api/admin/presentation-room?operatorId=north&presentationLaneId=vip-presentation`) });
  assert.equal((await prep()).ready, false); const body = await f.payload(), before = f.pool.snapshot(), queryCount = f.pool.trace.length;
  await assert.rejects(blocked.handlers.get('POST /studio/api/admin/presentation-room')({ body, actor: session, scope }), status(503));
  assert.equal(f.pool.trace.slice(queryCount).filter(row => ['save-document', 'publish-package', 'lock-operator'].includes(row.marker)).length, 0, 'capability refusal precedes writer lock and all writes');
  assert.deepEqual(f.pool.snapshot(), before); assert.equal(f.pool.trace.slice(queryCount).filter(row => row.marker === 'save-document').length, 0);
  version = 2; assert.equal((await prep()).ready, true); assert.ok(fetches >= 3);
  const admin = await f.repository.readDocument('administration');
  await f.repository.saveDocument('administration', { actor: session.user, expectedRevision: admin.revision, value: { ...admin.value, gameLane: 'layer-preview', gameLanes: [{ schemaVersion: 1, id: 'layer-preview', label: 'Layer', dealer: 'paow', renderer: 'layered', mediaCollection: 'layer-packs-preview' }] } });
  assert.equal((await f.prepare()).ready, true);
  const created = await f.create(await f.payload()); assert.match(created.room.gameLaneId, /^room-lane-/);
  const current = (await f.repository.readDocument('administration')).value;
  assert.equal(current.gameLane, 'layer-preview'); assert.equal(current.gameLanes.find(row => row.id === created.room.gameLaneId).renderer, 'portrait-video');
});

test('room endpoint retains fresh session role, Origin and exact query/body/scope boundaries', async () => {
  const f = await fixture(); let role = 'admin';
  const api = createStudioAdminApi({ authorize: async () => ({ ...session, role }), allowedOrigins: [origin], publicHosts: ['studio.example.invalid'], handlers: f.roomApi.handlers, mutationTransaction: work => work() });
  const body = await f.payload(), post = (extra = {}, headers = {}) => new Request(`${origin}/studio/api/admin/presentation-room`, { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...headers }, body: JSON.stringify({ ...body, ...extra }) });
  role = 'player'; assert.equal((await api.handle(post())).status, 403); role = 'admin'; assert.equal((await api.handle(post({}, { origin: 'https://evil.invalid' }))).status, 403);
  assert.equal((await api.handle(post({ gameLaneId: 'made-up' }))).status, 400);
  for (const query of ['?operatorId=north&presentationLaneId=vip-presentation&x=1', '?operatorId=north&operatorId=other&presentationLaneId=vip-presentation', '?operatorId=north', '?operatorId=north&presentationLaneId=constructor']) {
    assert.equal((await api.handle(new Request(`${origin}/studio/api/admin/presentation-room${query}`))).status, 404);
  }
  await assert.rejects(f.roomApi.handlers.get('GET /studio/api/admin/presentation-room')({ scope: { ...scope, workspaceId: 'other' }, request: new Request(`${origin}/studio/api/admin/presentation-room?operatorId=north&presentationLaneId=vip-presentation`) }), status(403));
  assert.equal((await api.handle(post())).status, 200);
});

test('Nora uses an own frozen idle, accepts a different compatible lane ID and empty optional positions', async () => {
  const f = await fixture(), project = await f.repository.readDocument('project');
  const saved = addDealer(project.value, 'nora', 'Nora'), lane = defaultPresentationLane();
  lane.id = 'nora-presentation'; lane.label = 'Nora'; lane.renderer = 'portrait-video'; lane.dealers = ['nora']; lane.layers.dealer = { enabled: true, default: 'nora', allowed: ['nora'] }; saved.lanes.push(lane);
  const record = idleRecord('nora'); f.pool.setMedia(record);
  const line = saved.lines.find(row => row.dealerId === 'nora' && row.eventId === 'idle.ready'); line.variants.find(row => row.id === line.baselineVariantId).videoGenerationId = record.id;
  await f.repository.saveDocument('project', { value: saved, expectedRevision: project.revision, actor: session.user });
  const admin = await f.repository.readDocument('administration'), serverLane = { schemaVersion: 1, id: 'nearby-nora', label: 'Nora', dealer: 'nora', renderer: 'portrait-video', mediaCollection: 'nora-presentation' };
  await f.repository.saveDocument('administration', { value: { ...admin.value, gameLanes: [{ schemaVersion: 1, id: 'mobile-phone', label: 'Mobile', dealer: 'astrid', renderer: 'portrait-video', mediaCollection: 'astrid-presentation' }, serverLane], gameLane: 'mobile-phone' }, expectedRevision: admin.revision, actor: session.user });
  const ready = await f.prepare('north', lane.id); assert.equal(ready.ready, true); assert.equal(ready.capabilities.schemaVersion, 4);
  const body = { ...(await f.payload()), presentationLaneId: lane.id }, created = await f.create(body);
  assert.equal(created.room.gameLaneId, serverLane.id); assert.equal(created.room.presentationLaneId, lane.id);
  const row = f.pool.snapshot().packages.at(-1), frozen = readPackagePresentation({ lanes: JSON.parse(row.lanes), branding: JSON.parse(row.branding) });
  assert.equal(frozen.schemaVersion, 3); assert.equal(frozen.registeredDealers[0].idle.id, record.id);
});

test('frozen assets and existing branding choices survive unrelated draft edits while selected composition is published', async () => {
  const f = await fixture(), project = clone(f.project);
  const assets = ['background', 'table', 'background', 'table'].map((role, index) => {
    const asset = { schemaVersion: 1, id: `00000000-0000-4000-8000-00000000000${index + 1}`, role, label: `Published ${index}`, sha256: String(index + 1).repeat(64), size: 128, contentType: 'image/png', width: 720, height: 1280 };
    return { ...asset, pathname: layerAssetPath(asset) };
  });
  for (const [i, lane] of project.lanes.entries()) {
    lane.layers.background = { enabled: true, mode: 'image', allowed: [assets[i * 2].id], default: assets[i * 2].id };
    lane.layers.table = { enabled: true, allowed: [assets[i * 2 + 1].id], default: assets[i * 2 + 1].id, colors: ['#123abc'] };
    lane.composition = defaultCompositionSettings(); lane.composition.mobile.table.y = .13 + i * .1;
  }
  project.layerAssets = assets;
  const frozen = buildPresentationPackage(project, ['mobile-phone'], assets);
  const branding = { lane: 'mobile-phone', background: assets[0].id, table: assets[1].id, dealer: 'astrid', color: '#123abc', name: 'Brand' };
  await f.publish({ actor: session.user, operatorId: 'north', lanes: ['mobile-phone'], games: ['blackjack'], tables: ['legacy'], branding: withPackagePresentation(branding, frozen) });
  project.layerAssets[0].label = 'Unpublished library edit'; project.lanes[0].composition.mobile.table.y = .8;
  const saved = await f.repository.readDocument('project'); await f.repository.saveDocument('project', { value: project, expectedRevision: saved.revision, actor: session.user });
  await f.create(await f.payload());
  const row = f.pool.snapshot().packages.at(-1), pack = { lanes: JSON.parse(row.lanes), branding: JSON.parse(row.branding) }, final = readPackagePresentation(pack);
  assert.deepEqual(final.lanes[0], frozen.lanes[0]); assert.deepEqual(final.assets.slice(0, 2), frozen.assets);
  assert.equal(final.lanes[1].composition.mobile.table.y, .23); assert.equal(final.assets.length, 4);
  for (const [key, value] of Object.entries(branding)) assert.equal(pack.branding[key], value);
});

test('native admin preflight requests room capability before entering the product mutation', async () => {
  const f = await fixture(); let entered = 0;
  const guarded = wrapNativePresentationRepository(f.repository, { env: { CROUPIER_BACKEND_ORIGIN: 'https://engine.example.invalid' }, fetchImpl: async () => Response.json({ schemaVersion: 1, registeredDealerIds: ['nora'], compositing: 'per-clip' }) });
  const api = createStudioAdminApi({ authorize: async () => session, allowedOrigins: [origin], publicHosts: ['studio.example.invalid'], handlers: f.roomApi.handlers,
    mutationTransaction: (work, options) => guarded.withMutationContext(async () => { entered++; return work(); }, options.presentationMutation) });
  const before = f.pool.snapshot(), response = await api.handle(new Request(`${origin}/studio/api/admin/presentation-room`, { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, body: JSON.stringify(await f.payload()) }));
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'studio_presentation_runtime_update_required'); assert.equal(entered, 0); assert.deepEqual(f.pool.snapshot(), before);
});


test('replacing the selected definition cannot break an existing room bound to another game lane', async () => {
  const f = await fixture(), created = await f.create(await f.payload());
  const admin = await f.repository.readDocument('administration');
  await f.repository.saveDocument('administration', { value: { ...admin.value, gameLane: 'mobile-phone', gameLanes: [
    { schemaVersion: 1, id: 'mobile-phone', label: 'Mobile', dealer: 'astrid', renderer: 'portrait-video', mediaCollection: 'astrid-presentation' },
    { schemaVersion: 1, id: 'vip-presentation', label: 'VIP Vera', dealer: 'vera', renderer: 'portrait-video', mediaCollection: 'vera-presentation' },
  ] }, expectedRevision: admin.revision, actor: session.user });
  const project = await f.repository.readDocument('project'); const changed = clone(project.value);
  changed.lanes[1].dealers = ['vera']; changed.lanes[1].layers.dealer = { enabled: true, default: 'vera', allowed: ['vera'] };
  await f.repository.saveDocument('project', { value: changed, expectedRevision: project.revision, actor: session.user });
  const ready = await f.prepare();assert.equal(ready.reason, 'presentation_package_conflict');assert.equal(ready.ready,false);
  assert.equal(ready.conflictCode, 'presentation_room_binding_conflict');
  assert.deepEqual(ready.rooms,[{id:created.room.id,name:created.room.name,playUrl:created.playUrl}],
    'a blocked new publication must still list the valid current published room');
  const body = await f.payload({ idempotencyKey: '0ddd0000-1111-4222-8333-444444444444', name: 'Changed dealer' }), before = f.pool.snapshot();
  await assert.rejects(f.create(body), status(409)); assert.deepEqual(f.pool.snapshot(), before);
});


test('duplicate verifies the frozen room binding after a valid catalogue dealer change and never writes', async () => {
  const f = await fixture(), body = await f.payload(), created = await f.create(body);
  const admin = await f.repository.readDocument('administration');
  await f.repository.saveDocument('administration', { value: { ...admin.value, gameLane: 'mobile-phone', gameLanes: [
    { schemaVersion: 1, id: 'mobile-phone', label: 'Mobile Vera', dealer: 'vera', renderer: 'portrait-video', mediaCollection: 'vera-presentation' },
  ] }, expectedRevision: admin.revision, actor: session.user });
  const before = f.pool.snapshot();
  const saved = { project: (await f.repository.readDocument('project')).value, administration: (await f.repository.readDocument('administration')).value };
  const raw = before.packages.at(-1), pack = { operatorId: 'north', revision: raw.package_revision, lanes: JSON.parse(raw.lanes), tables: JSON.parse(raw.tables), branding: JSON.parse(raw.branding) };
  const entry = createGameEntrySelector({ policy: { readSaved: async () => saved, readGameConfiguration: async () => saved.administration }, packages: { resolve: async () => ({ operator: { id: 'north', status: 'active' }, package: pack }) } });
  await assert.rejects(entry(new URL(created.playUrl, origin).search), status(503));
  await assert.rejects(f.create(body), status(409));
  assert.deepEqual(f.pool.snapshot(), before);
});

test('a newer unpublished dealer choice does not invalidate a compatible frozen replay', async () => {
  const f = await fixture(), body = await f.payload(), first = await f.create(body);
  const saved = await f.repository.readDocument('project'), draft = clone(saved.value);
  draft.lanes[1].dealers = ['vera']; draft.lanes[1].layers.dealer = { enabled: true, default: 'vera', allowed: ['vera'] };
  await f.repository.saveDocument('project', { value: draft, expectedRevision: saved.revision, actor: session.user });
  const before = f.pool.snapshot(), duplicate = await f.create(body);
  assert.equal(duplicate.duplicate, true); assert.deepEqual(duplicate.room, first.room); assert.deepEqual(f.pool.snapshot(), before);
});

async function registeredFixture(options = {}) {
  const f = await fixture(options), current = await f.repository.readDocument('project');
  const project = addDealer(current.value, 'johanna', 'Johanna'), record = idleRecord(); f.pool.setMedia(record);
  const baseline = project.lines.find(row => row.dealerId === 'johanna' && row.eventId === 'idle.ready');
  baseline.variants.find(row => row.id === baseline.baselineVariantId).videoGenerationId = record.id;
  const lane = defaultPresentationLane(); lane.id = 'johns-johanna'; lane.label = 'Johns Johanna'; lane.renderer = 'portrait-video';
  lane.dealers = ['johanna']; lane.layers.dealer = { enabled: true, default: 'johanna', allowed: ['johanna'] };
  lane.composition = defaultCompositionSettings(); lane.composition.mobile.dealer.y = .27;
  project.lanes.push(lane);
  await f.repository.saveDocument('project', { actor: session.user, expectedRevision: current.revision, value: project });
  const payload = async (extra = {}) => { const ready = await f.prepare('north', lane.id); return { operatorId: 'north', presentationLaneId: lane.id,
    name: 'Johns Johanna', idempotencyKey: key, expectedProjectRevision: ready.projectRevision,
    expectedAdministrationRevision: ready.administrationRevision, expectedPackageRevision: ready.packageRevision, ...extra }; };
  return { ...f, record, lane, registeredPayload: payload };
}

test('Johanna without a technical lane creates one atomically and publishes her exact frozen idle and composition', async () => {
  const f = await registeredFixture(), before = f.pool.snapshot(), ready = await f.prepare('north', f.lane.id);
  assert.equal(ready.ready, true); assert.equal(ready.capabilities.schemaVersion, 4); assert.deepEqual(f.pool.snapshot(), before);
  const body = await f.registeredPayload(), result = await f.create(body), state = f.pool.snapshot();
  assert.match(result.room.gameLaneId, /^room-lane-[a-f0-9]{24}$/); assert.notEqual(result.room.gameLaneId, f.lane.id);
  const administration = (await f.repository.readDocument('administration')).value, lane = administration.gameLanes.find(row => row.id === result.room.gameLaneId);
  assert.deepEqual(lane, { schemaVersion: 1, id: result.room.gameLaneId, label: 'Johns Johanna', renderer: 'portrait-video', dealer: 'johanna', mediaCollection: 'johanna-presentation' });
  assert.equal(administration.gameLane, 'mobile-phone'); assert.equal(administration.gameLanes.length, 2);
  const raw = state.packages.at(-1), pack = { operatorId: 'north', revision: 1, lanes: JSON.parse(raw.lanes), tables: JSON.parse(raw.tables), branding: JSON.parse(raw.branding) };
  const frozen = readPackagePresentation(pack);
  assert.equal(frozen.schemaVersion, 3); assert.deepEqual(frozen.registeredDealers, [{ id: 'johanna', label: 'Johanna', idle: f.record }]);
  assert.deepEqual(pack.lanes, [f.lane.id]); assert.deepEqual(frozen.lanes[0].composition, f.lane.composition);
  const saved = { project: (await f.repository.readDocument('project')).value, administration };
  const selector = createGameEntrySelector({ policy: { readSaved: async () => saved, readGameConfiguration: async () => administration },
    packages: { resolve: async slug => ({ operator: { id: slug, status: 'active' }, package: pack }) } });
  const entry = await selector(new URL(result.playUrl, origin).search, { withChoices: true });
  assert.equal(entry.status, 200); assert.equal(entry.selection.dealer, 'johanna'); assert.equal(entry.selection.lane, result.room.gameLaneId);
  assert.equal(entry.selection.roomId, result.room.id); assert.deepEqual(entry.selection.composition.settings, f.lane.composition);
  assert.equal(entry.selection.choices.dealerDefault, 'johanna');
  assert.equal((await selector('?operator=other&table=' + result.room.id)).status, 404);
  const writes = f.pool.trace.filter(row => ['save-document', 'publish-package'].includes(row.marker)).slice(-2);
  assert.equal(new Set(writes.map(row => row.client)).size, 1);
});

test('generic registered dealer room refuses a v2-only engine before any room, catalogue or package write', async () => {
  const f = await registeredFixture({ runtimeCapabilities: async () => capability }), ready = await f.prepare('north', f.lane.id);
  assert.equal(ready.ready, false); assert.equal(ready.reason, 'studio_presentation_runtime_update_required');
  const body = await f.registeredPayload(), before = f.pool.snapshot(), index = f.pool.trace.length;
  await assert.rejects(f.create(body), status(503)); assert.deepEqual(f.pool.snapshot(), before);
  assert.equal(f.pool.trace.slice(index).filter(row => ['lock-operator', 'save-document', 'publish-package'].includes(row.marker)).length, 0);
});

test('provider refusal and missing own idle never create a room or a catalogue placeholder', async () => {
  for (const missing of ['provider', 'baseline']) {
    const f = await registeredFixture();
    if (missing === 'provider') f.videoRegistry.verifyCapturedMedia = async () => { assert.equal(f.pool.active, 0); throw Object.assign(Error('fixture unavailable'), { statusCode: 503 }); };
    else {
      const saved = await f.repository.readDocument('project'), next = clone(saved.value);
      const line = next.lines.find(row => row.dealerId === 'johanna' && row.eventId === 'idle.ready'); line.variants[0].videoGenerationId = null;
      await f.repository.saveDocument('project', { actor: session.user, expectedRevision: saved.revision, value: next });
    }
    const project = await f.repository.readDocument('project'), admin = await f.repository.readDocument('administration'), before = f.pool.snapshot();
    const body = { operatorId: 'north', presentationLaneId: f.lane.id, name: 'No placeholder', idempotencyKey: key,
      expectedProjectRevision: project.revision, expectedAdministrationRevision: admin.revision, expectedPackageRevision: null };
    await assert.rejects(f.create(body), status(missing === 'provider' ? 503 : 422)); assert.deepEqual(f.pool.snapshot(), before);
  }
});

test('frozen media CAS rejects exact classification/revision changes after provider I/O without publishing', async () => {
  const f = await registeredFixture(), body = await f.registeredPayload();
  f.videoRegistry.verifyCapturedMedia = async () => {
    assert.equal(f.pool.active, 0);
    const changed = clone(f.record); changed.classification.compositing.threshold = .7; f.pool.setMedia(changed, 'media-new');
  };
  const before = f.pool.snapshot(); await assert.rejects(f.create(body), status(409));
  const after = f.pool.snapshot(); assert.deepEqual(after.documents, before.documents); assert.deepEqual(after.packages, before.packages);
  assert.deepEqual(after.history, before.history); assert.deepEqual(after.audits, before.audits);
});

test('prepared room intent rechecks all three CAS preconditions under the write lock after provider preparation', async () => {
  for (const changed of ['project', 'administration', 'package']) {
    const f = await registeredFixture(), body = await f.registeredPayload(), prepare = f.roomApi.preparations.get('POST /studio/api/admin/presentation-room');
    const context = { body, actor: session, scope }, prepared = await prepare(context);
    if (changed === 'package') {
      await f.publish({ actor: session.user, operatorId: 'north', lanes: ['mobile-phone'], games: ['blackjack'], tables: ['legacy'],
        branding: withPackagePresentation({ name: 'Concurrent brand' }, buildPresentationPackage(f.project, ['mobile-phone'], [])) });
    } else {
      const saved = await f.repository.readDocument(changed);
      await f.repository.saveDocument(changed, { actor: session.user, expectedRevision: saved.revision,
        value: changed === 'project' ? { ...saved.value, clipLabels: { current: 'Concurrent draft' } } : { ...saved.value, pitboss: { ...saved.value.pitboss, randomWalkMin: 60 } } });
    }
    const before = f.pool.snapshot();
    await assert.rejects(f.roomApi.handlers.get('POST /studio/api/admin/presentation-room')({ ...context, prepared }), status(409));
    assert.deepEqual(f.pool.snapshot(), before);
  }
});

test('successful generic replay remains bound to the frozen idle without mutable provider access or writes', async () => {
  const f = await registeredFixture(), body = await f.registeredPayload(), first = await f.create(body);
  const saved = await f.repository.readDocument('project'), project = clone(saved.value);
  const line = project.lines.find(row => row.dealerId === 'johanna' && row.eventId === 'idle.ready'); line.variants[0].videoGenerationId = null;
  await f.repository.saveDocument('project', { actor: session.user, expectedRevision: saved.revision, value: project });
  f.videoRegistry.loadCaptured = f.videoRegistry.verifyCapturedMedia = () => { throw Error('Replay must never inspect mutable provider media'); };
  const before = f.pool.snapshot(), replay = await f.create(body);
  assert.equal(replay.duplicate, true); assert.deepEqual(replay.room, first.room); assert.deepEqual(f.pool.snapshot(), before);
  await assert.rejects(f.create({ ...body, name: 'Other intent' }), status(409)); assert.deepEqual(f.pool.snapshot(), before);
});

test('an ambiguous compatible catalogue creates one deterministic lane, a later intent reuses it and collisions fail closed', async () => {
  const f = await fixture(), current = await f.repository.readDocument('administration');
  const indexed = id => ({ schemaVersion: 1, id, label: 'Legacy', renderer: 'indexed-video', dealer: 'astrid', mediaCollection: 'legacy-dealers' });
  await f.repository.saveDocument('administration', { actor: session.user, expectedRevision: current.revision, value: { ...current.value, gameLane: 'first', gameLanes: [indexed('first'), indexed('second')] } });
  const first = await f.create(await f.payload()); assert.match(first.room.gameLaneId, /^room-lane-/);
  const second = await f.create(await f.payload({ idempotencyKey: '0bbb0000-1111-4222-8333-444444444444', name: 'Second room' }));
  assert.equal(second.room.gameLaneId, first.room.gameLaneId);
  const saved = await f.repository.readDocument('administration'), changed = clone(saved.value);
  changed.gameLanes.find(row => row.id === first.room.gameLaneId).dealer = 'vera';
  changed.gameLanes.find(row => row.id === first.room.gameLaneId).mediaCollection = 'vera-presentation';
  await f.repository.saveDocument('administration', { actor: session.user, expectedRevision: saved.revision, value: changed });
  const ready = await f.prepare(); assert.equal(ready.reason, 'presentation_package_conflict');
  assert.equal(ready.conflictCode, 'presentation_game_lane_conflict');
  const body = await f.payload({ idempotencyKey: '0ccc0000-1111-4222-8333-444444444444', name: 'Collision' }), before = f.pool.snapshot();
  await assert.rejects(f.create(body), status(409)); assert.deepEqual(f.pool.snapshot(), before);
});

test('creating an unrelated original dealer room preserves the previously frozen generic idle and presentation', async () => {
  const f = await registeredFixture(), first = await f.create(await f.registeredPayload()), initial = f.pool.snapshot().packages.at(-1);
  const old = readPackagePresentation({ lanes: JSON.parse(initial.lanes), branding: JSON.parse(initial.branding) });
  const project = await f.repository.readDocument('project'), next = clone(project.value);
  next.dealers.find(row => row.id === 'johanna').label = 'Unpublished label'; next.lanes.find(row => row.id === f.lane.id).composition.mobile.dealer.y = .8;
  await f.repository.saveDocument('project', { actor: session.user, expectedRevision: project.revision, value: next });
  await f.create(await f.payload({ idempotencyKey: '0bbb0000-1111-4222-8333-444444444444', name: 'Original room' }));
  const row = f.pool.snapshot().packages.at(-1), final = readPackagePresentation({ lanes: JSON.parse(row.lanes), branding: JSON.parse(row.branding) });
  assert.equal(final.schemaVersion, 3); assert.deepEqual(final.registeredDealers, old.registeredDealers);
  assert.deepEqual(final.lanes.find(lane => lane.id === f.lane.id), old.lanes[0]); assert.ok(JSON.parse(row.tables).includes(first.room.id));
});

test('a selected generic idle cannot silently replace the idle of another frozen presentation', async () => {
  const f = await registeredFixture(); await f.create(await f.registeredPayload());
  const saved = await f.repository.readDocument('project'), next = clone(saved.value), second = clone(next.lanes.find(row => row.id === f.lane.id));
  second.id = 'second-johanna'; second.label = 'Other Johanna'; next.lanes.push(second);
  const changed = idleRecord('johanna', '00000000-0000-4000-8000-000000000002'); f.pool.setMedia(changed, 'media-new');
  const line = next.lines.find(row => row.dealerId === 'johanna' && row.eventId === 'idle.ready'); line.variants[0].videoGenerationId = changed.id;
  await f.repository.saveDocument('project', { actor: session.user, expectedRevision: saved.revision, value: next });
  const ready = await f.prepare('north', second.id); assert.equal(ready.ready, false); assert.equal(ready.reason, 'presentation_package_conflict');
  assert.equal(ready.conflictCode, 'presentation_shared_dealer_conflict');
  const project = await f.repository.readDocument('project'), admin = await f.repository.readDocument('administration'), before = f.pool.snapshot();
  await assert.rejects(f.create({ operatorId: 'north', presentationLaneId: second.id, name: 'No implicit idle replacement', idempotencyKey: '0bbb0000-1111-4222-8333-444444444444',
    expectedProjectRevision: project.revision, expectedAdministrationRevision: admin.revision, expectedPackageRevision: 1 }), status(409));
  assert.deepEqual(f.pool.snapshot(), before);
});

test('all original four dealers remain playable through real room entry with byte-compatible v1 publication', async () => {
  for (const dealer of BASE_DEALER_IDS) {
    const f = await fixture(), project = await f.repository.readDocument('project'), next = clone(project.value);
    const lane = next.lanes.find(row => row.id === 'vip-presentation'); lane.dealers = [dealer]; lane.layers.dealer = { enabled: true, default: dealer, allowed: [dealer] };
    await f.repository.saveDocument('project', { actor: session.user, expectedRevision: project.revision, value: next });
    const ready = await f.prepare(); assert.equal(ready.ready, true); assert.equal(ready.capabilities.schemaVersion, 2);
    const room = await f.create(await f.payload()), raw = f.pool.snapshot().packages.at(-1);
    const pack = { operatorId: 'north', revision: 1, lanes: JSON.parse(raw.lanes), tables: JSON.parse(raw.tables), branding: JSON.parse(raw.branding) };
    assert.equal(readPackagePresentation(pack).schemaVersion, 1);
    const saved = { project: (await f.repository.readDocument('project')).value, administration: (await f.repository.readDocument('administration')).value };
    const selector = createGameEntrySelector({ policy: { readSaved: async () => saved, readGameConfiguration: async () => saved.administration },
      packages: { resolve: async () => ({ operator: { id: 'north', status: 'active' }, package: pack }) } });
    const entry = await selector(new URL(room.playUrl, origin).search);
    assert.equal(entry.status, 200); assert.equal(entry.selection.dealer, dealer); assert.equal(entry.selection.choices.dealerDefault, dealer);
  }
});

test('new v2 output with an empty registry still requires v3 before adding another original room', async () => {
  const f = await fixture({ runtimeCapabilities: async () => capability });
  const v2 = buildPresentationPackage(f.project, ['mobile-phone'], [], { registeredDealers: [] });
  await f.publish({ actor: session.user, operatorId: 'north', lanes: ['mobile-phone'], games: ['blackjack'], tables: ['legacy'], branding: withPackagePresentation({}, v2) });
  const ready = await f.prepare(); assert.equal(ready.ready, false); assert.equal(ready.reason, 'studio_presentation_runtime_update_required');
  const before = f.pool.snapshot(); await assert.rejects(f.create(await f.payload()), status(503)); assert.deepEqual(f.pool.snapshot(), before);
});

test('adding Johanna cannot silently migrate an unrelated legacy Nora presentation without its frozen idle', async () => {
  const f = await registeredFixture(), current = await f.repository.readDocument('project'), project = addDealer(current.value, 'nora', 'Nora');
  const nora = defaultPresentationLane(); nora.id = 'nora-mobile'; nora.dealers = ['nora']; nora.layers.dealer = { enabled: true, default: 'nora', allowed: ['nora'] }; project.lanes.push(nora);
  await f.repository.saveDocument('project', { actor: session.user, expectedRevision: current.revision, value: project });
  const legacy = buildPresentationPackage(project, [nora.id], []);
  await f.publish({ actor: session.user, operatorId: 'north', lanes: [nora.id], games: ['blackjack'], tables: ['legacy'], branding: withPackagePresentation({ name: 'Legacy Nora' }, legacy) });
  const ready = await f.prepare('north', f.lane.id); assert.equal(ready.reason, 'presentation_package_conflict');
  assert.equal(ready.conflictCode, 'presentation_legacy_package_conflict');
  const projectDocument = await f.repository.readDocument('project'), admin = await f.repository.readDocument('administration'), before = f.pool.snapshot();
  await assert.rejects(f.create({ operatorId: 'north', presentationLaneId: f.lane.id, name: 'No automatic migration', idempotencyKey: key,
    expectedProjectRevision: projectDocument.revision, expectedAdministrationRevision: admin.revision, expectedPackageRevision: 1 }), status(409));
  assert.deepEqual(f.pool.snapshot(), before);
});

test('the native room preparation map keeps provider and capability I/O outside both SQL transactions', async () => {
  const f = await registeredFixture(); let productActive = false, engineVersion = 2, headChecks = 0, capabilityChecks = 0;
  const guarded = wrapNativePresentationRepository(f.repository, { env: { CROUPIER_BACKEND_ORIGIN: 'https://engine.example.invalid' },
    fetchImpl: async (_url, options) => {
      assert.equal(productActive, false); assert.equal(f.pool.active, 0); capabilityChecks++;
      assert.equal(options.headers['X-Presentation-Capability-Version'], '4');
      return Response.json(engineVersion === 4 ? capability4 : capability);
    } });
  f.videoRegistry.verifyCapturedMedia = async () => { assert.equal(productActive, false); assert.equal(f.pool.active, 0); headChecks++; };
  const service = createPresentationRoomApi({ repository: guarded, scope, videoRegistry: f.videoRegistry,
    runtimeCapabilities: presentation => guarded.withMutationContext(async () => capability4,
      [{ kind: 'administration', value: { rooms: [{ schemaVersion: 2 }] } }, { kind: 'presentation-package', value: presentation }]) });
  const api = createStudioAdminApi({ authorize: async () => session, allowedOrigins: [origin], publicHosts: ['studio.example.invalid'],
    handlers: service.handlers, preparations: service.preparations, mutationTransaction: async (work, options) => {
      const descriptors = [...options.presentationMutation];
      for (const kind of options.presentationDocuments) descriptors.push({ kind, value: (await guarded.readDocument(kind)).value });
      return guarded.withMutationContext(async () => { productActive = true; try { return await work(); } finally { productActive = false; } }, descriptors);
    } });
  const body = await f.registeredPayload(), request = () => new Request(origin + '/studio/api/admin/presentation-room', { method: 'POST',
    headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const initialHeads = headChecks, before = f.pool.snapshot(); assert.equal((await api.handle(request())).status, 503); assert.deepEqual(f.pool.snapshot(), before);
  engineVersion = 4; const response = await api.handle(request()); assert.equal(response.status, 200);
  const receipt = await response.json(); assert.equal(receipt.duplicate, false); assert.equal(headChecks, initialHeads + 2);
  const heads = headChecks; assert.equal((await api.handle(request())).status, 200); assert.equal(headChecks, heads, 'replay has no provider HEAD');
  assert.ok(capabilityChecks >= 3);
});

test('a frozen default idle removed by another package writer makes replay conflict instead of exposing a broken game link', async () => {
  const f = await registeredFixture(), body = await f.registeredPayload(); await f.create(body);
  const current = f.pool.snapshot().packages.at(-1), pack = { lanes: JSON.parse(current.lanes), branding: JSON.parse(current.branding) }, frozen = readPackagePresentation(pack);
  frozen.registeredDealers[0].idle = null;
  const idleLine = frozen.playback.lines.find(line => line.dealerId === 'johanna' && line.eventId === 'idle.ready');
  idleLine.variants.find(variant => variant.id === idleLine.baselineVariantId).videoGenerationId = null;
  frozen.playback.media = [];
  await f.publish({ actor: session.user, operatorId: 'north', expectedRevision: 1, lanes: pack.lanes, games: ['blackjack'], tables: JSON.parse(current.tables),
    branding: withPackagePresentation(pack.branding, frozen) });
  const before = f.pool.snapshot(); await assert.rejects(f.create(body), status(409)); assert.deepEqual(f.pool.snapshot(), before);
});

test('the catalogue limit blocks an actual missing-lane room without changing existing tables', async () => {
  const f = await registeredFixture(), current = await f.repository.readDocument('administration');
  const lanes = Array.from({ length: 32 }, (_, index) => ({ schemaVersion: 1, id: 'existing-' + index, label: 'Existing', renderer: 'portrait-video', dealer: 'astrid', mediaCollection: 'astrid-presentation' }));
  await f.repository.saveDocument('administration', { actor: session.user, expectedRevision: current.revision, value: { ...current.value, gameLane: lanes[0].id, gameLanes: lanes } });
  assert.equal((await f.prepare('north', f.lane.id)).reason, 'presentation_lane_incompatible');
  const before = f.pool.snapshot(); await assert.rejects(f.create(await f.registeredPayload()), status(422)); assert.deepEqual(f.pool.snapshot(), before);
});

test('room listing exposes only live published rooms of this operator and presentation', async () => {
  const f=await fixture();
  assert.deepEqual((await f.prepare()).rooms,[]);
  const room=await f.create(await f.payload());
  assert.deepEqual((await f.prepare()).rooms,[{id:room.room.id,name:room.room.name,playUrl:room.playUrl}]);
  assert.deepEqual((await f.prepare('other')).rooms,[]);
  assert.deepEqual((await f.prepare('north','mobile-phone')).rooms,[]);
  const saved=await f.repository.readDocument('administration'), draft=clone(saved.value);
  draft.rooms.find(item=>item.id===room.room.id).state='preview';
  await f.repository.saveDocument('administration',{value:draft,expectedRevision:saved.revision,actor:session.user});
  assert.deepEqual((await f.prepare()).rooms,[]);
});


test('a saved Amira-Johanna-Astrid presentation can add a room while preserving the current Johanna package and room', async () => {
  const f=await registeredFixture(), first=await f.create(await f.registeredPayload());
  const initial=f.pool.snapshot().packages.at(-1), previous=readPackagePresentation({lanes:JSON.parse(initial.lanes),branding:JSON.parse(initial.branding)});
  const saved=await f.repository.readDocument('project'), project=clone(saved.value), mobile=project.lanes.find(lane=>lane.id==='mobile-phone');
  mobile.dealers=['amira','johanna','astrid'];mobile.layers.dealer={enabled:true,default:'amira',allowed:[...mobile.dealers]};
  mobile.composition=defaultCompositionSettings();
  await f.repository.saveDocument('project',{actor:session.user,expectedRevision:saved.revision,value:project});
  const prepared=await f.prepare('north','mobile-phone');assert.equal(prepared.ready,true);assert.equal(prepared.reason,null);
  const created=await f.create({operatorId:'north',presentationLaneId:'mobile-phone',name:'Jackes spelrum',
    idempotencyKey:'0eee0000-1111-4222-8333-444444444444',expectedProjectRevision:prepared.projectRevision,
    expectedAdministrationRevision:prepared.administrationRevision,expectedPackageRevision:prepared.packageRevision});
  const raw=f.pool.snapshot().packages.at(-1),pack={operatorId:'north',revision:raw.package_revision,lanes:JSON.parse(raw.lanes),tables:JSON.parse(raw.tables),branding:JSON.parse(raw.branding)};
  const frozen=readPackagePresentation(pack);
  assert.deepEqual(frozen.lanes.find(lane=>lane.id==='johns-johanna'),previous.lanes[0]);
  assert.deepEqual(frozen.registeredDealers,previous.registeredDealers);assert.deepEqual(frozen.playback,previous.playback);
  assert.deepEqual(new Set(pack.tables),new Set([first.room.id,created.room.id]));
  const administration=(await f.repository.readDocument('administration')).value;
  const select=createGameEntrySelector({policy:{readSaved:async()=>({project,administration}),readGameConfiguration:async()=>administration},
    packages:{resolve:async()=>({operator:{id:'north',status:'active'},package:pack})}});
  const entry=await select(new URL(created.playUrl,origin).search);assert.equal(entry.status,200);assert.equal(entry.selection.dealer,'amira');
  assert.deepEqual(entry.selection.choices.dealers,['amira','johanna','astrid']);
  assert.equal((await select(new URL(first.playUrl,origin).search)).selection.dealer,'johanna');
});


test('shared frozen event changes return a safe dealer conflict on either presentation and preserve published rooms', async () => {
  const f = await registeredFixture(), first = await f.create(await f.registeredPayload());
  const saved = await f.repository.readDocument('project'), second = clone(f.lane); second.id = 'second-johanna';
  saved.value.lanes.push(second);
  await f.repository.saveDocument('project', { value: saved.value, expectedRevision: saved.revision, actor: session.user });
  await f.create(await f.registeredPayload({ presentationLaneId: second.id, idempotencyKey: '0bbb0000-1111-4222-8333-444444444444' }));
  const edited = await f.repository.readDocument('project');
  edited.value.lines.find(row => row.dealerId === 'johanna' && row.eventId === 'speak.goodluck').variants[0].label = 'Updated saved event';
  await f.repository.saveDocument('project', { value: edited.value, expectedRevision: edited.revision, actor: session.user });
  const before = f.pool.snapshot();
  for (const id of [f.lane.id, second.id]) {
    const ready = await f.prepare('north', id);
    assert.equal(ready.ready, false); assert.equal(ready.conflictCode, 'presentation_shared_dealer_conflict');
    assert.equal(ready.rooms.length, 1);
    assert.doesNotMatch(JSON.stringify(ready), /Updated saved event|studio_shared_dealer_playback_conflict|pathname|sha256/);
  }
  assert.deepEqual(f.pool.snapshot(), before);
  assert.equal((await f.prepare('north', f.lane.id)).rooms[0].id, first.room.id);
});

test('changed frozen layer metadata has its own diagnostic without exposing the asset', async () => {
  const f = await fixture(), saved = await f.repository.readDocument('project');
  const asset = { schemaVersion: 1, id: '00000000-0000-4000-8000-000000000001', role: 'background', label: 'Published layer', sha256: 'a'.repeat(64), size: 128, contentType: 'image/png', width: 720, height: 1280 };
  asset.pathname = layerAssetPath(asset); saved.value.layerAssets = [asset];
  saved.value.lanes[1].layers.background = { enabled: true, mode: 'image', allowed: [asset.id], default: asset.id };
  await f.repository.saveDocument('project', { value: saved.value, expectedRevision: saved.revision, actor: session.user });
  await f.create(await f.payload());
  const changed = await f.repository.readDocument('project'); changed.value.layerAssets[0].label = 'Changed private metadata';
  await f.repository.saveDocument('project', { value: changed.value, expectedRevision: changed.revision, actor: session.user });
  const before = f.pool.snapshot(), ready = await f.prepare();
  assert.equal(ready.conflictCode, 'presentation_shared_layer_conflict'); assert.equal(ready.ready, false);
  assert.doesNotMatch(JSON.stringify(ready), /Changed private metadata|pathname|sha256/);
  assert.deepEqual(f.pool.snapshot(), before);
});

test('unknown internal conflicts remain generic and never reflect raw errors or arbitrary codes', async () => {
  const f = await registeredFixture();
  f.videoRegistry.verifyCapturedMedia = async () => { throw Object.assign(Error('private diagnostic'), { statusCode: 409, code: 'private-code' }); };
  const before = f.pool.snapshot(), ready = await f.prepare('north', f.lane.id);
  assert.equal(ready.reason, 'presentation_package_conflict'); assert.equal(ready.conflictCode, null);
  assert.doesNotMatch(JSON.stringify(ready), /private diagnostic|private-code/); assert.deepEqual(f.pool.snapshot(), before);
});
