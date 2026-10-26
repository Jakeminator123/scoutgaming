import test from 'node:test';
import assert from 'node:assert/strict';
import {PAOW_KEVIN_PROFILE as profile} from '../packages/presentation/contracts/filmed-profiles/kevin-paow-c7138759.mjs';
import {registeredFilmedProfile} from '../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {validateFilmedDealProfile,filmedFaceAtTime} from '../packages/presentation/contracts/filmed-profile.mjs';
import {bindFilmedBank,bindNativeFilmedBank,nativeFilmedBankState,filmedBankState,hasEmbeddedShoeTransitions} from '../packages/presentation/contracts/filmed-bank-bindings.mjs';
import {createEmptyProject,addDealer,validateProject,defaultPresentationLane} from '../packages/presentation/contracts/studio-model.mjs';
import {captureFrozenPresentation} from '../packages/presentation/server/frozen-presentation-capture.mjs';
import {createStudioProjectBindings} from '../packages/presentation/server/studio-project-bindings.mjs';
import {planFilmedDealSequence,orderFilmedPresentationEvents} from '../packages/presentation/runtime/filmed-deal-sequence.mjs';
import {filmedDealSelection} from '../services/game/filmed-deal-selection.mjs';
import {bindClip,clipSlots,configuredClipIds} from '../apps/studio/client/admin/lib/connected-studio.mjs';
import source from '../apps/studio/lib/dealer-import-kevin-source-paow.json' with {type:'json'};

function fixture(){
 const project=addDealer(addDealer(createEmptyProject(),'astrid','Astrid'),'paow','PAOW');
 const inventory={families:[],videos:profile.takes.map((take,i)=>{
  const box=Number(take.target)-1,eventId=take.target==='flip'?'reveal.dealer':['dealer','hole'].includes(take.target)?'deal.dealer':box<2?'deal.player.left':box<5?'deal.player.centre':'deal.player.right';
  return {id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,dealer:'paow',sha256:take.sha256,bytes:1000,available:true,integrity:'verified',
   classification:{dealerId:'paow',kind:'action',eventId,situation:['hole','flip'].includes(take.target)?'dealer-hole':take.target==='dealer'?'dealer-up':'box'+box,role:'alternative',label:take.key,notes:''}};
 })};
 return {project,inventory};
}
const box=(shoeDraw,seat=0)=>({type:'deal',to:'box',box:seat,shoeDraw,faceDown:false});
const dealer=(shoeDraw,faceDown=false)=>({type:'deal',to:'dealer',shoeDraw,faceDown});

test('PAOW binds 35 original films and all 18 original tracks, including the hidden card',()=>{
 assert.equal(registeredFilmedProfile('paow'),profile);
 assert.equal(validateFilmedDealProfile(profile),profile);
 assert.equal(profile.source.commit,source.ref);
 assert.equal(profile.takes.length,35);assert.equal(Object.keys(profile.tracks).length,18);
 for(const take of profile.takes){
  const original=source.files.find(row=>row.path===take.repositoryPath);
  assert.equal(take.sha256,original.sha256);
  assert.equal(take.frames,source.poseMetadata.frames[take.target]['-'+take.variant]);
  assert.equal(take.landFrame,source.runtime.ready.land[take.track]+take.offsetFrames);
 }
 assert.ok(hasEmbeddedShoeTransitions('paow'));
 assert.ok(!hasEmbeddedShoeTransitions('astrid'));
 assert.equal(filmedFaceAtTime(profile,profile.takes.find(t=>t.key==='hole:i'),38/24),profile.tracks.hole.frames[0]);
 const first=profile.takes.find(t=>t.key==='1:i');
 assert.equal(filmedFaceAtTime(profile,first,44/24),null);
 assert.equal(filmedFaceAtTime(profile,first,45/24),profile.tracks['1'].frames[0]);
 assert.equal(profile.takes.find(t=>t.key==='1:iv').track,'1v');
 assert.equal(profile.takes.find(t=>t.key==='dealer:v').releaseFrame,25);
 assert.equal(profile.takes.find(t=>t.key==='dealer:iv').releaseFrame,46);
 assert.equal(profile.takes.find(t=>t.key==='flip:base').releaseFrame,35);
 assert.ok(!profile.takes.some(t=>['u','iu'].includes(t.variant)));
});

