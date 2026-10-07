'use client';

import { useEffect } from 'react';
import { labUrl } from '../lib/lab-url.mjs';
import { CONTROL_TOOLS, controlToolPath, legacyControlView } from '../lib/control-workspace.mjs';
import styles from './control-workspace.module.css';

export function ControlWorkspace({ user }: { user: string; initialView?: string }) {
  useEffect(() => {
    const navigate = () => {
      const next = legacyControlView(window.location.hash);
      if (!next) return;
      const tool = controlToolPath(next);
      if (tool) window.location.replace(labUrl(tool));
    };
    navigate();
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  const primary = CONTROL_TOOLS[0];
  return <main className={styles.shell}>
    <header className={styles.intro}><p className={styles.kicker}>// NIVÅ 1 · INTERN DRIFT</p><h1>Översikt</h1>
      <p>Vår gemensamma arbetsyta för lanes, klipp, konton och drift.</p><span className={styles.user}>Inloggad som {user}</span>
    </header>
    <section aria-label="Snabbval" className={styles.quick}><h2>Snabbval</h2>{CONTROL_TOOLS.map(tool => <div className={styles.quickItem} key={tool.href}>
      <a className={tool === primary ? 'sg-btn sg-btn-primary' : 'sg-btn sg-btn-secondary'} href={labUrl(tool.href)}><span>{tool.title}</span><span aria-hidden="true">→</span></a>
      <p>{tool.text}</p>
    </div>)}</section>
    <section className={styles.levels} aria-label="Spelbolag och spelare"><div><h2>Nivå 2 · Spelbolag</h2><p>Intern adminpersonal har också tillgång till spelbolagens ytor. Kundval är ännu inte aktiverat; tills vidare finns tydligt märkta demonstrationer.</p><a href="/partner">Öppna spelbolagens arbetsytor →</a></div>
      <div><h2>Nivå 3 · Spelare</h2><p>Spelaren går till spelstart och befintlig spelinloggning.</p><a href="/play">Öppna spelarytan →</a></div></section>
    <p className={styles.help}>Nya lanes delar fortfarande Astrids klippbank och separata publicerade lane-paket återstår. Operatörens personal loggar in på /partner/login; kvar är inbjudan och återställning för den personalen samt adminens val av en riktig operatör. <a href={labUrl('/control/guide')}>Läs guiden →</a></p>
  </main>;
}
