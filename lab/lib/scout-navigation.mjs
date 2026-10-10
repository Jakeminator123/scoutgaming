import { labBasePath } from './lab-url.mjs';

// Staff shell only. A menu href with a query wins over the same path without one.
export const SCOUT_NAVIGATION = Object.freeze([
  Object.freeze({
    id: 'studio',
    label: 'Studio',
    items: Object.freeze([
      Object.freeze({ href: '/control/clips', label: 'Dealers & klipp' }),
      Object.freeze({ href: '/control/preview', label: 'Sammansättning' }),
      Object.freeze({ href: '/control/lanes', label: 'Publicering' }),
    ]),
  }),
  Object.freeze({
    id: 'operations',
    label: 'Drift',
    items: Object.freeze([
      Object.freeze({ href: '/control/administration?tab=tables', label: 'Bord & spelrum' }),
      Object.freeze({ href: '/control/activity', label: 'Uppspelning' }),
      Object.freeze({ href: '/control/administration?tab=operations', label: 'Spelintegritet' }),
      Object.freeze({ href: '/control/administration?tab=finance', label: 'Betalningar & journal' }),
    ]),
  }),
  Object.freeze({
    id: 'ai',
    label: 'AI & chatt',
    items: Object.freeze([
      Object.freeze({ href: '/control/openclaw', label: 'Agentmodeller' }),
      Object.freeze({ href: '/control/openclaw?tab=chat', label: 'Operatörschatt' }),
    ]),
  }),
  Object.freeze({
    id: 'administration',
    label: 'Administration',
    items: Object.freeze([
      Object.freeze({ href: '/control/lanes?tab=companies#operator-directory', label: 'Bolag & team' }),
      Object.freeze({ href: '/control/administration?tab=accounts', label: 'Konton & roller' }),
      Object.freeze({ href: '/control/administration?tab=partners', label: 'Partners' }),
    ]),
  }),
]);

export const SCOUT_FOOTER_NAVIGATION = Object.freeze([
  Object.freeze({ href: '/control', label: 'Översikt' }),
  Object.freeze({ href: '/control/guide', label: 'Guide & hjälp' }),
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
  ['/control/videos', '/control/clips'],
  ['/zones', '/control/preview'],
  ['/control/zones', '/control/preview'],
  ['/control/backgrounds', '/control/preview'],
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
  ['/activity', '/control/activity'],
  ['/guide', '/control/guide'],
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
  const cut = pathname.indexOf('?');
  const path = shellPath(cut === -1 ? pathname : pathname.slice(0, cut), basePath);
  if (path == null) return null;
  const mapped = hrefParts(legacyPaths.get(path) ?? path);
  const params = new URLSearchParams(cut === -1 ? '' : pathname.slice(cut + 1).split('#')[0]);
  if (mapped.query) {
    for (const [key, value] of new URLSearchParams(mapped.query)) if (!params.has(key)) params.append(key, value);
  }
  if (mapped.path === '/control/administration') {
    const tab = params.get('tab');
    if (tab === 'media-review') return items.find(item => item.href === '/control/clips') ?? null;
    // The administration page defaults to operations for an absent or unknown tab.
    if (!['tables', 'operations', 'finance', 'accounts', 'partners'].includes(tab)) params.set('tab', 'operations');
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
