import {uniformRegistration} from './performance-contact.mjs';
import {createActorCompositor} from './actor-compositor.mjs';
import {waitForAudio} from './speech-playback.mjs';

// Astrid's spoken lines on the Blender table: one keyed green take per line
// (ElevenLabs creatify-aurora lip sync over the approved elevated plate) plays
// over the held waiting idle. Each line is cut in at its first frame and out
// at its last, both plate ready poses; the recorded mp3 starts on the first
// presented frame plus the measured audio offset. Opt-in through speak.json.
export async function loadGreenSpeak(src='review/astrid-green-speak/speak.json'){
  const take=await fetch(src).then(r=>r.ok?r.json():null).catch(()=>null);
  if(!take||take.status!=='review'||take.enabled===false)return null;
  const errors=speakManifestErrors(take);
  if(errors.length)throw new Error(`Speak take invalid: ${errors.join('; ')}`);
  return take;
}

export function speakManifestErrors(take){
  const errors=[];
  if(take?.version!==1)errors.push('unsupported version');
  if(take?.dealer!=='astrid'||take?.action!=='speak')errors.push('not an Astrid speak take');
  const m=take?.media;
  if(!m?.src||!Number.isInteger(m?.width)||!Number.isInteger(m?.height)||!(m?.fps>0)||!Number.isInteger(m?.frames)||m.frames<2||m.layout!=='rgb-over-alpha')errors.push('media incomplete');
  if(!take?.camera?.placement||take.camera.width!==m?.width||take.camera.height!==m?.height)errors.push('camera must match the packed media');
  const offset=take?.spliceOffset??[0,0];
  if(!Array.isArray(offset)||offset.length!==2||!offset.every(Number.isFinite))errors.push('spliceOffset invalid');
  const lines=take?.lines;
  if(!lines||typeof lines!=='object'||!Object.keys(lines).length)errors.push('no lines');
  else for(const [id,line] of Object.entries(lines)){
    if(!line?.audio||typeof line.text!=='string')errors.push(`${id}: audio or text missing`);
    if(!Number.isInteger(line?.cutIn)||!Number.isInteger(line?.cutOut)||line.cutIn<0||line.cutOut<=line.cutIn||line.cutOut>(m?.frames??0)-1)errors.push(`${id}: cut range invalid`);
    if(!Number.isFinite(line?.audioOffsetSeconds))errors.push(`${id}: audioOffsetSeconds missing`);
  }
  return errors;
}

