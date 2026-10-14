import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { addDealer, createSeedProject } from '../lib/studio-model.mjs';
import { canonicalControlHref } from '../lib/control-flow.mjs';
import { studioLoginDestination } from '../lib/studio-login-client.mjs';
import { fixture } from './fixtures/dealer-forge-fixture.mjs';

const require=createRequire(import.meta.url), {transformSync}=require('next/dist/build/swc');
function load(file,overrides={},globals={}) {
  const url=new URL(file,import.meta.url),localRequire=createRequire(url),module={exports:{}};
  const {code}=transformSync(readFileSync(url,'utf8'),{filename:fileURLToPath(url),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  vm.runInNewContext(code,{module,exports:module.exports,structuredClone,URL,URLSearchParams,Blob,Error,Request,Headers,...globals,require:name=>{
    if(Object.hasOwn(overrides,name))return overrides[name];
    if(name.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
    if(name==='./studio-types')return load('../components/studio-types.ts',overrides,globals);
    if(name.startsWith('./')&&!/\.(mjs|js)$/.test(name))return new Proxy({},{get:(_,key)=>key});
    return localRequire(name);
  }});
  return module.exports;
}
function hooks() {
  const values=[],setters=[],refs=[],memos=[],effects=[];let stateIndex=0,refIndex=0,memoIndex=0,effectIndex=0,pending=[];
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
  const react={...React,
    useState(initial){const index=stateIndex++;if(!(index in values))values[index]=typeof initial==='function'?initial():initial;setters[index]??=next=>{values[index]=typeof next==='function'?next(values[index]):next;};return [values[index],setters[index]];},
    useRef(initial){return refs[refIndex++]??=( {current:initial} );},
    useMemo(fn,deps){const index=memoIndex++;if(!same(memos[index]?.deps,deps))memos[index]={deps,value:fn()};return memos[index].value;},
    useCallback(fn,deps){return this.useMemo(()=>fn,deps);},
    useEffect(fn,deps){const index=effectIndex++;if(!same(effects[index]?.deps,deps))pending.push(()=>{effects[index]?.cleanup?.();effects[index]={deps,cleanup:fn()};});},
  };
  // Transpiled named hook calls have no receiver.
  react.useCallback=(fn,deps)=>react.useMemo(()=>fn,deps);
  return {react,render(Component,props){stateIndex=refIndex=memoIndex=effectIndex=0;return Component(props);},effects(){const work=pending;pending=[];for(const effect of work)effect();},unmount(){for(const effect of effects)effect?.cleanup?.();}};
}
function nodes(node,predicate){if(Array.isArray(node))return node.flatMap(item=>nodes(item,predicate));if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];}
const text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):String(node??'');
const button=(tree,label)=>nodes(tree,node=>node.type==='button'&&text(node)===label)[0];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const response=(data,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data)});
function browser(href) {
  let url=new URL(href),state=null;const listeners=new Map(),timers=new Map();let timer=0;
  return {listeners,timers,location:{get href(){return url.href;},get pathname(){return url.pathname;},get origin(){return url.origin;},get search(){return url.search;},get hash(){return url.hash;},assign(){assert.fail('draft test must not navigate away');}},
    history:{get state(){return state;},pushState(value,_title,next){state=structuredClone(value);if(next!==undefined)url=new URL(next,url);},replaceState(value,_title,next){state=structuredClone(value);if(next!==undefined)url=new URL(next,url);}},
    addEventListener(type,listener){listeners.set(type,listener);},removeEventListener(type,listener){if(listeners.get(type)===listener)listeners.delete(type);},
    dispatchEvent(event){listeners.get(event.type)?.(event);return !event.defaultPrevented;},
    setTimeout(callback){timers.set(++timer,callback);return timer;},clearTimeout(id){timers.delete(id);},
  };
}

