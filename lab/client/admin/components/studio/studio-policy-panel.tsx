"use client"

import { useEffect, useRef, useState } from 'react';
import type { StudioProject, MediaVariantPolicy } from '../../../../../lab/lib/studio-model.mjs';
import type { IdlePolicy, IdleVariantPolicy, IdleVariantUse } from '../../../../../lab/lib/idle-policy.mjs';
import { readIdleVideoDuration } from '../../../../../lab/lib/idle-video-duration.mjs';
import { selectionFor } from '../../../../../lab/lib/video-intake.mjs';
import type { VideoInventory, ClipSlot } from '../../lib/connected-studio.mjs';
import { addStudioIdleClip, applyStudioIdlePolicy, applyStudioVariantPolicy, setStudioBaseWeight, studioPolicyContext, type StudioPolicyContext } from '../../lib/studio-policy.mjs';

export type StudioPolicyPanelProps = {
  project:StudioProject; inventory:VideoInventory; dealerId:string; slot:ClipSlot; selectedVideoId?:string; selectedVariantId?:string; blocked:boolean;
  onEdit:(project:StudioProject)=>void; onBusyChange?:(busy:boolean)=>void;
};
const useLabels:Record<IdleVariantUse,string>={manual:'Manuell',automatic:'Automatisk',rules:'Regler',openclaw:'OpenClaw'};
const automatic={averageEveryMs:25000,jitterMs:5000,cooldownMs:15000,maxPerMinute:3};

