import { WORKSPACE_VIEW_SLUGS } from '../../../packages/navigation/workspace-surfaces.mjs';

// These are existing internal tools, not new aliases for APIs or role grants.
// Leave unconnected prototype features without a destination rather than
// pretending that a similar-looking production tool implements them.
const tools = Object.freeze({
  players: '/control/administration?tab=accounts', tx: '/control/administration?tab=finance', team: '/control/administration?tab=accounts',
  api: '/control/administration?tab=partners', bj: '/control/administration?tab=tables', dealers: '/control/administration?tab=tables',
  shoes: '/control/administration?tab=operations', tables: '/control/administration?tab=tables',
  background: '/control/compositions', voice: '/control/clips#clips', clips: '/control/clips#deal',
  media: '/admin/videos', archive: '/admin/videos', tree: '/control/events',
});

export function controlToolPath(view) {
  return Object.hasOwn(tools, view) ? tools[view] : null;
}

export function legacyControlView(hash) {
  if (typeof hash !== 'string') return null;
  const value = hash.replace(/^#/, '');
  if (Object.hasOwn(WORKSPACE_VIEW_SLUGS, value)) return value;
  return Object.keys(WORKSPACE_VIEW_SLUGS).find(id => WORKSPACE_VIEW_SLUGS[id] === value) ?? null;
}

export const CONTROL_TOOLS = Object.freeze([
  { href: '/control/clips', title: 'Dealers & klipp' },
  { href: '/control/compositions', title: 'Sammansättning' },
  { href: '/admin/publication', title: 'Spelrum & publicering' },
].map(item => Object.freeze(item)));
