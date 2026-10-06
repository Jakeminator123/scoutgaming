import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createPreviewRuntime, validatePreviewSnapshot } from './preview-runtime.mjs';
import { DESTINATIONS, destinationsFor, normalizeView } from './navigation.mjs';
import { readPartnerPreviewFixture } from '../../lib/partner-preview-fixtures.mjs';
import { createPartnerPreviewContext } from '../../lib/partner-preview-policy.mjs';

const require=createRequire(new URL('../../package.json',import.meta.url));
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const babel=require('next/dist/compiled/babel/core');
const source=await readFile(new URL('./original-views.jsx',import.meta.url),'utf8');
const transformed=babel.transformSync(source,{babelrc:false,configFile:false,presets:[[require('next/dist/compiled/babel/preset-react'),{runtime:'classic'}]],plugins:[require('next/dist/compiled/babel/plugin-transform-modules-commonjs')]}).code;
const output={exports:{}};
new Function('require','module','exports',transformed)(require,output,output.exports);
const {createOriginalViews}=output.exports;
const scope={environment:'fixture',workspaceId:'croupier'};
const fixture=readPartnerPreviewFixture(createPartnerPreviewContext({session:{role:'admin',user:'test',scope},scope,operatorId:'operator-demo-north',previewEnabled:true}),{now:()=>Date.UTC(2026,9,6)});
const makeRuntime=(surface,snapshot=fixture)=>createPreviewRuntime(snapshot,{surface,user:'test',notify:()=>{},refresh:()=>{},assetUrl:()=>undefined,studioUrl:path=>'/studio'+(path==='/'?'':path)});

test('all 24 original destinations render as native React without a browser global',()=>{
  const runtime=makeRuntime('internal');
  const original=createOriginalViews(runtime);
  assert.equal(DESTINATIONS.length,24);
  for(const destination of DESTINATIONS){
    assert.equal(typeof original.views[destination.id],'function',destination.id);
    const html=renderToStaticMarkup(React.createElement(original.views[destination.id],{toast:()=>{},brand:'scout',tables:runtime.data.tables,setTables:()=>{},attention:[],setAttention:()=>{},role:'superadmin'}));
    assert.match(html,/<h[12]/,destination.id);
    assert.doesNotMatch(html,/https:\/\/croupier\.scoutgg\.dev|<iframe|NaN|undefined/,destination.id);
  }
});

test('partner excludes internal-only views and creation controls',()=>{
  const runtime=makeRuntime('partner'),original=createOriginalViews(runtime);
  for(const id of ['archive','tables','voice','clips','media','tree','gen'])assert.equal(original.views[id],undefined,id);
  assert.equal(destinationsFor('partner').length,17);
  for(const id of ['dealers','background','pit','team']){
    const html=renderToStaticMarkup(React.createElement(original.views[id],{toast:()=>{},brand:'scout',tables:runtime.data.tables,role:'admin'}));
    assert.doesNotMatch(html,/Create dealer|Duplicate and edit|Add your own casino|Walk-on triggers|Super admin/,id);
  }
  assert.equal(normalizeView('gen','partner'),null);
  assert.equal(normalizeView('tables','partner'),'bj');
  assert.equal(normalizeView('tables','internal'),'tables');
});

test('fixture boundaries reject live snapshots and mixed operator resources',()=>{
  assert.throws(()=>validatePreviewSnapshot({...fixture,mode:'live'}));
  assert.throws(()=>makeRuntime('partner',{...fixture,viewer:{...fixture.viewer,user:'another-admin'}}));
  for(const key of ['tables','team','presentations','players','transactions','reports'])assert.throws(()=>validatePreviewSnapshot({...fixture,[key]:[{id:'foreign',operatorId:'operator-demo-south'}]}),key);
});

test('local draft state and memory never cross runtimes and legacy mutations reject',async()=>{
  const north=makeRuntime('partner'),south=makeRuntime('partner');
  north.designStore.write('themes',{scout:{draft:{primary:'#FF0000'}}});
  north.memory.setItem('layout','list');
  assert.deepEqual(south.designStore.read('themes'),{});
  assert.equal(south.memory.getItem('layout'),null);
  await assert.rejects(north.api('/api/bo/apikeys/create',{name:'test'}),/ingen ansluten tjänst/);
});

test('CSS is fenced inside the portal and source has no legacy loader or global BO state',async()=>{
  const postcss=require('postcss'),css=postcss.parse(await readFile(new URL('./original.css',import.meta.url),'utf8'));
  css.walkRules(rule=>{if(rule.parent.type==='atrule'&&/keyframes$/.test(rule.parent.name))return;for(const selector of postcss.list.comma(rule.selector))assert.ok(selector.startsWith('.kevin-bo'),selector);});
  assert.doesNotMatch(source,/window\.BO_|ReactDOM|createRoot\(|import\(|fetch\(|new WebSocket|new EventSource|localStorage/);
});

test('initial operations and transaction markup are stable across server and browser time zones',()=>{
  const previous=process.env.TZ;
  const render=()=>{
    const runtime=makeRuntime('partner'),original=createOriginalViews(runtime);
    return ['ops','tx'].map(id=>renderToStaticMarkup(React.createElement(original.views[id],{toast:()=>{},brand:'scout',tables:runtime.data.tables,setTables:()=>{},attention:[],setAttention:()=>{},role:'admin'}))).join('');
  };
  try {process.env.TZ='UTC';const utc=render();process.env.TZ='Europe/Stockholm';assert.equal(render(),utc);}
  finally {if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
