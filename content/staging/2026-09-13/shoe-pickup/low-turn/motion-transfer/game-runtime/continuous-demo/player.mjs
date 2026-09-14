import {packedGPU} from './packed-gpu.mjs';
import {uniformRegistration} from '/performance-contact.mjs';
import {sourceFit,canonicalCorners} from '/astrid-single-seat/game-contract.mjs';
import {cardLandingCorners} from '/performance-player.mjs';

export async function playContinuousPass({deliveries,suspend,onLand}){
 if(deliveries.length!==4||deliveries.some(d=>!Number.isInteger(d.shoeDraw)))throw Error('Four server-issued cards required');
 const source=await fetch('/astrid-continuous/joined-ledger.json',{signal:AbortSignal.timeout(6000)}).then(r=>{if(!r.ok)throw Error('Missing sequence');return r.json();});
 const rows=source.ledger,fps=source.fps;
 const releases=[1,2,3,4].map(id=>rows.findIndex(row=>row.cards.some(c=>c.id===id&&c.released===true)&&(id!==4||row.outputFrame>=285)));
 if(releases.some(n=>n<0))throw Error('Missing source release');
 const fit=sourceFit(uniformRegistration({width:1280,height:720},{width:innerWidth,height:innerHeight}));
 const targets=deliveries.map(d=>canonicalCorners(cardLandingCorners(d.el),fit));
 const video=document.createElement('video');video.src='/astrid-continuous/actor.mp4';video.muted=true;video.playsInline=true;video.preload='auto';
 const layer=document.createElement('div');layer.className='performance-layer astrid-continuous-actor';Object.assign(layer.style,{position:'absolute',left:fit.x+'px',top:fit.y+'px',width:1920*fit.scale+'px',height:1080*fit.scale+'px',zIndex:24,pointerEvents:'none'});
 const canvas=document.createElement('canvas');Object.assign(canvas.style,{width:'100%',height:'100%'});layer.append(canvas);
 const style=document.createElement('style');style.textContent='#scene[data-astrid-continuous] #dealer-wrap,#scene[data-astrid-continuous] #dealer-hands-wrap,#scene[data-astrid-continuous] .performance-layer:not(.astrid-continuous-actor){visibility:hidden!important}';
 const host=document.querySelector('#scene'),landed=new Set(),receipt={mode:'continuous-rough-gameplay',releases,landings:[],cards:deliveries.map(d=>({shoeDraw:d.shoeDraw,faceDown:d.faceDown})),endpointPolicy:'Source hand contact then 12-frame authored slide to actual game card; not exact physical destination approval'};
 let gpu,resume,timer,callback,abort;
 function land(i,frame){if(landed.has(i))return;landed.add(i);deliveries[i].el.style.visibility='';receipt.landings.push({slot:i+1,shoeDraw:deliveries[i].shoeDraw,frame});onLand(deliveries[i]);}
 function paint(frame){const row=rows[frame];const cards=[];for(const pose of row.cards){const i=pose.id-1,d=deliveries[i];if(!d||landed.has(i))continue;const release=releases[i],end=release+12;if(frame>=end){land(i,frame);continue;}let quad=pose.quad;if(frame>=release){const start=rows[release].cards.find(c=>c.id===pose.id).quad,t=(frame-release)/12;quad=start.map((p,k)=>p.map((n,j)=>n+(targets[i][k][j]-n)*t));}const face=d.faceDown||pose.face==='back'?'back':'front';cards.push({quad,face,card:face==='front'?{r:d.card.r,s:d.card.s}:undefined,shoeOccluded:row.take!=='return'&&pose.face==='back'});}gpu.paint(null,{cards,handMaskEnabled:row.handMaskEnabled!==false});}
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Sequence loading timeout')),6000);video.onloadeddata=()=>{clearTimeout(t);resolve();};video.onerror=()=>{clearTimeout(t);reject(Error('Sequence unavailable'));};video.load();});
  gpu=packedGPU(canvas,video,{shoeMaskURL:'/astrid-continuous/shoe.png',outputWidth:1280});resume=suspend();host.dataset.astridContinuous='playing';document.head.append(style);host.append(layer);paint(0);
  await new Promise((resolve,reject)=>{abort=()=>reject(Error('Sequence interrupted'));window.addEventListener('resize',abort,{once:true});video.onended=resolve;video.onerror=()=>reject(Error('Sequence playback failed'));timer=setTimeout(()=>reject(Error('Sequence playback timeout')),10000);const tick=(now,m)=>{paint(Math.min(rows.length-1,Math.round(m.mediaTime*fps)));callback=video.requestVideoFrameCallback(tick);};callback=video.requestVideoFrameCallback(tick);video.play().catch(reject);});
  paint(rows.length-1);receipt.state='complete';
 }catch(error){receipt.state='fallback';receipt.error=error.message;throw error;}
 finally{clearTimeout(timer);window.removeEventListener('resize',abort);video.pause();if(callback!=null)video.cancelVideoFrameCallback(callback);video.removeAttribute('src');video.load();gpu?.dispose?.();layer.remove();style.remove();delete host.dataset.astridContinuous;resume?.();deliveries.forEach(d=>d.el.style.visibility='');const status=document.createElement('div');status.hidden=true;status.className='astrid-continuous-receipt';status.dataset.receipt=JSON.stringify(receipt);host.append(status);}
}
