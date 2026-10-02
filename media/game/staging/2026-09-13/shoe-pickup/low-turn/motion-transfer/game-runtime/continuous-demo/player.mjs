import {playReturnBridge} from './return-bridge.mjs';
import {createPassLifecycle,safeDelivery,onceLand,assertMediaEndpoint} from './lifecycle.mjs';
import {createCardGlide} from './card-glide.mjs';
import {createPlaybackSession} from './session.mjs';
import {packedGPU} from './packed-gpu.mjs';
import {uniformRegistration} from '/performance-contact.mjs';
import {sourceFit,canonicalCorners} from '/astrid-single-seat/game-contract.mjs';
import {cardLandingCorners} from '/performance-player.mjs';

export function createContinuousSession({suspend,signal,prepareIdle}){
 const lifecycle=createPassLifecycle({signal});
 const session=createPlaybackSession(lifecycle,l=>prepareActor(l,suspend,prepareIdle));
 return {
  async play({deliveries,onLand,finalReturn=false}){
   if(deliveries.length!==4||deliveries.some(d=>!Number.isInteger(d?.shoeDraw)))throw Error('Four server-issued cards required');
   const issued=deliveries,receipt={mode:'continuous-rough-gameplay',landings:[],cards:[],endpointPolicy:'Source hand contact then distance-aware decelerating glide to actual game card; not exact physical destination approval'};
   try{
    const safe=deliveries.map(safeDelivery);receipt.cards=safe.map(({shoeDraw,faceDown})=>({shoeDraw,faceDown}));
    await session.play({deliveries:safe,onLand:(i)=>onLand(issued[i]),receipt,finalReturn});receipt.state='complete';
   }catch(error){receipt.state='fallback';receipt.error=error.message;session.dispose();throw error;}
   finally{
    deliveries.forEach(d=>{if(d?.el)d.el.style.visibility='';});
    const status=document.createElement('div');status.hidden=true;status.className='astrid-continuous-receipt';status.dataset.receipt=JSON.stringify(receipt);document.querySelector('#scene')?.append(status);
   }
  },async finish(){try{await session.play({returnToIdle:true});}finally{session.dispose();}},dispose(){session.dispose();}
 };
}

// Retained for callers that need only one four-card group.
export async function playContinuousPass(options){
 const session=createContinuousSession(options);
 try{await session.play(options);}finally{session.dispose();}
}

