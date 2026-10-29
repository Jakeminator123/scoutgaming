import test from 'node:test';
import assert from 'node:assert/strict';
import { labBasePath } from '../lib/lab-url.mjs';
import { createPresentationRoomClient, createPresentationRoomController, presentationRoomContextKey, presentationRoomPlayUrl } from '../lib/presentation-room-client.mjs';
import { presentationCapabilitiesForVersion } from '../../../packages/presentation/capability-contract.mjs';

const owner = { id: 'sg-test', slug: 'sg-test', name: 'SG test' };
const context = { operator: owner, presentation: { id: 'portrait-live', label: 'Nora vid bordet' }, projectRevision: 'project-1', projectSaved: true, storeAvailable: true };
const capability = { schemaVersion: 3, registeredDealerIds: ['nora'], compositing: 'per-clip', rooms: 'operator-owned-v2', registeredDealerMode: 'saved-registry-idle-v1', frozenDealerIdle: 'operator-package-v2' };
const rouletteCapability = presentationCapabilitiesForVersion(15);
const id = 'room-00000000-0000-4000-8000-000000000001';
const keyOne = '00000000-0000-4000-8000-000000000010';
const prepared = (chosen = context, extra = {}) => ({ ok: true, operator: chosen.operator, presentationLaneId: chosen.presentation.id,
  projectRevision: chosen.projectRevision, administrationRevision: 'admin-1', packageRevision: null, ready: true, reason: null, capabilities: capability, rooms: [], ...extra });
const created = (payload, chosen = context, extra = {}) => ({ ok: true, duplicate: false,
  room: { schemaVersion: 2, id, name: payload.name, operatorId: chosen.operator.id, presentationLaneId: chosen.presentation.id, gameLaneId: 'nora-presentation', state: 'live' },
  administrationRevision: 'admin-2', packageRevision: 1,
  playUrl: '/play/blackjack?' + new URLSearchParams({ operator: chosen.operator.slug, table: id }), ...extra });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('roulette selection persists through an uncertain create and validates the matching game receipt',async()=>{
  const f=fixture();await f.ready();const selection=f.controller.setGame('roulette');
  f.reply(1,prepared(context,{capabilities:rouletteCapability}));await selection;
  const attempt=await f.start('Roulette',context,{capabilities:rouletteCapability});assert.equal(attempt.payload.game,'roulette');
  attempt.post.reject(Error('connection lost'));await attempt.pending;
  f.controller.setGame('blackjack');assert.equal(f.controller.getSnapshot().game,'roulette');
  await f.ready(context,{capabilities:rouletteCapability});assert.equal(f.controller.getSnapshot().game,'roulette');
  assert.equal(new URL(f.requests.at(-1).path,'https://studio.invalid').searchParams.get('game'),'roulette');
  const index=f.requests.length,pending=f.controller.create(presentationRoomContextKey(context));
  await tick();
  const result=created(attempt.payload);result.room.game='roulette';result.playUrl=result.playUrl.replace('/blackjack?','/roulette?');
  f.reply(index,result);await pending;
  assert.equal(f.controller.getSnapshot().receipt.room.game,'roulette');
  assert.match(f.controller.getSnapshot().receipt.playUrl,/^\/play\/roulette\?/);
});

