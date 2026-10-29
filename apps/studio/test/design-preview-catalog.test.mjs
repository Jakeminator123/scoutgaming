import test from 'node:test';
import assert from 'node:assert/strict';
import { registeredDesignCatalog, serveDesignCatalog } from '../lib/design-preview-catalog.mjs';
import { createPortraitRoomEntryFixture } from '../../../test/fixtures/portrait-room-entry.mjs';
import { addDealer } from '../../../packages/presentation/contracts/studio-model.mjs';
import { parseLobbyCatalog, lobbySelection, playUrlFor } from '../client/lobby/lib/catalog.mjs';
import {withOperatorLifecycle} from '../../../packages/operators/server/operator-lifecycle.mjs';
import {operatorLifecycleGroups} from '../client/admin/lib/studio-resource-lifecycle.mjs';
import {readPackagePresentation,withPackagePresentation} from '../../../packages/presentation/server/presentation-package.mjs';
import {materialSource} from '../../../packages/presentation/contracts/material-catalog.mjs';
import {layerAssetPath} from '../../../packages/presentation/contracts/presentation-layers.mjs';

function fixture() {
  const f = createPortraitRoomEntryFixture({ operator: 'north', dealer: 'linnea' });
  f.project = addDealer(f.project, 'unpublished', 'Unpublished dealer');
  const operators = [{ id: f.room.operatorId, slug: 'north', name: 'North', status: 'active', secret: 'private-operator-field' },
    { id: 'another', slug: 'another', name: 'Another', status: 'suspended' }];
  f.administration.rooms.push({ ...f.room, id: 'not-published', name: 'Draft room' },
    { ...f.room, id: 'other-room', operatorId: 'another', name: 'Another room' });
  const saved = { project: f.project, administration: f.administration, projectRevision: 'project-7', administrationRevision: 'admin-3' };
  const store = { listOperators: async () => operators, getCurrentPackage: async id => id === f.room.operatorId ? f.pack : null };
  const policy = { readSaved: async () => saved };
  return { ...f, saved, store, policy, operators };
}

