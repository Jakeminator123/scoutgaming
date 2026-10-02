import {packedGPU} from '/packed-gpu.mjs';
import {cardPose} from '/card-pose.mjs';
const usePreroll=new URLSearchParams(location.search).get('preroll')==='1';
const [manifest,trajectory,observations,registration]=await Promise.all([usePreroll?'/continuous-preroll.json':'/continuous.json','/trajectory.json','/observations.json','/transforms.json'].map(async path=>{const response=await fetch(path);if(!response.ok)throw Error(path);return response.json();}));
const video=document.querySelector('#video'),status=document.querySelector('#status'),slider=document.querySelector('#frame');
const preroll=manifest.decoderPrerollFrames||0;if(usePreroll)video.src='/continuous-preroll.mp4';
const gpu=packedGPU(document.querySelector('#scene'),video),last=manifest.frameCount-1;slider.max=last;
const transforms={pickup:registration.clips.source,slide:registration.clips.slide,return:registration.clips.return};
const register=(q,t)=>q?.map(([x,y])=>[x*t.scale+t.translation[0],y*t.scale+t.translation[1]])??null;
function slideQuad(n){const a=observations.frames[Math.floor(n)]?.fingerCandidateNative,b=observations.frames[Math.ceil(n)]?.fingerCandidateNative;if(!a||!b)return null;const f=n-Math.floor(n),p=a.map((v,i)=>v+(b[i]-v)*f);return register([[1052,619],[1109,612],[1136,643],[1079,650]].map(([x,y])=>[x+p[0]-1075,y+p[1]-620]),transforms.slide);}
function paint(n){const frame=manifest.frames[n],take=frame.clip,sourceN=frame.sourcePosition,pose=take==='pickup'?cardPose(trajectory,sourceN):null;let quad=pose?.quad,face=pose?.face||'front';if(take==='pickup'){if(face==='front'&&quad)quad=[quad[3],quad[2],quad[1],quad[0]];quad=register(quad,transforms.pickup);}else quad=slideQuad(take==='slide'?sourceN:54);gpu.paint(null,{video,transform:transforms[take],quad,face,layout:'horizontal'});slider.value=n;status.value=`${n}/${last} · ${take} source ${sourceN.toFixed(2)} · 60 fps draft`;}
let generation=0,callbackId=null;
function stop(){generation++;video.pause();if(callbackId!==null)video.cancelVideoFrameCallback(callbackId);callbackId=null;}
async function seek(n,raw=false){if(video.readyState<2)await new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(Error('Video unavailable')),{once:true});});const time=(n+(raw?0:preroll))/manifest.fps;if(Math.abs(video.currentTime-time)>.0001)await new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=time;});}
document.querySelector('#stop').onclick=stop;
slider.oninput=async()=>{stop();const token=generation,n=Number(slider.value);await seek(n);if(token===generation)paint(n);};
document.querySelector('#play').onclick=async()=>{stop();const token=generation;await seek(0,true);if(token!==generation)return;paint(0);const frames=[0],samples=[{frame:0,time:video.currentTime,kind:'decoded preroll'}];const baseline=video.getVideoPlaybackQuality();
 function next(_,metadata){if(token!==generation)return;const n=Math.round(metadata.mediaTime*manifest.fps)-preroll;if(n<0){callbackId=video.requestVideoFrameCallback(next);return;}if(n>last)return;paint(n);frames.push(n);samples.push({frame:n,time:metadata.mediaTime,presentedFrames:metadata.presentedFrames});if(n===last){video.pause();const q=video.getVideoPlaybackQuality();status.dataset.frames=JSON.stringify([...new Set(frames)]);status.dataset.samples=JSON.stringify(samples);status.dataset.quality=JSON.stringify({total:q.totalVideoFrames-baseline.totalVideoFrames,dropped:q.droppedVideoFrames-baseline.droppedVideoFrames});status.value+=' · ended';return;}callbackId=video.requestVideoFrameCallback(next);}
 callbackId=video.requestVideoFrameCallback(next);await video.play();};
await seek(0);paint(0);
