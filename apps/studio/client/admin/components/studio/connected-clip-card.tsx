"use client"
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Film, Upload, Check } from 'lucide-react';
import type { NodeProps, Node } from '@xyflow/react';
import { ClipGuide } from './clip-guide';
import type { ClipSlot, VideoEntry } from '../../lib/connected-studio.mjs';
import type { StudioClipUsage } from '../../lib/studio-policy.mjs';
import { slotCaption, slotExplanation, isRenderedOutcome, type ClipGroup, type ClipLibraryGroup } from '../../lib/studio-layout.mjs';
export type CardData = Record<string, unknown> & { group:ClipGroup; slot:ClipSlot; clips:VideoEntry[]; boundId:string; boundIds:string[]; busy:boolean;
  localPreviewUrl?:string; usage?:StudioClipUsage; usageChanged?:boolean; active?:boolean; onOpen?:()=>void;
  library?:ClipLibraryGroup[]; variants:{id:string;label:string;baseline?:boolean}[]; variantId:string; selectedId:string; onSelect:(id:string)=>void; onSlot:(id:string)=>void;
  onVariant:(id:string)=>void; onBind:()=>void; onUnbind?:()=>void; onFile:(file:File)=>void; onSettings:()=>void; };
export type CardNode = Node<CardData, 'registeredClip'>;
export function ConnectedClipDetails({ data, settingsOpen=false, active=true }:{data:CardData;settingsOpen?:boolean;active?:boolean}) {
  const [drag,setDrag]=useState(false);
  const selected=data.clips.find(row=>row.id===data.selectedId);
  const recording=selected?.classification?.recordedSpeech;
  const preview=useRef<HTMLVideoElement|null>(null);
  useEffect(()=>{
    const video=preview.current;
    if(!video)return;
    const pauseWhenHidden=()=>{if(!active||document.hidden)video.pause();};
    pauseWhenHidden();
    document.addEventListener('visibilitychange',pauseWhenHidden);
    return()=>{document.removeEventListener('visibilitychange',pauseWhenHidden);video.pause();};
  },[active,selected?.id,selected?.previewUrl,data.localPreviewUrl]);
  const image=data.slot.eventId==='roulette.reference',intake=data.slot.intakeOnly,planned=data.slot.planned;
  const wheelStart=data.slot.game==='roulette'&&data.slot.eventId==='roulette.wheel-start';
  if(isRenderedOutcome(data.slot))return <article className="studio-clip-detail" style={{'--clip-color':data.group.color} as CSSProperties} aria-label={`${data.group.title} ${data.group.subtitle}`} data-slot={data.slot.id} data-card={data.group.id}>
    <header className="studio-card-heading"><span className="studio-card-dot"/><strong>{data.group.title}</strong><span>{data.group.subtitle}</span></header>
    <div className="studio-card-body nodrag nowheel"><section className="studio-card-situation"><span className="studio-card-eyebrow">Fack</span><h2>{slotCaption(data.slot)}</h2><p>{slotExplanation(data.slot)}</p></section>
      <p className="studio-card-status is-ready">Ritas i spelet · ingen film behövs</p>
      <section className="studio-card-rule" aria-label="Hjulets funktion"><h3>Hjul och kula</h3><p>Anna-bordet ritar de 37 numren och kulan. Spelservern bestämmer det vinnande numret; ingen separat film per nummer ska laddas upp.</p></section>
      <details className="studio-card-identity"><summary>Tekniska detaljer</summary><p>{data.slot.description}</p></details>
    </div><footer><span>Serverstyrt utfall</span><span>0–36</span></footer>
  </article>;
  const exactBinding=!data.slot.family&&data.slot.eventId!=='idle.ready'&&data.slot.game!=='roulette';
  const ready=Boolean(selected&&(exactBinding?selected.id===data.boundId:(data.usage?.configured??data.boundIds.includes(selected.id))));
  const ruleEditor=!intake&&data.slot.game!=='roulette'&&data.slot.sourceType!=='speak';
  return <article className={`studio-clip-detail ${drag?'is-dragging':''}`} style={{'--clip-color':data.group.color} as CSSProperties}
    aria-label={`${data.group.title} ${data.group.subtitle}`} data-slot={data.slot.id} data-card={data.group.id}
    onDragOver={event=>{event.preventDefault();event.stopPropagation();if(!data.busy)setDrag(true);}} onDragLeave={()=>setDrag(false)}
    onDrop={event=>{event.preventDefault();event.stopPropagation();setDrag(false);const file=event.dataTransfer.files[0];if(file&&!data.busy)data.onFile(file);}}>
    <header className="studio-card-heading"><span className="studio-card-dot"/><strong>{data.group.title}</strong><span>{data.group.subtitle}</span></header>
    <div className="studio-card-body nodrag nowheel">
      <section className="studio-card-situation"><span className="studio-card-eyebrow">Situation</span><h2>{slotCaption(data.slot)}</h2><p>{slotExplanation(data.slot)}</p></section>
      {data.group.slots.length>1&&<label className="studio-card-select">Situation<select aria-label={`Situation i ${data.group.title}`} value={data.slot.id} disabled={data.busy} onChange={event=>data.onSlot(event.target.value)}>{data.group.slots.map(slot=><option key={slot.id} value={slot.id}>{slotCaption(slot)}</option>)}</select></label>}
      <ClipGuide slot={data.slot}/><p className="studio-preview-caption">Klippförhandsvisning · visar den valda filen, inte ett prov i spelmotorn.</p>
      <div className="studio-card-media-row"><div className="studio-card-video">{data.localPreviewUrl?<img src={data.localPreviewUrl} alt="Tillfällig lokal VILA-bild"/>:selected&&image?<img src={selected.previewUrl} alt={selected.label}/>:selected?<video ref={preview} key={selected.id} src={selected.previewUrl} controls muted playsInline preload="metadata" aria-label={`Förhandsvisa ${selected.label}`} onPlay={event=>{if(!active||document.hidden)event.currentTarget.pause();}}/>
        :<div className="studio-preview-empty"><Film size={28}/><span>Välj ett klipp för att förhandsvisa</span></div>}</div>
        <div className="studio-card-summary"><span className="studio-card-eyebrow">{image?'Bild':'Valt klipp'}</span>
          <p title={selected?.label}>{selected?.label??(planned?'Återstår att ansluta':image?'Dra in en PNG':'Dra in ett klipp')}</p>
          <span className={`studio-card-status ${ready?'is-ready':''}`}>{ready?<Check size={11}/>:<span className="studio-empty-dot"/>}{data.busy?'Bearbetar…':data.localPreviewUrl?'Lokalt prov · inte sparat':planned?'Planerat fack':intake?data.clips.length?'Registrerat · ej spelkopplat':'Material saknas':ready?data.usageChanged?'Ändrat lokalt · ej sparat':'Kopplat i sparat utkast':selected?exactBinding?'Valt för prov · ej kopplat till vald variant':'Valt för prov · ej kopplat':'Ingen tagning vald'}</span></div></div>
      {recording&&<section className="studio-recorded-speech" aria-label="Inspelad replik"><strong>Inspelat tal · originalets ljud</strong><p>{recording.exactText}</p><small>Språk: {recording.language}. Text, ljud och video hör ihop; ny generering är ett separat val i Röst &amp; tal.</small></section>}
      {data.variants.length>1&&<label className="studio-card-select">Standard och varianter<select aria-label={`Variant ${data.slot.id}`} value={data.variantId} disabled={data.busy} onChange={event=>data.onVariant(event.target.value)}>{data.variants.map(row=><option key={row.id} value={row.id}>{row.baseline?'Standardklipp':row.label}</option>)}</select></label>}
      {!planned&&data.slot.game!=='roulette'&&data.library?.length?<div className="studio-clip-library" aria-label="Klipp i vald situation">{data.library.map(group=><section key={group.id}><h3>{group.label}<span>{group.clips.length}</span></h3><div>{group.clips.map(clip=><button key={clip.id} type="button" disabled={data.busy} aria-pressed={clip.id===data.selectedId} onClick={()=>data.onSelect(clip.id)}><Film size={15} aria-hidden="true"/><span>{clip.label}<small>{clip.id===data.selectedId?'Visas i förhandsvisningen':data.boundIds.includes(clip.id)?'Ingår i utkastet':'Välj för att förhandsvisa'}</small></span></button>)}</div></section>)}</div>:!planned&&<label className="studio-card-select">Välj klipp<select aria-label={`Befintligt klipp ${data.slot.id}`} value={data.selectedId} disabled={data.busy} onChange={event=>data.onSelect(event.target.value)}><option value="">Välj registrerad video…</option>{data.clips.map(row=><option key={row.id} value={row.id}>{row.label}{data.boundIds.includes(row.id)?' · används i utkast':''}</option>)}</select></label>}
      {!planned&&<div className="studio-card-actions">
        {data.slot.sourceType==='speak'?<button disabled={data.busy} onClick={data.onSettings}>Talset</button>:<label><Upload size={12}/>{data.slot.localOnly?'Prova PNG lokalt':'Ladda upp'}<input aria-label={`${data.slot.localOnly?'Prova lokalt':'Ladda upp'} ${data.slot.id}`} type="file" accept={image?'.png,image/png':'.mp4,.webm,video/mp4,video/webm'} disabled={data.busy} onChange={event=>{const file=event.target.files?.[0];if(file)data.onFile(file);event.target.value='';}}/></label>}</div>}
      {wheelStart&&!settingsOpen&&<button disabled={data.busy} className="studio-card-bind" onClick={data.onSettings}>Kalibrera startfilm</button>}
      {selected&&!settingsOpen&&data.slot.game==='roulette'&&data.slot.eventId==='roulette.idle'&&<button disabled={data.busy} className="studio-card-bind" onClick={data.onSettings}>Granska poser och inramning</button>}
      {selected&&!wheelStart&&!intake&&!ready&&<button disabled={data.busy} className="studio-card-bind" onClick={data.onBind}>Koppla till utkast</button>}
      {selected&&!wheelStart&&data.slot.game==='roulette'&&!intake&&data.boundIds.includes(selected.id)&&data.onUnbind&&<button disabled={data.busy} className="studio-card-bind" onClick={data.onUnbind}>Ta bort koppling</button>}
      <section className="studio-card-rule" aria-label={`Körregel ${data.slot.id}`}><h3>Körregel · projektutkast</h3>
        {(data.usage?.rules??['Välj ett klipp för att se dess körregel.']).map(rule=><p key={rule}>{rule}</p>)}
        {data.usageChanged&&<p className="studio-card-rule-dirty">Regeln eller kopplingen har ändrats lokalt.</p>}
        {ruleEditor&&!settingsOpen&&<button disabled={data.busy} className="studio-card-bind" onClick={data.onSettings}>Redigera körregel</button>}
      </section>
      <details className="studio-card-identity"><summary>Tekniska detaljer</summary><p>{data.usage?.when||data.slot.description}</p>{selected&&<dl><dt>ID</dt><dd>{selected.id}</dd><dt>Format</dt><dd>{selected.contentType||'Ej angivet'}</dd><dt>SHA-256</dt><dd>{selected.sha256||'Inte tillgänglig i registret'}</dd></dl>}</details>
    </div><footer><span>{planned?'Spelkoppling återstår':image?'PNG · VILA':data.slot.sourceType==='speak'?'Exakt ljud + talvideo':drag?'Släpp videon här':'Släpp video på kortet'}</span><span>{data.clips.length} filer</span></footer>
  </article>;
}


