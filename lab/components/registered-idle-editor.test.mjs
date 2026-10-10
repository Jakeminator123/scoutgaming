import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {createSeedProject,addDealer} from '../lib/studio-model.mjs';
import * as registered from '../../presentation-runtime/registered-idle-policy.mjs';
import * as ownIdle from '../../presentation-runtime/registered-idle.mjs';
import * as idlePolicy from '../lib/idle-policy.mjs';
import * as clipLabels from '../lib/clip-label.mjs';

const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const clone=value=>JSON.parse(JSON.stringify(value));
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function nodes(node,predicate){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(row=>nodes(row,predicate));return [...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];}
function text(node){if(node==null)return '';if(Array.isArray(node))return node.map(text).join('');return typeof node==='object'?text(node.props?.children):String(node);}
function button(tree,label){const node=nodes(tree,row=>row.type==='button'&&text(row)===label)[0];assert.ok(node,label);return node;}
function harness(file,read){
  const values=[],refs=[],effects=[];let stateIndex=0,refIndex=0,effectIndex=0;
  const fakeReact={...React,useMemo:fn=>fn(),useRef:initial=>refs[refIndex++]??={current:initial},
    useState(initial){const index=stateIndex++;if(!(index in values))values[index]=typeof initial==='function'?initial():initial;return [values[index],value=>values[index]=typeof value==='function'?value(values[index]):value];},
    useEffect(run,deps){const index=effectIndex++,old=effects[index];effects[index]={...old,run,deps,changed:!old||!deps||deps.some((value,key)=>old.deps?.[key]!==value)};}};
  const SharedEditor=()=>null;
  const mocks={'../../presentation-runtime/registered-idle-policy.mjs':registered,'../../presentation-runtime/registered-idle.mjs':ownIdle,
    '../lib/idle-video-duration.mjs':{readIdleVideoDuration:read},'../lib/idle-policy.mjs':idlePolicy,'../lib/clip-label.mjs':clipLabels,'./idle-policy-editor':{IdlePolicyEditor:SharedEditor}};
  const output=transformSync(readFileSync(new URL(file,import.meta.url),'utf8'),{filename:file,jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const module={exports:{}};
  vm.runInNewContext(output.code,{module,exports:module.exports,AbortController,structuredClone,setTimeout,clearTimeout,
    require:name=>name==='react'?fakeReact:name.endsWith('.module.css')?{__esModule:true,default:{}}:mocks[name]??require(name)});
  return {SharedEditor,render(props){stateIndex=refIndex=effectIndex=0;return Object.values(module.exports)[0](props);},
    flush(){const pending=effects.filter(row=>row.changed);for(const row of pending)row.cleanup?.();for(const row of pending){row.changed=false;row.cleanup=row.run();}},
    unmount(){for(const row of effects)row.cleanup?.();}};
}
function fixture(){
  const project=addDealer(createSeedProject(),'johanna','Johanna');
  project.lines.find(row=>row.dealerId==='johanna'&&row.eventId==='idle.ready').variants[0].videoGenerationId=ids[0];
  const inventory={videos:ids.map((id,index)=>({id,dealer:'johanna',available:true,sha256:'a'.repeat(64),fileName:id+'.mp4',previewUrl:'/own/'+id+'.mp4',
    classification:{dealerId:'johanna',eventId:'idle.ready',kind:'idle',role:index?'alternative':'standard',playback:'once',situation:'',label:'Idle',notes:''}}))};
  const changes=[],busy=[];
  return {project,inventory,dealerId:'johanna',blocked:false,onChange:policy=>changes.push(policy),onBusyChange:value=>busy.push(value),changes,busy};
}

test('own idle starts unconfigured and uses probed baseline only after explicit action',async()=>{
  const p=fixture(),probe=deferred(),requests=[],h=harness('./registered-idle-editor.tsx',(url,options)=>{requests.push({url,...options});return probe.promise;});
  let tree=h.render(p);h.flush();
  assert.equal(p.changes.length,0);assert.equal(requests.length,0);assert.equal(nodes(tree,row=>row.type===h.SharedEditor).length,0);
  button(tree,'Anpassa grundloop').props.onClick();tree=h.render(p);h.flush();
  assert.equal(button(tree,'Läser klipplängd…').props.disabled,true);assert.deepEqual(p.busy,[true]);assert.equal(p.changes.length,0);
  probe.resolve(4321);await tick();
  assert.equal(requests[0].url,p.inventory.videos[0].previewUrl);
  assert.deepEqual(clone(p.changes),[{schemaVersion:1,familyId:'johanna/idle.ready/ready',base:[{videoId:ids[0],weight:100,durationMs:4321}],variants:[]}]);
  assert.deepEqual(p.busy,[true,false]);
});
test('missing or another dealer baseline cannot create a borrowed own policy',()=>{
  for(const change of [p=>p.inventory.videos=[],p=>p.inventory.videos[0].dealer='astrid']){
    const p=fixture();change(p);const h=harness('./registered-idle-editor.tsx',()=>{throw Error('unexpected metadata');});
    const tree=h.render(p);h.flush();assert.equal(button(tree,'Anpassa grundloop').props.disabled,true);assert.match(text(tree),/Välj en tillgänglig egen video/);
    button(tree,'Anpassa grundloop').props.onClick();assert.equal(p.changes.length,0);
  }
});
test('baseline mismatch requires explicit replacement and retains saved variation controls',async()=>{
  const p=fixture(),previous=registered.createRegisteredIdlePolicy({dealerId:'johanna',baselineVideoId:ids[1],durationMs:2000});
  previous.variants=[{videoId:ids[2],durationMs:3000,use:'openclaw',automatic:null,description:'nickar'}];
  p.project.dealerIdlePolicies=[{dealerId:'johanna',policy:previous}];
  const h=harness('./registered-idle-editor.tsx',async()=>4123);let tree=h.render(p);h.flush();
  assert.equal(nodes(tree,row=>row.type===h.SharedEditor)[0].props.blocked,true);assert.equal(p.changes.length,0);
  button(tree,'Använd valt basklipp').props.onClick();await tick();
  assert.deepEqual(clone(p.changes[0].base),[{videoId:ids[0],weight:100,durationMs:4123}]);assert.deepEqual(clone(p.changes[0].variants),previous.variants);
  assert.equal(p.project.dealerIdlePolicies[0].policy,previous);
});
test('unmount, changed baseline or newer policy discards pending metadata',async()=>{
  for(const scenario of ['unmount','baseline','policy']){
    const p=fixture(),probe=deferred();let signal;
    const h=harness('./registered-idle-editor.tsx',(_url,options)=>{signal=options.signal;return probe.promise;});
    let tree=h.render(p);h.flush();button(tree,'Anpassa grundloop').props.onClick();
    if(scenario==='unmount')h.unmount();
    else {
      if(scenario==='baseline')p.project.lines.find(row=>row.dealerId==='johanna'&&row.eventId==='idle.ready').variants[0].videoGenerationId=ids[1];
      else p.project.dealerIdlePolicies=[{dealerId:'johanna',policy:registered.createRegisteredIdlePolicy({dealerId:'johanna',baselineVideoId:ids[0],durationMs:3333})}];
      h.render(p);h.flush();
    }
    probe.resolve(2345);await tick();assert.equal(p.changes.length,0,scenario);assert.equal(p.busy.at(-1),false);
    if(scenario!=='policy')assert.equal(signal.aborted,true);
  }
});
test('shared own editor imports explicit manual variants and requested base weight with measured durations',async()=>{
  const p=fixture();let policy=registered.createRegisteredIdlePolicy({dealerId:'johanna',baselineVideoId:ids[0],durationMs:1000});
  const changes=[],busy=[],h=harness('./idle-policy-editor.tsx',async()=>3210);
  const props=()=>({policy,inventory:registered.registeredIdleInventory(p.inventory,{dealerId:p.dealerId,policy}),blocked:false,editableBase:true,onChange:value=>changes.push(value),onBusyChange(){},onImportBusyChange:value=>busy.push(value)});
  let tree=h.render(props());h.flush();
  const baseSelect=nodes(tree,row=>row.type==='label'&&text(row).startsWith('Nytt basklipp'))[0];
  nodes(baseSelect,row=>row.type==='select')[0].props.onChange({target:{value:ids[1]}});
  const weight=nodes(tree,row=>row.type==='input'&&row.props.type==='number'&&row.props.value==='')[0];
  assert.ok(weight);weight.props.onChange({target:{value:'30'}});
  tree=h.render(props());h.flush();button(tree,'Lägg till basklipp').props.onClick();tree=h.render(props());h.flush();
  assert.equal(tree.props.disabled,true);await tick();
  policy=changes.pop();assert.deepEqual(clone(policy.base),[{videoId:ids[0],weight:70,durationMs:1000},{videoId:ids[1],weight:30,durationMs:3210}]);assert.deepEqual(busy,[true,false]);
  tree=h.render(props());h.flush();
  nodes(nodes(tree,row=>row.type==='label'&&text(row).startsWith('Nytt basklipp'))[0],row=>row.type==='select')[0].props.onChange({target:{value:ids[2]}});
  nodes(tree,row=>row.type==='input'&&row.props.type==='number'&&row.props.value==='')[0].props.onChange({target:{value:'20'}});
  tree=h.render(props());h.flush();
  const add=nodes(tree,row=>row.type==='button'&&text(row).startsWith('Lägg till ')&&text(row).endsWith(' · manuellt'))[0];
  add.props.onClick();await tick();policy=changes.pop();
  assert.deepEqual(clone(policy.variants),[{videoId:ids[2],durationMs:3210,use:'manual',automatic:null,description:''}]);
  tree=h.render(props());h.flush();
  assert.equal(nodes(tree,row=>row.type==='button'&&text(row)==='Lägg till basklipp').length,0,'the previously selected clip cannot also become a duplicate base after importing as a variation');
  button(tree,'Ta bort variation').props.onClick();policy=changes.pop();assert.equal(policy.variants.length,0);
  tree=h.render(props());h.flush();nodes(tree,row=>row.type==='button'&&text(row).startsWith('Ta bort basklipp'))[1].props.onClick();
  assert.deepEqual(clone(changes.pop().base),[{videoId:ids[0],weight:100,durationMs:1000}]);
  assert.equal(p.inventory.videos.length,3,'removal only detaches policy, never deletes media');
});
test('shared editor aborts pending import when unmounted or blocked and rejects stale policy results',async()=>{
  for(const scenario of ['unmount','blocked','policy']){
    const p=fixture(),probe=deferred();let signal;
    const h=harness('./idle-policy-editor.tsx',(_url,options)=>{signal=options.signal;return probe.promise;});
    const changes=[],busy=[],policy=registered.createRegisteredIdlePolicy({dealerId:'johanna',baselineVideoId:ids[0],durationMs:1000});
    let props={policy,inventory:registered.registeredIdleInventory(p.inventory,{dealerId:p.dealerId,policy}),blocked:false,editableBase:true,onChange:value=>changes.push(value),onBusyChange(){},onImportBusyChange:value=>busy.push(value)};
    const tree=h.render(props);h.flush();nodes(tree,row=>row.type==='button'&&text(row).endsWith(' · manuellt'))[0].props.onClick();
    if(scenario==='unmount')h.unmount();
    else{props={...props,...scenario==='blocked'?{blocked:true}:{policy:{...policy}}};h.render(props);h.flush();}
    probe.resolve(3333);await tick();assert.equal(changes.length,0,scenario);assert.equal(busy.at(-1),false);
    if(scenario!=='policy')assert.equal(signal.aborted,true);
  }
});

test('rules can be selected only for an own dealer and require explicit event binding plus game mode',()=>{
  const p=fixture(),base=registered.createRegisteredIdlePolicy({dealerId:'johanna',baselineVideoId:ids[0],durationMs:1000});
  const initial={...base,variants:[{videoId:ids[1],durationMs:2000,use:'manual',automatic:null}]};
  const changes=[],h=harness('./idle-policy-editor.tsx',()=>{throw Error('rules must not read media or invent timing');});
  const props={policy:initial,inventory:registered.registeredIdleInventory(p.inventory,{dealerId:p.dealerId,policy:initial}),blocked:false,editableBase:true,onChange:value=>changes.push(value),onBusyChange(){}};
  let tree=h.render(props);h.flush();
  let selector=nodes(tree,row=>row.type==='select'&&row.props.value==='manual')[0];
  const rules=nodes(selector,row=>row.type==='option'&&row.props.value==='rules')[0];
  assert.equal(rules.props.disabled,false);selector.props.onChange({target:{value:'rules'}});
  const next=changes.pop();assert.equal(next.variants[0].use,'rules');assert.equal(next.variants[0].automatic,null);
  tree=h.render({...props,policy:next});h.flush();
  for(const label of ['Händelser → Grundloop','samma klipp','koppla ett villkor','utdelning eller vändning','chattvillkor används inte','Regler i spelets Klippval','Utan ett matchande sparat villkor'])assert.ok(text(tree).includes(label),label);
  tree=h.render({...props,editableBase:false});h.flush();
  selector=nodes(tree,row=>row.type==='select'&&row.props.value==='manual')[0];
  assert.equal(nodes(selector,row=>row.type==='option'&&row.props.value==='rules').length,0);
  tree=h.render({...props,policy:next,editableBase:false});h.flush();
  selector=nodes(tree,row=>row.type==='select'&&row.props.value==='rules')[0];
  assert.equal(nodes(selector,row=>row.type==='option'&&row.props.value==='rules')[0].props.disabled,true);
  assert.match(text(tree),/Regler är inte anslutna här/);
});
