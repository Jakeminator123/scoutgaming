'use client';
import {useState, type FormEvent} from 'react';
import type {StudioProject} from '../lib/studio-model.mjs';
import {labUrl} from '../lib/lab-url.mjs';
import {LAYER_ASSET_TYPES, MAX_LAYER_ASSET_BYTES, layerAssetPath} from '../../web/presentation-layers.mjs';

export function LayerLibrary({project,dirty,onRegistered,available=true}:{project:StudioProject;dirty:boolean;available?:boolean;onRegistered:(project:StudioProject)=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[role,setRole]=useState<'background'|'table'>('background');
  async function upload(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy||dirty||!available)return;
    const form=event.currentTarget, data=new FormData(form), file=data.get('file');
    if(!(file instanceof File)||!LAYER_ASSET_TYPES[file.type]||file.size<16||file.size>MAX_LAYER_ASSET_BYTES){setError('Välj PNG, JPEG, WebP, MP4 eller WebM, högst 128 MB.');return;}
    setBusy(true);setError('');
    try {
      const url=URL.createObjectURL(file);
      const dimensions=await new Promise<{width:number;height:number}>((resolve,reject)=>{
        const element=file.type.startsWith('image/')?new Image():document.createElement('video');
        const clean=()=>{URL.revokeObjectURL(url);if(element instanceof HTMLVideoElement){element.removeAttribute('src');element.load();}};
        element.onerror=()=>{clean();reject(new Error('Filen kunde inte läsas.'));};
        if(element instanceof HTMLImageElement){element.onload=()=>{const value={width:element.naturalWidth,height:element.naturalHeight};clean();resolve(value);};}
        else {element.preload='metadata';element.onloadedmetadata=()=>{const value={width:element.videoWidth,height:element.videoHeight};clean();resolve(value);};}
        element.src=url;
      });
      const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()));
      const sha256=[...hash].map(byte=>byte.toString(16).padStart(2,'0')).join('');
      async function post(body:unknown) {
        const response=await fetch(labUrl('/api/layer-assets/upload'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const value=await response.json();if(!response.ok)throw new Error(response.status===409?'Projektet har ändrats. Läs om och försök igen.':'Lagerfilen kunde inte sparas.');return value;
      }
      const grant=await post({operation:'prepare',role,label:String(data.get('label')??'').trim(),sha256,size:file.size,contentType:file.type,...dimensions});
      if(grant.pathname!==layerAssetPath({id:grant.id,role,sha256,contentType:file.type})||!grant.clientToken||!grant.ticket)throw new Error('Uppladdningens mål kunde inte verifieras.');
      const {put}=await import('@vercel/blob/client');
      const stored=await put(grant.pathname,file,{access:'private',token:grant.clientToken,contentType:file.type,multipart:file.size>5*1024*1024});
      if(stored.pathname!==grant.pathname)throw new Error('Uppladdningens mål kunde inte verifieras.');
      const result=await post({operation:'commit',ticket:grant.ticket});
      if(result.id!==grant.id||!result.project)throw new Error('Filen är uppladdad. Läs om biblioteket för att kontrollera registreringen.');
      onRegistered(result.project);form.reset();
    } catch(cause){setError(cause instanceof Error?cause.message:'Uppladdningen misslyckades.');}
    finally{setBusy(false);}
  }
  return <details open><summary>Lägg till bakgrund eller bord · {project.layerAssets?.length??0} filer</summary>
    <form onSubmit={event=>void upload(event)}><fieldset disabled={busy||dirty||!available}>
      <label className="field">Lager<select value={role} onChange={event=>setRole(event.target.value as typeof role)}><option value="background">Bakgrund</option><option value="table">Bord</option></select></label>
      <label className="field">Namn<input name="label" maxLength={80} required/></label>
      <label className="field">Fil<input name="file" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" required/></label>
      <p>Transparent PNG eller WebP passar för bord. Bakgrunder kan vara bilder eller tysta videoloopar.</p>
      <button type="submit" className="sg-btn sg-btn-secondary">{busy?'Sparar…':'Ladda upp lager'}</button>
    </fieldset></form>
    {!available?<p>Uppladdning är tillgänglig i den anslutna studion. Externa tjänster är avstängda i offline-provet.</p>:null}
    {dirty?<p>Spara projektutkastet före uppladdning.</p>:null}{error?<p role="alert">{error}</p>:null}
    <ul>{project.layerAssets?.map(asset=><li key={asset.id}>{asset.label} · {asset.role==='background'?'Bakgrund':'Bord'} · {asset.width} × {asset.height}</li>)}</ul>
  </details>;
}
