import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {availablePartnerRooms,initialPartnerRoomSelection} from '../lib/partner-room-selection.mjs';
import {partnerCopy,partnerNavigation} from '../components/partner/partner-copy.mjs';
import {PARTNER_PERMISSIONS} from '../../../packages/studio-access/server/partner-access-policy.mjs';
import {workspaceSurfacePath} from '../../../packages/navigation/workspace-surfaces.mjs';
import {jsxRequire} from './fixtures/jsx-require.mjs';
const require=createRequire(import.meta.url);
const {PartnerRoomWorkspace}=jsxRequire(import.meta.url)('../components/partner/views/rooms.jsx');
const operator={id:'north',slug:'north-casino',name:'North'};
const snapshot={operator,presentations:[],tables:[
  {id:'main-room',name:'Main',operatorId:'north',status:'active'},
  {id:'vip-room',name:'VIP',operatorId:'north',status:'active'},
  {id:'paused-room',name:'Paused',operatorId:'north',status:'paused'},
  {id:'archived-room',name:'Archived',operatorId:'north',status:'archived'},
  {id:'foreign-room',name:'Foreign',operatorId:'south',status:'active'},
]};
test('room deep links resolve exact registered ownership and active status without fallback',()=>{
  assert.deepEqual(availablePartnerRooms(snapshot).map(room=>room.id),['main-room','vip-room']);
  assert.deepEqual(initialPartnerRoomSelection(snapshot,'vip-room'),{roomId:'vip-room',unavailable:false});
  assert.deepEqual(initialPartnerRoomSelection(snapshot),{roomId:'main-room',unavailable:false});
  for(const room of ['foreign-room','paused-room','archived-room','missing','', '../main-room',['main-room','vip-room']])
    assert.deepEqual(initialPartnerRoomSelection(snapshot,room),{roomId:'',unavailable:true});
});
test('unavailable room links render no default preview or appearance controls',()=>{
  for(const initialRoomId of ['foreign-room','missing',['main-room','vip-room']]){
    const html=renderToStaticMarkup(React.createElement(PartnerRoomWorkspace,{snapshot,copy:partnerCopy('sv'),language:'sv',initialRoomId,apiBase:'/studio/api/partner/snapshot'}));
    assert.match(html,/Det begärda spelbordet är inte tillgängligt/);
    assert.doesNotMatch(html,/Hämtar utseende|kevin-package/);
  }
});
test('the exact room is selected in server markup before client hydration',()=>{
  const html=renderToStaticMarkup(React.createElement(PartnerRoomWorkspace,{snapshot,copy:partnerCopy('sv'),language:'sv',initialRoomId:'vip-room',apiBase:'/studio/api/partner/snapshot'}));
  assert.match(html,/<h1>VIP<\/h1>/);assert.match(html,/aria-current="page">VIP</);
  assert.doesNotMatch(html,/Foreign|Archived|Main|spelbordet är inte tillgängligt/i);
  assert.match(html,/Hämtar utseende/);
  // The list (no room requested) shows the company's rooms as cards, the paused one marked, never foreign or archived rooms.
  const list=renderToStaticMarkup(React.createElement(PartnerRoomWorkspace,{snapshot,copy:partnerCopy('sv'),language:'sv',list:true,apiBase:'/studio/api/partner/snapshot'}));
  assert.match(list,/aria-label="Öppna Main"/);assert.match(list,/aria-label="Öppna VIP"/);
  assert.match(list,/Paused[\s\S]*pausat/);assert.doesNotMatch(list,/aria-label="Öppna Paused"|Foreign|Archived/);
  assert.match(list,/Bolagets standard/);
});

test('controlled room selection renders the current scope instead of its original room',()=>{
  const html=renderToStaticMarkup(React.createElement(PartnerRoomWorkspace,{snapshot,copy:partnerCopy('sv'),language:'sv',initialRoomId:'main-room',selection:{roomId:'vip-room',unavailable:false},onSelectionChange(){},apiBase:'/studio/api/partner/snapshot'}));
  assert.match(html,/<h1>VIP<\/h1>/);assert.doesNotMatch(html,/<h1>Main<\/h1>/);
  const company=renderToStaticMarkup(React.createElement(PartnerRoomWorkspace,{snapshot,copy:partnerCopy('sv'),language:'sv',selection:{roomId:'',unavailable:false},onSelectionChange(){},apiBase:'/studio/api/partner/snapshot'}));
  assert.match(company,/<h1>Bolagets standard<\/h1>/);
});

