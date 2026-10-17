import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {transformSync} from 'esbuild';
import * as routing from './admin-routing.mjs';
import * as studioHistory from '../../../lab/lib/studio-history.mjs';

const require=createRequire(import.meta.url);
const runtime=transformSync(readFileSync(new URL('./navigation.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
const eventTarget=()=>{
  const listeners=new Map();
  return {addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(listener);},
    removeEventListener(type,listener){listeners.get(type)?.delete(listener);},
    dispatchEvent(event){for(const listener of listeners.get(event.type)??[])listener(event);return !event.defaultPrevented;}};
};
function harness(href='/admin',state=null){
  const origin='https://admin.fixture.invalid',entries=[{href,state:structuredClone(state)}],queue=[],native=[],notices=[],observed=[];
  let index=0,url=new URL(href,origin);
  const window=eventTarget();
  const location={get pathname(){return url.pathname;},get search(){return url.search;},get hash(){return url.hash;},get href(){return url.href;},origin,
    assign(href){native.push({method:'assign',href,allowed:window.dispatchEvent(new Event('beforeunload',{cancelable:true}))});},
    replace(href){native.push({method:'replace',href,allowed:window.dispatchEvent(new Event('beforeunload',{cancelable:true}))});}};
  const write=(state,href=url.href)=>({href:new URL(href,url).pathname+new URL(href,url).search+new URL(href,url).hash,state:structuredClone(state)});
  const history={get state(){return entries[index].state;},get length(){return entries.length;},
    pushState(state,unused,href){entries.splice(index+1);entries.push(write(state,href));index++;url=new URL(href??url.href,url);},
    replaceState(state,unused,href){entries[index]=write(state,href);url=new URL(href??url.href,url);},
    go(delta){queue.push(delta);}};
  Object.assign(window,{history,location,confirm:()=>assert.fail('unexpected confirmation')});
  const module={exports:{}};
  runInNewContext(runtime,{window,history,location,CustomEvent,URL,URLSearchParams,crypto:globalThis.crypto,module,exports:module.exports,
    require:name=>name==='react'?{useSyncExternalStore(subscribe,getSnapshot){const subscriber={value:getSnapshot(),notifications:0};observed.push(subscriber);subscribe(()=>{subscriber.value=getSnapshot();subscriber.notifications++;notices.push(location.href);});return subscriber.value;}}:name==='./admin-routing.mjs'?routing:name==='../../../lab/lib/studio-history.mjs'?studioHistory:require(name)});
  module.exports.usePathname();
  const step=()=>{const delta=queue.shift();if(delta===undefined)return false;if(index+delta>=0&&index+delta<entries.length){index+=delta;url=new URL(entries[index].href,origin);const event=new Event('popstate');event.state=history.state;window.dispatchEvent(event);}return true;};
  const flush=()=>{let steps=0;while(step())assert.ok(++steps<20,'restoration must settle');};
  return {api:module.exports,window,history,location,native,notices,observed,step,flush,
    go(delta){history.go(delta);flush();},index:()=>index,snapshot:()=>structuredClone(entries),paths:()=>entries.map(row=>row.href)};
}
function fourEntries(){const h=harness();for(const path of ['/admin/assets','/admin/dealers','/admin/clips'])assert.equal(h.api.navigate(path),true);return h;}

test('approved pushes, replacements, Back and Forward retain the normal stack',()=>{
  const h=fourEntries(),before=h.snapshot();h.go(-2);assert.equal(h.location.pathname,'/admin/assets');h.go(1);assert.equal(h.location.pathname,'/admin/dealers');
  assert.deepEqual(h.snapshot(),before);assert.equal(h.notices.length,5);
  h.api.navigate('/admin/rooms?view=registered',true);assert.equal(h.history.length,4);h.go(1);assert.equal(h.location.pathname,'/admin/clips');
  h.go(-1);assert.equal(h.location.search,'?view=registered');
});
for(const {name,start,delta} of [{name:'Back with a forward stack',start:2,delta:-1},{name:'Forward',start:1,delta:1},{name:'multiple steps Back',start:3,delta:-3}]){
  test(`vetoed ${name} restores the same entry without truncation or duplicates`,()=>{
    const h=fourEntries();h.go(start-3);const before=h.snapshot(),notices=h.notices.length;let prompts=0;
    h.window.addEventListener('scout:navigate',event=>{prompts++;event.preventDefault();});
    for(let attempt=0;attempt<3;attempt++){h.go(delta);assert.equal(h.index(),start);assert.deepEqual(h.snapshot(),before);}
    assert.equal(prompts,3,'compensating popstate must not ask the guards again');assert.equal(h.notices.length,notices,'veto must not unmount the draft');
  });
}

test('a rejected push or replacement creates no history entry',()=>{
  const h=fourEntries(),before=h.snapshot();h.window.addEventListener('scout:navigate',event=>event.preventDefault());
  assert.equal(h.api.navigate('/admin/assets'),false);assert.equal(h.api.navigate('/admin/assets',true),false);assert.deepEqual(h.snapshot(),before);
});

test('replaceContext keeps another consumer state and the index across a veto',()=>{
  const h=harness('/admin/clips',{next:{tree:['kept']},custom:'keep'}),first=h.snapshot()[0];
  h.api.replaceContext('/admin/clips?dealer=dragan#draft');const context=h.snapshot()[0];
  assert.deepEqual(context.state.next,first.state.next);assert.equal(context.state.custom,'keep');assert.equal(h.history.length,1);
  h.api.navigate('/admin/clips?dealer=dragan#draft',true);assert.equal(h.history.state.custom,'keep');assert.deepEqual(h.history.state.next,first.state.next);
  h.api.navigate('/admin/assets');h.go(-1);let prompts=0;h.window.addEventListener('scout:navigate',event=>{prompts++;event.preventDefault();});
  const before=h.snapshot();h.go(1);assert.deepEqual(h.snapshot(),before);assert.equal(h.location.search,'?dealer=dragan');assert.equal(h.location.hash,'#draft');assert.equal(prompts,1);
  h.api.replaceContext('/admin/clips?dealer=dragan#updated');assert.equal(h.history.state.custom,'keep');
});

test('context replacement waits for compensation and clicks cannot truncate the pending forward stack',()=>{
  const h=fourEntries();h.go(-1);h.api.replaceContext('/admin/dealers?dealer=astrid');let blocked=true;h.window.addEventListener('scout:navigate',event=>{if(blocked)event.preventDefault();});
  const before=h.snapshot();h.history.go(-1);h.step();assert.equal(h.index(),1);
  assert.equal(h.api.usePathname(),'/admin/dealers','a draft rerender must retain the accepted route during asynchronous compensation');
  assert.equal(h.api.useSearchParams().toString(),'dealer=astrid','the accepted query must also survive the compensation window');
  h.api.replaceContext('/admin/dealers?dealer=dragan');assert.equal(h.api.navigate('/admin'),false);assert.deepEqual(h.snapshot(),before);
  h.flush();assert.equal(h.observed.at(-1).value,'?dealer=dragan','an existing query subscriber must receive the deferred context after compensation');assert.equal(h.observed.at(-1).notifications,1);assert.equal(h.index(),2);assert.equal(h.location.search,'?dealer=dragan');assert.equal(h.history.length,4);assert.deepEqual(h.snapshot()[3],before[3]);
  blocked=false;h.go(1);assert.equal(h.location.pathname,'/admin/clips');
});

test('an unindexed entry uses the bounded fallback, retains the draft and leaves forward entries intact',()=>{
  const h=harness('/admin',{other:'A'});h.history.pushState({foreign:'older entry'},'','/admin/assets');h.api.navigate('/admin/dealers');h.api.navigate('/admin/clips');h.go(-1);
  const before=h.snapshot();let prompts=0;h.window.addEventListener('scout:navigate',event=>{prompts++;event.preventDefault();});h.go(-1);
  assert.equal(h.location.pathname,'/admin/dealers');assert.equal(h.history.length,4);assert.equal(h.index(),1);
  assert.deepEqual(h.snapshot().slice(2),before.slice(2));assert.equal(prompts,1);
  assert.equal(h.paths()[1],'/admin/dealers','the unknown destination is replaced because History API has no direction/index');
});

test('non-record history.state keeps its original type and value through context and route replacement',()=>{
  for(const state of ['foreign state',42,['array state'],new Map([['key','value']]),new Date('2026-01-01')]){
    const h=harness('/admin',state);assert.deepEqual(h.history.state,state);h.api.replaceContext('/admin?dealer=dragan');assert.deepEqual(h.history.state,state);
    h.api.navigate('/admin/assets',true);assert.deepEqual(h.history.state,state);assert.equal(h.history.length,1);
  }
});

test('native Admin tools still use document navigation and their beforeunload guard',()=>{
  for(const [source,target] of [['/admin','/admin/publication'],['/admin/publication','/admin']]){
    const h=harness(source);h.window.addEventListener('beforeunload',event=>event.preventDefault());const before=h.snapshot();
    assert.equal(h.api.navigate(target),true);assert.equal(h.api.navigate(target,true),true);
    assert.deepEqual(h.native,[{method:'assign',href:target,allowed:false},{method:'replace',href:target,allowed:false}]);assert.deepEqual(h.snapshot(),before);
  }
  for(const href of ['/control/login?returnTo=%2Fadmin','/control/set-password?token=fixture'])assert.equal(harness().api.previewHref(href),href);
});

for(const route of ['/admin/admin/accounts','/admin/admin/api','/admin/ai/models']){
  test(`native service ${route} uses document entries in both directions, including replacement`,()=>{
    for(const [source,target] of [['/admin/assets',route],[route,'/admin/assets']]){
      const h=harness(source);h.window.addEventListener('beforeunload',event=>event.preventDefault());const before=h.snapshot();
      assert.equal(h.api.navigate(target),true);assert.equal(h.api.navigate(target,true),true);
      assert.deepEqual(h.native,[{method:'assign',href:target,allowed:false},{method:'replace',href:target,allowed:false}]);
      assert.deepEqual(h.snapshot(),before,'document navigation must not create same-document entries for Back/Forward');
      assert.equal(h.notices.length,0,'the SPA must not hide the current form before its native guard runs');
    }
  });
}

test('native service navigation canonicalizes account bookmarks and preserves context and destination fragments',()=>{
  const h=harness('/admin/assets?operator=company&table=room&dealer=astrid&composition=scene&game=blackjack');
  h.api.navigate('/admin/admin/players?tab=users#invite',true);
  assert.deepEqual(h.native,[{method:'replace',href:'/admin/admin/accounts?tab=users&operator=company&table=room&dealer=astrid&composition=scene&game=blackjack#invite',allowed:true}]);
  for(const source of ['/admin/admin/players','/studio/admin/admin/players','/studio/admin/admin/accounts','/studio/admin/admin/api','/studio/admin/ai/models']){
    const h=harness(source+'?dealer=astrid');h.api.navigate('/admin/assets?game=roulette#library');
    assert.deepEqual(h.native,[{method:'assign',href:'/admin/assets?game=roulette&dealer=astrid#library',allowed:true}]);
  }
});

test('existing navigation vetoes cancel native service pushes and replacements before beforeunload',()=>{
  for(const guard of ['studio:before-navigate','scout:navigate'])for(const route of ['/admin/admin/accounts','/admin/admin/api','/admin/ai/models']){
    for(const [source,target] of [['/admin/assets',route],[route,'/admin/assets']]){
      const h=harness(source),before=h.snapshot();let prompts=0,unloads=0;
      h.window.addEventListener(guard,event=>{prompts++;event.preventDefault();});
      h.window.addEventListener('beforeunload',()=>unloads++);
      assert.equal(h.api.navigate(target),false);assert.equal(h.api.navigate(target,true),false);
      assert.equal(prompts,2);assert.equal(unloads,0);assert.deepEqual(h.native,[]);assert.deepEqual(h.snapshot(),before);assert.equal(h.notices.length,0);
    }
  }
});

test('read-only native service views retain normal SPA Back and Forward',()=>{
  const h=harness('/admin/assets');
  for(const route of ['/admin/drift','/admin/admin/payments','/admin/ekonomi'])assert.equal(h.api.navigate(route),true);
  const before=h.snapshot();h.go(-2);assert.equal(h.location.pathname,'/admin/drift');h.go(1);assert.equal(h.location.pathname,'/admin/admin/payments');
  assert.deepEqual(h.snapshot(),before);assert.deepEqual(h.native,[]);
});

async function mountImport(h){
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),componentUrl=new URL('../admin/components/studio/dealer-import-assistant.tsx',import.meta.url),componentRequire=createRequire(componentUrl);
  const catalog={dealers:[{id:'dragan',label:'Dragan'}],limits:{maxFileBytes:134217728,maxFiles:30},provider:{configured:false},slots:[{id:'deal.player.left/box0',label:'Plats 1',eventId:'deal.player.left',situation:'box0',kind:'action',category:'deal'}]};
  const slots=[],effects=[],cleanups=[];let cursor=0,finish;
  const react={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
    useRef(initial){return slots[cursor++]??={current:initial};},useEffect(effect,deps){const i=cursor++;if(!slots[i]||deps.some((dep,j)=>dep!==slots[i][j])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=effect();});}}};
  const module={exports:{}},code=transformSync(readFileSync(componentUrl,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
  runInNewContext(code,{module,exports:module.exports,AbortController,URL,URLSearchParams,crypto:globalThis.crypto,window:h.window,document:eventTarget(),setTimeout,
    fetch:async path=>Response.json(path.endsWith('/api/videos')?{uploadMode:'private-client-blob'}:catalog),
    require:name=>name==='react'?react:name.includes('upload-native-video.mjs')?{uploadNativeVideo:()=>assert.fail('no real upload')}
      :name.includes('media-upload-batch.mjs')?{uploadMediaBatch:(prepared,{onChange})=>new Promise(resolve=>{finish=()=>{for(const {row} of prepared)onChange(row.id,{state:'saved'});resolve(prepared.length);};})}:componentRequire(name)});
  const render=()=>{cursor=0;return module.exports.DealerImportAssistant({requestedDealerId:'dragan'});};
  const all=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(child=>all(child,predicate))];
  const nodes=predicate=>all(render(),predicate),settle=async()=>{for(let i=0;i<4;i++){render();for(const effect of effects.splice(0))effect();await new Promise(resolve=>setImmediate(resolve));}};
  await settle();
  nodes(node=>node.type==='input'&&node.props.type==='file')[0].props.onChange({target:{files:[new File([new Uint8Array(100)],'dragan-box1.mp4',{lastModified:1,type:'video/mp4'})]}});
  nodes(node=>node.props?.['aria-label']==='Fack för dragan-box1.mp4')[0].props.onChange({target:{value:catalog.slots[0].id}});
  nodes(node=>node.props?.['aria-label']==='Bakgrund för dragan-box1.mp4')[0].props.onChange({target:{value:'green-screen'}});
  nodes(node=>node.type==='button'&&node.props.className==='dealer-import-primary').at(-1).props.onClick();await settle();
  return {html:()=>renderToStaticMarkup(render()),async finish(){assert.equal(typeof finish,'function');finish();await settle();},unmount(){for(const cleanup of cleanups)cleanup?.();}};
}

