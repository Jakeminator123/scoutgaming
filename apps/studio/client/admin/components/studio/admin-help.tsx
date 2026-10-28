import Link from '../../../runtime/navigation';
import {adminNavigationGroups,adminSystemGroups} from '../../lib/admin-navigation';

// Hjälp (/admin/guide): what each Admin page does, from the shared menu, plus the two documents.
const GUIDE='https://github.com/Jakeminator123/scoutgaming/blob/main/apps/studio/docs/README.md';
const GLOSSARY='https://github.com/Jakeminator123/scoutgaming/blob/main/apps/studio/docs/TERMINOLOGI.md';
const groups=[
  {id:'overview',label:'Översikt',description:'Startsidan.',links:[{label:'Översikt',href:'/admin',description:'De vanligaste stegen: skapa dealer, fortsätt redigera, hantera spelbolag.'}]},
  ...adminNavigationGroups,
  ...adminSystemGroups.map(group=>({id:'system-'+group.label,label:group.label,description:'',links:group.links})),
];

export function AdminHelp() {
  return <section className="admin-system-page" aria-labelledby="admin-help-title">
    <header className="admin-system-header"><div><p className="sg-eyebrow">System</p><h1 id="admin-help-title">Hjälp</h1>
      <p>Vad varje sida i Admin gör. Arbetsstegen står i användarguiden och orden i ordlistan.</p></div></header>
    <nav className="admin-system-actions" aria-label="Dokument">
      <a className="studio-button" href={GUIDE} target="_blank" rel="noopener">Användarguiden ↗</a>
      <a className="studio-button" href={GLOSSARY} target="_blank" rel="noopener">Ordlistan ↗</a>
    </nav>
    <div className="admin-system-grid">{groups.map(group=><section key={group.id} className="admin-system-card" aria-labelledby={'admin-help-'+group.id}>
      <h2 id={'admin-help-'+group.id}>{group.label}</h2>
      {group.description&&<p>{group.description}</p>}
      <ul>{group.links.map(link=><li key={link.href}><Link href={link.href}>{link.label}</Link>{link.description?' · '+link.description:''}</li>)}</ul>
    </section>)}</div>
  </section>;
}
