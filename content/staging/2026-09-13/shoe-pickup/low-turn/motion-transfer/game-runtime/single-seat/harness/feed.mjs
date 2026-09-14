import {createAstridSingleSeat} from './adapter.mjs';
import {packedGPU as fullGPU} from './packed-gpu.mjs';
import {packedGPU as croppedGPU} from './packed-cropped.mjs';
import {packedGPU as grayGPU} from './packed-gray.mjs';
const cropMode=new URLSearchParams(location.search).get('crop'),cropped=['1','high','gray'].includes(cropMode),packedGPU=cropMode==='gray'?grayGPU:cropped?croppedGPU:fullGPU;
const status=document.querySelector('#status'),receipt=document.querySelector('#receipt'),issue=document.querySelector('#issue');let table=null,busy=false,issued=null,active=null,callback=null,run=0;const playbackRuns=[];const preparationMode=new URLSearchParams(location.search).get('prepare')==='reload'?'reload':'seek';
function qualitySnapshot(){const q=video.getVideoPlaybackQuality();return {creationTime:q.creationTime,totalVideoFrames:q.totalVideoFrames,droppedVideoFrames:q.droppedVideoFrames,corruptedVideoFrames:q.corruptedVideoFrames};}
const isolated=location.port==='4190'&&location.hostname==='astridsingleseat.localhost';
async function api(body){if(!isolated)throw Error('Use exact isolated hostname astridsingleseat.localhost:4190');const response=await fetch('/api/table',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok||data.error)throw Error(data.error||'Table request failed');return data;}
function show(){
 const hand=table.round?.hands?.find(h=>h.box===0),card=hand?.cards?.[0];
 const delivery=card?{cardId:`tableVersion:${table.version}:shoeDraw:${card.shoeDraw}`,seatId:'seat0',targetId:'box0',faceDown:false,card:{r:card.r,s:card.s},provenance:{tableVersion:table.version,shoeDraw:card.shoeDraw,source:'same-origin /api/table visible round.hands[box0].cards[0]'}}:null;
 issued=delivery;document.querySelector('#play').disabled=!delivery;
 document.querySelector('#card').textContent=delivery?`Server issued ${delivery.card.r}${delivery.card.s} · draw ${card.shoeDraw}`:'No active issued box0 card';
 receipt.textContent=JSON.stringify({origin:location.origin,tableVersion:table.version,serverPhase:table.round?.phase??null,delivery,candidate:{available:true,visualAcceptance:'FAILED',review:'Independent packed actor; known finger holes/edge/shoe debris. Isolated rough review only.'},bindingPolicy:'Optional slotBindings attaches an issued identity to the immutable reviewed slot; never rewrite its reviewed digest.'},null,2);
 issue.disabled=!!table.round;status.textContent=delivery?'Real server card loaded; rough isolated candidate available.':'Server state loaded.';
}
async function work(action){if(busy)return;busy=true;issue.disabled=true;try{table=await action();show();}catch(error){status.textContent=String(error);}finally{busy=false;if(table)issue.disabled=!!table.round;}}
document.querySelector('#load').onclick=()=>work(()=>api({op:'state'}));
issue.onclick=()=>work(async()=>{if(!table||table.round)throw Error('Active round cannot be replaced');return api({op:'start',version:table.version,requestId:crypto.randomUUID(),bets:Array.from({length:7},(_,i)=>({main:i===0?5:0,pp:0,tp:0}))});});
if(!isolated){status.textContent='Unavailable here. Open http://astridsingleseat.localhost:4190/astrid-single-seat/index.html';document.querySelector('#load').disabled=true;}

