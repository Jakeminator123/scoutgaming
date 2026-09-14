for (const panel of document.querySelectorAll('section')) {
  const video=panel.querySelector('video'),canvas=panel.querySelector('canvas'),
    context=canvas.getContext('2d'),status=panel.querySelector('pre');
  let callback=null,observations=[],start=null;
  const draw=()=>{if(panel.dataset.native!=="true")context.drawImage(video,1060,470,350,240,0,0,700,480);};
  const quality=()=>{const q=video.getVideoPlaybackQuality();return {total:q.totalVideoFrames,dropped:q.droppedVideoFrames,corrupted:q.corruptedVideoFrames};};
  const report=()=>{
    const end=quality();
    status.textContent=JSON.stringify({state:video.ended?'ended':video.paused?'paused':'playing',
      duration:video.duration,width:video.videoWidth,height:video.videoHeight,
      frameCallbacks:observations.length,first:observations[0],last:observations.at(-1),
      qualityDelta:start?Object.fromEntries(Object.keys(end).map(k=>[k,end[k]-start[k]])):null,
      observations},null,2);
  };
  const observe=(_time,meta)=>{draw();observations.push({mediaTime:meta.mediaTime,
    frame:Math.round(meta.mediaTime*Number(panel.dataset.fps)),presentedFrames:meta.presentedFrames});
    if(!video.paused&&!video.ended)callback=video.requestVideoFrameCallback(observe);
  };
  video.addEventListener('loadeddata',()=>{draw();report();});
  video.addEventListener('ended',()=>{if(callback!==null)video.cancelVideoFrameCallback(callback);draw();report();});
  video.addEventListener('error',()=>{status.textContent=`Media error: ${video.error?.message??video.error?.code}`;});
  panel.querySelector('button').addEventListener('click',async()=>{
    if(callback!==null)video.cancelVideoFrameCallback(callback);
    video.pause();video.currentTime=0;observations=[];start=quality();
    callback=video.requestVideoFrameCallback(observe);
    try{await video.play();}catch(error){status.textContent=String(error);}
  });
  video.src=panel.dataset.src;
}
