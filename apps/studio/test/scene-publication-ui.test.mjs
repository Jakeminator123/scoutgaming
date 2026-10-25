import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import React from 'react';
import {createSeedProject,defaultPresentationLane,validateProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {buildPresentationPackage} from '../../../packages/presentation/contracts/presentation-layers.mjs';
import {defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {appearanceReceipt} from '../components/partner-appearance-state.mjs';
import * as scenePublication from '../lib/scene-publication.mjs';

const file=new URL('../client/admin/components/studio/scene-publication.tsx',import.meta.url),require=createRequire(file);
const {transformSync}=require('next/dist/build/swc');
const compiled=transformSync(readFileSync(file,'utf8'),{filename:fileURLToPath(file),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>structuredClone(value)});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const text=node=>node==null||typeof node==='boolean'?'':typeof node==='object'?[node.props?.children].flat(Infinity).map(text).join(''):String(node);
const walk=(node,predicate)=>node&&typeof node==='object'?[...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>walk(child,predicate))]:[];

function fixture(){
  const project=createSeedProject();
  project.lanes=['scene-a','scene-b'].map(id=>({...defaultPresentationLane('astrid'),id,label:id,composition:defaultCompositionSettings()}));
  const frozen=validateProject(project),presentation=buildPresentationPackage(frozen,['scene-a','scene-b'],[]);
  const initial={operatorId:'operator-a',packageRevision:7,lanes:['scene-a','scene-b'],adjustable:[],canConfigure:true,
    branding:{color:'#123456'},draft:null,draftRevision:0,history:[],presentation,
    rooms:['scene-a','scene-b'].map((id,index)=>({id:'room-'+index,label:'Room '+index,presentationLaneId:id,game:'blackjack'}))};
  assert.equal(appearanceReceipt(initial,'operator-a'),true);
  const savedProject=structuredClone(frozen);savedProject.lanes.forEach(row=>{row.composition.mobile.table.y=.3;});
  const saved=validateProject(savedProject),expected=scenePublication.scenePublicationPreview(saved,'scene-a',presentation);
  return {initial,props:{project:structuredClone(saved),savedProject:saved,compositionId:'scene-a',operatorId:'operator-a',operatorSlug:'north',operatorName:'North',blocked:false,dirty:false},
    receipt:{ok:true,operatorId:'operator-a',compositionId:'scene-a',projectRevision:saved.revision,packageRevision:8,presentation:expected},
    readback:{...structuredClone(initial),packageRevision:8,presentation:expected}};
}

function harness(f,queue){
  const slots=[],requests=[],edits=[],busy=[];let cursor=0,pending=[],rerender=false,unmounted=false,lateWrites=0,tree;
  const props={...f.props,onEdit:project=>edits.push(project),onBusyChange:value=>busy.push(value)};
  const fetcher=(url,options={})=>{requests.push({url,options});assert.ok(queue.length,'unexpected fetch '+url);return Promise.resolve(queue.shift());};
  const hooks={...React,
    useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;
      return [slots[index],next=>{if(unmounted)lateWrites++;const value=typeof next==='function'?next(slots[index]):next;if(!Object.is(value,slots[index])){slots[index]=value;rerender=true;}}];},
    useRef:initial=>{const index=cursor++;return slots[index]??=( {current:initial} );},
    useEffect:(effect,deps)=>{const index=cursor++,previous=slots[index];if(!previous||deps.some((value,i)=>!Object.is(value,previous.deps[i]))){
      slots[index]={effect:true,deps};pending.push(()=>{previous?.cleanup?.();slots[index].cleanup=effect();});}}
  };
  const output={exports:{}};
  vm.runInNewContext(compiled.code,{module:output,exports:output.exports,fetch:fetcher,AbortController,structuredClone,
    require:name=>name==='react'?hooks:name.endsWith('/scene-publication.mjs')?{...scenePublication,publishSavedScene:input=>scenePublication.publishSavedScene({...input,fetchImpl:fetcher})}:require(name)},
  {filename:fileURLToPath(file)});
  function render(patch={}){
    assert.equal(unmounted,false);Object.assign(props,patch);let passes=0;
    do{assert.ok(++passes<20,'render loop');cursor=0;pending=[];rerender=false;tree=output.exports.ScenePublication(props);for(const commit of pending)commit();}while(rerender);
    return tree;
  }
  return {props,requests,edits,busy,render,
    button:label=>walk(tree,node=>node.type==='button'&&text(node)===label)[0],
    messages:role=>walk(tree,node=>node.props?.role===role).map(text),
    async flush(){await new Promise(resolve=>setImmediate(resolve));if(!unmounted)render();},
    unmount(){for(const slot of slots)if(slot?.effect)slot.cleanup?.();unmounted=true;},
    lateWrites:()=>lateWrites};
}

const publishLabel='Publicera sparad placering',importLabel='Läs in placering i mallen',reloadLabel='Läs in publicerad version';
const posts=h=>h.requests.filter(row=>row.options.method==='POST');

