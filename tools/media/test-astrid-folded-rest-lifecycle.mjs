import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import vm from 'node:vm';

// Run the actual orchestration with manually presented video frames. This
// catches races hidden by media hash tests without pretending to test visuals.
const source=(await fs.readFile(new URL('../../services/game/public/astrid-folded-rest.mjs',import.meta.url),'utf8'))
  .replace(/^import .*;\n/gm,'').replace('export async function installFoldedRest','async function installFoldedRest');
const tick=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
async function setup(){
  const videos=[],paints=[],timers=new Map();let timerId=0;
  const element=()=>({style:{},dataset:{},setAttribute(){},remove(){this.removed=true;}});
  class Video extends EventTarget{
    constructor(){super();this.readyState=2;this.videoWidth=960;this.videoHeight=1520;this.duration=2.5;this.time=0;this.callbacks=new Map();this.next=0;this.plays=0;this.paused=true;}
    set src(value){this.url=value;queueMicrotask(()=>this.dispatchEvent(new Event('loadeddata')));}
    get src(){return this.url;}
    set currentTime(value){this.time=value;queueMicrotask(()=>this.dispatchEvent(new Event('seeked')));}
    get currentTime(){return this.time;}
    requestVideoFrameCallback(fn){const id=++this.next;this.callbacks.set(id,fn);return id;}
    cancelVideoFrameCallback(id){this.callbacks.delete(id);}
    play(){this.plays++;this.paused=false;return Promise.resolve();}
    pause(){this.paused=true;}
    removeAttribute(){} load(){}
    frame(time){this.time=time;const callbacks=[...this.callbacks.values()];this.callbacks.clear();for(const fn of callbacks)fn(0,{mediaTime:time});}
    end(){this.time=this.duration;this.paused=true;this.dispatchEvent(new Event('ended'));}
  }
  const ready={canvas:element(),glanceCanvas:element(),sourceSha256:'ready',prepares:0,holds:0,resumes:0,
    async holdAtBoundary(){this.holds++;},async prepareResume(){this.prepares++;return 'ready-frame';},
    captureFrame(){return 'ready-frame';},resume(){this.resumes++;},dispose(){this.disposed=true;}};
  const host={classList:{contains:()=>false},append(){}};
  const context=vm.createContext({console,Promise,Error,Set,Object,Math,String,innerWidth:1280,innerHeight:900,
    document:{createElement(kind){assert.equal(kind,'video');const video=new Video();videos.push(video);return video;}},
    MutationObserver:class{observe(){} disconnect(){}},addEventListener(){},removeEventListener(){},
    uniformRegistration:()=>({x:0,y:0,width:960,height:760}),
    createActorCompositor:()=>({canvas:element(),paint(video){paints.push({src:video.src,time:video.currentTime});},dispose(){}}),
    setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
  });
  vm.runInContext(`${source}\nglobalThis.install=installFoldedRest;`,context);
  const take={readySha256:'ready',width:960,height:760,camera:{}};
  for(const key of ['loop','out','back'])take[key]={src:key,frames:60,fps:24};
  const api=await context.install(host,take,ready);
  return {api,ready,paints,loop:videos[0],out:videos[1],back:videos[2],
    runTimers(delay){for(const [id,timer] of [...timers])if(timer.delay===delay){timers.delete(id);timer.fn();}}};
}
async function reachReady(s){
  s.loop.frame(2.3);const done=s.api.holdAtBoundary();await tick();s.loop.frame(0);await tick();s.out.end();await done;
}

test('queued rest exit retains the tail before bridge decode and coalesces callers',async()=>{
  const s=await setup();s.loop.frame(1.4);
  const first=s.api.holdAtBoundary(),second=s.api.holdAtBoundary();assert.equal(first,second);
  await tick();assert.equal(s.api.canvas.dataset.restState,'waiting-to-unfold');assert.equal(s.out.plays,0);
  s.loop.frame(2.4);const before=s.paints.length;s.loop.frame(0);
  assert.equal(s.paints.length,before,'wrapped loop head is not shown before the bridge');
  await tick();assert.equal(s.out.plays,1);assert.equal(s.api.canvas.dataset.restState,'unfolding');
  s.out.end();await first;assert.equal(s.api.canvas.dataset.restState,'ready');
  assert.equal(s.ready.prepares,1);s.api.dispose();
});

test('a request during folding unfolds directly without restarting the idle loop',async()=>{
  const s=await setup();await reachReady(s);s.api.resume();s.runTimers(700);await tick();
  assert.equal(s.api.canvas.dataset.restState,'folding');assert.equal(s.ready.prepares,1,'no visible base-pose reset before folding');
  const first=s.api.holdAtBoundary(),second=s.api.holdAtBoundary();assert.equal(first,second);
  s.back.end();await tick();assert.equal(s.loop.plays,1,'folded endpoint is retained, not replaced by a loop restart');
  assert.equal(s.out.plays,2,'only one outgoing transition starts');s.out.end();await first;s.api.dispose();
});

test('dispose releases a request waiting for the next loop boundary',async()=>{
  const s=await setup();s.loop.frame(1);const pending=s.api.holdAtBoundary();await tick();s.api.dispose();
  await pending;assert.equal(s.out.plays,0);assert.equal(s.ready.disposed,true);
});
