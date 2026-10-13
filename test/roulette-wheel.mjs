import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {WHEEL,pocketColor} from '../web/games/roulette/rules.mjs';
import {createSpin,presentationForRound,SPIN_MS,TAU} from '../web/public/roulette/wheel-motion.mjs';
const circularDistance=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));

test('every authoritative European outcome lands in its own moving pocket, including zero',()=>{
  assert.equal(new Set(WHEEL).size,37);
  for(const start of [0,.31,5.7])for(const [index,number] of WHEEL.entries()){
    const motion=createSpin(index,start),end=motion(1);
    assert.ok(circularDistance(end.angle,Math.PI/2)<1e-10,String(number));
    for(const t of [.8,.85,.9,.99,1]){
      const pose=motion(t),relative=pose.angle-pose.rotation;
      const actual=Math.round((((relative+Math.PI/2)%TAU+TAU)%TAU)/(TAU/37))%37;
      assert.equal(WHEEL[actual],number);
      assert.equal(pose.radius,107);
    }
    assert.equal(end.settled,true);assert.equal(motion(.999).settled,false);
    assert.equal(motion(0).rotation,start);
  }
});
test('ball stays continuous through drop/capture, and the next round starts from the last rotor pose',()=>{
  let rotation=0;
  for(const number of [33,6,0,26]){
    const motion=createSpin(WHEEL.indexOf(number),rotation);
    for(let i=1;i<=9000;i++){
      const a=motion((i-1)/9000),b=motion(i/9000);
      assert.ok(Math.hypot(b.x-a.x,b.y-a.y)<1.1);
      assert.ok(b.radius>=107&&b.radius<=196);
      assert.ok(b.rotation>=a.rotation);
    }
    rotation=motion(1).rotation%TAU;
  }
  for(const index of [-1,37,NaN,1.5])assert.throws(()=>createSpin(index));
});
test('presentation varies final screen position and timing while preserving all 37 outcomes and replay',()=>{
  const quadrants=new Set(),durations=new Set();
  for(let id=0;id<120;id++){
    const profile=presentationForRound(`public-round-${id}`);assert.deepEqual(profile,presentationForRound(`public-round-${id}`));
    quadrants.add(Math.floor(((profile.stopAngle+TAU)%TAU)/(Math.PI/2)));durations.add(profile.duration);
    assert.ok(profile.duration>=8500&&profile.duration<=12000);
    for(let index=0;index<37;index++){
      const pose=createSpin(index,.71,profile)(1);
      assert.ok(circularDistance(pose.angle,profile.stopAngle)<1e-10);
      assert.ok(circularDistance(pose.angle-pose.rotation,-Math.PI/2+index*TAU/37)<1e-10);
    }
  }
  assert.equal(quadrants.size,4);assert.ok(durations.size>50);
});

