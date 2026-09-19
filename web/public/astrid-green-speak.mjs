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
  if(take?.version!==2)errors.push('unsupported version');
  if(take?.dealer!=='astrid'||take?.action!=='speak')errors.push('not an Astrid speak take');
  const offset=take?.spliceOffset??[0,0];
  if(!Array.isArray(offset)||offset.length!==2||!offset.every(Number.isFinite))errors.push('spliceOffset invalid');
  const lines=take?.lines;
  if(!lines||typeof lines!=='object'||!Object.keys(lines).length)errors.push('no lines');
  else for(const [id,line] of Object.entries(lines)){
    const m=line?.media;
    if(!m?.src||!Number.isInteger(m?.width)||!Number.isInteger(m?.height)||!(m?.fps>0)||!Number.isInteger(m?.frames)||m.frames<2||m.layout!=='rgb-over-alpha')errors.push(`${id}: media incomplete`);
    if(!line?.camera?.placement||line.camera.width!==m?.width||line.camera.height!==m?.height)errors.push(`${id}: camera must match the packed media`);
    if(!line?.audio||typeof line.text!=='string')errors.push(`${id}: audio or text missing`);
    if(!Number.isInteger(line?.cutIn)||!Number.isInteger(line?.cutOut)||line.cutIn<0||line.cutOut<=line.cutIn||line.cutOut>(m?.frames??0)-1)errors.push(`${id}: cut range invalid`);
    if(!Number.isFinite(line?.audioOffsetSeconds))errors.push(`${id}: audioOffsetSeconds missing`);
  }
  return errors;
}

function packedVideo(src){
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
  const ready=new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(new Error(`Speak media unavailable: ${src}`)),{once:true});});
  video.src=src;return {video,ready};
}