export async function installGreenSpeak(host,take,{waiting=()=>null,log=(...a)=>console.info('[speak]',...a)}={}){
  if(!HTMLVideoElement.prototype.requestVideoFrameCallback)throw new Error('Presented video frames are unavailable');
  const errors=speakManifestErrors(take);
  if(errors.length)throw new Error(`Speak take invalid: ${errors.join('; ')}`);
  const media=take.media,fps=media.fps,[offsetX,offsetY]=take.spliceOffset??[0,0];
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
  const ready=new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(new Error(`Speak media unavailable: ${media.src}`)),{once:true});});
  video.src=media.src;
  const actor=createActorCompositor(media.width,media.height),canvas=actor.canvas;
  canvas.className='astrid-green-speak';canvas.dataset.speakJob=take.jobId;canvas.setAttribute('aria-hidden','true');canvas.style.visibility='hidden';
  const audios=new Map(Object.entries(take.lines).map(([id,line])=>{const a=new Audio(line.audio);a.preload='auto';return [id,a];}));
  const resize=()=>{
    const fit=uniformRegistration(take.camera,{width:innerWidth,height:innerHeight});
    Object.assign(canvas.style,{left:`${fit.x+offsetX*fit.scale}px`,top:`${fit.y+offsetY*fit.scale}px`,width:`${fit.width}px`,height:`${fit.height}px`});
  };
  try{await ready;}catch(error){actor.dispose();throw error;}
  if(video.videoWidth!==media.width||video.videoHeight!==media.height*2)throw new Error('Packed speak media dimensions are invalid');
  if(Math.abs(video.duration-media.frames/fps)>2/fps)throw new Error('Speak media duration does not match its manifest');
  resize();host.append(canvas);addEventListener('resize',resize);
  const seek=t=>new Promise(resolve=>{if(Math.abs(video.currentTime-t)<.5/fps)return resolve();video.addEventListener('seeked',()=>resolve(),{once:true});video.currentTime=t;});
  let active=null,stopped=false;
  // A dealing take appended while she speaks takes the layer over; the speak
  // stops at once and leaves the performance class to the take's own release.
  const observer=new MutationObserver(()=>{if(active&&host.querySelector('.performance-layer'))active.abort();});
  observer.observe(host,{childList:true});
  async function say(id,{signal,onStart=()=>{},onFinish=()=>{}}={}){
    const line=take.lines[id];
    if(!line||active||stopped||document.hidden)return false;
    const audio=audios.get(id);
    // Autoplay is settled before the idle is touched: a refused play rejects
    // here and nothing on screen changes.
    audio.volume=0;await audio.play();audio.pause();audio.currentTime=0;audio.volume=1;
    const controller=new AbortController();active=controller;
    const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
    let frameRequest,videoDone=false,audioDone=false,audioStarted=false,delta=null,settled=null,timer,resolveDone;
    const done=new Promise(resolve=>{resolveDone=resolve;});
    const finish=()=>{
      if(active!==controller)return;active=null;
      clearTimeout(timer);signal?.removeEventListener('abort',abort);
      if(frameRequest!==undefined)video.cancelVideoFrameCallback(frameRequest);
      video.pause();audio.pause();audio.removeEventListener('ended',onAudioEnded);
      canvas.style.visibility='hidden';canvas.dataset.speakState='idle';
      if(!host.querySelector('.performance-layer'))host.classList.remove('performance-playing');
      try{onFinish();}finally{resolveDone();}
    };
    const onAudioEnded=()=>{audioDone=true;if(videoDone)finish();};
    controller.signal.addEventListener('abort',finish,{once:true});
    timer=setTimeout(abort,20000);
    const paint=(_,metadata)=>{
      if(controller.signal.aborted)return;
      const frame=Math.min(line.cutOut,Math.floor(metadata.mediaTime*fps+1e-4));
      actor.paint(video,null,{packed:true});canvas.dataset.speakFrame=String(frame);
      if(!audioStarted){
        // Anchor the line to the first presented frame, not to play() timing.
        audioStarted=true;
        audio.currentTime=Math.max(0,metadata.mediaTime-line.cutIn/fps+line.audioOffsetSeconds);
        audio.play().catch(error=>{console.warn('[speak]',error.message);abort();});
      }else if(delta===null&&!audio.paused&&audio.currentTime>0){
        // Output latency after play() shows up as the audio clock trailing
        // the presented frame. Measure it once and, when it exceeds a frame,
        // move the audio clock once, still inside the leading silence.
        delta=audio.currentTime-(metadata.mediaTime-line.cutIn/fps+line.audioOffsetSeconds);
        canvas.dataset.speakStartDeltaMs=String(Math.round(delta*1000));
        if(Math.abs(delta)>1/fps)audio.currentTime=Math.max(0,audio.currentTime-delta);
        log(id,'audio/video start delta',`${Math.round(delta*1000)} ms`,Math.abs(delta)>1/fps?'(audio clock nudged)':'');
      }else if(settled===null&&delta!==null&&frame>=line.cutIn+12&&!audio.paused){
        settled=audio.currentTime-(metadata.mediaTime-line.cutIn/fps+line.audioOffsetSeconds);
        canvas.dataset.speakSettledDeltaMs=String(Math.round(settled*1000));
        log(id,'audio/video settled delta',`${Math.round(settled*1000)} ms`);
      }
      if(frame>=line.cutOut){videoDone=true;video.pause();if(audioDone||audio.ended)finish();return;}
      frameRequest=video.requestVideoFrameCallback(paint);
    };
    try{
      await waiting()?.holdAtBoundary();
      await waitForAudio(audio,controller.signal);
      await seek((line.cutIn+.5)/fps);
      controller.signal.throwIfAborted();
      actor.paint(video,null,{packed:true});
      canvas.style.visibility='';canvas.dataset.speakState='playing';canvas.dataset.speakLine=id;
      host.classList.add('performance-playing');
      audio.addEventListener('ended',onAudioEnded,{once:true});
      log(id,`${take.jobId} ${line.cutIn}-${line.cutOut}`);
      onStart(line.text);
      frameRequest=video.requestVideoFrameCallback(paint);
      await video.play();
    }catch(error){if(!controller.signal.aborted)console.warn('[speak]',error.message);abort();}
    await done;
    return true;
  }
  return {
    canvas,
    has:id=>Boolean(take.lines[id]),
    say,
    cancel(){active?.abort();},
    dispose(){stopped=true;active?.abort();observer.disconnect();removeEventListener('resize',resize);video.removeAttribute('src');video.load();canvas.remove();actor.dispose();},
  };
}
