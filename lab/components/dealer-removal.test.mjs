import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createSeedProject,addDealer} from '../lib/studio-model.mjs';
import {dealerRemovalStatus} from '../lib/dealer-removal.mjs';
import {lifecycleProject} from '../lib/dealer-lifecycle.mjs';
const archiveFixture=project=>lifecycleProject(project,{dealerId:'johanna',archived:true,records:[]});

const own = () => addDealer(addDealer(createSeedProject(),'johanna','Johanna'),'elin','Elin');
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const compiled=transformSync(readFileSync(new URL('./dealer-removal.tsx',import.meta.url),'utf8'),{filename:'dealer-removal.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
function harness(request=async()=>{throw Error('Unexpected request');}){
 const state=[];let cursor=0;
 const react={...React,useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},useRef(initial){const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i];}};
 const module={exports:{}};
 vm.runInNewContext(compiled.code,{module,exports:module.exports,Error,require:name=>{
  if(name==='react')return react;
  if(name.includes('dealer-removal.mjs'))return{dealerRemovalStatus};
  if(name==='./studio-types')return{requestJson:request};
  if(name==='./media-removal-feedback')return{mediaRemovalMessage:cause=>cause.message??String(cause)};
  if(name==='./dealer-media-library')return{DealerMediaLibrary:()=>null};
  if(name.endsWith('.css'))return{default:{}};
  return require(name);
 }});
 return{render(props){cursor=0;return module.exports.DealerRemoval(props);}};
}
function find(tree,match){if(!tree||typeof tree!=='object')return null;if(match(tree))return tree;for(const child of [tree.props?.children].flat(Infinity)){const found=find(child,match);if(found)return found;}return null;}
const button=(tree,text)=>find(tree,node=>node.type==='button'&&String(node.props.children).includes(text));
const props=(project=own())=>({project,inventory:{videos:[]},dealerId:'johanna',onApplied(){},onInventory(){},onProjectSaved(){},onPendingChange(){}});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('dealer UI protects base dealers and names presentations that block removal',()=>{
 const h=harness(),p=props();p.dealerId='astrid';
 assert.match(renderToStaticMarkup(h.render(p)),/gemensamma originalbanken/);
 assert.equal(button(h.render(p),'Flytta'),null);
 p.dealerId='johanna';p.project.lanes[0].dealers.push('johanna');
 const tree=h.render(p);assert.match(renderToStaticMarkup(tree),/Mobile Phone Lane/);assert.equal(button(tree,'Flytta').props.disabled,true);
});
test('archive is one CAS request; parent changes only after confirmed server success',async()=>{
 let resolve;const calls=[],applied=[],pending=[];
 const h=harness((...args)=>{calls.push(args);return new Promise(done=>{resolve=done;});});
 const p={...props(),onApplied:(...args)=>applied.push(args),onPendingChange:x=>pending.push(x)};
 const click=button(h.render(p),'Flytta').props.onClick;click();click();
 assert.equal(calls.length,1);assert.deepEqual(applied,[]);
 assert.equal(calls[0][0],'/api/dealers/archive');
 assert.deepEqual(JSON.parse(calls[0][1].body),{dealerId:'johanna',expectedRevision:p.project.revision,archived:true});
 const project=archiveFixture(p.project),inventory={videos:[]};resolve({project,inventory});await settle();
 assert.deepEqual(applied,[[project,inventory,project.dealers[0].id]]);assert.deepEqual(pending,[true,false]);
});
test('a server conflict keeps the selected dealer and releases the UI lock',async()=>{
 let applied=0;const pending=[],h=harness(async()=>{throw Error('studio_conflict');});
 const p={...props(),onApplied(){applied++;},onPendingChange:x=>pending.push(x)};
 button(h.render(p),'Flytta').props.onClick();await settle();
 assert.equal(applied,0);assert.match(renderToStaticMarkup(h.render(p)),/studio_conflict/);assert.deepEqual(pending,[true,false]);
 assert.ok(p.project.dealers.some(row=>row.id==='johanna'));
});
test('unsaved changes disable lifecycle writes and explain how to continue',()=>{
 const h=harness(),p={...props(),disabled:true,disabledReason:'Spara först'};
 const tree=h.render(p);button(tree,'Flytta').props.onClick();assert.match(renderToStaticMarkup(tree),/Spara först/);
});
test('trash is accessible with a base dealer selected and restores the exact dealer',async()=>{
 const original=own(),project=archiveFixture(original);
 project.dealerTrash=[{schemaVersion:1,dealer:original.dealers.find(row=>row.id==='johanna'),lines:original.lines.filter(row=>row.dealerId==='johanna'),idlePolicy:null,activeMediaIds:[],archivedAt:'2026-10-11T12:00:00.000Z'}];
 const calls=[],applied=[],h=harness(async(path,init)=>{calls.push(JSON.parse(init.body));return{project:original,inventory:{videos:[]}};});
 const p={...props(project),dealerId:'astrid',onApplied:(...args)=>applied.push(args)};
 const tree=h.render(p);assert.match(renderToStaticMarkup(tree),/Papperskorg för dealers · 1/);
 button(tree,'Återställ dealer').props.onClick();await settle();
 assert.equal(calls[0].archived,false);assert.equal(calls[0].dealerId,'johanna');assert.equal(applied[0][2],'johanna');
});