test('switching to roulette replaces an incompatible blackjack preflight and rechecks the same game before create',async()=>{
  const h=fixture();await h.ready(context,{ready:false,reason:'presentation_lane_incompatible'});
  h.controller.setName('Annas roulette');const selection=h.controller.setGame('roulette');
  assert.equal(h.controller.getSnapshot().game,'roulette');assert.equal(h.controller.getSnapshot().status,'loading');
  assert.equal(h.controller.getSnapshot().preflight,null);
  assert.equal(new URL(h.requests[1].path,'https://studio.invalid').searchParams.get('game'),'roulette');
  assert.equal(await h.controller.create(presentationRoomContextKey(context)),null);
  assert.equal(await h.controller.setGame('blackjack'),false,'game switches stay locked during preflight');
  h.reply(1,prepared(context,{capabilities:rouletteCapability}));assert.equal(await selection,true);
  assert.equal(h.controller.getSnapshot().status,'ready');assert.equal(h.controller.getSnapshot().name,'Annas roulette');
  const pending=h.controller.create(presentationRoomContextKey(context));
  assert.equal(new URL(h.requests[2].path,'https://studio.invalid').searchParams.get('game'),'roulette');
  assert.equal(await h.controller.setGame('blackjack'),false,'game switches stay locked during create recheck');
  h.reply(2,prepared(context,{capabilities:rouletteCapability,administrationRevision:'admin-current',packageRevision:7}));await tick();
  const payload=JSON.parse(h.requests[3].options.body);
  assert.equal(payload.game,'roulette');assert.equal(payload.expectedAdministrationRevision,'admin-current');assert.equal(payload.expectedPackageRevision,7);
  assert.equal(await h.controller.setGame('blackjack'),false,'the POST retains the checked game');
  const result=created(payload);result.room.game='roulette';result.playUrl=result.playUrl.replace('/blackjack?','/roulette?');
  h.reply(3,result);await pending;assert.equal(h.controller.getSnapshot().receipt.room.game,'roulette');
  const back=h.controller.setGame('blackjack');assert.equal(h.controller.getSnapshot().preflight,null);
  assert.equal(new URL(h.requests[4].path,'https://studio.invalid').searchParams.has('game'),false,'blackjack keeps its legacy query');
  h.reply(4,prepared());assert.equal(await back,true);
});

test('a late roulette preflight cannot restore the previous company or unlock a new pending read',async()=>{
  const h=fixture();await h.ready();const roulette=h.controller.setGame('roulette');
  const other={...context,operator:{id:'other',slug:'other',name:'Other'}},changed=h.controller.configure(other);
  assert.equal(h.requests[1].options.signal.aborted,true);
  h.reply(1,prepared(context,{capabilities:rouletteCapability}));assert.equal(await roulette,false);
  assert.equal(h.controller.getSnapshot().status,'loading');assert.equal(h.controller.getSnapshot().game,'blackjack');
  assert.equal(h.controller.getSnapshot().preflight,null);assert.equal(await h.controller.setGame('roulette'),false);
  h.reply(2,prepared(other));await changed;
  assert.equal(h.controller.getSnapshot().preflight.operator.id,'other');assert.equal(h.controller.getSnapshot().game,'blackjack');
});

test('roulette preflight accepts exact supported capabilities and rejects malformed or blackjack-only readiness',async()=>{
  for(const version of [9,14,15,16,29,30,31]){
    const h=fixture(),pending=h.client.read(context,{game:'roulette'});
    h.reply(0,prepared(context,{capabilities:presentationCapabilitiesForVersion(version)}));
    assert.equal((await pending).capabilities.schemaVersion,version);
  }
  for(const capabilities of [capability,{...rouletteCapability,rouletteStart:'unverified'},{...rouletteCapability,schemaVersion:16}]){
    const h=fixture(),pending=h.client.read(context,{game:'roulette'});
    h.reply(0,prepared(context,{capabilities}));await assert.rejects(pending,/Svaret kunde inte verifieras/);
  }
  const h=fixture();await assert.rejects(h.client.read(context,{game:'poker'}),/Svaret kunde inte verifieras/);
  assert.equal(h.requests.length,0);
});

test('current measured and embedded AV capabilities reach ordinary room creation and preserve the receipt',async()=>{
  for(const version of [29,30,31]){
    const f=fixture(),capabilities=presentationCapabilitiesForVersion(version);
    await f.ready(context,{capabilities});
    assert.equal(f.controller.getSnapshot().preflight.capabilities.schemaVersion,version);
    const attempt=await f.start('Uppmätt bord',context,{capabilities});
    assert.equal(attempt.post.options.method,'POST');
    f.reply(attempt.index,created(attempt.payload));await attempt.pending;
    assert.equal(f.controller.getSnapshot().receipt.room.id,id);
    assert.equal(f.controller.getSnapshot().receipt.packageRevision,1);
  }
});

test('ready responses still require the exact capability representation including all v31 fields',async()=>{
  const current=presentationCapabilitiesForVersion(31);
  const missing=field=>Object.fromEntries(Object.entries(current).filter(([key])=>key!==field));
  for(const capabilities of [null,presentationCapabilitiesForVersion(1),{schemaVersion:31},missing('rooms'),
    missing('mediaTiming'),missing('recordedEmbeddedAv'),missing('nativeFilmedPlanning'),
    {...current,nativeFilmedPlanning:'unverified'},{...current,schemaVersion:30},{...current,schemaVersion:32},
    {...current,unexpected:true}]){
    const f=fixture(),pending=f.client.read(context);
    f.reply(0,prepared(context,{capabilities}));await assert.rejects(pending,/Svaret kunde inte verifieras/);
    assert.equal(f.requests.length,1,'invalid readiness cannot trigger a create');
  }
});

