import test from 'node:test';
import assert from 'node:assert/strict';
import {studioContext} from './studio-context.mjs';
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

async function registeredStudioHtml(path,search='',overrides={},interactive=false){
  let currentSearch=search,allowLeave=false,confirms=0,notifications=0;const listeners=new Map();
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
  const lifecycle=await import('./studio-resource-lifecycle.mjs');
  const historyModule=await import('../../../lib/studio-history.mjs');
  const locationState={origin:'https://scout.invalid',get href(){return this.origin+path+currentSearch;},pathname:path,get search(){return currentSearch;},hash:''};
  const historyState={state:null,replaceState(state,unused,href){this.state=state;if(href!==undefined)currentSearch=new URL(href,locationState.href).search;},pushState(state,unused,href){this.replaceState(state,unused,href);}};
  const windowState={location:locationState,history:historyState,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),dispatchEvent:event=>{listeners.get(event.type)?.(event);return !event.defaultPrevented;}};
  historyModule.studioHistory(windowState).subscribe(()=>notifications++);
  const value={schemaVersion:1,source:'registered',readAt:'2026-10-13T00:00:00Z',administration:{...catalog.administration,
    operators:catalog.administration.operators.map(row=>({...row,name:row.id,slug:row.id,packageRevision:1})),
    dealers:catalog.administration.dealers.map(row=>({...row,name:row.id})),
    rooms:catalog.administration.rooms.map(row=>({...row,name:row.id,state:row.state??'live',published:true,playable:true,
      dealerIds:row.game==='roulette'?['paow-v2']:['astrid'],dealers:[],dealerSource:'published'})),compositions:[],revisions:{project:'p1',administration:'a1'},...overrides}};
  const source=readFileSync(new URL('../components/studio/registered-studio.tsx',import.meta.url),'utf8');
  const output=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}),module={exports:{}},slots=[],effects=[];let cursor=0;
  const react={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;
    return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next}];},useEffect(effect,deps){const i=cursor++,previous=slots[i];if(!previous||!deps||deps.some((value,index)=>value!==previous.deps[index]))effects.push(()=>{previous?.cleanup?.();slots[i]={deps,cleanup:effect()};});}};
  runInNewContext(output.code,{module,exports:module.exports,URLSearchParams,URL,AbortController,location:locationState,confirm:()=>{confirms++;return allowLeave;},window:windowState,document:{addEventListener:()=>{},removeEventListener:()=>{}},
    fetch:async()=>Response.json(value),require:name=>name==='react'?react:name==='@/lib/utils'?{cn:(...names)=>names.filter(Boolean).join(' ')}
      :name.includes('partner-appearance-loader.mjs')?{PartnerAppearanceLoader:props=>React.createElement('section',{'data-room-editor':props.roomId,'data-operator':props.operatorId,'data-room-layout':props.roomLayout})}:name==='../../../runtime/navigation'?{useSearchParams:()=>new URLSearchParams(currentSearch)}:name.endsWith('studio-history.mjs')?historyModule:name.includes('connected-studio.mjs')?{navigationKeepsStudioTab:()=>false}:name==='./registered-resource-lifecycle'?{RegisteredResourceLifecycle:()=>null}:name.includes('studio-resource-lifecycle.mjs')?lifecycle:require(name)});
  const render=()=>{cursor=0;return module.exports.RegisteredStudio({path,title:'Register'})};
  render();for(const effect of effects.splice(0))effect();await new Promise(resolve=>setImmediate(resolve));
  if(interactive)return {render:()=>{const tree=render();for(const effect of effects.splice(0))effect();return tree;},listeners,allowLeave:value=>{allowLeave=value;},get search(){return currentSearch;},get confirms(){return confirms;},get notifications(){return notifications;}};
  return renderToStaticMarkup(render());
}
const hrefs=html=>[...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&'));

test('registered room view embeds the exact scoped editor and keeps shared-template/publication context',async()=>{
  const html=await registeredStudioHtml('/admin/rooms','?view=registered&operator=a&table=roulette');
  const links=hrefs(html);
  assert.deepEqual(links.filter(href=>href.startsWith('/admin/publication')),['/admin/publication?operator=a&table=roulette&composition=two&game=roulette']);
  const template=links.map(href=>new URL(href,'https://scout.invalid')).find(url=>url.searchParams.get('panel')==='layers');
  assert.ok(template);assert.equal(template.pathname,'/admin/clips');
  assert.deepEqual(Object.fromEntries(template.searchParams),{operator:'a',table:'roulette',composition:'two',game:'roulette',panel:'layers'});
  assert.match(html,/data-room-editor="roulette"/);assert.match(html,/data-operator="a"/);
  assert.doesNotMatch(html,/aria-label="Välj spel"|Redigera rum och sammansättning|id="room-trash"/);
  assert.match(html,/Papperskorg och återställning/);assert.match(html,/Gemensam mall och tillåtna alternativ/);
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
  const html=await registeredStudioHtml('/admin/rooms','?operator=b',{rooms:[]});
  assert.deepEqual(hrefs(html).filter(href=>href.startsWith('/admin/publication')),['/admin/publication?operator=b']);
  assert.match(html,/Skapa\/publicera rum/);assert.doesNotMatch(html,/data-room-editor=/);
});
test('company team editor links to the supported Admin workspace',async()=>{
  const html=await registeredStudioHtml('/admin/admin/operators','?operator=b');
  const legacy=hrefs(html).filter(href=>href.startsWith('/admin/companies'));
  assert.deepEqual(legacy,['/admin/companies?operator=a','/admin/companies?operator=b']);
  assert.match(html,/Bolag &amp; team/);assert.doesNotMatch(html,/Nuvarande Control/);
  const unknown=await registeredStudioHtml('/admin/unknown');
  assert.equal(hrefs(unknown).some(href=>href.startsWith('/control')),false);assert.ok(hrefs(unknown).includes('/admin'));
});


test('room navigation protects local edits and in-flight operations, then carries exact accepted room context',async()=>{
  const h=await registeredStudioHtml('/admin/rooms','?view=registered&operator=a&table=roulette',{},true);
  const walk=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>walk(child,predicate))];
  const editor=tree=>walk(tree,node=>node.props?.apiBase==='/studio/api/partner')[0];
  const rooms=tree=>walk(tree,node=>node.props?.['aria-label']==='Välj rum')[0];
  editor(h.render()).props.onDirtyChange(true);h.render();
  let denied=false;h.listeners.get('scout:navigate')({preventDefault:()=>{denied=true;}});assert.equal(denied,true);
  rooms(h.render()).props.onChange({target:{value:'bj'}});assert.equal(new URLSearchParams(h.search).get('table'),'roulette');
  editor(h.render()).props.onBusyChange(true);h.render();const before=h.confirms;
  assert.equal(rooms(h.render()).props.disabled,true);rooms(h.render()).props.onChange({target:{value:'bj'}});assert.equal(h.confirms,before);
  editor(h.render()).props.onBusyChange(false);h.render();h.allowLeave(true);
  rooms(h.render()).props.onChange({target:{value:'bj'}});
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
 walk(h.render(),node=>node.props?.['aria-label']==='Välj rum')[0].props.onChange({target:{value:'bj'}});
 assert.equal(h.notifications,1);assert.equal(h.confirms,0);
 assert.deepEqual(Object.fromEntries(new URLSearchParams(h.search)),{view:'registered',operator:'a',table:'bj',composition:'one',game:'blackjack'});
 walk(h.render(),node=>node.props?.['aria-label']==='Välj spelbolag')[0].props.onChange({target:{value:'b'}});
 assert.equal(h.notifications,2);assert.deepEqual(Object.fromEntries(new URLSearchParams(h.search)),{view:'registered',operator:'b'});
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
