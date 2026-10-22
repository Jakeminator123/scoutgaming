import {Building2,Clapperboard,Plus} from 'lucide-react';
import Link from '../../../runtime/navigation';

const actions=[
  {kind:'dealer',label:'Skapa dealer',href:'/admin/dealers?view=create',description:'Namnge din dealer och bygg klippkartan.',Icon:Plus},
  {kind:'clips',label:'Fortsätt redigera',href:'/admin/clips',description:'Arbeta med klippen, bordet och bakgrunden.',Icon:Clapperboard},
  {kind:'company',label:'Hantera spelbolag',href:'/admin/companies',description:'Välj bolag och hantera dess team och journal.',Icon:Building2},
];

function ActionArtwork({kind}:{kind:string}) {
  return <svg className="admin-home-art" viewBox="0 0 320 164" fill="none" aria-hidden="true" focusable="false">
    {kind==='dealer'?<>
      <rect x="66" y="24" width="132" height="126" rx="16" fill="currentColor" opacity=".09" transform="rotate(-9 66 24)"/>
      <rect x="104" y="16" width="128" height="132" rx="16" fill="#1c2828" stroke="currentColor" strokeOpacity=".45"/>
      <circle cx="168" cy="62" r="20" fill="currentColor" opacity=".65"/>
      <path d="M131 114c0-23 16-35 37-35s37 12 37 35" fill="currentColor" opacity=".35"/>
      <rect x="141" y="127" width="54" height="3" rx="1.5" fill="currentColor" opacity=".35"/>
      <circle cx="231" cy="118" r="22" fill="currentColor"/>
      <path d="M231 108v20m-10-10h20" stroke="#132018" strokeWidth="2.5" strokeLinecap="round"/>
    </>:kind==='clips'?<>
      <path d="M78 49h72v70h88M150 49h88" stroke="currentColor" strokeOpacity=".45" strokeWidth="2"/>
      {[{x:30,y:27,w:78},{x:205,y:27,w:80},{x:110,y:96,w:80}].map(({x,y,w})=><g key={x}>
        <rect x={x} y={y} width={w} height="52" rx="10" fill="#182c2c" stroke="currentColor" strokeOpacity=".5"/>
        <rect x={x+10} y={y+11} width="25" height="30" rx="5" fill="currentColor" opacity=".18"/>
        <path d={'M'+(x+20)+' '+(y+20)+'v12l9-6z'} fill="currentColor" opacity=".8"/>
        <path d={'M'+(x+43)+' '+(y+19)+'h24m-24 9h17m-17 9h21'} stroke="currentColor" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round"/>
      </g>)}
      <circle cx="150" cy="49" r="5" fill="currentColor"/>
    </>:<>
      {[{x:24,y:38,o:.35},{x:172,y:38,o:.35},{x:98,y:20,o:1}].map(({x,y,o})=><g key={x} opacity={o}>
        <rect x={x} y={y} width="124" height="111" rx="14" fill="#232536" stroke="currentColor" strokeOpacity=".5"/>
        <path d={'M'+(x+16)+' '+(y+65)+'V'+(y+17)+'h92v48'} fill="currentColor" opacity=".09"/>
        <circle cx={x+62} cy={y+40} r="10" fill="currentColor" opacity=".8"/>
        <path d={'M'+(x+43)+' '+(y+67)+'q0-18 19-18t19 18'} fill="currentColor" opacity=".4"/>
        <path d={'M'+(x+15)+' '+(y+70)+'q47-23 94 0l-11 22H'+(x+26)+'z'} fill="currentColor" opacity=".27"/>
        <path d={'M'+(x+15)+' '+(y+70)+'q47-23 94 0'} stroke="currentColor" strokeWidth="2"/>
      </g>)}
    </>}
  </svg>;
}

export function AdminHome() {
  return <section className="admin-home" aria-labelledby="admin-home-title">
    <header className="admin-home-heading"><p className="sg-eyebrow">Scoutgaming · Admin</p><h1 id="admin-home-title">Din spelstudio</h1><p>Dealers, bord och bakgrunder. Samlade för dina spelbolag.</p></header>
    <nav className="admin-home-actions" aria-label="Börja arbeta">{actions.map(({kind,label,href,description,Icon})=><Link key={href} href={href} className={'admin-home-link admin-home-'+kind}><ActionArtwork kind={kind}/><div className="admin-home-action-copy"><h2><Icon size={21} aria-hidden="true"/>{label}</h2><p>{description}</p></div></Link>)}</nav>
  </section>;
}
