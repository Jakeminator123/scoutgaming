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
const session={username:'fixture-admin',role:'admin',availableActions:['GET players','GET users','POST users/invite','GET overview','GET shoes','GET moving-drift'],gameOrigin:'https://game.invalid'};

function harness({search='',data=session,status=200}={}){
  const slots=[],effects=[],requests=[];let cursor=0,queue=[];
  const hooks={...React,useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];},
    useEffect(effect,deps){const index=cursor++;if(!effects[index]||deps.some((value,i)=>!Object.is(value,effects[index][i])))queue.push({index,effect,deps});}};
  const markers=Object.fromEntries(['NativeAdministration','StudioAdministration','OpenClawWorkspace','ConnectedEconomy','MovingDriftControls','ConnectedServices'].map(name=>[name,marker(name)]));
  const admin={...markers,StudioAdminUiError:class extends Error{constructor(status){super('Serverstatus '+status);this.status=status;}}};
  const context={URL,URLSearchParams,AbortController,Error,location:{origin:'https://admin.invalid',search},
    fetch:async(path,init)=>{requests.push({path,init});return {ok:status>=200&&status<300,status,json:async()=>data};}};
  function compile(file,resolve){
    const module={exports:{}};
    runInNewContext(transformSync(readFileSync(new URL(file,import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
      {...context,module,exports:module.exports,require:name=>name==='react'?hooks:name==='react/jsx-runtime'?require(name):resolve(name)});
    return module.exports;
  }
  const connected=compile('../components/studio/connected-services.tsx',name=>name.includes('studio-navigation')?studioNavigation:name.includes('studio-resource-lifecycle')?{isActiveOperator:()=>true}:name.endsWith('.module.css')?{__esModule:true,default:{embedded:'embedded-theme'}}:admin);
  const pages=compile('../components/studio/accounts-pages.tsx',()=>({ConnectedServices:markers.ConnectedServices}));
  return {connected,pages,requests,markers,
    render(fn,props={}){cursor=0;return fn(props);},
    async settle(){const pending=queue;queue=[];for(const item of pending){effects[item.index]=item.deps;item.effect();}await new Promise(setImmediate);}};
}
// ConnectedServices has no hooks of its own; the inner Administration owns the slots.
async function administration(h,props){const entry=h.connected.ConnectedServices(props);h.render(entry.type,entry.props);await h.settle();return h.render(entry.type,entry.props);}

test('both account pages describe their routes and read the one accounts document through the native reader',()=>{
  const h=harness();
  assert.deepEqual([h.pages.PLAYER_ACCOUNTS_ROUTE.path,h.pages.PLAYER_ACCOUNTS_ROUTE.label,h.pages.PLAYER_ACCOUNTS_ROUTE.area,h.pages.PLAYER_ACCOUNTS_ROUTE.section],['/admin/players','Spelarkonton','Verksamhet','players']);
  assert.deepEqual([h.pages.ADMIN_STAFF_ROUTE.path,h.pages.ADMIN_STAFF_ROUTE.label,h.pages.ADMIN_STAFF_ROUTE.area,h.pages.ADMIN_STAFF_ROUTE.section],['/admin/admin/accounts','Konton & åtkomst','System','users']);
  for(const [Page,route,other] of [[h.pages.PlayerAccountsPage,h.pages.PLAYER_ACCOUNTS_ROUTE,h.pages.ADMIN_STAFF_ROUTE],[h.pages.AdminStaffPage,h.pages.ADMIN_STAFF_ROUTE,h.pages.PLAYER_ACCOUNTS_ROUTE]]){
    // The exported page is a thin wrapper around the shared AccountsPage body.
    const outer=h.render(Page),tree=outer.type(outer.props),service=node(tree,item=>item.type===h.markers.ConnectedServices);
    assert.deepEqual(plain(service.props),{path:'/admin/admin/accounts',...(route.section?{section:route.section}:{})});
    const markup=renderToStaticMarkup(tree);
    assert.match(markup,new RegExp('<h1 id="'+route.section+'-accounts-title">'+route.label.replace('&','&amp;')+'</h1>'));
    assert.match(markup,new RegExp('<p class="sg-eyebrow">'+route.area+'</p>'));
    const links=descendants(tree).filter(item=>item.type==='a');
    assert.deepEqual(links.map(link=>[link.props.href,link.props.children]),[[other.path,other.label]]);
  }
});

test('the section prop selects one part of the accounts document without a second reader or request',async()=>{
  for(const section of ['players','users',undefined]){
    const h=harness();
    const tree=await administration(h,{path:'/admin/admin/accounts',section});
    assert.equal(tree.props['data-admin-view'],section);
    const native=node(tree,item=>item.type===h.markers.NativeAdministration);
    assert.equal(native.props.initialGroup,'accounts');assert.equal(native.props.apiBase,'/studio/api/admin');assert.equal(native.props.embedded,true);
    assert.deepEqual(plain(native.props.availableActions),session.availableActions);
    assert.deepEqual(h.requests.map(row=>row.path),['/studio/api/auth/session']);
    assert.equal(h.requests[0].init.credentials,'same-origin');
  }
  // Other groups never carry an accounts view.
  const h=harness();
  const payments=await administration(h,{path:'/admin/admin/payments',section:'players'});
  assert.equal(payments.props['data-admin-view'],undefined);
  assert.equal(node(payments,item=>item.type===h.markers.NativeAdministration).props.initialGroup,'finance');
});

test('Drift keeps game status, shoe proof and integrity through the native reader and sends taldrift to OpenClaw',async()=>{
  const h=harness();
  const tree=await administration(h,{path:'/admin/drift'});
  const reader=node(tree,item=>item.type===h.markers.StudioAdministration);
  assert.ok(reader,'the native StudioAdministration reader renders the operations group');
  assert.equal(reader.props.initialGroup,'operations');assert.equal(reader.props.apiBase,'/studio/api/admin');
  assert.equal(reader.props.readIdentity,'response-headers-v1');assert.equal(reader.props.showGroupNavigation,false);
  assert.equal(reader.props.roomsHref,'/admin/rooms');assert.equal(reader.props.companyTeamLabel,'Bolag & team');
  assert.deepEqual(plain(reader.props.availableActions),session.availableActions);assert.equal(reader.props.gameOrigin,'https://game.invalid');
  assert.equal(reader.props.renderOperations,undefined,'the taldrift controls no longer render on Drift');
  assert.equal(node(tree,item=>item.type===h.markers.NativeAdministration),null);
  assert.equal(node(tree,item=>item.type===h.markers.MovingDriftControls),null);
  assert.equal(node(tree,item=>item.props?.className==='embedded-theme')?.type,'div','the native embedded theme wraps the reader');
  const link=node(tree,item=>item.type==='a');
  assert.equal(link.props.href,'/admin/openclaw?tab=drift');
  // The reader's write preflight reads a fresh session with the native options.
  assert.deepEqual(h.requests.map(row=>row.path),['/studio/api/auth/session']);
  await reader.props.session();
  assert.equal(h.requests.length,2);assert.equal(h.requests[1].init.cache,'no-store');assert.equal(h.requests[1].init.redirect,'error');
});

test('a denied or unverifiable session blocks Drift exactly as before',async()=>{
  for(const [options,expected] of [[{status:401},/Din N1-session saknas/],[{status:503},/Administrationen kunde inte nås/],[{data:{availableActions:'GET overview'}},/kunde inte verifieras/]]){
    const h=harness(options);
    const tree=await administration(h,{path:'/admin/drift'});
    assert.ok(node(tree,item=>item.props?.role==='alert'));assert.match(renderToStaticMarkup(tree),expected);
    assert.equal(node(tree,item=>item.type===h.markers.StudioAdministration),null);
  }
});
