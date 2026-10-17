import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createSeedProject} from '../../../presentation/contracts/studio-model.mjs';
import {clipSlots,clipsForSlot,bindClip,currentClipId,configuredClipIds,uploadMetadata,createStudioClient} from './connected-studio.mjs';
import {groupSlots,slotCaption,slotExplanation,isRenderedOutcome} from './studio-layout.mjs';
import {rouletteReferencePreview,unbindRouletteClip,setRouletteIdleForeground} from './roulette-clip-map.mjs';
import {mediaClassification} from '../../../../lab/lib/dealer-media-library.mjs';
const project=createSeedProject(),dealer='astrid';
const slots=clipSlots(project,{videos:[]},dealer,'roulette');
const file=(name)=>({name,size:128});
const video=(slot,id)=>({id,label:id,available:true,integrity:'verified',previewUrl:'/studio/api/videos/'+id,contentType:slot.localOnly?'image/png':'video/webm',
  classification:slot.localOnly?mediaClassification(project,{dealerId:dealer,slotId:slot.id,label:'VILA',contentType:'image/png'}):uploadMetadata(project,dealer,slot,file('idle.webm'),{mode:'alpha'})});

test('same dealer gets independent roulette intake and blackjack slots, never a shared goodluck line',()=>{
  assert.equal(groupSlots(slots).length,6);
  assert.equal(slots.filter(slot=>!slot.planned).length,4);
  assert.ok(slots.every(slot=>slot.eventId.startsWith('roulette.')));
  assert.ok(clipSlots(project,{videos:[]},dealer).every(slot=>!slot.eventId.startsWith('roulette.')));
  const idle=slots.find(slot=>slot.situation==='breathing'),valid=video(idle,'a');
  const bank={videos:[valid,{...valid,id:'wrong-person',classification:{...valid.classification,dealerId:'vera'}},
    {...valid,id:'blackjack',classification:{dealerId:dealer,eventId:'idle.ready',kind:'idle',role:'standard',situation:'',label:'Idle',notes:''}},
    {...valid,id:'archived',classification:{...valid.classification,archived:true}},
    {...valid,id:'bad',classification:{...valid.classification,action:'wheel-start'}},
    {...valid,id:'missing',available:false},{...valid,id:'bad-integrity',integrity:'unavailable'}]};
  assert.deepEqual(clipsForSlot(bank,dealer,idle).map(row=>row.id),['a']);
  const before=structuredClone(project);
  assert.throws(()=>bindClip(project,bank,dealer,idle,'a'),/studio_roulette_idle_invalid/);
  assert.deepEqual(project,before);
});

