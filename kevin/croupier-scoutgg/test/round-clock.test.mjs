import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoundClock} from '../public/round-clock.js';
test('clock starts at 20, adding chips does not reset it, expires exactly once',()=>{
 let now=0,expired=[];const clock=createRoundClock({now:()=>now,onExpire:key=>expired.push(key)});
 assert.equal(clock.tick(),null);clock.set('bets');assert.equal(clock.tick().seconds,20);
 now=5000;clock.set('bets');assert.equal(clock.tick().seconds,15);
 now=21000;assert.equal(clock.tick().seconds,0);clock.tick();assert.deepEqual(expired,['bets']);
 clock.set('decision:2');assert.equal(clock.tick().seconds,20);
});
test('clip and hidden-tab pauses preserve remaining decision time',()=>{
 let now=0,expired=0;const c=createRoundClock({now:()=>now,onExpire:()=>expired++});
 c.set('insurance');now=5000;c.pause(true);now=50000;assert.equal(c.tick().seconds,15);assert.equal(expired,0);
 c.pause(false);now=54000;assert.equal(c.tick().seconds,11);
 c.set('decision');assert.equal(c.tick().seconds,20);c.set(null);assert.equal(c.tick(),null);
});
