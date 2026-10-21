import { WORKSPACE_VIEW_SLUGS } from '../../../packages/navigation/workspace-surfaces.mjs';
import { adminDocumentHref } from '../../../packages/navigation/admin-workspace-routes.mjs';

// A redirected Control bookmark keeps its fragment; hand it to an existing tool once.
const supported = new Set(['ops', 'players', 'tx', 'team', 'api', 'bj', 'dealers', 'shoes',
  'tables', 'background', 'voice', 'clips', 'media', 'archive', 'tree']);

export function legacyControlBookmarkHref(href) {
  if (typeof href !== 'string' || !/^\/(?:studio\/)?admin(?:[?#]|$)/.test(href) || /[\\\r\n]/.test(href)) return null;
  const url = new URL(href, 'https://workspace.invalid');
  const fragment = url.hash.slice(1);
  const view = Object.hasOwn(WORKSPACE_VIEW_SLUGS, fragment) ? fragment
    : Object.keys(WORKSPACE_VIEW_SLUGS).find(id => WORKSPACE_VIEW_SLUGS[id] === fragment);
  if (!supported.has(view)) return null;
  const anchor = view === 'clips' ? '#deal' : view === 'voice' ? '#clips' : '';
  return adminDocumentHref('/control/' + WORKSPACE_VIEW_SLUGS[view] + url.search + anchor);
}
