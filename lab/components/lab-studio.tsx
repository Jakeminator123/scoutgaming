'use client';
import { labBasePath } from "../lib/lab-url.mjs";
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { IdlePolicyEditor } from './idle-policy-editor';
import {RegisteredIdleEditor} from './registered-idle-editor';
import { LegacyClipEditor } from './legacy-clip-editor';
import { MediaFamilyEditor } from './media-family-editor';
import { clipSituationLabel } from '../lib/clip-label.mjs';
import { upsertMediaVariantPolicy, mediaExampleEvent, mediaLineForEvent, mediaVideoForEvent } from '../lib/media-family-policy.mjs';
import { situationsForEvent } from '../lib/video-intake.mjs';
import { createDefaultIdlePolicy, type IdlePolicy } from '../lib/idle-policy.mjs';
import {DEALER_IDS, type DealerId, type MediaVariantPolicy, type StudioProject} from '../lib/studio-model.mjs';
import { DEALER_WORKSPACE_SECTIONS, workspaceLocation, supportsFamilyWorkspace, type DealerWorkspaceSection } from '../lib/dealer-workspace.mjs';
import { requestJson, studioHref, type VideoInventory } from './studio-types';
import { PageTemplate, publishShellStatus } from './page-template.mjs';
import styles from './lab-studio.module.css';
import {ProjectConflict} from './project-conflict';
import {DealerRegistration} from './dealer-registration';
import {DealerMediaLibrary} from './dealer-media-library';
import {DealerRemoval} from './dealer-removal';

