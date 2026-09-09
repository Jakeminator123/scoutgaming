import test from 'node:test';
import assert from 'node:assert/strict';
import {movePlayer,nearestTable} from '../web/public/casino-navigation.mjs';
test('walk cannot tunnel through tables after a delayed frame',()=>{const p=movePlayer({x:5,z:8},0,-15);assert.ok(p.z>=4.1);});
test('walls stop movement and diagonal input can slide along obstacles',()=>{const p=movePlayer({x:0,z:12},30,30);assert.ok(p.x<10.7&&p.z<12.5);const q=movePlayer({x:5,z:4.2},2,-2);assert.ok(q.x>5);assert.ok(q.z>=4.1);});
test('approaching each table selects its existing dealer route',()=>{for(const [x,z,id] of [[-5,4.5,'vera'],[5,4.5,'astrid'],[-5,-3.5,'amira'],[5,-3.5,'mei']])assert.equal(nearestTable({x,z}).id,id);});