test('the saved bank is complete, idempotent and never random; other dealers remain unchanged',()=>{
 const {project,inventory}=fixture(),before=structuredClone(project),bound=bindFilmedBank(project,inventory,'paow');
 assert.deepEqual(project,before);assert.equal(validateProject(bound),bound);
 const refs=bound.lines.filter(l=>l.dealerId==='paow').flatMap(l=>l.variants.filter(v=>v.videoGenerationId));
 assert.equal(refs.length,35);assert.ok(refs.every(v=>Object.values(v.selection).every(value=>value===false)));
 assert.deepEqual(bound.lines.filter(l=>l.dealerId!=='paow'),before.lines.filter(l=>l.dealerId!=='paow'));
 assert.deepEqual(bindFilmedBank(bound,inventory,'paow'),bound);
 const slot=clipSlots(project,inventory,'paow').find(s=>s.id==='deal.player.centre/box3');
 const clicked=inventory.videos.find(v=>v.classification.situation==='box3');
 assert.deepEqual(bindClip(project,inventory,'paow',slot,clicked.id),bound);
 assert.equal(configuredClipIds(bound,'paow',slot,undefined,inventory).length,4);
});

test('wrong ownership, placement, archived media or missing exact bytes cannot activate a partial bank',()=>{
 for(const change of [v=>v.classification.dealerId='astrid',v=>v.classification.situation='box6',v=>v.classification.archived=true,
  v=>v.classification.game='roulette',v=>v.available=false,v=>v.sha256='0'.repeat(64)]){
  const {project,inventory}=fixture();change(inventory.videos[0]);
  assert.equal(filmedBankState(inventory,'paow').complete,false);
  assert.throws(()=>bindFilmedBank(project,inventory,'paow'),/saknar verifierade/);
  assert.ok(project.lines.every(l=>l.variants.every(v=>!v.videoGenerationId)));
 }
});

test('identical hole/flip aliases keep one canonical source name without activating both registrations',()=>{
 const {project,inventory}=fixture(),original=inventory.videos.find(v=>v.classification.eventId==='reveal.dealer');
 original.classification.label='flip';
 const alias={...structuredClone(original),id:'00000000-0000-4000-8000-000000000000',classification:{...original.classification,label:'flip-i'}};
 inventory.videos.push(alias);
 const state=filmedBankState(inventory,'paow');assert.equal(state.entries.find(e=>e.take.target==='flip').video.id,original.id);
 const slot=clipSlots(project,inventory,'paow').find(s=>s.eventId==='reveal.dealer');
 const bound=bindClip(project,inventory,'paow',slot,alias.id);
 assert.deepEqual(configuredClipIds(bound,'paow',slot,undefined,inventory),[original.id]);
});

test('opening, single hit and post-hole draw choose connected poses without a duplicate shoe transition',()=>{
 const {project,inventory}=fixture(),bound=bindFilmedBank(project,inventory,'paow');
 const sequences=[
  {events:[box(1),dealer(2),box(3),dealer(4,true)],keys:['1:i','dealer:base','1:base','hole:base']},
  {events:[box(5,3)],keys:['4:iv']},
  {events:[dealer(4,true),box(5,6)],keys:['hole:i','7:iv']},
  {events:[{type:'reveal',to:'dealer',shoeDraw:4},dealer(6)],keys:['flip:base','dealer:iv']},
 ];
 for(const {events,keys} of sequences){
  const plan=planFilmedDealSequence({profile,events,inventory,dealerId:'paow'});
  assert.equal(plan.complete,true);assert.deepEqual(plan.steps.map(s=>s.takeKey),keys);
  assert.ok(plan.steps.every(s=>!s.beforeVideoId&&!s.afterVideoId));
  for(const event of events){
   const selection=filmedDealSelection({project:bound,inventory,dealerId:'paow',sourceEvent:event,published:events,shoeTransitions:true});
   assert.ok(selection.filmedTake);assert.equal(selection.transitions.before,null);assert.equal(selection.transitions.after,null);
  }
 }
 const events=orderFilmedPresentationEvents([{type:'reveal',to:'dealer',shoeDraw:4},box(5),dealer(6)]);
 assert.equal(events[0].to,'box');
});

test('empty separate shoe cards disappear for an embedded bank; explicit existing shoe bindings remain visible',()=>{
 const {project,inventory}=fixture();
 assert.ok(!clipSlots(project,inventory,'paow').some(s=>s.eventId==='transition.shoe'));
 assert.ok(clipSlots(project,inventory,'astrid').some(s=>s.eventId==='transition.shoe'));
 project.lines.find(l=>l.dealerId==='paow'&&l.eventId==='transition.shoe').variants[0].videoGenerationId='existing-shoe';
 assert.equal(clipSlots(project,inventory,'paow').filter(s=>s.eventId==='transition.shoe').length,2);
});

