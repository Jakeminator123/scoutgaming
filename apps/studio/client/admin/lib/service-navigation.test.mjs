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
function harness({search='',pathname='/admin/drift',data=session(),status=200}={}){
  const requests=[],owners=new Map();let active=null,queue=[];
  const owner=key=>owners.get(key)??owners.set(key,{slots:[],effects:[],cursor:0}).get(key);
  const hooks={...React,
    useState(initial){const o=active,i=o.cursor++;if(!(i in o.slots))o.slots[i]=typeof initial==='function'?initial():initial;return [o.slots[i],next=>{o.slots[i]=typeof next==='function'?next(o.slots[i]):next;}];},
    useEffect(effect,deps){const o=active,i=o.cursor++,previous=o.effects[i];if(!previous||deps.some((value,k)=>!Object.is(value,previous[k])))queue.push(()=>{o.effects[i]=deps;effect();});}};
  const markers=Object.fromEntries(['WorkspaceTool','TaldriftPanel','MovingDriftControls','OpenClawWorkspace','NativeAdministration','StudioAdministration','ConnectedEconomy','DealerImportAssistant'].map(name=>[name,marker(name)]));
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
  const navigation={usePathname:()=>pathname,useSearchParams:()=>new URLSearchParams(search)};
  const auth=compile('./admin-session.ts',()=>admin);
  const connected=compile('../components/studio/connected-services.tsx',name=>name.includes('admin-session')?auth:name.includes('runtime/navigation')?navigation:name.includes('studio-navigation')?studioNavigation:name.endsWith('.module.css')?{__esModule:true,default:{embedded:'embedded'}}:admin);
  const page=compile('../components/studio/taldrift-panel.tsx',name=>name.includes('admin-session')?auth:admin);
  return {page,connected,requests,markers,
    navigate(next,path=pathname){search=next;pathname=path;},
    render(fn,props={},key=fn.name){const o=owner(key);active=o;o.cursor=0;return fn(props);},
    async settle(){for(let round=0;round<3&&queue.length;round++){const pending=queue;queue=[];for(const run of pending)run();await new Promise(setImmediate);}}};
}
const panelOf=(tree,type)=>node(tree,item=>item.type===type);

test('Taldrift mounts native controls on the freshly read actor',async()=>{
  const h=harness();
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


test('service tabs keep visited panels mounted and ignore tab selection from other pages',async()=>{
  const h=harness({search:'?tab=speech&dealer=elin'});
  const page=h.connected.ConnectedServices({path:'/admin/drift'});
  const render=()=>h.render(page.type,page.props);
  let tree=render();await h.settle();
  const wrappers=()=>descendants(tree).filter(row=>row.type==='div'&&Object.hasOwn(row.props,'hidden'));
  assert.equal(wrappers().length,1);assert.ok(panelOf(wrappers()[0],h.markers.TaldriftPanel));
  h.navigate('?tab=status&dealer=elin');tree=render();await h.settle();
  assert.deepEqual(wrappers().map(row=>row.props.hidden),[false,true]);
  h.navigate('?tab=payments','/admin/ekonomi');tree=render();await h.settle();
  assert.deepEqual(wrappers().map(row=>row.props.hidden),[false,true]);
  h.navigate('?tab=speech','/admin/drift');tree=render();await h.settle();
  assert.deepEqual(wrappers().map(row=>row.props.hidden),[true,false]);
});

test('service navigation retains explicit ambiguous scope and excludes credentials',()=>{
  const h=harness({search:'?tab=payments&dealer=elin&operator=north&operator=other&room=one&room=two&token=secret',pathname:'/admin/ekonomi'});
  const page=h.connected.ConnectedServices({path:'/admin/ekonomi'}),tree=h.render(page.type,page.props);
  const links=descendants(tree).filter(row=>row.type==='a');
  for(const link of links){
    const url=new URL(link.props.href,'https://test.invalid');assert.equal(url.pathname,'/admin/ekonomi');
    assert.equal(url.searchParams.getAll('tab').length,1);assert.equal(url.searchParams.get('dealer'),'elin');
    assert.deepEqual(url.searchParams.getAll('operator'),['north','other']);assert.deepEqual(url.searchParams.getAll('room'),['one','two']);
    assert.equal(url.searchParams.has('token'),false);
  }
});
