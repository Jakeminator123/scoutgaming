import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { buttonVariants, cn } from '../ui/kit';
import {lifecycleSnapshotKey, operatorLifecycleGroups} from '../../lib/studio-resource-lifecycle.mjs';
import {PartnerAppearanceLoader} from '../../../../components/partner-appearance-loader.mjs';
import type {AppearanceRoomStatus} from '../../../../components/partner-appearance';
import {ControlResourceLifecycle, type LifecycleSnapshot, type RoomLifecycleRequest} from '../../../../components/control-resource-lifecycle';
import {RoomGameConfig} from '../../../../components/room-game-config';
import {PresentationRoomCreate} from '../../../../components/presentation-room-create';
import {markPackagesStale, packageEditor, packageSelectionDirty, publishOperatorPackage, publishedPackageMessage, rebasePackageEditors, togglePackageLane, verifiedPackageRevision, packagePublishError} from '../../../../lib/operator-package-client.mjs';
import type {PackageEditor} from '../../../../lib/operator-package-client.mjs';
import {labBasePath} from '../../../../lib/lab-url.mjs';
import {compositionLabel} from '../../../../../../packages/navigation/control-flow.mjs';
import {useSearchParams} from '../../../runtime/navigation';
import {studioHistory} from '../../../../lib/studio-history.mjs';
import {navigationKeepsStudioTab} from '../../lib/connected-studio.mjs';

type Operator = { id: string; slug: string; name: string; status: string; archivedAt:string|null;packageRevision: number | null };
type Dealer = { id: string; name: string; archived: boolean };
type Room = { id: string; name: string; operatorId: string; game: string; state: string; compositionId: string;materialWarning?:string;
  laneId: string; published: boolean; playable: boolean; dealerIds: string[]; dealers: { id: string; name: string }[]; dealerSource: 'published' | 'saved'; playUrl: string | null;
  environment?: { kind: string; fixed: boolean; label: string; image?: string } | null };
type Composition = { id: string; name: string; dealerIds: string[]; defaultDealerId: string };
type Registry = { schemaVersion: 1; source: 'registered'; readAt: string; administration: {
  operators: Operator[]; dealers: Dealer[]; rooms: Room[];
  compositions: Composition[];
  revisions: { project: string; administration: string };
} };
type State = { status: 'loading' } | { status: 'error'; authentication: boolean } | { status: 'ready'; value: Registry };
const linkClass = 'inline-flex items-center gap-1 text-[13px] font-semibold text-sg-accent-text no-underline hover:underline';
const panelClass = 'rounded-xl border border-sg-border bg-sg-surface shadow-sg';
const ui = {
  message: 'rounded-lg bg-sg-surface-2 px-3.5 py-2.5 text-[13px] text-sg-muted',
  problem: 'rounded-lg bg-sg-warn-bg px-3.5 py-2.5 text-[13px] text-sg-warn [&_button]:ml-2',
  receipt: 'rounded-lg bg-sg-ok-bg px-3.5 py-2.5 text-[13px] text-sg-ok',
  unpublished: 'rounded-xl border border-dashed border-sg-border bg-sg-surface-2 px-5 py-6 text-center text-[13px] text-sg-muted [&_h3]:mb-1 [&_h3]:text-[14px] [&_h3]:font-semibold [&_h3]:text-sg-text',
  card: 'grid min-w-0 gap-4',
  choice: 'flex cursor-pointer items-start gap-3 rounded-xl border border-sg-border bg-sg-surface p-3.5 text-[13px] leading-snug transition-colors hover:bg-sg-surface-2 has-[:checked]:border-sg-text has-[:checked]:shadow-[0_0_0_2px_var(--sg-lime)] [&_input]:mt-0.5 [&_input]:size-4 [&_input]:accent-[var(--sg-ink)]',
  slot: 'empty:hidden',
};
const labels: Record<string, string> = { active: 'Aktivt', suspended: 'Avstängt', live: 'Öppet', preview: 'Förhandsvisning', pending: 'Pausat', draft: 'Utkast', archived: 'Arkiverat', blackjack: 'Blackjack', roulette: 'Roulette' };
// The game settings API accepts live blackjack rooms published on a composition in the package.
const gameSettingsRoom = (room: Room) => room.published && room.state === 'live' && room.game === 'blackjack';
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** The company's package (mode package), a new room (mode create) and the room editor (mode room, one
 *  section per tab). The company and room come from the nav's path, never from a dealer-library query. */
