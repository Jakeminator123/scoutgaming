'use client';
import { kindForEvent, situationsForEvent, VIDEO_KINDS } from '../lib/video-intake.mjs';
import type { VideoMetadata } from '../lib/video-intake.mjs';
import type { StudioProject } from '../lib/studio-model.mjs';
import styles from './video-intake.module.css';

export function VideoMetadataFields({ project, value, onChange }: {project: StudioProject; value: VideoMetadata; onChange: (value: VideoMetadata) => void}) {
  const event = project.events.find(e => e.id === value.eventId)!;
  const situations = situationsForEvent(event);
  return <>
    <label className="field">Namn<input required maxLength={120} value={value.label} onChange={e => onChange({...value,label:e.target.value})} /></label>
    <div className={styles.grid}>
      <label className="field">Dealer<select value={value.dealerId} onChange={e => onChange({...value,dealerId:e.target.value as VideoMetadata['dealerId']})}>{project.dealers.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
      <label className="field">Eventgrupp<select value={value.eventId} onChange={e => { const next=project.events.find(v=>v.id===e.target.value)!; onChange({...value,eventId:next.id,kind:kindForEvent(next),situation:situationsForEvent(next)[0] ?? ''}); }}>{project.events.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
      <label className="field">Videotyp<input readOnly value={VIDEO_KINDS[value.kind]} /><small>Bestäms av eventgruppen, inte ett extra val.</small></label>
      <label className="field">Avsedd roll<select value={value.role} onChange={e=>onChange({...value,role:e.target.value as VideoMetadata['role']})}><option value="standard">Standard</option><option value="alternative">Alternativ</option></select></label>
    </div>
    {situations.length ? <label className="field">{value.kind==='speech' ? 'Exakt replik-ID' : 'Exakt situation'}<select required value={value.situation} onChange={e=>onChange({...value,situation:e.target.value})}><option value="" disabled>Välj exakt situation</option>{situations.map(s=><option key={s} value={s}>{s}</option>)}</select></label> : null}
    <p className="helper">Uppspelning: en gång. Loop är ännu ett förslag och kan inte aktiveras här.</p>
    <details><summary>Anteckning</summary><label className="field">Vad behöver granskas?<textarea rows={2} maxLength={1500} value={value.notes} onChange={e=>onChange({...value,notes:e.target.value})} /></label></details>
  </>;
}
