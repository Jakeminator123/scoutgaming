'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createIdlePreviewPlan, idleShareEstimate, type IdlePolicy, type IdleVariantPolicy, type IdleVariantUse } from '../lib/idle-policy.mjs';
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
  const preview = byId.get(previewId);
  const plan = useMemo(() => createIdlePreviewPlan(policy, { seed, durationMs: 60000 }), [policy, seed]);
  const primary = policy.base[0];
  const primaryActualShare = primary ? estimate.shares[primary.videoId] ?? 0 : 0;

  useEffect(() => {
    if (!blocked) return;
    videoRef.current?.pause();
    onBusyChange(false);
  }, [blocked, onBusyChange]);
  useEffect(() => () => { videoRef.current?.pause(); onBusyChange(false); }, [onBusyChange]);

  function setPrimary(videoId: string) {
    onChange({ ...policy, base: weightedBase(policy.base, videoId, primary.weight) });
  }
  function setPrimaryWeight(weight: number) {
    onChange({ ...policy, base: weightedBase(policy.base, primary.videoId, weight) });
  }
  function updateVariant(videoId: string, patch: Partial<IdleVariantPolicy>) {
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
    setPreviewId(videoId);
    window.requestAnimationFrame(() => void videoRef.current?.play());
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
      {policy.base.length > 1 ? <label className={styles.range}>Huvudloopens andel före variationer <strong>{primary.weight} %</strong><input type="range" min={50} max={99} value={primary.weight} onChange={event => setPrimaryWeight(Number(event.target.value))} /></label> : null}
      <div className={styles.share}><strong>Beräknad faktisk visning: {percent(primaryActualShare)}</strong><span>Automatiska variationer tar {percent(estimate.automaticShare)} av tiden. Därför blir den faktiska andelen lägre än grundvikten.</span></div>
      <div className={styles.baseList}>{policy.base.map(item => <button type="button" key={item.videoId} onClick={() => play(item.videoId)} disabled={blocked}><span>{item.videoId === primary.videoId ? 'Huvudloop' : 'Reservloop'}</span><strong>{fileLabel(byId.get(item.videoId), item.videoId)}</strong><small>{item.weight} % grundvikt · spela prov</small></button>)}</div>
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHeading}><span>2</span><div><h3>Korta variationer</h3><p>Högst fyra klipp från den fysiska mappen <code>idle/variant/</code>.</p></div></div>
      <div className={styles.variantList}>{policy.variants.map(item => <div className={styles.variant} key={item.videoId}>
        <div><strong>{fileLabel(byId.get(item.videoId), item.videoId)}</strong><small>{usageDescription(item)}</small></div>
        <button type="button" className="text-button" onClick={() => play(item.videoId)} disabled={blocked}>Spela</button>
        <label>Används som<select value={item.use} onChange={event => setUse(item, event.target.value as IdleVariantUse)}><option value="manual">Manuell</option><option value="automatic">Automatisk</option><option value="rules">Regelstyrd</option><option value="openclaw">OpenClaw</option></select></label>
        {item.automatic ? <div className={styles.timing}>
          <label>Ungefär var<input type="number" min={5} max={300} value={seconds(item.automatic.averageEveryMs)} onChange={event => setAutomatic(item, 'averageEveryMs', Math.max(5, Number(event.target.value)) * 1000)} /><span>sek</span></label>
          <label>Slump ±<input type="number" min={0} max={60} value={seconds(item.automatic.jitterMs)} onChange={event => setAutomatic(item, 'jitterMs', Math.max(0, Number(event.target.value)) * 1000)} /><span>sek</span></label>
          <label>Minsta paus<input type="number" min={0} max={300} value={seconds(item.automatic.cooldownMs)} onChange={event => setAutomatic(item, 'cooldownMs', Math.max(0, Number(event.target.value)) * 1000)} /><span>sek</span></label>
          <label>Max/min<input type="number" min={1} max={12} value={item.automatic.maxPerMinute} onChange={event => setAutomatic(item, 'maxPerMinute', Math.max(1, Number(event.target.value)))} /></label>
        </div> : null}
      </div>)}</div>
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHeading}><span>3</span><div><h3>Prova en minut</h3><p>Samma seed ger samma förlopp. Det gör schemat lätt att kontrollera.</p></div></div>
      <div className={styles.previewControls}><label>Seed<input type="number" min={0} max={4294967295} value={seed} onChange={event => setSeed(Math.max(0, Number(event.target.value)))} /></label><button type="button" className="primary-button" onClick={() => setShowPlan(value => !value)}>{showPlan ? 'Dölj förlopp' : 'Visa förlopp'}</button></div>
      {showPlan ? <><div className={styles.timeline} aria-label="Förhandsvisning av idleförlopp">{plan.map((segment, index) => <span key={`${segment.startMs}-${index}`} className={segment.kind === 'variant' ? styles.variantSegment : styles.baseSegment} style={{ width: `${(segment.endMs - segment.startMs) / 600}%` }} title={`${Math.round(segment.startMs / 100) / 10}s · ${fileLabel(byId.get(segment.videoId), segment.videoId)}`} />)}</div><ol className={styles.log}>{events.length ? events.map((entry, index) => <li key={`${entry.at}-${entry.label}-${index}`}><time>{(entry.at / 1000).toFixed(1)} s</time><code>{entry.label}</code><span>{fileLabel(byId.get(entry.videoId), entry.videoId)}</span></li>) : <li>Inga automatiska variationer under minuten.</li>}</ol></> : null}
    </section>

    <section className={styles.player} aria-label="Idleklippspelare">
      <div><span className="eyebrow">LOKALT VIDEOPROV</span><strong>{fileLabel(preview, previewId)}</strong><small>Provet styr inte spelet och stoppas när en annan spelare tar över.</small></div>
      {preview?.available ? <video ref={videoRef} src={preview.previewUrl} muted playsInline controls onPlay={() => onBusyChange(true)} onPause={() => onBusyChange(false)} onEnded={() => onBusyChange(false)} /> : <p className={styles.warning}>Videon finns inte tillgänglig i labbets lokala mediekälla.</p>}
    </section>
  </div>;
}
