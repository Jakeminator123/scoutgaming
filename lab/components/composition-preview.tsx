'use client';
import {useEffect,useRef,useState} from 'react';
import {labUrl} from '../lib/lab-url.mjs';
import {sceneForComposition,type CompositionSettings} from '../../web/public/composition-settings.mjs';

export type CompositionMedia={url:string;label:string;contentType:string};
export type VideoCompositing={mode:'green-screen';threshold:number;softness:number;despill:number};
type Role='dealer'|'background'|'table';
type MediaElement=HTMLVideoElement|HTMLImageElement;
type Asset={id:string;el:MediaElement;width:number;height:number;kind:'video'|'image'};
type Renderer={render:(scene:unknown,actor:HTMLCanvasElement,assets:Map<string,Asset>,cards:unknown[],metadata:undefined)=>void;dispose:()=>void};
type CanvasActor=HTMLCanvasElement&{src?:string};

// Optional silent layer videos share playback controls. Only the dealer owns
// the finite play count, preserving the exact clip chosen by Studio.
export function CompositionPreview({dealer,background,table,settings,layout,show,compositing}:{dealer:CompositionMedia|null;background:CompositionMedia|null;table:CompositionMedia|null;settings:CompositionSettings;layout:'mobile'|'desktop';show:Record<Role,boolean>;compositing?:VideoCompositing}) {
  const canvas=useRef<HTMLCanvasElement>(null),videos=useRef<Partial<Record<Role,HTMLVideoElement>>>({}),renderer=useRef<Renderer|null>(null);
  const scene=useRef<unknown>(null),remaining=useRef(0),ready=useRef(false),generation=useRef(0);
  const [mediaInfo,setMediaInfo]=useState(''),[status,setStatus]=useState('Välj ett dealerklipp.'),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[playing,setPlaying]=useState(false);
  const sourceKey=JSON.stringify([dealer,background,table]);
  useEffect(()=>{scene.current=sceneForComposition(settings,layout,!compositing&&show.dealer?{...show,background:false,table:false}:show,compositing?{...compositing,mode:'composite',enabled:true}:undefined);},[settings,layout,show,compositing]);

  useEffect(()=>{
    const stage=canvas.current;if(!stage)return;stage.width=1080;stage.height=1920;
    generation.current++;let active=true,frame=0,actorTime=-1,lastInfo=0;
    const abort=new AbortController(),elements:MediaElement[]=[],assets=new Map<string,Asset>();
    const actor=document.createElement('canvas') as CanvasActor;actor.width=1080;actor.height=1920;
    const context=actor.getContext('2d');
    ready.current=false;setMediaInfo('');setLoaded(false);setPlaying(false);setError('');setStatus(dealer?'Laddar kanaler…':'Välj ett dealerklipp.');remaining.current=0;
    const pause=()=>{Object.values(videos.current).forEach(video=>video.pause());if(active)setPlaying(false);};
    function decode(element:MediaElement,event:string) {
      return new Promise<void>((resolve,reject)=>{
        const finish=(cause?:Error)=>{clearTimeout(timer);element.removeEventListener(event,success);element.removeEventListener('error',failure);abort.signal.removeEventListener('abort',cancel);cause?reject(cause):resolve();};
        const success=()=>finish(),failure=()=>finish(new Error('En vald mediefil kunde inte läsas. Välj filen igen eller kontrollera biblioteket.')),cancel=()=>finish(new Error('Avbruten laddning.'));
        const timer=setTimeout(()=>finish(new Error('Mediefilen tog för lång tid att ladda.')),20000);
        element.addEventListener(event,success,{once:true});element.addEventListener('error',failure,{once:true});abort.signal.addEventListener('abort',cancel,{once:true});
      });
    }
    async function load(role:Role,media:CompositionMedia|null) {
      if(!media)return;
      const video=media.contentType.startsWith('video/'),element=video?document.createElement('video'):new Image();elements.push(element);
      if(element instanceof HTMLVideoElement){element.playsInline=true;element.preload='auto';element.muted=role!=='dealer';element.loop=role!=='dealer';videos.current[role]=element;}
      const promise=decode(element,video?'loadeddata':'load');element.src=media.url;if(element instanceof HTMLVideoElement)element.load();await promise;
      if(!active)return;
      const width=element instanceof HTMLVideoElement?element.videoWidth:element.naturalWidth,height=element instanceof HTMLVideoElement?element.videoHeight:element.naturalHeight;
      if(!width||!height)throw new Error('Mediefilen saknar en läsbar bildruta.');
      assets.set(role,{id:role,el:element,width,height,kind:video?'video':'image'});
      element.addEventListener('error',()=>{pause();if(active)setError(`Uppspelningen av ${media.label} avbröts.`);},{signal:abort.signal});
      if(role==='dealer'&&element instanceof HTMLVideoElement)element.addEventListener('ended',()=>{
        if(remaining.current>1){remaining.current--;element.currentTime=0;void element.play().catch(()=>{pause();if(active)setError('Dealerklippet kunde inte starta igen.');});}
        else {remaining.current=0;pause();if(active)setStatus('Uppspelningen är klar.');}
      },{signal:abort.signal});
    }
    const visibility=()=>{if(document.hidden){remaining.current=0;pause();}};document.addEventListener('visibilitychange',visibility);
    async function init(){
      if(!dealer)return;
      const moduleUrl=labUrl('/preview/compositor.js');
      const [{Compositor}]=await Promise.all([import(/* webpackIgnore: true */ moduleUrl),load('dealer',dealer),load('background',background),load('table',table)]);
      if(!active)return;
      renderer.current=new Compositor(stage,(message:string)=>{if(active)setError(message);}) as Renderer;
      ready.current=true;setLoaded(true);setStatus('Kanalerna är redo.');
      function render(time:number){
        if(!active)return;
        try{
          const video=videos.current.dealer;
          if(video&&context&&video.readyState>=2&&video.currentTime!==actorTime){actorTime=video.currentTime;context.clearRect(0,0,1080,1920);const fit=Math.min(1080/video.videoWidth,1920/video.videoHeight),width=video.videoWidth*fit,height=video.videoHeight*fit;context.drawImage(video,(1080-width)/2,(1920-height)/2,width,height);actor.src=`${video.currentSrc}@${actorTime}`;}
          if(scene.current)renderer.current?.render(scene.current,actor,assets,[],undefined);
          if(time-lastInfo>400){lastInfo=time;setMediaInfo([...assets.entries()].map(([role,asset])=>{const title=role==='dealer'?'Dealer':role==='table'?'Bord':'Bakgrund';return asset.el instanceof HTMLVideoElement?title+': '+(asset.el.paused?'pausad':'spelar')+' · '+asset.el.currentTime.toFixed(2)+' / '+asset.el.duration.toFixed(2)+' s · '+asset.width+' × '+asset.height:title+': bild · '+asset.width+' × '+asset.height;}).join('\n'));}
        }catch(cause){pause();if(active)setError(cause instanceof Error?cause.message:'Sammansättningen kunde inte visas.');return;}
        frame=requestAnimationFrame(render);
      }
      frame=requestAnimationFrame(render);
    }
    void init().catch(cause=>{if(active){pause();setError(cause instanceof Error?cause.message:'Kanalerna kunde inte laddas.');setStatus('Laddningen avbröts.');}});
    return()=>{active=false;generation.current++;abort.abort();cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);pause();ready.current=false;videos.current={};renderer.current?.dispose();renderer.current=null;for(const element of elements){element.removeAttribute('src');if(element instanceof HTMLVideoElement)element.load();}};
    // Placement edits do not reload the source channels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sourceKey]);

  async function play(count?:number){
    if(!ready.current)return;
    const token=generation.current,channels=Object.values(videos.current);
    if(count){remaining.current=count;channels.forEach(video=>{video.currentTime=0;});}else if(!remaining.current)remaining.current=1;
    try{await Promise.all(channels.map(video=>video.play()));if(token!==generation.current)return;setPlaying(true);setStatus(count===2?'Spelar dealerklippet två gånger med parallella lager.':'Spelar alla videokanaler.');}
    catch{channels.forEach(video=>video.pause());if(token!==generation.current)return;setPlaying(false);setError('Videorna kunde inte starta. Försök igen.');}
  }
  function pause(){Object.values(videos.current).forEach(video=>video.pause());setPlaying(false);setStatus('Alla videokanaler är pausade.');}
  return <div>
    <div style={{background:'#111827',display:'flex',justifyContent:'center',overflow:'hidden',borderRadius:12}}>
      <canvas key={sourceKey} ref={canvas} aria-label={`${layout==='mobile'?'Mobil 9:16':'Desktop 16:9'} · dealer, bord och bakgrund`} style={{display:'block',width:'100%',maxWidth:layout==='mobile'?'min(100%, 39.375vh)':undefined,aspectRatio:layout==='mobile'?'9 / 16':'16 / 9'}}/>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>
      <button className="sg-btn sg-btn-secondary" disabled={!loaded} onClick={()=>playing?pause():void play()}>{playing?'Pausa alla kanaler':'Spela alla kanaler'}</button>
      <button className="sg-btn sg-btn-secondary" disabled={!loaded} onClick={()=>void play(2)}>Spela två gånger</button>
    </div>
    <p role="status">{status}</p>{error?<p role="alert">{error}</p>:null}
    <pre aria-live="off" style={{whiteSpace:'pre-wrap',fontSize:12}}>{mediaInfo}</pre>
    <small>{dealer?.label??'Ingen dealer'} · {background?.label??'Ingen separat bakgrund'} · {table?.label??'Inget separat bord'}</small>
  </div>;
}
