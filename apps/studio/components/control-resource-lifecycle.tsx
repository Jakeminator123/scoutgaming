'use client';
import {useEffect,useRef,useState} from 'react';
import {labBasePath,labUrl} from '../lib/lab-url.mjs';
import styles from './control-resource-lifecycle.module.css';
import {ConfirmDialog} from '../client/admin/components/studio/confirm-dialog';

type Operator = {id:string;slug:string;name:string;status:string;lanes:string[];packageRevision:number|null;archivedAt:string|null;roomCount:number;archivedRoomCount:number};
type Room = {id:string;name:string;operatorId:string;presentationLaneId:string;state:string;archivedAt:string|null;packageRevision:number|null;published:boolean;canArchive:boolean;canRestore:boolean;restoreBlockers:string[]};
export type LifecycleSnapshot = {administrationRevision:string;operators:Operator[];rooms:Room[]};
export type ResourceLifecycleNavigation = {compositionHref:(operator:Operator,room:Room)=>string;rehearsalLabel?:string};
const blockers:Record<string,string> = {operator_archived:'Återställ bolaget först.',room_identity_in_use:'Ett annat rum använder samma identitet.',presentation_not_published:'Publicera rummets sammansättning först.',playback_configuration_changed:'Uppspelningsinställningarna behöver granskas.',playback_configuration_limit:'Gränsen för uppspelningsinställningar är nådd.',dealer_not_available:'Rummets dealer är inte tillgänglig.',presentation_incompatible:'Sammansättningen behöver anpassas för rummet.',room_limit:'Gränsen för antal rum är nådd.'};
export type RoomLifecycleRequest = {kind:'archive'|'state';roomId:string};
type Intent = {kind:'operator'|'room'|'state';operatorId:string;id:string;name:string;archived?:boolean;state?:'live'|'pending'};
const revision = (value:unknown) => value === null || Number.isSafeInteger(value) && Number(value)>0;
export function validLifecycleSnapshot(value:unknown):value is LifecycleSnapshot {
  const data=value as LifecycleSnapshot|null;
  return Boolean(data && typeof data.administrationRevision==='string' && data.administrationRevision
    && Array.isArray(data.operators) && data.operators.every(row=>row && typeof row.id==='string' && typeof row.slug==='string' && typeof row.name==='string'
      && ['active','suspended'].includes(row.status) && revision(row.packageRevision) && Array.isArray(row.lanes) && row.lanes.every(id=>typeof id==='string')
      && (row.archivedAt===null || typeof row.archivedAt==='string'))
    && Array.isArray(data.rooms) && data.rooms.every(row=>row && typeof row.id==='string' && typeof row.operatorId==='string' && typeof row.name==='string'
      && typeof row.presentationLaneId==='string' && revision(row.packageRevision) && (row.archivedAt===null || typeof row.archivedAt==='string')
      && typeof row.canArchive==='boolean' && typeof row.canRestore==='boolean' && Array.isArray(row.restoreBlockers)));
}

