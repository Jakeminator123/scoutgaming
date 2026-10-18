import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPresentationLane} from '../packages/presentation/contracts/studio-model.mjs';
import {cloudPresentationFixture} from '../apps/studio/test/fixtures/cloud-presentation.mjs';
import {withPackagePresentation} from '../packages/presentation/server/presentation-package.mjs';
import {createGameEntrySelector} from '../packages/presentation/server/game-entry-selector.mjs';
import {createRouletteRoomAccess,validateRoomContext} from '../services/game/games/roulette/access.mjs';
import {createPublicOperatorRooms} from '../services/game/public-operator-rooms.mjs';
import {isPresentationRoom, roomPlayPath} from '../packages/presentation/contracts/presentation-room.mjs';
import {validatePublicOperatorRooms} from '../packages/presentation/contracts/operator-rooms-contract.mjs';
import {createFrozenDealerContextReader} from '../packages/presentation/server/frozen-dealer-presentation.mjs';
import {canonicalStudioJson} from '../packages/studio-registry/server/document-contract.mjs';

function fixture() {
  const {project,presentation}=cloudPresentationFixture({lanes:[defaultPresentationLane('astrid')]});
  const room={schemaVersion:2,id:'roulette-one',name:'North Roulette',operatorId:'north',presentationLaneId:'mobile-phone',gameLaneId:'mobile-phone',state:'live',game:'roulette'};
  const blackjack={...room,id:'blackjack-one',name:'North Blackjack'};delete blackjack.game;
  const administration={rooms:[room,blackjack],gameLane:'mobile-phone',gameLanes:[{schemaVersion:1,id:'mobile-phone',label:'Portrait',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'}]};
  const pack={operatorId:'north',revision:1,lanes:['mobile-phone'],games:['blackjack','roulette'],tables:[room.id,blackjack.id],branding:withPackagePresentation({},presentation)};
  const operator={id:'north',slug:'north',name:'North',status:'active'};
  const policy={readSaved:async()=>({project,administration}),readGameConfiguration:async()=>administration};
  const access=createRouletteRoomAccess({readCurrentContext:async()=>({operator,package:pack,administration})});
  const select=game=>createGameEntrySelector({game,policy,packages:{resolve:async()=>({operator,package:pack})}});
  return {room,blackjack,administration,pack,operator,policy,access,select};
}
test('both games share a frozen composition while entry routes enforce their own game type',async()=>{
  const f=fixture();
  assert.equal(isPresentationRoom(f.room),true);assert.equal(isPresentationRoom(f.blackjack),true);
  for(const game of [null,undefined,'poker',1]) assert.equal(isPresentationRoom({...f.room,game}),false);
  assert.equal((await f.select('blackjack')('?operator=north&table=roulette-one')).status,404);
  assert.equal((await f.select('roulette')('?operator=north&table=blackjack-one')).status,404);
  const resolved=await f.access({operator:'north',table:f.room.id});
  assert.equal(resolved.room.operatorId,'north');assert.equal(resolved.room.dealer,'astrid');
  assert.equal(roomPlayPath(f.room,'north'),'/play/roulette?operator=north&table=roulette-one');
  assert.equal(roomPlayPath(f.blackjack,'north'),'/play/blackjack?operator=north&table=blackjack-one');
  await resolved.recheck();f.pack.revision=2;await assert.rejects(resolved.recheck(),/roulette_room_changed/);
});
test('public catalog retains separate game links, media and dealer choices',async()=>{
  const f=fixture(),reader=createPublicOperatorRooms({policy:f.policy,store:{getOperatorBySlug:async()=>f.operator,getCurrentPackage:async()=>f.pack}});
  const catalog=await reader.read('north');assert.equal(catalog.rooms.length,2);
  assert.equal(catalog.rooms[0].game,'roulette');assert.equal('game' in catalog.rooms[1],false);
  assert.match(catalog.rooms[0].playUrl,/^\/play\/roulette\?/);
  assert.equal(catalog.rooms[0].dealers[0].id,'astrid');
  const forged=structuredClone(catalog);forged.rooms[0].playUrl=forged.rooms[0].playUrl.replace('roulette?','blackjack?');
  assert.throws(()=>validatePublicOperatorRooms(forged));
  f.pack.games=['blackjack'];assert.equal((await reader.read('north')).rooms.length,1);
});
test('wrong tenant, unpublished room, suspended operator and revoked game never authorize a spin',async()=>{
  for(const mutate of [f=>f.operator.status='suspended',f=>f.room.state='pending',f=>f.room.operatorId='south',f=>f.pack.games=['blackjack'],f=>f.pack.tables=[]]) {
    const f=fixture();mutate(f);await assert.rejects(f.access({operator:'north',table:f.room.id}),error=>error.statusCode===404);
  }
  const f=fixture();await assert.rejects(f.access({operator:'south',table:f.room.id}),error=>error.statusCode===404);
  for(const context of [{},{operator:['north'],table:'roulette-one'},{operator:'north',table:['roulette-one']},{operator:'north',table:'roulette-one',dealer:['astrid']},{operator:'north',table:'roulette-one',number:7}]) assert.throws(()=>validateRoomContext(context));
  const ready=await f.access({operator:'north',table:f.room.id});f.operator.status='suspended';await assert.rejects(ready.recheck());
});

test('the real publication recheck uses one scoped snapshot on the held transaction client',async()=>{
  const f=fixture(),scope={environment:'roulette-test',workspaceId:'isolated'};
  const scopeColumns={environment_id:scope.environment,workspace_id:scope.workspaceId};
  const row={operator:{...scopeColumns,operator_id:'north',slug:'north',name:'North',status:'active',created_at_ms:1},
    package:{...scopeColumns,operator_id:'north',package_revision:1,published_at_ms:1,
      lanes:canonicalStudioJson([...f.pack.lanes].sort()),games:canonicalStudioJson([...f.pack.games].sort()),tables:canonicalStudioJson([...f.pack.tables].sort()),branding:canonicalStudioJson(f.pack.branding)},
    administration:{...f.administration,tiers:{classic:'vera',high:'astrid',vip:'amira'},tournaments:[],pitboss:{payout10x:true,streak5:true,randomWalkMin:45}}};
  let queries=0;
  const reader=createFrozenDealerContextReader({scope,pool:{connect(){assert.fail('must reuse wallet client');}}});
  const client={async query(sql,values){queries++;assert.match(sql,/operator-store:presentation-context/);
    assert.deepEqual(values,[scope.environment,scope.workspaceId,'north']);return {rows:[structuredClone(row)]};}};
  const direct=createRouletteRoomAccess({readCurrentContext:reader});
  const ready=await direct({operator:'north',table:f.room.id},client);
  assert.equal(queries,1);await ready.recheck(client);assert.equal(queries,2);
  row.administration.rooms[0].state='preview';await assert.rejects(ready.recheck(client),/roulette_room_not_found/);
  row.operator.workspace_id='foreign';await assert.rejects(reader.inTransaction(client,'north'),/studio_corrupt_operator/);
});
