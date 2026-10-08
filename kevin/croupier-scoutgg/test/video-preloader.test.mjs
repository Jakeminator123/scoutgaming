import test from 'node:test';import assert from 'node:assert/strict';
import {createVideoPreloader,initialVideoOffset} from '../public/video-preloader.js';
const video=()=>({dataset:{},loads:0,load(){this.loads++}});
test('prepared decoder is reused at boundary and reset on next use',async()=>{
 const b={load:async s=>'blob:'+s,pin(){},unpin(){}},p=createVideoPreloader(b),v=video();
 await p.prepare(v,'deal');await p.prepare(v,'deal');assert.equal(v.loads,1);assert.equal(await p.consume(v,'deal'),true);assert.equal(v.loads,1);await p.prepare(v,'deal');assert.equal(v.loads,2);
});
test('late preparation cannot overwrite a replacement clip',async()=>{
 const resolves={},p=createVideoPreloader({load:s=>new Promise(r=>resolves[s]=r),pin(){},unpin(){}}),v=video();
 const first=p.prepare(v,'old'),second=p.consume(v,'new');resolves.new('blob:new');assert.equal(await second,true);resolves.old('blob:old');assert.equal(await first,false);assert.equal(v.src,'blob:new');
});
test('tiny startup offsets avoid seeking but late joins catch up',()=>{
 assert.equal(initialVideoOffset(.112,3),0);assert.equal(initialVideoOffset(.02,3),0);assert.equal(initialVideoOffset(.8,3),.8);assert.equal(initialVideoOffset(4,3),2.96);
});

test('native media URLs preserve the original source after full-byte preparation',async()=>{
 const {createVideoBuffer}=await import('../public/video-buffer.js');let bytes=0;
 const buffer=createVideoBuffer({fetchImpl:async()=>({ok:true,blob:async()=>{bytes++;return new Blob(['original video'])}}),createURL:(_blob,source)=>source,revokeURL:()=>{}});
 assert.equal(await buffer.load('/media/deal/pos1.mp4'),'/media/deal/pos1.mp4');assert.equal(await buffer.load('/media/deal/pos1.mp4'),'/media/deal/pos1.mp4');assert.equal(bytes,1);
});
