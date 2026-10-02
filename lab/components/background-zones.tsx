'use client';

import { useEffect, useRef, useState } from 'react';
import { labUrl } from '../lib/lab-url.mjs';
import { firstAutomaticDelayMs, nextAutomaticDelayMs } from '../lib/background-zone-schedule.mjs';
import { ZONE_BROWSER_STORAGE as STORAGE, ZONE_CLOUD_DRAFT_STORAGE, persistBrowserZones, persistCloudZoneDraft, readCloudZoneDraft, adoptUploadedZoneClip, restoredCloudDraftState, zoneClipKey, zoneClipSource } from '../lib/zone-workspaces.mjs';
import styles from './background-zones.module.css';

const WIDTH = 1080, HEIGHT = 1920;
type Playback = 'continuous' | 'automatic' | 'off';
type Zone = { id: string; name: string; x: number; y: number; width: number; height: number; blend: 'screen' | 'normal'; playback?: Playback; clipName?: string; clipWidth?: number; clipHeight?: number; cloudClipId?: string };
type CloudZones = { configured: boolean; revision: number; zones: Zone[]; updatedAt?: string | null };
type Clip = { id: string; label: string; url: string };
type Point = { x: number; y: number };

function validZone(value: unknown): value is Zone {
  if (!value || typeof value !== 'object') return false;
  const zone = value as Zone;
  return typeof zone.id === 'string' && typeof zone.name === 'string'
    && [zone.x, zone.y, zone.width, zone.height].every(Number.isInteger)
    && zone.x >= 0 && zone.y >= 0 && zone.width > 0 && zone.height > 0
    && zone.x + zone.width <= WIDTH && zone.y + zone.height <= HEIGHT
    && (zone.blend === 'screen' || zone.blend === 'normal')
    && (zone.playback === undefined || zone.playback === 'continuous' || zone.playback === 'automatic' || zone.playback === 'off')
    && (zone.cloudClipId === undefined || typeof zone.cloudClipId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(zone.cloudClipId))
    && (zone.clipWidth === undefined || Number.isInteger(zone.clipWidth) && zone.clipWidth > 0)
    && (zone.clipHeight === undefined || Number.isInteger(zone.clipHeight) && zone.clipHeight > 0);
}

function clipFits(zone: Zone) {
  return (!zone.clipWidth || zone.clipWidth === zone.width) && (!zone.clipHeight || zone.clipHeight === zone.height);
}

function ZoneClip({ src, blend, playback }: { src: string; blend: Zone['blend']; playback: Playback }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (playback !== 'automatic') return;
    const element = video.current;
    if (!element) return;
    let timer: number;
    let stopped = false;
    let lastStart = 0;
    function schedule(delay: number) {
      timer = window.setTimeout(() => {
        if (stopped || !element) return;
        element.currentTime = 0;
        lastStart = performance.now();
        void element.play().then(() => setPlaying(true)).catch(() => {
          setPlaying(false);
          if (!stopped) schedule(5000);
        });
      }, delay);
    }
    function ended() {
      setPlaying(false);
      schedule(nextAutomaticDelayMs(lastStart, performance.now()));
    }
    element.addEventListener('ended', ended);
    schedule(firstAutomaticDelayMs());
    return () => { stopped = true; clearTimeout(timer); element.removeEventListener('ended', ended); element.pause(); };
  }, [src, playback]);
  if (playback === 'off') return null;
  return <video ref={video} src={src} autoPlay={playback === 'continuous'} muted loop={playback === 'continuous'} playsInline preload="auto" style={{ mixBlendMode: blend, visibility: playback === 'automatic' && !playing ? 'hidden' : 'visible' }} />;
}

function clipStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('croupier-background-zones', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('clips');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function clipOperation<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await clipStore();
  try { return await new Promise<T>((resolve, reject) => {
    const transaction = db.transaction('clips', mode);
    const request = run(transaction.objectStore('clips'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error || new Error('Klippet kunde inte sparas.'));
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}

function pointInFrame(event: React.PointerEvent<HTMLElement>, element: HTMLElement): Point {
  const bounds = element.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(WIDTH, Math.round((event.clientX - bounds.left) * WIDTH / bounds.width))),
    y: Math.max(0, Math.min(HEIGHT, Math.round((event.clientY - bounds.top) * HEIGHT / bounds.height))),
  };
}

function box(start: Point, end: Point) {
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(start.x - end.x), height: Math.abs(start.y - end.y) };
}

async function videoSize(file: Blob) {
  const url = URL.createObjectURL(file);
  try { return await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => reject(new Error('Klippet kunde inte läsas som video.'));
    video.src = url;
  }); } finally { URL.revokeObjectURL(url); }
}

