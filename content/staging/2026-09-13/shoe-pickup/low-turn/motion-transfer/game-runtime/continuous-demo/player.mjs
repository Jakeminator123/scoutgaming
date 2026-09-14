import {createPassLifecycle,safeDelivery,onceLand,assertMediaEndpoint} from './lifecycle.mjs';
import {packedGPU} from './packed-gpu.mjs';
import {uniformRegistration} from '/performance-contact.mjs';
import {sourceFit,canonicalCorners} from '/astrid-single-seat/game-contract.mjs';
import {cardLandingCorners} from '/performance-player.mjs';

export async function playContinuousPass({deliveries,suspend,onLand,signal}){
 if(deliveries.length!==4||deliveries.some(d=>!Number.isInteger(d.shoeDraw)))throw Error('Four server-issued cards required');
 const issuedDeliveries=deliveries;const lifecycle=createPassLifecycle({signal});let gpu,video,layer,style,host,resume,callback;const receipt={mode:'continuous-rough-gameplay',landings:[],cards:[],endpointPolicy:'Source hand contact then 12-frame authored slide to actual game card; not exact physical destination approval'};
 try{
 deliveries=deliveries.map(safeDelivery);receipt.cards=deliveries.map(({shoeDraw,faceDown})=>({shoeDraw,faceDown}));
 const source=await lifecycle.prepare(async signal=>{const r=await fetch('/astrid-continuous/joined-ledger.json',{signal});if(!r.ok)throw Error('Missing sequence');return r.json();});
 const rows=source.ledger,fps=source.fps,lastFrame=Math.min(rows.length-1,333);receipt.endFrame=lastFrame;
 const releases=[1,2,3,4].map(id=>rows.findIndex(row=>row.cards.some(c=>c.id===id&&c.released===true)&&(id!==4||row.outputFrame>=285)));
 if(releases.some(n=>n<0))throw Error('Missing source release');
 const fit=sourceFit(uniformRegistration({width:1280,height:720},{width:innerWidth,height:innerHeight}));
 const targets=deliveries.map(d=>canonicalCorners(cardLandingCorners(d.el),fit));
 video=lifecycle.ownVideo(document.createElement('video'));video.src='/astrid-continuous/actor.mp4';video.muted=true;video.playsInline=true;video.preload='auto';
 layer=document.createElement('div');layer.className='performance-layer astrid-continuous-actor';Object.assign(layer.style,{position:'absolute',left:fit.x+'px',top:fit.y+'px',width:1920*fit.scale+'px',height:1080*fit.scale+'px',zIndex:24,pointerEvents:'none'});
 const canvas=document.createElement('canvas');Object.assign(canvas.style,{width:'100%',height:'100%'});layer.append(canvas);
 style=document.createElement('style');style.textContent='#scene[data-astrid-continuous] #dealer-wrap,#scene[data-astrid-continuous] #dealer-hands-wrap,#scene[data-astrid-continuous] .performance-layer:not(.astrid-continuous-actor){visibility:hidden!important}';
 host=document.querySelector('#scene');receipt.releases=releases;
 const landed=onceLand((i,frame)=>{deliveries[i].el.style.visibility='';receipt.landings.push({slot:i+1,shoeDraw:deliveries[i].shoeDraw,frame});onLand(issuedDeliveries[i]);});
 function land(i,frame){landed.land(i,frame);}
 function paint(frame){const row=rows[frame];const cards=[];for(const pose of row.cards){const i=pose.id-1,d=deliveries[i];if(!d||landed.has(i))continue;const release=releases[i],end=release+12;if(frame>=end){land(i,frame);continue;}let quad=pose.quad;if(frame>=release){const start=rows[release].cards.find(c=>c.id===pose.id).quad,t=(frame-release)/12;quad=start.map((p,k)=>p.map((n,j)=>n+(targets[i][k][j]-n)*t));}const face=d.faceDown||pose.face==='back'?'back':'front';cards.push({quad,face,card:face==='front'?{r:d.card.r,s:d.card.s}:undefined,shoeOccluded:row.take!=='return'&&pose.face==='back'});}gpu.paint(null,{cards,handMaskEnabled:row.handMaskEnabled!==false});}
  await lifecycle.prepare(()=>new Promise((resolve,reject)=>{video.onloadeddata=lifecycle.guard(resolve);video.onerror=lifecycle.guard(()=>reject(Error('Sequence unavailable')));video.load();}));
  gpu=packedGPU(canvas,video,{shoeMaskURL:'/astrid-continuous/shoe.png',outputWidth:1280});lifecycle.onCleanup(()=>gpu.dispose?.());if(gpu.ready)await lifecycle.prepare(()=>gpu.ready);
  if(!lifecycle.active)throw Error('Sequence cancelled before ownership');resume=suspend();lifecycle.onCleanup(()=>resume?.());host.dataset.astridContinuous='playing';document.head.append(style);host.append(layer);paint(0);
  lifecycle.onCleanup(()=>{if(callback!=null)video.cancelVideoFrameCallback(callback);});
  await lifecycle.playback(()=>new Promise((resolve,reject)=>{video.onended=lifecycle.guard(()=>{assertMediaEndpoint(video.currentTime,fps,lastFrame);resolve();});video.onerror=lifecycle.guard(()=>reject(Error('Sequence playback failed')));const tick=lifecycle.guard((now,m)=>{const frame=Math.min(lastFrame,Math.round(m.mediaTime*fps));paint(frame);if(frame>=lastFrame){resolve();return;}callback=video.requestVideoFrameCallback(tick);});callback=video.requestVideoFrameCallback(tick);video.play().catch(reject);}));
  paint(lastFrame);receipt.state='complete';
 }catch(error){receipt.state='fallback';receipt.error=error.message;throw error;}
 finally{lifecycle.dispose();layer?.remove();style?.remove();if(host)delete host.dataset.astridContinuous;deliveries.forEach(d=>{if(d.el)d.el.style.visibility='';});const status=document.createElement('div');status.hidden=true;status.className='astrid-continuous-receipt';status.dataset.receipt=JSON.stringify(receipt);(host??document.querySelector('#scene'))?.append(status);}
}
