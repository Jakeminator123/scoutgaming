'use client';

import type { MouseEvent } from 'react';
import { studioNavigationCrumbs, studioNavigationTabs, type StudioNavigationCrumbOptions, type StudioDealerTab } from '../lib/studio-navigation.mjs';
import styles from './studio-navigation.module.css';

export type StudioNavigationProps = StudioNavigationCrumbOptions & {
  active: StudioDealerTab;
  tabHrefs?: Partial<Record<StudioDealerTab, string>>;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
};

export function StudioNavigation({ tabHrefs, onNavigate, ...context }: StudioNavigationProps) {
  const crumbs = studioNavigationCrumbs(context);
  const tabs = studioNavigationTabs(context, tabHrefs);
  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    // The editor owns its save/conflict guard. Native links preserve beforeunload
    // when no callback is supplied; modified clicks keep normal browser behavior.
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onNavigate?.(event, href);
  };
  return <div className={styles.navigation}>
    <nav aria-label="Brödsmulor i Studio" className={styles.breadcrumbs}>
      <ol>{crumbs.map((crumb, index) => <li key={`${index}-${crumb.label}`}>
        {index > 0 && <span aria-hidden="true" className={styles.separator}>/</span>}
        {crumb.href
          ? <a href={crumb.href} onClick={event => navigate(event, crumb.href!)}>{crumb.label}</a>
          : <span aria-current={index === crumbs.length - 1 ? 'page' : undefined}>{crumb.label}</span>}
      </li>)}</ol>
    </nav>
    {context.dealerId && <nav aria-label={`Studio för ${context.dealerLabel || context.dealerId}`} className={styles.tabs}>
      {tabs.map(tab => <a key={tab.id} href={tab.href}
        className={tab.id === context.active ? styles.activeTab : styles.tab}
        aria-current={tab.id === context.active ? 'page' : undefined}
        onClick={event => navigate(event, tab.href)}>{tab.label}</a>)}
    </nav>}
  </div>;
}
