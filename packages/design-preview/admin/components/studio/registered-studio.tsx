import { useEffect, useState } from 'react';
import { ArrowUpRight, Building2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {RegisteredResourceLifecycle} from './registered-resource-lifecycle';
import {operatorLifecycleGroups} from '../../lib/studio-resource-lifecycle.mjs';
import {PartnerAppearanceLoader} from '../../../../../lab/components/partner-appearance-loader.mjs';
import {useSearchParams} from '../../../runtime/navigation';
import {studioHistory} from '../../../../../lab/lib/studio-history.mjs';
import {navigationKeepsStudioTab} from '../../lib/connected-studio.mjs';

type Operator = { id: string; slug: string; name: string; status: string; archivedAt:string|null;packageRevision: number | null };
type Dealer = { id: string; name: string; archived: boolean };
type Room = { id: string; name: string; operatorId: string; game: string; state: string; compositionId: string;materialWarning?:string;
  laneId: string; published: boolean; playable: boolean; dealerIds: string[]; dealers: { id: string; name: string }[]; dealerSource: 'published' | 'saved'; playUrl: string | null;
  environment?: { kind: string; fixed: boolean; label: string; image?: string } | null };
type Registry = { schemaVersion: 1; source: 'registered'; readAt: string; administration: {
  operators: Operator[]; dealers: Dealer[]; rooms: Room[];
  compositions: { id: string; name: string; dealerIds: string[]; defaultDealerId: string }[];
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

export function RegisteredStudio({ path, title,disabled=false,onChanged }: { path: string; title: string;disabled?:boolean;onChanged?:()=>void }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [companyView,setCompanyView]=useState<'active'|'trash'|'suspended'>('active');
  const [lifecycleBusy,setLifecycleBusy]=useState(false);
  const search = useSearchParams().toString();
  const query = new URLSearchParams(search);
  const operatorId = query.get('operator') ?? '', game = query.get('game') ?? '', roomId = query.get('table') ?? '';
  const roomView = path === '/admin/rooms';
  const [roomDirty,setRoomDirty] = useState(false), [roomBusy,setRoomBusy] = useState(false);
  const [showLifecycle,setShowLifecycle] = useState(false);
  function mayLeave() { return !roomBusy && !lifecycleBusy && (!roomDirty || confirm('Lämna rummets osparade val? Sparade utkast och publicerad version behålls.')); }
  function selectContext(next: Record<string,string>) {
    const params = new URLSearchParams(search);
    for (const key of ['operator','game','table','composition','lane','dealer']) params.delete(key);
    for (const [key,value] of Object.entries(next)) if(value)params.set(key,value);
    const href = path + (params.size ? '?' + params : '');
    const history = studioHistory(window);
    if (!history.canNavigate(href) || !history.push(href,true)) return;
    setRoomDirty(false); setShowLifecycle(false);
  }
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unload = (event:BeforeUnloadEvent) => { if(roomDirty || roomBusy){event.preventDefault();event.returnValue='';} };
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
  },[roomDirty,roomBusy,lifecycleBusy]);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
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
  return <>
    <nav aria-label="Registrerad struktur" className="flex flex-wrap items-center gap-3 border-b border-sg-line bg-sg-panel/60 px-6 py-3 text-xs">
      <label className="flex items-center gap-2 text-sg-muted">Spelbolag
        <select aria-label="Välj spelbolag" className="max-w-48 rounded border border-sg-line bg-sg-bg p-1.5 text-sg-text" value={operator?.id ?? ''} disabled={!data?.operators.length||lifecycleBusy||roomBusy}
          onChange={event => selectContext({operator:event.target.value})}>
          {!operator && <option value="">{data?.operators.length ? 'Välj ett aktivt bolag' : 'Inga val tillgängliga'}</option>}
          {data?.operators.map(row => <option value={row.id} key={row.id}>{row.name}</option>)}
        </select>
      </label>{!roomView && <><span className="text-sg-muted" aria-hidden>›</span>
      <label className="flex items-center gap-2 text-sg-muted">Spel
        <select aria-label="Välj spel" className="max-w-48 rounded border border-sg-line bg-sg-bg p-1.5 text-sg-text" value={selectedGame} disabled={!operatorRooms.length||lifecycleBusy||roomBusy} onChange={event=>selectContext({operator:operator?.id??'',game:event.target.value})}>
          {!operatorRooms.length&&<option value="">Inga spel registrerade</option>}
          {[...new Set(operatorRooms.map(row=>row.game))].map(id=><option key={id} value={id}>{labels[id]??id}</option>)}
        </select>
      </label></>}<span className="text-sg-muted" aria-hidden>›</span>
      <label className="flex items-center gap-2 text-sg-muted">Rum
        <select aria-label="Välj rum" className="max-w-48 rounded border border-sg-line bg-sg-bg p-1.5 text-sg-text" value={selectedRoom?.id ?? ''} disabled={!gameRooms.length||lifecycleBusy||roomBusy} onChange={event => {const next=operatorRooms.find(row=>row.id===event.target.value);if(next)selectContext({operator:operator?.id??'',table:next.id,composition:next.compositionId,game:next.game});}}>
          {!selectedRoom && <option value="">{gameRooms.length ? 'Välj ett rum' : 'Inga rum registrerade'}</option>}
          {gameRooms.map(row => <option value={row.id} key={row.id}>{row.name}{roomView ? ` · ${labels[row.game]??row.game}` : ''}</option>)}
        </select>
      </label>
      <a href="/lobby" className={cn(linkClass, 'ml-auto')}>Öppna spellobbyn <ArrowUpRight size={13} /></a>
    </nav>
    <section className="flex flex-1 flex-col gap-6 px-6 py-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sg-lime">{'// Studio · Register'}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{roomView ? 'Spelbolag & rum' : title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-sg-muted">{roomView ? 'Välj ett rum och se bakgrund, dealer och bord tillsammans. Rumsval gäller bara det valda rummet.' : 'Registrerade spelbolag och rum. Team och publicering nås via bolagets länkar.'}</p>
        </div>
        <div className="flex items-center gap-3">{path==='/admin/rooms'&&operator&&<button type="button" className={linkClass} aria-expanded={showLifecycle} disabled={roomBusy||roomDirty||lifecycleBusy} onClick={()=>setShowLifecycle(value=>!value)}>Papperskorg och återställning</button>}<button type="button" disabled={state.status === 'loading'||lifecycleBusy||roomDirty||roomBusy} onClick={() => setRefresh(value => value + 1)} className="inline-flex items-center gap-2 rounded border border-sg-line px-3 py-2 text-xs disabled:opacity-50"><RefreshCw size={13} /> Uppdatera</button></div>
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
          </ul> : roomView ? <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{selectedRoom?.name ?? operator?.name ?? 'Välj ett spelbolag'}</h2>{selectedRoom&&<p className="mt-1 text-sm text-sg-muted">{labels[selectedRoom.game]??selectedRoom.game} · {labels[selectedRoom.state]??selectedRoom.state} · {selectedRoom.published?'Publicerat rum':'Inte publicerat'}</p>}</div>{operator&&<div className="flex flex-wrap gap-4"><a href={workspaceLink('/admin/companies',operator)} className={linkClass}>Bolag & team</a><a href={workspaceLink('/admin/publication',operator,selectedRoom)} className={linkClass}>Skapa/publicera rum ↗</a></div>}</div>
            {roomId&&!selectedRoom&&<p role="alert">Det valda rummet finns inte hos detta aktiva spelbolag. Välj rum uttryckligen för att fortsätta.</p>}
            {selectedRoom&&operator&&<>
              {disabled&&<p role="status">Spara det pågående Studio-arbetet innan du ändrar rummets val.</p>}
              {selectedRoom.published ? <PartnerAppearanceLoader key={operator.id+':'+selectedRoom.id+':'+refresh} apiBase="/studio/api/partner" operatorId={operator.id} operatorSlug={operator.slug} roomId={selectedRoom.id} roomLayout disabled={disabled||lifecycleBusy} onDirtyChange={setRoomDirty} onBusyChange={setRoomBusy} onSaved={()=>onChanged?.()}/>
                : <p role="status">Rummet saknar ett publicerat paket. Förbered lagren i den delade mallen och granska sedan rummets första publicering.</p>}
              <details className={cn(panelClass,'p-4')}><summary className="cursor-pointer font-semibold">Gemensam mall och tillåtna alternativ</summary><p className="my-2 text-sm text-sg-muted">Malländringar kan beröra flera rum. Berörda rum visas i mallredigeraren innan du ändrar eller sparar.</p><div className="flex flex-wrap gap-4"><a href={editHref} className={linkClass}>Öppna gemensam mall för {selectedRoom.name} ↗</a><a href="/admin/assets" className={linkClass}>Bord & bakgrunder · bibliotek</a></div></details>
            </>}
            {!operatorRooms.length&&operator&&<p className="text-sm text-sg-muted">Inga rum är registrerade för det valda spelbolaget.</p>}
          </div> : null}
          {selectedRoom && !roomView && <p className="text-xs text-sg-muted">Valt rum: {selectedRoom.name} · {selectedRoom.dealerIds.map(dealerName).join(', ') || 'Inga dealers kopplade'}</p>}
          {selectedRoom?.materialWarning&&<p role="note">Fryst spelåtkomst behålls. Granska materialets katalogtagg och spelets bord före nästa publicering.</p>}
          {operator&&(path==='/admin/admin/operators'||roomView&&showLifecycle)&&<div id="room-trash"><RegisteredResourceLifecycle operatorId={operator.id} rooms={complete?.rooms} disabled={disabled||roomDirty||roomBusy} onBusyChange={setLifecycleBusy} onChanged={()=>{setRefresh(value=>value+1);onChanged?.();}}/></div>}
        </>}
      <footer className="mt-auto border-t border-sg-line pt-4 text-xs text-sg-muted">Ny arbetsyta · {state.status === 'ready' ? `Register läst ${new Date(state.value.readAt).toLocaleString('sv-SE')}` : 'Datastatus visas ovan'}</footer>
    </section>
  </>;
}
