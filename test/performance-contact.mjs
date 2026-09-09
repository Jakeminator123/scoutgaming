import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CONTACT_CHECKS,DEAL_ACTIONS,TABLE_ACTIONS,validateContactTake,validateSharedExtraction,selectContactTake,contactFrame,contactCueClock,calibrationPayload,uniformRegistration} from '../web/public/performance-contact.mjs';
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
    if(viewport.width>viewport.height)assert.equal(fit.y+fit.height/2,viewport.height/2);
    const outlet={x:fit.x+fit.width*.636,y:fit.y+fit.height*.599};
    assert.ok(outlet.x>0&&outlet.x<viewport.width&&outlet.y>0&&outlet.y<viewport.height);
  }
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
test('own-card contact cannot silently diverge from its shared player extraction',()=>{
  const player=fixture(),dealer=structuredClone(player);dealer.action='deal-dealer';
  dealer.sharedExtraction={action:'deal-centre',frames:4,sourceSha256:'b'.repeat(64)};
  assert.deepEqual(validateSharedExtraction(dealer,[player,dealer]),[]);
  dealer.frames[3].card.corners[0][1]-=.1;
  assert.deepEqual(validateSharedExtraction(dealer,[player,dealer]),['Shared extraction tracking changed']);
  dealer.frames[3]=structuredClone(player.frames[3]);dealer.events.pickup++;
  assert.deepEqual(validateSharedExtraction(dealer,[player,dealer]),['Shared pickup camera/timing changed']);
});
