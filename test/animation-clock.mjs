import test from 'node:test';
import assert from 'node:assert/strict';
import { animateProgress } from '../web/public/animation-clock.mjs';
function setup(){
 const visibility=new EventTarget();visibility.hidden=false;
 const frames=[];const cancelled=[];
 return {frames,cancelled,visibility,options:{now:()=>0,visibility,requestFrame:f=>(frames.push(f),frames.length),cancelFrame:id=>cancelled.push(id)}};
}
test('hidden tab lands the card and ignores stale frames',async()=>{
 const s=setup(),seen=[];const p=animateProgress(680,t=>seen.push(t),s.options);
 s.frames[0](100);s.visibility.hidden=true;s.visibility.dispatchEvent(new Event('visibilitychange'));await p;
 s.frames[1](300);assert.equal(seen.at(-1),1);assert.equal(seen.length,2);
});
test('occluded window still resolves when no frames arrive',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const s=setup(),seen=[];
 const p=animateProgress(680,x=>seen.push(x),s.options);t.mock.timers.tick(830);await p;assert.deepEqual(seen,[1]);
});
test('render failure rejects once and cancels future work',async()=>{
 const s=setup();let count=0;const p=animateProgress(680,()=>{count++;throw new Error('lost renderer');},s.options);
 s.frames[0](100);await assert.rejects(p,/lost renderer/);s.frames[0](400);assert.equal(count,1);assert.ok(s.cancelled.length);
});
