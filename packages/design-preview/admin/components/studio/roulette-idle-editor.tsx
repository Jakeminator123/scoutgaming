"use client"
import {useEffect,useState} from 'react';
import {validateProject,type StudioProject} from '../../../../presentation/contracts/studio-model.mjs';
import type {VideoEntry,VideoInventory} from '../../lib/connected-studio.mjs';
import {setRouletteIdleForeground} from '../../lib/roulette-clip-map.mjs';
import {RouletteMediaReview} from './roulette-media-review';

export function RouletteIdleEditor({project,inventory,video,dealerId,blocked,onEdit,onSaved,onBusyChange,onDirtyChange}:{
  project:StudioProject;inventory:VideoInventory;video:VideoEntry;dealerId:string;blocked:boolean;
  onEdit:(project:StudioProject)=>void;onSaved:(inventory:VideoInventory)=>void;onBusyChange:(busy:boolean)=>void;onDirtyChange:(dirty:boolean)=>void;
}) {
  const binding=project.dealers.find(row=>row.id===dealerId)?.rouletteIdle;
  const isBase=binding?.videoId===video.id;
  const saved=isBase&&binding?.foregroundPolygons?JSON.stringify(binding.foregroundPolygons):'';
  const [polygons,setPolygons]=useState(saved),[reviewDirty,setReviewDirty]=useState(false);
  const dirty=polygons!==saved;
  useEffect(()=>{onDirtyChange(dirty||reviewDirty);},[dirty,reviewDirty,onDirtyChange]);
  useEffect(()=>()=>onDirtyChange(false),[onDirtyChange]);
  let candidate:StudioProject|undefined,error='';
  if(isBase)try{candidate=validateProject(setRouletteIdleForeground(project,inventory,dealerId,video.id,polygons));}catch(cause){error=(cause as Error).message;}
  return <div className="space-y-4">
    <RouletteMediaReview video={video} dealerId={dealerId} blocked={blocked} onSaved={onSaved} onBusyChange={onBusyChange} onDirtyChange={setReviewDirty}/>
    {isBase?<fieldset disabled={blocked} className="space-y-2" aria-label="Roulette-grundloopens handregion">
      <label className="studio-field">Kalibrerad handregion (JSON, valfritt)<textarea rows={4} value={polygons} onChange={event=>setPolygons(event.target.value)}/></label>
      <p>Gäller exakt denna grundloop och dess kopplade varianter med samma inramning. Punkter 0–1 i filmens bildyta. Tomt fält tar bort masken. Ny grundfilm rensar tidigare mask.</p>
      {error&&<p role="alert" className="text-sg-red">{error}</p>}
      <button className="studio-button" disabled={!dirty||!candidate||reviewDirty} onClick={()=>{if(candidate&&!reviewDirty){onEdit(candidate);setPolygons(candidate.dealers.find(row=>row.id===dealerId)?.rouletteIdle?.foregroundPolygons?JSON.stringify(candidate.dealers.find(row=>row.id===dealerId)!.rouletteIdle!.foregroundPolygons):'');}}}>Lägg handregion i utkast</button>
      <p>Spara projektutkastet och publicera berörda rum separat. Ingen handregion fylls i automatiskt.</p>
    </fieldset>:<p>Koppla filmen som roulette-grundloop på kortet för att ange dess handregion. Glasögonvarianter delar grundloopens mask.</p>}
  </div>;
}
