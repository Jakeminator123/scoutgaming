import { validateGeneratedSpeechStream } from './generated-speech-player.mjs';

// Explicit ownQA capability; importing this module performs no IO. Source
// readback cannot attest an already imported module or live visual acceptance.
export const NATIVE_P6_GAME_ORIGIN='https://croupier-native-qa-abc92154cb15.vercel.app';
export const NATIVE_P6_GAME_CONTEXT_PATH='/api/presentation/native-p6-playback-context';
export const NATIVE_P6_GAME_SOURCE_PATHS=Object.freeze(['web/public/app.mjs','web/public/native-p6-game-playback.mjs',
  'web/public/speech-queue.mjs','web/public/speech-pose-gate.mjs','web/public/local-presentation.mjs',
  'web/public/generated-speech-player.mjs','web/public/speech-stream-client.mjs','web/public/speech-package.mjs',
  'web/public/astrid-voice-profile.mjs']);
const ownerKeys=['actorSha256','ownerSessionSha256','sessionRevision','roundRevision','policySha256'];
const clockToleranceMs=5000;
const stages=['chat-received','response-ready','held-for-pose','action-completed','standard-idle-presented',
  'chat-displayed','speech-started','speech-completed'];
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const need=(v,code)=>{if(!v)throw Error(code);};
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
const ownerValid=v=>exact(v,ownerKeys)&&hash(v.actorSha256)&&hash(v.ownerSessionSha256)&&hash(v.policySha256)
  &&v.sessionRevision===v.ownerSessionSha256&&id(v.roundRevision);
// Safe ownQA diagnostics and admission share this exact predicate. No owner
// identifiers, text, DOM nodes or mutable product state leave the callback.
export function nativeP6GameAvailability(components){
  const booleans=['busy','hasRound','chatBusy','speaking','muted','hidden','actionNone','speechNone','standardIdle','idlePresented'];
  const counts=['queuePending','posePending'];
  need(exact(components,[...booleans,...counts])&&booleans.every(key=>typeof components[key]==='boolean')
    &&counts.every(key=>Number.isSafeInteger(components[key])&&components[key]>=0),'native_p6_game_availability_invalid');
  const quiet=!components.busy&&!components.hasRound&&!components.chatBusy&&!components.speaking&&!components.muted
    &&!components.hidden&&components.queuePending===0&&components.posePending===0&&components.actionNone
    &&components.speechNone&&components.standardIdle&&components.idlePresented;
  return Object.freeze({...components,quiet});
}
async function bytesOf(response,max){
  const reader=response.body?.getReader();need(reader,'native_p6_game_readback_unavailable');let size=0;const parts=[];
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
    if(size>max){await reader.cancel();throw Error('native_p6_game_readback_too_large');}parts.push(part.value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}return bytes;
}
async function ownedContext(fetchImpl,signal,now){
  const response=await fetchImpl(NATIVE_P6_GAME_CONTEXT_PATH,{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',signal});
  need(response.ok&&response.url===NATIVE_P6_GAME_ORIGIN+NATIVE_P6_GAME_CONTEXT_PATH
    &&/^application\/json(?:;|$)/i.test(response.headers.get('content-type')??''),'native_p6_game_cookie_context_unavailable');
  let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bytesOf(response,4096)));}
  catch{throw Error('native_p6_game_cookie_context_unavailable');}
  const receivedAtMs=now();need(exact(value,[...ownerKeys,'observedAtMs'])
    &&ownerValid(Object.fromEntries(ownerKeys.map(k=>[k,value[k]])))&&Number.isSafeInteger(value.observedAtMs)
    &&Number.isSafeInteger(receivedAtMs)&&Math.abs(receivedAtMs-value.observedAtMs)<=clockToleranceMs,'native_p6_game_owned_state_changed');
  return{...value,receivedAtMs};
}
function frameVisible(video,surface,mount){
  if(document.hidden||document.visibilityState!=='visible'||!video.isConnected||!surface.isConnected
    ||!mount.contains(surface)||video.paused||video.muted||video.volume<=0)return false;
  const r=video.getBoundingClientRect();if(r.width<=0||r.height<=0||r.right<=0||r.bottom<=0||r.left>=innerWidth||r.top>=innerHeight)return false;
  for(let node=video;node;node=node.parentElement){const style=getComputedStyle(node);
    if(style.display==='none'||style.visibility!=='visible'||Number(style.opacity)===0)return false;}
  const hit=document.elementFromPoint(Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),Math.max(0,Math.min(innerHeight-1,r.top+r.height/2)));
  // Product film is pointer-events:none. Its own scene may be the hit target.
  return hit===mount||hit===video||surface.contains(hit);
}

