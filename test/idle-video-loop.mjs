import test from 'node:test';
import assert from 'node:assert/strict';
import {createIdleVideoLoop} from '../services/game/public/idle-video-loop.mjs';

function fixture(){
  let stamp=0,id=0,native,display;
  const frames=[],recoveries=[];
  const video={currentTime:0,readyState:2,seeking:false,paused:true,ended:false,
    async play(){this.paused=false;this.ended=false;},pause(){this.paused=true;},
    requestVideoFrameCallback(fn){native=fn;return ++id;},cancelVideoFrameCallback(){native=null;}};
  const loop=createIdleVideoLoop(video,{fps:24,onFrame:t=>frames.push(t),onRecovery:r=>recoveries.push(r),now:()=>stamp,visible:()=>true,
    schedule:fn=>{display=fn;return ++id;},cancel:()=>{display=null;}});
  return {video,loop,frames,recoveries,
    frame(time,ready=2){video.currentTime=time;video.readyState=ready;const fn=native;native=null;fn?.(stamp,{mediaTime:time});},
    async tick(ms){stamp+=ms;const fn=display;display=null;fn?.();await Promise.resolve();await Promise.resolve();},
    hasNative:()=>!!native,hasDisplay:()=>!!display};
}

test('temporary lack of current data at loop end cannot disarm future native frames',async()=>{
  const f=fixture();await f.loop.resume();
  f.frame(6);f.frame(0,1);
  assert.ok(f.hasNative(),'the next callback remains registered during seek');
  f.frame(1/24);f.frame(2/24);
  assert.deepEqual(f.frames,[0,6,1/24,2/24]);f.loop.stop();
});

test('display fallback keeps motion visible when native callbacks stop arriving',async()=>{
  const f=fixture();await f.loop.resume();f.frame(1);
  f.video.currentTime=2;await f.tick(300);
  f.video.currentTime=2.5;await f.tick(500);
  assert.deepEqual(f.frames,[0,1,2,2.5]);f.loop.stop();
});

test('stuck final media frame recovers without a user click',async()=>{
  const f=fixture();await f.loop.resume();f.video.currentTime=6;await f.tick(50);await f.tick(1600);
  assert.equal(f.video.currentTime,0);assert.equal(f.video.paused,false);
  assert.deepEqual(f.recoveries,['stalled']);f.frame(1/24);
  assert.equal(f.frames.at(-1),1/24);f.loop.stop();
});

test('dealing suspension is not mistaken for a stall and resumes the same loop',async()=>{
  const f=fixture();await f.loop.resume();f.frame(3);
  f.loop.pause({reset:true});await f.tick(10000);f.frame(0);
  assert.equal(f.video.paused,true);assert.deepEqual(f.recoveries,[]);assert.equal(f.frames.at(-1),3);
  await f.loop.resume();f.frame(.1);
  assert.equal(f.video.paused,false);assert.equal(f.frames.at(-1),.1);
  f.loop.stop();assert.equal(f.hasNative(),false);assert.equal(f.hasDisplay(),false);
});
