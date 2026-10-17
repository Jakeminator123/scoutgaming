'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { labBasePath, labUrl } from '../lib/lab-url.mjs';
import { type StudioLane, type StudioProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { ControlOperatorDirectory, type OperatorDirectory } from './control-operator-directory';
import { PresentationRoomCreate } from './presentation-room-create';
import { ControlResourceLifecycle, type LifecycleSnapshot } from './control-resource-lifecycle';
import { compositionLabel } from '../lib/control-flow.mjs';
import { initialPartnerRoomSelection } from '../lib/partner-room-selection.mjs';
import { studioHistory } from '../lib/studio-history.mjs';
import { PageTemplate } from './page-template';
import styles from './control-lanes-page.module.css';
import { ProjectConflict } from './project-conflict';
import { useStudioProjectSession } from './studio-session';
import type { ConnectionStatus } from './studio-types';
import type { VideoInventory } from '../../packages/presentation/contracts/media-inventory.mjs';

export type LaneOperatorChoice = { id: string; slug: string; name: string; status?: string; archivedAt?: string | null; publishedPackage?: { revision: number; lanes: string[] } | null };
type PackageEditor = { chosen: string[]; baseline: string[]; revision: number | null; message: string; error: string; needsRefresh: boolean };

export function initialPackageOperator(operators: readonly LaneOperatorChoice[], laneId?: string, operatorId?: string) {
  if (operatorId) return operators.find(operator => operator.id === operatorId || operator.slug === operatorId)?.id ?? '';
  const matches = laneId ? operators.filter(operator => operator.publishedPackage?.lanes.includes(laneId)) : [];
  return matches.length === 1 ? matches[0].id : operators.length === 1 ? operators[0].id : '';
}
function packageEditor(operator?: LaneOperatorChoice): PackageEditor {
  return { chosen: [...(operator?.publishedPackage?.lanes ?? [])], baseline: [...(operator?.publishedPackage?.lanes ?? [])], revision: operator?.publishedPackage?.revision ?? null,
    message: '', error: '', needsRefresh: operator?.publishedPackage === undefined };
}

const OFFLINE = 'Bolagens uppgifter kunde inte hämtas. Ladda om sidan för att försöka igen.';

export function publishLaneRows(lanes: readonly Pick<StudioLane, 'id' | 'label' | 'dealers'>[] | undefined, savedJson: string, dirty: boolean) {
  let saved: { id?: string }[] = [];
  try {
    const parsed = JSON.parse(savedJson) as { lanes?: { id?: string }[] };
    if (Array.isArray(parsed?.lanes)) saved = parsed.lanes;
  } catch {
    saved = [];
  }
  const byId = new Map(saved.map(lane => [String(lane.id), JSON.stringify(lane)]));
  const rows = (lanes ?? []).map(lane => ({
    id: lane.id,
    label: compositionLabel(lane.label),
    dealers: [...lane.dealers],
    unsaved: Boolean(dirty) && byId.get(lane.id) !== JSON.stringify(lane),
  }));
  return rows;
}

function requestedPublicationRoom(snapshot: LifecycleSnapshot | null, operatorId: string, requestedRoomId: string | string[] | undefined, lanes: readonly {id:string}[]) {
  const operator=snapshot?.operators.find(row=>row.id===operatorId);
  if(requestedRoomId===undefined||!operator||operator.status!=='active'||operator.archivedAt)return undefined;
  const selection=initialPartnerRoomSelection({operator,tables:(snapshot?.rooms??[])
    .filter(room=>!room.archivedAt&&room.published&&operator.lanes.includes(room.presentationLaneId)&&lanes.some(lane=>lane.id===room.presentationLaneId))
    .map(room=>({...room,status:room.state==='live'?'active':room.state}))},requestedRoomId);
  return snapshot?.rooms.find(room=>room.id===selection.roomId&&room.operatorId===operatorId);
}
export function ControlLanesPage({ initialProject, initialVideos, initialStatus, operators, storeAvailable, directory, initialLaneId, initialOperatorId, initialRoomId, onContextChange, initialTab = 'publish' }: {
  initialLaneId?: string;
  initialOperatorId?: string;
  initialRoomId?: string | string[];
  onContextChange?: () => void;
  initialTab?: 'publish' | 'companies';
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  operators: LaneOperatorChoice[];
  storeAvailable: boolean;
  directory?: OperatorDirectory | null;
}) {
  const session = useStudioProjectSession({ initialProject, initialVideos, initialStatus });
  const {
    project, dirty, saving, error, setError, notice, setNotice, conflict, setConflict, savedJson, setSavedJson, setProject,
  } = session;
  const rows = publishLaneRows(project.lanes, savedJson, dirty);
  const [selectedLaneId, setSelectedLaneId] = useState(initialLaneId ?? project.lanes?.[0]?.id ?? '');
  const [requestedRoomId, setRequestedRoomId] = useState(initialRoomId);
  const initialRoomCompositionResolved = useRef(false);
  const [resourceSnapshot, setResourceSnapshot] = useState<LifecycleSnapshot | null>(null);
  const [resourceStale, setResourceStale] = useState(false);
  const initialOperators: LaneOperatorChoice[] = [...operators, ...(directory?.operators ?? []).filter(entry => !operators.some(operator => operator.id === entry.id))];
  const [operatorId, setOperatorId] = useState(() => initialPackageOperator(initialOperators, initialLaneId, initialOperatorId));
  const [listed, setListed] = useState(initialOperators);
  const pendingInitialOperator=useRef(initialOperatorId&&!initialOperators.some(operator=>operator.id===initialOperatorId||operator.slug===initialOperatorId)?initialOperatorId:null);
  const [packages, setPackages] = useState<Record<string, PackageEditor>>(() => Object.fromEntries(initialOperators.map(operator => [operator.id, packageEditor(operator)])));
  const [lifecycleStatuses, setLifecycleStatuses] = useState<Record<string,string>>({});
  const [lifecycleArchives, setLifecycleArchives] = useState<Record<string,string|null>>({});
  const [resourcesRevision, setResourcesRevision] = useState(0);
  const selectedOperator = listed.find(operator => operator.id === operatorId);
  const suspended = (lifecycleStatuses[operatorId] ?? selectedOperator?.status) === 'suspended';
  const archived = suspended && Boolean(lifecycleArchives[operatorId]);
  const selectedRoom = !resourceStale ? requestedPublicationRoom(resourceSnapshot,operatorId,requestedRoomId,rows) : undefined;
  const roomUnavailable = requestedRoomId!==undefined&&!selectedRoom;
  const selectedLane = rows.find(lane=>lane.id===selectedLaneId)??rows[0];
  const compositionHref = labUrl('/control/compositions' + (selectedLane ? '?composition=' + encodeURIComponent(selectedLane.id) : ''));
  const selectedPackage = packages[operatorId] ?? packageEditor(selectedOperator);
  const { chosen, revision, message, error: publishError, needsRefresh } = selectedPackage;
  function updatePackage(id: string, update: (current: PackageEditor) => PackageEditor) {
    setPackages(current => ({ ...current, [id]: update(current[id] ?? packageEditor(listed.find(operator => operator.id === id))) }));
  }
  function chooseOperator(id: string) {
    if (writeLock.current || interactionBusy || Object.values(childLocks.current).some(Boolean)) return;
    if (id !== operatorId && roomDraft.current && !window.confirm('Lämna det osparade rumsnamnet och byta bolag?')) return;
    if(id!==operatorId)setRequestedRoomId(undefined);
    setOperatorId(id);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const params = new URLSearchParams(window.location.search);
      if (id) params.set('operator', id); else params.delete('operator');
      if(id!==operatorId){params.delete('room');params.delete('table');}
      window.history.replaceState(null, '', window.location.pathname + '?' + params);
      onContextChange?.();
    }
    updatePackage(id, current => ({ ...current, message: '', error: '' }));
  }
  const [busy, setBusy] = useState<'publish' | ''>('');
  const writeLock = useRef(false);
  const [childBusy, setChildBusy] = useState({room:false,lifecycle:false,directory:false});
  const childLocks = useRef(childBusy);
  const roomDraft = useRef(false);
  const [roomDirty,setRoomDirty] = useState(false);
  function setChildBusyFor(source:keyof typeof childBusy,value:boolean) {
    childLocks.current={...childLocks.current,[source]:value};
    setChildBusy(current=>current[source]===value?current:{...current,[source]:value});
  }
  const parentBusy = Boolean(busy) || saving;
  const interactionBusy = parentBusy || Object.values(childBusy).some(Boolean);
  const companiesOnly = initialTab === 'companies';
  const writesOff = !storeAvailable || interactionBusy || suspended;
  const publishSelectionReady = chosen.length > 0 && chosen.every(id => rows.some(row => row.id === id && !row.unsaved));
  const contextQuery = new URLSearchParams({... (operatorId ? {operator:operatorId} : {}), ...(selectedLane ? {composition:selectedLane.id} : {})});
  const reloadHref = labUrl('/control/rooms' + (contextQuery.size ? '?' + contextQuery : ''));
  const setMessage = (value: string) => updatePackage(operatorId, current => ({ ...current, message: value }));
  const setPublishError = (value: string) => updatePackage(operatorId, current => ({ ...current, error: value }));
  const companyHref = labUrl('/control/companies' + (operatorId ? '?operator=' + encodeURIComponent(operatorId) : ''));
  const shownError = [publishError, error].filter(Boolean).join(' ');
  const selectionDirty = Object.values(packages).some(pack => JSON.stringify([...pack.chosen].sort()) !== JSON.stringify([...pack.baseline].sort()));
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {if(selectionDirty || roomDirty || interactionBusy){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);
  },[selectionDirty,roomDirty,interactionBusy]);
  function resourceChanged(snapshot:LifecycleSnapshot) {
    setResourceSnapshot(snapshot);setResourceStale(false);
    let resolvedOperatorId=operatorId;
    if(pendingInitialOperator.current){const requested=pendingInitialOperator.current;pendingInitialOperator.current=null;const found=snapshot.operators.find(operator=>operator.id===requested||operator.slug===requested);if(found){resolvedOperatorId=found.id;setOperatorId(found.id);}}
    if(!initialRoomCompositionResolved.current){
      const room=requestedPublicationRoom(snapshot,resolvedOperatorId,requestedRoomId,rows);
      if(room){
        initialRoomCompositionResolved.current=true;
        // Seed editing once; later room readbacks only govern navigation, never discard a draft.
        if(!roomDraft.current&&!dirty&&!selectionDirty&&!conflict){
          setSelectedLaneId(room.presentationLaneId);
          if(typeof window!=='undefined'){
            const query=new URLSearchParams(window.location.search);
            query.set('composition',room.presentationLaneId);query.delete('lane');query.set('table',room.id);
            studioHistory(window).replaceContext(window.location.pathname+'?'+query+window.location.hash);
            onContextChange?.();
          }
        }
      }
    }
    setLifecycleStatuses(Object.fromEntries(snapshot.operators.map(operator=>[operator.id,operator.status])));
    setLifecycleArchives(Object.fromEntries(snapshot.operators.map(operator=>[operator.id,operator.archivedAt])));
    setListed(snapshot.operators.map(operator=>({...operator,publishedPackage:operator.packageRevision===null?null:{revision:operator.packageRevision,lanes:operator.lanes}})));
    setPackages(current=>{
      const next={...current};
      for(const operator of snapshot.operators) {
        const previous=current[operator.id]??packageEditor();
        if((operator.packageRevision??0)<(previous.revision??0))continue;
        const removed=new Set(previous.baseline.filter(id=>!previous.chosen.includes(id)));
        const added=previous.chosen.filter(id=>!previous.baseline.includes(id));
        next[operator.id]={...previous,chosen:[...new Set([...operator.lanes.filter(id=>!removed.has(id)),...added])],
          baseline:[...operator.lanes],revision:operator.packageRevision,needsRefresh:false,error:''};
      }
      return next;
    });
  }
  function resourceUncertain() {
    setResourceStale(true);
    setPackages(current=>Object.fromEntries(Object.entries(current).map(([id,pack])=>[id,{...pack,needsRefresh:true}])));
  }
  function companyCreated(operator:{id:string;slug:string;name:string}) {
    setListed(current=>[...current.filter(entry=>entry.id!==operator.id),{...operator,status:'active',publishedPackage:null}]);
    setRequestedRoomId(undefined);
    setOperatorId(operator.id);
    setPackages(current=>({...current,[operator.id]:packageEditor({...operator,publishedPackage:null})}));
    if(typeof window!=='undefined'&&window.history?.replaceState){const query=new URLSearchParams(window.location.search);query.set('operator',operator.id);query.delete('room');query.delete('table');window.history.replaceState(null,'',window.location.pathname+'?'+query);onContextChange?.();}
    setResourcesRevision(value=>value+1);
  }
  function chooseComposition(id:string) {
    if(interactionBusy||writeLock.current||Object.values(childLocks.current).some(Boolean))return;
    if(id!==selectedLane?.id&&roomDraft.current&&!window.confirm('Lämna det osparade rumsnamnet och byta sammansättning?'))return;
    if(id!==selectedLane?.id)setRequestedRoomId(undefined);
    setSelectedLaneId(id);
    const query=new URLSearchParams(window.location.search);query.set('composition',id);query.delete('lane');
    if(id!==selectedLane?.id){query.delete('room');query.delete('table');}
    window.history.replaceState(null,'',window.location.pathname+'?'+query);
    onContextChange?.();
  }

  async function post(action: string, body: Record<string, unknown>) {
    const response = await fetch(`${labBasePath()}/api/admin/${action}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lanes = [...chosen];
    if (writesOff || writeLock.current || Object.values(childLocks.current).some(Boolean) || interactionBusy || conflict || !publishSelectionReady || needsRefresh || !operatorId) return;
    writeLock.current = true;
    setBusy('publish'); setPublishError(''); setMessage('');
    try {
      const { response, payload } = await post('operator-package', { operatorId, lanes, expectedPackageRevision: revision });
      if (!response.ok) {
        updatePackage(operatorId, current => ({ ...current, needsRefresh: response.status === 409 || current.needsRefresh,
          error: payload?.code === 'studio_presentation_runtime_update_required' ? 'Spelmotorn behöver uppdateras innan ändringen kan publiceras. Dina val finns kvar.' : response.status === 422 ? 'Kontrollera lagerfiler, vald grundloop och tillåtna val. Spara sammansättningen och försök igen.'
            : response.status === 409 ? 'Paketet kunde inte uppdateras. Uppgifterna kan ha ändrats, eller så påverkar urvalet ett befintligt spelrum. Läs in bolagets publicerade paket och behåll sammansättningar som används av spelrum.'
              : 'Publiceringen gick inte igenom.' }));
        return;
      }
      const next = payload?.packageRevision;
      const sameLanes = Array.isArray(payload?.lanes) && payload.lanes.length === lanes.length && new Set(payload.lanes).size === lanes.length
        && payload.lanes.every((id: unknown) => typeof id === 'string' && lanes.includes(id));
      if (payload?.ok !== true || payload.operatorId !== operatorId || !sameLanes || !Number.isSafeInteger(next) || next !== (revision ?? 0) + 1
        || (payload.package_revision !== undefined && payload.package_revision !== next)) {
        updatePackage(operatorId,current=>({...current,needsRefresh:true,error:'Publiceringskvittot stämmer inte med bolaget, urvalet eller versionen. Dina val finns kvar. Läs in aktuella uppgifter innan du fortsätter.'})); return;
      }
      updatePackage(operatorId, current => ({ ...current, chosen: lanes, baseline: lanes, revision: next, needsRefresh: false, error: '', message: 'Bolagets sammansättningar är publicerade. Version ' + next + '.' }));
      setResourcesRevision(value=>value+1);
    } catch {
      updatePackage(operatorId,current=>({...current,needsRefresh:true,error:'Publiceringen kunde inte bekräftas. Läs in bolagets aktuella publicering innan du försöker igen.'}));
    } finally {
      writeLock.current = false;
      setBusy('');
    }
  }

  return <PageTemplate eyebrow="// SPELBOLAG" title={companiesOnly?'Bolag & team':'Spelrum & publicering'}
    intro={companiesOnly?'Välj ett bolag för att hantera team, spelrum och åtkomst.':'Här samlar du bolagets spelrum och det spelarna får möta.'}>
    <div className={styles.page}>
      {!storeAvailable?<p role="status" className={styles.card}>{OFFLINE}</p>:null}
      {shownError?<p role="alert" className={styles.card}>{shownError}</p>:null}
      {message?<p role="status" className={styles.card}>{message}</p>:null}
      {notice?<p role="status">{notice}</p>:null}
      {conflict?<ProjectConflict base={JSON.parse(savedJson) as StudioProject} draft={project} onResolve={(remote,merged)=>{setProject(merged);setSavedJson(JSON.stringify(remote));setConflict(false);setError('');setNotice('Senaste projektet är inläst. Dina ändringar har behållits.');}}/>:null}
      {companiesOnly?<>
        <ControlOperatorDirectory directory={directory??null} selectedOperatorId={operatorId} onSelect={chooseOperator} lifecycleStatuses={lifecycleStatuses} lifecycleArchives={lifecycleArchives}
          disabled={!storeAvailable||parentBusy||childBusy.room||childBusy.lifecycle} onBusyChange={value=>setChildBusyFor('directory',value)} onCreated={companyCreated}/>
        <ControlResourceLifecycle operatorId={operatorId} kind="operator" available={storeAvailable} disabled={parentBusy||childBusy.room||childBusy.directory} refreshKey={resourcesRevision} onChanged={resourceChanged} onRefreshNeeded={resourceUncertain} onBusyChange={value=>setChildBusyFor('lifecycle',value)}/>
      </>:<>
        <section className={styles.card} aria-label="Välj spelbolag">
          <div className={styles.contextLine}><label className={styles.field}>Spelbolag<select value={operatorId} disabled={interactionBusy||!listed.length} onChange={event=>chooseOperator(event.target.value)}>
            <option value="">Välj bolag</option>{listed.map(operator=><option key={operator.id} value={operator.id}>{operator.name}{(lifecycleStatuses[operator.id]??operator.status)==='suspended'?(lifecycleArchives[operator.id]?' · Arkiverat':' · Avstängt'):''}</option>)}
          </select></label><a className="sg-btn sg-btn-secondary" href={companyHref}>Bolag & team</a></div>
          {selectedOperator?<><div className={styles.cardHeading}><div><span className={styles.eyebrow}>VALT SPELBOLAG</span><h2>{selectedOperator.name}</h2></div><span className={styles.version}>{suspended?(archived?'Arkiverat':'Avstängt'):revision===null?'Ingen publicering ännu':'Publicerad version '+revision}</span></div>
            {selectedRoom?<p>Valt spelrum: <strong>{selectedRoom.name}</strong>. Rummet använder en gemensam sammansättning; ändringar i den kan påverka flera rum.</p>:null}
            {roomUnavailable?<p role="status">{!resourceSnapshot&&!resourceStale?'Kontrollerar det valda spelrummet…':'Det valda spelrummet är inte tillgängligt för det här bolaget. Välj ett aktuellt rum från Admin.'}</p>
              :<div className={styles.actions}><a className="sg-btn sg-btn-secondary" href={'/partner/'+encodeURIComponent(selectedOperator.slug)+'/rooms'+(selectedRoom?'?'+new URLSearchParams({room:selectedRoom.id}):'')}>Öppna partnerportalen</a><a className="sg-btn sg-btn-secondary" href={'/lobby?'+new URLSearchParams({operator:selectedOperator.slug,...(selectedRoom?{room:selectedRoom.id}:{})})}>Öppna spellobbyn</a></div>}
          </>:<p>Välj bolaget du vill arbeta med. Saknas det? <a href={labUrl('/control/companies')}>Skapa ett spelbolag</a>.</p>}
        </section>
        <ControlResourceLifecycle operatorId={operatorId} kind="rooms" available={storeAvailable} disabled={parentBusy||childBusy.room||childBusy.directory} refreshKey={resourcesRevision} onChanged={resourceChanged} onRefreshNeeded={resourceUncertain} onBusyChange={value=>setChildBusyFor('lifecycle',value)}/>
        {selectedOperator?<>
          {archived?<p className={styles.card}>Bolaget är arkiverat. <a href={companyHref}>Återställ bolaget under Bolag & team</a> för att fortsätta.</p>:null}
          {suspended&&!archived?<p className={styles.card}>Bolaget är avstängt. <a href={companyHref}>Granska bolagets åtkomst under Bolag & team</a>.</p>:null}
          {!suspended?<>
            <section className={styles.card} aria-label="Skapa spelrum">
              <div className={styles.cardHeading}><div><span className={styles.eyebrow}>NYTT SPELRUM</span><h2>Välj en sammansättning</h2></div><a href={labUrl('/control/compositions?'+new URLSearchParams({operator:operatorId}))}>Hantera sammansättningar →</a></div>
              <p>En sammansättning innehåller dealer, bord och bakgrund. Rummet blir bolagets spelbara ingång till den.</p>
              {rows.length?<label className={styles.field}>Sammansättning<select value={selectedLane?.id??''} disabled={interactionBusy} onChange={event=>chooseComposition(event.target.value)}>{rows.map(row=><option key={row.id} value={row.id}>{row.label}{row.unsaved?' · Osparad':''}</option>)}</select></label>:<p>Det finns inga sparade sammansättningar. <a href={compositionHref}>Skapa en sammansättning</a> innan du skapar ett rum.</p>}
              {selectedLane?<PresentationRoomCreate operator={selectedOperator} presentation={{id:selectedLane.id,label:selectedLane.label}} projectRevision={project.revision}
                projectSaved={!dirty&&!conflict&&!selectedLane.unsaved} storeAvailable={storeAvailable} disabled={conflict} interactionDisabled={parentBusy||childBusy.lifecycle||childBusy.directory} hideExisting
                onDraftChange={value=>{roomDraft.current=value;setRoomDirty(value);}} onBusyChange={value=>setChildBusyFor('room',value)} onCreated={receipt=>{updatePackage(receipt.room.operatorId,current=>({...current,revision:receipt.packageRevision,needsRefresh:true,message:'',error:''}));setResourcesRevision(value=>value+1);}}/>:null}
            </section>
            <section className={styles.card} aria-label="Publicera ändringar">
              <div className={styles.cardHeading}><div><span className={styles.eyebrow}>BEFINTLIGA SPELRUM</span><h2>Publicera ändrade sammansättningar</h2></div>{revision!==null?<span className={styles.version}>Version {revision}</span>:null}</div>
              <p>Ändringar i Studio blir synliga för spelarna efter publicering. Här väljer du bolagets sammansättningar och uppdaterar dess befintliga rum.</p>
              {needsRefresh?<p role="status">Läs in bolagets senaste publicering innan du fortsätter. <button className="sg-btn sg-btn-secondary" type="button" disabled={interactionBusy} onClick={()=>setResourcesRevision(value=>value+1)}>Läs in aktuella uppgifter</button></p>:null}
              {!chosen.length?<p role="status">Välj minst en sammansättning för att publicera. Vill du stänga spelutbudet kan du pausa eller arkivera rummen ovan, eller arkivera bolaget under Bolag &amp; team.</p>:null}
              <form id="operator-package-selection" className={styles.form} onSubmit={event=>void publish(event)}>
                <fieldset className={styles.choices} disabled={writesOff||needsRefresh}><legend>Sammansättningar som bolaget får använda</legend>
                  {rows.map(row=><label className={styles.choice} key={row.id}><input type="checkbox" name="lanes" value={row.id} checked={chosen.includes(row.id)} disabled={row.unsaved}
                    onChange={event=>{const checked=event.target.checked;updatePackage(operatorId,current=>({...current,chosen:checked?[...new Set([...current.chosen,row.id])]:current.chosen.filter(id=>id!==row.id),message:'',error:''}));}}/><span><strong>{row.label}</strong><br/>{row.dealers.map(id=>project.dealers.find(dealer=>dealer.id===id)?.label??id).join(', ')}{row.unsaved?' · Spara i Studio först':''}</span></label>)}
                  {chosen.filter(id=>!rows.some(row=>row.id===id)).map(id=><label className={styles.choice} key={id}><input type="checkbox" value={id} checked onChange={()=>updatePackage(operatorId,current=>({...current,chosen:current.chosen.filter(value=>value!==id)}))}/><span>Sammansättning borttagen ur Studio · {id}. Avmarkera efter att berörda rum arkiverats.</span></label>)}
                </fieldset>
                <div className={styles.actions}><button className="sg-btn sg-btn-primary" type="submit" disabled={writesOff||!publishSelectionReady||needsRefresh||conflict}>Publicera för {selectedOperator.name}</button><a href={labUrl('/control/compositions?'+new URLSearchParams({operator:operatorId,...(selectedLane?{composition:selectedLane.id}:{})}))}>Redigera sammansättningen</a></div>
              </form>
            </section>
          </>:null}
        </>:null}
      </>}
    </div>
  </PageTemplate>;
}
