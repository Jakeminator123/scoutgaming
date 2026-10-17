import * as savedGameDocumentContract from '../packages/studio-registry/server/document-contract.mjs';

import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPresentationLane } from '../packages/presentation/contracts/studio-model.mjs';
import { cloudPresentationFixture } from '../lab/test/fixtures/cloud-presentation.mjs';
import { createSavedGamePolicy } from '../packages/presentation/server/saved-game-policy.mjs';
import {isPresentationRoom} from '../packages/presentation/contracts/presentation-room.mjs';
import {listPackageRooms, resolvePackageRoom, inspectPackageRooms} from '../packages/presentation/server/package-rooms.mjs';
import { createGameEntrySelector } from '../packages/presentation/server/game-entry-selector.mjs';
import { layerAssetPath } from '../packages/presentation/contracts/presentation-layers.mjs';
import { defaultCompositionSettings } from '../packages/presentation/contracts/composition-settings.mjs';
import { withPackagePresentation,readPackagePresentation } from '../packages/presentation/server/presentation-package.mjs';
import {materialSource} from '../packages/presentation/contracts/material-catalog.mjs';
import {assertPresentationRoomMaterials} from '../packages/presentation/contracts/presentation-material-game.mjs';

const { validateStudioGameAdministration } = createSavedGamePolicy({ documentContract: savedGameDocumentContract });

