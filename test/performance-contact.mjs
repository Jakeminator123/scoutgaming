import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CONTACT_CHECKS,DEAL_ACTIONS,TABLE_ACTIONS,validateContactTake,validateSharedExtraction,validateContinuation,selectSequenceTake,continuationStartFrame,selectContactTake,selectPlayerDelivery,contactFrame,contactCueClock,calibrationPayload,uniformRegistration} from '../packages/presentation/contracts/performance-contact.mjs';
export function fixture() {
  const take={version:1,id:'synthetic-contract-test',dealer:'astrid',action:'deal-centre',status:'contact-approved',
    media:{src:'test.mp4',sha256:'a'.repeat(64),layout:'rgb-over-masks-r-actor-g-fingers',width:1280,height:720,fps:24,frames:12},
    camera:{width:1280,height:720,shoeOutlet:[.65,.58]},events:{pickup:2,release:6,land:8,rest:10},
    frames:Array.from({length:12},(_,frame)=>({frame,card:frame<2||frame>8?null:{corners:[[.6,.5,0],[.65,.5,0],[.65,.58,0],[.6,.58,0]],faceUp:true},contact:{measured:true,finger:[.6,.5]}}))};
  take.calibrationSha256=createHash('sha256').update(calibrationPayload(take)).digest('hex');
  take.review={result:'passed',reviewer:'Automated fixture, not human media approval',date:'2026-09-09',mediaSha256:take.media.sha256,calibrationSha256:take.calibrationSha256,checks:Object.fromEntries(CONTACT_CHECKS.map(k=>[k,true]))};
  return take;
}
test('draft, rejected, missing and stale reviews cannot enter the staged player',()=>{
  for(const mutate of [t=>t.status='draft',t=>t.status='rejected',t=>t.review.checks.grip=false,t=>t.review.mediaSha256='b'.repeat(64),t=>t.review.calibrationSha256='b'.repeat(64)]){
    const take=fixture();mutate(take);assert.ok(validateContactTake(take,{approved:true}).length);
    assert.equal(selectContactTake({status:'draft',takes:[take]},'deal-centre',{staged:true}),null);
  }
});
test('single contact approval is usable only in explicit staging; entire-table promotion needs every action',()=>{
  const take=fixture(),manifest={status:'draft',takes:[take]};
  assert.equal(selectContactTake(manifest,'deal-centre'),null);
  assert.equal(selectContactTake(manifest,'deal-centre',{staged:true}),take);
  manifest.status='approved';take.status='approved';assert.equal(selectContactTake(manifest,'deal-centre'),null);
  manifest.takes=DEAL_ACTIONS.map(action=>({...take,action}));
  manifest.review={actions:Object.fromEntries(TABLE_ACTIONS.map(k=>[k,true]))};
  assert.ok(selectContactTake(manifest,'deal-centre'));
  manifest.review.actions['reveal-hole']=false;assert.equal(selectContactTake(manifest,'deal-centre'),null);
});
test('every contact frame, card corner and finger measurement is required',()=>{
  for(const mutate of [t=>t.frames.splice(4,1),t=>t.frames[4].card=null,t=>t.frames[4].card.corners[2][1]=NaN,t=>t.frames[4].contact.measured=false,t=>t.frames[4].frame=5,t=>t.events.release=12]){
    const take=fixture();mutate(take);assert.ok(validateContactTake(take).length);
  }
});
test('a fully calibrated candidate can be reviewed in-game without declaring it approved',()=>{
  const take=fixture();take.status='review';delete take.review;
  const manifest={status:'draft',takes:[take],reviewCandidate:take.id};
  assert.equal(selectContactTake(manifest,'deal-centre',{staged:true}),take);
  assert.equal(selectContactTake(manifest,'deal-centre'),null);
  delete manifest.reviewCandidate;assert.equal(selectContactTake(manifest,'deal-centre',{staged:true}),null);
});
test('an estimated hand proxy stays a staged review candidate and cannot masquerade as contact-approved',()=>{
  const take=fixture();take.status='review';delete take.review;
  take.tracking={kind:'hand-proxy',sourceSha256:'c'.repeat(64),sourceStart:0,sourceStop:12,shoulder:[.7,.3]};
  for(const frame of take.frames)frame.contact={measured:false,method:'synthetic hand proxy',finger:[.6,.5]};
  take.calibrationSha256=createHash('sha256').update(calibrationPayload(take)).digest('hex');
  assert.deepEqual(validateContactTake(take),[]);
  const manifest={status:'review',takes:[take],reviewCandidates:[take.id]};
  assert.equal(selectContactTake(manifest,'deal-centre',{staged:true}),take);
  assert.equal(selectContactTake(manifest,'deal-centre'),null);
  assert.ok(validateContactTake(take,{approved:true}).length);
  for(const status of ['contact-approved','approved']){const forged=structuredClone(take);forged.status=status;assert.ok(validateContactTake(forged).length);}
  const changed=structuredClone(take);changed.tracking.sourceStart++;
  assert.notEqual(createHash('sha256').update(calibrationPayload(changed)).digest('hex'),take.calibrationSha256);
});
test('presented timestamps select their measured frame without a second animation clock',()=>{
  const take=fixture();assert.equal(contactFrame(take,4/24),take.frames[4]);
  assert.equal(contactFrame(take,9/24),take.frames[9]);assert.equal(contactFrame(take,100),take.frames[11]);
  assert.throws(()=>contactFrame(take,NaN));
});
test('cue clock handles repeated frames, backwards seeks, skipped frames and hidden completion once',()=>{
  const events=[],cue=contactCueClock({pickup:2,land:8},name=>events.push(name));
  for(const frame of [0,1,2,2,3,6,7,8,8,1,2,8])cue(frame);
  assert.deepEqual(events,['pickup','land']);
  for(const options of [{visible:false},{seeking:true}]){
    const seen=[],next=contactCueClock({pickup:2,land:8},name=>seen.push(name));
    next(0);next(2,options);next(8,options);next(8);assert.deepEqual(seen,[]);
  }
  const late=[],next=contactCueClock({pickup:2,land:8},name=>late.push(name));next(6);next(8);assert.deepEqual(late,['land']);
});
test('viewport registration preserves aspect ratio and actor/shoe coordinates together',()=>{
  const source={width:1280,height:720};
  for(const viewport of [{width:1600,height:900},{width:390,height:844}]){
    const fit=uniformRegistration(source,viewport);
    assert.equal(fit.width/fit.height,source.width/source.height);
    assert.equal(fit.x+fit.width/2,viewport.width/2);
    if(viewport.width>viewport.height){assert.equal(fit.y+fit.height/2,(viewport.height-136)/2);assert.ok(fit.y+fit.height<=viewport.height-136);}
    const outlet={x:fit.x+fit.width*.636,y:fit.y+fit.height*.599};
    assert.ok(outlet.x>0&&outlet.x<viewport.width&&outlet.y>0&&outlet.y<viewport.height);
  }
});
test('accelerated card cues survive ordinary frame drops but never replay after a stall',()=>{
  const heard=[],cue=contactCueClock({pickup:69,land:122},name=>heard.push(name),{fps:24,playbackRate:1.75});
  // A 14fps presentation can skip three source frames at 1.75x. Each
  // contact is still presented less than 80ms after its authored time.
  for(const frame of [63,66,70,73,117,120,124,124])cue(frame);
  assert.deepEqual(heard,['pickup','land']);
  const late=[],stalled=contactCueClock({pickup:69,land:122},name=>late.push(name),{fps:24,playbackRate:1.75});
  for(const frame of [20,71,75,100,140,122])stalled(frame);
  assert.deepEqual(late,[]);
});
test('native-resolution media preserves calibrated on-screen contact at desktop and phone sizes',()=>{
  for(const viewport of [{width:1920,height:1080},{width:1470,height:900},{width:390,height:844}]) {
    const before=uniformRegistration({width:1280,height:720},viewport);
    const after=uniformRegistration({width:1920,height:1080},viewport);
    for(const key of ['x','y','width','height'])assert.ok(Math.abs(before[key]-after[key])<1e-9);
    const take=fixture();take.media.width=take.camera.width=1920;take.media.height=take.camera.height=1080;
    assert.deepEqual(validateContactTake(take),[]);
    assert.equal(contactFrame(take,4/24).frame,4);
  }
});
test('player delivery follows the measured fan target after resize and split offsets',()=>{
  const takes=['deal-left','deal-centre','deal-right'].map((action,i)=>{
    const t=fixture();t.id=action;t.action=action;t.status='review';
    for(const f of t.frames)if(f.card)for(const p of f.card.corners)p[0]+=(i-1)*.28;
    return t;
  });
  const manifest={status:'draft',takes,reviewCandidates:takes.map(t=>t.id)};
  for(const viewport of [{width:1280,height:720},{width:390,height:844}]){
    const fit=uniformRegistration(takes[0].camera,viewport);
    for(const [i,t] of takes.entries()){
      const target={x:fit.x+(.625+(i-1)*.28)*fit.width,y:fit.y+.54*fit.height};
      assert.equal(selectPlayerDelivery(manifest,target,viewport,{staged:true}),t);
    }
  }
  takes[2].status='rejected';
  assert.notEqual(selectPlayerDelivery(manifest,{x:1200,y:550},{width:1280,height:720},{staged:true}),takes[2]);
  assert.equal(selectPlayerDelivery(manifest,{x:500,y:500},{width:1280,height:720}),null);
});
test('own-card contact cannot silently diverge from its shared player extraction',()=>{
  const player=fixture(),dealer=structuredClone(player);dealer.action='deal-dealer';
  dealer.sharedExtraction={action:'deal-centre',frames:4,sourceSha256:'b'.repeat(64)};
  assert.deepEqual(validateSharedExtraction(dealer,[player,dealer]),[]);
  dealer.frames[3].card.corners[0][1]-=.1;
  assert.deepEqual(validateSharedExtraction(dealer,[player,dealer]),['Shared extraction tracking changed']);
  dealer.frames[3]=structuredClone(player.frames[3]);dealer.events.pickup++;
  assert.deepEqual(validateSharedExtraction(dealer,[player,dealer]),['Shared pickup camera/timing changed']);
});
test('silent action pacing is calibrated while cues follow presented source frames',()=>{
  const take=fixture(),original=calibrationPayload(take);take.playbackRate=1.75;
  assert.notEqual(calibrationPayload(take),original);
  const cues=[],cue=contactCueClock(take.events,name=>cues.push(name));
  for(let tick=0;tick<30;tick++)cue(contactFrame(take,tick/60*take.playbackRate).frame);
  assert.deepEqual(cues,['pickup','land']);
  for(const rate of [0,Infinity,NaN,2.1]){take.playbackRate=rate;assert.ok(validateContactTake(take).includes('Invalid silent-action playback rate'));}
});

