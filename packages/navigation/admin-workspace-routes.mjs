// Document destinations only. APIs and authentication retain their own contracts.
export const ADMIN_WORKSPACE_TOOLS = Object.freeze({
  companies: 'Bolag & team',
  'dealer-studio': 'Skapa material', replies: 'Svarsbibliotek',
  'dealer-agent': 'Dialogtest',
});

const destinations = Object.freeze({
  '': '/admin', overview: '/admin', studio: '/admin/clips', lab: '/admin/clips',
  clips: '/admin/clips', 'dealer-forge': '/admin/dealer-studio?view=generate',
  companies: '/admin/companies', rooms: '/admin/rooms', lanes: '/admin/rooms',
  compositions: '/admin/scenes', preview: '/admin/scenes', backgrounds: '/admin/scenes',
  rehearsal: '/admin/rooms', activity: '/admin/rooms',
  library: '/admin/assets', videos: '/admin/clips', media: '/admin/clips', archive: '/admin/clips',
  replies: '/admin/replies', events: '/admin/clips', tree: '/admin/clips', 'presentation-events': '/admin/clips',
  zones: '/admin/scenes', probe: '/admin/clips?panel=room', guide: '/admin/guide',
  openclaw: '/admin/ai/models', ops: '/admin/drift?tab=speech', 'operator-chat': '/admin/dealer-agent',
  players: '/admin/players', team: '/admin/admin/accounts', transactions: '/admin/ekonomi',
  integration: '/admin/admin/api', shoes: '/admin/drift', 'legacy-rooms': '/admin/rooms',
  'game-tables': '/admin/rooms', speech: '/admin/clips?panel=room',
  tx:'/admin/ekonomi',api:'/admin/admin/api',bj:'/admin/rooms',dealers:'/admin/rooms',tables:'/admin/rooms',
  background:'/admin/scenes',voice:'/admin/clips?panel=room',
  deletion:'/admin/structure', // Merged into Kopplingar & användning.
  publication:'/admin/rooms', // Merged into Spelbolag & rum.
});
const administration = Object.freeze({accounts:'/admin/admin/accounts',finance:'/admin/ekonomi',
  partners:'/admin/admin/api',tables:'/admin/rooms',operations:'/admin/drift',
  // Retired speech review: recorded speech is reviewed under Röst & tal.
  'media-review':'/admin/clips?panel=room'});
export function adminToolName(path) {
  if(typeof path!=='string'||!/^\/(?:studio\/)?admin\//.test(path))return null;
  const name=path.replace(/^\/(?:studio\/)?admin\//,'');
  return Object.hasOwn(ADMIN_WORKSPACE_TOOLS,name)?name:null;
}
// Retired documents keep their bookmarks; canonical pages have a single menu home.
export const ADMIN_RETIRED_DOCUMENTS = Object.freeze({
  '/admin/material-library':'/admin/assets', '/admin/deletion':'/admin/structure',
  '/admin/publication':'/admin/rooms', '/admin/tools':'/admin/dealers',
  '/admin/admin/payments':'/admin/ekonomi?tab=payments', '/admin/admin/log':'/admin/companies',
  '/admin/ai/chat':'/admin', '/admin/admin/players':'/admin/players',
  '/admin/videos':'/admin/clips', '/admin/events':'/admin/clips', '/admin/rehearsal':'/admin/rooms',
  '/admin/compositions':'/admin/scenes', '/admin/probe':'/admin/clips?panel=room',
  '/admin/admin/operators':'/admin/companies',
  '/admin/media-review':'/admin/clips?panel=room',
});
const openClawHomes=Object.freeze({drift:'/admin/drift?tab=speech',models:'/admin/ai/models',
  agent:'/admin/dealer-agent',probe:'/admin/clips?panel=room',assistant:'/admin'});
export function adminDocumentHref(value) {
  if(typeof value!=='string'||!/^\/(?:studio\/)?(?:control|admin)(?:[/?#]|$)/.test(value)||/[\\\r\n]/.test(value))return value;
  const url=new URL(value,'https://workspace.invalid');
  const path=url.pathname.replace(/^\/studio(?=\/)/,'');
  const control=/^\/control(?:\/|$)/.test(path);
  const section=control?path.replace(/^\/control\/?/,'').replace(/\/$/,''):null;
  let consumeTab=false;
  let target;
  if(path==='/admin/clips'&&url.searchParams.get('panel')==='layers'){
    target='/admin/scenes';
  }else if(path==='/admin/openclaw'){
    const tab=url.searchParams.get('tab');
    target=Object.hasOwn(openClawHomes,tab)?openClawHomes[tab]:openClawHomes.drift;consumeTab=true;
  }else if(path==='/admin/dealer-studio'&&url.searchParams.get('view')!=='generate'){
    const view=url.searchParams.get('view');
    target=view==='speech'?'/admin/clips?panel=room':view==='settings'?'/admin/clips?panel=dealer':'/admin/clips';
  }else if(control){
    const administrationSection=section==='administration'||section==='admin';
    consumeTab=['openclaw','operator-chat','ops'].includes(section)||administrationSection&&url.searchParams.get('tab')==='media-review';
    target=administrationSection
      ? administration[url.searchParams.get('tab')]??'/admin/drift' : destinations[section];
    if(section==='openclaw'){target=url.searchParams.get('tab')==='chat'?'/admin/dealer-agent':'/admin/ai/models';consumeTab=true;}
    if(section==='lanes'&&url.searchParams.get('tab')==='companies')target='/admin/companies';
    if(section==='clips'){
      const view=url.searchParams.get('view');
      target=view==='generate'?'/admin/dealer-studio?view=generate':view==='speech'?'/admin/clips?panel=room':view==='settings'?'/admin/clips?panel=dealer':'/admin/clips';
    }
  }else target=ADMIN_RETIRED_DOCUMENTS[path];
  if(!target)return value; // Login, credentials, APIs and canonical pages are untouched.
  const result=new URL(target,url.origin),destinationKeys=new Set(result.searchParams.keys());
  for(const [key,item] of url.searchParams)if(!destinationKeys.has(key)&&!(consumeTab&&key==='tab'))result.searchParams.append(key,item);
  if((section==='library'||path==='/admin/material-library')&&!result.searchParams.has('tab')){
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
  if((path==='/admin/dealer-studio'||section==='clips')&&result.pathname==='/admin/clips')result.searchParams.delete('view');
  if(result.pathname==='/admin/scenes')result.searchParams.delete('panel');
  result.hash=url.hash;
  return result.pathname+result.search+result.hash;
}
