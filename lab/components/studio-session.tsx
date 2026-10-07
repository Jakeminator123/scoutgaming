'use client';

// useStudioSession(options) — shared control-page state. One field per line:
// initialProject: StudioProject — server project and the saved-revision baseline
// initialVideos: VideoInventory — server video inventory
// initialStatus: ConnectionStatus — connection status, returned as status
// initialDealerId?: string — query dealer; unknown values fall back to the first dealer
// initialEventId?: string — query event; unknown values fall back to the first event
// connectedLane?: boolean — save notice mentions the live lane when true
// unsavedSocialRef?: ref — social draft included in the beforeunload guard
// onInvalidate?: ref — Studio playback reset; tree, guide and activity omit it
// observation?: { active, step, speechLine, situation } — lab-only event overlay
// project / setProject: StudioProject — editable project
// updateProject(edit): clone, apply, clear messages, invalidate
// modelEdit(edit): replace the project or surface the thrown error
// dirty: boolean — project JSON differs from the last saved JSON
// saving: boolean — save request in flight
// save(): Promise<void> — PUT /api/project
// exportProject(): void — download the project JSON
// error / setError: string — visible error
// notice / setNotice: string — visible confirmation
// conflict / setConflict: boolean — HTTP 409 while saving
// savedJson / setSavedJson: string — last saved project JSON
// videos / setVideos: VideoInventory
// refreshVideos(): Promise<void> — POST /api/videos/rescan
// refreshingVideos: boolean
// originals: OriginalMediaCatalog | null — loaded after mount
// dealerId: DealerId
// selectDealer(id): set dealer, clear variant, replaceState the query
// eventId: string
// selectEvent(id): set event, clear variant, replaceState the query
// variantId: string
// setVariantId(id): raw variant setter, no query and no invalidate
// selectVariant(id): set variant and invalidate
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
import { appendActivity, type ActivityEntry } from '../lib/activity-log.mjs';
import type { ActivityDraft } from './activity-log';
import { loadActivities, saveActivities } from '../lib/activity-store.mjs';
import { mediaExampleEvent, mediaLineForEvent } from '../lib/media-family-policy.mjs';
import type { OriginalMediaCatalog } from '../lib/original-media.mjs';
import type { PresentationStep } from '../lib/presentation-sequence.mjs';
import { isAssetCompatible, type DealerId, type StudioProject } from '../lib/studio-model.mjs';
import { videoFitsLine } from '../lib/video-intake.mjs';
import { publishShellStatus } from './page-template.mjs';
import { requestJson, resolveStudioDealerId, resolveStudioEventId, selectionHref, studioHref } from './studio-types';
import type { ConnectionStatus, DirectorMode, VideoInventory } from './studio-types';

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
  connectedLane?: boolean;
  unsavedSocialRef?: { readonly current: UnsavedSocialDraft | null };
  onInvalidate?: RefObject<((stopSocial?: boolean) => void) | null>;
  observation?: StudioObservation;
};

