export const adminContextKeys=Object.freeze(['operator','table','dealer','composition','lane','game']);

const canonicalAccountHref=href=>href.replace(/^\/(?:studio\/)?admin\/admin\/players(?=[?#]|$)/,'/admin/system?flik=spelare');

// Compatibility for imported design links only. Admin components and route
// selection use their real /admin pathnames, never a virtual Control pathname.
export function adminHref(href){
  if(/^\/control\/(?:login|set-password)(?:[?#]|$)/.test(href))return href;
  const mapped=adminDocumentHref(href);
  return canonicalAccountHref(mapped===href?href.replace(/^\/control(?=[/?#]|$)/,'/admin'):mapped);
}

export function adminPathname(pathname){
  return pathname.replace(/^\/studio(?=\/admin(?:\/|$))/,'');
}

export function isInternalAdminPathname(pathname){
  return /^\/admin(?:\/|$)/.test(pathname)&&!/^\/admin\/lobby(?:\/|$)/.test(pathname);
}

// The six menu pages, the three navs and Skapa demo (reached from Översikt). An unknown /admin path is 'unknown'.
export function parseAdminPath(pathname){
  const match=adminPathname(pathname).match(/^\/admin(?:\/(dealers|scenes|companies|rooms|system|guide|lobby|demo)(?:\/([A-Za-z0-9][A-Za-z0-9._:-]{0,99}))?)?\/?$/);
  if(!match)return {page:'unknown',id:''};
  const [,section,id='']=match;
  if(!section)return {page:'home',id:''};
  if(id)return {page:section==='dealers'?'dealer':section==='companies'?'company':section==='rooms'?'room':'unknown',id};
  return {page:section==='rooms'?'unknown':section,id:''};
}

export function hasAdminContext(search){
  const query=new URLSearchParams(search);
  return adminContextKeys.some(key=>query.has(key));
}

// The one clip-map instance is mounted under the dealer nav and under Miljöer.
export function isStudioAdminRoute(path){
  const {page}=parseAdminPath(path);
  return page==='dealer'||page==='scenes';
}

// Only the clip map carries room/template context between its two mounts; the
// dealer sits in the path, so it is never inherited from a query.
export function withAdminContext(href,currentSearch){
  if(!href.startsWith('/admin'))return href;
  const url=new URL(href,'https://admin-routing.invalid');
  if(!isStudioAdminRoute(url.pathname))return href;
  const context=new URLSearchParams(currentSearch);
  const explicitComposition=url.searchParams.has('composition')||url.searchParams.has('lane');
  const changedRoom=['operator','table'].some(key=>url.searchParams.has(key)&&url.searchParams.get(key)!==context.get(key));
  const changedRoomContext=changedRoom||url.searchParams.has('game')&&url.searchParams.get('game')!==context.get('game');
  for(const key of ['operator','table','composition','lane','game']){
    // An omitted template follows a newly selected room; an explicit template
    // (including an old lane bookmark) must never inherit a competing ID.
    if((key==='composition'||key==='lane')&&(explicitComposition||changedRoomContext))continue;
    // A new room supplies its registered game unless the target chooses one.
    if(key==='game'&&changedRoom)continue;
    if(context.has(key)&&!url.searchParams.has(key))url.searchParams.set(key,context.get(key));
  }
  return url.pathname+url.search+url.hash;
}
import {adminDocumentHref} from '../../../../packages/navigation/admin-workspace-routes.mjs';
