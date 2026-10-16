import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeedProject,addDealer} from '../../../../lab/lib/studio-model.mjs';
import {clipSlots} from './connected-studio.mjs';
import {groupSlots,affectedRooms,slotCaption,slotExplanation,isRenderedOutcome,layoutClipCards} from './studio-layout.mjs';

test('expanded clip libraries reserve the tallest measured height before the next row',()=>{
  const cards=[{id:'wait',height:294},{id:'ready',height:359},{id:'players',height:310},{id:'dealer',height:320},{id:'reveal',height:294}];
  const expanded=layoutClipCards(cards,1200);
  assert.deepEqual(expanded.ready,{x:306,y:0});
  assert.equal(expanded.reveal.y,359+26);
  assert.ok(cards.slice(0,4).every(card=>expanded.reveal.y-expanded[card.id].y-card.height>=26));
  const collapsed=layoutClipCards(cards.map(card=>card.id==='ready'?{...card,height:294}:card),1200);
  assert.equal(collapsed.reveal.y,355);
});

test('clip rows reflow at the existing responsive column boundaries',()=>{
  const cards=Array.from({length:5},(_,index)=>({id:String(index),height:index===0?400:294}));
  assert.deepEqual(layoutClipCards(cards,609)['1'],{x:0,y:426});
  assert.deepEqual(layoutClipCards(cards,610)['1'],{x:306,y:0});
  assert.deepEqual(layoutClipCards(cards,1099)['2'],{x:0,y:426});
  assert.deepEqual(layoutClipCards(cards,1100)['3'],{x:918,y:0});
  assert.deepEqual(layoutClipCards(cards,1100)['4'],{x:0,y:426});
});

test('measured reflow preserves dragged coordinates until layout reset',()=>{
  const cards=[{id:'ready',height:500},{id:'reveal',height:294}];
  const positions={ready:{x:42,y:87},reveal:{x:740,y:19}};
  const before=structuredClone(positions);
  assert.deepEqual(layoutClipCards(cards,390,positions),before);
  assert.deepEqual(layoutClipCards(cards,1200,positions),before);
  assert.deepEqual(positions,before);
  assert.deepEqual(layoutClipCards(cards,390,{ready:positions.ready}),{ready:positions.ready,reveal:{x:0,y:526}});
  assert.deepEqual(layoutClipCards(cards,390,{}),{ready:{x:0,y:0},reveal:{x:0,y:526}});
});

test('unmeasured cards retain game spacing and invalid measurements cannot corrupt positions',()=>{
  const cards=[{id:'a'},{id:'b',height:0},{id:'c',height:NaN},{id:'d',height:-10},{id:'e',height:Infinity},{id:'f',height:500}];
  assert.equal(layoutClipCards(cards,1200).e.y,355);
  assert.equal(layoutClipCards(cards,1200,{},440).e.y,440);
  assert.deepEqual(layoutClipCards([],390),{});
});