export function ControlResourceLifecycle({operatorId,kind,available,disabled=false,refreshKey=0,onChanged,onBusyChange,onRefreshNeeded,navigation,compact=false,archiveOnly=false,request,onRequestHandled}:{
  operatorId:string;kind:'operator'|'rooms';available:boolean;disabled?:boolean;refreshKey?:number;
  onChanged?:(snapshot:LifecycleSnapshot)=>void;onBusyChange?:(busy:boolean)=>void;onRefreshNeeded?:()=>void;
  navigation?:ResourceLifecycleNavigation; compact?:boolean; archiveOnly?:boolean; request?:RoomLifecycleRequest; onRequestHandled?:()=>void;
}) {
  const [snapshot,setSnapshot]=useState<LifecycleSnapshot|null>(null);
  const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[stale,setStale]=useState(false),[problem,setProblem]=useState(''),[notice,setNotice]=useState('');
  const [showArchive,setShowArchive]=useState(false),[intent,setIntent]=useState<Intent|null>(null),[reload,setReload]=useState(0);
  const lock=useRef(false),epoch=useRef(0),callbacks=useRef({onChanged,onBusyChange,onRefreshNeeded});
  callbacks.current={onChanged,onBusyChange,onRefreshNeeded};
  const endpoint=labBasePath()+'/api/admin/';
  async function read(signal?:AbortSignal) {
    const response=await fetch(endpoint+'resource-lifecycle',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal});
    if(!response.ok)throw Error('unavailable');
    const value:unknown=await response.json();
    if(!validLifecycleSnapshot(value))throw Error('invalid');
    return value;
  }
  useEffect(()=>{
    const ticket=++epoch.current,abort=new AbortController();
    setIntent(null);setProblem('');
    if(!available){setSnapshot(null);setLoading(false);callbacks.current.onBusyChange?.(false);return()=>abort.abort();}
    setLoading(true);callbacks.current.onBusyChange?.(true);
    void read(abort.signal).then(value=>{
      if(ticket!==epoch.current)return;
      setSnapshot(value);setStale(false);callbacks.current.onChanged?.(value);
    }).catch(()=>{
      if(!abort.signal.aborted&&ticket===epoch.current){setStale(true);setProblem('Spelrum och arkiv kunde inte hämtas. Försök igen.');callbacks.current.onRefreshNeeded?.();}
    }).finally(()=>{if(ticket===epoch.current){setLoading(false);callbacks.current.onBusyChange?.(false);}});
    return()=>{abort.abort();epoch.current++;};
    // This read includes every company. Changing selection must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[endpoint,available,refreshKey,reload]);
  useEffect(()=>{setIntent(null);setNotice('');},[operatorId]);
  useEffect(()=>()=>{epoch.current++;callbacks.current.onBusyChange?.(false);},[]);
  const operator=snapshot?.operators.find(row=>row.id===operatorId);
  const rooms=snapshot?.rooms.filter(row=>row.operatorId===operatorId)??[];
  const visible=rooms.filter(room=>Boolean(room.archivedAt)===(archiveOnly||showArchive));
  const writesOff=disabled||busy||loading||stale;
  useEffect(()=>{
    if(!request||!snapshot||writesOff)return;
    setIntent(null);setProblem('');setNotice('');
    const target=snapshot.rooms.find(row=>row.id===request.roomId&&row.operatorId===operatorId);
    if(request.kind==='state'&&target?.published&&operator?.status==='active'&&!target.archivedAt)setIntent({kind:'state',operatorId,id:target.id,name:target.name,state:target.state==='live'?'pending':'live'});
    else if(request.kind==='archive'&&target?.canArchive)setIntent({kind:'room',operatorId,id:target.id,name:target.name,archived:true});
    else setProblem('Spelet kan inte ändras just nu. Uppdatera och kontrollera bolaget.');
    onRequestHandled?.();
  },[request,snapshot,writesOff,operatorId,onRequestHandled]);

  async function apply() {
    if(!intent||!snapshot||!operator||intent.operatorId!==operatorId||lock.current||writesOff)return;
    const room=rooms.find(row=>row.id===intent.id);
    if(intent.kind==='operator' ? intent.id!==operatorId || (intent.archived ? operator.status!=='active' : !operator.archivedAt)
      : !room || (intent.kind==='room' ? intent.archived ? !room.canArchive : !room.canRestore : operator.status!=='active'||Boolean(room.archivedAt)))return;
    const action=intent.kind==='operator'?'operator-lifecycle':intent.kind==='room'?'room-lifecycle':'room-state';
    const body=intent.kind==='operator'?{operatorId,archived:intent.archived,expectedPackageRevision:operator.packageRevision,expectedAdministrationRevision:snapshot.administrationRevision}
      :{operatorId,roomId:intent.id,expectedAdministrationRevision:snapshot.administrationRevision,expectedPackageRevision:room!.packageRevision,...(intent.kind==='state'?{state:intent.state}:{archived:intent.archived})};
    const confirmsIntent=(value:unknown)=>{
      const target=value as Partial<Operator & Room>|null;
      if(!target||target.id!==intent.id)return false;
      const archived=intent.kind!=='state'&&intent.archived;
      if(archived ? typeof target.archivedAt!=='string'||!target.archivedAt : target.archivedAt!==null)return false;
      return intent.kind==='operator'?target.status===(archived?'suspended':'active')
        :target.operatorId===operatorId&&target.presentationLaneId===room!.presentationLaneId
          &&target.state===(intent.kind==='state'?intent.state:archived?'archived':'pending');
    };
    const ticket=epoch.current;
    lock.current=true;setBusy(true);callbacks.current.onBusyChange?.(true);setProblem('');setNotice('');
    try {
      const response=await fetch(endpoint+action,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(body)});
      const result=await response.json().catch(()=>null);
      const target=intent.kind==='operator'?result?.operator:result?.room;
      const administrationConfirmed=typeof result?.administrationRevision==='string'&&Boolean(result.administrationRevision)&&(intent.kind==='operator'||result.administrationRevision!==snapshot.administrationRevision);
      const packageConfirmed=revision(result?.packageRevision)&&result.packageRevision===(intent.kind==='state'?body.expectedPackageRevision:(body.expectedPackageRevision??0)+1);
      if(!response.ok||result?.ok!==true||!confirmsIntent(target)||!administrationConfirmed||!packageConfirmed)throw Error(result?.code==='studio_presentation_runtime_update_required'?'Spelmotorn behöver uppdateras innan bolag eller spelrum kan ändras.':response.status===409?'Uppgifterna har ändrats eller ett beroende hindrar åtgärden. Läs in aktuella uppgifter och försök igen.':'Ändringen kunde inte bekräftas. Läs in aktuella uppgifter innan du försöker igen.');
      if(ticket!==epoch.current)return;
      const value=await read();
      const nextOperator=value.operators.find(row=>row.id===operatorId);
      const nextTarget=intent.kind==='operator'?nextOperator:value.rooms.find(row=>row.id===intent.id&&row.operatorId===operatorId);
      if(!nextOperator||nextOperator.packageRevision!==result.packageRevision||!confirmsIntent(nextTarget)||nextTarget?.archivedAt!==target.archivedAt
        ||value.administrationRevision!==result.administrationRevision||(intent.kind!=='operator'&&nextTarget?.packageRevision!==result.packageRevision))throw Error('Ändringen är sparad men aktuella uppgifter kunde inte bekräftas. Uppdatera vyn innan du fortsätter.');
      if(ticket!==epoch.current)return;
      setSnapshot(value);setIntent(null);setStale(false);callbacks.current.onChanged?.(value);
      setNotice(intent.kind==='state'?(intent.state==='live'?'Spelrummet är öppet.':'Spelrummet är pausat.'):intent.archived?intent.name+(compact?' har tagits bort från bolagets utbud.':' är arkiverat.'):intent.kind==='room'?'Rummet är återställt och pausat. Öppna det när det är klart.':'Bolaget är återställt.');
    } catch(error){if(ticket===epoch.current){setStale(true);setIntent(null);setProblem(error instanceof Error&&!['invalid','unavailable'].includes(error.message)?error.message:'Ändringen kunde inte läsas tillbaka. Uppdatera vyn innan du fortsätter.');callbacks.current.onRefreshNeeded?.();}}
    finally {lock.current=false;if(ticket===epoch.current)setBusy(false);callbacks.current.onBusyChange?.(false);}
  }
  if(!available)return null;
  if(compact&&!problem&&!notice&&!intent)return null;
  if(compact)return <section aria-label="Ändra spel hos bolaget">
    {problem&&<p role="alert">{problem} <button className="sg-btn" type="button" disabled={loading||disabled} onClick={()=>setReload(value=>value+1)}>Uppdatera</button></p>}
    {notice&&<p role="status">{notice}</p>}
    {intent&&intent.operatorId===operatorId&&<fieldset className={styles.confirm} disabled={writesOff}><legend>{intent.kind==='state'?(intent.state==='live'?'Öppna ':'Pausa '):'Ta bort '}{intent.name} hos {operator?.name}?</legend><p>{intent.kind==='state'?(intent.state==='live'?'Spelet öppnas för bolagets spelare med sina publicerade inställningar.':'Spelet stängs tillfälligt för nya spelare. Inställningar och historik behålls.'):'Spelet försvinner från bolagets utbud och stängs för spelare. Gemensamma dealers, bord, bakgrunder och historik behålls. Spelet går att återställa.'}</p><div className={styles.actions}><button type="button" className="sg-btn sg-btn-primary" onClick={()=>void apply()}>{busy?'Sparar…':intent.kind==='state'?(intent.state==='live'?'Öppna spel':'Pausa spel'):'Ta bort spel'}</button><button type="button" className="sg-btn" onClick={()=>setIntent(null)}>Avbryt</button></div></fieldset>}
  </section>;
  if(!operatorId)return problem?<p role="alert">{problem} <button type="button" disabled={loading||disabled} onClick={()=>setReload(value=>value+1)}>Försök igen</button></p>:null;
  return <section className={styles.panel} aria-label={kind==='rooms'?'Bolagets spelrum':'Bolagets papperskorg'}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>{kind==='rooms'?'BOLAGETS SPELUTBUD':'HANTERA BOLAG'}</p><h2>{archiveOnly?'Borttagna spel':kind==='rooms'?'Spelrum':'Papperskorg & återställning'}</h2></div>
      <button className="sg-btn sg-btn-ghost" type="button" disabled={disabled||busy||loading} onClick={()=>setReload(value=>value+1)}>Uppdatera</button></header>
    {loading?<p role="status">Hämtar aktuella uppgifter…</p>:null}
    {problem?<p role="alert" className={styles.feedback}>{problem}</p>:null}
    {notice?<p role="status" className={styles.feedback}>{notice}</p>:null}
    {!loading&&snapshot&&!operator?<p role="status">Bolaget finns inte i den aktuella förteckningen.</p>:null}
    {kind==='rooms'&&operator?<>
      {!archiveOnly&&<div className={styles.tabs} role="group" aria-label="Visa spelrum"><button type="button" aria-pressed={!showArchive} onClick={()=>setShowArchive(false)}>Spelrum ({rooms.filter(room=>!room.archivedAt).length})</button><button type="button" aria-pressed={showArchive} onClick={()=>setShowArchive(true)}>Papperskorg ({rooms.filter(room=>room.archivedAt).length})</button></div>}
      {!visible.length?<p>{archiveOnly?'Inga borttagna spel.':showArchive?'Inga spelrum i papperskorgen.':'Inga spelrum ännu. Välj en mall nedan och skapa det första.'}</p>:<ul className={styles.rooms}>{visible.map(room=><li key={room.id} className={styles.room}>
        <div><h3>{room.name}</h3><p>{room.archivedAt?'I papperskorgen':room.state==='live'&&operator.status==='active'&&room.published?'Öppet för spelare':'Pausat'}</p></div>
        <div className={styles.actions}>
          {!room.archivedAt?<>
            <a className="sg-btn sg-btn-secondary" href={navigation?.compositionHref(operator,room)??labUrl('/admin/scenes?'+new URLSearchParams({operator:operator.id,composition:room.presentationLaneId}))}>Redigera sammansättning</a>
            {room.state==='live'&&operator.status==='active'&&room.published?<a className="sg-btn sg-btn-secondary" href={labUrl('/admin/rooms?'+new URLSearchParams({operator:operator.slug,table:room.id,composition:room.presentationLaneId}))}>{navigation?.rehearsalLabel??'Provspela & följ'}</a>:null}
            <button className="sg-btn sg-btn-secondary" type="button" disabled={writesOff||operator.status!=='active'||!room.published} onClick={()=>setIntent({kind:'state',operatorId,id:room.id,name:room.name,state:room.state==='live'?'pending':'live'})}>{room.state==='live'?'Pausa rum':'Öppna rum'}</button>
            <button className="sg-btn sg-btn-ghost" type="button" disabled={writesOff||!room.canArchive} onClick={()=>setIntent({kind:'room',operatorId,id:room.id,name:room.name,archived:true})}>Flytta till papperskorgen</button>
          </>:<button className="sg-btn sg-btn-secondary" type="button" disabled={writesOff||!room.canRestore} onClick={()=>setIntent({kind:'room',operatorId,id:room.id,name:room.name,archived:false})}>Återställ rum</button>}
        </div>
        {room.archivedAt&&!room.canRestore?<p>{room.restoreBlockers.map(code=>blockers[code]??'Rummets beroenden behöver granskas.').join(' ')}</p>:null}
      </li>)}</ul>}
    </>:kind==='operator'&&operator?<div className={styles.company}>
      <p>{operator.status==='active'?`Flytta bolaget och dess ${operator.roomCount} spelrum till papperskorgen. Rummen kopplas loss från den aktiva strukturen. Team, gemensamma media och historik bevaras.`:operator.archivedAt?'Bolaget ligger i papperskorgen. Team, media och publiceringshistorik finns kvar.':'Bolaget är avstängt sedan tidigare och kan inte återställas via arkivet.'}</p>
      {operator.status==='active'||operator.archivedAt?<button className="sg-btn sg-btn-secondary" type="button" disabled={writesOff} onClick={()=>setIntent({kind:'operator',operatorId,id:operator.id,name:operator.name,archived:operator.status==='active'})}>{operator.status==='active'?'Flytta bolag till papperskorgen':'Återställ bolag'}</button>:null}
    </div>:null}
    {intent&&intent.operatorId===operatorId?<ConfirmDialog open title={`${intent.kind==='state'?(intent.state==='live'?'Öppna':'Pausa'):intent.archived?'Flytta till papperskorgen:':'Återställ'} ${intent.name}`} danger={intent.kind!=='state'&&Boolean(intent.archived)}
      description={intent.kind==='operator'?(intent.archived?'Bolagets portal stängs och alla dess spelrum avpubliceras och flyttas till papperskorgen. Återställning sker uttryckligen, ett rum i taget.':'Bolagets åtkomst återställs. Spelrummen stannar i papperskorgen tills du återställer dem som pausade rum.'):intent.kind==='state'?(intent.state==='live'?'Rummet blir tillgängligt i bolagets spellobby.':'Rummet döljs från spellobbyn.'):intent.archived?'Rummet avpubliceras och flyttas till papperskorgen. Media och historik behålls.':'Rummet återställs som pausat, så att du kan granska det innan det öppnas.'}
      busy={busy} busyLabel="Sparar…" confirmLabel="Bekräfta" confirmDisabled={writesOff} onConfirm={()=>void apply()} onCancel={()=>setIntent(null)}/>:null}
  </section>;
}
