'use client';
import {useRef, useState, type MouseEvent} from 'react';
import {studioNavigationHref} from '../lib/studio-navigation.mjs';
import {compositionLabel} from '../../packages/navigation/control-flow.mjs';
import type {StudioProject} from '../../packages/presentation/contracts/studio-model.mjs';
import type {DealerArchiveImpact} from '../lib/dealer-archive-impact.mjs';
import {dealerRemovalStatus} from '../lib/dealer-removal.mjs';
import {DealerMediaLibrary} from './dealer-media-library';
import {mediaRemovalMessage} from './media-removal-feedback';
import { requestJson } from './studio-types';
import type { VideoInventory } from '../../packages/presentation/contracts/media-inventory.mjs';
import styles from './dealer-trash.module.css';

export type DealerRemovalProps = {
  project: StudioProject;
  inventory: VideoInventory;
  dealerId: string;
  laneId?: string;
  operatorId?: string;
  tableId?: string;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  onApplied: (project: StudioProject, inventory: VideoInventory, selectedId: string) => void;
  onInventory: (inventory: VideoInventory) => void;
  onProjectSaved: (project: StudioProject) => void;
  onPendingChange: (pending: boolean) => void;
};

function validArchiveImpact(value: unknown, dealerId: string): value is DealerArchiveImpact {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const impact = value as DealerArchiveImpact;
  const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  return impact.dealerId === dealerId && text(impact.token) && Number.isSafeInteger(impact.mediaCount) && impact.mediaCount >= 0
    && typeof impact.speechEnabled === 'boolean'
    && Array.isArray(impact.compositions) && impact.compositions.every(row => row && text(row.id) && text(row.label))
    && Array.isArray(impact.rooms) && impact.rooms.every(row => row && text(row.id) && text(row.name) && (row.operatorId === null || text(row.operatorId)))
    && Array.isArray(impact.operators) && impact.operators.every(row => row && text(row.id) && text(row.name));
}

function dealerLifecycleMessage(cause: unknown, permanent = false): string {
  const serverCode = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;
  const code = typeof serverCode === 'string' ? serverCode : typeof cause === 'string' ? cause : cause instanceof Error ? cause.message : '';
  if (permanent && ['studio_dealer_published', 'studio_media_published'].includes(code)) return 'Ett sparat spelbolagspaket behöver fortfarande dealern eller dess klipp. Permanent radering är därför spärrad; innehållet är kvar i arkivet.';
  if (permanent && code === 'studio_dealer_in_use') return 'En sparad koppling behöver fortfarande dealern. Permanent radering är spärrad; innehållet är kvar i arkivet.';
  if (code === 'studio_dealer_inactive') return 'Den här äldre dealerprofilen kan inte återställas som aktiv dealer.';
  if (['studio_dealer_published', 'studio_dealer_in_use', 'studio_dealer_speech_enabled', 'studio_dealer_archive_impact_changed'].includes(code)) return 'Dealerns användning har ändrats. Kontrollera konsekvenserna igen innan du bekräftar arkiveringen.';
  if (code === 'studio_dealer_archive_coverage_incomplete') return 'Servern kunde inte kontrollera alla berörda kopplingar. Ingen arkivering har gjorts. Kontrollera igen när uppgifterna kan läsas.';
  if (code === 'studio_dealer_archive_plan_invalid') return 'Servern kunde inte bekräfta vad som påverkas. Ingen arkivering har skickats. Kontrollera igen.';
  if (code === 'studio_conflict') return 'Projektet eller kopplingarna har ändrats. Läs in den aktuella sidan och kontrollera konsekvenserna igen.';
  if (code === 'studio_media_delete_coverage_incomplete' || code === 'studio_delete_coverage_incomplete') return 'Permanent radering är spärrad eftersom servern inte kan kontrollera alla kopplingar till lagringen. Inga ytterligare filer raderas.';
  return mediaRemovalMessage(cause);
}

