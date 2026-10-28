import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import React from 'react';
import {createSeedProject,defaultPresentationLane} from '../../../packages/presentation/contracts/studio-model.mjs';
const require=createRequire(import.meta.url), componentUrl=new URL('../components/studio-session.tsx',import.meta.url);
const localRequire=createRequire(componentUrl), {transformSync}=require('next/dist/build/swc');
const compiled=transformSync(readFileSync(componentUrl,'utf8'),{filename:'studio-session.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const typesModule={exports:{}};
const typesOutput=transformSync(readFileSync(new URL('../components/studio-types.ts',import.meta.url),'utf8'),{filename:'studio-types.ts',jsc:{parser:{syntax:'typescript'}},module:{type:'commonjs'}});
vm.runInNewContext(typesOutput.code,{module:typesModule,exports:typesModule.exports,URL,URLSearchParams,require:localRequire});
function explicitProject(){
 const project=createSeedProject();
 project.dealers=[{id:'astrid',label:'Astrid'}];
 project.assets=[{id:'idle-fixture',label:'Idle',kind:'animation',animation:'idle',color:'#112233',durationMs:1000}];
 project.lines=project.events.map(event=>({dealerId:'astrid',eventId:event.id,label:event.label,baselineVariantId:'base',variants:[{id:'base',label:'Bas',priority:0,triggerIds:[],assetId:'idle-fixture',videoGenerationId:null}]}));
 project.lanes=[defaultPresentationLane('astrid')];
 return project;
}
function harness({project=explicitProject(),projectOnly=false,dealerId='astrid'}={}){
 const hooks=[];let cursor=0;
 const react={...React,useState(initial){const i=cursor++;hooks[i]??={value:typeof initial==='function'?initial():initial};return [hooks[i].value,next=>hooks[i].value=typeof next==='function'?next(hooks[i].value):next];},useRef(initial){const i=cursor++;return hooks[i]??={current:initial};},useEffect(){},useCallback:fn=>fn};
 const module={exports:{}};
 vm.runInNewContext(compiled.code,{module,exports:module.exports,structuredClone,Error,crypto:webcrypto,URL,URLSearchParams,require:name=>name==='react'?react:name==='./studio-types'?typesModule.exports:localRequire(name)});
 const options={initialProject:project,initialDealerId:dealerId,initialVideos:{videos:[],status:'ready'},initialStatus:{connected:true}};
 return {render(){cursor=0;return module.exports[projectOnly?'useStudioProjectSession':'useStudioSession'](options);}};
}
test('same-tick functional edits reach the project ref before any rerender',()=>{
 const h=harness(),s=h.render(),original=structuredClone(s.project);
 s.updateProject(p=>{p.lanes[0].label='Första ändringen';});
 s.updateProject(p=>{p.lanes[0].layers.dealer.enabled=false;});
 assert.equal(s.projectRef.current.lanes[0].label,'Första ändringen');assert.equal(s.projectRef.current.lanes[0].layers.dealer.enabled,false);
 assert.deepEqual(s.project,original,'the original render snapshot is immutable');
 assert.equal(h.render().dirty,true);
});

test('same-tick model edits compose against the newest draft rather than a captured render',()=>{
 const h=harness(),s=h.render();
 s.modelEdit(p=>({...p,clipLabels:{...p.clipLabels,first:'Första klippet'}}));
 s.modelEdit(p=>({...p,clipLabels:{...p.clipLabels,second:'Andra klippet'}}));
 assert.deepEqual(JSON.parse(JSON.stringify(s.projectRef.current.clipLabels)),{first:'Första klippet',second:'Andra klippet'});
 assert.deepEqual(JSON.parse(JSON.stringify(h.render().project.clipLabels)),{first:'Första klippet',second:'Andra klippet'});
});

test('a failed edit leaves both state and the authoritative project ref unchanged',()=>{
 const h=harness(),s=h.render(),before=s.projectRef.current;
 s.modelEdit(()=>{throw new Error('Ogiltig ändring');});
 assert.equal(s.projectRef.current,before);assert.equal(h.render().project,before);assert.equal(h.render().error,'Ogiltig ändring');
 assert.throws(()=>s.updateProject(p=>{p.lanes[0].label='Skall inte sparas';throw new Error('Avbruten ändring');}),/Avbruten ändring/);
 assert.equal(s.projectRef.current,before);assert.equal(h.render().project,before);
});


test('project-only sessions do not select a dealer or construct its line when no choice was provided',()=>{
 const h=harness({projectOnly:true,dealerId:''}),s=h.render();
 assert.equal(s.dealerId,'');assert.equal(s.dealer,undefined);assert.equal(s.media,undefined);assert.equal(s.line,undefined);assert.equal(s.variant,undefined);
 assert.equal(s.project.dealers.length,1);assert.equal(s.dirty,false);
 s.selectDealer('missing');assert.equal(h.render().dealerId,'');
 s.selectDealer('astrid');assert.equal(h.render().dealer.id,'astrid');assert.equal(h.render().variant.id,'base');
 h.render().selectDealer('');assert.equal(h.render().dealerId,'');assert.equal(h.render().line,undefined);
});

test('project-only sessions keep an empty dealer/event/line inventory without inventing a selection',()=>{
 const project=explicitProject();project.dealers=[];project.events=[];project.lines=[];project.lanes=[];
 const h=harness({project,projectOnly:true,dealerId:''});let s=h.render();
 assert.equal(s.dealerId,'');assert.equal(s.eventId,'');assert.equal(s.event,undefined);assert.equal(s.variant,undefined);
 s.updateProject(p=>{p.clipLabels={note:'Inga dealers'};});s=h.render();assert.equal(s.dirty,true);
 assert.deepEqual(s.project.dealers,[]);assert.deepEqual(s.project.lines,[]);assert.equal(s.dealerId,'');
});

test('removing the selected dealer clears derived context without selecting the remaining dealer',()=>{
 const project=explicitProject();project.dealers.push({id:'vera',label:'Vera'});
 const h=harness({project,projectOnly:true}),s=h.render();assert.equal(s.dealer.id,'astrid');
 s.updateProject(p=>{p.dealers=p.dealers.filter(row=>row.id!=='astrid');p.lines=[];p.lanes=[];});
 const next=h.render();assert.equal(next.dealerId,'');assert.equal(next.dealer,undefined);assert.equal(next.line,undefined);assert.equal(next.variant,undefined);
});

test('missing lines, variants and baselines stay optional in project sessions and fail the dealer-editor invariant clearly',()=>{
 for(const change of [p=>{p.lines=[];},p=>{p.lines[0].variants=[];},p=>{p.lines[0].baselineVariantId='missing';}]){
  const project=explicitProject();change(project);const s=harness({project,projectOnly:true}).render();
  assert.equal(s.media,undefined);assert.equal(s.line,undefined);assert.equal(s.variant,undefined);
  assert.throws(()=>harness({project}).render(),/Dealervyn kräver/);
 }
 assert.throws(()=>harness({dealerId:''}).render(),/Dealervyn kräver/);
});