// This delivery is also used by the real app. It calls the supplied existing
// gate, whose onSpeech owns playChatDecision; it never constructs another queue.
export function createNativeP6GameQueueDelivery({identity,isAvailable,gate,pending,onAcquire=()=>{},onRelease=()=>{},
  pendingFields=()=>({})}={}){
  return async({decision,rendererIdentity,signal,beforeStart,streamObserver,onReceipt})=>{
    need(isAvailable()&&!signal.aborted,'native_p6_game_not_quiet');const value=identity();
    need(value.dealerId===rendererIdentity.dealerId&&value.sessionRevision===rendererIdentity.sessionRevision
      &&value.roundRevision===rendererIdentity.roundRevision,'native_p6_game_stale_renderer');
    const requestId=decision.requestId;need(!gate.get(requestId)&&!pending.has(requestId),'native_p6_game_attempt_consumed');
    const controller=new AbortController(),cancel=()=>{controller.abort();gate.cancel(requestId,'native-p6-cancelled');};
    signal.addEventListener('abort',cancel,{once:true});let acquired=false;
    try{
      onAcquire();acquired=true;
      pending.set(requestId,{...pendingFields(),controller,beforeStart,nativeP6Observer:streamObserver,nativeP6Receipt:onReceipt,
        synthetic:true,requestedAt:performance.now(),playbackReceipt:null});
      const received=gate.receive({jobId:requestId,...rendererIdentity,requestFingerprint:requestId});
      need(!received.duplicate&&received.record.status!=='cancelled','native_p6_game_attempt_consumed');
      gate.responseReady(requestId,decision);const queueReceipt=await received.completion;
      return{queueReceipt,playbackReceipt:pending.get(requestId)?.playbackReceipt};
    }catch(error){gate.cancel(requestId,'native-p6-failed');throw error;}
    finally{signal.removeEventListener('abort',cancel);pending.delete(requestId);if(acquired)onRelease();}
  };
}

/** App-owned callbacks close over the actual queue, pose gate and scene. No
 * player/owner/renderer revisions or URLs are accepted from another window. */
