import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createPreviewRuntime, operatorPackageRevision, sectionNotConnected, validatePreviewSnapshot } from './preview-runtime.mjs';
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
const makeRuntime=(surface,snapshot=fixture,options={})=>createPreviewRuntime(snapshot,{surface,user:'test',notify:()=>{},refresh:()=>{},assetUrl:()=>undefined,studioUrl:path=>'/studio'+(path==='/'?'':path),...options});

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
  const postcss=require('postcss');
  for(const file of ['./original.css','./preview.css']){
    const css=postcss.parse(await readFile(new URL(file,import.meta.url),'utf8'));
    css.walkRules(rule=>{if(rule.parent.type==='atrule'&&/keyframes$/.test(rule.parent.name))return;for(const selector of postcss.list.comma(rule.selector))assert.ok(selector.startsWith('.kevin-bo'),selector);});
  }
  assert.doesNotMatch(source,/window\.BO_|ReactDOM|createRoot\(|import\(|fetch\(|new WebSocket|new EventSource|localStorage/);
});

test('partner design choices remain usable locally and report their missing lane connection',()=>{
  const notices=[],runtime=makeRuntime('partner',fixture,{notify:message=>notices.push(message)});
  const themes={scout:{draft:{chipMode:'set',chipSet:'scout'}}};
  runtime.designStore.write('themes',themes);
  assert.deepEqual(runtime.designStore.read('themes'),themes);
  assert.match(notices[0],/marker och kort.*saknar koppling till en publicerad presentationslane/);
  assert.match(notices[0],/bara i den lokala förhandsvisningen/);
  runtime.designStore.write('tables',{scout:{draft:{felt:'#000000'}}});
  assert.match(notices[1],/Bordsdesign saknar koppling/);
  assert.deepEqual(fixture.presentations[0].status,'demo');
  assert.deepEqual(makeRuntime('partner').designStore.read('themes'),{});
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

const portalSource = await readFile(new URL('./kevin-backoffice.jsx', import.meta.url), 'utf8');
const portalCode = babel.transformSync(portalSource, { babelrc:false, configFile:false, presets:[[require('next/dist/compiled/babel/preset-react'),{runtime:'automatic'}]], plugins:[require('next/dist/compiled/babel/plugin-transform-modules-commonjs')] }).code;
const portalModule = { exports:{} };
const portalRequire = createRequire(new URL('./kevin-backoffice.jsx', import.meta.url));
new Function('require','module','exports', portalCode)(name => {
  if (name === './original.css' || name === './preview.css' || name === './john-foundation.css') return {};
  if (name === './assets.mjs') return { assetUrl: () => undefined };
  if (name === './original-views.jsx') return { createOriginalViews };
  return (name.startsWith('.') ? portalRequire : require)(name);
}, portalModule, portalModule.exports);
const { KevinBackoffice } = portalModule.exports;

function realSnapshot(extra = []) {
  const operator = { id:'op-1', name:'Nordic Bet', slug:'nordic-bet', packageRevision:'rev-7' };
  return { schemaVersion:1, preview:false, operator, operators:[operator, ...extra], team:[], presentations:[], tables:[], players:[], transactions:[], reports:[], notConnected:true };
}
const renderPortal = props => renderToStaticMarkup(React.createElement(KevinBackoffice, { surface:'partner', apiBase:'/api/partner-preview', user:'test', ...props }));

test('partner menu uses Swedish sections and keeps internal ids off the partner surface', async () => {
  assert.deepEqual(destinationsFor('partner').map(item => [item.id, item.label, item.group]), [
    ['ops', 'Livebord', 'Översikt'],
    ['pit', 'Pitbossar', 'Översikt'],
    ['players', 'Spelare', 'Spelare'],
    ['tx', 'Transaktioner', 'Spelare'],
    ['theme', 'Färger, marker och kort', 'Presentation'],
    ['design', 'Bord', 'Presentation'],
    ['background', 'Bakgrund', 'Presentation'],
    ['dealers', 'Presentationslanes', 'Presentation'],
    ['bj', 'Blackjack', 'Spel'],
    ['roulette', 'Roulette', 'Spel'],
    ['baccarat', 'Baccarat', 'Spel'],
    ['shoes', 'Skor och kortlekar', 'Spel'],
    ['test', 'Provbord', 'Spel'],
    ['stats', 'Statistik', 'Rapporter'],
    ['reports', 'Rapporter', 'Rapporter'],
    ['team', 'Medlemskap', 'Team & åtkomst'],
    ['api', 'Integrationer', 'Team & åtkomst'],
  ]);
  assert.equal(destinationsFor('partner').some(item => item.owner === 'internal'), false);
  assert.deepEqual(destinationsFor('internal').filter(item => item.owner === 'internal').map(item => item.id), ['archive','tables','voice','clips','media','tree','gen']);
  const owned = [portalSource, await readFile(new URL('./navigation.mjs', import.meta.url), 'utf8'), await readFile(new URL('./preview-runtime.mjs', import.meta.url), 'utf8')].join('\n').replaceAll('KevinBackoffice', '');
  assert.doesNotMatch(owned, /Backoffice|BO event|\bTrigger\b|\bPolicy\b|\bLinje\b/);
});

test('fixture preview keeps its internal banner while real operators use Johns honest partner shell', () => {
  const fixtureHtml = renderPortal({ initialSnapshot:fixture });
  assert.match(fixtureHtml, /Intern förhandsvisning/);
  assert.match(fixtureHtml, /Exempeloperatör/);
  assert.match(fixtureHtml, /id="kevin-operator"/);
  assert.equal(fixtureHtml.includes('data-preview="fixture"'), true);
  const single = renderPortal({ initialSnapshot:realSnapshot(), initialView:'players' });
  assert.match(single, /Nordic Bet/);
  assert.match(single, /class="kevin-operator-header"/);
  assert.match(single, /href="\/partner">Alla partners</);
  assert.match(single, /Paketversion rev-7/);
  assert.match(single, /<h1 class="kevin-shell-heading">Spelare</);
  assert.match(single, /data-theme="light" lang="sv"/);
  assert.match(single, /Operatörspersonal/);
  assert.doesNotMatch(single, /Intern förhandsvisning|Exempeloperatör|id="kevin-operator"|Ingen serverdata har lästs|No players match/);
  assert.match(single, /kevin-status-pill">Inte anslutet</);
  assert.match(single, /Spelkoppling återstår/);
  assert.match(single, /Spelare, transaktioner och ekonomiska rapporter är ännu inte anslutna/);
  assert.match(single, /Inga exempelvärden visas/);
  assert.doesNotMatch(single, /href="\/control(?:\/|")|Öppna integrationer|Visa nivå 1/);
  assert.equal((single.match(/btn primary/g) ?? []).length, 0);
  assert.equal(single.includes('data-preview="operator"'), true);
  const several = renderPortal({ initialSnapshot:realSnapshot([{ id:'op-2', name:'Amber House', slug:'amber-house' }]) });
  assert.match(several, /id="kevin-operator"/);
  assert.match(several, /Amber House/);
  assert.doesNotMatch(several, /Exempeloperatör|Intern förhandsvisning/);
  const reports = renderPortal({ initialSnapshot:realSnapshot(), initialView:'reports' });
  assert.match(reports, /<h1 class="kevin-shell-heading">Rapporter</);
  assert.match(reports, /Spelkoppling återstår/);
  assert.match(reports, /Spelare, transaktioner och ekonomiska rapporter är ännu inte anslutna/);
  const unavailablePanel = reports.slice(reports.indexOf('<div class="page-b kevin-disconnected"'));
  assert.doesNotMatch(unavailablePanel, /href=|Öppna integrationer|Ingen serverdata har lästs/);
  assert.equal(sectionNotConnected(fixture, 'players'), false);
  assert.equal(sectionNotConnected(realSnapshot(), 'transactions'), true);
  assert.equal(operatorPackageRevision(realSnapshot()), 'rev-7');
  assert.equal(makeRuntime('partner', realSnapshot()).snapshot.preview, false);
  assert.equal(validatePreviewSnapshot({ ...realSnapshot(), mode:'live', accessClass:'partner' }).accessClass, 'partner');
  assert.throws(() => makeRuntime('partner', { ...realSnapshot(), viewer:{ user:'someone-else' } }));
});

test('real partner presentation destinations use assigned packages instead of local prototype editors',()=>{
  for(const view of ['theme','design','background','dealers','test']){
    const html=renderPortal({initialSnapshot:realSnapshot(),initialView:view});
    assert.match(html,/saknar det publicerade trelagersformatet/,view);
    assert.doesNotMatch(html.slice(html.indexOf('<main '),html.indexOf('</main>')),/Saved board designs|CasinoBackground|Vald lokalt|kevin-lane-status|<svg|Apply theme|Reset theme/,view);
    assert.equal((html.match(/Hämtar utseende/g)||[]).length,view==='test'?0:1,view);
  }
  const fixtureHtml=renderPortal({initialSnapshot:fixture,initialView:'theme'});
  assert.match(fixtureHtml,/Intern förhandsvisning/);
  assert.match(fixtureHtml,/ingen publicerad presentationslane|Ingen publicerad presentationslane/);
});


import {defaultPresentationLane} from '../../lib/studio-model.mjs';
const partnerCopyCode=babel.transformSync(await readFile(new URL('./partner-copy.mjs',import.meta.url),'utf8'),{babelrc:false,configFile:false,plugins:[require('next/dist/compiled/babel/plugin-transform-modules-commonjs')]}).code;
test('verified own-operator saved receipt updates the real package view without replacing team, rooms or fixture design state',()=>{
  const output={exports:{}},slots=[];let cursor=0;
  const hooks={...React,useState:value=>{const index=cursor++;if(!(index in slots))slots[index]=typeof value==='function'?value():value;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];},
    useRef:value=>{const index=cursor++;if(!(index in slots))slots[index]={current:value};return slots[index];},useMemo:work=>work(),useCallback:work=>work,useEffect:()=>{}};
  // All imported hooks share this harness's slots, including presentation preferences.
  const preferences={exports:{}};
  new Function('require','module','exports',partnerCopyCode)(name=>name==='react'?hooks:require(name),preferences,preferences.exports);
  new Function('require','module','exports',portalCode)(name=>{
    if(name==='react')return hooks;
    if(name==='./partner-copy.mjs')return preferences.exports;
    if(name.endsWith('.css'))return {};
    if(name==='./assets.mjs')return {assetUrl:()=>undefined};
    if(name==='./original-views.jsx')return {createOriginalViews};
    return (name.startsWith('.')?portalRequire:require)(name);
  },output,output.exports);
  const snapshot={...realSnapshot(),packageRevision:'7',operator:{...realSnapshot().operator,packageRevision:'7'},
    team:[{id:'staff',operatorId:'op-1'}],tables:[{id:'room-owned',operatorId:'op-1'}]};
  const props={surface:'partner',initialSnapshot:snapshot,apiBase:'/studio/api/partner/snapshot',user:'test',initialView:'dealers'};
  const session=output.exports.KevinBackoffice(props).type;
  const walk=tree=>!tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(walk)];
  const view=()=>{cursor=0;return walk(session(props)).find(node=>node.type?.name==='PreviewView');};
  const before=view().props.runtime.snapshot;
  const lane=defaultPresentationLane();lane.dealers=['astrid','vera'];lane.layers.dealer.allowed=['astrid','vera'];
  const receipt={operatorId:'op-1',packageRevision:8,branding:{lane:lane.id,dealer:'vera'},presentation:{schemaVersion:1,projectRevision:'frozen-r1',lanes:[lane],assets:[]}};
  view().props.onAppearanceSaved({...receipt,operatorId:'other'});assert.deepEqual(view().props.runtime.snapshot,before);
  view().props.onAppearanceSaved(receipt);const after=view().props.runtime.snapshot;
  assert.equal(after.packageRevision,'8');assert.equal(after.operator.packageRevision,'8');assert.equal(after.presentations[0].dealer,'vera');
  assert.deepEqual(after.team,before.team);assert.deepEqual(after.tables,before.tables);assert.deepEqual(after.operators,before.operators);
  view().props.onAppearanceSaved({...receipt,packageRevision:7,branding:{dealer:'astrid'}});assert.deepEqual(view().props.runtime.snapshot,after);
});
