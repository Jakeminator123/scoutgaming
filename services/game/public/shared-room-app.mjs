import { gameLaneFromDocument } from '../../../packages/presentation/contracts/game-selection.mjs';
import { createPresentationStartup } from './presentation-startup.mjs';
import { combineAbortSignals } from './abort-signals.mjs';
import { createSharedRoomClient, ROOM_CONFIG_MISSING } from './shared-room-client.mjs';
import { createSharedRoomCommandClient } from './shared-room-command-client.mjs';
import { createSharedRoomController, ROOM_NOT_READY } from './shared-room-controller.mjs';
import { createSharedRoomView } from './shared-room-view.mjs';
import { mountSharedRoomPresentation } from './shared-room-presentation.mjs';
import { createSharedRoomWaiting } from './shared-room-waiting.mjs';
import { canonicalGameDestination } from '../../../packages/navigation/game-entry.mjs';

// The player's sign-in for this table (as auth-modal.mjs): /player-login with the table's own game query,
// so blackjack-entry.mjs returns the player here after signing in. Never a launch token.
function signInPath(location){
  try{return canonicalGameDestination(new URL(location.href),{includeLaunch:false}).replace(/^\/game(?=\?|$)/,'/player-login');}
  catch{return '/player-login';}
}

const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const invalidBinding=()=>{throw new TypeError('shared_room_presentation_binding_invalid');};
const abortError=()=>new DOMException('Shared room presentation replaced','AbortError');
const unavailable=transient=>Object.assign(new Error('shared_room_presentation_binding_unavailable'),transient?{transient:true}:{});
const pause=(ms,signal)=>new Promise((resolve,reject)=>{
  if(signal.aborted){reject(signal.reason);return;}
  const abort=()=>{clearTimeout(timer);reject(signal.reason);};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
  signal.addEventListener('abort',abort,{once:true});
});
const selectionAttributes={lane:'gameLane',dealer:'gameDealer',presentation:'gamePresentation',localDealer:'gameLocalDealer',
  registeredDealers:'gameRegisteredDealers',operator:'gameOperator',roomId:'gameRoomId',packageRevision:'gamePackageRevision',
  branding:'gameBranding',composition:'gameComposition',choices:'gameChoices'};
