import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../../../packages/presentation/contracts/studio-model.mjs';
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
  // The shared ConfirmDialog is a function component; expand it so its buttons are inspectable.
  const all=(node,predicate)=>!node||typeof node!=='object'?[]:typeof node.type==='function'?all(node.type(node.props),predicate):[...(predicate(node)?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(child=>all(child,predicate))];
  const nodes=predicate=>all(render(),predicate);
  // Controls are found by their action, never by their words.
  const button=action=>nodes(node=>node.type==='button'&&node.props['data-action']===action)[0];
  const dialog=()=>nodes(node=>node.type==='dialog'&&Boolean(node.props.children))[0];
  /** The confirm control: the compact panel's own, or the ConfirmDialog action that is not its cancel button. */
  const confirm=()=>button('confirm')??(dialog()&&all(dialog(),node=>node.type==='button'&&!('data-dialog-cancel' in node.props))[0]);
  const text=node=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
  const role=name=>nodes(node=>node.props?.role===name).length;
  return {input,requests,changed,busy,uncertain,render,nodes,button,dialog,confirm,role,text,html:()=>renderToStaticMarkup(render()),
    body:index=>JSON.parse(requests[index].options.body),
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
  assert.match(legacy.html(),/href="\/admin\/scenes\?operator=north&amp;composition=standard"/);
  const admin=harness({navigation:{compositionHref:(operator,room)=>'/admin/clips?'+new URLSearchParams({operator:operator.id,table:room.id,composition:room.presentationLaneId}),rehearsalLabel:'Provspela & följ (äldre vy)'}});
  await admin.ready();const links=admin.nodes(node=>node.type==='a');
  assert.ok(links.some(node=>node.props.href==='/admin/clips?operator=north&table=room-one&composition=standard'),'the composition link uses the supplied navigation');
  assert.match(links.find(node=>node.props.children==='Provspela & följ (äldre vy)').props.href,/\/admin\/rooms\?operator=north&table=room-one&composition=standard$/);
  assert.equal(admin.requests.length,1,'navigation does not mutate or reload the shared register');
});

test('archiving confirms a concrete room and sends exactly its tenant and observed revisions',async()=>{
  const h=harness();await h.ready();h.button('room-archive').props.onClick();
  assert.equal(h.requests.length,1);assert.match(h.text(h.dialog()),/Nordiska rummet/,'the dialog names the concrete room');
  const confirm=h.confirm();confirm.props.onClick();confirm.props.onClick();assert.equal(h.requests.length,2);
  assert.deepEqual(JSON.parse(h.requests[1].options.body),{operatorId:'north',roomId:'room-one',expectedAdministrationRevision:'admin-1',expectedPackageRevision:4,archived:true});
  assert.equal(h.busy.at(-1),true);
  await h.reply(1,{ok:true,room:room({state:'archived',archivedAt:'2026-10-12T00:00:00Z'}),administrationRevision:'admin-2',packageRevision:5});
  assert.equal(h.requests.length,3);
  await h.reply(2,snapshot({administrationRevision:'admin-2',operators:[company('north',{packageRevision:5})],rooms:[room({state:'archived',archivedAt:'2026-10-12T00:00:00Z',packageRevision:5,canArchive:false,canRestore:true})]}));
  h.render();assert.equal(h.changed.length,2);assert.equal(h.changed.at(-1).operators[0].packageRevision,5);assert.equal(h.busy.at(-1),false);
  assert.equal(h.requests.length,3,'successful readback must not trigger a fetch loop');
});

test('a selected confirmation cannot operate on another company after a context switch',async()=>{
  const h=harness({kind:'operator'});await h.ready();h.button('operator-lifecycle').props.onClick();assert.ok(h.confirm());
  h.input.operatorId='south';h.render();assert.equal(h.confirm(),undefined);assert.equal(h.requests.length,1);
});

test('old suspended companies are distinct from archived companies that can be restored',async()=>{
  const h=harness({kind:'operator'});await h.ready(snapshot({operators:[company('north',{status:'suspended'})]}));
  assert.equal(h.button('operator-lifecycle'),undefined,'an old suspension cannot be restored through the archive');
  h.input.refreshKey=1;h.render();await h.reply(1,snapshot({operators:[company('north',{status:'suspended',archivedAt:'2026-10-12T00:00:00Z'})]}));
  h.button('operator-lifecycle').props.onClick();h.confirm().props.onClick();
  assert.deepEqual(h.body(2),{operatorId:'north',archived:false,expectedPackageRevision:4,expectedAdministrationRevision:'admin-1'},'the archived company is restored, never archived again');
});

