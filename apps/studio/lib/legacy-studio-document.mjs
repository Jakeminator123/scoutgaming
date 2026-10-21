import {adminDocumentHref} from '../../../packages/navigation/admin-workspace-routes.mjs';
import {canonicalControlHref, legacyActivityDocumentHref} from '../../../packages/navigation/control-flow.mjs';

const studioAliases = Object.freeze({
  activity:'/control/activity', administration:'/control/administration', events:'/control/events',
  guide:'/control/guide', lissabon:'/control', probe:'/control/probe', tree:'/control/tree',
  videos:'/control/videos', zones:'/control/preview',
});
const controlAliases = new Set(['/control/rooms','/control/companies','/control/lanes','/control/library','/control/preview','/control/zones']);
const contextKeys = new Set(['dealer','dealerId','operator','room','table','game','composition','lane','tab','role','event','variant','situation','view','category']);

// Exact compatibility entries redirect before the destination authorizes data access.
// Preserve their distinct query policies; native Control-to-Admin routing runs first.
export function legacyStudioDocumentHref(request, {basePath = ''} = {}) {
  if (!['GET','HEAD'].includes(request.method) || request.body || request.headers.has('next-action')) return null;
  const url = new URL(request.url);
  if (basePath !== '' && basePath !== '/studio') return null;
  if (basePath && !url.pathname.startsWith(basePath+'/')) return null;
  const path = url.pathname.slice(basePath.length);
  // These retired tools preserve navigation context at both historical entries.
  const tool = path.startsWith('/control/')
    ? path.match(/^\/control\/(guide|videos|probe|replies|events|tree|compositions|rehearsal|preview|zones|openclaw|operator-chat|ops)$/)?.[1]
    : path.match(/^\/(guide|videos|probe|events|tree|compositions|rehearsal|preview|zones|openclaw|operator-chat)$/)?.[1];
  if (tool) {
    const query = new URLSearchParams();
    for (const [key,value] of url.searchParams) if (contextKeys.has(key)) query.append(key,value);
    return adminDocumentHref('/control/'+tool + (query.size ? '?'+query : '') + url.hash);
  }
  if (path === '/control/activity' || path === '/activity') return legacyActivityDocumentHref(url.href);
  const alias = path.slice(1);
  if (Object.hasOwn(studioAliases, alias)) return studioAliases[alias]; // Historical top-level links discard query.
  if (controlAliases.has(path)) {
    const query = new URLSearchParams();
    for (const [key,value] of url.searchParams) if (contextKeys.has(key)) query.append(key,value);
    return adminDocumentHref(path + (query.size ? '?'+query : ''));
  }
  if (path === '/control/dealer-forge') {
    const query = new URLSearchParams();
    for (const [key,oldKey] of [['dealer','dealerId'],['composition','lane'],['operator','operator'],['table','table']]) {
      const value = url.searchParams.get(key) ?? url.searchParams.get(oldKey);
      if (value && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value)) query.set(key,value);
    }
    return canonicalControlHref(path + (query.size ? '?'+query : ''));
  }
  return null;
}
