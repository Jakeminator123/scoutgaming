'use client';
import { labBasePath } from "../lib/lab-url.mjs";
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { IdlePolicyEditor } from './idle-policy-editor';
import {RegisteredIdleEditor} from './registered-idle-editor';
import {DealerSpeechSlotEditor} from './dealer-speech-slot-editor';
import {bindSpeechSlotStandard} from '../../../packages/presentation/contracts/speech-slot-bindings.mjs';
import { LegacyClipEditor } from './legacy-clip-editor';
import { MediaFamilyEditor } from './media-family-editor';
import { clipSituationLabel } from '../lib/clip-label.mjs';
import { upsertMediaVariantPolicy, mediaExampleEvent, mediaLineForEvent, mediaVideoForEvent } from '../../../packages/presentation/runtime/media-family-policy.mjs';
import { situationsForEvent } from '../../../packages/presentation/contracts/video-intake.mjs';
import { createDefaultIdlePolicy, type IdlePolicy } from '../../../packages/presentation/runtime/idle-policy.mjs';
import {DEALER_IDS, type DealerId, type MediaVariantPolicy, type StudioProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import { workspaceLocation, supportsFamilyWorkspace, type DealerWorkspaceSection } from '../lib/dealer-workspace.mjs';
import { dealerMediaSlots } from '../lib/dealer-media-library.mjs';
import { StudioNavigation } from './studio-navigation';
import { studioHistory } from '../lib/studio-history.mjs';
import { studioNavigationHref } from '../lib/studio-navigation.mjs';
import { DealerSpeechSettings } from './dealer-speech-settings';
import { ownDealerIdle } from '../../../packages/presentation/runtime/registered-idle.mjs';
import { activeStudioDealers, requestJson, resolveStudioDealerId, studioHref } from './studio-types';
import type { VideoInventory } from '../../../packages/presentation/contracts/media-inventory.mjs';
import { isActiveDealerId } from '../../../packages/presentation/contracts/dealer-identity.mjs';
import { PageTemplate, publishShellStatus } from './page-template.mjs';
import styles from './lab-studio.module.css';
import {ProjectConflict} from './project-conflict';
import {DealerRegistration} from './dealer-registration';
import {DealerMediaLibrary} from './dealer-media-library';
import {DealerRemoval} from './dealer-removal';
import {DealerMaterialCreator} from './dealer-forge-page';
import {DealerClipPreview} from './dealer-video-surface';

type WorkspaceView = 'idle' | 'clips' | 'generate' | 'speech' | 'settings';
const workspaceViews: WorkspaceView[] = ['idle', 'clips', 'generate', 'speech', 'settings'];
const clipCategories = ['all', 'deal', 'speech', 'reaction', 'action'];
const validView = (value: string | null | undefined): value is WorkspaceView => workspaceViews.includes(value as WorkspaceView);
const eventSection = (eventId: string): DealerWorkspaceSection => eventId === 'idle.ready' ? 'idle' : /^(deal|reveal)\./.test(eventId) ? 'deal' : 'clips';

function scopedHref(href: string, query: URLSearchParams) {
  const url = new URL(href, 'https://studio.invalid');
  // A library selection never resolves ambiguous room or operator scope.
  for (const key of ['operator', 'table', 'room']) if (query.has(key)) {
    url.searchParams.delete(key); for (const value of query.getAll(key)) url.searchParams.append(key, value);
  }
  return url.pathname + url.search + url.hash;
}

export function LabStudio({ initialProject, initialVideos, connectedLane, initialDealerId, initialEventId, initialSituation, initialView, initialCategory, initialLaneId, initialOperatorId, initialTableId, initialGame }: { initialProject: StudioProject; initialVideos: VideoInventory; connectedLane: boolean; initialDealerId?: string; initialEventId?: string; initialSituation?: string; initialView?: string; initialCategory?: string; initialLaneId?: string; initialOperatorId?: string; initialTableId?: string; initialGame?: string }) {
  const cloudStudio = labBasePath() === '/studio';
  const startingView = validView(initialView) ? initialView : initialEventId && initialEventId !== 'idle.ready' ? 'clips' : 'idle';
  const startingEvent = initialProject.events.find(row => row.id === initialEventId && (startingView === 'idle' ? row.id === 'idle.ready' : startingView === 'clips' && row.id !== 'idle.ready'));
  const startingCategory = startingView === 'idle' ? 'idle' : startingEvent ? dealerMediaSlots(initialProject).find(row => row.eventId === startingEvent.id)?.category ?? 'all' : clipCategories.includes(initialCategory ?? '') ? initialCategory! : 'all';
  const [project, setProject] = useState(initialProject);
  const [saved, setSaved] = useState(JSON.stringify(initialProject));
  const [videos, setVideos] = useState(initialVideos);
  const [dealerId, setDealerId] = useState<DealerId>(resolveStudioDealerId(initialProject, initialDealerId));
  const [requestedView, setView] = useState<DealerWorkspaceSection>(startingEvent ? eventSection(startingEvent.id) : startingCategory === 'idle' ? 'idle' : startingCategory === 'deal' ? 'deal' : 'clips');

  const [saving, setSaving] = useState(false);
  const [dealerBusy, setDealerBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict,setConflict]=useState(false);
  const [selection, setSelection] = useState<{ eventId: string; situation: string } | null>(startingEvent ? { eventId: startingEvent.id, situation: situationsForEvent(startingEvent).includes(initialSituation ?? '') ? initialSituation ?? '' : situationsForEvent(startingEvent)[0] ?? '' } : null);
  const [variantId, setVariantId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [intakePending,setIntakePending] = useState(false);
  const projectRef = useRef(project); projectRef.current = project;
  const savingRef = useRef(false);
  const continueLock = useRef(false);
  const [continueHref, setContinueHref] = useState('');
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(startingView);
  const [category, setCategory] = useState(startingCategory);
  const [speechDraft, setSpeechDraft] = useState(false);
  const [generationStatus,setGenerationStatus]=useState({dirty:false,busy:false});
  const [generationDealerId,setGenerationDealerId]=useState(startingView==='generate'?dealerId:'');
  const [laneId, setLaneId] = useState(initialLaneId ?? '');
  const [operatorId, setOperatorId] = useState(initialOperatorId ?? '');
  const [tableId, setTableId] = useState(initialTableId ?? '');
  const [game, setGame] = useState(initialGame ?? '');
  const registeredIdleAccess=useRef({dealerId,blocked:saving||!connectedLane,busy:uploading||dealerBusy||intakePending});
  registeredIdleAccess.current={dealerId,blocked:saving||!connectedLane,busy:uploading||dealerBusy||intakePending};
  const dirty = JSON.stringify(project) !== saved;
  const navigationRef = useRef({ dealerId, blocked: false, busy: false, leavingBlocked: false, speechDraft: false, generationDraft: false, href: '' });
  navigationRef.current = { ...navigationRef.current, dealerId, blocked: intakePending || speechDraft || generationStatus.dirty, busy: saving || uploading || dealerBusy || generationStatus.busy, leavingBlocked: dirty || conflict || intakePending || speechDraft || generationStatus.dirty, speechDraft, generationDraft:generationStatus.dirty };
  useEffect(()=>{if(workspaceView==='generate')setGenerationDealerId(dealerId);},[workspaceView,dealerId]);
  const settingsRef=useRef<HTMLElement>(null);
  useEffect(() => {
    const select = (navigation?: Event) => {
      const location = workspaceLocation(window.location.hash);
      const query = new URLSearchParams(window.location.search);
      const requestedDealer = query.get('dealer') ?? query.get('dealerId');
      const selectedDealer = resolveStudioDealerId(projectRef.current, requestedDealer ?? undefined);
      setLaneId(query.get('composition') ?? query.get('lane') ?? '');
      setOperatorId(query.get('operator') ?? '');
      setTableId(query.get('table') ?? '');
      setGame(query.get('game') ?? '');
      setDealerId(selectedDealer);
      if (location.redirect) { window.location.replace(scopedHref(studioNavigationHref(location.redirect, { dealerId: selectedDealer || undefined, laneId: query.get('composition') ?? query.get('lane') ?? undefined, operatorId: query.get('operator') ?? undefined, tableId: query.get('table') ?? undefined, game: query.get('game') ?? undefined }), query)); return; }
      const requestedEvent = query.get('event');
      const requestedDefinition = projectRef.current.events.find(row => row.id === requestedEvent);
      const requestedSituation = query.get('situation') ?? '';
      const requestedTab = query.get('view');
      const useHash = navigation?.type === 'hashchange' || !validView(requestedTab);
      const nextView: WorkspaceView = useHash ? navigation?.type === 'hashchange' ? location.section === 'idle' ? 'idle' : 'clips' : requestedDefinition ? requestedDefinition.id === 'idle.ready' ? 'idle' : 'clips' : location.section === 'idle' ? 'idle' : 'clips' : requestedTab;
      const definition = requestedDefinition && (nextView === 'idle' ? requestedDefinition.id === 'idle.ready' : nextView === 'clips' && requestedDefinition.id !== 'idle.ready') ? requestedDefinition : undefined;
      const requestedCategory = query.get('category');
      const nextCategory = nextView === 'idle' ? 'idle' : definition ? dealerMediaSlots(projectRef.current).find(row => row.eventId === definition.id)?.category ?? 'all' : clipCategories.includes(requestedCategory ?? '') ? requestedCategory! : location.section === 'deal' ? 'deal' : 'all';
      setWorkspaceView(nextView); setCategory(nextCategory);
      if (definition && (nextView === 'clips' || nextView === 'idle')) {
        const situation = situationsForEvent(definition).includes(requestedSituation) ? requestedSituation : situationsForEvent(definition)[0] ?? '';
        setSelection({ eventId: definition.id, situation });
        setView(eventSection(definition.id));
      } else { setView(nextCategory === 'idle' ? 'idle' : nextCategory === 'deal' ? 'deal' : 'clips'); setSelection(null); }
      setVariantId(definition ? query.get('variant') ?? '' : '');
      navigationRef.current.href = window.location.href;
    };
    const history = studioHistory(window);
    const releaseGuard = history.guardTraversal(href => {
      const destination = new URL(href, window.location.href);
      const query = destination.searchParams;
      const selectedDealer = resolveStudioDealerId(projectRef.current, query.get('dealer') ?? query.get('dealerId') ?? undefined);
      // Pending work stays with its mounted dealer. Compensation must not run
      // select() or let Next publish the rejected query into child editors.
      const leaving = destination.pathname !== new URL(navigationRef.current.href || window.location.href).pathname;
      if (savingRef.current || navigationRef.current.busy || leaving && navigationRef.current.leavingBlocked || navigationRef.current.blocked && selectedDealer !== navigationRef.current.dealerId) {
        setNotice(navigationRef.current.generationDraft ? 'Spara eller ångra ditt utkast under Skapa material innan du byter dealer.' : navigationRef.current.speechDraft ? 'Använd talunderlaget i utkastet eller ångra ändringarna under Tal & automatik innan du byter dealer.' : 'Spara eller avsluta pågående arbete innan du lämnar redigeringen.');
        return false;
      }
      return true;
    });
    select();
    const unsubscribe = history.subscribe(event => {if (event) select(event);});
    return () => {unsubscribe(); releaseGuard();};
  }, []);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty || saving || speechDraft || uploading || dealerBusy || intakePending || generationStatus.dirty || generationStatus.busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, saving, speechDraft, uploading, dealerBusy, intakePending, generationStatus]);
  useEffect(() => {
    if (!continueHref) return;
    if (dirty || speechDraft || uploading || conflict || dealerBusy || intakePending || generationStatus.dirty || generationStatus.busy) { setContinueHref(''); continueLock.current = false; return; }
    if (saving) return;
    // The clean render has replaced the old beforeunload guard above.
    const href = continueHref;
    setContinueHref(''); continueLock.current = false;
    window.location.assign(href);
  }, [continueHref, dirty, speechDraft, saving, uploading, conflict, dealerBusy, intakePending, generationStatus]);
  useEffect(() => {
    publishShellStatus(<span className={dirty || speechDraft || generationStatus.dirty ? 'sg-pill sg-pill-ej-sparad' : 'sg-pill sg-pill-sparad'}>{dirty || speechDraft || generationStatus.dirty ? 'Ej sparad' : 'Sparad'}</span>);
    return () => publishShellStatus(null);
  }, [dirty, speechDraft,generationStatus.dirty]);
  function edit(change: (draft: StudioProject) => void) {
    setProject(current => { const draft = structuredClone(current); change(draft); return draft; }); setNotice('');
  }
  async function save() {
    if (savingRef.current || uploading || speechDraft) return false;
    savingRef.current = true; setSaving(true); setError('');
    const submitted = projectRef.current;
    try {
      const response = await requestJson<{ project: StudioProject }>('/api/project', { method: 'PUT', body: JSON.stringify({ project: submitted, expectedRevision: submitted.revision }) });
      setSaved(JSON.stringify(response.project));
      setProject(current => current === submitted ? response.project : { ...current, revision: response.project.revision });
      const unchanged = projectRef.current === submitted;
      setConflict(false); setNotice(unchanged ? 'Sparat.' : 'Sparat. Nyare ändringar finns kvar i utkastet.'); return unchanged;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Kunde inte spara.');setConflict((cause as {statusCode?:number})?.statusCode===409); return false; }
    finally { savingRef.current = false; setSaving(false); }
  }
  async function refresh() {
    setRefreshing(true); setError('');
    // Imported inventory keeps its historical source label. Cloud Studio must
    // reread the shared registry, never infer a local disk scan from that label.
    const rescan = !cloudStudio && videos.summary?.archiveSource === 'emil-default';
    try { setVideos(await requestJson<VideoInventory>(rescan ? '/api/videos/rescan' : '/api/videos', rescan ? { method: 'POST' } : undefined)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Kunde inte läsa klippen.'); }
    finally { setRefreshing(false); }
  }
  function writeSelection(id: string, eventId = '', situation = '', section?: DealerWorkspaceSection, nextView: WorkspaceView = workspaceView, nextCategory = category) {
    if (!window.location.href) return;
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('dealer', id); else url.searchParams.delete('dealer');
    url.searchParams.delete('dealerId');
    const composition = url.searchParams.get('composition') ?? url.searchParams.get('lane');
    if (composition) url.searchParams.set('composition', composition);
    url.searchParams.delete('lane');
    url.searchParams.set('view', nextView);
    if (nextCategory !== 'all') url.searchParams.set('category', nextCategory); else url.searchParams.delete('category');
    if (eventId) url.searchParams.set('event', eventId); else url.searchParams.delete('event');
    if (situation) url.searchParams.set('situation', situation); else url.searchParams.delete('situation');
    url.searchParams.delete('variant');
    url.hash = section ?? '';
    if (url.href !== window.location.href) studioHistory(window).push(url);
    navigationRef.current.href = url.href;
  }
  function navigateWorkspace(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (studioHistory(window).isRestoring()) {event.preventDefault(); return;}
    const destination = new URL(href, window.location.href);
    const nextView = destination.searchParams.get('view');
    if (destination.pathname.endsWith('/admin/dealer-studio') && validView(nextView)) {
      event.preventDefault();
      if (savingRef.current || uploading || dealerBusy || generationStatus.busy) return;
      if(nextView==='clips'&&destination.searchParams.get('event')) {open(destination.searchParams.get('event')!,destination.searchParams.get('situation')??'');return;}
      const nextCategory = nextView === 'idle' ? 'idle' : category === 'idle' ? 'all' : category;
      setWorkspaceView(nextView); setCategory(nextCategory); setSelection(null); setVariantId('');
      setView(nextCategory === 'idle' ? 'idle' : nextCategory === 'deal' ? 'deal' : 'clips');
      writeSelection(dealerId, '', '', undefined, nextView, nextCategory);
      return;
    }
    void continueTo(event, href);
  }
  async function continueTo(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (studioHistory(window).isRestoring()) {event.preventDefault(); return;}
    event.preventDefault();
    if (speechDraft) { showSpeechDraft(); return; }
    if (generationStatus.dirty) { showGenerationDraft(); return; }
    if (continueLock.current || savingRef.current || saving || uploading || conflict || dealerBusy || intakePending || generationStatus.busy) return;
    continueLock.current = true;
    if (!dirty || await save()) setContinueHref(href);
    else continueLock.current = false;
  }
  function contentLink(path: string) {
    return scopedHref(studioNavigationHref(path, { dealerId, eventId: selection?.eventId, variantId: variantId || undefined, situation: selection?.situation, laneId, operatorId, tableId, game }),
      new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search));
  }
  function open(eventId: string, situation: string) {
    if (studioHistory(window).isRestoring()) return;
    if (savingRef.current || uploading || dealerBusy || generationStatus.busy) return;
    const definition = project.events.find(row => row.id === eventId);
    if (!definition) return;
    const section = eventSection(eventId), nextView = section === 'idle' ? 'idle' : 'clips';
    const nextCategory = dealerMediaSlots(projectRef.current).find(row => row.eventId === definition.id)?.category ?? 'all';
    writeSelection(dealerId, eventId, situation, section, nextView, nextCategory);
    setVariantId(''); setSelection({eventId,situation}); setView(section);
    setWorkspaceView(nextView); setCategory(nextCategory);
  }
  function selectCategory(next: string) {
    if (studioHistory(window).isRestoring()) return;
    if (savingRef.current || uploading || dealerBusy || generationStatus.busy) return;
    const section = next === 'idle' ? 'idle' : next === 'deal' ? 'deal' : 'clips';
    setSelection(null); setView(section); setCategory(next);
    setWorkspaceView(next === 'idle' ? 'idle' : 'clips');
    writeSelection(dealerId, '', '', section, next === 'idle' ? 'idle' : 'clips', next);
  }
  function showSpeechDraft() {
    if (studioHistory(window).isRestoring()) return;
    setNotice('Använd talunderlaget i utkastet eller ångra ändringarna i talformuläret innan du byter dealer eller lämnar sidan.');
    setWorkspaceView('speech');writeSelection(dealerId,'','',undefined,'speech');
  }
  function selectDealer(id: DealerId) {
    if (studioHistory(window).isRestoring()) return;
    if (id && !isActiveDealerId(id)) return;
    if (speechDraft) { showSpeechDraft(); return; }
    if (generationStatus.dirty) { showGenerationDraft(); return; }
    if (savingRef.current || dealerBusy || intakePending || uploading || generationStatus.busy) return;
    setDealerId(id); setSelection(null); setVariantId(''); writeSelection(id, '', '', requestedView);
  }
  function showGenerationDraft() {
    if (studioHistory(window).isRestoring()) return;
    setNotice('Spara profilen eller ångra ditt materialutkast innan du byter dealer eller lämnar sidan.');
    setWorkspaceView('generate');writeSelection(dealerId,'','',undefined,'generate');
  }
  function updatePolicy(familyId: string, policy: MediaVariantPolicy) {
    edit(draft => {
      if (policy.frequencyPercent === undefined && !Object.values(policy.selection).some(Boolean)) {
        draft.mediaPolicy = (draft.mediaPolicy ?? []).map(row => row.familyId === familyId
          ? { ...row, variants: row.variants.filter(item => item.videoId !== policy.videoId) } : row);
      } else draft.mediaPolicy = upsertMediaVariantPolicy(draft.mediaPolicy, familyId, policy);
    });
  }
  function updateRegisteredIdle(policy: IdlePolicy) {
    if(savingRef.current||registeredIdleAccess.current.blocked||registeredIdleAccess.current.dealerId!==dealerId)return;
    edit(draft => {
      const line = draft.lines.find(row => row.dealerId === dealerId && row.eventId === 'idle.ready');
      const baseline = line?.variants.find(row => row.id === line.baselineVariantId);
      if (!baseline) return;
      draft.dealerIdlePolicies = [...(draft.dealerIdlePolicies ?? []).filter(row => row.dealerId !== dealerId), {dealerId,policy}];
      baseline.videoGenerationId = policy.base[0].videoId;
    });
  }
  function detachRegisteredIdle() {
    const access=registeredIdleAccess.current;
    if(savingRef.current||access.blocked||access.busy||access.dealerId!==dealerId)return;
    edit(draft=>{
      const line=draft.lines.find(row=>row.dealerId===dealerId&&row.eventId==='idle.ready');
      const baseline=line?.variants.find(row=>row.id===line.baselineVariantId);
      if(!baseline)return;
      draft.dealerIdlePolicies=(draft.dealerIdlePolicies??[]).filter(row=>row.dealerId!==dealerId);
      baseline.videoGenerationId=null;
    });
  }
  const definition = selection && project.events.find(event => event.id === selection.eventId);
  const event = definition && mediaExampleEvent(definition, selection!.situation);
  const familyWorkspace = supportsFamilyWorkspace(dealerId);
  const customDealer = !DEALER_IDS.includes(dealerId);
  const view = requestedView;
  const dealers = activeStudioDealers(project);
  const dealer = dealers.find(row => row.id === dealerId);
  const idleReferenceId = customDealer ? ownDealerIdle(project, videos, dealerId)?.id : dealerId === 'astrid' ? project.idlePolicy?.base[0]?.videoId : undefined;
  const speechSlot = customDealer && selection ? dealerMediaSlots(project,'speech').find(slot=>slot.eventId===selection.eventId&&slot.situation===selection.situation) : undefined;
  const currentSlot = selection ? selection.eventId + '/' + selection.situation : workspaceView === 'idle' ? 'idle.ready/' : '';
  const showClips = workspaceView === 'idle' || workspaceView === 'clips';
  const showEditor = view === 'idle' || Boolean(selection) || !customDealer && !familyWorkspace;
  const media = familyWorkspace && definition && event && mediaLineForEvent(project, videos, dealerId, definition.id, event, { includeManualVariants: true });
  const variant = media && (media.line.variants.find(item => item.id === variantId) ?? media.line.variants[0]);
  const video = definition && event && variant && mediaVideoForEvent(videos, dealerId, definition.id, event, variant.videoGenerationId);
  const saveButton = <button type="button" className="sg-btn sg-btn-secondary" disabled={!dirty || speechDraft || saving || uploading || !connectedLane} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara inställningar'}</button>;
  const clipSettings = dealer && showEditor ? <section ref={settingsRef} className={styles.clipSettings} aria-label="Klippval, varianter och villkor">
    <div className={styles.sectionHeader}><div><h2>{selection ? clipSituationLabel(selection.eventId,selection.situation) : view === 'idle' ? 'Grundloop och variationer' : 'Klippval för ' + dealer?.label}</h2><p className={styles.intro}>Välj klipp, varianter och hur de används. Spara inställningarna efter ditt val.</p></div></div>
    {!speechSlot && (selection || view === 'idle') ? <nav className={styles.contentNav} aria-label="Fackets inställningar">{[['variants','Standard och varianter'],['triggers','Användning och villkor']].map(([tab,label])=>{const href=contentLink(studioHref('/admin/events',{dealerId,eventId:selection?.eventId??'idle.ready',situation:selection?.situation,variantId:variantId||undefined,tab}));return <a key={tab} href={href} onClick={event=>void continueTo(event,href)}>{label}</a>;})}</nav> : null}
    {view==='idle'&&familyWorkspace?<section><div className={styles.sectionHeader}><span/><button type="button" className="text-button" disabled={refreshing} onClick={()=>void refresh()}>{refreshing?'Läser…':'Uppdatera klipplistan'}</button></div><fieldset disabled={saving||!connectedLane} className={styles.fields}><IdlePolicyEditor policy={project.idlePolicy??createDefaultIdlePolicy()} inventory={videos} blocked={saving} clipLabels={project.clipLabels} onChange={policy=>edit(draft=>{draft.idlePolicy=policy;})} onBusyChange={()=>{}} onImportBusyChange={setUploading}/></fieldset></section>:null}
    {(view==='deal'||view==='clips')&&familyWorkspace&&media&&variant?<fieldset disabled={saving||!connectedLane} className={styles.editor}><div>{video?<DealerClipPreview key={video.id} url={video.previewUrl} framing={video.classification?.framing} compositing={video.classification?.compositing}/>:<p>Ingen tillgänglig film för detta fack.</p>}</div><MediaFamilyEditor inventory={videos} family={media.family} project={project} variants={media.line.variants} selectedId={variant.id} onSelect={setVariantId} onPolicy={updatePolicy} onRefresh={()=>void refresh()} refreshing={refreshing}/></fieldset>:null}
    {!familyWorkspace&&!customDealer?<fieldset className={styles.fields} disabled={saving||!connectedLane}><LegacyClipEditor project={project} dealerId={dealerId} section={view} onChange={policy=>edit(draft=>{draft.legacyClipPolicy=policy;})}/></fieldset>:null}
    {speechSlot?<DealerSpeechSlotEditor key={dealerId+'/'+speechSlot.id} project={project} inventory={videos} dealerId={dealerId} slot={speechSlot} blocked={saving||uploading||!connectedLane} onChange={videoId=>edit(draft=>{draft.lines=bindSpeechSlotStandard(draft,{dealerId,eventId:speechSlot.eventId,situation:speechSlot.situation,videoId}).lines;})}/>:null}
    {customDealer&&view==='idle'?<RegisteredIdleEditor key={dealerId} project={project} inventory={videos} dealerId={dealerId} blocked={saving||!connectedLane} onChange={updateRegisteredIdle} onDetach={detachRegisteredIdle} onBusyChange={setUploading} onInventory={setVideos}/>:null}
    {view==='clips'&&familyWorkspace&&category==='speech'?<section className={styles.help}><h3>Inspelade tal-klipp</h3><LegacyClipEditor project={project} dealerId={dealerId} section="clips" onChange={policy=>edit(draft=>{draft.legacyClipPolicy=policy;})}/></section>:null}
    {saveButton}
  </section> : null;
  const reviewHref=contentLink('/control/administration?tab=media-review');
  return <div className={styles.shell}>
    <PageTemplate eyebrow="// STUDIO" title="Dealers & klipp" primary={saveButton}>
    <main className={styles.main}><fieldset className={styles.fields} disabled={dealerBusy} onClickCapture={event=>{if(dealerBusy){event.preventDefault();event.stopPropagation();}}}>
      <div className={styles.dealerHeader}><div><p className={styles.eyebrow}>DEALERBIBLIOTEK · {dealers.length} DEALERS</p><h2>{dealer?.label ?? 'Välj dealer'}</h2><p className={styles.intro}>Grundloop, klipp och talinställningar för vald dealer.</p></div><button type="button" className="sg-btn sg-btn-secondary" disabled={saving||uploading||dealerBusy||generationStatus.busy} aria-controls="dealer-settings" onClick={()=>{if(savingRef.current||saving||uploading||dealerBusy||generationStatus.busy)return;setWorkspaceView('settings');setSelection(null);setVariantId('');writeSelection(dealerId,'','',undefined,'settings');}}>Hantera dealers <span className={styles.archiveCount}>{project.dealerTrash?.length??0} arkiverade</span></button></div>
      <div className="sg-chip-row" role="group" aria-label="Välj dealer">{dealers.map(dealer => <button type="button" className="sg-chip" disabled={intakePending||uploading||generationStatus.busy} aria-pressed={dealerId === dealer.id} key={dealer.id} onClick={() => selectDealer(dealer.id)}>{dealer.label.slice(0, 1)} {dealer.label}</button>)}</div>
      {dealer ? <StudioNavigation dealerId={dealerId} laneId={laneId} operatorId={operatorId} tableId={tableId} game={game} dealerLabel={dealer?.label} active={workspaceView} eventId={selection?.eventId} variantId={variantId||undefined} situation={selection?.situation} onNavigate={navigateWorkspace} crumbs={selection&&selection.eventId!=='idle.ready'?[{label:clipSituationLabel(selection.eventId,selection.situation)}]:[]} /> : null}
      {!connectedLane ? <p role="alert" className="feedback error">Spelanslutningen är inte tillgänglig. Inställningarna är skrivskyddade tills anslutningen har återställts.</p> : null}
      {error ? <p role="alert" className="feedback error">{error}</p> : null}
      {speechDraft?<p role="status" className="feedback">Talformuläret har ändringar som inte lagts till i projektutkastet. Flikarna kan bytas. Innan du byter dealer eller lämnar sidan: använd talunderlaget eller ångra ändringarna under Tal &amp; automatik.</p>:null}
      {notice ? <p role="status" className="feedback success">{notice}</p> : null}
      {generationStatus.dirty&&workspaceView!=='generate'?<p role="status" className="feedback">Ditt materialutkast finns kvar under Skapa material.</p>:null}
      {conflict?<ProjectConflict base={JSON.parse(saved)} draft={project} onResolve={(remote,merged)=>{setSaved(JSON.stringify(remote));setProject(merged);setConflict(false);setError('');setNotice('Utkastet är sammanslaget. Granska dina val och spara.');}}/>:null}
      {/* Keep the library mounted across tabs: queued uploads belong to this dealer. */}
      {dealer ? <div id="dealer-media" hidden={!showClips}>
        {workspaceView==='idle'?<p className={styles.intro}>Grundloopen spelas mellan händelser. Välj basklipp och variationer här; scenens storlek och placering finns under Sammansättningar i Studio-menyn.</p>:null}
        {category==='speech'?<div className={styles.sectionHeader}><p className={styles.intro}>Tal-klipp och ljud för {dealer?.label}. Varje replik har egna filer, varianter och villkor.</p><a className="sg-btn sg-btn-secondary" href={reviewHref} onClick={event=>void continueTo(event,reviewHref)}>Talgranskning för {dealer?.label}</a></div>:null}
        <DealerMediaLibrary key={dealerId} project={project} inventory={videos} dealerId={dealerId} onProjectSaved={next=>{setSaved(JSON.stringify(next));setProject(next);}} onLifecycleChange={setDealerBusy} onInventory={setVideos} onPendingChange={setIntakePending} removalDisabledReason={dirty?'Spara dina ändringar innan du ändrar papperskorgen.':''} initialSlotId={initialEventId?initialEventId+'/'+(initialSituation??''):''} category={category} slotId={currentSlot} categoryIds={workspaceView==='idle'?[]:clipCategories} onSlotChange={slotId=>{const slot=dealerMediaSlots(project).find(row=>row.id===slotId);if(slot)open(slot.eventId,slot.situation);else{setSelection(null);writeSelection(dealerId,'','',requestedView);}}} onConfigureSlot={open} onCategoryChange={selectCategory} slotEditor={clipSettings} disabled={saving || !connectedLane} />
      </div> : null}
      {dealer ? <section hidden={workspaceView!=='speech'} className={styles.panel} aria-label="Tal och automatik">
        <h2>Tal &amp; automatik · {dealer?.label}</h2><p>Inspelade tal-klipp hör till spelets händelser. AI-tal skapar en ny replik med dealerns röst och talunderlag.</p>
        <div className={styles.customGrid}><article><h3>Inspelade klipp</h3><p>Välj repliker och varianter under Klipp. Grundloopens variationer har egna intervall och val mellan automatik och OpenClaw.</p><button type="button" className="sg-btn sg-btn-secondary" onClick={()=>selectCategory('speech')}>Tal-klipp &amp; ljud</button></article><article><h3>AI-småprat vid inaktivitet</h3><p>{dealerId==='astrid'?'Styr när Astrid får formulera nya repliker vid ett lugnt bord.':'Automatiskt AI-småprat vid inaktivitet stöds för närvarande endast av Astrid. En egen talprofil kan förberedas nedan för chattsvar.'}</p>{dealerId==='astrid'?<a href={contentLink('/admin/probe')} onClick={event=>void continueTo(event,contentLink('/admin/probe'))}>Inställningar för AI-småprat</a>:null}</article></div>
        {dealer?<DealerSpeechSettings key={dealer.id} dealer={dealer} inventory={videos} idleReferenceId={idleReferenceId} onDraftChange={setSpeechDraft} expanded disabled={!connectedLane||saving||uploading||intakePending} onEdit={change=>setProject(current=>change(current))}/>:null}
        {saveButton}
      </section> : null}
      {dealer&&generationDealerId===dealerId?<div hidden={workspaceView!=='generate'}><DealerMaterialCreator key={dealerId} dealerId={dealerId} active={workspaceView==='generate'} disabled={!connectedLane||dirty||saving} onPendingChange={setGenerationStatus} navigationContext={{laneId,operatorId,tableId,game}} onNavigate={navigateWorkspace}/></div>:null}
      {!dealer && workspaceView !== 'settings' ? <section className={styles.panel} aria-label="Välj dealer"><h2>Välj en dealer för att börja</h2><p>Välj en dealer i listan ovan för att redigera grundloop, klipp och tal. Ingen dealer väljs automatiskt.</p><p>Under Hantera dealers kan du lägga till en ny dealer eller återställa en arkiverad.</p></section> : null}
      <section id="dealer-settings" hidden={workspaceView!=='settings'} className={styles.panel} aria-label="Dealerinställningar">
        <h2>{dealer ? 'Inställningar · '+dealer.label : 'Hantera dealers'}</h2><p>Arkivera en egen dealer för att ta bort den från den aktiva listan. Klipp och inställningar finns kvar för återställning. Du kan också lägga till en ny dealer här.</p>
        <DealerRemoval project={project} inventory={videos} dealerId={dealerId} laneId={laneId} operatorId={operatorId} tableId={tableId} onNavigate={navigateWorkspace} disabled={dirty||speechDraft||saving||uploading||conflict||intakePending||generationStatus.dirty||generationStatus.busy||!connectedLane} disabledReason={generationStatus.dirty?'Spara eller ångra ditt utkast under Skapa material först.':speechDraft?'Använd eller ångra talformulärets ändringar under Tal & automatik först.':dirty?'Spara dina ändringar innan du arkiverar eller återställer en dealer.':''} onPendingChange={setDealerBusy} onInventory={setVideos} onProjectSaved={next=>{setSaved(JSON.stringify(next));setProject(next);}} onApplied={(next,inventory,selectedId)=>{setSaved(JSON.stringify(next));setProject(next);setVideos(inventory);selectDealer(selectedId);setNotice('Dealerlistan och arkivet är uppdaterade. Ändringen är sparad.');}}/>
        <DealerRegistration expanded showSpeechSettings={false} project={project} dealerId={dealerId} inventory={videos} disabled={!connectedLane||saving||uploading||intakePending||speechDraft||generationStatus.dirty||generationStatus.busy} onEdit={change=>setProject(current=>change(current))} onAdded={id=>{selectDealer(id);setNotice('Dealern finns i utkastet. Spara och lägg sedan in egna klipp.');}}/>
        {saveButton}
      </section>
      {dealer ? <nav className={styles.contentNav} aria-label="Fortsätt med dealern"><a href={contentLink('/admin/rehearsal')} onClick={event=>void continueTo(event,contentLink('/admin/rehearsal'))}>Provspelning &amp; logg</a></nav> : null}
    </fieldset></main>
    </PageTemplate>
  </div>;
}
