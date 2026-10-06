'use client';

import { usePathname } from 'next/navigation';
import { labUrl } from '../lib/lab-url.mjs';
import { STUDIO_PRIMARY_NAVIGATION, STUDIO_TOOL_NAVIGATION, studioNavigationItem } from '../lib/studio-navigation.mjs';
import { isPartnerSurfacePath, resolveWorkspaceSurfacePath } from '../lib/workspace-surfaces.mjs';
import styles from './workspace-navigation.module.css';

export function WorkspaceNavigation() {
  const pathname = usePathname();
  const surface = resolveWorkspaceSurfacePath(pathname);
  const current = studioNavigationItem(surface?.legacyPath ? surface.studioPath : pathname);
  const toolActive = STUDIO_TOOL_NAVIGATION.some(item => item === current);
  if (isPartnerSurfacePath(pathname)) return null;
  // Full page navigation retains native unsaved-draft protection, including Back/Forward.
  return <header className={styles.header}>
    <a className={styles.brand} href="/control" aria-label="Croupier Kontrollpanel · Scout Gaming"><span>scout<b>/</b>gaming</span><strong>Croupier Kontrollpanel</strong></a>
    <nav className={styles.nav} aria-label="Interna arbetsytor">
      <a href="/control" aria-current={surface?.surface === 'control' && !surface.legacyPath ? 'page' : undefined}>Kontrollpanel</a>
      <a href="/partner">Partnerportal · förhandsvisning</a>
      <a href="/play">Spelaryta</a>
      {STUDIO_PRIMARY_NAVIGATION.map(item => <a key={item.href} href={labUrl(item.href)} aria-current={current === item ? 'page' : undefined}>{item.label}</a>)}
      <details className={styles.tools}>
        <summary data-active={toolActive || undefined}>Verktyg</summary>
        <div>{STUDIO_TOOL_NAVIGATION.map(item => <a key={item.href} href={labUrl(item.href)} aria-current={current === item ? 'page' : undefined}>{item.label}</a>)}</div>
      </details>
    </nav>
  </header>;
}
