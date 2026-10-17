import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeedProject,createEmptyProject,addDealer,validateProject,buildRuntimeCatalog,addVariant,defaultPresentationLane} from '../../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {lifecycleProject} from '../lib/dealer-lifecycle.mjs';
import {registeredDealerIds} from '../../../packages/presentation/contracts/dealer-identity.mjs';

test('retired dealer history and trash remain readable without permitting restoration',()=>{
 for(const id of ['vera','mei','amira','johanna']){
  const historical=addDealer(createEmptyProject(),'history-fixture','Historical dealer');
  historical.dealers[0].id=id;
  for(const line of historical.lines){
   line.dealerId=id;line.baselineVariantId=line.baselineVariantId.replace('history-fixture.',id+'.');
   for(const variant of line.variants)variant.id=variant.id.replace('history-fixture.',id+'.');
  }
  assert.equal(validateProject(historical),historical);
  assert.deepEqual([...registeredDealerIds(historical)],[id]);
  const archived=lifecycleProject(historical,{dealerId:id,archived:true,records:[]});
  assert.equal(validateProject(archived),archived);
  assert.equal(archived.dealerTrash[0].dealer.id,id);
  assert.throws(()=>lifecycleProject(archived,{dealerId:id,archived:false,records:[]}),{code:'studio_dealer_inactive'});
  assert.throws(()=>defaultPresentationLane(id));
 }
});

test('Nora receives all own event bindings without borrowing recorded films',()=>{
 const original=createSeedProject(), before=structuredClone(original), project=addDealer(original,'nora','Nora');
 assert.deepEqual(original,before);assert.equal(project.dealers.length,2);
 const lines=project.lines.filter(line=>line.dealerId==='nora');assert.equal(lines.length,17);
 for(const line of lines){assert.equal(line.variants.length,1);assert.equal(line.variants[0].videoGenerationId,null);assert.equal(line.baselineVariantId,`nora.${line.eventId}.standard`);}
 assert.equal(buildRuntimeCatalog(project,'nora').events.length,16);
 const next=addVariant(project,'nora','idle.ready','Reaktion');next.lines.find(row=>row.dealerId==='nora'&&row.eventId==='idle.ready').variants[1].selection={rules:true,model:true,random:true};
 assert.equal(validateProject(next),next);
});
test('registered dealer references and complete independent baselines are required',()=>{
 const project=addDealer(createSeedProject(),'nora','Nora');
 assert.throws(()=>addDealer(project,'nora','Andra Nora'));
 for(const id of ['../nora','constructor','api','Nora'])assert.throws(()=>addDealer(project,id,'Nora'));
 const missing=structuredClone(project);missing.lines=missing.lines.filter(row=>row.dealerId!=='nora');assert.throws(()=>validateProject(missing));
 const replaced=structuredClone(project);replaced.dealers=replaced.dealers.filter(row=>row.id!=='astrid');assert.throws(()=>validateProject(replaced));
 assert.throws(()=>buildRuntimeCatalog(project,'unregistered'));
});
test('composition round trips in saved lanes and refuses unbounded settings',()=>{
 const project=addDealer(createSeedProject(),'nora','Nora'),lane=defaultPresentationLane('nora');project.lanes=[lane];
 lane.composition=defaultCompositionSettings();
 lane.composition.mobile.table.y=0.08;assert.doesNotThrow(()=>validateProject(JSON.parse(JSON.stringify(project))));
 lane.composition.mobile.dealer.x=Infinity;assert.throws(()=>validateProject(project));
});
