import test from 'node:test';
import assert from 'node:assert/strict';
import {placeActions} from '../web/public/action-placement.mjs';
const box=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height});
const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
test('controls stay clear of a seven-seat fan, totals and wallet at each active seat',()=>{
  const obstacles=[box(18,725,396,56),box(935,725,180,56)];
  const seats=[224,320,434,558,682,795,895];
  seats.forEach((x,i)=>{const y=620-Math.abs(i-3)*20;obstacles.push(box(x-45,y-85,95,58),box(x+25,y-10,44,27));});
  for(const x of seats){
    const p=placeActions({width:196,height:54,viewport:{width:1117,top:292,bottom:793},anchor:{x,bottom:640},obstacles});
    assert.ok(p);assert.ok(p.x>=12&&p.x+196<=1105&&p.y+54<=781);
    assert.ok(obstacles.every(o=>!overlaps(box(p.x,p.y,196,54),o)));
  }
});
test('portrait split hand keeps both totals and the dealer count above a usable panel',()=>{
  const obstacles=[box(12,330,44,57),box(140,360,42,58),box(205,360,43,58),box(333,330,44,57),
    box(62,419,39,27),box(141,392,39,27),box(205,392,39,27),box(289,419,39,27),box(181,316,53,27),box(12,723,268,61)];
  const p=placeActions({width:268,height:74,viewport:{width:390,top:295,bottom:797},anchor:{x:195,bottom:450},obstacles});
  assert.ok(p);assert.ok(p.x>=12&&p.x+268<=378&&p.y+74<=785);
  assert.ok(obstacles.every(o=>!overlaps(box(p.x,p.y,268,74),o)));
});
test('actions stay below totals when clear space exists beside the wallet',()=>{
  const anchor={x:1060,bottom:548};
  const obstacles=[box(1030,520,60,28),box(960,455,135,75),box(18,612,300,52),box(820,612,330,52)];
  const p=placeActions({width:196,height:54,viewport:{width:1280,top:250,bottom:678},anchor,obstacles,belowAnchor:true});
  assert.ok(p);assert.ok(p.y>=anchor.bottom+12);
  assert.ok(obstacles.every(o=>!overlaps(box(p.x,p.y,196,54),o)));
});
