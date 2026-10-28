"use client"
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {House,Users,LayoutDashboard,Building2,Settings,CircleHelp,type LucideIcon} from 'lucide-react';
import {adminNavigationGroups} from '../../lib/admin-navigation';
import {parseAdminPath} from '../../../runtime/admin-routing.mjs';
import {AdminLogout} from './admin-logout';

const icons:Record<string,LucideIcon>={'/admin/dealers':Users,'/admin/scenes':LayoutDashboard,'/admin/companies':Building2,'/admin/system':Settings,'/admin/guide':CircleHelp};
// A nav page marks the menu entry it belongs to, so exactly one entry is current.
const menuHome:Record<string,string>={home:'/admin',dealers:'/admin/dealers',dealer:'/admin/dealers',scenes:'/admin/scenes',companies:'/admin/companies',company:'/admin/companies',room:'/admin/companies',system:'/admin/system',guide:'/admin/guide'};
export function StudioSidebar() {
  const current=menuHome[parseAdminPath(usePathname()).page]??'';
  return <aside className="studio-sidebar"><Link href="/admin" className="studio-wordmark"><span className="studio-mark" aria-hidden="true">S</span><span><b>scout<i>/</i>gaming</b><small>Scoutgaming Admin</small></span></Link>
    <nav aria-label="Huvudmeny">
      <Link href="/admin" title="Översikt" aria-current={current==='/admin'?'page':undefined}><House size={17} aria-hidden="true"/><span>Översikt</span></Link>
      {adminNavigationGroups.map(group=><div className="studio-nav-group" key={group.id} role="group" aria-labelledby={'nav-'+group.id}>
        <p id={'nav-'+group.id} className="studio-nav-label">{group.label}</p>
        {group.links.map(({label,href})=>{const Icon=icons[href]??House;return <Link key={href} href={href} title={label} aria-current={current===href?'page':undefined}><Icon size={17} aria-hidden="true"/><span>{label}</span></Link>;})}
      </div>)}
    </nav>
    <div className="studio-sidebar-foot"><AdminLogout/></div>
  </aside>;
}
