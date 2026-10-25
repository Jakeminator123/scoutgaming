import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeedProject,addDealer,addVariant,allowedPathDescriptors} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import {kindForEvent} from '../../../../../packages/presentation/contracts/video-intake.mjs';
import {bindSpeechSlotStandard} from '../../../../../packages/presentation/contracts/speech-slot-bindings.mjs';
import {clipSlots,bindClip,currentClipId} from './connected-studio.mjs';
import {addStudioIdleClip} from './studio-policy.mjs';
import {groupSlots,affectedRooms,slotCaption,slotExplanation,isRenderedOutcome,layoutClipCards,clipLibraryGroups,clipLibraryForSlot,clipVariantChoices} from './studio-layout.mjs';

function libraryFixture(eventId,situation,managed=false) {
  const project=createSeedProject(),dealerId='astrid',event=project.events.find(row=>row.id===eventId);
  const ids=[1,2,3].map(n=>`${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`);
  const family={id:`${dealerId}/${eventId}/${situation||'ready'}`,dealerId,eventId,situation:situation||'ready',playbackType:eventId==='idle.ready'?'idle-pool':'once',standardIds:[ids[0]],variantIds:[ids[1]]};
  const inventory={families:managed?[family]:[],videos:ids.map((id,index)=>({id,label:`Klipp ${index}`,available:true,sha256:'a'.repeat(64),contentType:'video/mp4',
    ...(managed?{familyId:family.id}:{}),classification:{label:`Klipp ${index}`,dealerId,eventId,situation,kind:kindForEvent(event),role:index?'alternative':'standard',notes:''}}))};
  const slot=clipSlots(project,inventory,dealerId).find(row=>managed?row.family?.id===family.id:row.eventId===eventId&&row.situation===situation);
  return {project,inventory,dealerId,slot,ids};
}
const libraryRoles=f=>Object.fromEntries(clipLibraryForSlot(f.project,f.inventory,f.dealerId,f.slot).map(group=>[group.id,group.clips.map(clip=>clip.id)]));

test('expanded clip libraries reserve the tallest measured height before the next row',()=>{
  const cards=[{id:'wait',height:294},{id:'ready',height:359},{id:'players',height:310},{id:'dealer',height:320},{id:'reveal',height:294}];
  const expanded=layoutClipCards(cards,1200);
  assert.ok(cards.slice(0,4).every(card=>expanded.reveal.y>expanded[card.id].y+card.height));
  const collapsed=layoutClipCards(cards.map(card=>card.id==='ready'?{...card,height:294}:card),1200);
  assert.ok(collapsed.reveal.y<expanded.reveal.y);
});

test('measured reflow preserves dragged coordinates until layout reset',()=>{
  const cards=[{id:'ready',height:500},{id:'reveal',height:294}];
  const positions={ready:{x:42,y:87},reveal:{x:740,y:19}};
  const before=structuredClone(positions);
  assert.deepEqual(layoutClipCards(cards,390,positions),before);
  assert.deepEqual(layoutClipCards(cards,1200,positions),before);
  assert.deepEqual(positions,before);
  const automatic=layoutClipCards(cards,390,{});
  const partial=layoutClipCards(cards,390,{ready:positions.ready});
  assert.deepEqual(partial.ready,positions.ready);
  assert.deepEqual(partial.reveal,automatic.reveal,'unmoved cards still follow the measured layout');
  assert.ok(automatic.reveal.y>automatic.ready.y+cards[0].height);
  assert.notDeepEqual(automatic.ready,positions.ready,'reset releases a saved manual position');
});

test('invalid measurements use the unmeasured layout and explicit row spacing is honored',()=>{
  const cards=[{id:'a'},{id:'b',height:0},{id:'c',height:NaN},{id:'d',height:-10},{id:'e',height:Infinity},{id:'f',height:500}];
  const unmeasured=cards.map(({id})=>({id}));
  assert.deepEqual(layoutClipCards(cards,1200),layoutClipCards(unmeasured,1200));
  const spaced=layoutClipCards(unmeasured,390,{},440);
  const rows=[...new Set(Object.values(spaced).map(point=>point.y))].sort((a,b)=>a-b);
  assert.ok(rows.length>1);
  for(let index=1;index<rows.length;index++)assert.ok(rows[index]-rows[index-1]>=440);
  assert.ok(Object.values(spaced).every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)));
  assert.deepEqual(layoutClipCards([],390),{});
});