export function LabStudio({ initialProject, initialVideos, connectedLane, initialDealerId, initialEventId, initialSituation }: { initialProject: StudioProject; initialVideos: VideoInventory; connectedLane: boolean; initialDealerId?: string; initialEventId?: string; initialSituation?: string }) {
  const cloudStudio = labBasePath() === '/studio';
  const [project, setProject] = useState(initialProject);
  const [saved, setSaved] = useState(JSON.stringify(initialProject));
  const [videos, setVideos] = useState(initialVideos);
  const [dealerId, setDealerId] = useState<DealerId>(initialProject.dealers.some(row => row.id === initialDealerId) ? initialDealerId! : initialProject.dealers[0]?.id ?? 'astrid');
  const [requestedView, setView] = useState<DealerWorkspaceSection>(initialEventId ? /^(deal|reveal)\./.test(initialEventId) ? 'deal' : initialEventId === 'idle.ready' ? 'idle' : 'clips' : 'idle');
  const [, setUploadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dealerBusy, setDealerBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict,setConflict]=useState(false);
  const [selection, setSelection] = useState<{ eventId: string; situation: string } | null>(initialEventId && initialProject.events.some(row => row.id === initialEventId) ? { eventId: initialEventId, situation: initialSituation ?? '' } : null);
  const [variantId, setVariantId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [intakePending,setIntakePending] = useState(false);
  const projectRef = useRef(project); projectRef.current = project;
  const savingRef = useRef(false);
  const continueLock = useRef(false);
  const [continueHref, setContinueHref] = useState('');
  const [settingsOpen,setSettingsOpen]=useState(Boolean(initialEventId));
  const settingsRef=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{if(settingsOpen)settingsRef.current?.scrollIntoView({behavior:'smooth',block:'start'});},[settingsOpen,selection?.eventId,selection?.situation]);
  const dirty = JSON.stringify(project) !== saved;
  useEffect(() => {
    const select = () => {
      const location = workspaceLocation(window.location.hash);
      const query = new URLSearchParams(window.location.search);
      const requestedDealer = query.get('dealer') ?? query.get('dealerId');
      if (projectRef.current.dealers.some(row => row.id === requestedDealer)) setDealerId(requestedDealer!);
      if (location.redirect) { window.location.replace(studioHref(location.redirect, { dealerId: requestedDealer ?? undefined })); return; }
      const requestedEvent = query.get('event');
      const definition = initialProject.events.find(row => row.id === requestedEvent);
      const requestedSituation = query.get('situation') ?? '';
      if (definition) {
        const situation = situationsForEvent(definition).includes(requestedSituation) ? requestedSituation : situationsForEvent(definition)[0] ?? '';
        setSelection({ eventId: definition.id, situation });
        setView(/^(deal|reveal)\./.test(definition.id) ? 'deal' : definition.id === 'idle.ready' ? 'idle' : 'clips');
      } else { setView(location.section); setSelection(null); }
      if (location.upload) setUploadOpen(true);
    };
    select(); window.addEventListener('hashchange', select); window.addEventListener('popstate', select);
    return () => { window.removeEventListener('hashchange', select); window.removeEventListener('popstate', select); };
  }, []);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty || uploading || dealerBusy || intakePending) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, uploading, dealerBusy, intakePending]);
  useEffect(() => {
    if (!continueHref) return;
    if (dirty || uploading || conflict || dealerBusy || intakePending) { setContinueHref(''); continueLock.current = false; return; }
    if (saving) return;
    // The clean render has replaced the old beforeunload guard above.
    const href = continueHref;
    setContinueHref(''); continueLock.current = false;
    window.location.assign(href);
  }, [continueHref, dirty, saving, uploading, conflict, dealerBusy, intakePending]);
  useEffect(() => {
    publishShellStatus(<span className={dirty ? 'sg-pill sg-pill-ej-sparad' : 'sg-pill sg-pill-sparad'}>{dirty ? 'Ej sparad' : 'Sparad'}</span>);
    return () => publishShellStatus(null);
  }, [dirty]);
  function edit(change: (draft: StudioProject) => void) {
    setProject(current => { const draft = structuredClone(current); change(draft); return draft; }); setNotice('');
  }
  async function save() {
    if (savingRef.current || uploading) return false;
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
  function writeSelection(id: string, eventId = '', situation = '', section?: DealerWorkspaceSection) {
    if (!window.location.href) return;
    const url = new URL(window.location.href);
    url.searchParams.set('dealer', id); url.searchParams.delete('dealerId');
    if (eventId) url.searchParams.set('event', eventId); else url.searchParams.delete('event');
    if (situation) url.searchParams.set('situation', situation); else url.searchParams.delete('situation');
    if (section) url.hash = section;
    window.history.replaceState(null, '', url);
  }
  async function continueTo(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    if (continueLock.current || savingRef.current || saving || uploading || conflict || dealerBusy || intakePending) return;
    continueLock.current = true;
    if (!dirty || await save()) setContinueHref(href);
    else continueLock.current = false;
  }
  function contentLink(path: string) {
    return studioHref(path, { dealerId, eventId: selection?.eventId, situation: selection?.situation });
  }
  function open(eventId: string, situation: string) {
    writeSelection(dealerId, eventId, situation, eventId === 'idle.ready' ? 'idle' : /^(deal|reveal)\./.test(eventId) ? 'deal' : 'clips');
    setVariantId('');
    setSelection({eventId,situation});setSettingsOpen(true);
    setView(eventId==='idle.ready'?'idle':/^(deal|reveal)\./.test(eventId)?'deal':'clips');
  }
  function selectView(next: DealerWorkspaceSection) {
    setSelection(null); setView(next);
    writeSelection(dealerId, '', '', next);
  }
  function selectDealer(id: DealerId) {
    setDealerId(id); setSettingsOpen(false); setSelection(null); setVariantId(''); writeSelection(id, '', '', requestedView);
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
    edit(draft => {
      const line = draft.lines.find(row => row.dealerId === dealerId && row.eventId === 'idle.ready');
      const baseline = line?.variants.find(row => row.id === line.baselineVariantId);
      if (!baseline) return;
      draft.dealerIdlePolicies = [...(draft.dealerIdlePolicies ?? []).filter(row => row.dealerId !== dealerId), {dealerId,policy}];
      baseline.videoGenerationId = policy.base[0].videoId;
    });
  }
  const definition = selection && project.events.find(event => event.id === selection.eventId);
  const event = definition && mediaExampleEvent(definition, selection!.situation);
  const familyWorkspace = supportsFamilyWorkspace(dealerId);
  const customDealer = !DEALER_IDS.includes(dealerId);
  const sections = DEALER_WORKSPACE_SECTIONS;
  const view = sections.some(section => section.id === requestedView) ? requestedView : 'idle';
  const media = familyWorkspace && definition && event && mediaLineForEvent(project, videos, dealerId, definition.id, event, { includeManualVariants: true });
  const variant = media && (media.line.variants.find(item => item.id === variantId) ?? media.line.variants[0]);
  const video = definition && event && variant && mediaVideoForEvent(videos, dealerId, definition.id, event, variant.videoGenerationId);
  const saveButton = <button type="button" className="sg-btn sg-btn-secondary" disabled={!dirty || saving || uploading || !connectedLane} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara inställningar'}</button>;
  return <div className={styles.shell}>
    <PageTemplate
      eyebrow="// STUDIO"
      title="Dealers & klipp"
      primary={<button type="button" className="sg-btn sg-btn-primary" onClick={()=>document.getElementById('dealer-media')?.scrollIntoView({behavior:'smooth'})}>Lägg in media</button>}
    >
    <main className={styles.main}><fieldset className={styles.fields} disabled={dealerBusy} onClickCapture={event=>{if(dealerBusy){event.preventDefault();event.stopPropagation();}}}>
      <h2>Dealerbibliotek · {project.dealers.length} dealers</h2>
      <p>Välj en dealer och lägg in media i rätt kategori. Du kan ladda upp flera filer samtidigt och välja exakt fack för varje fil.</p>
      <p>1. Lägg in media → 2. Öppna facket för klippval, varianter och villkor → 3. Sammansätt och publicera.</p>
      <details><summary>Hantera dealers · lägg till eller ta bort</summary>
      <DealerRegistration project={project} dealerId={dealerId} inventory={videos} disabled={!connectedLane||saving||uploading||intakePending} onEdit={change=>setProject(current=>change(current))} onAdded={id=>{selectDealer(id);setNotice('Dealern finns i utkastet. Spara och lägg sedan in egna klipp.');}}/>
      <DealerRemoval project={project} inventory={videos} dealerId={dealerId} disabled={dirty||saving||uploading||conflict||intakePending||!connectedLane} disabledReason={dirty?'Spara dina ändringar innan du flyttar eller återställer en dealer.':''} onPendingChange={setDealerBusy} onInventory={setVideos} onProjectSaved={next=>{setSaved(JSON.stringify(next));setProject(next);}} onApplied={(next,inventory,selectedId)=>{setSaved(JSON.stringify(next));setProject(next);setVideos(inventory);selectDealer(selectedId);setNotice('Papperskorgen är uppdaterad. Ändringen är sparad.');}}/>
      </details>
      <div className="sg-chip-row" role="group" aria-label="Välj dealer">{project.dealers.map(dealer => <button type="button" className="sg-chip" disabled={intakePending||uploading} aria-pressed={dealerId === dealer.id} key={dealer.id} onClick={() => selectDealer(dealer.id)}>{dealer.label.slice(0, 1)} {dealer.label}</button>)}</div>
      <div className={styles.save}>{saveButton}</div>
      <div id="dealer-media"><DealerMediaLibrary key={dealerId} project={project} inventory={videos} dealerId={dealerId} onProjectSaved={next=>{setSaved(JSON.stringify(next));setProject(next);}} onLifecycleChange={setDealerBusy} onInventory={setVideos} onPendingChange={setIntakePending} removalDisabledReason={dirty?'Spara dina ändringar innan du ändrar papperskorgen.':''} initialSlotId={initialEventId?initialEventId+'/'+(initialSituation??''):''} onConfigureSlot={open} onCategoryChange={category=>{setSettingsOpen(false);selectView(category==='idle'?'idle':category==='deal'?'deal':'clips');}} disabled={saving || !connectedLane} /></div>
      {!connectedLane ? <p role="alert" className="feedback error">Spelanslutningen är inte tillgänglig. Inställningarna är skrivskyddade tills anslutningen har återställts.</p> : null}
      {error ? <p role="alert" className="feedback error">{error}</p> : null}
      {notice ? <p role="status" className="feedback success">{notice}</p> : null}
      {conflict?<ProjectConflict base={JSON.parse(saved)} draft={project} onResolve={(remote,merged)=>{setSaved(JSON.stringify(remote));setProject(merged);setConflict(false);setError('');setNotice('Utkastet är sammanslaget. Granska dina val och spara.');}}/>:null}
      <details ref={settingsRef} style={{scrollMarginTop:120}} open={settingsOpen} onToggle={event=>setSettingsOpen(event.currentTarget.open)}>
        <summary>Klippval, varianter &amp; villkor · {selection?clipSituationLabel(selection.eventId,selection.situation):view==='idle'?'Grundloop':'välj ett fack ovan'}</summary>
        <p>Filerna ligger i biblioteket. Här väljer du standard, varianter och när de får användas. Spara inställningarna efter ditt val.</p>
        <nav className={styles.contentNav} aria-label="Fackets inställningar">{[['variants','Standard och varianter'],['triggers','Villkor']].map(([tab,label])=>{const href=studioHref('/control/events',{dealerId,eventId:selection?.eventId??'idle.ready',situation:selection?.situation,tab});return <a key={tab} href={href} onClick={event=>void continueTo(event,href)}>{label} →</a>;})}</nav>
        {view==='idle'&&familyWorkspace?<section><div className={styles.sectionHeader}><span/><button className="text-button" disabled={refreshing} onClick={()=>void refresh()}>{refreshing?'Läser…':'Uppdatera klipplistan'}</button></div><fieldset disabled={saving||!connectedLane} className={styles.fields}><IdlePolicyEditor policy={project.idlePolicy??createDefaultIdlePolicy()} inventory={videos} blocked={saving} clipLabels={project.clipLabels} onChange={policy=>edit(draft=>{draft.idlePolicy=policy;})} onBusyChange={()=>{}} onImportBusyChange={setUploading}/></fieldset></section>:null}
        {(view==='deal'||view==='clips')&&familyWorkspace&&media&&variant?<fieldset disabled={saving||!connectedLane} className={styles.editor}><div>{video?<video key={video.id} className={styles.preview} src={video.previewUrl} controls playsInline preload="none"/>:<p>Ingen tillgänglig film för detta fack.</p>}</div><MediaFamilyEditor inventory={videos} family={media.family} project={project} variants={media.line.variants} selectedId={variant.id} onSelect={setVariantId} onPolicy={updatePolicy} onRefresh={()=>void refresh()} refreshing={refreshing}/></fieldset>:null}
        {!familyWorkspace&&!customDealer?<fieldset className={styles.fields} disabled={saving||!connectedLane}><LegacyClipEditor project={project} dealerId={dealerId} section={view} onChange={policy=>edit(draft=>{draft.legacyClipPolicy=policy;})}/></fieldset>:null}
        {customDealer&&view==='idle'?<RegisteredIdleEditor key={dealerId} project={project} inventory={videos} dealerId={dealerId} blocked={saving||!connectedLane} onChange={updateRegisteredIdle} onBusyChange={setUploading}/>:null}
        {view==='clips'&&familyWorkspace?<details className={styles.help}><summary>Förinspelade exakta talpar</summary><LegacyClipEditor project={project} dealerId={dealerId} section="clips" onChange={policy=>edit(draft=>{draft.legacyClipPolicy=policy;})}/></details>:null}
        {saveButton}
      </details>
      <section className={styles.help} aria-label="När spelas klippen?"><h2>När spelas klippen?</h2><p>Grundloopen går mellan händelser. Deal och inspelade repliker startar från spelets händelser. I fackets inställningar väljer du klipp, varianter och villkor.</p><p>I klippets fack väljer du standard, variationer och villkor. Grundloopens variationer kan följa automatik eller OpenClaw. Spelaren visar vilket klippläge som används.</p><p><strong>AI-småprat vid inaktivitet</strong> låter AI formulera nya repliker när bordet är lugnt. Det är separat från inspelade tal-klipp och stöds för närvarande av Astrid.</p>
      <nav className={styles.contentNav} aria-label="Innehållsverktyg">{[['/control/preview','Sammansättning'],['/control/probe','AI-småprat vid inaktivitet'],['/control/activity','Uppspelning och logg']].map(([path,label])=>{const href=contentLink(path);return <a key={path} href={href} onClick={event=>void continueTo(event,href)}>{label} →</a>;})}</nav></section>
    </fieldset></main>
    </PageTemplate>
  </div>;
}