test('legacy material page redirects safe dealer and room context into the existing workspace',async()=>{
  let target;
  const Page=load('../app/control/dealer-forge/page.tsx',{
    '@/lib/control-flow.mjs':{canonicalControlHref},'@/components/studio-types':{firstQueryValue:value=>Array.isArray(value)?value[0]:value},
    '../public-redirect':{redirectToPublicControl:async href=>{target=href;}},
  }).default;
  await Page({searchParams:Promise.resolve({dealerId:['paow','astrid'],lane:'scene-a',operator:'north',table:'room-7',token:'private',view:'settings'})});
  const url=new URL(target,'https://qa.invalid');
  assert.equal(url.pathname,'/control/clips');
  assert.deepEqual(Object.fromEntries(url.searchParams),{dealer:'paow',composition:'scene-a',operator:'north',table:'room-7',view:'generate'});
  assert.equal(studioLoginDestination(target,'/studio/api/auth'),target);
  await Page({searchParams:Promise.resolve({dealer:'https://other.invalid',operator:'bad/value',table:'room-7'})});
  assert.equal(target,'/control/clips?table=room-7&view=generate');
});

test('material draft stays mounted across tabs and blocks dealer, history and native account departure',()=>{
  const h=hooks(),window=browser('https://qa.invalid/control/clips?dealer=paow&view=generate&composition=scene-a&operator=north&table=room-7&game=roulette');
  const {LabStudio}=load('../components/lab-studio.tsx',{react:h.react},{window});
  const props={initialProject:addDealer(createSeedProject(),'paow','PAOW'),initialVideos:{videos:[]},initialDealerId:'paow',initialView:'generate',initialLaneId:'scene-a',initialOperatorId:'north',initialTableId:'room-7',initialGame:'roulette',connectedLane:true};
  let tree=h.render(LabStudio,props);h.effects();tree=h.render(LabStudio,props);h.effects();
  const creator=nodes(tree,node=>node.type==='DealerMaterialCreator')[0];
  assert.equal(creator.props.dealerId,'paow');assert.equal(creator.key,'paow');
  assert.deepEqual(JSON.parse(JSON.stringify(creator.props.navigationContext)),{laneId:'scene-a',operatorId:'north',tableId:'room-7',game:'roulette'});
  creator.props.onPendingChange({dirty:true,busy:false});tree=h.render(LabStudio,props);h.effects();
  const nav=nodes(tree,node=>node.type==='StudioNavigation')[0];
  nav.props.onNavigate({preventDefault(){}},'/control/clips?dealer=paow&view=clips');
  tree=h.render(LabStudio,props);h.effects();
  const hidden=nodes(tree,node=>node.type==='DealerMaterialCreator')[0];assert.equal(hidden.key,creator.key);assert.equal(hidden.props.active,false);
  const astrid=nodes(tree,node=>node.type==='button'&&text(node)==='A Astrid')[0];assert.ok(astrid);astrid.props.onClick();
  tree=h.render(LabStudio,props);h.effects();assert.equal(nodes(tree,node=>node.type==='DealerMaterialCreator')[0].props.dealerId,'paow');
  let prevented=false;window.listeners.get('beforeunload')({preventDefault(){prevented=true;}});assert.equal(prevented,true,'native links including account/logout preserve guard');
  window.history.pushState(null,'','/control/clips?dealer=astrid&view=clips');window.listeners.get('popstate')(new Event('popstate'));
  tree=h.render(LabStudio,props);h.effects();assert.equal(new URL(window.location.href).searchParams.get('dealer'),'paow');
  nodes(tree,node=>node.type==='DealerMaterialCreator')[0].props.onPendingChange({dirty:false,busy:false});tree=h.render(LabStudio,props);h.effects();
  nodes(tree,node=>node.type==='button'&&text(node)==='A Astrid')[0].props.onClick();tree=h.render(LabStudio,props);h.effects();tree=h.render(LabStudio,props);
  assert.equal(new URL(window.location.href).searchParams.get('dealer'),'astrid');assert.equal(nodes(tree,node=>node.type==='DealerMaterialCreator')[0].props.dealerId,'astrid');
  h.unmount();assert.equal(window.listeners.size,0);
});