test('foreign receipts block retries until a fresh read and never update another tenant',async()=>{
  const h=harness();await h.ready();h.button('room-archive').props.onClick();h.confirm().props.onClick();
  await h.reply(1,{ok:true,room:room({operatorId:'south'}),administrationRevision:'admin-2',packageRevision:5});
  assert.equal(h.requests.length,2);assert.equal(h.changed.length,1);assert.equal(h.uncertain.length,1);
  assert.equal(h.button('room-archive').props.disabled,true);assert.equal(h.confirm(),undefined);
  h.button('refresh').props.onClick();h.render();await h.reply(2,snapshot());assert.equal(h.button('room-archive').props.disabled,false);
});

test('failed readback after a saved mutation blocks another write and retains a visible recovery action',async()=>{
  const h=harness();await h.ready();h.button('room-state').props.onClick();h.confirm().props.onClick();
  await h.reply(1,{ok:true,room:room({state:'pending'}),administrationRevision:'admin-2',packageRevision:4});
  await h.reply(2,{},503);assert.equal(h.uncertain.length,1);assert.equal(h.role('alert'),1);
  assert.equal(h.button('room-state').props.disabled,true);assert.equal(h.button('refresh').props.disabled,false);
});

test('an external write lock and missing package both disable mutations, and unmounted reads are ignored',async()=>{
  const h=harness({disabled:true});await h.ready(snapshot({operators:[company('north',{packageRevision:null,lanes:[]})],rooms:[room({packageRevision:null,published:false,canArchive:false})]}));
  assert.equal(h.button('room-archive').props.disabled,true);assert.equal(h.button('room-state').props.disabled,true);
  h.button('room-archive').props.onClick();h.confirm()?.props.onClick();assert.equal(h.requests.length,1);
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
    const h=harness();await h.ready();h.button('room-state').props.onClick();h.confirm().props.onClick();
    await h.reply(1,pausedReceipt());assert.equal(h.requests.length,3,name);
    await h.reply(2,change(pausedSnapshot()));
    assert.equal(h.changed.length,1,name+' never applies unconfirmed state');assert.equal(h.uncertain.length,1,name);
    assert.equal(h.button('room-state').props.disabled,true,name);assert.equal(h.button('refresh').props.disabled,false,name);
    assert.equal(h.role('status'),0,name+' reports no success');assert.equal(h.role('alert'),1,name);
  }
});

test('room-state receipt itself must contain the requested state and correct revisions before readback',async()=>{
  for(const patch of [{room:room()},{room:room({state:'pending',id:'other'})},{administrationRevision:'admin-1'},{administrationRevision:''},{packageRevision:5},{packageRevision:null},{ok:false}]){
    const h=harness();await h.ready();h.button('room-state').props.onClick();h.confirm().props.onClick();
    await h.reply(1,{...pausedReceipt(),...patch});
    assert.equal(h.requests.length,2);assert.equal(h.changed.length,1);assert.equal(h.uncertain.length,1);assert.equal(h.button('room-state').props.disabled,true);
  }
});

test('a confirmed room pause updates the visible status and releases writes only after matching readback',async()=>{
  const h=harness();await h.ready();h.button('room-state').props.onClick();h.confirm().props.onClick();
  assert.equal(h.body(1).state,'pending');
  await h.reply(1,pausedReceipt());assert.equal(h.button('room-state').props.disabled,true);
  await h.reply(2,pausedSnapshot());
  assert.equal(h.changed.length,2);assert.equal(h.uncertain.length,0);assert.equal(h.role('status'),1);
  assert.equal(h.button('room-state').props.disabled,false);
  h.button('room-state').props.onClick();h.confirm().props.onClick();
  assert.deepEqual(h.body(3),{operatorId:'north',roomId:'room-one',expectedAdministrationRevision:'admin-2',expectedPackageRevision:4,state:'live'},'the paused room is now offered for opening');
});

test('operator archive readback must confirm both suspended status and the recorded archive',async()=>{
  const archived=company('north',{status:'suspended',archivedAt:'2026-10-12T00:00:00Z',packageRevision:5});
  for(const returned of [archived,{...archived,status:'active'},{...archived,archivedAt:null},{...archived,archivedAt:'2026-10-12T01:00:00Z'}]){
    const h=harness({kind:'operator'});await h.ready();h.button('operator-lifecycle').props.onClick();h.confirm().props.onClick();
    assert.equal(h.body(1).archived,true);
    await h.reply(1,{ok:true,operator:archived,packageRevision:5,administrationRevision:'admin-1'});await h.reply(2,snapshot({operators:[returned]}));
    if(returned===archived){
      assert.equal(h.uncertain.length,0);assert.equal(h.role('status'),1);assert.equal(h.button('operator-lifecycle').props.disabled,false);
      h.button('operator-lifecycle').props.onClick();h.confirm().props.onClick();assert.equal(h.body(3).archived,false,'the archived company is now offered for restore');
    }
    else{assert.equal(h.uncertain.length,1);assert.equal(h.button('operator-lifecycle').props.disabled,true);assert.equal(h.role('status'),0);}
  }
});


