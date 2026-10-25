import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Building2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './registered-studio.module.css';
import {OperatorGameBoard} from './operator-game-board';
import {RegisteredResourceLifecycle} from './registered-resource-lifecycle';
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
import {adminRoomHref} from '../../../runtime/admin-routing.mjs';
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
const linkClass = 'inline-flex items-center gap-1 text-xs text-sg-lime hover:underline';
const panelClass = 'rounded-lg border border-sg-line bg-sg-panel';
const labels: Record<string, string> = { active: 'Aktivt', suspended: 'Avstängt', live: 'Öppet', preview: 'Förhandsvisning', pending: 'Väntar', draft: 'Utkast', archived: 'Arkiverat', blackjack: 'Blackjack', roulette: 'Roulette' };
function workspaceLink(path: string, operator?: Operator, room?: Room) {
  const params = new URLSearchParams();
  if (operator) params.set('operator', operator.id);
  if (room) { params.set('table', room.id); params.set('composition', room.compositionId); params.set('game', room.game); }
  return path + (params.size ? '?' + params : '');
}
const connectedPaths = new Set(['/admin/admin/operators', '/admin/rooms']);
// The game settings API accepts live blackjack rooms published on a composition in the package.
const gameSettingsRoom = (room: Room) => room.published && room.state === 'live' && room.game === 'blackjack';
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export function RegisteredStudio({ path, title,disabled=false,onChanged }: { path: string; title: string;disabled?:boolean;onChanged?:()=>void }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [companyView,setCompanyView]=useState<'active'|'trash'|'suspended'>('active');
  const [lifecycleBusy,setLifecycleBusy]=useState(false);
  const search = useSearchParams().toString();
  const query = new URLSearchParams(search);
  const operatorId = query.get('operator') ?? '', game = query.get('game') ?? '', roomId = query.get('table') ?? '';
  const roomView = path === '/admin/rooms';
  // One room draft at a time: a dirty or writing room editor locks its sibling, room creation,
  // the rooms lifecycle and the package publication, so nothing remounts over unsaved edits.
  const [roomDirty,setRoomDirty] = useState(false), [roomBusy,setRoomBusy] = useState(false);
  const [gameDirty,setGameDirty] = useState(false), [gameBusy,setGameBusy] = useState(false);
  const [createDraft,setCreateDraft] = useState(false), [createBusy,setCreateBusy] = useState(false);
  const [publishBusy,setPublishBusy] = useState(false);
  const publishLock = useRef(false);
  const [showLifecycle,setShowLifecycle] = useState(false);
  const [lifecycleRefresh,setLifecycleRefresh] = useState(0);
  const [lifecycleSnapshot,setLifecycleSnapshot] = useState<LifecycleSnapshot|null>(null);
  const lifecycleKey = useRef(''), lifecycleOps = useRef(new Set<string>());
  const [packages,setPackages] = useState<Record<string,PackageEditor>>({});
  const [roomStatus,setRoomStatus] = useState<AppearanceRoomStatus|null>(null);
  const [newRoomComposition,setNewRoomComposition] = useState('');
  const [showCreate,setShowCreate] = useState(false);
  const [roomRequest,setRoomRequest] = useState<RoomLifecycleRequest>();
  const [confirmedNavigation,setConfirmedNavigation] = useState<Record<string,string>|null>(null);
  const anyBusy = roomBusy || gameBusy || createBusy || lifecycleBusy || publishBusy;
  // Package selections are retained per company; only mounted editors need a leave guard.
  const anyDraft = roomDirty || gameDirty || createDraft;
  function mayLeave() { return !anyBusy && (!anyDraft || confirm('Lämna rummets osparade val? Sparade utkast och publicerad version behålls.')); }
  function selectContext(next: Record<string,string>) {
    if (!showCreate && selectedRoom && next.table === selectedRoom.id && next.operator === operator?.id) return;
    const params = new URLSearchParams(search);
    for (const key of ['operator','game','table','composition','lane','dealer']) params.delete(key);
    for (const [key,value] of Object.entries(next)) if(value)params.set(key,value);
    const href = path + (params.size ? '?' + params : '');
    const history = studioHistory(window);
    if (!history.canNavigate(href) || !history.push(href,true)) return;
    setRoomDirty(false); setGameDirty(false); setShowLifecycle(false); setShowCreate(false); setRoomRequest(undefined);
  }
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
  // A verified write settles its busy/draft callbacks before navigation guards run.
  useEffect(()=>{
    if(!confirmedNavigation||anyBusy||anyDraft)return;
    selectContext(confirmedNavigation);
    setConfirmedNavigation(null);
  },[confirmedNavigation,anyBusy,anyDraft]);
  useEffect(() => {
    if (!roomView || !query.has('dealer') || anyDraft || anyBusy || disabled) return;
    const history = studioHistory(window), href = adminRoomHref(search, window.location.hash);
    if (history.canNavigate(href)) history.push(href, true);
  }, [roomView, search, anyDraft, anyBusy, disabled]);
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
  const data=complete?{...complete,operators:path==='/admin/admin/operators'?groups[companyView]:groups.active,
    rooms:complete.rooms.filter(room=>room.state!=='archived'&&groups.active.some(row=>row.id===room.operatorId))}:null;
  const requestedOwner = roomId ? data?.rooms.find(row => row.id === roomId)?.operatorId : undefined;
  const operator = operatorId ? data?.operators.find(row => row.id === operatorId)
    : roomId ? data?.operators.find(row => row.id === requestedOwner) : data?.operators[0];
  const operatorRooms = data?.rooms.filter(row => row.operatorId === operator?.id) ?? [];
  const requestedRoom=operatorRooms.find(row=>row.id===roomId);
  const selectedGame=requestedRoom?.game??(operatorRooms.some(row=>row.game===game)?game:operatorRooms[0]?.game??'');
  const gameRooms=roomView ? operatorRooms : operatorRooms.filter(row=>row.game===selectedGame);
  const selectedRoom = roomId ? gameRooms.find(row => row.id === roomId) : gameRooms[0];
  const dealerName = (id: string) => data?.dealers.find(row => row.id === id)?.name ?? id;
  const editHref = workspaceLink('/admin/clips', operator, selectedRoom) + '&panel=layers';
  const compositions = complete?.compositions ?? [];
  const createComposition = compositions.find(row => row.id === newRoomComposition) ?? compositions.find(row => row.id === selectedRoom?.compositionId) ?? compositions[0];
  // Both room editors reload together on a register re-read; sibling keys stay distinct.
  const editorKey = operator && selectedRoom ? operator.id + ':' + selectedRoom.id + ':' + refresh : '';
  // Lifecycle snapshots carry the published package per company; a changed key re-reads the register.
  function lifecycleChanged(snapshot: LifecycleSnapshot) {
    const previous = lifecycleKey.current, key = lifecycleSnapshotKey(snapshot);
    lifecycleKey.current = key;
    setLifecycleSnapshot(snapshot);
    if(selectedRoom && snapshot.rooms.some(row=>row.id===selectedRoom.id&&row.operatorId===operator?.id&&row.archivedAt)) setConfirmedNavigation({operator:operator?.id??''});
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
  const publicationStatus = operatorPackage.needsRefresh ? 'Läs in aktuell publicering' : disabled ? 'Spara det pågående Studio-arbetet först'
    : roomDraftBlocks ? 'Spara rummets ändringar först' : selectionDirty ? 'Urvalet är inte publicerat'
    : operatorPackage.message ? 'Publicerat · version ' + operatorPackage.revision : 'Redo att publicera';
  async function publishPackage() {
    if (!operator || publishBlocked || publishLock.current) return;
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
    compositionHref: (owner: {id:string}, room: {id:string;presentationLaneId:string}) => {
      const params = new URLSearchParams({ operator: owner.id, table: room.id, composition: room.presentationLaneId });
      const context = data?.rooms.find(row => row.id === room.id && row.operatorId === owner.id && row.compositionId === room.presentationLaneId);
      if (context) params.set('game', context.game);
      return '/admin/clips?' + params;
    },
    rehearsalLabel: 'Provspela & följ',
  };
  const liveLabel = (value: string|null, label: string) => value ? label : '–';
  return <>
    {!roomView&&<nav aria-label="Registrerad struktur" className={cn("flex flex-wrap items-center gap-3 border-b border-sg-line bg-sg-panel/60 px-6 py-3 text-xs",roomView&&styles.context)}>
      <label className="flex items-center gap-2 text-sg-muted">Spelbolag
        <select aria-label="Välj spelbolag" className="max-w-48 rounded border border-sg-line bg-sg-bg p-1.5 text-sg-text" value={operator?.id ?? ''} disabled={!data?.operators.length||anyBusy}
          onChange={event => selectContext({operator:event.target.value})}>
          {!operator && <option value="">{data?.operators.length ? 'Välj ett aktivt bolag' : 'Inga val tillgängliga'}</option>}
          {data?.operators.map(row => <option value={row.id} key={row.id}>{row.name}</option>)}
        </select>
      </label>{!roomView && <><span className="text-sg-muted" aria-hidden>›</span>
      <label className="flex items-center gap-2 text-sg-muted">Spel
        <select aria-label="Välj spel" className="max-w-48 rounded border border-sg-line bg-sg-bg p-1.5 text-sg-text" value={selectedGame} disabled={!operatorRooms.length||anyBusy} onChange={event=>selectContext({operator:operator?.id??'',game:event.target.value})}>
          {!operatorRooms.length&&<option value="">Inga spel registrerade</option>}
          {[...new Set(operatorRooms.map(row=>row.game))].map(id=><option key={id} value={id}>{labels[id]??id}</option>)}
        </select>
      </label></>}<span className="text-sg-muted" aria-hidden>›</span>
      <label className="flex items-center gap-2 text-sg-muted">Rum
        <select aria-label="Välj rum" className="max-w-48 rounded border border-sg-line bg-sg-bg p-1.5 text-sg-text" value={selectedRoom?.id ?? ''} disabled={!gameRooms.length||anyBusy} onChange={event => {const next=operatorRooms.find(row=>row.id===event.target.value);if(next)selectContext({operator:operator?.id??'',table:next.id,composition:next.compositionId,game:next.game});}}>
          {!selectedRoom && <option value="">{gameRooms.length ? 'Välj ett rum' : 'Inga rum registrerade'}</option>}
          {gameRooms.map(row => <option value={row.id} key={row.id}>{row.name}{roomView ? ` · ${labels[row.game]??row.game}` : ''}</option>)}
        </select>
      </label>
      <a href="/lobby" className={cn(linkClass, 'ml-auto')}>Öppna spellobbyn <ArrowUpRight size={13} /></a>
    </nav>}
    <section className={cn("flex flex-1 flex-col gap-6 px-6 py-5",roomView&&styles.roomPage)}>
      <header className={cn("flex flex-wrap items-start justify-between gap-4",roomView&&styles.pageHeader)}>
        <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sg-lime">{roomView?'Verksamhet':'Spelbolag'}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{roomView ? 'Spelutbud' : title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-sg-muted">{roomView ? 'Välj bolag. Lägg till spel och forma det spelaren möter.' : 'Registrerade spelbolag och rum. Team och publicering nås via bolagets länkar.'}</p>
        </div>
        <div className="flex items-center gap-3">{roomView&&operator&&<button type="button" className={linkClass} aria-expanded={showLifecycle} disabled={anyBusy||anyDraft} onClick={()=>setShowLifecycle(value=>!value)}>Återställ borttaget spel</button>}<button type="button" disabled={state.status === 'loading'||anyBusy||anyDraft} onClick={reload} className="inline-flex items-center gap-2 rounded border border-sg-line px-3 py-2 text-xs disabled:opacity-50"><RefreshCw size={13} /> Uppdatera</button></div>
      </header>
      {complete&&path==='/admin/admin/operators'&&<div role="group" aria-label="Bolagsvy">{(['active','trash','suspended'] as const).map(view=><button key={view} className="studio-button" aria-pressed={companyView===view} disabled={lifecycleBusy} onClick={()=>{if(mayLeave()){setCompanyView(view);selectContext({});}}}>{({active:'Aktiva bolag',trash:'Papperskorg',suspended:'Avstängda bolag'})[view]} ({groups[view].length})</button>)}</div>}
      {!connectedPaths.has(path) ? <div className={cn(panelClass, 'p-6')}>
        <h2 className="font-semibold">{title} ansluts i nästa steg</h2>
        <p className="my-3 text-sm text-sg-muted">Den här delen har ännu ingen datakoppling. Exempelsiffror och simulerade ändringar visas inte bland de registrerade uppgifterna.</p>
        <a className={linkClass} href="/admin">Öppna administrationens översikt <ArrowUpRight size={13} /></a>
      </div> : state.status === 'loading' ? <p role="status" className="text-sm text-sg-muted">Läser spelbolag, rum och dealers…</p>
        : state.status === 'error' ? <div role="alert" className={cn(panelClass, 'p-6')}>
          <h2 className="font-semibold">{state.authentication ? 'Inloggning krävs' : 'Registret är inte tillgängligt'}</h2>
          <p className="my-3 text-sm text-sg-muted">{state.authentication ? 'Din interna session saknas eller har gått ut. Öppna administrationen igen för att logga in.' : 'Kontrollera anslutningen till Studio. Lokal offlinekörning har inte tillgång till produktionsregistret. Inga exempeldata har ersatt de saknade uppgifterna.'}</p>
          <a href="/admin" className={linkClass}>Öppna administrationen igen <ArrowUpRight size={13} /></a>
        </div> : data && <>
          {!roomView && <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
            ['Aktiva spelbolag', groups.active.length], ['Rum', data.rooms.length], ['Aktiva dealers', data.dealers.filter(row => !row.archived).length], ['Spelbara rum', data.rooms.filter(row => row.playable).length],
          ].map(([label, count]) => <div key={label} className={cn(panelClass, 'px-4 py-3')}><dt className="font-mono text-[10px] uppercase tracking-wider text-sg-muted">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{count}</dd></div>)}</dl>}
          {path === '/admin/admin/operators' ? <ul className="grid gap-3 sm:grid-cols-2">
            {!data.operators.length && <li className="text-sm text-sg-muted">Inga spelbolag är registrerade.</li>}
            {data.operators.map(row => <li key={row.id} className={cn(panelClass, 'p-4')}><Building2 size={20} className="mb-3 text-sg-lime" /><h2 className="font-semibold">{row.name}</h2><p className="my-2 text-xs text-sg-muted">{row.archivedAt?'I papperskorgen':labels[row.status] ?? row.status} · {data.rooms.filter(room => room.operatorId === row.id).length} rum · {row.packageRevision === null ? 'Inget publicerat paket' : `Paket ${row.packageRevision}`}</p><div className="mt-4 flex flex-wrap gap-4"><a className={linkClass} href={workspaceLink('/admin/companies', row)}>Bolag & team ↗</a>{row.status === 'active' && <a className={linkClass} href={'/partner/' + encodeURIComponent(row.slug)}>Spelbolagsportal ↗</a>}</div></li>)}
          </ul> : roomView ? <div className={styles.operatorWorkspace}>
            {operator&&<OperatorGameBoard company={operator} companies={data.operators} onCompanyChange={id=>selectContext({operator:id})} rooms={operatorRooms} selectedId={showCreate?undefined:selectedRoom?.id} disabled={disabled||anyBusy} removeDisabled={disabled||anyBusy||anyDraft} onSelect={id=>{const room=operatorRooms.find(row=>row.id===id);if(room){selectContext({operator:operator.id,table:room.id,composition:room.compositionId,game:room.game});scrollTo('operator-game-editor');}}} onAdd={()=>{if(!disabled&&mayLeave()){setShowCreate(true);scrollTo('operator-game-editor');}}} onRemove={id=>{if(!disabled&&!anyBusy&&!anyDraft){setRoomRequest({kind:'archive',roomId:id});scrollTo('room-lifecycle');}}}/>}

              {operator&&<div id="room-lifecycle" className={styles.lifecycleSlot}><ControlResourceLifecycle operatorId={operator.id} kind="rooms" available refreshKey={lifecycleRefresh} compact request={roomRequest} onRequestHandled={()=>setRoomRequest(undefined)}
                disabled={disabled||roomBusy||gameBusy||createBusy||publishBusy||anyDraft}
                onChanged={lifecycleChanged} onRefreshNeeded={lifecycleUncertain} onBusyChange={value=>lifecycleOperation('rooms',value)} navigation={lifecycleNavigation}/></div>}

            <section id="operator-game-editor" className={styles.roomDetail} aria-label="Redigera spel">
              {!showCreate&&<>
              <header className={styles.detailHeader}><div><p className={styles.detailEyebrow}>{selectedRoom?'VALT SPEL':'SPELUTBUD'}</p><h2 id="registered-room-title">{selectedRoom?.name??operator?.name??'Välj ett spelbolag'}</h2>{selectedRoom&&<p>{labels[selectedRoom.game]??selectedRoom.game} · {labels[selectedRoom.state]??selectedRoom.state} · {selectedRoom.published?'Publicerat rum':'Inte publicerat'}</p>}
                {selectedRoom&&roomStatus&&roomStatus.roomId===selectedRoom.id&&<dl className={styles.roomStatus} aria-label="Rummets status">
                  <div><dt>Publicerat nu</dt><dd>{liveLabel(roomStatus.live.background,roomStatus.labels.background)} · {liveLabel(roomStatus.live.dealer,roomStatus.labels.dealer)} · {liveLabel(roomStatus.live.table,roomStatus.labels.table)}</dd></div>
                </dl>}</div>
                {operator&&<div className={styles.detailActions}>{selectedRoom?.published&&<button type="button" className="studio-button" disabled={disabled||anyBusy||anyDraft} onClick={()=>{setRoomRequest({kind:'state',roomId:selectedRoom.id});scrollTo('room-lifecycle');}}>{selectedRoom.state==='live'?'Pausa spel':'Öppna spel'}</button>}<a href={workspaceLink('/admin/companies',operator)} className={linkClass}>Bolag & team</a>{selectedRoom?.playUrl&&<a href={selectedRoom.playUrl} target="_blank" rel="noopener" className={linkClass}>Öppna rummet <ArrowUpRight size={13} aria-hidden="true"/></a>}</div>}
              </header>
              {operator&&!selectedRoom&&!roomId&&<p className={styles.message}>Bolaget har inga spel ännu. Välj Lägg till spel för att skapa det första.</p>}
              {roomId&&!selectedRoom&&<p role="alert" className={styles.message}>Det valda rummet finns inte hos detta aktiva spelbolag. Välj rum uttryckligen för att fortsätta.</p>}
              {selectedRoom&&operator&&<>
                {disabled&&<p role="status" className={styles.message}>Spara det pågående Studio-arbetet innan du ändrar rummets val.</p>}
                {gameSettingsRoom(selectedRoom)&&selectedRoom.dealerIds.includes('paow')&&<section className={styles.message} aria-label="Publicera PAOWs viloklipp">
                  <p>Uppdatera PAOWs sparade vilosekvens i bolagets publicerade rum. Övriga publicerade val och placeringar behålls.</p>
                  <button type="button" className="studio-button" disabled={publishBlocked||selectionDirty} onClick={()=>void publishPaowIdle()}>{publishBusy?'Publicerar…':'Publicera PAOWs viloklipp'}</button>
                  {operatorPackage.message&&<p role="status">{operatorPackage.message}</p>}
                  {operatorPackage.error&&<p role="alert">{operatorPackage.error}</p>}
                </section>}
                {selectedRoom.published ? <PartnerAppearanceLoader key={'layers:'+editorKey} apiBase="/studio/api/partner" operatorId={operator.id} operatorSlug={operator.slug} roomId={selectedRoom.id} roomLayout adminChoices disabled={disabled||lifecycleBusy||gameBusy||gameDirty||createBusy||publishBusy} onDirtyChange={setRoomDirty} onBusyChange={setRoomBusy} onStatus={setRoomStatus} onSaved={(saved:{operatorId:string;packageRevision:number})=>{packageAdvanced(saved.operatorId,saved.packageRevision);onChanged?.();}}>
                    {gameSettingsRoom(selectedRoom)&&<RoomGameConfig key={'game:'+editorKey} operatorId={operator.id} roomId={selectedRoom.id} roomName={selectedRoom.name}
                      disabled={disabled||lifecycleBusy||roomBusy||roomDirty||createBusy||publishBusy}
                      onBusyChange={setGameBusy} onDirtyChange={setGameDirty}
                      onPublished={receipt=>{packageAdvanced(receipt.operatorId,receipt.packageRevision);onChanged?.();}}/>}
                  </PartnerAppearanceLoader>
                  : <div className={styles.unpublished} role="status"><h3>Rummet saknar ett publicerat paket</h3><p>Rummets lager kan väljas när bolagets sammansättningar är publicerade. Välj rummets mall under Spelmallar för bolaget nedan.</p></div>}
                <details className={cn(panelClass,styles.sharedTemplate)}><summary>Gemensam mall och tillåtna alternativ</summary><p>Malländringar kan beröra flera rum. Berörda rum visas i mallredigeraren innan du ändrar eller sparar.</p><div><a href={editHref} className={linkClass}>Öppna gemensam mall för {selectedRoom.name} ↗</a><a href="/admin/assets" className={linkClass}>Bord & bakgrunder · bibliotek</a></div></details>
              </>}
              </>}
              {operator&&!showCreate&&<details id="operator-publication" className={styles.packageDetails}><summary>Spelmallar för bolaget</summary><section id="room-publication" className={cn(panelClass,styles.companyCard)} aria-label="Publicering">
                <header><div><p className={styles.detailEyebrow}>Bolaget</p><h3>Spelmallar · {operator.name}</h3></div>
                  <span className={styles.version}>{operator.packageRevision===null&&operatorPackage.revision===null?'Ingen publicering ännu':'Senast publicerat · version '+(operatorPackage.revision??operator.packageRevision)}</span></header>
                <p>Här tilldelar du bolaget spelmallar från Studio. Materialval för det enskilda spelet sparar du ovan.</p>
                {operatorPackage.needsRefresh&&<p role="status" className={styles.problem}>Uppgifterna behöver kontrolleras. <button type="button" className="studio-button" disabled={anyBusy} onClick={()=>{if(roomDraftBlocks&&!confirm('Lämna osparade rumsändringar och läsa in aktuella uppgifter?'))return;reload();}}>Läs in aktuella uppgifter</button></p>}
                {!compositions.length&&<p role="status">Det finns inga sparade sammansättningar. <a className={linkClass} href="/admin/compositions">Skapa en sammansättning</a> innan du skapar ett rum.</p>}
                {!operatorPackage.chosen.length&&compositions.length>0&&<p role="status">Välj minst en sammansättning för att publicera. Stäng spelutbudet genom att pausa eller arkivera spelrummen.</p>}
                <form onSubmit={event=>{event.preventDefault();void publishPackage();}}>
                  <fieldset className={styles.choices} disabled={disabled||anyBusy||operatorPackage.needsRefresh}><legend>Spelmallar som bolaget får använda</legend>
                    {compositions.map(row=><label className={styles.choice} key={row.id}><input type="checkbox" name="lanes" value={row.id} checked={operatorPackage.chosen.includes(row.id)}
                      onChange={event=>{const checked=event.target.checked;updatePackage(operator.id,current=>togglePackageLane(current,row.id,checked));}}/><span><strong>{compositionLabel(row.name)}</strong><br/>{row.dealerIds.map(dealerName).join(', ')||'Inga dealers'}{operatorRooms.some(room=>room.compositionId===row.id)?' · används av '+operatorRooms.filter(room=>room.compositionId===row.id).map(room=>room.name).join(', '):''}</span></label>)}
                    {operatorPackage.chosen.filter(id=>!compositions.some(row=>row.id===id)).map(id=><label className={styles.choice} key={id}><input type="checkbox" value={id} checked onChange={()=>updatePackage(operator.id,current=>togglePackageLane(current,id,false))}/><span>Sammansättning borttagen ur Studio · {id}. Avmarkera efter att berörda rum arkiverats.</span></label>)}
                  </fieldset>
                  <div className={styles.publishAction}><p role="status">{publishBusy?'Publicerar…':publicationStatus}</p>
                    <button className={operatorPackage.message?'studio-button':'studio-button primary'} type="submit" disabled={publishBlocked}>{publishBusy?'Publicerar…':operatorPackage.message?'Publicera igen':'Publicera för '+operator.name}</button></div>
                </form>
                {operatorPackage.error&&<p role="alert" className={styles.problem}>{operatorPackage.error}</p>}
                {operatorPackage.message&&<p role="status" className={styles.receipt}><strong>Publiceringen är bekräftad.</strong> {operatorPackage.message}</p>}
                <p><a href={'/partner/'+encodeURIComponent(operator.slug)+'/rooms'+(selectedRoom?'?'+new URLSearchParams({room:selectedRoom.id}):'')} className={linkClass}>Öppna partnerportalen ↗</a></p>
              </section></details>}
              {operator&&complete&&showCreate&&<div id="room-create" className={styles.companyCard}><div className={styles.createHeader}><h2>Lägg till spel hos {operator.name}</h2><button type="button" className="studio-button" disabled={anyBusy} onClick={()=>{if(mayLeave())setShowCreate(false);}}>Avbryt</button></div>
                {compositions.length>0&&<label className={styles.compositionPick}>Spelmall<select aria-label="Spelmall" value={createComposition?.id??''} disabled={anyBusy||createDraft} onChange={event=>setNewRoomComposition(event.target.value)}>
                  {compositions.map(row=><option key={row.id} value={row.id}>{compositionLabel(row.name)}{operatorPackage.baseline.includes(row.id)?'':' · inte publicerad'}</option>)}
                </select></label>}
                <PresentationRoomCreate operator={{id:operator.id,slug:operator.slug,name:operator.name}} presentation={createComposition?{id:createComposition.id,label:compositionLabel(createComposition.name)}:null}
                  projectRevision={complete.revisions.project} projectSaved={!disabled} storeAvailable hideExisting visual
                  interactionDisabled={lifecycleBusy||roomBusy||gameBusy||publishBusy||roomDraftBlocks}
                  onDraftChange={setCreateDraft} onBusyChange={setCreateBusy}
                  onCreated={receipt=>{packageAdvanced(receipt.room.operatorId,receipt.packageRevision);reload();onChanged?.();setConfirmedNavigation({operator:receipt.room.operatorId,table:receipt.room.id,composition:receipt.room.presentationLaneId,game:receipt.room.game??'blackjack'});}}/>
              </div>}

            </section>
          </div> : null}
          {selectedRoom && !roomView && <p className="text-xs text-sg-muted">Valt rum: {selectedRoom.name} · {selectedRoom.dealerIds.map(dealerName).join(', ') || 'Inga dealers kopplade'}</p>}
          {selectedRoom?.materialWarning&&<p role="note">Fryst spelåtkomst behålls. Granska materialets katalogtagg och spelets bord före nästa publicering.</p>}
          {operator&&path==='/admin/admin/operators'&&<div id="room-trash"><RegisteredResourceLifecycle operatorId={operator.id} rooms={complete?.rooms} disabled={disabled||roomDirty||roomBusy} onBusyChange={setLifecycleBusy} onChanged={()=>{setRefresh(value=>value+1);onChanged?.();}}/></div>}
          {operator&&roomView&&showLifecycle&&<div id="room-trash" className={cn(panelClass,styles.companyCard)}><ControlResourceLifecycle operatorId={operator.id} kind="rooms" archiveOnly available refreshKey={lifecycleRefresh}
            disabled={disabled||roomBusy||gameBusy||createBusy||publishBusy||anyDraft} onChanged={lifecycleChanged} onRefreshNeeded={lifecycleUncertain} onBusyChange={value=>lifecycleOperation('operator',value)}/></div>}
        </>}
      <footer className="mt-auto border-t border-sg-line pt-4 text-xs text-sg-muted">Ny arbetsyta · {state.status === 'ready' ? `Register läst ${new Date(state.value.readAt).toLocaleString('sv-SE')}` : 'Datastatus visas ovan'}{lifecycleSnapshot?' · Paket och livscykel lästa':''}</footer>
    </section>
  </>;
}
