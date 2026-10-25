import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeedProject,defaultPresentationLane} from '../../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings,defaultBlackjackTableGeometry} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {layerAssetPath} from '../../../packages/presentation/contracts/layer-asset-contract.mjs';
import {importPublishedSceneLayout,publishSavedScene,scenePublicationPreview} from '../lib/scene-publication.mjs';

function fixture(){
  const project=createSeedProject(),lane={...defaultPresentationLane('astrid'),composition:defaultCompositionSettings()};
  const ids=[1,2].map(n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
  project.layerAssets=ids.map(id=>{const asset={schemaVersion:1,id,role:'table',game:'blackjack',label:'Table',sha256:'a'.repeat(64),size:1024,contentType:'image/png',width:1672,height:941};return {...asset,pathname:layerAssetPath(asset)};});
  lane.layers.table={enabled:true,default:ids[0],allowed:ids};lane.composition.blackjackTables=ids.map(defaultBlackjackTableGeometry);
  project.lanes=[lane,{...structuredClone(lane),id:'other-scene',label:'Other scene'}];
  const presentation={schemaVersion:3,lanes:[structuredClone(lane)],assets:[project.layerAssets[0]],playback:{media:[{id:'untouched'}]}};
  presentation.lanes[0].layers.table.allowed=[ids[0]];presentation.lanes[0].composition.blackjackTables.splice(1);
  const initial={operatorId:'op-1',packageRevision:7,lanes:[lane.id],adjustable:[],canConfigure:true,branding:{color:'#123456'},draftRevision:2,
    draft:{revision:2,basePackageRevision:7,branding:{color:'#654321'}},history:[],rooms:[{id:'room-a',label:'Main',presentationLaneId:lane.id}],presentation};
  return {project,compositionId:lane.id,initial,operatorSlug:'north',ids};
}
const response=(value,status=200)=>({ok:status===200,status,json:async()=>structuredClone(value)});

test('recovering the live geometry preserves other templates, allowed material and unpublished board profiles',()=>{
  const f=fixture(),before=structuredClone(f.project),published=f.initial.presentation;
  published.lanes[0].composition.mobile.table.y=.3;published.lanes[0].composition.blackjackTables[0].mobile.fanSpread=.65;
  const result=importPublishedSceneLayout(f.project,f.compositionId,published);
  assert.equal(result.lanes[0].composition.mobile.table.y,.3);
  assert.equal(result.lanes[0].composition.blackjackTables[0].tableId,f.ids[1]);
  assert.deepEqual(result.lanes[0].layers,before.lanes[0].layers);
  assert.deepEqual(result.lanes[1],before.lanes[1]);assert.deepEqual(result.layerAssets,before.layerAssets);assert.deepEqual(f.project,before);
});

test('publication sends only saved identities and revisions, then verifies media, branding and draft readback',async()=>{
  const f=fixture();f.project.lanes[0].composition.mobile.table.y=.3;
  const expected=scenePublicationPreview(f.project,f.compositionId,f.initial.presentation),calls=[];
  const saved={...f.initial,packageRevision:8,presentation:expected};
  const result=await publishSavedScene({...f,fetchImpl:async(url,request)=>{calls.push({url,request});return calls.length===1?response({ok:true,operatorId:'op-1',compositionId:f.compositionId,projectRevision:f.project.revision,packageRevision:8,presentation:expected}):response(saved);}});
  assert.deepEqual(JSON.parse(calls[0].request.body),{action:'publish-scene-layout',operatorId:'op-1',compositionId:f.compositionId,expectedPackageRevision:7,expectedProjectRevision:f.project.revision});
  assert.equal(calls[1].url,'/studio/api/partner/branding?operator=north');assert.deepEqual(result,saved);
  assert.deepEqual(expected.playback,f.initial.presentation.playback);assert.deepEqual(expected.assets,f.initial.presentation.assets);
});

test('no-op and every unconfirmed publication stop without a false receipt',async()=>{
  const f=fixture();await assert.rejects(publishSavedScene({...f,fetchImpl:()=>assert.fail('no request')}),/redan publicerad/);
  f.project.lanes[0].composition.mobile.table.y=.3;
  const expected=scenePublicationPreview(f.project,f.compositionId,f.initial.presentation);
  for(const failure of ['conflict','oversize','wrong-project','wrong-company','readback-media','readback-draft']){
    let calls=0;
    await assert.rejects(publishSavedScene({...f,fetchImpl:async()=>{
      calls++;
      if(failure==='conflict')return response({},409);if(failure==='oversize')return response({},413);
      if(calls===1)return response({ok:true,operatorId:failure==='wrong-company'?'other':'op-1',compositionId:f.compositionId,projectRevision:failure==='wrong-project'?'stale':f.project.revision,packageRevision:8,presentation:expected});
      const saved=structuredClone({...f.initial,packageRevision:8,presentation:expected});
      if(failure==='readback-media')saved.presentation.playback.media=[];
      if(failure==='readback-draft')saved.draft=null;
      return response(saved);
    }}),failure==='oversize'?/för stort/:/senaste version/);
    assert.equal(calls,failure.startsWith('readback')?2:1,failure);
  }
});
