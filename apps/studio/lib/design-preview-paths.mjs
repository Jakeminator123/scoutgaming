import {ADMIN_RETIRED_DOCUMENTS,adminDocumentHref} from '../../../packages/navigation/admin-workspace-routes.mjs';
// Static documents the Admin bundle serves. Retired addresses stay listed so the server can redirect them.
export const designPreviewPages = new Set([...Object.keys(ADMIN_RETIRED_DOCUMENTS).map(path=>path.slice(7)),'', 'dealers', 'scenes', 'companies', 'system', 'guide',
  'tools', 'structure', 'deletion', 'rooms', 'clips', 'assets', 'drift', 'ekonomi', 'replies', 'dealer-agent', 'dealer-studio',
  'admin/accounts', 'admin/players', 'admin/payments', 'admin/api', 'admin/log', 'ai/models', 'ai/chat', 'openclaw', 'players']);
// The three navs carry one identity in the path: /admin/dealers/<dealer>, /admin/companies/<bolag>, /admin/rooms/<spelbord>.
const navPages=/^(?:dealers|companies|rooms)\/[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
export const isDesignPreviewPage=path=>typeof path==='string'&&(designPreviewPages.has(path)||navPages.test(path));
export function designPreviewReturnTo(value) {
  if(typeof value!=='string'||value.length>2048||/[\\#\x00-\x20]/.test(value)||value.startsWith('//'))return null;
  const target=value.startsWith('/studio/')?value.slice(7):value;
  const [path,search]=target.split('?');
  if(target.split('?').length>2||!(path==='/admin'||path==='/admin/lobby'||path==='/admin/material-library'||path.startsWith('/admin/')&&isDesignPreviewPage(path.slice(7))))return null;
  const allowed=new Set(['operator','room','table','composition','lane','dealer','game','event','variant','situation','view','tab','tool','role','category','panel','family','flik','verktyg']);
  const query=new URLSearchParams(search),seen=new Set();
  for(const [key,item] of query){if(!allowed.has(key)||seen.has(key)||!(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/).test(item))return null;seen.add(key);}
  return adminDocumentHref(path+(query.size?'?'+query:''));
}
