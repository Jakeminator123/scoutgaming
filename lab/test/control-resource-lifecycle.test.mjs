import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { fixtureLaneOperators } from '../lib/operator-package-api.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl, overrides = {}) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams, AbortController, fetch: overrides.fetch ?? globalThis.fetch,
    window: overrides.window ?? new Proxy({}, { get: (_target, key) => globalThis.window?.[key] }),
    require: name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      // Cross-package fixtures use the same React runtime as this Lab renderer.
      if (name === 'react/jsx-runtime' || name === 'react/jsx-dev-runtime') return require(name);
      if (name.endsWith('.module.css') || name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('./') || name.startsWith('../')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const candidate = new URL(name + suffix, fileUrl);
          const path = fileURLToPath(candidate);
          if (!existsSync(path)) continue;
          if (path.endsWith('.mjs') || path.endsWith('.js') || path.endsWith('.json')) return localRequire(path);
          return loadTs(pathToFileURL(path), overrides);
        }
      }
      return localRequire(name);
    },
  }, { filename: fileURLToPath(fileUrl) });
  return module.exports;
}



const source=new URL('../components/control-resource-lifecycle.tsx',import.meta.url);
const company=(id='north',extra={})=>({id,slug:id,name:id==='north'?'North':'South',status:'active',packageRevision:4,lanes:['standard'],archivedAt:null,roomCount:1,archivedRoomCount:0,...extra});
const room=(extra={})=>({id:'room-one',name:'Nordiska rummet',operatorId:'north',presentationLaneId:'standard',state:'live',archivedAt:null,packageRevision:4,published:true,canArchive:true,canRestore:false,restoreBlockers:[],...extra});
const snapshot=(extra={})=>({administrationRevision:'admin-1',operators:[company(),company('south')],rooms:[room()],...extra});
function harness(props={}) {
  const slots=[],effects=[],requests=[],changed=[],busy=[],uncertain=[];let cursor=0,queued=[];
  const input={operatorId:'north',kind:'rooms',available:true,onChanged:value=>changed.push(value),onBusyChange:value=>busy.push(value),onRefreshNeeded:()=>uncertain.push(true),...props};
  const react={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;
    return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef(value){return slots[cursor++]??={current:value};},
    useEffect(fn,deps){const i=cursor++,old=effects[i];if(!old||deps.some((value,index)=>value!==old.deps[index]))queued.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()};});}};
  const {ControlResourceLifecycle}=loadTs(source,{react,fetch:(path,options)=>new Promise(resolve=>requests.push({path,options,resolve}))});
  const render=()=>{cursor=0;queued=[];const tree=ControlResourceLifecycle(input);for(const fn of queued)fn();return tree;};
  const all=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(child=>all(child,predicate))];
  const nodes=predicate=>all(render(),predicate);
  const button=label=>nodes(node=>node.type==='button'&&node.props.children===label)[0];
  return {input,requests,changed,busy,uncertain,render,nodes,button,html:()=>renderToStaticMarkup(render()),
    async reply(index,value,status=200){requests[index].resolve(Response.json(value,{status}));await new Promise(resolve=>setImmediate(resolve));},
    async ready(value=snapshot()){render();await this.reply(0,value);render();},
    unmount(){for(const effect of effects)effect?.cleanup?.();}};
}

test('snapshot validation rejects untrusted revision and missing selection while accepting the complete archive',()=>{
  const {validLifecycleSnapshot}=loadTs(source);assert.equal(validLifecycleSnapshot(snapshot()),true);
  assert.equal(validLifecycleSnapshot(snapshot({operators:[company('north',{packageRevision:'4'})]})),false);
  assert.equal(validLifecycleSnapshot(snapshot({operators:[company('north',{lanes:undefined})]})),false);
});

test('all companies load even without a selection and switching companies does not refetch the same snapshot',async()=>{
  const h=harness({operatorId:''});h.render();assert.equal(h.requests.length,1);
  await h.reply(0,snapshot({operators:[company('north',{status:'suspended',archivedAt:'2026-10-12T00:00:00Z'})]}));
  assert.equal(h.changed.length,1);h.input.operatorId='north';h.render();h.render();assert.equal(h.requests.length,1);
  assert.equal(h.requests[0].options.cache,'no-store');assert.equal(h.requests[0].options.credentials,'same-origin');
});

