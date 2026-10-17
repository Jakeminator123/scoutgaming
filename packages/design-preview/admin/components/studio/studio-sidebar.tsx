"use client"
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Network, LayoutDashboard, Activity, CircleDollarSign, Settings, Cpu, House, Clapperboard } from 'lucide-react';
import {adminToolName} from '../../../runtime/admin-routing.mjs';
const main = [
  {label:'Översikt',href:'/admin',icon:House},
  {label:'Spelbolag & rum',href:'/admin/rooms',icon:Network},
  {label:'Dealers & klipp',href:'/admin/clips',icon:Clapperboard},
  {label:'Bord & bakgrunder',href:'/admin/assets',icon:LayoutDashboard},
  {label:'Drift',href:'/admin/drift',icon:Activity},
  {label:'Ekonomi',href:'/admin/ekonomi',icon:CircleDollarSign},
];
const system = [['Verktyg','/admin/tools'],['Kopplingar','/admin/structure'],['Användning & beroenden','/admin/deletion'],['Agentmodeller','/admin/ai/models'],['Adminroboten','/admin/ai/chat'],['Konton & åtkomst','/admin/admin/accounts'],['Betalningar','/admin/admin/payments'],['Integrationer','/admin/admin/api'],['Ändringslogg','/admin/admin/log']];
export function StudioSidebar() {
  const pathname=usePathname();
  const path=pathname==='/admin/admin/players'?'/admin/admin/accounts':pathname;
  const systemActive=system.some(([,href])=>href===path)||Boolean(adminToolName(path));
  return <aside className="studio-sidebar"><Link href="/admin" className="studio-wordmark">scout<span>/</span>gaming<small>WORKSPACE</small></Link>
    <nav aria-label="Huvudmeny">{main.map(({label,href,icon:Icon})=><Link key={href} href={href} aria-label={label} title={label} aria-current={path===href||href==='/admin/clips'&&path==='/admin/dealers'?'page':undefined}><Icon size={17} aria-hidden="true"/><span>{label}</span></Link>)}
      <details key={systemActive?'active-system':'system'} open={systemActive||undefined} className="studio-system-menu"><summary aria-label="System" title="System"><Settings size={17} aria-hidden="true"/><span>System</span></summary>{system.map(([label,href])=><Link key={href} href={href} aria-current={path===href||href==='/admin/tools'&&adminToolName(path)?'page':undefined}>{label}</Link>)}</details>
    </nav><div className="studio-sidebar-foot"><Cpu size={14} aria-hidden="true"/><span>Intern arbetsyta</span></div>
  </aside>;
}
