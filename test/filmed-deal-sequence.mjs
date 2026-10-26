import test from 'node:test';
import assert from 'node:assert/strict';
import {DRAGAN_KEVIN_PROFILE as profile} from '../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
import {planFilmedDealSequence,orderFilmedPresentationEvents} from '../packages/presentation/runtime/filmed-deal-sequence.mjs';
import {timeFilmedDealSequence,planFilmedTimeline,filmedStepPhase,FILMED_TAKE_GAP_MS,FILMED_OPEN_LEAD_MS} from '../packages/presentation/runtime/filmed-deal-timeline.mjs';
import {presentationEvents} from '../services/game/partner-presentation.mjs';
import {readFileSync} from 'node:fs';
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

// Kevin's per-take timeline (K server/shared-table.mjs:114-135 readyTimeline) on main's plan: times come
// from the profile's frame counts at its fps, joins are back to back, the game window is never moved.
const fps=profile.plane.fps,frameMs=frames=>frames*1000/fps,takeOf=key=>profile.takes.find(t=>t.key===key);
const timeline=(events,timing={})=>planFilmedTimeline({profile,dealerId:'dragan',events,...timing});
// material-revision.mjs on this profile: cardMs = longest deal take + 80, leadMs = 1500 + longest flip + 80.
const materialCardMs=Math.ceil(Math.max(...profile.takes.filter(t=>t.target!=='flip').map(t=>frameMs(t.frames))))+80;
const materialLeadMs=1500+Math.ceil(Math.max(...profile.takes.filter(t=>t.target==='flip').map(t=>frameMs(t.frames))))+80;

test('each planned step gets its own time from the take frames and REDO joins chain back to back',()=>{
  const events=[{type:'speak',line:'goodluck'},box(6,1),box(0,2),dealer(3),box(6,4),box(0,5),dealer(6,true)];
  const draws=6,result=timeline(events,{startAt:1000,endAt:1000+materialLeadMs+draws*materialCardMs});
  assert.equal(result.complete,true);assert.equal(result.leadMs,FILMED_OPEN_LEAD_MS.deal);assert.equal(result.fps,fps);
  assert.deepEqual(result.steps.map(s=>s.takeKey),['7:i','1:base','dealer:base','7:base','1:base','hole:base']);
  assert.deepEqual(result.steps.map(s=>s.durationMs),[66,39,39,39,39,39].map(frameMs));
  let at=FILMED_OPEN_LEAD_MS.deal;
  for(const step of result.steps){assert.equal(step.startMs,at);assert.equal(step.endMs,at+step.durationMs);at=step.endMs+step.gapAfterMs;}
  assert.deepEqual(result.steps.map(s=>[s.joinBefore,s.joinAfter]),[[false,true],[true,true],[true,true],[true,true],[true,true],[true,false]]);
  assert.deepEqual(result.steps.map(s=>s.gapAfterMs),[0,0,0,0,0,FILMED_TAKE_GAP_MS],'80 ms only after a take that does not join (K :132)');
  assert.equal(result.realEndMs,at);assert.equal(result.windowMs,materialLeadMs+draws*materialCardMs);assert.equal(result.endAt,1000+result.windowMs);
  assert.ok(result.deviationMs<0,'the real chain ends inside the configured window');assert.equal(result.fit,null);
  // the published instruction index maps to its step, speech has none
  assert.deepEqual([...result.eventIndex.keys()],[1,2,3,4,5,6]);assert.equal(result.eventIndex.get(1).takeKey,'7:i');
  // handover on the last 1.5 frames (K app.js:192), never before the card has cleared the hand
  assert.equal(result.steps[0].handoverMs,frameMs(66-1.5));assert.equal(result.steps[1].handoverMs,frameMs(39-1.5));
  assert.deepEqual([result.steps[1].faceMs,result.steps[1].contactMs,result.steps[1].landMs,result.steps[1].clearMs],[24,26,29,29].map(frameMs));
});

test('a plan that opens on the flip leads 1500 ms, a VILA take leaves the 80 ms gap and a late clear delays the handover',()=>{
  const result=timeline([flip(6),dealer(9),dealer(10)],{startAt:0,endAt:20000});
  assert.deepEqual(result.steps.map(s=>s.takeKey),['flip:base','dealer:i','dealer:v']);assert.equal(result.leadMs,FILMED_OPEN_LEAD_MS.reveal);
  assert.deepEqual(result.steps.map(s=>s.startMs),[1500,1500+frameMs(39)+FILMED_TAKE_GAP_MS,1500+frameMs(39)+FILMED_TAKE_GAP_MS+frameMs(66)]);
  assert.deepEqual(result.steps.map(s=>s.gapAfterMs),[FILMED_TAKE_GAP_MS,0,FILMED_TAKE_GAP_MS]);
  const last=takeOf('dealer:v');assert.equal(result.steps[2].handoverMs,frameMs(last.clearFrame+1),'clearFrame 37 of 39: the card clears after the 1.5-frame mark');
  // the coordinator's own window: a reveal is not a draw (draws = deal steps)
  const window=timeFilmedDealSequence(planFilmedDealSequence({profile,events:[flip(6),dealer(9)],inventory,dealerId:'dragan'}),profile,{leadMs:materialLeadMs,cardMs:materialCardMs});
  assert.equal(window.windowMs,materialLeadMs+materialCardMs);assert.equal(window.deviationMs,window.realEndMs-window.windowMs);
  assert.ok(window.deviationMs<=0,'flip + one dealer take fit the material window exactly');
});