export async function installNativeP6GamePlayback({href,identity,isAvailable,readAvailability,deliver,mount,fetchImpl=fetch,now=Date.now}={}){
  let url;try{url=new URL(href);}catch{return null;}
  if(url.origin!==NATIVE_P6_GAME_ORIGIN||url.searchParams.get('nativeP6GamePlayback')!=='1'
    ||url.searchParams.get('dealer')!=='astrid'||url.searchParams.get('presentation')!=='local')return null;
  if(globalThis.location?.origin!==NATIVE_P6_GAME_ORIGIN)return null;
  need(typeof identity==='function'&&typeof isAvailable==='function'&&typeof readAvailability==='function'
    &&typeof deliver==='function'&&mount?.isConnected,
    'native_p6_game_actual_callbacks_required');
  const initial=await ownedContext(fetchImpl,undefined,now);
  const renderer=identity();need(renderer.dealerId==='astrid'&&uuid(renderer.sessionRevision)&&renderer.roundRevision===initial.roundRevision,
    'native_p6_game_initial_renderer_mismatch');
  let current=null,closed=false,campaign=null;const seen=new Set();
  const close=()=>{closed=true;current?.abort();};
  const availability=()=>{
    const snapshot=nativeP6GameAvailability(readAvailability());
    return Object.freeze({...snapshot,currentRun:current!==null,closed,quiet:snapshot.quiet&&!current&&!closed});
  };
  async function run(input){
    need(globalThis.location?.origin===NATIVE_P6_GAME_ORIGIN&&!closed&&!current&&exact(input,['runId','expectedSha','attempt','descriptor','expectedOwnedState','sourceHashes',
      'sessionObserverSourceSha256',...(Object.hasOwn(input??{},'signal')?['signal']:[])])&&uuid(input.runId)
      &&/^[a-f0-9]{40}$/.test(input.expectedSha)&&[1,2].includes(input.attempt)&&ownerValid(input.expectedOwnedState)
      &&hash(input.sessionObserverSourceSha256)&&exact(input.sourceHashes,NATIVE_P6_GAME_SOURCE_PATHS)
      &&Object.values(input.sourceHashes).every(hash)&&(input.signal===undefined||input.signal instanceof AbortSignal),
      'native_p6_game_exact_request_required');
    input.signal?.throwIfAborted();
    const expected=structuredClone(input.expectedOwnedState),pins=structuredClone(input.sourceHashes),runId=input.runId,
      expectedSha=input.expectedSha,attempt=input.attempt,observerSha=input.sessionObserverSourceSha256;
    const own=new AbortController();current=own;const abort=()=>own.abort();input.signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,45000),startedAtMs=now();let player,video,surface,frameHandle,ended=false,start,end,frame;
    const chunks=[],observations=[];let binaryBytes=0,runObservedAtMs;
    const rendererIdentity=Object.freeze(structuredClone(identity()));
    const checkRenderer=()=>{const value=identity();need(value.dealerId==='astrid'&&value.sessionRevision===rendererIdentity.sessionRevision
      &&value.roundRevision===rendererIdentity.roundRevision&&value.roundRevision===expected.roundRevision,'native_p6_game_stale_renderer');};
    const observe=async phase=>{own.signal.throwIfAborted();const state=await ownedContext(fetchImpl,own.signal,now);
      need(ownerKeys.every(k=>state[k]===expected[k])&&state.actorSha256===initial.actorSha256&&state.ownerSessionSha256===initial.ownerSessionSha256
        &&Number.isSafeInteger(runObservedAtMs)&&state.observedAtMs>=runObservedAtMs,'native_p6_game_owned_state_changed');checkRenderer();own.signal.throwIfAborted();
      observations.push({phase,...state});};
    try{
      checkRenderer();need(isAvailable(),'native_p6_game_not_quiet');
      const descriptor=await validateGeneratedSpeechStream(input.descriptor,{exactText:input.descriptor?.exactText,dealerId:'astrid',requestId:input.descriptor?.requestId});
      need(!seen.has(descriptor.requestId)&&seen.size<2&&attempt===seen.size+1
        &&(!campaign||(campaign.runId===runId&&campaign.expectedSha===expectedSha)),'native_p6_game_attempt_consumed');
      // Authenticate before any queue mutation; it is separate from the three
      // playback checkpoints, whose receipts are captured at their actual gates.
      const beforeQueue=await ownedContext(fetchImpl,own.signal,now);
      need(ownerKeys.every(k=>beforeQueue[k]===expected[k])&&beforeQueue.actorSha256===initial.actorSha256
        &&beforeQueue.ownerSessionSha256===initial.ownerSessionSha256,'native_p6_game_owned_state_changed');checkRenderer();
      // Compare subsequent authority reads with this fresh server timestamp.
      // Browser and server wall clocks may differ within the bounded tolerance.
      runObservedAtMs=beforeQueue.observedAtMs;
      for(const path of NATIVE_P6_GAME_SOURCE_PATHS){
        const response=await fetchImpl('/'+path.replace('web/public/',''),{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',signal:own.signal});
        need(response.ok&&response.url===NATIVE_P6_GAME_ORIGIN+'/'+path.replace('web/public/','')
          &&/^(?:text|application)\/(?:javascript|ecmascript)(?:;|$)/i.test(response.headers.get('content-type')??''),'native_p6_game_source_unavailable');
        need(await sha(await bytesOf(response,1048576))===pins[path],'native_p6_game_source_changed');
      }
      // Source reads may be slow. Revalidate ownership again before enqueue.
      const atQueue=await ownedContext(fetchImpl,own.signal,now);
      need(ownerKeys.every(k=>atQueue[k]===expected[k])&&atQueue.observedAtMs>=runObservedAtMs,'native_p6_game_owned_state_changed');checkRenderer();
      need(isAvailable()&&!own.signal.aborted&&descriptor.expiresAt>now(),'native_p6_game_not_quiet');
      seen.add(descriptor.requestId);campaign??={runId,expectedSha};
      const event=()=>({requestId:descriptor.requestId,streamId:descriptor.id,reviewStatus:'pending',atMs:now()});
      const presented=(_time,info)=>{frameHandle=null;if(own.signal.aborted)return;
        if(start&&Number.isSafeInteger(info?.presentedFrames)&&info.presentedFrames>0&&Number.isFinite(info.mediaTime)&&info.mediaTime>0
          &&Number.isSafeInteger(video.videoWidth)&&video.videoWidth>0&&Number.isSafeInteger(video.videoHeight)&&video.videoHeight>0
          &&frameVisible(video,surface,mount)){
          frame={...event(),state:'presented',evidence:'request-video-frame-callback',presentedFrames:info.presentedFrames,
            mediaTime:info.mediaTime,videoWidth:video.videoWidth,videoHeight:video.videoHeight,audible:true,visible:true};
        }else frameHandle=video.requestVideoFrameCallback(presented);};
      const streamObserver={onPlayer:value=>{need(!player&&value.video?.requestVideoFrameCallback,'native_p6_game_actual_player_required');
          ({player,video,surface}=value);video.addEventListener('ended',()=>{ended=true;},{once:true,signal:own.signal});},
        onBinary:value=>{need(value.player===player&&value.bytes instanceof ArrayBuffer,'native_p6_game_wrong_player');
          binaryBytes+=value.bytes.byteLength;need(binaryBytes<=32*1024*1024,'native_p6_game_media_too_large');chunks.push(new Uint8Array(value.bytes));},
        onFrame:value=>{need(value.player===player&&value.video===video&&value.surface===surface,'native_p6_game_wrong_player');presented(0,value.info);}};
      const onReceipt=value=>{if(value?.requestId!==descriptor.requestId||value?.streamId!==descriptor.id||value.reviewStatus!=='pending')return;
        if(value.state==='start'&&value.evidence==='media-playing')start={...event(),state:'start',evidence:value.evidence};
        if(value.state==='end'&&value.evidence==='media-lifecycle'&&value.started===true)end={...event(),state:'end',evidence:value.evidence,started:true};};
      const decision={kind:'generatedText',visualMode:'generated-lipsync-stream-preview',speechStream:descriptor,exactText:descriptor.exactText,
        requestId:descriptor.requestId,...rendererIdentity};
      const delivered=await deliver({decision,rendererIdentity,signal:own.signal,streamObserver,onReceipt,
        beforeStart:()=>observe(player?'before-play':'before-connect')});
      await observe('after-end');const queueReceipt=delivered?.queueReceipt;
      need(queueReceipt?.jobId===descriptor.requestId&&queueReceipt.status==='completed'&&queueReceipt.dealerId==='astrid'
        &&queueReceipt.sessionRevision===rendererIdentity.sessionRevision&&queueReceipt.roundRevision===rendererIdentity.roundRevision
        &&queueReceipt.promoted===true&&queueReceipt.displayed===true&&queueReceipt.speechStarted===true
        &&Array.isArray(queueReceipt.stages)&&stages.every(s=>queueReceipt.stages.some(v=>v.stage===s&&v.jobId===descriptor.requestId)),
        'native_p6_game_actual_queue_completion_required');
      need(player&&uuid(player.id)&&player.receivedDone?.id===player.id&&player.receivedDone.aborted!==true&&player.completed===true
        &&player.inputComplete===true&&player.totalBytes===binaryBytes&&binaryBytes>0&&ended&&start&&frame&&end
        &&end.atMs>start.atMs&&end.atMs>=frame.atMs&&!own.signal.aborted&&observations.length===3
        &&observations.map(v=>v.phase).join(',')==='before-connect,before-play,after-end','native_p6_game_actual_playback_required');
      const bytes=new Uint8Array(binaryBytes);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      const mediaSha256=await sha(bytes),completedAtMs=now();
      return{clientOrigin:NATIVE_P6_GAME_ORIGIN,clientPath:'/speech-stream',requestId:descriptor.requestId,descriptorId:descriptor.id,
        textSha256:descriptor.textSha256,binaryBytes,mediaSha256,transportSessionId:player.id,transportCompleted:true,completed:true,
        playback:{purpose:'native-p6-product-game-playback-v1',origin:NATIVE_P6_GAME_ORIGIN,expectedSha,runId,attempt,
          requestId:descriptor.requestId,descriptorId:descriptor.id,textSha256:descriptor.textSha256,
          playerScope:'decoded-product-game-queue',productWrapperExecuted:true,gameQueueExecuted:true,gameWrapperIntegrated:false,
          liveIntegrationVerified:false,sourceVerification:'same-origin-source-readback-loaded-module-unverified',
          sourceHashes:pins,rendererIdentity,queueReceipt:structuredClone(queueReceipt),
          sessionObserver:{purpose:'native-p6-cookie-owned-session-observer-v1',sourceSha256:observerSha,endpointIntegrationVerified:true,
            expected,observations},startedAtMs,completedAtMs,events:[start,frame,end]}};
    }finally{clearTimeout(timer);own.abort();input.signal?.removeEventListener('abort',abort);
      if(frameHandle!=null)video?.cancelVideoFrameCallback(frameHandle);chunks.length=0;current=null;}
  }
  return Object.freeze({run,close,availability});
}