export function ConnectedClipCard({data}:NodeProps<CardNode>) {
  const [drag,setDrag]=useState(false);
  const selected=data.clips.find(row=>row.id===data.selectedId);
  const exactBinding=!data.slot.family&&data.slot.eventId!=='idle.ready'&&data.slot.game!=='roulette';
  const ready=Boolean(selected&&(exactBinding?selected.id===data.boundId:(data.usage?.configured??data.boundIds.includes(selected.id))));
  const rendered=isRenderedOutcome(data.slot);
  return <article className={`studio-clip-card studio-map-card ${data.active?'is-selected':''} ${drag?'is-dragging':''}`} style={{'--clip-color':data.group.color} as CSSProperties} aria-label={`${data.group.title} ${data.group.subtitle}`} data-slot={data.slot.id} data-card={data.group.id}
    onDragOver={event=>{event.preventDefault();event.stopPropagation();if(!data.busy&&!rendered)setDrag(true);}} onDragLeave={()=>setDrag(false)}
    onDrop={event=>{event.preventDefault();event.stopPropagation();setDrag(false);const file=event.dataTransfer.files[0];if(file&&!data.busy&&!rendered)data.onFile(file);}}>
    <header className="studio-card-heading"><span className="studio-card-dot"/><strong>{data.group.title}</strong><span>{data.group.subtitle}</span></header>
    <div className="studio-card-body nodrag nowheel">
      <h2>{slotCaption(data.slot)}</h2>
      <p className="studio-map-card-description">{slotExplanation(data.slot)}</p>
      {data.slot.game!=='roulette'&&data.group.slots.length>1&&data.group.slots.length<=7&&<div className="studio-slot-choices" role="group" aria-label={`Situation i ${data.group.title}`}>{data.group.slots.map(slot=><button key={slot.id} type="button" disabled={data.busy} aria-pressed={slot.id===data.slot.id&&Boolean(data.active)} onClick={()=>data.onSlot(slot.id)}>{slotCaption(slot)}</button>)}</div>}
      <p className="studio-map-card-file">{selected?.label??(rendered?'Ritas i spelet':data.slot.planned?'Planerat fack':'Inget klipp valt')}</p>
      <p className={`studio-card-status ${ready||rendered?'is-ready':''}`}>{data.busy?'Bearbetar…':rendered?'Serverstyrt utfall':data.localPreviewUrl?'Lokalt prov · inte sparat':data.slot.planned?'Planerat fack':data.slot.intakeOnly?data.clips.length?'Registrerat · ej spelkopplat':'Material saknas':ready?data.usageChanged?'Ändrat lokalt · ej sparat':'Kopplat i sparat utkast':selected?exactBinding?'Valt för prov · ej kopplat till vald variant':'Valt för prov · ej kopplat':'Material saknas'}</p>
      <button id={`studio-card-open-${data.group.id}`} type="button" className="studio-card-open" aria-controls="studio-clip-inspector" disabled={data.busy} aria-expanded={Boolean(data.active)} onClick={data.onOpen}><Film size={17}/>{rendered?'Visa funktion':'Förhandsvisa och redigera'}</button>
    </div>
    <footer><span>{data.group.slots.length} fack</span><span>{data.clips.length} filer i valt fack</span></footer>
  </article>;
}
