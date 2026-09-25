'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DealerId, StudioProject } from '../lib/studio-model.mjs';
import type { PartnerTrace } from '../lib/partner-trace.mjs';
import { buildPresentationSequence, type PresentationStep } from '../lib/presentation-sequence.mjs';
import { resolveOriginalDefault, type OriginalMediaCatalog } from '../lib/original-media.mjs';
import { mediaLineForEvent, mediaVideoForEvent } from '../lib/media-family-policy.mjs';
import { videoFitsEvent } from '../lib/video-intake.mjs';
import { observationContext, observedTable } from '../lib/observation-context.mjs';
import { requestJson, type DirectorMode, type SimulationResult, type VideoInventory } from './studio-types';
import { Stage, type PlaybackReceipt } from './stage';
import { PresentationSequence } from './presentation-sequence';
import { ReferenceCapture } from './reference-capture';
import type { ActivityDraft } from './activity-log';
import { decisionAttribution } from '../lib/activity-log.mjs';
import styles from './game-stream.module.css';

export interface GameStreamProps {
  trace: PartnerTrace; project: StudioProject; videos: VideoInventory;
  originals: OriginalMediaCatalog | null; dealerId: DealerId; active: boolean;
  autoFollow?: boolean;
  followFromRecord?: number;
  observationRevision?: number;
  onActivity: (entry: ActivityDraft) => void;
  onOpenEvent: (eventId: string, step: PresentationStep) => void;
}
const stepIdentity = (step: PresentationStep) => JSON.stringify([step.requestId, step.version, step.presentationIndex, step.channel, step.event]);
interface PlaybackRun {
  generation: number; controller: AbortController; step: PresentationStep;
  cleanup: () => void; finish: { resolve: () => void; reject: (error: Error) => void } | null;
}
export function GameStream({ trace, project, videos, originals, dealerId, active, autoFollow = false, followFromRecord, observationRevision = 0, onActivity, onOpenEvent }: GameStreamProps) {
  const [mode, setMode] = useState<DirectorMode>('off');
  const sequence = useMemo(() => buildPresentationSequence(trace.records, project), [trace.records, project]);
  const table = useMemo(() => observedTable(trace.records, sequence), [trace.records, sequence]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [resultIdentity, setResultIdentity] = useState('');
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playId, setPlayId] = useState(0);
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState('');
  const playback = useRef<PlaybackRun | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const currentSequence = useRef(sequence); currentSequence.current = sequence;
  const currentContext = useRef({ active, project, dealerId, mode }); currentContext.current = { active, project, dealerId, mode };
  const live = useRef<{ controller: AbortController; queue: string[]; seen: Map<string, string>; notices: number; pumping: boolean } | null>(null);
  const autoWasActive = useRef(false);
  const callback = useRef(playStep); callback.current = playStep;

  function cancel(message = 'Uppspelningen stoppades.') {
    const current = playback.current; playback.current = null;
    current?.controller.abort(); current?.cleanup(); current?.finish?.reject(new Error(message));
    if (mounted.current) { setPlaying(false); setBusy(false); }
  }
  function stopFollow() { live.current?.controller.abort(); live.current = null; setFollowing(false); cancel(); }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; live.current?.controller.abort(); live.current = null; cancel('Spelytan stängdes.'); }; }, []);
  useEffect(() => { stopFollow(); setResult(null); }, [dealerId, project, mode]);
  useEffect(() => { stopFollow(); setSelectedId(null); setResult(null); setError(''); autoWasActive.current = false; }, [observationRevision]);
  useEffect(() => { if (!active) stopFollow(); }, [active]);
  useEffect(() => {
    if (autoFollow && active) startFollow(autoWasActive.current ? undefined : followFromRecord);
    else if (!autoFollow) stopFollow();
    autoWasActive.current = autoFollow;
  }, [autoFollow, active, mode, dealerId, project, observationRevision]);
  useEffect(() => {
    const current = playback.current;
    if (current) {
      const latest = sequence.steps.find(step => step.id === current.step.id);
      if (!latest || latest.blocked || stepIdentity(latest) !== stepIdentity(current.step)) {
        cancel('Instruktionen ändrades eller fick motstridiga mottagningar. Återspelningen stoppades.');
        setResult(null);
      }
    }
    const run = live.current;
    if (!run || run.controller.signal.aborted) return;
    const changed = [...run.seen].some(([id, identity]) => { const latest = sequence.steps.find(step => step.id === id); return !latest || latest.blocked || stepIdentity(latest) !== identity; });
    const newGap = sequence.notices.slice(run.notices).some(notice => notice.kind !== 'connection');
    if (changed || newGap || sequence.truncated || trace.limited) {
      setError('Följningen stoppades vid en lucka, ändrad instruktion eller observationsgräns. Granska sekvensen innan du fortsätter.');
      stopFollow(); return;
    }
    run.notices = sequence.notices.length;
    for (const step of sequence.steps) if (!run.seen.has(step.id)) { run.seen.set(step.id, stepIdentity(step)); run.queue.push(step.id); }
    if (run.pumping) return;
    run.pumping = true;
    void (async () => {
      try {
        while (run.queue.length && !run.controller.signal.aborted) {
          const nextId = run.queue.shift();
          const next = currentSequence.current.steps.find(step => step.id === nextId);
          if (!next) throw new Error('Nästa instruktion finns inte längre i observationen.');
          await callback.current(next, { signal: run.controller.signal });
        }
      } catch (cause) { if (mounted.current && live.current === run && !run.controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Följningen stoppades.'); stopFollow(); } }
      finally { run.pumping = false; }
    })();
  }, [sequence, trace.limited, following]);
  function startFollow(fromRecord?: number) {
    if (!active || playback.current || live.current) return;
    if (sequence.truncated || trace.limited) { setError('Observationen har nått sin gräns. Börja en ny observation innan du följer nya instruktioner.'); return; }
    setError('');
    live.current = { controller: new AbortController(), queue: fromRecord == null ? [] : sequence.steps.filter(step => step.recordIndex >= fromRecord).map(step => step.id), seen: new Map(sequence.steps.map(step => [step.id, stepIdentity(step)])), notices: sequence.notices.length, pumping: false };
    setFollowing(true);
  }
  async function playStep(requested: PresentationStep, { signal }: { signal: AbortSignal }) {
    const step = currentSequence.current.steps.find(step => step.id === requested.id);
    if (!step || stepIdentity(step) !== stepIdentity(requested)) throw new Error('Instruktionen har ersatts i observationen.');
    if (step.blocked || !step.eventId) throw new Error(step.issue ?? 'Instruktionen kan inte spelas i labbet.');
    if (signal.aborted || !mounted.current || !currentContext.current.active) throw new Error('Uppspelningen stoppades.');
    cancel(); setSelectedId(step.id); setResult(null); setError(''); setBusy(true);
    const controller = new AbortController();
    const current: PlaybackRun = { generation: ++generation.current, controller, step, cleanup: () => signal.removeEventListener('abort', abort), finish: null };
    const abort = () => { if (playback.current === current) cancel(); };
    playback.current = current;
    signal.addEventListener('abort', abort, { once: true });
    const runId = `sequence-${step.id}-${current.generation}`;
    const observed = observationContext(currentSequence.current, step, trace.records);
    onActivity({ source: step.replay ? 'lab' : 'partner', stage: 'input', status: 'received', runId, title: step.label, owner: 'Mottagen presentationsinstruktion', reason: 'Labbet återspelar publicerade kort, destination och exakt replik. Inget spelkommando skickas.', data: { source: step.source, replay: step.replay, requestId: step.requestId, version: step.version, presentationIndex: step.presentationIndex, event: step.event } });
    try {
      const decisionInput = { requestId: crypto.randomUUID(), project, dealerId, eventId: step.eventId, sourceEvent: step.event, sourceRef: { kind: step.replay ? 'import' : 'observed', channel: step.channel, requestId: step.requestId, version: step.version, presentationIndex: step.presentationIndex }, mode, context: observed.context };
      onActivity({ source: 'lab', stage: 'input', status: 'received', runId, title: 'Underlag till presentationsbeslutet', owner: 'Labbets observerade kontext', reason: 'Exakt event och begränsad kontext från mottagna speldata. Saknad historik markeras; ingen spelhandling skickas.', data: { ...decisionInput, project: { gameId: project.gameId, revision: project.revision }, contextEvidence: observed.evidence } });
      const response = await requestJson<SimulationResult>('/api/presentation/decision', { method: 'POST', signal: controller.signal, body: JSON.stringify(decisionInput) });
      const latest = currentSequence.current.steps.find(item => item.id === step.id);
      const context = currentContext.current;
      if (signal.aborted || controller.signal.aborted || playback.current !== current || !context.active || context.project !== project || context.dealerId !== dealerId || context.mode !== mode
        || !latest || latest.blocked || stepIdentity(latest) !== stepIdentity(step)) throw new Error('Uppspelningen stoppades eller instruktionen ändrades.');
      if (!response.variant || !response.asset) throw new Error('Variantbeslutet saknar en spelbar variant eller 2D-reserv.');
      const completion = new Promise<void>((resolve, reject) => { current.finish = { resolve, reject }; });
      setResult(response); setResultIdentity(`${dealerId}:${stepIdentity(step)}`); setPlayId(current.generation); setPlaying(true); setBusy(false);
      onActivity({ source: 'lab', stage: 'decision', status: 'selected', runId, title: response.variant?.label ?? step.label, owner: decisionAttribution(mode, response.decision?.reason, response.provider), reason: response.provider === 'remote_context_not_supported_baseline' ? 'Director-tjänsten saknar verifierat stöd för observerad chatt. Standard spelas tills tjänsten uppdaterats.' : 'Presentation av mottagen instruktion med observerade handresultat och tillgänglig chatt före eventet. Spelarhistorik och språk är okända.', data: { decision: response.decision, trace: response.trace, mode, contextEvidence: observed.evidence, contextReceipt: response.contextReceipt } });
      await completion;
    } finally {
      current.cleanup();
      if (playback.current === current) { playback.current = null; controller.abort(); if (mounted.current) { setBusy(false); setPlaying(false); } }
    }
  }
  function receipt(value: PlaybackReceipt, receiptGeneration: number) {
    const current = playback.current;
    if (!current?.finish || current.generation !== receiptGeneration || current.controller.signal.aborted) return;
    const latest = currentSequence.current.steps.find(step => step.id === current.step.id);
    if (!latest || latest.blocked || stepIdentity(latest) !== stepIdentity(current.step)) { cancel('Instruktionen har ändrats.'); return; }
    onActivity({ source: 'player', stage: 'playback', status: value.phase === 'fallback' ? 'failed' : value.phase, runId: `sequence-${current.step.id}-${current.generation}`, title: `${value.medium === 'video' ? 'Original/video' : '2D-reserv'} · ${current.step.label}`, owner: 'Labbets spelare', reason: value.reason ?? 'Uppspelningskvitto från labbet, inte från referensspelet.', data: value });
    if (value.phase === 'completed') { playback.current = null; current.cleanup(); setPlaying(false); current.finish.resolve(); }
    else if (value.phase === 'failed') cancel(value.reason ?? 'Uppspelningen misslyckades.');
  }
  const step = sequence.steps.find(step => step.id === selectedId) ?? sequence.steps[0];
  const currentResult = step && resultIdentity === `${dealerId}:${stepIdentity(step)}` && !step.blocked ? result : null;
  const definition = project.events.find(event => event.id === step?.eventId);
  const event = definition && step && typeof step.event === 'object' && step.event ? { ...definition, exampleEvent: step.event as Record<string, unknown> } : null;
  const media = event ? mediaLineForEvent(project, videos, dealerId, event.id, event.exampleEvent) : null;
  const line = media?.line;
  const variant = currentResult?.variant ?? line?.variants.find(variant => variant.id === line.baselineVariantId);
  const videoId = currentResult ? currentResult.videoGenerationId : variant?.videoGenerationId;
  const sourceEvent = (currentResult?.decision?.sourceEvent ?? event?.exampleEvent) as Record<string, unknown> | undefined;
  const video = media?.managed && sourceEvent && event ? mediaVideoForEvent(videos, dealerId, event.id, sourceEvent, videoId) : videoId && sourceEvent ? videos.videos.find(video => video.id === videoId && video.available && videoFitsEvent(video, sourceEvent)) : null;
  const original = !media?.managed && variant && line && variant.id === line.baselineVariantId && !variant.videoGenerationId && sourceEvent ? resolveOriginalDefault(originals, dealerId, sourceEvent) : null;
  return <div className={styles.surface}>
    <div className={styles.comparison}>
    <section className={styles.column} aria-label="Originalspelet"><h4>Originalspelet</h4><ReferenceCapture onActivity={onActivity} /></section>
    <section className={styles.column} aria-label="Labbets presentation"><h4>Labbets presentation <small>{following ? 'Följer nya speldata' : 'Pausad'}</small></h4>
      <div className={styles.toolbar}><label>Variantval <select value={mode} disabled={playing || busy} onChange={e => { stopFollow(); setMode(e.target.value as DirectorMode); }}><option value="off">Bara standard</option><option value="rules">Regler</option><option value="random">Slumpvariation</option><option value="active">OpenClaw</option><option value="shadow">Skuggläge</option></select></label><button className="text-button" disabled={!following && (playing || busy)} onClick={() => following ? stopFollow() : startFollow()}>{following ? 'Pausa labbet' : 'Följ nya instruktioner'}</button><small>{following ? 'Varje steg väntar på labbspelarens avslut.' : 'Samma speldata, labbets standard eller varianter.'}{mode === 'active' || mode === 'shadow' ? ' Uppspelning kan göra modellanrop.' : ''}</small></div>
      {event && variant ? <Stage event={event} asset={currentResult?.asset ?? project.assets.find(asset => asset.id === variant.assetId)} dealer={project.dealers.find(dealer => dealer.id === dealerId)?.label ?? dealerId} variantLabel={variant.label} playId={playId} playing={playing && active && !step?.blocked} hasResult={Boolean(currentResult)} busy={busy} videoUrl={video?.previewUrl} videoName={video?.fileName ?? video?.label} videoId={videoId ?? undefined} familyId={media?.family?.id ?? video?.familyId} fallbackVideo={media?.managed ? mediaVideoForEvent(videos, dealerId, event.id, event.exampleEvent, media.line?.variants[0]?.videoGenerationId) : null} videoMissing={Boolean(videoId && !video)} originalMedia={original} sourceIsObserved onPlaybackEvent={value => receipt(value, value.playId ?? playId)} onPlay={() => { if (step && !following && !playing && !busy) void playStep(step, { signal: new AbortController().signal }).catch(cause => { if (mounted.current) setError(cause.message); }); }} /> : <div className={styles.empty}><strong>Väntar på spelinstruktioner</strong><p>Tryck Anslut och spela i originalfliken. Labbet följer nya mottagna instruktioner automatiskt.</p></div>}
      {error ? <p role="alert">{error}</p> : null}
    </section>
    </div>
    <section className={styles.publicTable} aria-label="Mottaget offentligt bord"><h4>Senast mottagna bord <small>{table.version == null ? 'Ingen speldata ännu' : `version ${table.version}`}</small></h4>
      <p className={styles.note}>{table.partial ? 'Byggt från mottagna instruktioner; historik och split-omflyttningar kan saknas.' : 'Spelserverns offentliga svar. Animationen kan fortfarande spela tidigare steg.'}</p>
      {table.round ? <><div className={styles.cardRow}><strong>Dealer</strong>{(table.round.dealer ?? []).map((card: { r?: string; s?: string; faceDown?: boolean }, index: number) => <span className={styles.card} key={index}>{card.faceDown || !card.r ? 'Dolt' : `${card.r}${card.s}`}</span>)}{table.round.holeDraw != null && !(table.round.dealer ?? []).some((card: { shoeDraw?: number }) => card.shoeDraw === table.round.holeDraw) ? <span className={styles.card}>Dolt</span> : null}</div><div className={styles.hands}>{(table.round.hands ?? []).map((hand: { box: number; cards: { r?: string; s?: string }[]; outcome?: string }, index: number) => <div className={styles.cardRow} key={`${hand.box}:${index}`}><strong>Plats {hand.box + 1}</strong>{(hand.cards ?? []).map((card, ci) => <span className={styles.card} key={ci}>{card.r ? `${card.r}${card.s}` : 'Dolt'}</span>)}{hand.outcome ? <small>{hand.outcome}</small> : null}</div>)}</div></> : <p className={styles.note}>Inget pågående bord i mottagen data.</p>}
    </section>
    <details className={styles.details}><summary>Spelsekvens · {sequence.steps.length} instruktioner · {sequence.batchCount} kommandosvar</summary><PresentationSequence sequence={sequence} selectedId={step?.id} busy={busy || following || playing} onSelect={next => { cancel(); setSelectedId(next.id); setResult(null); }} onPlay={playStep} onOpenEvent={(id, next) => { stopFollow(); onOpenEvent(id, next); }} /></details>
    <p className={styles.note}>Samma publicerade speldata används i båda vyerna. Originalets bild och uppspelningskvitton, labbets beslut och labbets klippstarter är separata observationer.</p>
  </div>;
}
