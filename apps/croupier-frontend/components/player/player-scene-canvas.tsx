'use client';

import {useEffect, useRef, useState} from 'react';
import {sceneForComposition, type CompositionSettings} from '../../../../web/public/composition-settings.mjs';

export type PlayerSceneSource = {src:string; contentType:string};
export type PlayerSceneCompositing = {mode:'green-screen'; threshold:number; softness:number; despill:number};
type Props = {
  dealer:PlayerSceneSource|null;
  background:PlayerSceneSource|null;
  table:PlayerSceneSource|null;
  settings:CompositionSettings|null;
  compositing?:PlayerSceneCompositing;
  label:string;
  still?:boolean;
  controls?:boolean;
  onReady?:()=>void;
  onFailure?:()=>void;
};
type Role = 'dealer'|'background'|'table';
type MediaElement = HTMLVideoElement|HTMLImageElement;
type Asset = {id:Role; el:MediaElement; width:number; height:number; kind:'video'|'image'};
type Renderer = {render:(scene:unknown, actor:HTMLCanvasElement, assets:Map<string,Asset>, cards:unknown[], metadata:undefined)=>void; dispose:()=>void};
type CanvasActor = HTMLCanvasElement & {src?:string};
const failureMessage = 'Förhandsvisningen kunde inte visas. Du kan fortfarande välja dealer och öppna spelet.';

export function PlayerSceneCanvas(props:Props) {
  // A replacement canvas removes the previous dealer synchronously, before decoding
  // the next selection. Source URLs belong to the published preview projection.
  const sourceKey = JSON.stringify([props.dealer, props.background, props.table, props.settings, props.compositing, props.still ?? false]);
  return <Scene key={sourceKey} {...props}/>;
}

