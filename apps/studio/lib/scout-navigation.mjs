import { labBasePath } from './lab-url.mjs';
import { canonicalControlHref } from '../../../packages/navigation/control-flow.mjs';

// Labels used by the active guide. Query-specific destinations take precedence.
export const SCOUT_NAVIGATION = Object.freeze([
  { id: 'studio', label: 'Studio', items: [
    { href: '/admin/dealer-studio', label: 'Dealers & klipp' },
    { href: '/admin/assets', label: 'Bord & bakgrunder' },
    { href: '/admin/compositions', label: 'Sammansättningar' },
  ] },
  { id: 'companies', label: 'Spelbolag', items: [
    { href: '/admin/companies', label: 'Bolag & team' },
    { href: '/admin/publication', label: 'Spelrum & publicering' },
  ] },
  { id: 'operations', label: 'Drift', items: [
    { href: '/admin/drift', label: 'Spelstatus & integritet' },
    { href: '/admin/ekonomi', label: 'Betalningar & journal' },
  ] },
  { id: 'system', label: 'System', items: [
    { href: '/admin/admin/accounts', label: 'Konton & åtkomst' },
    { href: '/admin/admin/api', label: 'API & integrationer' },
    { href: '/admin/ai/models', label: 'Agentmodeller' },
    { href: '/admin/dealer-agent', label: 'Intern agentchatt' },
  ] },
].map(group => Object.freeze({...group, items: Object.freeze(group.items.map(item => Object.freeze(item)))})));

export const SCOUT_FOOTER_NAVIGATION = Object.freeze([
  Object.freeze({ href: '/admin', label: 'Översikt' }),
  Object.freeze({ href: '/admin/guide', label: 'Guide & hjälp' }),
]);

const items = [...SCOUT_NAVIGATION.flatMap(group => group.items), ...SCOUT_FOOTER_NAVIGATION];

// Content tools retain their pages while sharing one menu entry.
const legacyPaths = new Map([
  ['/control', '/admin'],
  ['/control/library', '/admin/assets'],
  ['/', '/admin/dealer-studio'],
  ['/clips', '/admin/dealer-studio'],
  ['/videos', '/admin/dealer-studio'],
  ['/admin/videos', '/admin/dealer-studio'],
  ['/control/replies', '/admin/dealer-studio'],
  ['/admin/replies', '/admin/dealer-studio'],
  ['/zones', '/admin/compositions'],
  ['/control/zones', '/admin/compositions'],
  ['/control/backgrounds', '/admin/compositions'],
  ['/events', '/admin/dealer-studio'],
  ['/control/events', '/admin/dealer-studio'],
  ['/admin/events', '/admin/dealer-studio'],
  ['/probe', '/admin/dealer-studio'],
  ['/control/probe', '/admin/dealer-studio'],
  ['/admin/probe', '/admin/dealer-studio'],
  ['/administration', '/control/administration'],
  ['/openclaw', '/control/openclaw'],
  ['/operator-chat', '/admin/dealer-agent'],
  ['/tree', '/admin/dealer-studio'],
  ['/control/tree', '/admin/dealer-studio'],
  ['/activity', '/admin/dealer-studio'],
  ['/admin/rehearsal', '/admin/dealer-studio'],
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
  let mapped = hrefParts(legacyPaths.get(path) ?? path);
  const params = new URLSearchParams(cut === -1 ? '' : pathname.slice(cut + 1).split('#')[0]);
  if (mapped.query) {
    for (const [key, value] of new URLSearchParams(mapped.query)) if (!params.has(key)) params.append(key, value);
  }
  mapped = hrefParts(canonicalControlHref(mapped.path + (params.size ? '?' + params : '')));
  if (mapped.path === '/admin/media-review') return items.find(item => item.href === '/admin/dealer-studio') ?? null;
  const matches = items.filter(item => {
    const parts = hrefParts(item.href);
    if (parts.path !== mapped.path) return false;
    for (const [key, value] of new URLSearchParams(parts.query)) if (params.get(key) !== value) return false;
    return true;
  });
  matches.sort((left, right) => hrefParts(right.href).query.length - hrefParts(left.href).query.length);
  return matches[0] ?? null;
}
