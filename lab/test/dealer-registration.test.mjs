import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeedProject,addDealer,validateProject,buildRuntimeCatalog,addVariant,defaultPresentationLane} from '../lib/studio-model.mjs';
import {defaultCompositionSettings} from '../../web/public/composition-settings.mjs';

test('Nora receives all own event bindings without borrowing recorded films',()=>{
 const original=createSeedProject(), before=structuredClone(original), project=addDealer(original,'nora','Nora');
 assert.deepEqual(original,before);assert.equal(project.dealers.length,5);
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
