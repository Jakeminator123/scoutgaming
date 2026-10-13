"use client"
import {useEffect,useState} from 'react';
import type {StudioProject} from '../../../../../lab/lib/studio-model.mjs';
import type {VideoInventory} from '../../lib/connected-studio.mjs';
import {rouletteClipMatches,rouletteClipSlots} from '../../lib/roulette-clip-map.mjs';
import {bindRouletteStart,removeRouletteStart,rouletteStartForm,rouletteStartTables,type RouletteStartForm} from '../../lib/roulette-start-editor.mjs';
import {RouletteMediaReview} from './roulette-media-review';

const slot=rouletteClipSlots().find(row=>row.eventId==='roulette.wheel-start')!;
export function RouletteStartEditor({project,inventory,dealerId,laneId,videoId,blocked,onEdit,onDirtyChange,onInventory,onBusyChange}:{
  project:StudioProject;inventory:VideoInventory;dealerId:string;laneId:string;videoId:string;blocked:boolean;
  onEdit:(project:StudioProject)=>void;onDirtyChange:(dirty:boolean)=>void;
  onInventory:(inventory:VideoInventory)=>void;onBusyChange:(busy:boolean)=>void;
}) {
  const [form,setForm]=useState(()=>rouletteStartForm(project,dealerId,videoId));
  const [reviewDirty,setReviewDirty]=useState(false);
  const compositions=project.lanes?.filter(lane=>lane.layers.dealer.enabled&&lane.layers.dealer.allowed.includes(dealerId))??[];
  const [tableLaneId,setTableLaneId]=useState(()=>compositions.some(lane=>lane.id===laneId)?laneId:'');
  const saved=project.dealers.find(row=>row.id===dealerId)?.rouletteStart;
  const dirty=JSON.stringify(form)!==JSON.stringify(rouletteStartForm(project,dealerId,form.videoId));
  useEffect(()=>{onDirtyChange(dirty||reviewDirty);},[dirty,reviewDirty,onDirtyChange]);
  useEffect(()=>()=>onDirtyChange(false),[onDirtyChange]);
  const videos=inventory.videos.filter(row=>rouletteClipMatches(row,dealerId,slot));
  const selected=videos.find(row=>row.id===form.videoId),metadata=selected?.classification;
  const tables=rouletteStartTables(project,tableLaneId),designs=[...new Set(tables.map(row=>row.designId))];
  let candidate:StudioProject|undefined,error='';
  try{candidate=bindRouletteStart(project,inventory,dealerId,tableLaneId,form);}catch(cause){error=(cause as Error).message;}
  const change=(key:keyof RouletteStartForm,value:string)=>setForm(current=>({...current,[key]:value}));
  return <section className="space-y-3 text-xs" aria-label="Kalibrera roulettens startfilm">
    <p>Välj granskad startfilm och dess exakta markörer. Ändringen gäller dealerns rouletteklipp i alla sammansättningar. Spara utkastet och publicera berörda rum separat.</p>
    <fieldset disabled={blocked} className="space-y-3">
      <label className="studio-field">Startfilm<select value={form.videoId} onChange={event=>{if((dirty||reviewDirty)&&!confirm('Kasta osparade formulärändringar och välj en annan film?'))return;setForm(rouletteStartForm(project,dealerId,event.target.value));}}>
        <option value="">Välj registrerad startfilm…</option>
        {form.videoId&&!selected&&<option value={form.videoId}>Otillgänglig: {form.videoId}</option>}
        {videos.map(video=><option key={video.id} value={video.id}>{video.label} · {video.id}</option>)}
      </select></label>
      {selected&&<p>Registrerad pose: {metadata?.startPose??'saknas'} → {metadata?.endPose??'saknas'}. Inramning: {metadata?.framing?`skala ${metadata.framing.scale}, x ${metadata.framing.x}, y ${metadata.framing.y}`:'saknas'}. Granska och spara filmuppgifterna nedan innan koppling.</p>}
      <label className="studio-field">Sammansättning för bordkontroll<select value={tableLaneId} onChange={event=>{setTableLaneId(event.target.value);change('tableDesignId','');}}>
        <option value="">Välj en mall som tillåter denna dealer…</option>
        {compositions.map(lane=><option key={lane.id} value={lane.id}>{lane.label} · {lane.id}</option>)}
      </select></label>
      <p>Valet kontrollerar bordets tillåtelse. Det ändrar inte rum eller mall. <a className="underline" href="/admin/compositions" target="_blank" rel="noopener">Hantera sammansättningar</a></p>
      <label className="studio-field">Tillåten borddesign<select value={form.tableDesignId} onChange={event=>change('tableDesignId',event.target.value)}>
        <option value="">Välj registrerat roulettebord…</option>
        {form.tableDesignId&&!designs.includes(form.tableDesignId)&&<option value={form.tableDesignId}>Inte tillåten här: {form.tableDesignId}</option>}
        {designs.map(id=><option key={id} value={id}>{tables.find(row=>row.designId===id)?.label} · {id}</option>)}
      </select></label>
      {form.tableDesignId&&<p>Matchande lager: {tables.filter(row=>row.designId===form.tableDesignId).map(row=>row.assetId).join(', ')||'saknas i sammansättningen'}</p>}
      {([['durationMs','Verifierad filmlängd (ms)'],['wheelImpulseMs','Hjulimpuls (ms)'],['ballReleaseMs','Kulsläpp (ms)']] as const).map(([key,label])=><label key={key} className="studio-field">{label}<input type="number" step="1" min={key==='durationMs'?1000:0} max={60000} value={form[key]} onChange={event=>change(key,event.target.value)}/></label>)}
      <details><summary>Handregion för just denna film</summary><label className="studio-field">Polygoner (JSON, valfritt)<textarea rows={3} value={form.foregroundPolygons} onChange={event=>change('foregroundPolygons',event.target.value)} /></label><p>Punkter 0–1 i filmens bildyta. Lämna tomt om ingen handregion är granskad.</p></details>
      {error&&<p role="alert" className="text-sg-red">{error}</p>}
      <button className="studio-button" disabled={!candidate||reviewDirty} onClick={()=>{if(candidate&&!reviewDirty){onEdit(candidate);setForm(rouletteStartForm(candidate,dealerId,form.videoId));}}}>Lägg startfilm i utkast</button>
      {saved&&<button className="studio-button" onClick={()=>{const next=removeRouletteStart(project,dealerId);onEdit(next);setForm(rouletteStartForm(next,dealerId,form.videoId));}}>Ta bort sparad startkoppling</button>}
    </fieldset>
    {selected&&<RouletteMediaReview key={selected.id} video={selected} dealerId={dealerId} blocked={blocked} onSaved={onInventory} onDirtyChange={setReviewDirty} onBusyChange={onBusyChange}/>}
    <p>{saved?`Kopplat i utkast: ${saved.videoId}.`:'Ingen startfilm är kopplad.'} Tider fylls aldrig från uppskattad längd. Registrering eller teknisk validering innebär inte visuellt godkännande.</p>
  </section>;
}
