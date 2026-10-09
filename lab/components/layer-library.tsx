'use client';
import {useEffect,useRef,useState} from 'react';
import type {StudioProject} from '../lib/studio-model.mjs';
import {uploadCompositionLayer} from '../lib/studio-composition.mjs';
import {labUrl} from '../lib/lab-url.mjs';
import {LAYER_ASSET_TYPES,MAX_LAYER_ASSET_BYTES} from '../../web/presentation-layers.mjs';

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

export function LayerLibrary({role,onRegistered,available=true,disabled=false,onBusyChange}:{role:Role;available?:boolean;disabled?:boolean;onRegistered:(project:StudioProject,id:string)=>void;onBusyChange?:(busy:boolean)=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[label,setLabel]=useState(''),[progress,setProgress]=useState<number|null>(null),[committing,setCommitting]=useState(false);
  const request=useRef<AbortController|null>(null),mounted=useRef(true),commitStarted=useRef(false),busyCallback=useRef(onBusyChange);
  busyCallback.current=onBusyChange;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current?.abort();busyCallback.current?.(false);};},[]);
  async function upload(input:HTMLInputElement) {
    const file=input.files?.[0];if(!file||request.current||disabled||!available)return;
    if(!LAYER_ASSET_TYPES[file.type]||file.size<16||file.size>MAX_LAYER_ASSET_BYTES){setError('Välj PNG, JPEG, WebP, MP4 eller WebM, högst 128 MB.');input.value='';return;}
    const controller=new AbortController();request.current=controller;commitStarted.current=false;
    setBusy(true);setCommitting(false);setError('');setProgress(null);busyCallback.current?.(true);
    try {
      const size=await dimensions(file,controller.signal);
      const result=await uploadCompositionLayer(file,{role,label:label.trim()||file.name.replace(/\.[^.]+$/,'').slice(0,80)||'Lager',...size},{
        signal:controller.signal,
        post:async(body,signal)=>{
          const response=await fetch(labUrl('/api/layer-assets/upload'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
          const value=await response.json();if(!response.ok)throw new Error(response.status===409?'Projektet har ändrats. Utkastet har behållits.':'Lagerfilen kunde inte sparas. Utkastet har behållits.');return value;
        },
        put:async(pathname,file,options)=>{const {put}=await import('@vercel/blob/client');controller.signal.throwIfAborted();return put(pathname,file,options);},
        onUploadProgress:event=>{if(mounted.current)setProgress(Math.round(event.percentage));},
        onCommit:()=>{commitStarted.current=true;if(mounted.current)setCommitting(true);},
      });
      if(!mounted.current)return;onRegistered(result.project,result.id);input.value='';setLabel('');
    }catch(cause){if(mounted.current)setError(controller.signal.aborted?'Uppladdningen avbröts. Utkastet har behållits.':`${commitStarted.current?'Filen kan vara registrerad. Kontrollera biblioteket innan du laddar upp igen. ':''}${cause instanceof Error?cause.message:'Uppladdningen misslyckades.'}`);}
    finally{input.value='';request.current=null;commitStarted.current=false;if(mounted.current){setBusy(false);setCommitting(false);}busyCallback.current?.(false);}
  }
  return <div>
    <label className="field">Ladda upp {role==='background'?'bakgrund':'bord'}<input type="file" disabled={busy||disabled||!available} accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" onChange={event=>void upload(event.currentTarget)}/></label>
    <details><summary>Namn vid uppladdning</summary><label className="field">Namn · valfritt<input maxLength={80} value={label} disabled={busy||disabled} onChange={event=>setLabel(event.target.value)}/></label></details>
    {busy?<div><p role="status">{committing?'Registrerar filen…':progress===null?'Kontrollerar filen…':`Laddar upp · ${progress} %`}</p><button type="button" className="sg-btn sg-btn-secondary" disabled={committing} onClick={()=>request.current?.abort()}>Avbryt uppladdning</button></div>:null}
    {!available?<p>Uppladdning kräver ansluten Studio.</p>:null}
    {error?<p role="alert">{error}</p>:null}
  </div>;
}
