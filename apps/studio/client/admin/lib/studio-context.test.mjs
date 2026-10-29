import test from 'node:test';
import assert from 'node:assert/strict';
import {studioContext} from './studio-context.mjs';
import * as reactDomServer from 'react-dom/server';
import {adminDocumentHref} from '../../../../../packages/navigation/admin-workspace-routes.mjs';
import {PACKAGE_RECEIPT_MISMATCH,packagePublishError,publishedPackageMessage} from '../../../lib/operator-package-client.mjs';
import {aiTableMisfitMessage} from '../../../lib/ai-image-contract.mjs';
const catalog={administration:{operators:[{id:'a',status:'active',archivedAt:null},{id:'b',status:'active',archivedAt:null}],rooms:[
  {id:'bj',operatorId:'a',game:'blackjack',compositionId:'one'},
  {id:'roulette',operatorId:'a',game:'roulette',compositionId:'two'},
  {id:'other',operatorId:'b',game:'blackjack',compositionId:'three'},
  {id:'archived',operatorId:'a',state:'archived',game:'roulette',compositionId:'three'},
],dealers:[{id:'astrid'},{id:'paow-v2'},{id:'removed',archived:true}]}};
const project={dealers:[{id:'astrid'},{id:'paow-v2'},{id:'removed'}],lanes:[
  {id:'one',layers:{dealer:{allowed:['astrid'],default:'astrid'}}},
  {id:'two',layers:{dealer:{allowed:['paow-v2','removed'],default:'paow-v2'}}},
  {id:'three',layers:{dealer:{allowed:['removed'],default:'removed'}}},
]};
test('a selected game limits rooms before dealer selection',()=>{
  const context=studioContext(catalog,project,{operatorId:'a',game:'roulette',roomId:'roulette',dealerId:'astrid'});
  assert.deepEqual(context.rooms.map(row=>row.id),['roulette']);
  assert.equal(context.game,'roulette');assert.equal(context.dealer.id,'paow-v2');
  assert.deepEqual(context.dealers.map(row=>row.id),['paow-v2']);
  const blackjack=studioContext(catalog,project,{operatorId:'a',game:'blackjack',roomId:'roulette'});
  assert.equal(blackjack.room.id,'bj');assert.equal(blackjack.dealer.id,'astrid');
});

test('explicit N1 library mode opens an unassigned dealer without changing the room template or ownership',()=>{
  const before=structuredClone(project);
  const context=studioContext(catalog,project,{operatorId:'a',roomId:'bj',dealerId:'paow-v2',library:true});
  assert.equal(context.dealer.id,'paow-v2');assert.equal(context.room.id,'bj');assert.equal(context.operator.id,'a');
  assert.deepEqual(context.lane.layers.dealer.allowed,['astrid']);assert.deepEqual(project,before);
  assert.deepEqual(context.dealers.map(row=>row.id),['astrid','paow-v2']);
});
test('a direct archived company link cannot reopen its room or inherit an active dealer bank',()=>{
  const saved=structuredClone(catalog);saved.administration.operators[0].status='suspended';saved.administration.operators[0].archivedAt='2026-10-13T00:00:00Z';
  const context=studioContext(saved,project,{operatorId:'a',roomId:'bj',dealerId:'astrid'});
  assert.equal(context.operator,undefined);assert.equal(context.room,undefined);assert.equal(context.dealer,undefined);assert.deepEqual(context.rooms,[]);
});
test('a cross-operator room cannot redirect the selected operator or dealer',()=>{
  const context=studioContext(catalog,project,{operatorId:'a',roomId:'other',dealerId:'removed'});
  assert.equal(context.room.id,'bj');assert.equal(context.operator.id,'a');assert.equal(context.dealer.id,'astrid');
});
test('a direct room link establishes its registered owner, never a name match',()=>{
  const context=studioContext(catalog,project,{roomId:'other'});
  assert.equal(context.operator.id,'b');assert.equal(context.room.id,'other');assert.equal(context.dealer,undefined);
});
test('missing composition has no automatic fallback dealer bank',()=>{
  const context=studioContext(catalog,{...project,lanes:[]},{roomId:'bj'});
  assert.equal(context.dealer,undefined);assert.deepEqual(context.dealers,[]);
});

test('explicit shared composition remains separate from the registered room and owner',()=>{
  const before=structuredClone(catalog);
  for(const compositionId of ['one','two']){
    const context=studioContext(catalog,project,{operatorId:'a',roomId:'bj',compositionId,dealerId:'astrid',game:'blackjack',library:true});
    assert.equal(context.lane.id,compositionId);assert.equal(context.room.id,'bj');
    assert.equal(context.room.compositionId,'one');assert.equal(context.operator.id,'a');
    assert.equal(context.dealer.id,'astrid');assert.equal(context.game,'blackjack');
  }
  assert.deepEqual(catalog,before);
});

test('unknown explicit composition never falls back to the room template and a library scene needs no room',()=>{
  const unknown=studioContext(catalog,project,{operatorId:'a',roomId:'bj',compositionId:'missing',library:true});
  assert.equal(unknown.lane,undefined);assert.equal(unknown.room.id,'bj');assert.equal(unknown.operator.id,'a');
  const library=studioContext(catalog,project,{compositionId:'two',dealerId:'paow-v2',library:true});
  assert.equal(library.lane.id,'two');assert.equal(library.room,undefined);assert.equal(library.operator,undefined);
  assert.equal(library.dealer.id,'paow-v2');
  const roomOnly=studioContext(catalog,project,{operatorId:'a',roomId:'bj',compositionId:'two'});
  assert.equal(roomOnly.lane.id,'one');assert.equal(roomOnly.dealer.id,'astrid');
});

// ---- RegisteredStudio: the company's assignment (mode package), a new room (mode create) and the room editor
// (mode room, one section per tab). Company and room come from the nav's path, so the harness takes the
// component's props; the address only matters for the history writes the component makes itself.
function fakeHooks(React){
  const slots=[],effects=[];let cursor=0;
  const react={...React,
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
    useRef(value){return slots[cursor++]??={current:value};},
    useEffect(effect,deps){const i=cursor++,previous=slots[i];if(!previous||!deps||deps.some((value,index)=>value!==previous.deps[index]))effects.push(()=>{previous?.cleanup?.();slots[i]={deps,cleanup:effect()};});}};
  return {react,reset(){cursor=0;},flush(){for(const effect of effects.splice(0))effect();}};
}
const registryRoom=row=>({...row,name:row.name??row.id,state:row.state??'live',published:row.published??true,playable:row.playable??true,
  dealerIds:row.dealerIds??(row.game==='roulette'?['paow-v2']:['astrid']),dealers:row.dealers??[],dealerSource:'published'});
const registry=(overrides={})=>({schemaVersion:1,source:'registered',readAt:'2026-10-13T00:00:00Z',administration:{...catalog.administration,
  operators:catalog.administration.operators.map(row=>({...row,name:row.id,slug:row.id,packageRevision:1})),
  dealers:catalog.administration.dealers.map(row=>({...row,name:row.id})),
  rooms:catalog.administration.rooms.map(registryRoom),compositions:[],revisions:{project:'p1',administration:'a1'},...overrides}});