test('shared lifecycle navigation defaults remain compatible while Admin can keep composition edits in Studio',async()=>{
  const legacy=harness();await legacy.ready();
  assert.match(legacy.html(),/\/control\/compositions\?operator=north&amp;composition=standard/);
  const admin=harness({navigation:{compositionHref:(operator,room)=>'/admin/clips?'+new URLSearchParams({operator:operator.id,table:room.id,composition:room.presentationLaneId}),rehearsalLabel:'Provspela & följ (äldre vy)'}});
  await admin.ready();const links=admin.nodes(node=>node.type==='a');
  assert.equal(links.find(node=>node.props.children==='Redigera sammansättning').props.href,'/admin/clips?operator=north&table=room-one&composition=standard');
  assert.match(links.find(node=>node.props.children==='Provspela & följ (äldre vy)').props.href,/\/control\/rehearsal\?operator=north&table=room-one&composition=standard$/);
  assert.equal(admin.requests.length,1,'navigation does not mutate or reload the shared register');
});

test('Admin lifecycle wrapper adds game only from the same registered room and composition',()=>{
  const wrapper=new URL('../../packages/design-preview/admin/components/studio/registered-resource-lifecycle.tsx',import.meta.url);
  const Lifecycle=props=>props.kind==='rooms'?React.createElement('a',{href:props.navigation.compositionHref(company(),room())},props.navigation.rehearsalLabel):null;
  const {RegisteredResourceLifecycle}=loadTs(wrapper,{react:React,'../../../../../lab/components/control-resource-lifecycle':{ControlResourceLifecycle:Lifecycle}});
  const html=rooms=>renderToStaticMarkup(React.createElement(RegisteredResourceLifecycle,{operatorId:'north',disabled:false,onChanged(){},rooms}));
  assert.match(html([{id:'room-one',operatorId:'north',compositionId:'standard',game:'roulette'}]),/href="\/admin\/clips\?operator=north&amp;table=room-one&amp;composition=standard&amp;game=roulette"/);
  for(const context of [{id:'other',operatorId:'north',compositionId:'standard',game:'roulette'},{id:'room-one',operatorId:'south',compositionId:'standard',game:'roulette'},{id:'room-one',operatorId:'north',compositionId:'different',game:'roulette'}]){
    assert.doesNotMatch(html([context]),/game=/);
  }
});

test('archiving confirms a concrete room and sends exactly its tenant and observed revisions',async()=>{
  const h=harness();await h.ready();h.button('Flytta till papperskorgen').props.onClick();
  assert.equal(h.requests.length,1);assert.match(h.html(),/Flytta till papperskorgen: Nordiska rummet/);
  const confirm=h.button('Bekräfta');confirm.props.onClick();confirm.props.onClick();assert.equal(h.requests.length,2);
  assert.deepEqual(JSON.parse(h.requests[1].options.body),{operatorId:'north',roomId:'room-one',expectedAdministrationRevision:'admin-1',expectedPackageRevision:4,archived:true});
  assert.equal(h.busy.at(-1),true);
  await h.reply(1,{ok:true,room:room({state:'archived',archivedAt:'2026-10-12T00:00:00Z'}),administrationRevision:'admin-2',packageRevision:5});
  assert.equal(h.requests.length,3);
  await h.reply(2,snapshot({administrationRevision:'admin-2',operators:[company('north',{packageRevision:5})],rooms:[room({state:'archived',archivedAt:'2026-10-12T00:00:00Z',packageRevision:5,canArchive:false,canRestore:true})]}));
  h.render();assert.equal(h.changed.length,2);assert.equal(h.changed.at(-1).operators[0].packageRevision,5);assert.equal(h.busy.at(-1),false);
  assert.equal(h.requests.length,3,'successful readback must not trigger a fetch loop');
});

test('a selected confirmation cannot operate on another company after a context switch',async()=>{
  const h=harness({kind:'operator'});await h.ready();h.button('Flytta bolag till papperskorgen').props.onClick();
  h.input.operatorId='south';h.render();assert.equal(h.button('Bekräfta'),undefined);assert.equal(h.requests.length,1);
});

