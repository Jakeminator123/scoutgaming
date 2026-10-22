import {Building2,Clapperboard,Plus} from 'lucide-react';
import Link from '../../../runtime/navigation';

const actions=[
  {label:'Skapa dealer',href:'/admin/dealers?view=create',description:'Namnge en ny dealer och lägg sedan till klipp.',Icon:Plus},
  {label:'Fortsätt redigera',href:'/admin/clips',description:'Öppna klippkartan och välj den dealer du vill arbeta med.',Icon:Clapperboard},
  {label:'Hantera spelbolag',href:'/admin/companies',description:'Hantera bolag, team och bolagets journal.',Icon:Building2},
];
export function AdminHome() {
  return <section className="admin-home" aria-labelledby="admin-home-title">
    <header className="admin-home-heading"><p className="sg-eyebrow">Scoutgaming · Admin</p><h1 id="admin-home-title">Vad vill du göra?</h1></header>
    <nav className="grid gap-4 md:grid-cols-3" aria-label="Börja arbeta">{actions.map(({label,href,description,Icon})=><Link key={href} href={href} className="admin-home-link"><div><Icon size={24} aria-hidden="true"/><h2>{label}</h2><p>{description}</p></div></Link>)}</nav>
  </section>;
}