export async function installGreenSpeak(host,take,{waiting=()=>null,log=(...a)=>console.info('[speak]',...a)}={}){
  if(!HTMLVideoElement.prototype.requestVideoFrameCallback)throw new Error('Presented video frames are unavailable');
  const errors=speakManifestErrors(take);
  if(errors.length)throw new Error(`Speak take invalid: ${errors.join('; ')}`);
  const [offsetX,offsetY]=take.spliceOffset??[0,0];
  // One decoded video and one recording per line; the compositor is created
  // per utterance at that line's crop size and disposed with it.
  const lines=new Map(Object.entries(take.lines).map(([id,line])=>{
    const audio=new Audio(line.audio);audio.preload='auto';
    return [id,{line,audio,...packedVideo(line.media.src)}];
  }));
  const layer=document.createElement('div');layer.className='astrid-green-speak';layer.setAttribute('aria-hidden','true');layer.style.visibility='hidden';
  host.append(layer);
  let active=null,stopped=false,current=null;
  const resize=()=>{
    if(!current)return;
    const fit=uniformRegistration(current.line.camera,{width:innerWidth,height:innerHeight});
    Object.assign(layer.style,{left:`${fit.x+offsetX*fit.scale}px`,top:`${fit.y+offsetY*fit.scale}px`,width:`${fit.width}px`,height:`${fit.height}px`});
  };
  addEventListener('resize',resize);
  // A dealing take appended while she speaks takes the layer over; the speak
  // stops at once and leaves the performance class to the take's own release.
  const observer=new MutationObserver(()=>{if(active&&host.querySelector('.performance-layer'))active.abort();});
  observer.observe(host,{childList:true});
  async function say(id,{signal,onStart=()=>{},onFinish=()=>{}}={}){
    const entry=lines.get(id);
    if(!entry||active||stopped||document.hidden)return false;
    const {line,audio,video}=entry,media=line.media,fps=media.fps;
    // Autoplay is settled before the idle is touched: a refused play rejects
    // here and nothing on screen changes.
    audio.volume=0;await audio.play();audio.pause();audio.currentTime=0;audio.volume=1;
    const controller=new AbortController();active=controller;
    const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
    let actor,frameRequest,videoDone=false,audioDone=false,audioStarted=false,delta=null,settled=null,timer,resolveDone;
    const done=new Promise(resolve=>{resolveDone=resolve;});
    const finish=()=>{
      if(active!==controller)return;active=null;current=null;
      clearTimeout(timer);signal?.removeEventListener('abort',abort);
      if(frameRequest!==undefined)video.cancelVideoFrameCallback(frameRequest);
      video.pause();audio.pause();audio.removeEventListener('ended',onAudioEnded);video.removeEventListener('ended',onVideoEnded);
      layer.style.visibility='hidden';layer.dataset.speakState='idle';
      actor?.canvas.remove();actor?.dispose();
      if(!host.querySelector('.performance-layer'))host.classList.remove('performance-playing');
      try{onFinish();}finally{resolveDone();}
    };
    const onAudioEnded=()=>{audioDone=true;if(videoDone)finish();};
    // Some browsers deliver ended before the final video-frame callback; the
    // decoded last image is still there, so present it as the cut-out frame.
    const onVideoEnded=()=>{if(!videoDone){if(video.readyState>=2)actor.paint(video,null,{packed:true});layer.dataset.speakFrame=String(line.cutOut);videoDone=true;}if(audioDone||audio.ended)finish();};
    controller.signal.addEventListener('abort',finish,{once:true});
    timer=setTimeout(abort,20000);
    const audioClock=mediaTime=>mediaTime-line.cutIn/fps+line.audioOffsetSeconds;
    const paint=(_,metadata)=>{
      if(controller.signal.aborted)return;
      const frame=Math.min(line.cutOut,Math.floor(metadata.mediaTime*fps+1e-4));
      actor.paint(video,null,{packed:true});layer.dataset.speakFrame=String(frame);
      if(!audioStarted){
        // Anchor the line to the first presented frame, not to play() timing.
        audioStarted=true;
        audio.currentTime=Math.max(0,audioClock(metadata.mediaTime));
        audio.play().catch(error=>{console.warn('[speak]',error.message);abort();});
      }else if(delta===null&&!audio.paused&&audio.currentTime>0){
        // Output latency after play() shows up as the audio clock trailing
        // the presented frame. Measure it once and, when it exceeds a frame,
        // move the audio clock once, still inside the leading silence.
        delta=audio.currentTime-audioClock(metadata.mediaTime);
        layer.dataset.speakStartDeltaMs=String(Math.round(delta*1000));
        // Only a trailing audio clock is moved; a leading one means late
        // frames, which catch up on their own.
        const nudge=delta<-1/fps;
        if(nudge)audio.currentTime=Math.max(0,audio.currentTime-delta);
        log(id,'audio/video start delta',`${Math.round(delta*1000)} ms`,nudge?'(audio clock nudged)':'');
      }else if(settled===null&&delta!==null&&frame>=line.cutIn+12&&!audio.paused){
        settled=audio.currentTime-audioClock(metadata.mediaTime);
        layer.dataset.speakSettledDeltaMs=String(Math.round(settled*1000));
        log(id,'audio/video settled delta',`${Math.round(settled*1000)} ms`);
      }
      if(frame>=line.cutOut){videoDone=true;video.pause();if(audioDone||audio.ended)finish();return;}
      frameRequest=video.requestVideoFrameCallback(paint);
    };
    try{
      await waiting()?.holdAtBoundary();
      await entry.ready;
      if(video.videoWidth!==media.width||video.videoHeight!==media.height*2)throw new Error(`${id}: packed speak media dimensions are invalid`);
      if(Math.abs(video.duration-media.frames/fps)>2/fps)throw new Error(`${id}: speak media duration does not match its manifest`);
      await waitForAudio(audio,controller.signal);
      const target=(line.cutIn+.5)/fps;
      if(Math.abs(video.currentTime-target)>=.5/fps)await new Promise(resolve=>{video.addEventListener('seeked',()=>resolve(),{once:true});video.currentTime=target;});
      controller.signal.throwIfAborted();
      actor=createActorCompositor(media.width,media.height);
      Object.assign(actor.canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%'});
      layer.replaceChildren(actor.canvas);current=entry;resize();
      actor.paint(video,null,{packed:true});
      layer.style.visibility='';layer.dataset.speakState='playing';layer.dataset.speakLine=id;layer.dataset.speakJob=line.jobId??'';
      host.classList.add('performance-playing');
      audio.addEventListener('ended',onAudioEnded,{once:true});video.addEventListener('ended',onVideoEnded,{once:true});
      log(id,`${line.jobId} ${line.cutIn}-${line.cutOut}`);
      onStart(line.text);
      frameRequest=video.requestVideoFrameCallback(paint);
      await video.play();
    }catch(error){if(!controller.signal.aborted)console.warn('[speak]',error.message);abort();}
    await done;
    return true;
  }
  return {
    layer,
    lines:[...lines.keys()],
    has:id=>lines.has(id),
    say,
    cancel(){active?.abort();},
    dispose(){stopped=true;active?.abort();observer.disconnect();removeEventListener('resize',resize);
      for(const {video} of lines.values()){video.pause();video.removeAttribute('src');video.load();}
      layer.remove();},
  };
}
