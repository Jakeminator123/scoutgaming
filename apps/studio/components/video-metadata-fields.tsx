'use client';
import { kindForEvent, situationsForEvent } from '../../../packages/presentation/contracts/video-intake.mjs';
import type { VideoCompositing, VideoMetadata } from '../../../packages/presentation/contracts/video-intake.mjs';
import { clipSituationLabel } from '../lib/clip-label.mjs';
import type { StudioProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import styles from './video-intake.module.css';
import {DEFAULT_DEALER_FRAMING,type DealerFraming} from '../../../packages/presentation/contracts/dealer-framing.mjs';
import {effectiveDealerCompositing} from '../../../packages/presentation/contracts/dealer-compositing.mjs';
import {dealerMediaEvents,rouletteMediaEvent,rouletteMediaDefaults} from '../../../packages/presentation/contracts/roulette-media.mjs';

export function VideoCompositingFields({ value, onChange }: { value?: VideoCompositing; onChange: (value: VideoCompositing) => void }) {
  const effective=effectiveDealerCompositing(value);
  const keyed=effective.mode==='green-screen'?effective:{mode:'green-screen' as const,threshold:.23,softness:.15,despill:0};
  return <>
    <label className="field">Friläggning<select value={effective.mode} onChange={event=>onChange(event.target.value==='alpha'?{mode:'alpha'}:keyed)}><option value="green-screen">Grön nyckling</option><option value="alpha">Befintlig alfa · PNG / WebM</option></select></label><p>Alfa bevarar originalets genomskinlighet och gröna detaljer. Filens alfakanal kontrolleras vid sparning; visuell kvalitet behöver granskas separat.</p>
    {value?.mode==='opaque'?<p role="alert">Äldre bakgrundsinställning behöver uppdateras. En miljö som redan är inbakad i filmen kan inte tas bort med grön nyckling. Ersätt då filen med en grön originalfilm innan klippet används.</p>:null}
    {effective.mode==='green-screen'?<details><summary>Avancerat · grön nyckling</summary><div className={styles.grid}>
      {([{ key: 'threshold', label: 'Tröskel', min: 0 }, { key: 'softness', label: 'Mjukhet', min: 0.001 }, { key: 'despill', label: 'Gröna färgrester', min: 0 }] as const).map(({ key, label, min }) =>
        <label className="field" key={key}>{label}<input type="number" min={min} max={1} step={0.001} value={keyed[key]}
          onChange={event => { const next = event.target.valueAsNumber; if (Number.isFinite(next)) onChange({ ...keyed, [key]: Math.max(min, Math.min(1, next)) }); }} /></label>)}
    </div></details>:null}
  </>;
}

export function DealerFramingFields({value=DEFAULT_DEALER_FRAMING,onChange}:{value?:DealerFraming;onChange:(value:DealerFraming)=>void}){
  return <fieldset><legend>Dealerns storlek och placering</legend>
    <p>Mobilklipp får genomskinliga sidor i datorvyn. Breda klipp beskärs från sidorna i mobilvyn. Samma förstoring gäller i båda.</p>
    {([{key:'scale',label:'Förstoring',min:.25,max:6,step:.05},{key:'x',label:'Placering i sidled',min:-2,max:2,step:.01},{key:'y',label:'Placering i höjdled',min:-2,max:2,step:.01}] as const).map(({key,label,...limits})=><label className="field" key={key}>{label}<input type="number" {...limits} value={value[key]} onChange={event=>{const next=event.target.valueAsNumber;if(Number.isFinite(next))onChange({...value,[key]:Math.max(limits.min,Math.min(limits.max,next))});}}/></label>)}
    <button type="button" onClick={()=>onChange({...DEFAULT_DEALER_FRAMING})}>Återställ storlek och placering</button>
    <p>Om dealern redan är liten i originalfilen: öka Förstoring och justera höjdled tills hon har rätt storlek i båda vyerna.</p>
  </fieldset>;
}

export function VideoMetadataFields({ project, value, onChange, lockedDealerId }: {project: StudioProject; value: VideoMetadata; onChange: (value: VideoMetadata) => void; lockedDealerId?: string}) {
  const events=dealerMediaEvents(project).filter(event=>(event.id==='roulette.reference')===(value.mediaType==='image'));
  const event = events.find(e => e.id === value.eventId)!;
  const situations = situationsForEvent(event);
  return <>
    <label className="field">Namn<input required maxLength={120} value={value.label} onChange={e => onChange({...value,label:e.target.value})} /></label>
    <div className={styles.grid}>
      <label className="field">Dealer{lockedDealerId ? <input readOnly value={project.dealers.find(row => row.id === lockedDealerId)?.label ?? lockedDealerId} /> : <select value={value.dealerId} onChange={e => onChange({...value,dealerId:e.target.value as VideoMetadata['dealerId']})}>{project.dealers.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select>}</label>
      <label className="field">Händelse<select value={value.eventId} onChange={e => { const next=events.find(v=>v.id===e.target.value)!,situation=situationsForEvent(next)[0]??''; const {game,action,startPose,endPose,...common}=value; onChange({...common,eventId:next.id,kind:kindForEvent(next),situation,...(rouletteMediaEvent(next.id)?rouletteMediaDefaults(next.id,situation):{})}); }}>{events.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
      <label className="field">Roll<select value={value.role} onChange={e=>onChange({...value,role:e.target.value as VideoMetadata['role']})}><option value="standard">Standard</option><option value="alternative">Alternativ</option></select></label>
      {situations.length ? <label className="field">{value.game==='roulette'?'Handling / referens':value.kind==='speech' ? 'Replik' : 'Kortplats'}<select required value={value.situation} onChange={e=>onChange({...value,situation:e.target.value,...(value.game==='roulette'?{action:value.eventId==='roulette.reference'?'reference':e.target.value}:{})})}><option value="" disabled>Välj exakt situation</option>{situations.map(s=><option key={s} value={s}>{clipSituationLabel(value.eventId, s)}</option>)}</select></label> : null}
    </div>
    {value.game==='roulette'&&value.mediaType!=='image'?<RoulettePoseFields value={value} onChange={onChange}/>:null}
    {value.mediaType!=='audio'?<VideoCompositingFields value={value.compositing} onChange={compositing => onChange({...value,compositing})} />:null}
    {value.mediaType!=='audio'?<DealerFramingFields value={value.framing} onChange={framing=>onChange({...value,framing})}/>:null}
    <details><summary>Avancerat · anteckning och identitet</summary><p><code>{value.eventId} / {value.situation || '—'}</code></p><label className="field">Anteckning<textarea rows={2} maxLength={1500} value={value.notes} onChange={e=>onChange({...value,notes:e.target.value})} /></label></details>
  </>;
}

export function RoulettePoseFields({value,onChange}:{value:VideoMetadata;onChange:(value:VideoMetadata)=>void}){
  return <fieldset><legend>Roulette · poser</legend><p>Granska första och sista bildrutan. Samma poser kan ha olika handlingar. Ingen automatisk spelkoppling.</p>{(['startPose','endPose'] as const).map(key=><label className="field" key={key}>{key==='startPose'?'Startpose':'Slutpose'}<select value={value[key]??'unverified'} onChange={event=>onChange({...value,[key]:event.target.value as VideoMetadata[typeof key]})}><option value="unverified">Inte granskad</option><option value="VILA">VILA</option><option value="WHEEL">Vid hjulet</option></select></label>)}</fieldset>;
}