function sessionHarness({initialRoomId,initialRoomScope,path='/partner/north-casino/rooms?room=main-room',accessClass='internal-admin'}={}) {
  const sourceUrl=new URL('../components/partner/partner-operator-workspace.jsx',import.meta.url);
  const {transformSync}=require('next/dist/build/swc');
  const code=transformSync(require('node:fs').readFileSync(sourceUrl,'utf8'),{filename:'partner-operator-workspace.jsx',jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code;
  const slots=[],effects=[],listeners=new Map(),entries=[{href:path,state:{consumer:'kept'}}];let cursor=0,index=0,queue=[],url=new URL(path,'https://partner.fixture.invalid');
  const hooks={...React,useMemo:fn=>fn(),useCallback:fn=>fn,
    useState(value){const i=cursor++;if(!(i in slots))slots[i]=typeof value==='function'?value():value;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
    useRef(value){return slots[cursor++]??={current:value};},
    useEffect(effect,deps){const i=cursor++;if(!effects[i]||deps.some((value,j)=>value!==effects[i].deps[j])){queue=queue.filter(item=>item.i!==i);queue.push({i,effect,deps});}},
  };
  const history={get state(){return entries[index].state;},get length(){return entries.length;},
    replaceState(state,title,path=url.href){url=new URL(path,url);entries[index]={href:url.pathname+url.search+url.hash,state};},
    pushState(state,title,path){url=new URL(path,url);entries.splice(index+1);entries.push({href:url.pathname+url.search+url.hash,state});index++;},
    go(delta){if(index+delta<0||index+delta>=entries.length)return;index+=delta;url=new URL(entries[index].href,url);window.dispatchEvent(new Event('popstate'));}};
  const window={location:{get pathname(){return url.pathname},get search(){return url.search},get hash(){return url.hash},get href(){return url.href},get origin(){return url.origin},assign(value){window.assigned=value;},reload(){window.reloaded=true;}},history,confirm:()=>false,
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    dispatchEvent(event){for(const fn of listeners.get(event.type)??[])fn(event);return !event.defaultPrevented;}};
  const stubs={react:hooks,'../partner-session-actions':{PartnerSessionActions:()=>null},'./partner-copy.mjs':{partnerNavigation,usePartnerPreferences:()=>({copy:partnerCopy('sv'),language:'sv',theme:'light'})}};
  const nested=jsxRequire(sourceUrl,stubs),module={exports:{}};
  require('node:vm').runInNewContext(code,{module,exports:module.exports,URL,URLSearchParams,structuredClone,window,Intl,
    require:name=>name.endsWith('.css')?{}:Object.hasOwn(stubs,name)?stubs[name]:nested(name)});
  const initialSnapshot={...snapshot,tables:snapshot.tables.filter(room=>room.operatorId===operator.id),preview:false,accessClass,operators:[operator,{id:'south',slug:'south-casino',name:'South'}],team:[],presentations:[],permissions:[...PARTNER_PERMISSIONS],role:{id:'partner-admin',label:'administratör'}};
  const props={surface:'partner',initialSnapshot,initialRoomId,initialRoomScope,initialView:'rooms',apiBase:'/studio/api/partner/snapshot',user:'test'};
  const Session=module.exports.PartnerOperatorWorkspace(props).type;
  const walk=tree=>!tree||typeof tree!=='object'?[]:[tree,...React.Children.toArray(tree.props?.children).flatMap(walk)];
  const render=()=>{cursor=0;return Session(props);};
  const nodes=()=>walk(render()),view=()=>nodes().find(node=>node.type?.name==='PartnerOperatorView');
  const lobby=()=>nodes().find(node=>node.type==='a'&&node.props.href.startsWith('/lobby'));
  const settle=()=>{render();const pending=queue;queue=[];for(const item of pending){effects[item.i]?.cleanup?.();effects[item.i]={deps:item.deps,cleanup:item.effect()};}return render();};
  return {window,history,view,lobby,render,nodes,settle,selection:()=>view().props.roomSelection,choose:id=>view().props.onRoomSelectionChange({roomId:id,unavailable:false}),
    go:view=>{const path=workspaceSurfacePath('partner',view,operator.slug);nodes().find(node=>node.type==='a'&&node.props.className==='nav'&&node.props.href.split('?')[0]===path).props.onClick({button:0,preventDefault(){}});}};
}

test('staff lobby follows current room through menu changes, reload and back/forward',()=>{
  const h=sessionHarness();h.settle();
  assert.equal(h.lobby().props.href,'/lobby?operator=north-casino&room=main-room');
  h.choose('vip-room');assert.equal(h.lobby().props.href,'/lobby?operator=north-casino&room=vip-room');
  assert.equal(new URL(h.window.location.href).searchParams.get('room'),'vip-room');
  h.go('integration');assert.equal(h.selection().roomId,'vip-room');
  for(const link of h.nodes().filter(node=>node.type==='a'&&node.props.href.startsWith('/partner/north-casino'))) assert.equal(new URL(link.props.href,h.window.location.origin).searchParams.get('room'),'vip-room');
  assert.equal(h.nodes().find(node=>node.type?.name==='PartnerSessionActions').props.returnTo,'/partner/north-casino/integration?room=vip-room');
  h.go('rooms');
  assert.equal(h.lobby().props.href,'/lobby?operator=north-casino&room=vip-room');
  h.choose('main-room');h.history.go(-1);assert.equal(h.selection().roomId,'vip-room');
  h.history.go(1);assert.equal(h.selection().roomId,'main-room');
  const reloaded=sessionHarness({initialRoomId:new URL(h.window.location.href).searchParams.get('room'),path:new URL(h.window.location.href).pathname+h.window.location.search});
  reloaded.settle();assert.equal(reloaded.lobby().props.href,h.lobby().props.href);
  assert.equal(h.history.state.consumer,'kept');
});

test('staff lobby rejects invalid scope, keeps company defaults explicit and never appears for members',()=>{
  for(const room of ['foreign-room','paused-room','archived-room','missing',['main-room','vip-room']]){
    const h=sessionHarness({initialRoomId:room});assert.equal(h.lobby(),undefined,String(room));
  }
  const h=sessionHarness();h.choose('');assert.equal(h.lobby().props.href,'/lobby?operator=north-casino');
  h.choose('foreign-room');assert.equal(h.lobby(),undefined);
  assert.equal(sessionHarness({accessClass:'partner'}).lobby(),undefined);
  const picker=h.nodes().find(node=>node.type==='select'&&node.props.id==='partner-operator');picker.props.onChange({target:{value:'south'}});
  assert.equal(h.window.assigned,'/partner/south-casino/rooms');
});

test('staff lobby departure keeps the existing dirty guard and modified clicks leave the draft in place',()=>{
  const h=sessionHarness();h.settle();h.view().props.onAppearanceDirty(true);
  let prompts=0,prevented=0;h.window.confirm=()=>{prompts++;return false;};
  const click={button:0,preventDefault(){prevented++}};
  h.lobby().props.onClick(click);assert.equal(prompts,1);assert.equal(prevented,1);
  h.lobby().props.onClick({...click,ctrlKey:true});assert.equal(prompts,1);
  h.window.confirm=()=>true;h.lobby().props.onClick(click);assert.equal(prevented,1);
});


test('company defaults require one explicit scope and never hide an invalid room request',()=>{
  assert.deepEqual(initialPartnerRoomSelection(snapshot,undefined,'company'),{roomId:'',unavailable:false});
  for(const scope of ['', 'other', ['company','company']]) assert.deepEqual(initialPartnerRoomSelection(snapshot,undefined,scope),{roomId:'',unavailable:true});
  for(const room of ['', 'foreign-room', ['main-room','main-room'], 'main-room']) assert.deepEqual(initialPartnerRoomSelection(snapshot,room,'company'),{roomId:'',unavailable:true});
});


test('company scope and invalid requests survive menu URLs, reload and history without a silent fallback',()=>{
  const h=sessionHarness();h.settle();h.choose('');
  assert.equal(h.window.location.search,'?scope=company');h.go('integration');
  assert.equal(h.window.location.pathname,'/partner/north-casino/integration');assert.equal(h.window.location.search,'?scope=company');
  const reload=sessionHarness({initialRoomId:undefined,initialRoomScope:'company',path:'/partner/north-casino/integration?scope=company'});reload.settle();
  assert.deepEqual(reload.selection(),{roomId:'',unavailable:false});
  assert.equal(reload.lobby().props.href,'/lobby?operator=north-casino');
  h.choose('vip-room');h.history.go(-1);assert.equal(h.selection().roomId,'');assert.equal(h.lobby().props.href,'/lobby?operator=north-casino');
  h.history.go(1);assert.equal(h.selection().roomId,'vip-room');
  for(const query of ['room=','room=missing','room=foreign-room','room=main-room&room=vip-room','scope=company&scope=company','scope=company&room=']){
    const bad=sessionHarness({path:'/partner/north-casino/rooms?'+query});bad.settle();assert.equal(bad.lobby(),undefined,query);
    bad.go('integration');assert.equal(bad.selection().unavailable,true);assert.equal(bad.lobby(),undefined,query);
    bad.go('rooms');assert.equal(bad.selection().unavailable,true);
    bad.choose('vip-room');assert.equal(bad.selection().roomId,'vip-room');assert.equal(bad.window.location.search,'?room=vip-room');
  }
});

test('cancelled cross-company history restores the selected room and dirty editor',()=>{
  const h=sessionHarness();h.settle();h.choose('vip-room');h.view().props.onAppearanceDirty(true);
  h.history.pushState(h.history.state,'','/partner/south-casino/rooms?room=foreign-room');
  let prompts=0;h.window.confirm=()=>{prompts++;return false;};h.window.dispatchEvent(new Event('popstate'));
  assert.equal(prompts,1);assert.equal(h.window.location.pathname,'/partner/north-casino/rooms');
  assert.equal(h.window.location.search,'?room=vip-room');assert.equal(h.selection().roomId,'vip-room');assert.equal(h.window.reloaded,undefined);
});


// Render the real room wrapper and actual draft panel with persistent hook state.
// Only the already-fetched package and media-preview boundary are fixtures.
function AppearanceChoices(){return null;}
function actualAppearance(session) {
  const {transformSync}=require('next/dist/build/swc'),{defaultPresentationLane}=require('../../../packages/presentation/contracts/studio-model.mjs');
  const lane=defaultPresentationLane('astrid');lane.operatorAdjustable=['dealer'];lane.layers.dealer={enabled:true,default:'astrid',allowed:['astrid','elin']};
  const initial={operatorId:'north',packageRevision:7,lanes:[lane.id],branding:{},adjustable:['dealer'],canConfigure:true,
    dealerChoices:{[lane.id]:['astrid','elin']},roomDealerChoices:{'main-room':['astrid','elin'],'vip-room':['astrid','elin']},
    presentation:{schemaVersion:1,projectRevision:'r1',assets:[],lanes:[lane]},draft:null,draftRevision:0,history:[],
    rooms:['main-room','vip-room'].map(id=>({id,label:id,presentationLaneId:lane.id}))};
  const mount=(relative,name)=>{
    const file=new URL(relative,import.meta.url),slots=[];let cursor=0;
    const hooks={...React,useState(value){const i=cursor++;if(!(i in slots))slots[i]=typeof value==='function'?value():value;return [slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next];},
      useRef(value){return slots[cursor++]??={current:value};},
      useEffect(callback,deps){const i=cursor++,old=slots[i];if(!old||deps.some((value,j)=>value!==old.deps[j])){old?.cleanup?.();slots[i]={effect:true,deps,cleanup:callback()};}}};
    const code=transformSync(require('node:fs').readFileSync(file,'utf8'),{filename:file.pathname,jsc:{parser:{syntax:name==='PartnerAppearance'?'typescript':'ecmascript',tsx:name==='PartnerAppearance',jsx:name!=='PartnerAppearance'},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code;
    const local=createRequire(file),module={exports:{}};
    require('node:vm').runInNewContext(code,{module,exports:module.exports,fetch:()=>assert.fail('No server write belongs in a navigation test'),
      require:key=>key==='react'?hooks:key.endsWith('.css')?{__esModule:true,default:{}}:key==='./appearance-choices'?{AppearanceChoices}:key==='./partner-appearance-preview'?{PartnerAppearancePreview:()=>null}:key.endsWith('.jsx')||key.endsWith('.mjs')&&key.startsWith('./')?jsxRequire(file,{react:hooks})(key):local(key)});
    return {render(props){cursor=0;return module.exports[name](props);},unmount(){for(const slot of slots)if(slot?.effect)slot.cleanup?.();}};
  };
  const wrapper=mount('../components/partner/views/rooms.jsx','PartnerRoomWorkspace');let panel=null,mounts=0;
  const walk=tree=>!tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(walk)];
  const render=()=>{
    const props=session.view().props;
    const tree=wrapper.render({snapshot:props.runtime.snapshot,copy:props.copy,language:'sv',apiBase:props.apiBase,
      selection:props.roomSelection,onSelectionChange:props.onRoomSelectionChange,onDirtyChange:props.onAppearanceDirty});
    const loader=walk(tree).find(node=>node.type?.name==='PartnerAppearanceLoader');
    if(!loader){panel?.unmount();panel=null;return tree;}
    if(!panel){panel=mount('../components/partner-appearance.tsx','PartnerAppearance');mounts++;}
    return panel.render({...loader.props,initial});
  };
  const dealer=()=>walk(render()).find(node=>node.type===AppearanceChoices&&node.props.kind==='dealer');
  return {render,dealer,get mounts(){return mounts;}};
}

test('Back to an invalid room cannot unmount a real unsaved appearance draft after cancellation',()=>{
  const h=sessionHarness({initialRoomId:'missing',path:'/partner/north-casino/rooms?room=missing'});h.settle();
  const panel=actualAppearance(h);assert.equal(panel.dealer(),undefined);
  h.choose('main-room');panel.dealer().props.onChange('elin');assert.equal(panel.dealer().props.value,'elin');
  let prompts=0;h.window.confirm=()=>{prompts++;return false;};
  const length=h.history.length;h.history.go(-1);
  assert.equal(panel.dealer()?.props.value,'elin','cancelled history must retain the actual unsaved room override');
  assert.equal(h.window.location.search,'?room=main-room');assert.equal(h.history.length,length);assert.equal(panel.mounts,1);assert.equal(prompts,1);
  h.history.go(-1);assert.equal(panel.dealer().props.value,'elin');assert.equal(h.history.length,length);assert.equal(prompts,2);
  h.choose('missing');assert.equal(h.window.location.search,'?room=main-room');assert.equal(panel.dealer().props.value,'elin');assert.equal(prompts,3);
  h.window.confirm=()=>true;h.history.go(-1);assert.equal(h.window.location.search,'?room=missing');assert.equal(panel.dealer(),undefined);
  h.choose('main-room');assert.equal(panel.dealer().props.value,'');assert.equal(panel.mounts,2,'only an approved departure may discard the mounted draft');
});

test('valid room and company switches retain the real draft across Back without discard prompts',()=>{
  const h=sessionHarness();h.settle();const panel=actualAppearance(h);
  panel.dealer().props.onChange('elin');assert.equal(panel.dealer().props.value,'elin');
  h.window.confirm=()=>assert.fail('All room overrides stay in the same mounted draft');
  h.choose('vip-room');assert.equal(panel.dealer().props.value,'');h.history.go(-1);assert.equal(panel.dealer().props.value,'elin');
  h.choose('');assert.equal(panel.dealer().props.value,'');h.history.go(-1);assert.equal(panel.dealer().props.value,'elin');assert.equal(panel.mounts,1);
});
