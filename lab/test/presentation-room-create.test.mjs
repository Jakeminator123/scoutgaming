import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { labBasePath } from '../lib/lab-url.mjs';
import { createPresentationRoomClient, createPresentationRoomController, presentationRoomContextKey, presentationRoomPlayUrl } from '../lib/presentation-room-client.mjs';

const owner = { id: 'sg-test', slug: 'sg-test', name: 'SG test' };
const context = { operator: owner, presentation: { id: 'portrait-live', label: 'Nora vid bordet' }, projectRevision: 'project-1', projectSaved: true, storeAvailable: true };
const capability = { schemaVersion: 3, registeredDealerIds: ['nora'], compositing: 'per-clip', rooms: 'operator-owned-v2', registeredDealerMode: 'saved-registry-idle-v1', frozenDealerIdle: 'operator-package-v2' };
const id = 'room-00000000-0000-4000-8000-000000000001';
const keyOne = '00000000-0000-4000-8000-000000000010';
const prepared = (chosen = context, extra = {}) => ({ ok: true, operator: chosen.operator, presentationLaneId: chosen.presentation.id,
  projectRevision: chosen.projectRevision, administrationRevision: 'admin-1', packageRevision: null, ready: true, reason: null, capabilities: capability, rooms: [], ...extra });
const created = (payload, chosen = context, extra = {}) => ({ ok: true, duplicate: false,
  room: { schemaVersion: 2, id, name: payload.name, operatorId: chosen.operator.id, presentationLaneId: chosen.presentation.id, gameLaneId: 'nora-presentation', state: 'live' },
  administrationRevision: 'admin-2', packageRevision: 1,
  playUrl: '/play/blackjack?' + new URLSearchParams({ operator: chosen.operator.slug, table: id }), ...extra });
const tick = () => new Promise(resolve => setImmediate(resolve));

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

