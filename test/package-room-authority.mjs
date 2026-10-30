import test from 'node:test';
import assert from 'node:assert/strict';
import { createPglitePool } from './fixtures/pglite-pool.mjs';
import { applyStudioMigrations, planStudioMigrations } from '../ops/neon-studio/migrations.mjs';
import { createStudioRepository } from '../packages/studio-registry/server/document-repository.mjs';
import { createOperatorStore } from '../packages/operators/server/operator-store.mjs';
import { studioContentHash } from '../packages/studio-registry/server/document-contract.mjs';

const scope = {environment:'room-authority',workspaceId:'isolated'};
const room = (id, operatorId, state='live') => ({schemaVersion:2,id,name:id,operatorId,presentationLaneId:'lane-a',gameLaneId:'game-a',state});
const rejected = code => error => error?.code === code;
async function fixture(t) {
  const pool=await createPglitePool();t.after(()=>pool.end());
  await applyStudioMigrations({pool,expectedTarget:(await planStudioMigrations({pool})).target,confirm:true});
  const repository=createStudioRepository({pool,scope}),store=await createOperatorStore({sql:pool,scope});
  await repository.initializeDocument('administration',{value:{rooms:[],gameLane:null,gameLanes:[]},revision:'admin-1',actor:'test'});
  for(const operatorId of ['north','south'])await store.createOperator({operatorId,slug:operatorId,name:operatorId,actor:'test'});
  const publish=(operatorId,rooms,expectedRevision=null)=>store.publishPackage({actor:'test',operatorId,expectedRevision,lanes:['lane-a'],games:['blackjack'],tables:rooms.map(room=>room.id),rooms,branding:{name:operatorId}});
  const north=room('north-a','north','pending'),south=room('south-a','south');
  await publish('north',[north]);await publish('south',[south]);
  return {pool,repository,store,publish,north,south};
}

test('Admin projection uses scoped latest packages; stale stored rooms and old package history cannot grant or change a room',async t=>{
  const f=await fixture(t);
  await f.pool.query(`UPDATE croupier_studio.documents SET value=value || $3::jsonb WHERE environment_id=$1 AND workspace_id=$2`,
    [scope.environment,scope.workspaceId,JSON.stringify({rooms:[{...f.north,state:'live'},room('phantom','north')]})]);
  const saved=await f.repository.readDocument('administration');
  assert.deepEqual(saved.value.rooms,[f.north,f.south]);
  saved.value.rooms[0].state='live';
  assert.equal((await f.repository.readDocument('administration')).value.rooms[0].state,'pending');
  const foreign=createStudioRepository({pool:f.pool,scope:{...scope,workspaceId:'foreign'}});
  await foreign.initializeDocument('administration',{value:{rooms:[]},actor:'test'});
  assert.deepEqual((await foreign.readDocument('administration')).value.rooms,[]);
  const snapshot=await f.repository.exportSnapshot();
  assert.equal(Object.hasOwn(snapshot.documents[0].value,'rooms'),false);
  assert.deepEqual(await f.repository.importSnapshot(snapshot,{actor:'test',expectedTargetEmpty:true}),{imported:0,replayed:true},'export/import ignores the retired raw field without changing rooms');
  const before=await f.store.getCurrentPackage('north');
  const changed=await f.repository.saveDocument('administration',{value:(await f.repository.readDocument('administration')).value,expectedRevision:saved.revision,actor:'retire-legacy-rooms'});
  const raw=(await f.pool.query(`SELECT value FROM croupier_studio.documents WHERE environment_id=$1 AND workspace_id=$2`,[scope.environment,scope.workspaceId])).rows[0].value;
  assert.equal(Object.hasOwn(raw,'rooms'),false);
  assert.deepEqual((await f.repository.listDocumentHistory('administration'))[0].value.rooms.map(room=>room.id),['north-a','phantom']);
  assert.deepEqual(await f.store.getCurrentPackage('north'),before,'document cleanup never republishes material or changes room state');
  assert.notEqual(changed.revision,saved.revision);
});

test('a document write cannot change rooms without matching package publication, while one atomic pause preserves other rooms and history',async t=>{
  const f=await fixture(t),initial=await f.repository.readDocument('administration');
  const edited=structuredClone(initial.value);edited.rooms[0].state='live';
  await assert.rejects(f.repository.saveDocument('administration',{value:edited,expectedRevision:initial.revision,actor:'test'}),rejected('studio_room_publication_required'));
  assert.equal((await f.repository.readDocument('administration')).revision,initial.revision);
  assert.equal((await f.repository.listDocumentHistory('administration')).length,0);
  const before=await f.store.getCurrentPackage('south');
  await f.repository.transaction(()=>f.repository.withTransactionClient(async client=>{
    const store=await createOperatorStore({sql:client,scope,transaction:work=>f.repository.withTransactionClient(work)});
    await f.repository.saveDocument('administration',{value:edited,expectedRevision:initial.revision,actor:'test'});
    await store.publishPackage({actor:'test',operatorId:'north',expectedRevision:1,lanes:['lane-a'],games:['blackjack'],tables:[f.north.id],rooms:[edited.rooms[0]],branding:{name:'north'}});
  }));
  assert.deepEqual((await f.repository.readDocument('administration')).value.rooms,edited.rooms);
  assert.deepEqual(await f.store.getCurrentPackage('south'),before);
  assert.equal((await f.store.getPackage('north',1)).rooms[0].state,'pending');
  assert.equal((await f.repository.listDocumentHistory('administration')).length,1);
});

