// Opt-in, in-memory diagnostics. No telemetry is sent to a server.
export function compactPlaybackReport(data) {
  const report={version:2,elapsedMs:data.elapsedMs,visible:data.visible,videos:data.videos,
    counts:data.counts,events:data.events.slice(-10).reverse(),gaps:data.gaps.slice(-5).reverse(),
    visibility:data.visibility.slice(-4),longTasks:data.longTasks.slice(-3),
    resources:data.resources.slice(-5),videoFrameCallbacks:data.videoFrameCallbacks,
    userAgent:data.userAgent,viewport:data.viewport};
  // WhatsApp previews previously truncated the report before the dealing events.
  // Keep the complete JSON small, preserving current state and newest events first.
  while(JSON.stringify(report).length>2800){
    const key=['resources','longTasks','gaps','events'].find(k=>report[k].length>(k==='events'?2:0));
    if(!key)break;
    if(key==='events'||key==='gaps')report[key].pop();else report[key].shift();
  }
  return report;
}
export function installPlaybackDiagnostics() {
  const started=performance.now(),events=[],gaps=[],longTasks=[],visibility=[],counts={},lastFrame=new WeakMap();
  document.addEventListener("visibilitychange",()=>{keep(visibility,{ms:Math.round(performance.now()-started),visible:!document.hidden});});
  const keep=(list,item)=>{list.push(item);if(list.length>120)list.shift();};
  const videos=[...document.querySelectorAll('video')];
  for(const video of videos){
    let last=null;
    for(const type of ['loadstart','playing','waiting','stalled','seeking','seeked','pause','error'])video.addEventListener(type,()=>{
      counts[type]=(counts[type]??0)+1;
      keep(events,{type,ms:Math.round(performance.now()-started),clip:video.dataset.source?.split('/').pop(),visible:video.classList.contains('on'),time:Number(video.currentTime.toFixed(3)),ready:video.readyState});
      if(['loadstart','pause','playing'].includes(type))last=null;
    });
    const frame=(now,meta)=>{
      lastFrame.set(video,now);
      if(!document.hidden&&video.classList.contains('on')){
        if(last&&last.source===video.currentSrc&&meta.mediaTime>last.time&&now-last.at>150)keep(gaps,{ms:Math.round(now-started),gapMs:Math.round(now-last.at),clip:video.dataset.source?.split('/').pop()});
        last={at:now,time:meta.mediaTime,source:video.currentSrc};
      }else last=null;
      video.requestVideoFrameCallback(frame);
    };
    video.requestVideoFrameCallback?.(frame);
  }
  let observer;
  try{observer=new PerformanceObserver(list=>{for(const e of list.getEntries())keep(longTasks,{ms:Math.round(e.startTime-started),durationMs:Math.round(e.duration)});});observer.observe({type:'longtask',buffered:false});}catch{}
  const report=()=>compactPlaybackReport({counts,visibility,videoFrameCallbacks:typeof videos[0]?.requestVideoFrameCallback==='function',userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight,devicePixelRatio],visible:!document.hidden,elapsedMs:Math.round(performance.now()-started),events,gaps,longTasks,
    resources:performance.getEntriesByType('resource').filter(r=>/\/api\/table|\/media\//.test(r.name)).slice(-60).map(r=>({path:new URL(r.name).pathname,ms:Math.round(r.duration),bytes:r.transferSize})),
    videos:videos.map(v=>({visible:v.classList.contains('on'),time:Number(v.currentTime.toFixed(3)),frameAgeMs:lastFrame.has(v)?Math.round(performance.now()-lastFrame.get(v)):null,clip:v.dataset.source?.split('/').pop(),width:v.videoWidth,height:v.videoHeight,paused:v.paused,ready:v.readyState,seeking:v.seeking,error:v.error?.code??null}))});
  const button=document.createElement('button');button.type='button';button.id='copyPlaybackReport';button.textContent='Copy playback report';
  button.style.cssText='position:fixed;bottom:8px;left:8px;z-index:1000;background:#111;color:#fff;border:1px solid #ddd;border-radius:8px;padding:10px;font:14px system-ui';
  button.addEventListener('click',async()=>{const text=JSON.stringify(report());try{await navigator.clipboard.writeText(text);button.textContent='Report copied';}catch{const area=document.createElement('textarea');area.value=text;area.readOnly=true;area.setAttribute('aria-label','Playback report');area.style.cssText='position:fixed;inset:20%;z-index:1001';document.body.append(area);area.select();}});
  document.body.append(button);
  return report;
}
