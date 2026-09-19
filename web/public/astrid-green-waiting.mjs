import {uniformRegistration} from './performance-contact.mjs';
import {createActorCompositor} from './actor-compositor.mjs';
import {createIdleScheduler,idleSegmentErrors,mulberry32} from './astrid-idle-scheduler.mjs';

// The green waiting clip as Astrid's idle: one packed video, played segment by
// segment under a randomized scheduler. A dealing take asks for a hold and
// gets it at the running segment's end frame (a ready pose), never mid-glance;
// the idle resumes with base once the take releases the scene.
export async function loadGreenWaiting(src='review/astrid-green-waiting/idle.json'){
  const take=await fetch(src).then(r=>r.ok?r.json():null).catch(()=>null);
  if(!take||take.status!=='review'||take.enabled===false)return null;
  const errors=idleSegmentErrors(take);
  if(errors.length)throw new Error(`Waiting idle segments invalid: ${errors.join('; ')}`);
  return take;
}

export async function installGreenWaiting(host,take,{seed=Date.now()>>>0,log=(...a)=>console.info('[idle]',...a)}={}){
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
  const actor=createActorCompositor(take.width,take.height),canvas=actor.canvas;
  canvas.className='astrid-green-idle';canvas.dataset.idleJob=take.jobId;canvas.dataset.idleKind='waiting';canvas.dataset.idleSeed=String(seed);
  canvas.setAttribute('aria-label','Astrid waiting');
  const random=mulberry32(seed);
  const scheduler=createIdleScheduler({segments:take.segments,random,...(take.scheduler??{})});
  const fps=take.fps,eps=1e-4;
  const sequence=[];
  let current=null,frameRequest,stopped=false,held=false,holdWaiters=[],lastProgress=performance.now(),watchdog;
  const frameOf=t=>Math.floor(t*fps+eps);
  const seekTo=frame=>new Promise(resolve=>{
    const target=(frame+.5)/fps;
    if(Math.abs(video.currentTime-target)<.5/fps)return resolve();
    video.addEventListener('seeked',()=>resolve(),{once:true});video.currentTime=target;
  });
  const settleHold=()=>{held=true;canvas.dataset.idleState='held';for(const done of holdWaiters.splice(0))done();};
  const start=async name=>{
    const segment=take.segments[name];current={name,...segment};
    sequence.push(name);if(sequence.length>60)sequence.shift();
    canvas.dataset.idleSegment=name;canvas.dataset.idleSequence=sequence.join(',');
    log(name,`${segment.start}-${segment.end}`);
    await seekTo(segment.start);
    if(stopped||held)return;
    lastProgress=performance.now();
    await video.play().catch(error=>{canvas.dataset.idleState='error';console.warn('[waiting idle]',error.message);});
    canvas.dataset.idleState='playing';
  };
  const advance=()=>{
    video.pause();
    if(stopped)return;
    if(holdWaiters.length)return settleHold();
    start(scheduler.next());
  };
  const paint=(_,metadata)=>{
    if(stopped)return;
    frameRequest=video.requestVideoFrameCallback(paint);
    if(!current||held||video.readyState<2)return;
    const frame=frameOf(metadata.mediaTime);
    lastProgress=performance.now();
    if(frame>=current.end){
      // Present the ready-pose end frame itself, then hand over at the boundary.
      actor.paint(video,null,{packed:true});canvas.dataset.idleFrame=String(current.end);
      advance();return;
    }
    actor.paint(video,null,{packed:true});canvas.dataset.idleFrame=String(frame);
  };
  const resize=()=>{
    const fit=uniformRegistration(take.camera,{width:innerWidth,height:innerHeight});
    Object.assign(canvas.style,{left:`${fit.x}px`,top:`${fit.y}px`,width:`${fit.width}px`,height:`${fit.height}px`});
  };
  const ready=new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(new Error('Waiting idle media unavailable')),{once:true});});
  video.src=take.src;
  if(!HTMLVideoElement.prototype.requestVideoFrameCallback)throw new Error('Presented video frames are unavailable');
  try{await ready;}catch(error){actor.dispose();throw error;}
  if(video.videoWidth!==take.width||video.videoHeight!==take.height*2)throw new Error('Packed waiting idle dimensions are invalid');
  resize();host.append(canvas);addEventListener('resize',resize);
  frameRequest=video.requestVideoFrameCallback(paint);
  document.documentElement.dataset.astridIdle='green';
  await start('base');
  // A stalled or ended element (tab hidden, decoder hiccup) restarts the running segment.
  watchdog=setInterval(()=>{
    if(stopped||held||!current||document.hidden)return;
    if(performance.now()-lastProgress>1500){canvas.dataset.idleRecoveries=String(Number(canvas.dataset.idleRecoveries??0)+1);start(current.name);}
  },1000);
  let performing=false;
  const observer=new MutationObserver(()=>{
    const next=host.classList.contains('performance-playing');
    if(next===performing)return;performing=next;
    if(next){if(!held){video.pause();held=true;canvas.dataset.idleState='held';}}
    else{held=false;start('base');}
  });
  observer.observe(host,{attributes:true,attributeFilter:['class']});
  return {
    canvas,sequence,
    // Resolves at the running segment's end frame, a ready pose; immediately if already held.
    holdAtBoundary(){
      if(held||stopped||!current)return Promise.resolve();
      return new Promise(resolve=>holdWaiters.push(resolve));
    },
    resume(){if(held&&!stopped&&!host.classList.contains('performance-playing')){held=false;start('base');}},
    dispose(){stopped=true;clearInterval(watchdog);observer.disconnect();removeEventListener('resize',resize);video.pause();if(frameRequest!==undefined)video.cancelVideoFrameCallback(frameRequest);video.removeAttribute('src');video.load();canvas.remove();actor.dispose();},
  };
}
