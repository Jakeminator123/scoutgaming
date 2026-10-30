import test from 'node:test';
import assert from 'node:assert/strict';
import {studioContext} from './studio-context.mjs';
import * as reactDomServer from 'react-dom/server';
import {adminDocumentHref} from '../../../../../packages/navigation/admin-workspace-routes.mjs';
import {PACKAGE_RECEIPT_MISMATCH,packagePublishError,publishedPackageMessage} from '../../../lib/operator-package-client.mjs';
import {aiTableMisfitMessage} from '../../../lib/ai-image-contract.mjs';
import {assignmentPublishError} from '../../../lib/operator-assignment-client.mjs';
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
    fetch:customFetch??(async()=>Response.json(value)),require:name=>name==='react'?hooks.react:name==='../ui/kit'?{cn:(...names)=>names.filter(Boolean).join(' '),buttonVariants:()=>'button',TechnicalDetails:props=>React.createElement('details',null,React.createElement('summary',null,props.title),props.children)}
      :name.includes('partner-appearance-loader.mjs')?{PartnerAppearanceLoader:props=>React.createElement('section',{'data-room-editor':props.roomId,'data-operator':props.operatorId,'data-room-layout':props.roomLayout,'data-admin-choices':String(Boolean(props.adminChoices)),'data-disabled':String(Boolean(props.disabled))},props.children)}:name==='../../../runtime/navigation'?{useSearchParams:()=>new URLSearchParams(currentSearch)}:name.endsWith('studio-history.mjs')?historyModule:name.includes('connected-studio.mjs')?{navigationKeepsStudioTab:()=>false}:name.includes('studio-resource-lifecycle.mjs')?lifecycle
      :name.endsWith('components/control-resource-lifecycle')?{ControlResourceLifecycle:stub('data-lifecycle',props=>props.kind)}:name.endsWith('components/room-game-config')?{RoomGameConfig:stub('data-game-config',props=>props.roomId)}
      :name==='./dealer-identity-portrait'?portraitStubs(React)
      :name==='./assignment-field'?{AssignmentField:props=>React.createElement('section',{'data-assignment-field':String(props.revision??'none')})}
      :name==='./room-release'?{RoomRelease:props=>React.createElement('section',{'data-room-release':props.roomId,'data-eligible':String(Boolean(props.eligible)),'data-blocked-by':props.blockedBy??''})}
      :name.startsWith('.')?componentRequire(name):require(name)});
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
async function companiesPageHtml({page,id,search='',previews=false,fetchImpl=null,dialog=null,...overrides}){
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
  const componentRequire=createRequire(new URL('../components/studio/companies-page.tsx',import.meta.url));
  const path=page==='companies'?'/admin/companies':page==='company'?'/admin/companies/'+id:'/admin/rooms/'+id;
  const navigation={__esModule:true,default:props=>React.createElement('a',props),usePathname:()=>path,useSearchParams:()=>new URLSearchParams(search)};
  const adminNavigation=await import('../../../../../packages/navigation/admin-navigation.mjs');
  const value=registry(overrides),hooks=fakeHooks(React);
  const compile=(file,resolve)=>{const module={exports:{}};runInNewContext(transformSync(readFileSync(new URL(file,import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
    {module,exports:module.exports,URLSearchParams,URL,AbortController,fetch:fetchImpl??(async()=>Response.json(value)),document:{addEventListener:()=>{},removeEventListener:()=>{}},require:resolve});return module.exports;};
  const ui={},uiRequire=name=>name.endsWith('runtime/navigation')?navigation:name.startsWith('./')?(ui[name]??=compile('../components/ui/'+name.slice(2)+'.tsx',uiRequire)):require(name);
  // `previews` opens the preview panel and shows which revision each preview receives.
  const hub={...compile('../components/ui/hub.tsx',uiRequire),...(previews?{PreviewFlyout:props=>React.createElement('aside',{'data-flyout':props.title},props.children)}:{})};
  const stub=(tag,pick)=>props=>React.createElement('section',{[tag]:pick(props)});
  const preview=tag=>previews?props=>React.createElement('section',{[tag]:props.laneId??props.presentationLaneId,'data-revision':props.revision??'none'}):()=>null;
  const module=compile('../components/studio/companies-page.tsx',name=>name==='react'?hooks.react:name.endsWith('runtime/navigation')?navigation:name==='../ui/hub'?hub:name==='../../lib/admin-navigation'?adminNavigation
    :name==='./registered-studio'?{RegisteredStudio:props=>React.createElement('section',{'data-registered-studio':[props.mode,props.operatorId,props.roomId??'',props.section??''].join(':'),'data-assignment-revision':String(props.assignmentRevision??'none')},props.navigation,props.children)}
    :name==='./workspace-tools'?{WorkspaceTool:stub('data-workspace-tool',props=>props.section)}:name==='./saved-scene-preview'?{SavedScenePreview:preview('data-saved-scene')}:name==='./scene-preview'?{ScenePreview:preview('data-scene-preview')}
    :name.endsWith('control-resource-lifecycle')?{ControlResourceLifecycle:stub('data-lifecycle',props=>props.kind)}:name.endsWith('partner-journal-loader.mjs')?{PartnerJournal:stub('data-journal',props=>props.operatorId)}
    :name==='./dealer-identity-portrait'?portraitStubs(React):name==='./room-picture'?{RoomPicture:()=>null}:name==='./permanent-delete'?{TrashPermanentDelete:()=>null}
    :name==='./room-settings-warning'?compile('../components/studio/room-settings-warning.tsx',dep=>dep.endsWith('runtime/navigation')?navigation:dep.startsWith('../ui/')?uiRequire('./'+dep.slice('../ui/'.length)):require(dep))
    :name.startsWith('../ui/')?uiRequire('./'+name.slice('../ui/'.length)):name.startsWith('.')?componentRequire(name):require(name));
  // `dialog` renders Nytt spelbord itself (its hooks run in the fake renderer, as the page's do).
  const render=()=>{hooks.reset();const tree=dialog?module.CreateRoomDialog(dialog):module.CompaniesPage({page,id,active:true,disabled:false,onChanged(){}});hooks.flush();return tree;};
  render();await settle(1);
  // A stubbed fetch lets reads made after mount (Nytt spelbord) land before the final render.
  if(fetchImpl)for(let round=0;round<3;round++){render();await settle(6);}
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
  assert.doesNotMatch(packageHtml,/data-room-create=|data-room-editor=|data-game-config=/,'the assignment mounts no room editor');
  assert.match(packageHtml,/data-lifecycle="rooms"/,'the assignment reads the published package through the rooms lifecycle');
  assert.equal(walk(h.render(),node=>node.type==='button'&&node.props.type==='submit').length,1,'the assignment has one publish action');
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

test('an active company without registered rooms still shows its assignment in Admin',async()=>{
  const html=await registeredStudioHtml({operatorId:'b',mode:'package'},{rooms:[],compositions});
  assert.equal(hrefs(html).some(href=>href.startsWith('/admin/publication')),false);
  assert.match(html,/aria-label="Tilldelning"/);assert.doesNotMatch(html,/data-room-create=|data-room-editor=|data-game-config=/);
});

test('partner and template links are scoped to the selected owner and never carry another company or its room',async()=>{
  const own=await registeredStudioHtml({operatorId:'a',mode:'package'},{compositions});
  assert.ok(hrefs(own).includes('/partner/a/rooms'));
  assert.equal(hrefs(own).some(href=>href.includes('operator=b')||href.includes('/partner/b')||href.startsWith('/control')),false);
  const other=await registeredStudioHtml({operatorId:'b',mode:'package'},{compositions});
  assert.ok(hrefs(other).includes('/partner/b/rooms'));assert.equal(hrefs(other).some(href=>href.includes('/partner/a')||href.includes('operator=a')),false);
  const empty=await registeredStudioHtml({operatorId:'b',mode:'package'},{compositions:[]});
  assert.ok(hrefs(empty).includes('/admin/scenes?tab=miljoer'),'without templates the assignment points to Miljöer');
  for(const section of ['appearance','state']){
    const foreign=await registeredStudioHtml({operatorId:'a',roomId:'other',mode:'room',section},{compositions});
    assert.equal(hrefs(foreign).some(href=>/rooms\?room=|\/partner\//.test(href)),false,'a cross-owner room never becomes this company\'s partner context');
  }
});

test('the rooms lifecycle gets scene template links without the game or owner of another room',async()=>{
  const h=await mountRegisteredStudio({operatorId:'a',roomId:'bj',mode:'room',section:'state'},{compositions});
  const navigation=walk(h.render(),node=>node.props?.kind==='rooms')[0].props.navigation;
  assert.equal(typeof navigation.rehearsalLabel,'string');assert.ok(navigation.rehearsalLabel);
  assert.equal(navigation.compositionHref({id:'a'},{id:'bj',presentationLaneId:'one'}),'/admin/scenes?tab=miljoer&composition=one&table=bj');
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

// Preview 29 Oct 2026: an open room without published game settings stood "öppet · publicerat". The room page
// warns with a link to Spelinställningar, and the list's state reads "förbereds" with the same reason.
test('an open room without published game settings is marked in the room page and the room list, with a link to its settings',async()=>{
  const missing=registryRoom({...catalog.administration.rooms[0],settingsMissing:true}),others=catalog.administration.rooms.slice(1).map(registryRoom);
  const reason='Saknar spelinställningar – spelare kan inte sätta sig';
  const page=await companiesPageHtml({page:'room',id:'bj',search:'?flik=utseende',compositions,rooms:[missing,...others]});
  assert.ok(shows(page,reason));assert.ok(hrefs(page).includes('/admin/rooms/bj?flik=spel'));assert.match(page,/>förbereds</);assert.doesNotMatch(page,/>öppet</);
  assert.match(page,/data-room-settings-missing=""/);
  assert.doesNotMatch(await companiesPageHtml({page:'room',id:'bj',search:'?flik=spel',compositions,rooms:[missing,...others]}),/data-room-settings-missing=/,'the settings tab itself is where they are published');
  const list=await companiesPageHtml({page:'companies',search:'?tab=spelbord',compositions,rooms:[missing,...others]});
  assert.ok(shows(list,reason));assert.ok(hrefs(list).includes('/admin/rooms/bj?flik=spel'));
  const ready=await companiesPageHtml({page:'room',id:'bj',search:'?flik=utseende',compositions});
  assert.equal(shows(ready,reason),false);assert.match(ready,/>öppet</);
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

// "Provspela sparad scen" needs the saved project revision; without it the button is always disabled.
test('the room preview hands the saved project revision to the saved-scene preview',async()=>{
  const room=await companiesPageHtml({page:'room',id:'bj',search:'?flik=utseende',compositions,previews:true});
  assert.match(room,/data-(?:scene-preview|saved-scene)="[^"]+" data-revision="p1"/,'the room preview receives the catalog project revision');
  assert.doesNotMatch(room,/data-revision="none"/);
});

test('the company nav lists only the owner\'s rooms and links each to its own room nav',async()=>{
  const html=await companiesPageHtml({page:'company',id:'a',search:'?flik=spelbord',compositions});
  assert.deepEqual([...new Set(hrefs(html).filter(href=>href.startsWith('/admin/rooms/')))],['/admin/rooms/bj?flik=utseende','/admin/rooms/roulette?flik=utseende']);
  assert.equal(hrefs(html).some(href=>/other|archived|operator=|\/control/.test(href)),false,'another company\'s room, the archive and query-selected owners stay out');
  assert.ok(hrefs(html).includes('/admin/companies/a?flik=spelbord&view=create'));assert.doesNotMatch(html,/data-registered-studio=/,'room creation opens only on request');
  const assigned=await companiesPageHtml({page:'company',id:'a',search:'?flik=tilldelning',compositions});
  assert.match(assigned,/data-registered-studio="package:a::"/);
  // Bolag › Tilldelat lives in the assignment form with the company's published revision, not beside it.
  assert.match(assigned,/data-assignment-revision="1"/);assert.doesNotMatch(assigned,/data-assignment-field=/);
  const other=await companiesPageHtml({page:'company',id:'b',search:'?flik=spelbord',compositions});
  assert.deepEqual([...new Set(hrefs(other).filter(href=>href.startsWith('/admin/rooms/')))],['/admin/rooms/other?flik=utseende']);
  const missing=await companiesPageHtml({page:'company',id:'missing',search:'?flik=spelbord',compositions});
  assert.match(missing,/data-not-found="company"/,'the page states that the company is not registered');assert.doesNotMatch(other,/data-not-found=/,'a known company is not reported missing');assert.doesNotMatch(missing,/data-registered-studio=|\/admin\/rooms\//);
  const filtered=await companiesPageHtml({page:'companies',search:'?tab=spelbord&operator=a',compositions});
  assert.deepEqual([...new Set(hrefs(filtered).filter(href=>href.startsWith('/admin/rooms/')))],['/admin/rooms/bj?flik=utseende','/admin/rooms/roulette?flik=utseende'],'the room list filters by company');
});

// Nytt spelbord på ett steg (room-quick-create.mjs): standardvalen står i dialogen, Skapa och publicera kör kedjan
// och den gamla guiden (RegisteredStudio create, scenmallsval i två steg) finns inte kvar.
test('Nytt spelbord is one dialog with every choice preselected and one Skapa och publicera',async()=>{
  const {QUICK_CREATE_NO_DEALER}=await import('./room-quick-create.mjs');
  const {addDealer,createEmptyProject,defaultPresentationLane}=await import('../../../../../packages/presentation/contracts/studio-model.mjs');
  const lane=(id,label,dealerId)=>({...defaultPresentationLane(dealerId),id,label});
  const project={...addDealer(addDealer(createEmptyProject(),'astrid','Astrid'),'paow-v2','Paow'),revision:'p1',lanes:[lane('one','Standard','astrid'),lane('two','Kväll','paow-v2')]};
  const value=registry({compositions}),reads=[];
  const fetchImpl=async url=>{reads.push(String(url).split('?')[0]);return Response.json(String(url).startsWith('/studio/api/project')?{project}:String(url).startsWith('/studio/api/videos')?{videos:[]}:value);};
  const page=await companiesPageHtml({page:'company',id:'a',search:'?flik=spelbord&view=create',compositions});
  assert.doesNotMatch(page,/data-registered-studio=|data-saved-scene=/,'no second path: the guided template picker is gone');
  const operators=value.administration.operators;
  const html=await companiesPageHtml({page:'company',id:'a',compositions,fetchImpl,dialog:{open:true,operators:[operators[0]],initialOperator:'a',fixedOperator:true,disabled:false,onChanged(){},onClose(){}}});
  assert.ok(['/admin/_data/catalog','/studio/api/project','/studio/api/videos'].every(path=>reads.includes(path)));
  // Inga klipp: ingen dealer har hela klippbanken, så ingen förväljs (room-quick-create.test.mjs prövar förvalen).
  assert.match(html,new RegExp(QUICK_CREATE_NO_DEALER.slice(0,40)),'one sentence instead of a silent incomplete dealer');
  assert.match(html,/<option value="" selected="">Välj dealer<\/option>/);assert.match(html,/<button[^>]*disabled=""[^>]*>Skapa och publicera/,'nothing to create with');
  assert.match(html,/Paow · klippen räcker inte än/);assert.match(html,/Roulette · enkel nolla/);
  assert.match(html,/<option value="prive" selected="">/,'Privé is the bet profile');assert.match(html,/<option value="en" selected="">Engelska/);
  assert.match(html,/Skapa och publicera/);assert.match(html,/blir öppet/);assert.doesNotMatch(html,/skapas pausat|Nästa: välj scenmall/);
});

// Papperskorg (the kit's pilot, docs/plans/DESIGNSYSTEM.md): the tab names the state, so rows carry no trash
// chip; an empty list is an empty state, not a table with only its header; a room is restored in the side
// panel through the company's rooms lifecycle, never another company's.
test('Papperskorg shows the archive date and count instead of a status chip, and an empty state instead of an empty table',async()=>{
  const operators=[{id:'a',name:'Alfa',slug:'a',status:'active',archivedAt:null,packageRevision:1},{id:'z',name:'Zeta',slug:'z',status:'suspended',archivedAt:'2026-10-28T09:00:00Z',packageRevision:null}];
  const html=await companiesPageHtml({page:'companies',search:'?tab=papperskorg',operators,rooms:[registryRoom(catalog.administration.rooms[0])],compositions});
  assert.doesNotMatch(html.slice(html.indexOf('data-trash')),/>(?:i )?papperskorg(?:en)?</i,'no trash chip on a row under the Papperskorg tab');
  assert.ok(shows(html,'Arkiverat 28 okt. 2026 · 0 spelbord'));
  assert.match(html,/<a[^>]*href="\/admin\/companies\/z\?flik=installningar"[^>]*aria-label="Återställ Zeta"/,'a company is restored under its Inställningar');
  assert.equal((html.match(/<table/g)??[]).length,1,'only the archived companies get a table');
  assert.ok(shows(html,'Inga arkiverade spelbord'));assert.equal(roleCount(html,'status'),1,'the missing rooms are one empty state');
  assert.doesNotMatch(html,/>Alla bolag</,'no lone filter between the sections');
  const empty=await companiesPageHtml({page:'companies',search:'?tab=papperskorg',operators:[operators[0]],rooms:[registryRoom(catalog.administration.rooms[0])]});
  assert.doesNotMatch(empty,/<table/);assert.ok(shows(empty,'Papperskorgen är tom'));assert.equal(roleCount(empty,'status'),1);
});

test('Papperskorg restores a room in the side panel of its own company and filters by company only with several owners',async()=>{
  const rooms=[...catalog.administration.rooms.map(registryRoom),registryRoom({id:'old',name:'Gamla',operatorId:'b',state:'archived',game:'blackjack',compositionId:'one'})];
  const html=await companiesPageHtml({page:'companies',search:'?tab=papperskorg',rooms,compositions});
  assert.ok(hrefs(html).includes('/admin/companies?tab=papperskorg&restore=a')&&hrefs(html).includes('/admin/companies?tab=papperskorg&restore=b'));
  assert.ok(hrefs(html).includes('/admin/companies?tab=papperskorg&operator=b'),'two owners: filter chips');
  assert.doesNotMatch(html,/data-lifecycle=/,'the panel opens only on request');
  const filtered=await companiesPageHtml({page:'companies',search:'?tab=papperskorg&operator=b&restore=b',rooms,compositions});
  assert.match(filtered,/data-lifecycle="rooms"/);assert.ok(shows(filtered,'Återställ hos b'));
  assert.ok(hrefs(filtered).includes('/admin/companies?tab=papperskorg&operator=b&restore=b'),'the filter stays when the panel opens');
  assert.equal(hrefs(filtered).some(href=>href.includes('restore=a')),false,'the filtered list shows only the company\'s rooms');
  const none=await companiesPageHtml({page:'companies',search:'?tab=papperskorg&operator=missing',rooms,compositions});
  assert.equal((none.match(/<table/g)??[]).length,0,'a filter without rooms is an empty state, not a table of headers');assert.equal(roleCount(none,'status'),1);
  assert.doesNotMatch(await companiesPageHtml({page:'companies',search:'?tab=papperskorg&restore=missing',rooms,compositions}),/data-lifecycle=/,'an unknown company opens no lifecycle');
  const single=await companiesPageHtml({page:'companies',search:'?tab=papperskorg',rooms:[...catalog.administration.rooms.map(registryRoom)],compositions});
  assert.equal(hrefs(single).some(href=>href.includes('operator=')),false,'one owner: no filter chips');
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
    const editor=()=>walk(h.render(),node=>section==='appearance'?node.props?.apiBase==='/studio/api/partner':node.props?.roomName!==undefined&&typeof node.props.onDirtyChange==='function')[0];
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

test('the room publication is keyed by company and room, and holds the room lifecycle while it publishes',async()=>{
  const h=await mountRegisteredStudio({operatorId:'a',roomId:'bj',mode:'room',section:'appearance'});
  const release=()=>walk(h.render(),node=>node.props?.['eligible']!==undefined&&typeof node.props.onPublished==='function')[0];
  const reader=()=>walk(h.render(),node=>node.props?.kind==='rooms')[0];
  // En ny key per bolag och spelbord: kvitto, fel och ruta från ett spelbord följer aldrig med till ett annat.
  assert.equal(release().key,'release:a:bj');
  for(const section of ['game','details','state','appearance']){
    h.setProps({section});assert.equal(release().key,'release:a:bj','changing tab keeps the same room publication');
  }
  const appearance=walk(h.render(),node=>node.props?.apiBase==='/studio/api/partner')[0];
  assert.equal(appearance.props.publication,'room');
  appearance.props.onDirtyChange(true);assert.ok(release().props.blockedBy);
  appearance.props.onDirtyChange(false);appearance.props.onBusyChange(true);assert.ok(release().props.blockedBy);
  const beforeSave=release().props.refreshKey;appearance.props.onBusyChange(false);h.render();
  assert.notEqual(release().props.refreshKey,beforeSave,'a completed save refreshes the release comparison');
  h.setProps({section:'game'});
  assert.equal(walk(h.render(),node=>node.props?.roomName!==undefined&&node.props?.onDirtyChange)[0].props.onPublished,undefined,'the settings editor only saves');
  h.setProps({section:'appearance'});
  h.setProps({roomId:'roulette'});assert.equal(release().key,'release:a:roulette');
  assert.equal(walk(h.render(),node=>node.props?.apiBase==='/studio/api/partner')[0].props.publication,'inline','roulette keeps its existing publisher');
  h.setProps({operatorId:'b',roomId:'other'});await settle(1);assert.equal(release().key,'release:b:other');
  assert.equal(reader().props.disabled,false);
  release().props.onBusyChange(true);assert.equal(reader().props.disabled,true,'the room cannot be opened or paused while it publishes');
  release().props.onBusyChange(false);assert.equal(reader().props.disabled,false);
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

test('the room status forwards the published choices to its header and rejects another room',async()=>{
  const statuses=[];
  const h=await mountRegisteredStudio({operatorId:'a',roomId:'bj',mode:'room',section:'appearance',onRoomStatus:status=>statuses.push(status)},{compositions});
  const editor=()=>walk(h.render(),node=>node.props?.apiBase==='/studio/api/partner')[0];
  const status={roomId:'bj',packageRevision:7,draftRevision:2,draft:true,live:{background:null,dealer:'astrid',table:'table-1'},labels:{background:'Standard',dealer:'Astrid',table:'Grön filt'}};
  editor().props.onStatus(status);assert.equal(statuses.at(-1),status,'saved drafts never replace the reported live choices');
  editor().props.onStatus({...status,roomId:'other'});assert.equal(statuses.at(-1),null);
  editor().props.onStatus(null);assert.equal(statuses.at(-1),null);
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
  assert.match(revisionChip(p.h.render()),/\b6\b/);assert.equal(p.status(),ready.replace(/\b4\b/,'6'),'back to the idle status, now naming the newer revision');
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

test('an unchanged assignment is re-frozen only under Avancerat and a changed one only through the form button',async()=>{
  const p=await publicationHarness();
  const republish=()=>walk(p.h.render(),node=>node.type==='button'&&node.props?.['data-action']==='republish-package')[0];
  const submitForm=async()=>{walk(p.h.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});await p.settle();};
  p.lifecycle().props.onChanged(lifecycleSnapshot());
  assert.equal(p.submit().props.disabled,true,'an unchanged selection has nothing to publish in the form');
  assert.equal(republish().props.disabled,false,'Avancerat re-freezes the unchanged selection');
  await submitForm();assert.equal(p.requests.length,0,'the form never re-freezes an unchanged selection');
  p.replies.push(Response.json({ok:true,operatorId:'a',packageRevision:5,lanes:['one']}));
  republish().props.onClick();await p.settle();
  assert.deepEqual(p.requests.map(row=>row.body),[{operatorId:'a',lanes:['one'],expectedPackageRevision:4}],'the republish carries the CAS revision');
  assert.match(p.status(),/\b5\b/);
  assert.equal(textOf(p.submit()).trim(),'Publicera','the form button keeps its name after a receipt');assert.equal(textOf(republish()).trim(),'Publicera igen');
  p.checkbox('two').props.onChange({target:{checked:true}});
  assert.equal(p.submit().props.disabled,false,'a changed selection is published by the form');assert.equal(republish().props.disabled,true,'Avancerat waits');
  republish().props.onClick();await p.settle();assert.equal(p.requests.length,1,'Avancerat never publishes a changed selection');
  p.replies.push(Response.json({ok:true,operatorId:'a',packageRevision:6,lanes:['one','two']}));
  await submitForm();
  assert.deepEqual(p.requests[1].body,{operatorId:'a',lanes:['one','two'],expectedPackageRevision:5});
  // A readback without a package revision is never a republish: the first publication is the form's and sends null.
  const first=await publicationHarness();
  const firstRepublish=()=>walk(first.h.render(),node=>node.type==='button'&&node.props?.['data-action']==='republish-package')[0];
  first.lifecycle().props.onChanged(packageOperators({packageRevision:null,lanes:['one']}));
  assert.equal(first.submit().props.disabled,false);assert.equal(firstRepublish().props.disabled,true);
  first.replies.push(Response.json({ok:true,operatorId:'a',packageRevision:1,lanes:['one']}));
  await first.publish();
  assert.deepEqual(first.requests.map(row=>row.body),[{operatorId:'a',lanes:['one'],expectedPackageRevision:null}]);
});

test('the room editor publishes through the room release and keeps the scoped PAOW repair in availability',async()=>{
  const p=await publicationHarness({props:{operatorId:'a',roomId:'bj',mode:'room',section:'state'},dealerIds:['astrid','paow']});
  p.lifecycle().props.onChanged(packageOperators({lanes:['one','retired']}));
  const tree=p.h.render();
  assert.equal(walk(tree,node=>node.type==='form').length,0,'the room editor carries no package form; the assignment stays on its own tab');
  const release=()=>walk(p.h.render(),node=>node.props?.eligible!==undefined&&node.props?.roomId==='bj');
  assert.equal(release().length,1,'one room publication, scoped to the open room');
  assert.equal(release()[0].props.operatorId,'a');assert.equal(release()[0].props.blockedBy,'');
  const isRefresh=node=>node.type==='button'&&node.props?.['data-action']==='refresh-dealer-idle';
  const advanced=()=>walk(p.h.render(),node=>node.props?.title!==undefined&&walk(node,isRefresh).length>0)[0];
  const paow=()=>walk(advanced(),isRefresh)[0];
  assert.ok(advanced(),'the scoped repair is in a closed details component');
  // A scene template removed from Studio stops Publicera (studio_presentation_required) but never the idle refresh:
  // it publishes against the frozen package, never Studio lanes.
  assert.equal(paow().props.disabled,false,'refresh-dealer-idle uses the frozen package');
  release()[0].props.onBusyChange(true);assert.equal(paow().props.disabled,true,'the room publication in flight locks the idle refresh');
  release()[0].props.onBusyChange(false);assert.equal(paow().props.disabled,false);
  p.replies.push(Response.json({ok:true,operatorId:'a',packageRevision:5,lanes:['one','retired'],idleRefreshed:{dealerId:'paow',roomId:'bj'}}));
  paow().props.onClick();await p.settle();
  assert.deepEqual(p.requests.map(row=>row.body),[{action:'refresh-dealer-idle',operatorId:'a',roomId:'bj',dealerId:'paow',expectedPackageRevision:4}]);
  assert.match(textOf(walk(advanced(),node=>node.props?.role==='status')),/\b5\b/,'the receipt names the new version');
  assert.equal(p.lifecycle().props.refreshKey,1,'the receipt re-reads the lifecycle');
  // The frozen package is the precondition: the next refresh sends the new revision.
  p.replies.push(Response.json({ok:true,operatorId:'a',packageRevision:6,lanes:['one','retired'],idleRefreshed:{dealerId:'paow',roomId:'bj'}}));
  paow().props.onClick();await p.settle();
  assert.deepEqual(p.requests.slice(1).map(row=>row.body),[{action:'refresh-dealer-idle',operatorId:'a',roomId:'bj',dealerId:'paow',expectedPackageRevision:5}]);
  // A foreign receipt is never confirmed; the next write waits for the readback.
  p.replies.push(Response.json({ok:true,operatorId:'a',packageRevision:7,lanes:['one','retired'],idleRefreshed:{dealerId:'paow',roomId:'other'}}));
  paow().props.onClick();await p.settle();
  assert.equal(paow().props.disabled,true,'an unconfirmed receipt blocks the next refresh until readback');
});

// The AI link uses the shared context keys (hub.tsx tabContext), so the spelbord survives a switch between the Scenes tabs.
test('a blackjack room\'s appearance links to the AI table dialog with its company and room as shared context',async()=>{
  const html=await registeredStudioHtml({operatorId:'a',roomId:'bj',mode:'room',section:'appearance'},{compositions});
  const link=hrefs(html).find(href=>href.startsWith('/admin/scenes?tab=bordsgrafik'));
  assert.equal(link,'/admin/scenes?tab=bordsgrafik&operator=a&room=bj');
});

// Enkel väg 4: the company nav has four tabs with Spelbord first; retired tab ids land on the nearest tab.
test('the company nav opens on Spelbord with start addresses, keeps the journal under Inställningar and maps old tab ids',async()=>{
  const rooms=catalog.administration.rooms.map(row=>registryRoom({...row,playUrl:row.id==='bj'?'https://game.invalid/play/bj':null}));
  const page=search=>companiesPageHtml({page:'company',id:'a',search,compositions,rooms});
  const tabs=html=>[...html.matchAll(/href="\/admin\/companies\/a\?flik=([a-z]+)"/g)].map(match=>match[1]);
  const plain=await page('');
  assert.deepEqual([...new Set(tabs(plain))],['spelbord','tilldelning','team','installningar']);
  const current=html=>html.match(/href="\/admin\/companies\/a\?flik=([a-z]+)" aria-current="page"/)?.[1];
  assert.equal(current(plain),'spelbord','Spelbord is the default tab');
  assert.ok(plain.includes('https://game.invalid/play/bj'),'start addresses are on Spelbord');
  assert.doesNotMatch(plain,/Spelare och ekonomi|Inte anslutet ännu|data-journal=/,'no empty state and no journal on Spelbord');
  for(const [old,tab,shows] of [['spelare','spelbord','https://game.invalid/play/bj'],['integration','spelbord','https://game.invalid/play/bj'],['journal','installningar','data-journal="a"']]){
    const html=await page('?flik='+old);assert.equal(current(html),tab,old+' lands on its nearest tab');assert.ok(html.includes(shows),old);
  }
  const settings=await page('?flik=installningar');
  assert.match(settings,/data-journal="a"/);assert.match(settings,/data-lifecycle="operator"/);
  const list=await companiesPageHtml({page:'companies',search:'?tab=bolag',compositions});
  assert.ok(hrefs(list).includes('/admin/companies/a?flik=spelbord'),'a company without a tab opens on Spelbord');
});

test('Tilldelning publishes the selection and what the company may change with one button, in order and on the first receipt',async()=>{
  const view={allow:{dealer:true,tableAsset:false,background:false,language:false,limit:true,pause:false},adjustable:{dealer:true,tableAsset:false,background:false},
    limitPresets:['casual'],languages:['sv'],options:{limitPresets:['casual','prive'],languages:['sv','en']}};
  const p=await publicationHarness({props:{operatorId:'a',mode:'package',assignment:view,assignmentRevision:4}});
  const field=()=>walk(p.h.render(),node=>typeof node.props?.onDraft==='function')[0];
  const setPause=on=>{field().props.onDraft(current=>({...current,allow:{...current.allow,pause:on}}));p.h.render();};
  p.lifecycle().props.onChanged(lifecycleSnapshot());
  assert.equal(walk(p.h.render(),node=>node.type==='button'&&node.props.type==='submit').length,1,'one publish button for both');
  assert.ok(walk(p.h.render(),node=>node.type==='form').flatMap(form=>walk(form,node=>typeof node.props?.onDraft==='function')).length,'the assignment is in the form');
  assert.equal(p.submit().props.disabled,true,'nothing changed');
  // Both changed: the selection first, then the assignment on revision 5 from the first receipt.
  p.checkbox('two').props.onChange({target:{checked:true}});setPause(true);
  assert.equal(p.submit().props.disabled,false);
  p.replies.push(Response.json({ok:true,operatorId:'a',packageRevision:5,lanes:['one','two']}),Response.json({ok:true,operatorId:'a',packageRevision:6,assignment:view}));
  await p.publish();
  assert.deepEqual(p.requests.map(row=>row.body),[{operatorId:'a',lanes:['one','two'],expectedPackageRevision:4},
    {action:'publish-assignment',operatorId:'a',expectedPackageRevision:5,assignment:{allow:{...view.allow,pause:true},limitPresets:['casual'],languages:['sv']}}]);
  assert.match(p.status(),/\b6\b/);assert.equal(p.submit().props.disabled,true,'the sent draft waits for the new catalog read');
  // The catalog reads revision 6; only the assignment changes: one call, and a 409 stops with a message.
  p.h.setProps({assignment:{...view,allow:{...view.allow,pause:true}},assignmentRevision:6});
  p.lifecycle().props.onChanged(packageOperators({packageRevision:6,lanes:['one','two']}));
  setPause(false);
  await p.publish();
  assert.deepEqual(p.requests.slice(2).map(row=>[row.body.action,row.body.expectedPackageRevision]),[['publish-assignment',6]]);
  assert.ok(p.html().includes(escapeHtml(assignmentPublishError(409))));
  await p.publish();assert.equal(p.requests.length,3,'no new attempt before the readback');
});
