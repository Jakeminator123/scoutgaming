import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as adminNavigation from '../../../../../packages/navigation/admin-navigation.mjs';
import {adminDocumentHref} from '../../../../../packages/navigation/admin-workspace-routes.mjs';
import * as environmentWorkspace from './environment-workspace.mjs';
import {compositionUses} from './connected-studio.mjs';
import {createSeedProject,defaultPresentationLane,addDealer} from '../../../../../packages/presentation/contracts/studio-model.mjs';

// The real Miljöer och material page (scenes-page.tsx) and environment editor (environment-editor.tsx) with the
// real kit, rendered on the server. Leaves with their own reads (material library, placement editor, preview,
// miljöbild, card picture) are stubbed with the props they receive; the draft workspace is a fixed value.
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
const h=React.createElement;
const compile=(url,resolve)=>{const module={exports:{}};runInNewContext(transformSync(readFileSync(url,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
  {module,exports:module.exports,URLSearchParams,URL,structuredClone,require:resolve});return module.exports;};
function page({search='',workspace}){
  const query=new URLSearchParams(search),navigated=[];
  const navigation={__esModule:true,default:({href,children,className,...rest})=>h('a',{href,className,'aria-current':rest['aria-current'],role:rest.role},children),
    navigate:(href)=>navigated.push(href),usePathname:()=>'/admin/scenes',useSearchParams:()=>query};
  const ui={},uiUrl=name=>new URL('../components/ui/'+name+'.tsx',import.meta.url);
  const uiRequire=name=>name.endsWith('runtime/navigation')?navigation:name.endsWith('lib/admin-navigation')?adminNavigation:name.startsWith('./')?(ui[name]??=compile(uiUrl(name.slice(2)),uiRequire)):require(name);
  const stub=tag=>props=>h('section',{[tag]:JSON.stringify(Object.fromEntries(Object.entries(props).filter(([,value])=>typeof value!=='function'&&typeof value!=='object'||Array.isArray(value)&&value.every(item=>typeof item==='string'))))});
  const panels=[];
  const shared=name=>name==='react'||name.startsWith('react/')?require(name):name.endsWith('runtime/navigation')?navigation:name.startsWith('../ui/')?uiRequire('./'+name.slice(6))
    :name==='../../lib/admin-navigation'?adminNavigation:name==='../../lib/environment-workspace.mjs'?environmentWorkspace:name==='../../lib/connected-studio.mjs'?{compositionUses}
    :name==='./environment-workspace'?{useEnvironmentWorkspace:()=>workspace}:null;
  const editor=compile(new URL('../components/studio/environment-editor.tsx',import.meta.url),name=>shared(name)??(name==='./environment-picture'?{EnvironmentPicture:stub('data-picture')}
    :name==='./studio-composition-panel'?{StudioCompositionPanel:props=>{panels.push(props);return h('section',{'data-layers':props.compositionId,'data-game':props.game,'data-in-environment':String(props.inEnvironment),'data-dealer':props.dealerId});}}
    :name==='./scene-preview'?{ScenePreview:stub('data-preview')}:name==='lucide-react'?require(name):assert.fail('Unexpected import '+name)));
  const scenes=compile(new URL('../components/studio/scenes-page.tsx',import.meta.url),name=>shared(name)??(name==='./environment-editor'?editor
    :name==='./registered-material-library'?{RegisteredMaterialLibrary:stub('data-library')}:name==='./dealer-identity-portrait'?{DealerFaces:()=>null}
    :name==='./scene-cover'?{SceneCover:props=>h('span',{'data-cover':props.lane.id})}
    :name==='../../../../components/lane-editor'?{addLane:(project,id,label,dealer)=>({...project,lanes:[...project.lanes,{...defaultPresentationLane(dealer),id,label}]}),newCompositionId:()=>'ny-miljo'}
    :name==='../../../../components/studio-types'?{activeStudioDealers:project=>project.dealers}:name==='lucide-react'?require(name):assert.fail('Unexpected import '+name)));
  const tab=adminNavigation.adminTabId('scenes',query.get('tab'));
  const html=renderToStaticMarkup(h(scenes.ScenesPage,{tab,filter:query.get('filter'),compositionId:query.get('composition')??'',game:query.get('game'),visible:true,blocked:false,onChanged(){},refreshKey:'0'}));
  return {html,panels,navigated};
}
function fixture({dirty=false}={}){
  const project=addDealer(createSeedProject(),'nora','Nora');
  const studion={...defaultPresentationLane('astrid'),id:'studion',label:'Studion'},lounge={...defaultPresentationLane('nora'),id:'lounge',label:'Loungen'};
  project.lanes=[studion,lounge];
  const asset=(id,role)=>({schemaVersion:1,id,role,label:id,sha256:'0'.repeat(64),size:1,contentType:'image/png',pathname:'x',width:1920,height:1080});
  project.layerAssets=[asset('bg-1','background'),asset('bg-2','background'),asset('table-1','table'),asset('pic-1','illustration')];
  project.layerAssetTrash=[{asset:asset('old','table'),archivedAt:'2026-10-28T00:00:00.000Z'}];
  const catalog={source:'registered',administration:{operators:[{id:'north',name:'North'}],rooms:[
    {id:'kvall',name:'Kvällsbord',operatorId:'north',compositionId:'studion',state:'live',game:'blackjack',published:true},
    {id:'paus',name:'Pausbord',operatorId:'north',compositionId:'studion',state:'paused',game:'roulette'},
    {id:'gammal',name:'Gammalt',operatorId:'north',compositionId:'studion',state:'archived'}]}};
  const base=structuredClone(project);
  return {data:{catalog,project,inventory:{videos:[]}},base,status:'ready',busy:false,dirty,error:'',notice:'',conflicts:[],stale:false,
    load(){},edit(){},save(){},compare(){},registered(){},savedRemote(){},setChildBusy(){},keepDraft(){},discard(){}};
}
const hrefs=html=>[...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&'));

test('Miljöer och material has two tabs; the Miljöer tab lists cards that open each environment in its editor',()=>{
  const {html}=page({search:'tab=miljoer',workspace:fixture()});
  assert.match(html,/<h1[^>]*>Miljöer och material<\/h1>/);
  const tabs=[...html.matchAll(/<nav[^>]*aria-label="Flikar"[^>]*>(.*?)<\/nav>/g)][0][1];
  assert.deepEqual([...tabs.matchAll(/>(Miljöer|Material)</g)].map(match=>match[1]),['Miljöer','Material']);
  assert.match(tabs,/aria-current="page"[^>]*>Miljöer<span[^>]*>2</);assert.match(tabs,/>Material<span[^>]*>3</,'material counts backgrounds and tables, never a miljöbild');
  assert.ok(hrefs(html).includes('/admin/scenes?tab=miljoer&composition=studion'));assert.ok(hrefs(html).includes('/admin/scenes?tab=miljoer&composition=lounge'));
  assert.match(html,/data-cover="studion"/);assert.match(html,/>2 spelbord</,'archived tables are not uses');assert.match(html,/>Oanvänd</);
  assert.match(html,/>Ny miljö</);
  assert.doesNotMatch(html,/Scenmall|ingen papperskorg|Sceneditor|Spelbord och publicering|Bakgrunder<|Papperskorg</);
  // An unknown or retired tab id lands on Miljöer, and retired bookmarks redirect once to the new tab and filter.
  assert.equal(adminNavigation.adminTabId('scenes','mallar'),'miljoer');
  assert.equal(adminDocumentHref('/admin/scenes?tab=mallar&composition=studion&dealer=nora'),'/admin/scenes?tab=miljoer&composition=studion&dealer=nora');
  assert.equal(adminDocumentHref('/admin/scenes?tab=bakgrunder&game=roulette'),'/admin/scenes?tab=material&filter=bakgrund&game=roulette');
  assert.equal(adminDocumentHref('/admin/scenes?tab=bordsgrafik'),'/admin/scenes?tab=material&filter=bordsgrafik');
  assert.equal(adminDocumentHref('/admin/scenes?tab=papperskorg'),'/admin/scenes?tab=material&filter=arkiverat');
  assert.equal(adminDocumentHref('/admin/scenes?tab=material&filter=bakgrund'),'/admin/scenes?tab=material&filter=bakgrund','the new addresses are canonical');
});

test('the Material tab filters Bakgrund, Bordsgrafik and Arkiverat over the existing libraries',()=>{
  for(const [filter,roles,trash] of [[null,['background'],false],['bakgrund',['background'],false],['bordsgrafik',['table'],false],['arkiverat',['background','table'],true]]){
    const {html}=page({search:'tab=material'+(filter?'&filter='+filter:''),workspace:fixture()});
    const chips=[...html.matchAll(/<a href="([^"]+)"[^>]*aria-current="page"[^>]*>(Bakgrund|Bordsgrafik|Arkiverat)/g)];
    assert.equal(chips.length,1);assert.equal(chips[0][2],{bakgrund:'Bakgrund',bordsgrafik:'Bordsgrafik',arkiverat:'Arkiverat'}[filter??'bakgrund']);
    const libraries=[...html.matchAll(/data-library="([^"]+)"/g)].map(match=>JSON.parse(match[1].replaceAll('&quot;','"')));
    assert.deepEqual(libraries.map(row=>row.role),roles);assert.ok(libraries.every(row=>Boolean(row.trashOnly)===trash&&row.base==='/admin/scenes'));
    assert.doesNotMatch(html,/ingen papperskorg/,'the empty-trash card for environments is gone');
  }
  const {html}=page({search:'tab=material&filter=arkiverat',workspace:fixture()});
  assert.ok(hrefs(html).includes('/admin/scenes?tab=material&filter=bordsgrafik'));
  assert.match(html,/>Arkiverat<span[^>]*>1</);
  // A draft of the environments keeps the material library locked until it is saved or discarded.
  const dirty=page({search:'tab=material&filter=bakgrund',workspace:fixture({dirty:true})}).html;
  assert.match(dirty,/osparat utkast/);assert.match(dirty,/&quot;disabled&quot;:true/);
});

test('an environment opens in its own view with Miljöbild, Lager och placering and Används av',()=>{
  const {html,panels}=page({search:'tab=miljoer&composition=studion',workspace:fixture()});
  assert.match(html,/<h1[^>]*>Studion <span/,"the title is the environment, with its draft state beside it");
  assert.deepEqual([...html.matchAll(/<h2[^>]*>(Miljöbild|Lager och placering|Används av)<\/h2>/g)].map(match=>match[1]),['Miljöbild','Lager och placering','Används av']);
  assert.ok(hrefs(html).includes('/admin/scenes?tab=miljoer'),'one step back to all environments');
  assert.match(html,/data-picture="[^"]*laneId&quot;:&quot;studion/);
  // The placement editor keeps its own functions (computer and phone placement, allowed dealers and material).
  assert.equal(panels.length,1);const panel=panels[0];
  assert.equal(panel.inEnvironment,true);assert.equal(panel.compositionId,'studion');assert.equal(panel.dealerId,'astrid');assert.equal(panel.game,'blackjack');
  assert.equal(typeof panel.onEdit,'function');assert.equal(typeof panel.onRegistered,'function');assert.equal(panel.roomChoicesPath,null);
  assert.match(html,/data-preview="[^"]*laneId&quot;:&quot;studion/,'the saved scene preview sits in the same section');
  // Används av lists the live and paused tables with links to their editors, where publication happens.
  const used=html.slice(html.indexOf('>Används av<'));
  assert.match(used,/Kvällsbord/);assert.match(used,/Pausbord/);assert.doesNotMatch(used,/Gammalt/);
  assert.ok(hrefs(used).includes('/admin/rooms/kvall?flik=utseende'));assert.ok(hrefs(used).includes('/admin/rooms/paus?flik=utseende'));
  assert.match(used,/>Öppet</);assert.match(used,/>Pausat</);assert.match(used,/Publicera i spelbordet/);
  assert.doesNotMatch(html,/Spelbord och publicering|Publicera sparad placering/);
  const roulette=page({search:'tab=miljoer&composition=lounge&game=roulette',workspace:fixture()});
  assert.equal(roulette.panels[0].game,'roulette');assert.match(roulette.html,/Inget spelbord använder miljön/);
  assert.match(page({search:'tab=miljoer&composition=borta',workspace:fixture()}).html,/Miljön finns inte i projektet/);
});

test('save and discard sit in the editor header and follow the draft',()=>{
  const clean=page({search:'tab=miljoer&composition=studion',workspace:fixture()}).html;
  assert.match(clean,/<button[^>]*disabled=""[^>]*>Spara utkast<\/button>/);assert.match(clean,/>Sparat</);
  const dirty=page({search:'tab=miljoer&composition=studion',workspace:fixture({dirty:true})}).html;
  assert.doesNotMatch(dirty,/<button[^>]*disabled=""[^>]*>Spara utkast<\/button>/);assert.match(dirty,/>Osparat utkast</);
});

test('the editor helpers list only active uses and count material by kind',()=>{
  const {data}=fixture();
  assert.deepEqual(environmentWorkspace.environmentRooms(data.catalog,'studion').map(row=>[row.id,row.state,row.game,row.href]),
    [['kvall','live','blackjack','/admin/rooms/kvall?flik=utseende'],['paus','paused','roulette','/admin/rooms/paus?flik=utseende']]);
  assert.deepEqual(environmentWorkspace.environmentRooms(data.catalog,''),[]);
  assert.deepEqual(environmentWorkspace.environmentCounts(data.project),{miljoer:2,material:3,bakgrund:2,bordsgrafik:1,arkiverat:1});
  assert.equal(adminNavigation.environmentHref('a b'),'/admin/scenes?tab=miljoer&composition=a+b');
  assert.equal(adminNavigation.materialHref('okänt'),'/admin/scenes?tab=material&filter=bakgrund');
});
