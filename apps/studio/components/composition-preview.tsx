'use client';
import {useEffect,useRef,useState,useMemo} from 'react';
import type {MutableRefObject,ReactNode} from 'react';
import {labUrl} from '../lib/lab-url.mjs';
import {compositionPreviewLayers} from '../lib/studio-composition.mjs';
import {sceneForComposition,type CompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {drawDealerFrame,type DealerFraming} from '../../../packages/presentation/contracts/dealer-framing.mjs';
import {effectiveDealerCompositing} from '../../../packages/presentation/contracts/dealer-compositing.mjs';
import {createBackgroundPlayback} from '../../../packages/presentation/runtime/background-playback.mjs';
import type {BackgroundPlaybackPolicy,LayerPlaybackRole} from '../../../packages/presentation/contracts/background-playback-policy.mjs';

export type CompositionMedia={url:string;label:string;contentType:string};
export type VideoCompositing=import('../../../packages/presentation/contracts/dealer-compositing.mjs').DealerCompositing;
type Role='dealer'|'background'|'table';
type MediaElement=HTMLVideoElement|HTMLImageElement;
type Asset={id:string;el:MediaElement;width:number;height:number;kind:'video'|'image'};
type Renderer={render:(scene:unknown,actor:HTMLCanvasElement,assets:Map<string,Asset>,cards:unknown[],metadata:undefined)=>void;release?:(source:MediaElement)=>void;dispose:()=>void};
type CanvasActor=HTMLCanvasElement&{src?:string};

type ClipMedia=CompositionMedia&{id:string};
type LayerPlayer=ReturnType<typeof createBackgroundPlayback>;
type ClipRefs={player:MutableRefObject<LayerPlayer|null>;base:MutableRefObject<Record<LayerPlaybackRole,Asset|null>>;sceneAssets:MutableRefObject<Map<string,Asset>>;renderer:MutableRefObject<Renderer|null>;playbackActive:MutableRefObject<boolean>};
const clipTexts={
  background:{loading:['Laddar bakgrundsklipp…','Loading background clip…'],playing:['Bakgrundsklipp: ','Background clip: '],base:['Grundbakgrunden visas.','Showing the base background.'],
    start:['Bakgrundsklippet kunde inte starta. Grundbakgrunden visas.','The background clip could not start. Showing the base background.'],read:['Bakgrundsklippet kunde inte läsas. Grundbakgrunden visas.','The background clip could not load. Showing the base background.']},
  table:{loading:['Laddar bordsklipp…','Loading table clip…'],playing:['Bordsklipp: ','Table clip: '],base:['Grundbordet visas.','Showing the base table.'],
    start:['Bordsklippet kunde inte starta. Grundbordet visas.','The table clip could not start. Showing the base table.'],read:['Bordsklippet kunde inte läsas. Grundbordet visas.','The table clip could not load. Showing the base table.']},
} as const;

// Layer clips use a separate media channel per role: changing a rule or trying a
// clip never reloads the dealer, its sound, the other layers or their playback
// clocks. The scheduler swaps the role's scene asset while a clip plays and
// restores the base image or loop afterwards.
function useLayerClips(role:LayerPlaybackRole,{policy,assets,enabled,sourceKey,loaded,language,previewRuleId,previewRequest,refs}:{policy?:BackgroundPlaybackPolicy;assets:ClipMedia[];enabled:boolean;sourceKey:string;loaded:boolean;language:string;previewRuleId?:string;previewRequest:number;refs:ClipRefs}){
  const t=(pair:readonly [string,string])=>language==='en'?pair[1]:pair[0],texts=clipTexts[role];
  const [status,setStatus]=useState('');
  const consumedPreview=useRef('');
  const key=JSON.stringify({policy,assets,enabled});
  useEffect(()=>{
    if(!loaded||!enabled||!policy?.rules.length)return;
    let active=true,current:{token:number;video:HTMLVideoElement}|null=null;
    const restore=()=>{const base=refs.base.current[role];if(base)refs.sceneAssets.current.set(role,base);else refs.sceneAssets.current.delete(role);};
    const player=createBackgroundPlayback(policy,{
      role,
      onStart(rule,token){
        const media=assets.find(asset=>asset.id===rule.assetId);
        if(!media){queueMicrotask(()=>player.finish(token));return;}
        const video=document.createElement('video');video.muted=true;video.playsInline=true;video.loop=false;video.preload='auto';
        current={token,video};setStatus(t(texts.loading));
        const owns=()=>active&&current?.token===token&&current.video===video;
        video.addEventListener('loadeddata',()=>{
          if(!owns())return;
          if(!video.videoWidth||!video.videoHeight){player.finish(token);return;}
          void video.play().then(()=>{
            if(!owns()){video.pause();return;}
            refs.sceneAssets.current.set(role,{id:media.id,el:video,width:video.videoWidth,height:video.videoHeight,kind:'video'});
            setStatus(t(texts.playing)+media.label);
          }).catch(()=>{if(owns()){player.finish(token);setStatus(t(texts.start));}});
        },{once:true});
        video.addEventListener('ended',()=>{if(owns())player.finish(token);},{once:true});
        video.addEventListener('error',()=>{if(owns()){player.finish(token);setStatus(t(texts.read));}},{once:true});
        video.src=media.url;video.load();
      },
      onStop(token){
        if(current?.token!==token)return;
        const video=current.video;current=null;refs.renderer.current?.release?.(video);video.pause();video.removeAttribute('src');video.load();restore();
        if(active)setStatus(t(texts.base));
      },
    });
    refs.player.current=player;if(refs.playbackActive.current)player.start();
    return()=>{active=false;player.close();restore();if(refs.player.current===player)refs.player.current=null;};
  // Serialized settings prevent unrelated placement edits from resetting budgets.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key,sourceKey,loaded,language]);
  useEffect(()=>{
    const request=JSON.stringify([previewRequest,previewRuleId]);
    if(!previewRequest||!previewRuleId||consumedPreview.current===request)return;
    // A material switch and preview request can arrive in the same render.
    // Wait for that material's player, then consume the request exactly once.
    if(!loaded||!refs.player.current)return;
    consumedPreview.current=request;
    const started=refs.player.current.preview(previewRuleId);
    if(!started)setStatus(t(['Provet väntar: kontrollera laddning, paus och minutgränser.','Preview waiting: check loading, cooldown and minute limits.']));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[previewRequest,previewRuleId,loaded,key,sourceKey,language]);
  return status;
}

// Optional silent layer videos share playback controls. Only the dealer owns
// the finite play count, preserving the exact clip chosen by Studio.
export function CompositionPreview({dealer,background,table,settings,layout,show,compositing,framing,language='sv',backgroundPlayback,backgroundAssets=[],previewBackgroundRuleId,previewBackgroundRequest=0,tablePlayback,tableAssets=[],previewTableRuleId,previewTableRequest=0,overlay}:{dealer:CompositionMedia|null;background:CompositionMedia|null;table:CompositionMedia|null;settings:CompositionSettings;layout:'mobile'|'desktop';show:Record<Role,boolean>;compositing?:VideoCompositing;framing?:DealerFraming;language?:string;backgroundPlayback?:BackgroundPlaybackPolicy;backgroundAssets?:ClipMedia[];previewBackgroundRuleId?:string;previewBackgroundRequest?:number;tablePlayback?:BackgroundPlaybackPolicy;tableAssets?:ClipMedia[];previewTableRuleId?:string;previewTableRequest?:number;overlay?:ReactNode}) {
  const t=(sv:string,en:string)=>language==='en'?en:sv;
  const canvas=useRef<HTMLCanvasElement>(null),videos=useRef<Partial<Record<Role,HTMLVideoElement>>>({}),renderer=useRef<Renderer|null>(null);
  const scene=useRef<unknown>(null),remaining=useRef(0),ready=useRef(false),generation=useRef(0),playAttempt=useRef(0);
  const backgroundPlayer=useRef<LayerPlayer|null>(null),tablePlayer=useRef<LayerPlayer|null>(null),sceneAssets=useRef(new Map<string,Asset>()),baseAssets=useRef<Record<LayerPlaybackRole,Asset|null>>({background:null,table:null}),playbackActive=useRef(false);
  const [mediaInfo,setMediaInfo]=useState(''),[status,setStatus]=useState(t('Välj ett klipp eller ett lager.','Choose a clip or layer.')),[error,setError]=useState(''),[loadedKey,setLoadedKey]=useState(''),[playing,setPlaying]=useState(false);
  const keyed=useMemo(()=>effectiveDealerCompositing(compositing),[compositing]);
  const visible=compositionPreviewLayers(show,keyed,Boolean(dealer));
  const sources={dealer:visible.dealer?dealer:null,background:visible.background?background:null,table:visible.table?table:null};
  const sourceKey=JSON.stringify(sources);
  const loadKey=JSON.stringify([sourceKey,language]),loaded=loadedKey===loadKey;
  const frameSettings=useRef(framing);frameSettings.current=framing;
  useEffect(()=>{scene.current={...sceneForComposition(settings,layout,visible,{...keyed,mode:'composite',enabled:keyed.mode!=='alpha'}),dealerAspect:16/9};},[settings,layout,show,keyed,framing]);

  useEffect(()=>{
    const stage=canvas.current;if(!stage)return;stage.width=1080;stage.height=1920;
    generation.current++;let active=true,frame=0,actorTime=-1,lastFraming:DealerFraming|undefined,lastInfo=0;
    const abort=new AbortController(),elements:MediaElement[]=[],assets=new Map<string,Asset>();
    sceneAssets.current=assets;baseAssets.current={background:null,table:null};playbackActive.current=false;
    const actor=document.createElement('canvas') as CanvasActor;actor.width=1080;actor.height=1920;
    const context=actor.getContext('2d');
    ready.current=false;setMediaInfo('');setLoadedKey('');setPlaying(false);setError('');setStatus(Object.values(sources).some(Boolean)?t('Laddar…','Loading…'):t('Välj ett klipp eller ett lager.','Choose a clip or layer.'));remaining.current=0;
    const pause=()=>{playAttempt.current++;playbackActive.current=false;backgroundPlayer.current?.pause();tablePlayer.current?.pause();Object.values(videos.current).forEach(video=>video.pause());if(active)setPlaying(false);};
    function decode(element:MediaElement,event:string) {
      return new Promise<void>((resolve,reject)=>{
        const finish=(cause?:Error)=>{clearTimeout(timer);element.removeEventListener(event,success);element.removeEventListener('error',failure);abort.signal.removeEventListener('abort',cancel);cause?reject(cause):resolve();};
        const success=()=>finish(),failure=()=>finish(new Error(t('En vald mediefil kunde inte läsas. Välj filen igen eller kontrollera biblioteket.','A selected media file could not be read. Select it again or check the library.'))),cancel=()=>finish(new Error(t('Avbruten laddning.','Loading cancelled.')));
        const timer=setTimeout(()=>finish(new Error(t('Mediefilen tog för lång tid att ladda.','The media file took too long to load.'))),20000);
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
      if(!width||!height)throw new Error(t('Mediefilen saknar en läsbar bildruta.','The media file has no readable frame.'));
      assets.set(role,{id:role,el:element,width,height,kind:video?'video':'image'});
      if(role!=='dealer')baseAssets.current[role]=assets.get(role)??null;
      element.addEventListener('error',()=>{pause();if(active)setError(t('Uppspelningen av '+media.label+' avbröts.','Playback of '+media.label+' stopped.'));},{signal:abort.signal});
      if(role==='dealer'&&element instanceof HTMLVideoElement)element.addEventListener('ended',()=>{
        if(remaining.current>1){remaining.current--;element.currentTime=0;void element.play().catch(()=>{pause();if(active)setError(t('Dealerklippet kunde inte starta igen.','The dealer clip could not restart.'));});}
        else {remaining.current=0;pause();if(active)setStatus(t('Uppspelningen är klar.','Playback finished.'));}
      },{signal:abort.signal});
    }
    const visibility=()=>{if(document.hidden){remaining.current=0;pause();}};document.addEventListener('visibilitychange',visibility);
    async function init(){
      if(!Object.values(sources).some(Boolean))return;
      const moduleUrl=labUrl('/preview/compositor.js');
      const [{Compositor}]=await Promise.all([import(/* webpackIgnore: true */ moduleUrl),load('dealer',sources.dealer),load('background',sources.background),load('table',sources.table)]);
      if(!active)return;
      renderer.current=new Compositor(stage,(message:string)=>{if(active)setError(message);}) as Renderer;
      ready.current=true;setLoadedKey(loadKey);setStatus(t('Redo.','Ready.'));
      function render(time:number){
        if(!active)return;
        try{
          const media=assets.get('dealer')?.el;
          const mediaTime=media instanceof HTMLVideoElement?media.currentTime:0;
          if(media&&context&&(!(media instanceof HTMLVideoElement)||media.readyState>=2)&&(mediaTime!==actorTime||lastFraming!==frameSettings.current)){
            actorTime=mediaTime;lastFraming=frameSettings.current;
            // Legacy and local files need the same height fit as classified clips.
            const width=1920,height=1080;if(actor.width!==width||actor.height!==height){actor.width=width;actor.height=height;}
            drawDealerFrame(context,media,width,height,lastFraming);
            actor.src=`${media.src}@${actorTime}/${JSON.stringify(lastFraming)}`;
          }
          if(scene.current)renderer.current?.render(scene.current,actor,assets,[],undefined);
          if(time-lastInfo>400){lastInfo=time;setMediaInfo([...assets.entries()].map(([role,asset])=>{const title=role==='dealer'?'Dealer':role==='table'?t('Bord','Table'):t('Bakgrund','Background');return asset.el instanceof HTMLVideoElement?title+': '+(asset.el.paused?t('pausad','paused'):t('spelar','playing'))+' · '+asset.el.currentTime.toFixed(2)+' / '+asset.el.duration.toFixed(2)+' s · '+asset.width+' × '+asset.height:title+t(': bild · ',': image · ')+asset.width+' × '+asset.height;}).join('\n'));}
        }catch(cause){pause();if(active)setError(cause instanceof Error?cause.message:t('Sammansättningen kunde inte visas.','The composition could not be displayed.'));return;}
        frame=requestAnimationFrame(render);
      }
      frame=requestAnimationFrame(render);
    }
    void init().catch(cause=>{if(active){pause();setError(cause instanceof Error?cause.message:t('Kanalerna kunde inte laddas.','The layers could not be loaded.'));setStatus(t('Laddningen avbröts.','Loading stopped.'));}});
    return()=>{active=false;generation.current++;abort.abort();cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);pause();ready.current=false;videos.current={};renderer.current?.dispose();renderer.current=null;for(const element of elements){element.removeAttribute('src');if(element instanceof HTMLVideoElement)element.load();}};
    // Placement edits do not reload the source channels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sourceKey,language]);

  const backgroundStatus=useLayerClips('background',{policy:backgroundPlayback,assets:backgroundAssets,enabled:visible.background,sourceKey,loaded,language,previewRuleId:previewBackgroundRuleId,previewRequest:previewBackgroundRequest,refs:{player:backgroundPlayer,base:baseAssets,sceneAssets,renderer,playbackActive}});
  const tableStatus=useLayerClips('table',{policy:tablePlayback,assets:tableAssets,enabled:visible.table,sourceKey,loaded,language,previewRuleId:previewTableRuleId,previewRequest:previewTableRequest,refs:{player:tablePlayer,base:baseAssets,sceneAssets,renderer,playbackActive}});

  async function play(count?:number){
    if(!ready.current)return;
    const token=generation.current,attempt=++playAttempt.current,channels=Object.values(videos.current);setError('');
    if(count){remaining.current=count;channels.forEach(video=>{video.currentTime=0;});}else if(!remaining.current)remaining.current=1;
    try{await Promise.all(channels.map(video=>video.play()));if(token!==generation.current||attempt!==playAttempt.current||document.hidden){if(attempt===playAttempt.current||!playbackActive.current)channels.forEach(video=>video.pause());return;}playbackActive.current=true;backgroundPlayer.current?.start();tablePlayer.current?.start();setPlaying(true);setStatus(count===2?t('Spelar två gånger.','Playing twice.'):t('Spelar.','Playing.'));}
    catch{if(token!==generation.current||attempt!==playAttempt.current)return;channels.forEach(video=>video.pause());setPlaying(false);setError(t('Videorna kunde inte starta. Försök igen.','The videos could not start. Try again.'));}
  }
  function pause(){playAttempt.current++;playbackActive.current=false;backgroundPlayer.current?.pause();tablePlayer.current?.pause();Object.values(videos.current).forEach(video=>video.pause());setPlaying(false);setStatus(t('Pausad.','Paused.'));}
  return <div style={{containerType:'inline-size'}}>
    <div style={{background:'#111827',display:'flex',justifyContent:'center',overflow:'hidden',borderRadius:12}}>
      <div style={{position:'relative',height:'min(540px, 60vh, 56.25cqw)',width:layout==='mobile'?'calc(min(540px, 60vh, 56.25cqw) * 9 / 16)':'calc(min(540px, 60vh, 56.25cqw) * 16 / 9)',maxWidth:'100%'}}>
        <canvas key={sourceKey} ref={canvas} aria-label={(layout==='mobile'?t('Mobil 9:16','Mobile 9:16'):'Desktop 16:9')+t(' · dealer, bord och bakgrund',' · dealer, table and background')} style={{display:'block',height:'100%',width:'100%'}}/>
        {overlay}
      </div>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>
      <button className="sg-btn sg-btn-secondary" disabled={!loaded||!Object.values(sources).some(media=>media?.contentType.startsWith('video/'))} onClick={()=>playing?pause():void play()}>{playing?t('Pausa','Pause'):t('Spela','Play')}</button>

    </div>
    <p role="status">{status}</p>{error?<p role="alert">{error}</p>:null}
    {backgroundStatus?<p role="status">{backgroundStatus}</p>:null}
    {tableStatus?<p role="status">{tableStatus}</p>:null}
    <details><summary>{t('Avancerat · uppspelning','Advanced · playback')}</summary><button className="sg-btn sg-btn-secondary" disabled={!loaded||!sources.dealer?.contentType.startsWith('video/')} onClick={()=>void play(2)}>{t('Spela två gånger','Play twice')}</button><pre aria-live="off" style={{whiteSpace:'pre-wrap',fontSize:12}}>{mediaInfo}</pre></details>
    <small>{Object.values(sources).filter(Boolean).map(media=>media!.label).join(' · ')}</small>
  </div>;
}
