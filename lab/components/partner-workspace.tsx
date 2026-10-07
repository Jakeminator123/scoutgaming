'use client';

import { useEffect } from 'react';
import { labUrl } from '../lib/lab-url.mjs';
import { workspaceSurfacePath } from '../lib/workspace-surfaces.mjs';
import { normalizeView } from './kevin-bo/navigation.mjs';
import styles from './control-workspace.module.css';

type Demonstration = { slug: string; name: string };

export function PartnerWorkspace({ user, demonstrations, preview = true }: {
  user: string; demonstrations: Demonstration[]; preview?: boolean;
}) {
  const legacyOperator = preview ? demonstrations[0]?.slug : undefined;
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

  if (!preview) return <main className={styles.shell}>
    <header className={styles.intro}><p className={styles.eyebrow}>Nivå 2 · Spelbolag</p><h1>Partnerportal</h1>
      <p>Du ser bara de spelbolag ditt konto är kopplat till.</p>
      <span className={styles.user}>Inloggad som {user}</span>
    </header>
    <section className={styles.tools} aria-label="Spelbolag">{demonstrations.map(operator => <a className={styles.tool} key={operator.slug} href={workspaceSurfacePath('partner', 'ops', operator.slug) ?? '/partner'}>
      <h2>{operator.name}<span aria-hidden="true"> →</span></h2><p>Öppna arbetsytan för det här spelbolaget.</p>
    </a>)}</section>
    <p className={styles.help}>Spelare, transaktioner och rapporter är inte anslutna. <a href="/partner/login">Byt konto</a></p>
  </main>;

  return <main className={styles.shell}>
    <header className={styles.intro}><p className={styles.eyebrow}>Nivå 2 · Spelbolag</p><h1>Partnerportal</h1>
      <p>Som intern adminpersonal har du tillgång till nivå 1, 2 och 3 med samma konto. Spelbolagens egen personal loggar in separat.</p>
      <span className={styles.user}>Inloggad som {user}</span>
      <p><a className="primary-button" href="/partner/login">Logga in som spelbolag</a></p>
    </header>
    <section className={styles.notice} aria-labelledby="preview-operators"><h2 id="preview-operators">Förhandsvisning</h2>
      <p>Demonstrationerna nedan visar exempeldata. De är inte anslutna kunder. Riktiga spelbolag ser bara sin egen organisation efter inloggning.</p>
    </section>
    <section className={styles.tools} aria-label="Förhandsvisning">{demonstrations.map(operator => <a className={styles.tool} key={operator.slug} href={workspaceSurfacePath('partner', 'ops', operator.slug) ?? '/partner'}>
      <h2>{operator.name}<span aria-hidden="true"> →</span></h2><p>Öppna demonstration med exempeldata och lokala designprov.</p>
    </a>)}</section>
    <section className={styles.levels} aria-label="Övriga nivåer"><div><h2>Nivå 1 · Intern administration</h2><p>Lanes, klipp, konton och drift.</p><a href="/control">Till Kontrollpanelen →</a></div>
      <div><h2>Nivå 3 · Spelare</h2><p>Öppna spelarlobbyn med samma konto.</p><a href="/play">Till spelarytan →</a></div></section>
    <p className={styles.help}>Spelbolagens egen personal ska bara nå sin organisations tilldelade innehåll. Kundinloggning och kundspecifik publicering återstår. <a href={labUrl('/guide')}>Läs guiden →</a></p>
  </main>;
}
