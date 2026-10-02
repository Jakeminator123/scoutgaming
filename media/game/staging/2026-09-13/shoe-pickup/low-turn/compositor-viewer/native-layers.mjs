import {packedGPU} from '/packed-gpu.mjs';
import {resolveFrameCards} from '/card-state.mjs';
import {shoeMaskEnabled} from '/camera-shoe-contract.mjs';
const {ledger}=await(await fetch('/camera60-joined.json')).json();
const rear=document.querySelector('#rear'),front=document.querySelector('#front'),status=document.querySelector('#status'),result=document.querySelector('#result');
const params=new URLSearchParams(location.search),full=params.get('full')==='1',offset=full?0:174,count=full?350:60,last=count-1;
const codec=params.get('codec')||'gbr';if(codec==='420'){rear.src='/native-rear-420.webm';front.src='/native-front-420.webm';rear.load();front.load();}
if(['709','601'].includes(codec)){rear.src='/native-rear-'+codec+'.webm';front.src='/native-front-'+codec+'.webm';rear.load();front.load();}
if(full){rear.src='/native-rear-joined709.webm';front.src='/native-front-joined709.webm';rear.load();front.load();document.querySelector('#play').textContent='Play full sequence';document.querySelector('p').textContent='Full four-delivery and return diagnostic. Seven-seat gameplay and layer synchronization remain unapproved.';}
const gpu=packedGPU(document.querySelector('#cards'),rear,{actor:false,outputWidth:1280,shoeMaskURL:'/camera-shoe-mask.png'});
const deliveries=new Map([{r:'A',s:'♠'},{r:'7',s:'♥'},{r:'Q',s:'♣'},{r:'4',s:'♦'}].map((card,i)=>[i+1,{card,faceDown:false}]));
// Resolve authoritative card identities and rigid poses once; neither clock alters geometry.
const samples=ledger.slice(offset,offset+count).map(row=>({cards:resolveFrameCards(row,deliveries).map(c=>({...c,shoeOccluded:row.take!=='return'&&shoeMaskEnabled({...c,nativeFrame:row.sourcePosition})}))}));
function paint(n){gpu.paint(null,samples[n]);}
const cardClock=params.get('cardClock')==='display'?'display':'callback';
// expectedDisplayTime is a predicted presentation timestamp, not callback delivery time.
// RAF timestamps are used without an assumed one-refresh lead. Phase must be visually tested.
function displayPosition(anchor,timestamp,rate=1){return anchor.mediaTime+(timestamp-anchor.expectedDisplayTime)*rate/1000;}
function frameAt(position){return Math.max(0,Math.min(last,Math.round(position*60)));}
async function ready(v){if(v.readyState<2)await new Promise((resolve,reject)=>{v.addEventListener('loadeddata',resolve,{once:true});v.addEventListener('error',()=>reject(Error('Native alpha unavailable: '+v.id)),{once:true});});if(v.currentTime>0)await new Promise(r=>{v.addEventListener('seeked',r,{once:true});v.currentTime=0;});}
let generation=0,raf=null,anchor=null,frontState='ready';const callbacks={};
function stopDisplayClock(){if(raf!==null)cancelAnimationFrame(raf);raf=null;anchor=null;}
// A fresh rear callback re-establishes phase after any pause, seek or buffering event.
for(const event of ['pause','waiting','seeking','ended','ratechange'])rear.addEventListener(event,stopDisplayClock);
for(const event of ['pause','waiting','seeking','ended'])front.addEventListener(event,()=>{frontState=event;});
front.addEventListener('playing',()=>{frontState='playing';});
document.querySelector('#play').onclick=async()=>{
 generation++;const token=generation;stopDisplayClock();
 for(const v of [rear,front]){v.pause();v.onended=null;if(callbacks[v.id]!=null)v.cancelVideoFrameCallback(callbacks[v.id]);}
 await Promise.all([ready(rear),ready(front)]);if(token!==generation)return;
 paint(last);paint(0);result.textContent='';
 const evidence={rear:[],front:[]},quality={},cardPaints=[],anchorResiduals=[],refreshIntervals=[];let ended=0,painted=0,lastRAF=null,frontAnchor=null;frontState='starting';
 function displayTick(timestamp){
  raf=null;if(token!==generation||rear.paused||rear.ended||rear.seeking||!anchor)return;
  if(lastRAF!==null){const delta=timestamp-lastRAF;if(delta>=4&&delta<=40){refreshIntervals.push(delta);if(refreshIntervals.length>30)refreshIntervals.shift();}}lastRAF=timestamp;
  const sorted=[...refreshIntervals].sort((a,b)=>a-b),refreshMs=sorted.length?sorted[Math.floor(sorted.length/2)]:1000/60;
  // Diagnostic safety bound: three observed RAF intervals, bounded to 50–100 ms (at least three 60fps source frames).
  // Missing callbacks beyond this bound are unknown presentation, not permission to advance.
  const staleAfterMs=Math.min(100,Math.max(3*1000/60,3*refreshMs)),anchorAgeMs=timestamp-anchor.expectedDisplayTime,clockValid=anchorAgeMs<=staleAfterMs;
  const position=displayPosition(anchor,timestamp,rear.playbackRate),requestedFrame=frameAt(position),n=clockValid?requestedFrame:painted,started=performance.now(),changed=n!==painted;
  const frontAgeMs=frontAnchor?timestamp-frontAnchor.expectedDisplayTime:null;
  // This asset's decoded front alpha is identically zero only AFTER joined frame 287.
  // A stale opaque front frame remains a concern even after the rear reaches that boundary.
  const frontKnownTransparent=frontAnchor!==null&&offset+frontAnchor.frame>287;
  const frontPotentiallyVisible=offset+requestedFrame<=287||!frontKnownTransparent;
  const frontStall=frontPotentiallyVisible&&(frontState!=='playing'||frontAgeMs===null||frontAgeMs>staleAfterMs);
  if(!clockValid)status.value='Card clock held: rear anchor stale; presentation unknown';
  if(changed){paint(n);painted=n;status.value=`Joined frame ${offset+n}; display-clock hypothesis`;}
  cardPaints.push({frame:n,joined:offset+n,rafTime:timestamp,paintTime:started,paintMs:performance.now()-started,painted:changed,position,requestedFrame,clockValid,staleAfterMs,observedRefreshMs:refreshMs,frontState,frontAgeMs,frontPotentiallyVisible,frontStall,anchorFrame:anchor.frame,anchorMediaTime:anchor.mediaTime,anchorExpectedDisplayTime:anchor.expectedDisplayTime,anchorAgeMs:timestamp-anchor.expectedDisplayTime,mediaClockResidualMs:(position-rear.currentTime)*1000});
  raf=requestAnimationFrame(displayTick);
 }
 for(const v of [rear,front]){
  const base=v.getVideoPlaybackQuality();
  v.onended=()=>{if(token!==generation)return;if(v===rear)stopDisplayClock();const q=v.getVideoPlaybackQuality();quality[v.id]={total:q.totalVideoFrames-base.totalVideoFrames,dropped:q.droppedVideoFrames-base.droppedVideoFrames};if(++ended===2){result.textContent=JSON.stringify({codec,full,offset,count,cardClock,evidence,quality,cardPaints,anchorResiduals,clockPolicy:'RAF/card counts do not measure native presentation. Expected-display anchor extrapolation has no assumed refresh lead and holds after three median observed RAF intervals, minimum three 60fps source intervals=50ms and maximum100ms; initial50ms. Front-stall visibility diagnostic uses verified zero alpha after joined287, not callback completion. Visual phase and two-layer synchronization remain unapproved.'});status.value='Ended; both layer clocks recorded';}};
  function tick(now,m){
   if(token!==generation)return;const n=frameAt(m.mediaTime);
   evidence[v.id].push({frame:n,mediaTime:m.mediaTime,expectedDisplayTime:m.expectedDisplayTime,presentationTime:m.presentationTime,callbackTime:now});
   if(v===front){frontAnchor={frame:n,expectedDisplayTime:m.expectedDisplayTime};if(!v.paused&&!v.seeking&&!v.ended)frontState='playing';}
   if(v===rear){
    if(cardClock==='display'){
     anchorResiduals.push({frame:n,callbackTime:now,expectedDisplayTime:m.expectedDisplayTime,callbackLeadMs:m.expectedDisplayTime-now,residualMs:anchor?(m.mediaTime-displayPosition(anchor,m.expectedDisplayTime,rear.playbackRate))*1000:null});
     anchor={frame:n,mediaTime:m.mediaTime,expectedDisplayTime:m.expectedDisplayTime};
     if(raf===null&&!rear.paused&&!rear.ended&&!rear.seeking)raf=requestAnimationFrame(displayTick);
    }else{paint(n);status.value=`Joined frame ${offset+n}; native layer test`;}
   }
   callbacks[v.id]=v.requestVideoFrameCallback(tick);
  }
  callbacks[v.id]=v.requestVideoFrameCallback(tick);
 }
 try{await Promise.all([rear.play(),front.play()]);}catch(error){if(token===generation){stopDisplayClock();rear.pause();front.pause();status.value=String(error);}}
};
await Promise.all([ready(rear),ready(front)]);paint(0);status.value=`Ready: ${count} frames, local0 = joined${offset}`;

