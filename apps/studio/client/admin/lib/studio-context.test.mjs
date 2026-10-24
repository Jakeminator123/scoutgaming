import test from 'node:test';
import assert from 'node:assert/strict';
import {studioContext} from './studio-context.mjs';
import * as reactDomServer from 'react-dom/server';
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

async function registeredStudioHtml(path,search='',{fetch:customFetch,...overrides}={},interactive=false){
  let currentSearch=new URL(search||path,'https://scout.invalid'+path).search,currentHash=new URL(search||path,'https://scout.invalid'+path).hash,allowLeave=false,confirms=0,notifications=0;const listeners=new Map();
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
  // Shared .mjs helpers resolve from the component's own location; React cards are stubbed with their props.
  const componentRequire=createRequire(new URL('../components/studio/registered-studio.tsx',import.meta.url));
  const stub=(tag,pick)=>props=>React.createElement('section',{[tag]:pick(props),'data-disabled':String(Boolean(props.disabled)),...('interactionDisabled' in props?{'data-interaction-disabled':String(Boolean(props.interactionDisabled))}:{})});
  const lifecycle=await import('./studio-resource-lifecycle.mjs');
  const historyModule=await import('../../../lib/studio-history.mjs');
  const routing=await import('../../runtime/admin-routing.mjs');
  const locationState={origin:'https://scout.invalid',get href(){return this.origin+path+currentSearch+currentHash;},pathname:path,get search(){return currentSearch;},get hash(){return currentHash;}};
  const historyState={state:null,replaceState(state,unused,href){this.state=state;if(href!==undefined){const url=new URL(href,locationState.href);currentSearch=url.search;currentHash=url.hash;}},pushState(state,unused,href){this.replaceState(state,unused,href);}};
  const windowState={location:locationState,history:historyState,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),dispatchEvent:event=>{listeners.get(event.type)?.(event);return !event.defaultPrevented;}};
  historyModule.studioHistory(windowState).subscribe(()=>notifications++);
  const value={schemaVersion:1,source:'registered',readAt:'2026-10-13T00:00:00Z',administration:{...catalog.administration,
    operators:catalog.administration.operators.map(row=>({...row,name:row.id,slug:row.id,packageRevision:1})),
    dealers:catalog.administration.dealers.map(row=>({...row,name:row.id})),
    rooms:catalog.administration.rooms.map(row=>({...row,name:row.id,state:row.state??'live',published:true,playable:true,
      dealerIds:row.game==='roulette'?['paow-v2']:['astrid'],dealers:[],dealerSource:'published'})),compositions:[],revisions:{project:'p1',administration:'a1'},...overrides}};
  const source=readFileSync(new URL('../components/studio/registered-studio.tsx',import.meta.url),'utf8');
  const boardSource=readFileSync(new URL('../components/studio/operator-game-board.tsx',import.meta.url),'utf8');
  const boardModule={exports:{}};
  runInNewContext(transformSync(boardSource,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module:boardModule,exports:boardModule.exports,require:name=>name.endsWith('.css')?{default:{}}:require(name)});
  const output=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}),module={exports:{}},slots=[],effects=[];let cursor=0;
  const react={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;
    return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next}];},useRef(value){return slots[cursor++]??={current:value};},useEffect(effect,deps){const i=cursor++,previous=slots[i];if(!previous||!deps||deps.some((value,index)=>value!==previous.deps[index]))effects.push(()=>{previous?.cleanup?.();slots[i]={deps,cleanup:effect()};});}};
  runInNewContext(output.code,{module,exports:module.exports,URLSearchParams,URL,AbortController,location:locationState,confirm:()=>{confirms++;return allowLeave;},window:windowState,document:{addEventListener:()=>{},removeEventListener:()=>{},getElementById:()=>null},
    fetch:customFetch??(async()=>Response.json(value)),require:name=>name==='./operator-game-board'?boardModule.exports:name==='./registered-studio.module.css'?{}:name==='react'?react:name==='@/lib/utils'?{cn:(...names)=>names.filter(Boolean).join(' ')}
      :name.includes('partner-appearance-loader.mjs')?{PartnerAppearanceLoader:props=>React.createElement('section',{'data-room-editor':props.roomId,'data-operator':props.operatorId,'data-room-layout':props.roomLayout,'data-admin-choices':String(Boolean(props.adminChoices)),'data-disabled':String(Boolean(props.disabled))},props.children)}:name==='../../../runtime/navigation'?{useSearchParams:()=>new URLSearchParams(currentSearch)}:name.endsWith('admin-routing.mjs')?routing:name.endsWith('studio-history.mjs')?historyModule:name.includes('connected-studio.mjs')?{navigationKeepsStudioTab:()=>false}:name==='./registered-resource-lifecycle'?{RegisteredResourceLifecycle:()=>null}:name.includes('studio-resource-lifecycle.mjs')?lifecycle
      :name.endsWith('components/control-resource-lifecycle')?{ControlResourceLifecycle:stub('data-lifecycle',props=>props.kind)}:name.endsWith('components/room-game-config')?{RoomGameConfig:stub('data-game-config',props=>props.roomId)}
      :name.endsWith('components/presentation-room-create')?{PresentationRoomCreate:stub('data-room-create',props=>props.presentation?.id??'')}:name.startsWith('.')?componentRequire(name):require(name)});
  const render=()=>{cursor=0;return module.exports.RegisteredStudio({path,title:'Register'})};
  render();for(const effect of effects.splice(0))effect();await new Promise(resolve=>setImmediate(resolve));
  if(interactive)return {render:()=>{const tree=render();for(const effect of effects.splice(0))effect();return tree;},listeners,allowLeave:value=>{allowLeave=value;},get search(){return currentSearch;},get hash(){return currentHash;},get confirms(){return confirms;},get notifications(){return notifications;}};
  return renderToStaticMarkup(render());
}
const gameBoard=tree=>walk(tree,node=>Array.isArray(node.props?.rooms)&&typeof node.props?.onSelect==='function'&&typeof node.props?.onAdd==='function')[0];
const hrefs=html=>[...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&'));
const compositions=[{id:'one',name:'Standard',dealerIds:['astrid'],defaultDealerId:'astrid'},{id:'two',name:'Kväll',dealerIds:['paow-v2'],defaultDealerId:'paow-v2'}];
const walk=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>walk(child,predicate))];
const lifecycleSnapshot=(extra={})=>({administrationRevision:'admin-1',operators:[{id:'a',slug:'a',name:'a',status:'active',packageRevision:4,lanes:['one'],archivedAt:null,roomCount:2,archivedRoomCount:0},{id:'b',slug:'b',name:'b',status:'active',packageRevision:null,lanes:[],archivedAt:null,roomCount:1,archivedRoomCount:0}],rooms:[],...extra});