const compositions=[{id:'one',name:'Standard',dealerIds:['astrid'],defaultDealerId:'astrid'},{id:'two',name:'Kväll',dealerIds:['paow-v2'],defaultDealerId:'paow-v2'}];
const walk=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>walk(child,predicate))];
const hrefs=html=>[...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&'));
// Words are not locked: messages are compared with the shared library texts, the publication status with
// itself across states, and notices by their role.
const textOf=node=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(textOf).join(''):node?.props?textOf(node.props.children):'';
const escapeHtml=text=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
const shows=(html,text)=>html.includes(escapeHtml(text));
/** The single publication status line inside the package form. */
const formStatus=tree=>textOf(walk(walk(tree,node=>node.type==='form')[0],node=>node.type==='p'&&node.props?.role==='status')[0]);
const roleCount=(html,role)=>(html.match(new RegExp(`role="${role}"`,'g'))||[]).length;
/** The revision chip in the assignment header. */
const revisionChip=tree=>textOf(walk(walk(tree,node=>node.type==='header')[0],node=>node.type==='span').at(-1));
const lifecycleSnapshot=(extra={})=>({administrationRevision:'admin-1',operators:[{id:'a',slug:'a',name:'a',status:'active',packageRevision:4,lanes:['one'],archivedAt:null,roomCount:2,archivedRoomCount:0},{id:'b',slug:'b',name:'b',status:'active',packageRevision:null,lanes:[],archivedAt:null,roomCount:1,archivedRoomCount:0}],rooms:[],...extra});
const settle=async(rounds=3)=>{for(let i=0;i<rounds;i++)await new Promise(resolve=>setImmediate(resolve));};

async function mountRegisteredStudio(props,{fetch:customFetch,hash='',...overrides}={}){
  let currentProps={...props};
  const pathFor=value=>value.mode==='room'?'/admin/rooms/'+(value.roomId??''):'/admin/companies/'+value.operatorId;
  let currentPath=pathFor(currentProps),currentSearch='',currentHash=hash,allowLeave=false,confirms=0,notifications=0;const listeners=new Map();
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild');
  // Shared .mjs helpers resolve from the component's own location; React cards are stubbed with their props.
  const componentRequire=createRequire(new URL('../components/studio/registered-studio.tsx',import.meta.url));
  const stub=(tag,pick)=>props=>React.createElement('section',{[tag]:pick(props),'data-disabled':String(Boolean(props.disabled)),...('interactionDisabled' in props?{'data-interaction-disabled':String(Boolean(props.interactionDisabled))}:{})});
  const lifecycle=await import('./studio-resource-lifecycle.mjs');
  const historyModule=await import('../../../lib/studio-history.mjs');
  const locationState={origin:'https://scout.invalid',get href(){return this.origin+currentPath+currentSearch+currentHash;},get pathname(){return currentPath;},get search(){return currentSearch;},get hash(){return currentHash;}};
  const historyState={state:null,replaceState(state,unused,href){this.state=state;if(href!==undefined){const url=new URL(href,locationState.href);currentPath=url.pathname;currentSearch=url.search;currentHash=url.hash;}},pushState(state,unused,href){this.replaceState(state,unused,href);}};
  const windowState={location:locationState,history:historyState,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),dispatchEvent:event=>{listeners.get(event.type)?.(event);return !event.defaultPrevented;}};
  historyModule.studioHistory(windowState).subscribe(()=>notifications++);
  const value=registry(overrides);
  const source=readFileSync(new URL('../components/studio/registered-studio.tsx',import.meta.url),'utf8');
  const output=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}),module={exports:{}},hooks=fakeHooks(React);
  runInNewContext(output.code,{module,exports:module.exports,URLSearchParams,URL,AbortController,location:locationState,confirm:()=>{confirms++;return allowLeave;},window:windowState,document:{addEventListener:()=>{},removeEventListener:()=>{},getElementById:()=>null},
    fetch:customFetch??(async()=>Response.json(value)),require:name=>name==='react'?hooks.react:name==='../ui/kit'?{cn:(...names)=>names.filter(Boolean).join(' '),buttonVariants:()=>'button'}
      :name.includes('partner-appearance-loader.mjs')?{PartnerAppearanceLoader:props=>React.createElement('section',{'data-room-editor':props.roomId,'data-operator':props.operatorId,'data-room-layout':props.roomLayout,'data-admin-choices':String(Boolean(props.adminChoices)),'data-disabled':String(Boolean(props.disabled))},props.children)}:name==='../../../runtime/navigation'?{useSearchParams:()=>new URLSearchParams(currentSearch)}:name.endsWith('studio-history.mjs')?historyModule:name.includes('connected-studio.mjs')?{navigationKeepsStudioTab:()=>false}:name.includes('studio-resource-lifecycle.mjs')?lifecycle
      :name.endsWith('components/control-resource-lifecycle')?{ControlResourceLifecycle:stub('data-lifecycle',props=>props.kind)}:name.endsWith('components/room-game-config')?{RoomGameConfig:stub('data-game-config',props=>props.roomId)}
      :name.endsWith('components/presentation-room-create')?{PresentationRoomCreate:stub('data-room-create',props=>props.presentation?.id??'')}
      :name==='./dealer-identity-portrait'?portraitStubs(React):name.startsWith('.')?componentRequire(name):require(name)});
  const render=()=>{hooks.reset();const tree=module.exports.RegisteredStudio(currentProps);hooks.flush();return tree;};
  render();await settle(1);
  return {render,listeners,allowLeave:value=>{allowLeave=value;},setProps(next){currentProps={...currentProps,...next};},
    get href(){return currentPath+currentSearch+currentHash;},get search(){return currentSearch;},get hash(){return currentHash;},get confirms(){return confirms;},get notifications(){return notifications;}};
}
// Portraits are presentation only (their own test is dealer-artwork.test.mjs); the names stay as text.
const portraitStubs=React=>({DealerAvatar:()=>null,DealerFaces:props=>React.createElement('span',{'data-dealer-faces':''},props.dealers.map(row=>row.label).join(', ')||props.empty||'–')});
async function registeredStudioHtml(props,options){return renderToStaticMarkupOf(await mountRegisteredStudio(props,options));}
function renderToStaticMarkupOf(h){const {renderToStaticMarkup}=reactDomServer;return renderToStaticMarkup(h.render());}