test('the full seven-box opening never exceeds the window material-revision derives from the same takes (G3)',()=>{
  const events=[{type:'speak',line:'goodluck'}];let draw=1;
  for(let box=0;box<7;box++)events.push({type:'deal',to:'box',box,shoeDraw:draw++});events.push(dealer(draw++));
  for(let box=0;box<7;box++)events.push({type:'deal',to:'box',box,shoeDraw:draw++});events.push(dealer(draw++,true));
  const result=timeline(events,{startAt:5000,leadMs:materialLeadMs,cardMs:materialCardMs});
  assert.equal(result.steps.length,16);assert.equal(result.windowMs,materialLeadMs+16*materialCardMs);
  assert.ok(result.realEndMs<result.windowMs);assert.equal(result.deviationMs,result.realEndMs-result.windowMs);assert.equal(result.fit,null);
});

test('a chain longer than the game window reports deviation and a fit rate instead of moving the deadline',()=>{
  const real=timeline([box(0,9)],{startAt:1000,endAt:4000});
  assert.equal(real.steps[0].takeKey,'1:iv');assert.equal(real.realEndMs,700+frameMs(66)+FILMED_TAKE_GAP_MS);assert.equal(real.deviationMs,real.realEndMs-3000);
  const expectedRate=frameMs(66)/(3000-700-FILMED_TAKE_GAP_MS);
  assert.ok(Math.abs(real.fit.rate-expectedRate)<1e-9&&real.fit.rate>1&&real.fit.rate<2);assert.equal(real.fit.residualMs,0);
  assert.ok(Math.abs(real.fit.endMs-3000)<1e-9,'at the fitted rate the chain ends exactly on the window');
  assert.equal(real.steps[0].startMs,700);assert.equal(real.steps[0].endMs,700+frameMs(66),'real times stay real');
  assert.deepEqual(real.steps[0].fit,{rate:real.fit.rate,durationMs:frameMs(66)/real.fit.rate,startMs:700,endMs:700+frameMs(66)/real.fit.rate});
  assert.equal(real.endAt,4000,'the deadline is the game window, untouched');
  const clamped=timeline([box(0,9)],{startAt:1000,endAt:3000});
  assert.equal(clamped.fit.rate,2,'Kevin clamps the rate to 2 (K app.js:225)');assert.equal(clamped.fit.residualMs,clamped.fit.endMs-2000);
  assert.ok(clamped.fit.residualMs>0);assert.equal(clamped.deviationMs,clamped.realEndMs-2000);
  assert.equal(timeline([box(0,9)],{startAt:1000}).windowMs,null,'no window, no deviation');
});

test('phase math: wait when early, seek into phase past 0.15 s, never into the last 0.04 s, never replay an expired step',()=>{
  const [step]=timeline([box(0,9)],{startAt:0}).steps,duration=frameMs(66);
  assert.deepEqual(filmedStepPhase(step,600),{waitMs:100,offsetMs:0,expired:false,seekS:0,rate:1,startMs:700,durationMs:duration});
  assert.equal(filmedStepPhase(step,800).seekS,0,'100 ms late plays from the first frame (K video-preloader.js:19)');
  assert.ok(Math.abs(filmedStepPhase(step,1100).seekS-.4)<1e-9);
  assert.ok(Math.abs(filmedStepPhase(step,700+duration-10).seekS-(duration/1000-.04))<1e-9);
  assert.equal(filmedStepPhase(step,700+duration-1).expired,false);assert.equal(filmedStepPhase(step,700+duration).expired,true);
  const fitted=timeline([box(0,9)],{startAt:0,endAt:2000}).steps[0],phase=filmedStepPhase(fitted,700+400,{fitted:true});
  assert.equal(phase.rate,2);assert.ok(Math.abs(phase.seekS-.8)<1e-9,'a fitted step counts its clock in take time');
  assert.equal(filmedStepPhase(fitted,700+fitted.fit.durationMs,{fitted:true}).expired,true);
  assert.equal(filmedStepPhase(fitted,700+fitted.fit.durationMs).expired,false,'without the fit the real length counts');
});

