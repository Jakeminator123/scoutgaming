import {defaultCompositionSettings,validateCompositionSettings,sceneForComposition} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {drawDealerFrame,validateDealerFraming} from '../../../packages/presentation/contracts/dealer-framing.mjs';
import {effectiveDealerCompositing} from '../../../packages/presentation/contracts/dealer-compositing.mjs';
import {validateLayerPlayback} from '../../../packages/presentation/contracts/background-playback-policy.mjs';
import {createBackgroundPlayback} from '../../../packages/presentation/runtime/background-playback.mjs';
import {projectGamePlane,projectTableGamePlane,BLACKJACK_COMPACT_QUERY} from '../../../packages/presentation/runtime/game-overlay-layout.mjs';
import {compositionAnchorFrames,projectAnchorRects} from './composition-anchors.mjs';
const idPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
// K04 (rerun 4 and the production measure, 28 Oct 2026): a film waits at most LAYER_WAIT_MS for its background and
// table (layersSettled); the layers still loading then stop holding films and show whenever they arrive. Without a
// waiting film, a layer that has not loaded within LAYER_DEADLINE_MS of its request stops holding the films that
// start later. A failed layer is requested again after each LAYER_RETRY_MS. No layer ever fails a film.
// DEFERRED_LAYER_MS: a background film deferred for the dealer's first frame loads anyway after this long.
const LAYER_WAIT_MS = 3000, LAYER_DEADLINE_MS = 12000, LAYER_RETRY_MS = [2000, 6000], DEFERRED_LAYER_MS = 20000;
// The shared table's link rule (K04 F7): only a known fast link is fast; unknown, 2g/3g or saveData is slow.
const FAST_LINK_MBPS = 5;
const fastLink = link => Boolean(link) && !link.saveData && Number.isFinite(link.downlink) && link.downlink >= FAST_LINK_MBPS
  && !['slow-2g', '2g', '3g'].includes(link.effectiveType);
