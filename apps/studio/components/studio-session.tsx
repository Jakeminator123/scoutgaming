'use client';

// useStudioProjectSession(options) — project state with optional dealer context.
// useStudioSession(options) — the same state, with a required, validated dealer-editor context.
// One field per line:
// initialProject: StudioProject — server project and the saved-revision baseline
// initialVideos: VideoInventory — server video inventory
// initialStatus: ConnectionStatus — connection status, returned as status
// initialDealerId?: string — explicit query dealer; absent or unknown values stay unselected
// initialEventId?: string — query event; unknown values fall back to the first event
// initialVariantId?: string — query variant; unknown values fall back to the line default
// connectedLane?: boolean — save notice mentions the live lane when true
// unsavedSocialRef?: ref — social draft included in the beforeunload guard
// overview?: boolean — dealer query only; event stays in component state until an editor link
// onInvalidate?: ref — Studio playback reset; tree, guide and activity omit it
// observation?: { active, step, speechLine, situation } — lab-only event overlay
// project / setProject: StudioProject — editable project
// updateProject(edit): clone, apply, clear messages, invalidate
// modelEdit(edit): replace the project or surface the thrown error
// dirty: boolean — project JSON differs from the last saved JSON
// saving: boolean — save request in flight
// save(): Promise<boolean> — true only when the current draft was saved; false on error, duplicate request or newer edits
// exportProject(): void — download the project JSON
// error / setError: string — visible error
// notice / setNotice: string — visible confirmation
// conflict / setConflict: boolean — HTTP 409 while saving
// savedJson / setSavedJson: string — last saved project JSON
// videos / setVideos: VideoInventory
// refreshVideos(): Promise<void> — POST /api/videos/rescan
// refreshingVideos: boolean
// dealerId: DealerId
// selectDealer(id): set dealer, clear variant, replaceState the query
// eventId: string
// selectEvent(id): set event, clear variant, replaceState the query
// variantId: string
// setVariantId(id): raw variant setter, no query and no invalidate
// selectVariant(id): set variant, replaceState the query (events and videos only), invalidate
// assignSelection(patch, options?): one dealer/event/variant update
// mode: DirectorMode
// changeMode(mode): set mode and invalidate
// status: ConnectionStatus
// event: StudioEvent — selected event, including lab overlays
// observedEvent: Record<string, unknown> | null — live lab step payload
// line: selected dealer/event line, after media-family resolution
// variant: selected variant, or the line default
// media: { managed, family, line }
// dealer: selected dealer
// activities: ActivityEntry[] — sessionStorage after mount
// recordActivity(draft): append a log entry and persist it
// clearActivities(): empty the log and persist that
// projectRef: latest project for async upload handlers

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { appendActivity, type ActivityDraft, type ActivityEntry } from '../lib/activity-log.mjs';
import { loadActivities, saveActivities } from '../lib/activity-store.mjs';
import { mediaExampleEvent, mediaLineForEvent } from '../../../packages/presentation/runtime/media-family-policy.mjs';
import type { PresentationStep } from '../lib/presentation-sequence.mjs';
import { isAssetCompatible, type DealerId, type StudioProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { videoFitsLine } from '../../../packages/presentation/contracts/video-intake.mjs';
import { publishShellStatus } from './page-template.mjs';
import { studioHistory } from '../lib/studio-history.mjs';
import { studioNavigationContextFromQuery, studioNavigationHref } from '../lib/studio-navigation.mjs';
import { stripLabBasePath } from '../lib/lab-url.mjs';
import { activeStudioDealers, requestJson, resolveStudioDealerId, resolveStudioEventId, selectionHref, studioHref } from './studio-types';
import type { ConnectionStatus, DirectorMode } from './studio-types';
import type { VideoInventory } from '../../../packages/presentation/contracts/media-inventory.mjs';

export type UnsavedSocialDraft = { draft: unknown; status: { policy: unknown } };
export type StudioObservation = {
  active: boolean;
  step: PresentationStep | null;
  speechLine: string;
  situation: string;
};
export type StudioSelectionPatch = { dealerId?: DealerId; eventId?: string; variantId?: string };

type SessionOptions = {
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  initialDealerId?: string;
  initialEventId?: string;
  initialVariantId?: string;
  connectedLane?: boolean;
  unsavedSocialRef?: { readonly current: UnsavedSocialDraft | null };
  onInvalidate?: RefObject<((stopSocial?: boolean) => void) | null>;
  observation?: StudioObservation;
  overview?: boolean;
};

export function useStudioProjectSession(options: SessionOptions) {
  const { initialProject, initialVideos, initialStatus, connectedLane = false, observation } = options;
  const [project, setProjectState] = useState(initialProject);
  const [conflict, setConflict] = useState(false);
  const [videos, setVideos] = useState(initialVideos);
  const [refreshingVideos, setRefreshingVideos] = useState(false);
  const projectRef = useRef(project);
  // The ref advances with each mutation, before React renders. Both sequential
  // functional edits and async save callbacks therefore see the newest draft.
  const setProject = useCallback((change: StudioProject | ((current: StudioProject) => StudioProject)) => {
    const next = typeof change === 'function' ? change(projectRef.current) : change;
    projectRef.current = next;
    setProjectState(next);
  }, []);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialProject));
  const [selectedDealerId, setDealerId] = useState<DealerId>(() => resolveStudioDealerId(initialProject, options.initialDealerId));
  const [eventId, setEventId] = useState(() => initialProject.events.length ? resolveStudioEventId(initialProject, options.initialEventId) : '');
  const [variantId, setVariantId] = useState(() => options.initialVariantId ?? '');
  const [mode, setMode] = useState<DirectorMode>('off');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [activitiesReady, setActivitiesReady] = useState(false);
  const recordActivity = useCallback((entry: ActivityDraft) => {
    setActivities(current => appendActivity(current, { ...entry, id: crypto.randomUUID(), time: new Date().toISOString() }));
  }, []);
  const clearActivities = useCallback(() => setActivities([]), []);
  const projectJson = JSON.stringify(project);
  const dirty = projectJson !== savedJson;
  const dealer = activeStudioDealers(project).find(item => item.id === selectedDealerId);
  const dealerId = dealer?.id ?? '';
  const eventDefinition = project.events.find(item => item.id === eventId) ?? project.events[0];
  const observedEvent = eventDefinition && observation?.active && observation.step?.eventId === eventDefinition.id && observation.step.event && typeof observation.step.event === 'object'
    ? observation.step.event as Record<string, unknown> : null;
  const speechExample = eventDefinition?.id === 'speak.other' ? { ...eventDefinition.exampleEvent, line: observation?.speechLine ?? 'placebets' } : null;
  const event = !eventDefinition ? undefined : observedEvent ? { ...eventDefinition, exampleEvent: observedEvent }
    : observation?.situation ? { ...eventDefinition, exampleEvent: mediaExampleEvent(eventDefinition, observation.situation) }
      : speechExample ? { ...eventDefinition, exampleEvent: speechExample } : eventDefinition;
  const savedLine = dealer && event ? project.lines.find(item => item.dealerId === dealerId && item.eventId === event.id) : undefined;
  const media = event && savedLine?.variants.some(item => item.id === savedLine.baselineVariantId)
    ? mediaLineForEvent(project, videos, dealerId, event.id, event.exampleEvent) : undefined;
  const line = media?.line;
  const variant = line?.variants.find((item: { id: string }) => item.id === variantId) ?? line?.variants[0];

  function replaceSelectionQuery(nextDealer: string, nextEvent: string, nextVariant = '') {
    if (typeof window === 'undefined' || !window.location || !window.history?.replaceState) return;
    const path = stripLabBasePath(window.location.pathname.split(/[?#]/, 1)[0]) || '/';
    const selection = options.overview
      ? studioHref(path, { dealerId: nextDealer })
      : selectionHref(window.location.pathname, window.location.search, nextDealer, nextEvent, nextVariant);
    const query = new URLSearchParams(window.location.search);
    const { laneId, operatorId, tableId, game } = studioNavigationContextFromQuery(query);
    const url = new URL(studioNavigationHref(selection, { laneId, operatorId, tableId, game }), 'https://studio.invalid');
    if (query.get('room')) url.searchParams.set('room', query.get('room')!);
    url.hash = window.location.hash;
    const href = url.pathname + url.search + url.hash;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` === href) return;
    studioHistory(window).push(href, true);
  }
  function assignSelection(patch: StudioSelectionPatch, call: { invalidate?: boolean } = {}) {
    const nextDealer = patch.dealerId ?? dealerId;
    const nextEvent = patch.eventId ?? eventId;
    if (patch.dealerId && !resolveStudioDealerId(project, patch.dealerId)) return;
    if (patch.eventId && !project.events.some(item => item.id === patch.eventId)) return;
    if (patch.dealerId !== undefined) setDealerId(patch.dealerId);
    if (patch.eventId) setEventId(patch.eventId);
    const selectionMoved = patch.dealerId !== undefined || patch.eventId !== undefined;
    const nextVariant = patch.variantId !== undefined ? patch.variantId : selectionMoved ? '' : variantId;
    if (patch.variantId !== undefined) setVariantId(patch.variantId);
    else if (selectionMoved) setVariantId('');
    if (selectionMoved || patch.variantId !== undefined) replaceSelectionQuery(nextDealer, nextEvent, nextVariant);
    if (call.invalidate !== false) options.onInvalidate?.current?.();
  }
  function selectDealer(id: DealerId) { assignSelection({ dealerId: id }); }
  function selectEvent(id: string) { assignSelection({ eventId: id }); }
  function selectVariant(id: string) { setVariantId(id); replaceSelectionQuery(dealerId, eventId, id); options.onInvalidate?.current?.(); }
  function changeMode(next: DirectorMode) { setMode(next); options.onInvalidate?.current?.(); }
  function updateProject(edit: (draft: StudioProject) => void) {
    setProject(current => { const draft = structuredClone(current); edit(draft); return draft; });
    options.onInvalidate?.current?.();
    setError('');
    setNotice('');
  }
  function modelEdit(edit: (value: StudioProject) => StudioProject) {
    try { setProject(current => edit(current)); options.onInvalidate?.current?.(); setError(''); setNotice(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Ändringen kunde inte göras.'); }
  }
  async function refreshVideos() {
    options.onInvalidate?.current?.();
    setRefreshingVideos(true);
    setError('');
    try { setVideos(await requestJson<VideoInventory>('/api/videos/rescan', { method: 'POST' })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Videomapparna kunde inte läsas.'); }
    finally { setRefreshingVideos(false); }
  }
  async function save(): Promise<boolean> {
    if (savingRef.current) return false;
    savingRef.current = true;
    options.onInvalidate?.current?.();
    setSaving(true); setError(''); setNotice('');
    const submitted = projectRef.current;
    try {
      const response = await requestJson<{ project: StudioProject }>('/api/project', { method: 'PUT', body: JSON.stringify({ project: submitted, expectedRevision: submitted.revision }) });
      if (!response.project) throw new Error('Servern returnerade inte det sparade projektet.');
      const unchanged = projectRef.current === submitted;
      setSavedJson(JSON.stringify(response.project));
      setConflict(false);
      setProject(current => current === submitted ? response.project : { ...current, revision: response.project.revision });
      setNotice(!unchanged ? 'Sparat. Nyare ändringar finns kvar i utkastet.' : connectedLane
        ? 'Sparat. Ladda om spelfliken mellan händer efter ändrad grundloop eller originalmotorns klippval.'
        : 'Projektet är sparat.');
      recordActivity({ source: 'config', stage: 'configuration', status: 'completed', title: 'Projekt sparat', owner: 'Du / projektlagringen',
        reason: 'Regler och kopplingar sparades.',
        data: { revision: response.project.revision } });
      return unchanged;
    } catch (cause) { if ((cause as { statusCode?: number })?.statusCode === 409) setConflict(true); setError(cause instanceof Error ? cause.message : 'Projektet kunde inte sparas.'); return false; }
    finally { savingRef.current = false; setSaving(false); }
  }
  function exportProject() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'croupier-lab-project.json'; anchor.click(); URL.revokeObjectURL(url);
    setNotice('JSON exporterad. Filen innehåller labbpolicyer, inte hemligheter eller videofiler.');
  }

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      const social = options.unsavedSocialRef?.current;
      if (dirty || social && JSON.stringify(social.draft) !== JSON.stringify(social.status.policy)) { event.preventDefault(); event.returnValue = ''; }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, options.unsavedSocialRef]);
  useEffect(() => {
    publishShellStatus(<span className={dirty ? 'sg-pill sg-pill-ej-sparad' : 'sg-pill sg-pill-sparad'}>{dirty ? 'Ej sparad' : 'Sparad'}</span>);
    return () => publishShellStatus(null);
  }, [dirty]);
  useEffect(() => {
    setActivities(loadActivities());
    setActivitiesReady(true);
  }, []);
  useEffect(() => {
    if (!activitiesReady) return;
    saveActivities(activities);
  }, [activities, activitiesReady]);

  return {
    project, setProject, updateProject, modelEdit, dirty, saving, save, exportProject,
    error, setError, notice, setNotice, conflict, setConflict, savedJson, setSavedJson,
    videos, setVideos, refreshVideos, refreshingVideos,
    dealerId, selectDealer, eventId, selectEvent, variantId, setVariantId, selectVariant, assignSelection,
    mode, changeMode, status: initialStatus, event, observedEvent, line, variant, media, dealer,
    activities, recordActivity, clearActivities, setActivities, projectRef,
  };
}

// Dealer pages gate entry before mounting this hook. Project-only pages use the
// nullable project session above and never need a synthetic dealer or line.
export function useStudioSession(options: SessionOptions) {
  const session = useStudioProjectSession(options);
  const { dealer, event, media, line, variant } = session;
  if (!dealer || !event || !media || !line || !variant) {
    throw new Error('Dealervyn kräver en vald dealer och en sparad händelse med klippvariant.');
  }
  return { ...session, dealer, event, media, line, variant };
}

export function StudioMessages({ error, notice, setError, setNotice }: { error: string; notice: string; setError: (value: string) => void; setNotice: (value: string) => void }) {
  return <>
    {error ? <div className="feedback error" role="alert"><span>{error}</span><button className="icon-button" aria-label="Stäng felmeddelande" onClick={() => setError('')}>×</button></div> : null}
    {notice ? <div className="feedback success" role="status"><span>{notice}</span><button className="icon-button" aria-label="Stäng meddelande" onClick={() => setNotice('')}>×</button></div> : null}
  </>;
}

export function StudioContextIntro({ dealerLabel, pageLabel, eventHref, eventLabel }: { dealerLabel: string; pageLabel: string; eventHref: string; eventLabel: string }) {
  return <span className="workspace-breadcrumb"><span>Blackjack</span><span> / </span><span>{dealerLabel}</span><span> / </span><strong>{pageLabel}</strong><span> / </span><a href={eventHref}>{eventLabel}</a></span>;
}

export function StudioBindingNotices({ project, videos, dealerId, eventId }: { project: StudioProject; videos: VideoInventory; dealerId: string; eventId: string }) {
  const incompatible = project.lines.flatMap(item => item.variants.filter(candidate => !isAssetCompatible(project.events.find(event => event.id === item.eventId), project.assets.find(asset => asset.id === candidate.assetId))).map(candidate => ({ dealerId: item.dealerId, eventId: item.eventId, variantId: candidate.id })));
  const invalidVideos = project.lines.filter(item => !videos.families?.some(family => family.dealerId === item.dealerId)).flatMap(item => item.variants.filter(candidate => candidate.videoGenerationId && !videoFitsLine(videos.videos.find(video => video.id === candidate.videoGenerationId), item.dealerId, item.eventId)));
  const first = incompatible[0];
  return <>
    {incompatible.length ? <div className="feedback error" role="alert"><span><strong>{incompatible.length} animationskopplingar behöver rättas.</strong> Projektet innehåller äldre val som inte matchar spelhändelsen. Inget har ändrats automatiskt. Välj en kompatibel labbanimation för varje markerad variant innan du sparar eller testar.</span>{first ? <a className="primary-button" href={studioHref('/admin/events', { dealerId: first.dealerId, eventId: first.eventId })}>Rätta första kopplingen →</a> : null}</div> : null}
    {invalidVideos.length ? <div className="feedback error" role="alert"><span>{invalidVideos.length} videokopplingar behöver kategoriseras eller kopplas loss. Inga original har ändrats.</span><a className="text-button" href={studioHref('/admin/videos', { dealerId, eventId })}>Granska i Videobanken →</a></div> : null}
  </>;
}
