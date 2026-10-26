import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSharedRoomAccess} from '../services/game/shared-room-access.mjs';
import {createSharedRoomChannel} from '../services/game/shared-room-channel.mjs';
import {playerAuth} from '../services/game/storage/async-player-auth.mjs';
import {createStudioRepository} from '../packages/studio-registry/server/document-repository.mjs';
import {defaultPresentationLane} from '../packages/presentation/contracts/studio-model.mjs';
import {withPackagePresentation} from '../packages/presentation/server/presentation-package.mjs';
import {canonicalStudioJson,validateDocumentValue} from '../packages/studio-registry/server/document-contract.mjs';
import {ROOM_LIMIT_PRESETS,ROOM_GAME_TIMERS} from '../packages/presentation/contracts/room-game-config.mjs';
import {cloudPresentationFixture} from '../apps/studio/test/fixtures/cloud-presentation.mjs';
import {nativeRoomMaterialFixture,measuredFixtureRecord} from './fixtures/native-room-game-material.mjs';
import {resolveNativeRoomGameMaterial} from '../packages/presentation/server/native-room-game-material.mjs';

const scope={environment:'room-access-test',workspaceId:'isolated'},clone=structuredClone;
const token='a'.repeat(64),sessionId='player-'+createHash('sha256').update(token).digest('hex');
const denied={code:'studio_forbidden',statusCode:403};
const request=(cookie=`player_session=${token}`,options={})=>new Request('https://engine.invalid/shared-room/room-a',{headers:{origin:'https://ui.invalid',cookie},...options});
function fixture({realAuth=false}={}) {
  let now=1000,active=false,clientCount=0,releases=0,failAt=null,afterQuery=null;
  const cloud=cloudPresentationFixture({lanes:[defaultPresentationLane('linnea')]}),trace=[];
  const room=id=>({schemaVersion:2,id,name:id,operatorId:'north',presentationLaneId:'mobile-phone',gameLaneId:'room-lane',state:'live'});
  const rooms=[room('room-a'),room('room-b')],version=id=>`room-config-00000000-0000-4000-8000-${id==='room-a'?'1':'2'}00000000000`;
  const administration=validateDocumentValue('administration',{rooms,gameLane:'room-lane',gameLanes:[{schemaVersion:1,id:'room-lane',label:'Room',renderer:'portrait-video',dealer:'linnea',mediaCollection:'linnea-presentation'}]},'admin-1');
  const material={revision:'material-fixture-1',dealerId:'linnea',language:'sv',leadMs:1200,cardMs:880,media:cloud.mediaRows.map(({id,sha256})=>({id,sha256}))};
  const preset=ROOM_LIMIT_PRESETS.prive,configs={};
  for(const room of rooms)configs[room.id]={configVersion:version(room.id),roomId:room.id,operatorId:'north',packageRevision:1,presentationLaneId:room.presentationLaneId,
    presentationHash:createHash('sha256').update(canonicalStudioJson(cloud.presentation)).digest('hex'),language:'sv',limitPreset:'prive',...ROOM_GAME_TIMERS,
    limits:{min:preset.min,max:preset.max,sideMax:preset.sideMax},chips:[...preset.chips],refill:preset.refill,leadMs:material.leadMs,cardMs:material.cardMs,material:clone(material)};
  const pack={environment_id:scope.environment,workspace_id:scope.workspaceId,operator_id:'north',package_revision:1,lanes:'["mobile-phone"]',games:'["blackjack"]',tables:'["room-a","room-b"]',
    branding:withPackagePresentation({roomGameConfigVersions:Object.fromEntries(rooms.map(room=>[room.id,version(room.id)]))},cloud.presentation),published_at_ms:1};
  const state={administration,pack,operator:{environment_id:scope.environment,workspace_id:scope.workspaceId,operator_id:'north',slug:'north',name:'North',status:'active',created_at_ms:1},configs,
    heads:Object.fromEntries(rooms.map(room=>[room.id,version(room.id)])),session:{actorId:'player-a',sessionId,expiresAt:999999,partnerKeyId:null}};
  const pool={async connect(){assert.equal(active,false);clientCount++;trace.push('connect');return {async query(sql,values){
    const marker=/\/\* ([^ ]+) \*\//.exec(sql)?.[1];trace.push(marker??sql);
    if(sql==='BEGIN'){active=true;return {rows:[]};}
    if(sql==='COMMIT'||sql==='ROLLBACK'){assert.ok(active);active=false;return {command:sql,rows:[]};}
    assert.ok(active,'same active scoped SQL transaction');
    if(sql.startsWith('SET LOCAL ')||sql.startsWith('SELECT pg_advisory_xact_lock'))return {rows:[]};
    assert.deepEqual(values.slice(0,2),[scope.environment,scope.workspaceId]);
    if(failAt===marker)throw new Error('injected SQL infrastructure failure');
    let rows;
    if(marker==='studio:read-document')rows=[{kind:'administration',revision:'admin-1',value:state.administration,updated_at:'2026-10-22T00:00:00.000Z'}];
    else if(marker==='operator-store:operator-by-id')rows=values[2]===state.operator.operator_id?[state.operator]:[];
    else if(marker==='operator-store:current-package')rows=state.pack?[{...state.pack,branding:canonicalStudioJson(state.pack.branding)}]:[];
    else if(marker==='shared-room-access:config'){const id=values[2];rows=state.heads[id]?[{version:state.heads[id],body:clone(state.configs[id])}]:[];}
    else assert.fail('Unexpected read or write: '+sql);
    afterQuery?.(marker);return {rows:clone(rows)};
  },release(){assert.equal(active,false);releases++;trace.push('release');}};}};
  let authFailure=null,authAfter=null;
  const auth={async binding(req){trace.push('auth:binding');assert.equal(req.headers.cookie,`player_session=${token}`);if(authFailure)throw authFailure;authAfter?.();return clone(state.session);},
    async bindingById(id){trace.push('auth:revalidate');assert.equal(typeof id,'string');if(authFailure)throw authFailure;return id===sessionId?clone(state.session):null;}};
  if(realAuth) {
    const db={prepare(sql){return {async get(...args){trace.push('auth:sql');
      if(sql.includes('FROM player_sessions'))return state.session&&args[0]===sessionId.slice(7)?{player_id:state.session.actorId,source_stamp:null,display_name:null,expires:state.session.expiresAt}:undefined;
      if(sql==='SELECT status FROM players WHERE id=?')return {status:'active'};
      assert.fail('Unexpected auth query: '+sql);
    }};}};
    Object.assign(auth,playerAuth(db,()=>assert.fail('read-only auth cannot create players')));
    state.session.expiresAt=Date.now()+60000;now=Date.now();
  }
  const repository=createStudioRepository({pool,scope}),access=createSharedRoomAccess({auth,repository,scope,now:()=>now});
  return {access,auth,repository,state,trace,read:(roomId='room-a',req=request())=>access.authorize(req,{roomId}),setNow:value=>{now=value;},
    fail:marker=>{failAt=marker;},after:fn=>{afterQuery=fn;},authFail:error=>{authFailure=error;},authAfter:fn=>{authAfter=fn;},
    assertReleased(){assert.equal(active,false);assert.equal(clientCount,releases);}};
}

