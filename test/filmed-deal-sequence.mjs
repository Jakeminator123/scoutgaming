import test from 'node:test';
import assert from 'node:assert/strict';
import {DRAGAN_KEVIN_PROFILE as profile} from '../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
import {planFilmedDealSequence,orderFilmedPresentationEvents} from '../packages/presentation/runtime/filmed-deal-sequence.mjs';
import {presentationEvents} from '../services/game/partner-presentation.mjs';
const inventory={videos:profile.takes.map(t=>({id:`video-${t.key}`,sha256:t.sha256,available:true,classification:{dealerId:'dragan',kind:'action'}}))};
const box=(box,shoeDraw)=>({type:'deal',to:'box',box,shoeDraw});
const dealer=(shoeDraw,faceDown=false)=>({type:'deal',to:'dealer',box:null,shoeDraw,faceDown});
const flip=shoeDraw=>({type:'reveal',to:'dealer',shoeDraw});
const plan=events=>planFilmedDealSequence({profile,events,inventory,dealerId:'dragan'});
const keys=result=>result.steps.map(step=>step.takeKey);

test('separate shoe clips wrap only REDO boundaries, never embedded VILA returns',()=>{
  const transitions={toShoe:{id:'to'},fromShoe:{id:'from'}};
  const withShoe=events=>planFilmedDealSequence({profile,events,inventory,dealerId:'dragan',transitions});
  const run=withShoe([box(0,1),box(1,2)]);
  assert.deepEqual(keys(run),['1:base','2:base']);
  assert.equal(run.steps[0].beforeVideoId,'to');assert.equal(run.steps[0].afterVideoId,undefined);
  assert.equal(run.steps[1].beforeVideoId,undefined);assert.equal(run.steps[1].afterVideoId,'from');
  const opening=withShoe([box(0,1),dealer(2),dealer(3,true)]);
  assert.deepEqual(keys(opening),['1:base','dealer:base','hole:base']);
  assert.equal(opening.steps.at(-1).afterVideoId,undefined,'hole already returns to VILA');
  const reveal=withShoe([flip(3),dealer(4)]);
  assert.equal(reveal.steps[0].beforeVideoId,undefined);assert.equal(reveal.steps[0].afterVideoId,undefined);
  assert.equal(reveal.steps[1].beforeVideoId,'to');assert.equal(reveal.steps[1].afterVideoId,'from');
  const partial=planFilmedDealSequence({profile,events:[box(0,1)],inventory,dealerId:'dragan',transitions:{toShoe:{id:'to'}}});
  assert.deepEqual(keys(partial),['1:v']);assert.equal(partial.steps[0].beforeVideoId,'to');
});

test('opening run lifts once, joins REDO takes and returns with the filmed hole card',()=>{
  const events=[{type:'speak',line:'goodluck'},box(6,1),box(0,2),dealer(3),box(6,4),box(0,5),dealer(6,true)];
  const before=structuredClone(events),result=plan(events);
  assert.equal(result.complete,true);assert.deepEqual(keys(result),['7:i','1:base','dealer:base','7:base','1:base','hole:base']);
  assert.deepEqual(result.steps.map(s=>s.eventIndex),[1,2,3,4,5,6]);assert.deepEqual(events,before);
  assert.equal(result.steps.at(-1).shoeDraw,6);assert.equal(result.steps.at(-1).type,'deal');
});

test('hit, double, split and dealer turn use terminal VILA takes instead of random same-slot videos',()=>{
  assert.deepEqual(keys(plan([box(0,9)])),['1:iv']);
  assert.deepEqual(keys(plan([{type:'speak',line:'double'},box(3,9)])),['4:iv']);
  assert.deepEqual(keys(plan([box(3,9),box(3,10)])),['4:i','4:v']);
  assert.deepEqual(keys(plan([flip(6),dealer(9),dealer(10)])),['flip:base','dealer:i','dealer:v']);
  assert.deepEqual(keys(plan([dealer(6,true),box(2,9)])),['hole:i','3:iv']);
});

test('speech breaks the pose run and hidden/revealed states never share a take',()=>{
  assert.deepEqual(keys(plan([box(1,3),{type:'speak',line:'twentyone'},box(2,4)])),['2:iv','3:iv']);
  assert.deepEqual(keys(plan([dealer(8,true),flip(8)])),['hole:i','flip:base']);
  const result=plan([{...box(1,1),card:{rank:'A',suit:'S'}}]);
  assert.ok(!JSON.stringify(result).includes('rank'));assert.ok(!JSON.stringify(result).includes('suit'));
});

