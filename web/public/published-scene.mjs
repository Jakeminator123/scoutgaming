import {sceneForComposition} from './composition-settings.mjs';

// One published, silent idle scene renderer for the lobby and game rooms.
// Call close when replacing the scene to release media, GPU resources and listeners.
export function mountPublishedScene(stage, {dealer=null, background=null, table=null, tableMask=null, settings=null, layout='mobile', compositing, still=false, onReady=()=>{}, onFailure=()=>{}, onPlaying=()=>{}}) {
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

    const canPlay = ()=>!still && active && loaded && !failed && requestedPlay && inView && !document.hidden;
    function pause() {
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
            contain(actorContext,selected,1080,1920);
            actor.src = version;
            actorVersion = version;
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
          renderer.render(scene,actor,assets,[],undefined);
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
      void Promise.all(videos.map(video=>video.play())).then(()=>{
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

    async function load(role, source) {
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
      assets.set(role,{id:role,el:element,width,height,kind:isVideo?'video':'image'});
      element.addEventListener('error',fail,{signal:abort.signal});
    }
    async function init() {
      if (settings) {
        scene = sceneForComposition(settings,layout,{
          dealer:Boolean(dealer), background:Boolean(background), table:Boolean(table), cards:false,
        },compositing ? {...compositing,mode:'composite',enabled:true} : undefined);
        const moduleUrl = '/composition-runtime/compositor.js';
        const [runtime] = await Promise.all([
          import(/* webpackIgnore: true */ moduleUrl),
          load('dealer',dealer),load('background',background),load('table',table),
          load('tableMask',tableMask),
        ]);
        if (!active || failed) return;
        actor = document.createElement('canvas');
        actor.width = 1080;
        actor.height = 1920;
        actorContext = actor.getContext('2d');
        if (!actorContext) throw new Error('Preview unavailable');
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
    }
    void init().catch(fail);
    return {toggle, close:()=>{
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
