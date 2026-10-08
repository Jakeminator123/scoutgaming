import test from 'node:test';import assert from 'node:assert/strict';
import {compactPlaybackReport} from '../public/playback-diagnostics.js';
test('phone report retains recent dealing evidence within message size limit',()=>{
 const events=Array.from({length:120},(_,i)=>({type:'seeked',ms:i*1000,clip:i>100?'posdealer.mp4':'still.mp4',visible:true,time:1.25,ready:4}));
 const data={elapsedMs:161315,visible:true,videos:[{clip:'posdealer.mp4',frameAgeMs:900,visible:true,ready:4}],counts:{seeking:20},events,gaps:Array.from({length:120},(_,i)=>({ms:i,gapMs:900,clip:'posdealer.mp4'})),visibility:[],longTasks:[],resources:Array.from({length:60},()=>({path:'/media/deal/posdealer.mp4',ms:1000,bytes:123456})),videoFrameCallbacks:true,userAgent:'iPhone Chrome '.repeat(15),viewport:[393,665,3]};
 const r=compactPlaybackReport(data),text=JSON.stringify(r);assert.ok(text.length<=2800);assert.equal(r.version,2);assert.equal(r.events[0].ms,119000);assert.equal(r.events[0].clip,'posdealer.mp4');assert.equal(r.videos[0].frameAgeMs,900);assert.equal(r.counts.seeking,20);assert.deepEqual(JSON.parse(text),r);assert.equal(data.events.length,120);
});
