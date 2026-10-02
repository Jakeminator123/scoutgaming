'use client';
import { labBasePath, labUrl } from "../lib/lab-url.mjs";
import { useCallback, useEffect, useState } from 'react';
import { ActivityLog, type ActivityDraft } from './activity-log';
import { appendActivity, type ActivityEntry } from '../lib/activity-log.mjs';
import { IdlePolicyEditor } from './idle-policy-editor';
import { FamilyVideoLibrary } from './family-video-library';
import { LegacyClipEditor } from './legacy-clip-editor';
import { FamilyVideoUpload } from './family-video-upload';
import { MediaFamilyEditor } from './media-family-editor';
import { upsertMediaVariantPolicy, mediaExampleEvent, mediaLineForEvent, mediaVideoForEvent } from '../lib/media-family-policy.mjs';
import { createDefaultIdlePolicy } from '../lib/idle-policy.mjs';
import type { DealerId, MediaVariantPolicy, StudioProject } from '../lib/studio-model.mjs';
import { DEALER_WORKSPACE_SECTIONS, workspaceLocation, supportsFamilyWorkspace, type DealerWorkspaceSection } from '../lib/dealer-workspace.mjs';
import { requestJson, type VideoInventory } from './studio-types';
import styles from './lab-studio.module.css';
import {ProbeEditor} from './probe-editor';
import {ProjectConflict} from './project-conflict';
import {createDefaultProbePolicy} from '../lib/probe-policy.mjs';

