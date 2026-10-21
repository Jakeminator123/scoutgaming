import { WORKSPACE_VIEW_SLUGS } from '../../../packages/navigation/workspace-surfaces.mjs';

// These are existing internal tools, not new aliases for APIs or role grants.
// Leave unconnected prototype features without a destination rather than
// pretending that a similar-looking production tool implements them.
const tools = Object.freeze({
  players: '/admin/admin/accounts', tx: '/admin/ekonomi', team: '/admin/admin/accounts',
  api: '/admin/admin/api', bj: '/admin/publication', dealers: '/admin/publication',
  shoes: '/admin/drift', tables: '/admin/publication',
  background: '/admin/compositions', voice: '/admin/dealer-studio#clips', clips: '/admin/dealer-studio#deal',
  media: '/admin/videos', archive: '/admin/videos', tree: '/admin/events',
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
  { href: '/admin/dealer-studio', title: 'Dealers & klipp' },
  { href: '/admin/compositions', title: 'Sammansättning' },
  { href: '/admin/publication', title: 'Spelrum & publicering' },
].map(item => Object.freeze(item)));