test('a lost archive response is reconciled by reads without repeating the mutation',async()=>{
 const p=props(),saved=archiveFixture(p.project),calls=[],applied=[];
 const h=harness(async(path)=>{calls.push(path);if(path==='/api/dealers/archive')throw Error('Network lost');if(path==='/api/project')return{project:saved};if(path==='/api/videos')return{videos:[]};throw Error('Unexpected request');});
 p.onApplied=(...args)=>applied.push(args);button(h.render(p),'Flytta').props.onClick();await settle();
 assert.deepEqual(calls,['/api/dealers/archive','/api/project','/api/videos']);
 assert.equal(applied.length,1);assert.equal(applied[0][0],saved);
});

test('whole dealer purge has a separate preflight and explicit final confirmation',async()=>{
 const project=archiveFixture(own()),calls=[],applied=[],p={...props(project),dealerId:'astrid',onApplied:(...args)=>applied.push(args)};
 const finished=structuredClone(project);finished.revision='purged';finished.dealerTrash=[];
 const h=harness(async(path,init)=>{calls.push([path,JSON.parse(init.body)]);return path.endsWith('delete-check')?{allowed:true,count:2}:{project:finished,inventory:{videos:[]}};});
 button(h.render(p),'Radera dealer permanent…').props.onClick();await settle();
 assert.equal(calls.length,1);assert.equal(calls[0][0],'/api/dealers/delete-check');
 let tree=h.render(p);assert.match(renderToStaticMarkup(tree),/2 uppladdade filer/);
 button(tree,'Radera dealer och filer permanent').props.onClick();await settle();
 assert.equal(calls[1][0],'/api/dealers/delete');assert.deepEqual(calls[1][1],{dealerId:'johanna',expectedRevision:project.revision});
 assert.equal(applied.length,1);assert.equal(applied[0][0].revision,'purged');
});
test('a dealer upload-grant wait prevents confirmation and shows remaining time',async()=>{
 const calls=[],p={...props(archiveFixture(own())),dealerId:'astrid'},h=harness(async path=>{calls.push(path);return{allowed:false,reason:'studio_media_upload_grant_active',retryAfterMs:120001};});
 button(h.render(p),'Radera dealer permanent…').props.onClick();await settle();
 const tree=h.render(p),final=button(tree,'Radera dealer och filer permanent');
 assert.equal(final.props.disabled,true);final.props.onClick();await settle();
 assert.deepEqual(calls,['/api/dealers/delete-check']);assert.match(renderToStaticMarkup(tree),/cirka 3 minuter/);
});
test('a partially completed dealer purge refreshes pending state, blocks restore and offers resume',async()=>{
 const project=archiveFixture(own()),pending=structuredClone(project),calls=[];
 pending.revision='pending-purge';pending.dealerTrash[0].deletion={state:'pending',requestedAt:'2026-10-11T12:00:00.000Z',mediaIds:[]};
 const p={...props(project),dealerId:'astrid',onProjectSaved:next=>{p.project=next;}};
 const h=harness(async path=>{calls.push(path);if(path.endsWith('delete-check'))return{allowed:true};if(path==='/api/project')return{project:pending};if(path==='/api/videos')return{videos:[]};throw Error('studio_media_delete_failed');});
 button(h.render(p),'Radera dealer permanent…').props.onClick();await settle();
 button(h.render(p),'Radera dealer och filer permanent').props.onClick();await settle();
 const tree=h.render(p);assert.equal(p.project.revision,'pending-purge');assert.equal(button(tree,'Återställ dealer').props.disabled,true);
 assert.ok(button(tree,'Slutför radering'));assert.match(renderToStaticMarkup(tree),/Några filer kan redan vara permanent raderade/);
 assert.equal(calls.filter(path=>path==='/api/dealers/delete').length,1);
});

test('an active speech profile explains the next step and cannot be archived from the UI',()=>{
 const p=props();p.project.dealers.find(row=>row.id==='johanna').speechProfile={state:'enabled'};
 const h=harness(),tree=h.render(p),remove=button(tree,'Flytta');
 assert.equal(remove.props.disabled,true);remove.props.onClick();assert.match(renderToStaticMarkup(tree),/Stäng av AI-tal/);
});
