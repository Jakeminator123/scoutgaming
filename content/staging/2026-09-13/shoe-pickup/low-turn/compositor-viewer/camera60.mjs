import {packedGPU} from '/packed-gpu.mjs';
import {resolveFrameCards} from '/card-state.mjs';
import {shoeMaskEnabled} from '/camera-shoe-contract.mjs';
const params=new URLSearchParams(location.search),joined=params.get('joined')==='1';
const response=await fetch(joined?'/camera60-joined.json':'/camera60.json');if(!response.ok)throw Error('Cadence ledger unavailable');
const {ledger,fps}=await response.json(),video=document.querySelector('#video'),status=document.querySelector('#status'),slider=document.querySelector('#frame');
const variant=new URLSearchParams(location.search).get('variant');if(variant==='720')video.src='/camera60-720.mp4';else if(variant==='repaired')video.src='/camera60-repaired.mp4';
if(joined){video.src=variant==='720'?'/camera60-joined-720.mp4':'/camera60-joined.mp4';document.querySelector('p').textContent='Four deliveries and empty-hand return on one shared clock. Contact and edges remain under review. Review card values; this is not gameplay.';}
if(joined&&params.get('contour')==='3')video.src='/camera60-contour.mp4';
if(joined&&params.get('contour')==='mixed5')video.src='/camera60-contour-mixed5.mp4';
const outputWidth=new URLSearchParams(location.search).get('output')==='720'?1280:1920;
if(params.get('render')==='video-only'||params.get('presentVideo')==='1'){video.style.cssText='display:block;width:640px;height:720px;max-height:60vh;object-fit:contain';if(params.get('render')==='video-only')document.querySelector('#scene').style.display='none';document.querySelector('p').textContent=params.get('render')==='video-only'?'Decode/presentation diagnostic: packed RGB and mask video shown directly, without actor/card compositing. Not a gameplay preview.':'Diagnostic: identical video directly presented alongside GPU actor/card compositing. Not a gameplay preview.';}
if(params.get('videoSurface')==='1')video.style.cssText='display:block;position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.001;pointer-events:none';
if(params.get('videoSurface')==='large')video.style.cssText='display:block;position:fixed;left:0;top:0;width:100vw;height:100vh;opacity:0.001;pointer-events:none';
const gpu=packedGPU(document.querySelector('#scene'),video,{shoeMaskURL:'/camera-shoe-mask.png',outputWidth});
const deliveries=new Map([{r:'A',s:'♠'},{r:'7',s:'♥'},{r:'Q',s:'♣'},{r:'4',s:'♦'}].map((card,i)=>[i+1,{card,faceDown:false}]));
let generation=0,callback=null;const last=ledger.length-1;slider.max=last;
function paint(n){const row=ledger[n];if(params.get('render')!=='video-only')gpu.paint(null,{handMaskEnabled:row.handMaskEnabled!==false,cards:resolveFrameCards(row,deliveries).map(card=>({...card,shoeOccluded:row.take!=='return'&&shoeMaskEnabled({...card,nativeFrame:row.sourcePosition})}))});slider.value=n;status.value=`Frame ${n}/${last} · ${fps} fps · ${row.take||'deal'} ${row.sourcePosition.toFixed(2)} · ${params.get('render')==='video-only'?'DECODE-ONLY DIAGNOSTIC; canvas not updated':'mask draft'}`;}
function stop(){generation++;video.pause();if(callback!==null)video.cancelVideoFrameCallback(callback);callback=null;}
async function seek(n){if(video.readyState<2)await new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(Error('Video unavailable')),{once:true});});if(Math.abs(video.currentTime-n/fps)>.0001)await new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=n/fps;});}
document.querySelector('#stop').onclick=stop;
slider.oninput=async()=>{stop();const token=generation,n=Number(slider.value);await seek(n);if(token===generation)paint(n);};
if(joined)for(const [n,label] of [[188,'Third turn'],[193,'Third grip'],[273,'Clip handoff'],[280,'Fourth contact'],[285,'Fourth release'],[349,'Empty hands']]){const button=document.createElement('button');button.textContent=label;button.onclick=async()=>{stop();const token=generation;await seek(n);if(token===generation)paint(n);};status.after(button);}
document.querySelector('#play').onclick=async()=>{
 stop();const token=generation;await seek(0);if(token!==generation)return;paint(0);
 const warmingStarted=performance.now();if(params.get('prewarm')==='1'){paint(last);paint(0);await new Promise(requestAnimationFrame);if(token!==generation)return;}const prewarmMilliseconds=performance.now()-warmingStarted;
 const frames=[0],samples=[],started=performance.now(),baseline=video.getVideoPlaybackQuality?.();
 function next(now,meta){
  if(token!==generation)return;
  const n=Math.min(last,Math.round(meta.mediaTime*fps)),before=performance.now();paint(n);frames.push(n);
  samples.push({frame:n,callbackTime:now,mediaTime:meta.mediaTime,presentedFrames:meta.presentedFrames,processingDuration:meta.processingDuration,expectedDisplayTime:meta.expectedDisplayTime,presentationTime:meta.presentationTime,deadlineSlackMs:meta.expectedDisplayTime-now,paintMilliseconds:performance.now()-before,visibility:document.visibilityState});
  if(n===last){video.pause();const quality=video.getVideoPlaybackQuality?.();status.dataset.frames=JSON.stringify([...new Set(frames)]);status.dataset.metrics=JSON.stringify({renderMode:params.get('render')||'gpu',videoPresented:params.get('render')==='video-only'||params.get('presentVideo')==='1',videoSurface:params.get('videoSurface')||null,prewarmed:params.get('prewarm')==='1',prewarmMilliseconds,elapsedMilliseconds:performance.now()-started,videoWidth:video.videoWidth,videoHeight:video.videoHeight,totalVideoFrames:quality&&baseline?quality.totalVideoFrames-baseline.totalVideoFrames:null,droppedVideoFrames:quality&&baseline?quality.droppedVideoFrames-baseline.droppedVideoFrames:null,samples});status.value+=' · ended';return;}
  callback=video.requestVideoFrameCallback(next);
 }
 callback=video.requestVideoFrameCallback(next);await video.play();
};
await seek(0);paint(0);
