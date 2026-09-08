import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playSpeech, abortableDelay } from '../web/public/speech-playback.mjs';
import { DealerEngine } from '../web/public/dealer-engine.mjs';
class Audio extends EventTarget {
  plays = 0; pauses = 0;
  play() { this.plays++; return Promise.resolve(); }
  pause() { this.pauses++; }
}
const tick = () => new Promise(r => setImmediate(r));
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


test('provider session limit cannot be performed as dealer dialogue', async () => {
  const { isAgentFailure } = await import('../web/agent-response.mjs');
  assert.equal(isAgentFailure("You've hit your session limit · resets 8:30am (UTC)"), true);
  assert.equal(isAgentFailure('The table limit is displayed above.'), false);
});