test('restoring a room requires readback of the same room as paused and unarchived',async()=>{
  const archived=room({state:'archived',archivedAt:'2026-10-12T00:00:00Z',canArchive:false,canRestore:true,published:false});
  for(const returnedState of ['pending','live']){
    const h=harness();await h.ready(snapshot({rooms:[archived]}));
    const archive=h.nodes(node=>node.type==='button'&&node.props['aria-pressed']===false)[0];archive.props.onClick();
    h.button('room-restore').props.onClick();h.confirm().props.onClick();assert.equal(h.body(1).archived,false);
    await h.reply(1,{ok:true,room:room({state:'pending'}),administrationRevision:'admin-2',packageRevision:5});
    await h.reply(2,snapshot({administrationRevision:'admin-2',operators:[company('north',{packageRevision:5})],rooms:[room({state:returnedState,packageRevision:5})]}));
    if(returnedState==='pending'){assert.equal(h.uncertain.length,0);assert.equal(h.role('status'),1);}
    else{assert.equal(h.uncertain.length,1);assert.equal(h.button('room-restore').props.disabled,true);assert.equal(h.role('status'),0);}
  }
});

test('a game card removal confirms the scoped room, keeps CAS and ignores foreign rooms',async()=>{
  const h=harness({compact:true,onRequestHandled:()=>{h.input.request=undefined;}});await h.ready();
  h.input.request={kind:'archive',roomId:'room-one'};h.render();h.render();
  assert.ok(h.confirm());assert.equal(h.requests.length,1);
  h.button('cancel').props.onClick();assert.equal(h.confirm(),undefined);assert.equal(h.requests.length,1);
  h.input.operatorId='south';h.input.request={kind:'archive',roomId:'room-one'};h.render();h.render();
  assert.equal(h.confirm(),undefined);assert.equal(h.requests.length,1);
  h.input.operatorId='north';h.input.request={kind:'archive',roomId:'room-one'};h.render();h.render();
  h.confirm().props.onClick();
  assert.deepEqual(JSON.parse(h.requests[1].options.body),{operatorId:'north',roomId:'room-one',expectedAdministrationRevision:'admin-1',expectedPackageRevision:4,archived:true});
});

test('restore view only offers archived rooms and compact opening keeps the scoped state contract',async()=>{
  const h=harness({archiveOnly:true});await h.ready(snapshot({rooms:[room(),room({id:'archived',name:'Borttaget',state:'archived',archivedAt:'2026-10-12',canArchive:false,canRestore:true})]}));
  assert.equal(h.button('room-archive'),undefined);assert.equal(h.nodes(node=>node.props?.['data-action']==='room-restore').length,1);
  const open=harness({compact:true,request:{kind:'state',roomId:'room-one'},onRequestHandled:()=>{open.input.request=undefined;}});
  await open.ready(snapshot({rooms:[room({state:'pending'})]}));open.render();open.confirm().props.onClick();
  assert.deepEqual(JSON.parse(open.requests[1].options.body),{operatorId:'north',roomId:'room-one',expectedAdministrationRevision:'admin-1',expectedPackageRevision:4,state:'live'});
});

test('a pending card action is replaced as one room and action, never mixed with another card',async()=>{
  const h=harness({compact:true,onRequestHandled:()=>{h.input.request=undefined;}});
  await h.ready(snapshot({rooms:[room(),room({id:'room-two',name:'Andra spelet',state:'pending'})]}));
  h.input.request={kind:'archive',roomId:'room-one'};h.render();h.render();
  const legend=()=>h.text(h.nodes(node=>node.type==='legend')[0]);
  assert.ok(h.confirm());assert.match(legend(),/Nordiska rummet/);assert.equal(h.requests.length,1);
  h.input.request={kind:'state',roomId:'missing'};h.render();h.render();
  assert.equal(h.confirm(),undefined);assert.equal(h.role('alert'),1);assert.equal(h.requests.length,1);
  h.input.request={kind:'state',roomId:'room-two'};h.render();h.render();
  assert.match(legend(),/Andra spelet/);assert.match(legend(),/North/);assert.doesNotMatch(legend(),/Nordiska rummet/,'the card action is never mixed with another card');
  h.confirm().props.onClick();
  assert.equal(h.requests[1].path.endsWith('/room-state'),true);
  assert.deepEqual(JSON.parse(h.requests[1].options.body),{operatorId:'north',roomId:'room-two',expectedAdministrationRevision:'admin-1',expectedPackageRevision:4,state:'live'});
});
