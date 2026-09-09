// Both halves are sampled from the same presented video; embedded audio stays
// on that video at its original rate. Mask processing never runs another clock.
import {createActorCompositor} from './actor-compositor.mjs';
export function packedSpeechCanvas(video,{width,height,bandY=height}){
  const compositor=createActorCompositor(width,height),canvas=compositor.canvas;
  canvas.className='dealer-speech-video';canvas.setAttribute('aria-hidden','true');
  const hands=document.createElement('canvas');hands.width=width;hands.height=height-bandY;
  hands.className='dealer-speech-hands';hands.setAttribute('aria-hidden','true');
  const h=hands.getContext('2d');
  let request,stopped=false;
  const paint=()=>{
    if(stopped||video.readyState<2)return;
    compositor.paint(video,null,{packed:true});
    if(hands.height){h.clearRect(0,0,width,hands.height);h.drawImage(canvas,0,bandY,width,hands.height,0,0,width,hands.height);}
  };
  const frame=()=>{paint();if(!stopped)request=video.requestVideoFrameCallback(frame);};
  return {canvas,hands,start(){paint();request=video.requestVideoFrameCallback(frame);},stop(){if(stopped)return;stopped=true;if(request!==undefined)video.cancelVideoFrameCallback(request);canvas.remove();hands.remove();compositor.dispose();}};
}
