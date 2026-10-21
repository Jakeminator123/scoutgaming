'use client';

import { Suspense, createContext, useContext, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { studioNavigationHref, studioNavigationContextFromQuery } from '../lib/studio-navigation.mjs';
import { labUrl } from '../lib/lab-url.mjs';
import { SCOUT_FOOTER_NAVIGATION, SCOUT_LEVELS, SCOUT_NAVIGATION, isScoutAuthPath, scoutLevel, scoutNavigationItem } from '../lib/scout-navigation.mjs';
import { isPartnerSurfacePath, resolveWorkspaceSurfacePath } from '../../../packages/navigation/workspace-surfaces.mjs';
import { subscribeShellStatus } from './page-template.mjs';
import { ThemeToggle } from './theme-toggle';
import styles from './workspace-navigation.module.css';
import './page-template.module.css';

export const ShellStatus = createContext<ReactNode>(null);

type ScoutLink = { href: string; label: string };
type ScoutGroup = { id: string; label: string; items: readonly ScoutLink[] };

function ItemLink({ item, active, routeKey }: { item: ScoutLink; active: boolean; routeKey: string }) {
  const currentPath = routeKey.split('?')[0].replace(/^\/studio(?=\/)/, '');
  if (active && currentPath === item.href.split('?')[0]) return <span className={styles.itemActive} aria-current="page">{item.label}</span>;
  const params = new URLSearchParams(routeKey.split('?')[1] ?? '');
  let href = item.href.startsWith('/control/')
    ? studioNavigationHref(item.href, {dealerId:params.get('dealer') ?? undefined, laneId:params.get('composition') ?? params.get('lane') ?? undefined, operatorId:params.get('operator') ?? undefined, tableId:params.get('table') ?? undefined}) : labUrl(item.href);
  if (item.href === '/admin/dealer-studio') {
    const destination = new URL(studioNavigationHref(item.href, studioNavigationContextFromQuery(params)), 'https://studio.invalid');
    for (const key of ['operator', 'table', 'room']) {
      const values = params.getAll(key);
      if (!values.length) continue;
      destination.searchParams.delete(key);
      for (const value of values) destination.searchParams.append(key, value);
    }
    href = destination.pathname + destination.search + destination.hash;
  }
  return <a className={active ? styles.itemActive : styles.item} href={href} aria-current={active ? 'page' : undefined}>{item.label}</a>;
}

function NavigationGroup({ group, active, routeKey }: { group: ScoutGroup; active: ScoutLink | null; routeKey: string }) {
  const current = group.items.some(item => item === active);
  const [expanded, setExpanded] = useState(current);
  useEffect(() => { if (current) setExpanded(true); }, [current, routeKey]);
  const labelId = `scout-navigation-${group.id}`;
  const panelId = `${labelId}-items`;
  return <div className={styles.group}>
    <button type="button" id={labelId} className={current ? styles.groupButtonActive : styles.groupButton}
      aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(value => !value)}>
      <span>{group.label}</span>
      <svg className={styles.chevron} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
    <div className={styles.groupItems} id={panelId} hidden={!expanded} aria-labelledby={labelId}>
      {group.items.map(item => <ItemLink key={item.href} item={item} active={active === item} routeKey={routeKey} />)}
    </div>
  </div>;
}

function LevelLink({ item, current }: { item: ScoutLink & { id: string }; current: boolean }) {
  return <a key={item.id} className={current ? styles.levelOn : styles.level} href={labUrl(item.href)} aria-current={current ? 'true' : undefined}>{item.label}</a>;
}

function MobileNavigation({ brand, children }: { brand: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); toggle.current?.focus(); };
  const escape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || !open || !toggle.current?.getClientRects().length) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };
  return <aside className={styles.sidebar} onKeyDown={escape}>
    <div className={styles.mobileHeading}>{brand}<button ref={toggle} type="button" className={styles.menuToggle}
      aria-expanded={open} aria-controls="scout-mobile-navigation" onClick={() => open ? close() : setOpen(true)}>{open ? 'Stäng meny' : 'Meny'}</button></div>
    <div id="scout-mobile-navigation" className={styles.menuPanel} data-open={open}>{children}</div>
  </aside>;
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
  const routeKey = search ? `${located}?${search}` : located;
  const current = scoutNavigationItem(routeKey);
  const overview = SCOUT_FOOTER_NAVIGATION.find(item => item.href === '/control') ?? null;
  const active = current ?? (surface?.surface === 'control' && !surface.legacyPath ? overview : null);
  const level = scoutLevel(pathname) ?? 'admin';
  const section = active?.label ?? (level === 'player' ? 'Spelare' : 'Översikt');
  // Full page navigation retains native unsaved-draft protection, including Back/Forward.
  return <div className={`${styles.shell} sg-shell`}>
    <MobileNavigation brand={<a className={styles.brand} href="/control" aria-label="ScoutGamingGroup · Administration">
        <span className={styles.wordmark}>scout<b>/</b>gaming</span>
        <span className={styles.product}>CROUPIER STUDIO</span>
      </a>}>
      <nav className={styles.nav} aria-label="ScoutGamingGroup administration">
        {SCOUT_NAVIGATION.map(group => <NavigationGroup key={group.id} group={group} active={active} routeKey={routeKey} />)}
      </nav>
      <div className={styles.footer}>
        {SCOUT_FOOTER_NAVIGATION.map(item => <ItemLink key={item.href} item={item} active={active === item} routeKey={routeKey} />)}
      </div>
    </MobileNavigation>
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
