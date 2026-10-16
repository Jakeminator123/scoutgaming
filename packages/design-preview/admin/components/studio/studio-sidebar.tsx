"use client"
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Network, LayoutDashboard, Activity, CircleDollarSign, Settings, Cpu, House, Users, Trash2 } from 'lucide-react';
import {adminToolName} from '../../../runtime/admin-routing.mjs';
const main = [
  {label:'Översikt',href:'/admin',icon:House},
  {label:'Spelbolag & rum',href:'/admin/rooms?view=registered',icon:Network},
  {label:'Kopplingar',href:'/admin/structure',icon:Network},
  {label:'Radering',href:'/admin/deletion',icon:Trash2},
  {label:'Dealers',href:'/admin/dealers',icon:Users},
  {label:'Klippkarta',href:'/admin/clips',icon:LayoutDashboard},
  {label:'Bord & bakgrunder',href:'/admin/assets',icon:LayoutDashboard},
  {label:'Verktyg',href:'/admin/tools',icon:Settings},
  {label:'Drift',href:'/admin/drift',icon:Activity},
  {label:'Ekonomi',href:'/admin/ekonomi',icon:CircleDollarSign},
];
const system = [['Agentmodeller','/admin/ai/models'],['Adminroboten','/admin/ai/chat'],['Konton & åtkomst','/admin/admin/accounts'],['Betalningar','/admin/admin/payments'],['Integrationer','/admin/admin/api'],['Ändringslogg','/admin/admin/log']];
export function StudioSidebar() {
  const pathname=usePathname();
  const query=useSearchParams();
  const registeredRoom=pathname==='/admin/rooms'&&query.get('view')==='registered';
  const path=pathname==='/admin/admin/players'?'/admin/admin/accounts':pathname;
  return <aside className="studio-sidebar"><Link href="/admin" className="studio-wordmark">scout<span>/</span>gaming<small>WORKSPACE</small></Link>
    <nav aria-label="Huvudmeny">{main.map(({label,href,icon:Icon})=><Link key={href} href={href} style={href==='/admin/deletion'?{color:'#f87171'}:undefined} aria-label={label} title={label} aria-current={path===href||href==='/admin/rooms?view=registered'&&registeredRoom||href==='/admin/tools'&&adminToolName(path)?'page':undefined}><Icon size={17}/><span>{label}</span></Link>)}
      <details className="studio-system-menu"><summary aria-label="System" title="System"><Settings size={17}/><span>System</span></summary>{system.map(([label,href])=><Link key={href} href={href} aria-current={path===href?'page':undefined}>{label}</Link>)}</details>
    </nav><div className="studio-sidebar-foot"><Cpu size={14}/><span>Intern arbetsyta</span></div>
  </aside>;
}
