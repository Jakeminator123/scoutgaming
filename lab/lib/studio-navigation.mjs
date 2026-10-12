import { labUrl } from './lab-url.mjs';
import { canonicalControlHref } from './control-flow.mjs';

export const STUDIO_DEALER_TABS = Object.freeze([
  { id: 'idle', label: 'Grundloop', href: '/control/clips?view=idle' },
  { id: 'clips', label: 'Klipp', href: '/control/clips?view=clips' },
  { id: 'scene', label: 'Sammansättning', href: '/control/compositions' },
  { id: 'speech', label: 'Tal & automatik', href: '/control/clips?view=speech' },
  { id: 'replies', label: 'Svarsbibliotek', href: '/control/replies' },
  { id: 'playback', label: 'Provspelning & logg', href: '/control/rehearsal' },
  { id: 'settings', label: 'Inställningar', href: '/control/clips?view=settings' },
].map(tab => Object.freeze(tab)));

const CONTEXT_PARAMETERS = Object.freeze({
  dealerId: 'dealer', eventId: 'event', variantId: 'variant', situation: 'situation', laneId: 'composition', operatorId: 'operator', tableId: 'table',
});

// Read only the shared Studio context; page-specific filters and credentials
// never become navigation context.
export function studioNavigationContextFromQuery(query) {
  if (query == null) return {};
  return Object.fromEntries(Object.entries(CONTEXT_PARAMETERS)
    .map(([key, parameter]) => [key, query.get(parameter) ?? (key === 'laneId' ? query.get('lane') : null)])
    .filter(([, value]) => typeof value === 'string' && value));
}

// Preserve the selected clip across Studio pages, without copying unrelated
// document parameters (for example an editor's tab or an authentication token).
export function studioNavigationHref(path, context = {}) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path)) {
    throw new TypeError('Studio navigation requires a local path.');
  }
  const url = new URL(canonicalControlHref(path), 'https://studio.invalid');
  context = {...context, operatorId: context.operatorSlug ?? context.operatorId};
  for (const [key, parameter] of Object.entries(CONTEXT_PARAMETERS)) {
    const value = context[key];
    if (typeof value === 'string' && value) url.searchParams.set(parameter, value);
  }
  const pathname = url.pathname.replace(/^\/studio(?=\/control(?:\/|$))/, '');
  return labUrl(`${pathname}${url.search}${url.hash}`);
}

export function studioNavigationTabs(context = {}, hrefs = {}) {
  return STUDIO_DEALER_TABS.map(tab => ({ ...tab, href: studioNavigationHref(hrefs[tab.id] ?? tab.href, context) }));
}

export function studioNavigationCrumbs({ dealerId, dealerLabel, active, crumbs = [], ...context } = {}) {
  const selection = { ...context, dealerId };
  const result = [
    { label: 'Studio', href: studioNavigationHref('/control/clips', context) },
    { label: 'Dealers', href: studioNavigationHref('/control/clips', context) },
  ];
  if (dealerId) result.push({ label: dealerLabel || dealerId, href: studioNavigationHref('/control/clips?view=idle', selection) });
  const tab = STUDIO_DEALER_TABS.find(row => row.id === active);
  if (tab) result.push({ label: tab.label, href: studioNavigationHref(tab.href, selection) });
  result.push(...crumbs.map(crumb => ({ label: crumb.label, ...(crumb.href ? { href: labUrl(crumb.href) } : {}) })));
  // The final breadcrumb identifies this page; ancestors remain navigable.
  return result.map((crumb, index) => index === result.length - 1 ? { label: crumb.label } : crumb);
}