test('missing current package room migration fails closed and document-only snapshots cannot restore legacy rooms',async t=>{
  const f=await fixture(t),snapshot=await f.repository.exportSnapshot();
  await f.pool.query(`UPDATE croupier_studio.operator_packages SET rooms=NULL WHERE environment_id=$1 AND workspace_id=$2 AND operator_id='north'`,[scope.environment,scope.workspaceId]);
  await assert.rejects(f.repository.readDocument('administration'),rejected('studio_package_rooms_migration_required'));
  const target={...scope,workspaceId:'restore'};snapshot.scope=target;snapshot.documents[0].value.rooms=[f.north];snapshot.documents[0].checksum=studioContentHash(snapshot.documents[0].value);
  await assert.rejects(createStudioRepository({pool:f.pool,scope:target}).importSnapshot(snapshot,{actor:'test',expectedTargetEmpty:true}),rejected('studio_room_publication_required'));
});


test('an older empty-room snapshot imports and replays without writing a room registry',async t=>{
  const f=await fixture(t),snapshot=await f.repository.exportSnapshot(),target={...scope,workspaceId:'empty-restore'};
  snapshot.scope=target;snapshot.documents[0].value.rooms=[];snapshot.documents[0].checksum=studioContentHash(snapshot.documents[0].value);
  const repository=createStudioRepository({pool:f.pool,scope:target}),options={actor:'restore',expectedTargetEmpty:true};
  assert.deepEqual(await repository.importSnapshot(snapshot,options),{imported:1,replayed:false});
  assert.deepEqual(await repository.importSnapshot(snapshot,options),{imported:0,replayed:true});
  assert.equal(Object.hasOwn((await repository.exportSnapshot()).documents[0].value,'rooms'),false);
});

test('partner pause authority follows immutable package state and cannot survive an Admin pause or archive/restore',async t=>{
  const f=await fixture(t),partner={actorId:'42',accessClass:'partner',requestId:'10000000-0000-4000-8000-000000000001'},admin={actorId:'7',accessClass:'internal-admin',requestId:'10000000-0000-4000-8000-000000000002'};
  let current=await f.store.getCurrentPackage('north');
  const publish=async(state,audit,extra={})=>current=await f.store.publishPackage({actor:'test',audit,operatorId:'north',expectedRevision:current.revision,
    lanes:['lane-a'],games:['blackjack'],tables:[f.north.id],rooms:[{...f.north,state}],branding:{name:'north'},roomState:{roomId:f.north.id,state},...extra});
  const mayOpen=()=>f.store.isRoomPausedByPartner('north',f.north.id,current.revision);
  await publish('live',admin);await publish('pending',partner);
  const paused=current.revision;
  const document=await f.repository.readDocument('administration');
  await f.repository.saveDocument('administration',{actor:'test',expectedRevision:document.revision,value:{...document.value,voiceReview:{checked:true}}});
  current=await f.store.publishPackage({actor:'test',operatorId:'north',expectedRevision:current.revision,lanes:current.lanes,games:current.games,tables:current.tables,branding:{name:'new branding'}});
  assert.equal(await mayOpen(),true);
  // Model original immutable pre-023 rows in this isolated fixture only.
  await f.pool.query('UPDATE croupier_studio.operator_packages SET rooms=NULL WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND package_revision=$4',[scope.environment,scope.workspaceId,'north',paused]);
  assert.equal(await mayOpen(),true,'explicit pause event plus uninterrupted membership spans old NULL rooms');
  assert.equal(await f.store.isRoomPausedByPartner('south',f.north.id,current.revision),false);
  await publish('live',admin);await publish('pending',admin);assert.equal(await mayOpen(),false);
  await publish('live',admin);await publish('pending',partner);
  current=await f.store.publishPackage({actor:'test',operatorId:'north',expectedRevision:current.revision,lanes:current.lanes,games:current.games,tables:[],branding:{}});
  current=await f.store.publishPackage({actor:'test',operatorId:'north',expectedRevision:current.revision,lanes:current.lanes,games:current.games,tables:[f.north.id],rooms:[f.north],branding:{}});
  assert.equal(await mayOpen(),false,'archive and restore cannot inherit the former partner pause');
});
