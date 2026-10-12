import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {createSeedProject,addDealer} from '../lib/studio-model.mjs';
import * as registered from '../../packages/presentation/runtime/registered-idle-policy.mjs';
import * as ownIdle from '../../packages/presentation/runtime/registered-idle.mjs';
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
  const mocks={'./dealer-video-surface':{DealerVideoSurface:({children})=>children},'./dealer-file-settings':{DealerFileSettings:()=>null},'../../packages/presentation/runtime/registered-idle-policy.mjs':registered,'../../packages/presentation/runtime/registered-idle.mjs':ownIdle,
    '../lib/idle-video-duration.mjs':{readIdleVideoDuration:read},'../lib/idle-policy.mjs':idlePolicy,'../lib/clip-label.mjs':clipLabels,'./idle-policy-editor':{IdlePolicyEditor:SharedEditor},'./presentation-frame':{PresentationFrame:({children})=>children}};
  const output=transformSync(readFileSync(new URL(file,import.meta.url),'utf8'),{filename:file,jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const module={exports:{}};
  vm.runInNewContext(output.code,{module,exports:module.exports,AbortController,structuredClone,setTimeout,clearTimeout,
    require:name=>name==='react'?fakeReact:name.endsWith('.module.css')?{__esModule:true,default:{}}:mocks[name]??require(name)});
  return {SharedEditor,render(props){stateIndex=refIndex=effectIndex=0;return Object.values(module.exports)[0](props);},
    flush(){const pending=effects.filter(row=>row.changed);for(const row of pending)row.cleanup?.();for(const row of pending){row.changed=false;row.cleanup=row.run();}},
    unmount(){for(const row of effects)row.cleanup?.();}};
}
function fixture(dealerId='johanna'){
  const project=addDealer(createSeedProject(),dealerId,dealerId==='paow'?'PAOW':'Johanna');
  project.lines.find(row=>row.dealerId===dealerId&&row.eventId==='idle.ready').variants[0].videoGenerationId=ids[0];
  const inventory={videos:ids.map((id,index)=>({id,dealer:dealerId,available:true,sha256:'a'.repeat(64),fileName:id+'.mp4',previewUrl:'/own/'+id+'.mp4',
    classification:{dealerId,eventId:'idle.ready',kind:'idle',role:index?'alternative':'standard',playback:'once',situation:'',label:'Idle',notes:''}}))};
  const changes=[],busy=[];
  return {project,inventory,dealerId,blocked:false,onChange:policy=>changes.push(policy),onBusyChange:value=>busy.push(value),changes,busy};
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


function replacementFixture(){
  const p=fixture('paow'),extra=['44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666'];
  p.inventory.videos[0].label='dealer_mobile';p.inventory.videos[0].fileName='dealer_mobile.mp4';p.inventory.videos[1].label='dealer_desktop';p.inventory.videos[1].fileName='dealer_desktop.mp4';
  p.inventory.videos.push(...extra.map(id=>({...clone(p.inventory.videos[0]),id,label:'Extra '+id[0],fileName:id+'.mp4',previewUrl:'/own/'+id+'.mp4'})));
  const policy={schemaVersion:1,familyId:'paow/idle.ready/ready',base:[ids[0],...extra].map((videoId,index)=>({videoId,weight:[41,29,19,11][index],durationMs:[1100,2200,3300,4400][index]})),variants:[{videoId:ids[1],durationMs:5555,use:'automatic',automatic:{averageEveryMs:25000,jitterMs:3000,cooldownMs:12000,maxPerMinute:2},description:'Desktop idle'},{videoId:ids[2],durationMs:6666,use:'rules',automatic:null,description:'Behåll villkoret'}]};
  p.project.dealerIdlePolicies=[{dealerId:p.dealerId,policy}];
  p.project.dealers.find(row=>row.id===p.dealerId).speechProfile={reference:{videoId:ids[0],frameTimeMs:0}};
  const changes=[],busy=[];
  return {p,policy,changes,busy,props:{policy,inventory:registered.registeredIdleInventory(p.inventory,{dealerId:p.dealerId,policy}),blocked:false,editableBase:true,onChange:value=>changes.push(value),onBusyChange(){},onImportBusyChange:value=>busy.push(value)}};
}
function replacementSelect(tree){const select=nodes(tree,row=>row.type==='select'&&row.props['aria-label']==='Välj nytt basklipp')[0];assert.ok(select,'visible replacement selector');return select;}
function chooseReplacement(h,props,id=ids[1]){let tree=h.render(props);h.flush();replacementSelect(tree).props.onChange({target:{value:id}});tree=h.render(props);h.flush();return tree;}

test('PAOW can visibly promote its desktop variation to the primary without changing other base weights or settings',async()=>{
  const f=replacementFixture(),before=clone(f.p),probe=deferred(),requests=[],h=harness('./idle-policy-editor.tsx',(url,options)=>{requests.push({url,...options});return probe.promise;});
  let tree=chooseReplacement(h,f.props);const group=nodes(tree,row=>row.props?.['aria-label']==='Byt basklipp')[0];assert.ok(group);assert.equal(nodes(tree,row=>row.type==='details'&&nodes(row,child=>child===group).length).length,0,'replacement is outside disclosures');
  assert.match(text(replacementSelect(tree)),/dealer_desktop · används som variation/);const current=nodes(tree,row=>row.type==='select'&&row.props.value===ids[0])[0];assert.match(text(current),/dealer_mobile/);
  const replace=button(tree,'Använd som basklipp');assert.equal(replace.props.disabled,false);replace.props.onClick();replace.props.onClick();tree=h.render(f.props);h.flush();assert.equal(requests.length,1);assert.equal(f.changes.length,0);assert.equal(button(tree,'Läser klipplängd…').props.disabled,true);
  probe.resolve(7890);await tick();assert.equal(f.changes.length,1);const next=f.changes[0];idlePolicy.validateIdlePolicy(next);
  assert.deepEqual(clone(next.base),[{videoId:ids[1],weight:41,durationMs:7890},...f.policy.base.slice(1)]);assert.deepEqual(clone(next.variants),[f.policy.variants[1]]);assert.equal(next.variants[0],f.policy.variants[1]);for(let i=1;i<4;i++)assert.equal(next.base[i],f.policy.base[i]);
  assert.equal(requests[0].url,f.p.inventory.videos[1].previewUrl);assert.deepEqual(f.busy,[true,false]);assert.deepEqual(clone(f.p),before,'old upload, project and AI reference remain unchanged until the parent saves the policy');assert.equal(next.base.length,4);
});

test('replacement also accepts an unused uploaded idle clip and keeps a sole primary at 100 percent',async()=>{
  const p=fixture('paow'),policy=registered.createRegisteredIdlePolicy({dealerId:p.dealerId,baselineVideoId:ids[0],durationMs:1000}),changes=[];
  const props={policy,inventory:registered.registeredIdleInventory(p.inventory,{dealerId:p.dealerId,policy}),blocked:false,editableBase:true,onChange:value=>changes.push(value),onBusyChange(){}};
  const h=harness('./idle-policy-editor.tsx',async()=>2345),tree=chooseReplacement(h,props);button(tree,'Använd som basklipp').props.onClick();await tick();assert.deepEqual(clone(changes[0].base),[{videoId:ids[1],weight:100,durationMs:2345}]);assert.deepEqual(clone(changes[0].variants),[]);assert.equal(p.inventory.videos.length,3);
});

test('replacement never commits after unmount, a block, newer policy, dealer change or changed media',async()=>{
  for(const scenario of ['unmount','blocked','blocked-before-effect','policy','dealer','unavailable','hash','url','not-editable']){
    const f=replacementFixture(),probe=deferred();let signal;const h=harness('./idle-policy-editor.tsx',(_url,options)=>{signal=options.signal;return probe.promise;});let props=f.props,tree=chooseReplacement(h,props);button(tree,'Använd som basklipp').props.onClick();
    if(scenario==='unmount')h.unmount();else{
      if(scenario.startsWith('blocked'))props={...props,blocked:true};
      if(scenario==='policy')props={...props,policy:{...f.policy}};
      if(scenario==='dealer')props={...props,policy:{...f.policy,familyId:'johanna/idle.ready/ready'}};
      if(scenario==='not-editable')props={...props,editableBase:false};
      if(['unavailable','hash','url'].includes(scenario)){const inventory=clone(props.inventory),video=inventory.videos.find(row=>row.id===ids[1]);if(scenario==='unavailable')video.available=false;if(scenario==='hash')video.sha256='b'.repeat(64);if(scenario==='url')video.previewUrl='/replacement.mp4';props={...props,inventory};}
      tree=h.render(props);if(scenario!=='blocked-before-effect')h.flush();
    }
    probe.resolve(3456);await tick();assert.equal(f.changes.length,0,scenario);assert.equal(f.busy.at(-1),false,scenario);if(['unmount','blocked'].includes(scenario))assert.equal(signal.aborted,true,scenario);
    if(['unavailable','hash','url'].includes(scenario)){tree=h.render(props);const group=nodes(tree,row=>row.props?.['aria-label']==='Byt basklipp')[0];assert.match(text(group),/Klippet har ändrats eller är inte längre tillgängligt/);}
  }
});

test('failed or invalid duration leaves the original primary and variation intact with an error beside replacement',async()=>{
  for(const duration of ['failed',199,60001,NaN]){
    const f=replacementFixture(),before=clone(f.policy),h=harness('./idle-policy-editor.tsx',async()=>{if(duration==='failed')throw Error('metadata unavailable');return duration;});let tree=chooseReplacement(h,f.props);button(tree,'Använd som basklipp').props.onClick();await tick();tree=h.render(f.props);
    assert.equal(f.changes.length,0,String(duration));assert.deepEqual(f.policy,before);const group=nodes(tree,row=>row.props?.['aria-label']==='Byt basklipp')[0];assert.equal(nodes(group,row=>row.props?.role==='alert').length,1);assert.equal(button(tree,'Använd som basklipp').props.disabled,false);assert.deepEqual(f.busy,[true,false]);
  }
});

test('replacement excludes existing base, missing, foreign-family and unavailable clips and respects an initial block',()=>{
  for(const scenario of ['existing','missing','foreign','unavailable','blocked']){
    const f=replacementFixture();let props=f.props,id=ids[1],calls=0;
    if(scenario==='existing')id=ids[0];if(scenario==='missing')id='77777777-7777-4777-8777-777777777777';
    if(scenario==='foreign')props.inventory.videos.find(row=>row.id===ids[1]).familyId='johanna/idle.ready/ready';
    if(scenario==='unavailable')props.inventory.videos.find(row=>row.id===ids[1]).available=false;if(scenario==='blocked')props={...props,blocked:true};
    const h=harness('./idle-policy-editor.tsx',()=>{calls++;return Promise.resolve(1000);}),tree=chooseReplacement(h,props,id);button(tree,'Använd som basklipp').props.onClick();assert.equal(calls,0,scenario);assert.equal(f.changes.length,0,scenario);assert.equal(button(tree,'Använd som basklipp').props.disabled,true,scenario);
  }
});

test('own upload labels and filename fallback are visible while the original bank keeps established names',()=>{
  const f=replacementFixture(),h=harness('./idle-policy-editor.tsx',()=>{throw Error('no read');});let tree=h.render(f.props);h.flush();assert.match(text(replacementSelect(tree)),/dealer_desktop/);assert.match(text(nodes(tree,row=>row.type==='select'&&row.props.value===ids[0])[0]),/dealer_mobile/);
  const inventory=clone(f.props.inventory),candidate=inventory.videos.find(row=>row.id===ids[1]);delete candidate.label;delete candidate.classification.label;tree=h.render({...f.props,inventory});h.flush();assert.match(text(replacementSelect(tree)),/dealer_desktop/);
  tree=h.render({...f.props,editableBase:false});h.flush();assert.equal(nodes(tree,row=>row.props?.['aria-label']==='Byt basklipp').length,0);assert.match(text(nodes(tree,row=>row.type==='select'&&row.props.value===ids[0])[0]),/Lugn blick/);assert.doesNotMatch(text(nodes(tree,row=>row.type==='select'&&row.props.value===ids[0])[0]),/dealer_mobile/);
});
