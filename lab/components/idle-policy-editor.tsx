'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createIdlePreviewPlan, idleShareEstimate, MAX_IDLE_VARIANTS, type IdlePolicy, type IdleVariantPolicy, type IdleVariantUse } from '../lib/idle-policy.mjs';
import type { VideoEntry, VideoInventory } from './studio-types';
import styles from './idle-policy-editor.module.css';

const useLabels: Record<IdleVariantUse, string> = {
  manual: 'Manuell',
  automatic: 'Automatisk',
  rules: 'Regelstyrd',
  openclaw: 'OpenClaw',
};

const seconds = (milliseconds: number) => Math.round(milliseconds / 1000);
const percent = (value: number) => `${Math.round(value * 100)} %`;

function fileLabel(video: VideoEntry | undefined, videoId: string) {
  return video?.fileName.replace(/\.mp4$/i, '') ?? `Saknad video · ${videoId.slice(0, 8)}`;
}

function weightedBase(base: IdlePolicy['base'], primaryId: string, primaryWeight: number) {
  const primary = base.find(item => item.videoId === primaryId) ?? base[0];
  const rest = base.filter(item => item.videoId !== primary.videoId);
  if (!rest.length) return [{ ...primary, weight: 100 }];
  const safePrimary = Math.max(1, Math.min(100 - rest.length, primaryWeight));
  let remaining = 100 - safePrimary;
  return [{ ...primary, weight: safePrimary }, ...rest.map((item, index) => {
    const slots = rest.length - index;
    const weight = index === rest.length - 1 ? remaining : Math.max(1, Math.round(remaining / slots));
    remaining -= weight;
    return { ...item, weight };
  })];
}

function usageDescription(item: IdleVariantPolicy) {
  if (item.use !== 'automatic' || !item.automatic) return useLabels[item.use];
  return `Automatisk · cirka var ${seconds(item.automatic.averageEveryMs)}:e sekund`;
}