test('all-or-nothing preparation refuses missing, foreign, archived or unavailable exact media',()=>{
  const events=[box(0,1),box(1,2)],last=profile.takes.find(t=>t.key==='2:v');
  for(const change of [v=>v.available=false,v=>v.classification.dealerId='astrid',v=>v.classification.archived=true,
    v=>v.classification.game='roulette',v=>v.classification.mediaType='audio',v=>v.sha256='0'.repeat(64)]){
    const copy=structuredClone(inventory);change(copy.videos.find(v=>v.sha256===last.sha256));
    assert.deepEqual(planFilmedDealSequence({profile,events,inventory:copy,dealerId:'dragan'}),
      {profileId:profile.id,complete:false,reason:'exact_video_missing',steps:[]});
  }
});

test('duplicate registrations resolve deterministically but duplicate or malformed instructions are rejected',()=>{
  const single=profile.takes.find(t=>t.key==='1:iv');
  const duplicate={...inventory.videos.find(v=>v.sha256===single.sha256),id:'aaa'};
  const result=planFilmedDealSequence({profile,events:[box(0,1)],inventory:{videos:[...inventory.videos,duplicate]},dealerId:'dragan'});
  assert.equal(result.steps[0].videoId,'aaa');
  for(const events of [[box(0,1),box(0,1)],[box(7,1)],[box(0,0)],[{type:'deal',to:'dealer',shoeDraw:1}],[null]]){
    const result=plan(events);assert.equal(result.complete,false);assert.equal(result.reason,'instructions_invalid');assert.deepEqual(result.steps,[]);
  }
  assert.equal(planFilmedDealSequence().reason,'profile_missing');
  assert.equal(planFilmedDealSequence({profile:{},events:[],inventory,dealerId:'dragan'}).reason,'profile_invalid');
});

test('profile selection remains explicit and sequence code does not alter game or dealer state',()=>{
  const snapshot=structuredClone({profile,inventory});
  plan([box(0,1),dealer(2),dealer(3,true)]);
  assert.deepEqual({profile,inventory},snapshot);
  const genericInventory=structuredClone(inventory);for(const video of genericInventory.videos)video.classification.dealerId='another-registered-dealer';
  assert.equal(planFilmedDealSequence({profile,events:[box(0,1)],inventory:genericInventory,dealerId:'another-registered-dealer'}).complete,true);
  assert.equal(planFilmedDealSequence({events:[box(0,1)],inventory,dealerId:'astrid'}).complete,false);
});

test('actual settled double receipt is reordered to the shared player without changing authoritative events',()=>{
  const card=(r,shoeDraw)=>({r,s:'S',shoeDraw});
  const previous={round:{phase:'decisions',active:0,holeDraw:5,dealer:[card('6',3)],hands:[{box:0,stake:10,cards:[card('5',2),card('6',4)]}]}};
  const current=structuredClone(previous);current.round.phase='settled';
  current.round.hands[0].cards.push(card('10',6));current.round.hands[0].result=40;
  current.round.dealer.push(card('9',5),card('5',7));
  const published=presentationEvents(previous,current,'act',{action:'double'}),before=structuredClone(published);
  // The generator now places the reveal after the player's card and before the extra dealer card (K04).
  assert.deepEqual(published.filter(e=>['deal','reveal'].includes(e.type)).map(e=>e.shoeDraw),[6,5,7]);
  const ordered=orderFilmedPresentationEvents(published);
  assert.equal(ordered[0].line,'double');
  assert.deepEqual(ordered.filter(e=>['deal','reveal'].includes(e.type)).map(e=>e.shoeDraw),[6,5,7]);
  assert.deepEqual(keys(plan(ordered)),['1:iv','flip:base','dealer:iv']);
  assert.deepEqual(published,before);
  // An instruction list stored before the fix (reveal first) still gets the same filmed order.
  const stored=[published.find(e=>e.type==='reveal'),...published.filter(e=>e.type!=='reveal')];
  assert.deepEqual(stored.filter(e=>['deal','reveal'].includes(e.type)).map(e=>e.shoeDraw),[5,6,7]);
  assert.deepEqual(orderFilmedPresentationEvents(stored),ordered);
});

test('opening reveal follows the hole while resumed action groups still end in VILA',()=>{
  const input=[flip(5),{type:'speak',line:'goodluck'},box(0,2),dealer(3),box(0,4),dealer(5,true),dealer(6),{type:'settle'}];
  const ordered=orderFilmedPresentationEvents(input);
  assert.deepEqual(ordered.filter(e=>['deal','reveal'].includes(e.type)).map(e=>[e.type,e.shoeDraw]),[['deal',2],['deal',3],['deal',4],['deal',5],['reveal',5],['deal',6]]);
  assert.deepEqual(keys(plan(ordered)),['1:i','dealer:base','1:base','hole:base','flip:base','dealer:iv']);
  assert.deepEqual(keys(plan(orderFilmedPresentationEvents([box(0,6),dealer(7)]))),['1:iv','dealer:iv']);
});