test('visual groups preserve the exact available server slots without requiring fixed group sizes',()=>{
  const slots=clipSlots(createSeedProject(),{videos:[]},'astrid'),groups=groupSlots(slots);
  assert.ok(slots.every(row=>!['turn','settle'].includes(row.sourceType)));
  assert.deepEqual(groups.find(row=>row.id==='speech').slots.map(row=>row.id).sort(),slots.filter(row=>row.sourceType==='speak').map(row=>row.id).sort());
  assert.deepEqual(groups.find(row=>row.id==='players').slots.map(row=>row.id).sort(),slots.filter(row=>row.eventId.startsWith('deal.player.')).map(row=>row.id).sort());
  assert.deepEqual(groups.flatMap(row=>row.slots).map(row=>row.id).sort(),slots.map(row=>row.id).sort());
  for(const slot of groups.find(row=>row.id==='players').slots)assert.equal(slotCaption(slot),`Plats ${Number(slot.situation.slice(3))+1}`);
  const dealer=groups.find(row=>row.id==='dealer');
  assert.ok(dealer.slots.some(row=>row.eventId==='reveal.dealer'));
  assert.ok(dealer.slots.every(row=>!/^box/.test(row.situation)));
  assert.equal(slotCaption(dealer.slots.find(row=>row.eventId==='reveal.dealer')),'Vänd dolt kort');
  assert.match(slotExplanation(dealer.slots.find(row=>row.situation==='dealer-up')),/tredje och senare/);
});

test('visual groups accept a partial clip bank and new speech slots without padding or dropping them',()=>{
  const slots=clipSlots(createSeedProject(),{videos:[]},'astrid');
  const speech=slots.find(row=>row.sourceType==='speak');
  const available=[slots.find(row=>row.eventId.startsWith('deal.player.')),speech,{...speech,id:'speech.custom',situation:'custom',title:'Egen replik'}];
  const before=structuredClone(available),groups=groupSlots(available);
  assert.deepEqual(groups.flatMap(row=>row.slots).map(row=>row.id).sort(),available.map(row=>row.id).sort());
  assert.ok(groups.every(row=>row.slots.length>0),'unavailable groups must not become empty editor panels');
  assert.deepEqual(groupSlots([]),[]);
  assert.deepEqual(available,before);
});

test('library roles come from exact IDs, preserving unassigned clips and separating idle behaviors',()=>{
  const clips=[{id:'one',label:'Basloop'},{id:'two',label:'Standardfil'},{id:'three',label:'Beteendeklipp'}];
  const before=structuredClone(clips);
  assert.deepEqual(clipLibraryGroups(clips,['two'],['three'],true).map(group=>[group.label,group.clips.map(clip=>clip.id)]),[
    ['Basloop',['two']],['Beteendeklipp',['three']],['Beteendeklipp · inte i schemat',['one']],
  ]);
  assert.deepEqual(clipLibraryGroups(clips,['one'],['one','two']).flatMap(group=>group.clips),clips);
  assert.deepEqual(clipLibraryGroups([],['missing']),[]);
  assert.deepEqual(clips,before);
});