async function makePulse(zone: Zone): Promise<Blob> {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('Webbläsaren kan inte spela in WebM. Använd Chrome eller lägg in ett eget klipp.');
  const canvas = document.createElement('canvas');
  canvas.width = zone.width; canvas.height = zone.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas kunde inte startas.');
  const stream = canvas.captureStream(24);
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error('WebM-inspelning saknas i webbläsaren.');
  const recorder = new MediaRecorder(stream, { mimeType });
  const pieces: BlobPart[] = [];
  recorder.ondataavailable = event => { if (event.data.size) pieces.push(event.data); };
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Inspelningen misslyckades.'));
    recorder.onstop = () => { stream.getTracks().forEach(track => track.stop()); resolve(new Blob(pieces, { type: 'video/webm' })); };
  });
  const started = performance.now();
  function paint(now: number) {
    const elapsed = Math.min(1, (now - started) / 2000);
    const strength = Math.pow(Math.max(0, Math.sin(Math.PI * elapsed * 3)), 3) * (1 - elapsed * .3);
    context!.fillStyle = '#000'; context!.fillRect(0, 0, zone.width, zone.height);
    const radiusX = zone.width * .58, radiusY = zone.height * .48;
    context!.save(); context!.translate(zone.width / 2, zone.height / 2);
    context!.scale(1, radiusY / radiusX);
    const glow = context!.createRadialGradient(0, 0, 0, 0, 0, radiusX);
    glow.addColorStop(0, `rgba(255,241,158,${.9 * strength})`);
    glow.addColorStop(.35, `rgba(255,190,68,${.5 * strength})`);
    glow.addColorStop(1, 'rgba(255,180,50,0)');
    context!.fillStyle = glow;
    context!.fillRect(-zone.width / 2, -zone.height * radiusX / (2 * radiusY), zone.width, zone.height * radiusX / radiusY);
    context!.restore();
    if (elapsed < 1) requestAnimationFrame(paint); else if (recorder.state === 'recording') recorder.stop();
  }
  recorder.start(); requestAnimationFrame(paint);
  return done;
}

