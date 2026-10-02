import {packedGPU} from '/packed-gpu.mjs';
const video=document.querySelector('#video'),canvas=document.querySelector('#scene'),slider=document.querySelector('#frame'),status=document.querySelector('#status');
const requested=new URLSearchParams(location.search).get('candidate');
const variant=['v4','v5'].includes(requested)?`full-cycle-${requested}`:'full-cycle';
video.src=`/${variant}-packed.mp4`;
const data=await fetch(`/${variant}-ledger.json`).then(r=>{if(!r.ok)throw Error('Packed candidate unavailable');return r.json();});
const gpu=packedGPU(canvas,video,{outputWidth:1920}),rows=data.ledger;
slider.max=rows.length-1;
let callback=null,epoch=0,last=0,seen=[];
function paint(frame){
 const row=rows[frame];if(!row)return;
 const value=document.querySelector('#card').value,hidden=document.querySelector('#hidden').checked;
 gpu.paint(null,{cards:row.cardVisible?[{quad:row.cardCorners,tintLinear:row.cardTintLinear,face:hidden||row.cardSide==='back'?'back':'front',card:hidden?undefined:{r:value.slice(0,-1),s:value.slice(-1)}}]:[]});
 last=frame;slider.value=frame;status.value=`Frame ${frame}/${rows.length-1} · ${row.source} ${row.native} · 60 fps review`;
}
function pause(){epoch++;video.pause();if(callback!==null)video.cancelVideoFrameCallback(callback);callback=null;}
async function seek(frame){
 pause();const token=epoch;
 if(video.readyState<2)await new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(Error('Candidate media unavailable')),{once:true});});
 const time=(frame+.5)/data.fps;
 if(Math.abs(video.currentTime-time)>1e-7)await new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=time;});
 if(token===epoch)paint(frame);
}
document.querySelector('#pause').onclick=pause;
document.querySelector('#play').onclick=async()=>{
 await seek(0);const token=epoch;seen=[];
 const onFrame=(now,metadata)=>{
  if(token!==epoch)return;
  const frame=Math.min(rows.length-1,Math.round(metadata.mediaTime*data.fps));
  paint(frame);seen.push({frame,mediaTime:metadata.mediaTime,expectedDisplayTime:metadata.expectedDisplayTime,callbackTime:now});
  callback=video.requestVideoFrameCallback(onFrame);
 };
 callback=video.requestVideoFrameCallback(onFrame);await video.play();
};
video.addEventListener('ended',()=>{const q=video.getVideoPlaybackQuality();document.querySelector('#receipt').textContent=JSON.stringify({candidateStatus:data.status,videoSha256:data.videoSha256,lastPaintedFrame:last,expectedFinalFrame:rows.length-1,quality:{totalVideoFrames:q.totalVideoFrames,droppedVideoFrames:q.droppedVideoFrames,corruptedVideoFrames:q.corruptedVideoFrames},frames:seen,policy:'Review only. Callback coverage is not visual contact or all-seven-seat gameplay acceptance.'},null,2);});
slider.oninput=()=>seek(Number(slider.value));
document.querySelector('#card').onchange=()=>paint(last);
document.querySelector('#hidden').onchange=()=>paint(last);
await seek(0);