test('registered room view embeds the exact scoped Admin editor with publication, room creation and lifecycle on the same page',async()=>{
  const h=await registeredStudioHtml('/admin/rooms','?view=registered&operator=a&table=roulette',{compositions},true);
  const html=renderToStaticMarkupOf(h);
  const links=hrefs(html);
  assert.equal(links.some(href=>href.startsWith('/admin/publication')),false,'no function lives only on the older publication page');
  const template=links.map(href=>new URL(href,'https://scout.invalid')).find(url=>url.searchParams.get('panel')==='layers');
  assert.ok(template);assert.equal(template.pathname,'/admin/clips');
  assert.deepEqual(Object.fromEntries(template.searchParams),{operator:'a',table:'roulette',composition:'two',game:'roulette',panel:'layers'});
  assert.match(html,/data-room-editor="roulette"/);assert.match(html,/data-operator="a"/);assert.match(html,/data-admin-choices="true"/);
  assert.doesNotMatch(html,/data-game-config=/,'roulette rooms have no blackjack game settings');
  const publication=walk(h.render(),node=>node.type==='section'&&node.props?.['aria-label']==='Publicering')[0];
  assert.ok(publication);
  assert.deepEqual(walk(publication,node=>node.type==='input'&&node.props?.name==='lanes').map(node=>node.props.value),['one','two']);
  assert.doesNotMatch(html,/data-room-create=/,'room creation opens only on request');
  assert.match(html,/data-lifecycle="rooms"/);assert.doesNotMatch(html,/data-lifecycle="operator"/);
  assert.doesNotMatch(html,/aria-label="Välj spel"|Redigera rum och sammansättning|id="room-trash"/);
  assert.match(html,/Återställ borttaget spel/);assert.match(html,/Gemensam mall och tillåtna alternativ/);
  const blackjack=await registeredStudioHtml('/admin/rooms','?operator=a&table=bj',{compositions});
  assert.match(blackjack,/data-game-config="bj"/);
  for(const [room,composition] of [['roulette','two'],['bj','one']]){
    const h=await registeredStudioHtml('/admin/rooms','?operator=a&table='+room,{compositions},true);
    gameBoard(h.render()).props.onAdd();
    assert.equal(walk(h.render(),node=>typeof node.props?.onCreated==='function')[0].props.presentation.id,composition);
  }
});

