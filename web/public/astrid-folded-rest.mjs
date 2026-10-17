import {uniformRegistration} from '../../packages/presentation/contracts/performance-contact.mjs';
import {createActorCompositor} from './actor-compositor.mjs';

// Folded rest has a different hand pose. A filmed empty-hand bridge reaches
// the existing ready player before speech, dealing, or a glance can own it.
// Speech keeps its calibrated ready frame, source hash, and audio unchanged.
export async function installFoldedRest(host,take,ready){
  if(take.readySha256!==ready.sourceSha256)throw new Error('Folded rest targets a different ready pose');
  const entries={};
  for(const key of ['loop','out','back']){
    const media=take[key],video=document.createElement('video');
    video.muted=true;video.playsInline=true;video.preload='auto';video.loop=key==='loop';
    const loaded=new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(new Error(`Rest ${key} unavailable`)),{once:true});});
    video.src=media.src;entries[key]={media,video,loaded};
  }
  await Promise.all(Object.values(entries).map(e=>e.loaded));
  for(const {media,video} of Object.values(entries))if(video.videoWidth!==take.width||video.videoHeight!==take.height*2||Math.abs(video.duration-media.frames/media.fps)>2/media.fps)throw new Error('Folded rest media does not match its manifest');
  const actor=createActorCompositor(take.width,take.height),canvas=actor.canvas;
  canvas.className='astrid-green-idle astrid-folded-rest';canvas.setAttribute('aria-label','Astrid resting with folded hands');
  host.append(canvas);
  let stopped=false,wantsReady=false,mode='rest',task=null,readyPromise=null,timer,request,playing=null,previousTime=-1,loops=0,stopClip,boundaryWaiter,intent=0;
  const seekWaiters=new Set();
  const resize=()=>{const fit=uniformRegistration(take.camera,{width:innerWidth,height:innerHeight});Object.assign(canvas.style,{left:`${fit.x}px`,top:`${fit.y}px`,width:`${fit.width}px`,height:`${fit.height}px`});};
  const showRest=show=>{canvas.style.display=show?'':'none';ready.canvas.style.opacity=show?'0':'';ready.glanceCanvas.style.opacity=show?'0':'';};
  const state=value=>{mode=value;canvas.dataset.restState=value;ready.canvas.dataset.restState=value;};
  const paint=()=>{if(playing?.video.readyState>=2){actor.paint(playing.video,null,{packed:true});canvas.dataset.restFrame=String(Math.min(playing.media.frames-1,Math.floor(playing.video.currentTime*playing.media.fps)));}};
  const setEntry=key=>{
    if(request!==undefined&&playing)playing.video.cancelVideoFrameCallback(request);
    playing?.video.pause();playing=entries[key];previousTime=-1;
    const entry=playing;
    const frame=(_,meta)=>{
      if(stopped||playing!==entry)return;
      if(key==='loop'&&previousTime>=0&&meta.mediaTime<previousTime){
        loops++;canvas.dataset.restLoops=String(loops);
        // Keep the last presented tail on screen while the outgoing bridge
        // decodes. Painting the wrapped head here caused a one-frame reset.
        if(boundaryWaiter){entry.video.pause();boundaryWaiter();return;}
      }
      paint();canvas.dataset.restFrame=String(Math.floor(meta.mediaTime*entry.media.fps));
      if(playing===entry){previousTime=meta.mediaTime;request=entry.video.requestVideoFrameCallback(frame);}
    };
    request=playing.video.requestVideoFrameCallback(frame);
  };
  const seekStart=async entry=>{
    const {video,media}=entry,target=.5/media.fps;
    if(Math.abs(video.currentTime-target)>=target)await new Promise(resolve=>{
      const finish=()=>{video.removeEventListener('seeked',finish);seekWaiters.delete(finish);resolve();};
      seekWaiters.add(finish);video.addEventListener('seeked',finish,{once:true});video.currentTime=target;
    });
  };
  const waitLoopBoundary=()=>new Promise((resolve,reject)=>{
    state('waiting-to-unfold');
    const timeout=setTimeout(()=>{boundaryWaiter=null;reject(new Error('Rest loop boundary timed out'));},Math.max(5000,entries.loop.video.duration*1000+2500));
    boundaryWaiter=()=>{clearTimeout(timeout);boundaryWaiter=null;resolve();};
  });
  const playLoop=async()=>{
    if(stopped)return;
    setEntry('loop');await seekStart(playing);if(stopped)return;paint();showRest(true);state('rest');
    await playing.video.play();
  };
  const playBridge=async key=>{
    if(stopped)return;
    setEntry(key);await seekStart(playing);if(stopped)return;paint();showRest(true);state(key==='out'?'unfolding':'folding');
    const video=playing.video;
    await new Promise((resolve,reject)=>{
      let watchdog;
      const finish=()=>{clearTimeout(watchdog);video.removeEventListener('ended',finish);stopClip=null;if(!stopped)paint();resolve();};
      stopClip=finish;video.addEventListener('ended',finish,{once:true});
      watchdog=setTimeout(()=>{video.pause();video.removeEventListener('ended',finish);stopClip=null;reject(new Error('Rest transition timed out'));},Math.max(6000,video.duration*1000+3000));
      video.play().catch(error=>{clearTimeout(watchdog);video.removeEventListener('ended',finish);stopClip=null;reject(error);});
    });
  };
  const revealReady=async()=>{await ready.prepareResume();if(stopped)return;showRest(false);state('ready');};
  const run=operation=>{
    const pending=Promise.resolve().then(operation);task=pending;
    pending.catch(error=>{if(!stopped){console.warn('[folded rest]',error.message);showRest(false);state('ready');ready.resume();}}).finally(()=>{if(task===pending)task=null;});
    return pending;
  };
  const toReady=async()=>{await playBridge('out');if(!stopped)await revealReady();};
  const toRest=async()=>{
    await ready.holdAtBoundary();if(stopped||wantsReady)return;
    // The ready player is already at the calibrated pose. Do not visibly
    // seek it again before the first decoded return frame takes over.
    await playBridge('back');if(stopped)return;
    if(wantsReady){state('folded');return;}
    await playLoop();
  };
  const holdAtBoundary=()=>{
    wantsReady=true;intent++;clearTimeout(timer);
    if(readyPromise)return readyPromise;
    const preceding=task;
    const pending=Promise.resolve().then(async()=>{
      if(preceding)await preceding.catch(()=>{});
      if(stopped)return;
      if(mode==='rest')await waitLoopBoundary();
      if(stopped)return;
      if(mode==='waiting-to-unfold'||mode==='folded')await run(toReady);
      if(!stopped)await ready.holdAtBoundary();
    }).catch(async error=>{
      if(stopped)return;
      // A stalled video must not block the server round indefinitely.
      console.warn('[folded rest]',error.message);canvas.dataset.restRecovery=error.message;
      await revealReady();if(!stopped)await ready.holdAtBoundary();
    });
    const shared=pending.finally(()=>{if(readyPromise===shared)readyPromise=null;});
    readyPromise=shared;return shared;
  };
  const resume=()=>{
    if(stopped||host.classList.contains('performance-playing'))return;
    wantsReady=false;clearTimeout(timer);const requestIntent=++intent;
    // The folded loop supplies breathing and eye motion itself. Keep the
    // older glance sources out of this cycle until their joins are reviewed.
    const schedule=()=>{
      if(stopped||wantsReady||requestIntent!==intent)return;
      timer=setTimeout(()=>{
        if(stopped||wantsReady||requestIntent!==intent)return;
        const pending=readyPromise??task;
        if(pending){pending.then(schedule,schedule);return;}
        if(mode==='ready')run(toRest);
      },700);
    };
    schedule();
  };
  let performing=host.classList.contains('performance-playing');
  const observer=new MutationObserver(()=>{
    const next=host.classList.contains('performance-playing');if(next===performing)return;performing=next;
    if(next){wantsReady=true;intent++;clearTimeout(timer);}else resume();
  });
  resize();addEventListener('resize',resize);observer.observe(host,{attributes:true,attributeFilter:['class']});
  await ready.holdAtBoundary();await playLoop();
  return {
    canvas,glanceCanvas:ready.glanceCanvas,sourceSha256:ready.sourceSha256,
    captureFrame:()=>ready.captureFrame(),prepareResume:()=>ready.prepareResume(),holdAtBoundary,resume,
    dispose(){stopped=true;intent++;clearTimeout(timer);observer.disconnect();removeEventListener('resize',resize);boundaryWaiter?.();stopClip?.();
      for(const finish of [...seekWaiters])finish();
      if(request!==undefined&&playing)playing.video.cancelVideoFrameCallback(request);
      for(const {video} of Object.values(entries)){video.pause();video.removeAttribute('src');video.load();}
      canvas.remove();actor.dispose();ready.dispose();},
  };
}
