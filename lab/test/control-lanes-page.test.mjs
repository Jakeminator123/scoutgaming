import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject as createEmptyProject , defaultPresentationLane} from '../lib/studio-model.mjs';
import { fixtureLaneOperators } from '../lib/operator-package-api.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl, overrides = {}) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams, fetch: overrides.fetch ?? globalThis.fetch,
    window: overrides.window ?? new Proxy({}, { get: (_target, key) => globalThis.window?.[key] }),
    require: name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
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


const sourceUrl=new URL('../components/control-lanes-page.tsx',import.meta.url);
const twoOperators=()=>[
  {id:'north',slug:'north',name:'North',status:'active',publishedPackage:{revision:4,lanes:['mobile-phone']}},
  {id:'south',slug:'south',name:'South',status:'active',publishedPackage:{revision:7,lanes:['evening']}},
];
const receipt=(operatorId,packageRevision,lanes)=>({ok:true,operatorId,packageRevision,package_revision:packageRevision,lanes:[...lanes].sort()});
const snapshot=(operators)=>({administrationRevision:'admin-1',rooms:[],operators:operators.map(operator=>({...operator,
  packageRevision:operator.publishedPackage?.revision??null,lanes:operator.publishedPackage?.lanes??[],archivedAt:operator.archivedAt??null}))});
function harness(options={}) {
  const project=createSeedProject(),other=structuredClone(project.lanes[0]);other.id='evening';other.label='Kväll';project.lanes.push(other);
  const props={initialProject:project,initialVideos:{videos:[]},initialStatus:{},operators:twoOperators(),storeAvailable:true,...options};
  const slots=[],requests=[],effects=[],events=new Map();let cursor=0;
  const react={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;
    return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useRef(value){return slots[cursor++]??={current:value};},useEffect(effect){effects.push(effect);}};
  const window={location:{pathname:'/studio/control/rooms',search:''},history:{replaceState(){}},confirm:()=>false,
    addEventListener:(name,cb)=>events.set(name,cb),removeEventListener:(name)=>events.delete(name)};
  const Room=()=>null,Lifecycle=()=>null,Directory=()=>null,Conflict=()=>null;let merged,saved;
  const {ControlLanesPage}=loadTs(sourceUrl,{react,window,
    './studio-session':{useStudioProjectSession:()=>({project,dirty:options.dirty??false,saving:options.saving??false,conflict:options.conflict??false,
      savedJson:JSON.stringify(options.savedProject??project),setError(){},setNotice(){},setConflict(){},setProject:value=>merged=value,setSavedJson:value=>saved=value})},
    './presentation-room-create':{PresentationRoomCreate:Room},'./control-resource-lifecycle':{ControlResourceLifecycle:Lifecycle},
    './control-operator-directory':{ControlOperatorDirectory:Directory},'./project-conflict':{ProjectConflict:Conflict},
    fetch:(path,options)=>new Promise(resolve=>requests.push({path,options,resolve}))});
  const render=()=>{cursor=0;effects.length=0;return ControlLanesPage(props);};
  const all=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(child=>all(child,predicate))];
  const nodes=predicate=>all(render(),predicate);
  return {project,props,requests,events,window,effects,render,nodes,html:()=>renderToStaticMarkup(render()),
    operator:()=>nodes(node=>node.type==='select')[0],composition:()=>nodes(node=>node.type==='select')[1],
    checkbox:id=>nodes(node=>node.type==='input'&&node.props.value===id)[0],
    submit:()=>nodes(node=>node.type==='form')[0].props.onSubmit({preventDefault(){}}),
    room:()=>nodes(node=>node.type===Room)[0],lifecycle:()=>nodes(node=>node.type===Lifecycle)[0],directory:()=>nodes(node=>node.type===Directory)[0],
    conflict:()=>nodes(node=>node.type===Conflict)[0],get merge(){return merged;},get saved(){return saved;},
    async reply(index,payload,status=200){requests[index].resolve(Response.json(payload,{status}));await new Promise(resolve=>setImmediate(resolve));}};
}

