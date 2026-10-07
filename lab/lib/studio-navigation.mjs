import { labBasePath } from './lab-url.mjs';

// Only existing pages in this zone. Apply labUrl once when rendering native anchors.
export const STUDIO_PRIMARY_NAVIGATION = Object.freeze([
  Object.freeze({ href: '/control', label: 'Kontrollpanel' }),
  Object.freeze({ href: '/control/clips', label: 'Dealer & klipp' }),
  Object.freeze({ href: '/control/administration', label: 'Administration' }),
  Object.freeze({ href: '/control/openclaw', label: 'OpenClaw' }),
]);

export const STUDIO_TOOL_NAVIGATION = Object.freeze([
  Object.freeze({ href: '/control/operator-chat', label: 'Operatörschatt' }),
  Object.freeze({ href: '/control/tree', label: 'Avancerade regler' }),
  Object.freeze({ href: '/control/activity', label: 'Uppspelningsdiagnostik' }),
  Object.freeze({ href: '/control/guide', label: 'Guide' }),
]);

const items = [...STUDIO_PRIMARY_NAVIGATION, ...STUDIO_TOOL_NAVIGATION];
const dealer = STUDIO_PRIMARY_NAVIGATION[1];
const dealerPaths = new Set([
  '/control/clips', '/control/videos', '/control/zones', '/control/events', '/control/probe',
  '/', '/clips', '/videos', '/zones', '/events', '/probe',
]);
const legacyPaths = new Map([
  ['/administration', '/control/administration'],
  ['/openclaw', '/control/openclaw'],
  ['/operator-chat', '/control/operator-chat'],
  ['/tree', '/control/tree'],
  ['/activity', '/control/activity'],
  ['/guide', '/control/guide'],
]);

// Exact matching only: this is a menu lookup, not an auth or redirect policy.
export function studioNavigationItem(pathname, basePath = labBasePath()) {
  if (typeof pathname !== 'string' || !['', '/studio'].includes(basePath)) return null;
  const path = basePath && pathname === basePath ? '/'
    : basePath && pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) : pathname;
  if (dealerPaths.has(path)) return dealer;
  return items.find(item => item.href === (legacyPaths.get(path) ?? path)) ?? null;
}
