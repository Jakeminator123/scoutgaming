import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {STANDARD_OPERATOR_ROLES} from '../../lib/operator-admin-api.mjs';

const require=createRequire(import.meta.url),{transformSync}=require('esbuild');
const roles=STANDARD_OPERATOR_ROLES.map(role=>({...role,permissions:[...role.permissions]}));
const north={id:'north-id',slug:'north',name:'North',status:'active',roles,missingRoles:[],members:[{userId:'42',username:'north-admin',roleId:'partner-admin',status:'active',revision:7}]};
const south={id:'south-id',slug:'south',name:'South',status:'active',roles,missingRoles:[],members:[]};
const payload=operator=>({source:'registered',operator,standardRoles:roles});
const all=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(child=>all(child,predicate))];

function harness(kind='team',initial={}) {
  const slots=[],effects=new Map(),queued=new Map(),requests=[],events=new Map(),created=[],identities=[],busy=[];
  let cursor=0,props={operatorId:north.id,onIdentity:(id,company)=>identities.push([id,company]),onCreated:company=>created.push(company),onBusyChange:value=>busy.push(value),...initial};
  const window={location:new URL('https://studio.invalid/admin/companies/north-id?flik=team&operator=south-id'),confirm:()=>true,
    addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},removeEventListener:(name,fn)=>events.get(name)?.delete(fn)};
  const hooks={...React,
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useRef(initial){return slots[cursor++]??={current:initial};},
    useEffect(effect,deps){const i=cursor++,previous=effects.get(i);if(!previous||deps.some((value,j)=>!Object.is(value,previous.deps[j])))queued.set(i,{effect,deps});},
  };
  const modules=new Map();
  function load(name) {
    if(modules.has(name))return modules.get(name);
    const url=new URL('../../components/'+name,import.meta.url),module={exports:{}};
    runInNewContext(transformSync(readFileSync(url,'utf8'),{loader:name.endsWith('tsx')?'tsx':'ts',format:'cjs',jsx:'automatic'}).code,{
      module,exports:module.exports,URL,URLSearchParams,AbortController,window,
      fetch:(path,options)=>new Promise(resolve=>requests.push({path,options,resolve})),
      require:name=>name==='react'?hooks:name.endsWith('.module.css')?{default:new Proxy({},{get:(_,key)=>key}),__esModule:true}
        :name==='./company-form'?load('company-form.ts'):name.includes('lab-url')?{labUrl:path=>'/studio'+path}
        :name.includes('partner-journal')?{PartnerJournal:props=>React.createElement('aside',{'data-journal':props.operatorId,'data-slug':props.operatorSlug})}:require(name),
    });modules.set(name,module.exports);return module.exports;
  }
  const View=load(kind==='team'?'company-team.tsx':'company-create.tsx')[kind==='team'?'CompanyTeam':'CompanyCreate'];
  const render=(next={})=>{props={...props,...next};cursor=0;const tree=View(props);for(const [i,item]of queued){effects.get(i)?.cleanup?.();effects.set(i,{deps:item.deps,cleanup:item.effect()});}queued.clear();return tree;};
  const nodes=predicate=>all(render(),predicate);
  const h={render,nodes,requests,created,identities,busy,window,
    html:()=>renderToStaticMarkup(render()),input:()=>nodes(node=>node.type==='input'&&node.props.placeholder==='namn@bolag.se')[0],
    button:text=>nodes(node=>node.type==='button').find(node=>renderToStaticMarkup(node).includes(text)),
    submit:()=>nodes(node=>node.type==='form')[0].props.onSubmit({preventDefault(){}}),
    field:(label,value)=>{const field=nodes(node=>node.type==='label').find(node=>node.props.children?.[0]===label);all(field,node=>node.type==='input')[0].props.onChange({target:{value}});},
    async reply(index,body,status=200){assert.ok(requests[index],`request ${index} exists`);requests[index].resolve(Response.json(body,{status}));await new Promise(setImmediate);render();},
    navigate(href){const event={detail:{href},defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};for(const listener of events.get('scout:navigate')??[])listener(event);return !event.defaultPrevented;},
    unmount(){for(const effect of effects.values())effect.cleanup?.();effects.clear();},
  };
  render();return h;
}