test('old suspended companies are distinct from archived companies that can be restored',async()=>{
  const h=harness({kind:'operator'});await h.ready(snapshot({operators:[company('north',{status:'suspended'})]}));
  assert.match(h.html(),/avstängt sedan tidigare/);assert.equal(h.button('Återställ bolag'),undefined);
  h.input.refreshKey=1;h.render();await h.reply(1,snapshot({operators:[company('north',{status:'suspended',archivedAt:'2026-10-12T00:00:00Z'})]}));
  assert.ok(h.button('Återställ bolag'));h.button('Återställ bolag').props.onClick();assert.match(h.html(),/Spelrummen stannar i papperskorgen/);
});

test('foreign receipts block retries until a fresh read and never update another tenant',async()=>{
  const h=harness();await h.ready();h.button('Flytta till papperskorgen').props.onClick();h.button('Bekräfta').props.onClick();
  await h.reply(1,{ok:true,room:room({operatorId:'south'}),administrationRevision:'admin-2',packageRevision:5});
  assert.equal(h.requests.length,2);assert.equal(h.changed.length,1);assert.equal(h.uncertain.length,1);
  assert.equal(h.button('Flytta till papperskorgen').props.disabled,true);assert.equal(h.button('Bekräfta'),undefined);
  h.button('Uppdatera').props.onClick();h.render();await h.reply(2,snapshot());assert.equal(h.button('Flytta till papperskorgen').props.disabled,false);
});

test('failed readback after a saved mutation blocks another write and retains a visible recovery action',async()=>{
  const h=harness();await h.ready();h.button('Pausa rum').props.onClick();h.button('Bekräfta').props.onClick();
  await h.reply(1,{ok:true,room:room({state:'pending'}),administrationRevision:'admin-2',packageRevision:4});
  await h.reply(2,{},503);assert.equal(h.uncertain.length,1);assert.match(h.html(),/Uppdatera vyn/);
  assert.equal(h.button('Pausa rum').props.disabled,true);assert.equal(h.button('Uppdatera').props.disabled,false);
});

test('an external write lock and missing package both disable mutations, and unmounted reads are ignored',async()=>{
  const h=harness({disabled:true});await h.ready(snapshot({operators:[company('north',{packageRevision:null,lanes:[]})],rooms:[room({packageRevision:null,published:false,canArchive:false})]}));
  assert.equal(h.button('Flytta till papperskorgen').props.disabled,true);assert.equal(h.button('Pausa rum').props.disabled,true);
  h.button('Flytta till papperskorgen').props.onClick();h.button('Bekräfta').props.onClick();assert.equal(h.requests.length,1);
  const late=harness();late.render();late.unmount();await late.reply(0,snapshot());assert.equal(late.changed.length,0);
});


const pausedReceipt=()=>({ok:true,room:room({state:'pending'}),administrationRevision:'admin-2',packageRevision:4});
const pausedSnapshot=()=>snapshot({administrationRevision:'admin-2',rooms:[room({state:'pending'})]});

test('room-state readback must confirm the administration revision, exact target and resulting state',async()=>{
  const changes=[
    ['older administration',value=>({...value,administrationRevision:'admin-1'})],
    ['different administration',value=>({...value,administrationRevision:'admin-3'})],
    ['wrong state',value=>({...value,rooms:[room()]})],
    ['missing room',value=>({...value,rooms:[]})],
    ['foreign room',value=>({...value,rooms:[room({state:'pending',operatorId:'south'})]})],
    ['different composition',value=>({...value,rooms:[room({state:'pending',presentationLaneId:'other'})]})],
    ['unexpected archive',value=>({...value,rooms:[room({state:'pending',archivedAt:'2026-10-12T00:00:00Z'})]})],
    ['different package',value=>({...value,operators:[company('north',{packageRevision:5})]})],
  ];
  for(const [name,change] of changes){
    const h=harness();await h.ready();h.button('Pausa rum').props.onClick();h.button('Bekräfta').props.onClick();
    await h.reply(1,pausedReceipt());assert.equal(h.requests.length,3,name);
    await h.reply(2,change(pausedSnapshot()));
    assert.equal(h.changed.length,1,name+' never applies unconfirmed state');assert.equal(h.uncertain.length,1,name);
    assert.equal(h.button('Pausa rum').props.disabled,true,name);assert.equal(h.button('Uppdatera').props.disabled,false,name);
    assert.doesNotMatch(h.html(),/Spelrummet är pausat./,name);assert.match(h.html(),/kunde inte bekräftas/,name);
  }
});

