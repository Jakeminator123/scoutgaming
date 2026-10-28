'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { labBasePath, labUrl } from '../lib/lab-url.mjs';
import { type StudioLane, type StudioProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { ControlOperatorDirectory, type OperatorDirectory } from './control-operator-directory';
import { PresentationRoomCreate } from './presentation-room-create';
import { ControlResourceLifecycle, type LifecycleSnapshot } from './control-resource-lifecycle';
import { compositionLabel } from '../../../packages/navigation/control-flow.mjs';
import { initialPartnerRoomSelection } from '../lib/partner-room-selection.mjs';
import { markPackagesStale, packageEditor, packageSelectionDirty, publishOperatorPackage, publishedPackageMessage, rebasePackageEditors, togglePackageLane } from '../lib/operator-package-client.mjs';
import type { PackageEditor } from '../lib/operator-package-client.mjs';
import { studioHistory } from '../lib/studio-history.mjs';
import { studioNavigationContextFromQuery, studioNavigationHref } from '../lib/studio-navigation.mjs';
import { PageTemplate } from './page-template.mjs';
import styles from './admin-publication-page.module.css';
import { ProjectConflict } from './project-conflict';
import { useStudioProjectSession } from './studio-session';
import type { ConnectionStatus } from './studio-types';
import type { VideoInventory } from '../../../packages/presentation/contracts/media-inventory.mjs';

export type PublicationOperatorChoice = { id: string; slug: string; name: string; status?: string; archivedAt?: string | null; publishedPackage?: { revision: number; lanes: string[] } | null };

export function initialPackageOperator(operators: readonly PublicationOperatorChoice[], laneId?: string, operatorId?: string) {
  if (operatorId) return operators.find(operator => operator.id === operatorId || operator.slug === operatorId)?.id ?? '';
  const matches = laneId ? operators.filter(operator => operator.publishedPackage?.lanes.includes(laneId)) : [];
  return matches.length === 1 ? matches[0].id : operators.length === 1 ? operators[0].id : '';
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
export function AdminPublicationPage({ initialProject, initialVideos, initialStatus, operators, storeAvailable, directory, initialLaneId, initialOperatorId, initialRoomId, onContextChange, initialTab = 'publish' }: {
  initialLaneId?: string;
  initialOperatorId?: string;
  initialRoomId?: string | string[];
  onContextChange?: () => void;
  initialTab?: 'publish' | 'companies';
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  operators: PublicationOperatorChoice[];
  storeAvailable: boolean;
  directory?: OperatorDirectory | null;
}) {
  const session = useStudioProjectSession({ initialProject, initialVideos, initialStatus });
  const {
    project, dirty, saving, save, updateProject, error, setError, notice, setNotice, conflict, setConflict, savedJson, setSavedJson, setProject,
  } = session;
  const rows = publishLaneRows(project.lanes, savedJson, dirty);
  const [selectedLaneId, setSelectedLaneId] = useState(initialLaneId ?? project.lanes?.[0]?.id ?? '');
  const [requestedRoomId, setRequestedRoomId] = useState(initialRoomId);
  const initialRoomCompositionResolved = useRef(false);
  const [resourceSnapshot, setResourceSnapshot] = useState<LifecycleSnapshot | null>(null);
  const [resourceStale, setResourceStale] = useState(false);
  const initialOperators: PublicationOperatorChoice[] = [...operators, ...(directory?.operators ?? []).filter(entry => !operators.some(operator => operator.id === entry.id))];
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
  const editableLane = project.lanes?.find(lane=>lane.id===selectedLane?.id);
  const selectedPackage = packages[operatorId] ?? packageEditor(selectedOperator);
  const { chosen, revision, message, error: publishError, needsRefresh } = selectedPackage;
  function updatePackage(id: string, update: (current: PackageEditor) => PackageEditor) {
    setPackages(current => ({ ...current, [id]: update(current[id] ?? packageEditor(listed.find(operator => operator.id === id))) }));
  }
  function chooseOperator(id: string) {
    if (writeLock.current || interactionBusy || Object.values(childLocks.current).some(Boolean)) return;
    if (id !== operatorId && roomDraft.current && !window.confirm('Lämna osparade rumsändringar och byta bolag?')) return;
    if(id!==operatorId)setRequestedRoomId(undefined);
    setOperatorId(id);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (id) params.set('operator', id); else params.delete('operator');
      if(id!==operatorId){params.delete('room');params.delete('table');}
      studioHistory(window).replaceContext(window.location.pathname + '?' + params + window.location.hash);
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
  const navigationContext = studioNavigationContextFromQuery(new URLSearchParams(typeof window==='undefined'?'':window.location?.search??''));
  // A room picked for game settings may use another composition than the open draft;
  // editor links carry the room only when it belongs to that composition.
  const editorContext = {...navigationContext, operatorId, laneId:selectedLane?.id,
    tableId:selectedRoom&&selectedRoom.presentationLaneId===selectedLane?.id?selectedRoom.id:undefined,
    dealerId:selectedLane?.dealers.includes(navigationContext.dealerId??'')?navigationContext.dealerId:undefined};
  const compositionHref = studioNavigationHref('/admin/compositions', editorContext);
  const setMessage = (value: string) => updatePackage(operatorId, current => ({ ...current, message: value }));
  const setPublishError = (value: string) => updatePackage(operatorId, current => ({ ...current, error: value }));
  const companyHref = studioNavigationHref('/admin/companies', editorContext);
  const shownError = [publishError, error].filter(Boolean).join(' ');
  const selectionDirty = Object.values(packages).some(packageSelectionDirty);
  const currentSelectionDirty = packageSelectionDirty(selectedPackage);
  const publishBlocked = writesOff || dirty || !publishSelectionReady || needsRefresh || conflict;
  const publicationStatus = needsRefresh ? 'Läs in aktuell publicering' : dirty || conflict ? 'Spara ändringarna först'
    : currentSelectionDirty ? 'Urvalet är inte publicerat' : message ? 'Publicerat · version '+revision : 'Redo att publicera';
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
    setPackages(current=>rebasePackageEditors(current,snapshot.operators));
  }
  function resourceUncertain() {
    setResourceStale(true);
    setPackages(markPackagesStale);
  }
  function companyCreated(operator:{id:string;slug:string;name:string}) {
    setListed(current=>[...current.filter(entry=>entry.id!==operator.id),{...operator,status:'active',publishedPackage:null}]);
    setRequestedRoomId(undefined);
    setOperatorId(operator.id);
    setPackages(current=>({...current,[operator.id]:packageEditor({...operator,publishedPackage:null})}));
    if(typeof window!=='undefined'){const query=new URLSearchParams(window.location.search);query.set('operator',operator.id);query.delete('room');query.delete('table');studioHistory(window).replaceContext(window.location.pathname+'?'+query+window.location.hash);onContextChange?.();}
    setResourcesRevision(value=>value+1);
  }
  function chooseComposition(id:string) {
    if(interactionBusy||writeLock.current||Object.values(childLocks.current).some(Boolean))return;
    if(id!==selectedLane?.id&&roomDraft.current&&!window.confirm('Lämna osparade rumsändringar och byta sammansättning?'))return;
    if(id!==selectedLane?.id)setRequestedRoomId(undefined);
    setSelectedLaneId(id);
    const query=new URLSearchParams(window.location.search);query.set('composition',id);query.delete('lane');
    if(id!==selectedLane?.id){query.delete('room');query.delete('table');}
    studioHistory(window).replaceContext(window.location.pathname+'?'+query+window.location.hash);
    onContextChange?.();
  }

  async function saveComposition() {
    if (!dirty || writesOff || conflict || !editableLane?.label.trim() || writeLock.current || Object.values(childLocks.current).some(Boolean)) return;
    writeLock.current = true;
    try {
      if (await save()) setNotice('Sammansättningen är sparad. Publicera för att uppdatera spelrummen.');
    } finally { writeLock.current = false; }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lanes = [...chosen];
    if (publishBlocked || writeLock.current || Object.values(childLocks.current).some(Boolean) || !operatorId) return;
    writeLock.current = true;
    setBusy('publish'); setPublishError(''); setMessage(''); setNotice('');
    try {
      const result = await publishOperatorPackage({ endpoint: `${labBasePath()}/api/admin/operator-package`, operatorId, lanes, revision, fetchImpl: fetch });
      if (!result.ok) { updatePackage(operatorId, current => ({ ...current, needsRefresh: result.needsRefresh || current.needsRefresh, error: result.error })); return; }
      updatePackage(operatorId, current => ({ ...current, chosen: lanes, baseline: lanes, revision: result.revision, needsRefresh: false, error: '', message: publishedPackageMessage(result.revision) }));
      setResourcesRevision(value=>value+1);
    } finally {
      writeLock.current = false;
      setBusy('');
    }
  }

  return <PageTemplate eyebrow="// SPELBOLAG" title={companiesOnly?'Bolag & team':'Spelrum & publicering'}
    intro={companiesOnly?'Välj ett bolag för att hantera team, spelrum och åtkomst.':'Välj sammanhang, spara sammansättningen och publicera för spelarna.'}>
    <div className={styles.page}>
      {!companiesOnly?<p role="note" className={styles.card}>Rummets lager, spelinställningar, publicering och livscykel finns samlade under <a href={labUrl(studioNavigationHref('/admin/rooms',{operatorId,tableId:selectedRoom?.id}))}>Spelbolag & rum</a>.</p>:null}
      {!storeAvailable?<p role="status" className={styles.card}>{OFFLINE}</p>:null}
      {shownError?<p role="alert" className={styles.problem}>{shownError}</p>:null}
      {conflict?<ProjectConflict base={JSON.parse(savedJson) as StudioProject} draft={project} onResolve={(remote,merged)=>{setProject(merged);setSavedJson(JSON.stringify(remote));setConflict(false);setError('');setNotice('Senaste projektet är inläst. Dina ändringar har behållits.');}}/>:null}
      {companiesOnly?<>
        <ControlOperatorDirectory directory={directory??null} selectedOperatorId={operatorId} onSelect={chooseOperator} lifecycleStatuses={lifecycleStatuses} lifecycleArchives={lifecycleArchives}
          disabled={!storeAvailable||parentBusy||childBusy.room||childBusy.lifecycle} onBusyChange={value=>setChildBusyFor('directory',value)} onCreated={companyCreated}/>
        <ControlResourceLifecycle operatorId={operatorId} kind="operator" available={storeAvailable} disabled={parentBusy||childBusy.room||childBusy.directory} refreshKey={resourcesRevision} onChanged={resourceChanged} onRefreshNeeded={resourceUncertain} onBusyChange={value=>setChildBusyFor('lifecycle',value)}/>
      </>:<>
        <ol className={styles.steps} aria-label="Arbetsgång för publicering">
          <li aria-current={!selectedOperator?'step':undefined}><span>1</span><div><strong>Välj bolag</strong><small>Rätt sammanhang</small></div></li>
          <li aria-current={selectedOperator&&(dirty||conflict)?'step':undefined}><span>2</span><div><strong>Redigera och spara</strong><small>Sammansättningens utkast</small></div></li>
          <li aria-current={selectedOperator&&!dirty&&!conflict?'step':undefined}><span>3</span><div><strong>Publicera</strong><small>Uppdatera spelrummen</small></div></li>
        </ol>
        <section className={styles.card} aria-label="Välj spelbolag">
          <div className={styles.contextLine}><label className={styles.field}>Spelbolag<select aria-label="Spelbolag" value={operatorId} disabled={interactionBusy||!listed.length} onChange={event=>chooseOperator(event.target.value)}>
            <option value="">Välj bolag</option>{listed.map(operator=><option key={operator.id} value={operator.id}>{operator.name}{(lifecycleStatuses[operator.id]??operator.status)==='suspended'?(lifecycleArchives[operator.id]?' · Arkiverat':' · Avstängt'):''}</option>)}
          </select></label><a className="sg-btn sg-btn-secondary" href={companyHref}>Bolag & team</a></div>
          {selectedOperator?<div className={styles.contextSummary}>
            <div><span className={styles.eyebrow}>VALT SPELBOLAG</span><h2>{selectedOperator.name}</h2>
              {selectedRoom?<p>Spelrum: <strong>{selectedRoom.name}</strong></p>:null}</div>
            <div className={styles.contextActions}><span className={styles.version}>{suspended?(archived?'Arkiverat':'Avstängt'):revision===null?'Ingen publicering ännu':'Senast publicerat · version '+revision}</span>
              {roomUnavailable?<p role="status">{!resourceSnapshot&&!resourceStale?'Kontrollerar det valda spelrummet…':'Det valda spelrummet är inte tillgängligt för det här bolaget. Välj ett aktuellt rum från Admin.'}</p>
                :<a href={'/lobby?'+new URLSearchParams({operator:selectedOperator.slug,...(selectedRoom?{room:selectedRoom.id}:{})})}>Öppna spellobbyn →</a>}
            </div>
          </div>:<p>Välj bolaget du vill arbeta med. Saknas det? <a href={labUrl('/admin/companies')}>Skapa ett spelbolag</a>.</p>}
        </section>
        {selectedOperator?<>
          {archived?<p className={styles.card}>Bolaget är arkiverat. <a href={companyHref}>Återställ bolaget under Bolag & team</a> för att fortsätta.</p>:null}
          {suspended&&!archived?<p className={styles.card}>Bolaget är avstängt. <a href={companyHref}>Granska bolagets åtkomst under Bolag & team</a>.</p>:null}
          {!suspended?<>
            <div className={styles.workflow}>
              <section className={styles.card} aria-label="Redigera och spara">
                <div className={styles.cardHeading}><div><span className={styles.eyebrow}>STEG 2</span><h2>Redigera och spara</h2></div>
                  <span className={styles.version} data-state={conflict?'conflict':dirty?'dirty':'saved'}>{conflict?'Versionskonflikt':saving?'Sparar…':dirty?'Osparade ändringar':'Sparad'}</span></div>
                {rows.length?<label className={styles.field}>Sammansättning<select aria-label="Sammansättning" value={selectedLane?.id??''} disabled={interactionBusy} onChange={event=>chooseComposition(event.target.value)}>{rows.map(row=><option key={row.id} value={row.id}>{row.label}{row.unsaved?' · Osparad':''}</option>)}</select></label>:<p>Det finns inga sparade sammansättningar. <a href={compositionHref}>Skapa en sammansättning</a> innan du skapar ett rum.</p>}
                {editableLane?<><label className={styles.field}>Namn på sammansättningen<input name="compositionLabel" value={editableLane.label} maxLength={100} disabled={writesOff||conflict}
                  onChange={event=>{if(writesOff||conflict||writeLock.current||Object.values(childLocks.current).some(Boolean))return;const label=event.target.value;updateProject(draft=>{const lane=draft.lanes?.find(item=>item.id===selectedLane.id);if(lane)lane.label=label;});setMessage('');}}/></label>
                  <p>En gemensam sammansättning kan användas av flera rum. <a href={compositionHref}>Redigera dealer, bord och bakgrund →</a></p>
                  <div className={styles.actions}><button type="button" className="sg-btn sg-btn-primary" disabled={!dirty||writesOff||conflict||!editableLane.label.trim()} onClick={()=>void saveComposition()}>{saving?'Sparar…':'Spara sammansättning'}</button></div>
                  {!editableLane.label.trim()?<p role="status">Ange ett namn innan du sparar.</p>:null}
                </>:null}
                {notice?<p role="status" className={styles.savedNotice}>{notice}</p>:null}
              </section>
              <section className={styles.card} aria-label="Publicera ändringar">
                <div className={styles.cardHeading}><div><span className={styles.eyebrow}>STEG 3</span><h2>Publicera för spelarna</h2></div></div>
                <p>Det sparade innehållet blir tillgängligt i bolagets spelrum först när du publicerar.</p>
                {needsRefresh?<p role="status" className={styles.problem}>Uppgifterna behöver kontrolleras. <button className="sg-btn sg-btn-secondary" type="button" disabled={interactionBusy} onClick={()=>setResourcesRevision(value=>value+1)}>Läs in aktuella uppgifter</button></p>:null}
                {!chosen.length?<p role="status">Välj minst en sammansättning för att publicera. Stäng spelutbudet genom att pausa eller arkivera spelrummen.</p>:null}
                <form id="operator-package-selection" className={styles.form} onSubmit={event=>void publish(event)}>
                  <fieldset className={styles.choices} disabled={writesOff||needsRefresh}><legend>Sammansättningar som bolaget får använda</legend>
                    {rows.map(row=><label className={styles.choice} key={row.id}><input type="checkbox" name="lanes" value={row.id} checked={chosen.includes(row.id)} disabled={row.unsaved}
                      onChange={event=>{const checked=event.target.checked;updatePackage(operatorId,current=>togglePackageLane(current,row.id,checked));}}/><span><strong>{row.label}</strong><br/>{row.dealers.map(id=>project.dealers.find(dealer=>dealer.id===id)?.label??id).join(', ')}{row.unsaved?' · Spara först':''}</span></label>)}
                    {chosen.filter(id=>!rows.some(row=>row.id===id)).map(id=><label className={styles.choice} key={id}><input type="checkbox" value={id} checked onChange={()=>updatePackage(operatorId,current=>({...current,chosen:current.chosen.filter(value=>value!==id),message:'',error:''}))}/><span>Sammansättning borttagen ur Studio · {id}. Avmarkera efter att berörda rum arkiverats.</span></label>)}
                  </fieldset>
                  <div className={styles.publishAction}><p role="status">{busy==='publish'?'Publicerar…':publicationStatus}</p>
                    <button className={message?"sg-btn sg-btn-secondary":"sg-btn sg-btn-primary"} type="submit" disabled={publishBlocked}>{busy==='publish'?'Publicerar…':message?'Publicera igen':'Publicera för '+selectedOperator.name}</button></div>
                </form>
                {message?<div className={styles.receipt} role="status"><strong>Publiceringen är bekräftad</strong><p>{message}</p></div>:null}
                <div className={styles.actions}><button type="button" className={message?"sg-btn sg-btn-primary":"sg-btn sg-btn-secondary"} disabled={interactionBusy||dirty||selectionDirty||roomDirty} onClick={()=>window.location.reload()}>Återöppna sparat läge</button>
                  {!roomUnavailable?<a href={'/partner/'+encodeURIComponent(selectedOperator.slug)+'/rooms'+(selectedRoom?'?'+new URLSearchParams({room:selectedRoom.id}):'')}>Öppna partnerportalen →</a>:null}</div>
              </section>
            </div>
            {selectedLane?<PresentationRoomCreate operator={selectedOperator} presentation={{id:selectedLane.id,label:selectedLane.label}} projectRevision={project.revision}
              projectSaved={!dirty&&!conflict&&!selectedLane.unsaved} storeAvailable={storeAvailable} disabled={conflict} interactionDisabled={parentBusy||childBusy.lifecycle||childBusy.directory} hideExisting
              onDraftChange={value=>{roomDraft.current=value;setRoomDirty(value);}} onBusyChange={value=>setChildBusyFor('room',value)} onCreated={receipt=>{updatePackage(receipt.room.operatorId,current=>({...current,revision:receipt.packageRevision,needsRefresh:true,message:'',error:''}));setResourcesRevision(value=>value+1);}}/>:null}
          </>:null}
        </>:null}
        <ControlResourceLifecycle operatorId={operatorId} kind="rooms" available={storeAvailable} disabled={parentBusy||childBusy.room||childBusy.directory} refreshKey={resourcesRevision} onChanged={resourceChanged} onRefreshNeeded={resourceUncertain} onBusyChange={value=>setChildBusyFor('lifecycle',value)}/>
      </>}
    </div>
  </PageTemplate>;
}