export function BackgroundZones({ videos }: { videos: Clip[] }) {
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<Point | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState('');
  const [drawing, setDrawing] = useState<ReturnType<typeof box> | null>(null);
  const [clipUrls, setClipUrls] = useState<Record<string, string>>({});
  const urls = useRef<Record<string, string>>({});
  const [base, setBase] = useState('');
  const [baseSize, setBaseSize] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [workspace, setWorkspace] = useState<'local' | 'cloud'>('local');
  const [cloud, setCloud] = useState<CloudZones | null>(null);
  const [cloudStatus, setCloudStatus] = useState('Kontrollerar molnlagring…');
  const cloudBase = useRef('');
  const [hasCloudDraft, setHasCloudDraft] = useState(false);
  const [boundsDraft, setBoundsDraft] = useState({ x: '', y: '', width: '', height: '' });
  const active = zones.find(zone => zone.id === selected);
  useEffect(() => {
    if (active) setBoundsDraft({ x: String(active.x), y: String(active.y), width: String(active.width), height: String(active.height) });
  }, [selected]);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(STORAGE) || '[]'); if (Array.isArray(saved)) setZones(saved.filter(validZone)); }
    catch { setMessage('Sparade zoner kunde inte läsas.'); }
    try { setHasCloudDraft(Boolean(readCloudZoneDraft(localStorage, validZone))); }
    catch { setMessage('Ett sparat molnutkast kunde inte läsas. Webbläsarkopian finns kvar.'); }
    setHydrated(true);
    return () => { Object.values(urls.current).forEach(URL.revokeObjectURL); };
  }, []);
  useEffect(() => {
    if (hydrated && workspace === 'local') {
      try { persistBrowserZones(localStorage, workspace, zones); }
      catch { setMessage('Webbläsaren kunde inte spara koordinaterna. Exportera dem innan du lämnar sidan.'); }
    }
  }, [hydrated, zones, workspace]);
  useEffect(() => {
    if (hydrated && workspace === 'cloud' && cloud && JSON.stringify(zones) !== cloudBase.current) {
      try { persistCloudZoneDraft(localStorage, zones, cloud.revision); setHasCloudDraft(true); }
      catch { setMessage('Molnutkastet kunde inte sparas i webbläsaren. Exportera koordinaterna innan du lämnar sidan.'); }
    }
  }, [hydrated, zones, workspace, cloud]);
  useEffect(() => {
    let cancelled = false;
    void readCloud().then(value => {
      if (!cancelled) {
        // A draft may already have been restored while this initial check was
        // in flight. Keep its original revision so conflict protection survives.
        setCloud(current => current ? { ...current, configured: value.configured } : value);
        setCloudStatus(value.configured ? `Molnet har ${value.zones.length} zoner, version ${value.revision}.` : 'Molnlagring är inte konfigurerad på Lab-servern. Webbläsarkopian är kvar.');
      }
    }).catch(error => { if (!cancelled) setCloudStatus(error.message); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(zones.filter(zone => zone.clipName && !(workspace === 'cloud' && zone.cloudClipId && cloud?.configured) && !urls.current[`${workspace}:${zone.id}`]).map(async zone => {
      const key = zoneClipKey(workspace, zone.id);
      const blob = await clipOperation<Blob | undefined>('readonly', store => store.get(key));
      if (blob && !cancelled) { urls.current[`${workspace}:${zone.id}`] = URL.createObjectURL(blob); setClipUrls({ ...urls.current }); }
    })).catch(() => setMessage('Ett sparat zonklipp kunde inte läsas.'));
    return () => { cancelled = true; };
  }, [zones, workspace, cloud?.configured]);
  function clipUrl(zone: Zone) {
    return zoneClipSource(workspace, zone, clipUrls, (id: string) => labUrl(`/api/zones/clips/${id}`), !cloud?.configured);
  }
  async function readCloud(): Promise<CloudZones> {
    const response = await fetch(labUrl('/api/zones'), { cache: 'no-store' });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Molnzonerna kunde inte läsas. Webbläsarkopian finns kvar.');
    if (!Array.isArray(value.zones) || !value.zones.every(validZone) || !Number.isSafeInteger(value.revision)) throw new Error('Molnsvaret är ogiltigt. Dina zoner har bevarats.');
    return value;
  }
  async function loadCloud() {
    setBusy(true);
    try {
      const value = await readCloud();
      setCloud(value);
      if (!value.configured) throw new Error('Molnlagring är inte konfigurerad på Lab-servern.');
      // Switching views never writes the cloud document over browser geometry/clips.
      cloudBase.current = JSON.stringify(value.zones);
      setWorkspace('cloud'); setZones(value.zones); setSelected('');
      setCloudStatus(`Molnvy: ${value.zones.length} zoner, version ${value.revision}.`);
      setMessage('Molnzonerna är inlästa. Webbläsarkopian och eventuellt osparat molnutkast finns kvar via återställningsknapparna. Ändringar sparas med Spara till molnet.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Molnzonerna kunde inte läsas.'); }
    finally { setBusy(false); }
  }
  function restoreBrowser() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || '[]');
      if (!Array.isArray(saved) || !saved.every(validZone)) throw new Error('Webbläsarkopian är ogiltig. Exportera de synliga zonerna först.');
      setWorkspace('local'); setZones(saved); setSelected(''); setMessage('Webbläsarkopian är inläst.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Webbläsarkopian kunde inte läsas.'); }
  }
  function restoreCloudDraft() {
    try {
      const draft = readCloudZoneDraft(localStorage, validZone);
      if (!draft) throw new Error('Det finns inget läsbart molnutkast.');
      cloudBase.current = '';
      setWorkspace('cloud'); setZones(draft.zones); setSelected('');
      setCloud(restoredCloudDraftState(draft, cloud));
      setMessage(`Molnutkastet från version ${draft.revision} är återställt. ${cloud?.configured ? 'Tidigare uppladdade klipp kan återanvändas.' : 'Frånkopplat läge: lokalt bevarade klipp och export fungerar; molnsparning kräver anslutning.'} Webbläsarkopian är bevarad.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Molnutkastet kunde inte återställas.'); }
  }
  async function saveCloud() {
    setBusy(true);
    try {
      if (!cloud?.configured) throw new Error('Läs från molnet för att kontrollera anslutningen innan du sparar.');
      let saved: Zone[] = zones.map(zone => ({ ...zone }));
      for (const zone of zones) {
        if (!clipFits(zone)) throw new Error(`${zone.name}: ersätt klippet med exakt ${zone.width} × ${zone.height} px innan molnsparning.`);
        if (!zone.clipName || zone.cloudClipId) continue;
        const key = zoneClipKey(workspace, zone.id);
        const blob = await clipOperation<Blob | undefined>('readonly', store => store.get(key));
        if (!blob) throw new Error(`${zone.name}: klippet saknas i webbläsaren. Lägg in det igen innan molnsparning.`);
        const contentType = /\.webm$/i.test(zone.clipName) ? 'video/webm' : /\.mp4$/i.test(zone.clipName) ? 'video/mp4' : blob.type.split(';')[0];
        const response = await fetch(labUrl('/api/zones/clips'), { method: 'POST', headers: { 'Content-Type': contentType, 'X-Zone-Width': String(zone.width), 'X-Zone-Height': String(zone.height) }, body: blob });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || `Zonklippet ${zone.name} kunde inte laddas upp.`);
        saved = adoptUploadedZoneClip(saved, zone.id, value);
        // Persist each completed upload even when a later upload/save fails.
        setZones(saved);
        if (workspace === 'local') persistBrowserZones(localStorage, workspace, saved);
        else { persistCloudZoneDraft(localStorage, saved, cloud.revision); setHasCloudDraft(true); }
      }
      const response = await fetch(labUrl('/api/zones'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: cloud.revision, zones: saved }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Molnzonerna kunde inte sparas.');
      setCloud(value); setZones(value.zones);
      let draftWarning = '';
      if (workspace === 'cloud') {
        cloudBase.current = JSON.stringify(value.zones);
        try {
          const draft = readCloudZoneDraft(localStorage, validZone);
          if (draft && JSON.stringify(draft.zones) === JSON.stringify(saved)) { localStorage.removeItem(ZONE_CLOUD_DRAFT_STORAGE); setHasCloudDraft(false); }
        } catch { draftWarning = ' Det lokala molnutkastet kunde inte städas, men molnsparningen lyckades.'; }
      }
      setCloudStatus(`Sparat i molnet: ${saved.length} zoner, version ${value.revision}.`);
      setMessage(`Zonerna och klippen är sparade i molnet. Läs från molnet för att kontrollera återläsningen. Webbläsarkopian har bevarats.${draftWarning}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Molnsparningen misslyckades. Webbläsarkopian finns kvar.'); }
    finally { setBusy(false); }
  }
  function change(id: string, patch: Partial<Zone>) { setZones(current => current.map(zone => zone.id === id ? { ...zone, ...patch } : zone)); }
  function applyBounds() {
    if (!active) return;
    const values = Object.values(boundsDraft);
    if (!values.every(value => /^\d+$/.test(value))) { setMessage('Pixelrutan kräver fyra heltal.'); return; }
    const x = Number(boundsDraft.x), y = Number(boundsDraft.y), width = Number(boundsDraft.width), height = Number(boundsDraft.height);
    if (width < 4 || height < 4 || x + width > WIDTH || y + height > HEIGHT) { setMessage(`Rutan måste vara minst 4 × 4 px och rymmas inom ${WIDTH} × ${HEIGHT} px.`); return; }
    const resized = width !== active.width || height !== active.height;
    change(active.id, { x, y, width, height, ...(resized && active.clipName ? { clipWidth: active.clipWidth || active.width, clipHeight: active.clipHeight || active.height } : {}) });
    setMessage(resized && active.clipName ? 'Pixelrutan sparades. Det gamla klippet finns kvar för nedladdning men behöver ersättas eller skapas om i den nya storleken.' : 'Pixelrutan sparades.');
  }
  function start(event: React.PointerEvent<HTMLDivElement>) {
    if (!frame.current || event.target !== frame.current && event.target !== frame.current.querySelector('img')) return;
    drag.current = pointInFrame(event, frame.current); frame.current.setPointerCapture(event.pointerId); setDrawing(null); setMessage('');
  }
  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current && frame.current) setDrawing(box(drag.current, pointInFrame(event, frame.current)));
  }
  function end(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current || !frame.current) return;
    const bounds = box(drag.current, pointInFrame(event, frame.current)); drag.current = null; setDrawing(null);
    if (bounds.width < 4 || bounds.height < 4) { setMessage('Dra en ruta på minst 4 × 4 pixlar.'); return; }
    const zone: Zone = { id: crypto.randomUUID(), name: `Zon ${zones.length + 1}`, ...bounds, blend: 'screen', playback: 'continuous' };
    setZones(current => [...current, zone]); setSelected(zone.id);
  }
  async function saveClip(blob: Blob, name: string) {
    if (!active) return;
    const key = zoneClipKey(workspace, active.id), urlKey = `${workspace}:${active.id}`;
    await clipOperation('readwrite', store => store.put(blob, key));
    if (urls.current[urlKey]) URL.revokeObjectURL(urls.current[urlKey]);
    urls.current[urlKey] = URL.createObjectURL(blob); setClipUrls({ ...urls.current });
    change(active.id, { clipName: name, clipWidth: active.width, clipHeight: active.height, cloudClipId: undefined }); setMessage(`Zonklippet ${name} sparades lokalt i webbläsaren. Välj Spara till molnet för molnlagring.`);
  }
  async function upload(file: File) {
    if (!active) return;
    if (file.size > 64 * 1024 * 1024) { setMessage('Zonklippet får vara högst 64 MiB.'); return; }
    setBusy(true);
    try {
      const size = await videoSize(file);
      if (size.width !== active.width || size.height !== active.height) throw new Error(`Klippet är ${size.width} × ${size.height}; zonen kräver exakt ${active.width} × ${active.height}.`);
      await saveClip(file, file.name);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Klippet kunde inte sparas.'); }
    finally { setBusy(false); }
  }
  async function pulse() {
    if (!active) return;
    setBusy(true);
    try {
      const clip = await makePulse(active), size = await videoSize(clip);
      if (size.width !== active.width || size.height !== active.height) throw new Error(`Webbläsaren skapade ${size.width} × ${size.height} i stället för ${active.width} × ${active.height}. Välj en ny zon med jämna mått.`);
      await saveClip(clip, `${active.name.replace(/[^a-z0-9_-]/gi, '-')}-blink.webm`);
      change(active.id, { blend: 'screen' });
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Blinkklippet kunde inte skapas.'); }
    finally { setBusy(false); }
  }
  async function downloadClip() {
    if (!active?.clipName) return;
    const src = clipUrl(active);
    if (!src) { setMessage('Zonklippet finns inte längre i webbläsaren.'); return; }
    const link = document.createElement('a'); link.href = src; link.download = active.clipName; link.click();
  }
  async function downloadCrop() {
    if (!active) return;
    try {
      const source = new Image(); source.src = labUrl('/api/zones/reference'); await source.decode();
      const canvas = document.createElement('canvas'); canvas.width = active.width; canvas.height = active.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Bilden kunde inte beskäras.');
      context.drawImage(source, active.x, active.y, active.width, active.height, 0, 0, active.width, active.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG kunde inte skapas.')), 'image/png'));
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `${active.name.replace(/[^a-z0-9_-]/gi, '-')}-startbild.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Bilden kunde inte sparas.'); }
  }
  async function remove() {
    if (!active) return;
    const key = zoneClipKey(workspace, active.id), urlKey = `${workspace}:${active.id}`;
    await clipOperation('readwrite', store => store.delete(key));
    if (urls.current[urlKey]) { URL.revokeObjectURL(urls.current[urlKey]); delete urls.current[urlKey]; setClipUrls({ ...urls.current }); }
    setZones(current => current.filter(zone => zone.id !== active.id)); setSelected('');
  }
  function exportJson() {
    const output = { schemaVersion: 1, dealer: 'astrid', reference: 'emil/dealklipp-v1/astrid_startbild_spel_1080x1920.png', frame: { width: WIDTH, height: HEIGHT }, zones: zones.map(zone => ({ ...zone, playback: zone.playback || 'continuous', clipName: zone.clipName || null })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'astrid-bakgrundszoner.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const displayed = videos.find(video => video.id === base);
  return <div className={styles.shell}>
    <header className={styles.header}><a href={labUrl('/')}>← Backoffice/Lab</a><div><span className="eyebrow">ASTRID · STUDIO</span><h1>Bakgrundszoner</h1></div><button onClick={exportJson} disabled={!zones.length}>Exportera koordinater</button></header>
    <main className={styles.main}>
      <p className={styles.intro}>Dra en ruta på startbilden. Rutan blir en exakt pixelzon för ett eget litet klipp. Välj sedan om klippet ska visas hela tiden eller starta automatiskt. Zonklippet styrs oberoende av dealerklippet i förhandsvisningen. Ingenting skrivs in i originalfilmerna eller spelets uppspelning.</p>
      <section aria-label="Molnlagring"><p><strong>{workspace === 'local' ? 'Webbläsarkopia' : 'Molnvy'}</strong> · {cloudStatus}</p><div className={styles.actions}><button disabled={busy || !hydrated || !cloud?.configured} onClick={() => void saveCloud()}>{busy ? 'Arbetar…' : 'Spara till molnet'}</button><button disabled={busy || !hydrated} onClick={() => void loadCloud()}>Läs från molnet</button>{workspace === 'cloud' ? <button disabled={busy} onClick={restoreBrowser}>Till webbläsarkopian</button> : null}{hasCloudDraft ? <button disabled={busy} onClick={restoreCloudDraft}>Återställ molnutkast</button> : null}</div><p className={styles.note}>Spara till molnet sparar de synliga zonerna och ersätter tidigare molnkoordinater. Läs från molnet öppnar en separat vy; din webbläsarkopia och dess klipp behålls. Osparade molnändringar kan återställas som molnutkast. Molnklipp kräver Lab-inloggning.</p></section>
      {message ? <p role="status" className={styles.message}>{message}</p> : null}
      <div className={styles.layout} inert={busy || undefined}>
        <section><div className={styles.toolbar}><label>Underlag för prov<select value={base} onChange={event => { setBase(event.target.value); setBaseSize(''); }}><option value="">Startbild</option>{videos.map(video => <option value={video.id} key={video.id}>{video.label}</option>)}</select></label><span>Referens: {WIDTH} × {HEIGHT} px</span></div>
          <div ref={frame} className={styles.frame} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { drag.current = null; setDrawing(null); }}>
            <img src={labUrl('/api/zones/reference')} alt="Astrids startbild för bakgrundszoner" draggable={false} />
            {displayed ? <video key={displayed.id} className={styles.baseVideo} src={displayed.url} autoPlay muted loop playsInline onLoadedMetadata={event => { const video = event.currentTarget; setBaseSize(`${video.videoWidth} × ${video.videoHeight}`); }} /> : null}
            {zones.map(zone => <div key={zone.id} className={`${styles.zone} ${zone.id === selected ? styles.selected : ''}`} style={{ left: `${zone.x / WIDTH * 100}%`, top: `${zone.y / HEIGHT * 100}%`, width: `${zone.width / WIDTH * 100}%`, height: `${zone.height / HEIGHT * 100}%` }} onClick={() => setSelected(zone.id)}>
              {clipUrl(zone) && clipFits(zone) ? <ZoneClip key={`${zone.id}:${zone.playback || 'continuous'}`} src={clipUrl(zone)} blend={zone.blend} playback={zone.playback || 'continuous'} /> : null}<span>{zone.name}</span></div>)}
            {drawing ? <div className={styles.drawing} style={{ left: `${drawing.x / WIDTH * 100}%`, top: `${drawing.y / HEIGHT * 100}%`, width: `${drawing.width / WIDTH * 100}%`, height: `${drawing.height / HEIGHT * 100}%` }} /> : null}
          </div>
          {displayed && baseSize ? <p className={styles.note}>Provklippets bildyta: {baseSize}. {baseSize !== `${WIDTH} × ${HEIGHT}` ? 'Avvikande upplösning: kontrollera att motivet verkligen ligger på samma relativa plats innan zonen används.' : 'Kontrollera fortfarande kameraregistrering och eventuell rörelse i zonen.'}</p> : null}
        </section>
        <aside className={styles.panel}><h2>Zoner</h2><p>Klicka på en ruta för att redigera den. {workspace === 'local' ? 'Koordinater och zonklipp sparas i den här webbläsarprofilen.' : 'Ändringar i molnvyn behöver sparas med Spara till molnet.'}</p>
          <div className={styles.list}>{zones.map(zone => <button key={zone.id} className={zone.id === selected ? styles.current : ''} onClick={() => setSelected(zone.id)}>{zone.name}<small>{zone.x}, {zone.y} · {zone.width} × {zone.height} px{zone.clipName ? ' · klipp' : ''}</small></button>)}</div>
          {active ? <div className={styles.editor}><label>Namn<input value={active.name} maxLength={50} onChange={event => change(active.id, { name: event.target.value })} /></label><p><strong>Pixelruta:</strong> x {active.x}–{active.x + active.width - 1}, y {active.y}–{active.y + active.height - 1}<br /><strong>Klippstorlek:</strong> {active.width} × {active.height} px</p>
            <div className={styles.boundsGrid}>{(['x', 'y', 'width', 'height'] as const).map(field => <label key={field}>{({ x: 'X', y: 'Y', width: 'Bredd', height: 'Höjd' })[field]}<input type="number" min={field === 'x' || field === 'y' ? 0 : 4} max={field === 'x' || field === 'width' ? WIDTH : HEIGHT} value={boundsDraft[field]} onChange={event => setBoundsDraft(current => ({ ...current, [field]: event.target.value }))} /></label>)}</div>
            <button onClick={applyBounds}>Spara pixelruta</button>
            <label>Blandning<select value={active.blend} onChange={event => change(active.id, { blend: event.target.value as Zone['blend'] })}><option value="screen">Ljus (svart blir osynligt)</option><option value="normal">Vanlig video / alfakanal</option></select></label>
            <label>Uppspelning<select value={active.playback || 'continuous'} onChange={event => change(active.id, { playback: event.target.value as Playback })}><option value="continuous">Hela tiden</option><option value="automatic">Automatisk · högst 2/minut</option><option value="off">Av</option></select></label>
            {active.playback === 'automatic' ? <p>Första start inom 10 sekunder. Därefter minst 30 sekunder mellan starterna, plus 0–10 sekunder slump. Klippet spelas klart innan nästa start. Timern fortsätter när du byter dealerklipp i Labbet.</p> : null}
            <p><strong>Zonklipp:</strong> {active.clipName ? clipFits(active) ? active.clipName : `${active.clipName} har gamla mått ${active.clipWidth} × ${active.clipHeight} px. Skapa eller lägg in ett nytt klipp för ${active.width} × ${active.height} px.` : `Inget sparat klipp. Lägg in en video som är exakt ${active.width} × ${active.height} px eller välj Skapa blinkklipp.`}</p>
            <div className={styles.actions}><button onClick={() => void downloadCrop()}>Ladda ned zonens startbild</button><button disabled={busy} onClick={() => void pulse()}>{busy ? 'Arbetar…' : 'Skapa blinkklipp'}</button><label className={styles.upload}>Lägg in eget zonklipp<input type="file" accept="video/mp4,video/webm" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} /></label></div>
            {active.clipName ? <button onClick={() => void downloadClip()}>Ladda ned {active.clipName}</button> : null}<button className={styles.danger} onClick={() => void remove()}>Ta bort zon</button>
          </div> : <p>Rita din första zon på bilden.</p>}
          <p className={styles.note}>En rektangel är masken. Ett eget klipp måste ha exakt zonens pixelstorlek. För lampor fungerar ljusblandning; objekt bakom en rörlig dealer kräver separat förgrundsmask. Prova varje relevant grundfilm och variant visuellt.</p>
        </aside>
      </div>
    </main>
  </div>;
}