function nativeFixture() {
  const h=fixture(),native=nativeRoomMaterialFixture();
  h.state.administration.gameLanes[0].dealer='dragan';
  h.state.administration.gameLanes[0].mediaCollection='dragan-presentation';
  const recapture=()=>{
    h.state.pack.branding=withPackagePresentation({roomGameConfigVersions:h.state.pack.branding.roomGameConfigVersions},native.presentation,{allowExtended:true});
    for(const config of Object.values(h.state.configs))config.presentationHash=createHash('sha256').update(canonicalStudioJson(native.presentation)).digest('hex');
  };
  recapture();
  for(const room of h.state.administration.rooms){
    const material=resolveNativeRoomGameMaterial({room,language:'sv',package:{operatorId:'north',revision:1,
      tables:['room-a','room-b'],games:['blackjack'],lanes:['mobile-phone'],branding:h.state.pack.branding}});
    Object.assign(h.state.configs[room.id],{material,leadMs:material.leadMs,cardMs:material.cardMs});
  }
  return {...h,native,recapture};
}

test('native access recomputes the complete frozen material and preserves branding-only publication',async()=>{
  const h=nativeFixture(),before=clone(h.state),binding=await h.read();
  assert.deepEqual(await h.access.revalidate(binding),binding);assert.deepEqual(h.state,before);
  h.state.pack.package_revision=2;h.state.pack.branding.title='Another title';
  assert.equal((await h.read()).packageRevision,2);
  await assert.rejects(h.access.revalidate(binding),denied);h.assertReleased();
});

