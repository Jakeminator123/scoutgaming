'use client';

import { useEffect, useRef, useState } from 'react';
import { labUrl } from '../lib/lab-url.mjs';
import { firstAutomaticDelayMs, nextAutomaticDelayMs } from '../lib/background-zone-schedule.mjs';
import styles from './background-zones.module.css';

const WIDTH = 1080, HEIGHT = 1920;
const STORAGE = 'croupier.astrid.background-zones.v1';
type Playback = 'continuous' | 'automatic' | 'off';
type Zone = { id: string; name: string; x: number; y: number; width: number; height: number; blend: 'screen' | 'normal'; playback?: Playback; clipName?: string };
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
    && (zone.playback === undefined || zone.playback === 'continuous' || zone.playback === 'automatic' || zone.playback === 'off');
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
    const request = run(db.transaction('clips', mode).objectStore('clips'));
    request.onsuccess = () => resolve(request.result);
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
    const radius = Math.max(zone.width, zone.height) * .72;
    const glow = context!.createRadialGradient(zone.width / 2, zone.height / 2, 0, zone.width / 2, zone.height / 2, radius);
    glow.addColorStop(0, `rgba(255,241,158,${.9 * strength})`);
    glow.addColorStop(.35, `rgba(255,190,68,${.5 * strength})`);
    glow.addColorStop(1, 'rgba(255,180,50,0)');
    context!.fillStyle = glow; context!.fillRect(0, 0, zone.width, zone.height);
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
  const active = zones.find(zone => zone.id === selected);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(STORAGE) || '[]'); if (Array.isArray(saved)) setZones(saved.filter(validZone)); }
    catch { setMessage('Sparade zoner kunde inte läsas.'); }
    setHydrated(true);
    return () => { Object.values(urls.current).forEach(URL.revokeObjectURL); };
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE, JSON.stringify(zones)); }, [hydrated, zones]);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(zones.filter(zone => zone.clipName && !urls.current[zone.id]).map(async zone => {
      const blob = await clipOperation<Blob | undefined>('readonly', store => store.get(zone.id));
      if (blob && !cancelled) { urls.current[zone.id] = URL.createObjectURL(blob); setClipUrls({ ...urls.current }); }
    })).catch(() => setMessage('Ett sparat zonklipp kunde inte läsas.'));
    return () => { cancelled = true; };
  }, [zones]);
  function change(id: string, patch: Partial<Zone>) { setZones(current => current.map(zone => zone.id === id ? { ...zone, ...patch } : zone)); }
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
    await clipOperation('readwrite', store => store.put(blob, active.id));
    if (urls.current[active.id]) URL.revokeObjectURL(urls.current[active.id]);
    urls.current[active.id] = URL.createObjectURL(blob); setClipUrls({ ...urls.current });
    change(active.id, { clipName: name }); setMessage(`Zonklippet ${name} sparades lokalt i webbläsaren.`);
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
    const blob = await clipOperation<Blob | undefined>('readonly', store => store.get(active.id));
    if (!blob) { setMessage('Zonklippet finns inte längre i webbläsaren.'); return; }
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = active.clipName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    await clipOperation('readwrite', store => store.delete(active.id));
    if (urls.current[active.id]) { URL.revokeObjectURL(urls.current[active.id]); delete urls.current[active.id]; setClipUrls({ ...urls.current }); }
    setZones(current => current.filter(zone => zone.id !== active.id)); setSelected('');
  }
  function exportJson() {
    const output = { schemaVersion: 1, dealer: 'astrid', reference: 'emil/dealklipp-v1/astrid_startbild_spel_1080x1920.png', frame: { width: WIDTH, height: HEIGHT }, zones: zones.map(({ id, name, x, y, width, height, blend, playback, clipName }) => ({ id, name, x, y, width, height, blend, playback: playback || 'continuous', clipName: clipName || null })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'astrid-bakgrundszoner.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const displayed = videos.find(video => video.id === base);
  return <div className={styles.shell}>
    <header className={styles.header}><a href={labUrl('/')}>← Astrid Studio</a><div><span className="eyebrow">ASTRID · LOKALT LABB</span><h1>Bakgrundszoner</h1></div><button onClick={exportJson} disabled={!zones.length}>Exportera koordinater</button></header>
    <main className={styles.main}>
      <p className={styles.intro}>Dra en ruta på startbilden. Rutan blir en exakt pixelzon för ett eget litet klipp. Välj sedan om klippet ska visas hela tiden eller starta automatiskt. Zonklippet styrs oberoende av dealerklippet i förhandsvisningen. Ingenting skrivs in i originalfilmerna eller spelets uppspelning.</p>
      {message ? <p role="status" className={styles.message}>{message}</p> : null}
      <div className={styles.layout}>
        <section><div className={styles.toolbar}><label>Underlag för prov<select value={base} onChange={event => { setBase(event.target.value); setBaseSize(''); }}><option value="">Startbild</option>{videos.map(video => <option value={video.id} key={video.id}>{video.label}</option>)}</select></label><span>Referens: {WIDTH} × {HEIGHT} px</span></div>
          <div ref={frame} className={styles.frame} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { drag.current = null; setDrawing(null); }}>
            <img src={labUrl('/api/zones/reference')} alt="Astrids startbild för bakgrundszoner" draggable={false} />
            {displayed ? <video key={displayed.id} className={styles.baseVideo} src={displayed.url} autoPlay muted loop playsInline onLoadedMetadata={event => { const video = event.currentTarget; setBaseSize(`${video.videoWidth} × ${video.videoHeight}`); }} /> : null}
            {zones.map(zone => <div key={zone.id} className={`${styles.zone} ${zone.id === selected ? styles.selected : ''}`} style={{ left: `${zone.x / WIDTH * 100}%`, top: `${zone.y / HEIGHT * 100}%`, width: `${zone.width / WIDTH * 100}%`, height: `${zone.height / HEIGHT * 100}%` }} onClick={() => setSelected(zone.id)}>
              {clipUrls[zone.id] ? <ZoneClip key={`${zone.id}:${zone.playback || 'continuous'}`} src={clipUrls[zone.id]} blend={zone.blend} playback={zone.playback || 'continuous'} /> : null}<span>{zone.name}</span></div>)}
            {drawing ? <div className={styles.drawing} style={{ left: `${drawing.x / WIDTH * 100}%`, top: `${drawing.y / HEIGHT * 100}%`, width: `${drawing.width / WIDTH * 100}%`, height: `${drawing.height / HEIGHT * 100}%` }} /> : null}
          </div>
          {displayed && baseSize ? <p className={styles.note}>Provklippets bildyta: {baseSize}. {baseSize !== `${WIDTH} × ${HEIGHT}` ? 'Avvikande upplösning: kontrollera att motivet verkligen ligger på samma relativa plats innan zonen används.' : 'Kontrollera fortfarande kameraregistrering och eventuell rörelse i zonen.'}</p> : null}
        </section>
        <aside className={styles.panel}><h2>Zoner</h2><p>Klicka på en ruta för att redigera den. Koordinater och zonklipp sparas i den här webbläsarprofilen.</p>
          <div className={styles.list}>{zones.map(zone => <button key={zone.id} className={zone.id === selected ? styles.current : ''} onClick={() => setSelected(zone.id)}>{zone.name}<small>{zone.x}, {zone.y} · {zone.width} × {zone.height} px{zone.clipName ? ' · klipp' : ''}</small></button>)}</div>
          {active ? <div className={styles.editor}><label>Namn<input value={active.name} maxLength={50} onChange={event => change(active.id, { name: event.target.value })} /></label><p><strong>Pixelruta:</strong> x {active.x}–{active.x + active.width - 1}, y {active.y}–{active.y + active.height - 1}<br /><strong>Klippstorlek:</strong> {active.width} × {active.height} px</p>
            <label>Blandning<select value={active.blend} onChange={event => change(active.id, { blend: event.target.value as Zone['blend'] })}><option value="screen">Ljus (svart blir osynligt)</option><option value="normal">Vanlig video / alfakanal</option></select></label>
            <label>Uppspelning<select value={active.playback || 'continuous'} onChange={event => change(active.id, { playback: event.target.value as Playback })}><option value="continuous">Hela tiden</option><option value="automatic">Automatisk · högst 2/minut</option><option value="off">Av</option></select></label>
            {active.playback === 'automatic' ? <p>Första start inom 10 sekunder. Därefter minst 30 sekunder mellan starterna, plus 0–10 sekunder slump. Klippet spelas klart innan nästa start. Timern fortsätter när du byter dealerklipp i Labbet.</p> : null}
            <p><strong>Zonklipp:</strong> {active.clipName ? active.clipName : `Inget sparat klipp. Lägg in en video som är exakt ${active.width} × ${active.height} px eller välj Skapa blinkklipp.`}</p>
            <div className={styles.actions}><button onClick={() => void downloadCrop()}>Ladda ned zonens startbild</button><button disabled={busy} onClick={() => void pulse()}>{busy ? 'Arbetar…' : 'Skapa blinkklipp'}</button><label className={styles.upload}>Lägg in eget zonklipp<input type="file" accept="video/mp4,video/webm" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} /></label></div>
            {active.clipName ? <button onClick={() => void downloadClip()}>Ladda ned {active.clipName}</button> : null}<button className={styles.danger} onClick={() => void remove()}>Ta bort zon</button>
          </div> : <p>Rita din första zon på bilden.</p>}
          <p className={styles.note}>En rektangel är masken. Ett eget klipp måste ha exakt zonens pixelstorlek. För lampor fungerar ljusblandning; objekt bakom en rörlig dealer kräver separat förgrundsmask. Prova varje relevant grundfilm och variant visuellt.</p>
        </aside>
      </div>
    </main>
  </div>;
}
