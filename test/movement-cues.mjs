import {test} from 'node:test';
import assert from 'node:assert/strict';
import {movementCues} from '../web/public/movement-cues.mjs';
test('movement emits pickup and contact once despite repeated frames',()=>{
 const events=[], frame=movementCues(x=>events.push(x));
 [0,.02,.2,.8,1,1].forEach(x=>frame(x));
 assert.deepEqual(events,['pickup','land']);
});
test('hidden completion cannot replay old audio',()=>{
 const events=[], frame=movementCues(x=>events.push(x));
 frame(0);frame(1,false);frame(1,true);
 assert.deepEqual(events,['pickup']);
});
test('late first frame and reduced motion only sound at landing',()=>{
 for(const initial of [.5,1]) {const events=[], frame=movementCues(x=>events.push(x));frame(initial);frame(1);assert.deepEqual(events,['land']);}
});
