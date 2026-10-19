import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as ui from '../client/admin/lib/moving-drift-ui.mjs';
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const compiled=transformSync(readFileSync(new URL('./moving-drift-controls.tsx',import.meta.url),'utf8'),{filename:'moving-drift-controls.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code;
const actor={username:'fixture-admin',role:'admin'};
const fixture=()=>({schemaVersion:1,revision:4,operationId:null,serverNowMs:100000,desired:{mode:'off',profileId:null,endsAtMs:null},observed:{status:'unknown',atMs:null,reasonCode:'drift_observation_missing'},profiles:[{id:'standard',label:'Fixture standard'}],selectedProfileId:null,actual:{profileId:null,gpu:null,workerId:null},readiness:{modelReady:false,releaseMatches:false,bankMatches:false},admission:{allowed:false,reasonCode:'drift_not_admitting'},capabilities:{connected:false,allowedModes:['off'],reasonCode:'drift_runtime_unavailable'},cost:{estimatedMicroUsd:null,source:null,quotedAtMs:null,shutdownTailMs:null}});
function running(){const dto=fixture();dto.desired={mode:'saving',profileId:'standard',endsAtMs:null};dto.selectedProfileId='standard';dto.observed={status:'ready',atMs:100000,reasonCode:null};dto.actual={profileId:'standard',gpu:'Verified fixture GPU',workerId:'fixture-worker'};dto.readiness={modelReady:true,releaseMatches:true,bankMatches:true};dto.admission={allowed:true,reasonCode:null};dto.capabilities={connected:true,allowedModes:['off','saving'],reasonCode:'drift_warm_unavailable'};return dto;}
function transport(state=fixture()) {
  const api={state,calls:[],getFailure:null,post:null,available:()=>true,async request(method,action,body,signal,expectedActor){
    api.calls.push({method,action,body:structuredClone(body),signal,expectedActor});
    if(method==='GET'){if(api.getFailure)throw api.getFailure;return {actor,payload:structuredClone(api.state)};}
    if(api.post)return api.post(body);
    const next=structuredClone(api.state);next.revision++;next.desired={mode:body.mode,profileId:body.profileId??null,endsAtMs:null};next.observed={status:'unknown',atMs:null,reasonCode:'drift_observation_missing'};next.admission.allowed=false;api.state=next;return {actor,payload:next};
  }};return api;
}
function harness(client) {
  const hooks=[],effects=[],timers=new Map(),events=new Map();let cursor=0,now=0,serial=0,command=0,updates=0,currentClient=client;
  const fakeReact={...React,useState(initial){const index=cursor++;if(!(index in hooks))hooks[index]=typeof initial==='function'?initial():initial;return [hooks[index],next=>{updates++;hooks[index]=typeof next==='function'?next(hooks[index]):next;}];},useRef(initial){const index=cursor++;if(!(index in hooks))hooks[index]={current:initial};return hooks[index];},useEffect(fn,deps){const index=cursor++,old=hooks[index];if(!old||deps.some((value,i)=>value!==old.deps[i]))effects.push(()=>{old?.cleanup?.();hooks[index]={deps,cleanup:fn()};});}};
  const window={setInterval(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearInterval(id){timers.delete(id);},addEventListener(name,fn){events.set(name,fn);},removeEventListener(name,fn){if(events.get(name)===fn)events.delete(name);},location:{reload(){assert.fail('unexpected reload');}}};
  const document={visibilityState:'visible',addEventListener:window.addEventListener,removeEventListener:window.removeEventListener};
  const module={exports:{}};
  vm.runInNewContext(compiled,{module,exports:module.exports,window,document,performance:{now:()=>now},AbortController,crypto:{randomUUID:()=>`command-${++command}`},require:name=>name==='react'?fakeReact:name.endsWith('.module.css')?{__esModule:true,default:{}}:name==='../client/admin/lib/moving-drift-ui.mjs'?ui:require(name)});
  const api={render(next=currentClient){currentClient=next;cursor=0;return module.exports.MovingDriftControls({client:next,expectedActor:actor});},effects(){while(effects.length)effects.shift()();},async settle(){await new Promise(resolve=>setImmediate(resolve));},tick(ms,{poll=false}={}){now+=ms;for(const timer of timers.values())if(timer.ms===1000||(poll&&timer.ms===10000))timer.fn();},unmount(){for(const hook of hooks)hook?.cleanup?.();},get updates(){return updates;},timers,events};return api;
}
function nodes(node,predicate){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(child=>nodes(child,predicate));return [...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];}
function text(node){if(node===null||node===undefined||typeof node==='boolean')return '';if(typeof node!=='object')return String(node);if(Array.isArray(node))return node.map(text).join('');return text(node.props?.children);}
const button=(tree,label)=>nodes(tree,node=>node.type==='button'&&text(node)===label)[0];
const radio=(tree,mode)=>nodes(tree,node=>node.type==='input'&&node.props.value===mode)[0];
const form=tree=>nodes(tree,node=>node.type==='form')[0];
async function mount(client){const h=harness(client);h.render();h.effects();await h.settle();return h;}

test('an unavailable action renders no operating controls and makes no request',async()=>{
  const api=transport();api.available=()=>false;const h=await mount(api);const tree=h.render();
  assert.match(text(tree),/inte tillgänglig för den här sessionen/);assert.equal(form(tree),undefined);assert.equal(api.calls.length,0);assert.equal(h.timers.size,0);h.unmount();
});
test('off-only control never displays stopped, ready or a zero price from an unknown observation',async()=>{
  const api=transport(),h=await mount(api),tree=h.render();
  assert.match(text(tree),/Faktisk drift: Okänd/);assert.equal(radio(tree,'saving').props.disabled,true);assert.equal(radio(tree,'warm').props.disabled,true);
  assert.match(text(tree),/Timpris för nytt valOkänt/);assert.doesNotMatch(text(tree),/Faktisk drift: Av|Redo för tal|0,00/);h.unmount();
});
test('a disabled warm mode cannot issue a command even through its event callback',async()=>{
  const api=transport(running()),h=await mount(api);radio(h.render(),'warm').props.onChange();form(h.render()).props.onSubmit({preventDefault(){}});await h.settle();
  assert.equal(api.calls.filter(call=>call.method==='POST').length,0);assert.equal(button(h.render(),'Använd läge').props.disabled,true);h.unmount();
});
test('stale observation loses speech readiness without relying on the computer clock',async()=>{
  const api=transport(running()),h=await mount(api);assert.match(text(h.render()),/Redo för tal/);h.tick(15001);
  assert.match(text(h.render()),/Faktisk drift: Okänd/);assert.doesNotMatch(text(h.render()),/Redo för tal/);assert.equal(button(h.render(),'Stoppa drift').props.disabled,true);h.unmount();
});
test('one stop request keeps unknown actual status and rejects immediate double clicks',async()=>{
  const api=transport(running());let release;api.post=()=>new Promise(resolve=>{release=resolve;});const h=await mount(api);
  const stop=button(h.render(),'Stoppa drift');stop.props.onClick();stop.props.onClick();
  assert.equal(api.calls.filter(call=>call.method==='POST').length,1);const sent=api.calls.at(-1);assert.deepEqual(sent.body,{expectedRevision:4,commandId:'command-1',mode:'off'});assert.deepEqual(sent.expectedActor,actor);
  const reply=fixture();reply.revision=5;release({actor,payload:reply});await h.settle();
  assert.match(text(h.render()),/Sparat önskemål: Av/);assert.match(text(h.render()),/Faktisk drift: Okänd/);assert.doesNotMatch(text(h.render()),/Faktisk drift: Av/);assert.equal(button(h.render(),'Stoppa drift'),undefined);h.unmount();
});
test('polling preserves an edited revision and requires an explicit rebase after a conflict',async()=>{
  const api=transport(running()),h=await mount(api);radio(h.render(),'off').props.onChange();api.state.revision=5;h.tick(10000,{poll:true});await h.settle();
  const tree=h.render();assert.match(text(tree),/Dina fält har behållit sin tidigare revision/);assert.equal(radio(tree,'off').props.checked,true);assert.equal(button(tree,'Använd läge').props.disabled,true);
  form(tree).props.onSubmit({preventDefault(){}});await h.settle();assert.equal(api.calls.filter(call=>call.method==='POST').length,0);
  button(h.render(),'Läs in sparat val').props.onClick();radio(h.render(),'off').props.onChange();form(h.render()).props.onSubmit({preventDefault(){}});await h.settle();
  assert.equal(api.calls.filter(call=>call.method==='POST').length,1);assert.equal(api.calls.at(-1).body.expectedRevision,5);h.unmount();
});
test('a failed command is never automatically retried and clears unconfirmed actual data',async()=>{
  const api=transport(running());api.post=async()=>{throw Object.assign(new Error('conflict'),{status:409});};const h=await mount(api);button(h.render(),'Stoppa drift').props.onClick();await h.settle();
  assert.match(text(h.render()),/Läs om status/);assert.match(text(h.render()),/Faktisk drift: Okänd/);assert.equal(api.calls.filter(call=>call.method==='POST').length,1);
  h.tick(10000,{poll:true});await h.settle();assert.equal(api.calls.filter(call=>call.method==='POST').length,1);h.unmount();
});
test('revoked access removes profile data and suspends automatic reads',async()=>{
  const api=transport(running()),h=await mount(api);assert.match(text(h.render()),/Verified fixture GPU/);api.getFailure=Object.assign(new Error('revoked'),{status:403});
  h.tick(10000,{poll:true});await h.settle();assert.doesNotMatch(renderToStaticMarkup(h.render()),/Verified fixture GPU|Fixture standard/);const count=api.calls.length;
  h.tick(10000,{poll:true});await h.settle();assert.equal(api.calls.length,count);h.unmount();
});
test('an old transport response cannot clear the lock for a newer session command',async()=>{
  const a=transport(running()),b=transport(running());let releaseA,releaseB;a.post=()=>new Promise(resolve=>{releaseA=resolve;});b.post=()=>new Promise(resolve=>{releaseB=resolve;});
  const h=await mount(a);button(h.render(),'Stoppa drift').props.onClick();h.render(b);h.effects();await h.settle();button(h.render(),'Stoppa drift').props.onClick();
  const stopped=fixture();stopped.revision=5;releaseA({actor,payload:stopped});await h.settle();button(h.render(),'Stoppa drift').props.onClick();assert.equal(b.calls.filter(call=>call.method==='POST').length,1);
  releaseB({actor,payload:stopped});await h.settle();assert.match(text(h.render()),/Sparat önskemål: Av/);h.unmount();
});
test('leaving the view aborts the request and prevents late state updates',async()=>{
  const api=transport();let release;api.request=()=>new Promise(resolve=>{release=resolve;});const h=harness(api);h.render();h.effects();h.unmount();const updates=h.updates;
  release({actor,payload:fixture()});await h.settle();assert.equal(h.updates,updates);assert.equal(h.timers.size,0);assert.equal(h.events.size,0);
});
test('submitting an unchanged form never creates another desired-state command',async()=>{
  const api=transport(running()),h=await mount(api);assert.equal(button(h.render(),'Använd läge').props.disabled,true);
  form(h.render()).props.onSubmit({preventDefault(){}});await h.settle();assert.equal(api.calls.filter(call=>call.method==='POST').length,0);h.unmount();
});