function fixture() {
  const requests = []; let keys = 0;
  const fetchImpl = (path, options) => new Promise((resolve, reject) => requests.push({ path, options, resolve, reject }));
  const client = createPresentationRoomClient({ fetchImpl });
  const controller = createPresentationRoomController({ client, newKey: () => '00000000-0000-4000-8000-' + String(10 + keys++).padStart(12, '0') });
  return { requests, client, controller, get keys() { return keys; },
    reply(index, value, status = 200) { requests[index].resolve(Response.json(value, { status })); },
    async ready(chosen = context, extra = {}) { const index = requests.length, pending = controller.configure(chosen); this.reply(index, prepared(chosen, extra)); await pending; },
    async start(name = 'Noras bord', chosen = context, extra = {}) {
      controller.setName(name); const index = requests.length, pending = controller.create(presentationRoomContextKey(chosen));
      this.reply(index, prepared(chosen, extra)); await tick();
      return { pending, post: requests[index + 1], index: index + 1, payload: JSON.parse(requests[index + 1].options.body) };
    },
  };
}

test('preflight uses only the selected company/presentation and uncached same-origin transport', async () => {
  const h = fixture(); await h.ready();
  const request = h.requests[0], url = new URL(request.path, 'https://studio.invalid');
  assert.equal(url.pathname, labBasePath() + '/api/admin/presentation-room');
  assert.deepEqual([...url.searchParams], [['operatorId', owner.id], ['presentationLaneId', context.presentation.id]]);
  assert.equal(request.options.method, 'GET'); assert.equal(request.options.credentials, 'same-origin');
  assert.equal(request.options.redirect, 'error'); assert.equal(request.options.cache, 'no-store');
  assert.equal(h.controller.getSnapshot().status, 'ready');
});
test('local and published base paths send both GET and POST to the configured Lab API', async () => {
  const previous = process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  try {
    for (const basePath of ['', '/studio']) {
      process.env.NEXT_PUBLIC_LAB_BASE_PATH = basePath;
      const h = fixture(); await h.ready(); const first = await h.start();
      assert.equal(new URL(h.requests[0].path, 'https://studio.invalid').pathname, basePath + '/api/admin/presentation-room');
      assert.equal(first.post.path, basePath + '/api/admin/presentation-room');
      h.reply(first.index, created(first.payload)); await first.pending;
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;
    else process.env.NEXT_PUBLIC_LAB_BASE_PATH = previous;
  }
});

test('unsaved project, missing storage and missing selection never issue a request', async () => {
  for (const extra of [{ projectSaved: false }, { storeAvailable: false }, { operator: null }, { presentation: null }, { disabled: true }]) {
    const h = fixture(), chosen = { ...context, ...extra }; await h.controller.configure(chosen);
    assert.equal(await h.controller.create(presentationRoomContextKey(chosen)), null); assert.equal(h.requests.length, 0);
  }
});
test('a changed saved project and old runtime capability block creation without hiding the cause on name edit', async () => {
  const h = fixture(); await h.ready(context, { projectRevision: 'project-newer' });
  assert.equal(h.controller.getSnapshot().status, 'unavailable'); h.controller.setName('Mitt bord');
  assert.match(h.controller.getSnapshot().message, /Ladda om/);
  assert.equal(await h.controller.create(presentationRoomContextKey(context)), null); assert.equal(h.requests.length, 1);
  await h.ready(context, { ready: false, reason: 'studio_presentation_runtime_update_required',
    capabilities: { schemaVersion: 1, registeredDealerIds: ['nora'], compositing: 'per-clip' } });
  assert.match(h.controller.getSnapshot().message, /Spelservern behöver uppdateras/);
  assert.equal(await h.controller.create(presentationRoomContextKey(context)), null);
});
test('each new create rereads exact revisions, including an existing package; duplicate clicks stay locked', async () => {
  const h = fixture(); await h.ready(); h.controller.setName('  Noras bord  ');
  const first = h.controller.create(presentationRoomContextKey(context));
  assert.equal(await h.controller.create(presentationRoomContextKey(context)), null); assert.equal(h.requests.length, 2);
  h.reply(1, prepared(context, { administrationRevision: 'admin-new', packageRevision: 7 })); await tick();
  assert.equal(h.requests.length, 3); assert.equal(await h.controller.create(presentationRoomContextKey(context)), null);
  const payload = JSON.parse(h.requests[2].options.body);
  assert.deepEqual(payload, { operatorId: owner.id, presentationLaneId: context.presentation.id, name: 'Noras bord', idempotencyKey: keyOne,
    expectedProjectRevision: 'project-1', expectedAdministrationRevision: 'admin-new', expectedPackageRevision: 7 });
  assert.equal(h.keys, 1);
  h.reply(2, created(payload)); const result = await first;
  assert.equal(result.room.name, 'Noras bord'); assert.equal(h.controller.getSnapshot().status, 'success');
});
test('network uncertainty locks the name and retries the exact same key and payload; duplicate receipt succeeds', async () => {
  const h = fixture(); await h.ready(); const first = await h.start();
  first.post.reject(new TypeError('Network lost')); assert.equal(await first.pending, null);
  assert.equal(h.controller.getSnapshot().status, 'uncertain'); h.controller.setName('Annat rum');
  assert.equal(h.controller.getSnapshot().name, 'Noras bord');
  const retry = h.controller.create(presentationRoomContextKey(context));
  assert.equal(h.requests.length, 4); assert.equal(h.requests[3].options.method, 'POST');
  assert.equal(h.requests[3].options.body, first.post.options.body); assert.equal(h.keys, 1);
  h.reply(3, created(first.payload, context, { duplicate: true, administrationRevision: 'admin-current', packageRevision: 9 }));
  const replay = await retry;
  assert.equal(replay.duplicate, true); assert.equal(replay.administrationRevision, 'admin-current'); assert.equal(replay.packageRevision, 9);
  assert.equal(Object.hasOwn(replay, 'projectRevision'), false, 'replay does not fabricate the original project revision');
});
test('server errors and invalid success receipts remain uncertain instead of creating another room', async () => {
  for (const failure of ['server', 'receipt']) {
    const h = fixture(); await h.ready(); const first = await h.start();
    if (failure === 'server') h.reply(first.index, { error: 'unavailable' }, 503);
    else h.reply(first.index, created(first.payload, context, { playUrl: '/play/blackjack?operator=foreign&table=' + id }));
    assert.equal(await first.pending, null); assert.equal(h.controller.getSnapshot().status, 'uncertain');
    const retry = h.controller.create(presentationRoomContextKey(context));
    assert.equal(h.requests[3].options.body, first.post.options.body);
    h.reply(3, created(first.payload)); assert.equal((await retry).room.id, id);
  }
});
test('409 requires a separate refresh, retains the name and uses a new key only for a new confirmed attempt', async () => {
  const h = fixture(); await h.ready(); const first = await h.start();
  h.reply(first.index, { error: 'studio_conflict' }, 409); assert.equal(await first.pending, null);
  assert.equal(h.controller.getSnapshot().status, 'conflict'); assert.equal(h.controller.getSnapshot().preflight, null);
  assert.match(h.controller.getSnapshot().message, /Uppdatera/);
  assert.equal(await h.controller.create(presentationRoomContextKey(context)), null); assert.equal(h.requests.length, 3);
  const refresh = h.controller.refresh(); h.reply(3, prepared(context, { administrationRevision: 'admin-8', packageRevision: 9 })); await refresh;
  assert.equal(h.requests.length, 4, 'refresh must never silently resubmit');
  const next = await h.start('Noras bord', context, { administrationRevision: 'admin-8', packageRevision: 9 });
  assert.notEqual(next.payload.idempotencyKey, first.payload.idempotencyKey);
  assert.equal(next.payload.expectedAdministrationRevision, 'admin-8'); assert.equal(next.payload.expectedPackageRevision, 9);
  h.reply(next.index, created(next.payload)); await next.pending;
});
test('409 refresh to a different project stays blocked until the displayed saved version is updated', async () => {
  const h = fixture(); await h.ready(); const first = await h.start();
  h.reply(first.index, {}, 409); await first.pending;
  const refresh = h.controller.refresh(); h.reply(3, prepared(context, { projectRevision: 'project-2' })); await refresh;
  assert.equal(h.controller.getSnapshot().status, 'unavailable');
  assert.equal(await h.controller.create(presentationRoomContextKey(context)), null); assert.equal(h.requests.length, 4);
});
test('late preflight replies cannot restore a previously selected company or presentation', async () => {
  for (const other of [{ ...context, operator: { id: 'other', slug: 'other', name: 'Other' } }, { ...context, presentation: { id: 'second', label: 'Andra' } }]) {
    const h = fixture(), first = h.controller.configure(context), second = h.controller.configure(other);
    assert.equal(h.requests[0].options.signal.aborted, true);
    h.reply(1, prepared(other)); await second; h.reply(0, prepared()); await first;
    assert.equal(h.controller.getSnapshot().key, presentationRoomContextKey(other)); assert.equal(h.controller.getSnapshot().preflight.operator.id, other.operator.id);
    assert.equal(h.controller.getSnapshot().preflight.presentationLaneId, other.presentation.id);
  }
});
test('late POST receipts are ignored; returning to an unresolved context retries its original payload', async () => {
  const h = fixture(); await h.ready(); const first = await h.start();
  const other = { ...context, operator: { id: 'other', slug: 'other', name: 'Other' } };
  const changed = h.controller.configure(other); assert.equal(first.post.options.signal.aborted, true);
  h.reply(3, prepared(other)); await changed; h.reply(first.index, created(first.payload)); assert.equal(await first.pending, null);
  assert.equal(h.controller.getSnapshot().receipt, null); assert.equal(h.controller.getSnapshot().key, presentationRoomContextKey(other));
  const back = h.controller.configure(context); h.reply(4, prepared(context, { administrationRevision: 'admin-2', packageRevision: 1 })); await back;
  assert.equal(h.controller.getSnapshot().status, 'uncertain');
  const retry = h.controller.create(presentationRoomContextKey(context)); assert.equal(h.requests[5].options.body, first.post.options.body);
  h.reply(5, created(first.payload, context, { duplicate: true })); assert.equal((await retry).duplicate, true);
});
test('new edits cancel pending work and prevent late success; fresh project revisions cannot reuse an old preflight', async () => {
  const h = fixture(); await h.ready(); const first = await h.start();
  await h.controller.configure({ ...context, projectSaved: false });
  assert.equal(first.post.options.signal.aborted, true); h.reply(first.index, created(first.payload)); assert.equal(await first.pending, null);
  assert.equal(h.controller.getSnapshot().receipt, null); assert.equal(h.requests.length, 3);
  assert.equal(await h.controller.create(presentationRoomContextKey(context)), null);
  const updated = { ...context, projectRevision: 'project-2' }, pending = h.controller.configure(updated);
  h.reply(3, prepared(context)); await pending;
  assert.equal(h.controller.getSnapshot().status, 'unavailable'); assert.equal(await h.controller.create(presentationRoomContextKey(updated)), null);
});
test('preflight rejects missing revisions, mismatched ownership and false claims of room readiness', async () => {
  for (const extra of [{ packageRevision: undefined }, { administrationRevision: null }, { operator: { ...owner, id: 'foreign' } },
    { presentationLaneId: 'foreign' }, { capabilities: { ...capability, extra: true } },
    { capabilities: { schemaVersion: 1, registeredDealerIds: ['nora'], compositing: 'per-clip' } },
    { capabilities: { ...capability, frozenDealerIdle: 'unverified' } }]) {
    const h = fixture(), pending = h.controller.configure(context); h.reply(0, prepared(context, extra)); await pending;
    assert.equal(h.controller.getSnapshot().status, 'error'); assert.equal(await h.controller.create(presentationRoomContextKey(context)), null);
  }
});
test('receipt links must name only the correct relative game path, company and exact room', () => {
  const good = '/play/blackjack?operator=sg-test&table=' + id;
  assert.equal(presentationRoomPlayUrl(good, { operatorSlug: owner.slug, roomId: id }), good);
  for (const value of ['https://evil.example' + good, '//evil.example' + good, '/play/blackjack/extra?operator=sg-test&table=' + id,
    good + '#hash', good + '&lane=nora', good + '&operator=sg-test', good.replace('sg-test', 'foreign'), good.replace(id, 'room-foreign'),
    good.replace('/play/blackjack', '/play/%62lackjack'), good.replace('/play/', '/play/../play/'), good + '&table=' + id]) {
    assert.throws(() => presentationRoomPlayUrl(value, { operatorSlug: owner.slug, roomId: id }), /Svaret kunde inte verifieras/);
  }
});
test('wrong receipt owner, lane, name, room identifier or current revisions never expose a game link', async () => {
  const payload = { operatorId: owner.id, presentationLaneId: context.presentation.id, name: 'Mitt rum', idempotencyKey: keyOne,
    expectedProjectRevision: context.projectRevision, expectedAdministrationRevision: 'admin-1', expectedPackageRevision: null };
  const good = created(payload);
  for (const extra of [{ room: { ...good.room, operatorId: 'foreign' } }, { room: { ...good.room, presentationLaneId: 'foreign' } },
    { room: { ...good.room, name: 'Annat' } }, { room: { ...good.room, id: 'foreign' } }, { administrationRevision: undefined }, { packageRevision: null }]) {
    const h = fixture(), pending = h.client.create(context, payload); h.reply(0, { ...good, ...extra });
    await assert.rejects(pending, error => error.uncertain === true);
  }
});

test('refresh after a Render upgrade changes unavailable to ready without replacing the context or room name', async () => {
  const h = fixture();
  await h.ready(context, { ready: false, reason: 'studio_presentation_runtime_update_required',
    capabilities: { schemaVersion: 2, registeredDealerIds: ['nora'], compositing: 'per-clip', rooms: 'operator-owned-v2' } });
  assert.equal(h.controller.getSnapshot().status, 'unavailable');
  h.controller.setName('Johns Johanna');
  const before = h.controller.getSnapshot(), update = h.controller.refresh();
  h.reply(1, prepared(context, { packageRevision: 7, administrationRevision: 'admin-after-deploy' })); assert.equal(await update, true);
  const after = h.controller.getSnapshot();
  assert.equal(after.status, 'ready'); assert.equal(after.key, before.key); assert.equal(after.name, 'Johns Johanna'); assert.equal(after.message, null);
  assert.equal(after.preflight.capabilities.schemaVersion, 3); assert.equal(h.keys, 0); assert.equal(h.requests.length, 2);
});

test('an unchanged original-four room can remain ready with the exact legacy v2 capability contract', async () => {
  const h = fixture(); await h.ready(context, { capabilities: { schemaVersion: 2, registeredDealerIds: ['nora'], compositing: 'per-clip', rooms: 'operator-owned-v2' } });
  assert.equal(h.controller.getSnapshot().status, 'ready'); assert.equal(h.controller.getSnapshot().preflight.capabilities.schemaVersion, 2);
});

test('existing rooms have validated scoped links and cannot inject another company or duplicate room', async () => {
  const room={id,name:'Johannas blackjack',playUrl:'/play/blackjack?operator=sg-test&table='+id};
  const h=fixture();await h.ready(context,{packageRevision:1,rooms:[room]});
  assert.deepEqual(h.controller.getSnapshot().preflight.rooms,[room]);assert.equal(h.keys,0);
  const wrong=[
    {rooms:[{...room,playUrl:'/play/blackjack?operator=foreign&table='+id}],packageRevision:1},
    {rooms:[{...room,playUrl:'https://foreign.invalid/play'}],packageRevision:1},
    {rooms:[room,room],packageRevision:1},
    {rooms:[{...room,name:'\n'}],packageRevision:1},
    {rooms:[room],packageRevision:null},
  ];
  for(const extra of wrong){const broken=fixture();await broken.ready(context,extra);assert.equal(broken.controller.getSnapshot().status,'error');assert.equal(broken.controller.getSnapshot().preflight,null);}
});

test('room creation accepts the exact v4 capability for frozen event packages',async()=>{
  const h=fixture();await h.ready(context,{capabilities:{...capability,schemaVersion:4,frozenDealerEvents:'operator-package-v3'}});
  assert.equal(h.controller.getSnapshot().status,'ready');
  assert.equal(h.controller.getSnapshot().preflight.capabilities.schemaVersion,4);
});

test('fixed environment accepts the full registered layer label limit without widening room names', async () => {
  const valid = fixture(); await valid.ready(context, { environment: { kind: 'image', fixed: true, label: 'A'.repeat(120) } });
  assert.equal(valid.controller.getSnapshot().status, 'ready');
  assert.equal(valid.controller.getSnapshot().preflight.environment.label.length, 120);
  const invalid = fixture(); await invalid.ready(context, { environment: { kind: 'image', fixed: true, label: 'A'.repeat(121) } });
  assert.equal(invalid.controller.getSnapshot().status, 'error');
  valid.controller.setName('A'.repeat(101));
  const requests = valid.requests.length;
  assert.equal(await valid.controller.create(presentationRoomContextKey(context)), null);
  assert.equal(valid.requests.length, requests);
});

test('preflight rejects contradictory environment metadata', async () => {
  for (const environment of [
    { kind: 'variable', fixed: false, label: 'Flera miljöval' },
    { kind: 'variable', fixed: true, label: 'Flera miljöval' },
    { kind: 'image', fixed: true, label: 'Casino', pathname: 'private/blob' },
  ]) {
    const h = fixture(); await h.ready(context, { environment });
    assert.equal(h.controller.getSnapshot().status, 'error');
    assert.equal(h.controller.getSnapshot().preflight, null);
  }
});

test('conflict code validation rejects unknown, non-string, prototype and inconsistent diagnostics', async () => {
  for (const extra of [
    { conflictCode: 'private-code' }, { conflictCode: {} }, { conflictCode: 'constructor' },
    { conflictCode: 'presentation_shared_dealer_conflict', ready: true, reason: null },
    { conflictCode: 'presentation_shared_dealer_conflict', reason: 'presentation_lane_incompatible' },
  ]) {
    const h = fixture(); await h.ready(context, { ready: false, reason: 'presentation_package_conflict', ...extra });
    assert.equal(h.controller.getSnapshot().status, 'error');
    assert.equal(h.controller.getSnapshot().preflight, null);
    assert.doesNotMatch(h.controller.getSnapshot().message, /private-code|constructor/);
    assert.equal(await h.controller.create(presentationRoomContextKey(context)), null); assert.equal(h.requests.length, 1);
  }
});


test('gameConfig: kvittot måste bära exakt de publicerade inställningarna; serverns kod och materialskäl når anroparen', async () => {
  const gameConfig = { language: 'sv', limitPreset: 'prive' };
  const payload = { operatorId: owner.id, presentationLaneId: context.presentation.id, name: 'Mitt rum', idempotencyKey: keyOne,
    expectedProjectRevision: context.projectRevision, expectedAdministrationRevision: 'admin-1', expectedPackageRevision: null, gameConfig };
  const published = { configVersion: 'v1', packageRevision: 1, gameConfig, betMs: 20000, actionMs: 15000 };
  let h = fixture(), pending = h.client.create(context, payload); h.reply(0, created(payload, context, { published }));
  const receipt = await pending;
  assert.deepEqual(receipt.published, { packageRevision: 1, gameConfig });
  assert.deepEqual(JSON.parse(h.requests[0].options.body).gameConfig, gameConfig);
  for (const wrong of [undefined, { ...published, gameConfig: { language: 'en', limitPreset: 'prive' } }, { ...published, packageRevision: 0 }]) {
    h = fixture(); pending = h.client.create(context, payload); h.reply(0, created(payload, context, { published: wrong }));
    await assert.rejects(pending, error => error.uncertain === true);
  }
  await assert.rejects(h.client.create(context, { ...payload, game: 'roulette' }), /verifieras/);
  for (const [status, body, code, materialReason] of [[409, { error: 'studio_room_choices_draft_pending', code: 'studio_room_choices_draft_pending' }, 'studio_room_choices_draft_pending', null],
    [422, { error: 'studio_room_game_material_unavailable', code: 'studio_room_game_material_unavailable', materialReason: 'native_material_speech_slot_missing' }, 'studio_room_game_material_unavailable', 'native_material_speech_slot_missing'],
    [409, { error: 'Conflict' }, null, null], [422, { code: 'Bad Code', materialReason: 'other' }, null, null]]) {
    h = fixture(); pending = h.client.create(context, payload); h.reply(0, body, status);
    await assert.rejects(pending, error => error.status === status && error.code === code && error.materialReason === materialReason && error.uncertain === false);
  }
});
