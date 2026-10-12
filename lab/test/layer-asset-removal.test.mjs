import test from 'node:test';import assert from 'node:assert/strict';
import {createSeedProject,defaultPresentationLane} from '../lib/studio-model.mjs';
import {layerAssetPath} from '../../web/presentation-layers.mjs';
import {layerAssetReferences,removeLayerAsset,restoreLayerAsset} from '../lib/layer-asset-removal.mjs';
function fixture(){const project=createSeedProject();const asset={schemaVersion:1,id:'11111111-1111-4111-8111-111111111111',role:'background',label:'Testbakgrund',sha256:'a'.repeat(64),size:128,contentType:'image/png',width:100,height:100};asset.pathname=layerAssetPath(asset);project.layerAssets=[asset];project.lanes=[defaultPresentationLane('astrid')];return {project,asset};}
test('unused layer can be removed and restored without mutating source or published snapshot',()=>{
  const {project,asset}=fixture(),published=structuredClone(project),next=removeLayerAsset(project,asset.id);
  assert.equal(next.layerAssets.length,0);assert.deepEqual(project,published);
  const restored=restoreLayerAsset(next,asset);assert.deepEqual(restored.layerAssets,[asset]);
  assert.equal(restoreLayerAsset(restored,asset),restored);
});
test('all presentation references block removal including allowed choices on disabled layers',()=>{
  for(const reference of ['default','allowed']){const {project,asset}=fixture(),lane=project.lanes[0];lane.layers.background.enabled=false;
    if(reference==='default')lane.layers.background.default=asset.id;else lane.layers.background.allowed=[asset.id];
    assert.equal(layerAssetReferences(project,asset.id).length,1);assert.throws(()=>removeLayerAsset(project,asset.id),/Koppla loss/);assert.equal(project.layerAssets.length,1);
  }
});
test('archived dealer compositions retain their layer references until explicitly detached',()=>{
  const {project,asset}=fixture(),lane=project.lanes[0];lane.layers.background.allowed=[asset.id];
  project.lanes=[];project.dealerTrash=[{compositions:[lane]}];
  assert.deepEqual(layerAssetReferences(project,asset.id),[{id:lane.id,label:lane.label}]);
  assert.throws(()=>removeLayerAsset(project,asset.id),/Koppla loss/);
});
