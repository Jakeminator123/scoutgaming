import {sceneForComposition} from './composition-settings.mjs';
import {drawDealerFrame,dealerFrameRect} from './dealer-framing.mjs';

// One published, silent idle scene renderer for the lobby and game rooms.
// Call close when replacing the scene to release media, GPU resources and listeners.
export function mountPublishedScene(stage, {dealer=null, background=null, table=null, tableMask=null, tableOverlay=null, settings=null, layout='mobile', compositing, still=false, onReady=()=>{}, onFailure=()=>{}, onPlaying=()=>{}, onDealerClip=()=>{}}) {
    const abort = new AbortController();
    const assets = new Map();
    const elements = [];
    const videos = [];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let active = true, loaded = false, failed = false, frame = 0;
    let inView = typeof window.IntersectionObserver === 'undefined';
    let requestedPlay = !still && !motion.matches, playingNow = false, starting = false, playGeneration = 0;
    let renderer = null, actor = null, actorContext = null;
    let outputContext = null, actorVersion = '';
    let scene = null;
    let maskedTable = null;
    let animatedTable = null, tableRevision = 0;
    let foregroundMatte = null;
    let roundActive = false, idleLoops = 0, variantCursor = 0;
    let startReady=Promise.resolve(null), actionRun=null, startBroken=false;
    const dealerAssets = [], dealerElements = new Set();
    const playableVideos = ()=>videos.filter(video=>!dealerElements.has(video)||video===assets.get('dealer')?.el);

    const canPlay = ()=>!still && active && loaded && !failed && requestedPlay && inView && !document.hidden;
    function pause() {
      finishAction(false);
      playGeneration++;
      starting = false;
      playingNow = false;
      videos.forEach(video=>video.pause());
      cancelAnimationFrame(frame);
      frame = 0;
      if (active) onPlaying(false);
    }
    function fail() {
      if (!active || failed) return;
      failed = true;
      pause();
      abort.abort();
      onFailure();
    }
    function contain(context, asset, width, height) {
      const scale = Math.min(width/asset.width,height/asset.height);
      const w = asset.width*scale, h = asset.height*scale;
      context.clearRect(0,0,width,height);
      context.drawImage(asset.el,(width-w)/2,(height-h)/2,w,h);
    }
    function render() {
      if (!active || !loaded || failed) return;
      const selected = assets.get('dealer');
      try {
        if (renderer && actor && actorContext && scene) {
          const version = selected ? selected.el instanceof HTMLVideoElement ? `${selected.el.currentSrc}@${selected.el.currentTime}` : dealer.src : '';
          if (selected && actorVersion !== version) {
            if (selected.profile?.framing) drawDealerFrame(actorContext,selected.el,actor.width,actor.height,selected.profile.framing);
            else contain(actorContext,selected,actor.width,actor.height);
            actor.src = version;
            actorVersion = version;
            if(foregroundMatte){
              const {mask,context,region}=foregroundMatte;
              context.globalCompositeOperation='source-over';context.clearRect(0,0,mask.width,mask.height);
              context.drawImage(actor,0,0,mask.width,mask.height);
              const pixels=context.getImageData(0,0,mask.width,mask.height);
              for(let i=0;i<pixels.data.length;i+=4){
                const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2],a=pixels.data[i+3];
                // The calibrated region admits skin and the white sleeves; the
                // dark waistcoat must stay behind the rim when hands are raised.
                const value=a>16&&r>70&&g>53&&b>35?255:0;
                pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;
              }
              context.putImageData(pixels,0,0);context.globalCompositeOperation='destination-in';
              context.drawImage(region,0,0);context.globalCompositeOperation='source-over';mask.src=version;
            }
          }
          if (maskedTable) {
            const {source,mask,canvas,context} = maskedTable;
            const version = source.el instanceof HTMLVideoElement ? `${source.el.currentSrc}@${source.el.currentTime}` : table.src;
            if (canvas.src !== version) {
              context.clearRect(0,0,canvas.width,canvas.height);
              context.globalCompositeOperation='source-over';
              context.drawImage(source.el,0,0,canvas.width,canvas.height);
              context.globalCompositeOperation='destination-in';
              context.drawImage(mask.el,0,0,canvas.width,canvas.height);
              context.globalCompositeOperation='source-over';
              canvas.src=version;
            }
          }
          if(animatedTable){
            const {source,canvas,context}=animatedTable;
            context.clearRect(0,0,canvas.width,canvas.height);
            context.drawImage(source.el,0,0,canvas.width,canvas.height);
            const overlay=tableOverlay();
            if(overlay&&!overlay.hidden)context.drawImage(overlay,0,0,canvas.width,canvas.height);
            canvas.src='table-frame-'+(++tableRevision);
          }
          renderer.render(scene,actor,assets,[],undefined);
          if(actionRun && selected===actionRun.asset)actionRun.onFrame(selected.el.currentTime*1000);
        } else if (outputContext && selected) contain(outputContext,selected,720,1280);
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
      void Promise.all(playableVideos().map(video=>video.play())).then(()=>{
        if (!active || generation !== playGeneration || !canPlay()) {
          // A pending play promise may complete after visibility or source changes.
          if (!canPlay()) videos.forEach(video=>video.pause());
          return;
        }
        starting = false;
        playingNow = true;
        onPlaying(true);
        if (!frame) frame = requestAnimationFrame(tick);
      }).catch(()=>{
        if (!active || generation !== playGeneration) return;
        if(actionRun){startBroken=true;finishAction(false);starting=false;playingNow=false;render();syncPlayback();return;}
        // A browser may block autoplay. Keep the decoded first frame and offer Play.
        requestedPlay = false;
        pause();
      });
    }
    const toggle = ()=>{
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
    const observer = typeof window.IntersectionObserver === 'undefined' ? null : new window.IntersectionObserver(entries=>{
      inView = entries.some(entry=>entry.isIntersecting);
      syncPlayback();
    });
    observer?.observe(stage);
    stage.addEventListener('webglcontextlost',fail,{signal:abort.signal});

    function nextDealerClip(event) {
      if(actionRun)return;
      if (!active || failed || dealerAssets.length<2 || event?.target!==assets.get('dealer')?.el) return;
      const current=assets.get('dealer');
      if (current===dealerAssets[0]) idleLoops++;
      const useVariant=current===dealerAssets[0]&&!roundActive&&idleLoops>=3;
      const next=useVariant?dealerAssets[1+(variantCursor++%(dealerAssets.length-1))]:dealerAssets[0];
      if (useVariant) idleLoops=0;
      pause();
      next.el.currentTime=0;
      assets.set('dealer',next);
      actorVersion='';
      onDealerClip({src:next.el.currentSrc||next.el.src,variant:next!==dealerAssets[0]});
      render();
      syncPlayback();
    }

    function prepareForegroundMask(source) {
      const profile=source.profile;
      foregroundMatte=null;assets.delete('dealer-foreground');
      if(scene){delete scene.handmatte;scene.layerMode='full';scene.tableFront=settings?.tableFront??false;}
      if (!profile?.foregroundPolygons?.length) return;
      if (!profile.framing) throw Error('Foreground mask requires explicit framing');
      const mask=document.createElement('canvas');mask.width=480;mask.height=270;
      const context=mask.getContext('2d');
      if (!context) throw Error('Foreground mask unavailable');
      const region=document.createElement('canvas');region.width=mask.width;region.height=mask.height;
      const regionContext=region.getContext('2d');
      if(!regionContext)throw Error('Foreground region unavailable');
      const [x,y,w,h]=dealerFrameRect(source.width,source.height,mask.width,mask.height,profile.framing);
      regionContext.fillStyle='#fff';
      for (const polygon of profile.foregroundPolygons) {
        regionContext.beginPath();
        polygon.forEach(([u,v],index)=>regionContext[index?'lineTo':'moveTo'](x+u*w,y+v*h));
        regionContext.closePath();regionContext.fill();
      }
      foregroundMatte={mask,context,region};
      assets.set('dealer-foreground',{el:mask,width:mask.width,height:mask.height,kind:'image'});
      scene.handmatte='dealer-foreground';scene.layerMode='split';scene.tableFront=false;
    }

    function finishAction(ok) {
      const run=actionRun;if(!run)return;
      actionRun=null;clearTimeout(run.timer);run.asset.el.pause();
      const base=dealerAssets[0];
      try{if(base){assets.set('dealer',base);base.el.currentTime=0;actorVersion='';prepareForegroundMask(base);}}
      catch{ok=false;}
      finally{run.resolve(ok);}
    }
    async function loadStart() {
      if(!dealer?.wheelStart)return null;
      try {
        await load('dealer-action',dealer.wheelStart);
        const asset=assets.get('dealer-action');
        if(!asset||!Number.isFinite(asset.el.duration)||Math.abs(asset.el.duration*1000-dealer.wheelStart.durationMs)>100)return null;
        asset.el.loop=false;
        asset.el.addEventListener('ended',()=>{if(actionRun?.asset===asset){finishAction(true);render();playingNow=false;syncPlayback();}},{signal:abort.signal});
        return asset;
      }catch{return null;}
    }
    async function playWheelStart({onFrame=()=>{}}={}) {
      const asset=await startReady;
      if(!asset||startBroken||!canPlay()||actionRun)return false;
      pause();
      try{prepareForegroundMask(asset);}catch{startBroken=true;prepareForegroundMask(dealerAssets[0]);syncPlayback();return false;}
      assets.set('dealer',asset);asset.el.currentTime=0;actorVersion='';
      return new Promise(resolve=>{
        actionRun={asset,onFrame,resolve,timer:setTimeout(()=>{finishAction(false);render();playingNow=false;syncPlayback();},dealer.wheelStart.durationMs+5000)};
        render();syncPlayback();
      });
    }

    async function loadVariants(base) {
      const variants=await Promise.all((dealer.variants??[]).map(async(variant,index)=>{
        const role='dealer-variant-'+index;
        try {
          await load(role,variant);
          const asset=assets.get(role);
          if (!asset || asset.width!==base.width || asset.height!==base.height
            || ['scale','x','y'].some(key=>variant.framing?.[key]!==dealer.framing?.[key])) {
            asset?.el.removeAttribute('src');return null;
          }
          return asset;
        } catch { return null; }
      }));
      if(!active||failed)return;
      dealerAssets.push(...variants.filter(Boolean));
      if(dealerAssets.length>1)for(const asset of dealerAssets){
        asset.el.loop=false;asset.el.addEventListener('ended',nextDealerClip,{signal:abort.signal});
      }
    }

    async function load(role, source) {
      if (!source || !active || failed || abort.signal.aborted) return;
      const isVideo = source.contentType.startsWith('video/');
      const element = isVideo ? document.createElement('video') : new Image();
      elements.push(element);
      if (role==='dealer'||role==='dealer-action'||role.startsWith('dealer-variant-')) dealerElements.add(element);
      if (element instanceof HTMLVideoElement) {
        element.muted = true;
        element.defaultMuted = true;
        element.playsInline = true;
        element.preload = 'auto';
        element.loop = true;
        videos.push(element);
      }
      await new Promise((resolve,reject)=>{
        const event = isVideo ? 'loadeddata' : 'load';
        const finish = (ok)=>{
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
      assets.set(role,{id:role,el:element,width,height,kind:isVideo?'video':'image',profile:role.startsWith('dealer-variant-')?dealer:source});
      element.addEventListener('error',()=>{
        if(role==='dealer-action'){startBroken=true;finishAction(false);render();playingNow=false;syncPlayback();return;}
        if (!role.startsWith('dealer-variant-')) { fail(); return; }
        const index=dealerAssets.findIndex(asset=>asset.el===element);
        const selected=assets.get('dealer')?.el===element;
        if(index>0)dealerAssets.splice(index,1);
        element.pause();
        if(selected){pause();assets.set('dealer',dealerAssets[0]);dealerAssets[0].el.currentTime=0;actorVersion='';render();syncPlayback();}
        if(dealerAssets.length===1)dealerAssets[0].el.loop=true;
      },{signal:abort.signal});
    }
    async function init() {
      if (settings) {
        scene = sceneForComposition(settings,layout,{
          dealer:Boolean(dealer), background:Boolean(background), table:Boolean(table), cards:false,
        },compositing ? {...compositing,mode:'composite',enabled:compositing.mode!=='alpha'} : undefined);
        const moduleUrl = '/composition-runtime/compositor.js';
        const [runtime] = await Promise.all([
          import(/* webpackIgnore: true */ moduleUrl),
          load('dealer',dealer),load('background',background),load('table',table),
          load('tableMask',tableMask),
        ]);
        if (!active || failed) return;
        actor = document.createElement('canvas');
        actor.width = dealer?.framing ? 1920 : 1080;
        actor.height = dealer?.framing ? 1080 : 1920;
        if (dealer?.framing) scene.dealerAspect=actor.width/actor.height;
        actorContext = actor.getContext('2d');
        if (!actorContext) throw new Error('Preview unavailable');
        const base=assets.get('dealer');
        if (base) {
          dealerAssets.push(base);dealerElements.add(base.el);
          prepareForegroundMask(base);
          onDealerClip({src:base.el.currentSrc||base.el.src,variant:false});
        }
        if (tableMask) {
          const source=assets.get('table'), mask=assets.get('tableMask');
          // A registered static alpha mask, never an unsynchronised second video.
          if (!source || !mask || mask.kind!=='image' || Math.abs(source.width/source.height-mask.width/mask.height)>.002) throw new Error('Invalid table mask');
          const canvas=document.createElement('canvas');
          const scale=Math.min(1,1920/source.width,1080/source.height);
          canvas.width=Math.round(source.width*scale);canvas.height=Math.round(source.height*scale);
          const context=canvas.getContext('2d');
          if (!context) throw new Error('Preview unavailable');
          maskedTable={source,mask,canvas,context};
          assets.set('table',{...source,el:canvas});
        }
        // Dynamic game graphics belong to the table pass, below the exact
        // dealer hand matte. They must not be a DOM overlay above her fingers.
        if(tableOverlay&&assets.get('table')){
          const source=assets.get('table'),canvas=document.createElement('canvas');
          canvas.width=source.width;canvas.height=source.height;
          const context=canvas.getContext('2d');if(!context)throw Error('Table canvas unavailable');
          animatedTable={source,canvas,context};
          assets.set('table',{...source,el:canvas});
        }
        // The shared renderer can fall back to Canvas2D without treating its
        // informational WebGL notice as a broken public preview.
        renderer = new runtime.Compositor(stage,()=>{});
      } else {
        if (!dealer || tableMask) throw new Error('Preview unavailable');
        await load('dealer',dealer);
        if (!active || failed) return;
        outputContext = stage.getContext('2d');
        if (!outputContext) throw new Error('Preview unavailable');
      }
      loaded = true;
      render();
      if (failed) return;
      onReady();
      syncPlayback();
      if(settings&&dealerAssets[0]&&!still)startReady=loadStart();
      if(settings&&dealerAssets[0]&&!still)void loadVariants(dealerAssets[0]);
    }
    void init().catch(fail);
    return {toggle, playWheelStart, refresh:()=>{if(active&&!playingNow&&!frame)frame=requestAnimationFrame(()=>{frame=0;render();});}, setRoundActive:value=>{roundActive=Boolean(value);}, close:()=>{
      active = false;
      abort.abort();
      pause();
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
    }};
}
