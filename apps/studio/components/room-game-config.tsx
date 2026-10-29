'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {createRoomGameConfigController,type RoomGameReceipt} from '../lib/room-game-config-client.mjs';
import {roomLimitProfiles,roomLimitProfileNote,formatAmount} from '../lib/room-limit-profiles.mjs';
import styles from './admin-publication-page.module.css';
import {blockerView,runBlockerAction} from '../client/admin/lib/blocker-view.mjs';

const profiles=roomLimitProfiles();

type RoomDealer={id:string;name:string};

export function RoomGameConfig({operatorId,roomId,roomName,dealers=[],disabled=false,onBusyChange,onDirtyChange,onPublished}:{operatorId:string;roomId:string;roomName:string;dealers?:RoomDealer[];disabled?:boolean;onBusyChange?:(busy:boolean)=>void;onDirtyChange?:(dirty:boolean)=>void;onPublished?:(receipt:RoomGameReceipt)=>void}) {
  const ref=useRef<ReturnType<typeof createRoomGameConfigController>|null>(null);
  if(!ref.current)ref.current=createRoomGameConfigController();
  const controller=ref.current,state=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const callbacks=useRef({onBusyChange,onDirtyChange,onPublished});callbacks.current={onBusyChange,onDirtyChange,onPublished};
  const current=state.context?.operatorId===operatorId&&state.context?.roomId===roomId;
  const dirty=current&&controller.dirty(),receipt=current?state.receipt:null;
  const busy=current&&state.busy;
  useEffect(()=>{void controller.configure({operatorId,roomId});return()=>controller.cancel();},[controller,operatorId,roomId]);
  useEffect(()=>{callbacks.current.onBusyChange?.(busy);return()=>callbacks.current.onBusyChange?.(false);},[busy]);
  useEffect(()=>{callbacks.current.onDirtyChange?.(dirty);return()=>callbacks.current.onDirtyChange?.(false);},[dirty]);
  const [fixing,setFixing]=useState(''),[fixed,setFixed]=useState('');
  const off=disabled||busy||!current||fixing!=='';
  const publication=receipt?.publication,single=dealers.length===1?dealers[0]:null;
  // Utan utkast prövar servern det som Publicera sparar (#662), så spärren är alltid ett materialskäl.
  const blocker=publication&&!publication.ready?blockerView(publication.reason,{roomId,operatorId,dealerId:single?.id,dealerName:single?.name,
    language:state.fields.language,materialReason:publication.materialReason}):null;
  // Publicera sparar först när fälten är ändrade eller inget utkast finns; sedan publiceras utkastet om materialet räcker.
  const publishable=Boolean(receipt)&&!state.stale&&(dirty||!receipt?.draft||Boolean(publication?.ready));
  async function act(action:'refresh'|'save'|'publish'){if(off)return;callbacks.current.onBusyChange?.(true);setFixed('');try{
    if(action==='publish'&&(dirty||!receipt?.draft)){const saved=await controller.save();if(!saved?.publication.ready)return;}
    const next=await controller[action]();if(action==='publish'&&next)callbacks.current.onPublished?.(next);}finally{callbacks.current.onBusyChange?.(controller.getSnapshot().busy);}}
  // Mät omätta klipp direkt (#655); mätningen följer med när spelbordet publiceras.
  async function measure(){if(off)return;setFixing('Mäter…');setFixed('');try{
    const result=await runBlockerAction(blocker?.action,{dealerIds:dealers.map(row=>row.id),onProgress:({done,total})=>setFixing(`Mäter ${done}/${total}…`)});
    setFixed(result.ok?(result.message??'')+' Publicera spelbordet så följer mätningen med.':result.error??'');}finally{setFixing('');void controller.refresh();}}
  function edit(field:'language'|'limitPreset',value:string){controller.edit(field,value);callbacks.current.onDirtyChange?.(controller.dirty());}
  return <section className={styles.card} aria-label="Spelinställningar för rummet">
    <h2>Spelinställningar · {roomName}</h2>
    <p>Spara ett utkast och publicera när det är klart. En pågående runda behåller sin publicerade version.</p>
    <div className={styles.contextLine}>
      <label className={styles.field}>Bordsspråk<select value={state.fields.language} disabled={off||!receipt} onChange={event=>edit('language',event.target.value)}>
        <option value="en">Engelska</option><option value="sv">Svenska</option>
      </select></label>
    </div>
    <fieldset className="m-0 grid min-w-0 gap-2.5 border-0 p-0" disabled={off||!receipt}>
      <legend className="mb-1 p-0 text-[13px] font-semibold text-sg-muted">Insatsprofil</legend>
      <p className="m-0 text-[12.5px] text-sg-muted">{roomLimitProfileNote}</p>
      {/* Native radios share one name, so arrow keys move between the cards and Tab enters the group once. */}
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">{profiles.map(profile=>{const on=state.fields.limitPreset===profile.id;
        return <label key={profile.id} className={'group/profile relative grid cursor-pointer overflow-hidden rounded-xl border bg-sg-surface text-[13px] shadow-sg transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sg-mark has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-sg-surface '+(on?'border-sg-text shadow-[0_0_0_2px_var(--sg-lime)]':'border-sg-border hover:border-sg-faint hover:shadow-md')}>
          <input type="radio" name={'limit-preset-'+roomId} value={profile.id} checked={on} onChange={()=>edit('limitPreset',profile.id)} className="sr-only"/>
          {/* A profile is stakes only; the room's picture comes from its environment (miljöbild). */}
          <span className="flex items-center justify-between gap-2 border-b border-sg-border px-3 py-2.5">
            <strong className="text-[15px] leading-tight text-sg-text">{profile.label}</strong>
            {on&&<span className="grid size-6 place-items-center rounded-full bg-sg-lime text-[13px] font-bold text-sg-on-accent" aria-hidden="true">✓</span>}
          </span>
          <span className="grid gap-1 p-3 tabular-nums">
            <span className="flex justify-between gap-2"><span className="text-sg-muted">Insats</span><strong className="text-sg-text">{profile.stakes}</strong></span>
            <span className="flex justify-between gap-2"><span className="text-sg-muted">Sidoinsats max</span><span className="text-sg-text">{formatAmount(profile.sideMax)}</span></span>
            <span className="flex justify-between gap-2"><span className="text-sg-muted">Påfyllning</span><span className="text-sg-text">{formatAmount(profile.refill)} spelpengar</span></span>
            <span className="mt-1 flex flex-wrap gap-1" aria-label={'Marker: '+profile.chips.map(formatAmount).join(', ')}>{profile.chips.map(chip=><span key={chip} aria-hidden="true" className="rounded-full border border-sg-border bg-sg-surface-2 px-1.5 text-[11px] font-semibold text-sg-muted">{formatAmount(chip)}</span>)}</span>
          </span>
        </label>;})}</div>
    </fieldset>
    <p>Insatstid: 20 sekunder. Beslutstid: 15 sekunder. Beloppen är demoenheter.</p>
    {current&&state.error?<p role="alert">{state.error}</p>:null}
    {current&&state.message?<p role="status">{state.message}</p>:null}
    {blocker?<p role="status" data-tone={blocker.tone}>{blocker.text}{' '}{blocker.action?.run==='measure'&&dealers.length?<button type="button" data-action="blocker-measure" className="sg-btn sg-btn-secondary" disabled={off} onClick={()=>void measure()}>{fixing||blocker.action.label}</button>
      :blocker.action?.href?<a className="font-semibold underline" href={blocker.action.href}>{blocker.action.label}</a>:null}</p>:null}
    {fixed?<p role="status">{fixed}</p>:null}
    <div className={styles.actions}>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={off} onClick={()=>void act('refresh')}>Läs in aktuella uppgifter</button>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={off||!receipt||state.stale} onClick={()=>void act('save')}>Spara spelinställningar</button>
      <button type="button" className="sg-btn sg-btn-primary" disabled={off||!publishable} onClick={()=>void act('publish')}>Publicera spelinställningar</button>
    </div>
    {busy?<p role="status">Hämtar eller sparar spelinställningar…</p>:null}
    {receipt?<details><summary>Versioner</summary><p>Sparat utkast: {receipt.draft?.revision??'Inget'}. Publicerad spelversion: {receipt.published?.configVersion??'Ingen'}. Paketversion: {receipt.packageRevision}.</p></details>:null}
  </section>;
}
