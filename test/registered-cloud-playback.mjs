import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameEntrySelector} from '../web/game-entry-operator.mjs';
import {gameLaneConfiguration,gameLaneFromDocument,validateGameLanes} from '../web/public/game-lanes.mjs';
import {isDealerId,isActiveDealerId,validatePublicRegisteredDealers} from '../web/public/dealer-identity.mjs';
const lane=id=>({schemaVersion:1,id:'configured',label:'Configured cloud table',renderer:'portrait-video',dealer:id,mediaCollection:id+'-presentation'});
function selector(id,{configured=true,pack=true}={}){
 const lanes=configured?[lane(id)]:[];
 const saved={administration:{gameLanes:lanes,gameLane:configured?'configured':null},project:{dealers:[{id,label:id}],lanes:configured?[{id:'configured',dealers:[id],layers:{dealer:{enabled:true,default:id,allowed:[id]},background:{enabled:false,mode:'baked',allowed:[],default:null},table:{enabled:false,allowed:[],default:null}}}]:[]}};
 return createGameEntrySelector({policy:{readSaved:async()=>saved,readGameConfiguration:async()=>{}},packages:{resolve:async()=>({operator:{id:'operator',status:'active'},package:pack?{revision:3,lanes:['configured'],branding:{}}:null})}});
}
test('empty configuration invents no lane or local dealer',async()=>{assert.deepEqual(gameLaneConfiguration(),{gameLanes:[],gameLane:null});assert.throws(()=>gameLaneFromDocument({}));await assert.rejects(selector('paow',{configured:false})(''),/configured/);});
for(const id of ['paow','dragge','nora','astrid','vera','mei'])test(`${id} is available only through explicit saved cloud registration`,async()=>{
 const select=selector(id);
 for(const query of ['',`?dealer=${id}`,`?operator=testco&dealer=${id}`]){
  const result=await select(query);assert.equal(result.status,200);assert.equal(result.selection.dealer,id);assert.equal(result.selection.presentation,'local');assert.equal(result.selection.localDealer,id);assert.deepEqual(result.selection.registeredDealers,[{id,label:id}]);assert.deepEqual(result.selection.choices.dealers,[id]);
 }
 const data={gameLane:'configured',gameDealer:id,gamePresentation:'local',gameLocalDealer:id,gameRegisteredDealers:JSON.stringify([{id,label:id}])};
 assert.equal(gameLaneFromDocument(data).dealer,id);
 assert.throws(()=>gameLaneFromDocument({...data,gameRegisteredDealers:'[]'}));
});
test('Amira cannot launch while old document identifiers remain readable',async()=>{assert.equal(isDealerId('amira'),true);assert.equal(isActiveDealerId('amira'),false);assert.equal((await selector('paow')('?dealer=amira')).status,404);assert.throws(()=>validatePublicRegisteredDealers([{id:'amira',label:'Amira'}]));});
test('local indexed catalog can be read for history but cannot start',async()=>{const old={schemaVersion:1,id:'old',label:'Old',renderer:'indexed-video',dealer:'vera',mediaCollection:'legacy-dealers'};assert.deepEqual(validateGameLanes([old]),[old]);const select=createGameEntrySelector({policy:{readGameConfiguration:async()=>{},readSaved:async()=>({administration:{gameLanes:[old],gameLane:'old'},project:{}})}});await assert.rejects(select(''),/cloud/);});
test('missing operator package cannot silently start a default dealer',async()=>{assert.equal((await selector('paow',{pack:false})('?operator=testco')).status,404);});

test('registered former local names do not duplicate the historical package authority',async()=>{
 const {validatePresentationPackage}=await import('../web/presentation-layers.mjs');
 const {defaultPresentationLane}=await import('../lab/lib/studio-model.mjs');
 for(const id of ['astrid','vera','mei']){
  const pack={schemaVersion:2,projectRevision:'fixture',assets:[],lanes:[defaultPresentationLane(id)],registeredDealers:[{id,label:id,idle:null}]};
  assert.equal(validatePresentationPackage(pack).registeredDealers[0].id,id);
 }
});
test('a published cloud lane is independent of a historical active indexed lane',async()=>{
 const old={schemaVersion:1,id:'old',label:'Old',renderer:'indexed-video',dealer:'vera',mediaCollection:'legacy-dealers'};
 const configured=lane('paow');
 const saved={administration:{gameLanes:[old,configured],gameLane:'old'},project:{dealers:[{id:'paow',label:'Paow'}],lanes:[{id:'configured',dealers:['paow'],layers:{dealer:{enabled:true,default:'paow',allowed:['paow']},background:{enabled:false,mode:'baked',allowed:[],default:null},table:{enabled:false,allowed:[],default:null}}}]}};
 const select=createGameEntrySelector({policy:{readSaved:async()=>saved,readGameConfiguration:async()=>{}},packages:{resolve:async()=>({operator:{id:'op',status:'active'},package:{revision:1,lanes:['configured'],branding:{}}})}});
 const result=await select('?operator=testco');assert.equal(result.status,200);assert.equal(result.selection.dealer,'paow');
});

test('historical box variants remain stored without automatically becoming the standard',async()=>{
 const {createSeedProject}=await import('../lab/lib/studio-model.mjs');
 const {applyLegacyStandardVariants}=await import('../packages/presentation/runtime/legacy-standard-variants.mjs');
 const {selectPresentation}=await import('../packages/presentation/runtime/selection.mjs');
 const project=createSeedProject();
 project.legacyClipPolicy=[{dealerId:'vera',part:'box3',clipId:'vera:legacy/box3'}];
 applyLegacyStandardVariants(project); // Explicit historical fixture, never a runtime import.
 const original=structuredClone(project);
 const result=await selectPresentation({project,dealerId:'vera',eventId:'deal.player.centre',mode:'off',sourceEvent:project.events.find(e=>e.id==='deal.player.centre').exampleEvent},{videoRegistry:{videos:[],families:[]}});
 assert.equal(result.variant.videoGenerationId,null);
 assert.equal(result.videoGenerationId,null);
 assert.deepEqual(project,original);
});

test('reading historical clip metadata never creates new active bindings',async()=>{
 const {createSeedProject,normalizeProject}=await import('../lab/lib/studio-model.mjs');
 const project=createSeedProject();
 project.legacyClipPolicy=[{dealerId:'vera',part:'idle',clipId:'vera:legacy/idle'}];
 const before=structuredClone(project);
 const result=normalizeProject(project);
 assert.deepEqual(result.lines,before.lines);
 assert.deepEqual(result.triggers,before.triggers);
 assert.deepEqual(result.legacyClipPolicy,before.legacyClipPolicy);
 assert.deepEqual(project,before);
});
test('Amira cannot be registered again while other named cloud dealers can',async()=>{
 const {createEmptyProject,addDealer}=await import('../lab/lib/studio-model.mjs');
 assert.throws(()=>addDealer(createEmptyProject(),'amira','Amira'));
 for(const id of ['astrid','vera','mei','nora']){
  const project=addDealer(createEmptyProject(),id,id);
  assert.deepEqual(project.dealers,[{id,label:id}]);
  assert.ok(project.lines.every(line=>line.variants.every(variant=>variant.videoGenerationId===null)));
 }
});