export function LabStudio({ initialProject, initialVideos, connectedLane }: { initialProject: StudioProject; initialVideos: VideoInventory; connectedLane: boolean }) {
  const cloudStudio = labBasePath() === '/studio';
  const [project, setProject] = useState(initialProject);
  const [saved, setSaved] = useState(JSON.stringify(initialProject));
  const [videos, setVideos] = useState(initialVideos);
  const [dealerId, setDealerId] = useState<DealerId>('astrid');
  const [view, setView] = useState<DealerWorkspaceSection>('idle');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [observeOpen, setObserveOpen] = useState(false);
  const [observationDealerId, setObservationDealerId] = useState<DealerId | null>(null);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict,setConflict]=useState(false);
  const [selection, setSelection] = useState<{ eventId: string; situation: string } | null>(null);
  const [variantId, setVariantId] = useState('');
  const dirty = JSON.stringify(project) !== saved;
  const record = useCallback((entry: ActivityDraft) => setEntries(current => appendActivity(current, { ...entry, id: crypto.randomUUID(), time: new Date().toISOString() })), []);
  useEffect(() => {
    const select = () => {
      const location = workspaceLocation(window.location.hash);
      setView(location.section); setSelection(null);
      if (location.upload) setUploadOpen(true);
      if (location.observe) { setObserveOpen(true); setObservationDealerId(current => current ?? 'astrid'); }
    };
    select(); window.addEventListener('hashchange', select);
    return () => window.removeEventListener('hashchange', select);
  }, []);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
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
      record({ source: 'config', stage: 'configuration', status: 'completed', title: 'Studio-inställningar sparade', owner: 'Gemensam projektlagring', reason: 'Spelet och Studio läser samma sparade projekt.', data: { revision: response.project.revision } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Kunde inte spara.');setConflict((cause as {statusCode?:number})?.statusCode===409); }
    finally { setSaving(false); }
  }
  async function refresh() {
    setRefreshing(true); setError('');
    try { setVideos(await requestJson<VideoInventory>(videos.summary?.archiveSource === 'emil-default' ? '/api/videos/rescan' : '/api/videos', videos.summary?.archiveSource === 'emil-default' ? { method: 'POST' } : undefined)); }
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
  const dealerLabel = project.dealers.find(row => row.id === dealerId)?.label ?? dealerId;
  const observationDealerLabel = project.dealers.find(row => row.id === observationDealerId)?.label ?? observationDealerId;
  const familyInventory = { ...videos, families: videos.families?.filter(row => row.dealerId === dealerId) };
  const media = familyWorkspace && definition && event && mediaLineForEvent(project, videos, dealerId, definition.id, event, { includeManualVariants: true });
  const variant = media && (media.line.variants.find(item => item.id === variantId) ?? media.line.variants[0]);
  const video = definition && event && variant && mediaVideoForEvent(videos, dealerId, definition.id, event, variant.videoGenerationId);
  return <div className={styles.shell}>
    <header className={styles.header}><div><span className="eyebrow">DEALER & KLIPP</span><h1>{dealerLabel}<span>Studio</span></h1></div>
      <label className={styles.dealer}>Dealer<select aria-label="Dealer" value={dealerId} onChange={event => { setDealerId(event.target.value as DealerId); setSelection(null); setVariantId(''); }}>{project.dealers.map(dealer => <option key={dealer.id} value={dealer.id}>{dealer.label}</option>)}</select></label>
      <div className={styles.save}><span>{dirty ? 'Osparade ändringar' : 'Sparat i Studio'}</span><button className="primary-button" disabled={!dirty || saving || !connectedLane} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara inställningar'}</button></div>
    </header>
    <main className={styles.main}>
      <nav className={styles.categories} aria-label="Dealerns klippkategorier">{DEALER_WORKSPACE_SECTIONS.map(({ id, label }) => <button type="button" className={view === id ? styles.active : ''} aria-pressed={view === id} key={id} onClick={() => selectView(id)}>{label}</button>)}</nav>
      {!connectedLane ? <p role="alert" className="feedback error">{cloudStudio ? 'Studions gemensamma spelanslutning är inte konfigurerad. Inställningarna är skrivskyddade tills anslutningen har återställts.' : 'Starta med Start-Lab.cmd för gemensam lagring och spelanslutning. Det kostnadsfria lokala provet körs med node lab/start.mjs --offline --no-open.'}</p> : null}
      {error ? <p role="alert" className="feedback error">{error}</p> : null}
      {notice ? <p role="status" className="feedback success">{notice}</p> : null}
      {conflict?<ProjectConflict base={JSON.parse(saved)} draft={project} onResolve={(remote,merged)=>{setSaved(JSON.stringify(remote));setProject(merged);setConflict(false);setError('');setNotice('Utkastet är sammanslaget. Granska dina val och spara.');}}/>:null}
      {['idle', 'deal', 'clips'].includes(view) ? <div className={styles.actions}><p className={styles.intro}>Klipp och inställningar för {dealerLabel}. Dina projektändringar behålls när du byter dealer eller kategori.</p><button type="button" className="text-button" onClick={() => setUploadOpen(current => !current)} aria-expanded={uploadOpen}>Ladda upp klipp</button></div> : null}
      <div hidden={!uploadOpen || !['idle', 'deal', 'clips'].includes(view)}>
        {familyWorkspace ? <><p className={styles.intro}>Befintlig familjeuppladdning: MP4/WebM, högst 128 MB. Större direktuppladdningar till privat Blob ingår ännu inte i den här vyn.</p><fieldset className={styles.fields} disabled={!connectedLane || saving}><FamilyVideoUpload project={project} inventory={familyInventory} onUploaded={setVideos} onOpen={open} /></fieldset></> : <p className={styles.intro}>Familjeuppladdning stöds ännu inte för {dealerLabel}. Befintliga exakta klipp kan granskas och originalmotorns tillåtna val kan sparas.</p>}
      </div>
      {view === 'probe' ? <section><h2>Talinitiativ vid inaktivitet</h2>{familyWorkspace ? <><p className={styles.intro}>Astrid kan förbereda en personlig replik, röst och talfilm när spelaren är inaktiv och bordet är lugnt. Ett textprov skapar ingen röst eller video. Kontrollera den verkliga uppspelningen i spelet.</p><details className={styles.help}><summary>Probe-inställningar och syntetiskt textprov</summary><fieldset className={styles.fields} disabled={saving || !connectedLane}><ProbeEditor policy={project.probePolicy ?? createDefaultProbePolicy()} onChange={policy => edit(draft => { draft.probePolicy = policy; })} onActivity={record} /></fieldset></details></> : <p className={styles.intro}>Probe stöds ännu inte för {dealerLabel}. Astrids inställningar gäller endast Astrid.</p>}</section> : null}
      {view === 'background' ? <section><h2>Bakgrund för {dealerLabel}</h2>{familyWorkspace ? <><p className={styles.intro}>Bakgrundsvideo och zoner kan förhandsvisas i det befintliga zonverktyget. Verktyget är ännu inte kopplat till spelets bakgrund. Spara ditt projekt innan du lämnar den här vyn.</p><a className="primary-button" href={labUrl('/zones')}>Öppna bakgrundszoner</a></> : <p className={styles.intro}>Bakgrundsredigering stöds ännu inte för {dealerLabel} i denna arbetsyta.</p>}</section> : null}
      {view === 'idle' && familyWorkspace ? <section><h2>Vänteläge och reaktioner</h2><button className="text-button" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? 'Läser…' : 'Läs in nya idle-klipp'}</button><p className={styles.intro}>Spara och ladda om spelfliken mellan händer. För chattreaktioner behöver spelets Klippval stå på OpenClaw.</p><fieldset disabled={saving || !connectedLane} className={styles.fields}><IdlePolicyEditor policy={project.idlePolicy ?? createDefaultIdlePolicy()} inventory={videos} blocked={saving} onChange={policy => edit(draft => { draft.idlePolicy = policy; })} onBusyChange={() => {}} /></fieldset></section> : null}
      {(view === 'deal' || view === 'clips') && familyWorkspace ? <section>{selection ? <h2>{view === 'deal' ? 'Utdelning' : 'Repliker'} · {selection.situation}</h2> : null}<p className={styles.intro}>Välj en exakt situation för att se standardfilen och dess tillåtna varianter. Förhandsvisningen styr inte spelet.</p>
        {media && variant ? <><button className="text-button" onClick={() => setSelection(null)}>← Alla klipp</button><fieldset disabled={saving || !connectedLane} className={styles.editor}><div>{video ? <video key={video.id} className={styles.preview} src={video.previewUrl} controls playsInline preload="metadata" /> : <p>Ingen tillgänglig film för denna situation.</p>}<p>{selection?.situation} · Manuell klippgranskning</p></div><MediaFamilyEditor inventory={videos} family={media.family} project={project} variants={media.line.variants} selectedId={variant.id} onSelect={setVariantId} onPolicy={updatePolicy} onRefresh={() => void refresh()} refreshing={refreshing} /></fieldset></> : <FamilyVideoLibrary inventory={videos} dealerId={dealerId} familyType={view === 'deal' ? 'deal' : 'speak'} onOpen={open} onRefresh={() => void refresh()} refreshing={refreshing} />}
      </section> : null}
      {!familyWorkspace && ['idle', 'deal', 'clips'].includes(view) ? <fieldset className={styles.fields} disabled={saving || !connectedLane}><LegacyClipEditor project={project} dealerId={dealerId} section={view} showLegacyReview={false} onChange={policy => edit(draft => { draft.legacyClipPolicy = policy; })} /></fieldset> : null}
      {view === 'clips' && familyWorkspace ? <details className={styles.help}><summary>Förinspelade exakta talpar</summary><LegacyClipEditor project={project} dealerId={dealerId} section="clips" showLegacyReview={false} onChange={policy => edit(draft => { draft.legacyClipPolicy = policy; })} /></details> : null}
      <details className={styles.help} open={observeOpen} onToggle={event => { const isOpen = event.currentTarget.open; setObserveOpen(isOpen); if (isOpen) setObservationDealerId(current => current ?? dealerId); }}><summary>Granska i spel · följ faktisk uppspelning</summary><p className={styles.intro}>Följ spelarens uppspelning och kvitton i den anslutna spelfliken. Registrerat eller valt betyder inte uppspelat.</p>{observationDealerId && observationDealerId !== dealerId ? <p role="status">Observerar {observationDealerLabel}; klippytan visar {dealerLabel}. Välj {observationDealerLabel} i dealer-väljaren för att öppna observerade klipp. Spelfliken påverkas inte av dealerbytet.</p> : null}{observationDealerId && connectedLane ? <ActivityLog focused entries={entries} onActivity={record} onClear={() => setEntries([])} full onOpen={() => setObserveOpen(true)} streamView={{ project, videos, originals: null, dealerId: observationDealerId, onOpenEvent: eventId => { if (observationDealerId !== dealerId) { setNotice(`Välj ${observationDealerLabel} för att öppna klippet från den observerade spelfliken.`); return; } open(eventId, ''); } }} /> : null}</details>
    </main>
  </div>;
}
