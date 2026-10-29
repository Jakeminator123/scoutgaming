import test from 'node:test';
import assert from 'node:assert/strict';
import * as adminNavigation from './admin-navigation.ts';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {buildResourceDeletionTree,createResourceDeletionClient,resourceAnchor} from './resource-deletion.mjs';
import {designPreviewPages,designPreviewReturnTo} from '../../../lib/design-preview-paths.mjs';

function fixture(){
  const operators=[{id:'company-a',name:'Bolag A',status:'active',archivedAt:null,packageRevision:2},{id:'company-b',name:'Bolag B',status:'active',archivedAt:null,packageRevision:3}];
  const rooms=[{id:'room-a',name:'Snö',operatorId:'company-a',game:'blackjack',compositionId:'shared',state:'live',published:true,dealerIds:['published-only']},
    {id:'room-b',name:'Snö igen',operatorId:'company-b',game:'roulette',compositionId:'shared',state:'pending',published:false,dealerIds:['dragan']}];
  const project={revision:'project-1',dealers:[{id:'dragan',label:'Dragan',speechProfile:{reference:{videoId:'clip'}}}],lines:[{dealerId:'dragan',eventId:'idle.ready',variants:[{id:'base',label:'Bas',videoGenerationId:'clip'}]}],
    lanes:[{id:'shared',label:'Gemensam miljö',layers:{background:{enabled:true,allowed:['snow'],default:'snow'},dealer:{enabled:true,allowed:['dragan'],default:'dragan'},table:{enabled:true,allowed:['board'],default:'board'}}}],
    layerAssets:[{id:'snow',label:'Snöbild',role:'background',contentType:'image/png'},{id:'board',label:'Standardbord',role:'table',game:'blackjack',contentType:'image/png'}]};
  const inventory={videos:[{id:'clip',label:'Grundloop',dealer:'dragan',available:true,contentType:'video/mp4',classification:{dealerId:'dragan',eventId:'idle.ready'}},
    {id:'portrait',label:'Porträtt',available:true,contentType:'image/png',classification:{dealerId:'dragan',mediaType:'image',game:'roulette',eventId:'roulette.reference'}}]};
  const catalog={source:'registered',readAt:'2026-10-13T12:00:00.000Z',administration:{revisions:{project:'project-1',administration:'admin-1'},operators,rooms}};
  const lifecycle={administrationRevision:'admin-1',operators:structuredClone(operators),rooms:rooms.map(row=>({...row,presentationLaneId:row.compositionId,archivedAt:null}))};
  return {workspace:{project,inventory,catalog},lifecycle};
}
test('shared room layers are references; published dealer choices do not replace saved choices',()=>{
  const {workspace,lifecycle}=fixture(),before=structuredClone(workspace),tree=buildResourceDeletionTree(workspace,lifecycle);
  assert.deepEqual(workspace,before);
  assert.equal(tree.operators.length,2);assert.equal(tree.rooms.length,2);assert.equal(tree.compositions.length,1);assert.equal(tree.materials.length,2);
  assert.equal(tree.compositions[0].uses.length,2);assert.equal(tree.materials.find(row=>row.id==='snow').uses.length,1);
  assert.deepEqual(tree.compositions[0].layers.dealer.ids,['dragan']);
  assert.deepEqual(tree.rooms.find(row=>row.id==='room-a').publishedDealerIds,['published-only']);
  assert.equal(tree.dealers.find(row=>row.id==='published-only').missing,true);
  assert.equal(tree.dealers.find(row=>row.id==='published-only').uses[0].kind,'room');
  assert.equal(tree.media.find(row=>row.id==='portrait').kind,'image');
  assert.equal(tree.media.find(row=>row.id==='portrait').game,'roulette');
  assert.equal(tree.media.find(row=>row.id==='clip').uses.length,2);
  assert.deepEqual(tree.dealers.find(row=>row.id==='dragan').mediaIds,['clip','portrait']);
  assert.ok(tree.coverage.length&&tree.coverage.every(line=>typeof line==='string'&&line.trim()),'the tree states what its counts cover');
  assert.equal(tree.rooms.find(row=>row.id==='room-a').choicesPath,'/admin/rooms?operator=company-a&table=room-a&composition=shared&game=blackjack');
  assert.equal(tree.rooms.find(row=>row.id==='room-a').playable,false);
});
test('a miljöbild is a use of its material, never a layer of the environment',()=>{
  const {workspace,lifecycle}=fixture();
  workspace.project.layerAssets.push({id:'picture',label:'Gemensam miljö · miljöbild v1',role:'illustration',contentType:'image/webp'});
  workspace.project.lanes[0].illustration='picture';
  const tree=buildResourceDeletionTree(workspace,lifecycle),picture=tree.materials.find(row=>row.id==='picture');
  assert.equal(picture.role,'illustration');assert.deepEqual(picture.uses.map(row=>[row.kind,row.id]),[['composition','shared']]);
  assert.equal(Object.values(tree.compositions[0].layers).some(layer=>layer.ids.includes('picture')),false);
});
test('archived identities, rooms, compositions and media remain visible without inventing a game or owner',()=>{
  const {workspace,lifecycle}=fixture();
  workspace.project.dealerTrash=[{dealer:{id:'old',label:'Arkiverad dealer'},lines:[],compositions:[{id:'old-lane',label:'Arkiverad miljö',layers:{background:{enabled:false,allowed:['old-picture'],default:null},dealer:{enabled:true,allowed:['old'],default:'old'},table:{enabled:false,allowed:[],default:null}}}],activeMediaIds:['archived-clip']}];
  workspace.project.layerAssetTrash=[{asset:{id:'old-picture',label:'Äldre bakgrund',role:'background'}}];
  workspace.inventory.videos.push({id:'archived-clip',label:'Arkiverat klipp',dealer:'old',available:true,classification:{archived:true}});
  lifecycle.rooms.push({id:'old-room',name:'Arkiverat rum',operatorId:'company-b',presentationLaneId:'old-lane',archivedAt:'2026-10-12',state:'archived'});
  const tree=buildResourceDeletionTree(workspace,lifecycle);
  assert.equal(tree.dealers.find(row=>row.id==='old').archived,true);
  assert.equal(tree.compositions.find(row=>row.id==='old-lane').archived,true);
  assert.equal(tree.materials.find(row=>row.id==='old-picture').archived,true);
  assert.equal(tree.rooms.find(row=>row.id==='old-room').archived,true);
  assert.equal(tree.rooms.find(row=>row.id==='old-room').game,null);
  assert.equal(tree.rooms.find(row=>row.id==='old-room').choicesPath,null,'archived rooms have no room editor');
  assert.equal(tree.media.find(row=>row.id==='archived-clip').archived,true);
  assert.equal(tree.media.find(row=>row.id==='archived-clip').uses[0].relation,'Arkiverad mediakoppling');
});
test('missing and conflicting references stay explicit and no names confer ownership',()=>{
  const {workspace,lifecycle}=fixture();
  workspace.inventory.videos[0].dealer='other';
  workspace.inventory.videos.push({id:'unowned',label:'Dragan png',available:true,contentType:'image/png'});
  workspace.project.dealers[0].speechProfile.reference.videoId='missing-clip';
  workspace.catalog.administration.rooms.push({id:'unowned-room',name:'Frånkopplat rum',operatorId:'missing-company',compositionId:'missing-lane',state:'pending'});
  const tree=buildResourceDeletionTree(workspace,lifecycle);
  assert.equal(tree.media.filter(row=>row.id==='clip').length,1);
  assert.deepEqual(tree.media.find(row=>row.id==='clip').ownerIds,['dragan','other']);
  assert.equal(tree.media.find(row=>row.id==='unowned').primaryOwnerId,null);
  assert.equal(tree.media.find(row=>row.id==='missing-clip').missing,true);
  assert.equal(tree.compositions.find(row=>row.id==='missing-lane').missing,true);
  assert.deepEqual(tree.unownedRoomIds,['unowned-room']);
  assert.equal(tree.rooms.find(row=>row.id==='unowned-room').choicesPath,null,'a room without its company has no room editor');
  assert.match(tree.warnings.join(' '),/motstridiga dealer-ID/);
  assert.ok(!JSON.stringify(tree).includes('canDelete'));
});
test('mixed project, administration and operator package revisions cannot be presented as one snapshot',()=>{
  const {workspace,lifecycle}=fixture();
  for(const mutate of [
    ({workspace})=>{workspace.project.revision='changed';},
    ({lifecycle})=>{lifecycle.administrationRevision='changed';},
    ({lifecycle})=>{lifecycle.operators[0].packageRevision++;},
    ({lifecycle})=>{lifecycle.rooms[0].operatorId='changed';},
  ]){
    const copy=structuredClone({workspace,lifecycle});mutate(copy);
    assert.throws(()=>buildResourceDeletionTree(copy.workspace,copy.lifecycle),/ändrades under läsningen/);
  }
});
test('client starts independent reads together and performs only authenticated, uncached GET',async()=>{
  const {workspace,lifecycle}=fixture(),calls=[],started=[];
  let release;
  const pending=new Promise(resolve=>{release=resolve;});
  const client=createResourceDeletionClient({workspaceClient:{async load(signal){started.push('workspace');await pending;assert.equal(signal,controller.signal);return workspace;}},
    fetchImpl:async(url,options)=>{calls.push({url,options});started.push('lifecycle');await pending;return Response.json(lifecycle);}});
  const controller=new AbortController(),loading=client.load(controller.signal);
  assert.deepEqual(started,['lifecycle','workspace']);release();
  const tree=await loading;assert.equal(tree.lifecycleAvailable,true);
  assert.equal(calls.length,1);assert.equal(calls[0].url,'/studio/api/admin/resource-lifecycle');
  assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.credentials,'same-origin');
  assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.redirect,'error');
  assert.equal(calls[0].options.signal,controller.signal);assert.equal(calls[0].options.body,undefined);
});
test('unavailable lifecycle is marked incomplete; failed workspace is never replaced with empty data',async()=>{
  const {workspace}=fixture();
  const client=createResourceDeletionClient({workspaceClient:{load:async()=>workspace},fetchImpl:async()=>new Response(null,{status:503})});
  assert.equal((await client.load()).lifecycleAvailable,false);
  const bad=createResourceDeletionClient({workspaceClient:{load:async()=>{throw Error('Ingen N1-session');}},fetchImpl:async()=>Response.json({})});
  await assert.rejects(bad.load(),/Ingen N1-session/);
});

