'use client';
import { StudioDealerRequired } from './studio-dealer-required';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { decisionAttribution, eventSummary } from '../lib/activity-log.mjs';
import { dealFrequencyPolicies, mediaVideoForEvent } from '../lib/media-family-policy.mjs';
import { getMotionClip } from '../lib/motion-library.mjs';
import { resolveOriginalDefault } from '../lib/original-media.mjs';
import { takeObservedStep } from '../lib/observed-step-store.mjs';
import type { PresentationStep } from '../lib/presentation-sequence.mjs';
import { isAssetCompatible } from '../lib/studio-model.mjs';
import type { DealerId, StudioAsset, StudioProject } from '../lib/studio-model.mjs';
import { videoFitsLine, situationsForEvent } from '../lib/video-intake.mjs';
import { StudioNavigation } from './studio-navigation';
import { clipSituationLabel } from '../lib/clip-label.mjs';
import { EventsCatalog } from './events-catalog';
import { EventsInspector, eventsEditorTab, type EventsEditorTab } from './events-inspector';
import { describeSocialActivity, EventsIdleNotice, EventsPreview, readableLogReason } from './events-preview';
import { PageTemplate } from './page-template.mjs';
import { ProjectConflict } from './project-conflict';
import type { SocialActivity, SocialDraftCache } from './social-chat-panel';
import type { PlaybackReceipt } from './stage';
import { StudioMessages, useStudioSession } from './studio-session';
import { neutralContext } from './test-context';
import { activeStudioDealers, resolveStudioDealerId, previewVideoIdFor, requestJson, studioHref, type ConnectionStatus, type DirectorMode, type SimulationResult, type TestContext, type VideoInventory } from './studio-types';

function readObservedStep(): PresentationStep | null {
  const step = takeObservedStep() as PresentationStep | null;
  if (!step || step.blocked || typeof step.eventId !== 'string' || !step.eventId) return null;
  return step;
}

// Strict Mode mounts, unmounts and mounts again. The first effect deletes the
// stored step; keep it until the second mount has read it, then drop it.
let strictObservedStep: PresentationStep | null | undefined;
function consumeObservedStep() {
  if (strictObservedStep === undefined) strictObservedStep = readObservedStep();
  return strictObservedStep;
}

