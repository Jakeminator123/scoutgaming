import test from 'node:test';import assert from 'node:assert/strict';
import {payoutStack} from '../public/table-boxes.js';
test('payout chips use wager units and bound visible height',()=>{
 assert.deepEqual(payoutStack(5,15),{unit:5,count:3,layers:[5,5,5]});
 assert.equal(payoutStack(5,130).count,26);assert.equal(payoutStack(5,505).count,101);assert.equal(payoutStack(5,505).layers.length,12);
 assert.deepEqual(payoutStack(5,12.5).layers,[5,5,2.5]);assert.equal(payoutStack(500,13000).unit,500);
 for(const [s,r] of [[0,10],[5,0],[5,5],[-5,10],[Infinity,10],[5,Infinity]])assert.equal(payoutStack(s,r),null);
});