test('create is independent of reads, keeps an editable slug and navigates with the returned id',async()=>{
  const h=harness('create');assert.equal(h.requests.length,0);
  h.field('Bolagsnamn','Åland Spel');h.field('Adressnamn','aland');h.field('Bolagsnamn','Åland Casino');
  assert.match(h.html(),/value="aland"/);h.submit();h.submit();assert.equal(h.requests.length,1);
  assert.deepEqual(JSON.parse(h.requests[0].options.body),{name:'Åland Casino',slug:'aland'});
  assert.equal(h.requests[0].path,'/studio/api/admin/operator-create');assert.equal(h.requests[0].options.credentials,'same-origin');
  assert.equal(h.navigate('/admin/companies'),false,'pending write blocks navigation immediately');
  await h.reply(0,{operator:{...north,id:'generated-id',slug:'aland',name:'Åland Casino'}});
  assert.equal(h.created.length,1);assert.equal(h.created[0].id,'generated-id');assert.equal(h.navigate('/admin/companies/generated-id?flik=team'),true);
  assert.deepEqual(h.busy,[true,false]);assert.doesNotMatch(h.html(),/value="aland"/);
});
test('create keeps drafts after 403 and 409, confirms leaving and rejects foreign or late receipts',async()=>{
  const h=harness('create');h.field('Bolagsnamn','North');h.render();h.window.confirm=()=>false;
  assert.equal(h.navigate('/admin/companies'),false);
  h.submit();await h.reply(0,{},403);assert.match(h.html(),/Åtkomst nekad/);assert.match(h.html(),/value="North"/);
  h.submit();await h.reply(1,{},409);assert.match(h.html(),/redan ett bolag/);assert.equal(h.created.length,0);
  h.submit();await h.reply(2,{operator:south});assert.equal(h.created.length,0);assert.match(h.html(),/kunde inte bekräftas/);
  h.submit();h.unmount();h.requests[3].resolve(Response.json({operator:north}));await new Promise(setImmediate);assert.equal(h.created.length,0);
});
test('team selection is route-controlled, retains per-company drafts and writes the canonical id',async()=>{
  const h=harness('team',{operatorId:north.slug});await h.reply(0,payload(north));
  assert.equal(h.requests[0].path,'/studio/api/admin/workspace/company-team?operator=north');
  assert.doesNotMatch(h.html(),/Välj bolag|Sök bolag|Skapa bolag/);
  h.input().props.onChange({target:{value:'north@example.invalid'}});
  assert.equal(h.navigate('/admin/companies/south-id?flik=team'),true);
  h.render({operatorId:south.id});assert.equal(h.input(),undefined);await h.reply(1,payload(south));assert.equal(h.input().props.value,'');
  h.render({operatorId:north.slug});await h.reply(2,payload(north));assert.equal(h.input().props.value,'north@example.invalid');
  assert.match(h.html(),/data-journal="north-id" data-slug="north"/);h.submit();h.submit();assert.equal(h.requests.length,4);
  assert.deepEqual(JSON.parse(h.requests[3].options.body),{operatorId:north.id,email:'north@example.invalid',status:'invited',roleId:'partner-viewer'});
  await h.reply(3,{operator:north});assert.equal(h.input().props.value,'');
});
test('late reads cannot replace a later visit, including A to B to A',async()=>{
  const h=harness();h.render({operatorId:south.id});h.render({operatorId:north.id});
  assert.equal(h.requests[0].options.signal.aborted,true);assert.equal(h.requests[1].options.signal.aborted,true);
  await h.reply(2,payload({...north,name:'Current North'}));await h.reply(0,payload({...north,name:'Old North'}));await h.reply(1,payload(south));
  assert.match(h.html(),/Current North/);assert.doesNotMatch(h.html(),/Old North|South/);assert.equal(h.identities.length,1);
});
test('failed or foreign reads expose no other team and reload without project or video',async()=>{
  const h=harness();await h.reply(0,payload(south));assert.match(h.html(),/kunde inte bekräftas/);assert.equal(h.input(),undefined);assert.equal(h.identities.length,0);
  h.button('Läs in teamet igen').props.onClick();h.render();await h.reply(1,{},403);assert.match(h.html(),/Åtkomst nekad/);
  h.button('Läs in teamet igen').props.onClick();h.render();await h.reply(2,payload(north));assert.equal(h.input().props.value,'');
  assert.equal(h.requests.every(request=>request.path.includes('/workspace/company-team?operator=north-id')),true);
  for(const invalid of [null,payload({...north,members:[null]})]){
    const malformed=harness();await malformed.reply(0,invalid);assert.match(malformed.html(),/kunde inte bekräftas/);assert.equal(malformed.input(),undefined);
  }
});
test('403, 409 and foreign mutation receipts preserve drafts and require a fresh team read',async()=>{
  for(const outcome of [403,409,'foreign']){
    const h=harness();await h.reply(0,payload(north));h.input().props.onChange({target:{value:'keep@example.invalid'}});h.submit();
    await h.reply(1,outcome==='foreign'?{operator:south}:{},typeof outcome==='number'?outcome:200);
    assert.equal(h.input().props.value,'keep@example.invalid');assert.equal(h.input().props.disabled,true);
    h.submit();assert.equal(h.requests.length,2);assert.doesNotMatch(h.html(),/South/);
    h.button('Läs in teamet igen').props.onClick();h.render();await h.reply(2,payload(north));
    assert.equal(h.input().props.value,'keep@example.invalid');assert.equal(h.input().props.disabled,false);
  }
});
test('late mutation after a route change updates neither the new team nor the old draft',async()=>{
  const h=harness();await h.reply(0,payload(north));h.input().props.onChange({target:{value:'keep@example.invalid'}});h.submit();
  assert.equal(h.navigate('/admin/companies/south-id?flik=team'),false);
  h.render({operatorId:south.id});await h.reply(2,payload(south));await h.reply(1,{operator:{...north,name:'Late North'}});
  assert.match(h.html(),/South/);assert.doesNotMatch(h.html(),/Late North/);
  h.render({operatorId:north.id});await h.reply(3,payload(north));assert.equal(h.input().props.value,'keep@example.invalid');
});
test('role changes keep membership revisions and drafts on conflict; status changes require confirmation',async()=>{
  const h=harness();await h.reply(0,payload(north));
  h.nodes(node=>node.type==='select'&&node.props['aria-label']==='Roll för north-admin')[0].props.onChange({target:{value:'partner-viewer'}});
  h.button('Spara roll').props.onClick();assert.deepEqual(JSON.parse(h.requests[1].options.body),{operatorId:north.id,userId:'42',roleId:'partner-viewer',status:'active',expectedRevision:7});
  await h.reply(1,{},409);assert.match(h.html(),/sista administratören/);
  h.button('Läs in teamet igen').props.onClick();h.render();await h.reply(2,payload({...north,members:[{...north.members[0],revision:8}]}));
  assert.equal(h.nodes(node=>node.type==='select'&&node.props['aria-label']==='Roll för north-admin')[0].props.value,'partner-viewer');
  h.button('Spara roll').props.onClick();assert.equal(JSON.parse(h.requests[3].options.body).expectedRevision,8);
  await h.reply(3,{operator:{...north,members:[{...north.members[0],roleId:'partner-viewer',revision:9}]}});assert.equal(h.button('Spara roll'),undefined);
  h.window.confirm=message=>{assert.match(message,/north-admin hos North/);return false;};h.button('Stäng av').props.onClick();assert.equal(h.requests.length,4);
  h.window.confirm=()=>true;h.button('Stäng av').props.onClick();assert.deepEqual(JSON.parse(h.requests[4].options.body),{operatorId:north.id,userId:'42',roleId:'partner-viewer',status:'suspended',expectedRevision:9});
});
test('inactive companies are read-only; a suspended member of an active company can be restored',async()=>{
  const h=harness();await h.reply(0,payload({...north,status:'suspended'}));assert.equal(h.input().props.disabled,true);h.submit();assert.equal(h.requests.length,1);assert.doesNotMatch(h.html(),/data-journal=/);
  const active=harness();await active.reply(0,payload({...north,members:[{...north.members[0],status:'suspended'}]}));active.button('Återaktivera').props.onClick();assert.equal(JSON.parse(active.requests[1].options.body).expectedRevision,7);
});
test('company subtabs retain team drafts, guard leaving the company editor, and do not read while inactive',async()=>{
  const h=harness('team',{active:false});assert.equal(h.requests.length,0);h.render({active:true});await h.reply(0,payload(north));
  h.input().props.onChange({target:{value:'draft@example.invalid'}});h.render();h.window.confirm=()=>false;
  assert.equal(h.navigate('/admin/companies/north-id?flik=tilldelning'),true);assert.equal(h.navigate('/admin/dealers'),false);
  h.render({active:false});assert.equal(h.requests.length,1);h.render({active:true});await h.reply(1,payload(north));assert.equal(h.input().props.value,'draft@example.invalid');
  h.render({disabled:true});h.submit();assert.equal(h.requests.length,2);
});
test('missing standard roles are restored only in the selected company',async()=>{
  const h=harness();await h.reply(0,payload({...north,missingRoles:['partner-editor'],roles:roles.filter(role=>role.id!=='partner-editor')}));
  h.button('Skapa saknade standardroller').props.onClick();assert.deepEqual(JSON.parse(h.requests[1].options.body),{operatorId:north.id,roleId:'partner-editor',permissions:roles.find(role=>role.id==='partner-editor').permissions});
  await h.reply(1,{operator:north});assert.equal(h.button('Skapa saknade standardroller'),undefined);
});
