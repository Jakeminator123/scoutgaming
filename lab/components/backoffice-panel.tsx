'use client';

import { useEffect, useState } from 'react';
import { BACKOFFICE_GROUPS, BACKOFFICE_SECTIONS, backofficeFrameUrl, backofficeGroup, backofficeSection } from '../lib/backoffice-navigation.mjs';
import styles from './backoffice-panel.module.css';

export function BackofficePanel({ origin }: {origin: string | null}) {
  const [section, setSection] = useState('ops');
  useEffect(() => {
    const select = () => setSection(backofficeSection(window.location.hash));
    select(); window.addEventListener('hashchange', select);
    return () => window.removeEventListener('hashchange', select);
  }, []);
  const url = backofficeFrameUrl(origin, section);
  const group = backofficeGroup(section);
  return <main className={styles.main}>
    <div className={styles.heading}><div><span className="eyebrow">STUDIO · BACKOFFICE</span><h1>Backoffice</h1><p>Konton, bord, drift och granskning. Ditt befintliga konto och dess behörigheter gäller.</p></div>{url ? <a href={url.replace('?workspace=lab', '')}>Öppna aktuell administrationssida ↗</a> : null}</div>
    <nav className={styles.groups} aria-label="Backoffice-områden">
      {BACKOFFICE_GROUPS.map(item => <a key={item.id} href={`#${item.sections[0]}`} aria-current={item === group ? 'location' : undefined}>{item.label}</a>)}
    </nav>
    <nav className={styles.sections} aria-label={group.label}>
      {group.sections.map(id => <a key={id} href={`#${id}`} aria-current={id === section ? 'location' : undefined}>{BACKOFFICE_SECTIONS.find(item => item.id === id)?.label}</a>)}
    </nav>
    <p className={styles.migration}>Dessa funktioner använder tills vidare den befintliga Backoffice-backenden. Menyn är samlad här; flytten av administrationens API och lagring är ännu inte aktiverad.</p>
    {!url ? <p className="feedback error" role="alert">Produktens Backoffice-adress är inte konfigurerad. Starta det gemensamma Lab-/produktparet för lokal administration.</p> : <iframe className={styles.frame} src={url} title={`Backoffice · ${BACKOFFICE_SECTIONS.find(item => item.id === section)?.label}`} referrerPolicy="strict-origin-when-cross-origin" />}
  </main>;
}
