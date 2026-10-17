// Offline DOM/MSE/WS fixtures. They execute the product queue/gate/player and
// QA delivery used by app.mjs; simulated frames are not live decoder approval.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {installNativeP6GamePlayback,createNativeP6GameQueueDelivery,nativeP6GameAvailability,NATIVE_P6_GAME_ORIGIN,
  NATIVE_P6_GAME_CONTEXT_PATH,NATIVE_P6_GAME_SOURCE_PATHS} from '../web/public/native-p6-game-playback.mjs';
import {createSpeechQueue} from '../web/public/speech-queue.mjs';
import {createSpeechPoseGate} from '../web/public/speech-pose-gate.mjs';
import {playGeneratedSpeech} from '../web/public/generated-speech-player.mjs';
import {DEFAULT_DEALER_COMPOSITING} from '../packages/presentation/contracts/dealer-compositing.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const paths=NATIVE_P6_GAME_SOURCE_PATHS;
const sources=await Promise.all(paths.map(p=>readFile(new URL('../'+p,import.meta.url))));
const sourceHashes=Object.fromEntries(paths.map((p,i)=>[p,hash(sources[i])]));
const owned={actorSha256:'2'.repeat(64),ownerSessionSha256:'3'.repeat(64),sessionRevision:'3'.repeat(64),roundRevision:'0',policySha256:'4'.repeat(64)};
const href=NATIVE_P6_GAME_ORIGIN+'/?dealer=astrid&presentation=local&nativeP6GamePlayback=1';
const mime='video/mp4; codecs="avc1.64002a, mp4a.40.2"';
function descriptor(){const id='a'.repeat(32),expiresAt=Date.now()+30000,exactText='Welcome to the table.';
  return{schemaVersion:1,kind:'generated-speech-stream',id,requestId:'qa-game-'+randomUUID(),dealerId:'astrid',exactText,
    textSha256:hash(exactText),reviewStatus:'pending',url:'/speech-stream',expiresAt,
    ticket:Buffer.from(JSON.stringify({sessionId:id,exp:expiresAt})).toString('base64url')+'.'+'x'.repeat(43)};}
