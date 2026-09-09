// Both halves are sampled from the same presented video; embedded audio stays
// on that video at its original rate. Mask processing never runs another clock.
export function packedSpeechCanvas(video,{width,height,bandY=height}){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  canvas.className='dealer-speech-video';canvas.setAttribute('aria-hidden','true');
  const hands=document.createElement('canvas');hands.width=width;hands.height=height-bandY;
  hands.className='dealer-speech-hands';hands.setAttribute('aria-hidden','true');
  const h=hands.getContext('2d');
  const alpha=document.createElement('canvas');alpha.width=width;alpha.height=height;
  const x=canvas.getContext('2d'),a=alpha.getContext('2d');a.filter='url(#luma-alpha)';
  let request,stopped=false;
  const paint=()=>{
    if(stopped||video.readyState<2)return;
    a.clearRect(0,0,width,height);a.drawImage(video,0,height,width,height,0,0,width,height);
    x.clearRect(0,0,width,height);x.drawImage(video,0,0,width,height,0,0,width,height);
    x.globalCompositeOperation='destination-in';x.drawImage(alpha,0,0);x.globalCompositeOperation='source-over';
    if(hands.height){h.clearRect(0,0,width,hands.height);h.drawImage(canvas,0,bandY,width,hands.height,0,0,width,hands.height);}
  };
  const frame=()=>{paint();if(!stopped)request=video.requestVideoFrameCallback(frame);};
  return {canvas,hands,start(){paint();request=video.requestVideoFrameCallback(frame);},stop(){stopped=true;if(request!==undefined)video.cancelVideoFrameCallback(request);canvas.remove();hands.remove();}};
}
