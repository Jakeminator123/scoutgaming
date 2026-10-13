"use client"
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Network, LayoutDashboard, Activity, CircleDollarSign, Settings, Cpu, House } from 'lucide-react';
const main = [
  {label:'Översikt',href:'/control',icon:House},
  {label:'Struktur',href:'/control/structure',icon:Network},
  {label:'Studio',href:'/control/clips',icon:LayoutDashboard},
  {label:'Bord & bakgrunder',href:'/control/assets',icon:LayoutDashboard},
  {label:'Drift',href:'/control/drift',icon:Activity},
  {label:'Ekonomi',href:'/control/ekonomi',icon:CircleDollarSign},
];
const system = [['Agentmodeller','/control/ai/models'],['Studioassistent','/control/ai/chat'],['Spelbolag & team','/control/admin/operators'],['Konton','/control/admin/accounts'],['Spelare','/control/admin/players'],['Betalningar','/control/admin/payments'],['Integrationer','/control/admin/api'],['Ändringslogg','/control/admin/log']];
export function StudioSidebar() {
  const path=usePathname();
  return <aside className="studio-sidebar"><Link href="/control" className="studio-wordmark">scout<span>/</span>gaming<small>WORKSPACE</small></Link>
    <nav aria-label="Huvudmeny">{main.map(({label,href,icon:Icon})=><Link key={href} href={href} aria-label={label} title={label} aria-current={path===href?'page':undefined}><Icon size={17}/><span>{label}</span></Link>)}
      <details className="studio-system-menu"><summary aria-label="System" title="System"><Settings size={17}/><span>System</span></summary>{system.map(([label,href])=><Link key={href} href={href} aria-current={path===href?'page':undefined}>{label}</Link>)}</details>
    </nav><div className="studio-sidebar-foot"><Cpu size={14}/><span>Intern arbetsyta</span></div>
  </aside>;
}