function fixture(t,{ownerChangeAt=0,ownerKey='policySha256',stale=false,deny=false,changedSource=false,poseChangeAt=0,quiet=true,serverSkewMs=0,serverRollbackAt=0,now=Date.now,renderFrameFails=false}={}){
  const media=[],sockets=[],frames=new Map(),fetches=[],pending=new Map();let frameId=0,reads=0,acquired=0,released=0,prepared=false,rendered=0;
  const renderer={dealerId:'astrid',sessionRevision:randomUUID(),roundRevision:'0'},wireId=randomUUID();
  const install=(key,value)=>{const prior=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
    t.after(()=>prior?Object.defineProperty(globalThis,key,prior):delete globalThis[key]);};
  class Element extends EventTarget{
    constructor(){super();this.style={};this.dataset={};this.children=[];this.isConnected=true;}
    append(...nodes){for(const n of nodes){this.children.push(n);n.parentElement=this;}}
    contains(value){return value===this||this.children.some(n=>n.contains(value));}
    remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}
    removeAttribute(){}setAttribute(){}getBoundingClientRect(){return{left:0,top:0,right:500,bottom:400,width:500,height:400};}
  }
  class Video extends Element{
    constructor(){super();Object.assign(this,{paused:true,muted:false,volume:1,currentTime:0,videoWidth:384,videoHeight:384});media.push(this);}
    play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}load(){}
    requestVideoFrameCallback(fn){const id=++frameId;frames.set(id,fn);return id;}cancelVideoFrameCallback(id){frames.delete(id);}
  }
  class SourceBuffer extends EventTarget{
    constructor(){super();this.buffered={length:0,start:()=>0,end:()=>.5};}
    appendBuffer(){this.updating=true;queueMicrotask(()=>{this.updating=false;this.buffered.length=1;this.dispatchEvent(new Event('updateend'));});}
    abort(){this.updating=false;}
  }
  class MediaSource extends EventTarget{
    static isTypeSupported(v){return v===mime;}
    constructor(){super();this.readyState='closed';queueMicrotask(()=>{this.readyState='open';this.dispatchEvent(new Event('sourceopen'));});}
    addSourceBuffer(){return new SourceBuffer();}endOfStream(){this.readyState='ended';}
  }
  class Socket extends EventTarget{
    static OPEN=1;constructor(url,protocols){super();Object.assign(this,{url,protocols,readyState:1});sockets.push(this);}
    message(v){this.dispatchEvent(new MessageEvent('message',{data:v instanceof ArrayBuffer?v:JSON.stringify(v)}));}
    close(){this.readyState=3;this.dispatchEvent(new Event('close'));}send(){}
  }
  install('location',{origin:NATIVE_P6_GAME_ORIGIN});install('innerWidth',800);install('innerHeight',600);
  install('document',{hidden:false,visibilityState:'visible',createElement:k=>k==='video'?new Video():new Element(),elementFromPoint:()=>mount});
  install('getComputedStyle',v=>({visibility:v.style.visibility||'visible',display:v.style.display||'block',opacity:v.style.opacity??'1'}));
  install('MediaSource',MediaSource);install('WebSocket',Socket);
  install('Audio',class{constructor(){assert.fail('no second audible element');}});
  t.mock.method(URL,'createObjectURL',v=>{assert.ok(v instanceof MediaSource,'game mode imports no Blob wrapper');return'blob:mse';});
  t.mock.method(URL,'revokeObjectURL',()=>{});
  const mount=new Element(),original=new Element();mount.append(original);
  original.tagName='CANVAS';original.className='presentation-composed-film';
  mount.querySelector=selector=>selector==='.presentation-composed-film'&&mount.contains(original)?original:null;
  const queue=createSpeechQueue({canPlay:()=>!document.hidden});let gate;
  gate=createSpeechPoseGate({enqueue:fn=>queue.enqueue(fn),initialState:{...renderer,dealerPose:'standard-idle',actionOwner:'none',speechOwner:'none',
    idlePresented:{...renderer,presentationId:'actual-renderer-fixture'},visible:true,muted:false},
    onSpeech:async(decision,{signal,job})=>{
      gate.updateRendererState({dealerPose:'speech',speechOwner:'chat-'+job.jobId,idlePresented:null});
      const own=pending.get(job.jobId);
      const check=()=>{const value=gate.get(job.jobId),state=gate.state;assert.equal(value.status,'speaking');
        if(value.sessionRevision!==renderer.sessionRevision||value.roundRevision!==renderer.roundRevision||state.actionOwner!=='none'
          ||state.speechOwner!=='chat-'+job.jobId||!state.visible||state.muted)throw Error('stale_speech_stream_pose');};
      try{await playGeneratedSpeech(decision.speechStream,{exactText:decision.exactText,dealerId:'astrid',requestId:job.jobId,mount,signal,
        // Match app.mjs's existing shared compositor injection. These remain
        // simulated frames; this fixture cannot establish live pixel approval.
        prepareRendering:async key=>{assert.deepEqual(key,DEFAULT_DEALER_COMPOSITING);prepared=true;},
        renderFrame:video=>{assert.equal(prepared,true);assert.equal(video,media[0]);if(renderFrameFails)return false;
          rendered++;mount.dataset.presentationClipMode='green-screen';return true;},
        beforeStart:async()=>{check();await own.beforeStart();check();},streamObserver:own.nativeP6Observer,onReceipt:own.nativeP6Receipt});}
      finally{gate.updateRendererState({dealerPose:'standard-idle',speechOwner:'none'});
        gate.presentStandardIdle({...renderer,presentationId:'actual-renderer-return'});}
    }});
  const fetchImpl=async(path,options)=>{fetches.push(path);assert.equal(options.method,'GET');assert.equal(options.credentials,'same-origin');
    assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.equal(Object.hasOwn(options,'body'),false);
    if(path===NATIVE_P6_GAME_CONTEXT_PATH){reads++;const value={...owned,observedAtMs:now()+serverSkewMs-(stale?6000:0)-(reads===serverRollbackAt?1:0)};
      if(reads===ownerChangeAt)value[ownerKey]='6'.repeat(64);if(reads===poseChangeAt)gate.updateRendererState({actionOwner:'dealing'});
      const r=new Response(JSON.stringify(value),{status:deny?404:200,headers:{'content-type':'application/json'}});
      Object.defineProperty(r,'url',{value:NATIVE_P6_GAME_ORIGIN+path});return r;}
    const i=paths.findIndex(p=>'/'+p.replace('web/public/','')===path);assert.notEqual(i,-1,'no generation or unknown URL');
    const r=new Response(changedSource?'changed':sources[i],{headers:{'content-type':'text/javascript'}});
    Object.defineProperty(r,'url',{value:NATIVE_P6_GAME_ORIGIN+path});return r;};
  const availabilityState={busy:!quiet,hasRound:false,chatBusy:false,speaking:false,muted:false};
  const readAvailability=()=>({...availabilityState,hidden:document.hidden,queuePending:queue.pending,posePending:gate.pendingCount,
    actionNone:gate.state.actionOwner==='none',speechNone:gate.state.speechOwner==='none',
    standardIdle:gate.state.dealerPose==='standard-idle',idlePresented:gate.state.idlePresented!==null});
  const available=()=>nativeP6GameAvailability(readAvailability()).quiet;
  const deliver=createNativeP6GameQueueDelivery({identity:()=>({...renderer}),isAvailable:available,gate,pending,
    onAcquire:()=>acquired++,onRelease:()=>released++});
  const start=()=>installNativeP6GamePlayback({href,identity:()=>({...renderer}),isAvailable:available,readAvailability,deliver,mount,fetchImpl,now});
  const input=()=>({runId:randomUUID(),expectedSha:'1'.repeat(40),attempt:1,descriptor:descriptor(),expectedOwnedState:{...owned},sourceHashes,
    sessionObserverSourceSha256:'5'.repeat(64)});
  const feed=()=>{sockets[0].message({t:'ready',protocol:2,id:wireId});sockets[0].message({t:'stream',id:wireId,mime});sockets[0].message(new Uint8Array([1,2,3,4]).buffer);};
  const present=()=>{for(const[id,fn]of[...frames]){frames.delete(id);fn(0,{presentedFrames:1,mediaTime:.04});}};
  const end=async()=>{present();sockets[0].message({t:'done',id:wireId,frames:12});await new Promise(r=>setTimeout(r,5));
    media[0].ended=true;media[0].dispatchEvent(new Event('ended'));};
  return{start,input,feed,end,renderer,gate,queue,pending,mount,original,sockets,media,fetches,frames,
    availabilityState,rendered:()=>rendered,counts:()=>({acquired,released,reads})};
}
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,1));}assert.fail('fixture lifecycle timeout');}
const quietComponents={busy:false,hasRound:false,chatBusy:false,speaking:false,muted:false,hidden:false,
  queuePending:0,posePending:0,actionNone:true,speechNone:true,standardIdle:true,idlePresented:true};
