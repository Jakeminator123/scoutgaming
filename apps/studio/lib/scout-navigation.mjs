import { labBasePath } from './lab-url.mjs';
import { canonicalControlHref } from '../../../packages/navigation/control-flow.mjs';

import {adminNavigationGroups,adminSystemGroups} from '../../../packages/navigation/admin-navigation.mjs';

export const SCOUT_NAVIGATION=Object.freeze([...adminNavigationGroups,...adminSystemGroups].map(group=>Object.freeze({label:group.label,items:Object.freeze(group.links.map(({href,label})=>Object.freeze({href,label})))})));

export const SCOUT_FOOTER_NAVIGATION = Object.freeze([
  Object.freeze({ href: '/admin', label: 'Översikt' }),
]);

const items = [...SCOUT_NAVIGATION.flatMap(group => group.items), ...SCOUT_FOOTER_NAVIGATION];

// Content tools retain their pages while sharing one menu entry.
const legacyPaths = new Map([
  ['/control', '/admin'],
  ['/control/library', '/admin/assets'],
  ['/', '/admin/clips'],
  ['/clips', '/admin/clips'],
  ['/videos', '/admin/clips'],
  ['/admin/videos', '/admin/clips'],
  ['/control/replies', '/admin/clips'],
  ['/admin/replies', '/admin/clips'],
  ['/zones', '/admin/clips'],
  ['/control/zones', '/admin/clips'],
  ['/control/backgrounds', '/admin/clips'],
  ['/events', '/admin/clips'],
  ['/control/events', '/admin/clips'],
  ['/admin/events', '/admin/clips'],
  ['/probe', '/admin/clips'],
  ['/control/probe', '/admin/clips'],
  ['/admin/probe', '/admin/clips'],
  ['/admin/ai/models', '/admin/ai/models'],
  ['/admin/ai/chat', '/admin'],
  ['/admin/dealer-agent', '/admin/clips'],
  ['/administration', '/control/administration'],
  ['/openclaw', '/control/openclaw'],
  ['/operator-chat', '/admin/clips'],
  ['/tree', '/admin/clips'],
  ['/control/tree', '/admin/clips'],
  ['/activity', '/admin/rooms'],
  ['/admin/rehearsal', '/admin/rooms'],
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
  if (['/admin/media-review','/admin/dealer-agent','/admin/dealer-studio','/admin/replies'].includes(mapped.path)) return items.find(item => item.href === '/admin/clips') ?? null;
  const matches = items.filter(item => {
    const parts = hrefParts(item.href);
    if (parts.path !== mapped.path) return false;
    for (const [key, value] of new URLSearchParams(parts.query)) if (params.get(key) !== value) return false;
    return true;
  });
  matches.sort((left, right) => hrefParts(right.href).query.length - hrefParts(left.href).query.length);
  return matches[0] ?? null;
}
