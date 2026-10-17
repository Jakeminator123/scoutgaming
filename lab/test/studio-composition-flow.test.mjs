import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeedProject as createEmptyProject,validateProject, defaultPresentationLane} from '../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings} from '../../packages/presentation/contracts/composition-settings.mjs';
import {layerAssetPath} from '../../packages/presentation/contracts/presentation-layers.mjs';
import {compositionPreviewLayers,registerCompositionLayer,uploadCompositionLayer} from '../lib/studio-composition.mjs';

const id='11111111-2222-4333-8444-555555555555';
function asset(role='background',contentType='image/png') {
  const row={schemaVersion:1,id,role,label:'Kväll',sha256:'a'.repeat(64),size:24,contentType,width:640,height:360};
  return {...row,pathname:layerAssetPath(row)};
}
function fixture(role='background',contentType='image/png') {
  const base=createSeedProject(),draft=structuredClone(base),remote=structuredClone(base),record=asset(role,contentType);
  draft.lanes[0].composition=defaultCompositionSettings();draft.lanes[0].composition.mobile.dealer.x=.37;
  remote.layerAssets=[record];remote.revision='remote-upload-revision';
  return {base,draft,remote,selection:{id,role,laneId:base.lanes[0].id}};
}

test('upload registration selects a background while retaining unsaved placement and unrelated remote edits',()=>{
  const {base,draft,remote,selection}=fixture();remote.events[0].label='Ny serverrubrik';
  const original={base:structuredClone(base),draft:structuredClone(draft),remote:structuredClone(remote)};
  const result=registerCompositionLayer(base,draft,remote,selection);
  assert.deepEqual(result.conflicts,[]);assert.equal(result.project.revision,remote.revision);
  assert.equal(result.project.lanes[0].composition.mobile.dealer.x,.37);
  assert.equal(result.project.events[0].label,'Ny serverrubrik');
  assert.equal(result.project.lanes[0].layers.background.default,id);assert.equal(result.project.lanes[0].layers.background.mode,'image');
  assert.deepEqual(result.project.lanes[0].layers.background.allowed,[id]);assert.notDeepEqual(result.project,remote);
  assert.deepEqual({base,draft,remote},original);assert.equal(validateProject(result.project),result.project);
});

test('video and table registration configure the correct role and do not change the dealer or runtime selections',()=>{
  for(const [role,contentType] of [['background','video/webm'],['table','image/webp']]) {
    const {base,draft,remote,selection}=fixture(role,contentType);draft.lanes[0].layers[role].enabled=false;
    const result=registerCompositionLayer(base,draft,remote,selection),lane=result.project.lanes[0];
    assert.equal(lane.layers[role].default,id);assert.equal(lane.layers[role].enabled,true);
    assert.deepEqual(lane.layers.dealer,draft.lanes[0].layers.dealer);assert.deepEqual(result.project.lines,draft.lines);
    assert.equal(lane.renderer,'layered');if(role==='background')assert.equal(lane.layers.background.mode,'video');
  }
});

test('a simultaneous remote lane edit remains an explicit conflict and retains the local draft',()=>{
  const {base,draft,remote,selection}=fixture();remote.lanes[0].label='Serverval';draft.lanes[0].label='Mitt osparade val';
  const result=registerCompositionLayer(base,draft,remote,selection);
  assert.deepEqual(result.conflicts,[`lanes.${base.lanes[0].id}.label`]);assert.equal(result.project.lanes[0].label,'Mitt osparade val');
  assert.equal(result.project.lanes[0].layers.background.default,id);
});

test('a missing or wrong-role upload receipt cannot change the draft',()=>{
  const {base,draft,remote,selection}=fixture(),before=structuredClone(draft);
  assert.throws(()=>registerCompositionLayer(base,draft,remote,{...selection,role:'table'}),/registrering kunde inte verifieras/);
  assert.throws(()=>registerCompositionLayer(base,draft,remote,{...selection,laneId:'deleted-lane'}),/valda sammansättningen finns inte längre/);
  assert.deepEqual(draft,before);
});

test('legacy metadata never hides independently selected preview layers',()=>{
  const show={dealer:true,background:true,table:true};
  assert.deepEqual(compositionPreviewLayers(show),show);
  assert.deepEqual(compositionPreviewLayers(show,{mode:'green-screen'}),show);
  assert.deepEqual(compositionPreviewLayers(show,undefined,false),show);
  assert.deepEqual(compositionPreviewLayers({...show,dealer:false}),{dealer:false,background:true,table:true});
});

