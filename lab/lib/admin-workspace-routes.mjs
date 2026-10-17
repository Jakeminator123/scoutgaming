import {canonicalControlHref} from './control-flow.mjs';

// Document destinations only. APIs and authentication retain their own contracts.
export const ADMIN_WORKSPACE_TOOLS = Object.freeze({
  companies: 'Bolag & team', publication: 'Rum & publicering',
  compositions: 'Sammansättningar', 'dealer-studio': 'Dealerinställningar',
  videos: 'Klippbibliotek', replies: 'Svarsbibliotek', 'media-review': 'Talgranskning', rehearsal: 'Provspelning',
  events: 'Spelhändelser & regler', probe: 'Tal vid inaktivitet', guide: 'Guide',
  'dealer-agent': 'Dealerns agent',
});
const destinations = Object.freeze({
  '': '/admin', overview: '/admin', studio: '/admin/clips', lab: '/admin/clips',
  clips: '/admin/dealer-studio', 'dealer-forge': '/admin/dealer-studio?view=generate',
  companies: '/admin/companies', rooms: '/admin/publication', lanes: '/admin/publication',
  compositions: '/admin/compositions', preview: '/admin/compositions', backgrounds: '/admin/compositions',
  rehearsal: '/admin/rehearsal', activity: '/admin/rehearsal',
  library: '/admin/assets', videos: '/admin/videos', media: '/admin/videos', archive: '/admin/videos',
  replies: '/admin/replies', events: '/admin/events', tree: '/admin/events', 'presentation-events': '/admin/events',
  zones: '/admin/compositions', probe: '/admin/probe', guide: '/admin/guide',
  openclaw: '/admin/ai/models', ops: '/admin/ai/models', 'operator-chat': '/admin/dealer-agent',
  players: '/admin/admin/players', team: '/admin/admin/accounts', transactions: '/admin/ekonomi',
  integration: '/admin/admin/api', shoes: '/admin/drift', 'legacy-rooms': '/admin/publication',
  'game-tables': '/admin/publication', speech: '/admin/dealer-studio?view=speech',
  tx:'/admin/ekonomi',api:'/admin/admin/api',bj:'/admin/publication',dealers:'/admin/publication',tables:'/admin/publication',
  background:'/admin/compositions',voice:'/admin/dealer-studio?view=speech',
});
const administration = Object.freeze({accounts:'/admin/admin/accounts',finance:'/admin/ekonomi',
  partners:'/admin/admin/api',tables:'/admin/publication',operations:'/admin/drift','media-review':'/admin/media-review'});
export function adminToolName(path) {
  if(typeof path!=='string'||!/^\/(?:studio\/)?admin\//.test(path))return null;
  const name=path.replace(/^\/(?:studio\/)?admin\//,'');
  return Object.hasOwn(ADMIN_WORKSPACE_TOOLS,name)?name:null;
}
export function adminDocumentHref(value) {
  if(typeof value!=='string'||!/^\/(?:studio\/)?(?:control(?:[/?#]|$)|admin\/material-library(?:[/?#]|$))/.test(value)||/[\\\r\n]/.test(value))return value;
  const url=new URL(value,'https://workspace.invalid');
  const materialAlias=/^\/(?:studio\/)?admin\/material-library$/.test(url.pathname);
  const section=materialAlias?'library':url.pathname.replace(/^\/(?:studio\/)?control\/?/,'');
  let target=section==='administration'||section==='admin'
    ? administration[url.searchParams.get('tab')]??'/admin/drift' : destinations[section];
  if(section==='openclaw'&&url.searchParams.get('tab')==='chat')target='/admin/dealer-agent';
  if(section==='lanes'&&url.searchParams.get('tab')==='companies')target='/admin/companies';
  if(!target)return value; // Includes login and set-password; never rewrite credentials.
  const result=new URL(target,url.origin);
  const destinationKeys=new Set(result.searchParams.keys());
  for(const [key,item] of url.searchParams)if(!destinationKeys.has(key))result.searchParams.append(key,item);
  if(section==='library'&&!result.searchParams.has('tab')){
    const role=result.searchParams.get('role');
    if(role==='background'||role==='table')result.searchParams.set('tab',role==='background'?'backgrounds':'tables');
  }
  if(result.searchParams.has('lane')&&!result.searchParams.has('composition'))result.searchParams.set('composition',result.searchParams.get('lane'));
  result.searchParams.delete('lane');
  if(section==='lanes')result.searchParams.delete('tab');
  if(section==='clips'||section==='dealer-forge'){
    if(!result.searchParams.has('dealer')&&result.searchParams.has('dealerId'))result.searchParams.set('dealer',result.searchParams.get('dealerId'));
    result.searchParams.delete('dealerId');
  }
  result.hash=url.hash;
  return result.pathname+result.search+result.hash;
}

const studioAliases = Object.freeze({
  activity:'/control/activity', administration:'/control/administration', events:'/control/events',
  guide:'/control/guide', lissabon:'/control', openclaw:'/control/openclaw',
  'operator-chat':'/control/operator-chat', probe:'/control/probe', tree:'/control/tree',
  videos:'/control/videos', zones:'/control/preview',
});
const controlAliases = new Set(['/control/lanes','/control/library','/control/preview','/control/zones']);
const contextKeys = new Set(['dealer','dealerId','operator','room','table','game','composition','lane','tab','role','event','variant','situation','view','category']);

// These exact, unauthenticated page shells used to redirect before loading data.
// Preserve their distinct query policies; native Control-to-Admin routing runs first.
export function legacyStudioDocumentHref(request, {basePath = ''} = {}) {
  if (!['GET','HEAD'].includes(request.method) || request.body || request.headers.has('next-action')) return null;
  const url = new URL(request.url);
  if (basePath !== '' && basePath !== '/studio') return null;
  if (basePath && !url.pathname.startsWith(basePath+'/')) return null;
  const path = url.pathname.slice(basePath.length);
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
