import { ArrowRight, Building2, Clapperboard, Layers3, Play } from 'lucide-react';
import Link from '../../../runtime/navigation';

const destinations = [
  { title:'Spelbolag & rum', description:'Välj rum och se bakgrund, dealer och bord. Granska rumsval före publicering.', href:'/admin/rooms', icon:Building2, secondary:{label:'Skapa rum',href:'/admin/publication'} },
  { title:'Dealers och klipp', description:'Välj en dealer och arbeta med dess material. Koppla klipp till utkastet i klippkartan.', href:'/admin/dealers', icon:Clapperboard, secondary:{label:'Klippkarta',href:'/admin/clips'} },
  { title:'Bolag & team', description:'Skapa bolag, bjud in medlemmar och hantera deras åtkomst.', href:'/admin/companies', icon:Building2, secondary:null },
  { title:'Provspelning', description:'Provspela en dealer och följ vad som visas och hörs i spelaren.', href:'/admin/rehearsal', icon:Play, secondary:null },
  { title:'System', description:'Hitta struktur, konton och tekniska inställningar.', href:'/admin/structure', icon:Layers3, secondary:{label:'Konton och åtkomst',href:'/admin/admin/accounts'} },
] as const;

export function AdminHome() {
  return <section className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-6 lg:px-8" aria-labelledby="admin-home-title">
    <header className="max-w-2xl">
      <p className="text-sm font-medium text-sg-lime">Scoutgaming · Intern arbetsyta</p>
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
