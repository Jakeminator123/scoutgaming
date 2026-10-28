import test from 'node:test';
import assert from 'node:assert/strict';
import * as adminNavigation from './admin-navigation.ts';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as adminWorkspaceRoutes from '../../../../../packages/navigation/admin-workspace-routes.mjs';
import {isActiveOperator} from './studio-resource-lifecycle.mjs';

const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild');
const node=(tree,predicate)=>{
  if(!tree||typeof tree!=='object')return null;
  if(Array.isArray(tree))return tree.map(child=>node(child,predicate)).find(Boolean)??null;
  return predicate(tree)?tree:node(tree.props?.children,predicate);
};
const marker=name=>Object.defineProperty(()=>null,'name',{value:name});
const components=Object.fromEntries(['AdminPublicationPage','ControlRepliesPage','ControlOpenClawChat','NativeAdministration','OpenClawWorkspace','ConnectedEconomy','ConnectedServices'].map(name=>[name,marker(name)]));

function harness(file,search='',data={project:{revision:'stored',dealers:[{id:'dragan',label:'Dragan'}]},videos:{videos:[]},status:{configured:true,provider:'neon'}},responseStatus=200){
  const slots=[],effects=[],requests=[];let cursor=0,queue=[];
  const hooks={...React,useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next}];},
    useEffect(effect,deps){const index=cursor++;if(!effects[index]||deps.some((value,i)=>!Object.is(value,effects[index][i])))queue.push({index,effect,deps});}};
  const source=readFileSync(new URL(file,import.meta.url),'utf8'),module={exports:{}};
  runInNewContext(transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,URL,URLSearchParams,AbortController,Error,
    location:{search},fetch:async(path,init)=>{requests.push({path,init});const value=typeof data==='function'?await data(path,init):data;return {ok:responseStatus>=200&&responseStatus<300,status:responseStatus,json:async()=>value};},
    require:name=>name==='react'?hooks:name.includes('studio-resource-lifecycle')?{isActiveOperator}:name.includes('admin-workspace-routes')?adminWorkspaceRoutes:name.includes('admin-navigation')?adminNavigation:name.includes('admin-routing')?{withAdminContext:href=>href}:name.includes('studio-navigation')?{studioNavigationContextFromQuery:()=>({})}:name.includes('lab-url')?{labUrl:path=>path}:name==='react/jsx-runtime'?require(name):components});
  return {exports:module.exports,requests,render(fn,props){cursor=0;return fn(props);},async settle(){const pending=queue;queue=[];for(const item of pending){effects[item.index]=item.deps;item.effect();}await new Promise(setImmediate);}};
}

// System › Integration mounts Administration with group "partners"; the old /admin/admin/api page resolves there.
test('Integrationer opens the real NativeAdministration with the server-read actions',async()=>{
  const service=harness('../components/studio/connected-services.tsx','',{availableActions:['GET apikeys','POST apikeys/create'],gameOrigin:'https://game.invalid'});
  assert.equal(adminWorkspaceRoutes.adminDocumentHref('/admin/admin/api'),'/admin/system?flik=integration');
  assert.equal(service.exports.ConnectedServices,undefined,'the separate service pages are gone');
  const props={group:'partners'};
  assert.equal(node(service.render(service.exports.Administration,props),item=>item.type===components.NativeAdministration),null,'nothing native mounts before the session is read');
  await service.settle();
  const native=node(service.render(service.exports.Administration,props),item=>item.type===components.NativeAdministration);
  assert.equal(native.props.initialGroup,'partners');assert.equal(Object.hasOwn(native.props,'initialDealerId'),false);
  assert.equal(native.props.sections,undefined,'integration is not limited to an accounts section');
  assert.deepEqual(native.props.availableActions,['GET apikeys','POST apikeys/create']);
  assert.equal(native.props.apiBase,'/studio/api/admin');
  assert.equal(service.requests[0].path,'/studio/api/auth/session');assert.equal(service.requests[0].init.credentials,'same-origin');
  // There are no separate tool pages any more; the retired speech review resolves to the dealers.
  assert.deepEqual(Object.keys(adminWorkspaceRoutes.ADMIN_WORKSPACE_TOOLS),[]);
  assert.equal(adminWorkspaceRoutes.adminToolName('/admin/media-review'),null);
  assert.equal(adminWorkspaceRoutes.adminDocumentHref('/admin/media-review'),'/admin/dealers');
});