const baseId='11111111-1111-4111-8111-111111111111',variantId='22222222-2222-4222-8222-222222222222',otherId='33333333-3333-4333-8333-333333333333';
function bindingFixture() {
  const idle=slots.find(slot=>slot.situation==='breathing'),glasses=slots.find(slot=>slot.situation==='glasses-clean');
  const base=video(idle,baseId),variant=video(glasses,variantId),other=video(idle,otherId);
  for(const row of [base,variant,other])row.classification.framing={scale:1,x:0,y:0};
  return {idle,glasses,base,variant,other,inventory:{videos:[base,variant,other]}};
}
test('explicit roulette base and variations survive ordinary project save/readback without touching blackjack',async()=>{
  const f=bindingFixture(),before=structuredClone(project);
  assert.equal(currentClipId(project,dealer,f.idle,undefined,f.inventory),'');
  assert.deepEqual(configuredClipIds(project,dealer,f.glasses,undefined,f.inventory),[]);
  assert.throws(()=>bindClip(project,f.inventory,dealer,f.glasses,variantId),/grundloopen/);
  const base=bindClip(project,f.inventory,dealer,f.idle,baseId),draft=bindClip(base,f.inventory,dealer,f.glasses,variantId);
  assert.deepEqual(draft.lines,before.lines);assert.deepEqual(project,before);
  let requestBody;
  const client=createStudioClient({fetchImpl:async(url,options)=>{
    assert.equal(url,'/studio/api/project');assert.equal(options.method,'PUT');requestBody=JSON.parse(options.body);
    return Response.json({project:{...requestBody.project,revision:'saved-roulette-binding'}});
  }});
  const saved=await client.save(draft);
  assert.equal(requestBody.expectedRevision,project.revision);assert.equal(saved.revision,'saved-roulette-binding');
  assert.equal(currentClipId(saved,dealer,f.idle,undefined,f.inventory),baseId);
  assert.deepEqual(configuredClipIds(saved,dealer,f.glasses,undefined,f.inventory),[variantId]);
  assert.equal(currentClipId(saved,'vera',f.idle,undefined,f.inventory),'');
});
test('new base clears old mask and variations; removing base never leaves orphan variants',()=>{
  const f=bindingFixture(),draft=bindClip(bindClip(project,f.inventory,dealer,f.idle,baseId),f.inventory,dealer,f.glasses,variantId);
  draft.dealers.find(row=>row.id===dealer).rouletteIdle.foregroundPolygons=[[[0,0],[1,0],[1,1]]];
  assert.deepEqual(bindClip(draft,f.inventory,dealer,f.idle,baseId),draft,'same exact base is idempotent');
  const changed=bindClip(draft,f.inventory,dealer,f.idle,otherId);
  assert.deepEqual(changed.dealers.find(row=>row.id===dealer).rouletteIdle,{videoId:otherId});
  const variantRemoved=unbindRouletteClip(draft,dealer,f.glasses,variantId);
  assert.deepEqual(configuredClipIds(variantRemoved,dealer,f.glasses),[]);assert.equal(currentClipId(variantRemoved,dealer,f.idle),baseId);
  assert.equal(unbindRouletteClip(draft,dealer,f.idle,baseId).dealers.find(row=>row.id===dealer).rouletteIdle,undefined);
});
test('roulette binding rejects wrong dealer, archived media, opaque video, foreign slots and mismatched framing',()=>{
  for(const mutate of [
    f=>f.variant.classification.dealerId='vera',f=>f.variant.classification.archived=true,
    f=>f.variant.classification.compositing={mode:'opaque'},f=>f.variant.contentType='video/mp4',
    f=>f.variant.classification.framing.x=.2,f=>f.variant.available=false,
  ]) {
    const f=bindingFixture(),draft=bindClip(project,f.inventory,dealer,f.idle,baseId);mutate(f);
    assert.throws(()=>bindClip(draft,f.inventory,dealer,f.glasses,variantId));
  }
  const f=bindingFixture();
  assert.throws(()=>bindClip(project,f.inventory,'vera',f.idle,baseId));
  for(const slot of slots.filter(row=>row.intakeOnly))assert.throws(()=>bindClip(project,f.inventory,dealer,slot,baseId),/kan ännu inte kopplas/);
  const draft=bindClip(project,f.inventory,dealer,f.idle,baseId);
  for(let i=0;i<4;i++)f.inventory.videos.push({...structuredClone(f.variant),id:`40000000-0000-4000-8000-00000000000${i}`});
  let next=draft;for(let i=0;i<3;i++)next=bindClip(next,f.inventory,dealer,f.glasses,`40000000-0000-4000-8000-00000000000${i}`);
  assert.throws(()=>bindClip(next,f.inventory,dealer,f.glasses,'40000000-0000-4000-8000-000000000003'),/Högst tre/);
});

