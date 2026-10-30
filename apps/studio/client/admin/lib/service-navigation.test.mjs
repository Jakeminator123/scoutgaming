import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as studioNavigation from '../../../lib/studio-navigation.mjs';
import * as adminNavigation from './admin-navigation.ts';

const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
const marker=name=>Object.defineProperty(()=>null,'name',{value:name});
// Values built inside the vm realm carry its prototypes; compare them as plain data.
const plain=value=>JSON.parse(JSON.stringify(value));
const node=(tree,predicate)=>{
  if(!tree||typeof tree!=='object')return null;
  if(Array.isArray(tree))return tree.map(child=>node(child,predicate)).find(Boolean)??null;
  return predicate(tree)?tree:node(tree.props?.children,predicate);
};
const descendants=tree=>Array.isArray(tree)?tree.flatMap(descendants):tree&&typeof tree==='object'?[tree,...descendants(tree.props?.children)]:[];
const session=()=>({username:'fixture-admin',role:'admin',availableActions:['GET moving-drift','POST moving-drift','GET overview'],gameOrigin:'https://game.invalid'});

// Each component keeps its own hook slots so a page and its panels can be
// rendered side by side; effects run on settle(), like the browser would.
function harness({search='',pathname='/admin/system',data=session(),status=200}={}){
  const requests=[],clients=[],owners=new Map();let active=null,queue=[];
  const owner=key=>owners.get(key)??owners.set(key,{slots:[],effects:[],cursor:0}).get(key);
  const hooks={...React,
    useState(initial){const o=active,i=o.cursor++;if(!(i in o.slots))o.slots[i]=typeof initial==='function'?initial():initial;return [o.slots[i],next=>{o.slots[i]=typeof next==='function'?next(o.slots[i]):next;}];},
    useEffect(effect,deps){const o=active,i=o.cursor++,previous=o.effects[i];if(!previous||deps.some((value,k)=>!Object.is(value,previous[k])))queue.push(()=>{o.effects[i]=deps;effect();});}};
  const markers=Object.fromEntries(['WorkspaceTool','TaldriftPanel','MovingDriftControls','OpenClawWorkspace','NativeAdministration','StudioAdministration','ConnectedEconomy','DealerImportAssistant'].map(name=>[name,marker(name)]));
  class StudioAdminUiError extends Error{constructor(status){super('Serverstatus '+status);this.status=status;}}
  const admin={...markers,StudioAdminUiError,
    studioAdminActor:value=>value&&typeof value.username==='string'&&typeof value.role==='string'?{username:value.username,role:value.role}:null,
    createStudioAdminClient:options=>{const client={options,calls:[],available:()=>true,async request(...args){client.calls.push(args);return {actor:{username:'fixture-admin',role:'admin'},payload:{}};}};clients.push(client);return client;},
    sharedStudioAdminRead:actions=>({actions,async read(){throw Error('no transport in this fixture');},refresh(){}})};
  const context={URL,URLSearchParams,AbortController,Error,location:{origin:'https://admin.invalid',get search(){return search;}},
    fetch:async(path,init)=>{requests.push({path,init});return {ok:status>=200&&status<300,status,json:async()=>typeof data==='function'?data():data};}};
  function compile(file,resolve){
    const module={exports:{}};
    runInNewContext(transformSync(readFileSync(new URL(file,import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
      {...context,module,exports:module.exports,require:name=>name==='react'?hooks:name==='react/jsx-runtime'?require(name):resolve(name)});
    return module.exports;
  }
  const navigation={__esModule:true,default:'a',usePathname:()=>pathname,useSearchParams:()=>new URLSearchParams(search)};
  const auth=compile('./admin-session.ts',()=>admin);
  const connected=compile('../components/studio/connected-services.tsx',name=>name.includes('admin-session')?auth:name.includes('runtime/navigation')?navigation:name.includes('studio-navigation')?studioNavigation:name.endsWith('.module.css')?{__esModule:true,default:{embedded:'embedded'}}:admin);
  const page=compile('../components/studio/taldrift-panel.tsx',name=>name.includes('admin-session')?auth:admin);
  // The hub layout builds on the kit (./kit, ./dialog, ./menu); those compile beside it, packages load as usual.
  const ui={},uiRequire=name=>name.includes('runtime/navigation')?navigation:name.startsWith('./')?(ui[name]??=compile('../components/ui/'+name.slice(2)+'.tsx',uiRequire)):require(name);
  const hub=compile('../components/ui/hub.tsx',uiRequire);
  markers.ResourceConnections=marker('ResourceConnections');
  const system=compile('../components/studio/system-page.tsx',name=>name==='../ui/hub'?hub:name.startsWith('../ui/')?uiRequire('./'+name.slice('../ui/'.length)):name.includes('runtime/navigation')?navigation:name.includes('admin-navigation')?adminNavigation:name==='./connected-services'?connected:name==='./resource-connections'?{ResourceConnections:markers.ResourceConnections}:admin);
  return {page,connected,hub,system,requests,clients,markers,
    navigate(next,path=pathname){search=next;pathname=path;},
    render(fn,props={},key=fn.name){const o=owner(key);active=o;o.cursor=0;return fn(props);},
    async settle(){for(let round=0;round<3&&queue.length;round++){const pending=queue;queue=[];for(const run of pending)run();await new Promise(setImmediate);}}};
}
const panelOf=(tree,type)=>node(tree,item=>item.type===type);

test('Taldrift mounts native controls on the freshly read actor, bound to the shown dealer',async()=>{
  const h=harness();
  let panel=h.render(h.page.TaldriftPanel,{dealerId:'paow'});
  assert.ok(node(panel,item=>item.props?.role==='status'));assert.equal(panelOf(panel,h.markers.MovingDriftControls),null);
  await h.settle();
  assert.deepEqual(h.requests.map(row=>row.path),['/studio/api/auth/session']);
  const init=h.requests[0].init;assert.equal(init.credentials,'same-origin');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');assert.ok(init.signal);
  panel=h.render(h.page.TaldriftPanel,{dealerId:'paow'});
  const controls=panelOf(panel,h.markers.MovingDriftControls);assert.ok(controls,'controls render once the session is verified');
  assert.deepEqual(plain(controls.props.expectedActor),{username:'fixture-admin',role:'admin'});
  assert.equal(h.clients.length,1);const [{options,calls}]=h.clients;
  // Every read names the dealer as ?dealerId=, every write in the body; the command itself is kept.
  await controls.props.client.request('GET','moving-drift',undefined,undefined,undefined);
  await controls.props.client.request('POST','moving-drift',{expectedRevision:0,commandId:'c-1',mode:'off'},undefined,undefined);
  assert.deepEqual(plain(calls.map(([method,action,body,,,query])=>({method,action,body,query}))),[
    {method:'GET',action:'moving-drift',query:{dealerId:'paow'}},
    {method:'POST',action:'moving-drift',body:{expectedRevision:0,commandId:'c-1',mode:'off',dealerId:'paow'}}]);
  assert.equal(controls.props.client.available('GET','moving-drift'),true);
  assert.equal(options.apiBase,'/studio/api/admin');assert.equal(options.readIdentity,'response-headers-v1');
  assert.deepEqual(plain(options.availableActions),session().availableActions);
  // Writes preflight a fresh session, as NativeAdministration does; nothing else is contacted.
  await options.session();
  assert.deepEqual(h.requests.map(row=>row.path),['/studio/api/auth/session','/studio/api/auth/session']);
  assert.equal(node(panel,item=>item.props?.role==='alert'),null);
});

// DealerHub has no key per dealer (entry.tsx), so the same panel instance moves from one dealer to the next.
test('Taldrift binds a new client when the shown dealer changes, so B never reads or writes A',async()=>{
  const h=harness();
  h.render(h.page.TaldriftPanel,{dealerId:'paow'});await h.settle();
  h.render(h.page.TaldriftPanel,{dealerId:'dragan'});await h.settle();
  const controls=panelOf(h.render(h.page.TaldriftPanel,{dealerId:'dragan'}),h.markers.MovingDriftControls);
  assert.equal(h.clients.length,2,'a new dealer reads the session again and gets its own client');
  await controls.props.client.request('GET','moving-drift',undefined,undefined,undefined);
  await controls.props.client.request('POST','moving-drift',{expectedRevision:1,commandId:'c-2',mode:'off'},undefined,undefined);
  assert.deepEqual(plain(h.clients[1].calls.map(([method,,body,,,query])=>({method,body,query}))),[
    {method:'GET',query:{dealerId:'dragan'}},
    {method:'POST',body:{expectedRevision:1,commandId:'c-2',mode:'off',dealerId:'dragan'}}]);
  assert.equal(h.clients[0].calls.length,0,'the first dealer\'s client is not reused');
});

test('Taldrift refuses an unverified session or action list and can retry',async()=>{
  for(const [options,expected] of [
    [{data:{availableActions:['GET moving-drift']}},/Serverstatus 401/],
    [{data:{...session(),availableActions:'GET moving-drift'}},/Serverstatus 503/],
    [{status:401},/Serverstatus 401/],
    [{status:503},/Serverstatus 503/],
  ]){
    const h=harness(options);h.render(h.page.TaldriftPanel);await h.settle();
    const panel=h.render(h.page.TaldriftPanel),alert=node(panel,item=>item.props?.role==='alert');
    assert.ok(alert,JSON.stringify(options));assert.match(renderToStaticMarkup(alert),expected);
    assert.equal(panelOf(panel,h.markers.MovingDriftControls),null);
    node(alert,item=>item.type==='button').props.onClick();h.render(h.page.TaldriftPanel);await h.settle();
    assert.equal(h.requests.length,2,'retry reads the session again');
  }
});


// System replaces the separate Drift, Ekonomi and account pages; its tabs must not discard native drafts.
test('system tabs keep visited panels mounted and ignore tab selection from other pages',async()=>{
  const h=harness({search:'?flik=drift&dealer=elin'});
  let tree;const render=async props=>{h.render(h.system.SystemPage,props);await h.settle();tree=h.render(h.system.SystemPage,props);};
  const wrappers=()=>descendants(tree).filter(row=>row.type==='div'&&Object.hasOwn(row.props,'hidden'));
  const administration=wrapper=>descendants(wrapper).filter(row=>row.type===h.connected.Administration).map(row=>[row.props.group,row.props.section??null]);
  await render({active:true,tab:'drift'});
  assert.equal(wrappers().length,1,'only the opened tab is mounted');assert.deepEqual(administration(wrappers()[0]),[['operations',null]]);
  await render({active:true,tab:'personal'});
  assert.deepEqual(wrappers().map(row=>row.props.hidden),[true,false],'the earlier tab stays mounted, hidden');
  assert.deepEqual(administration(wrappers()[1]),[['accounts','users']],'staff accounts read only staff users');
  // While another Admin page is shown, its query cannot mount a System tab.
  await render({active:false,tab:'spelare'});
  assert.equal(wrappers().length,2);assert.equal(descendants(tree).some(row=>row.type===h.connected.EconomyPanel),false);
  await render({active:false,tab:'drift'});assert.equal(wrappers().length,2);
  await render({active:true,tab:'personal'});
  assert.deepEqual(wrappers().map(row=>row.props.hidden),[true,false],'returning keeps both drafts mounted');
  await render({active:true,tab:'spelare'});
  assert.deepEqual(wrappers().map(row=>row.props.hidden),[true,true,false]);
  assert.deepEqual(administration(wrappers()[2]),[['accounts','players']],'player accounts read only players');
  assert.equal(descendants(wrappers()[2]).find(row=>row.type===h.connected.EconomyPanel).props.active,true);
  await render({active:false,tab:'spelare'});
  assert.equal(descendants(tree).find(row=>row.type===h.connected.EconomyPanel).props.active,false,'leaving System ends the journal visit');
  assert.equal(wrappers().length,3);
});

test('system navigation retains explicit ambiguous scope on every tab link',()=>{
  const h=harness({search:'?flik=spelare&dealer=elin&operator=north&operator=other&room=one&room=two&panel=intake'});
  const page=h.render(h.system.SystemPage,{active:true,tab:'spelare'}),tabs=descendants(page).find(row=>row.type===h.hub.Tabs);
  assert.equal(tabs.props.active,'spelare');
  // Intern lobby is no tab but a link in System's page header (Enkel väg 8).
  assert.equal(page.props.actions.props.href,'/admin/lobby');assert.equal(page.props.actions.props.children,'Intern lobby');
  const links=descendants(h.render(h.hub.Tabs,tabs.props)).filter(row=>row.type==='a');
  assert.deepEqual(links.map(link=>new URL(link.props.href,'https://test.invalid').searchParams.get('flik')),adminNavigation.adminSystemTabs.map(tab=>tab.id),'every System tab is a link');
  assert.deepEqual(links.filter(link=>link.props['aria-current']==='page').map(link=>link.props.children[0]),['Spelarkonton']);
  for(const link of links){
    const url=new URL(link.props.href,'https://test.invalid');assert.equal(url.pathname,'/admin/system');
    assert.equal(url.searchParams.getAll('flik').length,1);assert.equal(url.searchParams.get('dealer'),'elin');
    assert.deepEqual(url.searchParams.getAll('operator'),['north','other']);assert.deepEqual(url.searchParams.getAll('room'),['one','two']);
    assert.equal(url.searchParams.has('panel'),false,'a single-tab panel does not follow to another tab');
  }
});

test('the exported context link keeps ambiguous scope and excludes credentials',()=>{
  const h=harness();
  const query=new URLSearchParams('flik=spelare&dealer=elin&operator=north&operator=other&room=one&room=two&token=secret');
  const url=new URL(h.connected.adminContextHref('/admin/system?flik=integration',query),'https://test.invalid');
  assert.equal(url.pathname,'/admin/system');assert.equal(url.searchParams.get('dealer'),'elin');
  assert.deepEqual(url.searchParams.getAll('operator'),['north','other']);assert.deepEqual(url.searchParams.getAll('room'),['one','two']);
  assert.equal(url.searchParams.has('token'),false);
});

// A nav address already names its company or room; the selector is not repeated in the query.
test('the exported context link never repeats the selector a nav address names',()=>{
  const h=harness();
  assert.equal(h.connected.adminContextHref('/admin/companies/north?flik=team',new URLSearchParams('operator=north&dealer=elin')),'/admin/companies/north?flik=team&dealer=elin');
  assert.equal(h.connected.adminContextHref('/admin/companies/north',new URLSearchParams('operator=north&operator=other')),'/admin/companies/north');
  assert.equal(h.connected.adminContextHref('/admin/rooms',new URLSearchParams('table=room-7&operator=north')),'/admin/rooms/room-7?operator=north');
  assert.equal(h.connected.adminContextHref('/admin/rooms/room-7?flik=spel',new URLSearchParams('room=room-7&table=room-7')),'/admin/rooms/room-7?flik=spel');
  // On the company list the company is a filter: one operator, the Spelbord tab, no nav.
  const list=new URL(h.connected.adminContextHref('/admin/companies',new URLSearchParams('operator=north')),'https://test.invalid');
  assert.equal(list.pathname,'/admin/companies');assert.equal(list.searchParams.get('tab'),'spelbord');assert.deepEqual(list.searchParams.getAll('operator'),['north']);
});

// The hub tab row copies only the shared Studio context (components/ui/hub.tsx Tabs), never a credential.
test('system tab links exclude credentials from the address',()=>{
  const h=harness({search:'?flik=spelare&token=secret'});
  const tabs=descendants(h.render(h.system.SystemPage,{active:true,tab:'spelare'})).find(row=>row.type===h.hub.Tabs);
  for(const link of descendants(h.render(h.hub.Tabs,tabs.props)).filter(row=>row.type==='a'))
    assert.equal(new URL(link.props.href,'https://test.invalid').searchParams.has('token'),false,link.props.href);
});