function sequenceFixture(){
  const base=fixture(),candidate=structuredClone(base);
  candidate.id='return-candidate';candidate.status='review';
  candidate.media.sha256='c'.repeat(64);
  candidate.continuation={baseId:base.id,baseMediaSha256:base.media.sha256,baseCalibrationSha256:base.calibrationSha256,preserveThrough:9,
    resume:[{takeId:base.id,mediaSha256:base.media.sha256,calibrationSha256:base.calibrationSha256,frame:1}]};
  candidate.calibrationSha256=createHash('sha256').update(calibrationPayload(candidate)).digest('hex');
  return {base,candidate,manifest:{takes:[base],continuations:[candidate],reviewCandidates:[candidate.id]}};
}
test('only a continuing reviewed sequence can use the empty-hand return',()=>{
  const {base,candidate,manifest}=sequenceFixture();
  assert.deepEqual(validateContinuation(candidate,manifest.takes),[]);
  assert.equal(selectSequenceTake(manifest,base,{staged:true,continues:true}),candidate);
  for(const opts of [{staged:false,continues:true},{staged:true,continues:false}])assert.equal(selectSequenceTake(manifest,base,opts),base);
  candidate.status='rejected';assert.equal(selectSequenceTake(manifest,base,{staged:true,continues:true}),base);
});
test('return replacement cannot alter the issued card or move its landing',()=>{
  for(const mutate of [c=>c.continuation.preserveThrough=7,c=>c.events.land=7,c=>c.frames[4].card.corners[0][0]=.1,c=>c.continuation.baseMediaSha256='d'.repeat(64),c=>c.camera.shoeOutlet[0]=.1]){
    const {base,candidate,manifest}=sequenceFixture();mutate(candidate);
    assert.ok(validateContinuation(candidate,manifest.takes).length);
    assert.equal(selectSequenceTake(manifest,base,{staged:true,continues:true}),base);
  }
});
test('next pickup seek is bound to media, calibration and pre-pickup frames',()=>{
  const {base,candidate}=sequenceFixture();
  assert.equal(continuationStartFrame(candidate,base),1);
  assert.equal(continuationStartFrame(candidate,candidate),1);
  assert.equal(continuationStartFrame(null,base),0);
  const cues=[],cue=contactCueClock(base.events,name=>cues.push(name));
  for(const frame of [1,2,3,7,8,9])cue(frame);
  assert.deepEqual(cues,['pickup','land']);
  for(const mutate of [t=>t.media.sha256='d'.repeat(64),t=>t.calibrationSha256='e'.repeat(64),t=>t.camera.width=999]){
    const next=structuredClone(base);mutate(next);assert.equal(continuationStartFrame(candidate,next),0);
  }
  const before=calibrationPayload(candidate);candidate.continuation.resume[0].frame=2;
  assert.notEqual(calibrationPayload(candidate),before);
  assert.equal(continuationStartFrame(candidate,base),0);
});

test('actor grading is calibrated and cannot silently differ on a return',()=>{
  const take=fixture(),before=calibrationPayload(take);take.colourGain=[.91,.82,.77];
  assert.notEqual(calibrationPayload(take),before);
  assert.deepEqual(validateContactTake(take),[]);
  for(const invalid of [[1,1],[1,NaN,1],[0,1,1],[2,1,1]]){
    take.colourGain=invalid;assert.ok(validateContactTake(take).includes('Invalid actor colour correction'));
  }
  const {base,candidate}=sequenceFixture();candidate.colourGain=[.91,.82,.77];
  assert.ok(validateContinuation(candidate,[base]).includes('Continuation actor colour changed'));
});