async function prepareActor(lifecycle,suspend,prepareIdle){
 const response=await fetch('/astrid-continuous/joined-ledger.json',{signal:lifecycle.signal});
 if(!response.ok)throw Error('Missing sequence');
 const source=await response.json();
 if(!lifecycle.active)throw Error('Sequence cancelled before video creation');
 const rows=source.ledger,fps=source.fps;
 const releases=[1,2,3,4].map(id=>rows.findIndex(row=>row.cards.some(c=>c.id===id&&c.released===true)&&(id!==4||row.outputFrame>=285)));
 if(releases.some(n=>n<0))throw Error('Missing source release');
 const fit=sourceFit(uniformRegistration({width:1280,height:720},{width:innerWidth,height:innerHeight}));
 const video=lifecycle.ownVideo(document.createElement('video'));
 video.src='/astrid-continuous/actor.mp4';video.muted=true;video.playsInline=true;video.preload='auto';
 const layer=document.createElement('div');layer.className='performance-layer astrid-continuous-actor';
 Object.assign(layer.style,{position:'absolute',left:fit.x+'px',top:fit.y+'px',width:1920*fit.scale+'px',height:1080*fit.scale+'px',zIndex:24,pointerEvents:'none'});
 const canvas=document.createElement('canvas');Object.assign(canvas.style,{width:'100%',height:'100%'});layer.append(canvas);
 const style=document.createElement('style');style.textContent='#scene[data-astrid-continuous] #dealer-wrap,#scene[data-astrid-continuous] #dealer-hands-wrap,#scene[data-astrid-continuous] .performance-layer:not(.astrid-continuous-actor){visibility:hidden!important}';
 const host=document.querySelector('#scene');
 lifecycle.onCleanup(()=>{layer.remove();style.remove();delete host.dataset.astridContinuous;});
 await new Promise((resolve,reject)=>{video.onloadeddata=lifecycle.guard(resolve);video.onerror=lifecycle.guard(()=>reject(Error('Sequence unavailable')));video.load();});
 if(!lifecycle.active)throw Error('Sequence cancelled before renderer');
 const gpu=packedGPU(canvas,video,{shoeMaskURL:'/astrid-continuous/shoe.png',outputWidth:1280});lifecycle.onCleanup(()=>gpu.dispose?.());
 if(gpu.ready)await gpu.ready;
 if(!lifecycle.active)throw Error('Sequence cancelled before ownership');
 const resume=suspend();lifecycle.onCleanup(()=>resume?.());
 let mounted=false,passNumber=0;
 return {async play({deliveries,onLand,receipt,finalReturn=false,returnToIdle=false}){
  if(returnToIdle){
   await playReturnBridge({host,fit,signal:lifecycle.signal,onReady:()=>{layer.style.visibility='hidden';},onComplete:async()=>{resume();await prepareIdle?.();}});return;
  }
  const lastFrame=Math.min(rows.length-1,finalReturn?348:333);
  receipt.endFrame=lastFrame;receipt.releases=releases;receipt.sessionPass=++passNumber;
  const targets=deliveries.map(d=>canonicalCorners(cardLandingCorners(d.el),fit));
  const glides=deliveries.map((d,i)=>createCardGlide(rows[releases[i]].cards.find(c=>c.id===i+1).quad,targets[i],releases[i],{fps,latestFrame:lastFrame}));
  receipt.glides=glides.map(({distance,durationFrames,endFrame})=>({distance,durationFrames,endFrame}));
  const landed=onceLand((i,frame)=>{deliveries[i].el.style.visibility='';receipt.landings.push({slot:i+1,shoeDraw:deliveries[i].shoeDraw,frame});onLand(i);});
  function paint(frame){
   const row=rows[frame],cards=[];
   for(const pose of row.cards){
    const i=pose.id-1,d=deliveries[i];if(!d||landed.has(i))continue;
    const release=releases[i],end=glides[i].endFrame;
    if(frame>=end){landed.land(i,frame);continue;}
    let quad=pose.quad;
    if(frame>=release)quad=glides[i].quadAt(frame);
    const face=d.faceDown||pose.face==='back'?'back':'front';
    cards.push({quad,face,card:face==='front'?{r:d.card.r,s:d.card.s}:undefined,shoeOccluded:row.take!=='return'&&pose.face==='back'});
   }
   gpu.paint(null,{cards,handMaskEnabled:row.handMaskEnabled!==false});layer.dataset.frame=String(frame);
  }
  // Keep the previous rendered endpoint visible during a bounded decoder seek.
  // No base-actor exposure, texture reload or GPU recreation between groups.
  if(passNumber>1){
   await new Promise((resolve,reject)=>{
    const clean=()=>{video.removeEventListener('seeked',done);video.removeEventListener('error',failed);lifecycle.signal.removeEventListener('abort',aborted);};
    const done=()=>{clean();resolve();},failed=()=>{clean();reject(Error('Sequence seek failed'));},aborted=()=>{clean();reject(Error('Sequence seek interrupted'));};
    video.addEventListener('seeked',done,{once:true});video.addEventListener('error',failed,{once:true});lifecycle.signal.addEventListener('abort',aborted,{once:true});video.currentTime=0;
   });
  }
  if(!lifecycle.active)throw Error('Sequence cancelled before play');
  if(!mounted){host.dataset.astridContinuous='playing';document.head.append(style);host.append(layer);mounted=true;}
  layer.dataset.pass=String(passNumber);paint(0);
  let callback,finished=false;
  try{
   await new Promise((resolve,reject)=>{
    video.onended=lifecycle.guard(()=>{assertMediaEndpoint(video.currentTime,fps,lastFrame);resolve();});
    video.onerror=lifecycle.guard(()=>reject(Error('Sequence playback failed')));
    const tick=lifecycle.guard((now,m)=>{if(finished)return;const frame=Math.min(lastFrame,Math.round(m.mediaTime*fps));paint(frame);if(frame>=lastFrame){resolve();return;}callback=video.requestVideoFrameCallback(tick);});
    callback=video.requestVideoFrameCallback(tick);video.play().catch(reject);
    const aborted=()=>reject(Error('Sequence playback interrupted'));
    lifecycle.signal.addEventListener('abort',aborted,{once:true});
    lifecycle.onCleanup(()=>lifecycle.signal.removeEventListener('abort',aborted));
   });
   paint(lastFrame);
  }finally{finished=true;video.pause();video.onended=null;video.onerror=null;if(callback!=null)video.cancelVideoFrameCallback(callback);}
 }};
}
