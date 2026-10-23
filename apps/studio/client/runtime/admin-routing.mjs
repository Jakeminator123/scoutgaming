export const adminContextKeys=Object.freeze(['operator','table','dealer','composition','lane','game']);

const canonicalAccountHref=href=>href.replace(/^\/(?:studio\/)?admin\/admin\/players(?=[?#]|$)/,'/admin/players');

// Compatibility for imported design links only. Admin components and route
// selection use their real /admin pathnames, never a virtual Control pathname.
export function adminHref(href){
  if(/^\/control\/(?:login|set-password)(?:[?#]|$)/.test(href))return href;
  const mapped=adminDocumentHref(href);
  return canonicalAccountHref(mapped===href?href.replace(/^\/control(?=[/?#]|$)/,'/admin'):mapped);
}

export function adminPathname(pathname){
  return canonicalAccountHref(pathname.replace(/^\/studio(?=\/admin(?:\/|$))/,''));
}

export function isInternalAdminPathname(pathname){
  return /^\/admin(?:\/|$)/.test(pathname)&&!/^\/admin\/lobby(?:\/|$)/.test(pathname);
}

export function hasAdminContext(search){
  const query=new URLSearchParams(search);
  return adminContextKeys.some(key=>query.has(key));
}

export function isStudioAdminRoute(path,search){
  return path==='/admin/clips';
}

// Room appearance comes from the selected room, never from a dealer-library query.
export function adminRoomHref(search,hash=''){
  const params=new URLSearchParams(search);params.delete('dealer');
  return '/admin/rooms'+(params.size?'?'+params:'')+hash;
}

export function withAdminContext(href,currentSearch){
  if(!href.startsWith('/admin'))return href;
  const url=new URL(href,'https://admin-routing.invalid');
  // A dealer library is independent of a room's permitted appearance choices.
  if(url.pathname==='/admin/dealers')return href;
  if(!isInternalAdminPathname(url.pathname)||url.pathname==='/admin')return href;
  if(url.pathname==='/admin/rooms')url.searchParams.delete('dealer');
  const context=new URLSearchParams(currentSearch);
  const explicitComposition=url.searchParams.has('composition')||url.searchParams.has('lane');
  const changedRoom=['operator','table'].some(key=>url.searchParams.has(key)&&url.searchParams.get(key)!==context.get(key));
  const changedRoomContext=changedRoom||url.searchParams.has('game')&&url.searchParams.get('game')!==context.get('game');
  for(const key of adminContextKeys){
    if(key==='dealer'&&url.pathname==='/admin/rooms')continue;
    // An omitted template follows a newly selected room; an explicit template
    // (including an old lane bookmark) must never inherit a competing ID.
    if((key==='composition'||key==='lane')&&(explicitComposition||changedRoomContext))continue;
    // A new room supplies its registered game unless the target chooses one.
    if(key==='game'&&changedRoom)continue;
    if(context.has(key)&&!url.searchParams.has(key))url.searchParams.set(key,context.get(key));
  }
  return url.pathname+url.search+url.hash;
}
import {adminDocumentHref,adminToolName} from '../../../../packages/navigation/admin-workspace-routes.mjs';
export {adminToolName};