test('the timeline is pure, refuses what it cannot time and plays untimed when the published order differs',()=>{
  const source=readFileSync(new URL('../packages/presentation/runtime/filmed-deal-timeline.mjs',import.meta.url),'utf8');
  for(const word of ['Date.','document.','performance.','window.','setTimeout(','requestAnimationFrame'])assert.ok(!source.includes(word),`no ${word} in the planner`);
  const events=[box(6,1),box(0,2)],plan=planFilmedDealSequence({profile,events,inventory,dealerId:'dragan'});
  const snapshot=structuredClone({plan,profile,events});
  const result=timeFilmedDealSequence(plan,profile,{startAt:7,endAt:30007});
  assert.deepEqual({plan,profile,events},snapshot);assert.deepEqual(timeFilmedDealSequence(plan,profile,{startAt:7,endAt:30007}),result);
  assert.deepEqual(result.steps.map(s=>s.videoId),['video-7:i','video-1:v'],'plan fields pass through');
  assert.deepEqual(timeFilmedDealSequence({complete:false,reason:'exact_video_missing',profileId:profile.id,steps:[]},profile),{profileId:profile.id,complete:false,reason:'exact_video_missing',steps:[]});
  assert.equal(timeFilmedDealSequence(plan,{...profile,plane:{...profile.plane,fps:0}}).reason,'profile_invalid');
  assert.equal(timeFilmedDealSequence({...plan,steps:[{...plan.steps[0],takeKey:'9:base'}]},profile).reason,'take_missing');
  assert.equal(timeline([box(7,1)]).reason,'instructions_invalid');
  assert.equal(timeline([dealer(7),box(0,6)]).reason,'order_mismatch','the filmed order (player first) is not the published order');
  assert.equal(timeline([box(1,3),{type:'speak',line:'twentyone'},box(2,4)]).complete,true,'speech between takes: the server plans the same chain, the player anchors the second run');
  assert.equal(planFilmedTimeline({events:[box(0,1)]}).reason,'profile_missing');
  // Separate shoe clips break the join and require their own measured times.
  const withShoe=planFilmedDealSequence({profile,events,inventory,dealerId:'dragan',transitions:{toShoe:{id:'to'},fromShoe:{id:'from'}}});
  assert.equal(timeFilmedDealSequence(withShoe,profile).reason,'transition_timing_missing');
  const timed=timeFilmedDealSequence(withShoe,profile,{transitions:{toShoe:{id:'to',durationMs:2000},fromShoe:{id:'from',durationMs:1000}}});
  assert.deepEqual(timed.steps.map(s=>[s.takeKey,s.joinBefore,s.joinAfter,s.gapAfterMs]),[['7:base',false,true,0],['1:base',true,false,FILMED_TAKE_GAP_MS]]);
});

test('an explicit reduced bank times its selected shoe clips and exact take, without synthesizing missing variants',()=>{
  const transitions={toShoe:{id:'to',durationMs:2000},fromShoe:{id:'from',durationMs:1000}};
  const reduced={videos:inventory.videos.filter(video=>video.sha256===takeOf('1:base').sha256)};
  const result=planFilmedTimeline({profile,events:[box(0,1)],dealerId:'dragan',inventory:reduced,transitions,startAt:1000,endAt:11000});
  assert.equal(result.complete,true);assert.equal(result.steps[0].takeKey,'1:base');
  const step=result.steps[0],duration=frameMs(takeOf('1:base').frames);
  assert.equal(step.playbackStartMs,700);assert.equal(step.startMs,2700);
  assert.equal(step.endMs,2700+duration);assert.equal(step.playbackEndMs,3700+duration);
  assert.equal(result.realEndMs,step.playbackEndMs+FILMED_TAKE_GAP_MS);
  assert.equal(filmedStepPhase(step,699).waitMs,1);
  assert.equal(filmedStepPhase(step,step.endMs+500).expired,false,'the full exit clip remains within the step');
  assert.equal(filmedStepPhase(step,step.playbackEndMs).expired,true);
  assert.equal(planFilmedTimeline({profile,events:[box(0,1)],dealerId:'dragan',inventory:reduced}).complete,false,'no fabricated iv variant');
  assert.equal(planFilmedTimeline({profile,events:[box(0,1)],dealerId:'dragan',inventory:{videos:[]},transitions}).complete,false);
});

test('a fitted chain reserves the complete measured transitions and only compresses the take',()=>{
  const transitions={toShoe:{id:'to',durationMs:2000},fromShoe:{id:'from',durationMs:1000}};
  const result=planFilmedTimeline({profile,events:[box(0,1)],dealerId:'dragan',inventory,transitions,startAt:0,endAt:4500});
  const step=result.steps[0];assert.ok(result.fit.rate>1);
  assert.equal(step.fit.startMs-step.fit.playbackStartMs,2000);
  assert.equal(step.fit.playbackEndMs-step.fit.endMs,1000);
  assert.equal(step.fit.durationMs,step.durationMs/result.fit.rate);
  assert.equal(result.endAt,4500);
});
