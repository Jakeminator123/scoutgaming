import { Activity, ArrowRight, Building2, CircleDollarSign, Clapperboard, Layers3 } from 'lucide-react';
import Link from '../../../runtime/navigation';

const destinations = [
  { title:'Dealers och klipp', description:'Arbeta med dealerklipp och sammansättningar.', href:'/control/clips', icon:Clapperboard, secondary:{label:'Bord och bakgrunder',href:'/control/assets'} },
  { title:'Spelbolag och rum', description:'Se bolag, spelrum och deras kopplingar till spel och dealers.', href:'/control/admin/operators', icon:Building2, secondary:{label:'Visa spelrum',href:'/control/rooms'} },
  { title:'Ekonomi', description:'Se kontorörelser och diagram. Öppna journalen för detaljer.', href:'/control/ekonomi', icon:CircleDollarSign, secondary:null },
  { title:'Drift', description:'Följ spelstatus och den löpande driften.', href:'/control/drift', icon:Activity, secondary:null },
  { title:'System', description:'Hitta struktur, konton och tekniska inställningar.', href:'/control/structure', icon:Layers3, secondary:{label:'Konton och åtkomst',href:'/control/admin/accounts'} },
] as const;

export function AdminHome() {
  return <section className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-6 lg:px-8" aria-labelledby="admin-home-title">
    <header className="max-w-2xl">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sg-lime">Scoutgaming · Intern arbetsyta</p>
      <h1 id="admin-home-title" className="mt-2 text-2xl font-semibold tracking-tight">Vad vill du göra?</h1>
      <p className="mt-2 text-sm text-sg-muted">Välj ett område. Dina val för spelbolag och rum gör du inne i respektive arbetsyta.</p>
    </header>
    <div className="grid max-w-5xl gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {destinations.map(({title,description,href,icon:Icon,secondary})=><article key={href} className="flex min-h-48 flex-col rounded-lg border border-sg-line bg-sg-panel p-5">
        <Icon size={22} className="text-sg-lime" aria-hidden="true" />
        <h2 className="mt-4 text-base font-semibold">{title}</h2>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-sg-muted">{description}</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-medium text-sg-lime hover:underline">Öppna {title.toLowerCase()} <ArrowRight size={15} aria-hidden="true" /></Link>
          {secondary&&<Link href={secondary.href} className="text-xs text-sg-muted hover:text-sg-text hover:underline">{secondary.label}</Link>}
        </div>
      </article>)}
    </div>
  </section>;
}