document.querySelector('#colour').onclick=async()=>{
 generation++;const token=generation;stopDisplayClock();for(const v of [rear,front]){v.pause();v.onended=null;if(callbacks[v.id]!=null)v.cancelVideoFrameCallback(callbacks[v.id]);}
 const source=document.createElement('video');source.src='/camera60-contour-mixed5.mp4';source.muted=true;source.preload='auto';
 await ready(source);if(token!==generation){source.removeAttribute('src');source.load();return;}const control=params.get('control')==='1'&&!full?document.createElement('video'):null;if(control){control.src='/native-opaque-709.webm';control.muted=true;control.preload='auto';await ready(control);}const rows=[];
 function dispose(){source.removeAttribute('src');source.load();if(control){control.removeAttribute('src');control.load();}}
 if(token!==generation){dispose();return;}
 async function at(v,t){if(Math.abs(v.currentTime-t)>.0001)await new Promise(r=>{v.addEventListener('seeked',r,{once:true});v.currentTime=t;});}
 function pixels(v){const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(v,0,0);return ctx.getImageData(0,0,c.width,c.height).data;}
 for(const n of [0,Math.floor(last/2),last]){if(token!==generation){dispose();return;}await Promise.all([at(source,(offset+n+.5)/60),at(rear,(n+.5)/60),at(front,(n+.5)/60)]);if(token!==generation){dispose();return;}const original=pixels(source);if(control)await at(control,(n+.5)/60);if(token!==generation){dispose();return;}const controlPixels=control?pixels(control):null;
  for(const v of [rear,front]){const rgba=pixels(v),buckets={opaque:{count:0,sum:[0,0,0],absolute:[0,0,0],control:[0,0,0],controlAbsolute:[0,0,0],controlMax:0},nearOpaque:{count:0,sum:[0,0,0],absolute:[0,0,0],control:[0,0,0],controlAbsolute:[0,0,0],controlMax:0}};let count=0,sum=[0,0,0],absolute=[0,0,0],max=0;for(let i=0;i<rgba.length;i+=4){if(rgba[i+3]<251)continue;count++;const bucket=buckets[rgba[i+3]===255?'opaque':'nearOpaque'];bucket.count++;for(let c=0;c<3;c++){const d=rgba[i+c]-original[i+c];sum[c]+=d;absolute[c]+=Math.abs(d);bucket.sum[c]+=d;bucket.absolute[c]+=Math.abs(d);if(controlPixels){const e=controlPixels[i+c]-original[i+c];bucket.control[c]+=e;bucket.controlAbsolute[c]+=Math.abs(e);bucket.controlMax=Math.max(bucket.controlMax,Math.abs(e));}max=Math.max(max,Math.abs(d));}}rows.push({layer:v.id,local:n,joined:offset+n,pixels:count,meanDelta:sum.map(x=>x/count),meanAbsolute:absolute.map(x=>x/count),maxAbsolute:max,alphaGroups:Object.fromEntries(Object.entries(buckets).map(([k,b])=>[k,{pixels:b.count,meanDelta:b.sum.map(x=>b.count?x/b.count:null),meanAbsolute:b.absolute.map(x=>b.count?x/b.count:null),opaqueControlMaxAbsolute:controlPixels?b.controlMax:null,opaqueControlMeanAbsolute:controlPixels?b.controlAbsolute.map(x=>b.count?x/b.count:null):null,opaqueControlMeanDelta:controlPixels?b.control.map(x=>b.count?x/b.count:null):null}]))});}
 }
 source.removeAttribute('src');source.load();if(control){control.removeAttribute('src');control.load();}paint(last);result.textContent=JSON.stringify({codec,colourComparison:rows,policy:'Browser canvas unpremultiplied RGB; nativealpha>=251 only; original packedtopRGB sampled at frame midpoints to avoid timestamp rounding. No colour correction applied.'});status.value='Source pixel comparison complete';
};
