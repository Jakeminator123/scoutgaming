import test from 'node:test';import assert from 'node:assert/strict';
import {playNativeFrameClock} from './harness/native-frame-clock.mjs';
test('late presentation follows source wallclock without replaying missed frames',async()=>{
 const old={performance:globalThis.performance,raf:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame};let next,id=0;const seen=[],ticks=[];
 Object.defineProperty(globalThis,'performance',{value:{now:()=>0},configurable:true});globalThis.requestAnimationFrame=f=>{next=f;return ++id;};globalThis.cancelAnimationFrame=()=>{next=null;};
 try{const done=playNativeFrameClock({frameCount:85,fps:60,present:async n=>seen.push(n),onTick:x=>ticks.push(x)});for(const t of [100,1067,1401,1417]){const f=next;next=null;await f(t);}await done;assert.deepEqual(seen,[6,64,84]);assert.deepEqual(ticks.map(t=>t.skipped),[5,57,19]);assert.equal(next,null);}
 finally{Object.defineProperty(globalThis,'performance',{value:old.performance,configurable:true});globalThis.requestAnimationFrame=old.raf;globalThis.cancelAnimationFrame=old.cancel;}
});
test('abort stops the scheduled clock and rejects playback',async()=>{
 const old={raf:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame};let cancelled=false;globalThis.requestAnimationFrame=()=>7;globalThis.cancelAnimationFrame=id=>{cancelled=id===7;};
 try{const c=new AbortController();const done=playNativeFrameClock({frameCount:85,fps:60,present:()=>assert.fail('No presentation after abort'),signal:c.signal});c.abort(Error('hidden'));await assert.rejects(done,/hidden/);assert.equal(cancelled,true);}
 finally{globalThis.requestAnimationFrame=old.raf;globalThis.cancelAnimationFrame=old.cancel;}
});
