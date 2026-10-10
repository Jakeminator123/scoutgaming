'use client';
import { labBasePath, labUrl } from "../lib/lab-url.mjs";
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { IdlePolicyEditor } from './idle-policy-editor';
import {RegisteredIdleEditor} from './registered-idle-editor';
import { FamilyVideoLibrary } from './family-video-library';
import { LegacyClipEditor } from './legacy-clip-editor';
import { FamilyVideoUpload } from './family-video-upload';
import { MediaFamilyEditor } from './media-family-editor';
import { applyClipLabel, clipLabel, clipSituationLabel } from '../lib/clip-label.mjs';
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
import {DealerRemoval} from './dealer-removal';

export function LabStudio({ initialProject, initialVideos, connectedLane, initialDealerId, initialEventId, initialSituation }: { initialProject: StudioProject; initialVideos: VideoInventory; connectedLane: boolean; initialDealerId?: string; initialEventId?: string; initialSituation?: string }) {
  const cloudStudio = labBasePath() === '/studio';
  const [project, setProject] = useState(initialProject);
  const [saved, setSaved] = useState(JSON.stringify(initialProject));
  const [videos, setVideos] = useState(initialVideos);
  const [dealerId, setDealerId] = useState<DealerId>(initialProject.dealers.some(row => row.id === initialDealerId) ? initialDealerId! : initialProject.dealers[0]?.id ?? 'astrid');
  const [requestedView, setView] = useState<DealerWorkspaceSection>(initialEventId ? /^(deal|reveal)\./.test(initialEventId) ? 'deal' : initialEventId === 'idle.ready' ? 'idle' : 'clips' : 'idle');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict,setConflict]=useState(false);
  const [selection, setSelection] = useState<{ eventId: string; situation: string } | null>(initialEventId && initialProject.events.some(row => row.id === initialEventId) ? { eventId: initialEventId, situation: initialSituation ?? '' } : null);
  const [variantId, setVariantId] = useState('');
  const [uploading, setUploading] = useState(false);
  const projectRef = useRef(project); projectRef.current = project;
  const savingRef = useRef(false);
  const continueLock = useRef(false);
  const [continueHref, setContinueHref] = useState('');
  const dirty = JSON.stringify(project) !== saved;
  useEffect(() => {
    const select = () => {
      const location = workspaceLocation(window.location.hash);
      const query = new URLSearchParams(window.location.search);
      const requestedDealer = query.get('dealer') ?? query.get('dealerId');
      if (initialProject.dealers.some(row => row.id === requestedDealer)) setDealerId(requestedDealer!);
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
    const guard = (event: BeforeUnloadEvent) => { if (dirty || uploading) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, uploading]);
  useEffect(() => {
    if (!continueHref) return;
    if (dirty || uploading || conflict) { setContinueHref(''); continueLock.current = false; return; }
    if (saving) return;
    // The clean render has replaced the old beforeunload guard above.
    const href = continueHref;
    setContinueHref(''); continueLock.current = false;
    window.location.assign(href);
  }, [continueHref, dirty, saving, uploading, conflict]);
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
    if (continueLock.current || savingRef.current || saving || uploading || conflict) return;
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
    if (eventId === 'idle.ready') setView('idle');
    else { setSelection({ eventId, situation }); setView(/^(deal|reveal)\./.test(eventId) ? 'deal' : 'clips'); }
  }
  function selectView(next: DealerWorkspaceSection) {
    setSelection(null); setView(next);
    writeSelection(dealerId, '', '', next);
  }
  function selectDealer(id: DealerId) {
    setDealerId(id); setSelection(null); setVariantId(''); writeSelection(id, '', '', requestedView);
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
  const dealerLabel = project.dealers.find(row => row.id === dealerId)?.label ?? dealerId;
  const familyInventory = { ...videos, families: videos.families?.filter(row => row.dealerId === dealerId) };
  const media = familyWorkspace && definition && event && mediaLineForEvent(project, videos, dealerId, definition.id, event, { includeManualVariants: true });
  const variant = media && (media.line.variants.find(item => item.id === variantId) ?? media.line.variants[0]);
  const video = definition && event && variant && mediaVideoForEvent(videos, dealerId, definition.id, event, variant.videoGenerationId);
  const uploadAvailable = familyWorkspace && ['idle', 'deal', 'clips'].includes(view);
  const customEntries = project.events.filter(row => view === 'deal' ? ['deal', 'reveal'].includes(row.sourceType) : view === 'idle' ? row.sourceType === 'idle' : row.sourceType === 'speak')
    .flatMap(row => (situationsForEvent(row).length ? situationsForEvent(row) : ['']).map(situation => ({ event: row, situation })));
  function customCard(definition: StudioProject['events'][number], situation: string, player = false) {
    const href = studioHref('/control/videos', { dealerId, eventId: definition.id, situation });
    return <article key={`${definition.id}/${situation}`}><h3>{player ? 'Kort till spelaren' : clipSituationLabel(definition.id, situation)}</h3><a href={href} onClick={event => void continueTo(event, href)}>Klipp och uppladdning →</a></article>;
  }
  const saveButton = <button type="button" className="sg-btn sg-btn-secondary" disabled={!dirty || saving || uploading || !connectedLane} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara inställningar'}</button>;
  return <div className={styles.shell}>
    <PageTemplate
      eyebrow="// STUDIO"
      title="Dealers & klipp"
      primary={uploadAvailable
        ? <button type="button" className="sg-btn sg-btn-primary" disabled={uploading} onClick={() => setUploadOpen(current => !current)} aria-expanded={uploadOpen}>Ladda upp klipp</button>
        : <button type="button" className="sg-btn sg-btn-primary" disabled={!dirty || saving || uploading || !connectedLane} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara inställningar'}</button>}
    >
    <main className={styles.main}>
      <h2>Dealerbibliotek · {project.dealers.length} dealers</h2>
      <p>Här redigerar du dealerns grundloop och händelseklipp. Biblioteket visar alla sparade dealers. Spelaren ser bara de dealers som ingår i ett publicerat spelrum.</p>
      <p>Välj dealer → sätt ihop dealer, bord och bakgrund → publicera till ett bolag → öppna rummets spellobby.</p>
      <DealerRegistration project={project} disabled={!connectedLane||saving||uploading} onEdit={change=>setProject(current=>change(current))} onAdded={id=>{selectDealer(id);setNotice('Dealern finns i utkastet. Spara och lägg sedan in egna klipp.');}}/>
      <DealerRemoval key={dealerId} project={project} dealerId={dealerId} disabled={saving||uploading||conflict||!connectedLane} onEdit={change=>setProject(current=>change(current))} onRemoved={(_id,nextDealerId)=>{selectDealer(nextDealerId);setNotice('Dealern är borttagen från utkastet. Spara för att behålla ändringen.');}}/>
      <div className="sg-chip-row" role="group" aria-label="Välj dealer">{project.dealers.map(dealer => <button type="button" className="sg-chip" aria-pressed={dealerId === dealer.id} key={dealer.id} onClick={() => selectDealer(dealer.id)}>{dealer.label.slice(0, 1)} {dealer.label}</button>)}</div>
      <nav className="sg-tabs" aria-label="Dealerns klippkategorier">{sections.map(({ id, label }) => <button type="button" aria-pressed={view === id} key={id} onClick={() => selectView(id)}>{label}</button>)}</nav>
      <nav className={styles.contentNav} aria-label="Innehållsverktyg">{[['/control/videos', 'Klippbibliotek'], ['/control/events', 'Händelser'], ['/control/probe', 'Tal vid inaktivitet'], ['/control/preview', 'Sammansättning']].map(([path, label]) => {
        const href = contentLink(path); return <a key={path} href={href} onClick={event => void continueTo(event, href)}>{label} →</a>;
      })}</nav>
      {uploadAvailable ? <div className={styles.save}>{saveButton}</div> : null}
      {!connectedLane ? <p role="alert" className="feedback error">{cloudStudio ? 'Studions gemensamma spelanslutning är inte konfigurerad. Inställningarna är skrivskyddade tills anslutningen har återställts.' : 'Starta lokalt med node lab/start.mjs för gemensam lagring och spelanslutning. En agent använder node lab/start.mjs --no-open. Det kostnadsfria provet körs med node lab/start.mjs --offline --no-open.'}</p> : null}
      {error ? <p role="alert" className="feedback error">{error}</p> : null}
      {notice ? <p role="status" className="feedback success">{notice}</p> : null}
      {conflict?<ProjectConflict base={JSON.parse(saved)} draft={project} onResolve={(remote,merged)=>{setSaved(JSON.stringify(remote));setProject(merged);setConflict(false);setError('');setNotice('Utkastet är sammanslaget. Granska dina val och spara.');}}/>:null}
      <div hidden={!familyWorkspace || !uploadOpen || !['idle', 'deal', 'clips'].includes(view)}>
        {familyWorkspace ? <fieldset className={styles.fields} disabled={!connectedLane || saving}><FamilyVideoUpload key={dealerId} dealerId={dealerId} initialFamilyId={media && media.family?.id || videos.families?.find(row => row.dealerId === dealerId && (view === 'idle' ? row.playbackType === 'idle-pool' : view === 'deal' ? /^(deal|reveal)\./.test(row.eventId) : row.eventId.startsWith('speak.')))?.id} project={project} inventory={familyInventory} onBusyChange={setUploading} onUploaded={(next, id) => { setVideos(next); const label = next.videos.find(row => row.id === id)?.classification?.label; if (id && label && label.length <= 80) setProject(current => current.clipLabels?.[id]?.trim() ? current : applyClipLabel(current, id, label)); }} onOpen={open} /></fieldset> : null}
      </div>
      {view === 'idle' && familyWorkspace ? <section><div className={styles.sectionHeader}><span /><button className="text-button" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? 'Läser…' : 'Uppdatera klipplistan'}</button></div><fieldset disabled={saving || !connectedLane} className={styles.fields}><IdlePolicyEditor policy={project.idlePolicy ?? createDefaultIdlePolicy()} inventory={videos} blocked={saving} clipLabels={project.clipLabels} onChange={policy => edit(draft => { draft.idlePolicy = policy; })} onBusyChange={() => {}} onImportBusyChange={setUploading} /></fieldset></section> : null}
      {(view === 'deal' || view === 'clips') && familyWorkspace ? <section>{selection ? <h2>{clipSituationLabel(selection.eventId, selection.situation)}</h2> : null}
        {media && variant ? <><button className="text-button" onClick={() => setSelection(null)}>← Alla klipp</button><fieldset disabled={saving || !connectedLane} className={styles.editor}><div>{video ? <video key={video.id} className={styles.preview} src={video.previewUrl} controls playsInline preload="metadata" /> : <p>Ingen tillgänglig film för denna situation.</p>}<p>{video ? clipLabel({ id: video.id, familyId: video.familyId, role: video.role, relativePath: video.relativePath }, project.clipLabels) : ''}</p><details className={styles.help}><summary>Avancerat · klipp och kortdata</summary><p><code>{video && video.fileName} · {video && video.id}</code></p><pre>{JSON.stringify(event, null, 2)}</pre></details></div><MediaFamilyEditor inventory={videos} family={media.family} project={project} variants={media.line.variants} selectedId={variant.id} onSelect={setVariantId} onPolicy={updatePolicy} onRefresh={() => void refresh()} refreshing={refreshing} /></fieldset></> : <FamilyVideoLibrary inventory={videos} dealerId={dealerId} familyType={view === 'deal' ? 'deal' : 'speak'} clipLabels={project.clipLabels} onOpen={open} onRefresh={() => void refresh()} refreshing={refreshing} />}
      </section> : null}
      {!familyWorkspace && !customDealer && ['idle', 'deal', 'clips'].includes(view) ? <fieldset className={styles.fields} disabled={saving || !connectedLane}><LegacyClipEditor project={project} dealerId={dealerId} section={view} onChange={policy => edit(draft => { draft.legacyClipPolicy = policy; })} /></fieldset> : null}
      {customDealer && view === 'idle' ? <section><div className={styles.sectionHeader}><span /><button type="button" className="text-button" disabled={refreshing || uploading} onClick={() => void refresh()}>{refreshing ? 'Läser…' : 'Uppdatera klipplistan'}</button></div><RegisteredIdleEditor key={dealerId} project={project} inventory={videos} dealerId={dealerId} blocked={saving || !connectedLane} onChange={updateRegisteredIdle} onBusyChange={setUploading} /></section> : null}
      {customDealer ? <section aria-label={`${dealerLabel} · egna klipp`}><div className={styles.customGrid}>
        {view === 'deal' ? <>{Array.from({length:7},(_,box)=><section key={box} data-position={`box${box}`}><h2>Spelarplats {box+1}</h2>{customEntries.filter(row=>row.situation===`box${box}`).map(row=>customCard(row.event,row.situation,true))}</section>)}
          <section data-position="dealer"><h2>Dealer</h2>{customEntries.filter(row=>['dealer-up','dealer-hole'].includes(row.situation)).map(row=>customCard(row.event,row.situation))}</section></>
          : customEntries.map(row=>customCard(row.event,row.situation))}
      </div></section> : null}
      {view === 'clips' && familyWorkspace ? <details className={styles.help}><summary>Förinspelade exakta talpar</summary><LegacyClipEditor project={project} dealerId={dealerId} section="clips" onChange={policy => edit(draft => { draft.legacyClipPolicy = policy; })} /></details> : null}
      <details className={styles.help}><summary>Avancerat · uppspelning</summary><a href={contentLink('/control/activity')} onClick={event => void continueTo(event, contentLink('/control/activity'))}>Uppspelning och logg →</a></details>
    </main>
    </PageTemplate>
  </div>;
}
