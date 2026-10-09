'use client';
import { labBasePath, labUrl } from "../lib/lab-url.mjs";
import { useEffect, useState } from 'react';
import { IdlePolicyEditor } from './idle-policy-editor';
import { FamilyVideoLibrary } from './family-video-library';
import { LegacyClipEditor } from './legacy-clip-editor';
import { FamilyVideoUpload } from './family-video-upload';
import { MediaFamilyEditor } from './media-family-editor';
import { clipLabel } from '../lib/clip-label.mjs';
import { upsertMediaVariantPolicy, mediaExampleEvent, mediaLineForEvent, mediaVideoForEvent } from '../lib/media-family-policy.mjs';
import { createDefaultIdlePolicy } from '../lib/idle-policy.mjs';
import {DEALER_IDS, type DealerId, type MediaVariantPolicy, type StudioProject} from '../lib/studio-model.mjs';
import { DEALER_WORKSPACE_SECTIONS, workspaceLocation, supportsFamilyWorkspace, type DealerWorkspaceSection } from '../lib/dealer-workspace.mjs';
import { requestJson, type VideoInventory } from './studio-types';
import { PageTemplate, publishShellStatus } from './page-template.mjs';
import styles from './lab-studio.module.css';
import {ProjectConflict} from './project-conflict';
import {DealerRegistration} from './dealer-registration';

