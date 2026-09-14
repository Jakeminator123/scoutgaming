import {packedGPU} from './packed-gpu.mjs';
import {createPassLifecycle,assertMediaEndpoint} from './lifecycle.mjs';
import {bridgeTransform} from './return-registration.mjs';

// Caller retains its source-engine lease. The final actor remains visible while
// onComplete releases that lease and prepares the actual, unchanged idle take.
export async function playReturnBridge({host,fit,signal,onReady=()=>{},onComplete=async()=>{}}){
 const life=createPassLifecycle({signal,preparationMs:6000});let callback,video,layer,gpu;
 const receipt={kind:'existing-silent-return-bridge',frames:[],completed:false};
 try{
  if(!host||![fit?.x,fit?.y,fit?.scale].every(Number.isFinite)||fit.scale<=0)throw Error('Invalid bridge placement');
  const registration=await life.prepare(async signal=>{const r=await fetch('/astrid-continuous/return-bridge-registration.json',{signal});if(!r.ok)throw Error('Missing bridge registration');return r.json();});
  bridgeTransform(registration,0);bridgeTransform(registration,96);
  if(!life.active)throw Error('Bridge cancelled before resources');
  video=life.ownVideo(document.createElement('video'));video.muted=true;video.playsInline=true;video.preload='auto';video.src='/astrid-continuous/return-bridge.mp4';
  layer=document.createElement('div');layer.className='performance-layer astrid-continuous-actor astrid-return-bridge';
  Object.assign(layer.style,{position:'absolute',left:fit.x+'px',top:fit.y+'px',width:1920*fit.scale+'px',height:1080*fit.scale+'px',zIndex:25,pointerEvents:'none'});
  const canvas=document.createElement('canvas');Object.assign(canvas.style,{width:'100%',height:'100%'});layer.append(canvas);life.onCleanup(()=>layer.remove());
  await life.prepare(()=>new Promise((resolve,reject)=>{video.onloadeddata=life.guard(resolve);video.onerror=life.guard(()=>reject(Error('Bridge unavailable')));video.load();}));
  if(video.videoWidth!==1920||video.videoHeight!==2160)throw Error('Bridge packed dimensions mismatch');
  if(!life.active)throw Error('Bridge cancelled before renderer');
  gpu=packedGPU(canvas,video,{outputWidth:1280});life.onCleanup(()=>gpu.dispose?.());if(gpu.ready)await life.prepare(()=>gpu.ready);
  life.onCleanup(()=>{if(callback!=null)video.cancelVideoFrameCallback(callback);});
  const paint=n=>{if(!life.active)return;gpu.paint(null,{cards:[],handMaskEnabled:false,transform:bridgeTransform(registration,n)});layer.dataset.frame=String(n);receipt.frames.push(n);};
  host.append(layer);paint(0);await life.playback(()=>onReady(),6000);
  await life.playback(()=>new Promise((resolve,reject)=>{
   video.onended=life.guard(()=>{assertMediaEndpoint(video.currentTime,24,96);resolve();});video.onerror=life.guard(()=>reject(Error('Bridge playback failed')));
   const tick=life.guard((_,m)=>{const n=Math.min(96,Math.round(m.mediaTime*24));paint(n);if(n>=96){resolve();return;}callback=video.requestVideoFrameCallback(tick);});
   callback=video.requestVideoFrameCallback(tick);video.play().catch(reject);
  }),8000);
  video.pause();if(callback!=null){video.cancelVideoFrameCallback(callback);callback=null;}video.onended=null;video.onerror=null;
  paint(96);await life.playback(()=>onComplete(),6000);receipt.completed=true;return receipt;
 }catch(error){receipt.error=error.message;throw error;}
 finally{life.dispose();if(host){host.dataset.astridReturnBridge=JSON.stringify(receipt);}}
}
