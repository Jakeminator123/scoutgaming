'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { labUrl } from '../lib/lab-url.mjs';
import { kindForEvent, MAX_VIDEO_BYTES, type VideoCompositing, type VideoMetadata } from '../lib/video-intake.mjs';
import { clipSituationLabel } from '../lib/clip-label.mjs';
import { VideoCompositingFields } from './video-metadata-fields';
import { uploadNativeVideo } from '../lib/upload-native-video.mjs';
import type { StudioProject } from '../lib/studio-model.mjs';
import { requestJson, type VideoEntry, type VideoInventory } from './studio-types';
import styles from './video-intake.module.css';

export function FamilyVideoUpload({ project, inventory, dealerId, initialFamilyId, onUploaded, onOpen, onBusyChange, disabled = false }: {
  project: StudioProject; inventory: VideoInventory; dealerId?: string; initialFamilyId?: string; disabled?: boolean;
  onUploaded: (inventory: VideoInventory, videoId?: string) => void;
  onOpen?: (eventId: string, situation: string) => void; onBusyChange?: (busy: boolean) => void;
}) {
  const families = (inventory.families ?? []).filter(row => !dealerId || row.dealerId === dealerId);
  const [familyId, setFamilyId] = useState(families.some(row => row.id === initialFamilyId) ? initialFamilyId! : '');
  const [compositing, setCompositing] = useState<VideoCompositing>({ mode: 'opaque' });
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState('');
  const [saved, setSaved] = useState<VideoEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const busyCallback = useRef(onBusyChange); busyCallback.current = onBusyChange;
  const request = useRef<XMLHttpRequest | null>(null);
  const nativeRequest = useRef<AbortController | null>(null);
  const family = families.find(row => row.id === familyId);
  useEffect(() => {
    if (!file) { setLocalUrl(''); return; }
    const url = URL.createObjectURL(file); setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => () => {request.current?.abort();nativeRequest.current?.abort();busyCallback.current?.(false);}, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || busy || !file || !family) return;
    if (file.size > MAX_VIDEO_BYTES || !/\.(mp4|webm)$/i.test(file.name)) {
      setError('Välj MP4 eller WebM, högst 128 MB.'); return;
    }
    const definition = project.events.find(row => row.id === family.eventId);
    if (!definition) { setError('Familjens spelsignal saknas. Läs om sidan.'); return; }
    const metadata: VideoMetadata = {
      familyId: family.id, dealerId: family.dealerId, eventId: family.eventId,
      situation: family.playbackType === 'idle-pool' ? '' : family.situation,
      kind: kindForEvent(definition), role: 'alternative', playback: 'once',
      label: label.trim() || clipSituationLabel(family.eventId, family.situation), notes: '', compositing,
    };
    setBusy(true); onBusyChange?.(true); setError(''); setNotice(''); setSaved(null); setProgress(0);
    const controller = new AbortController();nativeRequest.current = controller;
    let stored = false;
    try {
      const capability = await requestJson<VideoInventory & {uploadMode?: string}>('/api/videos',{signal:controller.signal});
      const result = capability.uploadMode === 'private-client-blob'
        ? await uploadNativeVideo(file,metadata,/\.webm$/i.test(file.name) ? 'video/webm' : 'video/mp4',
          {signal:controller.signal,onUploadProgress:event => setProgress(Math.round(event.percentage))})
        : await new Promise<{ id: string; duplicate: boolean }>((resolve, reject) => {
        const xhr = new XMLHttpRequest(); request.current = xhr;
        xhr.open('POST', labUrl('/api/videos'));
        xhr.setRequestHeader('Content-Type', /\.webm$/i.test(file.name) ? 'video/webm' : 'video/mp4');
        xhr.setRequestHeader('X-Video-Metadata', encodeURIComponent(JSON.stringify(metadata)));
        xhr.upload.onprogress = event => setProgress(event.lengthComputable ? Math.round(event.loaded / event.total * 100) : null);
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status < 200 || xhr.status >= 300) reject(new Error(data.error || 'Videon kunde inte sparas.'));
            else resolve(data);
          } catch { reject(new Error('Servern gav inget giltigt uppladdningskvitto.')); }
        };
        xhr.onerror = () => reject(new Error('Anslutningen bröts. Läs om biblioteket innan du försöker igen.'));
        xhr.onabort = () => reject(new Error('Uppladdningen avbröts.'));
        xhr.send(file);
      });
      stored = true;
      controller.signal.throwIfAborted();
      const next = await requestJson<VideoInventory>('/api/videos',{signal:controller.signal});
      controller.signal.throwIfAborted();
      const video = next.videos.find(row => row.id === result.id && row.familyId === family.id && row.available);
      if (!video) throw new Error('Filen är sparad men familjen kunde inte återläsas. Läs om biblioteket.');
      onUploaded(next, video.id); setSaved(video); onOpen?.(family.eventId, family.situation);
      setNotice(result.duplicate ? 'Klippet fanns redan.' : 'Klippet sparat.');
      setFile(null); if (input.current) input.current.value = '';
    } catch (cause) { setError(`${stored ? 'Uppladdningen är sparad. ' : ''}${cause instanceof Error ? cause.message : 'Kunde inte spara klippet.'}`); }
    finally { setBusy(false); onBusyChange?.(false); request.current = null;nativeRequest.current = null; }
  }
  return <section className={styles.upload} aria-label="Ladda upp en variant">
    <form onSubmit={submit}><fieldset disabled={busy || disabled} className={styles.form}>
      <label className="field">MP4 eller WebM · högst 128 MB<input ref={input} type="file" accept="video/mp4,video/webm,.mp4,.webm" required onChange={event => {
        const chosen = event.target.files?.[0] ?? null; setFile(chosen); setSaved(null); setNotice(''); setError('');
        if (chosen && !label) setLabel(family ? clipSituationLabel(family.eventId, family.situation) : '');
      }} /></label>
      <label className="field">Klippets namn<input value={label} placeholder={family ? clipSituationLabel(family.eventId, family.situation) : "Klippets namn"} maxLength={120} onChange={event => setLabel(event.target.value)} /></label>
      <label className="field">Var ska klippet användas?<select required value={familyId} onChange={event => setFamilyId(event.target.value)}>
        <option value="">Välj kortplats, replik eller grundloop</option>
        {families.map(row => <option key={row.id} value={row.id}>{clipSituationLabel(row.eventId, row.situation)}</option>)}
      </select></label>
      <VideoCompositingFields value={compositing} onChange={setCompositing} />
      {localUrl ? <video src={localUrl} controls playsInline preload="metadata" aria-label="Förhandsvisa vald fil" style={{ width: '100%', maxHeight: 420 }} /> : null}
      {!families.length ? <p role="status">Inga egna klippfamiljer registrerade för vald dealer. Lägg in klippet via Klippbibliotek.</p> : null}
      <button type="submit" className="primary-button" disabled={disabled || busy || !file || !family}>{busy ? 'Sparar…' : 'Spara klipp'}</button>
    </fieldset></form>
    {busy ? <p role="status">{progress === 100 ? 'Filen är överförd. Väntar på sparat kvitto…' : `Laddar upp${progress === null ? '…' : ` · ${progress} %`}`}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {saved ? <div><video key={saved.id} src={saved.previewUrl} controls playsInline preload="metadata" aria-label="Förhandsvisa sparat klipp" style={{ width: '100%', maxHeight: 420 }} />
      <p>{saved.label}</p>
    </div> : null}
  </section>;
}