test('exact safe availability identifies every quiet blocker and rejects nonnumeric counts or extra data',()=>{
  const snapshot=nativeP6GameAvailability(quietComponents);assert.equal(snapshot.quiet,true);assert.equal(Object.isFrozen(snapshot),true);
  for(const [key,value]of Object.entries(quietComponents)){
    const blocked={...quietComponents,[key]:typeof value==='number'?1:!value};
    assert.equal(nativeP6GameAvailability(blocked).quiet,false,key);
  }
  for(const invalid of [{...quietComponents,queuePending:'0'},{...quietComponents,posePending:-1},
    {...quietComponents,posePending:NaN},{...quietComponents,busy:0},{...quietComponents,exactText:'private'},
    {...quietComponents,actionNone:undefined}])assert.throws(()=>nativeP6GameAvailability(invalid),/availability_invalid/);
});
test('availability is fresh and read-only and inactive/closed API cannot report quiet',async t=>{
  const f=fixture(t),api=await f.start();assert.equal(api.availability().quiet,true);
  assert.equal(Object.isFrozen(api.availability()),true);assert.equal(f.fetches.length,1);
  f.availabilityState.chatBusy=true;assert.equal(api.availability().chatBusy,true);assert.equal(api.availability().quiet,false);
  await assert.rejects(api.run(f.input()),/native_p6_game_not_quiet/);
  assert.equal(f.fetches.length,1);assert.equal(f.sockets.length,0);assert.equal(f.counts().acquired,0);
  f.availabilityState.chatBusy=false;const input=f.input(),pending=api.run(input);void pending.catch(()=>{});
  assert.equal(api.availability().currentRun,true);assert.equal(api.availability().quiet,false);
  api.close();assert.equal(api.availability().closed,true);assert.equal(api.availability().quiet,false);
  await assert.rejects(pending);assert.equal(api.availability().currentRun,false);
});
test('actual blocked app and pose components reject run before authority/source or paid stream IO',async t=>{
  const blockers=[...['busy','hasRound','chatBusy','speaking','muted'].map(key=>[key,f=>{f.availabilityState[key]=true;}]),
    ['hidden',()=>{document.hidden=true;}],['actionNone',f=>{f.gate.updateRendererState({actionOwner:'dealing'});}],
    ['speechNone',f=>{f.gate.updateRendererState({speechOwner:'other'});}],
    ['standardIdle',f=>{f.gate.updateRendererState({dealerPose:'action'});}],
    ['idlePresented',f=>{f.gate.updateRendererState({idlePresented:null});}]];
  for(const [key,block]of blockers)await t.test(key,async t=>{
    const f=fixture(t),api=await f.start();block(f);assert.equal(api.availability().quiet,false);
    await assert.rejects(api.run(f.input()),/native_p6_game_not_quiet/);
    assert.equal(f.fetches.length,1);assert.equal(f.counts().acquired,0);assert.equal(f.sockets.length,0);
  });
});
test('default-off and other dealer/host launches do no QA IO or queue work',async()=>{
  for(const url of [NATIVE_P6_GAME_ORIGIN+'/?dealer=astrid&presentation=local',href.replace('astrid','vera'),href.replace('astrid','amira'),
    href.replace('astrid','mei'),href.replace(NATIVE_P6_GAME_ORIGIN,'https://other.example')]){
    assert.equal(await installNativeP6GamePlayback({href:url,fetchImpl:()=>assert.fail('default-off must not fetch'),
      readAvailability:()=>assert.fail('default-off must not read availability')}),null);
  }
});
test('cookie authorization and fresh renderer round required before exposing any API',async t=>{
  const f=fixture(t,{deny:true});await assert.rejects(f.start(),/cookie_context_unavailable/);
  assert.equal(f.queue.pending,0);assert.equal(f.counts().acquired,0);assert.equal(f.sockets.length,0);
});
test('actual gate/queue/player delivers one existing descriptor, keeps existing scene, preserves separate identities',async t=>{
  const f=fixture(t),api=await f.start(),input=f.input(),pending=api.run(input);
  await until(()=>f.sockets.length===1);assert.equal(f.queue.pending,1);f.feed();await until(()=>f.media[0].paused===false);
  await f.end();const result=await pending;
  assert.equal(result.binaryBytes,4);assert.equal(result.mediaSha256,hash(new Uint8Array([1,2,3,4])));
  assert.equal(f.sockets.length,1);assert.equal(f.media.length,1);assert.equal(f.mount.children.length,1);assert.equal(f.mount.children[0],f.original);
  assert.equal(f.media[0].style.opacity,'0');assert.ok(f.rendered()>0,'the receipt follows a composited decoded frame');
  assert.equal(f.pending.size,0);assert.equal(f.queue.pending,0);assert.deepEqual(f.counts(),{acquired:1,released:1,reads:6});
  assert.equal(result.playback.gameQueueExecuted,true);assert.equal(result.playback.gameWrapperIntegrated,false);
  assert.equal(result.playback.liveIntegrationVerified,false);assert.equal(result.playback.playerScope,'decoded-product-game-queue');
  assert.equal(result.playback.rendererIdentity.sessionRevision,f.renderer.sessionRevision);
  assert.notEqual(result.playback.rendererIdentity.sessionRevision,result.playback.sessionObserver.expected.sessionRevision);
  assert.equal(result.playback.queueReceipt.status,'completed');
  assert.deepEqual(result.playback.sessionObserver.observations.map(v=>v.phase),['before-connect','before-play','after-end']);
  assert.equal(result.playback.sourceVerification,'same-origin-source-readback-loaded-module-unverified');
  await assert.rejects(api.run(input),/attempt_consumed/);assert.equal(f.sockets.length,1);
});

