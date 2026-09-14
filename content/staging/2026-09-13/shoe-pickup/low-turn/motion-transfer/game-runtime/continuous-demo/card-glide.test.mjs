import test from 'node:test';import assert from 'node:assert/strict';import {createCardGlide} from './card-glide.mjs';
const rect=(x,y)=>[[x,y],[x+60,y],[x+60,y+80],[x,y+80]];
test('released card reaches exact target without overshoot and loses speed',()=>{
 const a=rect(100,200),b=rect(700,250),g=createCardGlide(a,b,90);assert.deepEqual(g.quadAt(89),a);assert.deepEqual(g.quadAt(g.endFrame),b);assert.deepEqual(g.quadAt(999),b);
 let prior=a[0][0],speed=Infinity;for(let f=91;f<=g.endFrame;f++){const x=g.quadAt(f)[0][0],next=x-prior;assert(x>=100&&x<=700);assert(next>0&&next<=speed+1e-9);speed=next;prior=x;}
});
test('long slides have time to read while every slot lands before return ends',()=>{
 const near=createCardGlide(rect(0,0),rect(20,0),285),far=createCardGlide(rect(0,0),rect(900,0),285);assert(far.durationFrames>near.durationFrames);assert.equal(near.durationFrames,12);assert.equal(far.durationFrames,28);assert(far.endFrame<333);
});
test('perspective target corners remain exact including stationary-centre rotation',()=>{const a=rect(0,0),b=[[50,-10],[80,40],[10,90],[-20,40]],g=createCardGlide(a,b,150);assert.deepEqual(g.quadAt(g.endFrame),b);});
test('bad geometry and insufficient return reject before painting',()=>{assert.throws(()=>createCardGlide([[NaN,0]],rect(0,0),90),/Invalid/);assert.throws(()=>createCardGlide(rect(0,0),rect(900,0),330),/return/);});

test('already aligned card lands on release without artificial waiting',()=>{const a=rect(100,200),g=createCardGlide(a,a,90);assert.equal(g.durationFrames,0);assert.equal(g.endFrame,90);assert.deepEqual(g.quadAt(90),a);});
