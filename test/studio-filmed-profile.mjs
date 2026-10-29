import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStudioFilmedProfile,expandStudioFilmedProfile,filmedProfileFor} from '../packages/presentation/contracts/filmed-profiles/studio-profile.mjs';
import {registeredFilmedProfile} from '../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {validateFilmedDealProfile} from '../packages/presentation/contracts/filmed-profile.mjs';
import {addDealer,createSeedProject,validateProject} from '../packages/presentation/contracts/studio-model.mjs';
import {studioCopyProfile} from './fixtures/native-room-game-material.mjs';

// Contract of dealers[].filmedProfile: compact, browser-safe, tracks inherited
// from a code profile, and never a replacement for the code seeds.
const invalid=error=>error.code==='studio_filmed_profile_invalid'&&error.statusCode===422;
const paow=registeredFilmedProfile('paow');
const measured=()=>({schemaVersion:1,id:'studio-jakob-2-0123abcd',kind:'measured',plane:{width:1080,height:1920,fps:24},card:{width:78,height:106},
  positions:structuredClone(paow.positions),measuredAt:'2026-10-29T12:00:00.000Z',
  takes:{'1:base':{sha256:'1'.repeat(64),frames:40,startPose:'REDO',endPose:'REDO',landFrame:30},'dealer:v':{sha256:'2'.repeat(64),frames:30,startPose:'REDO',endPose:'VILA',landFrame:20,contactFrame:18,clearFrame:22}}});

test('a copy inherits PAOW geometry, tracks and timing; only the clip bindings are the dealer\'s own',()=>{
  const compact=studioCopyProfile('jakob-2','paow'),full=expandStudioFilmedProfile(compact,{dealerId:'jakob-2'});
  assert.deepEqual(validateStudioFilmedProfile(compact,{dealerId:'jakob-2'}),compact);
  assert.equal(full.id,compact.id);assert.deepEqual(full.source,{studio:{dealerId:'jakob-2',kind:'copy',base:paow.id}});
  assert.equal(full.tracks,paow.tracks);assert.deepEqual(full.positions,paow.positions);assert.equal(full.takes.length,paow.takes.length);
  for(const take of full.takes){
    const base=paow.takes.find(row=>row.key===take.key);
    assert.deepEqual({...take,sha256:base.sha256,repositoryPath:base.repositoryPath},base);
    assert.equal(take.sha256,compact.takes[take.key].sha256);assert.equal(take.repositoryPath,`studio/jakob-2/${take.key}`);
  }
  assert.ok(JSON.stringify(compact).length<4000,'≈ 35 × 80 B, never the 93 kB tracks');
  const subset={...compact,takes:{'1:base':compact.takes['1:base']}};
  assert.equal(expandStudioFilmedProfile(subset,{dealerId:'jakob-2'}).takes.length,1);
});

test('measured landings have no tracks; the card shows at landing',()=>{
  const full=expandStudioFilmedProfile(measured(),{dealerId:'jakob-2'});
  assert.deepEqual(full.tracks,{});assert.equal(full.timingEvidence,'studio-measured');
  assert.deepEqual(full.takes.map(({key,track,firstFaceFrame,contactFrame,landFrame,clearFrame,offsetFrames})=>[key,track,firstFaceFrame,contactFrame,landFrame,clearFrame,offsetFrames]),
    [['1:base','1',30,30,30,30,0],['dealer:v','dealerv',18,18,20,22,0]]);
  for(const patch of [{landFrame:40},{startPose:'SIT'},{frames:0},{clearFrame:10},{extra:1}])
    assert.throws(()=>validateStudioFilmedProfile({...measured(),takes:{'1:base':{...measured().takes['1:base'],...patch}}},{dealerId:'jakob-2'}),invalid);
  for(const patch of [{positions:{...paow.positions,1:{cx:2000,cy:10}}},{measuredAt:'yesterday'},{takes:{}},{takes:{'9:base':measured().takes['1:base']}},{tracks:{}}])
    assert.throws(()=>validateStudioFilmedProfile({...measured(),...patch},{dealerId:'jakob-2'}),invalid);
});

test('unknown fields, unknown bases, foreign ids, duplicate clips and the code seeds are refused',()=>{
  const compact=studioCopyProfile('jakob-2','paow');
  for(const [value,dealerId] of [[{...compact,extra:true},'jakob-2'],[{...compact,base:'kevin-unknown-00000000'},'jakob-2'],
    [{...compact,takes:{...compact.takes,'9:base':{sha256:'a'.repeat(64)}}},'jakob-2'],[{...compact,takes:{}},'jakob-2'],
    [{...compact,takes:{...compact.takes,'1:i':{sha256:compact.takes['1:base'].sha256}}},'jakob-2'],
    [{...compact,takes:{...compact.takes,'1:i':{sha256:'A'.repeat(64)}}},'jakob-2'],[{...compact,id:'kevin-paow-c7138759'},'jakob-2'],
    [compact,'jakob-3'],[{...studioCopyProfile('paow','dragan')},'paow'],[{...compact,schemaVersion:2},'jakob-2'],[{...compact,kind:'tracked'},'jakob-2']])
    assert.throws(()=>validateStudioFilmedProfile(value,{dealerId}),invalid);
});

