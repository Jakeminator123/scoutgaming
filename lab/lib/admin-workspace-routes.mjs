// Document destinations only. APIs and authentication retain their own contracts.
export const ADMIN_WORKSPACE_TOOLS = Object.freeze({
  companies: 'Bolag & team', publication: 'Rum & publicering',
  compositions: 'Sammansättningar', 'dealer-studio': 'Dealerinställningar',
  videos: 'Klippbibliotek', replies: 'Svarsbibliotek', 'media-review': 'Talgranskning', rehearsal: 'Provspelning',
  events: 'Spelhändelser & regler', probe: 'Tal vid inaktivitet', guide: 'Guide',
  'material-library': 'Materialinställningar', 'dealer-agent': 'Dealerns agent',
});
const destinations = Object.freeze({
  '': '/admin', overview: '/admin', studio: '/admin/clips', lab: '/admin/clips',
  clips: '/admin/dealer-studio', 'dealer-forge': '/admin/dealer-studio?view=generate',
  companies: '/admin/companies', rooms: '/admin/publication', lanes: '/admin/publication',
  compositions: '/admin/compositions', preview: '/admin/compositions', backgrounds: '/admin/compositions',
  rehearsal: '/admin/rehearsal', activity: '/admin/rehearsal',
  library: '/admin/material-library', videos: '/admin/videos', media: '/admin/videos', archive: '/admin/videos',
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
  if(typeof value!=='string'||!/^\/(?:studio\/)?control(?:[/?#]|$)/.test(value)||/[\\\r\n]/.test(value))return value;
  const url=new URL(value,'https://workspace.invalid');
  const section=url.pathname.replace(/^\/(?:studio\/)?control\/?/,'');
  let target=section==='administration'||section==='admin'
    ? administration[url.searchParams.get('tab')]??'/admin/drift' : destinations[section];
  if(section==='openclaw'&&url.searchParams.get('tab')==='chat')target='/admin/dealer-agent';
  if(section==='lanes'&&url.searchParams.get('tab')==='companies')target='/admin/companies';
  if(!target)return value; // Includes login and set-password; never rewrite credentials.
  const result=new URL(target,url.origin);
  for(const [key,item] of url.searchParams)if(!result.searchParams.has(key))result.searchParams.append(key,item);
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
