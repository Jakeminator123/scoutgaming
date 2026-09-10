import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiscardState} from '../web/public/rigged-discard-state.mjs';
const snapshot=(version,dealt,round=null,id='shoe-a')=>({version,shoe:{id,total:416,dealt},round});
const hiddenRound={hands:[{cards:[{},{}]}],dealer:[{}],holeDraw:5};
test('burn and previous cards persist while the hidden dealer card stays on the table',()=>{
 const state=createDiscardState();assert.equal(state.sync(snapshot(0,1)).count,1);
 assert.deepEqual(state.sync(snapshot(1,5,hiddenRound)),{shoeId:'shoe-a',count:1,onTable:4});
 assert.deepEqual(state.sync(snapshot(2,5,null),{collecting:true}),{shoeId:'shoe-a',count:1,onTable:4});
 for(const card of ['a','b','c','d'])state.land(card);
 assert.deepEqual(state.view(),{shoeId:'shoe-a',count:5,onTable:0});
 state.land('d');assert.equal(state.view().count,5);
 assert.equal(state.sync(snapshot(2,5),{collecting:true}).count,5);
 assert.throws(()=>state.land('extra'),/exceeds/);
 const reloaded=createDiscardState();assert.deepEqual(reloaded.sync(snapshot(2,5)),state.view());
});
test('hit and split snapshots do not prematurely move newly drawn cards into the discard',()=>{
 const state=createDiscardState();state.sync(snapshot(10,43,hiddenRound));
 const split={hands:[{cards:[{},{}]},{cards:[{},{}]}],dealer:[{}],holeDraw:41};
 assert.equal(state.sync(snapshot(11,45,split)).count,39);
 split.hands[1].cards.push({});assert.equal(state.sync(snapshot(12,46,split)).count,39);
 assert.equal(state.sync(snapshot(11,45,split)).count,39); // stale response ignored
});
test('new shoe clears the old pile and refresh during a paid collection restores the complete count',()=>{
 const state=createDiscardState();state.sync(snapshot(50,317,hiddenRound));
 state.sync(snapshot(51,317),{collecting:true});state.land('first');
 const reloaded=createDiscardState();assert.equal(reloaded.sync(snapshot(51,317)).count,317);
 assert.deepEqual(state.sync(snapshot(52,5,hiddenRound,'shoe-b')),{shoeId:'shoe-b',count:1,onTable:4});
 assert.throws(()=>state.sync(snapshot(53,2,hiddenRound,'shoe-b')),/more cards/);
});