test('rooms publish only real compositions and expose a company-first surface without a test-provider shortcut',()=>{
  const {ControlLanesPage,publishLaneRows}=loadTs(sourceUrl);
  assert.deepEqual(Array.from(publishLaneRows([],JSON.stringify({lanes:[]}),false)),[]);
  assert.deepEqual(Array.from(publishLaneRows(undefined,'{}',false)),[]);
  const html=renderToStaticMarkup(React.createElement(ControlLanesPage,{initialProject:createSeedProject(),initialVideos:{videos:[]},initialStatus:{},operators:twoOperators(),storeAvailable:false}));
  assert.match(html,/<h1>Spelrum &amp; publicering<\/h1>/);
  assert.match(html,/Välj bolaget du vill arbeta med/);
  assert.doesNotMatch(html,/Skapa SG test game provider|Avancerat: testbolag|Publicera för/);
  assert.match(html,/Bolagens uppgifter kunde inte hämtas/);
});

test('a composition link does not silently add the selected composition to the package',()=>{
  const h=harness({initialOperatorId:'north',initialLaneId:'evening'});
  assert.equal(h.composition().props.value,'evening');assert.equal(h.checkbox('evening').props.checked,false);
  assert.equal(h.checkbox('mobile-phone').props.checked,true);
  assert.match(h.html(),/control\/compositions\?operator=north&amp;composition=evening/);
});

test('company selection uses explicit identity or an unambiguous assignment',()=>{
  const {initialPackageOperator}=loadTs(sourceUrl);
  assert.equal(initialPackageOperator(twoOperators(),'evening'),'south');
  assert.equal(initialPackageOperator(twoOperators(),'evening','north'),'north');
  assert.equal(initialPackageOperator(twoOperators(),'evening','missing'),'');
  assert.equal(initialPackageOperator(twoOperators()),'');
});

test('package writes lock synchronously, retain company drafts on 409 and send the displayed revision',async()=>{
  const h=harness({initialOperatorId:'south'});
  h.checkbox('mobile-phone').props.onChange({target:{checked:true}});
  const picker=h.operator();h.submit();h.submit();picker.props.onChange({target:{value:'north'}});
  assert.equal(h.requests.length,1);assert.equal(h.operator().props.value,'south');
  assert.deepEqual(JSON.parse(h.requests[0].options.body),{operatorId:'south',lanes:['evening','mobile-phone'],expectedPackageRevision:7});
  await h.reply(0,{error:'studio_conflict'},409);
  assert.equal(h.checkbox('mobile-phone').props.checked,true);assert.match(h.html(),/Paketet kunde inte uppdateras/);
  h.operator().props.onChange({target:{value:'north'}});assert.equal(h.checkbox('evening').props.checked,false);
  h.submit();assert.deepEqual(JSON.parse(h.requests[1].options.body),{operatorId:'north',lanes:['mobile-phone'],expectedPackageRevision:4});
  await h.reply(1,receipt('north',5,['mobile-phone']));assert.match(h.html(),/Version 5/);
  h.operator().props.onChange({target:{value:'south'}});assert.equal(h.checkbox('mobile-phone').props.checked,true);
  h.submit();assert.equal(h.requests.length,2,'stale company remains blocked until verified readback');
});

test('new packages send explicit null and unknown assignments require readback',async()=>{
  const h=harness({operators:[{id:'new',slug:'new',name:'New',publishedPackage:null}]});
  h.checkbox('evening').props.onChange({target:{checked:true}});h.submit();
  assert.deepEqual(JSON.parse(h.requests[0].options.body),{operatorId:'new',lanes:['evening'],expectedPackageRevision:null});
  await h.reply(0,receipt('new',1,['evening']));
  const unknown=harness({operators:[{id:'new',slug:'new',name:'New'}]});
  unknown.checkbox('evening').props.onChange({target:{checked:true}});unknown.submit();assert.equal(unknown.requests.length,0);
});

