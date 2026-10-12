"use client"
import { useState, useEffect } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Film, Upload } from 'lucide-react';
import type { ClipSlot, VideoEntry } from '../../lib/connected-studio.mjs';

export type CardData = Record<string, unknown> & { slot:ClipSlot; clips:VideoEntry[]; boundId:string; boundIds:string[]; busy:boolean;
  variants:{id:string;label:string}[]; variantId:string; selectedId:string; onSelect:(id:string)=>void;
  onVariant:(id:string)=>void; onBind:()=>void; onFile:(file:File)=>void; };
export type CardNode = Node<CardData, 'registeredClip'>;
export function ConnectedClipCard({ data }:NodeProps<CardNode>) {
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState(false);
  const selected = data.clips.find(row => row.id === data.selectedId);
  useEffect(() => setPreview(false), [selected?.id]);
  const ready = data.clips.some(row => data.boundIds.includes(row.id));
  return <article className={`w-[296px] overflow-hidden rounded-lg border bg-sg-panel shadow-xl ${drag ? 'border-sg-lime' : 'border-sg-line'}`}
    aria-label={`${data.slot.title} ${data.slot.situation}`} data-slot={data.slot.id}
    onDragOver={event => { if (data.busy) return; event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
    onDrop={event => { event.preventDefault(); event.stopPropagation(); setDrag(false); const file = event.dataTransfer.files[0]; if (file && !data.busy) data.onFile(file); }}>
    <Handle type="target" position={Position.Left} isConnectable={false} className="!bg-sg-muted" />
    <header className="border-b border-sg-line p-3"><p className="font-mono text-[10px] uppercase text-sg-teal">{data.slot.sourceType} · {data.slot.situation || 'standard'}</p>
      <h2 className="mt-1 text-sm font-semibold">{data.slot.title}</h2>
      <p className={`mt-1 text-xs ${ready ? 'text-sg-lime' : 'text-sg-amber'}`}>{data.busy ? 'Bearbetar…' : ready ? `Redo · ${data.boundIds.length} registrerade kopplingar` : 'Tomt · ingen verifierad koppling'}</p></header>
    <div className="nodrag nowheel space-y-3 p-3">
      <div className="flex h-36 items-center justify-center overflow-hidden rounded border border-sg-line bg-sg-bg">
        {selected && preview ? <video key={selected.id} src={selected.previewUrl} controls muted playsInline autoPlay preload="metadata" className="h-full w-full object-contain" />
          : <button className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-sg-muted" disabled={!selected} onClick={() => setPreview(true)}><Film size={24}/>{selected ? 'Förhandsvisa valt klipp' : 'Välj eller dra in video'}</button>}
      </div>
      {data.variants.length > 1 && <label className="block text-xs">Variant<select aria-label={`Variant ${data.slot.id}`} value={data.variantId} disabled={data.busy} onChange={event => data.onVariant(event.target.value)} className="mt-1 w-full rounded border border-sg-line bg-sg-bg p-2">{data.variants.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>}
      <label className="block text-xs">Registrerade klipp<select aria-label={`Klipp ${data.slot.id}`} value={data.selectedId} disabled={data.busy} onChange={event => data.onSelect(event.target.value)} className="mt-1 w-full rounded border border-sg-line bg-sg-bg p-2">
        <option value="">Välj ett klipp</option>{data.clips.map(row => <option key={row.id} value={row.id}>{row.label}{data.boundIds.includes(row.id) ? ' · kopplad' : ''}</option>)}
      </select></label>
      <button onClick={data.onBind} disabled={data.busy || !selected || data.boundIds.includes(selected.id)} className="w-full rounded border border-sg-lime/50 p-2 text-xs text-sg-lime disabled:opacity-40">{data.slot.family&&data.slot.eventId!=='idle.ready'?'Aktivera alternativ i utkast':'Koppla klipp till utkast'}</button>
      {data.slot.family&&data.slot.eventId!=='idle.ready'&&<p className="text-[10px] text-sg-muted">Originalet är fast. Flera alternativ kan vara aktiva; deras befintliga villkor behålls.</p>}
      {data.slot.sourceType === 'speak' ? <p className="text-[10px] text-sg-amber">Taluppladdning kräver en separat uppsättning med exakt text, ljud, video och acceptans. Den är inte ansluten här ännu.</p> : <label className={`flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-sg-line p-2 text-xs text-sg-muted ${data.busy ? 'pointer-events-none opacity-40' : ''}`}><Upload size={14}/> Välj eller dra in video<input aria-label={`Ladda upp ${data.slot.id}`} type="file" accept=".mp4,.webm,video/mp4,video/webm" disabled={data.busy} className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) data.onFile(file); event.target.value = ''; }}/></label>}
      <p className="text-[10px] leading-relaxed text-sg-muted">{data.slot.description}</p>
    </div><Handle type="source" position={Position.Right} isConnectable={false} className="!bg-sg-lime" />
  </article>;
}
