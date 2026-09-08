import test from 'node:test';
import assert from 'node:assert/strict';
import { DealerEngine } from '../web/public/dealer-engine.mjs';
const make=()=>new DealerEngine({getContext:()=>({})},'dealer');
const show=(e,p)=>{e.presentation=p;for(const f of [...e.frameListeners])f(p);};
test('card cue waits for the painted release frame, not decoded progress',async()=>{
 const e=make();e.presentation={key:'deal',frame:10,cycle:100};let done=false;
 const p=e.waitForFrame('deal',17).then(value=>{done=true;return value;});
 show(e,{key:'deal',frame:16,cycle:100});await Promise.resolve();assert.equal(done,false);
 show(e,{key:'deal',frame:17,cycle:100});assert.equal((await p).frame,17);assert.equal(e.frameListeners.size,0);
});
test('next-cycle cue cannot reuse a release from the previous dealing loop',async()=>{
 const e=make();e.presentation={key:'deal',frame:100,cycle:100};let done=false;
 const p=e.waitForFrame('deal',17,{afterCycle:100}).then(value=>{done=true;return value;});
 show(e,{key:'deal',frame:130,cycle:100});await Promise.resolve();assert.equal(done,false);
 show(e,{key:'deal',frame:17,cycle:200});assert.equal((await p).cycle,200);
});
test('unavailable hand footage releases the wait and removes its listener',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const e=make();const p=e.waitForFrame('deal',17,{timeoutMs:20});
 t.mock.timers.tick(20);assert.equal(await p,null);assert.equal(e.frameListeners.size,0);
});
