'use client';

import { useEffect, useState } from 'react';
import { labUrl } from '../lib/lab-url.mjs';
import { CONTROL_TOOLS, controlToolPath, legacyControlView } from '../lib/control-workspace.mjs';
import { workspaceSurfacePath } from '../lib/workspace-surfaces.mjs';
import styles from './control-workspace.module.css';

export function ControlWorkspace({ user, initialView = 'ops' }: { user: string; initialView?: string }) {
  const [view, setView] = useState(initialView);
  useEffect(() => {
    const navigate = () => {
      const next = legacyControlView(window.location.hash);
      if (!next) return;
      const tool = controlToolPath(next);
      if (tool) { window.location.replace(labUrl(tool)); return; }
      setView(next);
      window.history.replaceState(window.history.state, '', workspaceSurfacePath('control', next));
    };
    navigate();
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  return <main className={styles.shell}>
    <header className={styles.intro}><p className={styles.eyebrow}>Nivå 1 · ScoutGamingGroup</p><h1>Administration</h1>
      <p>Vår gemensamma arbetsyta för lanes, klipp, konton och drift.</p><span className={styles.user}>Inloggad som {user}</span>
    </header>
    {view !== 'ops' && <section className={styles.notice} role="status"><strong>Den tidigare exempelvyn är inte ansluten.</strong>
      <p>Här finns de fungerande interna verktygen. Generering och operatörsrapportering är ännu inte anslutna som egna arbetsflöden. Spelbolagets design- och rapportvyer finns i förhandsvisningen av nivå 2.</p>
    </section>}
    <section aria-label="Administrationsverktyg" className={styles.tools}>{CONTROL_TOOLS.map(tool => <a className={styles.tool} key={tool.href} href={labUrl(tool.href)}>
      <h2>{tool.title}<span aria-hidden="true"> →</span></h2><p>{tool.text}</p>
    </a>)}</section>
    <section className={styles.levels} aria-label="Spelbolag och spelare"><div><h2>Nivå 2 · Spelbolag</h2><p>Intern adminpersonal har också tillgång till spelbolagens ytor. Kundval är ännu inte aktiverat; tills vidare finns tydligt märkta demonstrationer.</p><a href="/partner">Öppna spelbolagens arbetsytor →</a></div>
      <div><h2>Nivå 3 · Spelare</h2><p>Spelaren går till spelstart och befintlig spelinloggning.</p><a href="/play">Öppna spelarytan →</a></div></section>
    <p className={styles.help}>Nya lanes delar fortfarande Astrids klippbank. Separata publicerade lane-paket och spelbolagens egen inloggning återstår. <a href={labUrl('/guide')}>Läs guiden →</a></p>
  </main>;
}
