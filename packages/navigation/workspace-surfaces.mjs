import {isOperatorSlug} from './operator-slug.mjs';
// Document navigation only. These routes never grant a role or an operator
// membership, and deliberately contain no API, auth or asset aliases.

// Partnerportalen: one view per menu entry, the view ID is the public address
// segment. The server checks the view's permission (partner-access-policy.mjs).
export const PARTNER_VIEWS = Object.freeze(['overview', 'rooms', 'players', 'reports', 'team', 'integration', 'help']);
// Kevin's retired partner addresses and view IDs land on the nearest new view.
const partnerLegacySections = Object.freeze({
  ops: 'overview', 'pit-bosses': 'overview', pit: 'overview', shoes: 'overview',
  tables: 'rooms', 'game-tables': 'rooms', bj: 'rooms', presentation: 'rooms', theme: 'rooms', 'table-design': 'rooms', design: 'rooms',
  backgrounds: 'rooms', background: 'rooms', lanes: 'rooms', dealers: 'rooms', preview: 'rooms', test: 'rooms', roulette: 'rooms', baccarat: 'rooms',
  transactions: 'reports', tx: 'reports', statistics: 'reports', stats: 'reports',
  api: 'integration',
});
export function partnerView(section) {
  if (typeof section !== 'string') return null;
  if (PARTNER_VIEWS.includes(section)) return section;
  return Object.hasOwn(partnerLegacySections, section) ? partnerLegacySections[section] : null;
}

// Retired /control bookmarks: Kevin's view IDs are only recognised so the
// Admin redirect (apps/studio/lib/control-workspace.mjs) can land them.
export const CONTROL_PREVIEW_VIEWS = Object.freeze([
  'ops', 'players', 'tx', 'background', 'bj', 'dealers', 'shoes', 'team', 'api',
  'archive', 'tables', 'voice', 'clips', 'media', 'tree',
]);
const controlAliases = Object.freeze({ overview: 'ops', integration: 'api' });
// studioPath is the internal rewrite. legacyPath is the current public document.
const legacyControl = Object.freeze({
  studio: Object.freeze({ studioPath: '/studio', legacyPath: '/control' }),
  admin: Object.freeze({ studioPath: '/studio/administration', legacyPath: '/control/administration' }),
  ops: Object.freeze({ studioPath: '/studio/admin/openclaw', legacyPath: '/admin/openclaw' }),
  lab: Object.freeze({ studioPath: '/studio', legacyPath: '/control' }),
});
const staffTools = new Set(['companies', 'rooms', 'compositions', 'rehearsal', 'library', 'replies', 'clips', 'dealer-forge', 'administration', 'tree', 'videos', 'openclaw', 'activity', 'guide', 'zones', 'events', 'probe', 'operator-chat', 'preview', 'lanes']);
// `login` is the public partner page, not an operator. The App Router page
// wins by specificity; rejecting the slug here keeps the catch-all from
// treating /partner/login as a workspace.

// Source component IDs stay internal. Links use one readable document address.
export const WORKSPACE_VIEW_SLUGS = Object.freeze({
  ops: 'overview', players: 'players', tx: 'transactions', background: 'backgrounds',
  bj: 'game-tables', dealers: 'lanes', shoes: 'shoes', team: 'team', api: 'integration',
  archive: 'archive', tables: 'legacy-rooms', voice: 'speech', clips: 'clips', media: 'media',
  tree: 'presentation-events', gen: 'generations',
});

/** @param {string | null} [operator] */
export function workspaceSurfacePath(surface, view, operator = null) {
  if (surface === 'partner') {
    if (!PARTNER_VIEWS.includes(view) || !isOperatorSlug(operator)) return null;
    const root = `/partner/${operator}`;
    return view === 'overview' ? root : `${root}/${view}`;
  }
  if (surface !== 'control' || !CONTROL_PREVIEW_VIEWS.includes(view)) return null;
  return view === 'ops' ? '/control' : `/control/${WORKSPACE_VIEW_SLUGS[view]}`;
}

export function resolveWorkspaceSurfacePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || /[%\\?#\x00-\x20]/.test(value) || value.includes('//')) return null;
  const publicPath = value.startsWith('/studio/') ? value.slice('/studio'.length) : value;
  const parts = publicPath.slice(1).split('/');
  const surface = parts[0];
  if (surface !== 'control' && surface !== 'partner') return null;
  if (surface === 'partner') {
    if (parts.length === 1) return Object.freeze({ surface, operatorSlug: null, section: 'overview', view: 'overview', publicPath,
      studioPath: '/studio' + publicPath, canonicalPath: '/partner', legacyPath: null });
    if (![2, 3].includes(parts.length) || !isOperatorSlug(parts[1])) return null;
    const operator = parts[1], section = parts[2] ?? 'overview';
    const view = partnerView(section);
    if (!view) return null;
    return Object.freeze({ surface, operatorSlug: operator, section, view, publicPath, studioPath: '/studio' + publicPath,
      canonicalPath: workspaceSurfacePath('partner', view, operator), legacyPath: null });
  }
  if (parts.length > 2 || (parts.length === 2 && !parts[1])) return null;
  const section = parts[1] || 'overview';
  if (Object.hasOwn(legacyControl, section)) {
    const destination = legacyControl[section];
    return Object.freeze({
      surface, operatorSlug: null, section, view: null, publicPath,
      studioPath: destination.studioPath, legacyPath: destination.legacyPath,
    });
  }
  const view = Object.hasOwn(controlAliases, section) ? controlAliases[section]
    : Object.keys(WORKSPACE_VIEW_SLUGS).find(id => WORKSPACE_VIEW_SLUGS[id] === section) ?? section;
  if (!CONTROL_PREVIEW_VIEWS.includes(view)) {
    if (staffTools.has(section)) return Object.freeze({
      surface, operatorSlug: null, section, view: null, publicPath,
      studioPath: '/studio' + publicPath, canonicalPath: publicPath, legacyPath: null,
    });
    return null;
  }
  const canonicalPath = staffTools.has(section) ? publicPath : workspaceSurfacePath('control', view);
  return Object.freeze({ surface, operatorSlug: null, section, view, publicPath, studioPath: '/studio' + publicPath,
    canonicalPath, legacyPath: null });
}

// Next may report either the public rewrite or the native /studio route.
// Hide the internal workspace header even on a partner not-found document.
export function isPartnerSurfacePath(pathname) {
  return typeof pathname === 'string' && /^\/(?:studio\/)?partner(?:\/|$)/.test(pathname);
}
