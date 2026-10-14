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

async function registeredStudioHtml(path,search='',overrides={}){
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
  const lifecycle=await import('./studio-resource-lifecycle.mjs');
  const value={schemaVersion:1,source:'registered',readAt:'2026-10-13T00:00:00Z',administration:{...catalog.administration,
    operators:catalog.administration.operators.map(row=>({...row,name:row.id,slug:row.id,packageRevision:1})),
    dealers:catalog.administration.dealers.map(row=>({...row,name:row.id})),
    rooms:catalog.administration.rooms.map(row=>({...row,name:row.id,state:row.state??'live',published:true,playable:true,
      dealerIds:row.game==='roulette'?['paow-v2']:['astrid'],dealers:[],dealerSource:'published'})),compositions:[],revisions:{project:'p1',administration:'a1'},...overrides}};
  const source=readFileSync(new URL('../components/studio/registered-studio.tsx',import.meta.url),'utf8');
  const output=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}),module={exports:{}},slots=[],effects=[];let cursor=0;
  const react={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;
    return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next}];},useEffect(effect){effects.push(effect);}};
  runInNewContext(output.code,{module,exports:module.exports,URLSearchParams,AbortController,location:{search},
    fetch:async()=>Response.json(value),require:name=>name==='react'?react:name==='@/lib/utils'?{cn:(...names)=>names.filter(Boolean).join(' ')}
      :name==='./registered-resource-lifecycle'?{RegisteredResourceLifecycle:()=>null}:name.includes('studio-resource-lifecycle.mjs')?lifecycle:require(name)});
  const render=()=>{cursor=0;return module.exports.RegisteredStudio({path,title:'Register'})};
  render();for(const effect of effects.splice(0))effect();await new Promise(resolve=>setImmediate(resolve));
  return renderToStaticMarkup(render());
}
const hrefs=html=>[...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&'));

test('registered room and dealer links stay in Admin and retain the exact owner, room, composition and game',async()=>{
  const html=await registeredStudioHtml('/admin/rooms','?operator=a&table=roulette');
  const links=hrefs(html);
  assert.deepEqual(links.filter(href=>href.startsWith('/admin/publication')),['/admin/publication?operator=a&table=roulette&composition=two&game=roulette']);
  const dealer=links.map(href=>new URL(href,'https://scout.invalid')).find(url=>url.pathname==='/admin/clips'&&url.searchParams.get('table')==='roulette');
  assert.ok(dealer);assert.deepEqual(Object.fromEntries(dealer.searchParams),{operator:'a',table:'roulette',composition:'two',game:'roulette',dealer:'paow-v2'});
  const rooms=links.filter(href=>href.startsWith('/admin/rooms?')).map(href=>new URL(href,'https://scout.invalid'));
  assert.ok(rooms.some(url=>url.searchParams.get('table')==='roulette'&&url.searchParams.get('composition')==='two'&&url.searchParams.get('game')==='roulette'));
  assert.match(html,/Redigera rum i Studio/);assert.match(html,/Skapa\/publicera rum/);
  assert.ok(html.indexOf('Redigera rum och sammansättning')<html.indexOf('Skapa/publicera rum'));
  assert.doesNotMatch(html,/<h3 class="text-sm font-medium">bj<\/h3>/,'room cards retain the incoming game-first filter');
  assert.match(html,/id="room-trash"/,'registered room trash remains available in Admin');
});
test('an active company without registered rooms can still create its first room in Admin',async()=>{
  const html=await registeredStudioHtml('/admin/rooms','?operator=b',{rooms:[]});
  assert.deepEqual(hrefs(html).filter(href=>href.startsWith('/admin/publication')),['/admin/publication?operator=b']);
  assert.match(html,/Skapa\/publicera rum/);assert.doesNotMatch(html,/Redigera rum och sammansättning/);
});
test('company team editor links to the supported Admin workspace',async()=>{
  const html=await registeredStudioHtml('/admin/admin/operators','?operator=b');
  const legacy=hrefs(html).filter(href=>href.startsWith('/admin/companies'));
  assert.deepEqual(legacy,['/admin/companies?operator=a','/admin/companies?operator=b']);
  assert.match(html,/Bolag &amp; team/);assert.doesNotMatch(html,/Nuvarande Control/);
  const unknown=await registeredStudioHtml('/admin/unknown');
  assert.equal(hrefs(unknown).some(href=>href.startsWith('/control')),false);assert.ok(hrefs(unknown).includes('/admin'));
});
