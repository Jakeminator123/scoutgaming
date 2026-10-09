import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import React from 'react';
import {createSeedProject} from '../lib/studio-model.mjs';
const require=createRequire(import.meta.url), componentUrl=new URL('../components/studio-session.tsx',import.meta.url);
const localRequire=createRequire(componentUrl), {transformSync}=require('next/dist/build/swc');
const compiled=transformSync(readFileSync(componentUrl,'utf8'),{filename:'studio-session.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
function harness(){
 const hooks=[], requests=[];let cursor=0;
 const react={...React,useState(initial){const i=cursor++;hooks[i]??={value:typeof initial==='function'?initial():initial};return [hooks[i].value,next=>hooks[i].value=typeof next==='function'?next(hooks[i].value):next];},useRef(initial){const i=cursor++;return hooks[i]??={current:initial};},useEffect(){},useCallback:fn=>fn};
 const module={exports:{}};
 const types={resolveStudioDealerId:(p,id)=>id??p.dealers[0].id,resolveStudioEventId:(p,id)=>id??p.events[0].id,requestJson:(path,options)=>new Promise((resolve,reject)=>requests.push({path,body:JSON.parse(options.body),resolve,reject}))};
 vm.runInNewContext(compiled.code,{module,exports:module.exports,structuredClone,Error,crypto:webcrypto,URL,URLSearchParams,require:name=>name==='react'?react:name==='./studio-types'?types:localRequire(name)});
 const options={initialProject:createSeedProject(),initialVideos:{videos:[],status:'ready'},initialStatus:{connected:true}};
 return {requests,render(){cursor=0;return module.exports.useStudioSession(options);}};
}
test('save serializes same-tick calls and returns true only after acknowledged save',async()=>{
 const h=harness(),session=h.render(),first=session.save();
 assert.equal(await session.save(),false);assert.equal(h.requests.length,1);
 const req=h.requests[0],saved={...req.body.project,revision:'saved-revision'};
 req.resolve({project:saved});
 assert.equal(await first,true);const next=h.render();
 assert.equal(next.dirty,false);assert.equal(next.saving,false);assert.equal(next.project.revision,'saved-revision');
});
test('a revision conflict keeps the draft, blocks continuation and unlocks retry',async()=>{
 const h=harness();let s=h.render();s.updateProject(p=>{p.title='Lokalt utkast';});s=h.render();
 const pending=s.save();h.requests[0].reject(Object.assign(new Error('Konflikt'),{statusCode:409}));
 assert.equal(await pending,false);s=h.render();assert.equal(s.conflict,true);assert.equal(s.dirty,true);assert.equal(s.project.title,'Lokalt utkast');
 const retry=s.save();assert.equal(h.requests.length,2);h.requests[1].resolve({project:{...h.requests[1].body.project,revision:'revision-2'}});
 assert.equal(await retry,true);assert.equal(h.render().conflict,false);
});
test('edits made while save is pending remain dirty and prevent save-and-continue',async()=>{
 const h=harness();let s=h.render();const pending=s.save();
 s.updateProject(p=>{p.title='Nyare ändring';});s=h.render();
 h.requests[0].resolve({project:{...h.requests[0].body.project,revision:'revision-2'}});
 assert.equal(await pending,false);s=h.render();assert.equal(s.project.title,'Nyare ändring');assert.equal(s.project.revision,'revision-2');assert.equal(s.dirty,true);assert.equal(s.saving,false);
});

test('same-tick functional edits are included in the saved snapshot before any rerender',async()=>{
 const h=harness(),s=h.render(),original=structuredClone(s.project);
 s.updateProject(p=>{p.lanes[0].label='Första ändringen';});
 s.updateProject(p=>{p.lanes[0].layers.dealer.enabled=false;});
 const pending=s.save(),request=h.requests[0];
 assert.equal(request.body.project.lanes[0].label,'Första ändringen');assert.equal(request.body.project.lanes[0].layers.dealer.enabled,false);
 assert.deepEqual(s.project,original,'the original render snapshot is immutable');
 request.resolve({project:{...request.body.project,revision:'same-tick-saved'}});
 assert.equal(await pending,true);const current=h.render();assert.equal(current.dirty,false);assert.equal(current.project.revision,'same-tick-saved');
});

test('same-tick model edits compose against the newest draft rather than a captured render',async()=>{
 const h=harness(),s=h.render();
 s.modelEdit(p=>({...p,clipLabels:{...p.clipLabels,first:'Första klippet'}}));
 s.modelEdit(p=>({...p,clipLabels:{...p.clipLabels,second:'Andra klippet'}}));
 const pending=s.save(),request=h.requests[0];
 assert.deepEqual(JSON.parse(JSON.stringify(request.body.project.clipLabels)),{first:'Första klippet',second:'Andra klippet'});
 request.resolve({project:{...request.body.project,revision:'model-edits-saved'}});assert.equal(await pending,true);assert.equal(h.render().dirty,false);
});

test('edits during pending save block continuation even when React has not rendered them yet',async()=>{
 const h=harness(),s=h.render(),pending=s.save();
 s.updateProject(p=>{p.lanes[0].label='Nyare utkast före render';});
 h.requests[0].resolve({project:{...h.requests[0].body.project,revision:'saved-before-new-edit'}});
 assert.equal(await pending,false);const next=h.render();
 assert.equal(next.project.lanes[0].label,'Nyare utkast före render');assert.equal(next.project.revision,'saved-before-new-edit');assert.equal(next.dirty,true);
});

test('an immediate second save uses the acknowledged revision without waiting for a render',async()=>{
 const h=harness(),s=h.render(),first=s.save();h.requests[0].resolve({project:{...h.requests[0].body.project,revision:'acknowledged-1'}});assert.equal(await first,true);
 const second=s.save();assert.equal(h.requests[1].body.expectedRevision,'acknowledged-1');
 h.requests[1].resolve({project:{...h.requests[1].body.project,revision:'acknowledged-2'}});assert.equal(await second,true);assert.equal(h.render().project.revision,'acknowledged-2');
});

test('a failed edit leaves both state and the authoritative project ref unchanged',()=>{
 const h=harness(),s=h.render(),before=s.projectRef.current;
 s.modelEdit(()=>{throw new Error('Ogiltig ändring');});
 assert.equal(s.projectRef.current,before);assert.equal(h.render().project,before);assert.equal(h.render().error,'Ogiltig ändring');
 assert.throws(()=>s.updateProject(p=>{p.lanes[0].label='Skall inte sparas';throw new Error('Avbruten ändring');}),/Avbruten ändring/);
 assert.equal(s.projectRef.current,before);assert.equal(h.render().project,before);
});
