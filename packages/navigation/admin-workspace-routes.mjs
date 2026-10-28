// Document destinations only. APIs and authentication retain their own contracts.
// Admin has six menu pages; every retired address lands on the right nav and tab with
// its company, room, dealer, revision and fragment kept. Two pseudo-targets resolve
// against the query: `dealer:<flik>` opens the dealer's nav, `rooms` the room list or editor.
export const ADMIN_WORKSPACE_TOOLS = Object.freeze({});
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const SYSTEM=flik=>'/admin/system?flik='+flik;
const destinations = Object.freeze({
  '': '/admin', overview: '/admin', studio: 'dealer:klipp', lab: 'dealer:klipp',
  clips: 'dealer:klipp', 'dealer-forge': 'dealer:klipp&panel=generera',
  companies: '/admin/companies', rooms: 'rooms', lanes: 'rooms',
  compositions: '/admin/scenes?tab=mallar', preview: '/admin/scenes?tab=mallar', backgrounds: '/admin/scenes?tab=bakgrunder',
  rehearsal: 'rooms', activity: 'rooms',
  library: '/admin/scenes', videos: 'dealer:klipp', media: 'dealer:klipp', archive: 'dealer:installningar',
  replies: 'dealer:tal', events: 'dealer:klipp', tree: 'dealer:klipp', 'presentation-events': 'dealer:klipp',
  zones: '/admin/scenes?tab=mallar', probe: 'dealer:tal', guide: '/admin/guide',
  openclaw: SYSTEM('agenter'), ops: 'dealer:tal', 'operator-chat': 'dealer:tal&verktyg=dialog',
  players: SYSTEM('spelare'), team: SYSTEM('personal'), transactions: SYSTEM('spelare'),
  integration: SYSTEM('integration'), shoes: SYSTEM('drift'), 'legacy-rooms': 'rooms',
  'game-tables': 'rooms', speech: 'dealer:tal',
  tx:SYSTEM('spelare'),api:SYSTEM('integration'),bj:'rooms',dealers:'rooms',tables:'rooms',
  background:'/admin/scenes?tab=bakgrunder',voice:'dealer:tal',
  deletion:SYSTEM('beroenden'), publication:'rooms',
});
const administration = Object.freeze({accounts:SYSTEM('personal'),finance:SYSTEM('spelare'),
  partners:SYSTEM('integration'),tables:'rooms',operations:SYSTEM('drift'),
  // Retired speech review: recorded speech is reviewed under the dealer's Röst och tal.
  'media-review':'dealer:tal'});
