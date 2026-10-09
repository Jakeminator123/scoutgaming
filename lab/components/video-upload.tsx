'use client';
import { labUrl } from "../lib/lab-url.mjs";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { kindForEvent, situationsForEvent, MAX_VIDEO_BYTES, MANUAL_SELECTION } from '../lib/video-intake.mjs';
import type { VideoMetadata } from '../lib/video-intake.mjs';
import type { StudioProject, VariantSelection } from '../lib/studio-model.mjs';
import type { VideoEntry, VideoInventory } from './studio-types';
import { requestJson } from './studio-types';
import { VideoMetadataFields } from './video-metadata-fields';
import { VariantSelectionFields } from './variant-selection';
import styles from './video-intake.module.css';
import { uploadNativeVideo } from '../lib/upload-native-video.mjs';

export interface UploadBinding { role: 'standard' | 'alternative'; selection: VariantSelection; triggerIds: string[] }
export function VideoUpload({ project, dealerId, eventId, initialSituation, onUploaded, disabled = false, onBusyChange, lockDealer = false, previewOnly = false, open }: {
  project: StudioProject; dealerId: string; eventId: string; initialSituation?: string; disabled?: boolean; onBusyChange?: (busy: boolean) => void; lockDealer?: boolean; previewOnly?: boolean; open?: boolean;
  onUploaded: (inventory: VideoInventory, video: VideoEntry, binding: UploadBinding | null) => void;
}) {
  const [metadata, setMetadata] = useState<VideoMetadata>(() => {
    const event = project.events.find(e => e.id === eventId)!;
    return { label: '', dealerId: dealerId as VideoMetadata['dealerId'], eventId, kind: kindForEvent(event), role: 'standard', situation: initialSituation && situationsForEvent(event).includes(initialSituation) ? initialSituation : situationsForEvent(event)[0] ?? '', playback: 'once', notes: '' };
  });
  const [selection, setSelection] = useState<VariantSelection>({ ...MANUAL_SELECTION });
  const [triggerIds, setTriggerIds] = useState<string[]>([]);
  const [bind, setBind] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const uploadRequest = useRef<AbortController | null>(null);
  const busyCallback = useRef(onBusyChange); busyCallback.current = onBusyChange;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState('');
  useEffect(() => {
    if (!selectedFile) { setLocalUrl(''); return; }
    const url = URL.createObjectURL(selectedFile); setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);
  useEffect(() => () => { uploadRequest.current?.abort(); busyCallback.current?.(false); }, []);
  const target = project.lines.find(l => l.dealerId === metadata.dealerId && l.eventId === metadata.eventId)!;
  const full = metadata.role === 'alternative' && target.variants.length >= 5;

  async function submit(e: FormEvent) {
    e.preventDefault(); if (disabled || busyRef.current) return;
    const file = fileInput.current?.files?.[0] ?? selectedFile;
    if (!file) { setError('Välj en videofil.'); return; }
    if (file.size > MAX_VIDEO_BYTES) { setError('Videon får vara högst 128 MB.'); return; }
    const extension = file.name.split('.').at(-1)?.toLowerCase();
    const type = extension === 'mp4' ? 'video/mp4' : extension === 'webm' ? 'video/webm' : '';
    if (!type) { setError('Välj MP4 eller WebM.'); return; }
    busyRef.current = true; setBusy(true); onBusyChange?.(true); setError(''); setNotice('');
    const controller = new AbortController(); uploadRequest.current = controller;
    const uploadMetadata = lockDealer ? { ...metadata, dealerId } : metadata;
    let saved = false;
    try {
      const mode = await requestJson<VideoInventory & {uploadMode?:string}>('/api/videos', { signal: controller.signal });
      let result: {id:string;duplicate:boolean};
      if (mode.uploadMode === 'private-client-blob') result = await uploadNativeVideo(file,uploadMetadata,type,{signal:controller.signal});
      else {
        const response = await fetch(labUrl('/api/videos'), { method: 'POST', headers: { 'Content-Type': type, 'X-Video-Metadata': encodeURIComponent(JSON.stringify(uploadMetadata)) }, body: file, signal: controller.signal });
        result = await response.json();
        if (!response.ok) throw new Error((result as {error?:string}).error ?? 'Videon kunde inte sparas.');
      }
      saved = true;
      controller.signal.throwIfAborted();
      const inventory = await requestJson<VideoInventory>('/api/videos', { signal: controller.signal });
      controller.signal.throwIfAborted();
      const video = inventory.videos.find(v => v.id === result.id);
      if (!video || !video.available || video.classification?.dealerId !== uploadMetadata.dealerId
        || video.classification?.eventId !== uploadMetadata.eventId || video.classification?.situation !== uploadMetadata.situation) {
        throw new Error('Filen är sparad men exakt dealer, händelse och kortplats kunde inte återläsas. Uppdatera Klippbibliotek.');
      }
      onUploaded(inventory, video, !previewOnly && bind ? { role: metadata.role, selection, triggerIds } : null);
      setNotice(previewOnly ? 'Klippet är sparat och valt i förhandsvisningen.' : `${result.duplicate ? 'Filen fanns redan' : 'Videon är sparad'} i videobanken.${bind ? ' Kopplingen finns i utkastet.' : ''}`);
      setSelectedFile(null); if (fileInput.current) fileInput.current.value = '';
    } catch (cause) { setError(`${saved ? 'Filen är sparad. ' : ''}${cause instanceof Error ? cause.message : 'Uppladdningen misslyckades.'}`); }
    finally { busyRef.current = false; setBusy(false); onBusyChange?.(false); uploadRequest.current = null; }
  }
  return <details open={open} className={styles.upload}><summary>Lägg in en video <span>MP4 / WebM · upp till 128 MB</span></summary>
    <form onSubmit={submit}><fieldset disabled={busy || disabled} className={styles.form}>
      <label className="field">Videofil<input ref={fileInput} type="file" accept="video/mp4,video/webm,.mp4,.webm" required onChange={e => { const file = e.target.files?.[0]; setSelectedFile(file ?? null); if (file && !metadata.label) setMetadata(m => ({ ...m, label: file.name.replace(/\.[^.]+$/, '').slice(0, 120) })); }} /></label>
      <VideoMetadataFields project={project} value={metadata} onChange={setMetadata} lockedDealerId={lockDealer ? dealerId : undefined} />
      {localUrl ? <video src={localUrl} controls playsInline preload="metadata" aria-label="Förhandsvisa vald fil" style={{width:'100%',maxHeight:420}} /> : null}
      {!previewOnly ? <label className="check-field"><input type="checkbox" checked={bind} onChange={e => setBind(e.target.checked)} /><span>Koppla till projektutkastet direkt<small>{metadata.role === 'standard' ? 'Ersätter linjens nuvarande standardkoppling i utkastet.' : 'Skapar ett nytt alternativ. Befintliga varianter behålls.'}</small></span></label> : null}
      {!previewOnly && metadata.role === 'alternative' && bind ? <><VariantSelectionFields value={selection} onChange={setSelection} /><details><summary>Villkor / triggers (valfritt)</summary><p className="helper">Inga valda = inget extra villkor. Alla valda måste matcha. Själva eventet krävs alltid.</p>{project.triggers.map(t => <label className="check-field" key={t.id}><input type="checkbox" checked={triggerIds.includes(t.id)} onChange={e => setTriggerIds(ids => e.target.checked ? [...ids, t.id] : ids.filter(id => id !== t.id))} /><span>{t.label}</span></label>)}</details></> : null}
      {!previewOnly && bind && full ? <p role="alert">Linjen har redan fyra alternativ. Spara filmen i banken och koppla till ett befintligt alternativ i editorn.</p> : null}

      <button className="primary-button" type="submit" disabled={disabled || busy || !previewOnly && bind && full}>{busy ? 'Sparar video…' : 'Spara video i banken'}</button>
    </fieldset>{error ? <p role="alert" className={styles.error}>{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}</form>
  </details>;
}