test('visual cards preserve every exact server slot and discover all 17 speech variants',()=>{
  const slots=clipSlots(createSeedProject(),{videos:[]},'astrid'),groups=groupSlots(slots);
  assert.equal(groups.length,8);assert.equal(groups.filter(row=>row.title==='Tal').flatMap(row=>row.slots).length,17);
  assert.equal(groups.find(row=>row.id==='players').slots.length,7);
  assert.deepEqual(groups.flatMap(row=>row.slots).map(row=>row.id).sort(),slots.map(row=>row.id).sort());
  assert.equal(slotCaption(groups.find(row=>row.id==='players').slots[6]),'Plats 7');
});
test('save impact covers shared banks, earlier contexts and only changed compositions',()=>{
  const before=addDealer(addDealer(createSeedProject(),'nora','Nora'),'elin','Elin'),after=structuredClone(before);
  const rooms=[{id:'a',dealerIds:['astrid'],compositionId:'one'},{id:'b',dealerIds:['astrid'],compositionId:'two'},{id:'c',dealerIds:['nora'],compositionId:'three'}];
  after.lines.find(row=>row.dealerId==='astrid').variants[0].videoGenerationId='11111111-1111-4111-8111-111111111111';
  assert.deepEqual(affectedRooms(before,after,rooms).map(row=>row.id),['a','b']);
  assert.deepEqual(affectedRooms(before,before,rooms),[]);
});
test('removed family policies remain visible in save impact',()=>{
  const before=createSeedProject(),after=structuredClone(before),rooms=[{id:'a',dealerIds:['astrid'],compositionId:'one'}];
  before.mediaPolicy=[{familyId:'astrid/deal.player.left/box0',variants:[]}];after.mediaPolicy=[];
  assert.deepEqual(affectedRooms(before,after,rooms).map(row=>row.id),['a']);
});
test('editing a shared trigger reports each dealer bank and room using it',()=>{
  const before=addDealer(addDealer(createSeedProject(),'nora','Nora'),'elin','Elin'),after=structuredClone(before);
  before.triggers=[{id:'shared',value:1}];after.triggers=[{id:'shared',value:2}];
  for(const project of [before,after])for(const line of project.lines.filter(row=>['astrid','nora'].includes(row.dealerId)))line.variants[0].triggerIds=['shared'];
  const rooms=[{id:'a',dealerIds:['astrid'],compositionId:'one'},{id:'b',dealerIds:['nora'],compositionId:'two'},{id:'c',dealerIds:['elin'],compositionId:'three'}];
  assert.deepEqual(affectedRooms(before,after,rooms).map(row=>row.id),['a','b']);
});


test('clip cards distinguish situation, selected unbound take, saved rule and local edits',async()=>{
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const module={exports:{}};
  runInNewContext(require('esbuild').transformSync(readFileSync(new URL('../components/studio/connected-clip-card.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
    {module,exports:module.exports,require:name=>name==='../../lib/studio-layout.mjs'?{slotCaption,slotExplanation,isRenderedOutcome}:require(name)});
  const slot=clipSlots(createSeedProject(),{videos:[]},'astrid').find(row=>row.eventId==='idle.ready');
  const clips=[{id:'bound',label:'Sparad film'},{id:'selected',label:'En annan exakt tagning',contentType:'video/mp4',sha256:'a'.repeat(64)}];
  const data={group:groupSlots([slot])[0],slot,clips,selectedId:'selected',boundId:'bound',boundIds:['bound'],variants:[],variantId:'',busy:false,
    onSelect(){},onSlot(){},onVariant(){},onBind(){},onFile(){},onSettings(){}};
  const render=patch=>renderToStaticMarkup(React.createElement(module.exports.ConnectedClipCard,{data:{...data,...patch}}));
  const unbound=render({});assert.match(unbound,/Situation/);assert.match(unbound,/Klipp \/ tagning/);assert.match(unbound,/Körregel · projektutkast/);
  assert.match(unbound,/En annan exakt tagning/);assert.match(unbound,/Valt för prov · ej kopplat/);assert.match(unbound,/Koppla till utkast/);assert.doesNotMatch(unbound,/Kopplat i sparat utkast/);
  assert.match(unbound,/video\/mp4/);assert.ok(unbound.includes('a'.repeat(64)));
  const usage={configured:true,when:'Teknisk källa: event.type=idle',rules:['Automatiskt var 27 s.']};
  const saved=render({usage});assert.match(saved,/Kopplat i sparat utkast/);assert.match(saved,/Automatiskt var 27 s/);assert.doesNotMatch(saved,/Koppla till utkast/);
  assert.match(saved,/Teknisk källa: event.type=idle/);assert.doesNotMatch(saved.replace(/<details[\s\S]*?<\/details>/g,''),/event.type/);
  assert.match(saved,/Dealern väntar mellan spelhändelserna/);assert.match(saved,/<summary>Detaljer<\/summary>/);
  assert.match(saved,/Redigera körregel/);assert.doesNotMatch(saved,/Publicerad/);
  const dirty=render({usage,usageChanged:true});assert.match(dirty,/Ändrat lokalt · ej sparat/);assert.doesNotMatch(dirty,/Kopplat i sparat utkast/);
});