export function adminToolName(path) {
  if(typeof path!=='string'||!/^\/(?:studio\/)?admin\//.test(path))return null;
  const name=path.replace(/^\/(?:studio\/)?admin\//,'');
  return Object.hasOwn(ADMIN_WORKSPACE_TOOLS,name)?name:null;
}
// Retired documents keep their bookmarks; canonical pages have a single menu home.
const retired = Object.freeze({
  '/admin/material-library':'/admin/scenes', '/admin/deletion':SYSTEM('beroenden'),
  '/admin/publication':'rooms', '/admin/tools':'/admin/dealers',
  '/admin/admin/payments':SYSTEM('spelare'), '/admin/admin/log':'/admin/companies',
  '/admin/ai/chat':'/admin', '/admin/admin/players':SYSTEM('spelare'),
  '/admin/videos':'dealer:klipp', '/admin/events':'dealer:klipp', '/admin/rehearsal':'rooms',
  '/admin/compositions':'/admin/scenes?tab=mallar', '/admin/probe':'dealer:tal',
  '/admin/admin/operators':'/admin/companies',
  '/admin/media-review':'dealer:tal',
  '/admin/clips':'dealer:klipp', '/admin/replies':'dealer:tal', '/admin/dealer-agent':'dealer:tal&verktyg=dialog',
  '/admin/dealer-studio':'dealer:klipp', '/admin/assets':'/admin/scenes', '/admin/rooms':'rooms',
  '/admin/players':SYSTEM('spelare'), '/admin/ekonomi':SYSTEM('spelare'), '/admin/admin/api':SYSTEM('integration'),
  '/admin/admin/accounts':SYSTEM('personal'), '/admin/drift':SYSTEM('drift'), '/admin/ai/models':SYSTEM('agenter'),
  '/admin/structure':SYSTEM('beroenden'), '/admin/openclaw':SYSTEM('agenter'),
});
const staticTarget=target=>target.startsWith('dealer:')?'/admin/dealers':target==='rooms'?'/admin/companies?tab=spelbord':target;
export const ADMIN_RETIRED_DOCUMENTS = Object.freeze(Object.fromEntries(Object.entries(retired).map(([path,target])=>[path,staticTarget(target)])));
const openClawHomes=Object.freeze({drift:'dealer:tal',models:SYSTEM('agenter'),
  agent:'dealer:tal&verktyg=dialog',probe:'dealer:tal',assistant:'/admin'});
const dealerView=view=>view==='generate'?'dealer:klipp&panel=generera':view==='speech'?'dealer:tal':view==='settings'?'dealer:installningar':'dealer:klipp';
const clipPanel=panel=>panel==='layers'?'/admin/scenes?tab=mallar':panel==='room'?'dealer:tal':panel==='dealer'?'dealer:installningar':panel==='intake'?'dealer:klipp&panel=intake':'dealer:klipp';
const materialTab=(tab,role)=>tab==='backgrounds'||tab==='bakgrunder'||!tab&&role==='background'?'bakgrunder':'bordsgrafik';
const single=values=>{const distinct=[...new Set(values)];return distinct.length===1&&ID.test(distinct[0])?distinct[0]:null;};

export function adminDocumentHref(value) {
  if(typeof value!=='string'||!/^\/(?:studio\/)?(?:control|admin)(?:[/?#]|$)/.test(value)||/[\\\r\n]/.test(value))return value;
  const url=new URL(value,'https://workspace.invalid');
  const path=url.pathname.replace(/^\/studio(?=\/)/,'');
  const control=/^\/control(?:\/|$)/.test(path);
  const section=control?path.replace(/^\/control\/?/,'').replace(/\/$/,''):null;
  const query=url.searchParams,tab=query.get('tab'),view=query.get('view'),panel=query.get('panel');
  const consume=new Set();
  let target;
  if(control){
    const administrationSection=section==='administration'||section==='admin';
    if(administrationSection){target=administration[tab]??SYSTEM('drift');consume.add('tab');}
    else if(section==='openclaw'){target=tab==='chat'?'dealer:tal&verktyg=dialog':SYSTEM('agenter');consume.add('tab');}
    else if(section==='operator-chat'||section==='ops'){target=destinations[section];consume.add('tab');}
    else if(section==='lanes'){target=tab==='companies'?'/admin/companies':'rooms';consume.add('tab');}
    else if(section==='clips'){target=dealerView(view);consume.add('view');}
    else if(section==='library'){target='/admin/scenes?tab='+materialTab(tab,query.get('role'));consume.add('tab');consume.add('role');}
    else target=destinations[section];
  }
  else if(path==='/admin/clips'){target=clipPanel(panel);consume.add('panel');consume.add('view');}
  else if(path==='/admin/openclaw'){target=openClawHomes[tab]??openClawHomes.drift;consume.add('tab');}
  else if(path==='/admin/dealer-studio'){target=dealerView(view);consume.add('view');}
  else if(path==='/admin/drift'){target=tab==='speech'?'dealer:tal':SYSTEM('drift');consume.add('tab');}
  else if(path==='/admin/ekonomi'||path==='/admin/admin/payments'){target=SYSTEM('spelare');consume.add('tab');}
  else if(path==='/admin/assets'||path==='/admin/material-library'){target='/admin/scenes?tab='+materialTab(tab,query.get('role'));consume.add('tab');consume.add('role');}
  else if(path==='/admin/companies'&&query.has('operator')&&!tab){target='/admin/companies';}
  else if(path==='/admin/dealers'&&(query.has('dealer')||query.has('dealerId'))){target='dealer:klipp';}
  else target=retired[path];
  if(!target)return value; // Login, credentials, APIs and canonical pages are untouched.
  const remove=new Set(consume);
  if(target.startsWith('dealer:')){
    const [,flik,extra='']=target.match(/^dealer:([a-z]+)(?:&(.*))?$/);
    const dealers=query.getAll('dealer').length?query.getAll('dealer'):query.getAll('dealerId');
    const dealer=single(dealers);
    target=dealer?`/admin/dealers/${dealer}?flik=${flik}${extra?'&'+extra:''}`:'/admin/dealers';
    if(dealer){remove.add('dealer');remove.add('dealerId');}
  } else if(target==='rooms'){
    const room=single([...query.getAll('table'),...query.getAll('room')]);
    target=room?`/admin/rooms/${room}`:'/admin/companies?tab=spelbord';
    if(room)for(const key of ['table','room','composition','lane','game'])remove.add(key);
  } else if(target==='/admin/companies'&&!tab){
    const operator=single(query.getAll('operator'));
    if(operator){target=`/admin/companies/${operator}`;remove.add('operator');}
  }
  const result=new URL(target,url.origin),destinationKeys=new Set(result.searchParams.keys());
  for(const [key,item] of query)if(!destinationKeys.has(key)&&!remove.has(key))result.searchParams.append(key,item);
  if(result.searchParams.has('lane')&&!result.searchParams.has('composition'))result.searchParams.set('composition',result.searchParams.get('lane'));
  result.searchParams.delete('lane');
  if(!result.searchParams.has('dealer')&&result.searchParams.has('dealerId'))result.searchParams.set('dealer',result.searchParams.get('dealerId'));
  result.searchParams.delete('dealerId');
  if(result.pathname==='/admin/scenes')result.searchParams.delete('panel');
  result.hash=url.hash;
  return result.pathname+result.search+result.hash;
}