test('registered admin and published lobby share exact identities without private media or fixture substitution', async () => {
  const f = fixture(), before = structuredClone(f.saved);
  const result = await registeredDesignCatalog({ ...f, now: () => 0 });
  assert.equal(result.source, 'registered');
  assert.equal(result.readAt, '1970-01-01T00:00:00.000Z');
  assert.equal(result.administration.operators.length, 2);
  assert.equal(result.administration.rooms.length, 3);
  assert.equal(result.administration.operators[0].packageRevision, 7);
  assert.ok(result.administration.dealers.some(row => row.id === 'unpublished'));
  assert.deepEqual(result.lobby.catalogs.map(row => row.operator.slug), ['north']);
  assert.deepEqual(result.lobby.catalogs[0].rooms.map(row => row.id), [f.room.id]);
  assert.deepEqual(result.lobby.catalogs[0].rooms[0].dealers.map(row => row.id), ['linnea']);
  assert.equal(result.administration.rooms.find(row => row.id === 'not-published').playable, false);
  assert.equal(result.administration.rooms.find(row => row.id === 'not-published').environment, null);
  assert.doesNotMatch(JSON.stringify(result), /private-operator-field|sha256|pathname|croupier\/media|_scoutPresentation|salt|password/);
  assert.deepEqual(f.saved, before);
  const lobby = parseLobbyCatalog(result);
  const choice = lobbySelection(lobby, { operatorId: 'north', roomKey: 'north:' + f.room.id, dealerId: 'linnea' });
  const adminRoom = result.administration.rooms.find(row => row.id === f.room.id);
  assert.equal(adminRoom.environment.label, choice.room.environmentLabel);
  assert.equal(adminRoom.environment.fixed, choice.room.environmentFixed);
  assert.equal(playUrlFor(choice), '/game?game=blackjack&operator=north&table=' + f.room.id + '&dealer=linnea');
  assert.equal(lobbySelection(lobby, { operatorId: 'another', roomKey: 'north:' + f.room.id, dealerId: 'linnea' }).dealer, null);
});
test("the lobby shows the published miljöbild, Admin the saved one, and no bet profile picks a picture", async () => {
  const f = fixture();
  f.saved.administration.roomGameConfigs = [{ operatorId: f.room.operatorId, roomId: f.room.id, gameConfig: { language: 'sv', limitPreset: 'high' } }];
  f.store.getPublishedRoomLimitPresets = async () => new Map([[f.room.id, 'casual']]);
  const plain = await registeredDesignCatalog(f);
  assert.equal(plain.lobby.catalogs[0].rooms[0].limitPreset, 'casual');
  assert.equal(Object.hasOwn(plain.administration.rooms.find(row => row.id === f.room.id), 'savedLimitPreset'), false, 'the bet profile is not a picture source');
  assert.equal(parseLobbyCatalog(plain).rooms[0].illustration.image, '/admin/_assets/lobby/images/lobby/room-salongen.png');
  assert.equal(parseLobbyCatalog(plain).rooms[0].image, undefined);
  // Publish a miljöbild with the room's environment, and save a newer one in the project.
  const picture = (id, label) => { const asset = { schemaVersion: 1, id, role: 'illustration', label, sha256: id.replaceAll('-', '').padEnd(64, 'a').slice(0, 64), size: 4096, contentType: 'image/webp', width: 1920, height: 1080 }; asset.pathname = layerAssetPath(asset); return asset; };
  const published = picture('00000000-0000-4000-8000-0000000000a1', 'Studion · miljöbild v1'), saved = picture('00000000-0000-4000-8000-0000000000a2', 'Studion · miljöbild v2');
  assert.match(published.pathname, /^croupier\/media\/illustrations\//);
  const frozen = structuredClone(readPackagePresentation(f.pack)), laneId = f.room.presentationLaneId;
  frozen.assets.push(published); frozen.lanes.find(lane => lane.id === laneId).illustration = published.id;
  f.pack.branding = withPackagePresentation(f.pack.branding, frozen);
  f.saved.project = { ...f.saved.project, layerAssets: [...(f.saved.project.layerAssets ?? []), saved],
    lanes: f.saved.project.lanes.map(lane => lane.id === laneId ? { ...lane, illustration: saved.id } : lane) };
  const result = await registeredDesignCatalog(f);
  assert.equal(result.lobby.catalogs[0].rooms[0].illustration, published.id);
  const room = parseLobbyCatalog(result).rooms[0];
  assert.equal(room.image, '/api/presentation/layers/north/' + published.id, 'the lobby reads the published package, never the draft');
  const adminRoom = result.administration.rooms.find(row => row.id === f.room.id);
  assert.equal(adminRoom.illustration, '/studio/api/layer-assets/' + saved.id, "Admin's room picture follows the saved environment");
  assert.equal(result.administration.compositions.find(row => row.id === laneId).illustration, '/studio/api/layer-assets/' + saved.id);
  assert.doesNotMatch(JSON.stringify(result.lobby), /croupier\/media|sha256/);
});
test('admin and public readers preserve historical sibling grants and expose the new catalogue warning',async()=>{
  const f=fixture(),frozen=structuredClone(readPackagePresentation(f.pack));
  const {kind,hasAlpha,...source}=materialSource('blackjack-green-felt');
  const table={schemaVersion:1,id:'00000000-0000-4000-8000-000000000992',role:'table',label:'Supplied blackjack',...source};table.pathname=layerAssetPath(table);
  frozen.assets=[...frozen.assets,table];frozen.lanes[0].layers.table={...frozen.lanes[0].layers.table,enabled:true,default:table.id,allowed:[table.id]};
  const bad={...f.room,id:'historical-roulette',name:'Historical roulette',game:'roulette'};
  f.administration.rooms.push(bad);f.pack.tables.push(bad.id);f.pack.games.push('roulette');f.pack.branding=withPackagePresentation(f.pack.branding,frozen);
  const before=JSON.stringify({saved:f.saved,pack:f.pack});
  const result=await registeredDesignCatalog(f),good=result.administration.rooms.find(row=>row.id===f.room.id),historical=result.administration.rooms.find(row=>row.id===bad.id);
  assert.equal(good.published,true);assert.equal(good.playable,true);assert.ok(good.playUrl);
  assert.equal(historical.published,true);assert.equal(historical.playable,true);assert.ok(historical.playUrl);
  assert.equal(historical.materialWarning,'catalog_game_material_mismatch');
  assert.deepEqual(result.lobby.catalogs[0].rooms.map(row=>row.id),[f.room.id,bad.id]);
  assert.equal(JSON.stringify({saved:f.saved,pack:f.pack}),before);
});
test('registered catalog exposes protected archive identity separately from legacy suspended companies',async()=>{
  const f=fixture(),archivedAt='2026-10-13T00:00:00.000Z';f.operators[0].status='suspended';
  f.pack.branding=withOperatorLifecycle(f.pack.branding,{schemaVersion:1,operator:{archivedAt},rooms:[]});
  const result=await registeredDesignCatalog(f),groups=operatorLifecycleGroups(result.administration.operators);
  assert.deepEqual(groups.active,[]);assert.deepEqual(groups.trash.map(row=>row.slug),['north']);
  assert.equal(groups.trash[0].archivedAt,archivedAt);assert.deepEqual(groups.suspended.map(row=>row.slug),['another']);
  assert.equal(groups.suspended[0].archivedAt,null);assert.deepEqual(result.lobby.catalogs,[]);
});

test('preview rooms and suspended operators never enter the playable lobby; genuine empty data stays empty', async () => {
  const f = fixture();
  f.administration.rooms[0].state = 'preview';
  assert.deepEqual((await registeredDesignCatalog(f)).lobby.catalogs, []);
  f.administration.rooms[0].state = 'live'; f.operators[0].status = 'suspended';
  assert.deepEqual((await registeredDesignCatalog(f)).lobby.catalogs, []);
  const empty = await registeredDesignCatalog({ store: { listOperators: async () => [] }, policy: {
    readSaved: async () => ({ project: { dealers: [], lanes: [] }, administration: { rooms: [] }, projectRevision: 'a', administrationRevision: 'b' }),
  } });
  assert.deepEqual(empty.administration.operators, []);
  assert.deepEqual(empty.administration.dealers, []);
  assert.deepEqual(empty.lobby.catalogs, []);
});

test('storage failure and cross-operator package mismatch fail closed', async () => {
  const f = fixture();
  await assert.rejects(registeredDesignCatalog({ ...f, store: { ...f.store, listOperators: async () => { throw Error('offline'); } } }), /offline/);
  await assert.rejects(registeredDesignCatalog({ ...f, store: { ...f.store, getCurrentPackage: async () => ({ ...f.pack, operatorId: 'other' }) } }), error => error.statusCode === 503);
});

test('a published non-live room retains frozen dealers after saved composition edits', async () => {
  const f = fixture();
  f.administration.rooms[0].state = 'preview';
  f.project.lanes[0].dealers = ['unpublished'];
  f.project.lanes[0].layers.dealer = { enabled: true, default: 'unpublished', allowed: ['unpublished'] };
  const result = await registeredDesignCatalog(f);
  const room = result.administration.rooms.find(row => row.id === f.room.id);
  assert.equal(room.published, true); assert.equal(room.playable, false);
  assert.deepEqual(room.dealerIds, ['linnea']);
  assert.equal(room.dealerSource, 'published');
  assert.equal(room.dealers[0].name, 'Linnea');
  const draft = result.administration.rooms.find(row => row.id === 'not-published');
  assert.equal(draft.dealerSource, 'saved'); assert.deepEqual(draft.dealerIds, ['unpublished']);
});

test('catalog request reauthorizes before reads, accepts GET/HEAD only and never caches by session', async () => {
  let reads = 0, authorizations = 0;
  const request = new Request('https://studio.test/admin/_data/catalog');
  const options = { authorize: async () => { authorizations++; }, readCatalog: async () => { reads++; return { schemaVersion: 1 }; } };
  const denied = Object.assign(new Error('denied'), { statusCode: 403 });
  await assert.rejects(serveDesignCatalog(request, { ...options, authorize: async () => { throw denied; } }), error => error === denied);
  assert.equal(reads, 0);
  const response = await serveDesignCatalog(request, options);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { schemaVersion: 1 });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Cookie');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  const head = await serveDesignCatalog(new Request(request.url, { method: 'HEAD' }), options);
  assert.equal(await head.text(), ''); assert.equal(authorizations, 2); assert.equal(reads, 2);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await serveDesignCatalog(new Request(request.url, { method }), options)).status, 405);
  assert.equal(authorizations, 2); assert.equal(reads, 2);
  const query = await serveDesignCatalog(new Request(request.url + '?operator=other'), options);
  assert.equal(query.status, 400); assert.equal(reads, 2);
});