function uploadFixture(options={}) {
  const controller=new AbortController(),calls=[],file=new File([new Uint8Array(24)],'kväll.png',{type:'image/png'});
  let record;
  const dependencies={signal:controller.signal,post:async(body)=>{
    calls.push(body.operation);
    if(body.operation==='prepare') {record={schemaVersion:1,id,role:body.role,label:body.label,sha256:body.sha256,size:body.size,contentType:body.contentType,width:body.width,height:body.height,...(body.game===undefined?{}:{game:body.game})};record.pathname=layerAssetPath(record);return {id,pathname:options.badGrant?'other/path':record.pathname,clientToken:'bounded-token',ticket:'signed-ticket'};}
    if(options.failCommit)throw new Error('commit failed');
    const project=createSeedProject();project.layerAssets=[options.badGame?{...record,game:'blackjack'}:options.badReceipt?{...record,sha256:'f'.repeat(64)}:record];return {id,project};
  },put:async(pathname,_file,putOptions)=>{
    calls.push('put');assert.equal(putOptions.access,'private');assert.equal(putOptions.abortSignal,controller.signal);
    if(options.abortAfterPut)controller.abort();return {pathname:options.badPut?'wrong/path':pathname};
  },onCommit:()=>calls.push('commit-start')};
  return {file,controller,calls,dependencies,metadata:{role:'background',label:'Kväll',width:640,height:360}};
}

test('file selection protocol validates prepare, immutable put and committed receipt before selection',async()=>{
  const {file,metadata,dependencies,calls}=uploadFixture();
  const result=await uploadCompositionLayer(file,metadata,dependencies);
  assert.equal(result.id,id);assert.deepEqual(calls,['prepare','put','commit-start','commit']);
  assert.equal(result.project.layerAssets[0].label,'Kväll');assert.equal(result.project.layerAssets[0].size,file.size);
});

test('roulette table uploads preserve their exact game and MIME in the verified receipt',async()=>{
  for(const contentType of ['video/mp4','video/webm']){
    const f=uploadFixture(),file=new File([new Uint8Array(24)],'table',{type:contentType});
    const result=await uploadCompositionLayer(file,{...f.metadata,role:'table',game:'roulette'},f.dependencies);
    assert.equal(result.project.layerAssets[0].game,'roulette');assert.equal(result.project.layerAssets[0].contentType,contentType);
  }
  const f=uploadFixture({badGame:true});
  await assert.rejects(uploadCompositionLayer(f.file,{...f.metadata,role:'table',game:'roulette'},f.dependencies),/registreringen kunde inte verifieras/);
  const background=uploadFixture();
  await assert.rejects(uploadCompositionLayer(background.file,{...background.metadata,game:'roulette'},background.dependencies),/spelet som bordet/);
  assert.deepEqual(background.calls,[]);
});

test('cancel before upload or after transfer never sends the registration commit',async()=>{
  const before=uploadFixture();before.controller.abort();
  await assert.rejects(uploadCompositionLayer(before.file,before.metadata,before.dependencies));assert.deepEqual(before.calls,[]);
  const after=uploadFixture({abortAfterPut:true});
  await assert.rejects(uploadCompositionLayer(after.file,after.metadata,after.dependencies));assert.deepEqual(after.calls,['prepare','put']);
});

test('wrong grant and wrong Blob path are rejected before registration',async()=>{
  for(const [options,expected] of [[{badGrant:true},['prepare']],[{badPut:true},['prepare','put']]]) {
    const {file,metadata,dependencies,calls}=uploadFixture(options);
    await assert.rejects(uploadCompositionLayer(file,metadata,dependencies),/mål kunde inte verifieras/);assert.deepEqual(calls,expected);
  }
});

test('failed commit or mismatched receipt cannot produce a selected layer',async()=>{
  for(const options of [{failCommit:true},{badReceipt:true}]) {
    const {file,metadata,dependencies}=uploadFixture(options);
    await assert.rejects(uploadCompositionLayer(file,metadata,dependencies),options.failCommit?/commit failed/:/registreringen kunde inte verifieras/);
  }
});

// This suite exercises a saved composition, not an automatically populated new project.
function createSeedProject() { const project = createEmptyProject(); project.lanes = [defaultPresentationLane('astrid')]; return project; }