test('invalid explicit owner or cross-owner room never mounts another room editor',async()=>{
  for(const query of ['?operator=missing&table=roulette','?operator=a&table=other']) {
    const html=await registeredStudioHtml('/admin/rooms',query);
    assert.doesNotMatch(html,/data-room-editor=/);assert.match(html,/Det valda rummet finns inte/);
  }
});

test('unpublished rooms lead to the existing template and publication without a frozen editor fallback',async()=>{
  const room={...catalog.administration.rooms[0],name:'Utkast',state:'preview',published:false,playable:false,dealerIds:[],dealers:[]};
  const html=await registeredStudioHtml('/admin/rooms','?operator=a&table=bj',{rooms:[room]});
  assert.doesNotMatch(html,/data-room-editor=/);assert.match(html,/saknar ett publicerat paket/);
  assert.ok(hrefs(html).some(href=>href.includes('panel=layers')));
});

test('an active company without registered rooms can still create its first room in Admin',async()=>{
  const h=await registeredStudioHtml('/admin/rooms','?operator=b',{rooms:[],compositions},true);
  const html=renderToStaticMarkupOf(h);
  assert.equal(hrefs(html).some(href=>href.startsWith('/admin/publication')),false);
  assert.match(html,/Lägg till spel/);assert.doesNotMatch(html,/data-room-create=/);assert.match(html,/aria-label="Publicering"/);
  gameBoard(h.render()).props.onAdd();assert.match(renderToStaticMarkupOf(h),/data-room-create="one"/);
  assert.doesNotMatch(html,/data-room-editor=|data-game-config=/);
});
test('company team editor links to the supported Admin workspace',async()=>{
  const html=await registeredStudioHtml('/admin/admin/operators','?operator=b');
  const legacy=hrefs(html).filter(href=>href.startsWith('/admin/companies'));
  assert.deepEqual(legacy,['/admin/companies?operator=a','/admin/companies?operator=b']);
  assert.match(html,/Bolag &amp; team/);
  const unknown=await registeredStudioHtml('/admin/unknown');
  assert.equal(hrefs(unknown).some(href=>href.startsWith('/control')),false);assert.ok(hrefs(unknown).includes('/admin'));
});


test('room navigation protects local edits and in-flight operations, then carries exact accepted room context',async()=>{
  const h=await registeredStudioHtml('/admin/rooms','?view=registered&operator=a&table=roulette',{},true);
  const walk=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>walk(child,predicate))];
  const editor=tree=>walk(tree,node=>node.props?.apiBase==='/studio/api/partner')[0];
  const rooms=tree=>gameBoard(tree);
  editor(h.render()).props.onDirtyChange(true);h.render();
  let denied=false;h.listeners.get('scout:navigate')({preventDefault:()=>{denied=true;}});assert.equal(denied,true);
  rooms(h.render()).props.onSelect('bj');assert.equal(new URLSearchParams(h.search).get('table'),'roulette');
  editor(h.render()).props.onBusyChange(true);h.render();const before=h.confirms;
  assert.equal(rooms(h.render()).props.disabled,true);rooms(h.render()).props.onSelect('bj');assert.equal(h.confirms,before);
  editor(h.render()).props.onBusyChange(false);h.render();h.allowLeave(true);
  rooms(h.render()).props.onSelect('bj');
  assert.deepEqual(Object.fromEntries(new URLSearchParams(h.search)),{view:'registered',operator:'a',table:'bj',composition:'one',game:'blackjack'});
  assert.equal(editor(h.render()).props.roomId,'bj');
});