test('the library never promotes a transition preview fallback to a saved standard',()=>{
  const f=libraryFixture('transition.shoe','to-shoe');
  f.project=addVariant(f.project,f.dealerId,f.slot.eventId,'Egen tagning');
  const line=f.project.lines.find(row=>row.dealerId===f.dealerId&&row.eventId===f.slot.eventId),variant=line.variants.at(-1);
  variant.videoGenerationId=f.ids[1];variant.selection={rules:true,model:true,random:false};variant.priority=38;
  const descriptor=allowedPathDescriptors.find(row=>row.values?.length&&row.operators.includes('eq'));
  f.project.triggers.push({id:'library.test.trigger',label:'Testvillkor',category:descriptor.category,path:descriptor.path,op:'eq',value:descriptor.values[0]});
  variant.triggerIds=['library.test.trigger'];
  const before=structuredClone(f);
  assert.equal(currentClipId(f.project,f.dealerId,f.slot,line.baselineVariantId,f.inventory),f.ids[1]);
  assert.deepEqual(libraryRoles(f),{variants:[f.ids[1]],library:[f.ids[0],f.ids[2]]});
  assert.deepEqual(f,before);
  variant.selection.rules=false;
  assert.equal(currentClipId(f.project,f.dealerId,f.slot,line.baselineVariantId,f.inventory),f.ids[1]);
  assert.equal(libraryRoles(f).standard,undefined);
  line.variants.find(row=>row.id===line.baselineVariantId).videoGenerationId=f.ids[0];
  assert.deepEqual(libraryRoles(f),{standard:[f.ids[0]],variants:[f.ids[1]],library:[f.ids[2]]});
});

test('library standards follow actual saved player/dealer bindings and do not adopt an alternative if the standard disappears',()=>{
  for(const [eventId,situation] of [['deal.player.left','box0'],['deal.player.centre','box2'],['deal.player.right','box6'],['deal.dealer','dealer-up'],['deal.dealer','dealer-hole'],['reveal.dealer','dealer-hole']]) {
    const f=libraryFixture(eventId,situation);
    f.project=bindClip(f.project,f.inventory,f.dealerId,f.slot,f.ids[0]);
    f.project=addVariant(f.project,f.dealerId,eventId,'Alternativ');
    const line=f.project.lines.find(row=>row.dealerId===f.dealerId&&row.eventId===eventId),variant=line.variants.at(-1);
    variant.videoGenerationId=f.ids[1];variant.selection={rules:true,model:false,random:false};
    assert.deepEqual(libraryRoles(f),{standard:[f.ids[0]],variants:[f.ids[1]],library:[f.ids[2]]},situation);
    f.inventory.videos[0].available=false;
    assert.deepEqual(libraryRoles(f),{variants:[f.ids[1]],library:[f.ids[2]]},situation);
  }
});

test('library idle roles use the saved base and behavior policy',()=>{
  const f=libraryFixture('idle.ready','');
  f.project=addStudioIdleClip(f.project,f.inventory,f.dealerId,f.slot,f.ids[0],2000,true);
  f.project=addStudioIdleClip(f.project,f.inventory,f.dealerId,f.slot,f.ids[1],3000,false);
  assert.deepEqual(libraryRoles(f),{standard:[f.ids[0]],variants:[f.ids[1]],library:[f.ids[2]]});
  assert.deepEqual(clipLibraryForSlot(f.project,f.inventory,f.dealerId,f.slot).map(group=>group.label),['Basloop','Beteendeklipp','Beteendeklipp · inte i schemat']);
});

test('library family roles retain manifest standards when preview selection prefers an active variant',()=>{
  const f=libraryFixture('deal.player.left','box0',true);
  f.project.mediaPolicy=[{familyId:f.slot.family.id,variants:[{videoId:f.ids[1],frequencyPercent:25,selection:{rules:false,model:false,random:false},priority:10,triggerIds:[]}]}];
  assert.equal(currentClipId(f.project,f.dealerId,f.slot,undefined,f.inventory),f.ids[1]);
  assert.deepEqual(libraryRoles(f),{standard:[f.ids[0]],variants:[f.ids[1]]});
});

test('library speech roles retain dedicated and shared exact slot standards',()=>{
  for(const [eventId,situation] of [['speak.goodluck','goodluck'],['speak.other','greeting']]) {
    const f=libraryFixture(eventId,situation);
    f.project=bindSpeechSlotStandard(f.project,{dealerId:f.dealerId,eventId,situation,videoId:f.ids[0]});
    f.project=addVariant(f.project,f.dealerId,eventId,'Talalternativ');
    f.project.lines.find(row=>row.dealerId===f.dealerId&&row.eventId===eventId).variants.at(-1).videoGenerationId=f.ids[1];
    assert.deepEqual(libraryRoles(f),{standard:[f.ids[0]],variants:[f.ids[1]],library:[f.ids[2]]});
  }
});

