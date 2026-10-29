'use client';
import {useEffect,useRef,useSyncExternalStore} from 'react';
import {createRoomGameConfigController,type RoomGameReceipt} from '../lib/room-game-config-client.mjs';
import {roomLimitProfiles,roomLimitProfileNote,formatAmount} from '../lib/room-limit-profiles.mjs';
import styles from './admin-publication-page.module.css';

const profiles=roomLimitProfiles();

function publicationHelp(publication:RoomGameReceipt['publication']) {
  if(publication.reason==='studio_room_game_draft_required')return 'Spara spelinställningarna som utkast för att kontrollera materialet för valt språk.';
  if(publication.reason==='studio_room_game_material_unavailable')switch(publication.materialReason){
    case 'native_material_measurement_missing':
    case 'native_material_measurement_mismatch':
      return 'Klippen saknar aktuella tidsmätningar. Öppna dealerns klipp och välj Mät speltid. Publicera sedan i spelbordet och läs in aktuella uppgifter här. Mätningen ger inget nytt bild- eller talgodkännande.';
    case 'native_material_speech_slot_missing':
    case 'native_material_speech_unbound':
      return 'Det saknas en korrekt kopplad och godkänd talreplik för valt språk. Kontrollera dealerns talmaterial och publicera i spelbordet efter rättning.';
    case 'native_material_bank_incomplete':
    case 'native_material_idle_missing':
      return 'Den publicerade klippbanken är ofullständig. Kontrollera att filmprofilens spelklipp och viloklipp finns med i paketet. Publicera sedan i spelbordet.';
    case 'native_material_profile_missing':
      return 'Dealern använder PAOW:s landningar (ingen egen filmad profil).';
    case 'native_material_contract_unsupported':
      return 'Den valda filmprofilen saknar stöd för dessa spelinställningar. Profilens koppling till spelmotorn behöver rättas innan du kan publicera.';
    case 'native_material_speech_timing_mismatch':
      return 'Talets uppmätta bildrutor eller ljud stämmer inte med inspelningsunderlaget. Kontrollera inspelningen och dess koppling innan du publicerar i spelbordet.';
    case 'native_material_take_audio_truncated':
      return 'Ett spelklipps ljud fortsätter efter bytet till nästa klipp. Klippet och dess övergång behöver rättas och granskas innan du publicerar i spelbordet.';
    case 'native_material_timing_limit':
      return 'Klippen ger för långa uppspelningssekvenser för dessa spelinställningar. Klippens längd och övergångar behöver granskas innan du kan publicera.';
  }
  return 'Publicering kräver ett sparat utkast och exakt inspelat material för valt språk. Kontrollera rummets sammansättning.';
}

export function RoomGameConfig({operatorId,roomId,roomName,disabled=false,onBusyChange,onDirtyChange,onPublished}:{operatorId:string;roomId:string;roomName:string;disabled?:boolean;onBusyChange?:(busy:boolean)=>void;onDirtyChange?:(dirty:boolean)=>void;onPublished?:(receipt:RoomGameReceipt)=>void}) {
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
  const off=disabled||busy||!current;
  async function act(action:'refresh'|'save'|'publish'){if(off)return;callbacks.current.onBusyChange?.(true);try{const next=await controller[action]();if(action==='publish'&&next)callbacks.current.onPublished?.(next);}finally{callbacks.current.onBusyChange?.(controller.getSnapshot().busy);}}
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
        return <label key={profile.id} className={'group/profile relative grid cursor-pointer overflow-hidden max-md:grid-cols-[112px_minmax(0,1fr)] rounded-xl border bg-sg-surface text-[13px] shadow-sg transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sg-mark has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-sg-surface '+(on?'border-sg-text shadow-[0_0_0_2px_var(--sg-lime)]':'border-sg-border hover:border-sg-faint hover:shadow-md')}>
          <input type="radio" name={'limit-preset-'+roomId} value={profile.id} checked={on} onChange={()=>edit('limitPreset',profile.id)} className="sr-only"/>
          <span className="relative block aspect-[16/9] overflow-hidden bg-sg-ink max-md:aspect-auto max-md:min-h-[136px]">
            <img src={profile.image} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-200 group-hover/profile:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover/profile:scale-100"/>
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-white"><strong className="block text-[15px] leading-tight">{profile.label}</strong><span className="text-xs opacity-85">{profile.place}</span></span>
            {on&&<span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-sg-lime text-[13px] font-bold text-sg-on-accent" aria-hidden="true">✓</span>}
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
    {receipt&&!receipt.publication.ready?<p role="status">{publicationHelp(receipt.publication)}</p>:null}
    <div className={styles.actions}>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={off} onClick={()=>void act('refresh')}>Läs in aktuella uppgifter</button>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={off||!receipt||state.stale} onClick={()=>void act('save')}>Spara spelinställningar</button>
      <button type="button" className="sg-btn sg-btn-primary" disabled={off||!receipt?.draft||state.stale||dirty||!receipt?.publication.ready} onClick={()=>void act('publish')}>Publicera spelinställningar</button>
    </div>
    {busy?<p role="status">Hämtar eller sparar spelinställningar…</p>:null}
    {receipt?<details><summary>Versioner</summary><p>Sparat utkast: {receipt.draft?.revision??'Inget'}. Publicerad spelversion: {receipt.published?.configVersion??'Ingen'}. Paketversion: {receipt.packageRevision}.</p></details>:null}
  </section>;
}
