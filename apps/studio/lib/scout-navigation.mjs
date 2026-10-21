import { labBasePath } from './lab-url.mjs';
import { canonicalControlHref } from '../../../packages/navigation/control-flow.mjs';

// Staff shell only. A menu href with a query wins over the same path without one.
export const SCOUT_NAVIGATION = Object.freeze([
  { id: 'studio', label: 'Studio', items: [
    { href: '/control/clips', label: 'Dealers & klipp' },
    { href: '/control/library', label: 'Bord & bakgrunder' },
    { href: '/control/compositions', label: 'Sammansättningar' },
  ] },
  { id: 'companies', label: 'Spelbolag', items: [
    { href: '/admin/companies', label: 'Bolag & team' },
    { href: '/admin/publication', label: 'Spelrum & publicering' },
  ] },
  { id: 'operations', label: 'Drift', items: [
    { href: '/control/administration?tab=operations', label: 'Spelstatus & integritet' },
    { href: '/control/administration?tab=finance', label: 'Betalningar & journal' },
  ] },
  { id: 'system', label: 'System', items: [
    { href: '/control/administration?tab=accounts', label: 'Konton & åtkomst' },
    { href: '/control/administration?tab=partners', label: 'API & integrationer' },
    { href: '/control/openclaw', label: 'Agentmodeller' },
    { href: '/control/openclaw?tab=chat', label: 'Intern agentchatt' },
  ] },
].map(group => Object.freeze({...group, items: Object.freeze(group.items.map(item => Object.freeze(item)))})));

export const SCOUT_FOOTER_NAVIGATION = Object.freeze([
  Object.freeze({ href: '/control', label: 'Översikt' }),
  Object.freeze({ href: '/admin/guide', label: 'Guide & hjälp' }),
]);

// Login and password pages render without the staff menu.
const authPaths = new Set(['/login', '/set-password', '/control/login', '/control/set-password', '/partner/login', '/partner/set-password']);

export const SCOUT_LEVELS = Object.freeze([
  Object.freeze({ href: '/control', label: '1 · Admin', id: 'admin' }),
  Object.freeze({ href: '/partner', label: '2 · Spelbolag', id: 'partner' }),
  Object.freeze({ href: '/play', label: '3 · Spelare', id: 'player' }),
]);

const items = [...SCOUT_NAVIGATION.flatMap(group => group.items), ...SCOUT_FOOTER_NAVIGATION];

// Content tools retain their pages while sharing one menu entry.
const legacyPaths = new Map([
  ['/', '/control/clips'],
  ['/clips', '/control/clips'],
  ['/videos', '/control/clips'],
  ['/admin/videos', '/control/clips'],
  ['/control/replies', '/control/clips'],
  ['/zones', '/control/compositions'],
  ['/control/zones', '/control/compositions'],
  ['/control/backgrounds', '/control/compositions'],
  ['/events', '/control/clips'],
  ['/control/events', '/control/clips'],
  ['/probe', '/control/clips'],
  ['/control/probe', '/control/clips'],
  ['/administration', '/control/administration'],
  ['/openclaw', '/control/openclaw'],
  ['/operator-chat', '/control/openclaw?tab=chat'],
  ['/control/operator-chat', '/control/openclaw?tab=chat'],
  ['/tree', '/control/clips'],
  ['/control/tree', '/control/clips'],
  ['/activity', '/control/clips'],
  ['/control/rehearsal', '/control/clips'],
  ['/guide', '/admin/guide'],
]);

function shellPath(pathname, basePath) {
  if (typeof pathname !== 'string' || !['', '/studio'].includes(basePath)) return null;
  if (basePath && pathname === basePath) return '/';
  if (basePath && pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length);
  return pathname;
}

function hrefParts(href) {
  const withoutHash = href.split('#')[0];
  const cut = withoutHash.indexOf('?');
  return cut === -1 ? { path: withoutHash, query: '' } : { path: withoutHash.slice(0, cut), query: withoutHash.slice(cut + 1) };
}

export function scoutNavigationItem(pathname, basePath = labBasePath()) {
  if (typeof pathname !== 'string') return null;
  try { pathname = canonicalControlHref(pathname); } catch { return null; }
  const cut = pathname.indexOf('?');
  const path = shellPath(cut === -1 ? pathname : pathname.slice(0, cut), basePath);
  if (path == null) return null;
  const mapped = hrefParts(legacyPaths.get(path) ?? path);
  const params = new URLSearchParams(cut === -1 ? '' : pathname.slice(cut + 1).split('#')[0]);
  if (mapped.query) {
    for (const [key, value] of new URLSearchParams(mapped.query)) if (!params.has(key)) params.append(key, value);
  }
  if (mapped.path === '/control/administration' && params.get('tab') === 'tables') return items.find(item => item.href === '/admin/publication') ?? null;
  if (mapped.path === '/control/administration' && params.get('tab') === 'media-review') return items.find(item => item.href === '/control/clips') ?? null;
  if (mapped.path === '/control/administration') {
    const tab = params.get('tab');
    // The administration page defaults to operations for an absent or unknown tab.
    if (!['tables', 'operations', 'finance', 'accounts', 'partners', 'media-review'].includes(tab)) params.set('tab', 'operations');
  }
  const matches = items.filter(item => {
    const parts = hrefParts(item.href);
    if (parts.path !== mapped.path) return false;
    for (const [key, value] of new URLSearchParams(parts.query)) if (params.get(key) !== value) return false;
    return true;
  });
  matches.sort((left, right) => hrefParts(right.href).query.length - hrefParts(left.href).query.length);
  return matches[0] ?? null;
}

export function isScoutAuthPath(pathname, basePath = labBasePath()) {
  const path = shellPath(pathname, basePath);
  return path != null && authPaths.has(path.replace(/\/+$/, '') || '/');
}

export function scoutLevel(pathname, basePath = labBasePath()) {
  const path = shellPath(pathname, basePath);
  if (path == null) return null;
  if (path === '/play' || path.startsWith('/play/')) return 'player';
  if (path === '/partner' || path.startsWith('/partner/')) return 'partner';
  return 'admin';
}
