// Document navigation only. These routes never grant a role or an operator
// membership, and deliberately contain no API, auth or asset aliases.
export const PARTNER_PREVIEW_VIEWS = Object.freeze([
  'ops', 'players', 'tx', 'pit', 'theme', 'design', 'background', 'bj',
  'roulette', 'baccarat', 'dealers', 'shoes', 'test', 'stats', 'reports', 'team', 'api',
]);
// Kevin preview slugs that only repeated the control overview. Partner keeps them.
const controlDeadViews = new Set(['pit', 'theme', 'design', 'roulette', 'baccarat', 'test', 'stats', 'reports', 'gen']);
export const CONTROL_PREVIEW_VIEWS = Object.freeze([
  ...PARTNER_PREVIEW_VIEWS.filter(view => !controlDeadViews.has(view)),
  'archive', 'tables', 'voice', 'clips', 'media', 'tree',
]);
const aliases = Object.freeze({ overview: 'ops', presentation: 'theme', integration: 'api' });
// studioPath stays the internal Lab rewrite. legacyPath is the public /control URL.
const legacyControl = Object.freeze({
  studio: Object.freeze({ studioPath: '/studio', legacyPath: '/control' }),
  admin: Object.freeze({ studioPath: '/studio/administration', legacyPath: '/control/administration' }),
  ops: Object.freeze({ studioPath: '/studio/openclaw', legacyPath: '/control/openclaw' }),
  lab: Object.freeze({ studioPath: '/studio', legacyPath: '/control' }),
});
const staffTools = new Set(['companies', 'rooms', 'compositions', 'rehearsal', 'library', 'replies', 'clips', 'dealer-forge', 'administration', 'tree', 'videos', 'openclaw', 'activity', 'guide', 'zones', 'events', 'probe', 'operator-chat', 'preview', 'lanes']);
const operatorSlug = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
// `login` is the public partner page, not an operator. The App Router page
// wins by specificity; rejecting the slug here keeps the catch-all from
// treating /partner/login as a workspace.
const reservedOperators = new Set(['api', 'auth', 'login', 'logout', 'studio', 'control', 'partner', 'play', 'set-password']);

// Source component IDs stay internal. Links use one readable document address.
export const WORKSPACE_VIEW_SLUGS = Object.freeze({
  ops: 'overview', players: 'players', tx: 'transactions', pit: 'pit-bosses',
  theme: 'presentation', design: 'table-design', background: 'backgrounds',
  bj: 'game-tables', roulette: 'roulette', baccarat: 'baccarat', dealers: 'lanes',
  shoes: 'shoes', test: 'preview', stats: 'statistics', reports: 'reports',
  team: 'team', api: 'integration', archive: 'archive', tables: 'legacy-rooms',
  voice: 'speech', clips: 'clips', media: 'media', tree: 'presentation-events', gen: 'generations',
});

/** @param {string | null} [operator] */
export function workspaceSurfacePath(surface, view, operator = null) {
  const views = surface === 'partner' ? PARTNER_PREVIEW_VIEWS : surface === 'control' ? CONTROL_PREVIEW_VIEWS : [];
  if (!views.includes(view)) return null;
  if (surface === 'partner' && (typeof operator !== 'string' || operator.length > 63 || !operatorSlug.test(operator) || reservedOperators.has(operator))) return null;
  const root = surface === 'partner' ? `/partner/${operator}` : '/control';
  const slug = surface === 'partner' && view === 'bj' ? 'rooms' : WORKSPACE_VIEW_SLUGS[view];
  return view === 'ops' ? root : `${root}/${slug}`;
}

export function resolveWorkspaceSurfacePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || /[%\\?#\x00-\x20]/.test(value) || value.includes('//')) return null;
  const publicPath = value.startsWith('/studio/') ? value.slice('/studio'.length) : value;
  const parts = publicPath.slice(1).split('/');
  const surface = parts[0];
  if (surface !== 'control' && surface !== 'partner') return null;
  let section = 'overview', operator = null;
  if (surface === 'control') {
    if (parts.length > 2 || (parts.length === 2 && !parts[1])) return null;
    section = parts[1] || section;
    if (Object.hasOwn(legacyControl, section)) {
      const destination = legacyControl[section];
      return Object.freeze({
        surface, operatorSlug: null, section, view: null, publicPath,
        studioPath: destination.studioPath, legacyPath: destination.legacyPath,
      });
    }
  } else if (parts.length !== 1) {
    if (![2, 3].includes(parts.length) || parts[1].length > 63 || !operatorSlug.test(parts[1]) || reservedOperators.has(parts[1])) return null;
    operator = parts[1]; section = parts[2] ?? section;
  }
  const view = surface === 'partner' && ['rooms', 'tables'].includes(section) ? 'bj'
    : Object.hasOwn(aliases, section) ? aliases[section]
    : Object.keys(WORKSPACE_VIEW_SLUGS).find(id => WORKSPACE_VIEW_SLUGS[id] === section) ?? section;
  const allowed = (surface === 'partner' ? PARTNER_PREVIEW_VIEWS : CONTROL_PREVIEW_VIEWS).includes(view);
  if (!allowed) {
    if (surface === 'control' && staffTools.has(section)) return Object.freeze({
      surface, operatorSlug: null, section, view: null, publicPath,
      studioPath: '/studio' + publicPath, canonicalPath: publicPath, legacyPath: null,
    });
    return null;
  }
  const canonicalPath = surface === 'control' && staffTools.has(section)
    ? publicPath : (workspaceSurfacePath(surface, view, operator) ?? '/partner');
  return Object.freeze({ surface, operatorSlug: operator, section, view, publicPath, studioPath: '/studio' + publicPath,
    canonicalPath, legacyPath: null });
}

// Next may report either the public rewrite or the native /studio route.
// Hide the internal workspace header even on a partner not-found document.
export function isPartnerSurfacePath(pathname) {
  return typeof pathname === 'string' && /^\/(?:studio\/)?partner(?:\/|$)/.test(pathname);
}