const jsonAttributes=new Set(['registeredDealers','branding','composition','choices']);
function checkedBinding(value,snapshot,roomId){
  if(!object(value)||Object.keys(value).sort().join(',')!=='configVersion,owner,presentationContext,roomId,selection,windowId'
    ||value.owner!=='web'||value.roomId!==roomId||value.configVersion!==snapshot.configVersion||value.windowId!==snapshot.windowId)invalidBinding();
  const context=value.presentationContext,raw=value.selection;
  if(!object(context)||Object.keys(context).sort().join(',')!=='dealerId,operatorSlug,packageRevision,roomId'
    ||!object(raw)||Object.keys(raw).some(key=>!Object.hasOwn(selectionAttributes,key))
    ||!Number.isSafeInteger(raw.packageRevision)||raw.packageRevision<1)invalidBinding();
  const dataset={};
  for(const [key,item]of Object.entries(raw)){
    if(!jsonAttributes.has(key)&&key!=='packageRevision'&&typeof item!=='string')invalidBinding();
    dataset[selectionAttributes[key]]=jsonAttributes.has(key)?JSON.stringify(item):String(item);
  }
  // Reuse the document contract, without trusting the initial document's dealer
  // or package. The active room can still belong to an older published package.
  const selection=gameLaneFromDocument(dataset);
  if(selection.presentation!=='local'||selection.roomId!==roomId||context.roomId!==roomId
    ||context.operatorSlug!==selection.operator||context.packageRevision!==selection.packageRevision||context.dealerId!==selection.dealer)invalidBinding();
  return {owner:'web',roomId,configVersion:value.configVersion,windowId:value.windowId,presentationContext:{...context},selection};
}
// Conflicts that a fresh socket can resolve (shared-room-client.mjs rereads the room within its outage budget).
const recoverable=new Set(['shared_room_presentation_stale','shared_room_presentation_binding_unavailable']);
const canonical=value=>JSON.stringify(value,(_key,item)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
// A snapshot is the only input to this lazy owner. Controls become usable once
// the presentation adapter is mounted and the server confirms the same binding
// again after loading it. The dealer's film is not part of that gate: on a slow
// connection the idle clip alone took longer than the 30 s render callback and
// startup limits (K04, 400 kbit/s), so it loads afterwards and the dealer
// appears with its first verified frame. Every film keeps its exact hash,
// package and identity checks; a media error never grants or revokes controls.
function boundPresentation({document,window,roomId,signal,fetchImpl,createPresentation,transport,startupFor,onError,retryDelaysMs}){
  let current=null,job=null,generation=0,closed=false;
  const pending=new Set();
  function dispose(owned){
    if(!owned||owned.closed)return;
    owned.closed=true;owned.lifetime.abort();owned.port?.close();owned.startup.close();pending.delete(owned);
  }
  async function readOnce(snapshot,requestSignal){
    const request=new AbortController();
    const combined=combineAbortSignals([signal,requestSignal,request.signal,AbortSignal.timeout(10000)]);
    try{
      combined.throwIfAborted();
      const query=new URLSearchParams({configVersion:snapshot.configVersion,windowId:snapshot.windowId});
      let response;
      try{
        response=await fetchImpl(`/api/presentation/shared-room/${roomId}/binding?${query}`,{
          method:'GET',credentials:'same-origin',mode:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json'},signal:combined});
      }catch(error){
        // A refused or dropped request, or this attempt's own 10 s limit. A closed connection or page is no retry.
        if(!signal.aborted&&!requestSignal.aborted&&['TypeError','TimeoutError'].includes(error?.name))throw unavailable(true);
        throw error;
      }
      combined.throwIfAborted();
      if(response.status===409){
        const failure=await response.json().catch(()=>null);combined.throwIfAborted();
        if(failure?.error==='shared_room_presentation_stale')throw Object.assign(new Error('shared_room_presentation_stale'),{code:'shared_room_presentation_stale'});
      }
      if(response.status!==200)throw unavailable([502,503,504].includes(response.status));
      const value=await response.json();combined.throwIfAborted();return checkedBinding(value,snapshot,roomId);
    }finally{request.abort();}
  }
  // K04 (external review 28 Oct 2026, fynd 3): a network error, an attempt's 10 s limit or a 502/503/504 failed the
  // table at once. Such a read is made again, at most retryDelaysMs.length more times with a growing wait. 401/403,
  // any other status or 409, and an invalid or foreign binding stop as before; the stale window stays the recognized
  // conflict. When the attempts are spent the socket rereads the room within its own reconnect budget. Nothing opens
  // before the server has confirmed the binding.
  async function read(snapshot,requestSignal){
    if(!id(snapshot.configVersion)||!id(snapshot.windowId))invalidBinding();
    for(let attempt=0;;attempt++){
      try{return await readOnce(snapshot,requestSignal);}
      catch(error){
        if(!error?.transient)throw error;
        if(attempt>=retryDelaysMs.length)throw Object.assign(error,{code:'shared_room_presentation_binding_unavailable'});
        await pause(retryDelaysMs[attempt],requestSignal);
      }
    }
  }
  return Object.freeze({
    async restoreSnapshot(snapshot,{signal:connection,receivedAt=Date.now()}={}){
      signal.throwIfAborted();connection?.throwIfAborted();if(closed)throw abortError();
      const epoch=++generation;
      job?.abort();const work=new AbortController();job=work;
      const active=combineAbortSignals([signal,connection,work.signal]);
      const check=()=>{active.throwIfAborted();if(closed||epoch!==generation)throw abortError();};
      let candidate,abortMount;
      try{
        // K04 F5b: a binding the server already confirmed for this exact window and configuration is reused.
        // Reading it again before every plan held each snapshot for one more request (1-2.5 s in staging).
        // A new window, another configuration or an unconfirmed binding is still read before media or controls.
        if(current?.authorized&&!current.closed&&current.configVersion===snapshot.configVersion&&current.windowId===snapshot.windowId){
          await current.port.restoreSnapshot(snapshot,{signal:connection,receivedAt});check();return;
        }
        const binding=await read(snapshot,active);check();
        const key=canonical({presentationContext:binding.presentationContext,selection:binding.selection});
        if(current?.key===key){
          await current.port.restoreSnapshot(snapshot,{signal:connection,receivedAt});check();
          current.configVersion=binding.configVersion;current.windowId=binding.windowId;return;
        }
        dispose(current);current=null;
        candidate={key,lifetime:new AbortController(),port:null,closed:false,authorized:false,mismatch:null,startup:startupFor(binding.selection.dealer)};
        pending.add(candidate);
        const owned=candidate,mountSignal=combineAbortSignals([signal,owned.lifetime.signal]);
        const mismatch=()=>{if(owned.mismatch)throw owned.mismatch;};
        abortMount=()=>dispose(owned);active.addEventListener('abort',abortMount,{once:true});
        const port=await createPresentation({document,window,selection:structuredClone(binding.selection),signal:mountSignal,transport,
          // A frame of any other dealer is refused: before the binding is
          // confirmed it fails this restore, afterwards it closes the media.
          onReady:dealer=>{if(owned.closed||mountSignal.aborted||dealer===binding.selection.dealer)return;
            owned.mismatch??=new Error('shared_room_presentation_dealer_mismatch');
            if(owned.authorized){dispose(owned);onError();}},
          onError:()=>{if(!owned.closed)onError();}});
        if(owned.closed){port.close();check();throw abortError();}
        owned.port=port;check();mismatch();
        await port.restoreSnapshot(snapshot,{signal:connection,receivedAt});check();mismatch();
        const confirmed=await read(snapshot,active);check();mismatch();
        if(canonical(confirmed)!==canonical(binding))throw new Error('shared_room_presentation_binding_changed');
        current=owned;pending.delete(owned);owned.authorized=true;owned.configVersion=binding.configVersion;owned.windowId=binding.windowId;
        active.removeEventListener('abort',abortMount);abortMount=null;
        owned.startup.ready(binding.selection.dealer);
      }catch(error){
        if(candidate){if(!active.aborted&&!recoverable.has(error?.code))candidate.startup.fail();dispose(candidate);}
        throw error;
      }finally{
        if(abortMount)active.removeEventListener('abort',abortMount);
        work.abort();if(job===work)job=null;
      }
    },
    present(value,options){if(closed||!current?.authorized)throw new Error('shared_room_media_authority_unavailable');return current.port.present(value,options);},
    // A chat answer's speech descriptor plays only through the confirmed binding's dealer (shared-room-presentation.mjs speak).
    async speak(value,options){if(closed||!current?.authorized||!current.port.speak)throw new Error('shared_room_media_authority_unavailable');return current.port.speak(value,options);},
    enableSound(){if(!closed&&current?.authorized)current.port.enableSound?.();},
    layout(value){current?.port.layout?.(value);},
    close(){if(closed)return;closed=true;++generation;job?.abort();for(const owned of pending)dispose(owned);dispose(current);current=null;},
  });
}

export async function mountSharedRoomApp({document=globalThis.document,window=globalThis.window,
  createSocket=createSharedRoomClient,createCommands=createSharedRoomCommandClient,
  createView=createSharedRoomView,createPresentation=mountSharedRoomPresentation,presentationTransport=null,
  fetchImpl=(...args)=>window.fetch(...args),bindingRetryDelaysMs=[250,1000]}={}) {
  if(!Array.isArray(bindingRetryDelaysMs)||bindingRetryDelaysMs.length>4||!bindingRetryDelaysMs.every(ms=>Number.isSafeInteger(ms)&&ms>=0&&ms<=5000))
    throw new TypeError('shared_room_invalid_options');
  const dataset=document?.documentElement?.dataset,roomId=dataset?.gameRoomId;
  if(dataset?.sharedRoom!=='1'||!roomId||!/^[a-z0-9_-]{1,128}$/.test(roomId))throw new Error('shared_room_entry_required');
  const loading=document.getElementById('presentation-loading'),loadingText=loading?.textContent??'Visar spelbordet…';
  let startup=createPresentationStartup({document,dealerId:null});
  const lifetime=new AbortController();
  let presentation,view,controller,socket,commands,seats,closed=false;
  // A room without published game settings says so on the loading screen too, not the generic reload text.
  const fail=code=>{startup.fail(code===ROOM_CONFIG_MISSING?ROOM_NOT_READY:undefined);controller?.fail(code);};
  const close=()=>{if(closed)return;closed=true;lifetime.abort();window.removeEventListener('pagehide',close);socket?.stop();seats?.stop();controller?.stop();
    if(!controller){commands?.stop();view?.close();presentation?.close();}startup.close();};
  window.addEventListener('pagehide',close,{once:true});
  try {
    commands=createCommands({roomId});
    presentation=boundPresentation({document,window,roomId,signal:lifetime.signal,fetchImpl,createPresentation,transport:presentationTransport,retryDelaysMs:bindingRetryDelaysMs,
      startupFor:dealerId=>{startup.close();if(loading){loading.hidden=false;loading.textContent=loadingText;}
        startup=createPresentationStartup({document,dealerId});return startup;},onError:()=>{
        const caption=document.getElementById('caption');if(caption)caption.textContent='Presentationen är inte tillgänglig. Bordets spelstatus är oförändrad.';
      }});
    view=createView({document,onLayout:layout=>presentation.layout?.(layout),signInHref:signInPath(window.location)});
    controller=createSharedRoomController({roomId,commands,view,presentation,reconnect:()=>socket?.reconnect?.()});
    // K6: at a full table without a seat the viewer's wait is renewed after each restored snapshot (shared-room-waiting.mjs).
    seats=createSharedRoomWaiting({roomId,createCommands,state:()=>controller.state});
    const restoreSnapshot=async(raw,options)=>{await controller.restoreSnapshot(raw,options);seats.update();};
    // A spent reconnect budget leaves the socket offline: the table keeps its last state and offers Återanslut.
    socket=createSocket({roomId,browserOrigin:window.location.origin,restoreSnapshot,
      present:controller.present,onError:error=>socket?.status?.().state==='offline'?controller.offline():fail(error?.code),callbackTimeoutMs:30000});
    socket.start();
    // The room's chat panel plays an answer with presentation.speak(result.decision.speechStream).
    return Object.freeze({close,controller,presentation:Object.freeze({speak:presentation.speak,enableSound:presentation.enableSound})});
  }catch(error){fail();close();throw error;}
}
if(globalThis.document?.documentElement?.dataset.sharedRoom==='1') {
  void mountSharedRoomApp().catch(()=>{
    const status=document.getElementById('presentation-loading');
    if(status){status.hidden=false;status.textContent='Spelbordet kunde inte starta. Ladda om sidan för att försöka igen.';status.setAttribute('role','alert');}
  });
}
