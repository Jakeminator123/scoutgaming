import {uniformRegistration} from './performance-contact.mjs';
import {createActorCompositor} from './actor-compositor.mjs';
import {createIdleScheduler,idleSegmentErrors,mulberry32} from './astrid-idle-scheduler.mjs';
import {capturePacked} from './astrid-speech-join.mjs';

// Astrid's waiting idle: the eye-contact loop that was already playing stays
// the BASE (Kevin: combine, not swap); the green waiting clip 15777d5f only
// contributes glance segments, spliced in at the base loop's boundary every
// 2nd or 3rd loop by the randomized scheduler. The glance layer is offset by a
// rigid 2D translation measured between the two ready poses; nothing warps.
// A dealing take holds a glance until its end frame; a base loop can be held
// at once, every base frame being a ready pose.
export async function loadGreenWaiting(src='review/astrid-green-waiting/idle.json'){
  const take=await fetch(src).then(r=>r.ok?r.json():null).catch(()=>null);
  if(!take||take.status!=='review'||take.enabled===false)return null;
  const errors=idleSegmentErrors(take);
  if(errors.length)throw new Error(`Waiting idle invalid: ${errors.join('; ')}`);
  return take;
}

function packedVideo(src){
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
  const ready=new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(new Error(`Idle media unavailable: ${src}`)),{once:true});});
  video.src=src;return {video,ready};
}

