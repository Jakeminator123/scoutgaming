'use client';

import { useEffect } from 'react';
import { labUrl } from '../lib/lab-url.mjs';
import { workspaceSurfacePath } from '../lib/workspace-surfaces.mjs';
import { normalizeView } from './kevin-bo/navigation.mjs';
import styles from './control-workspace.module.css';

type Demonstration = { slug: string; name: string };

export function PartnerWorkspace({ user, demonstrations }: { user: string; demonstrations: Demonstration[] }) {
  const legacyOperator = demonstrations[0]?.slug;
  useEffect(() => {
    // Preserve old /partner#theme bookmarks without selecting a demo on normal entry.
    const navigate = () => {
      const view = normalizeView(window.location.hash, 'partner');
      const destination = legacyOperator && view ? workspaceSurfacePath('partner', view, legacyOperator) : null;
      if (destination) window.location.replace(destination);
    };
    navigate();
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, [legacyOperator]);

  return <main className={styles.shell}>
    <header className={styles.intro}><p className={styles.eyebrow}>Nivå 2 · Spelbolag</p><h1>Spelbolagens arbetsytor</h1>
      <p>Som intern adminpersonal har du tillgång till nivå 1, 2 och 3 med samma konto.</p>
      <span className={styles.user}>Inloggad som {user}</span>
    </header>
    <section className={styles.notice} aria-labelledby="connected-operators"><h2 id="connected-operators">Anslutna spelbolag</h2>
      <p>Kundval är ännu inte aktiverat i partnerportalen. Här ska du kunna välja bland faktiskt anslutna spelbolag och öppna deras respektive arbetsyta.</p>
      <p>Demonstrationerna nedan visar exempeldata. De är inte anslutna kunder.</p>
    </section>
    <section className={styles.tools} aria-label="Demonstrationer">{demonstrations.map(operator => <a className={styles.tool} key={operator.slug} href={workspaceSurfacePath('partner', 'ops', operator.slug) ?? '/partner'}>
      <h2>{operator.name}<span aria-hidden="true"> →</span></h2><p>Öppna demonstration med exempeldata och lokala designprov.</p>
    </a>)}</section>
    <section className={styles.levels} aria-label="Övriga nivåer"><div><h2>Nivå 1 · Intern administration</h2><p>Lanes, klipp, konton och drift.</p><a href="/control">Till Kontrollpanelen →</a></div>
      <div><h2>Nivå 3 · Spelare</h2><p>Öppna spelarlobbyn med samma konto.</p><a href="/play">Till spelarytan →</a></div></section>
    <p className={styles.help}>Spelbolagens egen personal ska bara nå sin organisations tilldelade innehåll. Kundinloggning och kundspecifik publicering återstår. <a href={labUrl('/guide')}>Läs guiden →</a></p>
  </main>;
}
