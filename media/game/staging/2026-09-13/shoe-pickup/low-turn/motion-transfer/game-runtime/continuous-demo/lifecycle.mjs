// Ownership starts before fetching; even an uncooperative fetch cannot hold a round.
export function createPassLifecycle({signal,windowTarget=globalThis.window,documentTarget=globalThis.document,preparationMs=6000}={}){
 const controller=new AbortController(),cleanups=[];let terminal=false,disposed=false,reason,rejectFailure;
 const deadline=Date.now()+preparationMs;
 const failure=new Promise((_,reject)=>{rejectFailure=reject;});failure.catch(()=>{});
 function cancel(message='Sequence interrupted'){if(terminal)return;terminal=true;reason=message instanceof Error?message:Error(message);controller.abort(reason);rejectFailure(reason);}
 const resized=()=>cancel('Sequence resized'),hidden=()=>{if(documentTarget?.hidden)cancel('Sequence hidden');},aborted=()=>cancel('Sequence cancelled');
 windowTarget?.addEventListener('resize',resized);documentTarget?.addEventListener('visibilitychange',hidden);signal?.addEventListener('abort',aborted,{once:true});
 hidden();if(signal?.aborted)aborted();
 async function bounded(work,ms){if(terminal)throw reason??Error('Sequence disposed');let timer;try{return await Promise.race([Promise.resolve().then(()=>{if(terminal)throw reason;return work(controller.signal);}),failure,new Promise((_,reject)=>{timer=setTimeout(()=>{cancel('Sequence timeout');reject(reason);},Math.max(0,ms));})]);}finally{clearTimeout(timer);}}
 function onCleanup(fn){if(disposed)fn();else cleanups.push(fn);return fn;}
 return {signal:controller.signal,get active(){return !terminal;},cancel,onCleanup,
  prepare(work){return bounded(work,deadline-Date.now());},playback(work,ms=10000){return bounded(work,ms);},
  guard(fn){return (...args)=>{if(terminal)return;try{return fn(...args);}catch(error){cancel(error);}};},
  ownVideo(video){onCleanup(()=>{video.onloadeddata=null;video.onerror=null;video.onended=null;video.pause();video.removeAttribute('src');video.load();});return video;},
  dispose(){if(disposed)return;disposed=true;cancel('Sequence disposed');windowTarget?.removeEventListener('resize',resized);documentTarget?.removeEventListener('visibilitychange',hidden);signal?.removeEventListener('abort',aborted);for(const fn of cleanups.reverse()){try{fn();}catch{ /* Continue releasing other owned resources. */ }}}
 };
}
export function safeDelivery(d){if(!Number.isInteger(d?.shoeDraw)||typeof d.faceDown!=='boolean')throw Error('Explicit server-issued card required');return {el:d.el,shoeDraw:d.shoeDraw,faceDown:d.faceDown,...(!d.faceDown?{card:{r:d.card?.r,s:d.card?.s}}:{})};}
export function onceLand(callback){const landed=new Set();return {has:i=>landed.has(i),land(i,...args){if(landed.has(i))return false;landed.add(i);callback(i,...args);return true;}};}

export function assertMediaEndpoint(currentTime,fps,lastFrame){if(!Number.isFinite(currentTime)||!Number.isFinite(fps)||fps<=0||!Number.isInteger(lastFrame)||lastFrame<0||currentTime*fps<lastFrame-.5)throw Error('Sequence ended before required source endpoint');}
