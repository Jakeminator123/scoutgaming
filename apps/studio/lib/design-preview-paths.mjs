import {ADMIN_WORKSPACE_TOOLS,ADMIN_RETIRED_DOCUMENTS,adminDocumentHref} from '../../../packages/navigation/admin-workspace-routes.mjs';
export const designPreviewPages = new Set([...Object.keys(ADMIN_RETIRED_DOCUMENTS).map(path=>path.slice(7)),...Object.keys(ADMIN_WORKSPACE_TOOLS),'tools', '', 'structure', 'deletion', 'rooms', 'dealers', 'clips', 'assets', 'drift', 'ekonomi',
  'admin/accounts', 'admin/operators', 'admin/players', 'admin/payments', 'admin/api', 'admin/log', 'ai/models', 'ai/chat', 'openclaw', 'players']);
export function designPreviewReturnTo(value) {
  if(typeof value!=='string'||value.length>2048||/[\\#\x00-\x20]/.test(value)||value.startsWith('//'))return null;
  const target=value.startsWith('/studio/')?value.slice(7):value;
  const [path,search]=target.split('?');
  if(target.split('?').length>2||!(path==='/admin'||path==='/admin/lobby'||path==='/admin/material-library'||path.startsWith('/admin/')&&designPreviewPages.has(path.slice(7))))return null;
  const allowed=new Set(['operator','room','table','composition','lane','dealer','game','event','variant','situation','view','tab','tool','role','category','panel','family']);
  const query=new URLSearchParams(search),seen=new Set();
  for(const [key,item] of query){if(!allowed.has(key)||seen.has(key)||!(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/).test(item))return null;seen.add(key);}
  return adminDocumentHref(path+(query.size?'?'+query:''));
}