test('idle hand calibration binds only the exact saved base, validates shared framing and survives save',async()=>{
  const f=bindingFixture(),draft=bindClip(bindClip(project,f.inventory,dealer,f.idle,baseId),f.inventory,dealer,f.glasses,variantId),before=structuredClone(draft);
  const polygon=[[[.2,.3],[.8,.3],[.7,.5],[.3,.5]]];
  const calibrated=setRouletteIdleForeground(draft,f.inventory,dealer,baseId,JSON.stringify(polygon));
  assert.deepEqual(draft,before);assert.deepEqual(calibrated.lines,before.lines);
  const client=createStudioClient({fetchImpl:async(url,options)=>Response.json({project:{...JSON.parse(options.body).project,revision:'mask-saved'}})});
  const saved=await client.save(calibrated);assert.deepEqual(saved.dealers.find(row=>row.id===dealer).rouletteIdle,{videoId:baseId,variantVideoIds:[variantId],foregroundPolygons:polygon});
  assert.deepEqual(setRouletteIdleForeground(saved,f.inventory,dealer,baseId,'').dealers.find(row=>row.id===dealer).rouletteIdle,{videoId:baseId,variantVideoIds:[variantId]});
  for(const bad of ['not-json','[]','[[[0,0],[1,1],[2,2]]]','[[[0,0],[0,0],[1,1]]]'])assert.throws(()=>setRouletteIdleForeground(draft,f.inventory,dealer,baseId,bad));
  assert.throws(()=>setRouletteIdleForeground(draft,f.inventory,dealer,otherId,JSON.stringify(polygon)));
  assert.throws(()=>setRouletteIdleForeground(draft,f.inventory,'vera',baseId,JSON.stringify(polygon)));
  for(const mutate of [x=>delete x.base.classification.framing,x=>x.variant.classification.framing.x=.4,x=>x.base.available=false,x=>x.variant.classification.game='blackjack']){
    const x=bindingFixture();mutate(x);assert.throws(()=>setRouletteIdleForeground(draft,x.inventory,dealer,baseId,JSON.stringify(polygon)));
  }
  assert.equal(bindClip(calibrated,f.inventory,dealer,f.idle,otherId).dealers.find(row=>row.id===dealer).rouletteIdle.foregroundPolygons,undefined);
});
test('VILA fallback is stable, scoped, editor-only and never takes a blackjack idle',()=>{
  const idle=slots.find(slot=>slot.situation==='breathing'),reference=slots.find(slot=>slot.situation==='VILA');
  const a=video(idle,'a'),b=video(idle,'b'),still=video(reference,'z');
  assert.equal(rouletteReferencePreview({videos:[b,a]},dealer).id,'a');
  assert.equal(rouletteReferencePreview({videos:[a,still]},dealer).id,'z');
  assert.equal(rouletteReferencePreview({videos:[a]},'vera'),null);
  assert.equal(rouletteReferencePreview({videos:[{...a,available:false}]},dealer),null);
  assert.throws(()=>uploadMetadata(project,dealer,reference,file('wrong.mp4'),{mode:'alpha'}),/PNG/);
  assert.throws(()=>uploadMetadata(project,dealer,slots.find(slot=>slot.planned),file('future.mp4'),{mode:'opaque'}),/planerat/);
});
test('native upload rereads exact roulette metadata and rejects changed dealer/game; PNG stops before network',async()=>{
  const slot=slots.find(slot=>slot.situation==='breathing'),item=video(slot,'11111111-1111-4111-8111-111111111111');
  let readback=item,received;
  const client=createStudioClient({fetchImpl:async()=>new Response(JSON.stringify({uploadMode:'private-client-blob',videos:[readback]})),
    uploadImpl:async(f,m,mime)=>{received={m,mime};return {id:item.id};}});
  assert.equal((await client.upload(file('idle.webm'),item.classification)).video.id,item.id);
  assert.equal(received.mime,'video/webm');assert.equal(received.m.game,'roulette');
  for(const patch of [{dealerId:'vera'},{game:undefined},{eventId:'idle.ready'}]){
    readback={...item,classification:{...item.classification,...patch}};
    await assert.rejects(client.upload(file('idle.webm'),item.classification),/exakt kortplats/);
  }
  const png=video(slots.find(slot=>slot.situation==='VILA'),'png');
  const forbidden=createStudioClient({fetchImpl:()=>assert.fail('PNG must not reach API'),uploadImpl:()=>assert.fail('PNG must not reach Blob')});
  await assert.rejects(forbidden.upload(file('vila.png'),png.classification),/PNG.*lokalt/);
});
test('roulette cards allow explicit idle binding while reference and planned cards remain honest',()=>{
  const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const source=readFileSync(new URL('../components/studio/connected-clip-card.tsx',import.meta.url),'utf8');
  const module={exports:{}};
  runInNewContext(require('esbuild').transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
    {module,exports:module.exports,require:name=>{
      if(name==='../../lib/studio-layout.mjs')return {slotCaption,slotExplanation,isRenderedOutcome};
      // Guide behavior has its own coverage in clip-guide.test.mjs.
      if(name==='./clip-guide')return {ClipGuide:()=>null};
      return require(name);
    }});
  const render=(slot,component=module.exports.ConnectedClipDetails)=>{const clips=slot.planned?[]:[video(slot,'a')];return renderToStaticMarkup(React.createElement(component,{data:{
    group:groupSlots([slot])[0],slot,clips,selectedId:'a',boundId:'',boundIds:[],variants:[],variantId:'',busy:false,
    onSelect(){},onSlot(){},onVariant(){},onBind(){},onFile(){},onSettings(){},onOpen(){}}}));};
  const renderCompact=slot=>render(slot,module.exports.ConnectedClipCard);
  const compactImage=renderCompact(slots.find(slot=>slot.situation==='VILA'));
  assert.match(compactImage,/Registrerat · ej spelkopplat/);assert.match(compactImage,/Förhandsvisa och redigera/);
  assert.doesNotMatch(compactImage,/<img|<video|<select|type="file"|Koppla till utkast/);
  const compactFuture=renderCompact(slots.find(slot=>slot.planned));
  assert.match(compactFuture,/Planerat fack/);assert.doesNotMatch(compactFuture,/Kopplat i sparat utkast|Koppla till utkast/);
  const compactIdle=renderCompact(slots.find(slot=>slot.situation==='breathing'));
  assert.match(compactIdle,/Valt för prov · ej kopplat/);assert.match(compactIdle,/Förhandsvisa och redigera/);
  assert.doesNotMatch(compactIdle,/Registrerat · ej spelkopplat|Kopplat i sparat utkast/);
  const compactOutcome=renderCompact(slots.find(slot=>slot.eventId==='roulette.plan.outcome'));
  assert.match(compactOutcome,/Serverstyrt utfall/);assert.match(compactOutcome,/Visa funktion/);
  assert.doesNotMatch(compactOutcome,/Planerat fack|Koppla till utkast|Förhandsvisa och redigera/);
  const image=render(slots.find(slot=>slot.situation==='VILA'));
  assert.match(image,/<img/);assert.match(image,/Registrerat · ej spelkopplat/);assert.doesNotMatch(image,/Koppla till utkast/);
  const future=render(slots.find(slot=>slot.planned));assert.match(future,/Planerat fack/);assert.doesNotMatch(future,/type="file"|Koppla till utkast/);
  const idle=render(slots.find(slot=>slot.situation==='breathing'));
  assert.match(idle,/Koppla till utkast/);assert.match(idle,/Valt för prov · ej kopplat/);assert.doesNotMatch(idle,/Registrerat · ej spelkopplat|aria-label="Inställningar/);
  const glasses=render(slots.find(slot=>slot.situation==='glasses-clean'));assert.match(glasses,/Koppla till utkast/);
  const outcome=render(slots.find(slot=>slot.eventId==='roulette.plan.outcome'));
  assert.match(outcome,/Ritas i spelet · ingen film behövs/);assert.match(outcome,/Spelservern bestämmer/);
  assert.doesNotMatch(outcome,/Planerat fack|Ingen tagning|Spelkoppling återstår|0 filer|type="file"|Koppla till utkast|Förhandsvisa/);
  const start=render(slots.find(slot=>slot.eventId==='roulette.wheel-start'));
  assert.match(start,/Kalibrera startfilm/);assert.doesNotMatch(start,/Koppla till utkast|Registrerat · ej spelkopplat/);
});