test('room-state receipt itself must contain the requested state and correct revisions before readback',async()=>{
  for(const patch of [{room:room()},{room:room({state:'pending',id:'other'})},{administrationRevision:'admin-1'},{administrationRevision:''},{packageRevision:5},{packageRevision:null},{ok:false}]){
    const h=harness();await h.ready();h.button('Pausa rum').props.onClick();h.button('Bekräfta').props.onClick();
    await h.reply(1,{...pausedReceipt(),...patch});
    assert.equal(h.requests.length,2);assert.equal(h.changed.length,1);assert.equal(h.uncertain.length,1);assert.equal(h.button('Pausa rum').props.disabled,true);
  }
});

test('a confirmed room pause updates the visible status and releases writes only after matching readback',async()=>{
  const h=harness();await h.ready();h.button('Pausa rum').props.onClick();h.button('Bekräfta').props.onClick();
  await h.reply(1,pausedReceipt());assert.equal(h.button('Pausa rum').props.disabled,true);
  await h.reply(2,pausedSnapshot());
  assert.equal(h.changed.length,2);assert.equal(h.uncertain.length,0);assert.match(h.html(),/Spelrummet är pausat/);
  assert.doesNotMatch(h.html(),/Öppet för spelare/);assert.equal(h.button('Öppna rum').props.disabled,false);
});

test('operator archive readback must confirm both suspended status and the recorded archive',async()=>{
  const archived=company('north',{status:'suspended',archivedAt:'2026-10-12T00:00:00Z',packageRevision:5});
  for(const returned of [archived,{...archived,status:'active'},{...archived,archivedAt:null},{...archived,archivedAt:'2026-10-12T01:00:00Z'}]){
    const h=harness({kind:'operator'});await h.ready();h.button('Flytta bolag till papperskorgen').props.onClick();h.button('Bekräfta').props.onClick();
    await h.reply(1,{ok:true,operator:archived,packageRevision:5,administrationRevision:'admin-1'});await h.reply(2,snapshot({operators:[returned]}));
    if(returned===archived){assert.equal(h.uncertain.length,0);assert.equal(h.button('Återställ bolag').props.disabled,false);assert.match(h.html(),/North är arkiverat/);}
    else{assert.equal(h.uncertain.length,1);assert.equal(h.button('Flytta bolag till papperskorgen').props.disabled,true);assert.doesNotMatch(h.html(),/North är arkiverat/);}
  }
});


test('restoring a room requires readback of the same room as paused and unarchived',async()=>{
  const archived=room({state:'archived',archivedAt:'2026-10-12T00:00:00Z',canArchive:false,canRestore:true,published:false});
  for(const returnedState of ['pending','live']){
    const h=harness();await h.ready(snapshot({rooms:[archived]}));
    const archive=h.nodes(node=>node.type==='button'&&node.props['aria-pressed']===false)[0];archive.props.onClick();
    h.button('Återställ rum').props.onClick();h.button('Bekräfta').props.onClick();
    await h.reply(1,{ok:true,room:room({state:'pending'}),administrationRevision:'admin-2',packageRevision:5});
    await h.reply(2,snapshot({administrationRevision:'admin-2',operators:[company('north',{packageRevision:5})],rooms:[room({state:returnedState,packageRevision:5})]}));
    if(returnedState==='pending'){assert.equal(h.uncertain.length,0);assert.match(h.html(),/Rummet är återställt och pausat/);}
    else{assert.equal(h.uncertain.length,1);assert.equal(h.button('Återställ rum').props.disabled,true);assert.doesNotMatch(h.html(),/Rummet är återställt och pausat/);}
  }
});
