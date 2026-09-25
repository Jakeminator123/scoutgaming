import guide from '../docs/guide.json';
import contract from '../policies/studio-contract.json';
import type { StudioView } from './studio-types';
import styles from './studio-guide.module.css';
import { OpenClawSources } from './openclaw-sources';

const viewLabels: Record<StudioView, string> = { tree: 'Nodträdet', lab: 'Eventstudion', videos: 'Videobanken', activity: 'Händelselogg', openclaw: 'Chatt & OpenClaw', guide: 'Guide' };

export function StudioGuide({ onNavigate }: { onNavigate: (view: StudioView) => void }) {
  return <article className={styles.guide}>
    <header className="section-intro"><span className="eyebrow">GUIDE / DIN GEMENSAMMA INGÅNG</span><h1>{guide.title}</h1><p>{guide.intro}</p></header>
    <section className={styles.steps} aria-label="Arbetsgång">{guide.steps.map(step => <div key={step.title}><h2>{step.title}</h2><p>{step.body}</p><button className="text-button" onClick={() => onNavigate(step.view as StudioView)}>Öppna {viewLabels[step.view as StudioView]} →</button></div>)}</section>
    <section className={styles.boundaries}><h2>Ramar som gäller nu</h2><ul>{guide.boundaries.map(text => <li key={text}>{text}</li>)}</ul></section>
    <OpenClawSources />
    <details><summary>Vilken vy använder jag?</summary><dl>{guide.surfaces.map(item => <div key={item.name}><dt>{item.name}</dt><dd>{item.purpose}</dd></div>)}</dl></details>
    <details><summary>Gemensamma begrepp</summary><dl>{contract.terms.map(term => <div key={term.id}><dt>{term.label}</dt><dd>{term.definition}</dd></div>)}</dl></details>
    <details><summary>Var finns mina saker?</summary><p>{guide.storage}</p></details>
    <details><summary>Teknisk källa och ändringar</summary><p>{guide.authority}</p><p>Aktiva texter i jakob-docs är fördjupning. Nya arbetsinstruktioner uppdateras här. Original, hemligheter och personliga anteckningar ska inte kopieras in i guiden.</p></details>
  </article>;
}
