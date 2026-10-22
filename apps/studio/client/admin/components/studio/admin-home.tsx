import {ArrowRight,Building2,Clapperboard} from 'lucide-react';
import Link from '../../../runtime/navigation';
import {adminNavigationGroups,adminSystemGroups} from '../../lib/admin-navigation';

// The footer repeats no Skapande/Verksamhet page: only System's work tools and access.
const systemLinks=[...adminSystemGroups[0].links,...adminSystemGroups.flatMap(group=>group.links).filter(link=>link.href==='/admin/admin/accounts')];
export function AdminHome() {
  return <section className="admin-home" aria-labelledby="admin-home-title">
    <header className="admin-home-heading">
      <p className="sg-eyebrow">Scoutgaming · Admin</p>
      <h1 id="admin-home-title">Vad vill du arbeta med?</h1>
      <p>Skapa spelupplevelsen eller hantera verksamheten. Börja där din uppgift hör hemma.</p>
    </header>
    <div className="admin-home-areas">
      {adminNavigationGroups.map(group=>{const Icon=group.id==='creation'?Clapperboard:Building2;return <section key={group.id} className="admin-home-area" aria-labelledby={'home-'+group.id}>
        <header><span className="admin-home-area-icon"><Icon size={24} aria-hidden="true"/></span><div><h2 id={'home-'+group.id}>{group.label}</h2><p>{group.description}</p></div></header>
        <div className="admin-home-links">{group.links.map(({label,href,description})=><Link href={href} key={href} className="admin-home-link"><div><h3>{label}</h3><p>{description}</p></div><ArrowRight size={18} aria-hidden="true"/></Link>)}</div>
      </section>;})}
    </div>
    <footer className="admin-home-footer"><p>System</p><nav aria-label="System">{systemLinks.map(({label,href})=><Link key={href} href={href}>{label} <ArrowRight size={14} aria-hidden="true"/></Link>)}</nav></footer>
  </section>;
}
