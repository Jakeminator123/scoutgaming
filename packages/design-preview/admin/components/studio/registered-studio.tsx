import { useEffect, useState } from 'react';
import { ArrowUpRight, Building2, DoorOpen, RefreshCw, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import {RegisteredResourceLifecycle} from './registered-resource-lifecycle';
import {operatorLifecycleGroups} from '../../lib/studio-resource-lifecycle.mjs';

type Operator = { id: string; slug: string; name: string; status: string; archivedAt:string|null;packageRevision: number | null };
type Dealer = { id: string; name: string; archived: boolean };
type Room = { id: string; name: string; operatorId: string; game: string; state: string; compositionId: string;
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
function controlLink(path: string, operator?: Operator, room?: Room, dealer?: Dealer) {
  const params = new URLSearchParams();
  if (operator) params.set('operator', operator.id);
  if (room) { params.set('table', room.id); params.set('composition', room.compositionId); }
  if (dealer) params.set('dealer', dealer.id);
  return path + (params.size ? '?' + params : '');
}
const existing: Record<string, string> = {
  '/control/clips': '/control/clips', '/control/assets': '/control/library', '/control/drift': '/control/administration?tab=operations',
  '/control/ekonomi': '/control/administration?tab=finance', '/control/admin/accounts': '/control/administration?tab=accounts',
  '/control/admin/api': '/control/administration?tab=partners', '/control/ai/models': '/control/openclaw', '/control/ai/chat': '/control/openclaw?tab=chat',
};
const connectedPaths = new Set(['/control', '/control/structure', '/control/admin/operators', '/control/rooms', '/control/dealers']);

export function RegisteredStudio({ path, title,disabled=false,onChanged }: { path: string; title: string;disabled?:boolean;onChanged?:()=>void }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [companyView,setCompanyView]=useState<'active'|'trash'|'suspended'>('active');
  const [lifecycleBusy,setLifecycleBusy]=useState(false);
  const [operatorId, setOperatorId] = useState(()=>new URLSearchParams(location.search).get('operator')??'');
  const [roomId, setRoomId] = useState(()=>new URLSearchParams(location.search).get('table')??'');
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
  const data=complete?{...complete,operators:path==='/control/admin/operators'?groups[companyView]:groups.active,
    rooms:complete.rooms.filter(room=>room.state!=='archived'&&groups.active.some(row=>row.id===room.operatorId))}:null;
  const operator = data?.operators.find(row => row.id === operatorId) ?? data?.operators[0];
  const operatorRooms = data?.rooms.filter(row => row.operatorId === operator?.id) ?? [];
  const selectedRoom = operatorRooms.find(row => row.id === roomId) ?? operatorRooms[0];
  const dealerName = (id: string) => data?.dealers.find(row => row.id === id)?.name ?? id;
  const editHref = controlLink('/control/rooms', operator, selectedRoom);
  return <>
    <nav aria-label="Registrerad struktur" className="flex flex-wrap items-center gap-3 border-b border-sg-line bg-sg-panel/60 px-6 py-3 text-xs">
      <label className="flex items-center gap-2 text-sg-muted">Spelbolag
        <select aria-label="Välj spelbolag" className="max-w-48 rounded border border-sg-line bg-sg-bg p-1.5 text-sg-text" value={operator?.id ?? ''} disabled={!data?.operators.length||lifecycleBusy}
          onChange={event => { setOperatorId(event.target.value); setRoomId(''); }}>
          {!data?.operators.length && <option value="">Inga val tillgängliga</option>}
          {data?.operators.map(row => <option value={row.id} key={row.id}>{row.name}</option>)}
        </select>
      </label><span className="text-sg-muted" aria-hidden>›</span>
      <label className="flex items-center gap-2 text-sg-muted">Rum
        <select aria-label="Välj rum" className="max-w-48 rounded border border-sg-line bg-sg-bg p-1.5 text-sg-text" value={selectedRoom?.id ?? ''} disabled={!operatorRooms.length} onChange={event => setRoomId(event.target.value)}>
          {!operatorRooms.length && <option value="">Inga rum registrerade</option>}
          {operatorRooms.map(row => <option value={row.id} key={row.id}>{row.name}</option>)}
        </select>
      </label>
      <a href="/admin/lobby" className={cn(linkClass, 'ml-auto')}>Öppna spellobbyn <ArrowUpRight size={13} /></a>
    </nav>
    <section className="flex flex-1 flex-col gap-6 px-6 py-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sg-lime">{'// Studio · Register'}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{path === '/control' || path === '/control/structure' ? 'Spelbolag → Rum → Spel → Bord & dealer' : title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-sg-muted">Registrerade bolag och rum använder samma skyddade register och papperskorg som Control. Team och publicering nås via bolagets länkar.</p>
        </div>
        <button type="button" disabled={state.status === 'loading'||lifecycleBusy} onClick={() => setRefresh(value => value + 1)} className="inline-flex items-center gap-2 rounded border border-sg-line px-3 py-2 text-xs disabled:opacity-50"><RefreshCw size={13} /> Uppdatera</button>
      </header>
      {complete&&path==='/control/admin/operators'&&<div role="group" aria-label="Bolagsvy">{(['active','trash','suspended'] as const).map(view=><button key={view} className="studio-button" aria-pressed={companyView===view} disabled={lifecycleBusy} onClick={()=>{setCompanyView(view);setOperatorId('');setRoomId('');}}>{({active:'Aktiva bolag',trash:'Papperskorg',suspended:'Avstängda bolag'})[view]} ({groups[view].length})</button>)}</div>}
      {!connectedPaths.has(path) ? <div className={cn(panelClass, 'p-6')}>
        <h2 className="font-semibold">{title} ansluts i nästa steg</h2>
        <p className="my-3 text-sm text-sg-muted">Den här delen har ännu ingen datakoppling. Exempelsiffror och simulerade ändringar visas inte bland de registrerade uppgifterna.</p>
        <a className={linkClass} href={existing[path] ?? '/control/administration'}>Öppna nuvarande arbetsyta <ArrowUpRight size={13} /></a>
      </div> : state.status === 'loading' ? <p role="status" className="text-sm text-sg-muted">Läser spelbolag, rum och dealers…</p>
        : state.status === 'error' ? <div role="alert" className={cn(panelClass, 'p-6')}>
          <h2 className="font-semibold">{state.authentication ? 'Inloggning krävs' : 'Registret är inte tillgängligt'}</h2>
          <p className="my-3 text-sm text-sg-muted">{state.authentication ? 'Din interna session saknas eller har gått ut. Öppna administrationen igen för att logga in.' : 'Kontrollera anslutningen till Studio. Lokal offlinekörning har inte tillgång till produktionsregistret. Inga exempeldata har ersatt de saknade uppgifterna.'}</p>
          <a href="/admin" className={linkClass}>Öppna administrationen igen <ArrowUpRight size={13} /></a>
        </div> : data && <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
            ['Aktiva spelbolag', groups.active.length], ['Rum', data.rooms.length], ['Aktiva dealers', data.dealers.filter(row => !row.archived).length], ['Spelbara rum', data.rooms.filter(row => row.playable).length],
          ].map(([label, count]) => <div key={label} className={cn(panelClass, 'px-4 py-3')}><dt className="font-mono text-[10px] uppercase tracking-wider text-sg-muted">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{count}</dd></div>)}</dl>
          {path === '/control/dealers' ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {!data.dealers.length && <p className="text-sm text-sg-muted">Inga dealers är registrerade.</p>}
            {data.dealers.map(dealer => <article key={dealer.id} className={cn(panelClass, 'p-4')}><UserRound size={20} className="mb-3 text-sg-teal" /><h2 className="font-semibold">{dealer.name}</h2><p className="mt-1 text-xs text-sg-muted">{dealer.archived ? 'Arkiverad' : 'Registrerad'} · {dealer.id}</p><a className={cn(linkClass, 'mt-4')} href={controlLink('/control/clips', undefined, undefined, dealer)}>Öppna dealer i Control <ArrowUpRight size={13} /></a></article>)}
          </div> : path === '/control/admin/operators' ? <ul className="grid gap-3 sm:grid-cols-2">
            {!data.operators.length && <li className="text-sm text-sg-muted">Inga spelbolag är registrerade.</li>}
            {data.operators.map(row => <li key={row.id} className={cn(panelClass, 'p-4')}><Building2 size={20} className="mb-3 text-sg-lime" /><h2 className="font-semibold">{row.name}</h2><p className="my-2 text-xs text-sg-muted">{row.archivedAt?'I papperskorgen':labels[row.status] ?? row.status} · {data.rooms.filter(room => room.operatorId === row.id).length} rum · {row.packageRevision === null ? 'Inget publicerat paket' : `Paket ${row.packageRevision}`}</p><div className="mt-4 flex flex-wrap gap-4"><a className={linkClass} href={controlLink('/control/companies', row)}>Bolag & team ↗</a>{row.status === 'active' && <a className={linkClass} href={'/partner/' + encodeURIComponent(row.slug)}>Spelbolagsportal ↗</a>}</div></li>)}
          </ul> : path === '/control/rooms' ? <div>
            <div className="mb-4 flex flex-wrap justify-between gap-3"><h2 className="font-semibold">{operator?.name ?? 'Inga registrerade spelbolag'}</h2>{operator && <a href={editHref} className={linkClass}>Spelrum & publicering i Control ↗</a>}</div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{operatorRooms.map(room => <RoomCard key={room.id} room={room} operator={operator!} dealers={data.dealers} />)}</div>
            {!operatorRooms.length && <p className="text-sm text-sg-muted">Inga rum är registrerade för bolaget.</p>}
          </div> : <ul className="flex flex-col gap-4">
            {!data.operators.length && <li className="text-sm text-sg-muted">Inga spelbolag är registrerade.</li>}
            {data.operators.map(row => <li key={row.id} className={cn(panelClass, row.id === operator?.id && 'border-sg-lime/50')}>
              <button type="button" onClick={() => { setOperatorId(row.id); setRoomId(''); }} className="flex w-full flex-wrap items-center gap-2 border-b border-sg-line px-4 py-3 text-left"><Building2 size={16} className="text-sg-lime" /><span className="font-semibold">{row.name}</span><span className="font-mono text-[10px] text-sg-muted">{row.archivedAt?'I papperskorgen':labels[row.status] ?? row.status}</span></button>
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{data.rooms.filter(room => room.operatorId === row.id).map(room => <RoomCard key={room.id} room={room} operator={row} dealers={data.dealers} />)}
                {!data.rooms.some(room => room.operatorId === row.id) && <p className="text-xs text-sg-muted">Inga rum registrerade ännu.</p>}
              </div>
            </li>)}
          </ul>}
          {selectedRoom && <p className="text-xs text-sg-muted">Valt rum: {selectedRoom.name} · {selectedRoom.dealerIds.map(dealerName).join(', ') || 'Inga dealers kopplade'}</p>}
          {operator&&path==='/control/admin/operators'&&<RegisteredResourceLifecycle operatorId={operator.id} disabled={disabled} onBusyChange={setLifecycleBusy} onChanged={()=>{setRefresh(value=>value+1);onChanged?.();}}/>}
        </>}
      <footer className="mt-auto border-t border-sg-line pt-4 text-xs text-sg-muted">Ny arbetsyta · {state.status === 'ready' ? `Register läst ${new Date(state.value.readAt).toLocaleString('sv-SE')}` : 'Datastatus visas ovan'} · <a href="/control" className="underline">Nuvarande Control</a></footer>
    </section>
  </>;
}

function RoomCard({ room, operator, dealers }: { room: Room; operator: Operator; dealers: Dealer[] }) {
  return <article className="flex flex-col rounded-md border border-sg-line bg-sg-bg">
    <div className="flex items-start gap-2 border-b border-sg-line px-3 py-3"><DoorOpen size={16} className="mt-0.5 text-sg-amber" /><div><h3 className="text-sm font-medium">{room.name}</h3><p className="mt-1 text-[11px] text-sg-muted">{labels[room.game] ?? room.game} · {labels[room.state] ?? room.state} · {room.playable ? 'Spelbart' : room.published ? 'Publicerat, inte spelbart' : 'Inte publicerat'}</p></div></div>
    <div className="border-b border-sg-line px-3 py-3 text-xs"><p className="font-medium">Miljö: {room.environment?.label ?? 'Granska i sammansättningen'}</p>{room.environment && !room.environment.fixed && <p className="mt-1 text-sg-amber">Rummet saknar en entydig miljö. Nya rum ska ha en fast miljö.</p>}</div>
    <ul className="flex flex-col gap-2 p-3">{room.dealerIds.map(id => {
      const dealer = dealers.find(row => row.id === id);
      return <li key={id}><a href={controlLink('/control/clips', operator, room, dealer ?? { id, name: id, archived: false })} className="flex items-center gap-2 text-xs hover:text-sg-lime"><UserRound size={14} className="text-sg-teal" />{room.dealers.find(row => row.id === id)?.name ?? id}<ArrowUpRight size={12} /></a></li>;
    })}{!room.dealerIds.length && <li className="text-xs text-sg-muted">Ingen kopplad dealer i den sparade sammansättningen.</li>}</ul>
    <p className="px-3 pb-2 text-[10px] text-sg-muted">{room.dealerSource === 'published' ? 'Dealers i publicerat paket' : 'Dealers i sparad sammansättning'}</p>
    <a href={controlLink('/control/rooms', operator, room)} className={cn(linkClass, 'mt-auto px-3 pb-3')}>Visa rum i Control <ArrowUpRight size={12} /></a>
  </article>;
}
