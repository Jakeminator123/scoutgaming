'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {StudioProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {uploadCompositionLayer} from '../lib/studio-composition.mjs';
import {labUrl} from '../lib/lab-url.mjs';
import {LAYER_ASSET_TYPES,MAX_LAYER_ASSET_BYTES} from '../../../packages/presentation/contracts/presentation-layers.mjs';
import {layerUploadResponseError,layerUploadFailureMessage} from '../../../packages/presentation/contracts/layer-upload-errors.mjs';

type Role='background'|'table';
function dimensions(file:File,signal:AbortSignal) {
  return new Promise<{width:number;height:number}>((resolve,reject)=>{
    const url=URL.createObjectURL(file),element=file.type.startsWith('image/')?new Image():document.createElement('video');
    let finished=false;
    function finish(cause?:Error) {
      if(finished)return;finished=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);
      const width=element instanceof HTMLImageElement?element.naturalWidth:element.videoWidth,height=element instanceof HTMLImageElement?element.naturalHeight:element.videoHeight;
      element.onerror=null;if(element instanceof HTMLImageElement)element.onload=null;else element.onloadedmetadata=null;
      URL.revokeObjectURL(url);element.removeAttribute('src');if(element instanceof HTMLVideoElement)element.load();
      if(cause)reject(cause);else if(!width||!height)reject(new Error('Filen saknar en läsbar bildruta.'));else resolve({width,height});
    }
    const cancel=()=>finish(new Error('Uppladdningen avbröts.'));
    const timer=setTimeout(()=>finish(new Error('Filen tog för lång tid att läsa. Välj filen igen.')),20000);
    element.onerror=()=>finish(new Error('Filen kunde inte läsas.'));
    if(element instanceof HTMLImageElement)element.onload=()=>finish();else {element.preload='metadata';element.onloadedmetadata=()=>finish();}
    signal.addEventListener('abort',cancel,{once:true});if(signal.aborted){cancel();return;}element.src=url;
  });
}

