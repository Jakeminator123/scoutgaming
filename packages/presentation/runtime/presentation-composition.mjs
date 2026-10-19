import {defaultCompositionSettings,validateCompositionSettings,sceneForComposition} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {drawDealerFrame,validateDealerFraming} from '../../../packages/presentation/contracts/dealer-framing.mjs';
import {effectiveDealerCompositing} from '../../../packages/presentation/contracts/dealer-compositing.mjs';
import {validateBackgroundPlayback} from '../../../packages/presentation/contracts/background-playback-policy.mjs';
import {createBackgroundPlayback} from '../../../packages/presentation/runtime/background-playback.mjs';
import {projectGamePlane,projectTableGamePlane,BLACKJACK_COMPACT_QUERY} from '../../../packages/presentation/runtime/game-overlay-layout.mjs';
import {compositionAnchorFrames,projectAnchorRects} from './composition-anchors.mjs';
const idPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const fail = () => {throw Error('Invalid layer composition');};
export function validateComposition(value) {
  if (!value || value.schemaVersion!==1 || Object.keys(value).filter(key=>!['settings','backgroundPlayback'].includes(key)).sort().join(',')!=='assets,background,dealer,schemaVersion,table'
    || !Array.isArray(value.assets) || value.assets.length>64) fail();
  if (Object.keys(value.dealer??{}).sort().join(',')!=='compatibility,enabled' || !['full-frame','per-clip'].includes(value.dealer.compatibility) || typeof value.dealer.enabled!=='boolean') fail();
  if(value.settings!==undefined)validateCompositionSettings(value.settings);
  const ids=new Set();
  for(const asset of value.assets) {
    if(Object.keys(asset).sort().join(',')!=='contentType,id,label,role,src' || !idPattern.test(asset.id)||ids.has(asset.id)
      || !['background','table'].includes(asset.role)||typeof asset.label!=='string'||asset.label.length>80
      || !['image/png','image/jpeg','image/webp','video/mp4','video/webm'].includes(asset.contentType)
      || !(new RegExp(`^/api/presentation/layers/[a-z][a-z0-9-]{0,62}/${asset.id}$`).test(asset.src)
        || new RegExp(`^/api/studio-preview/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/layers/${asset.id}$`).test(asset.src)))fail();
    ids.add(asset.id);
  }
  for(const role of ['background','table']) {
    const layer=value[role];
    if(!layer||Object.keys(layer).sort().join(',')!== (role==='background'?'allowed,default,enabled,mode':'allowed,default,enabled')
      ||typeof layer.enabled!=='boolean'||!Array.isArray(layer.allowed)||layer.allowed.length>32||new Set(layer.allowed).size!==layer.allowed.length
      ||layer.allowed.some(id=>!value.assets.some(asset=>asset.id===id&&asset.role===role))
      ||layer.default!==null&&!layer.allowed.includes(layer.default))fail();
    if(role==='background'&&!['baked','image','video'].includes(layer.mode))fail();
  }
  if(value.backgroundPlayback!==undefined){
    const policy=validateBackgroundPlayback(value.backgroundPlayback,{assets:value.assets,allowed:value.background.allowed,defaultAssetId:value.background.default});
    if(policy.rules.length&&!value.background.enabled)fail();
  }
  if(value.settings!==undefined)validateCompositionSettings(value.settings,{tableIds:value.table.allowed,assets:value.assets});
  return structuredClone(value);
}
export function clipCompositing(value) {
  value=effectiveDealerCompositing(value);
  if(value.mode==='alpha')return {enabled:false,mode:'composite'};
  if(!value||Object.keys(value).sort().join(',')!=='despill,mode,softness,threshold'||value.mode!=='green-screen'
    ||!Number.isFinite(value.threshold)||value.threshold<0||value.threshold>1
    ||!Number.isFinite(value.softness)||value.softness<=0||value.softness>1
    ||!Number.isFinite(value.despill)||value.despill<0||value.despill>1)fail();
  return {enabled:true,mode:'composite',threshold:value.threshold,softness:value.softness,despill:value.despill};
}
// Same exact decoded dealer frame and clock as local-film-player. The shared
// Nora compositor only changes pixels; card, speech and clip selection stay owned.
export function createLayerComposition(document, initial, {loadRuntime=()=>import(/* webpackIgnore: true */ '/composition-runtime/compositor.js'),backgroundPlaybackOptions={}}={}) {
  const host=document.querySelector('#scene');if(!host)return null;
  document.documentElement.dataset.presentationStandard='three-layer';
  let current=initial?validateComposition(initial):null,compositor=null,runtime=null,key=null,framing=null,frameNumber=0,preparation=0,raf=null,closed=false;
  const mounts=new Map(),selected=new Map(),pending=new Map();
  let backgroundPlayback=null,backgroundEvent=null,backgroundVisible=!document.hidden;
  const view=document.defaultView??globalThis;
  const compactQuery=view.matchMedia?.(BLACKJACK_COMPACT_QUERY);
  const geometryListeners=new Set();
  let referenceFraming=null,lastGeometry='';
  const hasBoardGeometry=()=>Boolean(current?.settings?.blackjackTables?.length);
  function compositionScene(){
    // Opt-in board layouts use the same breakpoint as the actual server-seat UI.
    // Existing compositions keep their orientation-based scene untouched.
    const layout=hasBoardGeometry()?((compactQuery?.matches??host.clientWidth<=860)?'mobile':'desktop')
      :host.clientWidth<host.clientHeight?'mobile':'desktop';
    // A prepared alpha clip composes layers without chroma key or board anchors.
    const layersVisible=Boolean(key);
    return sceneForComposition(current?.settings??defaultCompositionSettings(),layout,
      {dealer:current?.dealer.enabled??true,background:Boolean(layersVisible&&current?.background.enabled&&mounts.has('background')),
        table:Boolean(layersVisible&&current?.table.enabled&&mounts.has('table'))},key??{});
  }
  function referencePlane() {
    if(!compositor?.geometry)return null;
    const scene=compositionScene();
    const board=current?.settings?.blackjackTables?.find(row=>row.tableId===selected.get('table'));
    const asset=assets().get('table');
    if(board&&scene.show.table&&asset&&compositor.tableGeometry){
      return {...projectTableGamePlane(compositor.geometry(scene).dims,compositor.tableGeometry(scene,asset),
        {width:host.clientWidth,height:host.clientHeight},board,scene.layout),
        ...projectAnchorRects(board[scene.layout],compositionAnchorFrames(current.settings,scene.layout,asset),{width:host.clientWidth,height:host.clientHeight}),tableId:board.tableId,
        sourcePlane:projectGamePlane(compositor.geometry(scene),{width:host.clientWidth,height:host.clientHeight},framing??undefined)};
    }
    const missing=Boolean(current?.settings?.blackjackTables?.length);
    return {...projectGamePlane(compositor.geometry(scene),{width:host.clientWidth,height:host.clientHeight},referenceFraming??undefined),
      ...(missing?{geometryWarning:'Bordet saknar egna kort- och insatsplatser. Justera det i Sammansättning.'}:{}),
      sourceAligned:!missing&&['scale','x','y'].every(name=>(referenceFraming?.[name]??(name==='scale'?1:0))===(framing?.[name]??(name==='scale'?1:0)))};
  }
  const actorFrame=document.createElement('canvas');
  let movingSpeech=null,unpatchedFrame=null;
  function setMovingSpeechLayer(layer) {
    if(layer!==null&&(!layer||typeof layer.paint!=='function'||typeof layer.close!=='function'))throw Error('Invalid moving speech layer');
    if(layer===movingSpeech)return;
    movingSpeech?.close();movingSpeech=null;
    // Cancellation/replanning also removes a mouth from a held dealer frame.
    if(unpatchedFrame){const context=actorFrame.getContext('2d');context.clearRect(0,0,actorFrame.width,actorFrame.height);context.drawImage(unpatchedFrame,0,0);actorFrame.src=`presented-frame-${++frameNumber}`;unpatchedFrame.width=unpatchedFrame.height=0;unpatchedFrame=null;paintHeld();}
    if(closed){layer?.close();return;}movingSpeech=layer;
  }
  function assets() {
    const map=new Map();
    for(const [role,node]of mounts){const width=node.videoWidth||node.naturalWidth,height=node.videoHeight||node.naturalHeight;if(width&&height)map.set(role,{el:node,width,height});}
    if(backgroundEvent?.loaded){const node=backgroundEvent.node;if(node.videoWidth&&node.videoHeight)map.set('background',{el:node,width:node.videoWidth,height:node.videoHeight});}
    return map;
  }
  function paintHeld() {
    if(!compositor||!key||!actorFrame.width||closed)return;
    const scene=compositionScene();
    scene.dealerAspect=16/9;
    compositor.render(scene,actorFrame,assets(),[],null);
    const plane=referencePlane(),signature=JSON.stringify(plane);
    if(signature!==lastGeometry){lastGeometry=signature;for(const listener of geometryListeners)listener();}
  }
  function animate() {paintHeld();if(!closed&&key&&view.requestAnimationFrame)raf=view.requestAnimationFrame(animate);}
  function stopAnimation(){if(raf!==null)view.cancelAnimationFrame?.(raf);raf=null;}
  function stopBackgroundEvent(token) {
    if(backgroundEvent?.token!==token)return;
    const {node,ready,ended,failed}=backgroundEvent;backgroundEvent=null;
    node.removeEventListener?.('loadeddata',ready);node.removeEventListener?.('ended',ended);node.removeEventListener?.('error',failed);
    node.pause?.();compositor?.release?.(node);node.removeAttribute?.('src');node.load?.();node.remove();paintHeld();
  }
  function configureBackgroundPlayback() {
    backgroundPlayback?.close();backgroundPlayback=null;
    if(!current?.backgroundPlayback?.rules.length)return;
    backgroundPlayback=createBackgroundPlayback(current.backgroundPlayback,{...backgroundPlaybackOptions,
      onStart(rule,token){
        const asset=current.assets.find(row=>row.id===rule.assetId&&row.role==='background'&&current.background.allowed.includes(row.id));
        if(!asset||!asset.contentType.startsWith('video/'))throw Error('Background event unavailable');
        const node=document.createElement('video');
        node.className='presentation-plane presentation-background presentation-background-event';node.dataset.layerAsset=asset.id;node.setAttribute('aria-hidden','true');
        node.muted=true;node.loop=false;node.playsInline=true;node.preload='auto';
        node.style.visibility='hidden';
        const owns=()=>backgroundEvent?.token===token&&backgroundEvent.node===node;
        const ended=()=>{if(owns())backgroundPlayback?.finish(token);},failed=()=>{if(owns())backgroundPlayback?.finish(token,'error');};
        const ready=()=>{if(!owns())return;node.removeEventListener('loadeddata',ready);
          Promise.resolve(node.play()).then(()=>{if(owns()){backgroundEvent.loaded=true;node.style.visibility=current.dealer.enabled?'hidden':'';paintHeld();}}).catch(failed);};
        backgroundEvent={token,node,ready,ended,failed,loaded:false};
        // This load is deliberately absent from pending: an event background
        // can never delay prepareClip, dealer speech, dealing or card reveal.
        node.addEventListener('loadeddata',ready,{once:true});node.addEventListener('ended',ended,{once:true});node.addEventListener('error',failed,{once:true});
        node.src=asset.src;host.append(node);node.load?.();if(node.readyState>=2)ready();
      },onStop:stopBackgroundEvent});
    if(backgroundVisible)backgroundPlayback.start();
  }
  function render(role,id) {
    const previous=mounts.get(role);previous?.pause?.();if(previous)compositor?.release?.(previous);previous?.remove();mounts.delete(role);pending.delete(role);
    selected.set(role,id);
    if(!current||!current[role].enabled)return;
    const asset=current.assets.find(row=>row.id===id&&row.role===role);if(!asset)return;
    const node=document.createElement(asset.contentType.startsWith('video/')?'video':'img');
    node.className=`presentation-plane presentation-${role}`;node.dataset.layerAsset=asset.id;node.setAttribute('aria-hidden','true');
    if(node.tagName==='VIDEO'){node.muted=true;node.loop=true;node.playsInline=true;node.preload='auto';node.autoplay=role!=='background'||backgroundVisible;}
    else node.alt='';
    // Independent source planes appear through the mandatory keyed dealer layer.
    if(node.style)node.style.visibility=current.dealer.enabled?'hidden':'';node.src=asset.src;host.append(node);mounts.set(role,node);
    if(node.addEventListener){const event=node.tagName==='VIDEO'?'loadeddata':'load';pending.set(role,new Promise((resolve,reject)=>{
      if(node.tagName==='VIDEO'?node.readyState>=2:node.complete&&node.naturalWidth){resolve();return;}
      const timer=setTimeout(()=>finish(Error('Layer media unavailable')),12000);
      function finish(error){clearTimeout(timer);node.removeEventListener(event,ready);node.removeEventListener('error',bad);error?reject(error):resolve();}
      const ready=()=>finish(),bad=()=>finish(Error('Layer media unavailable'));node.addEventListener(event,ready,{once:true});node.addEventListener('error',bad,{once:true});
    }));void pending.get(role).catch(()=>{});}
  }
  function set(role,id) {if(current&&current[role].allowed.includes(id)){
    if(role==='background')backgroundPlayback?.pause();
    render(role,id);paintHeld();if(role==='background'&&backgroundVisible)backgroundPlayback?.start();
  }}
  function replace(value) {
    setMovingSpeechLayer(null);
    backgroundPlayback?.close();backgroundPlayback=null;
    ++preparation;current=validateComposition(value);key=null;referenceFraming=null;lastGeometry='';stopAnimation();compositor?.canvas?.style.setProperty('visibility','hidden');
    for(const role of ['background','table'])render(role,current[role].default);
    host.dataset.dealerLayerEnabled=String(current.dealer.enabled);host.dataset.presentationClipMode='pending';
    configureBackgroundPlayback();
  }
  async function prepareClip(compositing,sourceFraming,{kind}={}) {
    const revision=++preparation;stopAnimation();key=null;framing=sourceFraming?validateDealerFraming(sourceFraming):null;
    const nextKey=clipCompositing(compositing);
    runtime??=loadRuntime();const {Compositor}=await runtime;
    await Promise.all(pending.values());if(closed||revision!==preparation)return false;
    if(!compositor){const canvas=document.createElement('canvas');canvas.className='presentation-composed-film';host.append(canvas);compositor=new Compositor(canvas);}
    // Talking/variant crops must not make bets and resting cards jump.
    if(referenceFraming===null&&(kind===undefined||kind==='idle'))referenceFraming=framing??{scale:1,x:0,y:0};
    key=nextKey;
    // Publish the selected source framing before the card cursor binds to it.
    // A later resize still invalidates that exact binding.
    const plane=referencePlane(),signature=JSON.stringify(plane);
    if(signature!==lastGeometry){lastGeometry=signature;for(const listener of geometryListeners)listener();}
    return true;
  }
  function renderFrame(video,presented) {
    if(closed)return false;
    if(!key||!compositor){host.dataset.presentationClipMode='unavailable';if(compositor)compositor.canvas.style.visibility='hidden';throw Error('Dealer background removal unavailable');}
    if(!video.videoWidth||!video.videoHeight)throw Error('Dealer frame unavailable');
    const targetWidth=1920,targetHeight=1080;
    if(actorFrame.width!==targetWidth||actorFrame.height!==targetHeight){actorFrame.width=targetWidth;actorFrame.height=targetHeight;}
    const context=actorFrame.getContext('2d');
    // Mouth pixels belong to the source dealer before framing, keying, table
    // occlusion and authoritative cards. No independent foreground overlay.
    const source=movingSpeech?.paint(video,presented)??video;
    if(source!==video){
      unpatchedFrame??=document.createElement('canvas');
      unpatchedFrame.width=targetWidth;unpatchedFrame.height=targetHeight;
      drawDealerFrame(unpatchedFrame.getContext('2d'),video,targetWidth,targetHeight,framing??undefined);
    }else if(unpatchedFrame){unpatchedFrame.width=unpatchedFrame.height=0;unpatchedFrame=null;}
    drawDealerFrame(context,source,targetWidth,targetHeight,framing??undefined);
    actorFrame.src=`presented-frame-${++frameNumber}`;
    paintHeld();compositor.canvas.style.visibility='';host.dataset.presentationClipMode='green-screen';
    if(raf===null&&view.requestAnimationFrame)raf=view.requestAnimationFrame(animate);
    return true;
  }
  if(current)replace(current);
  return {setBackground:id=>set('background',id),setTable:id=>set('table',id),replace,prepareClip,renderFrame,setMovingSpeechLayer,
    referencePlane,onGeometryChange(listener){geometryListeners.add(listener);return()=>geometryListeners.delete(listener);},
    backgroundEvent:(eventId,eventKey)=>backgroundPlayback?.event(eventId,eventKey)??false,
    setBackgroundVisible(visible){backgroundVisible=Boolean(visible);
      if(backgroundVisible)backgroundPlayback?.start();else backgroundPlayback?.pause();
      const base=mounts.get('background');if(base?.tagName==='VIDEO'){base.autoplay=backgroundVisible;
        if(backgroundVisible)Promise.resolve(base.play?.()).catch(()=>{});else base.pause?.();}},
    hold:()=>{if(key)paintHeld();},
    close(){setMovingSpeechLayer(null);geometryListeners.clear();backgroundPlayback?.close();backgroundPlayback=null;closed=true;++preparation;stopAnimation();for(const node of mounts.values()){node.pause?.();node.remove();}mounts.clear();compositor?.dispose();compositor?.canvas.remove();}};
}
