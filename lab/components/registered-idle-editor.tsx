'use client';
import {useEffect,useRef,useState} from 'react';
import {IdlePolicyEditor} from './idle-policy-editor';
import {ownDealerIdle} from '../../packages/presentation/runtime/registered-idle.mjs';
import {createRegisteredIdlePolicy,registeredIdleInventory,registeredIdlePolicy} from '../../packages/presentation/runtime/registered-idle-policy.mjs';
import {readIdleVideoDuration} from '../lib/idle-video-duration.mjs';
import type {IdlePolicy} from '../lib/idle-policy.mjs';
import type {StudioProject} from '../lib/studio-model.mjs';
import type {VideoInventory} from './studio-types';
import {DealerFileSettings} from './dealer-file-settings';

export function RegisteredIdleEditor({project,inventory,dealerId,blocked,onChange,onBusyChange,onInventory}:{
  project:StudioProject;inventory:VideoInventory;dealerId:string;blocked:boolean;
  onChange:(policy:IdlePolicy)=>void;onBusyChange:(busy:boolean)=>void;onInventory?:(inventory:VideoInventory)=>void;
}) {
  const policy=registeredIdlePolicy(project,dealerId);
  const baseline=ownDealerIdle(project,inventory,dealerId);
  const baselineId=baseline?.id;
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const operation=useRef<AbortController|null>(null);
  const pendingPolicy=useRef(policy);pendingPolicy.current=policy;
  useEffect(()=>{setBusy(false);setError('');return()=>{operation.current?.abort();operation.current=null;onBusyChange(false);};},[dealerId,baselineId,onBusyChange]);
  const mismatched=Boolean(policy&&policy.base[0]?.videoId!==baselineId);
  async function configure() {
    if(blocked||operation.current||!baseline)return;
    const controller=new AbortController();operation.current=controller;
    const originalPolicy=policy;
    setBusy(true);setError('');onBusyChange(true);
    try {
      const durationMs=await readIdleVideoDuration(baseline.previewUrl,{signal:controller.signal});
      if(controller.signal.aborted||pendingPolicy.current!==originalPolicy)return;
      const next=createRegisteredIdlePolicy({dealerId,baselineVideoId:baseline.id,durationMs});
      // Replacing the primary is explicit. Existing variation settings stay intact.
      if(originalPolicy)next.variants=originalPolicy.variants.filter(row=>row.videoId!==baseline.id);
      onChange(next);
    } catch(cause) {
      if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Videons längd kunde inte läsas.');
    } finally {
      if(operation.current===controller){operation.current=null;setBusy(false);onBusyChange(false);}
    }
  }
  return <section aria-label="Schema för egen grundloop">
    {baseline&&onInventory?<DealerFileSettings key={baseline.id+JSON.stringify(baseline.classification)} video={baseline} disabled={blocked||busy} onSaved={onInventory} onBusyChange={onBusyChange}/>:null}
    {!policy?<><p>Det valda basklippet loopar tills en spelhändelse tar över. Lägg till ett schema för fler basklipp eller variationer.</p>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={blocked||busy||!baseline} onClick={()=>void configure()}>{busy?'Läser klipplängd…':'Anpassa grundloop'}</button></>:null}
    {mismatched?<><p role="alert">Valt basklipp har ändrats. Använd det i schemat innan du publicerar. Tidigare basklipp ersätts; variationernas inställningar behålls.</p>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={blocked||busy||!baseline} onClick={()=>void configure()}>{busy?'Läser klipplängd…':'Använd valt basklipp'}</button></>:null}
    {!baseline?<p>Välj en tillgänglig egen video som Grundloop i Klippbiblioteket först.</p>:null}
    {error?<p role="alert">{error}</p>:null}
    {policy?<fieldset disabled={blocked||busy||mismatched} style={{border:0,padding:0,minWidth:0}}><IdlePolicyEditor policy={policy}
      inventory={registeredIdleInventory(inventory,{dealerId,policy})} blocked={blocked||busy||mismatched}
      clipLabels={project.clipLabels} onChange={onChange} onBusyChange={()=>{}} onImportBusyChange={onBusyChange} editableBase /></fieldset>:null}
    <p>Ändringarna sparas med Spara inställningar och når spelet när paketet publiceras igen.</p>
  </section>;
}