test('a player situation lists its own saved variants, not neighbouring slot standards',()=>{
  const project=createSeedProject(),slot=clipSlots(project,{videos:[]},'astrid').find(row=>row.situation==='box2');
  const line=project.lines.find(row=>row.dealerId==='astrid'&&row.eventId===slot.eventId);
  const base=line.variants.find(row=>row.id===line.baselineVariantId);
  const videos=['box2','box3','box4','box2'].map((situation,index)=>({id:`clip-${index}`,available:true,classification:{label:`Klipp ${index}`,dealerId:'astrid',eventId:slot.eventId,situation,kind:'action',role:'alternative',notes:''}}));
  line.variants=[base,...videos.map((video,index)=>({...base,id:index===3?'nod':`astrid.${slot.eventId}.slot.${video.classification.situation}`,label:index===3?'Nickning':video.classification.situation,videoGenerationId:video.id}))];
  const before=structuredClone(project);
  assert.deepEqual(clipVariantChoices(project,{videos},'astrid',slot).map(row=>[row.id,row.baseline]),[[base.id,true],['nod',false]]);
  assert.deepEqual(project,before);
  line.variants.push({...base,id:'empty-alternative',label:'Ny variant',videoGenerationId:null});
  assert.ok(clipVariantChoices(project,{videos},'astrid',slot).some(row=>row.id==='empty-alternative'));
  const idle=clipSlots(project,{videos:[]},'astrid').find(row=>row.eventId==='idle.ready');
  assert.deepEqual(clipVariantChoices(project,{videos},'astrid',idle),[]);
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
  const componentRequire=createRequire(new URL('../components/studio/connected-clip-card.tsx',import.meta.url));
  const module={exports:{}};
  runInNewContext(require('esbuild').transformSync(readFileSync(new URL('../components/studio/connected-clip-card.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
    {module,exports:module.exports,require:name=>{
      if(name==='../../lib/studio-layout.mjs')return {slotCaption,slotExplanation,isRenderedOutcome};
      // Intake drag targets have their own coverage in clip-intake.test.mjs.
      if(name==='../../lib/clip-intake.mjs')return {INTAKE_DRAG_TYPE:'application/x-scout-intake'};
      // Guide behavior has its own coverage in clip-guide.test.mjs.
      if(name==='./clip-guide')return {ClipGuide:()=>null};
      if(name==='../../../../components/clip-pose-chain.mjs')return require('../../../components/clip-pose-chain.mjs');
      return componentRequire(name);
    }});
  const slot=clipSlots(createSeedProject(),{videos:[]},'astrid').find(row=>row.eventId==='idle.ready');
  const clips=[{id:'bound',label:'Sparad film'},{id:'selected',label:'En annan exakt tagning',contentType:'video/mp4',sha256:'a'.repeat(64)}];
  const data={group:groupSlots([slot])[0],slot,clips,selectedId:'selected',boundId:'bound',boundIds:['bound'],variants:[],variantId:'',busy:false,
    onSelect(){},onSlot(){},onVariant(){},onBind(){},onFile(){},onSettings(){}};
  const render=patch=>renderToStaticMarkup(React.createElement(module.exports.ConnectedClipDetails,{data:{...data,...patch}}));
  const unbound=render({});assert.match(unbound,/Situation/);assert.match(unbound,/Valt klipp/);assert.match(unbound,/Körregel · projektutkast/);
  assert.match(unbound,/En annan exakt tagning/);assert.match(unbound,/Valt för prov · ej kopplat/);assert.match(unbound,/Koppla till utkast/);assert.doesNotMatch(unbound,/Kopplat i sparat utkast/);
  assert.match(unbound,/video\/mp4/);assert.ok(unbound.includes('a'.repeat(64)));
  const usage={configured:true,when:'Teknisk källa: event.type=idle',rules:['Automatiskt var 27 s.']};
  const saved=render({usage});assert.match(saved,/Kopplat i sparat utkast/);assert.match(saved,/Automatiskt var 27 s/);assert.doesNotMatch(saved,/Koppla till utkast/);
  assert.match(saved,/Teknisk källa: event.type=idle/);assert.doesNotMatch(saved.replace(/<details[\s\S]*?<\/details>/g,''),/event.type/);
  assert.match(saved,/Dealern väntar mellan spelhändelserna/);
  assert.match(saved,/Redigera körregel/);assert.doesNotMatch(saved,/Publicerad/);
  const compact=renderToStaticMarkup(React.createElement(module.exports.ConnectedClipCard,{data:{...data,onOpen(){}}}));
  assert.match(compact,/Förhandsvisa och redigera/);assert.match(compact,/En annan exakt tagning/);
  const variants=[{id:'pose-i',label:'Pose I'},{id:'pose-iv',label:'Pose IV'},{id:'take-2',label:'Tagning 2'}];
  const detail=render({variants,variantId:'pose-iv'});
  for(const variant of variants)assert.ok(detail.includes(variant.id)&&detail.includes(variant.label));
  assert.match(detail,/Klippförhandsvisning/);assert.match(detail,/inte ett prov i spelmotorn/);assert.match(detail,/value="pose-iv" selected=""/);
  const explicitSlot=clipSlots(createSeedProject(),{videos:[]},'astrid').find(row=>row.id==='deal.player.left/box0');
  const explicit={slot:explicitSlot,group:groupSlots([explicitSlot])[0],variants,variantId:'pose-iv',boundIds:['bound','selected'],usage};
  const otherVariant=render(explicit);
  assert.match(otherVariant,/Valt för prov · ej kopplat till vald variant/);
  assert.match(otherVariant,/Koppla till utkast/);assert.doesNotMatch(otherVariant,/Kopplat i sparat utkast/);
  const exactVariant=render({...explicit,selectedId:'bound'});
  assert.match(exactVariant,/Kopplat i sparat utkast/);assert.doesNotMatch(exactVariant,/Koppla till utkast/);
  for(const direction of ['to-shoe','from-shoe']){
    const shoe=clipSlots(createSeedProject(),{videos:[]},'astrid').find(row=>row.id===`transition.shoe/${direction}`);
    const shoeData={slot:shoe,group:groupSlots([shoe])[0]};
    assert.match(render(shoeData),/Lägg till som variant/);
    assert.doesNotMatch(render({...shoeData,boundId:''}),/Lägg till som variant/);
    assert.doesNotMatch(render({...shoeData,boundIds:['bound','selected']}),/Lägg till som variant/);
  }
  const renderCompact=patch=>renderToStaticMarkup(React.createElement(module.exports.ConnectedClipCard,{data:{...data,...explicit,...patch,onOpen(){}}}));
  assert.match(renderCompact({}),/Valt för prov · ej kopplat till vald variant/);
  assert.doesNotMatch(renderCompact({}),/Kopplat i sparat utkast/);
  assert.match(renderCompact({selectedId:'bound'}),/Kopplat i sparat utkast/);
  const dealClip=poses=>({...clips[1],classification:{dealerId:'astrid',eventId:'deal.player.left',situation:'box0',kind:'action',...poses}});
  assert.match(render({...explicit,clips:[dealClip({startPose:'VILA',endPose:'REDO'})]}),/Poskedja <strong>VILA → REDO<\/strong>/);
  assert.match(render({...explicit,clips:[dealClip({})]}),/Poskedja ej angiven/);
  assert.doesNotMatch(unbound,/Poskedja/);
  const dirty=render({usage,usageChanged:true});assert.match(dirty,/Ändrat lokalt · ej sparat/);assert.doesNotMatch(dirty,/Kopplat i sparat utkast/);
  const recorded={...clips[1],classification:{recordedSpeech:{exactText:'Tack för spelet.',language:'sv'}}};
  const speech=render({clips:[recorded],library:clipLibraryGroups([recorded],['selected'])});
  assert.match(speech,/Inspelat tal · originalets ljud/);assert.match(speech,/Tack för spelet\./);assert.match(speech,/Språk: sv/);
  assert.doesNotMatch(unbound,/Inspelat tal · originalets ljud/);
  assert.match(speech,/Standardklipp/);assert.match(speech,/aria-pressed="true"/);
});
