// Document destinations only. APIs and authentication retain their own contracts.
export const ADMIN_WORKSPACE_TOOLS = Object.freeze({
  companies: 'Bolag & team', publication: 'Rum & publicering',
  compositions: 'Sammansättningar', 'dealer-studio': 'Dealerinställningar',
  videos: 'Klippbibliotek', replies: 'Svarsbibliotek', 'media-review': 'Talgranskning', rehearsal: 'Provspelning',
  events: 'Spelhändelser & regler', probe: 'Tal vid inaktivitet', guide: 'Guide',
  'dealer-agent': 'Dealerns agent',
});
// The only tools listed under System → Fördjupning; every other tool opens from its menu page.
export const ADMIN_DEPTH_TOOLS = Object.freeze(['media-review', 'replies', 'events', 'guide']);
const destinations = Object.freeze({
  '': '/admin', overview: '/admin', studio: '/admin/clips', lab: '/admin/clips',
  clips: '/admin/dealer-studio', 'dealer-forge': '/admin/dealer-studio?view=generate',
  companies: '/admin/companies', rooms: '/admin/rooms', lanes: '/admin/rooms',
  compositions: '/admin/compositions', preview: '/admin/compositions', backgrounds: '/admin/compositions',
  rehearsal: '/admin/rehearsal', activity: '/admin/rehearsal',
  library: '/admin/assets', videos: '/admin/videos', media: '/admin/videos', archive: '/admin/videos',
  replies: '/admin/replies', events: '/admin/events', tree: '/admin/events', 'presentation-events': '/admin/events',
  zones: '/admin/compositions', probe: '/admin/openclaw?tab=probe', guide: '/admin/guide',
  openclaw: '/admin/openclaw?tab=models', ops: '/admin/openclaw?tab=drift', 'operator-chat': '/admin/openclaw?tab=agent',
  players: '/admin/players', team: '/admin/admin/accounts', transactions: '/admin/ekonomi',
  integration: '/admin/admin/api', shoes: '/admin/drift', 'legacy-rooms': '/admin/rooms',
  'game-tables': '/admin/rooms', speech: '/admin/dealer-studio?view=speech',
  tx:'/admin/ekonomi',api:'/admin/admin/api',bj:'/admin/rooms',dealers:'/admin/rooms',tables:'/admin/rooms',
  background:'/admin/compositions',voice:'/admin/dealer-studio?view=speech',
  deletion:'/admin/structure', // Merged into Kopplingar & användning.
  publication:'/admin/rooms', // Merged into Spelbolag & rum.
});
const administration = Object.freeze({accounts:'/admin/admin/accounts',finance:'/admin/ekonomi',
  partners:'/admin/admin/api',tables:'/admin/rooms',operations:'/admin/drift','media-review':'/admin/media-review'});
export function adminToolName(path) {
  if(typeof path!=='string'||!/^\/(?:studio\/)?admin\//.test(path))return null;
  const name=path.replace(/^\/(?:studio\/)?admin\//,'');
  return Object.hasOwn(ADMIN_WORKSPACE_TOOLS,name)?name:null;
}
export function adminDocumentHref(value) {
  if(typeof value!=='string'||!/^\/(?:studio\/)?(?:control(?:[/?#]|$)|admin\/(?:material-library|deletion|publication)(?:[/?#]|$))/.test(value)||/[\\\r\n]/.test(value))return value;
  const url=new URL(value,'https://workspace.invalid');
  // Retired Admin documents redirect like Control bookmarks; their query and fragment follow.
  const retired=url.pathname.match(/^\/(?:studio\/)?admin\/(material-library|deletion|publication)$/)?.[1];
  const section=retired==='material-library'?'library':retired??url.pathname.replace(/^\/(?:studio\/)?control\/?/,'').replace(/\/$/,'');
  let target=section==='administration'||section==='admin'
    ? administration[url.searchParams.get('tab')]??'/admin/drift' : destinations[section];
  if(section==='openclaw'&&url.searchParams.get('tab')==='chat')target='/admin/openclaw?tab=agent';
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
