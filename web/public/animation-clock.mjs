// A dealt card must finish even when its tab stops receiving animation frames.
export function animateProgress(duration, draw, {
  now = () => performance.now(),
  requestFrame = callback => requestAnimationFrame(callback),
  cancelFrame = id => cancelAnimationFrame(id),
  visibility = document,
} = {}) {
  return new Promise((resolve, reject) => {
    let done=false, frame, timer;
    const start=now();
    const cleanup=()=>{
      done=true; clearTimeout(timer); cancelFrame(frame);
      visibility.removeEventListener('visibilitychange', hidden);
    };
    const paint=t=>{
      if(done)return;
      try { draw(t); } catch(error) {cleanup();reject(error);return;}
      if(t===1){cleanup();resolve();}
    };
    const hidden=()=>{if(visibility.hidden)paint(1);};
    const tick=timestamp=>{
      paint(Math.min(1,Math.max(0,(timestamp-start)/duration)));
      if(!done)frame=requestFrame(tick);
    };
    visibility.addEventListener('visibilitychange',hidden);
    // Occluded windows can stop rAF without changing document.hidden.
    timer=setTimeout(()=>paint(1),duration+150);
    if(visibility.hidden || duration<=0)paint(1);
    else frame=requestFrame(tick);
  });
}