test('the frozen row goes first and the code register stays the seed and fallback',()=>{
  const compact=studioCopyProfile('jakob-2','paow');
  assert.equal(filmedProfileFor('jakob-2',{registeredDealers:[{id:'jakob-2',filmedProfile:compact}]}).id,compact.id);
  assert.equal(filmedProfileFor('jakob-2',{project:{dealers:[{id:'jakob-2',filmedProfile:compact}]}}).id,compact.id);
  assert.equal(filmedProfileFor('jakob-2',{registeredDealers:[{id:'jakob-2'}]}),null);
  assert.equal(filmedProfileFor('paow',{registeredDealers:[]}),paow);assert.equal(filmedProfileFor('dragan'),registeredFilmedProfile('dragan'));
  for(const dealerId of ['dragan','paow'])assert.equal(validateFilmedDealProfile(registeredFilmedProfile(dealerId)),registeredFilmedProfile(dealerId));
  const studioSource=expandStudioFilmedProfile(compact,{dealerId:'jakob-2'});
  assert.throws(()=>validateFilmedDealProfile({...studioSource,source:{studio:{dealerId:'jakob-3',kind:'copy',base:paow.id}}}),/Invalid filmed deal profile/);
  assert.throws(()=>validateFilmedDealProfile({...registeredFilmedProfile('paow'),tracks:{}}),/Invalid filmed deal profile/,'code profiles still need their tracks');
});

test('the saved project accepts the profile only on its own non-seed dealer',()=>{
  const project=addDealer(addDealer(createSeedProject(),'jakob-2','Jakob 2'),'paow','Paow');
  project.dealers.find(row=>row.id==='jakob-2').filmedProfile=studioCopyProfile('jakob-2','paow');
  assert.ok(validateProject(project));
  project.dealers.find(row=>row.id==='paow').filmedProfile=studioCopyProfile('paow','dragan');
  assert.throws(()=>validateProject(project),/filmedProfile/);
});

test('a copy is PAOW in every field but its id, source and takes (version, game, plane, card, positions, tracks, timingEvidence)',()=>{
  const compact=studioCopyProfile('jakob-2','paow');
  const {id,source,takes,...inherited}=expandStudioFilmedProfile(compact,{dealerId:'jakob-2'}),{id:_id,source:_source,takes:_takes,...code}=paow;
  assert.deepEqual(inherited,code);assert.equal(id,compact.id);assert.equal(takes.length,paow.takes.length);
  assert.deepEqual(Object.keys(inherited).sort(),Object.keys(paow).filter(key=>!['id','source','takes'].includes(key)).sort());
});

test('a copy never binds the code profile\'s own (Kevin\'s) clips',()=>{
  const compact=studioCopyProfile('jakob-2','paow');
  for(const [key,sha256] of [['1:base',paow.takes.find(take=>take.key==='1:base').sha256],['1:base',paow.takes.find(take=>take.key==='flip:base').sha256]])
    assert.throws(()=>validateStudioFilmedProfile({...compact,takes:{...compact.takes,[key]:{sha256}}},{dealerId:'jakob-2'}),invalid);
});

test('a copied take keeps a longer factory clip (-iu, 68-81 frames against 60) and refuses shorter, equal-noted or far longer ones',()=>{
  const compact=studioCopyProfile('jakob-2','paow'),code=paow.takes.find(take=>take.key==='1:i');
  for(const frames of [68,81,120]){
    const value={...compact,takes:{...compact.takes,'1:i':{...compact.takes['1:i'],frames}}};
    assert.deepEqual(validateStudioFilmedProfile(value,{dealerId:'jakob-2'}),value);
    const take=expandStudioFilmedProfile(value,{dealerId:'jakob-2'}).takes.find(row=>row.key==='1:i');
    assert.deepEqual({...take,frames:code.frames,sha256:code.sha256,repositoryPath:code.repositoryPath},code,'only the frame count is the clip\'s own');
    assert.equal(take.frames,frames);
  }
  for(const frames of [59,60,121,68.5,'68',null])
    assert.throws(()=>validateStudioFilmedProfile({...compact,takes:{...compact.takes,'1:i':{...compact.takes['1:i'],frames}}},{dealerId:'jakob-2'}),invalid,String(frames));
});

test('measured landings use Kevin\'s 1080×1920 plane at 24 fps and a card-sized card',()=>{
  assert.ok(validateStudioFilmedProfile({...measured(),card:{width:216,height:320}},{dealerId:'jakob-2'}));
  for(const patch of [{plane:{width:720,height:1280,fps:24}},{plane:{width:1080,height:1920,fps:25}},{plane:{width:1,height:1,fps:0.001}},{plane:{width:1080,height:1920,fps:24,extra:1}},
    {card:{width:1080,height:1920}},{card:{width:217,height:106}},{card:{width:78,height:321}},{card:{width:0,height:106}},{card:{width:78,height:106,extra:1}}])
    assert.throws(()=>validateStudioFilmedProfile({...measured(),...patch},{dealerId:'jakob-2'}),invalid,JSON.stringify(patch));
});