test('failed material writes freeze controls, preserve a profile draft and recover by read only retry',async()=>{
  const {service}=fixture(),state=await service.state('paow');const h=hooks(),window=browser('https://qa.invalid/control/clips?dealer=paow&view=generate'),requests=[],pending=[];
  let failWrite=true;
  const fetch=async(url,init={})=>{requests.push({url,method:init.method??'GET'});return init.method==='POST'&&failWrite?response({error:'studio_native_unavailable'},503):response(state);};
  const {DealerMaterialCreator}=load('../components/dealer-forge-page.tsx',{react:h.react},{window,fetch});
  const props={dealerId:'paow',initialState:state,onPendingChange:value=>pending.push(value)};
  let tree=h.render(DealerMaterialCreator,props);h.effects();
  nodes(tree,node=>node.type==='input'&&node.props.placeholder==='woman with dark hair, white shirt, black vest')[0].props.onChange({target:{value:'My preserved profile'}});
  tree=h.render(DealerMaterialCreator,props);h.effects();assert.equal(pending.at(-1).dirty,true);
  button(tree,'Spara profil').props.onClick();await tick();tree=h.render(DealerMaterialCreator,props);h.effects();
  assert.match(text(tree),/tillfälligt otillgängligt/);assert.doesNotMatch(text(tree),/studio_native_unavailable/);
  assert.equal(nodes(tree,node=>node.type==='fieldset')[0].props.disabled,true);
  button(tree,'Spara profil').props.onClick();await tick();assert.equal(requests.length,1,'blocked controls cannot submit again');
  failWrite=false;button(tree,'Försök ansluta igen').props.onClick();await tick();tree=h.render(DealerMaterialCreator,props);h.effects();
  assert.equal(nodes(tree,node=>node.type==='fieldset')[0].props.disabled,false);
  assert.equal(nodes(tree,node=>node.type==='input'&&node.props.placeholder==='woman with dark hair, white shirt, black vest')[0].props.value,'My preserved profile');
  assert.deepEqual(requests.map(row=>row.method),['POST','GET']);assert.equal(pending.at(-1).dirty,true);
  h.unmount();assert.equal(pending.at(-1).dirty,false);
});

test('material reads ignore an older dealer response and stop job polling when the tab is hidden',async()=>{
  const {service}=fixture(),paow=await service.state('paow'),astrid={...paow,dealer:{id:'astrid',label:'Astrid'}};
  const h=hooks(),window=browser('https://qa.invalid/control/clips'),requests=[];
  const fetch=(url,init)=>new Promise(resolve=>requests.push({url,init,resolve}));
  const {DealerMaterialCreator}=load('../components/dealer-forge-page.tsx',{react:h.react},{window,fetch});
  h.render(DealerMaterialCreator,{dealerId:'paow'});h.effects();
  h.render(DealerMaterialCreator,{dealerId:'astrid'});h.effects();assert.equal(requests.length,2);
  requests[1].resolve(response(astrid));await tick();requests[0].resolve(response(paow));await tick();
  let tree=h.render(DealerMaterialCreator,{dealerId:'astrid'});h.effects();assert.match(text(tree),/Grundposer · Astrid/);assert.doesNotMatch(text(tree),/Grundposer · Paow/);h.unmount();
  const polling=hooks();const {DealerMaterialCreator:Polling}=load('../components/dealer-forge-page.tsx',{react:polling.react},{window,fetch:()=>assert.fail('hidden tab must not poll or generate')});
  const props={dealerId:'paow',initialState:{...paow,jobs:[{jobId:'existing',status:'running',taskId:'provider-task',request:{}}]}};
  polling.render(Polling,props);polling.effects();assert.equal(window.timers.size,1,'active mounted tab schedules its existing job');
  polling.render(Polling,{...props,active:false});polling.effects();assert.equal(window.timers.size,0,'leaving the tab cancels polling');polling.unmount();
});