test('native access rejects a forged budget, revision or incomplete frozen media list',async()=>{
  for(const change of [config=>{config.material.leadMs--;config.leadMs--;},
    config=>{config.material.cardMs--;config.cardMs--;},config=>{config.material.revision='native-film-v1-'+'f'.repeat(64);},
    config=>{config.material.media.pop();}]){
    const h=nativeFixture();change(h.state.configs['room-a']);
    await assert.rejects(h.read(),denied);h.assertReleased();
  }
});

test('native access rejects changed measurements or approvals even with a refreshed outer presentation hash',async()=>{
  for(const change of [row=>measuredFixtureRecord(row,{audioEndUs:3000000}),row=>{row.classification.recordedSpeech.review={status:'pending'};}]){
    const h=nativeFixture(),binding=await h.read();
    change(h.native.records.find(row=>row.classification.situation==='placebets'));h.recapture();
    await assert.rejects(h.access.revalidate(binding),denied);h.assertReleased();
  }
});

test('explicit ports/scope and non-partner live session required before all registry reads',async()=>{
  const h=fixture();assert.throws(()=>createSharedRoomAccess({scope}),TypeError);
  assert.throws(()=>createSharedRoomAccess({auth:h.auth,repository:h.repository,scope:{...scope,workspaceId:'other'}}),TypeError);
  for(const value of [null,{...h.state.session,partnerKeyId:'key-a'},{actorId:'player-a',sessionId,expiresAt:999999},{...h.state.session,expiresAt:1000},{...h.state.session,sessionId:'raw-bearer'}]) {
    h.state.session=value;await assert.rejects(h.read(),denied);
  }
  assert.equal(h.trace.includes('connect'),false);
  for(const roomId of ['../room-a','room-a?actor=other','room-a/','%72oom-a','constructor'])await assert.rejects(h.read(roomId),denied);
});

test('server-owned binding uses real scoped SQL reader and contains no bearer/config/media',async()=>{
  const h=fixture(),before=clone(h.state),binding=await h.read();
  assert.deepEqual(binding,{actorId:'player-a',sessionId,expiresAt:999999,operatorId:'north',roomId:'room-a',packageRevision:1});
  assert.ok(Object.isFrozen(binding));assert.deepEqual(await h.access.revalidate(binding),binding);assert.deepEqual(h.state,before);
  const second=await h.read('room-b');assert.equal(second.roomId,'room-b');
  assert.ok(h.trace.indexOf('auth:binding')<h.trace.indexOf('connect'));
  assert.ok(h.trace.some(line=>line.includes('statement_timeout')));assert.ok(h.trace.some(line=>line.includes('pg_advisory_xact_lock')));
  assert.equal(h.trace.filter(line=>line==='shared-room-access:config').length,3);h.assertReleased();
});

test('revocation, changed identity and expiry reject before further registry reads',async()=>{
  for(const change of [s=>{s.session=null;},s=>{s.session.actorId='other';},s=>{s.session.partnerKeyId='key-a';},s=>{s.session.expiresAt--;},s=>{s.session.expiresAt=1000;}]) {
    const h=fixture(),binding=await h.read(),count=h.trace.length;change(h.state);
    await assert.rejects(h.access.revalidate(binding),denied);assert.equal(h.trace.slice(count).includes('connect'),false);h.assertReleased();
  }
});

test('closed or moved rooms, suspended operators, removed games and stale package bindings deny',async()=>{
  const cases=[s=>{s.administration.rooms[0].state='preview';},s=>{s.administration.rooms[0].operatorId='south';},s=>{s.operator.status='suspended';},
    s=>{s.pack.tables='["room-b"]';},s=>{s.pack.games='["roulette"]';},s=>{s.pack=null;},s=>{delete s.pack.branding.roomGameConfigVersions['room-a'];},
    s=>{s.pack.branding.roomGameConfigVersions['room-a']='room-config-00000000-0000-4000-8000-300000000000';},s=>{s.heads['room-a']='room-config-00000000-0000-4000-8000-300000000000';}];
  for(const change of cases){const h=fixture(),binding=await h.read();change(h.state);await assert.rejects(h.access.revalidate(binding),denied);h.assertReleased();}
});

test('branding-only publication keeps original config valid but invalidates an older connection binding',async()=>{
  const h=fixture(),binding=await h.read();h.state.pack.package_revision=2;h.state.pack.branding.title='New title';
  const next=await h.read();assert.equal(next.packageRevision,2);assert.equal(h.state.configs['room-a'].packageRevision,1);
  await assert.rejects(h.access.revalidate(binding),denied);assert.deepEqual(await h.access.revalidate(next),next);h.assertReleased();
});

