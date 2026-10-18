import test from 'node:test';
import assert from 'node:assert/strict';
import {readyMotionErrors} from '../services/game/public/ready-motion.mjs';
import {PerformancePlayer} from '../services/game/public/performance-player.mjs';
const hash='a'.repeat(64);
const idle={sha256:hash,matteSha256:hash};
const take={id:'take-1',camera:{width:1920,height:1080},media:{sha256:hash},calibrationSha256:hash};
function clip(kind){
  return {status:'review',calibrationSha256:hash,
    media:{src:'dealers/astrid/performance/joins/ready.mp4',sha256:hash,width:1920,height:1080,fps:60,frames:2},
    camera:{width:1920,height:1080},
    idle:{rgbSha256:hash,maskSha256:hash},
    bindings:['entry','exit'].map(edge=>({edge,takeId:'take-1',mediaSha256:hash,calibrationSha256:hash})),
    ready:{kind,loopSha256:hash}};
}
function fixture(){
  const loop=clip('loop'),speech=clip('speech');
  const joins=['entry','exit'].map(edge=>{const row=clip(edge);row.bindings=row.bindings.filter(binding=>binding.edge===edge);return row;});
  return {status:'review',loop,speech,joins};
}
test('ready lifecycle requires all take entries, exits, loop and paired speech',()=>{
  const m=fixture();assert.deepEqual(readyMotionErrors(m,[take],idle),[]);
  for(const broken of [null,{...m,speech:null},{...m,joins:m.joins.slice(1)}])assert.ok(readyMotionErrors(broken,[take],idle).length);
  const changed=structuredClone(m);changed.loop.media.sha256='0'.repeat(64);assert.ok(readyMotionErrors(changed,[take],idle).length);
  assert.ok(readyMotionErrors(m,[take],{...idle,sha256:'0'.repeat(64)}).length);
});
test('speech waits for the moving loop and filmed idle return before release',async()=>{
  const events=[];let stopDone;
  const actor={readyPose:true,ready:{speech:{}},leavingReady:null,stopWaiting:()=>new Promise(r=>stopDone=r),playJoin:async()=>events.push('bridge'),prepareIdle:async()=>events.push('idle'),release:()=>events.push('release')};
  const pending=PerformancePlayer.prototype.leaveReady.call(actor);assert.deepEqual(events,[]);stopDone();await pending;
  assert.deepEqual(events,['bridge','idle','release']);assert.equal(actor.leavingReady,null);
});
test('concurrent speech return requests share one transition',async()=>{
  let transitions=0,stopDone;
  const actor={readyPose:true,ready:{speech:{}},leavingReady:null,stopWaiting:()=>new Promise(r=>stopDone=r),playJoin:async()=>transitions++,prepareIdle:async()=>{},release:()=>{}};
  const a=PerformancePlayer.prototype.leaveReady.call(actor),b=PerformancePlayer.prototype.leaveReady.call(actor);stopDone();await Promise.all([a,b]);assert.equal(transitions,1);
});
test('a failed speech-return bridge releases actor ownership',async()=>{
  let released=false;
  const actor={readyPose:true,ready:{speech:{}},leavingReady:null,stopWaiting:async()=>{},playJoin:async()=>{throw Error('decode');},prepareIdle:async()=>assert.fail(),release:()=>released=true};
  await assert.rejects(PerformancePlayer.prototype.leaveReady.call(actor),/decode/);assert.ok(released);assert.equal(actor.leavingReady,null);
});
