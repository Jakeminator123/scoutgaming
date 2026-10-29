import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { addDealer, createSeedProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { legacyStudioDocumentHref } from '../lib/legacy-studio-document.mjs';
import { studioLoginDestination } from '../lib/studio-login-client.mjs';
import { fixture, PNG } from './fixtures/dealer-forge-fixture.mjs';

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

test('legacy material URL redirects safe dealer and room context into the existing workspace',()=>{
  const destination=query=>legacyStudioDocumentHref(new Request('https://qa.invalid/control/dealer-forge?'+query));
  const target=destination('dealerId=paow&dealerId=astrid&lane=scene-a&operator=north&table=room-7&token=private&view=settings');
  const url=new URL(target,'https://qa.invalid');
  assert.equal(url.pathname,'/admin/dealers/paow','material generation opens on the dealer nav');
  assert.deepEqual(Object.fromEntries(url.searchParams),{flik:'klipp',panel:'generera',composition:'scene-a',operator:'north',table:'room-7'});
  assert.equal(studioLoginDestination(target,'/studio/api/auth'),target);
  assert.equal(destination('dealer=https://other.invalid&operator=bad/value&table=room-7'),'/admin/dealers?table=room-7','an unsafe dealer never becomes a dealer nav');
});



test('failed material writes freeze controls, preserve a profile draft and recover by read only retry',async()=>{
  const {service}=fixture(),state=await service.state('paow');const h=hooks(),window=browser('https://qa.invalid/admin/dealer-studio?dealer=paow&view=generate'),requests=[],pending=[];
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
  const h=hooks(),window=browser('https://qa.invalid/admin/dealer-studio'),requests=[];
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

test('the dedicated material page preserves dealer scope and guards pending work on every exit',()=>{
  const h=hooks(),window=browser('https://qa.invalid/admin/dealer-studio?dealer=paow&view=generate');
  const {DealerMaterialPage}=load('../components/dealer-material-page.tsx',{react:h.react},{window});
  const context={laneId:'scene-a',operatorId:'north',tableId:'room-7',game:'roulette'};
  const props={project:addDealer(createSeedProject(),'paow','PAOW'),dealerId:'paow',navigationContext:context,disabled:false};
  const render=()=>{const tree=h.render(DealerMaterialPage,props);h.effects();return tree;};
  let tree=render(),creator=nodes(tree,node=>node.type==='DealerMaterialCreator')[0];
  assert.equal(creator.props.dealerId,'paow');assert.equal(creator.key,'paow');
  assert.deepEqual(creator.props.navigationContext,context);
  for(const pending of [{dirty:true,busy:false},{dirty:false,busy:true}]){
    creator.props.onPendingChange(pending);tree=render();
    const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
    window.listeners.get('studio:before-navigate')(event);assert.equal(event.defaultPrevented,true);
    let warned=false;window.listeners.get('beforeunload')({preventDefault(){warned=true;}});assert.equal(warned,true);
    assert.equal(nodes(tree,node=>node.type==='DealerMaterialCreator')[0].key,'paow');
  }
  creator.props.onPendingChange({dirty:false,busy:false});render();
  const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
  window.listeners.get('studio:before-navigate')(event);assert.equal(event.defaultPrevented,false);
  h.unmount();assert.equal(window.listeners.size,0);
});
test('material page does not mount a creator for a missing or archived dealer',()=>{
  for(const dealerId of [undefined,'missing']){
    const h=hooks(),window=browser('https://qa.invalid/admin/dealer-studio?view=generate');
    const {DealerMaterialPage}=load('../components/dealer-material-page.tsx',{react:h.react},{window});
    const tree=h.render(DealerMaterialPage,{project:createSeedProject(),dealerId,navigationContext:{},disabled:false});
    assert.equal(nodes(tree,node=>node.type==='DealerMaterialCreator').length,0);h.effects();h.unmount();
  }
});

// The composer's idempotency key, by behaviour: an uncertain failure (5xx) keeps the key so a retry returns the
// journaled job instead of paying again; a definite refusal (4xx) or a changed request gets a new key.
test('a paid generation keeps one requestId across an uncertain failure and takes a new one after a refusal or a changed request',async()=>{
  const {service}=fixture();
  await service.uploadAnchor('paow',{pose:'vila',contentType:'image/png',dataBase64:PNG.toString('base64')},{actor:'tester'});
  const state=await service.state('paow');
  const h=hooks(),window=browser('https://qa.invalid/admin/dealers/paow?flik=klipp&panel=generera'),jobs=[],replies=[];
  const fetch=async(url,init={})=>{
    if(init.method==='POST'&&url.endsWith('/preview'))return response(await service.preview('paow',JSON.parse(init.body)));
    if(init.method==='POST'&&url.endsWith('/jobs')){jobs.push(JSON.parse(init.body));const [status,body]=replies.shift();return response(body,status);}
    assert.notEqual(init.method,'POST','no other write');return response(state);
  };
  const {DealerMaterialCreator}=load('../components/dealer-forge-page.tsx',{react:h.react},{window,fetch,crypto:globalThis.crypto});
  const props={dealerId:'paow',initialState:state};
  const render=()=>{const tree=h.render(DealerMaterialCreator,props);h.effects();return tree;};
  // The composer is a function component in the same file; expand it so its submit button is reachable.
  const expand=node=>Array.isArray(node)?node.map(expand):node&&typeof node==='object'?typeof node.type==='function'&&node.type.name==='Composer'?expand(node.type(node.props)):{...node,props:{...node.props,children:expand(node.props?.children)}}:node;
  const action=name=>nodes(expand(render()),node=>node.props?.['data-action']===name)[0];
  const settle=async()=>{for(let i=0;i<3;i++){await tick();render();}};
  const submit=async([status,body])=>{replies.push([status,body]);assert.equal(action('submit-job').props.disabled,false);action('submit-job').props.onClick();await settle();};
  action('generate-redo').props.onClick();await settle();
  await submit([503,{error:'runway_unavailable'}]);
  action('reconnect').props.onClick();await settle();
  await submit([503,{error:'runway_unavailable'}]);
  action('reconnect').props.onClick();await settle();
  await submit([422,{error:'forge_slot_invalid'}]);
  await submit([503,{error:'runway_unavailable'}]);
  action('reconnect').props.onClick();await settle();
  const prompt=nodes(expand(render()),node=>node.type==='textarea')[0];prompt.props.onChange({target:{value:prompt.props.value+' Changed.'}});await settle();
  await submit([503,{error:'runway_unavailable'}]);
  assert.equal(jobs.length,5);const ids=jobs.map(job=>job.requestId);
  assert.ok(ids.every(id=>/^[0-9a-f-]{36}$/.test(id)));
  assert.equal(ids[1],ids[0],'a retry after an uncertain 503 reuses the key');
  assert.equal(ids[2],ids[0],'every retry after an uncertain failure keeps the key, also the one that is then refused');
  assert.notEqual(ids[3],ids[2],'after a definite 422 refusal the next click is a new request');
  assert.notEqual(ids[4],ids[3],'a changed request body gets a new key');
  const withoutKey=({requestId,...body})=>body;
  assert.deepEqual(withoutKey(jobs[1]),withoutKey(jobs[0]));assert.notEqual(jobs[4].prompt,jobs[3].prompt);
  h.unmount();
});