const legacy = { id: 'old-room', name: 'Old', scene: 'Dark', felt: 'Green', dealer: 'vera', state: 'live' };
const room = { schemaVersion: 2, id: 'room-one', name: 'North table', operatorId: 'north', presentationLaneId: 'mobile-phone', gameLaneId: 'mobile-phone', state: 'live' };
function fixture() {
  const { project, presentation } = cloudPresentationFixture({lanes:[defaultPresentationLane('astrid')]});
  const administration = { rooms: [legacy, structuredClone(room)], tiers: { classic: 'vera', high: 'astrid', vip: 'amira' }, pitboss: { payout10x: true, streak5: true, randomWalkMin: 45 }, tournaments: [] };
  administration.gameLane = 'mobile-phone';
  administration.gameLanes = [{schemaVersion:1,id:'mobile-phone',label:'Explicit portrait',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'}];
  const pack = { operatorId: 'north', revision: 1, lanes: ['mobile-phone'], tables: ['room-one'], branding: withPackagePresentation({}, presentation) };
  const policy = { readSaved: async () => ({ project, administration }), readGameConfiguration: async () => administration };
  return { project, administration, pack, policy };
}
test('administration validates the closed legacy/v2 union without rewriting legacy rooms', () => {
  const { administration } = fixture();
  const checked = validateStudioGameAdministration(administration);
  assert.deepEqual(checked.rooms, [legacy, room]); assert.equal(isPresentationRoom(legacy), false);
  for (const changes of [{ schemaVersion: 1 }, { dealer: 'astrid' }, { operatorId: '' }, { id: '../room' }, { state: 'closed' }, { gameLaneId: 'original' }, { name: ' x' }]) {
    const next = structuredClone(administration); Object.assign(next.rooms[1], changes);
    assert.throws(() => validateStudioGameAdministration(next), error => error.statusCode === 422);
  }
  const duplicate = structuredClone(administration); duplicate.rooms[1].id = legacy.id;
  assert.throws(() => validateStudioGameAdministration(duplicate));
});
test('new material tags preserve both authorised historical sibling game entries while new publication stays strict',async()=>{
  const f=fixture(),frozen=structuredClone(readPackagePresentation(f.pack));
  const {kind,hasAlpha,...source}=materialSource('blackjack-green-felt');
  const table={schemaVersion:1,id:'00000000-0000-4000-8000-000000000991',role:'table',label:'Supplied blackjack',...source};table.pathname=layerAssetPath(table);
  frozen.assets=[...frozen.assets,table];frozen.lanes[0].layers.table={...frozen.lanes[0].layers.table,enabled:true,default:table.id,allowed:[table.id]};
  const bad={...room,id:'room-roulette',name:'Historical roulette',game:'roulette'};
  f.administration.rooms.push(bad);f.pack.tables.push(bad.id);f.pack.games=['blackjack','roulette'];f.pack.branding=withPackagePresentation(f.pack.branding,frozen);
  const before=JSON.stringify({pack:f.pack,administration:f.administration});
  const input={administration:f.administration,package:f.pack,operatorId:'north'};
  assert.deepEqual(inspectPackageRooms(input).map(row=>[row.room.id,row.materialsCompatible]),[[room.id,true],[bad.id,false]]);
  assert.deepEqual(listPackageRooms(input).map(row=>row.id),[room.id,bad.id]);
  assert.equal(resolvePackageRoom({...input,roomId:bad.id}).id,bad.id);
  const select=createGameEntrySelector({policy:f.policy,packages:{resolve:async()=>({operator:{id:'north',slug:'north',status:'active'},package:f.pack})},game:'any',log(){}});
  assert.equal((await select('operator=north&table='+room.id)).status,200);
  assert.equal((await select('operator=north&table='+bad.id)).status,200);
  assert.throws(()=>assertPresentationRoomMaterials(frozen,bad),error=>error.code==='studio_presentation_game_material_mismatch'&&error.statusCode===422);
  assert.equal(JSON.stringify({pack:f.pack,administration:f.administration}),before);
});
test('package room IDs alone never grant ownership; readers require owner, package tables and both lanes', () => {
  const { administration, pack } = fixture();
  const input = { administration, package: pack, operatorId: 'north', roomId: room.id };
  assert.deepEqual(resolvePackageRoom(input), room);
  const detached = listPackageRooms(input); detached[0].name = 'changed'; assert.equal(administration.rooms[1].name, room.name);
  for (const change of [
    value => value.operatorId = 'south', value => value.package.operatorId = 'south', value => value.package.tables = [],
    value => value.administration.rooms[1].operatorId = 'south',
    value => value.administration.rooms[1].gameLaneId = 'other', value => value.administration.rooms[1].presentationLaneId = 'other',
    value => value.roomId = legacy.id,
  ]) { const next = structuredClone(input); change(next); assert.equal(resolvePackageRoom(next), null); }
  const corrupt = structuredClone(input); corrupt.package.lanes = [];
  assert.throws(() => resolvePackageRoom(corrupt), error => error.statusCode === 503);
});
test('explicit table chooses its owned room and preserves the caller query; absent table keeps existing entry behavior', async () => {
  const { policy, pack } = fixture();
  const select = createGameEntrySelector({ policy, packages: { resolve: async () => ({ operator: { id: 'north' }, package: pack }) } });
  const query = new URLSearchParams('operator=north&table=room-one&lane=other');
  const entry = await select(query);
  assert.equal(entry.status, 200); assert.equal(entry.selection.roomId, room.id); assert.equal(entry.selection.lane, room.gameLaneId);
  assert.equal(query.get('lane'), 'other');
  assert.equal((await select('?operator=north')).status, 200);
  for (const query of ['?table=room-one', '?operator=north&table=missing', '?operator=north&table=old-room', '?operator=north&table=room-one&table=room-one', '?operator=north&table=../room']) {
    assert.equal((await select(query)).status, 404);
  }
});
test('explicit room never falls back during suspended, foreign, missing package or unavailable storage conditions', async () => {
  const { policy, administration, pack } = fixture();
  const select = context => createGameEntrySelector({ policy, packages: { resolve: async () => context } });
  assert.equal((await select({ operator: null })('?operator=north&table=room-one')).status, 404);
  assert.equal((await select({ operator: { id: 'north', status: 'suspended' }, package: pack })('?operator=north&table=room-one')).status, 404);
  assert.equal((await select({ operator: { id: 'south' }, package: pack })('?operator=north&table=room-one')).status, 404);
  assert.equal((await select({ operator: { id: 'north' }, package: null })('?operator=north&table=room-one')).status, 404);
  await assert.rejects(select(null)('?operator=north&table=room-one'), error => error.statusCode === 503);
  for (const state of ['preview', 'pending']) { administration.rooms[1].state = state; assert.equal((await select({ operator: { id: 'north' }, package: pack })('?operator=north&table=room-one')).status, 404); }
});

test('a VIP presentation binds a different real game lane without adding artificial package lanes or losing frozen choices', async () => {
  const { project, administration } = fixture();
  const before = createGameEntrySelector({ policy: { readSaved: async () => ({ project, administration }), readGameConfiguration: async () => administration } });
  const old = await before('');
  const vip = structuredClone(project.lanes[0]); vip.id = 'vip-presentation'; vip.label = 'VIP';
  vip.composition = defaultCompositionSettings(); vip.composition.mobile.table.y = .12;
  const assets = ['background', 'table'].map((role, index) => {
    const record = { schemaVersion: 1, id: `00000000-0000-4000-8000-00000000000${index + 1}`, role, label: role, sha256: 'a'.repeat(64), size: 128, contentType: 'image/png', width: 720, height: 1280 };
    return { ...record, pathname: layerAssetPath(record) };
  });
  vip.layers.background = { enabled: true, mode: 'image', allowed: [assets[0].id], default: assets[0].id };
  vip.layers.table = { enabled: true, allowed: [assets[1].id], default: assets[1].id, colors: ['#123abc'] };
  project.lanes.push(vip); project.layerAssets = assets;
  administration.rooms[1].presentationLaneId = vip.id;
  administration.rooms[1].gameLaneId = 'compatible-portrait';
  administration.gameLane = 'mobile-phone';
  administration.gameLanes = ['mobile-phone', 'compatible-portrait'].map(id => ({ schemaVersion: 1, id, label: id, renderer: 'portrait-video', dealer: 'astrid', mediaCollection: 'astrid-presentation' }));
  const {presentation} = cloudPresentationFixture({project,lanes:[vip],assets});
  const pack = { operatorId: 'north', revision: 1, lanes: [vip.id], tables: [room.id], branding: withPackagePresentation({}, presentation) };
  const select = createGameEntrySelector({ policy: { readSaved: async () => ({ project, administration }), readGameConfiguration: async () => administration },
    packages: { resolve: async () => ({ operator: { id: 'north' }, package: pack }) } });
  // The source draft may change; the live room uses only its frozen package.
  vip.layers.table.colors = ['#ffffff']; vip.composition.mobile.table.y = .8;
  const entry = await select('?operator=north&table=room-one&lane=vip-presentation');
  assert.equal(entry.status, 200); assert.equal(entry.selection.lane, 'compatible-portrait'); assert.equal(entry.selection.roomId, room.id);
  assert.deepEqual(entry.selection.choices.tableColors, ['#123abc']);
  assert.deepEqual(entry.selection.choices.background.allowed, [assets[0].id]);
  assert.equal(entry.selection.composition.settings.mobile.table.y, .12);
  assert.equal(entry.selection.composition.assets.length, 2); assert.deepEqual(pack.lanes, ['vip-presentation']);
  assert.deepEqual(await before(''), old, 'the unscoped legacy entry must not acquire VIP layers');
});
