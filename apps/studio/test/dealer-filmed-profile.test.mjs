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
import {wrapNativePresentationRepository,PRESENTATION_RUNTIME_UPDATE_REQUIRED} from '../lib/presentation-runtime-readiness.mjs';
import {presentationCapabilitiesForVersion} from '../../../packages/presentation/capability-contract.mjs';

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
async function fixture(t,{role='admin',records=clips(),packages=[],sessionScope=scope,runtimeVersion=null}={}) {
  const pool=await createPglitePool();t.after(()=>pool.end());
  const plan=await planStudioMigrations({pool});await applyStudioMigrations({pool,expectedTarget:plan.target,confirm:true});
  const stored=createStudioRepository({pool,scope});
  let repository={...stored,listMedia:async()=>structuredClone(records),listLifecyclePackages:async()=>structuredClone(packages)},mutationTransaction=async work=>work();
  const fetches=[];
  // runtimeVersion: the production readiness wrapper in front of SQL, against a Render that advertises that version.
  if(runtimeVersion!==null){
    repository=wrapNativePresentationRepository(repository,{env:{CROUPIER_BACKEND_ORIGIN:'https://render.example.invalid'},
      fetchImpl:async(url,init)=>{fetches.push(init.headers['X-Presentation-Capability-Version']);return Response.json(presentationCapabilitiesForVersion(Math.min(runtimeVersion,Number(init.headers['X-Presentation-Capability-Version']??2))));}});
    mutationTransaction=async(work,options={})=>repository.withMutationContext(work,options.presentationMutation===undefined?[]:[options.presentationMutation]);
  }
  const project=addDealer(addDealer(addDealer(createSeedProject(),'paow','Paow'),'dragan','Dragan'),'jakob-2','Jakob 2');
  const saved=await stored.initializeDocument('project',{value:project,actor:'fixture'});
  const api=createStudioDealerApi({repository,config,mutationTransaction,videoRegistry:async()=>({videos:[]}),
    authorize:async()=>({user:'Admin',role,scope:sessionScope})});
  const journal=async()=>(await pool.query("SELECT action,revision,actor FROM croupier_studio.audit_events WHERE environment_id=$1 AND action<>'initialize_document' ORDER BY at",[scope.environment])).rows;
  return {api,repository:stored,revision:saved.revision,journal,fetches};
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
    [clips('jakob-2',{frames:take=>off.has(take.key)?take.frames-1:take.frames}),[{key:'1:base',reason:'frames',frames:39,measured:38},{key:'dealer:v',reason:'frames'}]],
    [clips('jakob-2',{frames:take=>take.key==='1:base'?take.frames*2+1:take.frames}),[{key:'1:base',reason:'frames',frames:39,measured:79}]],
    [clips().filter(row=>row.classification.label!==kevinName('4:base')),[{key:'4:base',reason:'missing'}]],
  ]){
    const f=await fixture(t,{records}),response=await json(await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,copyFrom:'paow'})));
    assert.equal(response.status,422);assert.equal(response.body.code,'studio_filmed_profile_mismatch');
    assert.deepEqual(response.body.mismatch.map(row=>({key:row.key,reason:row.reason})),expected.map(row=>({key:row.key,reason:row.reason})));
    if(expected[0].frames)assert.deepEqual([response.body.mismatch[0].frames,response.body.mismatch[0].measured],[expected[0].frames,expected[0].measured]);
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

// Dealer-fabriken: -iu clips are Kevin's N:i take plus an appended return, 68-81 frames (frames 0-59 identical).
const factoryFrames=take=>take.variant==='i'&&take.target!=='hole'?68+(Number(take.target)||8)+(take.target==='dealer'?5:0):take.frames;

test('copy from PAOW keeps a factory dealer\'s longer -iu clips with their own frame count',async t=>{
  const f=await fixture(t,{records:clips('jakob-2',{frames:factoryFrames})});
  const put=await json(await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,copyFrom:'paow'})));
  assert.equal(put.status,200);
  const profile=put.body.project.dealers.find(row=>row.id==='jakob-2').filmedProfile;
  for(const take of paow.takes)assert.deepEqual(profile.takes[take.key],{sha256:hash(`jakob-2 own ${take.key}`),...(factoryFrames(take)>take.frames?{frames:factoryFrames(take)}:{})},take.key);
  assert.deepEqual(Object.values(profile.takes).map(take=>take.frames).filter(Boolean).sort((a,b)=>a-b),[69,70,71,72,73,74,75,81]);
});

