import {uniformRegistration} from './performance-contact.mjs';
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
  let stopped=false,wantsReady=false,mode='rest',task=null,timer,request,playing=null,previousTime=-1,loops=0,stopClip;
  const resize=()=>{const fit=uniformRegistration(take.camera,{width:innerWidth,height:innerHeight});Object.assign(canvas.style,{left:`${fit.x}px`,top:`${fit.y}px`,width:`${fit.width}px`,height:`${fit.height}px`});};
  const showRest=show=>{canvas.style.display=show?'':'none';ready.canvas.style.opacity=show?'0':'';ready.glanceCanvas.style.opacity=show?'0':'';};
  const state=value=>{mode=value;canvas.dataset.restState=value;ready.canvas.dataset.restState=value;};
  const paint=()=>{if(playing?.video.readyState>=2)actor.paint(playing.video,null,{packed:true});};
  const setEntry=key=>{
    if(request!==undefined&&playing)playing.video.cancelVideoFrameCallback(request);
    playing?.video.pause();playing=entries[key];previousTime=-1;
    const entry=playing;
    const frame=(_,meta)=>{
      if(stopped||playing!==entry)return;
      paint();canvas.dataset.restFrame=String(Math.floor(meta.mediaTime*playing.media.fps));
      if(key==='loop'&&previousTime>=0&&meta.mediaTime<previousTime){
        loops++;canvas.dataset.restLoops=String(loops);
        if(!wantsReady&&!task&&loops%3===0)runGlance();
      }
      if(playing===entry){previousTime=meta.mediaTime;request=entry.video.requestVideoFrameCallback(frame);}
    };
    request=playing.video.requestVideoFrameCallback(frame);
  };
  const seekStart=async video=>{
    const target=.5/playing.media.fps;
    if(Math.abs(video.currentTime-target)>=target)await new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=target;});
  };
  const playLoop=async()=>{
    if(stopped)return;
    setEntry('loop');await seekStart(playing.video);paint();showRest(true);state('rest');
    await playing.video.play();
  };
  const playBridge=async key=>{
    if(stopped)return;
    setEntry(key);await seekStart(playing.video);paint();showRest(true);state(key==='out'?'unfolding':'folding');
    const video=playing.video;
    await new Promise((resolve,reject)=>{
      let watchdog;
      const finish=()=>{clearTimeout(watchdog);video.removeEventListener('ended',finish);stopClip=null;paint();resolve();};
      stopClip=finish;video.addEventListener('ended',finish,{once:true});
      watchdog=setTimeout(()=>{video.pause();video.removeEventListener('ended',finish);stopClip=null;reject(new Error('Rest transition timed out'));},Math.max(6000,video.duration*1000+3000));
      video.play().catch(error=>{clearTimeout(watchdog);video.removeEventListener('ended',finish);stopClip=null;reject(error);});
    });
  };
  const revealReady=async()=>{await ready.prepareResume();showRest(false);state('ready');};
  const run=operation=>{
    const pending=operation();task=pending;
    pending.catch(error=>{if(!stopped){console.warn('[folded rest]',error.message);showRest(false);state('ready');ready.resume();}}).finally(()=>{if(task===pending)task=null;});
    return pending;
  };
  const toReady=async()=>{await playBridge('out');if(!stopped)await revealReady();};
  const toRest=async()=>{
    await ready.holdAtBoundary();if(stopped||wantsReady)return;
    await ready.prepareResume();await playBridge('back');
    if(!stopped)await playLoop();
  };
  const runGlance=()=>run(async()=>{
    await toReady();if(stopped||wantsReady)return;
    const names=['glanceLeft','glanceRight','full'];state('glance');
    await ready.glanceOnce(names[Math.floor(Math.random()*names.length)]);
    state('ready');if(!stopped&&!wantsReady)await toRest();
  });
  const holdAtBoundary=async()=>{
    wantsReady=true;clearTimeout(timer);
    if(task)await task;
    if(stopped)return;
    if(mode==='rest')await run(toReady);
    await ready.holdAtBoundary();
  };
  const resume=()=>{
    if(stopped||host.classList.contains('performance-playing'))return;
    wantsReady=false;clearTimeout(timer);
    // Consecutive speech lines keep the ready pose instead of folding and
    // unfolding her arms in the short gap between the recordings.
    timer=setTimeout(()=>{if(stopped||wantsReady)return;if(task){task.then(resume,resume);return;}if(mode==='ready')run(toRest);},700);
  };
  let performing=host.classList.contains('performance-playing');
  const observer=new MutationObserver(()=>{
    const next=host.classList.contains('performance-playing');if(next===performing)return;performing=next;
    if(next){wantsReady=true;clearTimeout(timer);}else resume();
  });
  resize();addEventListener('resize',resize);observer.observe(host,{attributes:true,attributeFilter:['class']});
  await ready.holdAtBoundary();await playLoop();
  return {
    canvas,glanceCanvas:ready.glanceCanvas,sourceSha256:ready.sourceSha256,
    captureFrame:()=>ready.captureFrame(),prepareResume:()=>ready.prepareResume(),holdAtBoundary,resume,
    dispose(){stopped=true;clearTimeout(timer);observer.disconnect();removeEventListener('resize',resize);stopClip?.();
      if(request!==undefined&&playing)playing.video.cancelVideoFrameCallback(request);
      for(const {video} of Object.values(entries)){video.pause();video.removeAttribute('src');video.load();}
      canvas.remove();actor.dispose();ready.dispose();},
  };
}
