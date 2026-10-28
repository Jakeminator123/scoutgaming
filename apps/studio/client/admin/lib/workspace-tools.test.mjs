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
const components=Object.fromEntries(['AdminPublicationPage','ControlActivityPage','ControlPreviewPage','ControlEventsPage','ControlTreePage','ControlProbePage','ControlRepliesPage','ControlVideosPage','ControlGuidePage','ControlOpenClawChat','LabStudio','NativeAdministration','OpenClawWorkspace','ConnectedEconomy','ConnectedServices'].map(name=>[name,marker(name)]));

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
