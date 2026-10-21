import {adminDocumentHref} from '../../../packages/navigation/admin-workspace-routes.mjs';
import {canonicalControlHref} from '../../../packages/navigation/control-flow.mjs';

const studioAliases = Object.freeze({
  activity:'/control/activity', administration:'/control/administration', events:'/control/events',
  guide:'/control/guide', lissabon:'/control', openclaw:'/control/openclaw',
  'operator-chat':'/control/operator-chat', probe:'/control/probe', tree:'/control/tree',
  videos:'/control/videos', zones:'/control/preview',
});
const controlAliases = new Set(['/control/rooms','/control/companies','/control/lanes','/control/library','/control/preview','/control/zones']);
const contextKeys = new Set(['dealer','dealerId','operator','room','table','game','composition','lane','tab','role','event','variant','situation','view','category']);

// These exact, unauthenticated page shells used to redirect before loading data.
// Preserve their distinct query policies; native Control-to-Admin routing runs first.
export function legacyStudioDocumentHref(request, {basePath = ''} = {}) {
  if (!['GET','HEAD'].includes(request.method) || request.body || request.headers.has('next-action')) return null;
  const url = new URL(request.url);
  if (basePath !== '' && basePath !== '/studio') return null;
  if (basePath && !url.pathname.startsWith(basePath+'/')) return null;
  const path = url.pathname.slice(basePath.length);
  // These retired tools preserve navigation context at both historical entries.
  const tool = path.match(/^\/(?:control\/)?(guide|videos)$/)?.[1];
  if (tool) {
    const query = new URLSearchParams();
    for (const [key,value] of url.searchParams) if (contextKeys.has(key)) query.append(key,value);
    return adminDocumentHref('/control/'+tool + (query.size ? '?'+query : '') + url.hash);
  }
  const alias = path.slice(1);
  if (Object.hasOwn(studioAliases, alias)) return studioAliases[alias]; // Historical top-level links discard query.
  if (controlAliases.has(path)) {
    const query = new URLSearchParams();
    for (const [key,value] of url.searchParams) if (contextKeys.has(key)) query.append(key,value);
    return adminDocumentHref(path + (query.size ? '?'+query : ''));
  }
  if (path === '/control/activity') {
    const query = new URLSearchParams();
    for (const key of ['dealer','operator','table','composition']) {
      const values = url.searchParams.getAll(key);
      if (values.length === 1 && values[0]) query.set(key,values[0]);
    }
    const lanes = url.searchParams.getAll('lane');
    if (!query.has('composition') && lanes.length === 1 && lanes[0]) query.set('composition',lanes[0]);
    return '/control/rehearsal' + (query.size ? '?'+query : '');
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