const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild');
const nodes=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>nodes(child,predicate)):[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];
const text=node=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
function expand(node){
  if(Array.isArray(node))return node.map(expand);
  if(!node||typeof node!=='object')return node;
  if(typeof node.type==='function')return expand(node.type(node.props));
  return {...node,props:{...node.props,children:expand(node.props?.children)}};
}
function harness({workspace,lifecycle}=fixture(),search=''){
  const tree=buildResourceDeletionTree(workspace,lifecycle);
  const slots=[],effects=[],module={exports:{}};let cursor=0,fail=false;
  const hooks={...React,useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],next=>slots[index]=typeof next==='function'?next(slots[index]):next];},
    useEffect(fn,deps){const index=cursor++;if(!slots[index]||deps.some((dep,i)=>dep!==slots[index].deps[i]))effects.push(()=>{slots[index]?.cleanup?.();slots[index]={deps,cleanup:fn()};});}};
  const output=transformSync(readFileSync(new URL('../components/studio/resource-connections.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'});
  const scrolled=[],document={getElementById:id=>({scrollIntoView(){scrolled.push(id);}})};
  runInNewContext(output.code,{module,exports:module.exports,URLSearchParams,AbortController,Date,Error,location:{search},document,require:name=>{
    if(name==='react')return hooks;
    if(name.includes('resource-deletion.mjs'))return {resourceAnchor,createResourceDeletionClient:()=>({load:async()=>{if(fail)throw Error('Läsningen misslyckades');return tree;}})};
    return require(name);
  }});
  const h={tree,scrolled,setFailure:value=>fail=value,render(){cursor=0;return expand(module.exports.ResourceConnections());},
    async settle(){for(let i=0;i<4;i++){h.render();while(effects.length)effects.shift()();await new Promise(resolve=>setImmediate(resolve));}},
  };return h;
}
test('tree uses unique object anchors and opens the referenced object when following an internal link',async()=>{
  const h=harness();await h.settle();const view=h.render(),all=nodes(view,()=>true),ids=all.map(row=>row.props?.id).filter(Boolean);
  assert.equal(new Set(ids).size,ids.length);
  for(const anchor of all.filter(row=>row.type==='a'&&row.props.href.startsWith('#')))assert.ok(ids.includes(anchor.props.href.slice(1)),anchor.props.href);
  assert.equal(ids.filter(id=>id===resourceAnchor('media','clip')).length,1);
  assert.equal(ids.filter(id=>id===resourceAnchor('material','snow')).length,1);
  const panelFor=(tree,kind,id)=>nodes(tree,row=>row.props?.role==='tabpanel').find(panel=>nodes(panel,row=>row.props?.id===resourceAnchor(kind,id)).length);
  assert.equal(panelFor(view,'room','room-a').props.hidden,false);
  const section=all.find(row=>row.props['aria-labelledby']==='structure-title');let stopped=0,prevented=0;
  const click=href=>section.props.onClick({target:{closest:()=>({getAttribute:()=>href})},stopPropagation(){stopped++;},preventDefault(){prevented++;}});
  click('#'+resourceAnchor('room','room-a'));assert.equal(stopped,1);assert.equal(prevented,0,'a same-tab reference keeps native fragment navigation');
  click('#'+resourceAnchor('media','clip'));assert.equal(stopped,2);assert.equal(prevented,1);await h.settle();
  assert.equal(panelFor(h.render(),'media','clip').props.hidden,false);
  assert.deepEqual(h.scrolled,[resourceAnchor('media','clip')]);
  click('/admin/dealers?dealer=dragan');assert.equal(stopped,2,'Admin links keep the SPA click handling');
});
test('merged page opens the tab and item of the navigation context and keeps room, template and company actions',async()=>{
  const h=harness(fixture(),'?operator=company-a&table=room-a&composition=shared&dealer=dragan&game=blackjack');await h.settle();
  const view=h.render(),all=nodes(view,()=>true),links=all.filter(row=>row.type==='a').map(row=>row.props.href);
  assert.deepEqual(h.scrolled,[resourceAnchor('room','room-a')]);
  assert.equal(all.find(row=>row.props?.id==='structure-panel-operators').props.hidden,false);
  assert.ok(links.includes('/admin/scenes?operator=company-a&table=room-a&composition=shared&game=blackjack'),'template edits open the canonical Studio scene with the same room context');
  assert.ok(links.includes('/admin/rooms?operator=company-a&table=room-a&composition=shared&game=blackjack'),'room choices use the room editor');
  assert.equal(all.find(row=>row.type==='a'&&text(row)==='Öppna spelbordet')?.props.href,'/admin/rooms/room-a','the table opens in its own nav by its path identity');
  assert.ok(links.includes('/admin/rooms/room-b'),'each table links to its own nav');
  assert.ok(links.includes('/admin/companies/company-a')&&links.includes('/admin/companies/company-b'),'each company opens its own nav');
  assert.ok(links.includes('/admin/dealers/dragan?flik=anvands'),'a dealer opens the uses tab of its own nav');
  assert.equal(all.find(row=>row.type==='a'&&text(row)==='Ändra miljön')?.props.href,'/admin/scenes?tab=miljoer&composition=shared','compositions open in the scene template tab');
  assert.ok(links.includes('/admin/scenes?tab=material&filter=bakgrund'));assert.ok(links.includes('/admin/scenes?tab=material&filter=bordsgrafik&game=blackjack'));
  assert.ok(!links.some(href=>/^\/admin\/(assets|clips|structure|deletion)(\?|$)/.test(href)),'no link points at a retired address');
  assert.deepEqual(nodes(view,row=>row.props?.role==='tab').map(text),['Bolag och spelbord','Dealers','Material','Miljöer']);
  const dealers=harness(fixture(),'?dealer=dragan');await dealers.settle();
  assert.equal(nodes(dealers.render(),row=>row.props?.id==='structure-panel-dealers')[0].props.hidden,false);
  assert.deepEqual(dealers.scrolled,[resourceAnchor('dealer','dragan')]);
  const explicit=harness(fixture(),'?tab=materials&dealer=dragan');await explicit.settle();
  assert.equal(nodes(explicit.render(),row=>row.props?.id==='structure-panel-materials')[0].props.hidden,false);
  assert.deepEqual(explicit.scrolled,[]);
});
test('refresh failure removes the old tree and incomplete lifecycle stays visible as a warning',async()=>{
  const h=harness();h.tree.lifecycleAvailable=false;await h.settle();
  assert.match(text(h.render()),/Trädet är ofullständigt/);
  h.setFailure(true);nodes(h.render(),row=>row.type==='button')[0].props.onClick();await h.settle();
  assert.match(text(h.render()),/Läsningen misslyckades/);assert.doesNotMatch(text(h.render()),/Gemensam miljö/);
});
test('dependency overview has an accessible active Admin link and unique resource anchors',()=>{
  assert.ok(designPreviewPages.has('deletion'));assert.ok(designPreviewPages.has('structure'));
  assert.equal(designPreviewReturnTo('/admin/deletion'),'/admin/system?flik=beroenden');
  assert.equal(designPreviewReturnTo('/admin/deletion?operator=nord&table=room-1'),'/admin/system?flik=beroenden&operator=nord&table=room-1');
  assert.equal(designPreviewReturnTo('/admin/structure?operator=nord&table=room-1'),'/admin/system?flik=beroenden&operator=nord&table=room-1');
  const componentUrl=new URL('../components/studio/studio-sidebar.tsx',import.meta.url),componentRequire=createRequire(componentUrl),module={exports:{}};
  let pathname='/admin/system';
  runInNewContext(transformSync(readFileSync(componentUrl,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,
    require:name=>name.includes('admin-navigation')?adminNavigation:name==='./admin-logout'?{AdminLogout:()=>null}:name==='./theme-toggle'?{ThemeToggle:()=>null}:name==='next/link'?{__esModule:true,default:'a'}:name==='next/navigation'?{usePathname:()=>pathname,useSearchParams:()=>new URLSearchParams()}:componentRequire(name)});
  const dependencyLinks=()=>{
    const all=nodes(expand(module.exports.StudioSidebar()),node=>node.type==='a');
    assert.ok(!all.some(node=>node.props.href==='/admin/structure'),'the retired overview has no menu entry of its own');
    const links=all.filter(node=>node.props.href==='/admin/system');
    assert.ok(links.length,'the dependency overview remains reachable through System');
    assert.ok(links.every(link=>text(link).trim()||link.props['aria-label']),'overview links have an accessible name');
    return links;
  };
  assert.ok(dependencyLinks().every(link=>link.props['aria-current']==='page'));
  assert.equal(nodes(module.exports.StudioSidebar(),node=>node.type?.name==='AdminLogout').length,1,'the menu holds the one Admin logout');
  assert.equal(nodes(module.exports.StudioSidebar(),node=>node.type?.name==='ThemeToggle').length,1,'the menu holds the one mode choice');
  pathname='/admin';assert.ok(dependencyLinks().every(link=>link.props['aria-current']===undefined));
  assert.notEqual(resourceAnchor('media','a:b'),resourceAnchor('media','a_3Ab'));
  assert.notEqual(resourceAnchor('media','é'),resourceAnchor('dealer','é'));
  assert.ok(!resourceAnchor('media','é:#').includes('%'));
});

// Admin's single logout: the same guard as a menu link, one request, then the login page.
test('the Admin menu logout respects unsaved editors, ends the N1 session once and reports a failure',async()=>{
  const componentUrl=new URL('../components/studio/admin-logout.tsx',import.meta.url),componentRequire=createRequire(componentUrl);
  const slots=[];let cursor=0;
  const hooks={...React,useRef(initial){const index=cursor++;return slots[index]??={current:initial};},
    useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],next=>{slots[index]=next;}];}};
  let allowed=false,assigned=[],requests=[],respond=()=>Response.json({ok:true});
  const login={createStudioLoginClient:({authBase})=>({async request(action,body){requests.push({authBase,action,body});const response=respond();if(!response.ok)throw new LoginError(response.status);return {ok:true};}}),StudioLoginUiError:class extends Error{}};
  class LoginError extends login.StudioLoginUiError{constructor(status){super('Inloggningstjänsten är tillfälligt otillgänglig.');this.status=status;}}
  const history={studioHistory:()=>({canNavigate:href=>{assert.equal(href,'/admin/login');return allowed;}})};
  const module={exports:{}};
  runInNewContext(transformSync(readFileSync(componentUrl,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,window:{location:{assign:href=>assigned.push(href)}},
    require:name=>name==='react'?hooks:name.includes('studio-login-client')?login:name.includes('studio-history')?history:componentRequire(name)});
  const render=()=>{cursor=0;return expand(module.exports.AdminLogout());};
  const button=()=>nodes(render(),node=>node.type==='button')[0];
  assert.equal(text(button()).trim(),'Logga ut');
  await button().props.onClick();await new Promise(setImmediate);
  assert.deepEqual(requests,[],'an editor with unsaved changes keeps the session');assert.deepEqual(assigned,[]);
  allowed=true;respond=()=>new Response('{}',{status:503});
  button().props.onClick();button().props.onClick();await new Promise(setImmediate);
  assert.equal(requests.length,1,'a double click sends one logout');assert.deepEqual(assigned,[]);
  assert.match(text(nodes(render(),node=>node.props?.role==='alert')[0]),/tillfälligt otillgänglig/);
  respond=()=>Response.json({ok:true});button().props.onClick();await new Promise(setImmediate);
  assert.deepEqual(JSON.parse(JSON.stringify(requests.at(-1))),{authBase:'/studio/api/auth',action:'logout',body:{}});
  assert.deepEqual(assigned,['/admin/login']);
});

