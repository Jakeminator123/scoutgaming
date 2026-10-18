// A native-frame callback can arrive while the browser is seeking across a
// loop boundary. Keep it armed even then. The display clock also recovers a
// lost callback or a media element that paused/stalled at the end of a loop.
export function createIdleVideoLoop(video,{
  fps,onFrame,onError=()=>{},onRecovery=()=>{},
  now=()=>performance.now(),visible=()=>!document.hidden,
  schedule=callback=>requestAnimationFrame(callback),cancel=id=>cancelAnimationFrame(id),
}){
  let stopped=false,suspended=true,frameRequest,displayRequest,playing=null;
  let painted=-1,observed=-1,lastProgress=now(),lastNative=-Infinity,lastRecovery=-Infinity;
  const publish=time=>{
    if(stopped||suspended||video.readyState<2)return;
    if(Math.floor(time*fps+.0001)===Math.floor(painted*fps+.0001))return;
    painted=time;onFrame(time);
  };
  const nativeFrame=(_,metadata)=>{
    if(stopped)return;
    // Rearm before checking readyState. Returning here used to permanently
    // stop rendering when readyState temporarily dropped below HAVE_CURRENT_DATA.
    frameRequest=video.requestVideoFrameCallback(nativeFrame);
    lastNative=now();publish(metadata.mediaTime);
  };
  const play=()=>{
    if(playing)return playing;
    playing=Promise.resolve().then(()=>video.play()).finally(()=>{playing=null;});
    return playing;
  };
  const tick=()=>{
    if(stopped)return;
    displayRequest=schedule(tick);
    if(suspended||!visible()){lastProgress=now();return;}
    const time=video.currentTime,stamp=now();
    if(time!==observed){observed=time;lastProgress=stamp;}
    if(stamp-lastNative>250)publish(time);
    const stalled=stamp-lastProgress>1500;
    if(!video.seeking&&(video.ended||video.paused||stalled)&&stamp-lastRecovery>1500){
      lastRecovery=lastProgress=stamp;
      if(video.ended||stalled)video.currentTime=0;
      onRecovery(video.ended?'ended':stalled?'stalled':'paused');
      play().catch(onError);
    }
  };
  if(video.requestVideoFrameCallback)frameRequest=video.requestVideoFrameCallback(nativeFrame);
  displayRequest=schedule(tick);
  return {
    async resume(){
      if(stopped)return;
      suspended=false;lastProgress=now();
      await play();publish(video.currentTime);
    },
    pause({reset=false}={}){
      suspended=true;video.pause();
      if(reset)video.currentTime=0;
    },
    stop(){
      stopped=true;suspended=true;video.pause();cancel(displayRequest);
      if(frameRequest!==undefined)video.cancelVideoFrameCallback(frameRequest);
    },
  };
}