test('server validation and frozen publication retain all 35 films even with ordinary selectors disabled',async()=>{
 const {project,inventory}=fixture(),bound=bindFilmedBank(project,inventory,'paow');
 bound.revision='studio-00000000-0000-4000-8000-000000000100';
 const lane=defaultPresentationLane('paow');lane.id='paow-fixture';bound.lanes=[lane];
 const id='00000000-0000-4000-8000-000000000100';
 inventory.videos.push({id,dealer:'paow',sha256:'a'.repeat(64),bytes:1000,available:true,integrity:'verified',classification:{dealerId:'paow',eventId:'idle.ready',situation:'',kind:'idle',role:'alternative',label:'Synthetic idle',notes:''}});
 bound.lines.find(l=>l.dealerId==='paow'&&l.eventId==='idle.ready').variants[0].videoGenerationId=id;
 const media=inventory.videos.map(video=>({id:video.id,sha256:video.sha256,size:1000,contentType:'video/mp4',classification:video.classification,
  pathname:`croupier/media/dealers/paow/review/uploads/${video.id}/${video.sha256}.mp4`}));
 await createStudioProjectBindings({videoRegistry:async()=>inventory})(bound);
 const {presentation}=captureFrozenPresentation({snapshot:{projectDocument:{kind:'project',revision:bound.revision,value:bound},
  administrationDocument:{kind:'administration',revision:'admin-fixture',value:{rooms:[]}},mediaRows:media.map(row=>({...row,revision:'media-fixture'}))},
  inventory,selectedLaneIds:[lane.id],requiredIdleDealerIds:['paow']});
 assert.equal(presentation.playback.media.length,36);
 assert.ok(profile.takes.every(take=>presentation.playback.media.some(video=>video.sha256===take.sha256)));
});


function shoeFixture(){
 const f=fixture();
 for(const [index,situation] of ['to-shoe','from-shoe'].entries()){
  const video={id:`00000000-0000-4000-8000-${String(201+index).padStart(12,'0')}`,sha256:String(8+index).repeat(64),bytes:2048,
   available:true,integrity:'verified',classification:{dealerId:'paow',kind:'action',eventId:'transition.shoe',situation,
    startPose:index?'REDO':'VILA',endPose:index?'VILA':'REDO',role:'standard',label:situation,notes:''}};
  f.inventory.videos.push(video);
  const slot=clipSlots(f.project,f.inventory,'paow').find(row=>row.id===`transition.shoe/${situation}`);
  assert.ok(slot,'compatible inventory makes the separate shoe slot selectable before any binding');
  f.project=bindClip(f.project,f.inventory,'paow',slot,video.id);
 }
 return f;
}

test('explicit native bank binding accepts reachable originals and preserves unrelated drafts and legacy full-bank behavior',()=>{
 const f=shoeFixture(),coverage=nativeFilmedBankState(f.project,f.inventory,'paow');
 assert.equal(coverage.complete,true);assert.ok(coverage.entries.length<profile.takes.length);
 const ids=new Set(coverage.entries.map(row=>row.video.id));
 f.inventory.videos=f.inventory.videos.filter(row=>ids.has(row.id)||row.classification.eventId==='transition.shoe');
 const before=structuredClone(f.project),inventoryBefore=structuredClone(f.inventory);
 assert.equal(filmedBankState(f.inventory,'paow').complete,false);
 assert.throws(()=>bindFilmedBank(f.project,f.inventory,'paow'),/saknar verifierade/);
 const bound=bindNativeFilmedBank(f.project,f.inventory,'paow');
 const refs=bound.lines.filter(row=>row.dealerId==='paow'&&row.eventId!=='transition.shoe').flatMap(row=>row.variants.map(variant=>variant.videoGenerationId).filter(Boolean));
 assert.deepEqual(new Set(refs),ids);assert.equal(refs.length,ids.size);
 assert.deepEqual(f.project,before);assert.deepEqual(f.inventory,inventoryBefore);
 assert.deepEqual(bound.lines.filter(row=>row.dealerId!=='paow'||row.eventId==='transition.shoe'),before.lines.filter(row=>row.dealerId!=='paow'||row.eventId==='transition.shoe'));
 assert.deepEqual(bindNativeFilmedBank(bound,f.inventory,'paow'),bound);
 const existing=bound.lines.find(row=>row.eventId==='deal.player.left'&&row.dealerId==='paow').variants.find(row=>row.videoGenerationId);
 existing.label='Mitt granskade utkast';existing.priority=2;
 assert.deepEqual(bindNativeFilmedBank(bound,f.inventory,'paow'),bound,'existing bindings and their author settings remain unchanged');
});