export function LabStudio({ initialProject, initialVideos, connectedLane }: { initialProject: StudioProject; initialVideos: VideoInventory; connectedLane: boolean }) {
  const cloudStudio = labBasePath() === '/studio';
  const [project, setProject] = useState(initialProject);
  const [saved, setSaved] = useState(JSON.stringify(initialProject));
  const [videos, setVideos] = useState(initialVideos);
  const [dealerId, setDealerId] = useState<DealerId>('astrid');
  const [requestedView, setView] = useState<DealerWorkspaceSection>('idle');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict,setConflict]=useState(false);
  const [selection, setSelection] = useState<{ eventId: string; situation: string } | null>(null);
  const [variantId, setVariantId] = useState('');
  const dirty = JSON.stringify(project) !== saved;
  useEffect(() => {
    const select = () => {
      const location = workspaceLocation(window.location.hash);
      if (location.redirect) { window.location.replace(labUrl(location.redirect)); return; }
      setView(location.section); setSelection(null);
      if (location.upload) setUploadOpen(true);
    };
    select(); window.addEventListener('hashchange', select);
    return () => window.removeEventListener('hashchange', select);
  }, []);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  useEffect(() => {
    publishShellStatus(<span className={dirty ? 'sg-pill sg-pill-ej-sparad' : 'sg-pill sg-pill-sparad'}>{dirty ? 'Ej sparad' : 'Sparad'}</span>);
    return () => publishShellStatus(null);
  }, [dirty]);
  function edit(change: (draft: StudioProject) => void) {
    setProject(current => { const draft = structuredClone(current); change(draft); return draft; }); setNotice('');
  }
  async function save() {
    if (saving) return;
    setSaving(true); setError('');
    const submitted = project;
    try {
      const response = await requestJson<{ project: StudioProject }>('/api/project', { method: 'PUT', body: JSON.stringify({ project: submitted, expectedRevision: submitted.revision }) });
      setSaved(JSON.stringify(response.project));
      setProject(current => current === submitted ? response.project : { ...current, revision: response.project.revision });
      setNotice('Sparat i Studio. Astrids deal- och replikval läses direkt; Probe inför nästa beslut. Ladda om spelfliken mellan händer efter ändrad idlepolicy eller originalmotorns klippval.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Kunde inte spara.');setConflict((cause as {statusCode?:number})?.statusCode===409); }
    finally { setSaving(false); }
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
  function open(eventId: string, situation: string) {
    setVariantId('');
    if (eventId === 'idle.ready') setView('idle');
    else { setSelection({ eventId, situation }); setView(/^(deal|reveal)\./.test(eventId) ? 'deal' : 'clips'); }
  }
  function selectView(next: DealerWorkspaceSection) {
    setSelection(null); setView(next);
    window.location.hash = next;
  }
  function selectDealer(id: DealerId) {
    setDealerId(id); setSelection(null); setVariantId('');
  }
  function updatePolicy(familyId: string, policy: MediaVariantPolicy) {
    edit(draft => {
      if (policy.frequencyPercent === undefined && !Object.values(policy.selection).some(Boolean)) {
        draft.mediaPolicy = (draft.mediaPolicy ?? []).map(row => row.familyId === familyId
          ? { ...row, variants: row.variants.filter(item => item.videoId !== policy.videoId) } : row);
      } else draft.mediaPolicy = upsertMediaVariantPolicy(draft.mediaPolicy, familyId, policy);
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
  const saveButton = <button type="button" className="sg-btn sg-btn-secondary" disabled={!dirty || saving || !connectedLane} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara inställningar'}</button>;
  return <div className={styles.shell}>
    <PageTemplate
      eyebrow="// STUDIO"
      title="Dealers & klipp"
      intro="Välj dealer, sedan vad hen ska göra: vänta, dela kort, prata eller reagera."
      primary={uploadAvailable
        ? <button type="button" className="sg-btn sg-btn-primary" onClick={() => setUploadOpen(current => !current)} aria-expanded={uploadOpen}>Ladda upp klipp</button>
        : <button type="button" className="sg-btn sg-btn-primary" disabled={!dirty || saving || !connectedLane} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara inställningar'}</button>}
    >
    <main className={styles.main}>
      <DealerRegistration project={project} disabled={!connectedLane||saving} onEdit={change=>setProject(current=>change(current))} onAdded={id=>{selectDealer(id);setNotice('Dealern finns i utkastet. Spara och lägg sedan in egna klipp.');}}/>
      <div className="sg-chip-row" role="group" aria-label="Välj dealer">{project.dealers.map(dealer => <button type="button" className="sg-chip" aria-pressed={dealerId === dealer.id} key={dealer.id} onClick={() => selectDealer(dealer.id)}>{dealer.label.slice(0, 1)} {dealer.label}</button>)}</div>
      <nav className="sg-tabs" aria-label="Dealerns klippkategorier">{sections.map(({ id, label }) => <button type="button" aria-pressed={view === id} key={id} onClick={() => selectView(id)}>{label}</button>)}</nav>
      <p className={styles.intro}><a href={labUrl(`/control/videos?dealerId=${encodeURIComponent(dealerId)}`)}>Klippbibliotek, uppladdning och namn →</a> · <a href={labUrl('/control/events')}>Händelser och villkor →</a> · <a href={labUrl('/control/preview')}>Komponera dealer, bord och bakgrund →</a> · <a href={labUrl('/control/zones')}>Öppna Bakgrundszoner →</a> · <a href={labUrl('/control/probe')}>Öppna Probe →</a></p>
      {uploadAvailable ? <div className={styles.save}>{saveButton}</div> : null}
      {!connectedLane ? <p role="alert" className="feedback error">{cloudStudio ? 'Studions gemensamma spelanslutning är inte konfigurerad. Inställningarna är skrivskyddade tills anslutningen har återställts.' : 'Starta lokalt med node lab/start.mjs för gemensam lagring och spelanslutning. En agent använder node lab/start.mjs --no-open. Det kostnadsfria provet körs med node lab/start.mjs --offline --no-open.'}</p> : null}
      {error ? <p role="alert" className="feedback error">{error}</p> : null}
      {notice ? <p role="status" className="feedback success">{notice}</p> : null}
      {conflict?<ProjectConflict base={JSON.parse(saved)} draft={project} onResolve={(remote,merged)=>{setSaved(JSON.stringify(remote));setProject(merged);setConflict(false);setError('');setNotice('Utkastet är sammanslaget. Granska dina val och spara.');}}/>:null}
      <div hidden={!familyWorkspace || !uploadOpen || !['idle', 'deal', 'clips'].includes(view)}>
        {familyWorkspace ? <><p className={styles.intro}>MP4 eller WebM, högst 128 MB. Välj en exakt klippfamilj; nya varianter granskas innan de aktiveras.</p><fieldset className={styles.fields} disabled={!connectedLane || saving}><FamilyVideoUpload project={project} inventory={familyInventory} onUploaded={setVideos} onOpen={open} /></fieldset></> : null}
      </div>
      {view === 'idle' && familyWorkspace ? <section><div className={styles.sectionHeader}><h2>Vänteläge och reaktioner</h2><button className="text-button" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? 'Läser…' : 'Läs in nya idle-klipp'}</button></div><p className={styles.intro}>Spara och ladda om spelet mellan händer. Chattreaktioner kräver klippval OpenClaw.</p><fieldset disabled={saving || !connectedLane} className={styles.fields}><IdlePolicyEditor policy={project.idlePolicy ?? createDefaultIdlePolicy()} inventory={videos} blocked={saving} clipLabels={project.clipLabels} onChange={policy => edit(draft => { draft.idlePolicy = policy; })} onBusyChange={() => {}} /></fieldset></section> : null}
      {(view === 'deal' || view === 'clips') && familyWorkspace ? <section>{selection ? <><h2>{view === 'deal' ? 'Utdelning' : 'Repliker'} · {selection.situation}</h2><p className={styles.intro}>Förhandsvisningen styr inte spelet.</p></> : null}
        {media && variant ? <><button className="text-button" onClick={() => setSelection(null)}>← Alla klipp</button><fieldset disabled={saving || !connectedLane} className={styles.editor}><div>{video ? <video key={video.id} className={styles.preview} src={video.previewUrl} controls playsInline preload="metadata" /> : <p>Ingen tillgänglig film för denna situation.</p>}<p title={video ? video.id : undefined}>{selection?.situation} · {video ? `${clipLabel({ id: video.id, familyId: video.familyId, role: video.role, relativePath: video.relativePath }, project.clipLabels)} · ${video.fileName || video.id} · ` : ''}Manuell klippgranskning</p></div><MediaFamilyEditor inventory={videos} family={media.family} project={project} variants={media.line.variants} selectedId={variant.id} onSelect={setVariantId} onPolicy={updatePolicy} onRefresh={() => void refresh()} refreshing={refreshing} /></fieldset></> : <FamilyVideoLibrary inventory={videos} dealerId={dealerId} familyType={view === 'deal' ? 'deal' : 'speak'} clipLabels={project.clipLabels} onOpen={open} onRefresh={() => void refresh()} refreshing={refreshing} />}
      </section> : null}
      {!familyWorkspace && !customDealer && ['idle', 'deal', 'clips'].includes(view) ? <fieldset className={styles.fields} disabled={saving || !connectedLane}><LegacyClipEditor project={project} dealerId={dealerId} section={view} showLegacyReview={false} onChange={policy => edit(draft => { draft.legacyClipPolicy = policy; })} /></fieldset> : null}
      {customDealer?<section><h2>{dealerLabel} · egna klipp</h2><p>Lägg in en film för varje situation och välj standard eller alternativ. Händelser, regler, slump och OpenClaw använder samma urval som tidigare.</p><div className="sg-chip-row">{project.events.filter(event=>view==='idle'?event.sourceType==='idle':view==='deal'?['deal','reveal','turn'].includes(event.sourceType):['speak','settle'].includes(event.sourceType)).map(event=><a key={event.id} className="sg-btn sg-btn-secondary" href={labUrl(`/control/videos?dealerId=${encodeURIComponent(dealerId)}&eventId=${encodeURIComponent(event.id)}`)}>{event.label} · lägg in eller koppla film</a>)}</div><p><a href={labUrl('/control/preview')}>Välj bakgrund och bord →</a></p></section>:null}
      {view === 'clips' && familyWorkspace ? <details className={styles.help}><summary>Förinspelade exakta talpar</summary><LegacyClipEditor project={project} dealerId={dealerId} section="clips" showLegacyReview={false} onChange={policy => edit(draft => { draft.legacyClipPolicy = policy; })} /></details> : null}
      <p className={styles.intro}><a href={labUrl('/control/activity')}>Öppna Uppspelning →</a></p>
    </main>
    </PageTemplate>
  </div>;
}
