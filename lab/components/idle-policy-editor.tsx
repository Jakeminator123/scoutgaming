'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clipLabel } from '../lib/clip-label.mjs';
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

export function IdlePolicyEditor({ policy, inventory, blocked, onChange, onBusyChange, clipLabels }: {
  policy: IdlePolicy;
  inventory: VideoInventory;
  blocked: boolean;
  onChange: (policy: IdlePolicy) => void;
  onBusyChange: (busy: boolean) => void;
  clipLabels?: Record<string, string>;
}) {
  const family = inventory.families?.find(item => item.id === policy.familyId);
  const byId = useMemo(() => new Map(inventory.videos.map(item => [item.id, item])), [inventory.videos]);
  const shown = (videoId: string) => {
    const video = byId.get(videoId);
    const file = fileLabel(video, videoId);
    const role = video?.role ?? (family?.standardIds.includes(videoId) || policy.base.some(row => row.videoId === videoId) ? 'standard' : 'variant');
    const name = clipLabel({ id: videoId, familyId: video?.familyId ?? policy.familyId, role, relativePath: video?.relativePath }, clipLabels);
    const ids = role === 'standard' ? family?.standardIds ?? policy.base.map(item => item.videoId) : family?.variantIds ?? policy.variants.map(item => item.videoId);
    const ordinal = Math.max(1, ids.indexOf(videoId) + 1);
    const defaultName = name === 'Variation' ? `Variation ${ordinal}` : name;
    return { text: clipLabels?.[videoId]?.trim() ? name : defaultName, title: `${file} · ${videoId}` };
  };
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
  const visibleVariants = policy.variants.filter(item => `${shown(item.videoId).text} ${shown(item.videoId).title} ${useLabels[item.use]} ${item.description ?? ''}`.toLocaleLowerCase('sv').includes(filter.trim().toLocaleLowerCase('sv')));

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
      if (!Number.isInteger(durationMs) || durationMs < 200 || durationMs > 60000) throw new Error('Klippet måste vara mellan 0,2 och 60 sekunder.');
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
      <h3>Basklipp</h3>
      {!family ? <p className={styles.warning}>Klippen för grundloopen kunde inte hittas.</p> : null}
      <div className={styles.baseChoice}><label className="field">Basklipp<select value={primary.videoId} onChange={event => setPrimary(event.target.value)}>{policy.base.map(item => <option key={item.videoId} value={item.videoId} title={shown(item.videoId).title}>{shown(item.videoId).text}</option>)}</select></label><button type="button" className="text-button" onClick={() => play(primary.videoId)} disabled={blocked || !byId.get(primary.videoId)?.available}>Spela basklipp</button></div>
      <details className={styles.help}><summary>Avancerat · basklipp och fördelning</summary>
        {policy.base.length > 1 ? <><p>Alla basklipp ingår i grundloopen och väljs enligt sina vikter.</p><label className={styles.range}>Valt basklipps andel <strong>{primary.weight} %</strong><input type="range" min={50} max={99} value={primary.weight} onChange={event => setPrimaryWeight(Number(event.target.value))} /></label></> : null}
        <div className={styles.share}><strong>Andel i det automatiska schemat: {percent(primaryActualShare)}</strong><span>Automatiska variationer tar cirka {percent(estimate.automaticShare)} av tiden. OpenClaw-reaktioner, tal och spelhandlingar ingår inte i uppskattningen.</span></div>
        <div className={styles.baseList}>{policy.base.map(item => <button type="button" key={item.videoId} title={shown(item.videoId).title} onClick={() => play(item.videoId)} disabled={blocked || !byId.get(item.videoId)?.available}><span>{item.videoId === primary.videoId ? 'Valt basklipp' : 'Alternativt basklipp'}</span><strong>{shown(item.videoId).text}</strong><small>{item.weight} % · spela klipp</small></button>)}</div>
      </details>
    </section>

    <section className={styles.section}>
      <h3>Variationer</h3>
      <label className={styles.search}>Hitta variation<input type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Sök namn, rörelse eller styrning…" /></label>
      {unconfigured.length ? <details className={styles.help}><summary>Lägg till variation · {unconfigured.length} tillgängliga klipp</summary><div className={styles.variantList}>{unconfigured.map(id => <button type="button" className="text-button" key={id} title={shown(id).title} disabled={blocked || policy.variants.length >= MAX_IDLE_VARIANTS || !byId.get(id)?.available} onClick={() => void addVariant(id)}>Lägg till {shown(id).text}</button>)}</div></details> : null}
      {importError ? <p role="alert" className={styles.warning}>{importError}</p> : null}
      <div className={styles.variantList}>{visibleVariants.map(item => <div className={styles.variant} key={item.videoId}>
        <details className={styles.variantDetails}><summary title={shown(item.videoId).title}><strong>{shown(item.videoId).text}</strong><small>{usageDescription(item)}</small></summary><div className={styles.variantSettings}>
        <label>Startas av<select value={item.use} onChange={event => setUse(item, event.target.value as IdleVariantUse)}><option value="openclaw">OpenClaw</option><option value="automatic">Automatik</option><option value="manual">Bara manuellt</option>{item.use === 'rules' ? <option value="rules" disabled>Regler · ej anslutna</option> : null}</select></label>
        <label className={styles.description}>Rörelse och sammanhang<input type="text" maxLength={80} value={item.description ?? ''} placeholder="Till exempel: kliar sig i huvudet när hon funderar" onChange={event => updateVariant(item.videoId, { description: event.target.value })} />{item.use === 'openclaw' ? <span>OpenClaw använder beskrivningen för att välja klipp.</span> : null}</label>
        {item.use === 'rules' ? <p className={styles.useHelp}>Regler är inte anslutna här. Välj OpenClaw eller Automatik för automatisk uppspelning.</p> : null}
        {item.automatic ? <><div className={styles.interval}><label><span>Spela ungefär var</span><input type="number" min={5} max={300} value={seconds(item.automatic.averageEveryMs)} onChange={event => setAutomatic(item, 'averageEveryMs', Math.max(5, Number(event.target.value)) * 1000)} /><span>sekund</span></label></div><details className={styles.help}><summary>Avancerat · slump och gränser</summary><div className={styles.timing}>
          <label><span>Slump ±</span><input type="number" min={0} max={60} value={seconds(item.automatic.jitterMs)} onChange={event => setAutomatic(item, 'jitterMs', Math.max(0, Number(event.target.value)) * 1000)} /><span>sek</span></label>
          <label><span>Minsta paus</span><input type="number" min={0} max={300} value={seconds(item.automatic.cooldownMs)} onChange={event => setAutomatic(item, 'cooldownMs', Math.max(0, Number(event.target.value)) * 1000)} /><span>sek</span></label>
          <label><span>Högst per minut</span><input type="number" min={1} max={12} value={item.automatic.maxPerMinute} onChange={event => setAutomatic(item, 'maxPerMinute', Math.max(1, Number(event.target.value)))} /></label>
        </div></details></> : null}
        </div></details><button type="button" className="text-button" title={shown(item.videoId).title} aria-label={`Spela ${shown(item.videoId).text}`} onClick={() => play(item.videoId)} disabled={blocked || !byId.get(item.videoId)?.available}>Spela</button>
      </div>)}</div>
      {!visibleVariants.length ? <p className={styles.useHelp}>{filter.trim() ? 'Inga variationer matchar sökningen.' : 'Inga variationer tillagda ännu.'}</p> : null}
      <details className={styles.help}><summary>Om automatiken</summary><p>Automatik följer ditt intervall. Manuell betyder att klippet bara startas med Spela. OpenClaw väljer utifrån nya chattmeddelanden, högst en reaktion per minut. Tal och spelhandlingar går före.</p><p>Mediekälla: <code>idle/variant/</code>.</p></details>
    </section>

    <section className={styles.player} aria-label="Spelare för grundloop">
      <div><strong title={shown(previewId).title}>{shown(previewId).text}</strong></div>
      {preview?.available ? <video key={`${previewId}-${playSerial}`} ref={videoRef} src={preview.previewUrl} muted playsInline autoPlay={playRequested && !blocked} loop={Boolean(family?.standardIds.includes(previewId))} onPlaying={event => {
        if (event.currentTarget !== videoRef.current || blocked || playback.current?.serial !== playSerial) { event.currentTarget.pause(); return; }
        onBusyChange(true);
        if (playback.current.started) return;
        playback.current.started = true; log(`started · ${fileLabel(preview, previewId)}`);
        if (planIndex !== null && plan[planIndex].kind === 'base') segmentTimer.current = setTimeout(() => advance(playSerial), plan[planIndex].endMs - plan[planIndex].startMs);
      }} onPause={event => { if (event.currentTarget === videoRef.current && !event.currentTarget.ended && playback.current?.serial === playSerial) stop('Pausat'); }} onEnded={() => advance(playSerial)} onError={event => { if (event.currentTarget === videoRef.current) stop('Videofel — provet avbröts'); }} /> : <p className={styles.warning}>Videon finns inte tillgänglig i labbets lokala mediekälla.</p>}
      <div className={styles.previewControls}><button type="button" className="primary-button" disabled={blocked} onClick={() => { stop(); setActualLog([]); startClip(plan[0].videoId, 0); }}>Spela en minut</button><button type="button" className="text-button" onClick={() => stop()}>Stoppa</button></div>
      <details className={styles.help}><summary>Avancerat · uppspelningsplan</summary><p>Förhandsvisningen styr inte spelet. Samma slumpfrö ger samma planerade förlopp.</p>
        <div className={styles.previewControls}><label>Slumpfrö<input type="number" min={0} max={4294967295} value={seed} onChange={event => { stop('Slumpfrö ändrades'); setSeed(Math.max(0, Number(event.target.value))); }} /></label><button type="button" className="text-button" onClick={() => setShowPlan(value => !value)}>{showPlan ? 'Dölj plan' : 'Visa plan'}</button></div>
        {showPlan ? <><div className={styles.timeline} aria-label="Förhandsvisning av grundloop">{plan.map((segment, index) => <span key={`${segment.startMs}-${index}`} className={segment.kind === 'variant' ? styles.variantSegment : styles.baseSegment} style={{ width: `${(segment.endMs - segment.startMs) / 600}%` }} title={`${Math.round(segment.startMs / 100) / 10}s · ${shown(segment.videoId).text}`} />)}</div><ol className={styles.log}>{events.length ? events.map((entry, index) => <li key={`${entry.at}-${entry.label}-${index}`}><time>{(entry.at / 1000).toFixed(1)} s</time><code>{entry.label}</code><span title={shown(entry.videoId).title}>{shown(entry.videoId).text}</span></li>) : <li>Inga automatiska variationer under minuten.</li>}</ol></> : null}
      </details>
      {actualLog.length ? <details className={styles.help}><summary>Uppspelningslogg</summary><ol className={`${styles.log} ${styles.actualLog}`} aria-label="Faktisk uppspelning av grundloop">{actualLog.map((entry, index) => <li key={index}>{entry}</li>)}</ol></details> : null}
    </section>
  </div>;
}