function publishedFixture(){
  const f=fixture(),op=f.workspace.catalog.administration.operators[0];op.slug='company-a';
  f.lifecycle.operators[0].slug='company-a';
  f.workspace.catalog.lobby={catalogs:[{operator:{slug:'company-a',name:op.name},packageRevision:2,rooms:[{
    id:'room-a',presentation:{id:'shared',label:'Publicerad miljö'},dealerDefault:'published-only',dealers:[{
      id:'published-only',label:'Publicerad dealer',independentLayers:true,
      background:{enabled:true,mode:'image',default:'published-snow',allowed:[{id:'published-snow',label:'Publicerad snö'}]},
      table:{enabled:true,default:'board',allowed:[{id:'board',label:'Publicerat bord'}]},
    }],
  }]}]};
  return f;
}
test('playable room layers retain exact published choices separately from the saved shared template',()=>{
  const {workspace,lifecycle}=publishedFixture(),tree=buildResourceDeletionTree(workspace,lifecycle),room=tree.rooms.find(row=>row.id==='room-a');
  assert.equal(room.publication.packageRevision,2);
  assert.equal(room.publication.dealerDefault,'published-only');
  assert.equal(room.publication.dealers[0].background.defaultId,'published-snow');
  assert.equal(room.publication.dealers[0].background.allowed[0].label,'Publicerad snö');
  assert.equal(tree.compositions.find(row=>row.id==='shared').layers.background.defaultId,'snow');
  assert.equal(tree.materials.find(row=>row.id==='published-snow').publishedOnly,true);
  assert.equal(tree.materials.find(row=>row.id==='published-snow').missing,false);
  assert.equal(tree.dealers.find(row=>row.id==='published-only').label,'Publicerad dealer');
  assert.equal(tree.materials.filter(row=>row.id==='board').length,1);
  assert.equal(tree.materials.find(row=>row.id==='board').uses.filter(row=>row.kind==='room').length,1);
  assert.equal(tree.rooms.find(row=>row.id==='room-b').publication,null);
});
test('published room choices reject mixed owner, package, composition and game identities',()=>{
  for(const mutate of [
    f=>{f.workspace.catalog.lobby.catalogs[0].operator.slug='unknown';},
    f=>{f.workspace.catalog.lobby.catalogs[0].packageRevision=99;},
    f=>{f.workspace.catalog.lobby.catalogs[0].rooms[0].presentation.id='wrong-lane';},
    f=>{f.workspace.catalog.lobby.catalogs[0].rooms[0].game='roulette';},
  ]){
    const f=publishedFixture();mutate(f);
    assert.throws(()=>buildResourceDeletionTree(f.workspace,f.lifecycle),/publicerade|publicering/);
  }
});
test('available publication history counts remain separate from incomplete or absent history',()=>{
  const {workspace,lifecycle}=fixture();
  lifecycle.historyCoverage='complete';
  lifecycle.presentations=[{id:'shared',publishedTo:[{id:'company-a',name:'Bolag A'}],historicalPackageReferences:4}];
  let tree=buildResourceDeletionTree(workspace,lifecycle);
  assert.equal(tree.historyCoverage,'complete');
  assert.equal(tree.compositions[0].historicalPackageReferences,4);
  assert.equal(tree.compositions[0].publishedTo[0].id,'company-a');
  lifecycle.presentations[0].historicalPackageReferences=0;
  assert.equal(buildResourceDeletionTree(workspace,lifecycle).compositions[0].historicalPackageReferences,0);
  lifecycle.historyCoverage='incomplete';
  assert.equal(buildResourceDeletionTree(workspace,lifecycle).compositions[0].historicalPackageReferences,null);
  tree=buildResourceDeletionTree(workspace,null);
  assert.equal(tree.historyCoverage,'unavailable');
  assert.equal(tree.compositions[0].historicalPackageReferences,null);
});
test('immutable bank event fields are retained without replacing explicit classification fields',()=>{
  const {workspace,lifecycle}=fixture();
  workspace.inventory.videos.push({id:'bank',label:'Astrid',dealer:'astrid',available:true,eventId:'deal.dealer',situation:'dealer-hole'});
  workspace.inventory.videos[0].classification.situation='';
  workspace.inventory.videos[0].eventId='wrong-event';workspace.inventory.videos[0].situation='wrong-slot';
  const tree=buildResourceDeletionTree(workspace,lifecycle),bank=tree.media.find(row=>row.id==='bank'),classified=tree.media.find(row=>row.id==='clip');
  assert.equal(bank.eventId,'deal.dealer');assert.equal(bank.situation,'dealer-hole');assert.equal(bank.kind,'video');
  assert.equal(classified.eventId,'idle.ready');assert.equal(classified.situation,'');
});
test('archived schema-v2 rooms follow the verified server Blackjack default and preserve explicit Roulette',()=>{
  const {workspace,lifecycle}=fixture();
  lifecycle.rooms.push({schemaVersion:2,id:'archived-blackjack',name:'Arkiv BJ',operatorId:'company-a',presentationLaneId:'shared',gameLaneId:'lane',state:'archived',archivedAt:'2026-10-12'},
    {schemaVersion:2,id:'archived-roulette',name:'Arkiv roulette',operatorId:'company-b',presentationLaneId:'shared',gameLaneId:'roulette-lane',game:'roulette',state:'archived',archivedAt:'2026-10-12'});
  const tree=buildResourceDeletionTree(workspace,lifecycle);
  assert.equal(tree.rooms.find(row=>row.id==='archived-blackjack').game,'blackjack');
  assert.equal(tree.rooms.find(row=>row.id==='archived-roulette').game,'roulette');
});

test('published room UI renders its own defaults and counted history without duplicating library objects',async()=>{
  const f=publishedFixture();f.lifecycle.historyCoverage='complete';
  f.lifecycle.presentations=[{id:'shared',publishedTo:[{id:'company-a',name:'Bolag A'}],historicalPackageReferences:3}];
  const h=harness(f);await h.settle();const view=h.render(),all=nodes(view,()=>true),ids=all.map(row=>row.props?.id).filter(Boolean);
  assert.match(text(view),/Publicerade spelval · paket 2/);
  assert.match(text(view),/Publicerad snö.*spelbordets förval/);
  assert.match(text(view),/Historiska paketreferenser: 3/);
  assert.match(text(view),/Historikräkning: komplett registerläsning/);
  assert.match(text(view),/Klippimporten tar för närvarande emot MP4 och WebM/);
  assert.equal(ids.filter(id=>id===resourceAnchor('material','board')).length,1);
  assert.equal(ids.filter(id=>id===resourceAnchor('material','published-snow')).length,1);
  for(const anchor of all.filter(row=>row.type==='a'&&row.props.href.startsWith('#')))assert.ok(ids.includes(anchor.props.href.slice(1)),anchor.props.href);
});
