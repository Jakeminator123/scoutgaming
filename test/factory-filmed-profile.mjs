import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {importedFilmedProfile} from '../apps/studio/lib/dealer-filmed-profile.mjs';
import {expandStudioFilmedProfile,validateStudioFilmedProfile} from '../packages/presentation/contracts/filmed-profiles/studio-profile.mjs';
import {registeredFilmedProfile} from '../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {filmedFaceAtTime} from '../packages/presentation/contracts/filmed-profile.mjs';
import {bindNativeFilmedBank,filmedTakePlacement,nativeFilmedBankState} from '../packages/presentation/contracts/filmed-bank-bindings.mjs';
import {nativeFilmedCoverageSequences} from '../packages/presentation/runtime/filmed-deal-coverage.mjs';
import {planFilmedDealSequences,orderFilmedPresentationEvents} from '../packages/presentation/runtime/filmed-deal-sequence.mjs';
import {addDealer,createSeedProject} from '../packages/presentation/contracts/studio-model.mjs';
import {measuredFixtureRecord} from './fixtures/native-room-game-material.mjs';

const paow=registeredFilmedProfile('paow'),dealerId='factory-test';
const hash=value=>createHash('sha256').update(value).digest('hex');
// The factory segments base/i footage and appends a return. These fixtures name
// that footage explicitly; no frame numbers are inferred from the v/iv suffix.
export function factoryFixture(){
  const profile={...structuredClone(paow),derivedFrom:paow.id,takes:paow.takes.map(take=>{
    const sourceKey=take.variant==='v'?`${take.target}:base`:take.variant==='iv'?`${take.target}:i`:null;
    const source=paow.takes.find(row=>row.key===sourceKey)??take;
    return {...source,key:take.key,variant:take.variant,endPose:take.endPose,
      sha256:hash(`factory ${take.key}`),repositoryPath:`factory/${take.key.replace(':','-')}.mp4`,
      frames:source.frames+(sourceKey?21:0),...(sourceKey?{sourceTakeKey:sourceKey}:{})};
  })};
  const records=profile.takes.map((take,i)=>measuredFixtureRecord({
    id:`20000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,sha256:take.sha256,size:4096,
    classification:{dealerId,kind:'action',role:'alternative',label:take.key,notes:'',...filmedTakePlacement(take),
      startPose:take.startPose,endPose:take.endPose},
  },{frames:take.frames,fps:24}));
  return {profile,records};
}

test('factory variants preserve their actual source timing and card track in every playable sequence',()=>{
  const {profile,records}=factoryFixture(),compact=importedFilmedProfile({dealerId,profile,records});
  const full=expandStudioFilmedProfile(compact,{dealerId});
  for(const take of full.takes){
    const declared=profile.takes.find(row=>row.key===take.key);
    assert.equal(take.landFrame,declared.landFrame,take.key);
    if(!declared.sourceTakeKey)continue;
    const source=paow.takes.find(row=>row.key===declared.sourceTakeKey);
    assert.equal(compact.takes[take.key].sourceTakeKey,source.key);
    for(const frame of [source.firstFaceFrame,source.contactFrame,source.landFrame,source.clearFrame])
      assert.deepEqual(filmedFaceAtTime(full,take,frame/24),filmedFaceAtTime(paow,source,frame/24),`${take.key} frame ${frame}`);
  }
  let project=addDealer(createSeedProject(),dealerId,'Factory');
  project.dealers.find(row=>row.id===dealerId).filmedProfile=compact;
  const inventory={videos:records.map(row=>({...row,bytes:row.size,available:true,integrity:'verified'}))};
  assert.equal(nativeFilmedBankState(project,inventory,dealerId).complete,true);
  project=bindNativeFilmedBank(project,inventory,dealerId);
  assert.deepEqual(bindNativeFilmedBank(project,inventory,dealerId),project,'binding is idempotent');
  const variants=project.lines.filter(line=>line.dealerId===dealerId).flatMap(line=>line.variants).filter(row=>row.videoGenerationId);
  assert.ok(variants.length>=34);
  assert.ok(variants.every(row=>row.selection?.model===false&&row.selection?.random===false),'filmed order remains server-planned; AI offers use their own policy');
  for(const transitions of [{},{toShoe:{id:'to'},fromShoe:{id:'from'}}]){
    const planned=planFilmedDealSequences({profile:full,dealerId,inventory,transitions,
      eventSequences:nativeFilmedCoverageSequences().map(orderFilmedPresentationEvents)});
    assert.equal(planned.complete,true,planned.reason);
    assert.ok(planned.plans.length>127);
  }
});

test('an exact registered profile supplies missing pose annotations; explicit contradictions still fail',()=>{
  const {profile,records}=factoryFixture();
  for(const row of records.filter(row=>row.classification.label.endsWith(':base'))){
    delete row.classification.startPose;delete row.classification.endPose;
  }
  const compact=importedFilmedProfile({dealerId,profile,records});
  const project=addDealer(createSeedProject(),dealerId,'Factory');project.dealers.find(row=>row.id===dealerId).filmedProfile=compact;
  const inventory={videos:records.map(row=>({...row,bytes:row.size,available:true,integrity:'verified'}))};
  assert.equal(nativeFilmedBankState(project,inventory,dealerId).complete,true);
  assert.doesNotThrow(()=>bindNativeFilmedBank(project,inventory,dealerId));
  const wrong=records.find(row=>row.classification.label==='1:base');
  wrong.classification.startPose='VILA';wrong.classification.endPose='REDO';
  assert.equal(nativeFilmedBankState(project,inventory,dealerId).complete,false);
  assert.throws(()=>importedFilmedProfile({dealerId,profile,records}),error=>error.code==='studio_filmed_profile_mismatch');
});

test('unbound, stale or missing measured bytes cannot be imported or linked as a complete bank',()=>{
  for(const corrupt of [row=>delete row.mediaTiming,row=>row.mediaTiming.sha256=hash('stale'),row=>row.mediaTiming.mediaId='20000000-0000-4000-8000-999999999999',row=>row.mediaTiming.video.frameCount--]){
    const {profile,records}=factoryFixture();corrupt(records.find(row=>row.classification.label==='3:iv'));
    assert.throws(()=>importedFilmedProfile({dealerId,profile,records}),error=>error.code==='studio_filmed_profile_mismatch');
  }
  const {profile,records}=factoryFixture(),compact=importedFilmedProfile({dealerId,profile,records});
  const project=addDealer(createSeedProject(),dealerId,'Factory');project.dealers.find(row=>row.id===dealerId).filmedProfile=compact;
  const inventory={videos:records.slice(1).map(row=>({...row,bytes:row.size,available:true,integrity:'verified'}))};
  const before=structuredClone(project);
  assert.throws(()=>bindNativeFilmedBank(project,inventory,dealerId),/saknar verifierade/);
  assert.deepEqual(project,before);
});

test('source mapping refuses another target, unregistered timing, false return poses and unmeasured length',()=>{
  for(const edit of [
    take=>take.sourceTakeKey='2:base',take=>take.sourceTakeKey='1:iv',take=>take.sourceTakeKey='1:u',
    take=>take.landFrame++,take=>take.track='1v',take=>take.startPose='VILA',take=>take.endPose='REDO',
    take=>take.frames--,take=>delete take.sourceTakeKey,
  ]){
    const {profile,records}=factoryFixture();edit(profile.takes.find(row=>row.key==='1:v'));
    assert.throws(()=>importedFilmedProfile({dealerId,profile,records}),error=>error.code==='studio_filmed_profile_mismatch');
  }
  const {profile,records}=factoryFixture(),compact=importedFilmedProfile({dealerId,profile,records});
  for(const patch of [{sourceTakeKey:'2:base'},{frames:39},{frames:79},{sourceTakeKey:'1:iv'}])
    assert.throws(()=>validateStudioFilmedProfile({...compact,takes:{...compact.takes,'1:v':{...compact.takes['1:v'],...patch}}},{dealerId}),/studio_filmed_profile_invalid/);
});
