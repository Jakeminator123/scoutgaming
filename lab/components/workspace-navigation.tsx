'use client';

import { usePathname } from 'next/navigation';
import { labUrl, stripLabBasePath } from '../lib/lab-url.mjs';
import { BACKOFFICE_SECTIONS } from '../lib/backoffice-navigation.mjs';
import styles from './workspace-navigation.module.css';

const surfaces = [
  ['/', 'Studio och aktiva klipp'], ['/tree', 'Event och regler'],
  ['/videos', 'Mediebibliotek'], ['/activity', 'Uppspelning och spår'],
  ['/zones', 'Bakgrundszoner'], ['/openclaw', 'OpenClaw'], ['/guide', 'Guide'],
] as const;

export function WorkspaceNavigation() {
  const path = stripLabBasePath(usePathname() || '/');
  const administration = path === '/administration';
  return <header className={styles.header}>
    <a className={styles.brand} href={labUrl('/')} aria-label="Backoffice/Lab · Scout Gaming"><span>scout<b>/</b>gaming</span><strong>Backoffice/Lab</strong></a>
    <nav className={styles.nav} aria-label="Backoffice/Lab">
      {surfaces.map(([href, label]) => <a key={href} href={labUrl(href)} aria-current={path === href ? 'page' : undefined}>{label}</a>)}
      <details className={styles.administration}>
        <summary aria-current={administration ? 'page' : undefined}>Administration</summary>
        <div>{BACKOFFICE_SECTIONS.map(section => <a key={section.id} href={`${labUrl('/administration')}#${section.id}`}>{section.label}</a>)}</div>
      </details>
    </nav>
  </header>;
}
