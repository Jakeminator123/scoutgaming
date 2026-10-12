'use client';
import { kindForEvent, situationsForEvent } from '../lib/video-intake.mjs';
import type { VideoCompositing, VideoMetadata } from '../lib/video-intake.mjs';
import { clipSituationLabel } from '../lib/clip-label.mjs';
import type { StudioProject } from '../lib/studio-model.mjs';
import styles from './video-intake.module.css';
import {DEFAULT_DEALER_FRAMING,DEFAULT_GREEN_SCREEN,type DealerFraming} from '../../web/public/dealer-framing.mjs';

export function VideoCompositingFields({ value, onChange }: { value?: VideoCompositing; onChange: (value: VideoCompositing) => void }) {
  return <>
    <label className="field">Bildläge<select value={value?.mode ?? 'opaque'} onChange={event => onChange(event.target.value === 'green-screen'
      ? {...DEFAULT_GREEN_SCREEN} : { mode: 'opaque' })}>
      <option value="green-screen">Grön bakgrund · kan tas bort</option><option value="opaque">Bakgrund inbakad · behåll hela bilden</option>
    </select></label>
    {value?.mode === 'green-screen' ? <details><summary>Avancerat · grön nyckling</summary><div className={styles.grid}>
      {([{ key: 'threshold', label: 'Tröskel', min: 0 }, { key: 'softness', label: 'Mjukhet', min: 0.001 }, { key: 'despill', label: 'Gröna färgrester', min: 0 }] as const).map(({ key, label, min }) =>
        <label className="field" key={key}>{label}<input type="number" min={min} max={1} step={0.001} value={value[key]}
          onChange={event => { const next = event.target.valueAsNumber; if (Number.isFinite(next)) onChange({ ...value, [key]: Math.max(min, Math.min(1, next)) }); }} /></label>)}
    </div></details> : null}
  </>;
}

export function DealerFramingFields({value=DEFAULT_DEALER_FRAMING,onChange}:{value?:DealerFraming;onChange:(value:DealerFraming)=>void}){
  return <fieldset><legend>Dealerns storlek och placering</legend>
    <p>Mobilklipp får gröna sidor i datorvyn. Breda klipp beskärs från sidorna i mobilvyn. Samma förstoring gäller i båda.</p>
    {([{key:'scale',label:'Förstoring',min:.25,max:6,step:.05},{key:'x',label:'Placering i sidled',min:-2,max:2,step:.01},{key:'y',label:'Placering i höjdled',min:-2,max:2,step:.01}] as const).map(({key,label,...limits})=><label className="field" key={key}>{label}<input type="number" {...limits} value={value[key]} onChange={event=>{const next=event.target.valueAsNumber;if(Number.isFinite(next))onChange({...value,[key]:Math.max(limits.min,Math.min(limits.max,next))});}}/></label>)}
    <button type="button" onClick={()=>onChange({...DEFAULT_DEALER_FRAMING})}>Återställ storlek och placering</button>
    <p>Om dealern redan är liten i originalfilen: öka Förstoring och justera höjdled tills hon har rätt storlek i båda vyerna.</p>
  </fieldset>;
}

export function VideoMetadataFields({ project, value, onChange, lockedDealerId }: {project: StudioProject; value: VideoMetadata; onChange: (value: VideoMetadata) => void; lockedDealerId?: string}) {
  const event = project.events.find(e => e.id === value.eventId)!;
  const situations = situationsForEvent(event);
  return <>
    <label className="field">Namn<input required maxLength={120} value={value.label} onChange={e => onChange({...value,label:e.target.value})} /></label>
    <div className={styles.grid}>
      <label className="field">Dealer{lockedDealerId ? <input readOnly value={project.dealers.find(row => row.id === lockedDealerId)?.label ?? lockedDealerId} /> : <select value={value.dealerId} onChange={e => onChange({...value,dealerId:e.target.value as VideoMetadata['dealerId']})}>{project.dealers.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select>}</label>
      <label className="field">Händelse<select value={value.eventId} onChange={e => { const next=project.events.find(v=>v.id===e.target.value)!; onChange({...value,eventId:next.id,kind:kindForEvent(next),situation:situationsForEvent(next)[0] ?? ''}); }}>{project.events.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
      <label className="field">Roll<select value={value.role} onChange={e=>onChange({...value,role:e.target.value as VideoMetadata['role']})}><option value="standard">Standard</option><option value="alternative">Alternativ</option></select></label>
      {situations.length ? <label className="field">{value.kind==='speech' ? 'Replik' : 'Kortplats'}<select required value={value.situation} onChange={e=>onChange({...value,situation:e.target.value})}><option value="" disabled>Välj exakt situation</option>{situations.map(s=><option key={s} value={s}>{clipSituationLabel(value.eventId, s)}</option>)}</select></label> : null}
    </div>
    <VideoCompositingFields value={value.compositing} onChange={compositing => onChange({...value,compositing})} />
    {value.mediaType!=='audio'?<DealerFramingFields value={value.framing} onChange={framing=>onChange({...value,framing})}/>:null}
    <details><summary>Avancerat · anteckning och identitet</summary><p><code>{value.eventId} / {value.situation || '—'}</code></p><label className="field">Anteckning<textarea rows={2} maxLength={1500} value={value.notes} onChange={e=>onChange({...value,notes:e.target.value})} /></label></details>
  </>;
}
