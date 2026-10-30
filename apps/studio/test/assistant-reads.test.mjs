import {assistantWrite} from '../lib/assistant-context.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readAssistantData,assistantNavigation,validateAssistantRead} from '../lib/assistant-reads.mjs';
import {prepareAssistantAction,executeAssistantAction} from '../lib/assistant-actions.mjs';
import {createEmptyProject} from '../../../packages/presentation/contracts/studio-model.mjs';
const origin='https://studio.example.invalid',scope={environment:'test',workspaceId:'robot-test'},actor={accountId:'1',user:'admin-test',role:'admin',scope};
const config={scope,apiBase:'/studio/api/admin',authBase:'/studio/api/auth',allowedOrigins:[origin,'https://lab.example.invalid'],publicHosts:['studio.example.invalid','lab.example.invalid']};
const req=()=>new Request(origin+'/studio/api/assistant',{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:'{}'});
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function fixture(){
 const state={project:createEmptyProject(),media:{id,revision:'media-r1',sha256:'a'.repeat(64),pathname:'private/path.mp4',size:500,contentType:'video/mp4',classification:{dealerId:'astrid',label:'First clip',notes:'test',archived:false}},references:[],mutations:0};
 const runtime={config,authorize:async()=>actor,repository:{readDocument:async()=>({revision:'project-r1',value:structuredClone(state.project)}),getMedia:async()=>structuredClone(state.media),findMediaReferences:async()=>({references:state.references}),listMedia:async()=>[structuredClone(state.media)]},videoRegistry:async()=>({videos:[]})};
 return {state,runtime};
}
test('registry reading searches stored metadata but excludes storage paths, keys and hidden columns',async()=>{
 const h=fixture();h.state.media.apiKey='SECRET';h.state.media.signedUrl='SECRET';h.state.media.classification.secret='SECRET';
 const result=await readAssistantData(h.runtime,req(),{source:'media',query:'first',offset:0});
 assert.equal(result.items[0].label,'First clip');assert.equal(result.total,1);assert.equal(result.complete,true);assert.ok(!JSON.stringify(result).includes('SECRET'));assert.ok(!JSON.stringify(result).includes('private/path'));
});
test('query pagination preserves total and explicit continuation',async()=>{
 const h=fixture();h.runtime.repository.listMedia=async()=>Array.from({length:85},(_,i)=>({...h.state.media,id:String(i).padStart(3,'0')}));
 const page=await readAssistantData(h.runtime,req(),{source:'media',query:'',offset:40});
 assert.equal(page.items.length,40);assert.equal(page.total,85);assert.equal(page.nextOffset,80);assert.equal(page.items[0].id,'040');
});
test('dealer reads report saved speech state for active and archived dealers',async()=>{
 const h=fixture();h.state.project.dealers=[{id:'active',label:'Active',speechProfile:{state:'enabled'}},{id:'draft',label:'Draft',speechProfile:{state:'preparation'}}];
 h.state.project.dealerTrash=[{dealer:{id:'archived',label:'Archived',speechProfile:{state:'preparation'}}}];
 const page=await readAssistantData(h.runtime,req(),{source:'dealers',query:'',offset:0});
 assert.deepEqual(page.items.map(({id,archived,speechEnabled})=>({id,archived,speechEnabled})),[{id:'active',archived:false,speechEnabled:true},{id:'archived',archived:true,speechEnabled:false},{id:'draft',archived:false,speechEnabled:false}]);
});
test('navigation only builds known same-site routes and readers reject endpoint or SQL injection',()=>{
 assert.deepEqual(assistantNavigation({page:'import',targetId:'dragge'}),{href:'/admin/clips?panel=intake&dealer=dragge',label:'Lägg till klipp'});
 for(const value of [{page:'https://evil.invalid',targetId:null},{page:'import',targetId:'a&token=secret'},{page:'__proto__',targetId:null}])assert.throws(()=>assistantNavigation(value));
 for(const value of [{source:'sql',query:'SELECT *',offset:0},{source:'media',query:'',offset:-1},{source:'media',query:'',offset:0,url:'/secrets'}])assert.throws(()=>validateAssistantRead(value));
});
test('dealer creation prepares a revision-bound empty dealer and rejects duplicate IDs',async()=>{
 const h=fixture(),proposal={action:'dealer.create',targetId:'dragge',value:'Dragge'};
 const prepared=await prepareAssistantAction(h.runtime,req(),proposal);
 assert.equal(prepared.plan.body.expectedRevision,'project-r1');assert.equal(h.state.project.dealers.length,0);
 assert.equal(prepared.plan.body.project.dealers[0].id,'dragge');assert.ok(prepared.plan.body.project.lines.every(line=>line.variants.every(v=>v.videoGenerationId===null)));
 assert.ok(prepared.review.question.includes('skapa'));h.state.project=prepared.plan.body.project;
 await assert.rejects(prepareAssistantAction(h.runtime,req(),proposal),{code:'assistant_invalid_dealer'});
});
test('clip rename binds exact prior metadata and bytes while preserving placement',async()=>{
 const h=fixture(),prepared=await prepareAssistantAction(h.runtime,req(),{action:'media.rename',targetId:id,value:'New name'});
 assert.equal(prepared.plan.path,'/videos/classify');assert.equal(prepared.plan.body.previous.label,'First clip');assert.equal(prepared.plan.body.metadata.label,'New name');assert.equal(prepared.plan.body.metadata.dealerId,'astrid');assert.equal(prepared.plan.body.sha256,h.state.media.sha256);assert.equal(h.state.media.classification.label,'First clip');
});
test('archive preserves bytes, blocks active references and refuses immutable bank clips',async()=>{
 const h=fixture(),proposal={action:'media.archive',targetId:id,value:null};
 const prepared=await prepareAssistantAction(h.runtime,req(),proposal);assert.equal(prepared.plan.path,'/videos/archive');assert.equal(prepared.plan.body.archived,true);assert.equal(prepared.review.permanent,false);
 h.state.references=[{historical:false}];await assert.rejects(prepareAssistantAction(h.runtime,req(),proposal),{code:'assistant_media_in_use'});
 h.state.references=[];h.state.media.retainedBank=true;await assert.rejects(prepareAssistantAction(h.runtime,req(),proposal),{code:'assistant_target_unavailable'});
});
test('permanent clip deletion requires native eligibility and keeps byte identity through purge',async()=>{
 for(const changed of [false,true]){
 const h=fixture();let purged=false;h.state.media.classification.archived=true;
 h.runtime.mediaDeletion={check:async()=>({allowed:true}),remove:async(_body,{stillAuthorized})=>{await stillAuthorized();h.state.media.revision='tombstone';if(changed)h.state.media.sha256='b'.repeat(64);await stillAuthorized();purged=true;}};
 const prepared=await prepareAssistantAction(h.runtime,req(),{action:'media.delete',targetId:id,value:null});assert.equal(prepared.review.confirmation,'RADERA '+id);
 if(changed)await assert.rejects(executeAssistantAction(h.runtime,req(),prepared));else await executeAssistantAction(h.runtime,req(),prepared);assert.equal(purged,!changed);
 h.runtime.mediaDeletion.check=async()=>({allowed:false});await assert.rejects(prepareAssistantAction(h.runtime,req(),{action:'media.delete',targetId:id,value:null}),{code:'assistant_delete_blocked'});
 }
});

test('frozen family clips cannot offer a rename that the original writer will reject',async()=>{
 const h=fixture();h.state.media.classification.familyId='frozen-family';
 await assert.rejects(prepareAssistantAction(h.runtime,req(),{action:'media.rename',targetId:id,value:'Ny'}),{code:'assistant_media_immutable'});
});

test('successful native mutations do not fail after saving a large project receipt',async()=>{
 const result=await assistantWrite(Response.json({project:'x'.repeat(150000)}));assert.deepEqual(result,{completed:true});
 await assert.rejects(assistantWrite(Response.json({error:'conflict'},{status:409})),{code:'assistant_dependency_unavailable'});
});
