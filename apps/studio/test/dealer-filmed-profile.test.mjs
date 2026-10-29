import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPglitePool} from '../../../test/fixtures/pglite-pool.mjs';
import {measuredFixtureRecord} from '../../../test/fixtures/native-room-game-material.mjs';
import {planStudioMigrations,applyStudioMigrations} from '../../../ops/neon-studio/migrations.mjs';
import {createStudioRepository} from '../../../packages/studio-registry/server/document-repository.mjs';
import {addDealer,createSeedProject,validateProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {registeredFilmedProfile} from '../../../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {filmedTakePlacement} from '../../../packages/presentation/contracts/filmed-bank-bindings.mjs';
import {createStudioDealerApi} from '../lib/studio-dealer-api.mjs';

// Admin › Dealers › Landningar on real PostgreSQL SQL (PGlite with the Studio
// migrations). Synthetic clip records; no Neon, no Blob, no published room.
const scope={environment:'filmed-profile-test',workspaceId:'isolated'},origin='https://studio.example.invalid';
const config={scope,apiBase:'/api/admin',allowedOrigins:['https://public.example.invalid',origin],publicHosts:['public.example.invalid',new URL(origin).host]};
const hash=value=>createHash('sha256').update(value).digest('hex');
const paow=registeredFilmedProfile('paow');
const kevinName=key=>paow.takes.find(take=>take.key===key).repositoryPath.split('/').at(-1).replace(/\.mp4$/,'');
const req=(dealerId,method,body)=>new Request(`${origin}/api/dealers/${dealerId}/filmed-profile`,{method,
  headers:{origin,'sec-fetch-site':'same-origin',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
// The dealer's own Runway clips: same slot, poses and frame count as PAOW's takes.
function clips(dealerId='jakob-2',{frames=take=>take.frames}={}) {
  return paow.takes.map((take,index)=>{
    const id=`20000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,sha256=hash(`${dealerId} own ${take.key}`);
    return measuredFixtureRecord({id,sha256,size:4096,contentType:'video/mp4',revision:'media-1',pathname:`croupier/media/dealers/${dealerId}/review/uploads/${id}/${sha256}.mp4`,
      classification:{dealerId,kind:'action',role:'alternative',label:kevinName(take.key),notes:'',...filmedTakePlacement(take),startPose:take.startPose,endPose:take.endPose,
        compositing:{mode:'green-screen',threshold:.2,softness:.1,despill:0}}},{frames:frames(take),fps:24});
  });
}
async function fixture(t,{role='admin',records=clips(),packages=[]}={}) {
  const pool=await createPglitePool();t.after(()=>pool.end());
  const plan=await planStudioMigrations({pool});await applyStudioMigrations({pool,expectedTarget:plan.target,confirm:true});
  const stored=createStudioRepository({pool,scope});
  const repository={...stored,listMedia:async()=>structuredClone(records),listLifecyclePackages:async()=>structuredClone(packages)};
  const project=addDealer(addDealer(addDealer(createSeedProject(),'paow','Paow'),'dragan','Dragan'),'jakob-2','Jakob 2');
  const saved=await stored.initializeDocument('project',{value:project,actor:'fixture'});
  const api=createStudioDealerApi({repository,config,mutationTransaction:async work=>work(),videoRegistry:async()=>({videos:[]}),
    authorize:async()=>({user:'Admin',role,scope})});
  const journal=async()=>(await pool.query("SELECT action,revision,actor FROM croupier_studio.audit_events WHERE environment_id=$1 AND action<>'initialize_document' ORDER BY at",[scope.environment])).rows;
  return {api,repository:stored,revision:saved.revision,journal};
}
const json=async response=>({status:response.status,body:await response.json()});

test('copy from PAOW binds every take to the dealer\'s own exact clip, is journalled and survives validateProject',async t=>{
  const f=await fixture(t);
  assert.deepEqual((await json(await f.api.handle(req('jakob-2','GET')))).body,{source:null,profile:null,positions:null,card:null,plane:null,takes:[],template:null});
  const put=await json(await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,copyFrom:'paow'})));
  assert.equal(put.status,200);
  const stored=(await f.repository.readDocument('project')).value,profile=stored.dealers.find(row=>row.id==='jakob-2').filmedProfile;
  assert.deepEqual(put.body.project,stored);assert.ok(validateProject(stored));
  assert.equal(profile.kind,'copy');assert.equal(profile.base,paow.id);assert.match(profile.id,/^studio-jakob-2-[a-f0-9]{8}$/);
  assert.deepEqual(Object.fromEntries(Object.entries(profile.takes).map(([key,take])=>[key,take.sha256])),
    Object.fromEntries(paow.takes.map(take=>[take.key,hash(`jakob-2 own ${take.key}`)])));
  assert.deepEqual((await f.journal()).map(row=>[row.action,row.actor]),[['save_document','Admin']]);
  const read=(await json(await f.api.handle(req('jakob-2','GET')))).body;
  assert.equal(read.source,'studio');assert.deepEqual(read.profile,profile);assert.deepEqual(read.positions,paow.positions);
  assert.ok(read.takes.length===35&&read.takes.every(take=>take.status==='bound'&&take.videoId));assert.equal(read.template.profileId,profile.id);
  assert.equal((await json(await f.api.handle(req('paow','GET')))).body.source,'code');
});

test('a clip with another frame count or a missing reachable take is refused with the list of takes',async t=>{
  const off=new Set(['1:base','dealer:v']);
  for(const [records,expected] of [
    [clips('jakob-2',{frames:take=>off.has(take.key)?take.frames+1:take.frames}),[{key:'1:base',reason:'frames',frames:39,measured:40},{key:'dealer:v',reason:'frames'}]],
    [clips().filter(row=>row.classification.label!==kevinName('4:base')),[{key:'4:base',reason:'missing'}]],
  ]){
    const f=await fixture(t,{records}),response=await json(await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,copyFrom:'paow'})));
    assert.equal(response.status,422);assert.equal(response.body.code,'studio_filmed_profile_mismatch');
    assert.deepEqual(response.body.mismatch.map(row=>({key:row.key,reason:row.reason})),expected.map(row=>({key:row.key,reason:row.reason})));
    if(expected[0].frames)assert.deepEqual([response.body.mismatch[0].frames,response.body.mismatch[0].measured],[39,40]);
    assert.deepEqual(await f.journal(),[]);assert.equal((await f.repository.readDocument('project')).revision,f.revision);
  }
});

test('two clips for one take are candidates, never a guess; Kevin\'s file name separates them',async t=>{
  const records=clips(),twin={...structuredClone(records[0]),id:'20000000-0000-4000-8000-000000000999',sha256:hash('twin')};
  twin.mediaTiming={...twin.mediaTiming,mediaId:twin.id,sha256:twin.sha256};twin.classification.label='Runway retake';
  let f=await fixture(t,{records:[...records,twin]});
  assert.equal((await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,copyFrom:'paow'}))).status,200,'the clip named after Kevin\'s file (pos1) wins');
  records[0].classification.label='first';
  f=await fixture(t,{records:[...records,twin]});
  const response=await json(await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,copyFrom:'paow'})));
  assert.equal(response.status,409);assert.equal(response.body.code,'studio_filmed_profile_candidates');
  assert.deepEqual(response.body.candidates,[{key:paow.takes[0].key,videoIds:[records[0].id,twin.id]}]);
});

test('seeds, stale revisions, readers, cross-site writes and bad bodies change nothing',async t=>{
  const f=await fixture(t);
  for(const [dealerId,method,body,status,code] of [
    ['paow','PUT',{expectedRevision:f.revision,copyFrom:'paow'},409,'studio_filmed_profile_seeded'],
    ['dragan','DELETE',{expectedRevision:f.revision},409,'studio_filmed_profile_seeded'],
    ['jakob-2','PUT',{expectedRevision:'studio.project.stale',copyFrom:'paow'},409,'studio_conflict'],
    ['jakob-2','PUT',{expectedRevision:f.revision,copyFrom:'astrid'},422,'studio_filmed_profile_source_unknown'],
    ['ghost','PUT',{expectedRevision:f.revision,copyFrom:'paow'},409,'studio_dealer_missing'],
    ['jakob-2','DELETE',{expectedRevision:f.revision},409,'studio_filmed_profile_missing'],
    ['jakob-2','PUT',{expectedRevision:f.revision,copyFrom:'paow',extra:1},400,null],
    ['jakob-2','POST',{expectedRevision:f.revision},405,null],
  ]){
    const response=await f.api.handle(req(dealerId,method,body));assert.equal(response.status,status,`${dealerId} ${method}`);
    if(code)assert.equal((await response.json()).code,code);
  }
  const reader=await fixture(t,{role:'reader'});
  assert.equal((await reader.api.handle(req('jakob-2','GET'))).status,403);
  const cross=req('jakob-2','PUT',{expectedRevision:f.revision,copyFrom:'paow'});cross.headers.set('sec-fetch-site','cross-site');
  assert.equal((await f.api.handle(cross)).status,403);
  assert.deepEqual(await f.journal(),[]);
});

test('measured landings need the dealer\'s own clips at their frames; delete is blocked while a package shows the dealer',async t=>{
  const records=clips(),take=paow.takes.find(row=>row.key==='1:base'),own=records.find(row=>row.classification.label===kevinName('1:base'));
  const measurement={plane:{width:1080,height:1920,fps:24},card:{width:78,height:106},positions:structuredClone(paow.positions),
    takes:{'1:base':{sha256:own.sha256,frames:take.frames,startPose:take.startPose,endPose:take.endPose,landFrame:28}}};
  let f=await fixture(t,{records});
  const wrong=await json(await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,measurement:{...measurement,takes:{'1:base':{...measurement.takes['1:base'],frames:41}}}})));
  assert.equal(wrong.status,422);assert.deepEqual(wrong.body.mismatch,[{key:'1:base',reason:'frames'}]);
  const saved=await json(await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,measurement})));
  assert.equal(saved.status,200);assert.equal(saved.body.project.dealers.find(row=>row.id==='jakob-2').filmedProfile.kind,'measured');
  const removed=await json(await f.api.handle(req('jakob-2','DELETE',{expectedRevision:saved.body.project.revision})));
  assert.equal(removed.status,200);assert.equal(Object.hasOwn(removed.body.project.dealers.find(row=>row.id==='jakob-2'),'filmedProfile'),false);
  f=await fixture(t,{records,packages:[{operator_id:'op',package_revision:1,lanes:['lane'],branding:{dealer:'jakob-2'}}]});
  const put=await json(await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,copyFrom:'paow'})));
  const blocked=await json(await f.api.handle(req('jakob-2','DELETE',{expectedRevision:put.body.project.revision})));
  assert.equal(blocked.status,409);assert.equal(blocked.body.code,'studio_dealer_published');
});