export async function installGreenWaiting(host,take,{seed=Date.now()>>>0,log=(...a)=>console.info('[idle]',...a),externalLifecycle=false}={}){
  if(!HTMLVideoElement.prototype.requestVideoFrameCallback)throw new Error('Presented video frames are unavailable');
  const base=take.base,glances=take.glances;
  const baseMedia=packedVideo(base.src),glanceMedia=packedVideo(glances.src);
  baseMedia.video.loop=true;
  const baseActor=createActorCompositor(base.width,base.height),glanceActor=createActorCompositor(glances.width,glances.height);
  const baseCanvas=baseActor.canvas,glanceCanvas=glanceActor.canvas;
  baseCanvas.className='astrid-green-idle';baseCanvas.dataset.idleKind='waiting-base';baseCanvas.dataset.idleJob=base.jobId;baseCanvas.dataset.idleSeed=String(seed);
  glanceCanvas.className='astrid-green-idle astrid-green-glance';glanceCanvas.dataset.idleKind='waiting-glance';glanceCanvas.dataset.idleJob=glances.jobId;
  baseCanvas.setAttribute('aria-label','Astrid waiting');glanceCanvas.setAttribute('aria-hidden','true');
  const random=mulberry32(seed);
  const scheduler=createIdleScheduler({segments:{base:{start:0,end:base.frames-1},...take.segments},random,...(take.scheduler??{})});
  const eps=1e-4,sequence=[],seekWaiters=new Set();
  let stopped=false,held=false,holdWaiters=[],current='base',glance=null,previousBaseTime=-1,baseLoops=0,lastProgress=performance.now(),watchdog,baseRequest,glanceRequest;
  const [offsetX,offsetY]=take.spliceOffset??[0,0];
  const record=name=>{sequence.push(name);if(sequence.length>60)sequence.shift();baseCanvas.dataset.idleSegment=name;baseCanvas.dataset.idleSequence=sequence.join(',');};
  const settleHold=()=>{held=true;baseCanvas.dataset.idleState='held';for(const done of holdWaiters.splice(0))done();};
  const seek=async(video,target,tolerance)=>{
    if(Math.abs(video.currentTime-target)<tolerance)return;
    await new Promise(resolve=>{
      const finish=()=>{video.removeEventListener('seeked',finish);seekWaiters.delete(finish);resolve();};
      seekWaiters.add(finish);video.addEventListener('seeked',finish,{once:true});video.currentTime=target;
    });
  };
  const resize=()=>{
    const fit=uniformRegistration(take.camera,{width:innerWidth,height:innerHeight});
    Object.assign(baseCanvas.style,{left:`${fit.x}px`,top:`${fit.y}px`,width:`${fit.width}px`,height:`${fit.height}px`});
    const gfit=uniformRegistration(glances.camera,{width:innerWidth,height:innerHeight});
    Object.assign(glanceCanvas.style,{left:`${gfit.x+offsetX*gfit.scale}px`,top:`${gfit.y+offsetY*gfit.scale}px`,width:`${gfit.width}px`,height:`${gfit.height}px`});
  };
  const showGlance=on=>{glanceCanvas.style.visibility=on?'':'hidden';baseCanvas.style.visibility=on?'hidden':'';};
  const playBase=async()=>{
    current='base';showGlance(false);record('base');log('base',`${base.jobId.slice(0,8)} 0-${base.frames-1}`);
    baseMedia.video.currentTime=0;previousBaseTime=-1;lastProgress=performance.now();
    await baseMedia.video.play().catch(error=>{
      if(error.name==='AbortError'&&(held||stopped||baseMedia.video.paused))return;
      baseCanvas.dataset.idleState='error';console.warn('[waiting idle]',error.message);
    });
    if(!held&&!stopped&&!baseMedia.video.paused)baseCanvas.dataset.idleState='playing';
  };
  const playGlance=async name=>{
    const segment=take.segments[name];glance={name,...segment};current=name;record(name);log(name,`${glances.jobId.slice(0,8)} ${segment.start}-${segment.end}`);
    baseMedia.video.pause();
    const target=(segment.start+.5)/glances.fps;
    await seek(glanceMedia.video,target,.5/glances.fps);
    if(stopped||held)return;
    glanceActor.paint(glanceMedia.video,null,{packed:true});showGlance(true);lastProgress=performance.now();
    await glanceMedia.video.play().catch(error=>{baseCanvas.dataset.idleState='error';console.warn('[waiting idle]',error.message);});
    baseCanvas.dataset.idleState='playing';
  };
  const atBoundary=()=>{
    if(stopped)return;
    if(holdWaiters.length){baseMedia.video.pause();glanceMedia.video.pause();return settleHold();}
    const next=scheduler.next();
    if(next==='base'){if(current!=='base')playBase();else record('base');}
    else playGlance(next);
  };
  const paintBase=(_,metadata)=>{
    if(stopped)return;
    baseRequest=baseMedia.video.requestVideoFrameCallback(paintBase);
    if(held||current!=='base'||baseMedia.video.readyState<2)return;
    const t=metadata.mediaTime;lastProgress=performance.now();
    baseActor.paint(baseMedia.video,null,{packed:true});baseCanvas.dataset.idleFrame=String(Math.floor(t*base.fps+eps));
    if(previousBaseTime>=0&&t<previousBaseTime){baseLoops++;baseCanvas.dataset.idleLoops=String(baseLoops);atBoundary();}
    previousBaseTime=t;
  };
  const paintGlance=(_,metadata)=>{
    if(stopped)return;
    glanceRequest=glanceMedia.video.requestVideoFrameCallback(paintGlance);
    if(held||!glance||glanceMedia.video.readyState<2)return;
    const frame=Math.floor(metadata.mediaTime*glances.fps+eps);lastProgress=performance.now();
    glanceActor.paint(glanceMedia.video,null,{packed:true});baseCanvas.dataset.idleFrame=String(Math.min(frame,glance.end));
    if(frame>=glance.end){glanceMedia.video.pause();const done=glance;glance=null;if(done)atBoundary();}
  };
  try{await Promise.all([baseMedia.ready,glanceMedia.ready]);}
  catch(error){baseActor.dispose();glanceActor.dispose();throw error;}
  if(baseMedia.video.videoWidth!==base.width||baseMedia.video.videoHeight!==base.height*2)throw new Error('Packed base idle dimensions are invalid');
  if(glanceMedia.video.videoWidth!==glances.width||glanceMedia.video.videoHeight!==glances.height*2)throw new Error('Packed glance media dimensions are invalid');
  resize();host.append(baseCanvas,glanceCanvas);showGlance(false);addEventListener('resize',resize);
  baseRequest=baseMedia.video.requestVideoFrameCallback(paintBase);glanceRequest=glanceMedia.video.requestVideoFrameCallback(paintGlance);
  document.documentElement.dataset.astridIdle='green';
  await playBase();
  watchdog=setInterval(()=>{
    if(stopped||held||document.hidden)return;
    if(performance.now()-lastProgress>1500){baseCanvas.dataset.idleRecoveries=String(Number(baseCanvas.dataset.idleRecoveries??0)+1);glance=null;playBase();}
  },1000);
  let performing=false;
  const observer=new MutationObserver(()=>{
    const next=host.classList.contains('performance-playing');
    if(next===performing)return;performing=next;
    if(next){if(!held){baseMedia.video.pause();glanceMedia.video.pause();held=true;baseCanvas.dataset.idleState='held';}}
    else{held=false;glance=null;playBase();}
  });
  if(!externalLifecycle)observer.observe(host,{attributes:true,attributeFilter:['class']});
  return {
    canvas:baseCanvas,glanceCanvas,sequence,
    restoreLifecycle(){observer.observe(host,{attributes:true,attributeFilter:['class']});},
    sourceSha256:base.sha256,
    async glanceOnce(name){
      if(stopped||!take.segments[name])return;
      held=false;await playGlance(name);
      if(!stopped)await new Promise(resolve=>holdWaiters.push(resolve));
    },
    captureFrame(){
      const isBase=current==='base',media=isBase?base:glances;
      return capturePacked(isBase?baseMedia.video:glanceMedia.video,media.width,media.height,base.width,base.height,isBase?0:offsetX,isBase?0:offsetY);
    },
    async prepareResume(){
      // Paint the destination before revealing the idle; otherwise the old
      // held frame flashes for one refresh while the video seeks back to 0.
      const video=baseMedia.video;video.pause();
      const target=.5/base.fps;
      await seek(video,target,.5/base.fps);if(stopped)return;
      current='base';glance=null;showGlance(false);baseActor.paint(video,null,{packed:true});
      return capturePacked(video,base.width,base.height);
    },
    // A base loop can be held at once (every base frame is a ready pose); a
    // running glance is held only at its end frame.
    holdAtBoundary(){
      if(held||stopped)return Promise.resolve();
      if(current==='base'){baseMedia.video.pause();settleHold();return Promise.resolve();}
      return new Promise(resolve=>holdWaiters.push(resolve));
    },
    resume(){if(held&&!stopped&&!host.classList.contains('performance-playing')){held=false;glance=null;playBase();}},
    dispose(){stopped=true;clearInterval(watchdog);observer.disconnect();removeEventListener('resize',resize);
      for(const done of holdWaiters.splice(0))done();
      for(const finish of [...seekWaiters])finish();
      for(const [m,r] of [[baseMedia,baseRequest],[glanceMedia,glanceRequest]]){m.video.pause();if(r!==undefined)m.video.cancelVideoFrameCallback(r);m.video.removeAttribute('src');m.video.load();}
      baseCanvas.remove();glanceCanvas.remove();baseActor.dispose();glanceActor.dispose();},
  };
}