function Scene({dealer, background, table, settings, compositing, label, still=false, controls=true, onReady, onFailure}:Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const toggleMotion = useRef<()=>void>(()=>{});
  const callbacks = useRef({onReady,onFailure});
  callbacks.current = {onReady,onFailure};
  const [status,setStatus] = useState<'loading'|'ready'|'error'>('loading');
  const [playing,setPlaying] = useState(false);
  const hasVideo = [dealer, ...(settings ? [background,table] : [])].some(source=>source?.contentType.startsWith('video/'));

  useEffect(()=>{
    const currentCanvas = canvas.current;
    if (!currentCanvas || !dealer) return;
    const stage:HTMLCanvasElement = currentCanvas;
    const abort = new AbortController();
    const assets = new Map<string,Asset>();
    const elements:MediaElement[] = [];
    const videos:HTMLVideoElement[] = [];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let active = true, loaded = false, failed = false, frame = 0;
    let inView = typeof IntersectionObserver === 'undefined';
    let requestedPlay = !still && !motion.matches, playingNow = false, starting = false, playGeneration = 0;
    let renderer:Renderer|null = null, actor:CanvasActor|null = null, actorContext:CanvasRenderingContext2D|null = null;
    let outputContext:CanvasRenderingContext2D|null = null, actorVersion = '';
    let scene:Record<string,unknown>|null = null;

    const canPlay = ()=>!still && active && loaded && !failed && requestedPlay && inView && !document.hidden;
    function pause() {
      playGeneration++;
      starting = false;
      playingNow = false;
      videos.forEach(video=>video.pause());
      cancelAnimationFrame(frame);
      frame = 0;
      if (active) setPlaying(false);
    }
    function fail() {
      if (!active || failed) return;
      failed = true;
      pause();
      abort.abort();
      setStatus('error');
      callbacks.current.onFailure?.();
    }
    function contain(context:CanvasRenderingContext2D, asset:Asset, width:number, height:number) {
      const scale = Math.min(width/asset.width,height/asset.height);
      const w = asset.width*scale, h = asset.height*scale;
      context.clearRect(0,0,width,height);
      context.drawImage(asset.el,(width-w)/2,(height-h)/2,w,h);
    }
    function render() {
      if (!active || !loaded || failed) return;
      const selected = assets.get('dealer');
      if (!selected) return;
      try {
        if (renderer && actor && actorContext && scene) {
          const version = selected.el instanceof HTMLVideoElement ? `${selected.el.currentSrc}@${selected.el.currentTime}` : dealer!.src;
          if (actorVersion !== version) {
            contain(actorContext,selected,1080,1920);
            actor.src = version;
            actorVersion = version;
          }
          renderer.render(scene,actor,assets,[],undefined);
        } else if (outputContext) contain(outputContext,selected,720,1280);
      } catch { fail(); }
    }
    function tick() {
      frame = 0;
      if (!canPlay() || !playingNow) return;
      render();
      if (canPlay() && playingNow) frame = requestAnimationFrame(tick);
    }
    function syncPlayback() {
      if (!canPlay() || videos.length === 0) { pause(); return; }
      if (playingNow || starting) return;
      const generation = ++playGeneration;
      starting = true;
      void Promise.all(videos.map(video=>video.play())).then(()=>{
        if (!active || generation !== playGeneration || !canPlay()) {
          // A pending play promise may complete after visibility or source changes.
          if (!canPlay()) videos.forEach(video=>video.pause());
          return;
        }
        starting = false;
        playingNow = true;
        setPlaying(true);
        if (!frame) frame = requestAnimationFrame(tick);
      }).catch(()=>{
        if (!active || generation !== playGeneration) return;
        // A browser may block autoplay. Keep the decoded first frame and offer Play.
        requestedPlay = false;
        pause();
      });
    }
    toggleMotion.current = ()=>{
      requestedPlay = !playingNow && !starting;
      syncPlayback();
    };
    const visibility = ()=>syncPlayback();
    const reduceMotion = ()=>{
      if (motion.matches) requestedPlay = false;
      syncPlayback();
    };
    document.addEventListener('visibilitychange',visibility);
    motion.addEventListener('change',reduceMotion);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries=>{
      inView = entries.some(entry=>entry.isIntersecting);
      syncPlayback();
    });
    observer?.observe(stage);
    stage.addEventListener('webglcontextlost',fail,{signal:abort.signal});

    async function load(role:Role, source:PlayerSceneSource|null) {
      if (!source) return;
      const isVideo = source.contentType.startsWith('video/');
      const element = isVideo ? document.createElement('video') : new Image();
      elements.push(element);
      if (element instanceof HTMLVideoElement) {
        element.muted = true;
        element.defaultMuted = true;
        element.playsInline = true;
        element.preload = 'auto';
        element.loop = true;
        videos.push(element);
      }
      await new Promise<void>((resolve,reject)=>{
        const event = isVideo ? 'loadeddata' : 'load';
        const finish = (ok:boolean)=>{
          clearTimeout(timer);
          element.removeEventListener(event,success);
          element.removeEventListener('error',error);
          abort.signal.removeEventListener('abort',cancel);
          ok ? resolve() : reject(new Error('Preview unavailable'));
        };
        const success = ()=>finish(true), error = ()=>finish(false), cancel = ()=>finish(false);
        const timer = setTimeout(error,20000);
        element.addEventListener(event,success,{once:true});
        element.addEventListener('error',error,{once:true});
        abort.signal.addEventListener('abort',cancel,{once:true});
        element.src = source.src;
        if (element instanceof HTMLVideoElement) element.load();
      });
      if (!active || failed) return;
      const width = element instanceof HTMLVideoElement ? element.videoWidth : element.naturalWidth;
      const height = element instanceof HTMLVideoElement ? element.videoHeight : element.naturalHeight;
      if (!width || !height) throw new Error('Preview unavailable');
      assets.set(role,{id:role,el:element,width,height,kind:isVideo?'video':'image'});
      element.addEventListener('error',fail,{signal:abort.signal});
    }
    async function init() {
      if (settings) {
        scene = sceneForComposition(settings,'mobile',{
          dealer:true, background:Boolean(background), table:Boolean(table), cards:false,
        },compositing ? {...compositing,mode:'composite',enabled:true} : undefined);
        const moduleUrl = '/composition-runtime/compositor.js';
        const [runtime] = await Promise.all([
          import(/* webpackIgnore: true */ moduleUrl),
          load('dealer',dealer),load('background',background),load('table',table),
        ]);
        if (!active || failed) return;
        actor = document.createElement('canvas') as CanvasActor;
        actor.width = 1080;
        actor.height = 1920;
        actorContext = actor.getContext('2d');
        if (!actorContext) throw new Error('Preview unavailable');
        // The shared renderer can fall back to Canvas2D without treating its
        // informational WebGL notice as a broken public preview.
        renderer = new runtime.Compositor(stage,()=>{}) as Renderer;
      } else {
        await load('dealer',dealer);
        if (!active || failed) return;
        outputContext = stage.getContext('2d');
        if (!outputContext) throw new Error('Preview unavailable');
      }
      loaded = true;
      render();
      if (failed) return;
      setStatus('ready');
      callbacks.current.onReady?.();
      syncPlayback();
    }
    void init().catch(fail);
    return ()=>{
      active = false;
      abort.abort();
      pause();
      toggleMotion.current = ()=>{};
      document.removeEventListener('visibilitychange',visibility);
      motion.removeEventListener('change',reduceMotion);
      observer?.disconnect();
      renderer?.dispose();
      // Sources are direct authorized URLs, not owned blob URLs. Resetting each
      // detached element cancels decoding/downloads without revoking caller data.
      for (const element of elements) {
        element.removeAttribute('src');
        if (element instanceof HTMLVideoElement) element.load();
      }
      assets.clear();
    };
    // The keyed parent remounts this whole lifecycle for any media/settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  if (!dealer) return <div role="status" style={{display:'grid',placeItems:'center',aspectRatio:'9 / 16',padding:24,textAlign:'center',color:'#a9adb4'}}>Ingen dealerpreview är publicerad för detta val.</div>;
  return <div style={{position:'relative',width:'100%',aspectRatio:'9 / 16',overflow:'hidden',background:'#07090c'}}>
    <canvas ref={canvas} width={720} height={1280} role="img" aria-label={label}
      style={{display:'block',width:'100%',height:'100%',visibility:status==='ready'?'visible':'hidden'}}/>
    {status !== 'ready' ? <div role="status" aria-live="polite" style={{position:'absolute',inset:0,display:'grid',placeItems:'center',padding:28,textAlign:'center',color:'#c4c7cd',fontSize:14}}>
      {status==='error' ? failureMessage : 'Laddar dealerpreview…'}
    </div> : null}
    {controls && !still && status==='ready' && hasVideo ? <button type="button" onClick={()=>toggleMotion.current()} aria-label={playing?'Pausa dealerpreview':'Spela dealerpreview'}
      style={{position:'absolute',bottom:16,right:16,zIndex:2,border:'1px solid #ffffff45',borderRadius:999,padding:'9px 15px',background:'#080a0de6',color:'#fff',fontSize:13,cursor:'pointer'}}>
      <span aria-hidden="true">{playing?'Ⅱ':'▶'}</span> {playing?'Pausa':'Spela'}
    </button> : null}
  </div>;
}
