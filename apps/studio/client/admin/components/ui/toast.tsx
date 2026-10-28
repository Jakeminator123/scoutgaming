'use client';
import {useEffect,useState} from 'react';
import {CheckCircle2,AlertTriangle,X} from 'lucide-react';
import {cn,focusRing} from './kit';

// Short receipts ("sparad", "publicerad") that survive navigation between Admin pages. The page that
// did the work still shows its own status and errors inline; a toast only confirms a finished step.
type Item={id:number;text:string;tone:'ok'|'warn'};
let items:Item[]=[],next=0;
const listeners=new Set<(value:Item[])=>void>();
const emit=()=>{for(const listener of listeners)listener(items);};
export function toast(text:string,{tone='ok',duration=5000}:{tone?:'ok'|'warn';duration?:number}={}) {
  const id=++next;items=[...items.slice(-3),{id,text,tone}];emit();
  if(typeof setTimeout==='function')setTimeout(()=>dismiss(id),duration);
  return id;
}
export function dismiss(id:number) { items=items.filter(row=>row.id!==id);emit(); }
/** Read-only view for tests and the region below. */
export function toasts() { return items; }

export function Toaster() {
  const [list,setList]=useState(items);
  useEffect(()=>{listeners.add(setList);return()=>{listeners.delete(setList);};},[]);
  return <div role="status" aria-live="polite" aria-label="Kvitton" className="pointer-events-none fixed bottom-4 right-4 z-[60] grid w-[min(380px,calc(100vw-32px))] gap-2">
    {list.map(row=><div key={row.id} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-sg-border bg-sg-surface px-4 py-3 text-[13.5px] text-sg-text shadow-xl animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      {row.tone==='ok'?<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sg-ok" aria-hidden="true"/>:<AlertTriangle className="mt-0.5 size-4 shrink-0 text-sg-warn" aria-hidden="true"/>}
      <span className="min-w-0 flex-1">{row.text}</span>
      <button type="button" aria-label="Stäng kvittot" onClick={()=>dismiss(row.id)} className={cn('-m-1 grid size-6 place-items-center rounded-md border-0 bg-transparent text-sg-faint hover:bg-sg-hover hover:text-sg-text',focusRing)}><X className="size-3.5" aria-hidden="true"/></button>
    </div>)}
  </div>;
}