test('unsaved or missing compositions remain explicit and block publication until removed or saved',()=>{
  const h=harness({operators:[{id:'north',slug:'north',name:'North',publishedPackage:{revision:4,lanes:['mobile-phone','evening']}}],dirty:true,savedProject:createSeedProject()});
  assert.equal(h.checkbox('evening').props.checked,true);assert.equal(h.checkbox('evening').props.disabled,true);h.submit();assert.equal(h.requests.length,0);
  const missing=harness({operators:[{id:'north',slug:'north',name:'North',publishedPackage:{revision:4,lanes:['mobile-phone','retired']}}]});
  assert.equal(missing.checkbox('retired').props.checked,true);missing.submit();assert.equal(missing.requests.length,0);
  missing.checkbox('retired').props.onChange({target:{checked:false}});missing.submit();assert.equal(missing.requests.length,1);
});

test('room creation readback advances revision and rebases draft additions/removals without a refresh loop',async()=>{
  const h=harness({initialOperatorId:'north'});
  h.checkbox('mobile-phone').props.onChange({target:{checked:false}});h.checkbox('evening').props.onChange({target:{checked:true}});
  h.room().props.onCreated({packageRevision:5,room:{operatorId:'north'}});h.submit();assert.equal(h.requests.length,0);
  const generation=h.lifecycle().props.refreshKey;
  const updated=twoOperators();updated[0].publishedPackage={revision:5,lanes:['mobile-phone','evening']};
  h.lifecycle().props.onChanged(snapshot(updated));
  assert.equal(h.lifecycle().props.refreshKey,generation,'readback does not request itself again');
  assert.equal(h.checkbox('mobile-phone').props.checked,false);assert.equal(h.checkbox('evening').props.checked,true);
  h.submit();assert.deepEqual(JSON.parse(h.requests[0].options.body),{operatorId:'north',lanes:['evening'],expectedPackageRevision:5});
  await h.reply(0,receipt('north',6,['evening']));
  h.lifecycle().props.onChanged(snapshot(twoOperators()));
  assert.match(h.html(),/Version 6|version 6/,'older snapshots cannot roll back the package editor');
});

test('creator busy does not disable its own controller but immediately locks sibling actions',()=>{
  const h=harness({initialOperatorId:'north'});const picker=h.operator();
  h.room().props.onBusyChange(true);picker.props.onChange({target:{value:'south'}});h.submit();
  assert.equal(h.operator().props.value,'north');assert.equal(h.requests.length,0);
  assert.equal(h.room().props.disabled,false);assert.equal(h.lifecycle().props.disabled,true);
  h.room().props.onBusyChange(false);h.lifecycle().props.onBusyChange(true);assert.equal(h.room().props.interactionDisabled,true);assert.equal(h.room().props.disabled,false);
});

test('archived-only directories remain selectable and refresh without losing tenant identity',()=>{
  const archived={id:'old',slug:'old',name:'Old',status:'suspended',roles:[],members:[],missingRoles:[]};
  const h=harness({initialTab:'companies',initialOperatorId:'old',operators:[],directory:{operators:[archived],standardRoles:[]}});
  assert.equal(h.lifecycle().props.operatorId,'old');
  const updated=snapshot([{...archived,archivedAt:'2026-10-12T00:00:00Z',publishedPackage:{revision:4,lanes:['mobile-phone']}}]);
  h.lifecycle().props.onChanged(updated);assert.equal(h.directory().props.lifecycleArchives.old,'2026-10-12T00:00:00Z');
  assert.equal(h.lifecycle().props.refreshKey,0);
  h.directory().props.onCreated({id:'new',slug:'new',name:'New'});assert.equal(h.lifecycle().props.operatorId,'new');
});

test('room names and package drafts are protected during document and context navigation',()=>{
  const h=harness({initialOperatorId:'north'});h.room().props.onDraftChange(true);
  h.operator().props.onChange({target:{value:'south'}});assert.equal(h.operator().props.value,'north');
  h.composition().props.onChange({target:{value:'evening'}});assert.equal(h.composition().props.value,'mobile-phone');
  h.render();h.effects.forEach(effect=>effect());let prevented=false;
  h.events.get('beforeunload')({preventDefault(){prevented=true;},returnValue:undefined});assert.equal(prevented,true);
});

