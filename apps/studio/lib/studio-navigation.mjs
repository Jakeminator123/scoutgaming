import { labUrl } from './lab-url.mjs';
import { canonicalControlHref } from '../../../packages/navigation/control-flow.mjs';

export const STUDIO_DEALER_TABS = Object.freeze([
  {id:'clips',label:'Klippkarta',href:'/admin/clips'},
  {id:'speech',label:'Röst & tal',href:'/admin/clips?panel=room'},
  {id:'replies',label:'Svarsbibliotek',href:'/admin/replies'},
  {id:'generate',label:'Skapa material',href:'/admin/dealer-studio?view=generate'},
  {id:'settings',label:'Inställningar',href:'/admin/clips?panel=dealer'},
].map(tab=>Object.freeze(tab)));

const CONTEXT_PARAMETERS = Object.freeze({
  dealerId: 'dealer', eventId: 'event', variantId: 'variant', situation: 'situation', laneId: 'composition', operatorId: 'operator', tableId: 'table', game: 'game',
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
// The context is applied before the address is canonicalized, so a retired tab path
// with a dealer becomes that dealer's nav (/admin/dealers/<id>?flik=…) in one step
// instead of the dealer list with ?dealer=, which would need a second redirect.
// The company list is a canonical page: a selected company filters its Spelbord tab
// (/admin/companies?tab=spelbord&operator=<id>) and does not open the company's nav.
export function studioNavigationHref(path, context = {}) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path)) {
    throw new TypeError('Studio navigation requires a local path.');
  }
  const url = new URL(path, 'https://studio.invalid');
  context = {...context, operatorId: context.operatorSlug ?? context.operatorId};
  if (url.pathname === '/admin/companies' && !url.searchParams.has('tab') && typeof context.operatorId === 'string' && context.operatorId) url.searchParams.set('tab', 'spelbord');
  for (const [key, parameter] of Object.entries(CONTEXT_PARAMETERS)) {
    const value = context[key];
    if (typeof value === 'string' && value) url.searchParams.set(parameter, value);
  }
  const canonical = new URL(canonicalControlHref(url.pathname + url.search + url.hash), 'https://studio.invalid');
  const pathname = canonical.pathname.replace(/^\/studio(?=\/control(?:\/|$))/, '');
  return labUrl(`${pathname}${canonical.search}${canonical.hash}`);
}

// Sidans uttryckliga val av bolag och spelrum (operator, table, room) går in i
// dokumentmappningen med alla sina värden, så att single() i
// packages/navigation/admin-workspace-routes.mjs avgör målet: ett spelrum öppnar sin nav,
// flera hamnar på bolagets flik Spelbord. Navigeringen väljer aldrig det första värdet.
// Valen följer sedan med oförändrade så att målsidan själv kan pröva dem. Ett tableId i
// context ersätter aldrig tvetydiga table-värden i adressen; det tas då bort.
export function studioScopedHref(path, query, context = {}) {
  const source = new URL(path, 'https://studio.invalid');
  const scope = typeof query?.getAll === 'function'
    ? [['operator', 'operatorId'], ['table', 'tableId'], ['room', null]].map(([parameter, key]) => [parameter, key, query.getAll(parameter)]).filter(([, , values]) => values.length)
    : [];
  context = {...studioNavigationContextFromQuery(query), ...context};
  for (const [parameter, key, values] of scope) {
    if (key && new Set(values).size === 1) continue;
    if (key) { delete context[key]; if (key === 'operatorId') delete context.operatorSlug; }
    source.searchParams.delete(parameter);
    for (const value of values) source.searchParams.append(parameter, value);
  }
  const url = new URL(studioNavigationHref(source.pathname + source.search + source.hash, context), 'https://studio.invalid');
  for (const [parameter, , values] of scope) {
    url.searchParams.delete(parameter);
    for (const value of values) url.searchParams.append(parameter, value);
  }
  return url.pathname + url.search + url.hash;
}

export function studioNavigationTabs(context = {}, hrefs = {}) {
  return STUDIO_DEALER_TABS.map(tab => ({ ...tab, href: studioNavigationHref(hrefs[tab.id] ?? tab.href, context) }));
}
