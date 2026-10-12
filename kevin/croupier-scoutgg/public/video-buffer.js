import {speechForEvent} from './dealer-language.js';
// Full-quality source bytes, one transfer at a time, reused through Blob URLs.
// No decoder/resolution changes. Pending game clips outrank decorative idle.
// Kevin 12 Oct (preload): a few transfers at once instead of one, so a high-latency line does not wait clip by clip.
export function createVideoBuffer({fetchImpl=fetch,createURL=b=>URL.createObjectURL(b),revokeURL=u=>URL.revokeObjectURL(u),maxBytes=96*1024*1024,parallel=4}={}) {
  const entries=new Map();let active=0,bytes=0,clock=0;
  function trim(protect) {
    for(const [key,e] of [...entries].filter(([,e])=>e.url).sort((a,b)=>a[1].used-b[1].used)){
      if(bytes<=maxBytes)break;if(key===protect||e.pins)continue;
      bytes-=e.size;revokeURL(e.url);entries.delete(key);
    }
  }
  async function pump(){
    if(active>=parallel)return;
    const e=[...entries.values()].filter(e=>!e.url&&!e.started).sort((a,b)=>a.priority-b.priority||a.order-b.order)[0];if(!e)return;
    active++;e.started=true;queueMicrotask(pump);
    try{const r=await fetchImpl(e.source,{cache:'force-cache'});if(!r.ok)throw new Error('Video download failed');const blob=await r.blob();if(!blob.size)throw new Error('Empty video');e.url=createURL(blob,e.source);e.size=blob.size;bytes+=e.size;e.used=++clock;trim(e.source);e.resolve(e.url);}
    catch(err){entries.delete(e.source);e.reject(err);}
    finally{active--;pump();}
  }
  function load(source,priority=0){
    let e=entries.get(source);if(e){e.used=++clock;e.priority=Math.min(e.priority,priority);return e.promise;}
    e={source,priority,order:++clock,used:clock,started:false,pins:0};e.promise=new Promise((resolve,reject)=>Object.assign(e,{resolve,reject}));entries.set(source,e);queueMicrotask(pump);return e.promise;
  }
  return {load,has:source=>Boolean(entries.get(source)?.url),pin(source){const e=entries.get(source);if(e)e.pins++;},unpin(source){const e=entries.get(source);if(e)e.pins=Math.max(0,e.pins-1);trim();},async prepare(sources,onProgress=()=>{}){const unique=[...new Set(sources.filter(Boolean))];let done=0;onProgress(0,unique.length);await Promise.all(unique.map(source=>load(source,1).then(()=>{onProgress(++done,unique.length);})));},get bytes(){return bytes;}};
}

// Match the server's deterministic event selection, including the side-bet line.
export function tableVideoSources(manifest,seats=[],language='en') {
  const events=['goodluck','bust','double','sidebet','insurance','dealerblackjack','blackjack','dealerbust','win','push','lose'];
  const lines=events.map(event=>speechForEvent(manifest,event,language));
  return [...new Set([
    ...manifest.deal.filter(c=>['deal_posdealer','deal_hole','deal_flip'].includes(c.id)||seats.includes(Number(c.id.replace('deal_pos',''))-1)),...lines
  ].filter(Boolean).map(c=>c.url))];
}
