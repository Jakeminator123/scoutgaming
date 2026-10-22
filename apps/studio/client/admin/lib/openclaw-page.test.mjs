import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as studioNavigation from '../../../lib/studio-navigation.mjs';

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
function harness({search='',data=session(),status=200}={}){
  const requests=[],owners=new Map();let active=null,queue=[];
  const owner=key=>owners.get(key)??owners.set(key,{slots:[],effects:[],cursor:0}).get(key);
  const hooks={...React,
    useState(initial){const o=active,i=o.cursor++;if(!(i in o.slots))o.slots[i]=typeof initial==='function'?initial():initial;return [o.slots[i],next=>{o.slots[i]=typeof next==='function'?next(o.slots[i]):next;}];},
    useEffect(effect,deps){const o=active,i=o.cursor++,previous=o.effects[i];if(!previous||deps.some((value,k)=>!Object.is(value,previous[k])))queue.push(()=>{o.effects[i]=deps;effect();});}};
  const markers=Object.fromEntries(['WorkspaceTool','MovingDriftControls','OpenClawWorkspace','NativeAdministration','StudioAdministration','ConnectedEconomy','DealerImportAssistant'].map(name=>[name,marker(name)]));
  class StudioAdminUiError extends Error{constructor(status){super('Serverstatus '+status);this.status=status;}}
  const admin={...markers,StudioAdminUiError,
    studioAdminActor:value=>value&&typeof value.username==='string'&&typeof value.role==='string'?{username:value.username,role:value.role}:null,
    createStudioAdminClient:options=>({options,available:()=>true,async request(){throw Error('no transport in this fixture');}})};
  const context={URL,URLSearchParams,AbortController,Error,location:{origin:'https://admin.invalid',get search(){return search;}},
    fetch:async(path,init)=>{requests.push({path,init});return {ok:status>=200&&status<300,status,json:async()=>typeof data==='function'?data():data};}};
  function compile(file,resolve){
    const module={exports:{}};
    runInNewContext(transformSync(readFileSync(new URL(file,import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
      {...context,module,exports:module.exports,require:name=>name==='react'?hooks:name==='react/jsx-runtime'?require(name):resolve(name)});
    return module.exports;
  }
  const connected=compile('../components/studio/connected-services.tsx',name=>name.includes('studio-navigation')?studioNavigation:name.includes('studio-resource-lifecycle')?{isActiveOperator:()=>true}:name.endsWith('.module.css')?{__esModule:true,default:{embedded:'embedded'}}:admin);
  const shell=compile('../components/studio/dealer-assistant-shell.tsx',()=>admin);
  const page=compile('../components/studio/openclaw-page.tsx',name=>name==='./connected-services'?connected:name==='./dealer-assistant-shell'?shell:name.includes('runtime/navigation')?{useSearchParams:()=>new URLSearchParams(search)}:admin);
  return {page,connected,shell,requests,markers,
    navigate(next){search=next;},
    render(fn,props={},key=fn.name){const o=owner(key);active=o;o.cursor=0;return fn(props);},
    async settle(){for(let round=0;round<3&&queue.length;round++){const pending=queue;queue=[];for(const run of pending)run();await new Promise(setImmediate);}}};
}
const tabLinks=tree=>descendants(node(tree,item=>item.props?.['aria-label']==='OpenClaw-delar')).filter(item=>item.type==='a');
const panelOf=(tree,type)=>node(tree,item=>item.type===type);

test('the route descriptor names one System page whose five tabs replace the scattered OpenClaw routes',()=>{
  const {page}=harness();
  assert.equal(page.OPENCLAW_ROUTE.path,'/admin/openclaw');assert.equal(page.OPENCLAW_ROUTE.label,'OpenClaw');assert.equal(page.OPENCLAW_ROUTE.area,'System');
  assert.deepEqual(plain(page.OPENCLAW_ROUTE.tabs.map(tab=>[tab.id,tab.label])),[['drift','Driftläge'],['models','Agentmodeller'],['agent','Dealerns agent'],['probe','Tal vid inaktivitet'],['assistant','Adminroboten']]);
  for(const tab of page.OPENCLAW_ROUTE.tabs)assert.equal(tab.href,'/admin/openclaw?tab='+tab.id);
  assert.deepEqual(plain(page.OPENCLAW_ROUTE.tabs.flatMap(tab=>tab.formerly)),['/admin/ai/models','/admin/dealer-agent','/admin/probe','/admin/ai/chat']);
  assert.equal(page.openClawTab(null),'drift');assert.equal(page.openClawTab('unknown'),'drift');assert.equal(page.openClawTab('probe'),'probe');
  assert.ok(Object.isFrozen(page.OPENCLAW_ROUTE.tabs));
});

test('tab links keep the Studio context and explicit ambiguous room selectors without duplicating the tab key',()=>{
  const h=harness({search:'?tab=models&dealer=elin&operator=north&operator=other&table=room-a&table=room-b&room=room-c&composition=scene-a&game=roulette&token=secret'});
  const tree=h.render(h.page.OpenClawPage),links=tabLinks(tree);
  assert.deepEqual(links.map(link=>link.props.children),['Driftläge','Agentmodeller','Dealerns agent','Tal vid inaktivitet','Adminroboten']);
  assert.deepEqual(links.map(link=>link.props['aria-current']),[undefined,'page',undefined,undefined,undefined]);
  for(const [index,link] of links.entries()){
    const url=new URL(link.props.href,'https://admin.invalid');
    assert.equal(url.pathname,'/admin/openclaw');assert.deepEqual(url.searchParams.getAll('tab'),[h.page.OPENCLAW_ROUTE.tabs[index].id]);
    assert.equal(url.searchParams.get('dealer'),'elin');assert.deepEqual(url.searchParams.getAll('operator'),['north','other']);
    assert.deepEqual(url.searchParams.getAll('table'),['room-a','room-b']);assert.equal(url.searchParams.get('room'),'room-c');
    assert.equal(url.searchParams.get('composition'),'scene-a');assert.equal(url.searchParams.get('game'),'roulette');assert.equal(url.searchParams.has('token'),false);
  }
  const models=panelOf(tree,h.connected.AgentModelsPanel);
  assert.equal(new URL(models.props.navigation.chat,'https://admin.invalid').searchParams.get('tab'),'agent');
  assert.equal(new URL(models.props.navigation.assistant,'https://admin.invalid').searchParams.get('tab'),'assistant');
  assert.match(models.props.navigation.studio,/^\/admin\/clips\?/);
  assert.match(renderToStaticMarkup(node(tree,item=>item.type==='h1')),/>OpenClaw</);
});

test('the Driftläge tab is the default and mounts the native moving-drift controls on the freshly read actor',async()=>{
  const h=harness();
  const tree=h.render(h.page.OpenClawPage);
  assert.equal(tabLinks(tree)[0].props['aria-current'],'page');
  const drift=panelOf(tree,h.page.TaldriftPanel);assert.ok(drift,'default tab renders the taldrift panel');
  assert.equal(panelOf(tree,h.markers.WorkspaceTool),null);assert.equal(panelOf(tree,h.connected.AgentModelsPanel),null);
  let panel=h.render(h.page.TaldriftPanel);
  assert.ok(node(panel,item=>item.props?.role==='status'));assert.equal(panelOf(panel,h.markers.MovingDriftControls),null);
  await h.settle();
  assert.deepEqual(h.requests.map(row=>row.path),['/studio/api/auth/session']);
  const init=h.requests[0].init;assert.equal(init.credentials,'same-origin');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');assert.ok(init.signal);
  panel=h.render(h.page.TaldriftPanel);
  const controls=panelOf(panel,h.markers.MovingDriftControls);assert.ok(controls,'controls render once the session is verified');
  assert.deepEqual(plain(controls.props.expectedActor),{username:'fixture-admin',role:'admin'});
  const {options}=controls.props.client;
  assert.equal(options.apiBase,'/studio/api/admin');assert.equal(options.readIdentity,'response-headers-v1');
  assert.deepEqual(plain(options.availableActions),session().availableActions);
  // Writes preflight a fresh session, as NativeAdministration does; nothing else is contacted.
  await options.session();
  assert.deepEqual(h.requests.map(row=>row.path),['/studio/api/auth/session','/studio/api/auth/session']);
  assert.equal(node(panel,item=>item.props?.role==='alert'),null);
});

test('the Driftläge tab refuses an unverified session or action list and can retry',async()=>{
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

test('Studio tools mount one at a time while visited native panels stay mounted but hidden',async()=>{
  const h=harness({search:'?tab=agent&dealer=elin'});
  let tree=h.render(h.page.OpenClawPage);await h.settle();
  let tools=descendants(tree).filter(item=>item.type===h.markers.WorkspaceTool);
  assert.deepEqual(tools.map(tool=>tool.props.section),['dealer-agent']);
  assert.equal(panelOf(tree,h.page.TaldriftPanel),null);assert.equal(panelOf(tree,h.connected.AgentModelsPanel),null);
  h.navigate('?tab=probe&dealer=elin');tree=h.render(h.page.OpenClawPage);await h.settle();
  tools=descendants(tree).filter(item=>item.type===h.markers.WorkspaceTool);
  assert.deepEqual(tools.map(tool=>tool.props.section),['probe'],'the agent chat unmounts like leaving /admin/dealer-agent today');
  h.navigate('?tab=models&dealer=elin');tree=h.render(h.page.OpenClawPage);await h.settle();
  const wrapper=item=>item.type==='div'&&Object.hasOwn(item.props,'hidden');
  const models=panelOf(tree,h.connected.AgentModelsPanel);assert.ok(models);
  assert.equal(descendants(tree).find(item=>wrapper(item)&&node(item,inner=>inner===models)).props.hidden,false);
  assert.equal(descendants(tree).filter(item=>item.type===h.markers.WorkspaceTool).length,0);
  h.navigate('?tab=drift&dealer=elin');tree=h.render(h.page.OpenClawPage);await h.settle();
  const wrappers=descendants(tree).filter(wrapper);
  assert.deepEqual(wrappers.map(item=>item.props.hidden),[false,true],'drift visible, models kept mounted but hidden');
  assert.ok(panelOf(wrappers[0],h.page.TaldriftPanel));assert.ok(panelOf(wrappers[1],h.connected.AgentModelsPanel));
});

test('the Adminroboten tab shares the drawer card with the existing assistant route',()=>{
  const h=harness({search:'?tab=assistant'});
  const tree=h.render(h.page.OpenClawPage),card=panelOf(tree,h.shell.AdminAssistantPage);
  assert.equal(card.props.embedded,true);
  const embedded=renderToStaticMarkup(card);
  assert.match(embedded,/<h2 id="adminrobot-title">Adminroboten<\/h2>/);assert.match(embedded,/data-scout-assistant="admin"/);assert.match(embedded,/data-scout-assistant="openclaw"/);
  assert.doesNotMatch(embedded,/<h1/);
  const route=h.render(h.shell.DealerAssistantShell,{pageMode:'chat',onShowPage(){}});
  const standalone=renderToStaticMarkup(panelOf(route,h.shell.AdminAssistantPage));
  assert.match(standalone,/<h1 id="adminrobot-title">Adminroboten<\/h1>/);assert.match(standalone,/data-scout-assistant="admin"/);
  assert.equal(panelOf(h.render(h.shell.DealerAssistantShell,{pageMode:null,onShowPage(){}}),h.shell.AdminAssistantPage),null);
});
