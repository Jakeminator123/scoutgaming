'use client';
import { useRef, useState, type FormEvent } from 'react';
import { kindForEvent, situationsForEvent, VIDEO_KINDS, MAX_VIDEO_BYTES, MANUAL_SELECTION } from '../lib/video-intake.mjs';
import type { VideoMetadata } from '../lib/video-intake.mjs';
import type { StudioProject, VariantSelection } from '../lib/studio-model.mjs';
import type { VideoEntry, VideoInventory } from './studio-types';
import { requestJson } from './studio-types';
import { VariantSelectionFields } from './variant-selection';
import styles from './video-intake.module.css';

export interface UploadBinding { role: 'standard' | 'alternative'; selection: VariantSelection; triggerIds: string[] }
export function VideoUpload({ project, dealerId, eventId, onUploaded }: {
  project: StudioProject; dealerId: string; eventId: string;
  onUploaded: (inventory: VideoInventory, video: VideoEntry, binding: UploadBinding | null) => void;
}) {
  const [metadata, setMetadata] = useState<VideoMetadata>(() => {
    const event = project.events.find(e => e.id === eventId)!;
    return { label: '', dealerId: dealerId as VideoMetadata['dealerId'], eventId, kind: kindForEvent(event), role: 'standard', situation: event.sourceType === 'speak' ? String(event.exampleEvent.line) : '', notes: '' };
  });
  const [selection, setSelection] = useState<VariantSelection>({ ...MANUAL_SELECTION });
  const [triggerIds, setTriggerIds] = useState<string[]>([]);
  const [bind, setBind] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const event = project.events.find(e => e.id === metadata.eventId)!;
  const situations = situationsForEvent(event);
  const target = project.lines.find(l => l.dealerId === metadata.dealerId && l.eventId === metadata.eventId)!;
  const full = metadata.role === 'alternative' && target.variants.length >= 5;

  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return;
    const file = fileInput.current?.files?.[0];
    if (!file) { setError('Välj en videofil.'); return; }
    if (file.size > MAX_VIDEO_BYTES) { setError('Videon får vara högst 128 MB.'); return; }
    const extension = file.name.split('.').at(-1)?.toLowerCase();
    const type = extension === 'mp4' ? 'video/mp4' : extension === 'webm' ? 'video/webm' : '';
    if (!type) { setError('Välj MP4 eller WebM.'); return; }
    setBusy(true); setError(''); setNotice('');
    let saved = false;
    try {
      const response = await fetch('/api/videos', { method: 'POST', headers: { 'Content-Type': type, 'X-Video-Metadata': encodeURIComponent(JSON.stringify(metadata)) }, body: file });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Videon kunde inte sparas.');
      saved = true;
      const inventory = await requestJson<VideoInventory>('/api/videos');
      const video = inventory.videos.find(v => v.id === result.id);
      if (!video) throw new Error('Filen sparades men syns inte i registret. Läs om videobanken.');
      onUploaded(inventory, video, bind ? { role: metadata.role, selection, triggerIds } : null);
      setNotice(`${result.duplicate ? 'Filen fanns redan' : 'Videon är sparad'} i den lokala banken.${bind ? ' Kopplingen ligger i projektutkastet: välj Spara projekt.' : ' Du kan koppla den till en variant när du vill.'}`);
      if (fileInput.current) fileInput.current.value = '';
    } catch (cause) { setError(`${saved ? 'Filen är sparad. ' : ''}${cause instanceof Error ? cause.message : 'Uppladdningen misslyckades.'}`); }
    finally { setBusy(false); }
  }
  return <details className={styles.upload} open><summary>Lägg in en video <span>MP4 / WebM · upp till 128 MB</span></summary>
    <form onSubmit={submit}><fieldset disabled={busy} className={styles.form}>
      <label className="field">Videofil<input ref={fileInput} type="file" accept="video/mp4,video/webm,.mp4,.webm" required onChange={e => { const file = e.target.files?.[0]; if (file && !metadata.label) setMetadata(m => ({ ...m, label: file.name.replace(/\.[^.]+$/, '').slice(0, 120) })); }} /></label>
      <label className="field">Namn<input required maxLength={120} value={metadata.label} onChange={e => setMetadata({ ...metadata, label: e.target.value })} placeholder="Exempel: Astrid · lugn delning mitten" /></label>
      <div className={styles.grid}><label className="field">Dealer<select value={metadata.dealerId} onChange={e => setMetadata({ ...metadata, dealerId: e.target.value as VideoMetadata['dealerId'] })}>{project.dealers.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
      <label className="field">Event / standardlinje<select value={metadata.eventId} onChange={e => { const next = project.events.find(v => v.id === e.target.value)!; setMetadata({ ...metadata, eventId: next.id, kind: kindForEvent(next), situation: next.sourceType === 'speak' ? String(next.exampleEvent.line) : '' }); }}>{project.events.map(v => <option key={v.id} value={v.id}>{v.label} · {v.id}</option>)}</select></label>
      <label className="field">Videotyp<select value={metadata.kind} onChange={e => setMetadata({ ...metadata, kind: e.target.value as VideoMetadata['kind'] })}>{Object.entries(VIDEO_KINDS).map(([id, label]) => <option key={id} value={id} disabled={id !== kindForEvent(event)}>{label}</option>)}</select><small>Följer eventets uppgift.</small></label>
      <label className="field">Avsedd roll<select value={metadata.role} onChange={e => setMetadata({ ...metadata, role: e.target.value as VideoMetadata['role'] })}><option value="standard">Standard · grundutförande</option><option value="alternative">Alternativ · annan variant</option></select></label></div>
      {situations.length ? <label className="field">{metadata.kind === 'speech' ? 'Exakt replik-ID' : 'Konkret situation'}<select required={metadata.kind === 'speech'} value={metadata.situation} onChange={e => setMetadata({ ...metadata, situation: e.target.value })}>{metadata.kind !== 'speech' ? <option value="">Hela eventgruppen · täckning att granska</option> : null}{situations.map(s => <option key={s} value={s}>{s}</option>)}</select></label> : null}
      <label className="field">Anteckning / innehåll / vad som behöver granskas<textarea rows={2} maxLength={1500} value={metadata.notes} onChange={e => setMetadata({ ...metadata, notes: e.target.value })} /></label>
      <label className="check-field"><input type="checkbox" checked={bind} onChange={e => setBind(e.target.checked)} /><span>Koppla till projektutkastet direkt<small>{metadata.role === 'standard' ? 'Ersätter linjens nuvarande standardkoppling i utkastet.' : 'Skapar ett nytt alternativ. Befintliga varianter behålls.'}</small></span></label>
      {metadata.role === 'alternative' && bind ? <><VariantSelectionFields value={selection} onChange={setSelection} /><details><summary>Villkor / triggers (valfritt)</summary><p className="helper">Inga valda = inget extra villkor. Alla valda måste matcha. Själva eventet krävs alltid.</p>{project.triggers.map(t => <label className="check-field" key={t.id}><input type="checkbox" checked={triggerIds.includes(t.id)} onChange={e => setTriggerIds(ids => e.target.checked ? [...ids, t.id] : ids.filter(id => id !== t.id))} /><span>{t.label}</span></label>)}</details></> : null}
      {bind && full ? <p role="alert">Linjen har redan fyra alternativ. Spara filmen i banken och koppla till ett befintligt alternativ i editorn.</p> : null}
      <p className="helper">Filen sparas direkt lokalt. Regler och kopplingar sparas separat med Spara projekt. Kategorisering är inte ett visuellt godkännande.</p>
      <button className="primary-button" type="submit" disabled={busy || bind && full}>{busy ? 'Sparar video…' : 'Spara video i banken'}</button>
    </fieldset>{error ? <p role="alert" className={styles.error}>{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}</form>
  </details>;
}