// Bolag och spelbord (companies-page.tsx) resolves the company and the room's registered owner from the path and
// mounts RegisteredStudio per tab. Its children with their own reads are stubbed with their props.
async function companiesPageHtml({page,id,search='',...overrides}){
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
  const componentRequire=createRequire(new URL('../components/studio/companies-page.tsx',import.meta.url));
  const path=page==='companies'?'/admin/companies':page==='company'?'/admin/companies/'+id:'/admin/rooms/'+id;
  const navigation={__esModule:true,default:props=>React.createElement('a',props),usePathname:()=>path,useSearchParams:()=>new URLSearchParams(search)};
  const adminNavigation=await import('../../../../../packages/navigation/admin-navigation.mjs');
  const value=registry(overrides),hooks=fakeHooks(React);
  const compile=(file,resolve)=>{const module={exports:{}};runInNewContext(transformSync(readFileSync(new URL(file,import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
    {module,exports:module.exports,URLSearchParams,URL,AbortController,fetch:async()=>Response.json(value),document:{addEventListener:()=>{},removeEventListener:()=>{}},require:resolve});return module.exports;};
  const ui={},uiRequire=name=>name.endsWith('runtime/navigation')?navigation:name.startsWith('./')?(ui[name]??=compile('../components/ui/'+name.slice(2)+'.tsx',uiRequire)):require(name);
  const hub=compile('../components/ui/hub.tsx',uiRequire);
  const stub=(tag,pick)=>props=>React.createElement('section',{[tag]:pick(props)});
  const module=compile('../components/studio/companies-page.tsx',name=>name==='react'?hooks.react:name.endsWith('runtime/navigation')?navigation:name==='../ui/hub'?hub:name==='../../lib/admin-navigation'?adminNavigation
    :name==='./registered-studio'?{RegisteredStudio:stub('data-registered-studio',props=>[props.mode,props.operatorId,props.roomId??'',props.section??''].join(':'))}
    :name==='./workspace-tools'?{WorkspaceTool:stub('data-workspace-tool',props=>props.section)}:name==='./saved-scene-preview'?{SavedScenePreview:()=>null}
    :name.endsWith('control-resource-lifecycle')?{ControlResourceLifecycle:stub('data-lifecycle',props=>props.kind)}:name.endsWith('partner-journal-loader.mjs')?{PartnerJournal:stub('data-journal',props=>props.operatorId)}
    :name==='./dealer-identity-portrait'?portraitStubs(React):name==='./room-picture'?{RoomPicture:()=>null}
    :name.startsWith('../ui/')?uiRequire('./'+name.slice('../ui/'.length)):name.startsWith('.')?componentRequire(name):require(name));
  const render=()=>{hooks.reset();const tree=module.CompaniesPage({page,id,active:true,disabled:false,onChanged(){}});hooks.flush();return tree;};
  render();await settle(1);
  return renderToStaticMarkup(render());
}

test('the room nav mounts the exact scoped editor per tab; the company nav owns the assignment and room creation',async()=>{
  const appearance=await registeredStudioHtml({operatorId:'a',roomId:'roulette',mode:'room',section:'appearance'},{compositions});
  assert.equal(hrefs(appearance).some(href=>/^\/admin\/(publication|rooms\?|clips)/.test(href)),false,'no function lives only on a retired page');
  assert.match(appearance,/data-room-editor="roulette"/);assert.match(appearance,/data-operator="a"/);assert.match(appearance,/data-admin-choices="true"/);assert.match(appearance,/data-room-layout="true"/);
  assert.doesNotMatch(appearance,/data-game-config=|data-room-create=|aria-label="Tilldelning"/,'the appearance tab mounts only the layer editor');
  assert.doesNotMatch(appearance,/<select|id="room-trash"/,'no game picker, composition editor or room trash in the appearance tab');
  assert.match(await registeredStudioHtml({operatorId:'a',roomId:'bj',mode:'room',section:'game'},{compositions}),/data-game-config="bj"/);
  const rouletteGame=await registeredStudioHtml({operatorId:'a',roomId:'roulette',mode:'room',section:'game'},{compositions});
  assert.doesNotMatch(rouletteGame,/data-game-config=|data-room-editor=/,'roulette rooms have no blackjack game settings');assert.equal(roleCount(rouletteGame,'status'),1,'the missing settings are explained');
  const state=await registeredStudioHtml({operatorId:'a',roomId:'bj',mode:'room',section:'state'},{compositions});
  assert.match(state,/data-lifecycle="rooms"/);assert.doesNotMatch(state,/data-lifecycle="operator"|data-room-editor=|data-game-config=/);
  const stateView=await mountRegisteredStudio({operatorId:'a',roomId:'bj',mode:'room',section:'state'},{compositions});
  const pause=walk(stateView.render(),node=>node.type==='button'&&typeof node.props.onClick==='function')[0];
  pause.props.onClick();
  assert.deepEqual({...walk(stateView.render(),node=>node.props?.kind==='rooms')[0].props.request},{kind:'state',roomId:'bj'},'the live room offers a pause through its own lifecycle');
  const h=await mountRegisteredStudio({operatorId:'a',mode:'package'},{compositions});
  const assignment=walk(h.render(),node=>node.type==='section'&&node.props?.['aria-label']==='Tilldelning')[0];
  assert.ok(assignment);
  assert.deepEqual(walk(assignment,node=>node.type==='input'&&node.props?.name==='lanes').map(node=>node.props.value),['one','two']);
  const packageHtml=renderToStaticMarkupOf(h);
  assert.doesNotMatch(packageHtml,/data-room-create=|data-room-editor=|data-game-config=/,'room creation opens only on the create view');
  assert.match(packageHtml,/data-lifecycle="rooms"/,'the assignment reads the published package through the rooms lifecycle');
  assert.equal(walk(h.render(),node=>node.type==='button'&&node.props.type==='submit').length,1,'the assignment has one publish action');
  // A new room starts from the company's first room template; without a matching template the first saved one.
  for(const [overrides,composition] of [[{},'one'],[{rooms:[registryRoom(catalog.administration.rooms[1])]},'two'],[{rooms:[registryRoom(catalog.administration.rooms[2])]},'one']]){
    const create=await mountRegisteredStudio({operatorId:'a',mode:'create'},{compositions,...overrides});
    assert.equal(walk(create.render(),node=>typeof node.props?.onCreated==='function')[0].props.presentation.id,composition);
  }
});

test('an unknown owner or a cross-owner room never mounts another room editor',async()=>{
  for(const section of ['appearance','game','state']){
    const missing=await registeredStudioHtml({operatorId:'missing',roomId:'roulette',mode:'room',section});
    assert.doesNotMatch(missing,/data-room-editor=|data-game-config=|data-lifecycle=/);assert.equal(roleCount(missing,'alert'),1);assert.match(missing,/missing/,'the unknown company is named');
    for(const roomId of ['other','archived','missing']){
      const foreign=await registeredStudioHtml({operatorId:'a',roomId,mode:'room',section});
      assert.doesNotMatch(foreign,/data-room-editor=|data-game-config=|data-lifecycle=/,roomId);assert.equal(roleCount(foreign,'alert'),1,roomId);
    }
  }
});

test('unpublished rooms point to the company assignment without a frozen editor fallback',async()=>{
  const room=registryRoom({...catalog.administration.rooms[0],name:'Utkast',state:'preview',published:false,playable:false,dealerIds:[]});
  const html=await registeredStudioHtml({operatorId:'a',roomId:'bj',mode:'room',section:'appearance'},{rooms:[room]});
  assert.doesNotMatch(html,/data-room-editor=/);assert.equal(roleCount(html,'status'),1,'the missing package is explained instead of a frozen editor');
  const game=await registeredStudioHtml({operatorId:'a',roomId:'bj',mode:'room',section:'game'},{rooms:[room]});
  assert.doesNotMatch(game,/data-game-config=/);assert.equal(roleCount(game,'status'),1);
});

test('an active company without registered rooms can still create its first room in Admin',async()=>{
  const html=await registeredStudioHtml({operatorId:'b',mode:'package'},{rooms:[],compositions});
  assert.equal(hrefs(html).some(href=>href.startsWith('/admin/publication')),false);
  assert.match(html,/aria-label="Tilldelning"/);assert.doesNotMatch(html,/data-room-create=|data-room-editor=|data-game-config=/);
  const create=await registeredStudioHtml({operatorId:'b',mode:'create'},{rooms:[],compositions});
  assert.match(create,/data-room-create="one"/);assert.doesNotMatch(create,/data-room-editor=|data-game-config=/);
});

test('partner and template links are scoped to the selected owner and never carry another company or its room',async()=>{
  const own=await registeredStudioHtml({operatorId:'a',mode:'package'},{compositions});
  assert.ok(hrefs(own).includes('/partner/a/rooms'));
  assert.equal(hrefs(own).some(href=>href.includes('operator=b')||href.includes('/partner/b')||href.startsWith('/control')),false);
  const other=await registeredStudioHtml({operatorId:'b',mode:'package'},{compositions});
  assert.ok(hrefs(other).includes('/partner/b/rooms'));assert.equal(hrefs(other).some(href=>href.includes('/partner/a')||href.includes('operator=a')),false);
  const empty=await registeredStudioHtml({operatorId:'b',mode:'package'},{compositions:[]});
  assert.ok(hrefs(empty).includes('/admin/scenes?tab=mallar'),'without templates the assignment points to Scenmallar');
  for(const section of ['appearance','state']){
    const foreign=await registeredStudioHtml({operatorId:'a',roomId:'other',mode:'room',section},{compositions});
    assert.equal(hrefs(foreign).some(href=>/rooms\?room=|\/partner\//.test(href)),false,'a cross-owner room never becomes this company\'s partner context');
  }
});

test('the rooms lifecycle gets scene template links without the game or owner of another room',async()=>{
  const h=await mountRegisteredStudio({operatorId:'a',roomId:'bj',mode:'room',section:'state'},{compositions});
  const navigation=walk(h.render(),node=>node.props?.kind==='rooms')[0].props.navigation;
  assert.equal(typeof navigation.rehearsalLabel,'string');assert.ok(navigation.rehearsalLabel);
  assert.equal(navigation.compositionHref({id:'a'},{id:'bj',presentationLaneId:'one'}),'/admin/scenes?tab=mallar&composition=one&table=bj');
  for(const [owner,room] of [[{id:'a'},{id:'other',presentationLaneId:'three'}],[{id:'b'},{id:'bj',presentationLaneId:'one'}],[{id:'a'},{id:'bj',presentationLaneId:'two'}]]){
    assert.doesNotMatch(navigation.compositionHref(owner,room),/game=|operator=/,'another room, company or composition never lends its game or owner');
  }
});

test('the room editor vetoes in-app navigation over a draft or a write in flight and lets a confirmed leave through',async()=>{
  const h=await mountRegisteredStudio({operatorId:'a',roomId:'roulette',mode:'room',section:'appearance'});
  const editor=()=>walk(h.render(),node=>node.props?.apiBase==='/studio/api/partner')[0];
  const attempt=()=>{let denied=false;h.listeners.get('scout:navigate')({preventDefault:()=>{denied=true;}});return denied;};
  assert.equal(attempt(),false);assert.equal(h.confirms,0,'a clean editor never asks');
  editor().props.onDirtyChange(true);h.render();
  assert.equal(attempt(),true);assert.equal(h.confirms,1,'a draft asks and a declined confirm vetoes');
  editor().props.onBusyChange(true);h.render();
  assert.equal(attempt(),true);assert.equal(h.confirms,1,'a write in flight vetoes without asking');
  editor().props.onBusyChange(false);h.render();h.allowLeave(true);
  assert.equal(attempt(),false);assert.equal(h.confirms,2);
  assert.equal(editor().props.roomId,'roulette','the editor never remounts over its draft');assert.equal(h.href,'/admin/rooms/roulette');
});

test('the room nav resolves the registered owner and never falls back for an unknown or archived room',async()=>{
  for(const [flik,section] of [['utseende','appearance'],['spel','game'],['tillganglighet','state']]){
    const html=await companiesPageHtml({page:'room',id:'other',search:'?flik='+flik,compositions});
    assert.match(html,new RegExp(`data-registered-studio="room:b:other:${section}"`));
    assert.ok(hrefs(html).includes('/admin/companies/b?flik=spelbord'));assert.equal(hrefs(html).some(href=>href.includes('/admin/companies/a')),false);
  }
  const missing=await companiesPageHtml({page:'room',id:'missing',search:'?flik=utseende'});
  assert.doesNotMatch(missing,/data-registered-studio=/);assert.match(missing,/data-not-found="room"/,'the page states that the room is not registered');
  assert.doesNotMatch(await companiesPageHtml({page:'room',id:'other',search:'?flik=utseende',compositions}),/data-not-found=/,'a known room is not reported missing');
  const direct=await registeredStudioHtml({operatorId:'b',roomId:'other',mode:'room',section:'appearance'});
  assert.match(direct,/data-room-editor="other"/);assert.match(direct,/data-operator="b"/);
  const archived=await registeredStudioHtml({operatorId:'a',roomId:'archived',mode:'room',section:'appearance'});
  assert.doesNotMatch(archived,/data-room-editor=/);assert.equal(roleCount(archived,'alert'),1);
});

test('archiving the open room leaves the editor for the company\'s room list through the shared history',async()=>{
  const h=await mountRegisteredStudio({operatorId:'a',roomId:'bj',mode:'room',section:'state'});
  const reader=()=>walk(h.render(),node=>node.props?.kind==='rooms')[0];
  const before=h.notifications;
  for(const room of [{id:'bj',operatorId:'b',archivedAt:'2026-10-13T00:00:00Z'},{id:'roulette',operatorId:'a',archivedAt:'2026-10-13T00:00:00Z'},{id:'bj',operatorId:'a',archivedAt:null}]){
    reader().props.onChanged(lifecycleSnapshot({rooms:[room]}));
    assert.equal(h.href,'/admin/rooms/bj','another room or another company\'s room never moves this editor');
  }
  assert.equal(h.notifications,before);
  reader().props.onChanged(lifecycleSnapshot({rooms:[{id:'bj',operatorId:'a',archivedAt:'2026-10-13T00:00:00Z'}]}));
  assert.equal(h.href,'/admin/companies/a?flik=spelbord');assert.equal(h.notifications,before+1);assert.equal(h.confirms,0);
});

test('dealer library opens without silently selecting a company, room or shared composition',()=>{
  const context=studioContext(catalog,project,{dealerId:'paow-v2',game:'blackjack',library:true});
  assert.equal(context.dealer.id,'paow-v2');
  assert.equal(context.operator,undefined);assert.equal(context.room,undefined);assert.equal(context.lane,undefined);
  assert.deepEqual(context.rooms,[]);
  const companyOnly=studioContext(catalog,project,{operatorId:'a',dealerId:'paow-v2',library:true});
  assert.equal(companyOnly.operator.id,'a');assert.equal(companyOnly.room,undefined);
  assert.deepEqual(companyOnly.rooms.map(row=>row.id),['bj','roulette']);
});

test('library context accepts only the explicitly selected room and its registered owner',()=>{
  const direct=studioContext(catalog,project,{roomId:'roulette',library:true});
  assert.equal(direct.operator.id,'a');assert.equal(direct.room.id,'roulette');assert.equal(direct.game,'roulette');
  for(const selection of [{operatorId:'a',roomId:'other'},{operatorId:'missing',roomId:'bj'},{operatorId:'a',roomId:'missing'},{operatorId:'a',roomId:'archived'}]){
    const context=studioContext(catalog,project,{...selection,dealerId:'paow-v2',library:true});
    assert.equal(context.room,undefined);assert.equal(context.lane,undefined);
    assert.equal(context.dealer.id,'paow-v2');
  }
});

test('the company nav lists only the owner\'s rooms and links each to its own room nav',async()=>{
  const html=await companiesPageHtml({page:'company',id:'a',search:'?flik=spelbord',compositions});
  assert.deepEqual([...new Set(hrefs(html).filter(href=>href.startsWith('/admin/rooms/')))],['/admin/rooms/bj?flik=utseende','/admin/rooms/roulette?flik=utseende']);
  assert.equal(hrefs(html).some(href=>/other|archived|operator=|\/control/.test(href)),false,'another company\'s room, the archive and query-selected owners stay out');
  assert.ok(hrefs(html).includes('/admin/companies/a?flik=spelbord&view=create'));assert.doesNotMatch(html,/data-registered-studio=/,'room creation opens only on request');
  assert.match(await companiesPageHtml({page:'company',id:'a',search:'?flik=spelbord&view=create',compositions}),/data-registered-studio="create:a::"/);
  assert.match(await companiesPageHtml({page:'company',id:'a',search:'?flik=tilldelning',compositions}),/data-registered-studio="package:a::"/);
  const other=await companiesPageHtml({page:'company',id:'b',search:'?flik=spelbord',compositions});
  assert.deepEqual([...new Set(hrefs(other).filter(href=>href.startsWith('/admin/rooms/')))],['/admin/rooms/other?flik=utseende']);
  const missing=await companiesPageHtml({page:'company',id:'missing',search:'?flik=spelbord',compositions});
  assert.match(missing,/data-not-found="company"/,'the page states that the company is not registered');assert.doesNotMatch(other,/data-not-found=/,'a known company is not reported missing');assert.doesNotMatch(missing,/data-registered-studio=|\/admin\/rooms\//);
  const filtered=await companiesPageHtml({page:'companies',search:'?tab=spelbord&operator=a',compositions});
  assert.deepEqual([...new Set(hrefs(filtered).filter(href=>href.startsWith('/admin/rooms/')))],['/admin/rooms/bj?flik=utseende','/admin/rooms/roulette?flik=utseende'],'the room list filters by company');
});

test('saved room bookmarks land on the room nav with their owner, room and fragment',()=>{
  // The old /admin/rooms editor query becomes the room nav path; table, composition, game and the dealer selection leave
  // the address, the company stays as context and the fragment follows (packages/navigation/admin-workspace-routes.mjs).
  assert.equal(adminDocumentHref('/admin/rooms?operator=a&table=roulette&dealer=astrid&tag=a&tag=b#choices'),'/admin/rooms/roulette?operator=a&tag=a&tag=b#choices');
  assert.equal(adminDocumentHref('/admin/rooms?operator=a&table=other&composition=three&game=blackjack#choices'),'/admin/rooms/other?operator=a#choices','the nav resolves the registered owner, never the bookmarked one');
  assert.equal(adminDocumentHref('/admin/rooms?operator=a'),'/admin/companies?tab=spelbord&operator=a');
  assert.equal(adminDocumentHref('/admin/rooms?table=one&table=two'),'/admin/companies?tab=spelbord&table=one&table=two','an ambiguous room opens the list');
  assert.equal(adminDocumentHref('/admin/rooms/roulette?flik=spel'),'/admin/rooms/roulette?flik=spel','the room nav is canonical');
});

test('beforeunload guards drafts and writes in the layer editor and the game settings alike',async()=>{
  for(const section of ['appearance','game']){
    const h=await mountRegisteredStudio({operatorId:'a',roomId:'bj',mode:'room',section});
    const editor=()=>walk(h.render(),node=>section==='appearance'?node.props?.apiBase==='/studio/api/partner':node.props?.roomName!==undefined)[0];
    const unload=()=>{const event={prevented:false,returnValue:undefined,preventDefault(){this.prevented=true;}};h.listeners.get('beforeunload')(event);return event;};
    assert.equal(unload().prevented,false,section);
    editor().props.onDirtyChange(true);h.render();
    const guarded=unload();assert.equal(guarded.prevented,true,section);assert.equal(guarded.returnValue,'');
    editor().props.onDirtyChange(false);editor().props.onBusyChange(true);h.render();
    assert.equal(unload().prevented,true,section+': a write in flight is guarded like a draft');
    editor().props.onBusyChange(false);h.render();assert.equal(unload().prevented,false,section);
    assert.equal(h.confirms,0);assert.equal(editor().props.roomId,'bj');
  }
});

test('the assignment publishes the acknowledged company package with the lifecycle revision and re-reads it',async()=>{
  const requests=[];let reply;
  const catalogResponse=()=>registry({operators:catalog.administration.operators.map(row=>({...row,name:row.id,slug:row.id,packageRevision:4})),compositions});
  const fetcher=async(url,options={})=>{if(options.method==='POST'){requests.push({url,body:JSON.parse(options.body)});return new Promise(resolve=>{reply=resolve;});}return Response.json(catalogResponse());};
  const h=await mountRegisteredStudio({operatorId:'a',mode:'package'},{fetch:fetcher});
  const reader=()=>walk(h.render(),node=>node.props?.kind==='rooms')[0];
  const submit=()=>walk(h.render(),node=>node.type==='button'&&node.props.type==='submit')[0];
  const checkbox=id=>walk(h.render(),node=>node.type==='input'&&node.props.value===id)[0];
  const status=()=>formStatus(h.render());
  assert.equal(submit().props.disabled,true,'no package baseline before the lifecycle readback');const needsReadback=status();assert.ok(needsReadback);
  reader().props.onChanged(lifecycleSnapshot());
  assert.equal(checkbox('one').props.checked,true);assert.equal(checkbox('two').props.checked,false);const ready=status();assert.notEqual(ready,needsReadback);
  checkbox('two').props.onChange({target:{checked:true}});const unpublished=status();assert.notEqual(unpublished,ready);assert.notEqual(unpublished,needsReadback);
  reader().props.onBusyChange(true);h.render();assert.equal(submit().props.disabled,true,'a lifecycle write in flight locks the form');
  reader().props.onBusyChange(false);h.render();assert.equal(submit().props.disabled,false);
  const form=walk(h.render(),node=>node.type==='form')[0];
  const refreshBefore=reader().props.refreshKey;
  form.props.onSubmit({preventDefault(){}});
  await settle(1);
  assert.deepEqual(requests.map(row=>row.body),[{operatorId:'a',lanes:['one','two'],expectedPackageRevision:4}]);
  assert.match(requests[0].url,/\/api\/admin\/operator-package$/);
  assert.equal(submit().props.disabled,true,'the write locks the form');assert.equal(reader().props.disabled,true,'the write locks the lifecycle');
  reply(Response.json({ok:true,operatorId:'a',packageRevision:5,package_revision:5,lanes:['one','two']}));
  await settle(2);
  const published=status();assert.match(published,/\b5\b/);assert.equal(reader().props.refreshKey,refreshBefore+1,'the lifecycle re-reads the new package');
  reader().props.onChanged(lifecycleSnapshot({operators:lifecycleSnapshot().operators.map(row=>row.id==='a'?{...row,packageRevision:5,lanes:['one','two']}:row)}));
  assert.equal(checkbox('two').props.checked,true);assert.equal(status(),published);
  // An uncertain lifecycle demands a fresh read before the next write; the button asks the reader again.
  reader().props.onRefreshNeeded();h.render();
  assert.equal(status(),needsReadback);assert.equal(submit().props.disabled,true);
  const section=walk(h.render(),node=>node.type==='section'&&node.props?.id==='room-publication')[0];
  walk(walk(section,node=>node.type==='p'&&node.props?.role==='status')[0],node=>node.type==='button')[0].props.onClick();h.render();
  assert.equal(reader().props.refreshKey,refreshBefore+2);
});

test('a lifecycle write in flight and an unconfirmed publish receipt keep the company package unpublished',async()=>{
  const requests=[];
  const fetcher=async(url,options={})=>{if(options.method==='POST'){requests.push(JSON.parse(options.body));return Response.json({ok:true,operatorId:'b',packageRevision:5,lanes:['one']});}
    return Response.json(registry({operators:catalog.administration.operators.map(row=>({...row,name:row.id,slug:row.id,packageRevision:4})),compositions}));};
  const h=await mountRegisteredStudio({operatorId:'a',mode:'package'},{fetch:fetcher});
  const reader=()=>walk(h.render(),node=>node.props?.kind==='rooms')[0];
  reader().props.onChanged(lifecycleSnapshot());
  const form=()=>walk(h.render(),node=>node.type==='form')[0],checkbox=id=>walk(h.render(),node=>node.type==='input'&&node.props.value===id)[0];
  reader().props.onRefreshNeeded();h.render();const needsReadback=formStatus(h.render());reader().props.onChanged(lifecycleSnapshot());
  reader().props.onBusyChange(true);h.render();
  form().props.onSubmit({preventDefault(){}});await settle(1);
  assert.equal(requests.length,0,'a lifecycle write in flight blocks the package publication');
  reader().props.onBusyChange(false);h.render();
  checkbox('two').props.onChange({target:{checked:true}});
  form().props.onSubmit({preventDefault(){}});await settle(2);
  assert.equal(requests.length,1);
  const html=renderToStaticMarkupOf(h);
  assert.ok(shows(html,PACKAGE_RECEIPT_MISMATCH),'a foreign receipt never confirms this company');
  assert.equal(checkbox('two').props.checked,true,'the draft selection is preserved');
  assert.equal(formStatus(h.render()),needsReadback);
  form().props.onSubmit({preventDefault(){}});await settle(1);
  assert.equal(requests.length,1,'an unconfirmed package requires readback before the next write');
});

test('the room status shows published materials only for the selected room and clears stale status',async()=>{
  const h=await mountRegisteredStudio({operatorId:'a',roomId:'bj',mode:'room',section:'appearance'},{compositions});
  const editor=()=>walk(h.render(),node=>node.props?.apiBase==='/studio/api/partner')[0];
  const publishedMaterials=()=>walk(h.render(),node=>node.type==='dl'&&node.props?.['aria-label']==='Publicerat nu')
    .flatMap(region=>walk(region,node=>node.type==='dd')).map(node=>[node.props.children].flat(Infinity).join(''));
  assert.deepEqual(publishedMaterials(),[]);
  editor().props.onStatus({roomId:'bj',packageRevision:7,draftRevision:2,draft:true,live:{background:null,dealer:'astrid',table:'table-1'},labels:{background:'Standard',dealer:'Astrid',table:'Grön filt'}});
  assert.deepEqual(publishedMaterials(),['– · Astrid · Grön filt'],'an unpublished background is not presented as live while a draft exists');
  editor().props.onStatus({roomId:'bj',packageRevision:7,draftRevision:2,draft:false,live:{background:'bg',dealer:'astrid',table:'table-1'},labels:{background:'Salong',dealer:'Astrid',table:'Grön filt'}});
  assert.deepEqual(publishedMaterials(),['Salong · Astrid · Grön filt']);
  editor().props.onStatus({roomId:'other',packageRevision:9,draftRevision:0,draft:false,live:{background:'foreign',dealer:'paow-v2',table:'other-table'},labels:{background:'Annat bolag',dealer:'Paow',table:'Annat bord'}});
  assert.deepEqual(publishedMaterials(),[],'a delayed status from another room cannot describe this room');
  editor().props.onStatus({roomId:'bj',packageRevision:7,draftRevision:2,draft:false,live:{background:'bg',dealer:'astrid',table:'table-1'},labels:{background:'Salong',dealer:'Astrid',table:'Grön filt'}});
  assert.deepEqual(publishedMaterials(),['Salong · Astrid · Grön filt']);
  editor().props.onStatus(null);assert.deepEqual(publishedMaterials(),[]);
});
// Publication proofs for the company package under Bolag › Tilldelning. They were first written for the retired
// publication page (/admin/publication) and follow the same operator-package contract.
const packageOperators=change=>lifecycleSnapshot({operators:lifecycleSnapshot().operators.map(row=>row.id==='a'?{...row,...change}:row)});
async function publicationHarness({props={operatorId:'a',mode:'package'},dealerIds=['astrid'],project=null}={}){
  const requests=[],replies=[],extraRooms=[];
  const value=()=>registry({operators:catalog.administration.operators.map(row=>({...row,name:row.id,slug:row.id,packageRevision:row.id==='a'?4:null})),
    rooms:[...catalog.administration.rooms,...extraRooms].map(row=>registryRoom({...row,dealerIds:[...dealerIds]})),compositions});
  const fetcher=async(url,options={})=>{
    if(options.method!=='POST')return project&&/\/api\/project$/.test(url)?Response.json({project}):Response.json(value());
    requests.push({url,body:JSON.parse(options.body)});
    const next=replies.shift();
    return typeof next==='function'?next():next??Response.json({error:'studio_conflict'},{status:409});
  };
  const h=await mountRegisteredStudio(props,{fetch:fetcher});
  return {h,requests,replies,settle,addRoom:room=>extraRooms.push(room),
    lifecycle:()=>walk(h.render(),node=>node.props?.kind==='rooms')[0],
    submit:()=>walk(h.render(),node=>node.type==='button'&&node.props.type==='submit')[0],
    checkbox:id=>walk(h.render(),node=>node.type==='input'&&node.props.value===id)[0],
    status:()=>formStatus(h.render()),
    html:()=>renderToStaticMarkupOf(h),
    async publish(){walk(h.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});await settle();}};
}

test('a package conflict keeps the company draft and blocks every further write until the lifecycle readback',async()=>{
  const p=await publicationHarness();const needsReadback=p.status();
  p.lifecycle().props.onChanged(lifecycleSnapshot());
  p.checkbox('two').props.onChange({target:{checked:true}});const unpublished=p.status();
  let conflict;p.replies.push(()=>new Promise(resolve=>{conflict=resolve;}));
  const form=walk(p.h.render(),node=>node.type==='form')[0];
  form.props.onSubmit({preventDefault(){}});form.props.onSubmit({preventDefault(){}});await p.settle();
  assert.equal(p.requests.length,1,'the write lock admits one request');
  assert.deepEqual(p.requests[0].body,{operatorId:'a',lanes:['one','two'],expectedPackageRevision:4});
  assert.match(p.requests[0].url,/\/api\/admin\/operator-package$/);
  conflict(Response.json({error:'studio_conflict'},{status:409}));await p.settle();
  assert.ok(shows(p.html(),packagePublishError(409,{error:'studio_conflict'})));
  assert.equal(p.checkbox('two').props.checked,true,'the draft selection survives the conflict');
  assert.equal(p.status(),needsReadback);assert.equal(p.submit().props.disabled,true);
  await p.publish();assert.equal(p.requests.length,1,'no automatic retry and no write before readback');
  p.lifecycle().props.onChanged(packageOperators({packageRevision:5,lanes:['one']}));
  assert.equal(p.checkbox('two').props.checked,true,'the addition is rebased onto the newer package');
  assert.equal(p.status(),unpublished);
  p.replies.push(Response.json({ok:true,operatorId:'a',packageRevision:6,lanes:['one','two']}));
  await p.publish();
  assert.deepEqual(p.requests[1].body,{operatorId:'a',lanes:['one','two'],expectedPackageRevision:5},'the read-back revision is the new CAS precondition');
  assert.match(p.status(),/\b6\b/);
});

test('each company publishes with its own revision; a new package sends null and drafts stay per company',async()=>{
  const p=await publicationHarness();
  p.lifecycle().props.onChanged(lifecycleSnapshot());
  const publishedChip=revisionChip(p.h.render());
  p.checkbox('two').props.onChange({target:{checked:true}});const unpublished=p.status();
  // The company nav swaps the company on the same mount; every company keeps its own draft.
  p.h.setProps({operatorId:'b'});
  assert.equal(p.checkbox('one').props.checked,false);assert.equal(p.checkbox('two').props.checked,false);
  assert.equal(p.submit().props.disabled,true,'an empty selection cannot be published');
  assert.doesNotMatch(revisionChip(p.h.render()),/\d/,'a company without a package shows no version');assert.notEqual(revisionChip(p.h.render()),publishedChip);
  p.checkbox('one').props.onChange({target:{checked:true}});
  p.replies.push(Response.json({ok:true,operatorId:'b',packageRevision:1,lanes:['one']}));
  await p.publish();
  assert.deepEqual(p.requests.map(row=>row.body),[{operatorId:'b',lanes:['one'],expectedPackageRevision:null}]);
  assert.match(p.status(),/\b1\b/);
  p.h.setProps({operatorId:'a'});
  assert.equal(p.checkbox('two').props.checked,true,'company a keeps its unpublished draft');
  assert.equal(p.status(),unpublished);
  p.replies.push(Response.json({ok:true,operatorId:'a',packageRevision:5,lanes:['one','two']}));
  await p.publish();
  assert.deepEqual(p.requests[1].body,{operatorId:'a',lanes:['one','two'],expectedPackageRevision:4},'company a still sends its own displayed revision');
});

test('unconfirmed publish receipts keep every local addition and removal and block another write until readback',async()=>{
  const receipt=()=>({ok:true,operatorId:'a',packageRevision:5,package_revision:5,lanes:['two']});
  const invalid=[
    ['missing receipt',()=>null],['missing success',row=>{delete row.ok;return row;}],['failed success',row=>({...row,ok:false})],
    ['foreign company',row=>({...row,operatorId:'b'})],['missing choices',row=>{delete row.lanes;return row;}],
    ['different choices',row=>({...row,lanes:['one']})],['duplicate choices',row=>({...row,lanes:['two','two']})],
    ['stale revision',row=>({...row,packageRevision:4,package_revision:4})],['skipped revision',row=>({...row,packageRevision:999,package_revision:999})],
    ['string revision',row=>({...row,packageRevision:'5',package_revision:'5'})],['conflicting revisions',row=>({...row,package_revision:6})],
  ];
  for(const [name,change] of invalid){
    const p=await publicationHarness();const needsReadback=p.status();
    p.lifecycle().props.onChanged(lifecycleSnapshot());
    p.checkbox('one').props.onChange({target:{checked:false}});p.checkbox('two').props.onChange({target:{checked:true}});const unpublished=p.status();
    p.replies.push(Response.json(change(receipt())));
    await p.publish();
    assert.equal(p.requests.length,1,name);
    assert.ok(shows(p.html(),PACKAGE_RECEIPT_MISMATCH),name);assert.equal(shows(p.html(),publishedPackageMessage(5)),false,name);
    assert.equal(p.checkbox('one').props.checked,false,name);assert.equal(p.checkbox('two').props.checked,true,name);
    assert.equal(p.status(),needsReadback,name);
    await p.publish();assert.equal(p.requests.length,1,name+' stays locked until readback');
    p.lifecycle().props.onChanged(lifecycleSnapshot());
    assert.equal(p.checkbox('one').props.checked,false,name+' preserves the removal after readback');
    assert.equal(p.checkbox('two').props.checked,true,name+' preserves the addition after readback');
    assert.equal(p.status(),unpublished,name);
  }
});

test('the exact receipt accepts server-sorted choices and clears the draft; a newer package readback withdraws the confirmation',async()=>{
  const p=await publicationHarness();
  p.lifecycle().props.onChanged(lifecycleSnapshot());const ready=p.status();
  p.checkbox('two').props.onChange({target:{checked:true}});
  p.replies.push(Response.json({ok:true,operatorId:'a',packageRevision:5,package_revision:5,lanes:['two','one']}));
  await p.publish();
  assert.deepEqual(p.requests[0].body.lanes,['one','two']);
  const receipt=()=>shows(p.html(),publishedPackageMessage(5));
  assert.ok(receipt());
  assert.match(p.status(),/\b5\b/);assert.match(revisionChip(p.h.render()),/\b5\b/);
  p.lifecycle().props.onChanged(packageOperators({packageRevision:5,lanes:['one','two']}));
  assert.ok(receipt(),'the same revision keeps this receipt');
  p.lifecycle().props.onChanged(packageOperators({packageRevision:6,lanes:['one','two']}));
  assert.equal(receipt(),false,'a different revision is not this action receipt');
  assert.match(revisionChip(p.h.render()),/\b6\b/);assert.equal(p.status(),ready);
});

test('a room creation receipt advances the company package, re-reads the lifecycle and opens the new room nav',async()=>{
  const p=await publicationHarness({props:{operatorId:'a',mode:'create'}});
  p.lifecycle().props.onChanged(lifecycleSnapshot());
  const label=id=>{const option=walk(p.h.render(),node=>node.type==='option'&&node.props.value===id)[0];return [option.props.children].flat(Infinity).join('');};
  const name=id=>compositions.find(row=>row.id===id).name;
  assert.equal(label('one'),name('one'));assert.notEqual(label('two'),name('two'),'a template outside the published package says so');assert.ok(label('two').startsWith(name('two')));
  const create=walk(p.h.render(),node=>typeof node.props?.onCreated==='function')[0];
  assert.equal(walk(p.h.render(),node=>node.type==='form').length,0,'the create view carries no package form');
  const refreshBefore=p.lifecycle().props.refreshKey,notifications=p.h.notifications;
  p.addRoom({id:'created',operatorId:'a',game:'blackjack',compositionId:'two'});
  create.props.onCreated({packageRevision:5,room:{id:'created',operatorId:'a',presentationLaneId:'two',game:'blackjack'}});
  await p.settle();p.h.render();await p.settle();
  const refreshAfter=p.lifecycle().props.refreshKey;
  assert.ok(refreshAfter>refreshBefore,'the lifecycle re-reads after the room receipt');
  assert.equal(p.h.href,'/admin/rooms/created','the receipt opens the new room nav');assert.equal(p.h.notifications,notifications+1);assert.equal(p.h.confirms,0);
  assert.equal(p.requests.length,0,'the receipt itself writes nothing more');
  p.lifecycle().props.onChanged(packageOperators({packageRevision:5,lanes:['one','two']}));
  assert.equal(p.lifecycle().props.refreshKey,refreshAfter,'a readback does not request itself again');
  assert.equal(label('two'),name('two'),'the read-back package labels the new template as published');
  p.lifecycle().props.onChanged(lifecycleSnapshot());
  assert.equal(label('two'),name('two'),'an older snapshot cannot roll the package editor back');
});

test('unsaved Studio work blocks the company publication until it is saved',async()=>{
  const p=await publicationHarness({props:{operatorId:'a',mode:'package',disabled:true}});
  p.lifecycle().props.onChanged(lifecycleSnapshot());
  const free=await publicationHarness();free.lifecycle().props.onChanged(lifecycleSnapshot());
  assert.notEqual(p.status(),free.status(),'the status says why the publication waits');assert.equal(p.submit().props.disabled,true);
  await p.publish();assert.equal(p.requests.length,0);
});

test('an assigned scene template showing an AI table drawn for another dealer stops the company publish before the request',async()=>{
  const {aiImageLabel}=await import('../../../lib/ai-image-contract.mjs');
  const table={id:'t1',role:'table',label:aiImageLabel('Grön filt',{dealerId:'paow',placement:'0123abcd'})};
  const lane=(id,dealers,tables)=>({id,dealers,layers:{table:{enabled:true,default:tables[0]??null,allowed:tables}}});
  const p=await publicationHarness({project:{lanes:[lane('one',['astrid'],['t1']),lane('two',['astrid'],[])],layerAssets:[table]}});
  p.lifecycle().props.onChanged(lifecycleSnapshot());
  p.checkbox('two').props.onChange({target:{checked:true}});
  await p.publish();
  assert.equal(p.requests.length,0,'nothing is sent while a chosen template shows the misfit');
  assert.ok(shows(p.html(),aiTableMisfitMessage({code:'ai_table_other_dealer'})),'the shared misfit reason is shown');assert.equal(roleCount(p.html(),'alert'),1);
  assert.equal(p.checkbox('two').props.checked,true,'the draft selection is kept');
  p.checkbox('one').props.onChange({target:{checked:false}});
  p.replies.push(Response.json({ok:true,operatorId:'a',packageRevision:5,lanes:['two']}));
  await p.publish();
  assert.deepEqual(p.requests.map(row=>row.body),[{operatorId:'a',lanes:['two'],expectedPackageRevision:4}],'a template without the misfit publishes as before');
});

test('a composition removed from Studio stays visible in the package and blocks publication until it is unchecked',async()=>{
  const p=await publicationHarness();
  p.lifecycle().props.onChanged(packageOperators({lanes:['one','retired']}));
  const retired=walk(p.h.render(),node=>node.type==='label'&&walk(node,child=>child.type==='input'&&child.props.value==='retired').length)[0];
  assert.equal(p.checkbox('retired').props.checked,true);assert.ok(textOf(retired).trim(),'the removed template stays visible with an explanation');assert.doesNotMatch(textOf(retired),/retired/,'it is named in plain words, not by id');
  assert.equal(p.submit().props.disabled,true);const blocked=p.status();
  await p.publish();assert.equal(p.requests.length,0);
  p.checkbox('retired').props.onChange({target:{checked:false}});
  assert.notEqual(p.status(),blocked);assert.equal(p.submit().props.disabled,false);
  p.replies.push(Response.json({ok:true,operatorId:'a',packageRevision:5,lanes:['one']}));
  await p.publish();
  assert.deepEqual(p.requests[0].body,{operatorId:'a',lanes:['one'],expectedPackageRevision:4});
});

test('a removed composition never blocks the PAOW idle refresh, which publishes against the frozen package',async()=>{
  const p=await publicationHarness({props:{operatorId:'a',roomId:'bj',mode:'room',section:'appearance'},dealerIds:['astrid','paow']});
  p.lifecycle().props.onChanged(packageOperators({lanes:['one','retired']}));
  const later=()=>walk(p.h.render(),node=>node.type==='details')[0];
  const paow=()=>walk(later(),node=>node.type==='button')[0];
  assert.equal(paow().props.disabled,false,'refresh-dealer-idle uses the frozen package, never Studio lanes');
  assert.equal(walk(p.h.render(),node=>node.type==='form').length,0,'the room editor carries no package form; the blocked assignment stays on its own tab');
  assert.ok(later(),'the interim publication lives in its own disclosure');
  p.replies.push(Response.json({ok:true,operatorId:'a',packageRevision:5,lanes:['one','retired'],idleRefreshed:{dealerId:'paow',roomId:'bj'}}));
  paow().props.onClick();await p.settle();
  assert.deepEqual(p.requests.map(row=>row.body),[{action:'refresh-dealer-idle',operatorId:'a',roomId:'bj',dealerId:'paow',expectedPackageRevision:4}]);
  assert.match(textOf(walk(later(),node=>node.props?.role==='status')),/\b5\b/,'the receipt names the new version');
  assert.equal(p.lifecycle().props.refreshKey,1,'the receipt re-reads the lifecycle');
  // The frozen package is the precondition: the next refresh waits for the readback.
  p.replies.push(Response.json({ok:true,operatorId:'a',packageRevision:6,lanes:['one','retired'],idleRefreshed:{dealerId:'paow',roomId:'bj'}}));
  paow().props.onClick();await p.settle();
  assert.deepEqual(p.requests.slice(1).map(row=>row.body),[{action:'refresh-dealer-idle',operatorId:'a',roomId:'bj',dealerId:'paow',expectedPackageRevision:5}]);
});