test('PUT never binds another dealer\'s clip: PAOW\'s own clips in the same slots are ignored',async t=>{
  const theirs=clips('paow'),own=clips('jakob-2');
  let f=await fixture(t,{records:[...theirs,...own]});
  const put=await json(await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,copyFrom:'paow'})));
  assert.equal(put.status,200);
  const bound=Object.values(put.body.project.dealers.find(row=>row.id==='jakob-2').filmedProfile.takes).map(take=>take.sha256);
  assert.ok(bound.every(sha=>own.some(row=>row.sha256===sha))&&!bound.some(sha=>theirs.some(row=>row.sha256===sha)));
  f=await fixture(t,{records:theirs});
  const only=await json(await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,copyFrom:'paow'})));
  assert.equal(only.status,422);assert.ok(only.body.mismatch.length>=34&&only.body.mismatch.every(row=>row.reason==='missing'));
  const imported=await json(await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,profile:factoryProfile(theirs)})));
  assert.equal(imported.status,422);assert.equal(imported.body.code,'studio_filmed_profile_sha_missing');assert.equal(imported.body.missing.length,paow.takes.length);
  assert.deepEqual(await f.journal(),[]);
});

// dealer_outputs/<dealer>/generated/filmed_profile.json: PAOW with the factory's clips inserted.
function factoryProfile(records,dealerId='jakob-2') {
  const {id:_id,source:_source,...rest}=structuredClone(paow);
  return {...rest,id:`factory-${dealerId}`,source:{factory:'dealer-fabriken v1.2.0'},derivedFrom:paow.id,timingEvidence:'derived-from-kevin-paow',visuallyVerified:false,
    takes:paow.takes.map(take=>{const row=records.find(item=>item.classification.label===kevinName(take.key));
      return {...structuredClone(take),sha256:row.sha256,repositoryPath:`dealer_outputs/${dealerId}/generated/${kevinName(take.key)}.mp4`,frames:row.mediaTiming.video.frameCount};})};
}

test('PUT takes dealer-fabriken\'s whole filmed_profile.json and matches every sha256 against the dealer\'s own media',async t=>{
  const records=clips('jakob-2',{frames:factoryFrames}),profile=factoryProfile(records);
  let f=await fixture(t,{records});
  const put=await json(await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,profile})));
  assert.equal(put.status,200);
  const stored=put.body.project.dealers.find(row=>row.id==='jakob-2').filmedProfile;
  assert.equal(stored.kind,'copy');assert.equal(stored.base,paow.id);
  const g=await fixture(t,{records}),copied=await json(await g.api.handle(req('jakob-2','PUT',{expectedRevision:g.revision,copyFrom:'paow'})));
  assert.deepEqual(stored,copied.body.project.dealers.find(row=>row.id==='jakob-2').filmedProfile,'the same compact copy as Använd PAOW:s landningar');
  assert.deepEqual((await f.journal()).map(row=>row.action),['save_document']);
  // Kevin's 60-frame count in the JSON is accepted too: the clip's measured count is what is stored.
  f=await fixture(t,{records});
  const kevinFrames={...profile,takes:profile.takes.map(take=>({...take,frames:paow.takes.find(row=>row.key===take.key).frames}))};
  assert.deepEqual((await json(await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,profile:kevinFrames})))).body.project.dealers.find(row=>row.id==='jakob-2').filmedProfile,stored);
});

