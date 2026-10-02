// Presentation follows elapsed wall time; late frames are skipped, never replayed slowly.
export function playNativeFrameClock({frameCount,fps,present,onTick=()=>{},signal}){
 return new Promise((resolve,reject)=>{
  let handle=null,settled=false,last=0;const origin=performance.now(),duration=frameCount*1000/fps;
  const finish=(error)=>{if(settled)return;settled=true;if(handle!==null)cancelAnimationFrame(handle);signal?.removeEventListener('abort',abort);error?reject(error):resolve();};
  const abort=()=>finish(signal.reason??Error('Native playback cancelled'));
  const tick=async now=>{
   if(settled)return;
   try{
    const elapsed=Math.max(0,now-origin),frame=Math.min(frameCount-1,Math.floor(elapsed*fps/1000));
    if(frame>last){const skipped=frame-last-1;await present(frame);if(settled)return;onTick({frame,mediaTime:frame/fps,callbackTime:now,elapsed,skipped});last=frame;}
    if(elapsed>=duration)finish();else handle=requestAnimationFrame(tick);
   }catch(error){finish(error);}
  };
  if(signal?.aborted)return abort();signal?.addEventListener('abort',abort,{once:true});handle=requestAnimationFrame(tick);
 });
}