export function StudioPolicyPanel(props:StudioPolicyPanelProps) {
  const {project,inventory,dealerId,slot,selectedVideoId,selectedVariantId,blocked,onEdit,onBusyChange}=props;
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[addId,setAddId]=useState(''),[selected,setSelected]=useState('');
  const operation=useRef<AbortController|null>(null), latest=useRef(props), busyCallback=useRef(onBusyChange);
  latest.current=props;busyCallback.current=onBusyChange;
  useEffect(()=>{
    setError('');setBusy(false);setAddId('');setSelected('');
    return ()=>{operation.current?.abort();operation.current=null;busyCallback.current?.(false);};
  },[dealerId,slot.id,selectedVideoId,selectedVariantId]);
  useEffect(()=>()=>{operation.current?.abort();busyCallback.current?.(false);},[]);
  let scope:StudioPolicyContext|null=null, scopeError='';
  try{scope=studioPolicyContext(project,inventory,dealerId,slot);}catch(cause){scopeError=cause instanceof Error?cause.message:'Kortplatsen kan inte redigeras.';}
  const locked=blocked||busy;
  const label=(id:string)=>project.clipLabels?.[id]||scope?.clips.find(video=>video.id===id)?.label||`Saknat klipp · ${id.slice(0,8)}`;
  function edit(action:()=>StudioProject){if(locked)return;try{const next=action();setError('');onEdit(next);}catch(cause){setError(cause instanceof Error?cause.message:'Inställningen kunde inte ändras.');}}
  function idle(policy:IdlePolicy){edit(()=>applyStudioIdlePolicy(project,inventory,dealerId,slot,policy));}
  async function add(asBase:boolean){
    if(locked||operation.current||!scope||scope.kind!=='idle')return;
    const video=scope.clips.find(row=>row.id===addId);if(!video)return;
    const original=latest.current, videoSignature=JSON.stringify(video), projectSignature=JSON.stringify(project), controller=new AbortController();operation.current=controller;
    setBusy(true);setError('');onBusyChange?.(true);
    try{
      const durationMs=await readIdleVideoDuration(video.previewUrl,{signal:controller.signal});
      const current=latest.current;
      if(controller.signal.aborted||current.blocked||current.project!==original.project||current.inventory!==original.inventory
        ||current.dealerId!==original.dealerId||current.slot.id!==original.slot.id||JSON.stringify(current.project)!==projectSignature
        ||JSON.stringify(current.inventory.videos.find(row=>row.id===video.id))!==videoSignature)return;
      const next=addStudioIdleClip(current.project,current.inventory,current.dealerId,current.slot,video.id,durationMs,asBase);
      current.onEdit(next);setAddId('');
    }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Klipplängden kunde inte läsas.');}
    finally{if(operation.current===controller){operation.current=null;setBusy(false);busyCallback.current?.(false);}}
  }
  const policy=scope?.policy;
  const choices=scope?.family?scope.clips.filter(video=>scope!.family!.variantIds.includes(video.id)).map(video=>({id:video.id,label:label(video.id)}))
    :scope?.line.variants.filter(row=>row.id!==scope!.line.baselineVariantId&&scope!.clips.some(video=>video.id===row.videoGenerationId)).map(row=>({id:row.id,label:row.label}))??[];
  const preferredId=scope?.family?selectedVideoId:scope?.line.variants.find(row=>row.id===selectedVariantId&&row.videoGenerationId===selectedVideoId)?.id
    ??scope?.line.variants.find(row=>row.videoGenerationId===selectedVideoId)?.id;
  const selectedId=choices.some(row=>row.id===selected)?selected:choices.some(row=>row.id===preferredId)?preferredId!:selectedVideoId?'':choices[0]?.id??'';
  const media=scope?.family?project.mediaPolicy?.find(row=>row.familyId===scope!.family!.id)?.variants.find(row=>row.videoId===selectedId)
    ??{videoId:selectedId,selection:{rules:false,model:false,random:false},priority:10,triggerIds:[]}:null;
  const lineVariant=scope?.line.variants.find(row=>row.id===selectedId);
  const variant=media??lineVariant;
  const selection=media?.selection??(lineVariant?selectionFor(lineVariant):{rules:false,model:false,random:false});
  function variantEdit(patch:Partial<Omit<MediaVariantPolicy,'videoId'>>){edit(()=>applyStudioVariantPolicy(project,inventory,dealerId,slot,selectedId,patch));}
  const saved=scope?.family?project.mediaPolicy?.find(row=>row.familyId===scope!.family!.id)?.variants??[]:[];
  const percent=media?.frequencyPercent??0,total=saved.reduce((sum,row)=>sum+(row.frequencyPercent??0),0);
  const unavailableShare=saved.filter(row=>!scope?.clips.some(video=>video.id===row.videoId)).reduce((sum,row)=>sum+(row.frequencyPercent??0),0);
  const activeFrequency=saved.filter(row=>(row.frequencyPercent??0)>0).length;
  const legacyFrequency=Boolean(scope?.frequency&&!saved.some(row=>row.frequencyPercent!==undefined)&&saved.some(row=>Object.values(row.selection).some(Boolean)));
  const addChoices=scope?.clips.filter(video=>!policy||![...policy.base,...policy.variants].some(row=>row.videoId===video.id))??[];
  const baseAllowed=(id:string)=>!scope?.global||Boolean(scope.family?.standardIds.includes(id));
  const variationAllowed=(id:string)=>!scope?.global||Boolean(scope.family?.variantIds.includes(id));

  return <section aria-label={`Policy för ${slot.title}`} className="studio-policy-panel">
    <header className="mb-3"><h2 className="text-sm font-semibold">Klippregler · {slot.title}</h2><p className="mt-1 text-[11px] text-sg-muted">Ändrar denna situation i projektutkastet. Rumspublicering sker separat. OpenClaw-val visar tillåtet urval, inte en verifierad triggeranslutning.</p></header>
    {scopeError?<p role="alert" className="text-xs text-sg-amber">{scopeError}</p>:scope&&<fieldset disabled={locked} className="min-w-0 border-0 p-0" aria-busy={busy}>
      {scope.kind==='idle'?<>
        {policy?<>
          <h3 className="mb-2 text-xs font-semibold">Basklipp · totalt 100 %</h3>
          {policy.base.map((item,index)=><div key={item.videoId} className="mb-2 rounded border border-sg-line p-2">
            <div className="flex items-center gap-2 text-xs"><span className="min-w-0 flex-1 truncate">{label(item.videoId)}</span><span className="text-sg-muted">{(item.durationMs/1000).toFixed(2)} s</span>
              {index===0?<span className="text-[10px] text-sg-lime">Huvudklipp</span>:<button type="button" className="studio-button" onClick={()=>idle({...policy,base:[item,...policy.base.filter(row=>row.videoId!==item.videoId)]})}>Gör huvudklipp</button>}
            </div>
            <Numeric label={`Andel för ${label(item.videoId)}`} value={item.weight} min={1} max={100-policy.base.length+1} suffix="%" disabled={policy.base.length===1}
              onChange={weight=>{try{idle(setStudioBaseWeight(policy,item.videoId,weight));}catch(cause){setError(cause instanceof Error?cause.message:'Ogiltig andel.');}}}/>
            {policy.base.length>1&&<button type="button" className="mt-1 text-[10px] text-sg-muted hover:text-sg-text" onClick={()=>{
              const base=policy.base.filter(row=>row.videoId!==item.videoId).map(row=>({...row}));base[0].weight+=item.weight;idle({...policy,base});
            }}>Ta bort ur baspoolen</button>}
          </div>)}
          <h3 className="mb-2 mt-4 text-xs font-semibold">Variationer</h3>
          {!policy.variants.length&&<p className="text-[11px] text-sg-muted">Inga variationer i schemat.</p>}
          {policy.variants.map(item=><IdleVariant key={item.videoId} item={item} label={label(item.videoId)}
            onChange={patch=>idle({...policy,variants:policy.variants.map(row=>row.videoId===item.videoId?{...row,...patch}:row)})}
            onRemove={()=>idle({...policy,variants:policy.variants.filter(row=>row.videoId!==item.videoId)})}/>)}
        </>:<p className="mb-3 text-xs text-sg-muted">Välj ett registrerat grundloopsklipp för att skapa schemat.</p>}
        <div className="mt-3 flex flex-col gap-2 border-t border-sg-line pt-3">
          <label className="studio-field"><span>Lägg till grundloopsklipp</span><select value={addId} onChange={event=>setAddId(event.target.value)}>
            <option value="">Välj registrerat klipp…</option>{addChoices.map(video=><option key={video.id} value={video.id}>{label(video.id)}</option>)}
          </select></label>
          <div className="flex flex-wrap gap-2"><button type="button" className="studio-button" disabled={!addId||!baseAllowed(addId)||(policy?.base.length??0)>=4} onClick={()=>void add(true)}>{busy?'Läser längd…':'Lägg till basklipp'}</button>
            {policy&&<button type="button" className="studio-button" disabled={!addId||!variationAllowed(addId)} onClick={()=>void add(false)}>Lägg till variation</button>}
          </div><p className="text-[10px] text-sg-muted">Nya längder läses från den valda videons metadata.</p>
        </div>
      </>:<>
        {choices.length?<>
          <label className="studio-field"><span>Klippvariant</span><select value={selectedId} onChange={event=>setSelected(event.target.value)}>{!selectedId&&<option value="">Välj en alternativ tagning…</option>}{choices.map(choice=><option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label>
          {!selectedId?<p className="mt-3 text-xs text-sg-muted">Den valda tagningen saknar en redigerbar alternativregel. Standardklippets urval är fast; ett okopplat klipp måste kopplas först.</p>:scope.frequency?<div className="mt-3">
            {legacyFrequency&&<p className="mb-2 text-[11px] text-sg-amber">Första frekvensändringen ersätter det äldre urvalet för just denna plats.</p>}
            <Numeric label="Frekvens" value={percent} min={0} max={percent===0&&activeFrequency>=4?0:100-total+percent} suffix="%" onChange={frequencyPercent=>variantEdit({frequencyPercent})}/>
            <p className="mt-2 text-[11px] text-sg-muted">0 % = manuell. Högst fyra aktiva varianter.{!legacyFrequency&&` Standardens andel: ${100-total+unavailableShare} %.`}</p>
          </div>:variant?<>
            <div className="my-3 flex flex-wrap gap-3">{([['rules','Regler'],['model','OpenClaw'],['random','Slump']]as const).map(([key,title])=><label key={key} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={selection[key]} onChange={event=>variantEdit({selection:{...selection,[key]:event.target.checked}})}/>{title}</label>)}</div>
            <button type="button" className="studio-button" onClick={()=>variantEdit({selection:{rules:false,model:false,random:false}})}>Endast manuell</button>
            <details className="mt-3"><summary className="cursor-pointer text-xs">Villkor & prioritet</summary>
              <Numeric label="Prioritet" value={variant.priority} min={-100} max={100} onChange={priority=>variantEdit({priority})}/>
              <div className="mt-2 flex max-h-40 flex-col gap-2 overflow-y-auto">{project.triggers.map(trigger=><label key={trigger.id} className="flex items-start gap-2 text-[11px]"><input type="checkbox" checked={variant.triggerIds.includes(trigger.id)} onChange={event=>variantEdit({triggerIds:event.target.checked?[...variant.triggerIds,trigger.id]:variant.triggerIds.filter(id=>id!==trigger.id)})}/><span>{trigger.label}</span></label>)}</div>
            </details>
            <p className="mt-3 text-[10px] text-sg-muted">Alla urvalsval av = manuellt prov. Standardklippet finns alltid som reserv.</p>
          </>:null}
        </>:<p className="text-xs text-sg-muted">Inga kopplade klippvarianter i detta fack. Standardklippet behåller sitt fasta urval.</p>}
      </>}
    </fieldset>}
    {error&&<p role="alert" className="mt-3 text-xs text-sg-amber">{error}</p>}
  </section>;
}

function Numeric({label,value,min,max,suffix='',disabled=false,onChange}:{label:string;value:number;min:number;max:number;suffix?:string;disabled?:boolean;onChange:(value:number)=>void}){
  return <label className="studio-field mt-2"><span>{label}{suffix&&` (${suffix})`}</span><input type="number" value={value} min={min} max={max} step={1} disabled={disabled} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))onChange(event.target.valueAsNumber);}}/></label>;
}
function IdleVariant({item,label,onChange,onRemove}:{item:IdleVariantPolicy;label:string;onChange:(patch:Partial<IdleVariantPolicy>)=>void;onRemove:()=>void}){
  return <div className="mb-2 rounded border border-sg-line p-2">
    <div className="flex items-center justify-between gap-2 text-xs"><span className="truncate">{label}</span><span className="shrink-0 text-sg-muted">{(item.durationMs/1000).toFixed(2)} s</span></div>
    <label className="studio-field mt-2"><span>Användning</span><select value={item.use} onChange={event=>{const use=event.target.value as IdleVariantUse;onChange({use,automatic:use==='automatic'?item.automatic??{...automatic}:null});}}>
      {(Object.entries(useLabels)as [IdleVariantUse,string][]).map(([use,title])=><option key={use} value={use}>{title}</option>)}
    </select></label>
    {item.use==='automatic'&&item.automatic&&<div className="grid grid-cols-2 gap-2">
      {([['averageEveryMs','Intervall',5,300],['jitterMs','Slump ±',0,60],['cooldownMs','Minsta paus',0,300],['maxPerMinute','Max per minut',1,12]]as const).map(([key,title,min,max])=><Numeric key={key} label={title} value={key==='maxPerMinute'?item.automatic![key]:item.automatic![key]/1000} min={min} max={max} suffix={key==='maxPerMinute'?'':'s'} onChange={value=>onChange({automatic:{...item.automatic!,[key]:key==='maxPerMinute'?value:value*1000}})}/>)}
    </div>}
    <button type="button" className="mt-2 text-[10px] text-sg-muted hover:text-sg-text" onClick={onRemove}>Ta bort variation ur schemat</button>
  </div>;
}