const video=document.querySelector('#actor'),canvas=document.querySelector('#scene');if(cropped){video.src=cropMode==='gray'?'/astrid-single-seat/actor-gray.mp4':cropMode==='high'?'/astrid-single-seat/actor-cropped-high.mp4':'/astrid-single-seat/actor-cropped.mp4';video.load();}const gpu=packedGPU(canvas,video,{outputWidth:1920});
function halt(reason='cancelled'){run++;active?.cancel(reason);video.pause();if(callback!==null)video.cancelVideoFrameCallback(callback);callback=null;}
window.addEventListener('resize',()=>halt('resize-requires-target-revalidation'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)halt('hidden');});
document.querySelector('#cancel').onclick=()=>halt();
document.querySelector('#play').onclick=async()=>{
 halt('restart');const token=run;let lands=0;const observations=[],paints=[];let qualityStart=null,playStarted=null,cropReceipt=null;const preparationStarted=performance.now(),qualityBeforePreparation=qualitySnapshot();const lifecycle=[];const recordEvent=event=>lifecycle.push({event:event.type,at:performance.now(),currentTime:video.currentTime,readyState:video.readyState,paused:video.paused,seeking:video.seeking,visibility:document.visibilityState,quality:qualitySnapshot()});const eventNames=['seeking','seeked','waiting','stalled','playing','pause','ended'];for(const name of eventNames)video.addEventListener(name,recordEvent);const detach=()=>{for(const name of eventNames)video.removeEventListener(name,recordEvent);};
 try{
  if(!issued)throw Error('Load an actual server-issued box0 card first');
  const [ledger,target]=await Promise.all(['ledger.json','target.json'].map(x=>fetch('/astrid-single-seat/'+x).then(r=>r.json())));if(token!==run){detach();return;}
  if(cropped){cropReceipt=await fetch(cropMode==='gray'?'/astrid-single-seat/crop-gray-receipt.json':cropMode==='high'?'/astrid-single-seat/crop-high-receipt.json':'/astrid-single-seat/crop-receipt.json').then(r=>r.json());if(cropReceipt.sourceSha256!==ledger.sourceSha256||(!['high','gray'].includes(cropMode)&&cropReceipt.allDecodedYUVFrameHashesEqual!==true)||cropReceipt.frames!==89)throw Error('Crop provenance mismatch');}
  const delivery=structuredClone(issued);delivery.faceDown=delivery.faceDown||document.querySelector('#hidden').checked;if(delivery.faceDown)delete delivery.card;
  const candidate=await createAstridSingleSeat({delivery,ledger,target,slotBindings:[{slotId:'box0-first',cardId:delivery.cardId}],surface:{render:plan=>{
   const start=performance.now();gpu.paint(null,{cards:[...plan.moving.map(c=>({quad:c.corners,face:c.face,card:c.card})),...plan.landed.map(c=>({quad:c.corners,face:c.faceDown?'back':'front',card:c.card}))]});paints.push({frame:plan.frame,start,completed:performance.now(),durationMs:performance.now()-start,videoCurrentTime:video.currentTime});
  },dispose(){detach();video.pause();if(callback!==null)video.cancelVideoFrameCallback(callback);callback=null;}},onLand:e=>{lands++;document.querySelector('#playback').textContent=JSON.stringify({event:'ownership-handoff',landings:lands,cardId:e.cardId,faceDown:e.faceDown,frame:e.landFrame});},onFallback:e=>{document.querySelector('#playback').textContent=JSON.stringify(e);}});
  if(token!==run){candidate.cancel('stale-start');return;}active=candidate;
  // Opt-in decoder reset experiment; same element, media bytes and GPU texture.
  // The default remains seek. Reload is a hypothesis, not an accepted performance fix.
  if(preparationMode==='reload')video.load();
  if(video.readyState<2)await new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(Error('Actor decode failed')),{once:true});});
  if(video.currentTime!==0)await new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=0;});if(token!==run){detach();return;}
  await active.present(0);
  const tick=(now,m)=>{if(token!==run){detach();return;}const frame=Math.min(88,Math.round(m.mediaTime*60));observations.push({frame,mediaTime:m.mediaTime,callbackTime:now,expectedDisplayTime:m.expectedDisplayTime,presentationTime:m.presentationTime,presentedFrames:m.presentedFrames,processingDuration:m.processingDuration});active.present(frame).catch(e=>{status.textContent=String(e);halt('render-failed');});callback=video.requestVideoFrameCallback(tick);};
  qualityStart=qualitySnapshot();playStarted=performance.now();callback=video.requestVideoFrameCallback(tick);video.onended=async()=>{if(token!==run){detach();return;}const qualityEnd=qualitySnapshot(),endedAt=performance.now();const outcome=await active.ended();const entry={run:playbackRuns.length+1,outcome,landings:lands,issuedCardId:delivery.cardId,faceDown:delivery.faceDown,cropped,cropMode,derivative:cropReceipt?{sourceSha256:cropReceipt.sourceSha256,outputSha256:cropReceipt.outputSha256,frames:cropReceipt.frames,crop:cropReceipt.crop,status:cropReceipt.status}:null,preparationMode,preparationStarted,qualityBeforePreparation,preparationMs:playStarted-preparationStarted,playStarted,endedAt,elapsedMs:endedAt-playStarted,qualityStart,qualityEnd,qualityDelta:{totalVideoFrames:qualityEnd.totalVideoFrames-qualityStart.totalVideoFrames,droppedVideoFrames:qualityEnd.droppedVideoFrames-qualityStart.droppedVideoFrames,corruptedVideoFrames:qualityEnd.corruptedVideoFrames-qualityStart.corruptedVideoFrames},observations,paints,lifecycle,visibility:document.visibilityState,videoPresentation:{display:getComputedStyle(video).display,width:video.getBoundingClientRect().width,height:video.getBoundingClientRect().height},visualAcceptance:'FAILED; paint completion and callback counts are not display presentation or smoothness proof'};playbackRuns.push(entry);document.querySelector('#playback').textContent=JSON.stringify({latest:entry,runs:playbackRuns});};await video.play();
 }catch(error){detach();status.textContent=String(error);halt('failed');}
};