test('mismatched frozen room, operator, lane, presentation and J08 game/material settings deny',async()=>{
  for(const change of [c=>{c.roomId='room-b';},c=>{c.operatorId='south';},c=>{c.configVersion='other';},c=>{c.presentationLaneId='other';},c=>{c.presentationHash='f'.repeat(64);},
    c=>{c.packageRevision=2;},c=>{c.language='de';},c=>{c.betMs++;},c=>{c.actionMs++;},c=>{c.limits.max++;},c=>{c.chips=[1];},c=>{c.refill++;},
    c=>{c.material.dealerId='astrid';},c=>{c.material.language='en';},c=>{c.cardMs++;},c=>{c.material.media[0].sha256='bad';},c=>{c.material.media[0].sha256='f'.repeat(64);},c=>{c.material.media[0].id='unknown';}]) {
    const h=fixture();change(h.state.configs['room-a']);await assert.rejects(h.read(),denied);h.assertReleased();
  }
});

test('infrastructure/corrupt-row errors remain failures rather than fabricated authorization denials',async()=>{
  const h=fixture(),error=new Error('authentication database unavailable');h.authFail(error);await assert.rejects(h.read(),e=>e===error);assert.equal(h.trace.includes('connect'),false);
  for(const marker of ['studio:read-document','operator-store:operator-by-id','operator-store:current-package','shared-room-access:config']) {
    const h=fixture();h.fail(marker);await assert.rejects(h.read(),e=>e.statusCode===503&&e.code!=='studio_forbidden');assert.ok(h.trace.includes('ROLLBACK'));h.assertReleased();
  }
  const corrupt=fixture();corrupt.state.configs['room-a']='{bad JSON';await assert.rejects(corrupt.read(),{code:'studio_storage_unavailable',statusCode:503});corrupt.assertReleased();
  const scopeLeak=fixture();scopeLeak.state.operator.workspace_id='other';await assert.rejects(scopeLeak.read(),{code:'studio_corrupt_operator',statusCode:503});scopeLeak.assertReleased();
});

test('revocation or expiry during SQL cannot produce a successful binding',async()=>{
  for(const modify of [h=>{h.state.session=null;},h=>{h.setNow(999999);},h=>{h.state.session.actorId='other';}]) {
    const h=fixture();h.after(marker=>{if(marker==='shared-room-access:config')modify(h);});await assert.rejects(h.read(),denied);h.assertReleased();
  }
});

test('abort before/during auth and during registry wait prevents later reads or acceptance',async()=>{
  const before=fixture(),early=new AbortController();early.abort();await assert.rejects(before.read('room-a',request(undefined,{signal:early.signal})));assert.deepEqual(before.trace,[]);
  const during=fixture(),controller=new AbortController();during.authAfter(()=>controller.abort());await assert.rejects(during.read('room-a',request(undefined,{signal:controller.signal})));assert.equal(during.trace.includes('connect'),false);
  const h=fixture(),c=new AbortController();h.after(marker=>{if(marker==='studio:read-document')c.abort();});await assert.rejects(h.read('room-a',request(undefined,{signal:c.signal})));assert.equal(h.trace.includes('operator-store:operator-by-id'),false);h.assertReleased();
});

test('real player binding accepts Fetch cookie conversion, rechecks digest and refuses duplicates/revocation',async()=>{
  const h=fixture({realAuth:true}),binding=await h.read();assert.equal(binding.sessionId,sessionId);
  await assert.rejects(h.read('room-a',request(`player_session=${token}; player_session=${token}`)),denied);
  await assert.rejects(h.read('room-a',request('player_session=bad')),denied);
  assert.deepEqual(await h.access.revalidate(binding),binding);h.state.session=null;await assert.rejects(h.access.revalidate(binding),denied);h.assertReleased();
});

test('actual channel prepare composes with access before any game/presentation read',async()=>{
  const h=fixture({realAuth:true}),channel=createSharedRoomChannel({origin:'https://ui.invalid',...h.access,
    readSnapshot:()=>assert.fail('prepare cannot read game state'),readPresentation:()=>assert.fail('prepare cannot read presentation')});
  try {const result=await channel.prepare(request());assert.equal(typeof result.attach,'function');
    h.state.session=null;await assert.rejects(channel.prepare(request()),denied);
  } finally {channel.close();h.assertReleased();}
});