test('project conflicts use the base, draft and resolved merge without dropping local edits',()=>{
  const base=createSeedProject(),h=harness({initialOperatorId:'north',conflict:true,savedProject:base});
  const props=h.conflict().props;assert.deepEqual(JSON.parse(JSON.stringify(props.base)),base);assert.equal(props.draft,h.project);
  const remote={...base,revision:'new'},merged={...h.project,revision:'new'};props.onResolve(remote,merged);
  assert.equal(h.merge,merged);assert.equal(h.saved,JSON.stringify(remote));
});


test('an archived company query resolves from the global snapshot when the directory was unavailable',()=>{
  const h=harness({initialOperatorId:'old',operators:[]});assert.equal(h.operator().props.value,'');
  h.lifecycle().props.onChanged(snapshot([{id:'old',slug:'old',name:'Old',status:'suspended',archivedAt:'2026-10-12T00:00:00Z',publishedPackage:{revision:2,lanes:[]}}]));
  assert.equal(h.operator().props.value,'old');assert.match(h.html(),/Bolaget är arkiverat/);
});

// This suite exercises a saved composition, not an automatically populated new project.
function createSeedProject() { const project = createEmptyProject(); project.lanes = [defaultPresentationLane('astrid')]; return project; }


test('unconfirmed publish receipts preserve every local addition and removal and block another write',async()=>{
  const invalid=[
    ['missing receipt',()=>null],['missing success',row=>{delete row.ok;return row;}],['failed success',row=>({...row,ok:false})],
    ['foreign company',row=>({...row,operatorId:'south'})],['missing choices',row=>{delete row.lanes;return row;}],
    ['different choices',row=>({...row,lanes:['mobile-phone']})],['duplicate choices',row=>({...row,lanes:['evening','evening']})],
    ['stale revision',row=>({...row,packageRevision:4,package_revision:4})],['skipped revision',row=>({...row,packageRevision:999,package_revision:999})],
    ['string revision',row=>({...row,packageRevision:'5',package_revision:'5'})],['conflicting revisions',row=>({...row,package_revision:6})],
  ];
  for(const [name,change] of invalid){
    const h=harness({initialOperatorId:'north'});
    h.checkbox('mobile-phone').props.onChange({target:{checked:false}});h.checkbox('evening').props.onChange({target:{checked:true}});h.submit();
    await h.reply(0,change(receipt('north',5,['evening'])));
    assert.match(h.html(),/Dina val finns kvar/,name);assert.doesNotMatch(h.html(),/är publicerade/);
    assert.equal(h.checkbox('mobile-phone').props.checked,false,name);assert.equal(h.checkbox('evening').props.checked,true,name);
    h.submit();assert.equal(h.requests.length,1,name+' remains locked');
    h.render();h.effects.forEach(effect=>effect());let dirty=false;
    h.events.get('beforeunload')({preventDefault(){dirty=true;},returnValue:undefined});assert.equal(dirty,true,name+' preserves draft baseline');
    h.lifecycle().props.onChanged(snapshot(twoOperators()));
    assert.equal(h.checkbox('mobile-phone').props.checked,false,name+' preserves removal after recovery');
    assert.equal(h.checkbox('evening').props.checked,true,name+' preserves addition after recovery');
  }
});

test('the exact successful receipt accepts server-sorted choices and clears the saved draft',async()=>{
  const h=harness({initialOperatorId:'north'});h.checkbox('evening').props.onChange({target:{checked:true}});h.submit();
  assert.deepEqual(JSON.parse(h.requests[0].options.body).lanes,['mobile-phone','evening']);
  await h.reply(0,receipt('north',5,['mobile-phone','evening']));
  assert.match(h.html(),/är publicerade. Version 5/);assert.equal(h.lifecycle().props.refreshKey,1);
  h.render();h.effects.forEach(effect=>effect());let dirty=false;
  h.events.get('beforeunload')({preventDefault(){dirty=true;},returnValue:undefined});assert.equal(dirty,false);
});
