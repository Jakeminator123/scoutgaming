import test from 'node:test';
import assert from 'node:assert/strict';
import {PerformancePlayer} from '../services/game/public/performance-player.mjs';
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