test('a factory profile with unknown sha256 values is refused with the list; changed geometry, timing or slot is refused',async t=>{
  const records=clips('jakob-2',{frames:factoryFrames}),profile=factoryProfile(records);
  const absent=structuredClone(profile);absent.takes[0].sha256='e'.repeat(64);absent.takes[5].sha256=paow.takes[5].sha256;
  const moved=structuredClone(records);moved.find(row=>row.classification.label===kevinName('2:base')).classification.situation='box5';
  const retimed=structuredClone(profile);retimed.takes.find(take=>take.key==='3:base').landFrame+=1;
  for(const [body,rows,status,code,check] of [
    [absent,records,422,'studio_filmed_profile_sha_missing',body=>assert.deepEqual(body.missing,[{key:paow.takes[0].key,sha256:'e'.repeat(64)},{key:paow.takes[5].key,sha256:paow.takes[5].sha256}])],
    [{...profile,card:{width:80,height:106}},records,422,'studio_filmed_profile_mismatch',body=>assert.deepEqual(body.mismatch,[{key:'card',reason:'geometry'}])],
    [{...profile,tracks:{}},records,422,'studio_filmed_profile_mismatch',body=>assert.deepEqual(body.mismatch,[{key:'tracks',reason:'geometry'}])],
    [retimed,records,422,'studio_filmed_profile_mismatch',body=>assert.deepEqual(body.mismatch,[{key:'3:base',reason:'timing'}])],
    [profile,moved,422,'studio_filmed_profile_mismatch',body=>assert.deepEqual(body.mismatch.map(row=>[row.key,row.reason]),[['2:base','slot']])],
    [{...profile,takes:profile.takes.filter(take=>take.key!=='flip:base')},records,422,'studio_filmed_profile_mismatch',body=>assert.deepEqual(body.mismatch,[{key:'flip:base',reason:'missing'}])],
    [{...profile,takes:[...profile.takes,{...profile.takes[0],key:'1:iu'}]},records,422,'studio_filmed_profile_mismatch',body=>assert.deepEqual(body.mismatch,[{key:'1:iu',reason:'unknown'}])],
    [{...profile,derivedFrom:'kevin-astrid-00000000'},records,422,'studio_filmed_profile_source_unknown',()=>{}],
    [[],records,400,null,()=>{}],
  ]){
    const f=await fixture(t,{records:rows}),response=await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,profile:body}));
    assert.equal(response.status,status,code);
    if(code){const json=await response.json();assert.equal(json.code,code);check(json);}
    assert.deepEqual(await f.journal(),[]);
  }
});

test('PUT is refused with 403 for a session in another scope and for another origin, and changes nothing',async t=>{
  const other=await fixture(t,{sessionScope:{environment:'other-environment',workspaceId:'isolated'}});
  for(const method of ['GET','PUT']){
    const response=await other.api.handle(req('jakob-2',method,method==='PUT'?{expectedRevision:other.revision,copyFrom:'paow'}:undefined));
    assert.equal(response.status,403,method);
  }
  assert.deepEqual(await other.journal(),[]);
  const f=await fixture(t);
  // An unknown site, and the public host (an allowed origin, but not this Admin's own).
  for(const other of ['https://evil.example.invalid','https://public.example.invalid'])for(const method of ['GET','PUT','DELETE']){
    const request=new Request(`${origin}/api/dealers/jakob-2/filmed-profile`,{method,headers:{origin:other,'sec-fetch-site':'same-origin',
      ...(method==='GET'?{}:{'content-type':'application/json'})},...(method==='GET'?{}:{body:JSON.stringify({expectedRevision:f.revision,...(method==='PUT'?{copyFrom:'paow'}:{})})})});
    assert.equal((await f.api.handle(request)).status,403,`${other} ${method}`);
  }
  // A write without an Origin header is not a same-origin write either.
  for(const method of ['PUT','DELETE']){
    const request=new Request(`${origin}/api/dealers/jakob-2/filmed-profile`,{method,headers:{'sec-fetch-site':'same-origin','content-type':'application/json'},
      body:JSON.stringify({expectedRevision:f.revision,...(method==='PUT'?{copyFrom:'paow'}:{})})});
    assert.equal((await f.api.handle(request)).status,403,`no origin ${method}`);
  }
  assert.deepEqual(await f.journal(),[]);assert.equal((await f.repository.readDocument('project')).revision,f.revision);
});

test('PUT is held until Render reports v34 (filmed profiles on top of the v33 miljöbild); nothing is written before',async t=>{
  for(const version of [32,33]){
    const f=await fixture(t,{runtimeVersion:version}),response=await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,copyFrom:'paow'}));
    assert.equal(response.status,503);assert.equal((await response.json()).code,PRESENTATION_RUNTIME_UPDATE_REQUIRED);
    assert.deepEqual(f.fetches,['34']);assert.deepEqual(await f.journal(),[]);
  }
  const f=await fixture(t,{runtimeVersion:34});
  assert.equal((await f.api.handle(req('jakob-2','PUT',{expectedRevision:f.revision,copyFrom:'paow'}))).status,200);
  assert.deepEqual(f.fetches,['34']);assert.deepEqual((await f.journal()).map(row=>row.action),['save_document']);
});
