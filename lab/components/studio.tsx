'use client';

import { StudioGuide } from './studio-guide';
import { EventTree } from './event-tree';
import { ActivityLog, type ActivityDraft } from './activity-log';
import { appendActivity, decisionAttribution, eventSummary, type ActivityEntry } from '../lib/activity-log.mjs';
import { OUTPUT_GROUPS, presentationProfile } from '../lib/presentation-profile.mjs';
import treeStyles from './event-tree.module.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addVariant, allowedPathDescriptors, isAssetCompatible, MAX_ALTERNATIVES, removeTrigger, removeVariant } from '../lib/studio-model.mjs';
import type { DealerId, StudioAsset, StudioProject, StudioTrigger, StudioVariant, TriggerCategory } from '../lib/studio-model.mjs';
import { videoFitsLine } from '../lib/video-intake.mjs';
import { getMotionClip } from '../lib/motion-library.mjs';
import { EventTestPanel } from './event-test-panel';
import { Stage, type PlaybackReceipt } from './stage';
import { TriggerEditor, categoryLabels, defaultValue } from './trigger-editor';
import { VideoLibrary, VariantVideoBinding } from './video-library';
import { VariantSelectionEditor } from './variant-selection';
import type { UploadBinding } from './video-upload';
import type { VideoEntry } from './studio-types';
import { GatewayPanel } from './gateway-panel';
import { neutralContext } from './test-context';
import { SocialChatPanel } from './social-chat-panel';
import type { SocialDraftCache, SocialActivity } from './social-chat-panel';
import socialStyles from './social-chat-panel.module.css';
import { requestJson, studioViewForPath, viewPaths, previewVideoIdFor } from './studio-types';
import type { ConnectionStatus, DirectorMode, SimulationResult, StudioView, TestContext, VideoInventory } from './studio-types';

const navigation: { id: StudioView; label: string; number: string }[] = [{ id: 'tree', label: 'Nodträdet', number: '01' }, { id: 'lab', label: 'Eventstudion', number: '02' }, { id: 'videos', label: 'Videobanken', number: '03' }, { id: 'activity', label: 'Händelselogg', number: '04' }, { id: 'openclaw', label: 'Chatt & OpenClaw', number: '05' }, { id: 'guide', label: 'Guide', number: '06' }];

const socialTitles: Record<string, string> = {
  'social.requested': 'Meddelande skickat till Astrid',
  'social.responded': 'Astrids svar togs emot',
  'social.suppressed': 'Sociala policyn håller en paus',
  'social.cancelled': 'Socialt prov avbröts',
  'social.failed': 'Socialt prov misslyckades',
  'social.replay.requested': 'Spela sparat tal igen',
  'social.audio.loading': 'Ljudet kontrolleras före start',
  'social.audio.started': 'Astrids tal startade',
  'social.audio.completed': 'Astrids tal spelades klart',
  'social.audio.cancelled': 'Talprovet avbröts',
  'social.audio.failed': 'Talet kunde inte spelas klart',
  'social.audio.rejected': 'Ljudet avvisades',
};
const logReasons: Record<string, string> = {
  ai_disabled: 'Bara standard är valt. Ingen modell anropades.',
  deterministic_rules: 'Reglerna valde den högst prioriterade tillåtna varianten. Ingen modell anropades.',
  local_random: 'Labbet lottade bland standard och slumpaktiverade alternativ som matchade villkoren.',
  accepted: 'Modellens föreslagna variant var tillåten och godkändes av servern.',
  shadow_only: 'Modellförslaget var giltigt, men skuggläget spelar standardvarianten.',
  no_advice: 'Inget användbart modellråd kom tillbaka. Servern valde standardvarianten.',
  invalid_advice_shape: 'Modellsvaret följde inte det förväntade formatet. Servern valde standardvarianten.',
  request_mismatch: 'Modellsvaret hörde till en annan begäran. Servern valde standardvarianten.',
  catalog_mismatch: 'Modellsvaret gällde en annan projektversion. Servern valde standardvarianten.',
  abstained: 'Modellen avstod från variantval. Servern valde standardvarianten.',
  ineligible_variant: 'Modellens förslag var inte tillåtet i detta prov. Servern valde standardvarianten.',
  'explicit-player-chat': 'Du skickade ett meddelande i det sociala provet.',
  'explicit-manual-replay': 'Du bad att få höra det sparade ljudet igen. Inget nytt tal genererades.',
  'validated-social-trigger': 'Uttrycksförslaget godkändes enligt sociala policyn. Croupiern stannar i vänteläget.',
  'neutral-idle-response': 'Svaret godkändes utan uttrycksbyte. Croupiern stannar i vänteläget.',
  cooldown: 'Pausen mellan sociala reaktioner har inte löpt ut. Inget nytt tal spelas.',
  'audio-metadata-preflight': 'Ljudets längd kontrolleras före uppspelning.',
  'browser-audio-playing': 'Webbläsaren bekräftade att ljudet började spelas.',
  'audio-ended': 'Webbläsaren rapporterade att ljudet spelades till sitt slut.',
  'audio-longer-than-six-seconds': 'Ljudet är längre än sex sekunder och avvisades. Textsvaret finns kvar.',
  'speech-six-second-watchdog': 'Sexsekundersgränsen stoppade ljudprovet. Det räknas inte som slutfört tal.',
  'audio-metadata-timeout': 'Ljudets längd kunde inte läsas i tid. Provet avbröts.',
  'audio-play-rejected': 'Webbläsaren nekade ljudstarten. Inget automatiskt omtag görs.',
  'audio-error': 'Webbläsaren rapporterade ett ljudfel. Inget automatiskt omtag görs.',
  'speech-owner-busy': 'Ett annat talprov använder redan ljudspelaren.',
  'user-stop': 'Du stoppade det sociala provet.',
  'explicit-stop': 'Talprovet stoppades uttryckligen.',
  'explicit-stop-or-view-change': 'Provet stoppades eller den aktuella vyn ändrades.',
  'selection-settings-or-view-change': 'Val, inställning eller vy ändrades. Det sociala provet stoppades.',
  'left-astrid-idle': 'Astrids vänteläge lämnades. Det sociala provet stoppades.',
  'social-panel-unmounted': 'Chattpanelen stängdes. Det sociala provet stoppades.',
  'page-hidden': 'Fliken doldes. Det sociala provet stoppades.',
  'page-left': 'Sidan lämnades. Det sociala provet stoppades.',
  'social-request-failed': 'Begäran om ett socialt svar misslyckades.',
};
const readableLogReason = (reason: string | undefined) => reason ? logReasons[reason] ?? `Rapporterad orsak: ${reason}` : 'Ingen särskild orsak angavs. Se serverns beslutsspår.';

