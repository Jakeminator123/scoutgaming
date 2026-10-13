import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createSeedProject} from '../../../../lab/lib/studio-model.mjs';
import {clipSlots,clipsForSlot,bindClip,uploadMetadata,createStudioClient} from './connected-studio.mjs';
import {groupSlots,slotCaption} from './studio-layout.mjs';
import {rouletteReferencePreview} from './roulette-clip-map.mjs';
import {mediaClassification} from '../../../../lab/lib/dealer-media-library.mjs';
const project=createSeedProject(),dealer='astrid';
const slots=clipSlots(project,{videos:[]},dealer,'roulette');
const file=(name)=>({name,size:128});
const video=(slot,id)=>({id,label:id,available:true,integrity:'verified',previewUrl:'/studio/api/videos/'+id,
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
  assert.throws(()=>bindClip(project,bank,dealer,idle,'a'),/Spelkoppling/);
  assert.deepEqual(project,before);
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
test('roulette cards preview images and disclose registration without offering a false runtime binding',()=>{
  const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const source=readFileSync(new URL('../components/studio/connected-clip-card.tsx',import.meta.url),'utf8');
  const module={exports:{}};
  runInNewContext(require('esbuild').transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
    {module,exports:module.exports,require:name=>name==='../../lib/studio-layout.mjs'?{slotCaption}:require(name)});
  const render=slot=>{const clips=slot.planned?[]:[video(slot,'a')];return renderToStaticMarkup(React.createElement(module.exports.ConnectedClipCard,{data:{
    group:groupSlots([slot])[0],slot,clips,selectedId:'a',boundId:'',boundIds:[],variants:[],variantId:'',busy:false,
    onSelect(){},onSlot(){},onVariant(){},onBind(){},onFile(){},onSettings(){}}}));};
  const image=render(slots.find(slot=>slot.situation==='VILA'));
  assert.match(image,/<img/);assert.match(image,/Registrerat · ej spelkopplat/);assert.doesNotMatch(image,/Koppla till utkast/);
  const future=render(slots.find(slot=>slot.planned));assert.match(future,/Planerat fack/);assert.doesNotMatch(future,/type="file"|Koppla till utkast/);
});
