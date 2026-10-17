import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {ADMIN_WORKSPACE_TOOLS} from '../../../../../packages/navigation/admin-workspace-routes.mjs';
import * as adminRouting from '../../runtime/admin-routing.mjs';
import {isActiveOperator} from './studio-resource-lifecycle.mjs';

const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild');
const node=(tree,predicate)=>{
  if(!tree||typeof tree!=='object')return null;
  if(Array.isArray(tree))return tree.map(child=>node(child,predicate)).find(Boolean)??null;
  return predicate(tree)?tree:node(tree.props?.children,predicate);
};
const marker=name=>Object.defineProperty(()=>null,'name',{value:name});
const components=Object.fromEntries(['ControlLanesPage','ControlActivityPage','ControlPreviewPage','ControlEventsPage','ControlTreePage','ControlProbePage','ControlRepliesPage','ControlVideosPage','ControlGuidePage','ControlOpenClawChat','LabStudio','NativeAdministration','OpenClawWorkspace','ConnectedEconomy','ConnectedServices'].map(name=>[name,marker(name)]));

function harness(file,search='',data={project:{revision:'stored',dealers:[{id:'dragan',label:'Dragan'}]},videos:{videos:[]},status:{configured:true,provider:'neon'}},responseStatus=200){
  const slots=[],effects=[],requests=[];let cursor=0,queue=[];
  const hooks={...React,useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next}];},
    useEffect(effect,deps){const index=cursor++;if(!effects[index]||deps.some((value,i)=>!Object.is(value,effects[index][i])))queue.push({index,effect,deps});}};
  const source=readFileSync(new URL(file,import.meta.url),'utf8'),module={exports:{}};
  runInNewContext(transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,URL,URLSearchParams,AbortController,Error,
    location:{search},fetch:async(path,init)=>{requests.push({path,init});const value=typeof data==='function'?await data(path,init):data;return {ok:responseStatus>=200&&responseStatus<300,status:responseStatus,json:async()=>value};},
    require:name=>name==='react'?hooks:name.includes('studio-resource-lifecycle')?{isActiveOperator}:name.includes('admin-workspace-routes')?{ADMIN_WORKSPACE_TOOLS}:name.includes('admin-routing')?{withAdminContext:href=>href}:name.includes('studio-navigation')?{studioNavigationContextFromQuery:()=>({})}:name.includes('lab-url')?{labUrl:path=>path}:name==='react/jsx-runtime'?require(name):components});
  return {exports:module.exports,requests,render(fn,props){cursor=0;return fn(props);},async settle(){const pending=queue;queue=[];for(const item of pending){effects[item.index]=item.deps;item.effect();}await new Promise(setImmediate);}};
}

test('Admin speech review opens the real NativeAdministration review with the selected dealer',async()=>{
  const h=harness('../components/studio/workspace-tools.tsx','?dealer=dragan&tab=media-review');
  h.render(h.exports.WorkspaceTool,{section:'media-review'});await h.settle();
  const review=node(h.render(h.exports.WorkspaceTool,{section:'media-review'}),item=>item.type===components.ConnectedServices);
  assert.ok(review,'speech review must render the connected administration service');
  const service=harness('../components/studio/connected-services.tsx','',{availableActions:['GET config','GET voicelines','POST voiceline-review'],gameOrigin:'https://game.invalid'});
  const administration=service.exports.ConnectedServices(review.props);
  assert.equal(typeof administration.type,'function');
  service.render(administration.type,administration.props);await service.settle();
  const native=node(service.render(administration.type,administration.props),item=>item.type===components.NativeAdministration);
  assert.equal(native.props.initialGroup,'media-review');assert.equal(native.props.initialDealerId,'dragan');
  assert.deepEqual(native.props.availableActions,['GET config','GET voicelines','POST voiceline-review']);
  assert.equal(native.props.apiBase,'/studio/api/admin');
  assert.equal(service.requests[0].path,'/studio/api/auth/session');assert.equal(service.requests[0].init.credentials,'same-origin');
});

