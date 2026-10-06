import { labBasePath } from './lab-url.mjs';

// Only existing pages in this zone. Apply labUrl once when rendering native anchors.
export const STUDIO_PRIMARY_NAVIGATION = Object.freeze([
  Object.freeze({ href: '/', label: 'Dealer & klipp' }),
  Object.freeze({ href: '/administration', label: 'Administration' }),
  Object.freeze({ href: '/openclaw', label: 'OpenClaw' }),
]);

export const STUDIO_TOOL_NAVIGATION = Object.freeze([
  Object.freeze({ href: '/operator-chat', label: 'Operatörschatt' }),
  Object.freeze({ href: '/tree', label: 'Avancerade regler' }),
  Object.freeze({ href: '/activity', label: 'Uppspelningsdiagnostik' }),
  Object.freeze({ href: '/guide', label: 'Guide' }),
]);

const items = [...STUDIO_PRIMARY_NAVIGATION, ...STUDIO_TOOL_NAVIGATION];
// Existing deep links belong to the dealer workspace, not parallel main areas.
const dealerPaths = new Set(['/', '/videos', '/zones', '/events', '/probe']);

// Exact matching only: this is a menu lookup, not an auth or redirect policy.
export function studioNavigationItem(pathname, basePath = labBasePath()) {
  if (typeof pathname !== 'string' || !['', '/studio'].includes(basePath)) return null;
  const path = basePath && pathname === basePath ? '/'
    : basePath && pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) : pathname;
  return dealerPaths.has(path) ? STUDIO_PRIMARY_NAVIGATION[0] : items.find(item => item.href === path) ?? null;
}
