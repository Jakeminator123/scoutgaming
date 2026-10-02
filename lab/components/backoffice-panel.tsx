'use client';

import { useEffect, useState } from 'react';
import { BACKOFFICE_SECTIONS, backofficeFrameUrl, backofficeSection } from '../lib/backoffice-navigation.mjs';
import styles from './backoffice-panel.module.css';

export function BackofficePanel({ origin }: {origin: string | null}) {
  const [section, setSection] = useState('ops');
  useEffect(() => {
    const select = () => setSection(backofficeSection(window.location.hash));
    select(); window.addEventListener('hashchange', select);
    return () => window.removeEventListener('hashchange', select);
  }, []);
  const url = backofficeFrameUrl(origin, section);
  return <main className={styles.main}>
    <div className={styles.heading}><div><span className="eyebrow">BACKOFFICE/LAB · ADMINISTRATION</span><h1>{BACKOFFICE_SECTIONS.find(item => item.id === section)?.label}</h1><p>Ditt befintliga Backoffice-konto och dess behörigheter gäller. Studioinloggning ger inga nya administrativa rättigheter.</p></div>{url ? <a href={url.replace('?workspace=lab', '')}>Öppna administration som egen sida ↗</a> : null}</div>
    {!url ? <p className="feedback error" role="alert">Produktens Backoffice-adress är inte konfigurerad. Starta det gemensamma Lab-/produktparet för lokal administration.</p> : <iframe className={styles.frame} src={url} title={`Backoffice · ${BACKOFFICE_SECTIONS.find(item => item.id === section)?.label}`} referrerPolicy="strict-origin-when-cross-origin" />}
  </main>;
}
