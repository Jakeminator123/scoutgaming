'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clipLabel } from '../lib/clip-label.mjs';
import {readIdleVideoDuration} from '../lib/idle-video-duration.mjs';
import { createIdlePreviewPlan, idleShareEstimate, MAX_IDLE_VARIANTS, type IdlePolicy, type IdleVariantPolicy, type IdleVariantUse } from '../lib/idle-policy.mjs';
import type { VideoEntry, VideoInventory } from './studio-types';
import { PresentationFrame } from './presentation-frame';
import {DealerVideoSurface} from './dealer-video-surface';
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

function replacementVideo(inventory: VideoInventory, policy: IdlePolicy, videoId: string) {
  const family = inventory.families?.find(row => row.id === policy.familyId);
  const video = inventory.videos.find(row => row.id === videoId);
  return video?.available && video.familyId === policy.familyId && family?.variantIds.includes(videoId)
    && !policy.base.some(row => row.videoId === videoId) ? video : undefined;
}

function usageDescription(item: IdleVariantPolicy) {
  if (item.use !== 'automatic' || !item.automatic) return useLabels[item.use];
  return `Automatisk · cirka var ${seconds(item.automatic.averageEveryMs)}:e sekund`;
}

export function IdlePolicyEditor({ policy, inventory, blocked, onChange, onBusyChange, onImportBusyChange, clipLabels, editableBase = false }: {
  policy: IdlePolicy;
  editableBase?: boolean;
  inventory: VideoInventory;
  blocked: boolean;
  onChange: (policy: IdlePolicy) => void;
  onBusyChange: (busy: boolean) => void;
  onImportBusyChange?: (busy: boolean) => void;
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
    const uploadName = editableBase ? video?.label?.trim() || video?.classification?.label?.trim() || file : '';
    return { text: clipLabels?.[videoId]?.trim() ? name : uploadName || defaultName, title: `${file} · ${videoId}` };
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
  const [importing,setImporting] = useState(false);
  const [baseId,setBaseId] = useState(''),[baseWeight,setBaseWeight] = useState('');
  const [replacementId,setReplacementId] = useState(''),[replacementError,setReplacementError] = useState(''),[replacing,setReplacing] = useState(false);
  const replacementContext=useRef({inventory,blocked,editableBase});replacementContext.current={inventory,blocked,editableBase};
  const importOperation=useRef<AbortController|null>(null);
  const latestPolicy=useRef(policy);latestPolicy.current=policy;
  const busyCallback=useRef(onBusyChange);busyCallback.current=onBusyChange;
  const importBusyCallback=useRef(onImportBusyChange??onBusyChange);importBusyCallback.current=onImportBusyChange??onBusyChange;
  const playback = useRef<{ serial: number; started: boolean } | null>(null);
  const segmentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preview = byId.get(previewId);
  const unconfigured = family?.variantIds.filter(id => !policy.variants.some(item => item.videoId === id)) ?? [];
  const plan = useMemo(() => createIdlePreviewPlan(policy, { seed, durationMs: 60000 }), [policy, seed]);
  const primary = policy.base[0];
  const replacementChoices = editableBase ? inventory.videos.filter(video => replacementVideo(inventory,policy,video.id)) : [];
  const primaryActualShare = primary ? estimate.shares[primary.videoId] ?? 0 : 0;
  const visibleVariants = policy.variants.filter(item => `${shown(item.videoId).text} ${shown(item.videoId).title} ${useLabels[item.use]} ${item.description ?? ''}`.toLocaleLowerCase('sv').includes(filter.trim().toLocaleLowerCase('sv')));

  useEffect(() => {
    if (!blocked) return;
    importOperation.current?.abort();
    stop('Avbrutet av tal eller spelhandling');
  }, [blocked, onBusyChange]);
  useEffect(() => () => { importOperation.current?.abort(); importOperation.current=null; if (segmentTimer.current) clearTimeout(segmentTimer.current); playback.current = null; videoRef.current?.pause(); busyCallback.current(false); importBusyCallback.current(false); }, []);

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

  async function addVariant(videoId: string, asBase = false) {
    const video = byId.get(videoId);
    if (blocked || importOperation.current || !unconfigured.includes(videoId) || !video?.available || (asBase ? policy.base.length >= 4 || !editableBase : policy.variants.length >= MAX_IDLE_VARIANTS)) return;
    const weight=Number(baseWeight);
    if(asBase && (!Number.isInteger(weight)||weight<1||weight>100-policy.base.length))return;
    setImportError('');
    stop('Inställningen ändrades');
    const controller=new AbortController();importOperation.current=controller;setImporting(true);importBusyCallback.current(true);
    try {
      const durationMs=await readIdleVideoDuration(video.previewUrl,{signal:controller.signal});
      if(controller.signal.aborted||latestPolicy.current!==policy)return;
      if(asBase) {
        const base=weightedBase([...policy.base,{videoId,durationMs,weight}],videoId,weight);
        onChange({...policy,base:[base.find(row=>row.videoId===primary.videoId)!,...base.filter(row=>row.videoId!==primary.videoId)]});
        setBaseId('');setBaseWeight('');
      } else onChange({ ...policy, variants: [...policy.variants, { videoId, durationMs, use: 'manual', automatic: null, description: '' }] });
    } catch (error) { if(!controller.signal.aborted)setImportError(error instanceof Error ? error.message : 'Kunde inte läsa videon.'); }
    finally { if(importOperation.current===controller){importOperation.current=null;setImporting(false);importBusyCallback.current(false);} }
  }

  async function replacePrimary(videoId: string) {
    const video=replacementVideo(inventory,policy,videoId);
    if(blocked||!editableBase||importOperation.current||!video)return;
    setReplacementError('');stop('Inställningen ändrades');
    const controller=new AbortController();importOperation.current=controller;
    setImporting(true);setReplacing(true);importBusyCallback.current(true);
    try {
      const durationMs=await readIdleVideoDuration(video.previewUrl,{signal:controller.signal});
      if(controller.signal.aborted||latestPolicy.current!==policy)return;
      const latest=replacementContext.current;
      if(latest.blocked||!latest.editableBase)return;
      const current=replacementVideo(latest.inventory,policy,videoId);
      if(!current||current.sha256!==video.sha256||current.previewUrl!==video.previewUrl){setReplacementError('Klippet har ändrats eller är inte längre tillgängligt. Välj klipp igen.');return;}
      if(!Number.isInteger(durationMs)||durationMs<200||durationMs>60000)throw Error('Klippet måste vara mellan 0,2 och 60 sekunder.');
      // A replacement inherits only the primary slot's weight. Other base and
      // variation entries retain their exact settings; uploaded media is untouched.
      onChange({...policy,base:policy.base.map((row,index)=>index===0?{...row,videoId,durationMs}:row),
        variants:policy.variants.filter(row=>row.videoId!==videoId)});
      setReplacementId('');setPreviewId(videoId);
    } catch(error) {
      if(!controller.signal.aborted&&latestPolicy.current===policy)setReplacementError(error instanceof Error?error.message:'Videons längd kunde inte läsas. Försök igen.');
    } finally {
      if(importOperation.current===controller){importOperation.current=null;setImporting(false);setReplacing(false);importBusyCallback.current(false);}
    }
  }

  const events = plan.flatMap((segment, index) => segment.kind === 'variant' ? [
    { at: segment.startMs, label: 'scheduled', videoId: segment.videoId },
    { at: segment.startMs, label: 'started', videoId: segment.videoId },
    { at: segment.endMs, label: 'completed', videoId: segment.videoId },
    ...(plan[index + 1]?.kind === 'base' ? [{ at: segment.endMs, label: 'base resumed', videoId: plan[index + 1].videoId }] : []),
  ] : []).slice(0, 16);

  return <fieldset className={styles.editor} disabled={blocked||importing} style={{border:0,padding:0,minWidth:0}} aria-busy={importing}>
    <section className={styles.section}>
      <h3>Basklipp</h3>
      {!family ? <p className={styles.warning}>Klippen för grundloopen kunde inte hittas.</p> : null}
      <div className={styles.baseChoice}><label className="field">Basklipp<select value={primary.videoId} onChange={event => setPrimary(event.target.value)}>{policy.base.map(item => <option key={item.videoId} value={item.videoId} title={shown(item.videoId).title}>{shown(item.videoId).text}</option>)}</select></label><button type="button" className="text-button" onClick={() => play(primary.videoId)} disabled={blocked || !byId.get(primary.videoId)?.available}>Spela basklipp</button></div>
      {editableBase?<div role="group" aria-label="Byt basklipp">
        <div className={styles.baseChoice}><label className="field">Byt basklipp<select aria-label="Välj nytt basklipp" value={replacementId} disabled={!replacementChoices.length} onChange={event=>{setReplacementId(event.target.value);setReplacementError('');}}>
          <option value="">{replacementChoices.length?'Välj uppladdat grundloopsklipp':'Inga andra tillgängliga grundloopsklipp'}</option>
          {replacementChoices.map(video=><option key={video.id} value={video.id} title={shown(video.id).title}>{shown(video.id).text}{policy.variants.some(row=>row.videoId===video.id)?' · används som variation':''}</option>)}
        </select></label><button type="button" className="text-button" disabled={blocked||importing||!replacementChoices.some(row=>row.id===replacementId)} onClick={()=>void replacePrimary(replacementId)}>{replacing?'Läser klipplängd…':'Använd som basklipp'}</button></div>
        <p className={styles.useHelp}>Ersätter det valda basklippet och behåller övriga basklipp och deras andelar. Det tidigare klippet finns kvar i biblioteket. Spara inställningarna efter bytet.</p>
        {!replacementChoices.length?<p className={styles.useHelp}>Lägg in en egen video i facket Grundloop för att välja ett nytt basklipp.</p>:null}
        {replacementError?<p className={styles.warning} role="alert">{replacementError}</p>:null}
      </div>:null}
      <details className={styles.help}><summary>Avancerat · basklipp och fördelning</summary>
        {policy.base.length > 1 ? <><p>Alla basklipp ingår i grundloopen och väljs enligt sina vikter.</p><label className={styles.range}>Valt basklipps andel <strong>{primary.weight} %</strong><input type="range" min={1} max={100-policy.base.length+1} value={primary.weight} onChange={event => setPrimaryWeight(Number(event.target.value))} /></label></> : null}
        <div className={styles.share}><strong>Andel i det automatiska schemat: {percent(primaryActualShare)}</strong><span>Automatiska variationer tar cirka {percent(estimate.automaticShare)} av tiden. OpenClaw-reaktioner, tal och spelhandlingar ingår inte i uppskattningen.</span></div>
        <div className={styles.baseList}>{policy.base.map(item => <button type="button" key={item.videoId} title={shown(item.videoId).title} onClick={() => play(item.videoId)} disabled={blocked || !byId.get(item.videoId)?.available}><span>{item.videoId === primary.videoId ? 'Valt basklipp' : 'Alternativt basklipp'}</span><strong>{shown(item.videoId).text}</strong><small>{item.weight} % · spela klipp</small></button>)}</div>
        {editableBase?<><div className={styles.baseList}>{policy.base.map(item=><button type="button" className="text-button" key={item.videoId} disabled={policy.base.length===1} onClick={()=>{
          stop('Inställningen ändrades');const remaining=policy.base.filter(row=>row.videoId!==item.videoId);
          if(remaining.length)onChange({...policy,base:weightedBase(remaining,remaining[0].videoId,Math.round(remaining[0].weight*100/(100-item.weight)))});
        }}>Ta bort basklipp {shown(item.videoId).text}</button>)}</div>
        {policy.base.length<4&&unconfigured.length?<div><label className="field">Nytt basklipp<select value={baseId} onChange={event=>setBaseId(event.target.value)}><option value="">Välj klipp</option>{unconfigured.map(id=><option key={id} value={id}>{shown(id).text}</option>)}</select></label>
          <label className="field">Nytt basklipps andel (%)<input type="number" min={1} max={100-policy.base.length} value={baseWeight} onChange={event=>setBaseWeight(event.target.value)} /></label>
          <p>Övriga basklipp delar återstående andel lika. Det valda basklippet behålls som huvudbasklipp.</p>
          <button type="button" className="text-button" disabled={!unconfigured.includes(baseId)||!Number.isInteger(Number(baseWeight))||Number(baseWeight)<1||Number(baseWeight)>100-policy.base.length} onClick={()=>void addVariant(baseId,true)}>Lägg till basklipp</button></div>:null}</>:null}
      </details>
    </section>

    <section className={styles.section}>
      <h3>Variationer</h3>
      <label className={styles.search}>Hitta variation<input type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Sök namn, rörelse eller styrning…" /></label>
      {unconfigured.length ? <details className={styles.help}><summary>Lägg till variation · {unconfigured.length} tillgängliga klipp</summary><div className={styles.variantList}>{unconfigured.map(id => <button type="button" className="text-button" key={id} title={shown(id).title} disabled={blocked || policy.variants.length >= MAX_IDLE_VARIANTS || !byId.get(id)?.available} onClick={() => void addVariant(id)}>Lägg till {shown(id).text}{editableBase?' · manuellt':''}</button>)}</div></details> : null}
      {importError ? <p role="alert" className={styles.warning}>{importError}</p> : null}
      <div className={styles.variantList}>{visibleVariants.map(item => <div className={styles.variant} key={item.videoId}>
        <details className={styles.variantDetails}><summary title={shown(item.videoId).title}><strong>{shown(item.videoId).text}</strong><small>{usageDescription(item)}</small></summary><div className={styles.variantSettings}>
        <label>Startas av<select value={item.use} onChange={event => setUse(item, event.target.value as IdleVariantUse)}><option value="openclaw">OpenClaw · chattreaktion</option><option value="automatic">Automatisk · tidsintervall</option><option value="manual">Bara manuellt</option>{editableBase || item.use === 'rules' ? <option value="rules" disabled={!editableBase}>{editableBase ? 'Regler' : 'Regler · ej anslutna'}</option> : null}</select></label>
        <label className={styles.description}>Rörelse och sammanhang<input type="text" maxLength={80} value={item.description ?? ''} placeholder="Till exempel: kliar sig i huvudet när hon funderar" onChange={event => updateVariant(item.videoId, { description: event.target.value })} />{item.use === 'openclaw' ? <span>Beskriv vilken rörelse klippet visar och när den passar. OpenClaw jämför detta med de senaste observerade chattmeddelandena och får bara välja tillåtna klipp. Det skapar inget nytt tal.</span> : null}</label>
        {item.use === 'rules' ? <p className={styles.useHelp}>{editableBase ? 'Under Händelser → Grundloop: skapa en variant med samma klipp, tillåt Regler och koppla ett villkor för utdelning eller vändning. Villkoret måste gälla spelhändelsen; chattvillkor används inte här. Välj Regler i spelets Klippval. Utan ett matchande sparat villkor spelas ingen regelvariation.' : 'Regler är inte anslutna här. Välj OpenClaw eller Automatik för automatisk uppspelning.'}</p> : null}
        {item.automatic ? <><div className={styles.interval}><label><span>Spela ungefär var</span><input type="number" min={5} max={300} value={seconds(item.automatic.averageEveryMs)} onChange={event => setAutomatic(item, 'averageEveryMs', Math.max(5, Number(event.target.value)) * 1000)} /><span>sekund</span></label></div><details className={styles.help}><summary>Avancerat · slump och gränser</summary><div className={styles.timing}>
          <label><span>Slump ±</span><input type="number" min={0} max={60} value={seconds(item.automatic.jitterMs)} onChange={event => setAutomatic(item, 'jitterMs', Math.max(0, Number(event.target.value)) * 1000)} /><span>sek</span></label>
          <label><span>Minsta paus</span><input type="number" min={0} max={300} value={seconds(item.automatic.cooldownMs)} onChange={event => setAutomatic(item, 'cooldownMs', Math.max(0, Number(event.target.value)) * 1000)} /><span>sek</span></label>
          <label><span>Högst per minut</span><input type="number" min={1} max={12} value={item.automatic.maxPerMinute} onChange={event => setAutomatic(item, 'maxPerMinute', Math.max(1, Number(event.target.value)))} /></label>
        </div></details></> : null}
        </div></details><button type="button" className="text-button" title={shown(item.videoId).title} aria-label={`Spela ${shown(item.videoId).text}`} onClick={() => play(item.videoId)} disabled={blocked || !byId.get(item.videoId)?.available}>Spela</button>
      {editableBase?<button type="button" className="text-button" onClick={()=>{stop('Inställningen ändrades');onChange({...policy,variants:policy.variants.filter(row=>row.videoId!==item.videoId)});}}>Ta bort variation</button>:null}</div>)}</div>
      {!visibleVariants.length ? <p className={styles.useHelp}>{filter.trim() ? 'Inga variationer matchar sökningen.' : 'Inga variationer tillagda ännu.'}</p> : null}
      <details className={styles.help}><summary>Om automatiken</summary><p>Automatisk följer ditt tidsintervall och dina gränser utan AI-anrop. Manuell betyder att klippet bara startas med Spela. OpenClaw väljer en färdig rörelse utifrån beskrivningen och nya observerade chattmeddelanden, högst en reaktion per minut. Det är skilt från AI-småprat som skapar ny text och nytt tal. Tal och spelhandlingar går före.</p><p>Mediekälla: <code>idle/variant/</code>.</p></details>
    </section>

    <section className={styles.player} aria-label="Spelare för grundloop">
      <div><strong title={shown(previewId).title}>{shown(previewId).text}</strong></div>
      <PresentationFrame label="Grundloop"><DealerVideoSurface framing={preview?.classification?.framing} compositing={preview?.classification?.compositing}>
      {preview?.available ? <video key={`${previewId}-${playSerial}`} ref={videoRef} src={preview.previewUrl} muted playsInline autoPlay={playRequested && !blocked} loop={Boolean(family?.standardIds.includes(previewId))} onPlaying={event => {
        if (event.currentTarget !== videoRef.current || blocked || playback.current?.serial !== playSerial) { event.currentTarget.pause(); return; }
        onBusyChange(true);
        if (playback.current.started) return;
        playback.current.started = true; log(`started · ${fileLabel(preview, previewId)}`);
        if (planIndex !== null && plan[planIndex].kind === 'base') segmentTimer.current = setTimeout(() => advance(playSerial), plan[planIndex].endMs - plan[planIndex].startMs);
      }} onPause={event => { if (event.currentTarget === videoRef.current && !event.currentTarget.ended && playback.current?.serial === playSerial) stop('Pausat'); }} onEnded={() => advance(playSerial)} onError={event => { if (event.currentTarget === videoRef.current) stop('Videofel — provet avbröts'); }} /> : <p className={styles.warning}>Videon finns inte tillgänglig i klippbiblioteket.</p>}
      </DealerVideoSurface></PresentationFrame>
      <div className={styles.previewControls}><button type="button" className="primary-button" disabled={blocked} onClick={() => { stop(); setActualLog([]); startClip(plan[0].videoId, 0); }}>Spela en minut</button><button type="button" className="text-button" onClick={() => stop()}>Stoppa</button></div>
      <details className={styles.help}><summary>Avancerat · uppspelningsplan</summary><p>Förhandsvisningen styr inte spelet. Samma slumpfrö ger samma planerade förlopp.</p>
        <div className={styles.previewControls}><label>Slumpfrö<input type="number" min={0} max={4294967295} value={seed} onChange={event => { stop('Slumpfrö ändrades'); setSeed(Math.max(0, Number(event.target.value))); }} /></label><button type="button" className="text-button" onClick={() => setShowPlan(value => !value)}>{showPlan ? 'Dölj plan' : 'Visa plan'}</button></div>
        {showPlan ? <><div className={styles.timeline} aria-label="Förhandsvisning av grundloop">{plan.map((segment, index) => <span key={`${segment.startMs}-${index}`} className={segment.kind === 'variant' ? styles.variantSegment : styles.baseSegment} style={{ width: `${(segment.endMs - segment.startMs) / 600}%` }} title={`${Math.round(segment.startMs / 100) / 10}s · ${shown(segment.videoId).text}`} />)}</div><ol className={styles.log}>{events.length ? events.map((entry, index) => <li key={`${entry.at}-${entry.label}-${index}`}><time>{(entry.at / 1000).toFixed(1)} s</time><code>{entry.label}</code><span title={shown(entry.videoId).title}>{shown(entry.videoId).text}</span></li>) : <li>Inga automatiska variationer under minuten.</li>}</ol></> : null}
      </details>
      {actualLog.length ? <details className={styles.help}><summary>Uppspelningslogg</summary><ol className={`${styles.log} ${styles.actualLog}`} aria-label="Faktisk uppspelning av grundloop">{actualLog.map((entry, index) => <li key={index}>{entry}</li>)}</ol></details> : null}
    </section>
  </fieldset>;
}
