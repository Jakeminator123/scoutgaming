export const adminContextKeys=Object.freeze(['operator','table','dealer','composition','lane','game']);

// Compatibility for imported design links only. Admin components and route
// selection use their real /admin pathnames, never a virtual Control pathname.
export function adminHref(href){
  if(/^\/control\/(?:login|set-password)(?:[?#]|$)/.test(href))return href;
  const mapped=adminDocumentHref(href);
  return mapped===href?href.replace(/^\/control(?=[/?#]|$)/,'/admin'):mapped;
}

export function adminPathname(pathname){
  return pathname.replace(/^\/studio(?=\/admin(?:\/|$))/,'');
}

export function isInternalAdminPathname(pathname){
  return /^\/admin(?:\/|$)/.test(pathname)&&!/^\/admin\/lobby(?:\/|$)/.test(pathname);
}

export function hasAdminContext(search){
  const query=new URLSearchParams(search);
  return adminContextKeys.some(key=>query.has(key));
}

export function isRegisteredRoomListRoute(path,search){
  return path==='/admin/rooms'&&new URLSearchParams(search).get('view')==='registered';
}

export function isStudioAdminRoute(path,search){
  return path==='/admin'&&hasAdminContext(search)
    || path==='/admin/clips'
    || path==='/admin/rooms'&&!isRegisteredRoomListRoute(path,search);
}

export function withAdminContext(href,currentSearch){
  if(!href.startsWith('/admin'))return href;
  const url=new URL(href,'https://admin-routing.invalid');
  // A dealer library is independent of a room's permitted appearance choices.
  if(url.pathname==='/admin/dealers')return href;
  if(!isInternalAdminPathname(url.pathname)||url.pathname==='/admin')return href;
  const context=new URLSearchParams(currentSearch);
  for(const key of adminContextKeys)if(context.has(key)&&!url.searchParams.has(key))url.searchParams.set(key,context.get(key));
  return url.pathname+url.search+url.hash;
}
import {adminDocumentHref,adminToolName} from '../../../lab/lib/admin-workspace-routes.mjs';
export {adminToolName};