test('decoded speech without a visible owned compositor canvas cannot yield a playback receipt',async t=>{
  for(const mode of ['missing','hidden','transparent','occluded'])await t.test(mode,async t=>{
    const f=fixture(t),api=await f.start(),pending=api.run(f.input());void pending.catch(()=>{});
    await until(()=>f.sockets.length===1);f.feed();await until(()=>f.media[0].paused===false);
    if(mode==='missing')f.original.remove();
    if(mode==='hidden')f.original.style.visibility='hidden';
    if(mode==='transparent')f.original.style.opacity='0';
    if(mode==='occluded')document.elementFromPoint=()=>({});
    await f.end();await assert.rejects(pending,/actual_playback_required/);
    assert.equal(f.media[0].style.opacity,'0');assert.equal(f.pending.size,0);assert.equal(f.sockets.length,1);
    assert.equal(f.frames.size,0);
  });
});

test('failed compositing cancels the queue and stream without granting a decoded receipt',async t=>{
  const f=fixture(t,{renderFrameFails:true}),api=await f.start(),pending=api.run(f.input());void pending.catch(()=>{});
  await until(()=>f.sockets.length===1);f.feed();await until(()=>f.media[0].paused===false);await f.end();
  await assert.rejects(pending,/actual_queue_completion_required/);
  assert.equal(f.rendered(),0);assert.equal(f.media[0].paused,true);assert.equal(f.sockets[0].readyState,3);
  assert.equal(f.pending.size,0);assert.equal(f.frames.size,0);
});
for(const ownerKey of ['actorSha256','ownerSessionSha256','sessionRevision','roundRevision','policySha256'])
test(ownerKey+' mismatch before enqueue mutates no queue',async t=>{
  const f=fixture(t,{ownerChangeAt:2,ownerKey}),api=await f.start();await assert.rejects(api.run(f.input()),/owned_state_changed/);
  assert.equal(f.counts().acquired,0);assert.equal(f.gate.trace.length,0);assert.equal(f.sockets.length,0);
});
test('changed source and changed renderer round are denied before queue mutation',async t=>{
  const f=fixture(t,{changedSource:true}),api=await f.start();await assert.rejects(api.run(f.input()),/source_changed/);
  f.renderer.roundRevision='1';await assert.rejects(api.run(f.input()),/stale_renderer/);assert.equal(f.counts().acquired,0);
});
test('stale cookie context does not expose API',async t=>{
  const f=fixture(t,{stale:true});await assert.rejects(f.start(),/owned_state_changed/);assert.equal(f.counts().acquired,0);
});
test('actual gate with no presented idle proof denies admission before any queue or socket',async t=>{
  const f=fixture(t),api=await f.start(),controller=new AbortController();f.gate.updateRendererState({idlePresented:null});
  await assert.rejects(api.run({...f.input(),signal:controller.signal}),/native_p6_game_not_quiet/);
  assert.equal(api.availability().idlePresented,false);assert.equal(api.availability().quiet,false);
  assert.equal(f.queue.pending,0);assert.equal(f.sockets.length,0);
  assert.equal(f.gate.trace.some(v=>v.stage==='standard-idle-presented'),false);assert.equal(controller.signal.aborted,false);
  assert.equal(f.pending.size,0);assert.equal(f.gate.pendingCount,0);assert.equal(f.sockets.length,0);
});
test('parallel requests and close cannot open a second stream',async t=>{
  const f=fixture(t),api=await f.start(),pending=api.run(f.input());void pending.catch(()=>{});
  await assert.rejects(api.run(f.input()),/exact_request_required/);await until(()=>f.sockets.length===1);
  api.close();await assert.rejects(pending);await f.queue.idle;
  assert.equal(f.sockets.length,1);assert.equal(f.sockets[0].readyState,3);
  await assert.rejects(api.run(f.input()),/exact_request_required/);
});
test('descriptor text/ticket mismatch contacts no stream and mutates no queue',async t=>{
  const f=fixture(t),api=await f.start(),input=f.input();input.descriptor.exactText='Different words.';
  await assert.rejects(api.run(input),/text_hash_mismatch/);assert.equal(f.counts().acquired,0);assert.equal(f.sockets.length,0);
});
test('lost actual pose after enqueue opens no stream and cannot yield completed queue',async t=>{
  const f=fixture(t,{poseChangeAt:4}),api=await f.start();await assert.rejects(api.run(f.input()),/queue_completion_required/);
  assert.equal(f.sockets.length,0);assert.equal(f.gate.trace.some(v=>v.stage==='speech-completed'),false);assert.equal(f.pending.size,0);
});
test('cookie policy change immediately before play closes admitted stream without playing',async t=>{
  const f=fixture(t,{ownerChangeAt:5}),api=await f.start(),pending=api.run(f.input());void pending.catch(()=>{});
  await until(()=>f.sockets.length===1);f.feed();await assert.rejects(pending,/queue_completion_required/);
  assert.equal(f.media[0].paused,true);assert.equal(f.sockets[0].readyState,3);assert.equal(f.pending.size,0);
});
test('late owner change after ended denies receipt despite completed gate',async t=>{
  const f=fixture(t,{ownerChangeAt:6}),api=await f.start(),pending=api.run(f.input());void pending.catch(()=>{});
  await until(()=>f.sockets.length===1);f.feed();await until(()=>f.media[0].paused===false);await f.end();
  await assert.rejects(pending,/owned_state_changed/);assert.equal(f.gate.trace.some(v=>v.stage==='speech-completed'),true);
});
test('cancel during decode closes actual queue/player and consumes attempt without reconnect',async t=>{
  const f=fixture(t),api=await f.start(),signal=new AbortController(),input={...f.input(),signal:signal.signal},pending=api.run(input);void pending.catch(()=>{});
  await until(()=>f.sockets.length===1);f.feed();await until(()=>f.media[0].paused===false);signal.abort();
  await assert.rejects(pending);assert.equal(f.sockets[0].readyState,3);assert.equal(f.pending.size,0);assert.equal(f.frames.size,0);
  await f.queue.idle;
  await assert.rejects(api.run({...input,signal:new AbortController().signal}),/attempt_consumed/);assert.equal(f.sockets.length,1);
});