test('native binding rejects wrong exact bytes, owner, unavailable media and broken selected shoe directions without editing',()=>{
 for(const change of [row=>row.sha256='a'.repeat(64),row=>row.classification.dealerId='astrid',row=>row.available=false]){
  const f=shoeFixture(),needed=nativeFilmedBankState(f.project,f.inventory,'paow').entries[0].video;
  change(needed);const before=structuredClone(f.project);
  assert.throws(()=>bindNativeFilmedBank(f.project,f.inventory,'paow'),/saknar verifierade/);
  assert.deepEqual(f.project,before);
 }
 for(const change of [row=>row.available=false,row=>row.integrity='unavailable',row=>row.classification.dealerId='astrid',row=>row.classification.startPose='REDO']){
  const f=shoeFixture(),shoe=f.inventory.videos.find(row=>row.classification.situation==='to-shoe');
  change(shoe);const before=structuredClone(f.project);
  assert.throws(()=>bindNativeFilmedBank(f.project,f.inventory,'paow'),/valt skoklipp/);
  assert.deepEqual(f.project,before);
 }
 const f=shoeFixture(),line=f.project.lines.find(row=>row.dealerId==='paow'&&row.eventId==='transition.shoe');
 line.variants.find(row=>row.id.endsWith('.slot.to-shoe')).videoGenerationId='missing-selected';
 assert.throws(()=>bindNativeFilmedBank(f.project,f.inventory,'paow'),/valt skoklipp/);
});

test('removing a saved shoe direction restores the embedded take requirement without discarding previous bindings',()=>{
 const f=shoeFixture(),full=structuredClone(f.inventory),needed=nativeFilmedBankState(f.project,f.inventory,'paow');
 const ids=new Set(needed.entries.map(row=>row.video.id));
 f.inventory.videos=f.inventory.videos.filter(row=>ids.has(row.id)||row.classification.eventId==='transition.shoe');
 const bound=bindNativeFilmedBank(f.project,f.inventory,'paow');
 bound.lines.find(row=>row.dealerId==='paow'&&row.eventId==='transition.shoe').variants.find(row=>row.id.endsWith('.slot.to-shoe')).videoGenerationId=null;
 const before=structuredClone(bound);
 assert.throws(()=>bindNativeFilmedBank(bound,f.inventory,'paow'),/saknar verifierade/);
 const repaired=bindNativeFilmedBank(bound,full,'paow');
 const actual=nativeFilmedBankState(repaired,full,'paow');assert.equal(actual.complete,true);
 assert.ok(actual.entries.some(row=>!ids.has(row.video.id)),'embedded entry variants are now necessary');
 for(const line of before.lines)for(const variant of line.variants){
  assert.deepEqual(repaired.lines.find(row=>row.dealerId===line.dealerId&&row.eventId===line.eventId).variants.find(row=>row.id===variant.id),variant);
 }
});

test('embedded profiles expose shoe slots only for compatible inventory or existing saved references',()=>{
 for(const change of [row=>row.available=false,row=>row.classification.dealerId='astrid',row=>row.classification.startPose='REDO']){
  const f=shoeFixture();f.project=fixture().project;
  f.inventory.videos=f.inventory.videos.filter(row=>row.classification.situation!=='from-shoe');
  change(f.inventory.videos.find(row=>row.classification.situation==='to-shoe'));
  assert.equal(clipSlots(f.project,f.inventory,'paow').some(row=>row.eventId==='transition.shoe'),false);
 }
});

test('native binding fills an empty canonical reference without replacing its author settings',()=>{
 const f=shoeFixture(),bound=bindNativeFilmedBank(f.project,f.inventory,'paow');
 const line=bound.lines.find(row=>row.dealerId==='paow'&&row.eventId==='deal.player.left');
 const variant=line.variants.find(row=>row.id==='paow.deal.player.left.filmed.1.base'),videoId=variant.videoGenerationId;
 variant.videoGenerationId=null;variant.label='Saved author label';variant.priority=2;
 variant.selection={rules:true,random:false,model:false};
 const before=structuredClone(bound),expected={...structuredClone(variant),videoGenerationId:videoId};
 validateProject(bound);
 const repaired=bindNativeFilmedBank(bound,f.inventory,'paow');
 assert.deepEqual(repaired.lines.find(row=>row.dealerId==='paow'&&row.eventId===line.eventId).variants.find(row=>row.id===variant.id),expected);
 assert.deepEqual(bound,before);
 variant.videoGenerationId='another-existing-video';
 assert.throws(()=>bindNativeFilmedBank(bound,f.inventory,'paow'),/sparad givkoppling/);
});
