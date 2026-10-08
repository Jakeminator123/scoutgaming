import test from 'node:test';import assert from 'node:assert/strict';
import {createVideoBuffer,tableVideoSources} from '../public/video-buffer.js';
import {readFileSync} from 'node:fs';
const turn=()=>new Promise(r=>setImmediate(r));
test('full-quality buffers deduplicate playback and downloads; priority queues one transfer',async()=>{
 const calls=[],pending=[];const payload=new Uint8Array([0,1,255,32]);let saved;
 const b=createVideoBuffer({fetchImpl:source=>new Promise(resolve=>{calls.push(source);pending.push(()=>resolve({ok:true,blob:async()=>new Blob([payload])}));}),createURL:blob=>{saved=blob;return 'blob:'+calls.at(-1);}});
 const idle=b.load('/idle',10);await turn();const background=b.load('/background',10),game=b.load('/game',0),again=b.load('/game',0);assert.equal(game,again);assert.deepEqual(calls,['/idle']);pending.shift()();await idle;await turn();assert.deepEqual(calls,['/idle','/game']);pending.shift()();await game;assert.deepEqual(new Uint8Array(await saved.arrayBuffer()),payload);await turn();assert.deepEqual(calls,['/idle','/game','/background']);pending.shift()();await background;assert.equal(await b.load('/game'),'blob:/game');assert.equal(calls.length,3);
});
test('failed loads can retry and cache evicts unpinned sources without disrupting video elements',async()=>{
 let fail=true;const revoked=[];const b=createVideoBuffer({maxBytes:4,fetchImpl:async()=>{if(fail){fail=false;throw Error('offline');}return{ok:true,blob:async()=>new Blob(['1234'])};},createURL:()=>`blob:${Math.random()}`,revokeURL:u=>revoked.push(u)});
 await assert.rejects(b.load('/a'),/offline/);await b.load('/a');b.pin('/a');await b.load('/b');assert.ok(b.has('/a'));assert.ok(b.has('/b'));b.unpin('/a');assert.equal(b.bytes,4);assert.equal(revoked.length,1);assert.equal(b.has('/a'),false);
});
test('preparation includes every possible server announcement, dealer and occupied boxes only',async()=>{
 const m=JSON.parse(readFileSync(new URL('../public/media/manifest.json',import.meta.url)));const sources=tableVideoSources(m,[3]);assert.ok(sources.includes('/media/deal/pos4.mp4'));assert.ok(!sources.includes('/media/deal/pos1.mp4'));assert.equal(sources.filter(x=>x.includes('/deal/')).length,4);assert.ok(sources.includes(m.repliker.find(x=>x.id==='sidebet_2').url));for(const event of ['goodluck','bust','double','insurance','dealerblackjack','blackjack','dealerbust','win','push','lose'])assert.ok(sources.includes(m.repliker.find(x=>x.event===event).url));
 const progress=[];const b=createVideoBuffer({fetchImpl:async()=>({ok:true,blob:async()=>new Blob(['a'])}),createURL:()=> 'blob:ready'});await b.prepare(['/a','/a','/b'],(done,total)=>progress.push([done,total]));assert.deepEqual(progress,[[0,2],[1,2],[2,2]]);
});