const require = createRequire(import.meta.url), url = new URL('../components/presentation-room-create.tsx', import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const compiled = transformSync(readFileSync(url, 'utf8'), { filename: 'presentation-room-create.tsx',
  jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
function componentHarness(controller) {
  const refs = [], effects = []; let cursor = 0, queued = [];
  const react = { ...React, useRef(value) { return refs[cursor++] ??= { current: value }; },
    useSyncExternalStore(_subscribe, snapshot) { return snapshot(); },
    useEffect(fn, deps) { const i = cursor++, old = effects[i]; if (!old || deps.some((value, index) => value !== old.deps[index])) {
      queued.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; });
    } } };
  const module = { exports: {} };
  vm.runInNewContext(compiled.code, { module, exports: module.exports, URLSearchParams, require: name => name === 'react' ? react : name.endsWith('.module.css')
    ? { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) } : name.includes('presentation-room-client')
      ? { createPresentationRoomController: () => controller, presentationRoomContextKey } : require(name) });
  return { render(props = context) { cursor = 0; queued = []; const tree = module.exports.PresentationRoomCreate(props); for (const effect of queued) effect(); return tree; },
    unmount() { for (const effect of effects) effect?.cleanup?.(); } };
}
function find(tree, type) {
  if (!tree || typeof tree !== 'object') return null;
  if (tree.type === type) return tree;
  for (const child of React.Children.toArray(tree.props?.children)) { const found = find(child, type); if (found) return found; }
  return null;
}
test('standalone form has one name field and create action, with no extra acceptance input', () => {
  const h = fixture(), ui = componentHarness(h.controller);
  const tree = ui.render({ ...context, projectSaved: false });
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Skapa spelrum/); assert.match(html, /Rumsnamn/); assert.match(html, /Spara presentationen först/);
  assert.equal((html.match(/<input/g) ?? []).length, 1); assert.equal(html.includes('checkbox'), false);
  assert.equal(find(tree, 'button').props.disabled, true); assert.equal(h.requests.length, 0); ui.unmount();
});
test('component delivers only a current verified receipt once, reports busy and exposes its validated link', async () => {
  const h = fixture(), ui = componentHarness(h.controller), receipts = [], busy = [];
  const props = { ...context, onCreated: value => receipts.push(value), onBusyChange: value => busy.push(value) };
  ui.render(props); h.reply(0, prepared()); await tick();
  let tree = ui.render(props); find(tree, 'input').props.onChange({ target: { value: 'Mitt rum' } }); tree = ui.render(props);
  find(tree, 'form').props.onSubmit({ preventDefault() {} }); find(tree, 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(h.requests.length, 2); ui.render(props); assert.equal(busy.at(-1), true);
  h.reply(1, prepared()); await tick(); const payload = JSON.parse(h.requests[2].options.body); h.reply(2, created(payload)); await tick();
  tree = ui.render(props); ui.render(props); assert.equal(receipts.length, 1); assert.equal(busy.at(-1), false);
  assert.equal(find(tree, 'a').props.href, '/play?operator=sg-test'); assert.ok(renderToStaticMarkup(tree).includes(created(payload).playUrl.replaceAll('&','&amp;'))); ui.unmount(); assert.equal(busy.at(-1), false);
});
test('component renders a changed selection immediately empty and never delivers the previous late receipt', async () => {
  const h = fixture(), ui = componentHarness(h.controller), receipts = [];
  const props = { ...context, onCreated: value => receipts.push(value) }; ui.render(props); h.reply(0, prepared()); await tick();
  let tree = ui.render(props); find(tree, 'input').props.onChange({ target: { value: 'Mitt rum' } }); tree = ui.render(props);
  find(tree, 'form').props.onSubmit({ preventDefault() {} }); h.reply(1, prepared()); await tick();
  const payload = JSON.parse(h.requests[2].options.body), other = { ...props, presentation: { id: 'second', label: 'Andra' } };
  tree = ui.render(other); assert.equal(find(tree, 'input').props.value, ''); assert.equal(find(tree, 'button').props.disabled, true);
  h.reply(2, created(payload)); h.reply(3, prepared(other)); await tick(); tree = ui.render(other);
  assert.equal(receipts.length, 0); assert.equal(find(tree, 'a'), null); ui.unmount();
});

test('a receipt arriving just before new unsaved edits cannot invoke onCreated or expose the old link', async () => {
  const h = fixture(), ui = componentHarness(h.controller), receipts = [];
  const props = { ...context, onCreated: value => receipts.push(value) };
  ui.render(props); h.reply(0, prepared()); await tick();
  let tree = ui.render(props); find(tree, 'input').props.onChange({ target: { value: 'Mitt rum' } }); tree = ui.render(props);
  find(tree, 'form').props.onSubmit({ preventDefault() {} }); h.reply(1, prepared()); await tick();
  const payload = JSON.parse(h.requests[2].options.body); h.reply(2, created(payload)); await tick();
  tree = ui.render({ ...props, projectSaved: false });
  assert.equal(receipts.length, 0); assert.equal(find(tree, 'a'), null); assert.equal(find(tree, 'button').props.disabled, true);
  assert.equal(h.requests.length, 3); ui.unmount();
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

test('room list opens the existing room before creating and hides stale links on company changes', async () => {
  const h=fixture(),ui=componentHarness(h.controller);
  ui.render(context);
  const room={id,name:'Johannas blackjack',playUrl:'/play/blackjack?operator=sg-test&table='+id};
  h.reply(0,prepared(context,{rooms:[room],packageRevision:1}));await tick();
  let tree=ui.render(context),html=renderToStaticMarkup(tree);
  assert.match(html,/<ul aria-label="Befintliga spelrum">/);
  assert.equal(find(tree,'a').props.href,'/play?operator=sg-test');
  assert.ok(html.includes(room.playUrl.replaceAll('&','&amp;')));
  assert.match(html,/Öppna bolagets spellobby/);
  assert.match(html,/<details[^>]*><summary>Skapa nytt spelrum<\/summary>/);
  assert.equal(h.requests.length,1,'viewing existing rooms performs no create request');
  const other={...context,operator:{id:'other',slug:'other',name:'Annat bolag'}};
  tree=ui.render(other);assert.equal(find(tree,'a'),null);
  h.reply(1,prepared(other));await tick();tree=ui.render(other);
  assert.equal(find(tree,'a'),null);assert.equal(h.keys,0);ui.unmount();
});

test('room creation accepts the exact v4 capability for frozen event packages',async()=>{
  const h=fixture();await h.ready(context,{capabilities:{...capability,schemaVersion:4,frozenDealerEvents:'operator-package-v3'}});
  assert.equal(h.controller.getSnapshot().status,'ready');
  assert.equal(h.controller.getSnapshot().preflight.capabilities.schemaVersion,4);
});

test('preflight causes provide distinct recovery without silently creating or republishing', async () => {
  for (const [extra, label, href] of [
    [{ projectRevision: 'project-new' }, 'Läs in aktuella uppgifter', '/control/lanes?operator=sg-test&lane=portrait-live'],
    [{ ready: false, reason: 'presentation_package_conflict' }, 'Läs in aktuella uppgifter', '/control/lanes?operator=sg-test&lane=portrait-live'],
    [{ ready: false, reason: 'presentation_lane_incompatible' }, 'Kontrollera sammansättningen', '/control/preview?lane=portrait-live'],
    [{ ready: false, reason: 'presentation_package_too_large' }, 'Kontrollera sammansättningen', '/control/preview?lane=portrait-live'],
  ]) {
    const h = fixture(), ui = componentHarness(h.controller);
    ui.render(context); h.reply(0, prepared(context, extra)); await tick();
    const tree = ui.render(context), html = renderToStaticMarkup(tree);
    assert.match(html, new RegExp(label)); assert.doesNotMatch(html, /Uppdatera uppgifter/);
    assert.equal(find(tree, 'a').props.href, labBasePath() + href);
    find(tree, 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests.length, 1, 'a blocked preflight never submits');
    assert.equal(h.keys, 0); ui.unmount();
  }
});

test('a valid existing room stays visible when changed draft content blocks another room creation', async () => {
  const h = fixture(), ui = componentHarness(h.controller);
  const room = { id, name: 'Befintligt rum', playUrl: '/play/blackjack?operator=sg-test&table=' + id };
  ui.render(context); h.reply(0, prepared(context, { ready: false, reason: 'presentation_package_conflict', packageRevision: 1, rooms: [room] })); await tick();
  const html = renderToStaticMarkup(ui.render(context));
  assert.match(html, /Öppna Befintligt rum/); assert.match(html, /Öppna bolagets spellobby/);
  assert.doesNotMatch(html, /Inget publicerat spelrum/); assert.equal(h.requests.length, 1);
  ui.unmount();
});


test('typed conflicts offer visible explicit recovery while keeping creation blocked and never publishing', async () => {
  for (const code of ['presentation_shared_dealer_conflict', 'presentation_shared_layer_conflict', 'presentation_legacy_package_conflict', 'presentation_room_binding_conflict', 'presentation_game_lane_conflict']) {
    const h = fixture(), ui = componentHarness(h.controller);
    ui.render(context); h.reply(0, prepared(context, { ready: false, reason: 'presentation_package_conflict', conflictCode: code })); await tick();
    const tree = ui.render(context), html = renderToStaticMarkup(tree), together = ['presentation_shared_dealer_conflict', 'presentation_shared_layer_conflict', 'presentation_legacy_package_conflict'].includes(code);
    assert.equal(h.controller.getSnapshot().status, 'unavailable');
    assert.equal(find(tree, 'a').props.href, together ? '#operator-package-selection' : labBasePath() + '/control/administration?tab=tables');
    assert.match(html.slice(html.indexOf('</details>')), together ? /Granska hela paketurvalet/ : /Kontrollera Bord &amp; spelrum/);
    if (together) assert.match(html, /publicera alla dessa presentationer tillsammans först.*Behåll befintliga rum och dealers/);
    else assert.doesNotMatch(html, /publicera alla dessa presentationer/);
    const message = h.controller.getSnapshot().message; h.controller.setName('Nytt rum');
    assert.equal(h.controller.getSnapshot().message, message);
    find(tree, 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests.length, 1); assert.equal(h.keys, 0); ui.unmount();
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
