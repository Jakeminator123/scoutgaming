import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMovingDealPlan,createMovingDealReservations} from '../services/game/moving-speech-deal-plan.mjs';
import {DRAGAN_KEVIN_PROFILE as profile} from '../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
import {movingDealCard} from '../services/game/public/moving-speech-sequence.mjs';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createSpeechPoseGate} from '../packages/presentation/runtime/speech-pose-gate.mjs';

function fixture(){
  const clips=profile.takes.map((t,i)=>({videoId:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,sha256:t.sha256,
    take:`clip-00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,bytes:100+i,fps:24,frameCount:t.frames,width:1080,height:1920}));
  const videos=clips.map(c=>({id:c.videoId,sha256:c.sha256,size:c.bytes,available:true,classification:{dealerId:'dragan',kind:'action'}}));
  const frozenContext={schemaVersion:3,records:videos,inventory:{videos},project:{lines:[{dealerId:'dragan',variants:clips.map(c=>({videoGenerationId:c.videoId}))}]}};
  const receipt={version:7,payload:JSON.stringify([{type:'speak',line:'goodluck'},
    {type:'deal',to:'box',box:3,shoeDraw:1},{type:'deal',to:'dealer',faceDown:false,shoeDraw:2},
    {type:'deal',to:'box',box:3,shoeDraw:3},{type:'deal',to:'dealer',faceDown:true,shoeDraw:4}])};
  return {receipt,version:7,sourceSet:{dealerId:'dragan',clips},frozenContext,
    publicVideo:id=>({id,sha256:clips.find(c=>c.videoId===id).sha256,src:'/api/presentation/registered-video/fixture/'+id})};
}
test('committed box3 uses complete existing pose chain, exact source frames and authoritative draws',()=>{
  const input=fixture(),result=prepareMovingDealPlan(input);
  assert.deepEqual(result.steps.map(s=>s.video.filmedTake.takeKey),['4:i','dealer:base','4:base','hole:base']);
  assert.deepEqual(result.steps.map(s=>[s.first,s.end,s.event.shoeDraw]),[[0,66,1],[66,105,2],[105,144,3],[144,183,4]]);
  assert.equal(result.frames.length,183);
  assert.equal(result.frames[65].frame,65);assert.equal(result.frames[66].frame,0);
  assert.equal(result.frames[182].frame,38);
  assert.equal(result.steps[0].event.box,3);assert.equal(result.steps[3].event.faceDown,true);
  assert.ok(result.steps.every(s=>!Object.hasOwn(s.event,'card')));
});
test('sparse absolute box3 maps to live hand zero and never borrows another hand card',()=>{
  const first={shoeDraw:1,rank:'A'},second={shoeDraw:3,rank:'K'};
  const round={dealer:[{shoeDraw:2,rank:'7'}],live:()=>[{box:3,cards:[first,second]}]};
  assert.deepEqual(movingDealCard(round,{to:'box',box:3,shoeDraw:1}),{card:first,liveIndex:0,visibleCards:[first]});
  assert.deepEqual(movingDealCard(round,{to:'dealer',shoeDraw:4,faceDown:true}).card,null);
  assert.throws(()=>movingDealCard(round,{to:'box',box:0,shoeDraw:1}),/hand_unavailable/);
  assert.throws(()=>movingDealCard(round,{to:'box',box:3,shoeDraw:2}),/card_unavailable/);
});
test('app sequence cursor advances exact source frames and commits each authoritative sparse-box draw once',async()=>{
  const app=await readFile(new URL('../services/game/public/app.mjs',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('function finishMovingDealStep('),app.indexOf('async function playChatDecision('));
  const sequence=prepareMovingDealPlan(fixture()),owned={version:7,lastFrame:-1,stepIndex:-1,completed:false,sequence};
  const moves=[],finished=[],placed=[],cards=[{shoeDraw:1,rank:'A'},{shoeDraw:3,rank:'K'}];
  const context={activeDealSpeech:owned,tableVersion:7,movingDealCard,round:{dealer:[{shoeDraw:2,rank:'7'}],live:()=>[{box:3,cards}]},
    localCards:{begin:(_video,event)=>event.shoeDraw,frame:(token,seconds)=>moves.push([token,seconds]),finish:(_t,draw)=>finished.push(draw)},
    $:()=> 'dealer',boxContainer:i=>{assert.equal(i,0);return 'box3';},dealCardTo:(container,card,event)=>placed.push({container,card,event}),updateBadge(){}};
  runInNewContext(source+';this.frame=movingDealFrame;this.end=movingDealEnd',context);
  for(let k=0;k<183;k++)context.frame(owned,sequence,k);
  context.end(owned);context.end(owned);
  assert.deepEqual(finished,[1,2,3,4]);assert.deepEqual(placed.map(p=>p.container),['box3','dealer','box3','dealer']);
  assert.equal(placed.at(-1).card,null);assert.deepEqual(moves.filter((_,k)=>[0,65,66,182].includes(k)),[[1,0],[1,65/24],[2,0],[4,38/24]]);
  assert.throws(()=>context.frame(owned,sequence,0),/stale/);
});
test('muted or refused next-deal chat returns fallback and releases busy state without calling provider',async()=>{
  const app=await readFile(new URL('../services/game/public/app.mjs',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('async function sendChat('),app.indexOf("$('#gate-enter').onclick"));
  for(const muted of [true,false]){
    const identity={dealerId:'dragan',sessionRevision:2,roundRevision:7},input={value:'Hej'},send={disabled:false};let timers=0;
    const gate={...createSpeechPoseGate({enqueue:()=>assert.fail('no queue'),initialState:{...identity,dealerPose:'deal-action',actionOwner:'deal',speechOwner:'none',idlePresented:null,visible:true,muted}})};
    if(!muted)gate.reserveDeal=()=>{throw Error('reserved elsewhere');};
    const context={studioPreview:null,$:selector=>selector==='#chat-input'?input:send,chatBusy:false,probeClient:null,
      compactChat:()=>false,performance:{now:()=>0},setChatStatus(){},chatStatus:null,localPresentationEnabled:true,
      setInterval(){timers++;return 1;},clearInterval(){timers=0;},nativeObservation:{context:()=>({}),emit(){}},
      chatHistory:[],crypto:{randomUUID:()=> 'request-1'},chatPlaybackDiagnostic:{begin(){},finish(){}},poseIdentity:()=>identity,
      localPresentation:null,chatLog(){},speechPoseGate:gate,AbortController,pendingChatReplies:new Map(),
      refreshNextDealChat(){},chatFailureMessage:String,apiFetch:()=>assert.fail('no provider'),activeDealSpeech:null};
    assert.equal(await runInNewContext(source+';sendChat({message:"Hej",dealSpeech:{version:7}})',context),false);
    assert.equal(context.chatBusy,false);assert.equal(send.disabled,false);assert.equal(timers,0);assert.equal(context.pendingChatReplies.size,0);
    assert.equal(input.value,'Hej');
  }
});
test('stale command, missing published exact source, audio-bearing action and unbound take fail closed',()=>{
  for(const mutate of [i=>i.version++,i=>i.frozenContext.records.splice(0),
    i=>i.frozenContext.records.forEach(v=>v.classification.recordedSpeech={status:'pending'}),
    i=>i.frozenContext.project.lines[0].variants=[],i=>i.sourceSet.clips.forEach(c=>c.frameCount++),
    i=>i.receipt.payload='[]']){
    const input=fixture();mutate(input);assert.throws(()=>prepareMovingDealPlan(input),/moving_deal/);
  }
});
test('fresh committed opening reserves once; normal presentation, expiry, restart and newer command revoke it',()=>{
  let now=0;const r=createMovingDealReservations({now:()=>now});
  const scope={ownerHash:'a'.repeat(64),sessionRevision:'session-1',context:{operatorSlug:'test',roomId:'one',packageRevision:1,dealerId:'dragan'}};
  const command={op:'start',dealer:'dragan'},view={version:7},event={playerId:'player',command,view,session:{movingSpeech:scope}};
  const claim=(version=7,changes={})=>r.claim('player','dragan',version,{...scope,...changes});
  assert.throws(()=>claim());
  r.committed(event);assert.throws(()=>r.claim('other-player','dragan',7,scope));assert.throws(()=>r.claim('player','astrid',7,scope));
  for(const changes of [{ownerHash:'b'.repeat(64)},{sessionRevision:'other'},
    ...['roomId','operatorSlug','packageRevision'].map(key=>({context:{...scope.context,[key]:key==='packageRevision'?2:'other'}}))])assert.throws(()=>claim(7,changes));
  const lease=claim();lease.assertCurrent();assert.throws(()=>claim());
  assert.throws(()=>r.normal('player',7));lease.finish();assert.throws(()=>lease.assertCurrent());r.normal('player',7);
  r.committed(event);assert.throws(()=>claim(),'duplicate delivery must not reopen consumed window');
  r.committed({...event,view:{version:8}});r.normal('player',8);assert.throws(()=>claim(8));
  r.committed({...event,view:{version:9}});now=60000;assert.throws(()=>claim(9));
  r.committed({...event,view:{version:10}});const next=claim(10);
  r.committed({...event,command:{op:'act'},view:{version:11}});assert.throws(()=>next.assertCurrent());
  assert.throws(()=>createMovingDealReservations().claim('player','dragan',10));
});