export type RegisteredStudioProps = { operatorId: string; roomId?: string; mode: 'package'|'create'|'room'; section?: 'appearance'|'game'|'state'; disabled?: boolean; onChanged?: () => void; onRoomStatus?: (status: AppearanceRoomStatus|null) => void };
export function RegisteredStudio({ operatorId, roomId = '', mode, section = 'appearance', disabled = false, onChanged, onRoomStatus }: RegisteredStudioProps) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [lifecycleBusy,setLifecycleBusy]=useState(false);
  const search = useSearchParams().toString();
  // One room draft at a time: a dirty or writing room editor locks its sibling, room creation,
  // the rooms lifecycle and the package publication, so nothing remounts over unsaved edits.
  const [roomDirty,setRoomDirty] = useState(false), [roomBusy,setRoomBusy] = useState(false);
  const [gameDirty,setGameDirty] = useState(false), [gameBusy,setGameBusy] = useState(false);
  const [createDraft,setCreateDraft] = useState(false), [createBusy,setCreateBusy] = useState(false);
  const [publishBusy,setPublishBusy] = useState(false);
  const publishLock = useRef(false);
  const [lifecycleRefresh,setLifecycleRefresh] = useState(0);
  const [lifecycleSnapshot,setLifecycleSnapshot] = useState<LifecycleSnapshot|null>(null);
  const lifecycleKey = useRef(''), lifecycleOps = useRef(new Set<string>());
  const [packages,setPackages] = useState<Record<string,PackageEditor>>({});
  const [roomStatus,setRoomStatus] = useState<AppearanceRoomStatus|null>(null);
  const [newRoomComposition,setNewRoomComposition] = useState('');
  const [roomRequest,setRoomRequest] = useState<RoomLifecycleRequest>();
  const anyBusy = roomBusy || gameBusy || createBusy || lifecycleBusy || publishBusy;
  // Package selections are retained per company; only mounted editors need a leave guard.
  const anyDraft = roomDirty || gameDirty || createDraft;
  function mayLeave() { return !anyBusy && (!anyDraft || confirm('Lämna spelbordets osparade val? Sparade utkast och publicerad version behålls.')); }
  function reload() { setRefresh(value => value + 1); setLifecycleRefresh(value => value + 1); }
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unload = (event:BeforeUnloadEvent) => { if(anyDraft || anyBusy){event.preventDefault();event.returnValue='';} };
    const leave = (event:Event) => { if(!mayLeave())event.preventDefault(); };
    const click = (event:MouseEvent) => {
      const anchor=(event.target as Element)?.closest?.('a');
      if(!anchor || event.defaultPrevented || navigationKeepsStudioTab(event,anchor))return;
      const url=new URL(anchor.href,location.origin);
      if(url.origin===location.origin && /^\/admin(?:\/|$)/.test(url.pathname) && url.pathname!=='/admin/lobby')return;
      if(!mayLeave()){event.preventDefault();event.stopPropagation();}
    };
    window.addEventListener('beforeunload',unload); window.addEventListener('scout:navigate',leave); document.addEventListener('click',click,true);
    return () => {window.removeEventListener('beforeunload',unload);window.removeEventListener('scout:navigate',leave);document.removeEventListener('click',click,true);};
  },[anyDraft,anyBusy]);
  useEffect(() => {
    const controller = new AbortController();
    // A re-read keeps the shown register until the new one arrives.
    setState(current => current.status === 'ready' ? current : { status: 'loading' });
    (async () => {
      try {
        const response = await fetch('/admin/_data/catalog', { credentials: 'same-origin', cache: 'no-store',
          redirect: 'error', headers: { accept: 'application/json' }, signal: controller.signal });
        if (!response.ok) { if (!controller.signal.aborted) setState({ status: 'error', authentication: [401, 403].includes(response.status) }); return; }
        const text = await response.text();
        if (text.length > 2 * 1024 * 1024) throw Error('catalog_size');
        const value = JSON.parse(text) as Registry;
        if (value.schemaVersion !== 1 || value.source !== 'registered' || !value.administration
          || !['operators', 'rooms', 'dealers', 'compositions'].every(key => Array.isArray(value.administration[key as 'operators']))) throw Error('catalog_shape');
        if (!controller.signal.aborted) setState({ status: 'ready', value });
      } catch { if (!controller.signal.aborted) setState({ status: 'error', authentication: false }); }
    })();
    return () => controller.abort();
  }, [refresh]);
  const complete=state.status==='ready'?state.value.administration:null;
  const groups=operatorLifecycleGroups(complete?.operators??[]);
  const data=complete?{...complete,operators:groups.active,
    rooms:complete.rooms.filter(room=>room.state!=='archived'&&groups.active.some(row=>row.id===room.operatorId))}:null;
  const operator = data?.operators.find(row => row.id === operatorId || row.slug === operatorId);
  const operatorRooms = data?.rooms.filter(row => row.operatorId === operator?.id) ?? [];
  const selectedRoom = roomId ? operatorRooms.find(row => row.id === roomId) : undefined;
  const dealerName = (id: string) => data?.dealers.find(row => row.id === id)?.name ?? id;
  const compositions = complete?.compositions ?? [];
  const createComposition = compositions.find(row => row.id === newRoomComposition) ?? compositions.find(row => row.id === operatorRooms[0]?.compositionId) ?? compositions[0];
  // Both room editors reload together on a register re-read; sibling keys stay distinct.
  const editorKey = operator && selectedRoom ? operator.id + ':' + selectedRoom.id + ':' + refresh : '';
  // Lifecycle snapshots carry the published package per company; a changed key re-reads the register.
  function lifecycleChanged(snapshot: LifecycleSnapshot) {
    const previous = lifecycleKey.current, key = lifecycleSnapshotKey(snapshot);
    lifecycleKey.current = key;
    setLifecycleSnapshot(snapshot);
    // An archived room leaves the editor for the company's room list.
    if(selectedRoom && snapshot.rooms.some(row=>row.id===selectedRoom.id&&row.operatorId===operator?.id&&row.archivedAt)){
      const href='/admin/companies/'+encodeURIComponent(operator?.id??'')+'?flik=spelbord', history=studioHistory(window);
      if(history.canNavigate(href))history.push(href,true);
    }
    setPackages(current => rebasePackageEditors(current, snapshot.operators));
    if (previous && previous !== key) { setRefresh(value => value + 1); onChanged?.(); }
  }
  function lifecycleUncertain() { setLifecycleSnapshot(null); setPackages(markPackagesStale); }
  function lifecycleOperation(key: string, value: boolean) {
    if (value) lifecycleOps.current.add(key); else lifecycleOps.current.delete(key);
    setLifecycleBusy(lifecycleOps.current.size > 0);
  }
  function updatePackage(id: string, update: (current: PackageEditor) => PackageEditor) {
    setPackages(current => ({ ...current, [id]: update(current[id] ?? packageEditor()) }));
  }
  // A room or game publication and a new room advance the company package; the editors reload on the new revision.
  function packageAdvanced(id: string, revision: number) {
    updatePackage(id, current => ({ ...current, revision, needsRefresh: true, message: '', error: '' }));
    setLifecycleRefresh(value => value + 1);
  }
  const operatorPackage = operator ? packages[operator.id] ?? packageEditor() : packageEditor();
  const selectionDirty = packageSelectionDirty(operatorPackage);
  const roomDraftBlocks = roomDirty || gameDirty;
  const publishBlocked = !operator || disabled || anyBusy || roomDraftBlocks || createDraft || operatorPackage.needsRefresh || !operatorPackage.chosen.length;
  // A published composition that Studio no longer has stays visible until it is unchecked; the package is never
  // republished over it. The PAOW idle refresh works on the frozen package and is not affected.
  const retiredChosen = operatorPackage.chosen.some(id => !compositions.some(row => row.id === id));
  const packageBlocked = publishBlocked || retiredChosen;
  const publicationStatus = operatorPackage.needsRefresh ? 'Läs in aktuell publicering' : disabled ? 'Spara det pågående arbetet först'
    : roomDraftBlocks ? 'Spara spelbordets ändringar först' : retiredChosen ? 'Avmarkera borttagna scenmallar först' : selectionDirty ? 'Urvalet är inte publicerat'
    : operatorPackage.message ? 'Publicerat · version ' + operatorPackage.revision : 'Redo att publicera';
  async function publishPackage() {
    if (!operator || packageBlocked || publishLock.current) return;
    const id = operator.id, lanes = [...operatorPackage.chosen], revision = operatorPackage.revision;
    publishLock.current = true; setPublishBusy(true);
    updatePackage(id, current => ({ ...current, message: '', error: '' }));
    try {
      const result = await publishOperatorPackage({ endpoint: labBasePath() + '/api/admin/operator-package', operatorId: id, lanes, revision, fetchImpl: fetch });
      if (!result.ok) { updatePackage(id, current => ({ ...current, needsRefresh: result.needsRefresh || current.needsRefresh, error: result.error })); return; }
      updatePackage(id, current => ({ ...current, chosen: lanes, baseline: lanes, revision: result.revision, needsRefresh: false, error: '', message: publishedPackageMessage(result.revision) }));
      setLifecycleRefresh(value => value + 1);
      onChanged?.();
    } finally { publishLock.current = false; setPublishBusy(false); }
  }
  async function publishPaowIdle() {
    if(!operator||!selectedRoom||publishBlocked||selectionDirty||publishLock.current)return;
    const id=operator.id,room=selectedRoom.id,revision=operatorPackage.revision,lanes=[...operatorPackage.baseline];
    publishLock.current=true;setPublishBusy(true);updatePackage(id,current=>({...current,message:'',error:''}));
    try {
      const response=await fetch(labBasePath()+'/api/admin/operator-package',{method:'POST',credentials:'same-origin',
        headers:{'content-type':'application/json',accept:'application/json'},
        body:JSON.stringify({action:'refresh-dealer-idle',operatorId:id,roomId:room,dealerId:'paow',expectedPackageRevision:revision})});
      const payload=await response.json().catch(()=>null);
      if(!response.ok)throw Error(packagePublishError(response.status,payload));
      const next=verifiedPackageRevision(payload,{operatorId:id,lanes,revision});
      if(next===null||payload?.idleRefreshed?.dealerId!=='paow'||payload.idleRefreshed.roomId!==room)throw Error('Publiceringskvittot kunde inte bekräftas. Läs in aktuella uppgifter.');
      updatePackage(id,current=>({...current,revision:next,needsRefresh:false,error:'',message:`PAOWs sparade viloklipp är publicerade. Version ${next}.`}));
      setLifecycleRefresh(value=>value+1);onChanged?.();
    } catch(error) {updatePackage(id,current=>({...current,needsRefresh:true,error:error instanceof Error?error.message:'Publiceringen kunde inte bekräftas. Läs in aktuella uppgifter.'}));}
    finally {publishLock.current=false;setPublishBusy(false);}
  }
  const lifecycleNavigation = {
    compositionHref: (_owner: {id:string}, room: {id:string;presentationLaneId:string}) => '/admin/scenes?' + new URLSearchParams({ tab:'mallar', composition: room.presentationLaneId, table: room.id }),
    rehearsalLabel: 'Öppna spelbordet',
  };
  const liveLabel = (value: string|null, label: string) => value ? label : '–';
  const reloadButton=<button type="button" disabled={state.status === 'loading'||anyBusy||anyDraft} onClick={reload} className={buttonVariants({size:'sm'})}><RefreshCw aria-hidden="true"/> Uppdatera</button>;
  // The published package revision (the publish precondition) and the room archive are read through the rooms
  // lifecycle, as on the retired /admin/rooms page. One reader per mount; compact, it stays silent until it has
  // a notice or a pending request. Tillgänglighet shows it in its own slot; every other mode mounts it last.
  const lifecycleReader = operator && (mode !== 'room' || selectedRoom) ? <div id="room-lifecycle" className={ui.slot}>
    <ControlResourceLifecycle operatorId={operator.id} kind="rooms" available refreshKey={lifecycleRefresh} compact request={roomRequest} onRequestHandled={()=>setRoomRequest(undefined)}
      disabled={disabled||roomBusy||gameBusy||createBusy||publishBusy||anyDraft} onChanged={lifecycleChanged} onRefreshNeeded={lifecycleUncertain} onBusyChange={value=>lifecycleOperation('rooms',value)} navigation={lifecycleNavigation}/>
  </div> : null;
  const stateSection = mode === 'room' && section === 'state';
  return <>
    <section className="flex min-w-0 flex-1 flex-col gap-5" aria-live="polite">
      {state.status === 'loading' ? <p role="status" className="text-sm text-sg-muted">Läser bolag, spelbord och dealers…</p>
        : state.status === 'error' ? <div role="alert" className={cn(panelClass, 'p-6')}>
          <h2 className="font-semibold">{state.authentication ? 'Inloggning krävs' : 'Uppgifterna kunde inte läsas'}</h2>
          <p className="my-3 text-sm text-sg-muted">{state.authentication ? 'Din interna session saknas eller har gått ut. Öppna administrationen igen för att logga in.' : 'Kontrollera anslutningen till Studio. Inga exempeldata har ersatt de saknade uppgifterna.'}</p>
          <a href="/admin" className={linkClass}>Öppna administrationen igen <ArrowUpRight size={13} /></a>
        </div> : data && !operator ? <p role="alert" className={ui.message}>Bolaget {operatorId} finns inte bland de aktiva bolagen.</p>
        : data && operator && <>
          {mode==='room' && <>
            {roomId&&!selectedRoom&&<p role="alert" className={ui.message}>Spelbordet finns inte hos detta aktiva bolag.</p>}
            {selectedRoom&&<>
              {disabled&&<p role="status" className={ui.message}>Spara det pågående arbetet innan du ändrar spelbordets val.</p>}
              {section==='appearance'&&<>
                {selectedRoom&&roomStatus&&roomStatus.roomId===selectedRoom.id&&<dl className="m-0 flex flex-wrap items-center gap-2 text-[12.5px] text-sg-muted" aria-label="Publicerat nu"><div className="flex items-center gap-2"><dt className="inline-flex items-center gap-1.5 font-semibold text-sg-text"><span className="size-1.5 rounded-full bg-sg-ok" aria-hidden="true"/>Publicerat nu</dt><dd className="m-0">{liveLabel(roomStatus.live.background,roomStatus.labels.background)} · {liveLabel(roomStatus.live.dealer,roomStatus.labels.dealer)} · {liveLabel(roomStatus.live.table,roomStatus.labels.table)}</dd></div></dl>}
                {selectedRoom.published ? <PartnerAppearanceLoader key={'layers:'+editorKey} apiBase="/studio/api/partner" operatorId={operator.id} operatorSlug={operator.slug} roomId={selectedRoom.id} roomLayout adminChoices disabled={disabled||lifecycleBusy||gameBusy||gameDirty||createBusy||publishBusy} onDirtyChange={setRoomDirty} onBusyChange={setRoomBusy} onStatus={status=>{setRoomStatus(status);onRoomStatus?.(status);}} onSaved={(saved:{operatorId:string;packageRevision:number})=>{packageAdvanced(saved.operatorId,saved.packageRevision);onChanged?.();}}/>
                  : <div className={ui.unpublished} role="status"><h3>Spelbordet saknar ett publicerat paket</h3><p>Utseendet kan väljas när bolagets scenmallar är publicerade under Bolag › Tilldelning.</p></div>}
                <details className="group rounded-xl border border-dashed border-sg-border px-4 py-3 text-[13px] text-sg-muted" aria-label="Publicera (tills steg D)"><summary className="cursor-pointer select-none font-semibold text-sg-muted hover:text-sg-text">Publicera (tills steg D)</summary>
                  <div className="mt-2 grid gap-2"><p className="m-0">Utseendet publiceras med editorns egna knappar, spelinställningarna under sin flik och tilldelningen under bolaget. En gemensam publicering för hela spelbordet kommer i steg D.</p>
                  {gameSettingsRoom(selectedRoom)&&selectedRoom.dealerIds.includes('paow')&&<><p className="m-0">Uppdatera PAOWs sparade vilosekvens i bolagets publicerade spelbord. Övriga publicerade val och placeringar behålls.</p>
                    <p className="m-0"><button type="button" className={buttonVariants({size:'sm'})} disabled={publishBlocked||selectionDirty} onClick={()=>void publishPaowIdle()}>{publishBusy?'Publicerar…':'Publicera PAOWs viloklipp'}</button></p>
                    {operatorPackage.message&&<p role="status" className="m-0">{operatorPackage.message}</p>}{operatorPackage.error&&<p role="alert" className="m-0 text-sg-warn">{operatorPackage.error}</p>}</>}
                </div></details>
              </>}
              {section==='game'&&(gameSettingsRoom(selectedRoom)?<RoomGameConfig key={'game:'+editorKey} operatorId={operator.id} roomId={selectedRoom.id} roomName={selectedRoom.name}
                disabled={disabled||lifecycleBusy||roomBusy||roomDirty||createBusy||publishBusy} onBusyChange={setGameBusy} onDirtyChange={setGameDirty}
                onPublished={receipt=>{packageAdvanced(receipt.operatorId,receipt.packageRevision);onChanged?.();}}/>
                :<div className={ui.unpublished} role="status"><h3>Spelinställningar kan sättas när spelbordet är öppet och publicerat</h3><p>Spelinställningar (språk, insatsprofil) gäller öppna, publicerade blackjack-spelbord. Öppna spelbordet under Tillgänglighet och publicera tilldelningen först.</p></div>)}
              {section==='state'&&<div className={ui.slot}>
                {selectedRoom.published&&<p className="m-0 flex flex-wrap items-center gap-3"><button type="button" className={buttonVariants({variant:selectedRoom.state==='live'?'secondary':'primary'})} disabled={disabled||anyBusy||anyDraft} onClick={()=>{setRoomRequest({kind:'state',roomId:selectedRoom.id});scrollTo('room-lifecycle');}}>{selectedRoom.state==='live'?'Pausa spelbordet':'Öppna spelbordet'}</button><span className="text-xs text-sg-muted">Pausa gäller direkt. Pågående rundor spelas klart.</span></p>}
                {lifecycleReader}
                {selectedRoom.playUrl&&<p><a href={selectedRoom.playUrl} target="_blank" rel="noopener" className={linkClass}>Öppna spelbordet i spelet <ArrowUpRight size={13} aria-hidden="true"/></a></p>}
              </div>}
              {selectedRoom.materialWarning&&<p role="note" className={ui.problem}>Fryst spelåtkomst behålls. Granska materialets katalogtagg och spelets bordsgrafik före nästa publicering.</p>}
            </>}
          </>}
          {mode==='package' && <section id="room-publication" className={cn(panelClass,ui.card,'p-5')} aria-label="Tilldelning">
            <header className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="m-0 text-[15px] font-semibold">Scenmallar som {operator.name} får använda</h3><p className="mb-0 mt-1 max-w-[70ch] text-[13px] text-sg-muted">Dealers, bakgrunder och bordsgrafik följer med via scenmallarna. Varje publicering blir en ny version av bolagets tilldelning.</p></div>
              <span className="whitespace-nowrap rounded-full border border-sg-border px-2.5 py-1 text-xs font-semibold text-sg-muted">{operator.packageRevision===null&&operatorPackage.revision===null?'Ingen publicering ännu':'Senast publicerat · version '+(operatorPackage.revision??operator.packageRevision)}</span></header>
            {operatorPackage.needsRefresh&&<p role="status" className={ui.problem}>Uppgifterna behöver kontrolleras. <button type="button" className={buttonVariants({size:'sm'})} disabled={anyBusy} onClick={reload}>Läs in aktuella uppgifter</button></p>}
            {!compositions.length&&<p role="status" className={ui.message}>Det finns inga sparade scenmallar. <a className={linkClass} href="/admin/scenes?tab=mallar">Skapa en scenmall</a> innan du skapar ett spelbord.</p>}
            {!operatorPackage.chosen.length&&compositions.length>0&&<p role="status" className={ui.message}>Välj minst en scenmall för att publicera. Stäng bolagets spel genom att pausa eller arkivera spelborden.</p>}
            <form onSubmit={event=>{event.preventDefault();void publishPackage();}}>
              <fieldset className="m-0 grid min-w-0 gap-2.5 border-0 p-0 sm:grid-cols-2 2xl:grid-cols-3" disabled={disabled||anyBusy||operatorPackage.needsRefresh}><legend className="mb-2 p-0 text-[13px] font-semibold text-sg-muted">Scenmallar som bolaget får använda</legend>
                {compositions.map(row=><label className={ui.choice} key={row.id}><input type="checkbox" name="lanes" value={row.id} checked={operatorPackage.chosen.includes(row.id)}
                  onChange={event=>{const checked=event.target.checked;updatePackage(operator.id,current=>togglePackageLane(current,row.id,checked));}}/><span className="min-w-0"><strong className="block text-sg-text">{compositionLabel(row.name)}</strong><span className="text-sg-muted">{row.dealerIds.map(dealerName).join(', ')||'Inga dealers'}{operatorRooms.some(room=>room.compositionId===row.id)?' · används av '+operatorRooms.filter(room=>room.compositionId===row.id).map(room=>room.name).join(', '):''}</span></span></label>)}
                {operatorPackage.chosen.filter(id=>!compositions.some(row=>row.id===id)).map(id=><label className={ui.choice} key={id}><input type="checkbox" value={id} checked onChange={()=>updatePackage(operator.id,current=>togglePackageLane(current,id,false))}/><span>En borttagen scenmall. Avmarkera den när berörda spelbord har arkiverats.</span></label>)}
              </fieldset>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-sg-line-2 pt-4"><p role="status" className="m-0 text-[13px] text-sg-muted">{publishBusy?'Publicerar…':publicationStatus}</p>
                <button className={buttonVariants({variant:operatorPackage.message?'secondary':'primary'})} type="submit" disabled={packageBlocked}>{publishBusy?'Publicerar…':operatorPackage.message?'Publicera igen':'Publicera för '+operator.name}</button></div>
            </form>
            {operatorPackage.error&&<p role="alert" className={ui.problem}>{operatorPackage.error}</p>}
            {operatorPackage.message&&<p role="status" className={ui.receipt}><strong className="font-semibold">Publiceringen är bekräftad.</strong> {operatorPackage.message}</p>}
            <p className="m-0 flex flex-wrap items-center gap-3"><a href={'/partner/'+encodeURIComponent(operator.slug)+'/rooms'} className={linkClass}>Öppna Partnerportalen ↗</a> {reloadButton}</p>
          </section>}
          {mode==='create' && complete && <div id="room-create" className={ui.card}><div><h2 className="m-0 text-[15px] font-semibold">Nytt spelbord hos {operator.name}</h2></div>
            {compositions.length>0&&<label className="grid max-w-sm gap-1.5 text-[13px] font-semibold">Scenmall<select className="h-9 rounded-lg border border-sg-border bg-sg-surface px-2.5 font-normal text-sg-text" aria-label="Scenmall" value={createComposition?.id??''} disabled={anyBusy||createDraft} onChange={event=>setNewRoomComposition(event.target.value)}>
              {compositions.map(row=><option key={row.id} value={row.id}>{compositionLabel(row.name)}{operatorPackage.baseline.includes(row.id)?'':' · inte publicerad'}</option>)}
            </select></label>}
            <PresentationRoomCreate operator={{id:operator.id,slug:operator.slug,name:operator.name}} presentation={createComposition?{id:createComposition.id,label:compositionLabel(createComposition.name)}:null}
              projectRevision={complete.revisions.project} projectSaved={!disabled} storeAvailable hideExisting visual
              interactionDisabled={lifecycleBusy||roomBusy||gameBusy||publishBusy||roomDraftBlocks}
              onDraftChange={setCreateDraft} onBusyChange={setCreateBusy}
              onCreated={receipt=>{packageAdvanced(receipt.room.operatorId,receipt.packageRevision);reload();onChanged?.();const href='/admin/rooms/'+encodeURIComponent(receipt.room.id);const history=studioHistory(window);if(history.canNavigate(href))history.push(href,true);}}/>
            <p className="text-xs text-sg-muted">Spelbordet är pausat tills du publicerar tilldelningen och öppnar det under Tillgänglighet.</p>
          </div>}
          {!stateSection&&lifecycleReader}
        </>}
      <footer className="mt-auto border-t border-sg-line-2 pt-3 text-xs text-sg-faint">{state.status === 'ready' ? `Uppgifterna lästa ${new Date(state.value.readAt).toLocaleString('sv-SE')}` : 'Datastatus visas ovan'}{lifecycleSnapshot?' · Paket och livscykel lästa':''}</footer>
    </section>
  </>;
}