test('registered direct room links select the exact owner and never fall back for an unknown room',async()=>{
 const html=await registeredStudioHtml('/admin/rooms','?view=registered&table=other');
 assert.match(html,/data-room-editor="other"/);assert.match(html,/data-operator="b"/);
 const missing=await registeredStudioHtml('/admin/rooms','?view=registered&table=missing');
 assert.doesNotMatch(missing,/data-room-editor=/);assert.match(missing,/Det valda rummet finns inte/);
});


test('a clean room selection notifies real shared history subscribers and does not inherit the previous room',async()=>{
 const h=await registeredStudioHtml('/admin/rooms','?view=registered&operator=a&table=roulette&dealer=paow-v2',{},true);
 const walk=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>walk(child,predicate))];
 const initialNotifications=h.notifications;
 gameBoard(h.render()).props.onSelect('bj');
 assert.equal(h.notifications,initialNotifications+1);assert.equal(h.confirms,0);
 assert.deepEqual(Object.fromEntries(new URLSearchParams(h.search)),{view:'registered',operator:'a',table:'bj',composition:'one',game:'blackjack'});
 gameBoard(h.render()).props.onCompanyChange('b');
 assert.equal(h.notifications,initialNotifications+2);assert.deepEqual(Object.fromEntries(new URLSearchParams(h.search)),{view:'registered',operator:'b'});
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

test('room cards list only the active owner and preserve dirty/busy guards before exact room navigation',async()=>{
  const h=await registeredStudioHtml('/admin/rooms','?operator=a&table=roulette',{},true);
  const walk=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>walk(child,predicate))];
  const cards=()=>{const board=gameBoard(h.render()).props;return Array.from(board.rooms,room=>({props:{'aria-label':'Redigera '+room.name,'aria-pressed':board.selectedId===room.id,disabled:board.disabled,onClick:()=>board.onSelect(room.id)}}));};
  const editor=()=>walk(h.render(),node=>node.props?.apiBase==='/studio/api/partner')[0];
  assert.deepEqual(cards().map(node=>node.props['aria-label']),['Redigera bj','Redigera roulette']);
  assert.equal(cards()[1].props['aria-pressed'],true);
  editor().props.onDirtyChange(true);h.render();cards()[0].props.onClick();
  assert.equal(new URLSearchParams(h.search).get('table'),'roulette');assert.equal(h.confirms,1);
  editor().props.onBusyChange(true);h.render();assert.ok(cards().every(node=>node.props.disabled));
  cards()[0].props.onClick();assert.equal(new URLSearchParams(h.search).get('table'),'roulette');assert.equal(h.confirms,1);
  editor().props.onBusyChange(false);h.render();h.allowLeave(true);cards()[0].props.onClick();
  assert.deepEqual(Object.fromEntries(new URLSearchParams(h.search)),{operator:'a',table:'bj',composition:'one',game:'blackjack'});
  assert.equal(editor().props.roomId,'bj');assert.equal(cards()[0].props['aria-pressed'],true);
});


test('saved room bookmarks remove stale dealer context without changing the selected owner, room or hash',async()=>{
  for(const query of ['?operator=a&table=roulette&dealer=astrid&tag=a&tag=b#choices','?operator=a&table=other&dealer=astrid#choices']){
    const h=await registeredStudioHtml('/admin/rooms',query,{},true);h.render();
    assert.equal(new URLSearchParams(h.search).has('dealer'),false);
    assert.equal(h.search,new URL(query.replace('&dealer=astrid',''),'https://scout.invalid').search);
    assert.equal(h.hash,'#choices');assert.equal(h.confirms,0);
  }
  const library=await registeredStudioHtml('/admin/admin/operators','?dealer=astrid',{},true);library.render();
  assert.equal(library.search,'?dealer=astrid');
});