function shell(file,path){
  let mounted;
  const module={exports:{}},navigation={__esModule:true,default:'a',usePathname:()=>path,useSearchParams:()=>new URLSearchParams()};
  const hooks={...React,useEffect(){},useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useCallback:fn=>fn};
  const placeholders=new Proxy({},{get:(_,name)=>name==='__esModule'?false:marker(String(name))});
  runInNewContext(transformSync(readFileSync(new URL(file,import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{
    module,exports:module.exports,URL,URLSearchParams,document:{getElementById:()=>({}),querySelector:()=>null},
    location:{origin:'https://admin.invalid',search:''},
    require:name=>name==='react'?hooks:name==='react/jsx-runtime'?require(name)
      :name==='react-dom/client'?{createRoot:()=>({render:element=>{mounted=element;}})}
      :name==='next/link'||name==='next/navigation'||name==='../runtime/navigation'?navigation
      :name.includes('admin-workspace-routes')?{ADMIN_WORKSPACE_TOOLS}:name.includes('admin-routing')?adminRouting:placeholders,
  });
  return mounted?mounted.type(mounted.props):module.exports.StudioSidebar();
}
function descendants(tree){
  if(Array.isArray(tree))return tree.flatMap(descendants);
  return tree&&typeof tree==='object'?[tree,...descendants(tree.props?.children)]:[];
}

test('each workspace tool has one active main menu entry and companies remains reachable',()=>{
  for(const key of Object.keys(ADMIN_WORKSPACE_TOOLS)){
    const tree=shell('../components/studio/studio-sidebar.tsx','/admin/'+key);
    const menu=node(tree,item=>item.props?.['aria-label']==='Huvudmeny');
    const active=descendants(menu).filter(item=>item.props?.['aria-current']==='page');
    assert.equal(active.length,1,key);
    assert.equal(active[0].props.href,'/admin/tools',key);
  }
  const tools=harness('../components/studio/workspace-tools.tsx');
  assert.ok(node(tools.exports.WorkspaceToolsHome(),item=>item.props?.href==='/admin/companies'));
});

test('Admin portal navigation opens the three current product entry points',()=>{
  for(const path of ['/admin','/admin/clips','/admin/companies']){
    const tree=shell('../entry.tsx',path),portal=node(tree,item=>item.props?.['aria-label']==='Portaler');
    const links=descendants(portal).filter(item=>item.type==='a');
    assert.deepEqual(links.map(item=>item.props.href),['/admin','/partner','/lobby']);
    assert.equal(links[0].props['aria-current'],'page');
  }
});

for(const [query,room] of [
  ['?operator=north&room=room-evening&table=other','room-evening'],
  ['?operator=north&table=room-evening','room-evening'],
  ['?operator=north&room=&table=other',''],
  ['?operator=north&room=one&room=two',['one','two']],
  ['?operator=north&tableAsset=design-table',undefined],
])test(`Admin publication passes an explicit room selection without confusing design assets: ${query}`,async()=>{
  const h=harness('../components/studio/workspace-tools.tsx',query);
  h.render(h.exports.WorkspaceTool,{section:'publication'});await h.settle();
  const publication=node(h.render(h.exports.WorkspaceTool,{section:'publication'}),item=>item.type===components.ControlLanesPage);
  assert.deepEqual(publication.props.initialRoomId,room);
});

function publicationWorkspaceHarness(search) {
  const {createEmptyProject,addDealer,defaultPresentationLane}=require('../../../../../packages/presentation/contracts/studio-model.mjs');
  const project=addDealer(createEmptyProject(),'nora','Nora');
  const first=defaultPresentationLane('nora');project.lanes=[first,{...structuredClone(first),id:'evening',label:'Kväll'}];
  const operator={id:'north',slug:'north',name:'North',status:'active',publishedPackage:{revision:4,lanes:project.lanes.map(row=>row.id)}};
  const data={project,videos:{videos:[]},status:{configured:true},operators:[operator],storeAvailable:true,directory:null};
  let url=new URL('/admin/publication'+search,'https://workspace.invalid'),active,rootTree,lanesTree;
  const location={get pathname(){return url.pathname;},get search(){return url.search;},get hash(){return url.hash;},get href(){return url.href;},origin:url.origin};
  const history={state:{external:'preserved'},replaceState(state,unused,href){this.state=state;if(href!==undefined)url=new URL(href,url);}};
  const window={location,history,confirm:()=>false,addEventListener(){},removeEventListener(){}};
  // A child update must not refresh the parent link unless the component notifies it.
  const root={slots:[],effects:[],pending:true},child={slots:[],effects:[],pending:false};
  const hooks={...React,useState(initial){const owner=active,index=owner.cursor++;
    if(!(index in owner.slots))owner.slots[index]=typeof initial==='function'?initial():initial;
    return [owner.slots[index],next=>{owner.slots[index]=typeof next==='function'?next(owner.slots[index]):next;owner.pending=true;}];},
    useRef(initial){const owner=active,index=owner.cursor++;return owner.slots[index]??={current:initial};},
    useEffect(effect,deps){const owner=active,index=owner.cursor++,previous=owner.slots[index];
      if(!previous||deps.some((value,i)=>!Object.is(value,previous.deps[i])))owner.effects.push(()=>{previous?.cleanup?.();owner.slots[index]={deps,cleanup:effect()};});}};
  const Room=marker('PresentationRoomCreate'),Lifecycle=marker('ControlResourceLifecycle');
  function compile(file,resolve) {
    const url=new URL(file,import.meta.url),module={exports:{}},localRequire=createRequire(url);
    const source=transformSync(readFileSync(url,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
    runInNewContext(source,{module,exports:module.exports,window,location,URL,URLSearchParams,AbortController,structuredClone,
      fetch:async()=>({ok:true,json:async()=>data}),require:name=>name==='react'?hooks:resolve(name)??localRequire(name)});
    return module.exports;
  }
  const {ControlLanesPage}=compile('../../../components/control-lanes-page.tsx',name=>{
    if(name.endsWith('.module.css'))return {__esModule:true,default:{}};
    if(name==='./studio-session')return {useStudioProjectSession:()=>({project,dirty:false,saving:false,conflict:false,savedJson:JSON.stringify(project)})};
    if(name==='./presentation-room-create')return {PresentationRoomCreate:Room};
    if(name==='./control-resource-lifecycle')return {ControlResourceLifecycle:Lifecycle};
    if(name==='./control-operator-directory')return {ControlOperatorDirectory:marker('ControlOperatorDirectory')};
    if(name==='./page-template')return {PageTemplate:marker('PageTemplate')};
    if(name==='./project-conflict')return {ProjectConflict:marker('ProjectConflict')};
  });
  const {WorkspaceTool}=compile('../components/studio/workspace-tools.tsx',name=>{
    if(name.includes('control-lanes-page'))return {ControlLanesPage};
    if(name.includes('admin-workspace-routes'))return {ADMIN_WORKSPACE_TOOLS};
    if(name.includes('admin-routing'))return adminRouting;
    if(name.includes('studio-navigation'))return {studioNavigationContextFromQuery:()=>({})};
    if(name.includes('lab-url'))return {labUrl:path=>path};
    if(name!=='react/jsx-runtime')return components;
  });
  return {window,history,
    snapshot:{administrationRevision:'admin-1',operators:[{...operator,packageRevision:4,lanes:operator.publishedPackage.lanes,archivedAt:null}],
      rooms:[{id:'room-evening',operatorId:'north',name:'Kvällsrummet',presentationLaneId:'evening',state:'live',published:true,archivedAt:null}]},
    async settle(){for(let i=0;i<6;i++){
      if(root.pending){root.pending=false;root.cursor=0;active=root;rootTree=WorkspaceTool({section:'publication'});child.pending=true;}
      const lanes=node(rootTree,item=>item.type===ControlLanesPage);
      if(lanes&&child.pending){child.pending=false;child.cursor=0;active=child;lanesTree=ControlLanesPage(lanes.props);}
      for(const owner of [root,child])while(owner.effects.length)owner.effects.shift()();
      await new Promise(setImmediate);
    }},
    clipHref:()=>node(rootTree,item=>item.type==='a'&&item.props.children==='Klippkarta').props.href,
    lifecycle:()=>node(lanesTree,item=>item.type===Lifecycle),
    composition:()=>node(lanesTree,item=>item.type==='select'&&item.props.value!=='north'),
  };
}

test('verified room seeding immediately updates the real WorkspaceTool clip-map link and history context',async()=>{
  const h=publicationWorkspaceHarness('?operator=north&room=room-evening&table=outdated-room&composition=mobile-phone&tableAsset=design-table#review');
  await h.settle();h.lifecycle().props.onChanged(h.snapshot);await h.settle();
  assert.equal(h.clipHref(),'/admin/clips?operator=north&table=room-evening&composition=evening');
  const query=new URLSearchParams(h.window.location.search);
  assert.equal(query.get('composition'),'evening');assert.equal(query.get('table'),'room-evening');
  assert.equal(query.get('room'),'room-evening');assert.equal(query.get('tableAsset'),'design-table');
  assert.equal(h.window.location.hash,'#review');assert.equal(h.history.state.external,'preserved');
  assert.equal(h.history.state.__scoutAdminHistory.href,h.window.location.pathname+h.window.location.search+h.window.location.hash);
  h.composition().props.onChange({target:{value:'mobile-phone'}});await h.settle();
  assert.equal(h.clipHref(),'/admin/clips?operator=north&composition=mobile-phone');
  assert.equal(new URLSearchParams(h.window.location.search).has('room'),false);
});

for(const query of ['room=missing','room=room-evening&room=room-evening'])test('unavailable room context is never normalized into table: '+query,async()=>{
  const search='?operator=north&'+query+'&composition=mobile-phone&tableAsset=design-table';
  const h=publicationWorkspaceHarness(search);await h.settle();h.lifecycle().props.onChanged(h.snapshot);await h.settle();
  assert.equal(h.window.location.search,search);assert.equal(new URLSearchParams(h.window.location.search).has('table'),false);
  assert.equal(h.history.state.__scoutAdminHistory,undefined);
});

const journalTree=h=>{const entry=h.exports.ConnectedServices({path:'/admin/admin/log'});return h.render(entry.type,entry.props);};
const journalMarkup=h=>require('react-dom/server').renderToStaticMarkup(journalTree(h));

test('company journal reads only its catalogue, uses exact slugs and excludes archived or suspended companies',async()=>{
  const operator={id:'internal-id',name:'Visningsnamn med mellanslag',slug:'actual-company',status:'active',archivedAt:null};
  const data={source:'registered',administration:{operators:[operator,
    {...operator,id:'archived',name:'Arkiverat bolag',slug:'archived-company',archivedAt:'2026-10-17'},
    {...operator,id:'suspended',name:'Avstängt bolag',slug:'suspended-company',status:'suspended'},
    {...operator,id:'missing-slug',name:'Bolag utan adress',slug:''},
    {...operator,id:'invalid-slug',name:'Felaktig adress',slug:'../other'},
  ]}};
  const h=harness('../components/studio/connected-services.tsx','',path=>{assert.equal(path,'/admin/_data/catalog','journal must not read project or videos');return data;});
  assert.match(journalMarkup(h),/Läser registrerade bolag/);await h.settle();
  const view=journalTree(h),links=descendants(view).filter(row=>row.type==='a');
  assert.deepEqual(links.map(row=>row.props.href),['/partner/actual-company/team?scope=company']);
  const markup=journalMarkup(h);
  assert.match(markup,/Bolagsjournal/);assert.match(markup,/Visningsnamn med mellanslag/);assert.match(markup,/Visa journal/);
  assert.match(markup,/Gemensam historik för hela Admin finns ännu inte/);
  assert.match(markup,/Bolag utan adress/);assert.match(markup,/adress saknas eller är ogiltig/);
  assert.doesNotMatch(markup,/Arkiverat bolag|Avstängt bolag/);assert.equal(h.requests.length,1);assert.equal(h.requests[0].path,'/admin/_data/catalog');
  assert.equal(h.requests[0].init.method,'GET');assert.equal(h.requests[0].init.credentials,'same-origin');assert.equal(h.requests[0].init.cache,'no-store');assert.equal(h.requests[0].init.redirect,'error');assert.ok(h.requests[0].init.signal);
});

test('company journal has an honest empty state without fabricated company links',async()=>{
  const h=harness('../components/studio/connected-services.tsx','',{source:'registered',administration:{operators:[]}});
  journalTree(h);await h.settle();assert.match(journalMarkup(h),/Inga aktiva registrerade bolag/);
  assert.equal(descendants(journalTree(h)).filter(row=>row.type==='a').length,0);
});

test('company journal rejects unavailable or unregistered catalogues and can retry',async()=>{
  for(const failure of ['unavailable','unregistered']){
    let retry=false;
    const h=harness('../components/studio/connected-services.tsx','',()=>{
      if(!retry&&failure==='unavailable')throw Error('Katalogen kunde inte läsas');
      return {source:retry?'registered':'fixture',administration:{operators:[]}};
    });
    journalTree(h);await h.settle();
    const alert=node(journalTree(h),row=>row.props?.role==='alert');assert.ok(alert,failure);
    assert.doesNotMatch(journalMarkup(h),/Inga aktiva registrerade bolag/);assert.equal(descendants(journalTree(h)).filter(row=>row.type==='a').length,0);
    retry=true;node(alert,row=>row.type==='button').props.onClick();journalTree(h);await h.settle();
    assert.match(journalMarkup(h),/Inga aktiva registrerade bolag/);assert.equal(node(journalTree(h),row=>row.props?.role==='alert'),null);
  }
});

for(const status of [401,403,503])test('company journal presents catalogue HTTP '+status+' without an empty or stale directory',async()=>{
  const h=harness('../components/studio/connected-services.tsx','',{source:'registered',administration:{operators:[]}},status);
  journalTree(h);await h.settle();assert.ok(node(journalTree(h),row=>row.props?.role==='alert'));
  assert.match(journalMarkup(h),status===503?/Bolagsregistret kunde inte läsas/:/N1-behörigheten saknas eller har gått ut/);
  assert.doesNotMatch(journalMarkup(h),/Inga aktiva registrerade bolag/);assert.deepEqual(h.requests.map(row=>row.path),['/admin/_data/catalog']);
});

test('company journal rejects incomplete operator projections instead of fabricating an empty list',async()=>{
  for(const operators of [null,[null],[{id:'company',name:'Bolag',slug:'company',status:'active'}]]){
    const h=harness('../components/studio/connected-services.tsx','',{source:'registered',administration:{operators}});
    journalTree(h);await h.settle();assert.match(journalMarkup(h),/Bolagsregistret kunde inte verifieras/);
    assert.equal(descendants(journalTree(h)).filter(row=>row.type==='a').length,0);
  }
});
