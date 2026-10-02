import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveFrameCards} from './card-state.mjs';
const quad=[[0,0],[1,0],[1,2],[0,2]];
test('hole card stays hidden despite filmed turnover and landing',()=>{
 const issued=new Map([[2,{card:{r:'A',s:'♠'},faceDown:true}]]);
 for(const status of ['active','landed']){const [card]=resolveFrameCards({cards:[{id:2,quad,face:'front',status}]},issued);assert.equal(card.face,'back');assert.equal(card.card,undefined);}
});
test('does not invent unissued props or use filmed identity',()=>{
 const issued=new Map([[1,{card:{r:'7',s:'♥'}}]]);
 const cards=resolveFrameCards({cards:[{id:1,quad,face:'front',card:{r:'A',s:'♠'}},{id:2,quad,face:'front'}]},issued);
 assert.equal(cards.length,1);assert.deepEqual(cards[0].card,{r:'7',s:'♥'});
});
test('back does not require hidden rank; front requires issued identity',()=>{
 const issued=new Map([[1,{faceDown:true}]]);const frame={cards:[{id:1,quad,face:'front'}]};assert.equal(resolveFrameCards(frame,issued)[0].face,'back');issued.set(1,{});assert.throws(()=>resolveFrameCards(frame,issued),/Missing issued card/);
});
