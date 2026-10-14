import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {ADMIN_WORKSPACE_TOOLS,adminDocumentHref} from '../../../../lab/lib/admin-workspace-routes.mjs';
import * as adminRouting from '../../runtime/admin-routing.mjs';

const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild');
const node=(tree,predicate)=>{
  if(!tree||typeof tree!=='object')return null;
  if(Array.isArray(tree))return tree.map(child=>node(child,predicate)).find(Boolean)??null;
  return predicate(tree)?tree:node(tree.props?.children,predicate);
};
const marker=name=>Object.defineProperty(()=>null,'name',{value:name});
const components=Object.fromEntries(['ControlLanesPage','ControlActivityPage','ControlPreviewPage','ControlEventsPage','ControlTreePage','ControlProbePage','ControlRepliesPage','ControlVideosPage','ControlGuidePage','ControlLayerLibraryPage','ControlOpenClawChat','LabStudio','NativeAdministration','OpenClawWorkspace','ConnectedEconomy','ConnectedServices'].map(name=>[name,marker(name)]));

function harness(file,search='',data={project:{revision:'stored',dealers:[{id:'dragan',label:'Dragan'}]},videos:{videos:[]},status:{configured:true,provider:'neon'}}){
  const slots=[],effects=[],requests=[];let cursor=0,queue=[];
  const hooks={...React,useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next}];},
    useEffect(effect,deps){const index=cursor++;if(!effects[index]||deps.some((value,i)=>!Object.is(value,effects[index][i])))queue.push({index,effect,deps});}};
  const source=readFileSync(new URL(file,import.meta.url),'utf8'),module={exports:{}};
  runInNewContext(transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,URL,URLSearchParams,AbortController,
    location:{search},fetch:async(path,init)=>{requests.push({path,init});return {ok:true,json:async()=>data};},
    require:name=>name==='react'?hooks:name.includes('admin-workspace-routes')?{ADMIN_WORKSPACE_TOOLS}:name.includes('admin-routing')?{withAdminContext:href=>href}:name.includes('studio-navigation')?{studioNavigationContextFromQuery:()=>({})}:name.includes('lab-url')?{labUrl:path=>path}:name==='react/jsx-runtime'?require(name):components});
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

for(const [link,role] of [
  ['/control/library?tab=backgrounds','background'],['/control/library?tab=tables','table'],
  ['/admin/material-library?role=background','background'],['/admin/material-library?role=table','table'],
  ['/admin/material-library?role=table&tab=backgrounds','background'],['/admin/material-library?role=background&tab=tables','table'],
])test(`material selection survives entry or reload: ${link}`,async()=>{
  const target=new URL(adminDocumentHref(link),'https://admin.invalid');
  const h=harness('../components/studio/workspace-tools.tsx',target.search);
  h.render(h.exports.WorkspaceTool,{section:'material-library'});await h.settle();
  const library=node(h.render(h.exports.WorkspaceTool,{section:'material-library'}),item=>item.type===components.ControlLayerLibraryPage);
  assert.equal(library.props.initialRole,role);
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
