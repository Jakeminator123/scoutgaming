'use client';
import { useCallback, useEffect, useState } from 'react';
import { ActivityLog, type ActivityDraft } from './activity-log';
import { appendActivity, type ActivityEntry } from '../lib/activity-log.mjs';
import { IdlePolicyEditor } from './idle-policy-editor';
import { FamilyVideoLibrary } from './family-video-library';
import { MediaFamilyEditor } from './media-family-editor';
import { upsertMediaVariantPolicy, mediaExampleEvent, mediaLineForEvent, mediaVideoForEvent } from '../lib/media-family-policy.mjs';
import { createDefaultIdlePolicy } from '../lib/idle-policy.mjs';
import type { MediaVariantPolicy, StudioProject } from '../lib/studio-model.mjs';
import { requestJson, type VideoInventory } from './studio-types';
import styles from './lissabon-studio.module.css';
import {ProbeEditor} from './probe-editor';
import {ProjectConflict} from './project-conflict';
import {createDefaultProbePolicy} from '../lib/probe-policy.mjs';

type View = 'stream' | 'idle' | 'deal' | 'clips' | 'probe';
export function LissabonStudio({ initialProject, initialVideos, connectedLane }: { initialProject: StudioProject; initialVideos: VideoInventory; connectedLane: boolean }) {
  const [project, setProject] = useState(initialProject);
  const [saved, setSaved] = useState(JSON.stringify(initialProject));
  const [videos, setVideos] = useState(initialVideos);
  const [view, setView] = useState<View>('stream');
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
      setNotice('Sparat för Lissabon. Nya deal- och replikval läses av spelet direkt. Probe använder senaste sparade val inför nästa beslut. Ladda om spelfliken efter ändrad idlepolicy, när handen är avslutad.');
      record({ source: 'config', stage: 'configuration', status: 'completed', title: 'Lissabon-inställningar sparade', owner: 'Gemensam projektlagring', reason: 'Web och Lab läser samma sparade projekt.', data: { revision: response.project.revision } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Kunde inte spara.');setConflict((cause as {statusCode?:number})?.statusCode===409); }
    finally { setSaving(false); }
  }
  async function refresh() {
    setRefreshing(true); setError('');
    try { setVideos(await requestJson<VideoInventory>('/api/videos/rescan', { method: 'POST' })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Kunde inte läsa klippen.'); }
    finally { setRefreshing(false); }
  }
  function open(eventId: string, situation: string) {
    setVariantId('');
    if (eventId === 'idle.ready') setView('idle');
    else { setSelection({ eventId, situation }); setView(eventId.startsWith('deal.') ? 'deal' : 'clips'); }
  }
  function updatePolicy(familyId: string, policy: MediaVariantPolicy) {
    edit(draft => { draft.mediaPolicy = upsertMediaVariantPolicy(draft.mediaPolicy, familyId, policy); });
  }
  const definition = selection && project.events.find(event => event.id === selection.eventId);
  const event = definition && mediaExampleEvent(definition, selection!.situation);
  const media = definition && event && mediaLineForEvent(project, videos, 'astrid', definition.id, event);
  const variant = media && (media.line.variants.find(item => item.id === variantId) ?? media.line.variants[0]);
  const video = definition && event && variant && mediaVideoForEvent(videos, 'astrid', definition.id, event, variant.videoGenerationId);
  return <div className={styles.shell}>
    <header className={styles.header}><div><span className="eyebrow">ASTRID · LOKAL DEMO</span><h1>Lissabon<span>stream lane</span></h1></div>
      <nav aria-label="Lissabon">{([['stream', 'Ström'], ['idle', 'Idle'], ['deal', 'Deal'], ['clips', 'Repliker'], ['probe','Probe']] as const).map(([id, label]) => <button className={view === id ? styles.active : ''} aria-pressed={view === id} key={id} onClick={() => { setSelection(null); setView(id); }}>{label}</button>)}<a href="/openclaw">OpenClaw ↗</a></nav>
      <div className={styles.save}><span>{dirty ? 'Osparade ändringar' : 'Sparat lokalt'}</span><button className="primary-button" disabled={!dirty || saving || !connectedLane} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara inställningar'}</button></div>
    </header>
    <main className={styles.main}>
      {!connectedLane ? <p role="alert" className="feedback error">Det här labbet startades utan Lissabon-profilen. Starta med Start-Lissabon.cmd för rätt ström, tal och gemensam lagring.</p> : null}
      {error ? <p role="alert" className="feedback error">{error}</p> : null}
      {notice ? <p role="status" className="feedback success">{notice}</p> : null}
      {conflict?<ProjectConflict base={JSON.parse(saved)} draft={project} onResolve={(remote,merged)=>{setSaved(JSON.stringify(remote));setProject(merged);setConflict(false);setError('');setNotice('Utkastet är sammanslaget. Granska dina val och spara.');}}/>:null}
      {view==='probe'?<fieldset className={styles.fields} disabled={saving||!connectedLane}><ProbeEditor policy={project.probePolicy??createDefaultProbePolicy()} onChange={policy=>edit(draft=>{draft.probePolicy=policy;})} onActivity={record}/></fieldset>:null}
      <div hidden={view !== 'stream' || !connectedLane}>
        <p className={styles.intro}>Astrid med Emils klipp, OpenClaw och genererade röstsvar med läppsynk. Anslut öppnar spelfliken och följer dess uppspelning här.</p>
        {connectedLane ? <ActivityLog focused entries={entries} onActivity={record} onClear={() => setEntries([])} full onOpen={() => setView('stream')} streamView={{ project, videos, originals: null, dealerId: 'astrid', onOpenEvent: eventId => open(eventId, '') }} /> : null}
      </div>
      {view === 'idle' ? <section><h2>Vänteläge och reaktioner</h2><button className="text-button" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? 'Läser…' : 'Läs in nya filer från idle/variant'}</button><p className={styles.intro}>Spara och ladda om spelfliken när handen är avslutad. OpenClaw behöver inte startas om. Spelets Klippval ska stå på OpenClaw för chattreaktioner. Klippbeskrivningar och tillåtelse ändras här; agentens anslutning och dashboard finns under <a href="/openclaw">Chatt &amp; OpenClaw</a>.</p><fieldset disabled={saving || !connectedLane} className={styles.fields}><IdlePolicyEditor policy={project.idlePolicy ?? createDefaultIdlePolicy()} inventory={videos} blocked={saving} onChange={policy => edit(draft => { draft.idlePolicy = policy; })} onBusyChange={() => {}} /></fieldset></section> : null}
      {view === 'deal' || view === 'clips' ? <section>{selection ? <h2>{view === 'deal' ? 'Utdelning' : 'Repliker'} · {selection.situation}</h2> : null}<p className={styles.intro}>Välj en situation för att se dess exakta standardfil och tillåtna varianter. De här lokala proven styr inte spelet.</p>
        {media && variant ? <><button className="text-button" onClick={() => setSelection(null)}>← Alla klipp</button><fieldset disabled={saving || !connectedLane} className={styles.editor}><div>{video ? <video key={video.id} className={styles.preview} src={video.previewUrl} controls playsInline preload="metadata" /> : <p>Ingen tillgänglig film för denna situation.</p>}<p>{selection?.situation} · Manuell klippgranskning</p></div><MediaFamilyEditor inventory={videos} family={media.family} project={project} variants={media.line.variants} selectedId={variant.id} onSelect={setVariantId} onPolicy={updatePolicy} onRefresh={() => void refresh()} refreshing={refreshing} /></fieldset></> : <FamilyVideoLibrary inventory={videos} dealerId="astrid" familyType={view === 'deal' ? 'deal' : 'speak'} onOpen={open} onRefresh={() => void refresh()} refreshing={refreshing} />}
      </section> : null}
      <details className={styles.help}><summary>Start, sparande och kvarvarande arbete</summary><p>Starta med <code>Start-Lissabon.cmd</code>. Inställningar sparas i <code>lissabon/data/project.json</code> med versionshistorik. Lokala demoprofiler och Astrids chatthistorik sparas i <code>lissabon/data/players</code> och finns kvar efter omstart. Välj profil i spelfliken. Profilerna saknar lösenord; gästläget finns kvar. Genererade ljud och filmer är tillfälliga per serverstart.</p><p>Genereringen har tagit 15–81 sekunder i våra prover. Talet inväntar ledigt vänteläge. På mobil öppnar du själv loggen med Chatt; kort och insatser ligger ovanpå talfilmen. Kvar före demoacceptans: kortplacering, kortkontakt och saknade exakta filmer. Röst och läppsynk behöver fortsatt bedömas med ögon och öron.</p><p>Den tidigare studion finns under <a href="/tree">Avancerat labb</a>. Lissabon använder samma lagring och spelare.</p></details>
    </main>
  </div>;
}