export function DealerRemoval({project, inventory, dealerId, laneId, operatorId, tableId, onNavigate, disabled=false, disabledReason='', onApplied, onInventory, onProjectSaved, onPendingChange}: DealerRemovalProps) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [expanded, setExpanded] = useState('');
  const [archiveTarget, setArchiveTarget] = useState('');
  const [archivePlan, setArchivePlan] = useState<{impact: DealerArchiveImpact; revision: string}|null>(null);
  const [permanent, setPermanent] = useState('');
  const [plan, setPlan] = useState<{allowed:boolean;reason?:string;retryAfterMs?:number;count?:number}|null>(null);
  const lock = useRef(false);
  const selection = useRef({dealerId, revision: project.revision});
  selection.current = {dealerId, revision: project.revision};
  const status = dealerRemovalStatus(project, dealerId);
  const dealer = project.dealers.find(row => row.id === dealerId);
  const impact = archiveTarget === dealerId && archivePlan?.revision === project.revision && archivePlan.impact.dealerId === dealerId ? archivePlan.impact : null;
  const trash = project.dealerTrash ?? [];
  const context = {dealerId, laneId, operatorId, tableId};
  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onNavigate?.(event, href);
  }
  const clipCount = (id: string) => inventory.videos.filter(video => (video.dealer ?? video.classification?.dealerId) === id).length;
  async function checkArchive(id: string) {
    if (disabled || lock.current || id !== dealerId || status.kind !== 'ready') return;
    const expectedRevision = project.revision;
    const stillSelected = () => selection.current.dealerId === id && selection.current.revision === expectedRevision;
    lock.current = true; setBusy(true); onPendingChange(true); setArchiveTarget(id); setArchivePlan(null); setError('');
    try {
      const result = await requestJson<{impact: unknown}>('/api/dealers/archive-check', {
        method: 'POST', body: JSON.stringify({dealerId: id, expectedRevision}),
      });
      if (!stillSelected()) return;
      if (!validArchiveImpact(result?.impact, id)) throw new Error('studio_dealer_archive_plan_invalid');
      setArchivePlan({impact: result.impact, revision: expectedRevision});
    } catch (cause) {
      if (stillSelected()) setError(dealerLifecycleMessage(cause));
    } finally { lock.current = false; setBusy(false); onPendingChange(false); }
  }
  async function archive(id: string, archived: boolean) {
    if (disabled || lock.current || (archived && (!impact || impact.dealerId !== id || selection.current.dealerId !== id || selection.current.revision !== archivePlan?.revision))) return;
    lock.current=true; setBusy(true); onPendingChange(true); setError('');
    try {
      const result = await requestJson<{project: StudioProject; inventory: VideoInventory}>('/api/dealers/archive', {
        method:'POST', body:JSON.stringify({dealerId:id, expectedRevision:project.revision, archived, ...(archived ? {impactToken: impact!.token} : {})}),
      });
      const selected = archived ? '' : id;
      onApplied(result.project, result.inventory, selected); setExpanded('');setArchiveTarget('');setArchivePlan(null);
    } catch (cause) {
      // A lost response may follow a committed transaction. Reconcile with reads;
      // never automatically repeat a lifecycle write.
      try {
        const [saved, inventory] = await Promise.all([
          requestJson<{project:StudioProject}>('/api/project'), requestJson<VideoInventory>('/api/videos'),
        ]);
        const active=saved.project.dealers.some(row=>row.id===id);
        const trashed=saved.project.dealerTrash?.some(row=>row.dealer.id===id)===true;
        if (archived ? trashed&&!active : active&&!trashed) {
          onApplied(saved.project,inventory,archived?'':id);setExpanded('');setArchiveTarget('');setArchivePlan(null);return;
        }
      } catch { /* Preserve the original failure without guessing the saved state. */ }
      setArchivePlan(null);setError(dealerLifecycleMessage(cause));
    }
    finally { lock.current=false; setBusy(false); onPendingChange(false); }
  }
  async function checkPermanent(id:string) {
    if(disabled||lock.current)return;
    lock.current=true;setBusy(true);onPendingChange(true);setPermanent(id);setPlan(null);setError('');
    try{setPlan(await requestJson<{allowed:boolean;reason?:string;retryAfterMs?:number;count?:number}>('/api/dealers/delete-check',{method:'POST',body:JSON.stringify({dealerId:id,expectedRevision:project.revision})}));}
    catch(cause){setPlan({allowed:false,reason:cause instanceof Error?(cause as Error&{code?:string}).code??cause.message:undefined});}
    finally{lock.current=false;setBusy(false);onPendingChange(false);}
  }
  async function deleteDealer(id:string) {
    if(disabled||lock.current||permanent!==id||!plan?.allowed)return;
    lock.current=true;setBusy(true);onPendingChange(true);setError('');
    try {
      const result=await requestJson<{project:StudioProject;inventory:VideoInventory}>('/api/dealers/delete',{method:'POST',body:JSON.stringify({dealerId:id,expectedRevision:project.revision})});
      onApplied(result.project,result.inventory,result.project.dealers.some(row=>row.id===dealerId)?dealerId:'');setPermanent('');setExpanded('');setArchiveTarget('');setPlan(null);
    } catch(cause) {
      let pending=false;
      try{
        const [saved,inventory]=await Promise.all([requestJson<{project:StudioProject}>('/api/project'),requestJson<VideoInventory>('/api/videos')]);
        const entry=saved.project.dealerTrash?.find(row=>row.dealer.id===id);
        if(!entry&&!saved.project.dealers.some(row=>row.id===id)){
          onApplied(saved.project,inventory,saved.project.dealers.some(row=>row.id===dealerId)?dealerId:'');setPermanent('');setExpanded('');setArchiveTarget('');setPlan(null);return;
        }
        pending=Boolean(entry?.deletion);onProjectSaved(saved.project);onInventory(inventory);
      }catch{/* A failed read cannot establish whether the deletion completed. */}
      setPlan(null);setError(pending?'Raderingen av dealern är inte klar. Några filer kan redan vara permanent raderade. Välj Slutför radering för att fortsätta; dealern kan inte återställas.':dealerLifecycleMessage(cause,true));
    }finally{lock.current=false;setBusy(false);onPendingChange(false);}
  }
  return <section className={styles.section} aria-label="Arkivera och återställ dealers">
    {dealer ? <div className={styles.remove}>
      <h3>Arkivera {dealer.label}</h3>
      <p>Arkiveringen stänger av AI-tal och flyttar dealern, dess klipp och berörda sammansättningar till arkivet. Du får se vilka rum och spelbolag som påverkas innan du bekräftar.</p>
      {archiveTarget === dealerId ? <div className={styles.confirm} role="group" aria-label="Bekräfta arkivering">
        <strong>Arkivera {dealer.label}?</strong>
        {impact ? <>
          <p>{impact.speechEnabled ? 'AI-tal stängs av automatiskt.' : 'AI-tal är redan avstängt.'} {impact.mediaCount} klipp och mediefiler arkiveras. Inga filer raderas.</p>
          {impact.compositions.length ? <><p>Sammansättningar som arkiveras:</p><ul className={styles.references}>{impact.compositions.map(composition => {
            const href = studioNavigationHref('/control/compositions', {...context, laneId: composition.id});
            return <li key={composition.id}><a href={href} onClick={event => navigate(event, href)}>{compositionLabel(composition.label)}</a></li>;
          })}</ul></> : null}
          {impact.rooms.length ? <><p>Rum som stoppas:</p><ul className={styles.references}>{impact.rooms.map(room => {
            if (!room.operatorId) return <li key={room.id}>{room.name}</li>;
            const href = studioNavigationHref('/control/rooms', {...context, operatorId: room.operatorId, tableId: room.id});
            return <li key={room.id}><a href={href} onClick={event => navigate(event, href)}>{room.name}</a></li>;
          })}</ul></> : null}
          {impact.operators.length ? <><p>Berörda sammansättningar avpubliceras hos:</p><ul className={styles.references}>{impact.operators.map(operator => {
            const href = studioNavigationHref('/control/rooms', {...context, operatorId: operator.id, tableId: operator.id === operatorId ? tableId : ''});
            return <li key={operator.id}><a href={href} onClick={event => navigate(event, href)}>{operator.name}</a></li>;
          })}</ul></> : null}
          <p>Återställning återför dealern, klippen och sammansättningarna som utkast. AI-tal förblir avstängt. Rum och spelbolag publiceras inte automatiskt igen.</p>
        </> : <p role="status">{busy ? 'Kontrollerar vad som påverkas…' : 'Konsekvenserna behöver kontrolleras innan du kan bekräfta.'}</p>}
        <div className={styles.actions}>
          {!impact && !busy ? <button type="button" disabled={disabled} onClick={() => void checkArchive(dealerId)}>Kontrollera igen</button> : null}
          <button type="button" className="sg-btn sg-btn-secondary" disabled={disabled || busy || !impact} onClick={() => void archive(dealerId, true)}>{busy ? 'Arbetar…' : 'Arkivera '+dealer.label}</button>
          <button type="button" disabled={busy} onClick={() => {setArchiveTarget('');setArchivePlan(null);}}>Avbryt</button>
        </div>
      </div> : <button type="button" className="sg-btn sg-btn-secondary" disabled={disabled || busy || status.kind !== 'ready'} onClick={() => void checkArchive(dealerId)}>Arkivera dealer…</button>}
    </div> : null}
    {disabledReason ? <p role="status">{disabledReason}</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <section className={styles.trash} aria-labelledby="archived-dealers-title">
      <h3 id="archived-dealers-title">Arkiverade dealers · {trash.length}</h3>
      <p className={styles.muted}>Återställ dealern, klippen och sammansättningarna som utkast. AI-tal förblir avstängt, och rum och spelbolag publiceras inte automatiskt igen. Permanent radering tar bort alla dealerns ägda klipp och mediefiler efter en separat kontroll och bekräftelse.</p>
      {trash.length ? trash.map(entry => <article key={entry.dealer.id} className={styles.row}>
        <div className={styles.heading}><div><h3>{entry.dealer.label}</h3><p>{clipCount(entry.dealer.id)} filer · {entry.deletion?'permanent radering påbörjad':'arkiverad'}</p></div>
          <div className={styles.actions}>
            <button type="button" className="sg-btn sg-btn-secondary" disabled={disabled || busy || Boolean(entry.deletion)} onClick={() => void archive(entry.dealer.id, false)}>Återställ dealer och klipp</button>
            <button type="button" className="sg-btn sg-btn-ghost" disabled={busy} aria-expanded={expanded === entry.dealer.id} onClick={() => setExpanded(current => current === entry.dealer.id ? '' : entry.dealer.id)}>{expanded === entry.dealer.id ? 'Dölj klipp' : 'Visa klipp'}</button>
            <button type="button" className={styles.deleteButton} disabled={disabled||busy} onClick={()=>void checkPermanent(entry.dealer.id)}>{entry.deletion?'Slutför radering':'Radera dealer permanent…'}</button>
          </div>
        </div>
        {permanent===entry.dealer.id?<div className={styles.confirm} role="group" aria-label="Radera dealer permanent">
          <strong>{entry.deletion?'Slutför raderingen av':'Radera'} {entry.dealer.label}{entry.deletion?'?':' permanent?'}</strong>
          <p>Dealern, dess sparade klippval och alla {plan?.count??clipCount(entry.dealer.id)} ägda mediefiler tas bort permanent. Detta kan inte ångras.</p>
          {!plan?<p role="status">{busy?'Kontrollerar filer och beroenden…':'Kontrollen behöver göras om. Välj raderingsåtgärden ovan igen.'}</p>:!plan.allowed?<p role="status">{dealerLifecycleMessage(plan.reason,true)}{plan.retryAfterMs?` Försök igen om cirka ${Math.max(1,Math.ceil(plan.retryAfterMs/60000))} minuter.`:''}</p>:<p>Alla filer har kontrollerats. Beroenden kontrolleras igen när du bekräftar.</p>}
          <div className={styles.actions}><button type="button" className={styles.deleteButton} disabled={disabled||busy||!plan?.allowed} onClick={()=>void deleteDealer(entry.dealer.id)}>{entry.deletion?'Slutför permanent radering':'Radera dealer och filer permanent'}</button><button type="button" disabled={busy} onClick={()=>{setPermanent('');setPlan(null);}}>Avbryt</button></div>
        </div>:null}
        {expanded === entry.dealer.id ? <DealerMediaLibrary key={entry.dealer.id} project={project} inventory={inventory} dealerId={entry.dealer.id} archivedDealer onProjectSaved={onProjectSaved} onLifecycleChange={onPendingChange} onInventory={onInventory} onPendingChange={onPendingChange} disabled={disabled||Boolean(entry.deletion)} /> : null}
      </article>) : <p>Inga arkiverade dealers.</p>}
    </section>
  </section>;
}
