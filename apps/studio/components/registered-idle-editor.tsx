'use client';
import {useEffect,useRef,useState} from 'react';
import {IdlePolicyEditor} from './idle-policy-editor';
import {ownDealerIdle} from '../../../packages/presentation/runtime/registered-idle.mjs';
import {createRegisteredIdlePolicy,registeredIdleInventory,registeredIdlePolicy} from '../../../packages/presentation/runtime/registered-idle-policy.mjs';
import {readIdleVideoDuration} from '../lib/idle-video-duration.mjs';
import type {IdlePolicy} from '../../../packages/presentation/runtime/idle-policy.mjs';
import type {StudioProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import type { VideoInventory } from '../../../packages/presentation/contracts/media-inventory.mjs';
import {DealerFileSettings} from './dealer-file-settings';

function availableBaseline(project:StudioProject,inventory:VideoInventory,dealerId:string,videoId:string){
  // Reuse the registered baseline rules, including ownership and verified bytes.
  const candidate={...project,lines:project.lines.map(line=>line.dealerId===dealerId&&line.eventId==='idle.ready'
    ?{...line,variants:line.variants.map(variant=>variant.id===line.baselineVariantId?{...variant,videoGenerationId:videoId}:variant)}:line)};
  const video=ownDealerIdle(candidate,inventory,dealerId);
  return video?.classification?.archived||video?.deletion?null:video;
}

export function RegisteredIdleEditor({project,inventory,dealerId,blocked,onChange,onDetach,onBusyChange,onInventory}:{
  project:StudioProject;inventory:VideoInventory;dealerId:string;blocked:boolean;
  onChange:(policy:IdlePolicy)=>void;onDetach:()=>void;onBusyChange:(busy:boolean)=>void;onInventory?:(inventory:VideoInventory)=>void;
}) {
  const policy=registeredIdlePolicy(project,dealerId);
  const line=project.lines.find(row=>row.dealerId===dealerId&&row.eventId==='idle.ready');
  const boundId=line?.variants.find(row=>row.id===line.baselineVariantId)?.videoGenerationId;
  const baseline=boundId?availableBaseline(project,inventory,dealerId,boundId):null;
  const baselineId=baseline?.id;
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState('');
  const [importBusy,setImportBusy]=useState(false),[fileBusy,setFileBusy]=useState(false);
  const operation=useRef<AbortController|null>(null);
  const nestedBusy=useRef({import:false,file:false});
  const latest=useRef({project,inventory,dealerId,blocked,policy,boundId});latest.current={project,inventory,dealerId,blocked,policy,boundId};
  useEffect(()=>{setBusy(false);setError('');setSelected('');return()=>{operation.current?.abort();operation.current=null;onBusyChange(false);};},[dealerId,baselineId,boundId,onBusyChange]);
  useEffect(()=>{if(blocked&&operation.current){operation.current.abort();operation.current=null;setBusy(false);onBusyChange(false);}},[blocked,onBusyChange]);
  const mismatched=Boolean(policy&&policy.base[0]?.videoId!==baselineId);
  const choices=!baseline?registeredIdleInventory(inventory,{dealerId}).videos.filter(video=>availableBaseline(project,inventory,dealerId,video.id)):[];
  const locked=blocked||busy||importBusy||fileBusy;
  function nested(kind:'import'|'file',value:boolean){
    nestedBusy.current[kind]=value;
    if(kind==='import')setImportBusy(value);else setFileBusy(value);
    onBusyChange(Boolean(operation.current||nestedBusy.current.import||nestedBusy.current.file));
  }
  function detach(){
    if(latest.current.blocked||operation.current||nestedBusy.current.import||nestedBusy.current.file)return;
    setError('');setSelected('');onDetach();
  }
  async function configure(videoId=baselineId) {
    if(latest.current.blocked||operation.current||nestedBusy.current.import||nestedBusy.current.file||!videoId)return;
    const video=availableBaseline(project,inventory,dealerId,videoId);if(!video)return;
    const controller=new AbortController();operation.current=controller;
    const originalPolicy=policy;
    setBusy(true);setError('');onBusyChange(true);
    try {
      const durationMs=await readIdleVideoDuration(video.previewUrl,{signal:controller.signal});
      const current=latest.current;
      const currentVideo=availableBaseline(current.project,current.inventory,current.dealerId,video.id);
      if(controller.signal.aborted||current.blocked||current.dealerId!==dealerId||current.boundId!==boundId||current.policy!==originalPolicy||!currentVideo||currentVideo.sha256!==video.sha256||currentVideo.previewUrl!==video.previewUrl)return;
      const next=createRegisteredIdlePolicy({dealerId,baselineVideoId:video.id,durationMs});
      // Replacing the primary is explicit. Existing variation settings stay intact.
      if(originalPolicy)next.variants=originalPolicy.variants.filter(row=>row.videoId!==video.id);
      onChange(next);
    } catch(cause) {
      if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Videons längd kunde inte läsas.');
    } finally {
      if(operation.current===controller){operation.current=null;setBusy(false);onBusyChange(false);}
    }
  }
  return <section aria-label="Schema för egen grundloop">
    {baseline&&onInventory?<DealerFileSettings key={baseline.id+JSON.stringify(baseline.classification)} video={baseline} disabled={blocked||busy||importBusy} onSaved={onInventory} onBusyChange={value=>nested('file',value)}/>:null}
    {boundId||policy?<><button type="button" className="sg-btn sg-btn-secondary" disabled={locked} onClick={detach}>Koppla loss grundloop</button><p>Tar bort grundloopen och dess schema från utkastet. Klippen finns kvar i klippbiblioteket.</p></>:null}
    {!policy?<><p>{baseline?'Det valda basklippet loopar tills en spelhändelse tar över. Lägg till ett schema för fler basklipp eller variationer.':'Ingen tillgänglig grundloop är kopplad.'}</p>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={locked||!baseline} onClick={()=>void configure()}>{busy?'Läser klipplängd…':'Anpassa grundloop'}</button></>:null}
    {mismatched?<><p role="alert">Valt basklipp har ändrats. Använd det i schemat innan du publicerar. Tidigare basklipp ersätts; variationernas inställningar behålls.</p>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={locked||!baseline} onClick={()=>void configure()}>{busy?'Läser klipplängd…':'Använd valt basklipp'}</button></>:null}
    {!baseline?<><p>Välj en tillgänglig egen video som Grundloop här eller i Klippbiblioteket.</p>
      {choices.length?<><label>Välj grundloop <select aria-label="Välj grundloop" value={selected} disabled={locked} onChange={event=>setSelected(event.target.value)}><option value="">Välj ett klipp…</option>{choices.map(video=><option key={video.id} value={video.id}>{video.label||video.fileName||video.id}</option>)}</select></label>
        <button type="button" className="sg-btn sg-btn-secondary" disabled={locked||!choices.some(video=>video.id===selected)} onClick={()=>void configure(selected)}>Använd som grundloop</button></>:null}</>:null}
    {error?<p role="alert">{error}</p>:null}
    {policy?<fieldset disabled={blocked||busy||fileBusy||mismatched} style={{border:0,padding:0,minWidth:0}}><IdlePolicyEditor policy={policy}
      inventory={registeredIdleInventory(inventory,{dealerId,policy})} blocked={blocked||busy||fileBusy||mismatched}
      clipLabels={project.clipLabels} onChange={onChange} onBusyChange={()=>{}} onImportBusyChange={value=>nested('import',value)} editableBase /></fieldset>:null}
    <p>Ändringarna sparas med Spara inställningar och når spelet när paketet publiceras igen.</p>
  </section>;
}