test('double click publishes once, stays busy through readback, and confirms only the verified saved result',async()=>{
  const f=fixture(),post=deferred(),readback=deferred(),h=harness(f,[response(f.initial),post.promise,readback.promise]);
  h.render();await h.flush();const button=h.button(publishLabel);assert.equal(button.props.disabled,false);
  button.props.onClick();button.props.onClick();h.render();assert.equal(posts(h).length,1);assert.deepEqual(h.busy,[true]);
  assert.equal(h.button(publishLabel).props.disabled,true);assert.equal(h.button(importLabel).props.disabled,true);
  assert.equal(h.messages('status').some(value=>value.includes('är publicerad')),false);
  post.resolve(response(f.receipt));await h.flush();assert.equal(h.requests.length,3);assert.deepEqual(h.busy,[true]);
  readback.resolve(response(f.readback));await h.flush();assert.deepEqual(h.busy,[true,false]);
  assert.ok(h.messages('status').some(value=>value.includes('publicerad som version 8')));
  assert.equal(h.button(publishLabel).props.disabled,true,'same saved geometry is now published');assert.deepEqual(h.messages('alert'),[]);assert.equal(h.edits.length,0);
});

test('dirty or externally blocked state rejects direct publication and import callbacks without changing the project',async()=>{
  for(const field of ['dirty','blocked']){
    const f=fixture(),before=structuredClone(f.props.project),h=harness(f,[response(f.initial)]);
    h.render({[field]:true});await h.flush();
    for(const label of [publishLabel,importLabel]){const button=h.button(label);assert.equal(button.props.disabled,true,field);button.props.onClick();}
    await h.flush();assert.equal(posts(h).length,0);assert.equal(h.edits.length,0);assert.deepEqual(h.busy,[]);assert.deepEqual(h.props.project,before);
    h.render({[field]:false});assert.equal(h.button(importLabel).props.disabled,false);h.button(importLabel).props.onClick();
    assert.equal(h.edits.length,1);assert.equal(h.edits[0].lanes[0].composition.mobile.table.y,f.initial.presentation.lanes[0].composition.mobile.table.y);
    assert.deepEqual(h.props.project,before);assert.equal(posts(h).length,0);
  }
});

test('late POST or readback cannot replace the next operator or composition, or report success after unmount',async()=>{
  for(const phase of ['post','readback'])for(const transition of ['operator','composition','unmount'])for(const outcome of ['success','failure']){
    const f=fixture(),gate=deferred(),queue=[response(f.initial),phase==='post'?gate.promise:response(f.receipt)];
    if(phase==='readback')queue.push(gate.promise);
    const next={...structuredClone(f.initial),...(transition==='operator'?{operatorId:'operator-b'}:{})};
    if(transition!=='unmount')queue.push(response(next));
    if(phase==='post'&&outcome==='success')queue.push(response(f.readback));
    const h=harness(f,queue);h.render();await h.flush();h.button(publishLabel).props.onClick();await h.flush();
    if(transition==='unmount')h.unmount();
    else{h.render(transition==='operator'?{operatorId:'operator-b',operatorSlug:'south',operatorName:'South'}:{compositionId:'scene-b'});await h.flush();}
    gate.resolve(outcome==='success'?response(phase==='post'?f.receipt:f.readback):response({},503));await h.flush();
    assert.equal(posts(h).length,1);assert.equal(h.edits.length,0);assert.equal(h.lateWrites(),0,phase+' '+transition);
    assert.equal(h.messages('status').some(value=>value.includes('är publicerad')),false);
    assert.deepEqual(h.messages('alert'),[],phase+' '+transition+' '+outcome);
    if(transition!=='unmount'){
      assert.equal(h.button(publishLabel).props.disabled,false,'new selection retains its own publishable saved geometry');
      if(transition==='operator')assert.ok(h.requests.some(row=>row.url==='/studio/api/partner/branding?operator=south'));
    }
    assert.equal(queue.length,0);
  }
});

test('unconfirmed readback disables retries and import until an explicit reload without a false success',async()=>{
  const f=fixture(),invalid={...structuredClone(f.readback),draftRevision:1},h=harness(f,[response(f.initial),response(f.receipt),response(invalid),response(f.readback)]);
  h.render();await h.flush();h.button(publishLabel).props.onClick();await h.flush();
  assert.equal(posts(h).length,1);assert.ok(h.messages('alert').some(value=>value.includes('återläsas säkert')));
  assert.equal(h.messages('status').some(value=>value.includes('är publicerad')),false);
  assert.equal(h.button(publishLabel).props.disabled,true);h.button(publishLabel).props.onClick();await h.flush();assert.equal(posts(h).length,1);
  assert.equal(h.button(importLabel),undefined);assert.equal(h.button(reloadLabel).props.disabled,false);
  h.button(reloadLabel).props.onClick();h.render();await h.flush();
  assert.equal(h.requests.length,4);assert.deepEqual(h.messages('alert'),[]);assert.equal(h.button(importLabel).props.disabled,false);
  assert.equal(h.button(publishLabel).props.disabled,true,'reload discovers the already published version without another POST');
  assert.equal(h.edits.length,0);assert.deepEqual(h.busy,[true,false]);
});
