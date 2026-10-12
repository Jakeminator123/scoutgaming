import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaFetch} from '../public/media-fetch.js';

const cache=u=>u.startsWith('/media/')?'https://media.example'+u:u;
const ok={ok:true,status:206};

test('a clip comes from the media cache while the cache answers',async()=>{
 const calls=[];let off=0;const f=createMediaFetch(cache,()=>off++,async u=>{calls.push(u);return ok;});
 assert.equal(await f('/media/a.mp4',{}),ok);assert.deepEqual(calls,['https://media.example/media/a.mp4']);assert.equal(off,0);
});
test('a cache the browser blocks (staging origin) gives the clip from this host and turns the cache off',async()=>{
 const calls=[];let off=0;const f=createMediaFetch(cache,()=>off++,async u=>{calls.push(u);if(u.startsWith('https:'))throw new TypeError('Failed to fetch');return ok;});
 assert.equal(await f('/media/a.mp4',{}),ok);assert.deepEqual(calls,['https://media.example/media/a.mp4','/media/a.mp4']);assert.equal(off,1);
});
test('a cache error status also falls back to this host',async()=>{
 const calls=[];const f=createMediaFetch(cache,()=>{},async u=>{calls.push(u);return u.startsWith('https:')?{ok:false,status:403}:ok;});
 assert.equal(await f('/media/a.mp4',{}),ok);assert.equal(calls.length,2);
});
test('an aborted transfer is not retried and does not turn the cache off',async()=>{
 const ac=new AbortController();ac.abort();let off=0;const f=createMediaFetch(cache,()=>off++,async()=>{throw new DOMException('aborted','AbortError');});
 await assert.rejects(f('/media/a.mp4',{signal:ac.signal}));assert.equal(off,0);
});
test('anything the cache does not serve goes straight to this host',async()=>{
 const calls=[];const f=createMediaFetch(cache,()=>{},async u=>{calls.push(u);return ok;});
 await f('/answers/x.mp4',{});assert.deepEqual(calls,['/answers/x.mp4']);
});