test('selecting the active room is inert and preserves dirty guards even without explicit room URL context',async()=>{
  for(const search of ['?dealer=astrid&game=blackjack','?operator=a&table=roulette']){
    const h=await registeredStudioHtml('/admin/rooms',search,{},true);
    const walk=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>walk(child,predicate))];
    const cards=()=>{const board=gameBoard(h.render()).props;return Array.from(board.rooms,room=>({props:{'aria-label':'Redigera '+room.name,'aria-pressed':board.selectedId===room.id,disabled:board.disabled,onClick:()=>board.onSelect(room.id)}}));};
    const editor=()=>walk(h.render(),node=>node.props?.apiBase==='/studio/api/partner')[0];
    const activeRoom=editor().props.roomId,initialSearch=h.search,initialNotifications=h.notifications;
    editor().props.onDirtyChange(true);h.render();h.allowLeave(true);
    cards().find(node=>node.props['aria-pressed']).props.onClick();
    gameBoard(h.render()).props.onSelect(activeRoom);
    assert.equal(h.confirms,0);assert.equal(h.notifications,initialNotifications);assert.equal(h.search,initialSearch);
    assert.equal(editor().props.roomId,activeRoom);
    const unload={prevented:false,returnValue:undefined,preventDefault(){this.prevented=true;}};
    h.listeners.get('beforeunload')(unload);
    assert.equal(unload.prevented,true);assert.equal(unload.returnValue,'');
    h.allowLeave(false);
    cards().find(node=>!node.props['aria-pressed']).props.onClick();
    assert.equal(h.confirms,1);assert.equal(h.notifications,initialNotifications);assert.equal(h.search,initialSearch);
    assert.equal(editor().props.roomId,activeRoom);
  }
});


