import guide from '../docs/guide.json';
import contract from '../../packages/presentation/contracts/policies/studio-contract.json';
import type { StudioView } from './studio-types';
import styles from './studio-guide.module.css';
import { OpenClawSources } from './openclaw-sources';
import { workspaceLocation } from '../lib/dealer-workspace.mjs';
import { labUrl } from '../lib/lab-url.mjs';
import { scoutNavigationItem } from '../lib/scout-navigation.mjs';

function stepOpenLabel(href: string) {
  const hashAt = href.indexOf('#');
  const path = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : href.slice(hashAt + 1);
  const redirect = hash ? workspaceLocation(hash).redirect : null;
  const destination = redirect || (path && path !== '/' ? path : '/control/clips');
  const fromMenu = scoutNavigationItem(destination)?.label;
  const fromGuide = guide.surfaces.find(item => item.name.split('·').map(part => part.trim()).includes(destination))?.name.split('·')[0]?.trim();
  return `Öppna ${fromMenu || fromGuide || destination} →`;
}

export function StudioGuide(_props: { onNavigate: (view: StudioView) => void }) {
  return <article className={styles.guide}>
    <header className="section-intro"><span className="eyebrow">GUIDE / DIN GEMENSAMMA INGÅNG</span><h1>{guide.title}</h1><p>{guide.intro}</p></header>
    <section className={styles.steps} aria-label="Arbetsgång">{guide.steps.map(step => <div key={step.title}><h2>{step.title}</h2><p>{step.body}</p><a className="text-button" href={labUrl(step.href)}>{stepOpenLabel(step.href)}</a></div>)}</section>
    <section className={styles.boundaries}><h2>Ramar som gäller nu</h2><ul>{guide.boundaries.map(text => <li key={text}>{text}</li>)}</ul></section>
    <OpenClawSources />
    <details><summary>Vilken vy använder jag?</summary><dl>{guide.surfaces.map(item => <div key={item.name}><dt>{item.name}</dt><dd>{item.purpose}</dd></div>)}</dl></details>
    <details><summary>Gemensamma begrepp</summary><dl>{contract.terms.map(term => <div key={term.id}><dt>{term.label}</dt><dd>{term.definition}</dd></div>)}</dl></details>
    <details><summary>Var finns mina saker?</summary><p>{guide.storage}</p></details>
    <details><summary>Teknisk källa och ändringar</summary><p>{guide.authority}</p><p>Aktuella arbetsinstruktioner uppdateras i den här guiden och de fem befintliga dokumenten i docs. Original, hemligheter och personliga anteckningar ska inte kopieras in i guiden.</p></details>
  </article>;
}
