import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createLocalPresentation} from '../web/public/local-presentation.mjs';

const source=readFileSync(new URL('../web/public/app.mjs',import.meta.url),'utf8');
const body=(start,end)=>{
  const from=source.indexOf(start),to=source.indexOf(end,from);
  assert.ok(from>=0&&to>from);return source.slice(from,to);
};
const functions=body('async function beginDealingTake()', '\nasync function dealSequence()')
  +body('async function endDealingTake(', '\nasync function revealHole(')
  +body('async function revealHole(', '\nfunction clearTable()');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function fixture(t){
  const previousDocument=globalThis.document;
  const element=()=>({style:{},dataset:{},setAttribute(){},append(){},remove(){}});
  globalThis.document={hidden:false,createElement:element,addEventListener(){},removeEventListener(){}};
  const idle={id:'own-idle',sha256:'1'.repeat(64),src:'/idle'},video={id:'own-deal',sha256:'2'.repeat(64),src:'/deal'},jobs=[];
  const player={playLocalClip(take,options){return new Promise((resolve,reject)=>{
    jobs.push({take,options,resolve});options.signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});
  });}};
  const transport={request:async(url,options)=>new Response(JSON.stringify(url.includes('/config')
    ?{inventory:{families:[],videos:[]},dealerIdle:{dragan:idle}}
    :{video,standard:null,decision:{requestId:'fixture',sourceEvent:JSON.parse(options.body).event,media:{}}}),{status:200})};
  const controller=await createLocalPresentation({player,host:element(),dealerId:'dragan',version:()=>1,receipt(){},onIdle(){},onBusy(){},muted:()=>true,transport});
  t.after(()=>{controller.close();globalThis.document=previousDocument;});
  const context=vm.createContext({console:{info(){},warn(){}},localPresentation:controller,localPresentationEnabled:true,
    speechQueue:{idle:Promise.resolve()},speechPoseGate:{state:{actionOwner:'none'}},updatePoseState(){},
    performancePlayer:{finish:async()=>{},joins:false},round:{phase:'settled'},
    localCards:{sync(){},begin:()=>1,frame(){},finish:()=>false,reveal(){}},nativeObservation:{emit(){}},
    cardEl:()=>({style:{setProperty(){}},classList:{add(){}}})});
  vm.runInContext(functions,context);
  await context.endDealingTake();await tick();assert.equal(jobs.length,1,'prior player action releases its own idle');
  return {controller,jobs,context};
}

for(const kind of ['deal','reveal'])test(`actual ${kind} choreography reacquires ownership after a player action before late chat cleanup`,async t=>{
  const {controller,jobs,context}=await fixture(t);
  let playing;
  if(kind==='deal'){
    await context.beginDealingTake();
    playing=controller.present({type:'deal',to:'dealer',shoeDraw:7});
  }else{
    const back={style:{getPropertyValue:()=>1},replaceWith(){}};
    playing=context.revealHole({querySelector:()=>back},{r:'9',s:'H',shoeDraw:5});
  }
  await tick();const film=jobs.at(-1);
  assert.equal(jobs[0].options.signal.aborted,true,'new action takes over the idle film');
  assert.equal(film.take.media.src,'/deal');
  controller.state({ready:true});controller.state({speech:false});
  assert.equal(film.options.signal.aborted,false,'chat completion must not cancel a committed card film');
  assert.equal(jobs.length,2,'no replacement idle may start during the card');
  film.resolve({completed:true});await playing;
  await context.endDealingTake();await tick();
  assert.equal(jobs.length,3);assert.equal(jobs[2].take.media.src,'/idle');
});
