import { labBasePath } from './lab-url.mjs';

// Staff shell only. A repeated href stays a separate label; the first match is active.
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
      Object.freeze({ href: '/control/tree', label: 'Händelser → klipp' }),
      Object.freeze({ href: '/control/videos', label: 'Klippbibliotek' }),
      Object.freeze({ href: '/control/zones', label: 'Bakgrundszoner' }),
      Object.freeze({ href: '/control/events', label: 'Händelser' }),
    ]),
  }),
  Object.freeze({
    label: 'OpenClaw',
    items: Object.freeze([
      Object.freeze({ href: '/control/openclaw', label: 'Agentmodeller' }),
      Object.freeze({ href: '/control/operator-chat', label: 'Operatörschatt' }),
    ]),
  }),
  // One entry until the administration page has tabs; four labels to one page confused the active state.
  Object.freeze({
    label: 'Drift',
    items: Object.freeze([
      Object.freeze({ href: '/control/administration', label: 'Administration' }),
      Object.freeze({ href: '/control/activity', label: 'Uppspelning' }),
      Object.freeze({ href: '/control/probe', label: 'Talgranskning' }),
    ]),
  }),
  Object.freeze({
    label: 'Åtkomst',
    items: Object.freeze([
      Object.freeze({ href: '/partner', label: 'Partners' }),
    ]),
  }),
]);

export const SCOUT_FOOTER_NAVIGATION = Object.freeze([
  Object.freeze({ href: '/control/guide', label: 'Guide & hjälp' }),
]);

// Login and password pages render without the staff menu.
const authPaths = new Set(['/login', '/set-password', '/control/login', '/control/set-password', '/partner/login']);

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
  ['/operator-chat', '/control/operator-chat'],
  ['/tree', '/control/tree'],
  ['/activity', '/control/activity'],
  ['/guide', '/control/guide'],
]);

function shellPath(pathname, basePath) {
  if (typeof pathname !== 'string' || !['', '/studio'].includes(basePath)) return null;
  if (basePath && pathname === basePath) return '/';
  if (basePath && pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length);
  return pathname;
}

export function scoutNavigationItem(pathname, basePath = labBasePath()) {
  const path = shellPath(pathname, basePath);
  if (path == null) return null;
  const href = legacyPaths.get(path) ?? path;
  return items.find(item => item.href === href) ?? null;
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
