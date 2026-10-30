"use client"
import {useSyncExternalStore} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {House,Users,LayoutDashboard,Building2,Settings,CircleHelp,type LucideIcon} from 'lucide-react';
import {adminNavigationGroups} from '../../lib/admin-navigation';
import {parseAdminPath} from '../../../runtime/admin-routing.mjs';
import {AdminLogout} from './admin-logout';
import {ThemeToggle} from './theme-toggle';
import {readSharedWorkspace,subscribeSharedWorkspace} from '../../lib/connected-studio.mjs';
import {adminMenuCounts} from '../../lib/dealer-coverage.mjs';

const icons:Record<string,LucideIcon>={'/admin/dealers':Users,'/admin/scenes':LayoutDashboard,'/admin/companies':Building2,'/admin/system':Settings,'/admin/guide':CircleHelp};
// A nav page marks the menu entry it belongs to, so exactly one entry is current.
const menuHome:Record<string,string>={home:'/admin',dealers:'/admin/dealers',dealer:'/admin/dealers',scenes:'/admin/scenes',companies:'/admin/companies',company:'/admin/companies',room:'/admin/companies',system:'/admin/system',guide:'/admin/guide'};
// What a counter next to a menu entry means; the numbers come from adminMenuCounts (lib/dealer-coverage.mjs).
const countHints:Record<string,(n:number)=>string>={
  '/admin/dealers':n=>n===1?'1 dealer saknar klipp':`${n} dealers saknar klipp`,
  '/admin/companies':n=>n===1?'1 spelbord är inte spelbart':`${n} spelbord är inte spelbara`,
};
// The menu reads nothing itself: it counts from what the pages last read or saved (shareWorkspace in
// lib/connected-studio.mjs), so a saved change updates it and a page that has read nothing yet shows no counter.
export function StudioSidebar() {
  const workspace=useSyncExternalStore(subscribeSharedWorkspace,readSharedWorkspace,readSharedWorkspace);
  return <StudioMenu counts={adminMenuCounts(workspace)}/>;
}
export function StudioMenu({counts={}}:{counts?:Record<string,number>}={}) {
  const current=menuHome[parseAdminPath(usePathname()).page]??'';
  return <aside className="studio-sidebar"><Link href="/admin" className="studio-wordmark"><span className="studio-mark" aria-hidden="true">S</span><span><b>scout<i>/</i>gaming</b><small>Scoutgaming Admin</small></span></Link>
    <nav aria-label="Huvudmeny">
      <Link href="/admin" title="Översikt" aria-current={current==='/admin'?'page':undefined}><House size={17} aria-hidden="true"/><span>Översikt</span></Link>
      {adminNavigationGroups.map(group=><div className="studio-nav-group" key={group.id} role="group" aria-labelledby={'nav-'+group.id}>
        <p id={'nav-'+group.id} className="studio-nav-label">{group.label}</p>
        {group.links.map(({label,href})=>{const Icon=icons[href]??House,count=counts[href]??0,hint=count>0?countHints[href]?.(count):undefined;
          return <Link key={href} href={href} title={hint?`${label} · ${hint}`:label} aria-label={hint?`${label}, ${hint}`:undefined} aria-current={current===href?'page':undefined}><Icon size={17} aria-hidden="true"/><span>{label}</span>{hint&&<b className="studio-nav-count" aria-hidden="true">{count}</b>}</Link>;})}
      </div>)}
    </nav>
    <div className="studio-sidebar-foot"><ThemeToggle/><AdminLogout/></div>
  </aside>;
}