export function Studio({ initialProject, initialVideos, initialStatus, initialView = 'lab' }: { initialProject: StudioProject; initialVideos: VideoInventory; initialStatus: ConnectionStatus; initialView?: StudioView }) {
  const [project, setProject] = useState(initialProject);
  const [videos, setVideos] = useState(initialVideos);
  const projectRef = useRef(project);
  projectRef.current = project;
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialProject));
  const [view, setView] = useState<StudioView>(initialView);
  const [dealerId, setDealerId] = useState<DealerId>('astrid');
  const [eventId, setEventId] = useState(initialProject.events[0].id);
  const [variantId, setVariantId] = useState('');
  const [editorTab, setEditorTab] = useState<'event' | 'variants' | 'triggers'>('variants');
  const [testToolsOpen, setTestToolsOpen] = useState(false);
  const [focusSocial, setFocusSocial] = useState(false);
  const [mode, setMode] = useState<DirectorMode>('active');
  const [context, setContext] = useState<TestContext>(() => structuredClone(neutralContext));
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [playId, setPlayId] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [previewKind, setPreviewKind] = useState<'selected' | 'social' | null>(null);
  const [socialAsset, setSocialAsset] = useState<StudioAsset | null>(null);
  const [socialReply, setSocialReply] = useState('');
  const [filter, setFilter] = useState('');
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [socialBusy, setSocialBusy] = useState(false);
  const socialBusyRef = useRef(false);
  const activePlayback = useRef<{ id: string; title: string; started: boolean } | null>(null);
  const recordActivity = useCallback((entry: ActivityDraft) => {
    setActivities(current => appendActivity(current, { ...entry, id: crypto.randomUUID(), time: new Date().toISOString() }));
  }, []);
  const socialOwnership = useCallback((value: boolean) => { socialBusyRef.current = value; setSocialBusy(value); }, []);
  const recordSocial = useCallback((entry: SocialActivity) => {
    const audio = entry.type.includes('.audio.');
    const status = entry.type.endsWith('requested') ? 'received' : entry.type.endsWith('started') ? 'started' : entry.type.endsWith('loading') ? 'waiting' : entry.type.endsWith('completed') ? 'completed' : entry.type.endsWith('cancelled') || entry.type.endsWith('suppressed') ? 'cancelled' : entry.type.endsWith('failed') || entry.type.endsWith('rejected') ? 'failed' : 'selected';
    const owner = audio ? 'Labbets ljudspelare' : status === 'received' ? 'Du / spelarchatt'
      : entry.data?.textOwner === 'saved-social-policy' ? 'OpenClaws bedömning · text från din sparade policy'
        : entry.data?.decisionOwner === 'OpenClaw + local-social-policy' ? 'OpenClaw + labbets kontroll'
          : entry.data?.decisionOwner === 'local-social-policy' ? 'Labbets sociala policy' : 'Labbets sociala kontroll';
    recordActivity({ source: 'social', stage: audio ? 'playback' : status === 'received' ? 'input' : 'decision', status, title: socialTitles[entry.type] ?? `Social händelse: ${entry.type}`, runId: entry.requestId, owner, reason: readableLogReason(entry.reason), data: { ...entry.data, type: entry.type, rawReason: entry.reason } });
  }, [recordActivity]);
  const simulationRun = useRef(0);
  const simulationRequest = useRef<AbortController | null>(null);
  const cancelSocial = useRef<((reason?: string) => void) | null>(null);
  const socialDraftCache = useRef<SocialDraftCache | null>(null);
  const mainStage = useRef<HTMLDivElement>(null);
  const socialChat = useRef<HTMLDivElement>(null);
  const registerSocialCancel = useCallback((cancel: ((reason?: string) => void) | null) => { cancelSocial.current = cancel; }, []);

  const projectJson = useMemo(() => JSON.stringify(project), [project]);
  const dirty = projectJson !== savedJson;
  const event = project.events.find(item => item.id === eventId) ?? project.events[0];
  const line = project.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!;
  const variant = line.variants.find(item => item.id === variantId) ?? line.variants[0];
  const isBaseline = variant.id === line.baselineVariantId;
  const dealer = project.dealers.find(item => item.id === dealerId)!;
  const selectedAsset = project.assets.find(item => item.id === variant.assetId);
  const currentAsset = socialAsset ?? result?.asset ?? selectedAsset;
  const selectedAnimationCompatible = isAssetCompatible(event, selectedAsset);
  const incompatibleBindings = useMemo(() => {
    const events = new Map(project.events.map(item => [item.id, item]));
    const assets = new Map(project.assets.map(item => [item.id, item]));
    return project.lines.flatMap(item => item.variants.filter(candidate => !isAssetCompatible(events.get(item.eventId), assets.get(candidate.assetId))).map(candidate => ({ dealerId: item.dealerId, eventId: item.eventId, variantId: candidate.id })));
  }, [project]);
  const eligibleIds = new Set((result?.eligible ?? []).map(item => typeof item === 'string' ? item : item.id ?? item.variantId));
  const visibleEvents = project.events.filter(item => `${item.label} ${item.id}`.toLocaleLowerCase('sv').includes(filter.toLocaleLowerCase('sv')));
  const previewVideoId = previewVideoIdFor(variant, result, Boolean(socialAsset));
  const selectedVideo = previewVideoId ? videos.videos.find(item => item.id === previewVideoId && item.available && videoFitsLine(item, dealerId, event.id)) : undefined;
  const invalidVideoBindings = project.lines.flatMap(l => l.variants.filter(v => v.videoGenerationId && !videoFitsLine(videos.videos.find(f => f.id === v.videoGenerationId), l.dealerId, l.eventId)));

  function openFirstIncompatibleBinding() {
    const first = incompatibleBindings[0];
    if (!first) return;
    setDealerId(first.dealerId); setEventId(first.eventId); setVariantId(first.variantId);
    setEditorTab('variants'); changeView('lab');
  }
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      const social = socialDraftCache.current;
      if (dirty || social && JSON.stringify(social.draft) !== JSON.stringify(social.status.policy)) { event.preventDefault(); event.returnValue = ''; }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
  useEffect(() => {
    function onPopState() { invalidateSimulation(); setView(studioViewForPath(window.location.pathname)); }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => () => { simulationRun.current++; simulationRequest.current?.abort(); cancelSocial.current?.(); }, []);
  useEffect(() => {
    if (view !== 'lab' || previewKind !== 'social' || !socialReply) return;
    const frame = window.requestAnimationFrame(() => scrollTo(mainStage.current));
    return () => window.cancelAnimationFrame(frame);
  }, [playId, previewKind, socialReply, view]);

  useEffect(() => {
    if (!focusSocial || view !== 'lab' || dealerId !== 'astrid' || eventId !== 'idle.ready') return;
    const frame = window.requestAnimationFrame(() => { scrollTo(socialChat.current); setFocusSocial(false); });
    return () => window.cancelAnimationFrame(frame);
  }, [focusSocial, view, dealerId, eventId]);

  function scrollTo(element: HTMLElement | null) {
    element?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function invalidateSimulation(stopSocial = true) {
    if (activePlayback.current) {
      recordActivity({ source: 'player', stage: 'playback', status: 'cancelled', runId: activePlayback.current.id, title: 'Pågående prov avbröts', owner: 'Labbets kontroll', reason: 'Val, inställning eller vy ändrades. Ingen slutförd uppspelning antas.' });
      activePlayback.current = null;
    }
    simulationRun.current++; simulationRequest.current?.abort(); simulationRequest.current = null;
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
  function goToAstridIdle() { changeView('lab'); setDealerId('astrid'); setEventId('idle.ready'); setVariantId(''); setFocusSocial(true); }
  function playSocialReaction(assetId: 'social.ledsen' | 'idle.ready.standard', label: string, exactReply: string) {
    if (dealerId !== 'astrid' || event.id !== 'idle.ready' || view !== 'lab') return;
    const clip = getMotionClip('idle.ready.standard');
    if (!clip) { setError('Den sociala labbrörelsen saknas. Ingen annan rörelse spelades som ersättning.'); return; }
    setSocialAsset({ id: 'idle.ready.standard', label: `${label} · svar från idle`, kind: 'animation', animation: 'idle', color: '#b7a4c5', durationMs: clip.durationMs });
    setSocialReply(exactReply);
    setResult(null); setPreviewKind('social'); setPlayId(current => current + 1); setPlaying(true);
  }
  function recordPlayback(receipt: PlaybackReceipt) {
    if (previewKind === 'social') return; // Speech has its own owner and audio receipts.
    if (!activePlayback.current && receipt.phase === 'started') {
      activePlayback.current = { id: crypto.randomUUID(), title: currentAsset?.label ?? variant.label, started: false };
    }
    const run = activePlayback.current;
    if (!run) return;
    if (receipt.phase === 'started' && run.started) return;
    if (receipt.phase === 'started') { run.started = true; setPlaying(true); }
    recordActivity({ source: 'player', stage: 'playback', status: receipt.phase === 'fallback' ? 'failed' : receipt.phase, runId: run.id, title: `${receipt.medium === 'video' ? 'Video' : '2D'} · ${run.title}`, owner: 'Labbets spelare', reason: receipt.reason ?? (receipt.phase === 'completed' ? 'Spelaren rapporterade avslut. Ingen visuell acceptans hävdas.' : 'Spelaren rapporterade faktisk start.'), data: receipt });
    if (receipt.phase === 'completed') activePlayback.current = null;
    if (receipt.phase === 'fallback') run.started = false;
  }
  function changeView(next: StudioView) { invalidateSimulation(); setView(next); window.history.pushState(null, '', viewPaths[next]); }
  function updateProject(edit: (draft: StudioProject) => void) { setProject(current => { const draft = structuredClone(current); edit(draft); return draft; }); invalidateSimulation(); setError(''); setNotice(''); }
  function modelEdit(edit: (value: StudioProject) => StudioProject) {
    try { setProject(edit(project)); invalidateSimulation(); setError(''); setNotice(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Ändringen kunde inte göras.'); }
  }
  function updateVariant(patch: Partial<StudioVariant>) { updateProject(draft => { const target = draft.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!.variants.find(item => item.id === variant.id)!; Object.assign(target, patch); }); }
  function uploadedVideo(inventory: VideoInventory, video: VideoEntry, binding: UploadBinding | null) {
    setVideos(inventory);
    if (!binding || !video.classification) return;
    const { dealerId: targetDealer, eventId: targetEvent } = video.classification;
    try {
      let next = structuredClone(projectRef.current);
      if (binding.role === 'alternative') next = addVariant(next, targetDealer, targetEvent, video.label);
      const targetLine = next.lines.find(l => l.dealerId === targetDealer && l.eventId === targetEvent)!;
      const targetVariant = binding.role === 'standard' ? targetLine.variants.find(v => v.id === targetLine.baselineVariantId)! : targetLine.variants.at(-1)!;
      targetVariant.videoGenerationId = video.id;
      if (binding.role === 'alternative') { targetVariant.selection = binding.selection; targetVariant.triggerIds = binding.triggerIds; }
      setProject(next); setDealerId(targetDealer); setEventId(targetEvent); setVariantId(targetVariant.id);
      invalidateSimulation(); setError(''); setNotice('Videon finns i banken. Kopplingen ligger i utkastet tills du sparar projektet.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Filen sparades men kunde inte kopplas.'); }
  }
  function updateTrigger(id: string, patch: Partial<StudioTrigger>) { updateProject(draft => { Object.assign(draft.triggers.find(item => item.id === id)!, patch); }); }
  function createTrigger(category: TriggerCategory) {
    const descriptor = allowedPathDescriptors.find(item => item.category === category)!;
    const id = `trigger.${crypto.randomUUID()}`;
    updateProject(draft => { draft.triggers.push({ id, label: `Ny ${category === 'deterministic' ? 'spelregel' : category === 'social' ? 'social trigger' : 'framtoning'}`, category, path: descriptor.path, op: descriptor.operators[0], value: defaultValue(descriptor) }); });
    return id;
  }
  function selectEvent(id: string) { setEventId(id); setVariantId(''); invalidateSimulation(); }
  function selectDealer(id: DealerId) { setDealerId(id); setVariantId(''); invalidateSimulation(); }
  function selectVariant(id: string) { setVariantId(id); invalidateSimulation(); }
  function changeContext(next: TestContext) { setContext(next); invalidateSimulation(); }
  function changeMode(next: DirectorMode) { setMode(next); invalidateSimulation(); }

  async function save() {
    if (saving) return;
    invalidateSimulation();
    setSaving(true); setError(''); setNotice('');
    const submitted = project;
    try {
      const response = await requestJson<{ project: StudioProject }>('/api/project', { method: 'PUT', body: JSON.stringify({ project: submitted, expectedRevision: submitted.revision }) });
      if (!response.project) throw new Error('Servern returnerade inte det sparade projektet.');
      setSavedJson(JSON.stringify(response.project));
      setProject(current => current === submitted ? response.project : { ...current, revision: response.project.revision });
      setNotice('Projektet är sparat lokalt. Inget har publicerats till spelet eller Render.');
      recordActivity({ source: 'config', stage: 'configuration', status: 'completed', title: 'Projekt sparat lokalt', owner: 'Du / projektlagringen', reason: 'Regler och kopplingar sparades. Ingen produktpublicering.', data: { revision: response.project.revision } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Projektet kunde inte sparas.'); }
    finally { setSaving(false); }
  }

  async function simulate() {
    if (socialBusyRef.current) { setNotice('Vänta tills det sociala svaret är klart eller välj Stoppa före ett nytt eventprov.'); return; }
    setTestToolsOpen(true);
    invalidateSimulation();
    const run = ++simulationRun.current;
    const controller = new AbortController(); simulationRequest.current = controller;
    const logRun = crypto.randomUUID();
    activePlayback.current = { id: logRun, title: event.label, started: false };
    recordActivity({ source: 'lab', stage: 'input', status: 'received', runId: logRun, title: eventSummary(event.exampleEvent), owner: 'Sparat labbexempel + dina testvärden', reason: 'Detta är ett isolerat prov, ingen mottagen spelström.', data: { source: 'lab-example', event: event.exampleEvent, context, dealerId, selectionMode: mode, contextOrigin: 'manual-test-values' } });
    setSimulating(true); setError(''); setResult(null); setPlaying(false);
    try {
      const response = await requestJson<SimulationResult>('/api/simulate', { method: 'POST', signal: controller.signal, body: JSON.stringify({ project, dealerId, eventId: event.id, context, mode }) });
      if (controller.signal.aborted || run !== simulationRun.current) return;
      setResult(response);
      if (activePlayback.current) activePlayback.current.title = response.variant?.label ?? event.label;
      recordActivity({ source: 'lab', stage: 'decision', status: 'selected', runId: logRun, title: response.variant?.label ?? 'Variant vald', owner: decisionAttribution(mode, response.decision?.reason, response.provider), reason: readableLogReason(response.decision?.reason), data: { rawReason: response.decision?.reason, decision: response.decision, provider: response.provider, eligible: response.eligible, trace: response.trace, output: { variantId: response.variant?.id, videoGenerationId: response.videoGenerationId, assetId: response.asset?.id, durationMs: response.asset?.durationMs, durationSource: '2D-asset; videons faktiska längd läses av spelaren' } } });
      if (response.variant?.id) setVariantId(response.variant.id);
      setPlayId(current => current + 1); setPlaying(true);
    } catch (cause) { if (run === simulationRun.current) { const message = cause instanceof Error ? cause.message : 'Testet kunde inte genomföras.'; setError(message); activePlayback.current = null; recordActivity({ source: 'lab', stage: 'decision', status: 'failed', runId: logRun, title: 'Eventprovet misslyckades', owner: 'Labbservern', reason: message }); } }
    finally { if (run === simulationRun.current) { simulationRequest.current = null; setSimulating(false); } }
  }

  function exportProject() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'croupier-lab-project.json'; anchor.click(); URL.revokeObjectURL(url);
    setNotice('JSON exporterad. Filen innehåller labbpolicyer, inte hemligheter eller videofiler.');
  }

  return <div className="studio-shell"><a className="skip-link" href="#workspace">Hoppa till arbetsytan</a><header className="studio-header"><a className="studio-brand" href="/" onClick={e => { e.preventDefault(); changeView('lab'); }}><span className="brand-mark" aria-hidden="true">C<span>↗</span></span><span>CROUPIER<small>DIRECTOR STUDIO</small></span></a><nav className="main-nav" aria-label="Huvudnavigation">{navigation.map(item => <a key={item.id} href={viewPaths[item.id]} className={view === item.id ? 'active' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); changeView(item.id); } }}><span>{item.number}</span>{item.label}</a>)}</nav><div className="header-actions"><span className={`save-state ${dirty ? 'dirty' : ''}`}><i />{dirty ? 'Osparade ändringar' : 'Sparat lokalt'}</span><button className="icon-button export-button" title="Exportera projekt som JSON" aria-label="Exportera projekt som JSON" onClick={exportProject}>↓</button><button className="primary-button" disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara projekt'}</button></div></header>
    <div className={`studio-body ${view === 'lab' || view === 'videos' ? '' : treeStyles.fullWidth}`}>{view === 'lab' || view === 'videos' ? <aside className="event-sidebar"><div className="sidebar-top"><div className="eyebrow">DITT LABB <span>LOCAL / 01</span></div><div className="game-selector"><button className="active" aria-pressed="true"><span aria-hidden="true">♠</span> Blackjack</button><button disabled title="Roulette är inte implementerat">Roulette <small>Senare</small></button></div><label className="dealer-selector"><span className="eyebrow">CROUPIER</span><select value={dealerId} onChange={e => selectDealer(e.target.value as DealerId)}>{project.dealers.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="search-field sidebar-search"><span aria-hidden="true">⌕</span><input placeholder="Hitta ett event…" aria-label="Sök event" value={filter} onChange={e => setFilter(e.target.value)} /></label></div><div className="event-tree"><div className="tree-title"><span>EVENTTRÄD</span><span>{project.events.length}</span></div>{OUTPUT_GROUPS.map(group => { const source = group.id; const items = visibleEvents.filter(item => presentationProfile(item.sourceType)?.id === source); return items.length ? <div className="event-group" key={source}><div className="event-group-title"><span>{group.symbol}</span>{group.label}<code>{items.length}</code></div>{items.map(item => <button className={`event-node ${event.id === item.id ? 'active' : ''}`} key={item.id} aria-pressed={event.id === item.id} onClick={() => selectEvent(item.id)}><i /><span>{item.label}</span>{event.id === item.id ? <span className="node-arrow">↗</span> : null}</button>)}</div> : null; })}{!visibleEvents.length ? <p className="helper">Inga event matchar sökningen.</p> : null}</div><div className="sidebar-footer"><span className="sidebar-foot-icon" aria-hidden="true">⌘</span><p><strong>4 presentationssätt · 16 grupper.</strong><span>Grupperat efter utdata. Källans 6 typer finns kvar.</span></p></div></aside> : null}
      <main id="workspace" className={`workspace view-${view}`}><div className="workspace-breadcrumb"><span>Blackjack</span><span>/</span><span>{dealer.label}</span><span>/</span><strong>{view === 'lab' ? event.label : view === 'tree' ? 'Nodträdet' : view === 'videos' ? 'Videobanken' : view === 'guide' ? 'Guide' : view === 'activity' ? 'Händelselogg' : 'OpenClaw'}</strong><span className="environment-badge"><i /> ISOLERAT LABB</span></div>{error ? <div className="feedback error" role="alert"><span>{error}</span><button className="icon-button" aria-label="Stäng felmeddelande" onClick={() => setError('')}>×</button></div> : null}{notice ? <div className="feedback success" role="status"><span>{notice}</span><button className="icon-button" aria-label="Stäng meddelande" onClick={() => setNotice('')}>×</button></div> : null}
        {incompatibleBindings.length ? <div className="feedback error" role="alert"><span><strong>{incompatibleBindings.length} animationskopplingar behöver rättas.</strong> Projektet innehåller äldre val som inte matchar spelhändelsen. Inget har ändrats automatiskt. Välj en kompatibel labbanimation för varje markerad variant innan du sparar eller testar.</span><button className="primary-button" onClick={openFirstIncompatibleBinding}>Rätta första kopplingen →</button></div> : null}
        {invalidVideoBindings.length ? <div className="feedback error" role="alert"><span>{invalidVideoBindings.length} videokopplingar behöver kategoriseras eller kopplas loss. Inga original har ändrats.</span><button className="text-button" onClick={() => changeView('videos')}>Granska i Videobanken →</button></div> : null}
        {view !== 'openclaw' ? <div className="studio-chat-shortcuts" aria-label="Labbets två chattar"><span>Chatt</span><button type="button" className="text-button" onClick={goToAstridIdle}>Spelarchatt med Astrid →</button><button type="button" className="text-button" onClick={() => changeView('openclaw')}>Fråga OpenClaw om labbet →</button></div> : null}
        {view === 'activity' ? null : view === 'tree' ? <EventTree project={project} inventory={videos} dealerId={dealerId} event={event} line={line} variant={variant} mode={mode} onSelectDealer={selectDealer} onSelectEvent={selectEvent} onSelectVariant={selectVariant} onEdit={tab => { setEditorTab(tab); changeView('lab'); }} onVideos={() => changeView('videos')} onOpenClaw={() => changeView('openclaw')} /> : view === 'videos' ? <VideoLibrary onInventory={next => { setVideos(next); invalidateSimulation(); }} project={project} onUploaded={uploadedVideo} onOpenEvent={id => { selectEvent(id); changeView('lab'); }} inventory={videos} dealer={dealer.label} eventLabel={event.label} line={line} variant={variant} onSelectVariant={selectVariant} onBind={id => updateVariant({ videoGenerationId: id })} /> : view === 'guide' ? <StudioGuide onNavigate={changeView} /> : view === 'openclaw' ? <GatewayPanel status={initialStatus} mode={mode} onModeChange={changeMode} dealerId={dealerId} dirty={dirty} onPlayerChat={goToAstridIdle} /> : <div className="editor-layout"><div className="preview-column"><div className="event-heading"><div><span className="eyebrow">01 / EVENTSTUDION</span><h1>{event.label}</h1><p>{event.description}</p></div><span className="source-tag">{event.sourceType}<span>källtyp · labbindelning</span></span></div><div ref={mainStage} className={socialStyles.stageAnchor}><Stage event={event} asset={currentAsset} dealer={dealer.label} variantLabel={socialAsset?.label ?? result?.variant?.label ?? variant.label} playId={playId} playing={playing} hasResult={Boolean(result)} previewing={Boolean(previewKind) && playing} busy={simulating} blocked={socialBusy} onPlaybackEvent={recordPlayback} videoUrl={selectedVideo?.previewUrl} videoName={selectedVideo?.label} videoMissing={Boolean(previewVideoId && !selectedVideo)} onPlay={() => void simulate()} onPreview={previewSelected} onPlaybackEnd={() => setPlaying(false)} /><div ref={socialChat} className={socialStyles.chatAnchor}><SocialChatPanel compact draftCache={socialDraftCache} dealerId={dealerId} eventId={event.id} registerCancel={registerSocialCancel} blocked={simulating || (playing && event.sourceType !== 'idle' && previewKind !== 'social')} onBusyChange={socialOwnership} onActivity={recordSocial} onBegin={() => invalidateSimulation(false)} onReaction={playSocialReaction} onGoToIdle={goToAstridIdle} /></div><div className={socialStyles.sceneReply} aria-live="polite" aria-atomic="true">{socialReply ? <><div><span className="eyebrow">ASTRID · SOCIALT LABBSVAR</span><p>{socialReply}</p><small>Separat social presentation, inte ett nytt spel-event eller godkänd läppsynk.</small></div><button className="text-button" type="button" onClick={() => scrollTo(socialChat.current)}>Visa chatten ↓</button></> : <span><strong>Spela vald variant</strong> visar ditt material direkt. <strong>Testa event</strong> {mode === 'active' ? 'låter OpenClaw välja; ett modellanrop kan göras när du trycker.' : `kör jämförelseläget ${mode === 'off' ? 'Bara standard' : mode === 'shadow' ? 'Skuggläge' : mode === 'rules' ? 'Regler' : 'Slumpvariation'}.`}</span>}</div></div>
          <EventTestPanel open={testToolsOpen} onOpen={setTestToolsOpen} mode={mode} onMode={changeMode} configured={Boolean(initialStatus.configured)} context={context} onContext={changeContext} dealer={dealer.label} eventLabel={event.label} sourceType={event.sourceType} result={result} previewKind={previewKind} busy={simulating} blocked={socialBusy} onRun={() => void simulate()} /><div className="workspace-footnote">2D-reserven är ett rörelseprov för labbets eventgrupper. Kompletta spelhänder och läppsynk ingår inte.</div><div className="workspace-footnote">Testmiljö, inte ett spel om pengar. RNG, regler och utbetalningar är alltid utanför studion.</div>
        </div><aside className="inspector"><div className="inspector-heading"><span className="eyebrow">BYGG PRESENTATIONEN</span><h2>Redigera vald nod</h2><p>Valt event: {event.label} · {dealer.label}.</p></div><div className="inspector-tabs" role="tablist" aria-label="Redigera event"><button role="tab" aria-selected={editorTab === 'event'} onClick={() => setEditorTab('event')}>Event</button><button role="tab" aria-selected={editorTab === 'variants'} onClick={() => setEditorTab('variants')}>Varianter <span>{line.variants.length}</span></button><button role="tab" aria-selected={editorTab === 'triggers'} onClick={() => setEditorTab('triggers')}>Triggers</button></div>
          <div className="inspector-content">{editorTab === 'event' ? <div><label className="field">Eventets visningsnamn<input value={event.label} maxLength={120} onChange={e => updateProject(draft => { draft.events.find(item => item.id === event.id)!.label = e.target.value; })} /></label><p className="helper">Samma labbnamn för alla fyra croupierer. Motorns typer och ID:n ligger fast.</p>{event.id === 'speak.other' ? <p className="notice subtle">Den här labbnoden samlar flera exakta replik-ID:n. En generisk videokoppling här är bara ett labbexempel — den kan inte användas som gemensam talvideo för alla repliker i spelet.</p> : null}<label className="field">Beskrivning<textarea rows={4} value={event.description} maxLength={600} onChange={e => updateProject(draft => { draft.events.find(item => item.id === event.id)!.description = e.target.value; })} /></label><label className="field">Linjens namn<input value={line.label} maxLength={120} onChange={e => updateProject(draft => { draft.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!.label = e.target.value; })} /></label><p className="helper">Variantuppsättningen samlar en skyddad standardvariant och möjliga alternativ för {dealer.label}.</p><div className="protected-contract"><span className="eyebrow">LÅST KÄLLKONTRAKT</span><code>{event.id}</code><p>Tekniskt event-ID och motorns fält ändras inte när du byter namn.</p><details className="technical-details"><summary>Se källeventets exempel</summary><pre>{JSON.stringify(event.exampleEvent, null, 2)}</pre></details></div></div> : editorTab === 'triggers' ? <TriggerEditor triggers={project.triggers} descriptors={allowedPathDescriptors} onChange={updateTrigger} onAdd={createTrigger} onRemove={id => { const count = project.lines.reduce((total, item) => total + item.variants.filter(v => v.triggerIds.includes(id)).length, 0); if (count > 0) { setError(`Triggern används av ${count} varianter. Koppla loss den uttryckligen under Varianter innan du tar bort den.`); return; } if (window.confirm('Ta bort denna oanvända trigger? Ändringen sparas först när du väljer Spara projekt.')) modelEdit(value => removeTrigger(value, id)); }} /> : <div><div className="variant-list">{line.variants.map((item, index) => <button key={item.id} className={`variant-option ${variant.id === item.id ? 'active' : ''}`} onClick={() => selectVariant(item.id)}><span className="variant-number">{String(index).padStart(2, '0')}</span><span><strong>{item.label}</strong><small>{item.id === line.baselineVariantId ? 'Standard · alltid tillåten' : result ? eligibleIds.has(item.id) ? 'Tillåten i senaste testet' : 'Ej valbar i detta läge' : `${item.triggerIds.length} triggers · prioritet ${item.priority}`}</small></span>{item.id === line.baselineVariantId ? <span className="baseline-mark" title="Skyddad standardvariant">◇</span> : null}</button>)}</div><button className="text-button add-variant" disabled={line.variants.length >= MAX_ALTERNATIVES + 1} onClick={() => { try { const next = addVariant(project, dealerId, event.id, `Alternativ ${line.variants.length}`); setProject(next); setVariantId(next.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!.variants.at(-1)!.id); invalidateSimulation(); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Varianten kunde inte skapas.'); } }}>＋ Lägg till variant <span>{line.variants.length - 1}/{MAX_ALTERNATIVES}</span></button><div className="variant-form"><span className="eyebrow">{isBaseline ? 'REDIGERA STANDARDVARIANT' : 'REDIGERA ALTERNATIV'}</span><label className="field">Variantens namn<input value={variant.label} maxLength={120} onChange={e => updateVariant({ label: e.target.value })} /></label><VariantVideoBinding key={variant.id} inventory={videos} dealerId={dealerId} eventId={event.id} variant={variant} isBaseline={isBaseline} onBind={id => updateVariant({ videoGenerationId: id })} onInspect={() => changeView('videos')} />{!isBaseline ? <VariantSelectionEditor variant={variant} onChange={selection => updateVariant({ selection })} /> : null}<details className="reserve-editor"><summary>2D-reserv</summary><label className="field">2D-rörelse när video saknas<select value={variant.assetId} aria-invalid={!selectedAnimationCompatible} onChange={e => updateVariant({ assetId: e.target.value })}>{!selectedAnimationCompatible ? <option value={variant.assetId} disabled>{selectedAsset?.label ?? variant.assetId} · behöver bytas (matchar inte eventet)</option> : null}{project.assets.filter(asset => isAssetCompatible(event, asset)).map(asset => <option value={asset.id} key={asset.id}>{asset.label} · {asset.animation}</option>)}</select></label></details>{!isBaseline ? <label className="field">Prioritet <span className="optional">Högre väljs först i regelläget</span><input type="number" value={variant.priority} min={-100} max={100} onChange={e => updateVariant({ priority: Number(e.target.value) })} /></label> : null}{isBaseline ? <div className="notice subtle"><strong>Din standardvariant.</strong><p>Den har inga villkor och kan inte tas bort. Om ett modellval fallerar finns den alltid kvar.</p></div> : <fieldset className="trigger-assignment"><legend>Vilka triggers måste matcha?</legend><p className="helper">Alla valda villkor måste vara sanna. Inga valda = inga extra villkor. Urvalstillåtelsen gäller fortfarande.</p>{project.triggers.map(trigger => <label className="check-field" key={trigger.id}><input type="checkbox" checked={variant.triggerIds.includes(trigger.id)} onChange={e => updateVariant({ triggerIds: e.target.checked ? [...variant.triggerIds, trigger.id] : variant.triggerIds.filter(id => id !== trigger.id) })} /><span>{trigger.label}<small>{categoryLabels[trigger.category]}</small></span></label>)}<button type="button" className="text-button" onClick={() => setEditorTab('triggers')}>Hantera triggerbiblioteket →</button></fieldset>}<code className="technical-id">{variant.id}</code>{!isBaseline ? <button className="danger-button" onClick={() => { modelEdit(value => removeVariant(value, dealerId, event.id, variant.id)); setVariantId(line.baselineVariantId); }}>Ta bort alternativ</button> : null}</div></div>}</div><div className="inspector-footer"><i className={dirty ? 'unsaved-dot' : 'saved-dot'} />{dirty ? 'Utkast · spara när du är nöjd' : 'Projekt sparat lokalt'}<span>JSON, inte dold konfiguration.</span></div></aside></div>}
        <ActivityLog entries={activities} onActivity={recordActivity} onClear={() => setActivities([])} full={view === 'activity'} onOpen={() => changeView('activity')} />
      </main></div><footer className="studio-footer"><span>CROUPIER LAB <span className="footer-version">/ PRESENTATION LAB</span></span><span>Indata → Presentationsbehov → Standard eller alternativ → Uppspelning</span><span>{initialStatus.configured ? 'OpenClaw konfigurerat' : 'Lokalt regelläge'}</span></footer>
  </div>;
}
