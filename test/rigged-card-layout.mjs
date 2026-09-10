import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {riggedCardPose,cardCorners} from '../web/public/rigged-card-layout.mjs';
const profile=JSON.parse(readFileSync(new URL('../assets/blackjack-3d/profile.json',import.meta.url)));
function insideFelt([x,,z]){
  const ax=Math.abs(x),rear=ax<=.26?.16:ax<.50?-.15+.31*Math.sqrt(1-((ax-.26)/.24)**2):-.15;
  return (x/1.16)**2+((z+.15)/1.25)**2<1&&z>rear;
}
function intersects(a,b){
  for(const points of [a,b])for(let i=0;i<4;i++){
    const next=points[(i+1)%4],p=points[i],axis=[next[2]-p[2],p[0]-next[0]];
    const project=v=>v[0]*axis[0]+v[2]*axis[1],aa=a.map(project),bb=b.map(project);
    if(Math.max(...aa)<=Math.min(...bb)||Math.max(...bb)<=Math.min(...aa))return false;
  }
  return true;
}
test('all seven seats keep up to four split fans and long hands on the actual felt',()=>{
  for(let seat=0;seat<7;seat++)for(let handCount=1;handCount<=4;handCount++)for(const cardCount of [1,2,5,12,21]){
    const hands=[];
    for(let handIndex=0;handIndex<handCount;handIndex++){
      const cards=Array.from({length:cardCount},(_,cardIndex)=>cardCorners(riggedCardPose({profile,seat,handCount,handIndex,cardCount,cardIndex})));
      for(const corners of cards)assert.ok(corners.every(insideFelt),`Outside felt: seat${seat} hand${handIndex}/${handCount}, ${cardCount} cards`);
      hands.push(cards);
    }
    for(let a=0;a<hands.length;a++)for(let b=a+1;b<hands.length;b++)for(const ca of hands[a])for(const cb of hands[b])
      assert.equal(intersects(ca,cb),false,`Split fans overlap: seat${seat} hands${a}/${b}, ${cardCount} cards`);
  }
});
test('dealer long hands stay clear of the dealer notch',()=>{
  for(const cardCount of [1,2,5,12,21])for(let cardIndex=0;cardIndex<cardCount;cardIndex++)
    assert.ok(cardCorners(riggedCardPose({profile,cardCount,cardIndex})).every(insideFelt));
});
test('neighbouring players retain separate cards when either box splits',()=>{
  for(const cardCount of [2,5,21]){
    const seats=Array.from({length:7},(_,seat)=>{
      const cards=[];
      for(let handCount=1;handCount<=4;handCount++)for(let handIndex=0;handIndex<handCount;handIndex++)for(let cardIndex=0;cardIndex<cardCount;cardIndex++)
        cards.push({handCount,handIndex,corners:cardCorners(riggedCardPose({profile,seat,handCount,handIndex,cardCount,cardIndex}))});
      return cards;
    });
    for(let seat=0;seat<6;seat++)for(const a of seats[seat])for(const b of seats[seat+1])
      assert.equal(intersects(a.corners,b.corners),false,`Neighbour overlap: ${seat}/${seat+1}, hands ${a.handCount}/${b.handCount}, ${cardCount} cards`);
  }
});
test('reject invalid presentation indices without inventing a game target',()=>{
  for(const args of [{seat:8},{handCount:5},{handIndex:.5},{cardCount:0},{cardIndex:NaN}])
    assert.throws(()=>riggedCardPose({profile,...args}));
});
