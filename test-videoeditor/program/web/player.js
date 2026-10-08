import {Compositor} from './compositor.js';

const wait=(target,event,timeout=12000,signal=null)=>new Promise((resolve,reject)=>{
  let timer;const clean=()=>{clearTimeout(timer);target.removeEventListener(event,ok);target.removeEventListener('error',bad);signal?.removeEventListener('abort',abort);};
  const ok=()=>{clean();resolve();},bad=()=>{clean();reject(Error('Mediefilen kunde inte spelas. Kontrollera filen och H.264-stödet.'));},abort=()=>{clean();reject(new DOMException('Avbrutet','AbortError'));};
  if(timeout>0)timer=setTimeout(()=>{clean();reject(Error('Medieladdningen tog för lång tid.'));},timeout);target.addEventListener(event,ok,{once:true});target.addEventListener('error',bad,{once:true});
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
});
const video=()=>{const v=document.createElement('video');v.muted=true;v.defaultMuted=true;v.playsInline=true;v.preload='auto';v.setAttribute('playsinline','');return v;};
const loadImage=async url=>{const i=new Image();const ready=wait(i,'load');i.src=url;await ready;return i;};
export function clipPlan(action,state,returnToIdle=true){
  if(action==='idle')return state==='REDO'?['ut_redo_till_vila']:[];
  if(action==='ready')return state==='VILA'?['in_vila_till_redo']:[];
  const id=action.startsWith('deal_pos')?action:'deal_pos'+action;
  return [...(state==='VILA'?['in_vila_till_redo']:[]),id,...(returnToIdle?['ut_redo_till_vila']:[])];
}
export class StudioPlayer extends EventTarget {
  constructor(canvas,{mediaURL=p=>'/media/'+p,onStatus=()=>{},onError=()=>{}}={}){
    super();this.url=mediaURL;this.onStatus=onStatus;this.onError=onError;
    this.compositor=new Compositor(canvas,onError);this.assets=new Map();this.posters={};this.slots=[video(),video()];this.index=0;
    this.queue=[];this.cards=[];this.state='VILA';this.running=false;this.generation=0;this.assetsGeneration=0;this.paused=false;this.frame=0;
    this.abort=new AbortController();this.active=null;this.current=null;this.inspection=false;this.presented=0;this.dropped=0;this.seen=new Set();
    this.raf=0;this.vfc=null;this.scene=null;this.dealer=null;this.variant=null;this.hiddenPaused=false;
    this.visibilityHandler=()=>{
      if(document.hidden&&this.active&&!this.active.paused){this.hiddenPaused=true;this.pause();}
      else if(!document.hidden&&this.hiddenPaused){this.hiddenPaused=false;this.resume().catch(e=>onError(e.message));}
    };document.addEventListener('visibilitychange',this.visibilityHandler);
  }
  emit(type,detail={}){this.dispatchEvent(new CustomEvent(type,{detail}));}
  async setDealer(dealer,variantId='active'){
    this.stop();const generation=this.generation;
    for(const img of Object.values(this.posters))this.compositor.release(img);
    this.dealer=dealer;this.variant=dealer?.variants[variantId==='active'?dealer.active_variant:variantId];this.posters={};this.active=null;
    if(!dealer||!this.variant){this.render();return;}
    if(dealer.validation?.errors?.length)throw Error('Dealern har importfel. Rätta dem i Medieverkstaden först.');
    const pairs=await Promise.all(Object.entries(this.variant.posters).map(async([pose,r])=>[pose,await loadImage(this.url(r.src))]));
    if(generation!==this.generation)return;
    this.posters=Object.fromEntries(pairs);this.render();this.status();
  }
  async setAssets(records){
    const generation=++this.assetsGeneration;const selected=new Set(Object.values(this.scene||{}).filter(v=>typeof v==='string'));
    for(const [id,record]of this.assets){if(!selected.has(id)){if(record.el instanceof HTMLVideoElement){record.el.pause();record.el.removeAttribute('src');record.el.load();}this.compositor.release(record.el);this.assets.delete(id);}}
    await Promise.all(records.filter(a=>selected.has(a.id)&&!this.assets.has(a.id)).map(async a=>{
      let el;if(a.kind==='video'){el=video();el.loop=true;const ready=wait(el,'loadeddata');el.src=this.url(a.src);el.load();await ready;await el.play().catch(()=>{});}
      else el=await loadImage(this.url(a.src));
      if(generation!==this.assetsGeneration){if(el instanceof HTMLVideoElement)el.pause();return;}
      this.assets.set(a.id,{...a,el});
    }));this.startRenderLoop();this.render();
  }
  setScene(scene){this.scene=scene;this.render();}
  status(){const q=this.active?.getVideoPlaybackQuality?.();this.dropped=q?.droppedVideoFrames||0;
    this.onStatus({state:this.state,running:this.running,paused:this.paused,frame:this.frame,clip:this.current?.id||null,frames:this.current?.frames||0,
      renderer:this.compositor.cpu?'CPU-reserv':'WebGL',queue:this.queue.length,presented:this.presented,dropped:this.dropped,inspection:this.inspection});}
  render(){if(!this.scene)return;const actor=this.active&&this.active.readyState>=2?this.active:this.posters[this.state]||this.posters.VILA;
    this.compositor.render(this.scene,actor,this.assets,this.cards,this.dealer?.metadata);}
  startRenderLoop(){if(this.raf)return;const tick=()=>{this.raf=0;
    const animated=[...this.assets.values()].some(a=>a.el instanceof HTMLVideoElement&&!a.el.paused);
    const fallback=this.active&&!this.active.requestVideoFrameCallback&&!this.active.paused;
    if(fallback){this.frame=Math.min((this.current?.frames||1)-1,Math.round(this.active.currentTime*24));this.status();}
    if(animated||fallback){this.render();this.raf=requestAnimationFrame(tick);}};this.raf=requestAnimationFrame(tick);}
  async prepare(slot,cid,signal){
    const record=this.variant?.clips[cid];if(!record)throw Error('Klippet saknas: '+cid+'. Ingen annan rörelse ersätter det.');
    const v=this.slots[slot],url=new URL(this.url(record.src),location.href).href;
    if(v.src===url&&v.readyState>=2){if(v.currentTime>0){const done=wait(v,'seeked',12000,signal);v.currentTime=0;await done;}return v;}
    v.pause();v.src=url;const ready=wait(v,'loadeddata',12000,signal);v.load();await ready;return v;
  }
  framesFor(v){
    if(this.vfc&&this.vfc.video===v)v.cancelVideoFrameCallback?.(this.vfc.id);
    const next=(_,meta)=>{if(v!==this.active)return;this.frame=Math.min((this.current?.frames||1)-1,Math.max(0,Math.round(meta.mediaTime*24)));
      this.presented=meta.presentedFrames;this.render();this.status();this.vfc={video:v,id:v.requestVideoFrameCallback(next)};};
    if(v.requestVideoFrameCallback)this.vfc={video:v,id:v.requestVideoFrameCallback(next)};
  }
  async playOne(cid,card,signal){
    const clip=this.dealer?.clips[cid];if(!clip)throw Error('Det klippet finns inte: '+cid);
    if(clip.start!==this.state)throw Error(`Fel klippkoppling: ${cid} kräver ${clip.start}, spelaren står i ${this.state}.`);
    const slot=this.index,v=await this.prepare(slot,cid,signal);if(signal.aborted)throw new DOMException('Avbrutet','AbortError');
    this.current=clip;this.active=v;this.frame=0;this.framesFor(v);this.render();this.startRenderLoop();
    this.emit('clip-start',{clip:cid,state:this.state});
    const ended=wait(v,'ended',0,signal);
    // Attach a rejection observer before play(): autoplay denial must not leak an unhandled promise.
    ended.catch(()=>{});
    try{await v.play();}catch(e){throw Error('Tryck Spela för att tillåta video. '+e.message);}
    await ended;
    if(signal.aborted)return;
    if(this.vfc){this.vfc.video.cancelVideoFrameCallback?.(this.vfc.id);this.vfc=null;}
    if(clip.role==='deal'&&card){
      this.cards.push({...card,target:clip.target,clip:cid});
      this.emit('card-landed',{...card,target:clip.target,clip:cid,at:'clip-end',sourceCueFrame:clip.land_frame_source});}
    this.state=clip.end;this.active=null;this.current=null;this.index=1-slot;this.render();
    this.emit('clip-end',{clip:cid,state:this.state});this.status();
  }
  enqueueDeal(target,card={r:'A',s:'S'},returnToIdle=true){
    const id=String(target).startsWith('deal_pos')?String(target):'deal_pos'+target;
    if(!this.dealer?.clips[id])throw Error('Saknar '+id+'. Knappen är inte en ersättningsanimation.');
    if(this.queue.length>=100)throw Error('Kön är full (100 handlingar).');
    this.queue.push({kind:'deal',action:id,card:{...card,faceDown:id==='deal_poshole'||!!card.faceDown},returnToIdle});
    this.pump();this.status();
  }
  enqueueState(state){this.queue.push({kind:'state',action:state});this.pump();}
  async pump(){
    if(this.running||!this.queue.length)return;
    this.running=true;this.inspection=false;const generation=this.generation;
    try{while(this.queue.length&&generation===this.generation){
      const job=this.queue.shift();const plan=clipPlan(job.action,this.state,job.returnToIdle??true);
      for(let i=0;i<plan.length;i++){
        if(generation!==this.generation)return;
        // Preload the following clip into the other element. No extra decoder per mask/pass.
        const nextId=plan[i+1];if(nextId)this.prepare(1-this.index,nextId,this.abort.signal).catch(()=>{});
        await this.playOne(plan[i],plan[i].startsWith('deal_')?job.card:null,this.abort.signal);
      }
    }}catch(e){if(e.name!=='AbortError'){this.onError(e.message);this.emit('playback-error',{message:e.message});this.stop(false);}}
    finally{if(generation===this.generation){this.running=false;this.paused=false;this.current=null;this.active=null;this.render();this.status();this.emit('queue-idle',{state:this.state});}}
  }
  pause(){if(this.active){this.active.pause();this.paused=true;this.status();}}
  async resume(){if(this.active){await this.active.play();this.paused=false;this.status();}}
  stop(clearCards=true){
    this.generation++;this.abort.abort();this.abort=new AbortController();this.queue=[];this.running=false;this.paused=false;this.inspection=false;
    if(this.vfc){this.vfc.video.cancelVideoFrameCallback?.(this.vfc.id);this.vfc=null;}
    for(const v of this.slots)v.pause();this.active=null;this.current=null;this.state='VILA';this.frame=0;
    if(clearCards){this.cards=[];this.seen.clear();}this.render();this.status();
  }
  clearCards(){this.cards=[];this.render();}
  async inspect(cid){this.stop(false);this.inspection=true;this.current=this.dealer.clips[cid];
    if(!this.current)throw Error('Klippet saknas.');this.active=await this.prepare(0,cid,this.abort.signal);this.framesFor(this.active);this.render();this.status();}
  async seekFrame(n){if(!this.active||!this.current)throw Error('Välj ”Granska klipp” först.');
    this.active.pause();this.paused=true;const frame=Math.max(0,Math.min(this.current.frames-1,Math.round(n)));
    const time=(frame+.05)/24;if(Math.abs(this.active.currentTime-time)>.0001){const done=wait(this.active,'seeked',12000,this.abort.signal);this.active.currentTime=time;await done;}
    this.frame=frame;this.render();this.status();}
  reveal(shoeDraw,card){const found=this.cards.find(c=>c.shoeDraw===shoeDraw&&c.faceDown);if(!found)throw Error('Hålkortet som ska vändas finns inte i spelaren.');Object.assign(found,card,{faceDown:false});this.render();}
  destroy(){document.removeEventListener('visibilitychange',this.visibilityHandler);this.stop();cancelAnimationFrame(this.raf);for(const a of this.assets.values())if(a.el instanceof HTMLVideoElement)a.el.pause();this.assets.clear();this.compositor.dispose();}
}
