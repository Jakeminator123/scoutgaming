import test from 'node:test';
import assert from 'node:assert/strict';
import {PAOW_KEVIN_PROFILE as profile} from '../packages/presentation/contracts/filmed-profiles/kevin-paow-c7138759.mjs';
import {registeredFilmedProfile} from '../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {validateFilmedDealProfile,filmedFaceAtTime} from '../packages/presentation/contracts/filmed-profile.mjs';
import {bindFilmedBank,filmedBankState,hasEmbeddedShoeTransitions} from '../packages/presentation/contracts/filmed-bank-bindings.mjs';
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
