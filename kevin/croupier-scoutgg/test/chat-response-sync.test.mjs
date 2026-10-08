import test from 'node:test';
import assert from 'node:assert/strict';
import {enqueueSynchronizedReply} from '../public/chat-response-sync.js';

test('chat text waits for the matching video playback to start', async()=>{
  let queued,visible=0;
  const done=enqueueSynchronizedReply(item=>{queued=item;return Promise.resolve(true);},{url:'/answer.mp4',text:'Welcome',ms:{total:4300}},()=>visible++);
  assert.equal(visible,0);
  queued.onStart();
  assert.equal(visible,1);
  queued.onStart();
  assert.equal(visible,1);
  assert.equal(await done,true);
});

test('chat text remains available if its video cannot play', async()=>{
  let queued,visible=0;
  const done=enqueueSynchronizedReply(item=>{queued=item;return Promise.resolve(false);},{url:'/answer.mp4',text:'Welcome'},()=>visible++);
  assert.equal(visible,0);
  queued.onStart();
  assert.equal(await done,false);
  assert.equal(visible,1);
});
