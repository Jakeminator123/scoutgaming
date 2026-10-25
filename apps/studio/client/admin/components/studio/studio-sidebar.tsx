"use client"
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Network,LayoutDashboard,Activity,CircleDollarSign,Settings,Cpu,House,Clapperboard,Users,Play,Building2,Wallet,type LucideIcon} from 'lucide-react';
import {adminToolName} from '../../../runtime/admin-routing.mjs';
import {adminNavigationGroups,adminSystemGroups,adminToolHome} from '../../lib/admin-navigation';

const icons:Record<string,LucideIcon>={'/admin/rooms':Network,'/admin/clips':Clapperboard,'/admin/scenes':LayoutDashboard,'/admin/dealers':Users,'/admin/assets':LayoutDashboard,'/admin/rehearsal':Play,'/admin/companies':Building2,'/admin/players':Wallet,'/admin/drift':Activity,'/admin/ekonomi':CircleDollarSign};
export function StudioSidebar() {
  const pathname=usePathname();
  // A deep tool marks the menu page it belongs to, so exactly one entry is current.
  const path=pathname==='/admin/admin/players'?'/admin/players':adminToolHome(adminToolName(pathname))??pathname;
  const systemActive=adminSystemGroups.some(group=>group.links.some(link=>link.href===path));
  return <aside className="studio-sidebar"><Link href="/admin" className="studio-wordmark">scout<span>/</span>gaming<small>ADMIN</small></Link>
    <nav aria-label="Huvudmeny">
      <Link href="/admin" aria-label="Översikt" title="Översikt" aria-current={path==='/admin'?'page':undefined}><House size={17} aria-hidden="true"/><span>Översikt</span></Link>
      {adminNavigationGroups.map(group=><div className="studio-nav-group" key={group.id} role="group" aria-labelledby={'nav-'+group.id}>
        <p id={'nav-'+group.id} className="studio-nav-label">{group.label}</p>
        {group.links.map(({label,href})=>{const Icon=icons[href];return <Link key={href} href={href} aria-label={label} title={label} aria-current={path===href?'page':undefined}><Icon size={17} aria-hidden="true"/><span>{label}</span></Link>;})}
      </div>)}
      <details key={systemActive?'active-system':'system'} open={systemActive||undefined} className="studio-system-menu"><summary aria-label="System" title="System"><Settings size={17} aria-hidden="true"/><span>System</span></summary><div className="studio-system-group">{adminSystemGroups.flatMap(group=>group.links).map(({label,href})=><Link key={href} href={href} aria-current={path===href?'page':undefined}>{label}</Link>)}</div></details>
    </nav><div className="studio-sidebar-foot"><Cpu size={14} aria-hidden="true"/><span>Intern arbetsyta</span></div>
  </aside>;
}
