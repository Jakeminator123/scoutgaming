import test from 'node:test';
import assert from 'node:assert/strict';
import {readIdleVideoDuration} from '../lib/idle-video-duration.mjs';

function fixture(duration=1.234) {
  const video={duration,loads:0,removed:[],load(){this.loads++;},removeAttribute(key){this.removed.push(key);}};
  return {video,read:options=>readIdleVideoDuration('/own-idle.mp4',{createVideo:()=>video,...options})};
}
test('metadata uses the exact selected clip duration and releases its source',async()=>{
  const f=fixture(),pending=f.read();
  assert.equal(f.video.src,'/own-idle.mp4');assert.equal(f.video.preload,'metadata');
  f.video.onloadedmetadata();assert.equal(await pending,1234);
  assert.deepEqual(f.video.removed,['src']);assert.equal(f.video.loads,2);
  assert.equal(f.video.onerror,null);assert.equal(f.video.onloadedmetadata,null);
});
test('invalid, unavailable and timed-out media cannot invent a duration',async()=>{
  for(const duration of [NaN,Infinity,0.199,60.001]){
    const f=fixture(duration),pending=f.read();f.video.onloadedmetadata();
    await assert.rejects(pending,/mellan 0,2 och 60/);assert.deepEqual(f.video.removed,['src']);
  }
  const bad=fixture(),pending=bad.read();bad.video.onerror();await assert.rejects(pending,/kunde inte läsas/);
  await assert.rejects(fixture().read({timeoutMs:1}),/Försök igen/);
});
test('abort cancels metadata work and an already aborted request creates no element',async()=>{
  const controller=new AbortController(),f=fixture(),pending=f.read({signal:controller.signal});
  controller.abort();await assert.rejects(pending,{name:'AbortError'});
  assert.deepEqual(f.video.removed,['src']);assert.equal(f.video.onloadedmetadata,null);
  await assert.rejects(readIdleVideoDuration('/never.mp4',{signal:controller.signal,createVideo(){throw Error('must not construct');}}),{name:'AbortError'});
});
