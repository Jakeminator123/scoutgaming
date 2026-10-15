"use client"
import { useState, useEffect, type CSSProperties } from 'react';
import { Film, Upload, Play, Check } from 'lucide-react';
import type { NodeProps, Node } from '@xyflow/react';
import type { ClipSlot, VideoEntry } from '../../lib/connected-studio.mjs';
import type { StudioClipUsage } from '../../lib/studio-policy.mjs';
import { slotCaption, type ClipGroup } from '../../lib/studio-layout.mjs';
export type CardData = Record<string, unknown> & { group:ClipGroup; slot:ClipSlot; clips:VideoEntry[]; boundId:string; boundIds:string[]; busy:boolean;
  localPreviewUrl?:string; usage?:StudioClipUsage; usageChanged?:boolean;
  variants:{id:string;label:string}[]; variantId:string; selectedId:string; onSelect:(id:string)=>void; onSlot:(id:string)=>void;
  onVariant:(id:string)=>void; onBind:()=>void; onUnbind?:()=>void; onFile:(file:File)=>void; onSettings:()=>void; };
export type CardNode = Node<CardData, 'registeredClip'>;
export function ConnectedClipCard({ data }:NodeProps<CardNode>) {
  const [drag,setDrag]=useState(false),[preview,setPreview]=useState(false),[library,setLibrary]=useState(false);
  const selected=data.clips.find(row=>row.id===data.selectedId);
  const image=data.slot.eventId==='roulette.reference',intake=data.slot.intakeOnly,planned=data.slot.planned;
  const wheelStart=data.slot.game==='roulette'&&data.slot.eventId==='roulette.wheel-start';
  useEffect(()=>setPreview(false),[selected?.id]);
  const ready=Boolean(selected&&(data.usage?.configured??data.boundIds.includes(selected.id)));
  const ruleEditor=!intake&&data.slot.game!=='roulette'&&data.slot.sourceType!=='speak';
  return <article className={`studio-clip-card ${drag?'is-dragging':''}`} style={{'--clip-color':data.group.color} as CSSProperties}
    aria-label={`${data.group.title} ${data.group.subtitle}`} data-slot={data.slot.id} data-card={data.group.id}
    onDragOver={event=>{event.preventDefault();event.stopPropagation();if(!data.busy)setDrag(true);}} onDragLeave={()=>setDrag(false)}
    onDrop={event=>{event.preventDefault();event.stopPropagation();setDrag(false);const file=event.dataTransfer.files[0];if(file&&!data.busy)data.onFile(file);}}>
    <header className="studio-card-heading"><span className="studio-card-dot"/><strong>{data.group.title}</strong><span>{data.group.subtitle}</span></header>
    <div className="studio-card-body nodrag nowheel">
      <section className="studio-card-situation"><span className="studio-card-eyebrow">Situation</span><h2>{slotCaption(data.slot)}</h2><p>{data.usage?.when||data.slot.description}</p></section>
      <div className="studio-card-media-row"><div className="studio-card-video">{data.localPreviewUrl?<img src={data.localPreviewUrl} alt="Tillfällig lokal VILA-bild"/>:selected&&image?<img src={selected.previewUrl} alt={selected.label}/>:selected&&preview?<video key={selected.id} src={selected.previewUrl} controls muted playsInline autoPlay preload="metadata"/>
        :<button disabled={!selected} aria-label={`Förhandsvisa ${data.group.subtitle}`} onClick={()=>setPreview(true)}>{selected?<Play size={20}/>:<Film size={20}/>}<span>{selected?'Spela':'Video'}</span></button>}</div>
        <div className="studio-card-summary"><span className="studio-card-eyebrow">{image?'Bild':'Klipp / tagning'}</span>
          <p title={selected?.label}>{selected?.label??(planned?'Återstår att ansluta':image?'Dra in en PNG':'Dra in ett klipp')}</p>
          <span className={`studio-card-status ${ready?'is-ready':''}`}>{ready?<Check size={11}/>:<span className="studio-empty-dot"/>}{data.busy?'Bearbetar…':data.localPreviewUrl?'Lokalt prov · inte sparat':planned?'Planerat fack':intake?data.clips.length?'Registrerat · ej spelkopplat':'Material saknas':ready?data.usageChanged?'Ändrat lokalt · ej sparat':'Kopplat i sparat utkast':selected?'Valt för prov · ej kopplat':'Ingen tagning vald'}</span></div></div>
      {data.group.slots.length>1&&<label className="studio-card-select">Situation<select aria-label={`Kortvariant ${data.group.id}`} value={data.slot.id} disabled={data.busy} onChange={event=>data.onSlot(event.target.value)}>{data.group.slots.map(slot=><option key={slot.id} value={slot.id}>{slotCaption(slot)}</option>)}</select></label>}
      {data.variants.length>1&&<label className="studio-card-select">Kopplingsplats<select aria-label={`Variant ${data.slot.id}`} value={data.variantId} disabled={data.busy} onChange={event=>data.onVariant(event.target.value)}>{data.variants.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>}
      {library&&<label className="studio-card-select">Tagning i biblioteket<select aria-label={`Befintligt klipp ${data.slot.id}`} value={data.selectedId} disabled={data.busy} onChange={event=>data.onSelect(event.target.value)}><option value="">Välj registrerad video…</option>{data.clips.map(row=><option key={row.id} value={row.id}>{row.label}{data.boundIds.includes(row.id)?' · kopplad':''}</option>)}</select></label>}
      {!planned&&<div className="studio-card-actions"><button disabled={data.busy} onClick={()=>setLibrary(!library)}><Film size={12}/>{library?'Stäng bibliotek':'Välj befintligt'}</button>
        {data.slot.sourceType==='speak'?<button disabled={data.busy} onClick={data.onSettings}>Talset</button>:<label><Upload size={12}/>{data.slot.localOnly?'Prova PNG lokalt':'Ladda upp'}<input aria-label={`${data.slot.localOnly?'Prova lokalt':'Ladda upp'} ${data.slot.id}`} type="file" accept={image?'.png,image/png':'.mp4,.webm,video/mp4,video/webm'} disabled={data.busy} onChange={event=>{const file=event.target.files?.[0];if(file)data.onFile(file);event.target.value='';}}/></label>}</div>}
      {wheelStart&&<button disabled={data.busy} className="studio-card-bind" onClick={data.onSettings}>Kalibrera startfilm</button>}
      {selected&&data.slot.game==='roulette'&&data.slot.eventId==='roulette.idle'&&<button disabled={data.busy} className="studio-card-bind" onClick={data.onSettings}>Granska poser och inramning</button>}
      {selected&&!wheelStart&&!intake&&!ready&&<button disabled={data.busy} className="studio-card-bind" onClick={data.onBind}>Koppla till utkast</button>}
      {selected&&!wheelStart&&data.slot.game==='roulette'&&!intake&&data.boundIds.includes(selected.id)&&data.onUnbind&&<button disabled={data.busy} className="studio-card-bind" onClick={data.onUnbind}>Ta bort koppling</button>}
      <section className="studio-card-rule" aria-label={`Körregel ${data.slot.id}`}><h3>Körregel · projektutkast</h3>
        {(data.usage?.rules??['Välj en tagning för att se dess körregel.']).map(rule=><p key={rule}>{rule}</p>)}
        {data.usageChanged&&<p className="studio-card-rule-dirty">Regeln eller kopplingen har ändrats lokalt.</p>}
        {ruleEditor&&<button disabled={data.busy} className="studio-card-bind" onClick={data.onSettings}>Redigera körregel</button>}
      </section>
      {selected&&<details className="studio-card-identity"><summary>Filidentitet</summary><dl><dt>ID</dt><dd>{selected.id}</dd><dt>Format</dt><dd>{selected.contentType||'Ej angivet'}</dd><dt>SHA-256</dt><dd>{selected.sha256||'Inte tillgänglig i registret'}</dd></dl></details>}
    </div><footer><span>{planned?'Spelkoppling återstår':image?'PNG · VILA':data.slot.sourceType==='speak'?'Exakt ljud + talvideo':drag?'Släpp videon här':'Släpp video på kortet'}</span><span>{data.clips.length} filer</span></footer>
  </article>;
}