const fail = () => {throw Error('Invalid layer composition');};
function roomLayerSource(src,id){
  const match=new RegExp(`^/api/presentation/room-layers/[a-z][a-z0-9-]{0,62}/[a-z0-9_-]{1,128}/([1-9][0-9]{0,15})/${id}$`).exec(src);
  return Boolean(match&&Number.isSafeInteger(Number(match[1])));
}
export function validateComposition(value) {
  if (!value || value.schemaVersion!==1 || Object.keys(value).filter(key=>!['settings','backgroundPlayback','tablePlayback'].includes(key)).sort().join(',')!=='assets,background,dealer,schemaVersion,table'
    || !Array.isArray(value.assets) || value.assets.length>64) fail();
  if (Object.keys(value.dealer??{}).sort().join(',')!=='compatibility,enabled' || !['full-frame','per-clip'].includes(value.dealer.compatibility) || typeof value.dealer.enabled!=='boolean') fail();
  if(value.settings!==undefined)validateCompositionSettings(value.settings);
  const ids=new Set();
  for(const asset of value.assets) {
    if(Object.keys(asset).sort().join(',')!=='contentType,id,label,role,src' || !idPattern.test(asset.id)||ids.has(asset.id)
      || !['background','table'].includes(asset.role)||typeof asset.label!=='string'||asset.label.length>80
      || !['image/png','image/jpeg','image/webp','video/mp4','video/webm'].includes(asset.contentType)
      || !(new RegExp(`^/api/presentation/layers/[a-z][a-z0-9-]{0,62}/${asset.id}$`).test(asset.src)
        || roomLayerSource(asset.src,asset.id)
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
  // Silent living clips per layer: rules only reference granted videos of the
  // same role and need the layer enabled with a base to return to.
  for(const role of ['background','table']){
    const playback=value[`${role}Playback`];if(playback===undefined)continue;
    const policy=validateLayerPlayback(playback,{role,assets:value.assets,allowed:value[role].allowed,defaultAssetId:value[role].default});
    if(policy.rules.length&&!value[role].enabled)fail();
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
export function createLayerComposition(document, initial, {loadRuntime=()=>import(/* webpackIgnore: true */ '/composition-runtime/compositor.js'),backgroundPlaybackOptions={},
  connection=globalThis.navigator?.connection??null}={}) {
  const host=document.querySelector('#scene');if(!host)return null;
  document.documentElement.dataset.presentationStandard='three-layer';
  let current=initial?validateComposition(initial):null,compositor=null,runtime=null,key=null,framing=null,frameNumber=0,preparation=0,raf=null,closed=false;
  const mounts=new Map(),selected=new Map(),pending=new Map(),cancelLoads=new Map();
  // deferred: a background film that waits for the dealer's first frame on a slow link (dealerShown).
  const deferred=new Map();let dealerShown=false,deferredTimer;
  // The dealer's first frame, a dealer reported unavailable or DEFERRED_LAYER_MS without either releases them.
  function releaseDeferred(){clearTimeout(deferredTimer);deferredTimer=undefined;for(const resume of [...deferred.values()])resume();deferred.clear();}
  // One silent scheduler and at most one running event clip per layer role.
  const PLAYBACK_ROLES=['background','table'],players=new Map(),events=new Map();let backgroundVisible=!document.hidden;
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
    // Geometry belongs to the mounted base table. A living table clip only
    // changes pixels; its own size never moves seats, bets or dealer cards.
    // An autoScale layout follows the dealer plane of the reference (idle)
    // clip instead, so talking/variant crops never move resting cards either.
    const asset=mountedAsset('table');
    if(board&&scene.show.table&&asset&&compositor.tableGeometry){
      return {...projectTableGamePlane(compositor.geometry(scene).dims,compositor.tableGeometry(scene,asset),
        {width:host.clientWidth,height:host.clientHeight},board,scene.layout),
        ...projectAnchorRects(board[scene.layout],compositionAnchorFrames(current.settings,scene.layout,asset),{width:host.clientWidth,height:host.clientHeight},referenceFraming??undefined),tableId:board.tableId,
        sourcePlane:projectGamePlane(compositor.geometry(scene),{width:host.clientWidth,height:host.clientHeight},framing??undefined)};
    }
    const missing=Boolean(current?.settings?.blackjackTables?.length);
    return {...projectGamePlane(compositor.geometry(scene),{width:host.clientWidth,height:host.clientHeight},referenceFraming??undefined),
      ...(missing?{geometryWarning:'Bordet saknar egna kort- och insatsplatser. Justera det i Miljö.'}:{}),
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
  function mountedAsset(role) {
    const node=mounts.get(role);if(!node)return null;
    const width=node.videoWidth||node.naturalWidth,height=node.videoHeight||node.naturalHeight;
    return width&&height?{el:node,width,height}:null;
  }
  function assets() {
    const map=new Map();
    for(const role of mounts.keys()){const asset=mountedAsset(role);if(asset)map.set(role,asset);}
    for(const [role,event]of events)if(event.loaded){const node=event.node;if(node.videoWidth&&node.videoHeight)map.set(role,{el:node,width:node.videoWidth,height:node.videoHeight});}
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
  function stopLayerEvent(role,token) {
    const event=events.get(role);if(event?.token!==token)return;
    const {node,ready,ended,failed}=event;events.delete(role);
    node.removeEventListener?.('loadeddata',ready);node.removeEventListener?.('ended',ended);node.removeEventListener?.('error',failed);
    node.pause?.();compositor?.release?.(node);node.removeAttribute?.('src');node.load?.();node.remove();paintHeld();
  }
  function closePlayers(){for(const player of players.values())player.close();players.clear();}
  // Table rules are authored for the default table. Another selected table
  // (player choice or room override) keeps its player paused: no clip over it.
  const playbackAllowed=role=>role!=='table'||selected.get('table')===current?.table.default;
  function configureLayerPlayback(role) {
    players.get(role)?.close();players.delete(role);
    const policy=current?.[`${role}Playback`];if(!policy?.rules.length)return;
    const player=createBackgroundPlayback(policy,{...backgroundPlaybackOptions,role,
      onStart(rule,token){
        const asset=current.assets.find(row=>row.id===rule.assetId&&row.role===role&&current[role].allowed.includes(row.id));
        if(!asset||!asset.contentType.startsWith('video/')||!playbackAllowed(role))throw Error('Layer event unavailable');
        const node=document.createElement('video');
        node.className=`presentation-plane presentation-${role} presentation-${role}-event`;node.dataset.layerAsset=asset.id;node.setAttribute('aria-hidden','true');
        node.muted=true;node.loop=false;node.playsInline=true;node.preload='auto';
        node.style.visibility='hidden';
        const owns=()=>events.get(role)?.token===token&&events.get(role).node===node;
        const ended=()=>{if(owns())players.get(role)?.finish(token);},failed=()=>{if(owns())players.get(role)?.finish(token,'error');};
        const ready=()=>{if(!owns())return;node.removeEventListener('loadeddata',ready);
          Promise.resolve(node.play()).then(()=>{if(owns()){events.get(role).loaded=true;node.style.visibility=current.dealer.enabled?'hidden':'';paintHeld();}}).catch(failed);};
        events.set(role,{token,node,ready,ended,failed,loaded:false});
        // This load is deliberately absent from pending: an event clip can
        // never delay prepareClip, dealer speech, dealing or card reveal.
        node.addEventListener('loadeddata',ready,{once:true});node.addEventListener('ended',ended,{once:true});node.addEventListener('error',failed,{once:true});
        node.src=asset.src;host.append(node);node.load?.();if(node.readyState>=2)ready();
      },onStop:token=>stopLayerEvent(role,token)});
    players.set(role,player);
    if(backgroundVisible&&playbackAllowed(role))player.start();
  }
  function releaseLayer(role){
    cancelLoads.get(role)?.();cancelLoads.delete(role);pending.delete(role);deferred.delete(role);
    const node=mounts.get(role);if(!node)return;
    node.pause?.();compositor?.release?.(node);node.removeAttribute?.('src');if(node.tagName==='VIDEO')node.load?.();node.remove();mounts.delete(role);
  }
  function render(role,id) {
    releaseLayer(role);
    selected.set(role,id);
    if(!current||!current[role].enabled)return;
    const asset=current.assets.find(row=>row.id===id&&row.role===role);if(!asset)return;
    const video=asset.contentType.startsWith('video/'),node=document.createElement(video?'video':'img');
    node.className=`presentation-plane presentation-${role}`;node.dataset.layerAsset=asset.id;node.setAttribute('aria-hidden','true');
    // K04 (production: a 3.97 MB background film beside the dealer's 0.9 MB idle film): on a slow or unknown link the
    // background film loads nothing until the dealer's first frame; the compositor shows a dark surface until then.
    const defer=video&&role==='background'&&!dealerShown&&!fastLink(connection);
    if(video){node.muted=true;node.loop=true;node.playsInline=true;node.preload=defer?'none':'auto';node.autoplay=!defer&&(role!=='background'||backgroundVisible);}
    else node.alt='';
    // Independent source planes appear through the mandatory keyed dealer layer.
    if(node.style)node.style.visibility=current.dealer.enabled?'hidden':'';host.append(node);mounts.set(role,node);
    if(defer){deferredTimer??=setTimeout(releaseDeferred,DEFERRED_LAYER_MS);deferred.set(role,()=>{node.preload='auto';node.autoplay=backgroundVisible;load(role,node,asset,{hold:false});
      if(backgroundVisible)Promise.resolve(node.play?.()).catch(()=>{});});return;}
    load(role,node,asset,{hold:true});
  }
  // hold: a film may wait (LAYER_WAIT_MS) for this layer. A deferred background never holds one.
  function load(role,node,asset,{hold}){
    node.src=asset.src;if(!node.addEventListener)return;
    const video=node.tagName==='VIDEO',type=video?'loadeddata':'load';
    if(video?node.readyState>=2:node.complete&&node.naturalWidth)return;
    let release,retries=0,retryTimer,deadline;
    const entry=new Promise(resolve=>{release=resolve;});
    const done=()=>{clearTimeout(deadline);deadline=undefined;if(pending.get(role)===entry)pending.delete(role);release();};
    const stop=()=>{clearTimeout(retryTimer);retryTimer=undefined;node.removeEventListener(type,loaded);node.removeEventListener('error',failed);
      if(cancelLoads.get(role)===cancel)cancelLoads.delete(role);};
    const cancel=()=>{stop();done();};
    // It shows on the next composed frame; a held dealer frame is repainted now.
    const loaded=()=>{cancel();paintHeld();};
    const failed=()=>{done();if(retries>=LAYER_RETRY_MS.length){stop();return;}
      clearTimeout(retryTimer);retryTimer=setTimeout(()=>{retryTimer=undefined;node.src=asset.src;},LAYER_RETRY_MS[retries++]);};
    node.addEventListener(type,loaded);node.addEventListener('error',failed);cancelLoads.set(role,cancel);
    if(hold){pending.set(role,entry);deadline=setTimeout(done,LAYER_DEADLINE_MS);}
  }
  // A film waits at most LAYER_WAIT_MS for its layers; one still loading then stops holding films.
  function layersSettled(){
    if(!pending.size)return Promise.resolve();
    return new Promise(resolve=>{
      let timer;const finish=()=>{clearTimeout(timer);resolve();};
      timer=setTimeout(()=>{pending.clear();finish();},LAYER_WAIT_MS);
      void Promise.all(pending.values()).then(finish);
    });
  }
  function set(role,id) {if(!closed&&current&&current[role].allowed.includes(id)){
    players.get(role)?.pause();
    render(role,id);paintHeld();if(backgroundVisible&&playbackAllowed(role))players.get(role)?.start();
  }}
  function replace(value) {
    if(closed)return;
    setMovingSpeechLayer(null);
    closePlayers();
    ++preparation;current=validateComposition(value);key=null;referenceFraming=null;lastGeometry='';stopAnimation();compositor?.canvas?.style.setProperty('visibility','hidden');
    for(const role of ['background','table'])render(role,current[role].default);
    host.dataset.dealerLayerEnabled=String(current.dealer.enabled);host.dataset.presentationClipMode='pending';
    for(const role of PLAYBACK_ROLES)configureLayerPlayback(role);
  }
  async function prepareClip(compositing,sourceFraming,{kind}={}) {
    const revision=++preparation;stopAnimation();key=null;framing=sourceFraming?validateDealerFraming(sourceFraming):null;
    const nextKey=clipCompositing(compositing);
    runtime??=loadRuntime();const {Compositor}=await runtime;
    if(closed||revision!==preparation)return false;
    await layersSettled();if(closed||revision!==preparation)return false;
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
    if(!dealerShown){dealerShown=true;releaseDeferred();}
    if(raf===null&&view.requestAnimationFrame)raf=view.requestAnimationFrame(animate);
    return true;
  }
  if(current)replace(current);
  return {setBackground:id=>set('background',id),setTable:id=>set('table',id),replace,prepareClip,renderFrame,setMovingSpeechLayer,
    gameUi:()=>current?.settings?.[(compactQuery?.matches??host.clientWidth<=860)?'mobile':'desktop']?.gameUi,
    referencePlane,onGeometryChange(listener){geometryListeners.add(listener);return()=>geometryListeners.delete(listener);},
    backgroundEvent:(eventId,eventKey)=>players.get('background')?.event(eventId,eventKey)??false,
    tableEvent:(eventId,eventKey)=>players.get('table')?.event(eventId,eventKey)??false,
    setBackgroundVisible(visible){backgroundVisible=Boolean(visible);
      for(const [role,player] of players)if(backgroundVisible&&playbackAllowed(role))player.start();else player.pause();
      const base=mounts.get('background');if(base?.tagName==='VIDEO'){base.autoplay=backgroundVisible;
        if(backgroundVisible)Promise.resolve(base.play?.()).catch(()=>{});else base.pause?.();}},
    hold:()=>{if(key)paintHeld();},
    dealerUnavailable:()=>{if(!closed)releaseDeferred();},
    close(){if(closed)return;closed=true;clearTimeout(deferredTimer);deferredTimer=undefined;setMovingSpeechLayer(null);geometryListeners.clear();closePlayers();++preparation;stopAnimation();
      for(const role of [...mounts.keys()])releaseLayer(role);compositor?.dispose();compositor?.canvas.remove();}};
}
