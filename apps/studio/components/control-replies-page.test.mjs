import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {REPLY_CATEGORIES,validateReplyCategories} from '../../../packages/presentation/contracts/speech-reply-library.mjs';
import {parseStudioRepliesRequest} from '../lib/studio-replies-query.mjs';
import {studioNavigationContextFromQuery,studioNavigationHref,STUDIO_DEALER_TABS} from '../lib/studio-navigation.mjs';

const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const source=readFileSync(new URL('./control-replies-page.tsx',import.meta.url),'utf8');
const output=transformSync(source,{filename:'control-replies-page.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const typesModule={exports:{}};
const typesOutput=transformSync(readFileSync(new URL('./studio-types.ts',import.meta.url),'utf8'),{filename:'studio-types.ts',jsc:{parser:{syntax:'typescript'}},module:{type:'commonjs'}});
vm.runInNewContext(typesOutput.code,{module:typesModule,exports:typesModule.exports,URL,URLSearchParams,require});
const navigationOutput=transformSync(readFileSync(new URL('./studio-navigation.tsx',import.meta.url),'utf8'),{filename:'studio-navigation.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const navigationModule={exports:{}};vm.runInNewContext(navigationOutput.code,{module:navigationModule,exports:navigationModule.exports,URL,require:name=>name==='next/navigation'?{useSearchParams:()=>new URLSearchParams()}:name.endsWith('.module.css')?{__esModule:true,default:{}}:require(name)});
const StudioNavigation=navigationModule.exports.StudioNavigation;
const DealerClipPreview=({url,label})=>React.createElement('video',{src:url,'aria-label':label});
const stateNames=[...source.matchAll(/const \[([^,]*),[^\]]*\]\s*=\s*useState/g)].map(match=>match[1].trim());
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const props={dealers:[{id:'astrid',label:'Astrid'},{id:'elin',label:'Elin'}],initialDealerId:'astrid'};
const sample=(patch={})=>({id:'11111111-1111-4111-8111-111111111111',dealerId:'astrid',exactText:'Hej! Vad roligt att se dig.',language:'sv',createdAt:'2026-10-12T10:20:00.000Z',profileRevision:'a'.repeat(64),revision:1,categories:['player-greeting'],reviewStatus:'pending',media:{audio:{available:true,sha256:'b'.repeat(64),contentType:'audio/wav',size:100},video:{available:true,sha256:'c'.repeat(64),contentType:'video/mp4',size:200}},...patch});
function harness(requestJson,p=props){
  const values=[],refs=[],effects=[],listeners=new Map(),calls=[];let cursor=0,refCursor=0,effectCursor=0;
  const initialUrl=new URL(p.initialHref??studioNavigationHref('/admin/replies',{...p.initialNavigationContext,dealerId:p.initialDealerId}),'https://local.test');if(p.initialCategory)initialUrl.searchParams.set('category',p.initialCategory);
  let historyState=null;
  const writeHistory=(value,_title,url)=>{historyState=structuredClone(value);if(url!==undefined)initialUrl.href=new URL(url,initialUrl).href;};
  const runtimeWindow={location:initialUrl,history:{get state(){return historyState;},pushState:writeHistory,replaceState:writeHistory},addEventListener:(key,value)=>listeners.set(key,value),removeEventListener(key,value){if(listeners.get(key)===value)listeners.delete(key);},dispatchEvent(event){listeners.get(event.type)?.(event);return !event.defaultPrevented;}};
  const react={...React,useState(initial){const key=cursor++;if(!(key in values))values[key]=typeof initial==='function'?initial():initial;return[values[key],next=>{values[key]=typeof next==='function'?next(values[key]):next;}];},useRef(initial){return refs[refCursor++]??={current:initial};},useEffect(run,deps){const key=effectCursor++,previous=effects[key];effects[key]={...previous,run,deps,changed:!previous||!deps||deps.some((value,index)=>value!==previous.deps?.[index])};}};
  const module={exports:{}};vm.runInNewContext(output.code,{module,exports:module.exports,window:runtimeWindow,URL,URLSearchParams,AbortController,Intl,Date,require:name=>name==='react'?react:name.endsWith('.module.css')?{__esModule:true,default:{}}:name==='./studio-types'?{...typesModule.exports,requestJson(...args){calls.push(args);return requestJson(...args);}}:name==='./studio-navigation'?{StudioNavigation}:name==='./dealer-video-surface'?{DealerClipPreview}:require(name)});
  const h={render(){cursor=refCursor=effectCursor=0;return module.exports.ControlRepliesPage(p);},effects(){for(const effect of effects.filter(row=>row.changed)){effect.cleanup?.();effect.changed=false;effect.cleanup=effect.run();}},state(name){return values[stateNames.indexOf(name)];},unmount(){for(const effect of effects)effect.cleanup?.();},calls,listeners,window:runtimeWindow};return h;
}
function nodes(node,predicate){if(!node||typeof node!=='object')return[];if(Array.isArray(node))return node.flatMap(child=>nodes(child,predicate));return[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];}
// Controls are found by their action, field or category id, never by their words.
const button=(tree,action)=>nodes(tree,node=>node.type==='button'&&node.props['data-action']===action)[0];
const select=(tree,field)=>nodes(tree,node=>node.type==='select'&&node.props['data-field']===field)[0];
const category=(tree,id)=>nodes(tree,node=>node.type==='input'&&node.props['data-category']===id)[0];
const empty=tree=>nodes(tree,node=>node.props?.['data-empty']!==undefined).map(node=>node.props['data-empty']);
const savedCategories=tree=>nodes(tree,node=>node.props?.['data-saved-categories']!==undefined)[0]?.props['data-saved-categories'];
const roles=(tree,role)=>nodes(tree,node=>node.props?.role===role).length;
/** The dealer nav link for a tab id, found by the shared tab definition rather than a copied label. */
const tabLink=(links,id)=>links.find(link=>link.props.children===STUDIO_DEALER_TABS.find(tab=>tab.id===id).label);
async function loaded(request=async()=>({items:[sample()],nextCursor:null}),p=props){const h=harness(request,p);h.render();h.effects();await settle();h.render();h.effects();return h;}

test('reply list shows exact private dealer metadata and N1 media paths with ten shared categories',async()=>{
  const item=sample({exactText:'Exakt <b>text</b>\nRad två'}),h=await loaded(async()=>({items:[item],nextCursor:null}));const tree=h.render(),html=renderToStaticMarkup(tree);
  assert.match(html,/Exakt &lt;b&gt;text&lt;\/b&gt;/);assert.match(html,/Rad två/);assert.match(html,/data-review="pending"/);assert.match(html,new RegExp('a'.repeat(64)));assert.match(html,/2026-10-12T10:20:00.000Z/);
  assert.equal(nodes(tree,node=>node.type==='input'&&node.props.type==='checkbox').length,10);
  assert.deepEqual(nodes(tree,node=>node.type==='input'&&node.props.type==='checkbox').map(node=>node.props['data-category']),REPLY_CATEGORIES.map(entry=>entry.id));
  assert.deepEqual(nodes(tree,node=>node.type==='input'&&node.props.checked).map(node=>node.props['data-category']),item.categories);
  for(const [tag,kind]of [['audio','audio'],[DealerClipPreview,'video']]){const media=nodes(tree,node=>node.type===tag)[0];assert.equal(media.props.src??media.props.url,`/api/replies/${item.id}/${kind}?dealer=astrid`);if(kind==='audio')assert.equal(media.props.preload,'none');}
  assert.doesNotMatch(html,/blob\.vercel/);
  assert.deepEqual(nodes(tree,node=>node.type==='button').map(action=>action.props['data-action']).sort(),['refresh','save','undo'],'the library only categorizes: no generate, publish, delete, reuse or approve');
  assert.equal(h.calls[0][0],'/api/replies?dealer=astrid');assert.equal(h.calls[0][1].cache,'no-store');
});

test('category filters use the shared backend IDs and malformed or unauthorized state never shows examples',async()=>{
  const h=await loaded(async()=>({items:[],nextCursor:null}),{...props,initialCategory:'player-question'});assert.equal(h.calls[0][0],'/api/replies?dealer=astrid&category=player-question');assert.deepEqual(empty(h.render()),['category']);
  const denied=await loaded(async()=>{throw Object.assign(Error('sensitive backend detail'),{statusCode:403});});const html=renderToStaticMarkup(denied.render());assert.equal(roles(denied.render(),'alert'),1);assert.doesNotMatch(html,/sensitive backend detail|Hej!/);assert.deepEqual(empty(denied.render()),[]);
  const other=await loaded(async()=>{throw Object.assign(Error('x'),{statusCode:500});});assert.notEqual(renderToStaticMarkup(other.render()),html,'a missing privilege is explained apart from an unavailable library');
  const invalid=await loaded(async()=>{throw Error('must not fetch');},{...props,initialDealerId:'missing',initialCategory:'invented'});assert.equal(invalid.calls.length,0);assert.equal(invalid.state('dealerId'),'');assert.deepEqual(empty(invalid.render()),['no-dealer']);
});

test('late dealer responses are aborted and cannot replace a newly selected dealer list',async()=>{
  const old=deferred(),fresh=deferred(),h=harness(url=>url.includes('dealer=elin')?fresh.promise:old.promise);let tree=h.render();h.effects();select(tree,'dealer').props.onChange({target:{value:'elin'}});tree=h.render();h.effects();assert.equal(h.calls[0][1].signal.aborted,true);
  fresh.resolve({items:[sample({dealerId:'elin',exactText:'Elins svar'})],nextCursor:null});await settle();h.render();old.resolve({items:[sample()],nextCursor:null});await settle();tree=h.render();assert.equal(h.state('items')[0].dealerId,'elin');assert.match(renderToStaticMarkup(tree),/Elins svar/);assert.doesNotMatch(renderToStaticMarkup(tree),/Vad roligt/);
});

test('category changes require an explicit CAS save, lock double clicks and keep media keys stable',async()=>{
  const write=deferred(),h=await loaded(async(_url,init)=>init.method==='PATCH'?write.promise:{items:[sample()],nextCursor:null});let tree=h.render();const videoKey=nodes(tree,node=>node.type===DealerClipPreview)[0].key;
  category(tree,'player-kind').props.onChange();tree=h.render();assert.equal(h.calls.length,1);const save=button(tree,'save');save.props.onClick();save.props.onClick();tree=h.render();assert.equal(h.calls.length,2);
  const payload=JSON.parse(h.calls[1][1].body);assert.deepEqual(payload,{dealerId:'astrid',categories:['player-greeting','player-kind'],expectedRevision:1});assert.equal(h.calls[1][1].cache,'no-store');assert.equal(h.calls[1][0],'/api/replies/'+sample().id);assert.equal(new URL(h.calls[1][0],'https://test.invalid').search,'');assert.deepEqual(parseStudioRepliesRequest('PATCH',new URL(h.calls[1][0],'https://test.invalid')),{kind:'categorize',id:sample().id});assert.deepEqual(validateReplyCategories(payload.categories),['player-greeting','player-kind']);
  select(tree,'dealer').props.onChange({target:{value:'elin'}});assert.equal(h.state('dealerId'),'astrid');
  write.resolve({item:sample({categories:['player-greeting','player-kind'],revision:2})});await settle();tree=h.render();assert.deepEqual(Object.keys(h.state('drafts')),[]);assert.equal(h.state('items')[0].revision,2);assert.equal(nodes(tree,node=>node.type===DealerClipPreview)[0].key,videoKey);
});

test('409 retains category draft until an explicit fresh read and retries only on another Save click',async()=>{
  let patch=0;const h=await loaded(async(url,init)=>{if(init.method==='PATCH'){patch++;if(patch===1)throw Object.assign(Error('conflict'),{statusCode:409});return{item:sample({categories:['player-greeting','player-kind'],revision:5})};}return url.includes(sample().id)?{item:sample({categories:['game-win'],revision:4})}:{items:[sample()],nextCursor:null};});
  let tree=h.render();category(tree,'player-kind').props.onChange();tree=h.render();button(tree,'save').props.onClick();await settle();tree=h.render();assert.equal(patch,1);assert.equal(h.calls.length,2);assert.equal(button(tree,'save').props.disabled,true);assert.equal(h.state('drafts')[sample().id].includes('player-kind'),true);
  button(tree,'latest').props.onClick();await settle();tree=h.render();assert.equal(h.state('items')[0].revision,4);assert.equal(h.state('drafts')[sample().id].includes('player-kind'),true);assert.equal(savedCategories(tree),'game-win');
  button(tree,'save').props.onClick();await settle();tree=h.render();assert.equal(patch,2);assert.equal(JSON.parse(h.calls.at(-1)[1].body).expectedRevision,4);assert.deepEqual(Object.keys(h.state('drafts')),[]);
});

test('uncertain save is reconciled by reading without repeating its write',async()=>{
  const h=await loaded(async(url,init)=>{if(init.method==='PATCH')throw Error('connection lost');return url.includes(sample().id)?{item:sample({categories:['player-greeting','player-kind'],revision:2})}:{items:[sample()],nextCursor:null};});let tree=h.render();category(tree,'player-kind').props.onChange();tree=h.render();button(tree,'save').props.onClick();await settle();tree=h.render();assert.equal(h.calls.filter(([,init])=>init.method==='PATCH').length,1);assert.equal(h.calls.length,3);assert.deepEqual(Object.keys(h.state('drafts')),[]);assert.equal(h.state('items')[0].revision,2,'the reconciling read is applied');assert.equal(roles(tree,'alert'),0);assert.equal(roles(tree,'status'),1);
});

test('unsaved categories guard filters, dealer changes, leaving and browser history, with an Undo path',async()=>{
  const h=await loaded();let tree=h.render();category(tree,'player-help').props.onChange();tree=h.render();h.effects();
  select(tree,'category').props.onChange({target:{value:'game-win'}});select(tree,'dealer').props.onChange({target:{value:'elin'}});assert.equal(h.state('category'),'');assert.equal(h.state('dealerId'),'astrid');
  const nav=nodes(tree,node=>node.props?.active==='replies')[0],clipLink=tabLink(nodes(nav.type(nav.props),node=>node.type==='a'),'clips'),event={button:0,preventDefault(){this.blocked=true;}};clipLink.props.onClick(event);assert.equal(event.blocked,true);
  const unload={preventDefault(){this.blocked=true;}};h.listeners.get('beforeunload')(unload);assert.equal(unload.blocked,true);
  h.window.location.search='?dealer=elin';h.listeners.get('popstate')(new Event('popstate'));assert.equal(h.state('dealerId'),'astrid');assert.match(h.window.location.href,/\/admin\/dealers\/astrid\?/,'the vetoed traversal restores the dealer nav address');
  button(tree,'undo').props.onClick();tree=h.render();h.effects();select(tree,'dealer').props.onChange({target:{value:'elin'}});assert.equal(h.state('dealerId'),'elin');
});

test('paging deduplicates rows, preserves dealer identity and aborts pending reads on unmount',async()=>{
  const page=deferred(),h=await loaded(async(url)=>url.includes('cursor=')?page.promise:{items:[sample()],nextCursor:'next'});button(h.render(),'more').props.onClick();h.render();page.resolve({items:[sample(),sample({id:'22222222-2222-4222-8222-222222222222'})],nextCursor:null});await settle();h.render();assert.equal(h.state('items').length,2);assert.equal(h.calls[1][0],'/api/replies?dealer=astrid&cursor=next');
  const pending=deferred(),other=harness(()=>pending.promise);other.render();other.effects();other.unmount();assert.equal(other.calls[0][1].signal.aborted,true);pending.resolve({items:[sample()],nextCursor:null});await settle();assert.equal(other.state('items').length,0);
});

test('foreign dealer rows or wrong reconciliation identities fail closed; failed media does not borrow a substitute',async()=>{
  const foreign=await loaded(async()=>({items:[sample({dealerId:'elin'})],nextCursor:null}));assert.equal(foreign.state('items').length,0);assert.equal(roles(foreign.render(),'alert'),1);
  const h=await loaded();let tree=h.render();nodes(tree,node=>node.type===DealerClipPreview)[0].props.onError();tree=h.render();assert.equal(nodes(tree,node=>node.type===DealerClipPreview).length,0);assert.equal(nodes(tree,node=>node.type==='audio').length,1);
});

test('filtered drafts stay reachable when CAS refresh removes the active category',async()=>{
  const h=await loaded(async(url,init)=>{if(init.method==='PATCH')throw Object.assign(Error('conflict'),{statusCode:409});return url.includes(sample().id)?{item:sample({categories:['game-win'],revision:4})}:{items:[sample()],nextCursor:null};},{...props,initialCategory:'player-greeting'});
  let tree=h.render();category(tree,'player-kind').props.onChange();tree=h.render();button(tree,'save').props.onClick();await settle();tree=h.render();button(tree,'latest').props.onClick();await settle();tree=h.render();
  assert.equal(h.state('category'),'player-greeting');assert.equal(nodes(tree,node=>node.type==='article').length,1);assert.equal(category(tree,'player-kind').props.checked,true);assert.equal(savedCategories(tree),'game-win');
  assert.equal(button(tree,'undo').props.disabled,false);button(tree,'undo').props.onClick();tree=h.render();assert.deepEqual(Object.keys(h.state('drafts')),[]);assert.equal(nodes(tree,node=>node.type==='article').length,0);
  select(tree,'category').props.onChange({target:{value:'game-win'}});assert.equal(h.state('category'),'game-win');
});

test('a filtered empty page with a cursor invites continuation instead of declaring the category empty',async()=>{
  const h=await loaded(async url=>url.includes('cursor=')?{items:[sample()],nextCursor:null}:{items:[],nextCursor:'next-page'},{...props,initialCategory:'player-greeting'});let tree=h.render();assert.deepEqual(empty(tree),['more']);button(tree,'more').props.onClick();await settle();tree=h.render();assert.equal(nodes(tree,node=>node.type==='article').length,1);assert.deepEqual(parseStudioRepliesRequest('GET',new URL(h.calls[1][0],'https://test.invalid')),{kind:'list',dealerId:'astrid',category:'player-greeting',cursor:'next-page'});
});

test('a mismatched reconciliation item never replaces the original reply or clears its draft',async()=>{
  const h=await loaded(async(url,init)=>{if(init.method==='PATCH')throw Error('lost response');return url.includes(sample().id)?{item:sample({id:'22222222-2222-4222-8222-222222222222',categories:['player-greeting','player-kind'],revision:2})}:{items:[sample()],nextCursor:null};});let tree=h.render();category(tree,'player-kind').props.onChange();tree=h.render();button(tree,'save').props.onClick();await settle();tree=h.render();assert.equal(h.state('items')[0].id,sample().id);assert.equal(h.state('items')[0].revision,1);assert.equal(h.state('drafts')[sample().id].includes('player-kind'),true);assert.equal(button(tree,'save').props.disabled,true);assert.ok(button(tree,'latest'),'only an explicit fresh read can continue');assert.equal(h.calls.filter(([,init])=>init.method==='PATCH').length,1);
});


test('Admin replies component preserves exact Studio context through real navigation, filtering, dealer changes and history',async()=>{
  const query={dealer:'astrid',event:'speak.goodluck',variant:'astrid.goodluck.alt-2',situation:'goodluck',lane:'studio/main',operator:'fixture-operator',table:'fixture-room',game:'roulette',category:'player-question',token:'never-forward',tab:'private'};
  const p={...props,initialCategory:query.category,initialNavigationContext:studioNavigationContextFromQuery(new URLSearchParams(query))};
  assert.deepEqual(p.initialNavigationContext,{dealerId:'astrid',eventId:query.event,variantId:query.variant,situation:query.situation,laneId:query.lane,operatorId:query.operator,tableId:query.table,game:query.game});
  const h=await loaded(async()=>({items:[],nextCursor:null}),p);
  const links=()=>{const nav=nodes(h.render(),node=>node.props?.active==='replies')[0];return nodes(nav.type(nav.props),node=>node.type==='a');};
  const clips=()=>tabLink(links(),'clips');
  // The Klippkarta tab carries the exact Studio context; the token and the foreign tab never follow.
  const context=href=>{const url=new URL(href,'https://local.test');assert.ok(url.pathname.startsWith('/admin/dealers'),href);return Object.fromEntries(url.searchParams);};
  const full={dealer:'astrid',event:'speak.goodluck',variant:'astrid.goodluck.alt-2',situation:'goodluck',composition:'studio/main',operator:'fixture-operator',table:'fixture-room',game:'roulette'};
  const withoutDealer=href=>{const value=context(href);delete value.dealer;delete value.flik;return value;};
  assert.equal(links().some(link=>link.props.href.startsWith('/admin/compositions')),false);assert.deepEqual(withoutDealer(clips().props.href),(({dealer,...rest})=>rest)(full));
  const event={button:0,preventDefault(){this.blocked=true;}};clips().props.onClick(event);assert.equal(event.blocked,undefined);
  select(h.render(),'category').props.onChange({target:{value:'game-win'}});h.render();h.effects();await settle();assert.equal(new URL(h.window.location.href).searchParams.get('variant'),query.variant);assert.equal(new URL(h.window.location.href).searchParams.get('composition'),query.lane);assert.equal(h.calls.at(-1)[0],'/api/replies?dealer=astrid&category=game-win');const previousHref=h.window.location.href;assert.ok(new URL(previousHref).pathname.startsWith('/admin/dealers'));assert.equal(new URL(previousHref).searchParams.get('category'),'game-win');
  select(h.render(),'dealer').props.onChange({target:{value:'elin'}});h.render();h.effects();await settle();assert.deepEqual(withoutDealer(clips().props.href),{composition:'studio/main',operator:'fixture-operator',table:'fixture-room',game:'roulette'});assert.ok(clips().props.href.includes('elin'),'the new dealer follows');for(const key of ['event','variant','situation','token','tab'])assert.equal(new URL(h.window.location.href).searchParams.has(key),false);assert.equal(h.calls.at(-1)[0],'/api/replies?dealer=elin&category=game-win');assert.ok(h.window.location.pathname.startsWith('/admin/dealers'));for(const key of ['operator','table','game'])assert.equal(h.window.location.searchParams.get(key),query[key]);
  h.window.location.href=previousHref;h.window.location.search=new URL(previousHref).search;h.listeners.get('popstate')(new Event('popstate'));h.render();h.effects();await settle();assert.deepEqual(withoutDealer(clips().props.href),(({dealer,...rest})=>rest)(full));assert.ok(clips().props.href.includes('astrid'));assert.equal(h.state('category'),'game-win');
  for(const[url,init]of h.calls){assert.equal(parseStudioRepliesRequest(init.method??'GET',new URL(url,'https://local.test')).kind,'list');assert.deepEqual([...new URL(url,'https://local.test').searchParams.keys()],['dealer','category']);}
});

// Svarsbiblioteket is mounted inside the dealer nav (/admin/dealers/<d>?flik=tal). studioNavigationHref applies the dealer
// before it canonicalizes the retired tab paths, so every tab link and every filter or dealer write stays a nav address.
test('the embedded reply library links to its dealer nav tabs and filtering never leaves the nav',async()=>{
  const h=await loaded(async()=>({items:[],nextCursor:null}),{...props,initialHref:'/admin/dealers/astrid?flik=tal'});
  const nav=nodes(h.render(),node=>node.props?.active==='replies')[0],links=nodes(nav.type(nav.props),node=>node.type==='a');
  const href=id=>new URL(tabLink(links,id).props.href,'https://local.test');
  assert.equal(href('clips').pathname,'/admin/dealers/astrid');assert.equal(href('clips').searchParams.get('flik'),'klipp');
  assert.equal(href('speech').searchParams.get('flik'),'tal');assert.equal(href('replies').searchParams.get('flik'),'tal');
  assert.equal(href('settings').searchParams.get('flik'),'installningar');assert.equal(href('generate').searchParams.get('panel'),'generera');
  for(const link of links){const url=new URL(link.props.href,'https://local.test');assert.equal(url.pathname,'/admin/dealers/astrid',link.props.href);assert.equal(url.searchParams.has('dealer'),false,link.props.href);}
  // The nav owns a dealer: the library offers no "no dealer" choice that would open the dealer list.
  assert.equal(nodes(select(h.render(),'dealer'),node=>node.type==='option'&&node.props.value==='').length,0);
  select(h.render(),'category').props.onChange({target:{value:'game-win'}});h.render();h.effects();await settle();
  assert.equal(h.window.location.pathname,'/admin/dealers/astrid');assert.equal(h.window.location.searchParams.get('flik'),'tal');
  assert.equal(h.window.location.searchParams.get('category'),'game-win');
  // Another dealer opens that dealer's nav on the same tab; Back restores the dealer from the path.
  const before=h.window.location.href;
  select(h.render(),'dealer').props.onChange({target:{value:'elin'}});h.render();h.effects();await settle();
  assert.equal(h.window.location.pathname,'/admin/dealers/elin');assert.equal(h.window.location.searchParams.get('flik'),'tal');assert.equal(h.window.location.searchParams.has('dealer'),false);
  h.window.location.href=before;h.listeners.get('popstate')(new Event('popstate'));h.render();h.effects();await settle();
  assert.equal(h.state('dealerId'),'astrid');assert.equal(h.calls.at(-1)[0],'/api/replies?dealer=astrid&category=game-win');
});
