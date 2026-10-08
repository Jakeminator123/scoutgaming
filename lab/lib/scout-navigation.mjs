import { labBasePath } from './lab-url.mjs';

// Staff shell only. A menu href with a query wins over the same path without one.
export const SCOUT_NAVIGATION = Object.freeze([
  Object.freeze({
    label: '',
    items: Object.freeze([
      Object.freeze({ href: '/control', label: 'Översikt' }),
    ]),
  }),
  Object.freeze({
    label: 'Studio',
    items: Object.freeze([
      Object.freeze({ href: '/control/clips', label: 'Dealers & klipp' }),
      Object.freeze({ href: '/control/preview', label: 'Förhandsvisning' }),
      Object.freeze({ href: '/control/lanes', label: 'Lanes' }),
    ]),
  }),
  Object.freeze({ label: 'Studio · verktyg', items: Object.freeze([
      Object.freeze({ href: '/control/videos', label: 'Klippbibliotek' }),
      Object.freeze({ href: '/control/zones', label: 'Bakgrundszoner' }),
      Object.freeze({ href: '/control/events', label: 'Händelser' }),
    ]), }),
  Object.freeze({
    label: 'OpenClaw',
    items: Object.freeze([
      Object.freeze({ href: '/control/openclaw', label: 'Agentmodeller' }),
      Object.freeze({ href: '/control/openclaw?tab=chat', label: 'Operatörschatt' }),
    ]),
  }),
  // Bare Administration stays the page without ?tab=. The four labels deep-link a group.
  Object.freeze({
    label: 'Drift',
    items: Object.freeze([
      Object.freeze({ href: '/control/administration', label: 'Administration' }),
      Object.freeze({ href: '/control/administration?tab=tables', label: 'Bord & lanes' }),
      Object.freeze({ href: '/control/administration?tab=operations', label: 'Spelintegritet' }),
      Object.freeze({ href: '/control/activity', label: 'Uppspelning' }),
      Object.freeze({ href: '/control/administration?tab=finance', label: 'Betalningar & journal' }),
      Object.freeze({ href: '/control/probe', label: 'Probe' }),
    ]),
  }),
  Object.freeze({
    label: 'Åtkomst',
    items: Object.freeze([
      Object.freeze({ href: '/control/administration?tab=accounts', label: 'Konton & roller' }),
      Object.freeze({ href: '/partner', label: 'Partners' }),
    ]),
  }),
]);

export const SCOUT_FOOTER_NAVIGATION = Object.freeze([
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

// Lab root renders the clips page. Other legacy paths keep their own labels.
const legacyPaths = new Map([
  ['/', '/control/clips'],
  ['/clips', '/control/clips'],
  ['/videos', '/control/videos'],
  ['/zones', '/control/zones'],
  ['/events', '/control/events'],
  ['/probe', '/control/probe'],
  ['/administration', '/control/administration'],
  ['/openclaw', '/control/openclaw'],
  ['/operator-chat', '/control/openclaw?tab=chat'],
  ['/control/operator-chat', '/control/openclaw?tab=chat'],
  ['/tree', '/control/events'],
  ['/control/tree', '/control/events'],
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
  const cut = href.indexOf('?');
  return cut === -1 ? { path: href, query: '' } : { path: href.slice(0, cut), query: href.slice(cut + 1) };
}

export function scoutNavigationItem(pathname, basePath = labBasePath()) {
  if (typeof pathname !== 'string') return null;
  const cut = pathname.indexOf('?');
  const path = shellPath(cut === -1 ? pathname : pathname.slice(0, cut), basePath);
  if (path == null) return null;
  const mapped = hrefParts(legacyPaths.get(path) ?? path);
  const params = new URLSearchParams(cut === -1 ? '' : pathname.slice(cut + 1));
  if (mapped.query) {
    for (const [key, value] of new URLSearchParams(mapped.query)) if (!params.has(key)) params.append(key, value);
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
