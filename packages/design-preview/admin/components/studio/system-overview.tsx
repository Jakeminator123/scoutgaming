"use client"

import { useEffect, useState, type ReactNode } from 'react';
import { Activity, ArrowRight, ArrowUpRight, Bot, Building2, Gamepad2, Layers, Network, RefreshCw, ShieldCheck, Users, Wallet, type LucideIcon } from 'lucide-react';
import Link from '../../../runtime/navigation';
import { createStudioClient, type Workspace } from '../../lib/connected-studio.mjs';
import { systemHref, systemOverview } from '../../lib/system-overview.mjs';

const client = createStudioClient();
type State = { status:'loading' } | { status:'error'; message:string; authentication:boolean } | { status:'ready'; workspace:Workspace };
const card = 'rounded-lg border border-sg-line bg-sg-panel';
const detail = 'text-xs leading-relaxed text-sg-muted';

export function SystemOverview() {
  const [state, setState] = useState<State>({ status:'loading' });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status:'loading' });
    void client.load(controller.signal).then(workspace => {
      if (!controller.signal.aborted) setState({ status:'ready', workspace });
    }).catch((cause:unknown) => {
      if (controller.signal.aborted) return;
      const error = cause as Error & { statusCode?:number };
      setState({ status:'error', message:error.message || 'Registret kunde inte läsas.', authentication:[401,403].includes(error.statusCode ?? 0) });
    });
    return () => controller.abort();
  }, [refresh]);

  const workspace = state.status === 'ready' ? state.workspace : null;
  const overview = workspace ? systemOverview(workspace, location.search) : null;
  const counts = overview?.counts;
  const href = (path:string) => systemHref(path, overview?.context ?? {});
  const areas: {title:string;icon:LucideIcon;path:string;status:string;accent:string;summary:string;items:string[]}[] = [
    { title:'Studio', icon:Layers, path:'/admin/clips', status:'Ansluten', accent:'text-sg-lime',
      summary:counts ? `${counts.dealers} dealers · ${counts.compositions} sammansättningar` : 'Dealers & sammansättningar',
      items:['Dealer + rum / bakgrund + bord','Klipp · Tal · Provspelning'] },
    { title:'Drift', icon:Activity, path:'/admin/drift', status:'Server-API', accent:'text-sg-teal',
      summary:'Speldrift & integritet', items:['Spelstatus · Kortlek','N1-session och anslutning kontrolleras i vyn'] },
    { title:'Ekonomi', icon:Wallet, path:'/admin/ekonomi', status:'Server-API', accent:'text-sg-amber',
      summary:'Betalningar & journal', items:['Transaktioner · Journal','N1-session och anslutning kontrolleras i vyn'] },
    { title:'AI', icon:Bot, path:'/admin/ai/models', status:'Server-API', accent:'text-sg-teal',
      summary:'Agentmodeller & agentchatt', items:['OpenClaw · Modeller','Gateway och behörigheter kontrolleras i vyn'] },
    { title:'Admin', icon:ShieldCheck, path:'/admin/admin/operators', status:'Bolagsregister', accent:'text-sg-lime',
      summary:counts ? `${counts.operators} registrerade spelbolag` : 'Bolag & team',
      items:['Bolag · Team · Åtkomst','Konton och integrationer läser skyddade server-API:er'] },
  ];

  return <section className="system-overview flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 lg:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sg-lime">Scoutgaming · Nivå 1</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Struktur</h1>
      </div>
      <button type="button" disabled={state.status === 'loading'} onClick={() => setRefresh(value => value + 1)}
        className="inline-flex items-center gap-2 rounded border border-sg-line px-3 py-2 text-xs disabled:opacity-40">
        <RefreshCw size={13} aria-hidden /> Uppdatera register
      </button>
    </header>

    {state.status === 'loading' ? <div className={`${card} p-5 text-sm text-sg-muted`} role="status">Läser Scoutgamings registrerade uppgifter…</div>
      : state.status === 'error' ? <div className={`${card} p-5`} role="alert">
        <h2 className="font-semibold">{state.authentication ? 'Logga in igen' : 'Registret är inte tillgängligt'}</h2>
        <p className={`${detail} mt-2`}>{state.message}</p>
        {state.authentication && <a href="/admin/structure" className="mt-3 inline-flex items-center gap-1 text-xs text-sg-lime">Öppna intern inloggning <ArrowUpRight size={13} aria-hidden /></a>}
      </div> : counts && workspace && overview && <>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Spelbolag',counts.operators], ['Spelrum',counts.rooms], ['Speltyper i rum',counts.gameTypes], ['Spelbara rum',counts.playable],
          ].map(([label,count]) => <div key={label} className={`${card} flex items-center justify-between gap-2 px-3 py-2`}>
            <dt className="font-mono text-[10px] uppercase tracking-wide text-sg-muted">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{count}</dd>
          </div>)}
        </dl>

        <figure className="system-overview-map m-0">
          <figcaption className="sr-only">Scoutgaming har fem interna arbetsområden: Studio, Drift, Ekonomi, AI och Admin.</figcaption>
          <div className="flex flex-col items-center">
            <div className={`${card} inline-flex items-center gap-3 px-5 py-3`}><Network size={22} className="text-sg-lime" aria-hidden />
              <div><p className="font-semibold">Scoutgaming</p><p className="font-mono text-[10px] text-sg-muted">Intern administration · N1</p></div>
            </div><div className="h-5 border-l border-sg-line" aria-hidden />
          </div>
          <div className="relative grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="absolute inset-x-[10%] top-0 hidden border-t border-sg-line xl:block" aria-hidden />
            {areas.map(area => <Link key={area.title} href={href(area.path)}
              className={`${card} relative flex flex-col gap-3 p-4 transition-colors hover:border-sg-lime/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sg-lime`}>
              <div className="absolute -top-4 left-1/2 hidden h-4 border-l border-sg-line xl:block" aria-hidden />
              <div className="flex items-center gap-2"><area.icon size={19} className={area.accent} aria-hidden />
                <h2 className="font-semibold">{area.title}</h2><ArrowUpRight size={13} className="ml-auto text-sg-muted" aria-hidden />
              </div>
              <p className="text-xs font-medium">{area.summary}</p>
              <div className={`${detail} flex-1`}>{area.items.map(item => <p key={item}>{item}</p>)}</div>
              <span className={`w-fit rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide ${area.status === 'Simulerad' ? 'border-sg-amber/30 text-sg-amber' : 'border-sg-line text-sg-teal'}`}>{area.status}</span>
            </Link>)}
          </div>
        </figure>

        <section aria-labelledby="system-portals-title" className="flex flex-col gap-3">
          <h2 id="system-portals-title" className="font-mono text-[10px] uppercase tracking-[0.15em] text-sg-muted">Från innehåll till spel</h2>
          <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <Portal icon={Layers} number="N1" title="Intern personal" href={href('/admin/clips')} link="Studio & innehåll">
              <p className={detail}>Dealer + rum / bakgrund + bord</p>
              <p className={`${detail} mt-1`}>{counts.compositions} sammansättningar → bolagens paket</p>
            </Portal>
            <Connector label="Tilldela & publicera" />
            <Portal icon={Building2} number="N2" title="Spelbolagsportal" href={href('/admin/admin/operators')} link="Bolag & team">
              <p className={detail}>{counts.operators} registrerade spelbolag</p>
              <p className={`${detail} mt-1`}>Team · Tillåtna designval · Publicerade paket</p>
            </Portal>
            <Connector label="Publicerade spelrum" />
            <Portal icon={Users} number="N3" title="Spelarvy" href={href('/admin/rooms')} link="Spelrum & publicering">
              <p className={detail}>Lobby → spelrum → dealer & spel</p>
              <p className={`${detail} mt-1`}>{counts.rooms} registrerade · {counts.published} publicerade · {counts.playable} spelbara</p>
            </Portal>
          </div>
        </section>

        <section aria-labelledby="system-games-title" className={`${card} p-4`}>
          <div className="mb-3 flex items-center gap-2"><Gamepad2 size={17} className="text-sg-teal" aria-hidden />
            <h2 id="system-games-title" className="text-sm font-semibold">Registrerade spelrum</h2>
            <Link href={href('/admin/rooms')} className="ml-auto inline-flex items-center gap-1 text-xs text-sg-lime">Visa rum <ArrowUpRight size={12} aria-hidden /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{overview.games.map(game => <div key={game.kind} className="flex items-center justify-between gap-3 rounded border border-sg-line bg-sg-bg px-3 py-2">
            <div><h3 className="text-sm font-medium">{game.name}</h3><p className="mt-0.5 text-[10px] text-sg-muted">{game.playable} spelbara</p></div>
            <p className="text-right"><span className="text-lg font-semibold tabular-nums">{game.rooms}</span><span className="ml-1 text-xs text-sg-muted">rum</span></p>
          </div>)}</div>
          {!counts.rooms && <p className={`${detail} mt-3`}>Inga spelrum är registrerade.</p>}
          <div className="mt-3 flex flex-wrap gap-2">{workspace.catalog.administration.operators.map(operator => <Link key={operator.id}
            href={systemHref('/admin/admin/operators',{operator:operator.id})} className="rounded border border-sg-line px-2 py-1 text-[11px] text-sg-muted hover:text-sg-lime">
            {operator.name} · {workspace.catalog.administration.rooms.filter(room => room.operatorId === operator.id).length} rum
          </Link>)}</div>
        </section>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-sg-line pt-3 text-[10px] text-sg-muted">
          <span>Register läst {new Date(workspace.catalog.readAt).toLocaleString('sv-SE')}</span>
          <span>Rum i Studio = bakgrund · Spelrum hör till spelbolag</span>
        </footer>
      </>}
  </section>;
}

function Portal({ icon:Icon, number, title, href, link, children }: {
  icon:LucideIcon; number:string; title:string; href:string; link:string; children:ReactNode;
}) {
  return <article className={`${card} flex flex-col gap-3 p-4`}>
    <div className="flex items-center gap-2"><Icon size={17} className="text-sg-teal" aria-hidden /><h3 className="text-sm font-semibold">{title}</h3><span className="ml-auto font-mono text-[10px] text-sg-lime">{number}</span></div>
    <div className="flex-1">{children}</div>
    <Link href={href} className="inline-flex items-center gap-1 text-xs text-sg-lime">{link} <ArrowUpRight size={12} aria-hidden /></Link>
  </article>;
}

function Connector({ label }: {label:string}) {
  return <div className="flex items-center justify-center gap-2 text-center text-[9px] text-sg-muted lg:w-24 lg:flex-col">
    <span>{label}</span><ArrowRight size={18} className="rotate-90 lg:rotate-0" aria-hidden />
  </div>;
}
