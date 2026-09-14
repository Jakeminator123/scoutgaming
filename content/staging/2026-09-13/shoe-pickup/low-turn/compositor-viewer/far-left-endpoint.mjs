import {packedGPU} from '/packed-gpu.mjs';
const source=document.querySelector('#source'),cardLayer=document.querySelector('#card-layer'),scene=document.querySelector('#scene');
const targets=await fetch('/seven-seat-targets.json').then(r=>{if(!r.ok)throw Error('Seat calibration unavailable');return r.json();});
const selector=document.querySelector('#seat');
const requested=Number(new URLSearchParams(location.search).get('box')??0);
selector.value=String(Number.isInteger(requested)&&requested>=0&&requested<=6?requested:0);
const fps=24,frame=0,time=(frame+.5)/fps;
const gpu=packedGPU(cardLayer,source,{actor:false,outputWidth:1920});
const ctx=scene.getContext('2d',{willReadFrequently:true});
let busy=false;
async function render(){
 if(busy)return;busy=true;document.querySelector('#render').disabled=true;selector.disabled=true;
 try{
  const box=Number(selector.value),target=targets.targets.find(t=>t.box===box);
  if(!target||target.sourceCameraCorners?.length!==4||!target.sourceCameraCorners.flat().every(Number.isFinite))throw Error('Invalid seat calibration');
  const quad=target.sourceCameraCorners;
  const xs=quad.map(p=>p[0]),ys=quad.map(p=>p[1]),bounds=[Math.floor(Math.min(...xs))-3,Math.floor(Math.min(...ys))-3,Math.ceil(Math.max(...xs))+3,Math.ceil(Math.max(...ys))+3];
  if(source.readyState<2)await new Promise((resolve,reject)=>{source.addEventListener('loadeddata',resolve,{once:true});source.addEventListener('error',()=>reject(Error('Original source video unavailable')),{once:true});});
  source.pause();if(source.videoWidth!==1920||source.videoHeight!==1080)throw Error(`Expected original1920×1080, got ${source.videoWidth}×${source.videoHeight}; refusing resize`);
  if(Math.abs(source.currentTime-time)>1e-7)await new Promise((resolve,reject)=>{source.addEventListener('seeked',resolve,{once:true});source.addEventListener('error',()=>reject(Error('Source seek failed')),{once:true});source.currentTime=time;});
  // Browser-native decode at the midpoint of native24fps frame0, without filtering or rescaling.
  ctx.clearRect(0,0,1920,1080);ctx.drawImage(source,0,0);const before=ctx.getImageData(0,0,1920,1080);
  // Capture immediately after GPU render: its drawing buffer is not preserved across browser paints.
  gpu.paint(null,{cards:[{quad,face:'front',card:{r:'7',s:'♥'}}]});ctx.drawImage(cardLayer,0,0);
  const after=ctx.getImageData(0,0,1920,1080);let changedOutsideBox=0,changedInsideBox=0;
  for(let y=0;y<1080;y++)for(let x=0;x<1920;x++){const i=4*(y*1920+x);if(before.data[i]===after.data[i]&&before.data[i+1]===after.data[i+1]&&before.data[i+2]===after.data[i+2]&&before.data[i+3]===after.data[i+3])continue;if(x<bounds[0]||x>bounds[2]||y<bounds[1]||y>bounds[3])changedOutsideBox++;else changedInsideBox++;}
  if(changedOutsideBox)throw Error(`Unexpected ${changedOutsideBox} changed pixels outside card bounds`);
  if(!changedInsideBox)throw Error('Card did not render; refusing empty export');
  const link=document.querySelector('#download');link.href=scene.toDataURL('image/png');link.download=`astrid-box${box}-endpoint-source0-7hearts.png`;link.hidden=false;
  document.querySelector('#receipt').textContent=JSON.stringify({box,calibrationCaptureSHA256:targets.captureSHA256,calibrationUncertainty:targets.uncertainty,sourceURL:source.currentSrc,nativeFPS:fps,nativeFrame:frame,seekSeconds:time,actualCurrentTime:source.currentTime,width:1920,height:1080,quad,card:{r:'7',s:'♥'},changedOutsideCardBoundingBox:changedOutsideBox,changedInsideCardBoundingBox:changedInsideBox,policy:'Editable authored scene composition. Original browser-decoded source unchanged outside independent card bounds; no source actor or room pixel repair. Reference only; no gameplay promotion.'},null,2);
  document.querySelector('#status').textContent='Rendered exact card coordinates; PNG data URL is available in the download link.';
 }catch(error){document.querySelector('#download').hidden=true;document.querySelector('#status').textContent=String(error);}finally{busy=false;document.querySelector('#render').disabled=false;selector.disabled=false;}
}
document.querySelector('#render').onclick=render;
selector.onchange=render;
await render();
