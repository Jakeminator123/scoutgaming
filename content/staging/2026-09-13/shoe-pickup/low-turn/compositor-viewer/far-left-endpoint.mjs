import {packedGPU} from '/packed-gpu.mjs';
const source=document.querySelector('#source'),cardLayer=document.querySelector('#card-layer'),scene=document.querySelector('#scene');
const quad=[[422.40,644.23],[497.39,681.79],[447.14,742.02],[372.14,704.46]];
const fps=24,frame=0,time=(frame+.5)/fps;
const gpu=packedGPU(cardLayer,source,{actor:false,outputWidth:1920});
const ctx=scene.getContext('2d',{willReadFrequently:true});
let busy=false;
async function render(){
 if(busy)return;busy=true;document.querySelector('#render').disabled=true;
 try{
  if(source.readyState<2)await new Promise((resolve,reject)=>{source.addEventListener('loadeddata',resolve,{once:true});source.addEventListener('error',()=>reject(Error('Original source video unavailable')),{once:true});});
  source.pause();if(source.videoWidth!==1920||source.videoHeight!==1080)throw Error(`Expected original1920×1080, got ${source.videoWidth}×${source.videoHeight}; refusing resize`);
  if(Math.abs(source.currentTime-time)>1e-7)await new Promise((resolve,reject)=>{source.addEventListener('seeked',resolve,{once:true});source.addEventListener('error',()=>reject(Error('Source seek failed')),{once:true});source.currentTime=time;});
  // Browser-native decode at the midpoint of native24fps frame0, without filtering or rescaling.
  ctx.clearRect(0,0,1920,1080);ctx.drawImage(source,0,0);const before=ctx.getImageData(0,0,1920,1080);
  // Capture immediately after GPU render: its drawing buffer is not preserved across browser paints.
  gpu.paint(null,{cards:[{quad,face:'front',card:{r:'7',s:'♥'}}]});ctx.drawImage(cardLayer,0,0);
  const after=ctx.getImageData(0,0,1920,1080);let changedOutsideBox=0,changedInsideBox=0;
  for(let y=0;y<1080;y++)for(let x=0;x<1920;x++){const i=4*(y*1920+x);if(before.data[i]===after.data[i]&&before.data[i+1]===after.data[i+1]&&before.data[i+2]===after.data[i+2]&&before.data[i+3]===after.data[i+3])continue;if(x<370||x>500||y<642||y>745)changedOutsideBox++;else changedInsideBox++;}
  if(changedOutsideBox)throw Error(`Unexpected ${changedOutsideBox} changed pixels outside card bounds`);
  if(!changedInsideBox)throw Error('Card did not render; refusing empty export');
  const link=document.querySelector('#download');link.href=scene.toDataURL('image/png');link.hidden=false;
  document.querySelector('#receipt').textContent=JSON.stringify({sourceURL:source.currentSrc,nativeFPS:fps,nativeFrame:frame,seekSeconds:time,actualCurrentTime:source.currentTime,width:1920,height:1080,quad,card:{r:'7',s:'♥'},changedOutsideCardBoundingBox:changedOutsideBox,changedInsideCardBoundingBox:changedInsideBox,policy:'Editable authored scene composition. Original browser-decoded source unchanged outside independent card bounds; no source actor or room pixel repair. Reference only; no gameplay promotion.'},null,2);
  document.querySelector('#status').textContent='Rendered exact card coordinates; PNG data URL is available in the download link.';
 }catch(error){document.querySelector('#download').hidden=true;document.querySelector('#status').textContent=String(error);}finally{busy=false;document.querySelector('#render').disabled=false;}
}
document.querySelector('#render').onclick=render;
await render();
