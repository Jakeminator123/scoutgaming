import { WORKSPACE_VIEW_SLUGS } from './workspace-surfaces.mjs';

// These are existing internal tools, not new aliases for APIs or role grants.
// Leave unconnected prototype features without a destination rather than
// pretending that a similar-looking production tool implements them.
const tools = Object.freeze({
  players: '/control/administration', tx: '/control/administration', team: '/control/administration',
  api: '/control/administration', bj: '/control/administration', dealers: '/control/administration',
  shoes: '/control/administration', tables: '/control/administration',
  background: '/control/preview', voice: '/control/clips#clips', clips: '/control/clips#deal',
  media: '/control/videos', archive: '/control/videos', tree: '/control/events',
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
  { href: '/control/preview', title: 'Sammansättning' },
  { href: '/control/clips', title: 'Innehåll' },
  { href: '/control/lanes', title: 'Publicering' },
].map(item => Object.freeze(item)));