function fixture({reduced=false,fail=false}={}){
  let time=0,id=0,draws=0;const frames=new Map(),timers=new Map(),labels=[];
  const canvas={style:{},dataset:{},setAttribute(){},remove(){this.removed=true;},getContext(){return ctx;}};
  const ctx=new Proxy({fillText(value){labels.push(value);},clearRect(){draws++;if(fail&&draws>1)throw Error('context lost');},createRadialGradient(){return {addColorStop(){}};}},{get:(obj,key)=>obj[key]??(()=>{})});
  const source=readFileSync(new URL('../web/public/roulette/wheel.mjs',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export function mountRouletteWheel','function mountRouletteWheel');
  const mount=runInNewContext(source+'\nmountRouletteWheel;',{
    WHEEL,pocketColor,createSpin,presentationForRound,SPIN_MS,TAU,document:{createElement:()=>canvas},
    setTimeout(fn){const key=++id;timers.set(key,fn);return key;},clearTimeout:key=>timers.delete(key),
  });
  const options={now:()=>time,requestFrame:fn=>{const key=++id;frames.set(key,fn);return key;},cancelFrame:key=>frames.delete(key),reducedMotion:()=>reduced};
  const host={append(){}};
  return {mount:(designId='roulette-anna-v1')=>mount(host,{designId,placement:{width:1.044565,x:0,y:0}},options),canvas,labels,frames,timers,
    advance(ms){time+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn());},
    timeout(){[...timers.values()].forEach(fn=>fn());}};
}
test('dealer release delays the single ball while every outcome still lands correctly',()=>{
  for(let index=0;index<37;index++)for(const ballDelay of [.1,.25,.5]){
    const motion=createSpin(index,0,{ballDelay}),early=motion(ballDelay/2),end=motion(1);
    assert.equal(early.visible,false);assert.ok(early.rotation>0);assert.equal(motion(ballDelay).visible,true);
    const pocket=-Math.PI/2+index*TAU/37;
    assert.ok(Math.abs(Math.sin(end.angle-end.rotation-pocket))<1e-10);
    let previous=motion(0);
    // Even the half-duration flight stays continuous at sub-millisecond steps.
    for(let i=1;i<=10000;i++){const next=motion(i/10000);assert.ok(Math.hypot(next.x-previous.x,next.y-previous.y)<3);previous=next;}
  }
});

test('wheel follows video time during buffering and completes after the clock resumes',async()=>{
  const f=fixture(),wheel=f.mount();let videoTime=0,done=false;
  const play=wheel.play(23,'clocked',{clock:()=>videoTime,ballDelayMs:2000}).then(()=>{done=true;});
  f.advance(16000);await Promise.resolve();assert.equal(done,false);
  videoTime=12000;f.advance(1);await play;assert.equal(done,true);wheel.close();
});

test('rotor draws each exact number once, and refuses other game/table designs',()=>{
  const f=fixture();assert.equal(f.mount('blackjack'),null);assert.equal(f.mount('unknown'),null);
  const wheel=f.mount();assert.deepEqual(f.labels,WHEEL.map(String));wheel.close();
});
test('two consecutive plays finish and leave no pending frame or timer; close resolves an active play',async()=>{
  const f=fixture(),wheel=f.mount();
  for(const number of [33,6]){
    const played=wheel.play(number);assert.equal(f.frames.size,1);f.advance(12000);await played;
    assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
  }
  const pending=wheel.play(0);wheel.close();await pending;assert.equal(f.canvas.removed,true);assert.equal(f.frames.size,0);
});
test('reduced motion, hidden-tab timer and context loss cannot strand a confirmed receipt',async()=>{
  const reduced=fixture({reduced:true});await reduced.mount().play(0);assert.equal(reduced.frames.size,0);
  const hidden=fixture(),wheel=hidden.mount(),play=wheel.play(12);hidden.timeout();await play;assert.equal(hidden.frames.size,0);
  const broken=fixture({fail:true});await broken.mount().play(9);assert.equal(broken.frames.size,0);assert.equal(broken.canvas.hidden,true);
});

test('real submit holds the displayed receipt until landing and never retries a confirmed round after visual failure',async()=>{
  const app=readFileSync(new URL('../web/public/roulette/app.mjs',import.meta.url),'utf8');
  const submit=app.slice(app.indexOf('async function submit()'),app.indexOf('async function init()'));
  for(const fails of [false,true]){
    let release,calls=0;const rendered=[],messages=[],elements=new Map();
    const request={playerId:'isolated',requestId:'one'},receipt={player:{id:'isolated'},requestId:'one',round:{event:{outcome:{number:6,color:'black'}},returned:0}};
    const context={busy:false,pending:request,state:null,draft:new Map(),undo:[],
      $:id=>{if(!elements.has(id))elements.set(id,{open:false,hidden:true});return elements.get(id);},
      command:async data=>{calls++;assert.equal(data,request);return receipt;},
      clearPending:()=>{context.pending=null;},renderDraft:()=>{},renderState:()=>rendered.push(context.state),showResult:()=>{},
      message:text=>messages.push(text),colourNames:{black:'Svart'},errorText:{},money:String,
      roomScene:{playRound:number=>{assert.equal(number,6);return new Promise((resolve,reject)=>{release=()=>fails?reject(Error('context lost')):resolve();});}},
    };
    context.roomSceneReady=Promise.resolve(context.roomScene);
    const run=runInNewContext(submit+'\nsubmit;',context);
    const finished=run();await new Promise(setImmediate);
    assert.equal(context.busy,true);assert.equal(calls,1);assert.equal(rendered.length,0);
    await run();assert.equal(calls,1);release();await finished;
    assert.equal(context.busy,false);assert.equal(context.pending,null);assert.deepEqual(rendered,[receipt]);
    assert.match(messages.at(-1),/6 · Svart/);assert.equal(calls,1);
  }
});
