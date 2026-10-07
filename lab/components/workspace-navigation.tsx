'use client';

import { Suspense, createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { labUrl } from '../lib/lab-url.mjs';
import { SCOUT_FOOTER_NAVIGATION, SCOUT_LEVELS, SCOUT_NAVIGATION, isScoutAuthPath, scoutLevel, scoutNavigationItem } from '../lib/scout-navigation.mjs';
import { isPartnerSurfacePath, resolveWorkspaceSurfacePath } from '../lib/workspace-surfaces.mjs';
import { subscribeShellStatus } from './page-template.mjs';
import { ThemeToggle } from './theme-toggle';
import styles from './workspace-navigation.module.css';
import './page-template.module.css';

export const ShellStatus = createContext<ReactNode>(null);

type ScoutLink = { href: string; label: string };

function ItemLink({ item, active }: { item: ScoutLink; active: boolean }) {
  return <a key={item.label} className={active ? styles.itemActive : styles.item} href={labUrl(item.href)} aria-current={active ? 'page' : undefined}>{item.label}</a>;
}

function LevelLink({ item, current }: { item: ScoutLink & { id: string }; current: boolean }) {
  return <a key={item.id} className={current ? styles.levelOn : styles.level} href={labUrl(item.href)} aria-current={current ? 'true' : undefined}>{item.label}</a>;
}

// Rendered as an element so its hooks run inside React even when the shell itself is called as a plain function.
function StatusSlot() {
  const externalStatus = useContext(ShellStatus);
  const [localStatus, setLocalStatus] = useState<ReactNode>(null);
  useEffect(() => subscribeShellStatus(setLocalStatus), []);
  const status = externalStatus ?? localStatus;
  return status ? <div className={styles.status}>{status}</div> : null;
}

function Shell({ pathname, search, children }: { pathname: string; search: string; children?: ReactNode }) {
  const surface = resolveWorkspaceSurfacePath(pathname);
  const located = surface?.legacyPath ?? pathname;
  const current = scoutNavigationItem(search ? `${located}?${search}` : located);
  const overview = SCOUT_NAVIGATION[0].items[0];
  const active = current ?? (surface?.surface === 'control' && !surface.legacyPath ? overview : null);
  const level = scoutLevel(pathname) ?? 'admin';
  const section = active?.label ?? (level === 'player' ? 'Spelare' : 'Översikt');
  // Full page navigation retains native unsaved-draft protection, including Back/Forward.
  return <div className={`${styles.shell} sg-shell`}>
    <aside className={styles.sidebar}>
      <a className={styles.brand} href="/control" aria-label="ScoutGamingGroup · Administration">
        <span className={styles.wordmark}>scout<b>/</b>gaming</span>
        <span className={styles.product}>CROUPIER STUDIO · AI LIVE CASINO</span>
        <span className="sr-only" aria-hidden="true">Nivå 1 · ScoutGamingGroup</span>
      </a>
      <nav className={styles.nav} aria-label="ScoutGamingGroup administration">
        {SCOUT_NAVIGATION.map(group => <div className={styles.group} key={group.label || 'overview'}>
          {group.label ? <p className={styles.groupLabel}>{group.label}</p> : null}
          {group.items.map(item => ItemLink({ item, active: active === item }))}
        </div>)}
      </nav>
      <div className={styles.footer}>
        {SCOUT_FOOTER_NAVIGATION.map(item => ItemLink({ item, active: active === item }))}
      </div>
    </aside>
    <div className={styles.column}>
      <header className={styles.topbar}>
        <p className={styles.crumb}>{level === 'player' ? 'Nivå 3' : 'Nivå 1'} <span className={styles.sep} aria-hidden="true">/</span> <strong>{section}</strong></p>
        <StatusSlot />
        <div className={styles.levels} role="group" aria-label="Byt nivå">
          {SCOUT_LEVELS.map(item => LevelLink({ item, current: item.id === level }))}
        </div>
        <ThemeToggle />
      </header>
      {children}
    </div>
  </div>;
}

function ShellQuery({ pathname, children }: { pathname: string; children?: ReactNode }) {
  const search = useSearchParams()?.toString() ?? '';
  return <Shell pathname={pathname} search={search}>{children}</Shell>;
}

export function WorkspaceNavigation({ children }: { children?: ReactNode } = {}) {
  const pathname = usePathname() || '';
  if (isPartnerSurfacePath(pathname) || isScoutAuthPath(pathname)) return children ?? null;
  // Query lives under Suspense so a static page can still prerender the shell.
  return <Suspense fallback={<Shell pathname={pathname} search="">{children}</Shell>}>
    <ShellQuery pathname={pathname}>{children}</ShellQuery>
  </Suspense>;
}