test('actual pending import files veto Back and Forward before Studio context changes and survive compensation',async()=>{
  const h=fourEntries();h.go(-1);const draft=await mountImport(h);let laterGuardCalls=0;h.window.addEventListener('scout:navigate',()=>laterGuardCalls++);
  try{
    const before=h.snapshot(),notices=h.notices.length;assert.equal(h.window.dispatchEvent(new Event('beforeunload',{cancelable:true})),false);
    for(const delta of [-1,1,-2]){h.go(delta);assert.deepEqual(h.snapshot(),before);assert.equal(h.index(),2);assert.match(draft.html(),/dragan-box1.mp4/);}
    assert.equal(laterGuardCalls,0);assert.equal(h.notices.length,notices);
    await draft.finish();assert.equal(h.window.dispatchEvent(new Event('beforeunload',{cancelable:true})),true);h.go(1);assert.equal(h.location.pathname,'/admin/clips');assert.equal(laterGuardCalls,1);
  }finally{draft.unmount();}
});

async function mountClipMap(h){
  const React=require('react'),componentUrl=new URL('../admin/components/studio/connected-clip-map.tsx',import.meta.url),componentRequire=createRequire(componentUrl);
  const {createSeedProject,defaultPresentationLane,addDealer}=componentRequire('../../../../../lab/lib/studio-model.mjs');
  const project=addDealer(createSeedProject(),'nora','Nora');
  project.lanes=['a','b'].map(id=>({...defaultPresentationLane('astrid'),id:'scene-'+id}));
  const workspace={project,inventory:{videos:[]},catalog:{administration:{
    operators:['a','b'].map(id=>({id,slug:id,name:id,status:'active',archivedAt:null})),
    rooms:['a','b'].map(id=>({id:'room-'+id,operatorId:id,name:id,game:id==='a'?'blackjack':'roulette',compositionId:'scene-'+id,state:'draft',published:false,dealerIds:['astrid','nora']})),
    dealers:[{id:'astrid'},{id:'nora'}],
  }}};
  const slots=[],effects=[],cleanups=[];let cursor=0;
  const depsChanged=(before,next)=>!before||next.some((dep,j)=>!Object.is(dep,before[j]));
  const react={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
    useRef(initial){return slots[cursor++]??={current:initial};},
    useMemo(factory,deps){const i=cursor++;if(!slots[i]||depsChanged(slots[i].deps,deps))slots[i]={deps,value:factory()};return slots[i].value;},
    useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
    useEffect(effect,deps){const i=cursor++;if(depsChanged(slots[i],deps)){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=effect();});}}};
  const components=new Proxy({},{get:(_,name)=>name==='__esModule'?false:String(name)});
  const flow={...components,ReactFlowProvider:'FlowProvider',ReactFlow:'Flow',Controls:'Controls',MiniMap:'MiniMap',Background:'Background',BackgroundVariant:{Dots:'dots'},useReactFlow:()=>({setViewport(){}}),
    useNodesState(initial){const [value,setValue]=react.useState(initial);return [value,setValue,()=>{}];}};
  const module={exports:{}},code=transformSync(readFileSync(componentUrl,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
  runInNewContext(code,{module,exports:module.exports,AbortController,URL,URLSearchParams,structuredClone,location:h.location,window:h.window,document:eventTarget(),
    confirm:()=>assert.fail('ordinary pane navigation must not discard its draft'),
    require:name=>name==='react'?react:name==='@xyflow/react'?flow:name.endsWith('.css')?{}
      :name==='../../../runtime/navigation'?h.api:name==='../../../runtime/admin-routing.mjs'?routing
      :name==='../../lib/connected-studio.mjs'?{...componentRequire(name),clipSlots:()=>[],createStudioClient:()=>({load:async()=>structuredClone(workspace)})}
      :name==='lucide-react'||name.startsWith('./')?components:componentRequire(name)});
  const render=()=>{cursor=0;const element=module.exports.ConnectedClipMap({}).props.children;return element.type(element.props);};
  const all=(tree,predicate)=>!tree||typeof tree!=='object'?[]:[...(predicate(tree)?[tree]:[]),...React.Children.toArray(tree.props?.children).flatMap(child=>all(child,predicate))];
  const nodes=predicate=>all(render(),predicate),settle=async()=>{for(let i=0;i<5;i++){render();for(const effect of effects.splice(0))effect();await new Promise(resolve=>setImmediate(resolve));}};
  const textWithoutControls=tree=>typeof tree==='string'||typeof tree==='number'?String(tree)
    :!tree||tree.type==='select'?'':React.Children.toArray(tree.props?.children).map(textWithoutControls).join('');
  const one=(matches,description)=>{assert.equal(matches.length,1,description);return matches[0];};
  const select=label=>{
    const named=nodes(node=>node.type==='select'&&node.props['aria-label']===label);
    if(named.length)return one(named,'select labelled '+label);
    const field=one(nodes(node=>node.type==='label'&&textWithoutControls(node)===label),'field labelled '+label);
    return one(all(field,node=>node.type==='select'),'select within '+label);
  };
  const button=label=>one(nodes(node=>node.type==='button'&&(node.props['aria-label']??textWithoutControls(node))===label),'button labelled '+label);
  await settle();
  return {settle,selection:()=>({operator:select('Spelbolag').props.value,game:select('Spel').props.value,room:select('Rum').props.value,dealer:select('Dealer').props.value}),
    async dealer(id){select('Dealer').props.onChange({target:{value:id}});await settle();},
    async editDraft(){
      button('Gemensam sammansättningsmall').props.onClick();await settle();
      const inspector=one(nodes(node=>node.type==='aside'&&node.props['aria-label']==='Klipp och inställningar'),'clip inspector');
      assert.equal(inspector.props.hidden,false,'composition editor must open in the detail panel');
      const panel=one(all(inspector,node=>node.type==='StudioCompositionPanel'),'composition editor'),draft=structuredClone(panel.props.project);
      draft.dealers.find(row=>row.id==='nora').label='Nora draft';panel.props.onEdit(draft);await settle();
    },
    hasDraft:()=>all(select('Dealer'),node=>node.type==='option').some(node=>node.props.children==='Nora draft'),
    unmount(){for(const cleanup of cleanups)cleanup?.();}};
}

test('mounted clip pane reactivation writes the retained full context before Back, Forward and reload',async()=>{
  const h=harness('/admin/clips?operator=b&table=room-b&game=roulette'),pane=await mountClipMap(h);
  try{
    await pane.dealer('nora');await pane.editDraft();const selection=pane.selection();
    assert.deepEqual(selection,{operator:'b',game:'roulette',room:'room-b',dealer:'nora'});
    h.api.navigate('/admin');await pane.settle();assert.equal(h.location.search,'');assert.ok(pane.hasDraft());
    h.api.navigate('/admin/clips');await pane.settle();
    const params=new URLSearchParams(h.location.search);
    for(const [key,value] of Object.entries({operator:'b',table:'room-b',composition:'scene-b',dealer:'nora',game:'roulette'}))assert.equal(params.get(key),value,key);
    h.go(-1);await pane.settle();assert.equal(h.location.pathname,'/admin');assert.equal(h.location.search,'');
    h.go(1);await pane.settle();assert.deepEqual(pane.selection(),selection);assert.ok(pane.hasDraft());
    const reload=await mountClipMap(harness(h.location.pathname+h.location.search));
    try{assert.deepEqual(reload.selection(),selection);}finally{reload.unmount();}
  }finally{pane.unmount();}
});

test('mounted clip pane keeps room-owned context through accepted query changes and history',async()=>{
  const h=harness('/admin/clips?operator=a&table=room-a&game=blackjack'),pane=await mountClipMap(h);
  try{
    h.api.navigate('/admin/clips?operator=b&table=room-b&dealer=nora&game=roulette&category=bank');await pane.settle();
    assert.deepEqual(pane.selection(),{operator:'b',game:'roulette',room:'room-b',dealer:'nora'});
    assert.equal(new URLSearchParams(h.location.search).get('composition'),'scene-b');
    assert.equal(new URLSearchParams(h.location.search).get('category'),'bank');
    const target=h.location.search;
    h.go(-1);await pane.settle();assert.deepEqual(pane.selection(),{operator:'a',game:'blackjack',room:'room-a',dealer:'astrid'});
    assert.equal(new URLSearchParams(h.location.search).get('composition'),'scene-a');
    h.go(1);await pane.settle();assert.deepEqual(pane.selection(),{operator:'b',game:'roulette',room:'room-b',dealer:'nora'});assert.equal(h.location.search,target);
  }finally{pane.unmount();}
});

test('mounted clip pane ignores rejected history destinations and defers context onto the restored entry',async()=>{
  const h=harness('/admin/clips?operator=a&table=room-a&game=blackjack'),pane=await mountClipMap(h);
  try{
    h.api.navigate('/admin/clips?operator=b&table=room-b&dealer=nora&game=roulette');await pane.settle();
    let blocked=true;h.window.addEventListener('studio:before-navigate',event=>{if(blocked)event.preventDefault();});
    const before=h.snapshot();h.history.go(-1);h.step();await pane.settle();
    assert.deepEqual(pane.selection(),{operator:'b',game:'roulette',room:'room-b',dealer:'nora'});assert.deepEqual(h.snapshot(),before);
    await pane.dealer('astrid');assert.deepEqual(h.snapshot(),before,'a render while compensation is pending must not rewrite its rejected destination');
    h.flush();await pane.settle();assert.equal(h.index(),1);assert.equal(h.history.length,2);assert.deepEqual(h.snapshot()[0],before[0]);
    const params=new URLSearchParams(h.location.search);
    for(const [key,value] of Object.entries({operator:'b',table:'room-b',composition:'scene-b',dealer:'astrid',game:'roulette'}))assert.equal(params.get(key),value,key);
    blocked=false;h.go(-1);await pane.settle();assert.deepEqual(pane.selection(),{operator:'a',game:'blackjack',room:'room-a',dealer:'astrid'});
    h.go(1);await pane.settle();assert.deepEqual(pane.selection(),{operator:'b',game:'roulette',room:'room-b',dealer:'astrid'});
  }finally{pane.unmount();}
});
