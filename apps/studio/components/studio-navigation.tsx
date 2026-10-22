'use client';

import type { MouseEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { studioNavigationTabs, type StudioNavigationOptions, type StudioDealerTab } from '../lib/studio-navigation.mjs';
import styles from './studio-navigation.module.css';

export type StudioNavigationProps = StudioNavigationOptions & {
  active: StudioDealerTab;
  tabHrefs?: Partial<Record<StudioDealerTab, string>>;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
};

export function StudioNavigation({ tabHrefs, onNavigate, ...context }: StudioNavigationProps) {
  const query = useSearchParams();
  context = {
    ...(query?.get('composition') || query?.get('lane') ? { laneId: query.get('composition') || query.get('lane')! } : {}),
    ...(query?.get('operator') ? { operatorId: query.get('operator')! } : {}),
    ...(query?.get('table') ? { tableId: query.get('table')! } : {}),
    ...(query?.get('game') ? { game: query.get('game')! } : {}),
    ...Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined)),
  } as typeof context;
  // Keep explicit room scope, including ambiguous values, for the destination's
  // existing validation. Navigation must not turn an invalid selection into one room.
  const scopeHref = (href: string) => {
    const url = new URL(href, 'https://studio.invalid');
    for (const key of ['operator', 'table', 'room']) {
      const values = query?.getAll(key) ?? [];
      if (!values.length) continue;
      url.searchParams.delete(key);
      for (const value of values) url.searchParams.append(key, value);
    }
    return url.pathname + url.search + url.hash;
  };
  const tabs = studioNavigationTabs(context, tabHrefs).map(tab => ({...tab, href: scopeHref(tab.href)}));
  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    // The editor owns its save/conflict guard. Native links preserve beforeunload
    // when no callback is supplied; modified clicks keep normal browser behavior.
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onNavigate?.(event, href);
  };
  return <div className={styles.navigation}>
    {context.dealerId && <nav aria-label={`Studio för ${context.dealerLabel || context.dealerId}`} className={styles.tabs}>
      {tabs.map(tab => <a key={tab.id} href={tab.href}
        className={tab.id === context.active ? styles.activeTab : styles.tab}
        aria-current={tab.id === context.active ? 'page' : undefined}
        onClick={event => navigate(event, tab.href)}>{tab.label}</a>)}
    </nav>}
  </div>;
}
