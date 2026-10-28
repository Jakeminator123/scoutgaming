import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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

// Bolag & team (/admin/companies). Package publication is proven for Spelbolag & rum in
// client/admin/lib/studio-context.test.mjs.
const sourceUrl=new URL('../components/admin-publication-page.tsx',import.meta.url);
const twoOperators=()=>[
  {id:'north',slug:'north',name:'North',status:'active',publishedPackage:{revision:4,lanes:['mobile-phone']}},
  {id:'south',slug:'south',name:'South',status:'active',publishedPackage:{revision:7,lanes:['evening']}},
];
const snapshot=(operators)=>({administrationRevision:'admin-1',rooms:[],operators:operators.map(operator=>({...operator,
  packageRevision:operator.publishedPackage?.revision??null,lanes:operator.publishedPackage?.lanes??[],archivedAt:operator.archivedAt??null}))});
function harness(options={}) {
  const props={operators:twoOperators(),storeAvailable:true,...options};
  const slots=[],effects=[],events=new Map(),replacements=[];let cursor=0;
  const react={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;
    return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useRef(value){return slots[cursor++]??={current:value};},useEffect(effect){effects.push(effect);}};
  const initialUrl=new URL('/admin/companies'+(options.search??'')+(options.hash??''),'https://test.invalid');
  const location={pathname:initialUrl.pathname,search:initialUrl.search,hash:initialUrl.hash,origin:initialUrl.origin,href:initialUrl.href};
  const window={location,history:{state:options.historyState??{external:'preserved'},replaceState(state,_title,href){
    this.state=state;replacements.push({state,href});if(href===undefined)return;
    const url=new URL(href,window.location.href);Object.assign(window.location,{pathname:url.pathname,search:url.search,hash:url.hash,href:url.href});
  }},addEventListener:(name,cb)=>events.set(name,cb),removeEventListener:(name)=>events.delete(name)};
  const Lifecycle=()=>null,Directory=()=>null;
  const {AdminPublicationPage}=loadTs(sourceUrl,{react,window,
    './control-resource-lifecycle':{ControlResourceLifecycle:Lifecycle},'./control-operator-directory':{ControlOperatorDirectory:Directory}});
  const render=()=>{cursor=0;effects.length=0;return AdminPublicationPage(props);};
  const all=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(child=>all(child,predicate))];
  const nodes=predicate=>all(render(),predicate);
  return {props,events,window,replacements,effects,render,nodes,html:()=>renderToStaticMarkup(render()),
    lifecycle:()=>nodes(node=>node.type===Lifecycle)[0],directory:()=>nodes(node=>node.type===Directory)[0]};
}

test('the companies page shows the directory and the company lifecycle, says when the store is offline and offers no publication',()=>{
  const {AdminPublicationPage}=loadTs(sourceUrl);
  const html=renderToStaticMarkup(React.createElement(AdminPublicationPage,{operators:twoOperators(),storeAvailable:false,directory:null}));
  assert.match(html,/<h1>Bolag &amp; team<\/h1>/);
  assert.match(html,/Bolagens uppgifter kunde inte hämtas/);
  assert.match(html,/Bolag och team kunde inte hämtas/);
  assert.doesNotMatch(html,/Publicera för|name="lanes"|STEG|Spelrum &amp; publicering<\/h1>|Skapa SG test game provider/);
  const h=harness({initialOperatorId:'north'});
  assert.equal(h.directory().props.selectedOperatorId,'north');assert.equal(h.lifecycle().props.operatorId,'north');
  assert.equal(h.lifecycle().props.kind,'operator');assert.equal(h.lifecycle().props.available,true);
});

test('company selection uses explicit identity or an unambiguous assignment',()=>{
  const {initialPackageOperator}=loadTs(sourceUrl);
  assert.equal(initialPackageOperator(twoOperators(),'evening'),'south');
  assert.equal(initialPackageOperator(twoOperators(),'evening','north'),'north');
  assert.equal(initialPackageOperator(twoOperators(),'evening','missing'),'');
  assert.equal(initialPackageOperator(twoOperators()),'');
});

test('archived-only directories remain selectable and refresh without losing tenant identity',()=>{
  const archived={id:'old',slug:'old',name:'Old',status:'suspended',roles:[],members:[],missingRoles:[]};
  const h=harness({initialOperatorId:'old',operators:[],directory:{operators:[archived],standardRoles:[]}});
  assert.equal(h.lifecycle().props.operatorId,'old');
  const updated=snapshot([{...archived,archivedAt:'2026-10-12T00:00:00Z',publishedPackage:{revision:4,lanes:['mobile-phone']}}]);
  h.lifecycle().props.onChanged(updated);assert.equal(h.directory().props.lifecycleArchives.old,'2026-10-12T00:00:00Z');
  assert.equal(h.directory().props.lifecycleStatuses.old,'suspended');
  assert.equal(h.lifecycle().props.refreshKey,0,'a readback does not request itself again');
  h.directory().props.onCreated({id:'new',slug:'new',name:'New'});assert.equal(h.lifecycle().props.operatorId,'new');
  assert.equal(h.lifecycle().props.refreshKey,1,'a created company re-reads the lifecycle');
  assert.equal(new URLSearchParams(h.window.location.search).get('operator'),'new');
});

test('an archived company query resolves from the global snapshot when the directory was unavailable',()=>{
  const h=harness({initialOperatorId:'old',operators:[]});assert.equal(h.lifecycle().props.operatorId,'');
  h.lifecycle().props.onChanged(snapshot([{id:'old',slug:'old',name:'Old',status:'suspended',archivedAt:'2026-10-12T00:00:00Z',publishedPackage:{revision:2,lanes:[]}}]));
  assert.equal(h.lifecycle().props.operatorId,'old');assert.equal(h.directory().props.selectedOperatorId,'old');
  assert.equal(h.directory().props.lifecycleArchives.old,'2026-10-12T00:00:00Z');
});

test('company changes rewrite the operator, drop old room aliases and keep unrelated query, fragment and history',()=>{
  const h=harness({initialOperatorId:'north',search:'?operator=north&room=room-1&table=room-1&dealer=astrid',hash:'#team'});
  h.directory().props.onSelect('south');
  const query=new URLSearchParams(h.window.location.search);
  assert.equal(query.get('operator'),'south');assert.equal(query.has('room'),false);assert.equal(query.has('table'),false);
  assert.equal(query.get('dealer'),'astrid');assert.equal(h.window.location.hash,'#team');
  assert.equal(h.window.history.state.external,'preserved');
  assert.equal(h.window.history.state.__scoutAdminHistory.href,h.window.location.pathname+h.window.location.search+h.window.location.hash);
  assert.equal(h.lifecycle().props.operatorId,'south');assert.equal(h.directory().props.selectedOperatorId,'south');
});

test('a busy card locks company selection and its sibling until it settles',()=>{
  const h=harness({initialOperatorId:'north'});
  h.directory().props.onBusyChange(true);
  h.directory().props.onSelect('south');assert.equal(h.lifecycle().props.operatorId,'north');
  assert.equal(h.lifecycle().props.disabled,true);
  h.render();h.effects.forEach(effect=>effect());let prevented=false;
  h.events.get('beforeunload')({preventDefault(){prevented=true;},returnValue:undefined});assert.equal(prevented,true);
  h.directory().props.onBusyChange(false);h.lifecycle().props.onBusyChange(true);
  assert.equal(h.directory().props.disabled,true);
  h.lifecycle().props.onBusyChange(false);
  h.directory().props.onSelect('south');assert.equal(h.lifecycle().props.operatorId,'south');
});