export function useStudioSession(options: SessionOptions) {
  const { initialProject, initialVideos, initialStatus, connectedLane = false, observation } = options;
  const [project, setProject] = useState(initialProject);
  const [conflict, setConflict] = useState(false);
  const [videos, setVideos] = useState(initialVideos);
  const [originals, setOriginals] = useState<OriginalMediaCatalog | null>(null);
  const [refreshingVideos, setRefreshingVideos] = useState(false);
  const projectRef = useRef(project);
  projectRef.current = project;
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialProject));
  const [dealerId, setDealerId] = useState<DealerId>(() => resolveStudioDealerId(initialProject, options.initialDealerId));
  const [eventId, setEventId] = useState(() => resolveStudioEventId(initialProject, options.initialEventId));
  const [variantId, setVariantId] = useState('');
  const [mode, setMode] = useState<DirectorMode>('off');
  const [saving, setSaving] = useState(false);
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
  const eventDefinition = project.events.find(item => item.id === eventId) ?? project.events[0];
  const observedEvent = observation?.active && observation.step?.eventId === eventDefinition.id && observation.step.event && typeof observation.step.event === 'object'
    ? observation.step.event as Record<string, unknown> : null;
  const speechExample = eventDefinition.id === 'speak.other' ? { ...eventDefinition.exampleEvent, line: observation?.speechLine ?? 'placebets' } : null;
  const event = observedEvent ? { ...eventDefinition, exampleEvent: observedEvent }
    : observation?.situation ? { ...eventDefinition, exampleEvent: mediaExampleEvent(eventDefinition, observation.situation) }
      : speechExample ? { ...eventDefinition, exampleEvent: speechExample } : eventDefinition;
  const media = mediaLineForEvent(project, videos, dealerId, event.id, event.exampleEvent);
  const line = media.line;
  const variant = line.variants.find((item: { id: string }) => item.id === variantId) ?? line.variants[0];
  const dealer = project.dealers.find(item => item.id === dealerId)!;

  function replaceSelectionQuery(nextDealer: string, nextEvent: string) {
    if (typeof window === 'undefined' || !window.location || !window.history?.replaceState) return;
    const href = selectionHref(window.location.pathname, window.location.search, nextDealer, nextEvent);
    if (`${window.location.pathname}${window.location.search}` === href) return;
    window.history.replaceState(null, '', href);
  }
  function assignSelection(patch: StudioSelectionPatch, call: { invalidate?: boolean } = {}) {
    const nextDealer = patch.dealerId ?? dealerId;
    const nextEvent = patch.eventId ?? eventId;
    if (patch.dealerId && !project.dealers.some(item => item.id === patch.dealerId)) return;
    if (patch.eventId && !project.events.some(item => item.id === patch.eventId)) return;
    if (patch.dealerId) setDealerId(patch.dealerId);
    if (patch.eventId) setEventId(patch.eventId);
    if (patch.variantId !== undefined) setVariantId(patch.variantId);
    else if (patch.dealerId !== undefined || patch.eventId !== undefined) setVariantId('');
    if (patch.dealerId !== undefined || patch.eventId !== undefined) replaceSelectionQuery(nextDealer, nextEvent);
    if (call.invalidate !== false) options.onInvalidate?.current?.();
  }
  function selectDealer(id: DealerId) { assignSelection({ dealerId: id }); }
  function selectEvent(id: string) { assignSelection({ eventId: id }); }
  function selectVariant(id: string) { setVariantId(id); options.onInvalidate?.current?.(); }
  function changeMode(next: DirectorMode) { setMode(next); options.onInvalidate?.current?.(); }
  function updateProject(edit: (draft: StudioProject) => void) {
    setProject(current => { const draft = structuredClone(current); edit(draft); return draft; });
    options.onInvalidate?.current?.();
    setError('');
    setNotice('');
  }
  function modelEdit(edit: (value: StudioProject) => StudioProject) {
    try { setProject(edit(project)); options.onInvalidate?.current?.(); setError(''); setNotice(''); }
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
  async function save() {
    if (saving) return;
    options.onInvalidate?.current?.();
    setSaving(true); setError(''); setNotice('');
    const submitted = project;
    try {
      const response = await requestJson<{ project: StudioProject }>('/api/project', { method: 'PUT', body: JSON.stringify({ project: submitted, expectedRevision: submitted.revision }) });
      if (!response.project) throw new Error('Servern returnerade inte det sparade projektet.');
      setSavedJson(JSON.stringify(response.project));
      setProject(current => current === submitted ? response.project : { ...current, revision: response.project.revision });
      setNotice(connectedLane
        ? 'Sparat. Spelet läser nya deal- och replikval vid nästa händelse och Probe inför nästa beslut. Ladda om spelfliken efter ändrad idlepolicy, när handen är avslutad.'
        : 'Projektet är sparat. Probe läser policyn inför nästa beslut.');
      recordActivity({ source: 'config', stage: 'configuration', status: 'completed', title: 'Projekt sparat', owner: 'Du / projektlagringen',
        reason: 'Regler och kopplingar sparades.',
        data: { revision: response.project.revision } });
    } catch (cause) { if ((cause as { statusCode?: number })?.statusCode === 409) setConflict(true); setError(cause instanceof Error ? cause.message : 'Projektet kunde inte sparas.'); }
    finally { setSaving(false); }
  }
  function exportProject() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'croupier-lab-project.json'; anchor.click(); URL.revokeObjectURL(url);
    setNotice('JSON exporterad. Filen innehåller labbpolicyer, inte hemligheter eller videofiler.');
  }

  useEffect(() => {
    const controller = new AbortController();
    requestJson<OriginalMediaCatalog>('/api/original-media', { signal: controller.signal }).then(setOriginals).catch(() => {});
    return () => controller.abort();
  }, []);
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
    videos, setVideos, refreshVideos, refreshingVideos, originals,
    dealerId, selectDealer, eventId, selectEvent, variantId, setVariantId, selectVariant, assignSelection,
    mode, changeMode, status: initialStatus, event, observedEvent, line, variant, media, dealer,
    activities, recordActivity, clearActivities, setActivities, projectRef,
  };
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
    {incompatible.length ? <div className="feedback error" role="alert"><span><strong>{incompatible.length} animationskopplingar behöver rättas.</strong> Projektet innehåller äldre val som inte matchar spelhändelsen. Inget har ändrats automatiskt. Välj en kompatibel labbanimation för varje markerad variant innan du sparar eller testar.</span>{first ? <a className="primary-button" href={studioHref('/control/events', { dealerId: first.dealerId, eventId: first.eventId })}>Rätta första kopplingen →</a> : null}</div> : null}
    {invalidVideos.length ? <div className="feedback error" role="alert"><span>{invalidVideos.length} videokopplingar behöver kategoriseras eller kopplas loss. Inga original har ändrats.</span><a className="text-button" href={studioHref('/control/videos', { dealerId, eventId })}>Granska i Videobanken →</a></div> : null}
  </>;
}