export function IdlePolicyEditor({ policy, inventory, blocked, onChange, onBusyChange }: {
  policy: IdlePolicy;
  inventory: VideoInventory;
  blocked: boolean;
  onChange: (policy: IdlePolicy) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const family = inventory.families?.find(item => item.id === policy.familyId);
  const byId = useMemo(() => new Map(inventory.videos.map(item => [item.id, item])), [inventory.videos]);
  const estimate = useMemo(() => idleShareEstimate(policy), [policy]);
  const [seed, setSeed] = useState(25);
  const [showPlan, setShowPlan] = useState(false);
  const [previewId, setPreviewId] = useState(policy.base[0]?.videoId ?? '');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [planIndex, setPlanIndex] = useState<number | null>(null);
  const [playSerial, setPlaySerial] = useState(0);
  const [playRequested, setPlayRequested] = useState(false);
  const [actualLog, setActualLog] = useState<string[]>([]);
  const [importError, setImportError] = useState('');
  const [filter, setFilter] = useState('');
  const playback = useRef<{ serial: number; started: boolean } | null>(null);
  const segmentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preview = byId.get(previewId);
  const unconfigured = family?.variantIds.filter(id => !policy.variants.some(item => item.videoId === id)) ?? [];
  const plan = useMemo(() => createIdlePreviewPlan(policy, { seed, durationMs: 60000 }), [policy, seed]);
  const primary = policy.base[0];
  const primaryActualShare = primary ? estimate.shares[primary.videoId] ?? 0 : 0;
  const visibleVariants = policy.variants.filter(item => `${fileLabel(byId.get(item.videoId), item.videoId)} ${useLabels[item.use]} ${item.description ?? ''}`.toLocaleLowerCase('sv').includes(filter.trim().toLocaleLowerCase('sv')));

  useEffect(() => {
    if (!blocked) return;
    stop('Avbrutet av tal eller spelhandling');
  }, [blocked, onBusyChange]);
  useEffect(() => () => { if (segmentTimer.current) clearTimeout(segmentTimer.current); playback.current = null; videoRef.current?.pause(); onBusyChange(false); }, [onBusyChange]);

  function log(text: string) { setActualLog(current => [...current, text].slice(-60)); }
  function stop(reason = 'Stoppat') {
    if (segmentTimer.current) clearTimeout(segmentTimer.current);
    if (playback.current) log(reason);
    playback.current = null; setPlanIndex(null); setPlayRequested(false);
    videoRef.current?.pause(); onBusyChange(false);
  }
  function startClip(videoId: string, index: number | null) {
    if (segmentTimer.current) clearTimeout(segmentTimer.current);
    if (!byId.get(videoId)?.available) { stop('Klippet saknas — provet avbröts'); return; }
    const serial = playSerial + 1;
    playback.current = { serial, started: false };
    setPlaySerial(serial); setPlanIndex(index); setPreviewId(videoId); setPlayRequested(true);
    if (index !== null && plan[index].kind === 'variant') log(`scheduled · ${fileLabel(byId.get(videoId), videoId)}`);
  }
  function advance(serial: number) {
    if (playback.current?.serial !== serial || !playback.current.started) return;
    log(`${planIndex !== null && plan[planIndex].kind === 'base' ? 'base segment ended' : 'completed'} · ${fileLabel(preview, previewId)}`);
    if (planIndex === null) {
      if (family?.variantIds.includes(previewId)) {
        log('base resumed'); startClip(primary.videoId, null);
      } else stop('Klippet klart');
    } else if (planIndex + 1 < plan.length) {
      if (plan[planIndex].kind === 'variant' && plan[planIndex + 1].kind === 'base') log('base resumed');
      startClip(plan[planIndex + 1].videoId, planIndex + 1);
    } else stop('Minutprovet klart');
  }

  function setPrimary(videoId: string) {
    stop('Inställningen ändrades');
    onChange({ ...policy, base: weightedBase(policy.base, videoId, primary.weight) });
  }
  function setPrimaryWeight(weight: number) {
    stop('Inställningen ändrades');
    onChange({ ...policy, base: weightedBase(policy.base, primary.videoId, weight) });
  }
  function updateVariant(videoId: string, patch: Partial<IdleVariantPolicy>) {
    stop('Inställningen ändrades');
    onChange({ ...policy, variants: policy.variants.map(item => item.videoId === videoId ? { ...item, ...patch } : item) });
  }
  function setUse(item: IdleVariantPolicy, use: IdleVariantUse) {
    updateVariant(item.videoId, {
      use,
      automatic: use === 'automatic' ? item.automatic ?? { averageEveryMs: 25000, jitterMs: 5000, cooldownMs: 15000, maxPerMinute: 3 } : null,
    });
  }
  function setAutomatic(item: IdleVariantPolicy, key: 'averageEveryMs' | 'jitterMs' | 'cooldownMs' | 'maxPerMinute', value: number) {
    if (!item.automatic) return;
    updateVariant(item.videoId, { automatic: { ...item.automatic, [key]: value } });
  }
  function play(videoId: string) {
    stop(); setActualLog([]); startClip(videoId, null);
  }

  async function addVariant(videoId: string) {
    const video = byId.get(videoId);
    if (!video?.available || policy.variants.length >= MAX_IDLE_VARIANTS) return;
    setImportError('');
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    try {
      const durationMs = await new Promise<number>((resolve, reject) => {
        probe.onloadedmetadata = () => resolve(Math.round(probe.duration * 1000));
        probe.onerror = () => reject(new Error('Videons längd kunde inte läsas.'));
        probe.src = video.previewUrl;
      });
      if (!Number.isInteger(durationMs) || durationMs < 200 || durationMs > 60000) throw new Error('Idleklippet måste vara mellan 0,2 och 60 sekunder.');
      onChange({ ...policy, variants: [...policy.variants, { videoId, durationMs, use: 'manual', automatic: null, description: '' }] });
    } catch (error) { setImportError(error instanceof Error ? error.message : 'Kunde inte läsa videon.'); }
    finally { probe.removeAttribute('src'); probe.load(); }
  }

  const events = plan.flatMap((segment, index) => segment.kind === 'variant' ? [
    { at: segment.startMs, label: 'scheduled', videoId: segment.videoId },
    { at: segment.startMs, label: 'started', videoId: segment.videoId },
    { at: segment.endMs, label: 'completed', videoId: segment.videoId },
    ...(plan[index + 1]?.kind === 'base' ? [{ at: segment.endMs, label: 'base resumed', videoId: plan[index + 1].videoId }] : []),
  ] : []).slice(0, 16);

  return <div className={styles.editor}>
    <section className={styles.section}>
      <div className={styles.sectionHeading}><span>1</span><div><h3>Grundloop</h3><p>Det här visas mellan kort, tal och korta variationer.</p></div></div>
      {!family ? <p className={styles.warning}>Idlefamiljen saknas i videomanifestet.</p> : null}
      <label className="field">Huvudloop<select value={primary.videoId} onChange={event => setPrimary(event.target.value)}>{policy.base.map(item => <option key={item.videoId} value={item.videoId}>{fileLabel(byId.get(item.videoId), item.videoId)}</option>)}</select></label>
      <details className={styles.help}><summary>Fördelning mellan loopar och variationer</summary>
        {policy.base.length > 1 ? <label className={styles.range}>Huvudloopens andel före variationer <strong>{primary.weight} %</strong><input type="range" min={50} max={99} value={primary.weight} onChange={event => setPrimaryWeight(Number(event.target.value))} /></label> : null}
        <div className={styles.share}><strong>Andel i det automatiska schemat: {percent(primaryActualShare)}</strong><span>Automatiska variationer tar cirka {percent(estimate.automaticShare)} av tiden. OpenClaw-reaktioner, tal och spelhandlingar ingår inte i uppskattningen.</span></div>
      </details>
      <div className={styles.baseList}>{policy.base.map(item => <button type="button" key={item.videoId} onClick={() => play(item.videoId)} disabled={blocked}><span>{item.videoId === primary.videoId ? 'Huvudloop' : 'Reservloop'}</span><strong>{fileLabel(byId.get(item.videoId), item.videoId)}</strong><small>{item.weight} % grundvikt · spela prov</small></button>)}</div>
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHeading}><span>2</span><div><h3>Korta variationer</h3><p>{policy.variants.length} klipp · öppna en rad för att redigera</p></div></div>
      <label className={styles.search}>Hitta idleklipp<input type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Sök klipp, användning eller beskrivning…" /></label>
      {unconfigured.length ? <details className={styles.help}><summary>Nya klipp · {unconfigured.length}</summary><div className={styles.variantList}><p>Lägg till i policyn och spara. Högst {MAX_IDLE_VARIANTS} varianter.</p>{unconfigured.map(id => <button type="button" className="text-button" key={id} disabled={blocked || policy.variants.length >= MAX_IDLE_VARIANTS || !byId.get(id)?.available} onClick={() => void addVariant(id)}>Lägg till {fileLabel(byId.get(id), id)} som manuell variant</button>)}</div></details> : null}
      {importError ? <p role="alert" className={styles.warning}>{importError}</p> : null}
      <div className={styles.variantList}>{visibleVariants.map(item => <div className={styles.variant} key={item.videoId}>
        <details className={styles.variantDetails}><summary><strong>{fileLabel(byId.get(item.videoId), item.videoId)}</strong><small>{usageDescription(item)}</small></summary><div className={styles.variantSettings}>
        <label>Används som<select value={item.use} onChange={event => setUse(item, event.target.value as IdleVariantUse)}><option value="openclaw">OpenClaw</option><option value="automatic">Automatisk</option><option value="manual">Manuell · bara prov</option>{item.use === 'rules' ? <option value="rules" disabled>Regelstyrd · ej ansluten</option> : null}</select></label>
        <label className={styles.description}>När passar klippet?<input type="text" maxLength={80} value={item.description ?? ''} placeholder="Beskriv reaktionen och när den passar" onChange={event => updateVariant(item.videoId, { description: event.target.value })} /><span>Beskrivning till OpenClaw · högst 80 tecken</span></label>
        {item.use !== 'openclaw' ? <p className={styles.useHelp}>{item.use === 'automatic' ? 'Spelas enligt tiderna nedan, utan att tolka chatten.' : item.use === 'rules' ? 'Det finns ännu ingen ansluten regeltrigger för idle. Välj OpenClaw eller Automatisk för levande uppspelning.' : 'Startas bara med Spela här. Väljs inte i strömmen.'}</p> : null}
        {item.automatic ? <div className={styles.timing}>
          <label><span>Ungefär var</span><input type="number" min={5} max={300} value={seconds(item.automatic.averageEveryMs)} onChange={event => setAutomatic(item, 'averageEveryMs', Math.max(5, Number(event.target.value)) * 1000)} /><span>sek</span></label>
          <label><span>Slump ±</span><input type="number" min={0} max={60} value={seconds(item.automatic.jitterMs)} onChange={event => setAutomatic(item, 'jitterMs', Math.max(0, Number(event.target.value)) * 1000)} /><span>sek</span></label>
          <label><span>Minsta paus</span><input type="number" min={0} max={300} value={seconds(item.automatic.cooldownMs)} onChange={event => setAutomatic(item, 'cooldownMs', Math.max(0, Number(event.target.value)) * 1000)} /><span>sek</span></label>
          <label><span>Max/min</span><input type="number" min={1} max={12} value={item.automatic.maxPerMinute} onChange={event => setAutomatic(item, 'maxPerMinute', Math.max(1, Number(event.target.value)))} /></label>
        </div> : null}
        </div></details><button type="button" className="text-button" aria-label={`Spela ${fileLabel(byId.get(item.videoId), item.videoId)}`} onClick={() => play(item.videoId)} disabled={blocked || !byId.get(item.videoId)?.available}>Spela</button>
      </div>)}</div>
      {!visibleVariants.length ? <p className={styles.useHelp}>Inga klipp matchar sökningen.</p> : null}
      <details className={styles.help}><summary>Om idleklipp och användning</summary><p>Klipp från <code>idle/variant/</code>. Automatisk använder tiderna du ställer in. Manuell spelar endast prov. OpenClaw tolkar beskrivningen vid nya chattmeddelanden, högst en reaktion per minut. Tal och spelhandlingar går före.</p></details>
    </section>

    <section className={styles.section}>
      <details className={styles.help}><summary>Prova en minut</summary><p>Samma seed ger samma förlopp.</p>
      <div className={styles.previewControls}><label>Seed<input type="number" min={0} max={4294967295} value={seed} onChange={event => { stop('Seed ändrades'); setSeed(Math.max(0, Number(event.target.value))); }} /></label><button type="button" className="primary-button" disabled={blocked} onClick={() => { stop(); setActualLog([]); startClip(plan[0].videoId, 0); }}>Spela en minut</button><button type="button" className="text-button" onClick={() => setShowPlan(value => !value)}>{showPlan ? 'Dölj plan' : 'Visa planerat förlopp'}</button></div>
      <p className="helper">Planen är beräknad från klipplängderna i policyn. Engångsvarianter får spela klart. Loggen nedan visar faktiska uppspelningshändelser.</p>
      {showPlan ? <><div className={styles.timeline} aria-label="Förhandsvisning av idleförlopp">{plan.map((segment, index) => <span key={`${segment.startMs}-${index}`} className={segment.kind === 'variant' ? styles.variantSegment : styles.baseSegment} style={{ width: `${(segment.endMs - segment.startMs) / 600}%` }} title={`${Math.round(segment.startMs / 100) / 10}s · ${fileLabel(byId.get(segment.videoId), segment.videoId)}`} />)}</div><ol className={styles.log}>{events.length ? events.map((entry, index) => <li key={`${entry.at}-${entry.label}-${index}`}><time>{(entry.at / 1000).toFixed(1)} s</time><code>{entry.label}</code><span>{fileLabel(byId.get(entry.videoId), entry.videoId)}</span></li>) : <li>Inga automatiska variationer under minuten.</li>}</ol></> : null}
      </details>
    </section>

    <section className={styles.player} aria-label="Idleklippspelare">
      <div><span className="eyebrow">LOKALT VIDEOPROV</span><strong>{fileLabel(preview, previewId)}</strong><small>Provet styr inte spelet och stoppas när en annan spelare tar över.</small></div>
      {preview?.available ? <video key={`${previewId}-${playSerial}`} ref={videoRef} src={preview.previewUrl} muted playsInline autoPlay={playRequested && !blocked} loop={Boolean(family?.standardIds.includes(previewId))} onPlaying={event => {
        if (event.currentTarget !== videoRef.current || blocked || playback.current?.serial !== playSerial) { event.currentTarget.pause(); return; }
        onBusyChange(true);
        if (playback.current.started) return;
        playback.current.started = true; log(`started · ${fileLabel(preview, previewId)}`);
        if (planIndex !== null && plan[planIndex].kind === 'base') segmentTimer.current = setTimeout(() => advance(playSerial), plan[planIndex].endMs - plan[planIndex].startMs);
      }} onPause={event => { if (event.currentTarget === videoRef.current && !event.currentTarget.ended && playback.current?.serial === playSerial) stop('Pausat'); }} onEnded={() => advance(playSerial)} onError={event => { if (event.currentTarget === videoRef.current) stop('Videofel — provet avbröts'); }} /> : <p className={styles.warning}>Videon finns inte tillgänglig i labbets lokala mediekälla.</p>}
      <button type="button" className="text-button" onClick={() => stop()}>Stoppa idleprovet</button>
      {actualLog.length ? <details className={styles.help}><summary>Uppspelningslogg</summary><ol className={`${styles.log} ${styles.actualLog}`} aria-label="Faktisk idleuppspelning">{actualLog.map((entry, index) => <li key={index}>{entry}</li>)}</ol></details> : null}
    </section>
  </div>;
}