test('the publication card publishes the acknowledged company package with the lifecycle revision and reloads the room editors',async()=>{
  const requests=[];let reply;
  const fetcher=async(url,options={})=>{if(options.method==='POST'){requests.push({url,body:JSON.parse(options.body)});return new Promise(resolve=>{reply=resolve;});}return Response.json(await catalogResponse());};
  const catalogResponse=async()=>({schemaVersion:1,source:'registered',readAt:'2026-10-13T00:00:00Z',administration:{...catalog.administration,
    operators:catalog.administration.operators.map(row=>({...row,name:row.id,slug:row.id,packageRevision:4})),dealers:catalog.administration.dealers.map(row=>({...row,name:row.id})),
    rooms:catalog.administration.rooms.map(row=>({...row,name:row.id,state:row.state??'live',published:true,playable:true,dealerIds:['astrid'],dealers:[],dealerSource:'published'})),compositions,revisions:{project:'p1',administration:'a1'}}});
  const h=await registeredStudioHtml('/admin/rooms','?operator=a&table=bj',{fetch:fetcher},true);
  const lifecycle=()=>walk(h.render(),node=>node.props?.kind==='rooms')[0];
  const submit=()=>walk(h.render(),node=>node.type==='button'&&node.props.type==='submit')[0];
  const checkbox=id=>walk(h.render(),node=>node.type==='input'&&node.props.value===id)[0];
  const known=/^(Läs in aktuell publicering|Redo att publicera|Urvalet är inte publicerat|Spara rummets ändringar först|Publicerat · version \d+|Publicerar…|Spara det pågående Studio-arbetet först)$/;
  const status=()=>walk(h.render(),node=>node.type==='p'&&node.props.role==='status'&&typeof node.props.children==='string'&&known.test(node.props.children))[0]?.props.children;
  assert.equal(submit().props.disabled,true,'no package baseline before the lifecycle readback');assert.equal(status(),'Läs in aktuell publicering');
  lifecycle().props.onChanged(lifecycleSnapshot());
  assert.equal(checkbox('one').props.checked,true);assert.equal(checkbox('two').props.checked,false);assert.equal(status(),'Redo att publicera');
  checkbox('two').props.onChange({target:{checked:true}});assert.equal(status(),'Urvalet är inte publicerat');
  const editor=()=>walk(h.render(),node=>node.props?.apiBase==='/studio/api/partner')[0];
  const gameConfig=()=>walk(h.render(),node=>node.props?.roomName!==undefined)[0];
  editor().props.onDirtyChange(true);h.render();
  assert.equal(submit().props.disabled,true);assert.equal(status(),'Spara rummets ändringar först');
  assert.equal(gameConfig().props.disabled,true,'one room draft at a time');assert.equal(lifecycle().props.disabled,true);
  gameBoard(h.render()).props.onAdd();h.render();
  assert.equal(walk(h.render(),node=>node.props?.onCreated).length,0,'a room draft requires accepted discard before creating a game');
  editor().props.onDirtyChange(false);h.render();
  gameConfig().props.onDirtyChange(true);h.render();assert.equal(editor().props.disabled,true,'a game settings draft locks the layer editor');
  gameConfig().props.onDirtyChange(false);h.render();assert.equal(editor().props.disabled,false);
  const form=walk(h.render(),node=>node.type==='form')[0];
  const refreshBefore=lifecycle().props.refreshKey;
  form.props.onSubmit({preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(requests.map(row=>row.body),[{operatorId:'a',lanes:['one','two'],expectedPackageRevision:4}]);
  assert.match(requests[0].url,/\/api\/admin\/operator-package$/);
  assert.equal(submit().props.disabled,true,'the write locks the form');
  reply(Response.json({ok:true,operatorId:'a',packageRevision:5,package_revision:5,lanes:['one','two']}));
  await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(status(),'Publicerat · version 5');assert.equal(lifecycle().props.refreshKey,refreshBefore+1,'the lifecycle re-reads the new package');
  const editorKey=editor().key;
  lifecycle().props.onChanged(lifecycleSnapshot({operators:lifecycleSnapshot().operators.map(row=>row.id==='a'?{...row,packageRevision:5,lanes:['one','two']}:row)}));
  assert.notEqual(editor().key,editorKey,'both room editors reload on the new package revision');
  assert.equal(checkbox('two').props.checked,true);
});

test('a room draft, a busy editor and an unconfirmed publish receipt all keep the company package unpublished',async()=>{
  const requests=[];
  const fetcher=async(url,options={})=>{if(options.method==='POST'){requests.push(JSON.parse(options.body));return Response.json({ok:true,operatorId:'b',packageRevision:5,lanes:['one']});}
    return Response.json({schemaVersion:1,source:'registered',readAt:'2026-10-13T00:00:00Z',administration:{...catalog.administration,
      operators:catalog.administration.operators.map(row=>({...row,name:row.id,slug:row.id,packageRevision:4})),dealers:catalog.administration.dealers.map(row=>({...row,name:row.id})),
      rooms:catalog.administration.rooms.map(row=>({...row,name:row.id,state:row.state??'live',published:true,playable:true,dealerIds:['astrid'],dealers:[],dealerSource:'published'})),compositions,revisions:{project:'p1',administration:'a1'}}});};
  const h=await registeredStudioHtml('/admin/rooms','?operator=a&table=bj',{fetch:fetcher},true);
  const lifecycle=()=>walk(h.render(),node=>node.props?.kind==='rooms')[0];
  lifecycle().props.onChanged(lifecycleSnapshot());
  const form=()=>walk(h.render(),node=>node.type==='form')[0],checkbox=id=>walk(h.render(),node=>node.type==='input'&&node.props.value===id)[0];
  walk(h.render(),node=>node.props?.apiBase==='/studio/api/partner')[0].props.onBusyChange(true);h.render();
  form().props.onSubmit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,0,'a busy room editor blocks the package publication');
  walk(h.render(),node=>node.props?.apiBase==='/studio/api/partner')[0].props.onBusyChange(false);h.render();
  checkbox('two').props.onChange({target:{checked:true}});
  form().props.onSubmit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,1);
  const html=renderToStaticMarkupOf(h);
  assert.match(html,/Publiceringskvittot stämmer inte/,'a foreign receipt never confirms this company');
  assert.equal(checkbox('two').props.checked,true,'the draft selection is preserved');
  assert.match(html,/Läs in aktuell publicering/);
  form().props.onSubmit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,1,'an unconfirmed package requires readback before the next write');
});

test('the room status shows published materials only for the selected room and clears stale status',async()=>{
  const h=await registeredStudioHtml('/admin/rooms','?operator=a&table=bj',{compositions},true);
  const editor=()=>walk(h.render(),node=>node.props?.apiBase==='/studio/api/partner')[0];
  const publishedMaterials=()=>walk(h.render(),node=>node.type==='dl'&&node.props?.['aria-label']==='Rummets status')
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
function renderToStaticMarkupOf(h){const {renderToStaticMarkup}=reactDomServer;return renderToStaticMarkup(h.render());}
