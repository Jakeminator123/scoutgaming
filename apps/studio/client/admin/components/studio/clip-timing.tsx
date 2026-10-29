'use client';
import {useRef,useState} from 'react';
import {Timer} from 'lucide-react';
import type {VideoEntry,VideoInventory} from '../../lib/connected-studio.mjs';
import {measureClipTiming,measureClipsInOrder,timingMeasurable,timingMeasured,unmeasuredClips} from '../../lib/media-timing.mjs';
import {Badge,Button,plural} from '../ui/kit';

// Per klipp i detaljpanelen: "Uppmätt" eller knappen Mät speltid. Mätningen ger inget bild- eller talgodkännande.
export function ClipTimingAction({video,disabled=false,onMeasured,onBusyChange,fetchImpl}:{video:VideoEntry|undefined;disabled?:boolean;onMeasured?:(video:VideoEntry)=>void;onBusyChange?:(busy:boolean)=>void;fetchImpl?:typeof fetch}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false);
  if(!video)return null;
  if(timingMeasured(video))return <Badge tone="ok" dot title="Speltiden är uppmätt för klippets aktuella fil">Uppmätt</Badge>;
  if(!timingMeasurable(video))return null;
  async function measure(){
    if(lock.current||disabled||!video)return;
    lock.current=true;setBusy(true);setError('');onBusyChange?.(true);
    try{onMeasured?.(await measureClipTiming(video,fetchImpl?{fetchImpl}:{}));}
    catch(cause){setError((cause as Error)?.message||'Mätningen kunde inte bekräftas.');}
    finally{lock.current=false;setBusy(false);onBusyChange?.(false);}
  }
  return <span className="inline-flex flex-wrap items-center gap-2">
    <Button size="sm" data-action="measure-timing" disabled={disabled||busy} onClick={()=>void measure()}><Timer aria-hidden="true"/>{busy?'Mäter…':'Mät speltid'}</Button>
    {error&&<span role="alert" className="text-xs text-sg-danger">{error}</span>}
  </span>;
}

// På dealernavet: mät dealerns omätta klipp ett i taget, med räknare och en lista över klipp som inte gick att mäta.
export function DealerTimingAction({inventory,dealerId,disabled=false,onDone,fetchImpl}:{inventory:VideoInventory|null|undefined;dealerId:string;disabled?:boolean;onDone?:(measured:number)=>void;fetchImpl?:typeof fetch}) {
  const [progress,setProgress]=useState<{done:number;total:number}|null>(null);
  const [failed,setFailed]=useState<{id:string;label:string;message:string}[]>([]);
  const [summary,setSummary]=useState('');
  const lock=useRef(false);
  const pending=unmeasuredClips(inventory,dealerId),count=pending.length;
  async function run(){
    if(lock.current||disabled||!count)return;
    lock.current=true;setFailed([]);setSummary('');setProgress({done:0,total:count});
    try{
      const result=await measureClipsInOrder(pending,{...(fetchImpl?{fetchImpl}:{}),onProgress:({done,total})=>setProgress({done,total})});
      setFailed(result.failed);
      setSummary(plural(result.measured.length,'klipp','klipp')+' uppmätta'+(result.failed.length?', '+plural(result.failed.length,'klipp','klipp')+' kunde inte mätas.':'.'));
      if(result.measured.length)onDone?.(result.measured.length);
    }finally{lock.current=false;setProgress(null);}
  }
  return <div className="grid gap-1.5">
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button size="sm" data-action="measure-unmeasured" disabled={disabled||Boolean(progress)||count===0} onClick={()=>void run()}><Timer aria-hidden="true"/>{progress?`Mäter ${progress.done}/${progress.total}…`:`Mät omätta klipp (${count})`}</Button>
      {!progress&&count===0&&<span className="text-xs text-sg-muted">Alla klipp som kan mätas är uppmätta.</span>}
    </span>
    {progress&&<p role="status" className="m-0 text-xs text-sg-muted">{progress.done} av {progress.total} klar. Klippen mäts ett i taget.</p>}
    {summary&&<p role="status" className="m-0 text-xs text-sg-muted">{summary}</p>}
    {failed.length>0&&<ul role="alert" className="m-0 grid gap-0.5 pl-4 text-xs text-sg-danger">{failed.map(row=><li key={row.id}>{row.label}: {row.message}</li>)}</ul>}
  </div>;
}
