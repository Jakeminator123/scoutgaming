'use client';
import {useRef, useState} from 'react';
import type {StudioProject} from '../lib/studio-model.mjs';
import {dealerRemovalStatus} from '../lib/dealer-removal.mjs';
import {DealerMediaLibrary} from './dealer-media-library';
import {mediaRemovalMessage} from './media-removal-feedback';
import {requestJson, type VideoInventory} from './studio-types';
import styles from './dealer-trash.module.css';

export type DealerRemovalProps = {
  project: StudioProject;
  inventory: VideoInventory;
  dealerId: string;
  disabled?: boolean;
  disabledReason?: string;
  onApplied: (project: StudioProject, inventory: VideoInventory, selectedId: string) => void;
  onInventory: (inventory: VideoInventory) => void;
  onProjectSaved: (project: StudioProject) => void;
  onPendingChange: (pending: boolean) => void;
};

export function DealerRemoval({project, inventory, dealerId, disabled=false, disabledReason='', onApplied, onInventory, onProjectSaved, onPendingChange}: DealerRemovalProps) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [expanded, setExpanded] = useState('');
  const [permanent, setPermanent] = useState('');
  const [plan, setPlan] = useState<{allowed:boolean;reason?:string;retryAfterMs?:number;count?:number}|null>(null);
  const lock = useRef(false);
  const status = dealerRemovalStatus(project, dealerId);
  const dealer = project.dealers.find(row => row.id === dealerId);
  const speechEnabled = dealer?.speechProfile?.state === 'enabled';
  const trash = project.dealerTrash ?? [];
  const clipCount = (id: string) => inventory.videos.filter(video => (video.dealer ?? video.classification?.dealerId) === id && video.source === 'upload').length;
  async function archive(id: string, archived: boolean) {
    if (disabled || lock.current || (archived && (status.kind !== 'ready' || speechEnabled))) return;
    lock.current=true; setBusy(true); onPendingChange(true); setError('');
    try {
      const result = await requestJson<{project: StudioProject; inventory: VideoInventory}>('/api/dealers/archive', {
        method:'POST', body:JSON.stringify({dealerId:id, expectedRevision:project.revision, archived}),
      });
      const selected = archived ? result.project.dealers[0].id : id;
      onApplied(result.project, result.inventory, selected); setExpanded('');
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
          onApplied(saved.project,inventory,archived?saved.project.dealers[0].id:id);setExpanded('');return;
        }
      } catch { /* Preserve the original failure without guessing the saved state. */ }
      setError(mediaRemovalMessage(cause));
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
      onApplied(result.project,result.inventory,result.project.dealers.some(row=>row.id===dealerId)?dealerId:result.project.dealers[0].id);setPermanent('');setExpanded('');setPlan(null);
    } catch(cause) {
      let pending=false;
      try{
        const [saved,inventory]=await Promise.all([requestJson<{project:StudioProject}>('/api/project'),requestJson<VideoInventory>('/api/videos')]);
        const entry=saved.project.dealerTrash?.find(row=>row.dealer.id===id);
        if(!entry&&!saved.project.dealers.some(row=>row.id===id)){
          onApplied(saved.project,inventory,saved.project.dealers.some(row=>row.id===dealerId)?dealerId:saved.project.dealers[0].id);setPermanent('');setExpanded('');setPlan(null);return;
        }
        pending=Boolean(entry?.deletion);onProjectSaved(saved.project);onInventory(inventory);
      }catch{/* A failed read cannot establish whether the deletion completed. */}
      setPlan(null);setError(pending?'Raderingen av dealern är inte klar. Några filer kan redan vara permanent raderade. Välj Slutför radering för att fortsätta; dealern kan inte återställas.':mediaRemovalMessage(cause));
    }finally{lock.current=false;setBusy(false);onPendingChange(false);}
  }
  return <section className={styles.section} aria-label="Hantera borttagning av dealers">
    {status.kind === 'base' ? <p className={styles.muted}>Grunddealern ingår i den gemensamma originalbanken. Dess uppladdade klipp hanteras var för sig i biblioteket.</p> : dealer ? <div className={styles.remove}>
      <h3>Flytta {dealer.label} till papperskorgen</h3>
      <p>Dealern, dess klippval och {clipCount(dealerId)} uppladdade filer samlas i papperskorgen. Du kan återställa dem tillsammans.</p>
      {status.message ? <p role="status">{status.message}</p> : null}
      {speechEnabled ? <p role="status">Stäng av AI-tal i dealerns talprofil och spara innan du flyttar den till papperskorgen.</p> : null}
      <button type="button" className="sg-btn sg-btn-secondary" disabled={disabled || busy || status.kind !== 'ready' || speechEnabled} onClick={() => void archive(dealerId, true)}>{busy ? 'Arbetar…' : `Flytta ${dealer.label} till papperskorgen`}</button>
    </div> : null}
    {disabledReason ? <p role="status">{disabledReason}</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <details className={styles.trash}>
      <summary>Papperskorg för dealers · {trash.length}</summary>
      <p className={styles.muted}>Återställ en dealer med sina klippval och filer. Enskilda filer kan granskas här; permanent radering är separat och skyddar befintliga beroenden.</p>
      {trash.length ? trash.map(entry => <article key={entry.dealer.id} className={styles.row}>
        <div className={styles.heading}><div><h3>{entry.dealer.label}</h3><p>{clipCount(entry.dealer.id)} filer · {entry.deletion?'permanent radering påbörjad':'i papperskorgen'}</p></div>
          <div className={styles.actions}>
            <button type="button" className="sg-btn sg-btn-secondary" disabled={disabled || busy || Boolean(entry.deletion)} onClick={() => void archive(entry.dealer.id, false)}>Återställ dealer och klipp</button>
            <button type="button" className="sg-btn sg-btn-ghost" disabled={busy} aria-expanded={expanded === entry.dealer.id} onClick={() => setExpanded(current => current === entry.dealer.id ? '' : entry.dealer.id)}>{expanded === entry.dealer.id ? 'Dölj klipp' : 'Visa klipp'}</button>
            <button type="button" className={styles.deleteButton} disabled={disabled||busy} onClick={()=>void checkPermanent(entry.dealer.id)}>{entry.deletion?'Slutför radering':'Radera dealer permanent…'}</button>
          </div>
        </div>
        {permanent===entry.dealer.id?<div className={styles.confirm} role="group" aria-label="Radera dealer permanent">
          <strong>{entry.deletion?'Slutför raderingen av':'Radera'} {entry.dealer.label}{entry.deletion?'?':' permanent?'}</strong>
          <p>Dealern, dess sparade klippval och {plan?.count??clipCount(entry.dealer.id)} uppladdade filer tas bort permanent. Detta kan inte ångras.</p>
          {!plan?<p role="status">{busy?'Kontrollerar filer och beroenden…':'Kontrollen behöver göras om. Välj raderingsåtgärden ovan igen.'}</p>:!plan.allowed?<p role="status">{mediaRemovalMessage(plan.reason)}{plan.retryAfterMs?` Försök igen om cirka ${Math.max(1,Math.ceil(plan.retryAfterMs/60000))} minuter.`:''}</p>:<p>Alla filer har kontrollerats. Beroenden kontrolleras igen när du bekräftar.</p>}
          <div className={styles.actions}><button type="button" className={styles.deleteButton} disabled={disabled||busy||!plan?.allowed} onClick={()=>void deleteDealer(entry.dealer.id)}>{entry.deletion?'Slutför permanent radering':'Radera dealer och filer permanent'}</button><button type="button" disabled={busy} onClick={()=>{setPermanent('');setPlan(null);}}>Avbryt</button></div>
        </div>:null}
        {expanded === entry.dealer.id ? <DealerMediaLibrary key={entry.dealer.id} project={project} inventory={inventory} dealerId={entry.dealer.id} archivedDealer onProjectSaved={onProjectSaved} onLifecycleChange={onPendingChange} onInventory={onInventory} onPendingChange={onPendingChange} disabled={disabled||Boolean(entry.deletion)} /> : null}
      </article>) : <p>Inga dealers i papperskorgen.</p>}
    </details>
  </section>;
}
