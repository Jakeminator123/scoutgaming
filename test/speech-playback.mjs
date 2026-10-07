import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playSpeech, abortableDelay } from '../web/public/speech-playback.mjs';
import { DealerEngine } from '../web/public/dealer-engine.mjs';
import { createSpeechQueue } from '../web/public/speech-queue.mjs';
class Audio extends EventTarget {
  plays = 0; pauses = 0;
  play() { this.plays++; return Promise.resolve(); }
  pause() { this.pauses++; }
}
const tick = () => new Promise(r => setImmediate(r));
test('cancelling a loading line releases gameplay and suppresses its late voice after unmute',async()=>{
  const queue=createSpeechQueue();let bankReady;const bank=new Promise(r=>bankReady=r);
  const heard=[];let signal;
  const first=queue.enqueue(async s=>{signal=s;await bank;if(!s.aborted)heard.push('stale');});
  const second=queue.enqueue(()=>heard.push('also stale'));
  await tick();queue.cancel();await Promise.all([first,second]);
  assert.equal(signal.aborted,true);assert.equal(queue.pending,0);
  await queue.enqueue(()=>heard.push('fresh'));bankReady();await tick();
  assert.deepEqual(heard,['fresh']);assert.equal(queue.pending,0);
});
test('a hidden queue drops current and queued speech and does not replay them on return',async()=>{
  let visible=true,finish;const heard=[];
  const queue=createSpeechQueue({canPlay:()=>visible});
  queue.enqueue(signal=>new Promise(resolve=>{heard.push('first');finish=resolve;signal.addEventListener('abort',resolve,{once:true});}));
  queue.enqueue(()=>heard.push('queued'));
  await tick();visible=false;queue.cancel();
  await queue.enqueue(()=>heard.push('hidden'));await queue.idle;
  visible=true;await queue.enqueue(()=>heard.push('new event'));finish();await tick();
  assert.deepEqual(heard,['first','new event']);assert.equal(queue.pending,0);
});
test('repeated requested lines remain sequential and cancellation stops active audio',async()=>{
  const queue=createSpeechQueue(),audio=new Audio();const order=[];
  const first=queue.enqueue(signal=>playSpeech({audio,signal,onStart:()=>order.push('first'),onFinish:()=>order.push('end')}));
  const second=queue.enqueue(()=>order.push('second'));
  await tick();assert.deepEqual(order,['first']);assert.equal(queue.pending,2);
  audio.dispatchEvent(new Event('ended'));await Promise.all([first,second]);
  assert.deepEqual(order,['first','end','second']);
  const again=queue.enqueue(signal=>playSpeech({audio,signal}));await tick();
  queue.cancel();await again;assert.equal(audio.pauses,2);assert.equal(queue.pending,0);
});
test('completed line cannot stop a later line when its timeout would fire', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const first = new Audio(); let stops = 0;
  const p = playSpeech({audio:first,timeoutMs:100,onFinish:()=>stops++});
  await tick(); first.dispatchEvent(new Event('ended')); await p;
  const second = new Audio(); const abort = new AbortController();
  const p2 = playSpeech({audio:second,timeoutMs:200,signal:abort.signal}); await tick();
  t.mock.timers.tick(110); assert.equal(stops,1); assert.equal(second.pauses,0);
  first.dispatchEvent(new Event('error')); assert.equal(stops,1);
  abort.abort(); await p2;
});
test('timeout aborts pending preparation and prevents late audio', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const a = new Audio(); let ready; let signal;
  const p = playSpeech({ audio:a, timeoutMs:10, prepare:s=>{signal=s;return new Promise(r=>ready=r);} });
  t.mock.timers.tick(11); await p; ready(); await tick();
  assert.equal(a.plays,0); assert.equal(signal.aborted,true);
});
test('mute during calibration prevents audio start and finishes once', async () => {
  const a=new Audio(); const c=new AbortController(); let finished=0;
  const p=playSpeech({audio:a,signal:c.signal,prepare:s=>abortableDelay(1000,s),onFinish:()=>finished++});
  c.abort();await p; assert.equal(a.plays,0);assert.equal(finished,1);
});
test('decode output keeps submitting clip identity across an asynchronous boundary', () => {
  const callbacks=[];
  const original=globalThis.VideoDecoder;
  globalThis.VideoDecoder=class { constructor(c){callbacks.push(c);} configure(){} };
  try {
    const e=new DealerEngine({getContext:()=>({})},'dealer');
    e.config={};e.makeDecoder();
    e.frameTags.set(100,{key:'first',first:true,request:7});e.decodingClip='second';
    callbacks[0].output({timestamp:100,close(){}});
    assert.equal(e.display[0].key,'first');assert.equal(e.display[0].request,7);
    assert.equal(e.frameTags.size,0);
  } finally {globalThis.VideoDecoder=original;}
});
test('repeating the same speech clip gets a different presentation request', () => {
  const e=new DealerEngine({getContext:()=>({})},'dealer');e.index={clips:{hello:{}}};e.fetchClip=async()=>new ArrayBuffer(0);
  const a=e.interrupt('hello'),b=e.interrupt('hello');
  assert.notEqual(a,b);assert.deepEqual(e.nextClip(),{key:'hello',request:b});
});