// One file at a time: drop it or choose it, see it, name it (the name is suggested from the file name),
// then Ladda upp. The upload itself is unchanged (uploadCompositionLayer, /api/layer-assets/upload).
const suggestedName=(file:{name:string})=>file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
const checker={backgroundImage:'repeating-conic-gradient(var(--sg-hover) 0 25%, var(--sg-surface) 0 50%)',backgroundSize:'16px 16px'};
const button='inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3.5 text-[13px] font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sg-lime';
export function LayerLibrary({role,game='blackjack',onRegistered,available=true,disabled=false,onBusyChange,aside}:{role:Role;game?:'blackjack'|'roulette';available?:boolean;disabled?:boolean;onRegistered:(project:StudioProject,id:string)=>void;onBusyChange?:(busy:boolean)=>void;aside?:ReactNode}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[label,setLabel]=useState(''),[progress,setProgress]=useState<number|null>(null),[committing,setCommitting]=useState(false);
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[dragging,setDragging]=useState(false);
  const request=useRef<AbortController|null>(null),mounted=useRef(true),commitStarted=useRef(false),busyCallback=useRef(onBusyChange),input=useRef<HTMLInputElement|null>(null);
  busyCallback.current=onBusyChange;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current?.abort();busyCallback.current?.(false);};},[]);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  const locked=busy||disabled||!available;
  function choose(next:File|undefined) {
    if(!next||locked)return;
    if(!LAYER_ASSET_TYPES[next.type]||next.size<16||next.size>MAX_LAYER_ASSET_BYTES){setError('Välj PNG, JPEG, WebP, MP4 eller WebM, högst 128 MB.');if(input.current)input.current.value='';return;}
    setError('');setFile(next);setLabel(suggestedName(next));setPreview(URL.createObjectURL(next));
  }
  function clear() {setFile(null);setPreview('');setLabel('');if(input.current)input.current.value='';}
  async function upload() {
    if(!file||request.current||disabled||!available)return;
    const controller=new AbortController();request.current=controller;commitStarted.current=false;
    setBusy(true);setCommitting(false);setError('');setProgress(null);busyCallback.current?.(true);
    try {
      const size=await dimensions(file,controller.signal);
      const result=await uploadCompositionLayer(file,{role,...(role==='table'?{game}:{}),label:label.trim()||suggestedName(file)||'Lager',...size},{
        signal:controller.signal,
        post:async(body,signal)=>{
          const response=await fetch(labUrl('/api/layer-assets/upload'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
          const value=await response.json();if(!response.ok)throw layerUploadResponseError(response.status,value);return value;
        },
        put:async(pathname,file,options)=>{const {put}=await import('@vercel/blob/client');controller.signal.throwIfAborted();return put(pathname,file,options);},
        onUploadProgress:event=>{if(mounted.current)setProgress(Math.round(event.percentage));},
        onCommit:()=>{commitStarted.current=true;if(mounted.current)setCommitting(true);},
      });
      if(!mounted.current)return;onRegistered(result.project,result.id);clear();
    }catch(cause){if(mounted.current)setError(layerUploadFailureMessage(cause,{aborted:controller.signal.aborted,commitStarted:commitStarted.current}));}
    finally{request.current=null;commitStarted.current=false;if(mounted.current){setBusy(false);setCommitting(false);}busyCallback.current?.(false);}
  }
  const noun=role==='background'?'bakgrund':'bordsgrafik';
  const status=committing?'Registrerar filen…':progress===null?'Kontrollerar filen…':`Laddar upp · ${progress} %`;
  return <div className="grid gap-3">
    <div className="flex flex-wrap items-stretch gap-3">
      <div onDragOver={event=>{event.preventDefault();if(!locked)setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);choose(event.dataTransfer.files?.[0]);}}
        data-dragging={dragging||undefined} role="group" aria-label={'Ladda upp '+noun}
        className="min-w-[280px] flex-1 rounded-xl border-2 border-dashed border-sg-border bg-sg-surface px-5 py-5 transition-colors data-[dragging]:border-sg-text data-[dragging]:bg-sg-accent-bg">
        {file?<div className="flex flex-wrap items-center gap-4">
          <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-sg-border" style={checker}>
            {file.type.startsWith('video/')?<video src={preview} muted playsInline preload="metadata" className="absolute inset-0 size-full object-contain" aria-label={'Förhandsvisning av '+file.name}/>:<img src={preview} alt={'Förhandsvisning av '+file.name} className="absolute inset-0 size-full object-contain"/>}
          </div>
          <div className="grid min-w-[220px] flex-1 gap-2">
            <label className="grid gap-1 text-[13px] font-semibold text-sg-text">Namn<input maxLength={80} value={label} disabled={busy||disabled} onChange={event=>setLabel(event.target.value)} className="h-9 rounded-lg border border-sg-border bg-sg-surface px-3 text-[14px] font-normal text-sg-text"/></label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={button+' border-transparent bg-sg-lime text-sg-on-accent'} disabled={locked} onClick={()=>void upload()}>{busy?status:'Ladda upp'}</button>
              {busy?<button type="button" className={button+' border-sg-border bg-sg-surface text-sg-text'} disabled={committing} onClick={()=>request.current?.abort()}>Avbryt uppladdning</button>
                :<button type="button" className={button+' border-transparent bg-transparent text-sg-muted hover:bg-sg-hover'} onClick={clear}>Välj en annan fil</button>}
            </div>
          </div>
        </div>:<div className="grid justify-items-center gap-1.5 py-2 text-center">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 text-sg-faint" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 13v8"/><path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="m8 17 4-4 4 4"/></svg>
          <p className="m-0 text-[14px] font-semibold text-sg-text">Dra hit en bild eller video</p>
          <p className="m-0 text-[12.5px] text-sg-muted">eller <label className="cursor-pointer font-semibold text-sg-accent-text underline-offset-4 hover:underline">välj fil<input ref={input} type="file" className="sr-only" disabled={locked} accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" onChange={event=>choose(event.currentTarget.files?.[0])}/></label> · PNG, JPEG, WebP, MP4 eller WebM, högst 128 MB</p>
        </div>}
      </div>
      {aside}
    </div>
    {role==='table'?<p className="m-0 text-[12.5px] text-sg-muted">Bordsgrafiken registreras för {game==='roulette'?'Roulette':'Blackjack'}: en bild eller en tyst scenloop.</p>:null}
    {busy?<p role="status" className="sr-only">{status}</p>:null}
    {!available?<p className="m-0 text-[13px] text-sg-muted">Uppladdning kräver ansluten Studio.</p>:null}
    {error?<p role="alert" className="m-0 rounded-lg bg-sg-warn-bg px-3.5 py-2.5 text-[13px] text-sg-warn">{error}</p>:null}
  </div>;
}
