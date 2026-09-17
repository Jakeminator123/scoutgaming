// Seven-seat review bridge (2026-09-17): plays a full-scene generated Astrid
// reach clip for the FIRST card of a box instead of legacy delivery.
// Rough review only: the clip includes its own baked table and card; the DOM
// card is revealed at the clip's release time. Not physical-contact acceptance.
import {sourceFit} from '/astrid-single-seat/game-contract.mjs';
import {uniformRegistration} from '/performance-contact.mjs';
export const CLIPS={0:{src:'/astrid-seven/box0.mp4',landAt:4.0,job:'ac2fa366'},1:{src:'/astrid-seven/box1.mp4',landAt:3.7,job:'d6f34e24'},2:{src:'/astrid-seven/box2.mp4',landAt:2.3,job:'a9fa1da6'},3:{src:'/astrid-seven/box3.mp4',landAt:2.3,job:'0f5d719c'},4:{src:'/astrid-seven/box4.mp4',landAt:2.3,job:'e1a12d04'}};
let style,bridgeConfig;
export function tryAstridSeven({el,card,faceDown,tableVersion,dealer,suspend}){
 const p=new URLSearchParams(location.search);
 if(p.get('astridSeven')!=='review'||location.hostname!=='astridsingleseat.localhost'||location.port!=='4190'||dealer!=='astrid')return null;
 const box=Number(el.closest('.seat')?.dataset.box),index=Number(el.style.getPropertyValue('--ci'));
 if(index!==0||el.closest('.subhand'))return null;
 return resolveClip(box).then(clip=>clip?play(clip):null);
 async function resolveClip(box){
  // BO assignment wins (Dealing Clips page); only full-scene route clips can play here.
  try{const cfg=await (bridgeConfig??=fetch('/api/bo/config').then(r=>r.json()).catch(()=>({})));const a=cfg?.clipAssignments?.astrid?.[`box${box}`]?.clip;if(a){const m=/^astrid-seven-box(\d)$/.exec(a);if(m)return CLIPS[m[1]];return null;}}catch{}
  return CLIPS[box]??null;
 }
 async function play(clip){
  const host=document.querySelector('#scene');
  const fit=sourceFit(uniformRegistration({width:1280,height:720},{width:innerWidth,height:innerHeight}));
  const hostRect=host.getBoundingClientRect();
  const video=document.createElement('video');video.src=clip.src;video.muted=true;video.playsInline=true;video.preload='auto';video.className='astrid-seven-clip';
  Object.assign(video.style,{position:'absolute',left:`${fit.x-hostRect.left}px`,top:`${fit.y-hostRect.top}px`,width:`${1920*fit.scale}px`,height:`${1080*fit.scale}px`,zIndex:19,pointerEvents:'none',objectFit:'fill'});
  if(!style){style=document.createElement('style');style.textContent='#scene[data-astrid-seven] #dealer-wrap,#scene[data-astrid-seven] #dealer-hands-wrap,#scene[data-astrid-seven] .performance-layer{visibility:hidden!important;}';document.head.append(style);}
  const receipt={box,clip:clip.src,job:clip.job,tableVersion,shoeDraw:card?.shoeDraw,faceDown,fit,startedAt:performance.now()};
  let resume=null,landed=false;const land=()=>{if(landed)return;landed=true;el.style.visibility='';receipt.landedAt=performance.now();};
  el.style.visibility='hidden';
  try{
   await new Promise((res,rej)=>{video.onloadeddata=res;video.onerror=()=>rej(Error('clip decode failed'));setTimeout(()=>rej(Error('clip load timeout')),15000);video.load();});
   resume=suspend();host.dataset.astridSeven=String(box);host.querySelector('#table-canvas').after(video);
   await video.play();
   await new Promise((res,rej)=>{video.onended=res;video.onerror=()=>rej(Error('clip playback failed'));const tick=()=>{if(video.ended)return;if(video.currentTime>=clip.landAt)land();requestAnimationFrame(tick);};tick();setTimeout(()=>rej(Error('clip timeout')),12000);});
   receipt.state='complete';
  }catch(error){receipt.state='fallback';receipt.error=error.message;console.warn('[astrid-seven]',error.message);}
  finally{land();video.remove();delete host.dataset.astridSeven;resume?.();receipt.endedAt=performance.now();const s=document.createElement('div');s.hidden=true;s.className='astrid-seven-receipt';s.dataset.receipt=JSON.stringify(receipt);host.append(s);}
 }
}