test('bounded server/browser clock skew preserves the actual queue lifecycle in either direction',async t=>{
  for(const serverSkewMs of [-5000,-108,108,5000])await t.test(String(serverSkewMs),async t=>{
    let clientNow=Date.now();const f=fixture(t,{serverSkewMs,now:()=>clientNow}),api=await f.start(),input=f.input(),pending=api.run(input);
    void pending.catch(()=>{});await until(()=>f.sockets.length===1);f.feed();await until(()=>f.media[0].paused===false);
    clientNow+=10;await f.end();const result=await pending;
    assert.equal(result.playback.queueReceipt.status,'completed');assert.equal(result.transportCompleted,true);
    assert.equal(f.sockets.length,1);assert.equal(f.pending.size,0);
    assert.deepEqual(result.playback.sessionObserver.observations.map(v=>v.phase),['before-connect','before-play','after-end']);
    for(const observation of result.playback.sessionObserver.observations)assert.equal(observation.observedAtMs-observation.receivedAtMs,serverSkewMs);
    if(serverSkewMs<0)assert.ok(result.playback.sessionObserver.observations[0].observedAtMs<result.playback.startedAtMs,
      'server authority is compared in its own time domain');
  });
});

test('context beyond either five-second boundary exposes no capability or stream',async t=>{
  for(const serverSkewMs of [-5001,5001])await t.test(String(serverSkewMs),async t=>{
    const fixedNow=Date.now(),f=fixture(t,{serverSkewMs,now:()=>fixedNow});
    await assert.rejects(f.start(),/owned_state_changed/);
    assert.equal(f.counts().acquired,0);assert.equal(f.queue.pending,0);assert.equal(f.sockets.length,0);
  });
});

test('regressed server authority is rejected before enqueue or transport despite bounded browser skew',async t=>{
  for(const serverRollbackAt of [3,4])await t.test(String(serverRollbackAt),async t=>{
    const fixedNow=Date.now(),f=fixture(t,{serverSkewMs:-108,serverRollbackAt,now:()=>fixedNow}),api=await f.start();
    await assert.rejects(api.run(f.input()),/owned_state_changed|queue_completion_required/);
    assert.equal(f.counts().acquired,serverRollbackAt===3?0:1);assert.equal(f.sockets.length,0);
    assert.equal(f.pending.size,0);assert.equal(f.queue.pending,0);
  });
});

test('context diagnostic timestamp is never accepted as a sixth expected owner key',async t=>{
  const f=fixture(t),api=await f.start(),input=f.input();input.expectedOwnedState.observedAtMs=Date.now();
  await assert.rejects(api.run(input),/exact_request_required/);
  assert.equal(f.counts().reads,1);assert.equal(f.counts().acquired,0);assert.equal(f.sockets.length,0);
});