function SelectedControlEventsPage({ initialProject, initialVideos, initialStatus, initialDealerId, initialEventId, initialVariantId, initialTab, initialSituation, connectedLane = false }: {
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  initialDealerId?: string;
  initialEventId?: string;
  initialVariantId?: string;
  initialTab?: string;
  initialSituation?: string;
  connectedLane?: boolean;
}) {
  const [observedStep, setObservedStep] = useState<PresentationStep | null>(null);
  const initialDefinition = initialProject.events.find(row => row.id === initialEventId);
  const validInitialSituation = initialDefinition && initialSituation && situationsForEvent(initialDefinition).includes(initialSituation) ? initialSituation : '';
  const [exampleSpeechLine, setExampleSpeechLine] = useState(validInitialSituation || 'placebets');
  const [exampleSituation, setExampleSituation] = useState(validInitialSituation);
  const [editorTab, setEditorTab] = useState<EventsEditorTab>(() => eventsEditorTab(initialTab));
  const [testToolsOpen, setTestToolsOpen] = useState(false);
  const [focusSocial, setFocusSocial] = useState(false);
  const [context, setContext] = useState<TestContext>(() => structuredClone(neutralContext));
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [playId, setPlayId] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [previewKind, setPreviewKind] = useState<'selected' | 'social' | null>(null);
  const [socialAsset, setSocialAsset] = useState<StudioAsset | null>(null);
  const [socialReply, setSocialReply] = useState('');
  const [filter, setFilter] = useState('');
  const [socialBusyState, setSocialBusy] = useState(false);
  const socialBusyRef = useRef(false);
  const activePlayback = useRef<{ id: string; title: string; started: boolean } | null>(null);
  const socialOwnership = useCallback((value: boolean) => { socialBusyRef.current = value; setSocialBusy(value); }, []);
  const simulationRun = useRef(0);
  const simulationRequest = useRef<AbortController | null>(null);
  const cancelSocial = useRef<((reason?: string) => void) | null>(null);
  const socialDraftCache = useRef<SocialDraftCache | null>(null);
  const invalidateRef = useRef<((stopSocial?: boolean) => void) | null>(null);
  const mainStage = useRef<HTMLDivElement>(null);
  const speechHost = useRef<HTMLDivElement>(null);
  const socialChat = useRef<HTMLDivElement>(null);
  const registerSocialCancel = useCallback((cancel: ((reason?: string) => void) | null) => { cancelSocial.current = cancel; }, []);
  const session = useStudioSession({
    initialProject, initialVideos, initialStatus, initialDealerId, initialEventId, initialVariantId, connectedLane,
    unsavedSocialRef: socialDraftCache, onInvalidate: invalidateRef,
    observation: { active: true, step: observedStep, speechLine: exampleSpeechLine, situation: exampleSituation },
  });
  const {
    project, setProject, updateProject, modelEdit, dirty, saving, save, exportProject,
    error, setError, notice, setNotice, conflict, setConflict, savedJson, setSavedJson,
    videos, refreshVideos, refreshingVideos, originals,
    dealerId, selectDealer, eventId, selectEvent: selectStoredEvent, setVariantId, selectVariant, assignSelection,
    mode, changeMode, event, observedEvent, line, variant, media, dealer, recordActivity,
  } = session;
  const recordSocial = useCallback((entry: SocialActivity) => { recordActivity(describeSocialActivity(entry)); }, [recordActivity]);
  const selectedAsset = project.assets.find(item => item.id === variant.assetId);
  const currentAsset = socialAsset ?? result?.asset ?? selectedAsset;
  const selectedAnimationCompatible = isAssetCompatible(event, selectedAsset);
  const incompatibleBindings = useMemo(() => {
    const events = new Map(project.events.map(item => [item.id, item]));
    const assets = new Map(project.assets.map(item => [item.id, item]));
    return project.lines.flatMap(item => item.variants.filter(candidate => !isAssetCompatible(events.get(item.eventId), assets.get(candidate.assetId))).map(candidate => ({ dealerId: item.dealerId, eventId: item.eventId, variantId: candidate.id })));
  }, [project]);
  const eligibleIds = new Set((result?.eligible ?? []).map(item => typeof item === 'string' ? item : item.id ?? item.variantId).filter((id): id is string => Boolean(id)));
  const previewVideoId = previewVideoIdFor(variant, result, Boolean(socialAsset));
  const selectedVideo = media.managed ? mediaVideoForEvent(videos, dealerId, event.id, (result?.decision?.sourceEvent ?? event.exampleEvent) as Record<string, unknown>, previewVideoId) : previewVideoId ? videos.videos.find(item => item.id === previewVideoId && item.available && videoFitsLine(item, dealerId, event.id)) : undefined;
  const currentVariant = result?.variant ?? variant;
  const originalDefault = resolveOriginalDefault(originals, dealerId, (result?.decision?.sourceEvent ?? event.exampleEvent) as Record<string, unknown>);
  const selectedOriginal = !media.managed && !socialAsset && !currentVariant.videoGenerationId && currentVariant.id === line.baselineVariantId ? originalDefault : null;
  const invalidVideoBindings = project.lines.filter(item => !videos.families?.some(family => family.dealerId === item.dealerId)).flatMap(item => item.variants.filter(candidate => candidate.videoGenerationId && !videoFitsLine(videos.videos.find(video => video.id === candidate.videoGenerationId), item.dealerId, item.eventId)));
  const isIdleEditor = dealerId === 'astrid' && event.id === 'idle.ready';
  const isDealEditor = Boolean(media.managed && dealerId === 'astrid' && event.sourceType === 'deal');
  const frequencyMode = Boolean(dealFrequencyPolicies(project, media.family));
  const managed = Boolean(media.managed);

  function chooseTab(tab: EventsEditorTab, selection?: { dealerId: string; eventId: string; variantId: string }) {
    setEditorTab(tab);
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    const href = studioHref('/control/events', {
      dealerId: selection?.dealerId ?? dealerId,
      eventId: selection?.eventId ?? event.id,
      variantId: selection?.variantId ?? variant.id,
      tab, situation: exampleSituation || undefined,
    });
    window.history.replaceState(null, '', href);
  }
  function openFirstIncompatibleBinding() {
    const first = incompatibleBindings[0];
    if (!first) return;
    assignSelection({ dealerId: first.dealerId, eventId: first.eventId, variantId: first.variantId }, { invalidate: false });
    chooseTab('variants', first);
  }
  function scrollTo(element: HTMLElement | null) {
    element?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function invalidateSimulation(stopSocial = true) {
    if (activePlayback.current) {
      recordActivity({ source: 'player', stage: 'playback', status: 'cancelled', runId: activePlayback.current.id, title: 'Pågående prov avbröts', owner: 'Labbets kontroll', reason: 'Val, inställning eller vy ändrades. Ingen slutförd uppspelning antas.' });
      activePlayback.current = null;
    }
    simulationRun.current += 1;
    simulationRequest.current?.abort();
    simulationRequest.current = null;
    setResult(null); setPlaying(false); setSimulating(false); setPreviewKind(null); setSocialAsset(null); setSocialReply('');
    if (stopSocial) cancelSocial.current?.('selection-settings-or-view-change');
  }
  function previewSelected() {
    if (socialBusyRef.current) { setNotice('Ett socialt svar äger idle-läget. Vänta tills det är klart eller välj Stoppa.'); return; }
    invalidateSimulation(); setError('');
    if (!selectedAnimationCompatible) { setError('Byt först den gamla animationskopplingen till en som matchar eventet.'); return; }
    const id = crypto.randomUUID();
    activePlayback.current = { id, title: variant.label, started: false };
    recordActivity({ source: 'manual', stage: 'input', status: 'received', runId: id, title: 'Förhandsvisa markerad variant', owner: 'Du', reason: 'Manuellt val. Regler och OpenClaw körs inte.', data: { event: event.exampleEvent, dealerId, variantId: variant.id, videoGenerationId: variant.videoGenerationId, assetId: variant.assetId, durationMs: selectedAsset?.durationMs, durationSource: '2D-asset; video använder sin egen tid' } });
    setPreviewKind('selected'); setPlayId(current => current + 1); setPlaying(true);
  }
  function goToAstridIdle() {
    assignSelection({ dealerId: 'astrid', eventId: 'idle.ready', variantId: '' });
    setFocusSocial(true);
  }
  function playSocialReaction(assetId: 'social.ledsen' | 'idle.ready.standard', label: string, exactReply: string) {
    if (dealerId !== 'astrid' || event.id !== 'idle.ready') return;
    const clip = getMotionClip('idle.ready.standard');
    if (!clip) { setError('Den sociala labbrörelsen saknas. Ingen annan rörelse spelades som ersättning.'); return; }
    setSocialAsset({ id: 'idle.ready.standard', label: `${label} · svar från idle`, kind: 'animation', animation: 'idle', color: '#b7a4c5', durationMs: clip.durationMs });
    setSocialReply(exactReply);
    setResult(null); setPreviewKind('social'); setPlayId(current => current + 1); setPlaying(true);
  }
  function recordPlayback(receipt: PlaybackReceipt) {
    if (previewKind === 'social') return;
    if (!activePlayback.current && receipt.phase === 'started') activePlayback.current = { id: crypto.randomUUID(), title: currentAsset?.label ?? variant.label, started: false };
    const run = activePlayback.current;
    if (!run) return;
    if (receipt.phase === 'started' && run.started) return;
    if (receipt.phase === 'started') { run.started = true; setPlaying(true); }
    recordActivity({ source: 'player', stage: 'playback', status: receipt.phase === 'fallback' ? 'failed' : receipt.phase, runId: run.id, title: `${receipt.medium === 'video' ? 'Video' : '2D'} · ${run.title}`, owner: 'Labbets spelare', reason: receipt.reason ?? (receipt.phase === 'completed' ? 'Spelaren rapporterade avslut. Ingen visuell acceptans hävdas.' : 'Spelaren rapporterade faktisk start.'), data: receipt });
    if (receipt.phase === 'completed') activePlayback.current = null;
    if (receipt.phase === 'fallback') run.started = false;
  }
  function openEvent(id: string, situation = '') {
    setObservedStep(null);
    setExampleSituation(situation);
    selectStoredEvent(id);
    if (window.history?.replaceState) window.history.replaceState(null, '', studioHref('/control/events', { dealerId, eventId: id, situation: situation || undefined, tab: editorTab }));
  }
  function chooseSituation(situation: string) {
    if (!situationsForEvent(event).includes(situation)) return;
    setExampleSituation(situation); setVariantId(''); invalidateSimulation();
    if (window.history?.replaceState) window.history.replaceState(null, '', studioHref('/control/events', { dealerId, eventId: event.id, situation, tab: editorTab }));
  }
  function changeTestContext(next: TestContext) { setContext(next); invalidateSimulation(); }
  async function simulate() {
    if (socialBusyRef.current) { setNotice('Vänta tills det sociala svaret är klart eller välj Stoppa före ett nytt eventprov.'); return; }
    setTestToolsOpen(true);
    invalidateSimulation();
    const run = ++simulationRun.current;
    const controller = new AbortController();
    simulationRequest.current = controller;
    const logRun = crypto.randomUUID();
    activePlayback.current = { id: logRun, title: event.label, started: false };
    recordActivity({ source: 'lab', stage: 'input', status: 'received', runId: logRun, title: eventSummary(event.exampleEvent), owner: observedEvent ? 'Mottagen spelinstruktion + dina testvärden' : 'Sparat labbexempel + dina testvärden', reason: observedEvent ? 'Lokal presentation av ett mottaget steg; inga spelhandlingar skickas.' : 'Detta är ett isolerat prov, ingen mottagen spelström.', data: { source: observedEvent ? observedStep?.source : 'lab-example', event: event.exampleEvent, context, dealerId, selectionMode: mode, contextOrigin: 'manual-test-values' } });
    setSimulating(true); setError(''); setResult(null); setPlaying(false);
    try {
      const response = await requestJson<SimulationResult>('/api/presentation/decision', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          requestId: logRun, project, dealerId, eventId: event.id, context, mode,
          ...(observedEvent
            ? { sourceEvent: observedEvent, sourceRef: { kind: observedStep?.replay ? 'import' : 'observed', channel: observedStep?.channel, requestId: observedStep?.requestId, version: observedStep?.version, presentationIndex: observedStep?.presentationIndex } }
            : { exampleEvent: event.exampleEvent, sourceRef: { kind: 'example' } }),
        }),
      });
      if (controller.signal.aborted || run !== simulationRun.current) return;
      setResult(response);
      if (activePlayback.current) activePlayback.current.title = response.variant?.label ?? event.label;
      recordActivity({ source: 'lab', stage: 'decision', status: 'selected', runId: logRun, title: response.variant?.label ?? 'Variant vald', owner: decisionAttribution(mode, response.decision?.reason, response.provider), reason: readableLogReason(response.decision?.reason), data: { rawReason: response.decision?.reason, decision: response.decision, provider: response.provider, eligible: response.eligible, trace: response.trace, output: { variantId: response.variant?.id, videoGenerationId: response.videoGenerationId, assetId: response.asset?.id, durationMs: response.asset?.durationMs, durationSource: '2D-asset; videons faktiska längd läses av spelaren' } } });
      if (response.variant?.id) setVariantId(response.variant.id);
      setPlayId(current => current + 1); setPlaying(true);
    } catch (cause) {
      if (run === simulationRun.current) {
        const message = cause instanceof Error ? cause.message : 'Testet kunde inte genomföras.';
        setError(message); activePlayback.current = null;
        recordActivity({ source: 'lab', stage: 'decision', status: 'failed', runId: logRun, title: 'Eventprovet misslyckades', owner: 'Labbservern', reason: message });
      }
    } finally { if (run === simulationRun.current) { simulationRequest.current = null; setSimulating(false); } }
  }
  invalidateRef.current = invalidateSimulation;
  const assignSelectionRef = useRef(assignSelection);
  assignSelectionRef.current = assignSelection;
  useEffect(() => () => { simulationRun.current += 1; simulationRequest.current?.abort(); cancelSocial.current?.(); }, []);
  useEffect(() => {
    const step = consumeObservedStep();
    strictObservedStep = step;
    if (step?.eventId) {
      setObservedStep(step);
      assignSelectionRef.current({ eventId: step.eventId, variantId: '' }, { invalidate: false });
    }
    return () => {
      const snapshot = step;
      queueMicrotask(() => { if (strictObservedStep === snapshot) strictObservedStep = undefined; });
    };
  }, []);
  useEffect(() => {
    if (previewKind !== 'social' || !socialReply) return;
    const frame = window.requestAnimationFrame(() => scrollTo(mainStage.current));
    return () => window.cancelAnimationFrame(frame);
  }, [playId, previewKind, socialReply]);
  useEffect(() => {
    if (!focusSocial || dealerId !== 'astrid' || eventId !== 'idle.ready') return;
    const frame = window.requestAnimationFrame(() => { scrollTo(socialChat.current); setFocusSocial(false); });
    return () => window.cancelAnimationFrame(frame);
  }, [focusSocial, dealerId, eventId]);

  const frequencyHint = frequencyMode && !['off', 'shadow'].includes(mode)
    ? 'väljer klipp enligt dina frekvenser, utan modellanrop.'
    : mode === 'active'
      ? 'låter OpenClaw välja; ett modellanrop kan göras när du trycker.'
      : `kör jämförelseläget ${mode === 'off' ? 'Bara standard' : mode === 'shadow' ? 'Skuggläge' : mode === 'rules' ? 'Regler' : 'Slumpvariation'}.`;
  const videoHref = studioHref('/control/videos', { dealerId, eventId: event.id, variantId: variant.id });
  const eventHref = studioHref('/control/events', { dealerId, eventId: event.id, variantId: variant.id, tab: editorTab });
  const overviewHref = studioHref('/control/events', { dealerId });

  return <PageTemplate
    eyebrow="// STUDIO"
    title="Klippval & villkor"
    intro={`Klipp, varianter och villkor för ${dealer.label}.`}
    primary={<>
      <button type="button" className="sg-btn sg-btn-secondary" onClick={exportProject}>Exportera projekt</button>
      <button type="button" className="sg-btn sg-btn-primary" disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara projekt'}</button>
    </>}
  >
    <div className="sg-page-body">
    <StudioNavigation dealerId={dealerId} dealerLabel={dealer.label} active={event.id === 'idle.ready' ? 'idle' : 'clips'} eventId={event.id} variantId={variant.id} situation={exampleSituation || undefined} crumbs={[{label: exampleSituation ? clipSituationLabel(event.id, exampleSituation) : event.label}, {label: editorTab === 'triggers' ? 'Villkor' : editorTab === 'variants' ? 'Varianter' : 'Klipp'}]} />
    <a className="skip-link" href="#workspace">Hoppa till arbetsytan</a>
    <StudioMessages error={error} notice={notice} setError={setError} setNotice={setNotice} />
    {conflict ? <ProjectConflict base={JSON.parse(savedJson)} draft={project} onResolve={(remote, merged) => { setSavedJson(JSON.stringify(remote)); setProject(merged); setConflict(false); setError(''); setNotice('Utkastet är sammanslaget. Granska dina val och spara.'); }} /> : null}
    {incompatibleBindings.length ? <div className="feedback error" role="alert">
      <span><strong>{incompatibleBindings.length} animationskopplingar behöver rättas.</strong> Projektet innehåller äldre val som inte matchar spelhändelsen. Inget har ändrats automatiskt. Välj en kompatibel labbanimation för varje markerad variant innan du sparar eller testar.</span>
      <button type="button" className="primary-button" onClick={openFirstIncompatibleBinding}>Rätta första kopplingen →</button>
    </div> : null}
    {invalidVideoBindings.length ? <div className="feedback error" role="alert">
      <span>{invalidVideoBindings.length} videokopplingar behöver kategoriseras eller kopplas loss. Inga original har ändrats.</span>
      <a className="text-button" href={videoHref}>Granska i Videobanken →</a>
    </div> : null}
    <div className="workspace view-lab" id="workspace">
      <EventsCatalog project={{...project,dealers:activeStudioDealers(project)}} videos={videos} dealerId={dealerId} eventId={event.id} situation={exampleSituation || undefined} familyId={media.family?.id} managed={managed} filter={filter} onFilter={setFilter} onSelectDealer={selectDealer} onSelectEvent={openEvent} />
      {isIdleEditor ? <EventsIdleNotice refreshing={refreshingVideos} onRefresh={() => void refreshVideos()} /> : null}
      <div className="editor-layout">
        <EventsPreview
          isIdleEditor={isIdleEditor}
          managed={managed}
          event={event}
          observed={Boolean(observedEvent)}
          originals={originals}
          dealerId={dealerId}
          onSituation={chooseSituation}
          onSpeechLine={lineId => { setExampleSpeechLine(lineId); chooseSituation(lineId); }}
          onOpenSpeech={() => { openEvent('speak.other', 'placebets'); setExampleSpeechLine('placebets'); }}
          observedStep={observedStep}
          onClearObserved={() => { setObservedStep(null); invalidateSimulation(); }}
          activityHref={studioHref('/control/activity', { dealerId, eventId: event.id })}
          showStage={!isIdleEditor || previewKind === 'social'}
          stage={{
            asset: currentAsset,
            dealerLabel: dealer.label,
            variantLabel: socialAsset?.label ?? result?.variant?.label ?? variant.label,
            playId, playing, hasResult: Boolean(result), previewing: Boolean(previewKind) && playing, busy: simulating, blocked: socialBusyState,
            onPlaybackEvent: recordPlayback,
            videoUrl: selectedVideo?.previewUrl,
            videoName: selectedVideo?.fileName ?? selectedVideo?.label,
            videoId: previewVideoId ?? undefined,
            familyId: media.family?.id ?? selectedVideo?.familyId,
            allow2dFallback: !managed || previewKind === 'social',
            fallbackVideo: managed ? mediaVideoForEvent(videos, dealerId, event.id, event.exampleEvent, line.variants[0]?.videoGenerationId) : null,
            videoMissing: Boolean(previewVideoId && !selectedVideo),
            originalMedia: selectedOriginal,
            sourceIsObserved: Boolean(observedEvent),
            onPlay: () => void simulate(),
            onPreview: previewSelected,
            onPlaybackEnd: () => setPlaying(false),
          }}
          socialReply={socialReply}
          isIdleCopy={isIdleEditor}
          frequencyHint={frequencyHint}
          onShowChat={() => scrollTo(socialChat.current)}
          mainStage={mainStage}
          speechHost={speechHost}
          socialChat={socialChat}
          social={{
            draftCache: socialDraftCache, dealerId, eventId: event.id, registerCancel: registerSocialCancel,
            blocked: simulating || (playing && event.sourceType !== 'idle' && previewKind !== 'social'),
            onBusyChange: socialOwnership, onActivity: recordSocial, onBegin: () => invalidateSimulation(false),
            onReaction: playSocialReaction, onGoToIdle: goToAstridIdle,
          }}
          showTest={!isIdleEditor}
          test={{
            dealClips: isDealEditor, dealFrequency: frequencyMode, open: testToolsOpen, onOpen: setTestToolsOpen,
            mode, onMode: changeMode, configured: Boolean(initialStatus.configured), context, onContext: changeTestContext,
            dealer: dealer.label, eventLabel: event.label, sourceType: event.sourceType, result, originalLabel: selectedOriginal?.label,
            manifestOwned: managed, previewKind, busy: simulating, blocked: socialBusyState, onRun: () => void simulate(),
          }}
        />
        <EventsInspector
          managed={managed}
          isIdleEditor={isIdleEditor}
          editorTab={editorTab}
          onTab={chooseTab}
          project={project}
          videos={videos}
          family={media.family ?? null}
          dealerId={dealerId}
          dealerLabel={dealer.label}
          event={event}
          line={line}
          variant={variant}
          refreshing={refreshingVideos}
          onRefresh={() => void refreshVideos()}
          selectedAsset={selectedAsset}
          selectedAnimationCompatible={selectedAnimationCompatible}
          originalDefault={originalDefault}
          result={result}
          eligibleIds={eligibleIds}
          dirty={dirty}
          updateProject={updateProject}
          modelEdit={modelEdit}
          setProject={setProject}
          setVariantId={setVariantId}
          setError={setError}
          invalidateSimulation={invalidateSimulation}
          selectVariant={selectVariant}
        />
      </div>
    </div>
    </div>
  </PageTemplate>;
}

export function ControlEventsPage(props: Parameters<typeof SelectedControlEventsPage>[0]) {
  if (!resolveStudioDealerId(props.initialProject, props.initialDealerId)) return <StudioDealerRequired project={props.initialProject} title="Händelser" />;
  return <SelectedControlEventsPage {...props} />;
}
