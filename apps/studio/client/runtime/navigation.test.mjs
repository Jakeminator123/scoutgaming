import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {transformSync} from 'esbuild';
import * as routing from './admin-routing.mjs';
import * as studioHistory from '../../lib/studio-history.mjs';

const require=createRequire(import.meta.url);
const runtime=transformSync(readFileSync(new URL('./navigation.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
// Each component compiles once per file; every mount still evaluates it in a fresh context.
const compiledComponents=new Map();
const compiledComponent=url=>{
  const key=String(url);
  if(!compiledComponents.has(key))compiledComponents.set(key,transformSync(readFileSync(url,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code);
  return compiledComponents.get(key);
};
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
    require:name=>name==='react'?{useSyncExternalStore(subscribe,getSnapshot){const subscriber={value:getSnapshot(),notifications:0};observed.push(subscriber);subscribe(()=>{subscriber.value=getSnapshot();subscriber.notifications++;notices.push(location.href);});return subscriber.value;}}:name==='./admin-routing.mjs'?routing:name==='../../lib/studio-history.mjs'?studioHistory:require(name)});
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

test('retired dependency bookmarks replace themselves with the merged page and keep their selection',()=>{
  const h=harness('/admin/deletion?operator=north&table=room-1#resource-room-726f6f6d2d31');
  assert.equal(h.api.navigate('/admin/structure?operator=north&table=room-1#resource-room-726f6f6d2d31',true),true);
  assert.equal(h.history.length,1);assert.equal(h.location.pathname,'/admin/structure');
  assert.equal(h.location.search,'?operator=north&table=room-1');assert.equal(h.location.hash,'#resource-room-726f6f6d2d31');
  const link=harness('/admin/clips?dealer=saga');
  assert.equal(link.api.previewHref('/admin/deletion?operator=north'),'/admin/structure?operator=north','links to the retired page resolve to the merged page');
  assert.equal(link.api.navigate('/admin/deletion?operator=north'),true);
  assert.equal(link.location.pathname,'/admin/structure');assert.equal(link.location.search,'?operator=north&dealer=saga');
  assert.deepEqual(link.native,[]);
});

test('native Admin tools still use document navigation and their beforeunload guard',()=>{
  for(const [source,target] of [['/admin','/admin/companies'],['/admin/companies','/admin']]){
    const h=harness(source);h.window.addEventListener('beforeunload',event=>event.preventDefault());const before=h.snapshot();
    assert.equal(h.api.navigate(target),true);assert.equal(h.api.navigate(target,true),true);
    assert.deepEqual(h.native,[{method:'assign',href:target,allowed:false},{method:'replace',href:target,allowed:false}]);assert.deepEqual(h.snapshot(),before);
  }
});

for(const route of ['/admin/admin/accounts','/admin/admin/api','/admin/players']){
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
  assert.deepEqual(h.native,[{method:'replace',href:'/admin/players?tab=users&operator=company&table=room&dealer=astrid&composition=scene&game=blackjack#invite',allowed:true}]);
  for(const source of ['/admin/admin/players','/studio/admin/admin/players','/studio/admin/admin/accounts','/studio/admin/admin/api','/studio/admin/players']){
    const h=harness(source+'?dealer=astrid');h.api.navigate('/admin/assets?game=roulette#library');
    assert.deepEqual(h.native,[{method:'assign',href:'/admin/assets?game=roulette&dealer=astrid#library',allowed:true}]);
  }
});

test('existing navigation vetoes cancel native service pushes and replacements before beforeunload',()=>{
  for(const guard of ['studio:before-navigate','scout:navigate'])for(const route of ['/admin/admin/accounts','/admin/admin/api','/admin/players']){
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
  const before=h.snapshot();h.go(-2);assert.equal(h.location.pathname,'/admin/drift');h.go(1);assert.equal(h.location.pathname,'/admin/ekonomi');assert.equal(new URLSearchParams(h.location.search).get('tab'),'payments');
  assert.deepEqual(h.snapshot(),before);assert.deepEqual(h.native,[]);
});

async function mountImport(h){
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),componentUrl=new URL('../admin/components/studio/dealer-import-assistant.tsx',import.meta.url),componentRequire=createRequire(componentUrl);
  const catalog={dealers:[{id:'dragan',label:'Dragan'}],limits:{maxFileBytes:134217728,maxFiles:30},provider:{configured:false},slots:[{id:'deal.player.left/box0',label:'Plats 1',eventId:'deal.player.left',situation:'box0',kind:'action',category:'deal'}]};
  const slots=[],effects=[],cleanups=[];let cursor=0,finish;
  const react={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
    useRef(initial){return slots[cursor++]??={current:initial};},useEffect(effect,deps){const i=cursor++;if(!slots[i]||deps.some((dep,j)=>dep!==slots[i][j])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=effect();});}}};
  const module={exports:{}},code=compiledComponent(componentUrl);
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

function mountScenePlacement(){
  const React=require('react'),components=new Proxy({},{get:(_,name)=>name==='__esModule'?false:String(name)});
  function mount(relative,name){
    const url=new URL(relative,import.meta.url),localRequire=createRequire(url),slots=[];let cursor=0;
    const hooks={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef(initial){return slots[cursor++]??={current:initial};}};
    const module={exports:{}},code=compiledComponent(url);
    runInNewContext(code,{module,exports:module.exports,structuredClone,require:specifier=>specifier==='react'?hooks:specifier.endsWith('.css')?{}
      :specifier==='./scene-publication'?{ScenePublication:()=>null}:specifier.includes('/components/')&&!specifier.endsWith('.mjs')?components:localRequire(specifier)});
    return props=>{cursor=0;return module.exports[name](props);};
  }
  const panel=mount('../admin/components/studio/studio-composition-panel.tsx','StudioCompositionPanel');
  const editor=mount('../../components/blackjack-scene-placement-editor.tsx','BlackjackScenePlacementEditor');
  const all=(tree,predicate)=>!tree||typeof tree!=='object'?[]:[...(predicate(tree)?[tree]:[]),...React.Children.toArray(tree.props?.children).flatMap(child=>all(child,predicate))];
  const text=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):!tree?'':React.Children.toArray(tree.props?.children).map(text).join('');
  let panelTree,editorTree,editorProps,project;
  return {render(props){project=props.project;panelTree=panel(props);editorProps=all(panelTree,node=>node.type==='BlackjackScenePlacementEditor')[0]?.props;editorTree=editorProps?editor(editorProps):null;},
    project:()=>structuredClone(project),
    hasPlacement:()=>Boolean(editorProps),
    edit:profile=>editorProps.onChange(profile),
    click(label){const node=all(panelTree,node=>node.type==='button'&&text(node)===label)[0]??all(editorTree,node=>node.type==='button'&&text(node)===label)[0];assert.ok(node,'scene button '+label);assert.equal(Boolean(node.props.disabled),false,label+' is enabled');node.props.onClick();},
    disabled:()=>editorProps.disabled};
}

async function mountClipMap(h,{scene=false}={}){
  const React=require('react'),componentUrl=new URL('../admin/components/studio/connected-clip-map.tsx',import.meta.url),componentRequire=createRequire(componentUrl);
  const {createSeedProject,defaultPresentationLane,addDealer}=componentRequire('../../../../../../packages/presentation/contracts/studio-model.mjs');
  const project=addDealer(createSeedProject(),'nora','Nora');
  project.lanes=['a','b'].map(id=>({...defaultPresentationLane('astrid'),id:'scene-'+id}));
  if(scene){
    const {defaultCompositionSettings,defaultBlackjackTableGeometry}=componentRequire('../../../../../../packages/presentation/contracts/composition-settings.mjs');
    const {layerAssetPath}=componentRequire('../../../../../../packages/presentation/contracts/layer-asset-contract.mjs');
    const table={schemaVersion:1,id:'00000000-0000-4000-8000-000000000002',role:'table',game:'blackjack',label:'Oak',sha256:'a'.repeat(64),size:1024,contentType:'image/png',width:1672,height:941};
    project.layerAssets=[{...table,pathname:layerAssetPath(table)}];
    for(const lane of project.lanes){
      lane.layers.table={enabled:true,default:table.id,allowed:[table.id]};
      lane.composition={...defaultCompositionSettings(),blackjackTables:[defaultBlackjackTableGeometry(table.id)]};
    }
  }
  const workspace={project,inventory:{videos:[]},catalog:{administration:{
    operators:['a','b'].map(id=>({id,slug:id,name:id,status:'active',archivedAt:null})),
    rooms:['a','b'].map(id=>({id:'room-'+id,operatorId:id,name:id,game:id==='a'?'blackjack':'roulette',compositionId:'scene-'+id,state:'draft',published:false,dealerIds:['astrid','nora']})),
    dealers:[{id:'astrid'},{id:'nora'}],
  }}};
  const slots=[],effects=[],cleanups=[],saveAttempts=[];let cursor=0;
  const depsChanged=(before,next)=>!before||next.some((dep,j)=>!Object.is(dep,before[j]));
  const react={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
    useRef(initial){return slots[cursor++]??={current:initial};},
    useMemo(factory,deps){const i=cursor++;if(!slots[i]||depsChanged(slots[i].deps,deps))slots[i]={deps,value:factory()};return slots[i].value;},
    useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
    useEffect(effect,deps){const i=cursor++;if(depsChanged(slots[i],deps)){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=effect();});}}};
  const components=new Proxy({},{get:(_,name)=>name==='__esModule'?false:String(name)});
  const flow={...components,ReactFlowProvider:'FlowProvider',ReactFlow:'Flow',Controls:'Controls',MiniMap:'MiniMap',Background:'Background',BackgroundVariant:{Dots:'dots'},useReactFlow:()=>({setViewport(){}}),
    useNodesState(initial){const [value,setValue]=react.useState(initial);return [value,setValue,()=>{}];}};
  const module={exports:{}},code=compiledComponent(componentUrl);
  runInNewContext(code,{module,exports:module.exports,AbortController,URL,URLSearchParams,structuredClone,location:h.location,window:h.window,document:eventTarget(),
    confirm:()=>assert.fail('ordinary pane navigation must not discard its draft'),
    require:name=>name==='react'?react:name==='@xyflow/react'?flow:name.endsWith('.css')?{}
      :name==='../../../runtime/navigation'?h.api:name==='../../../runtime/admin-routing.mjs'?routing
      :name==='../../lib/connected-studio.mjs'?{...componentRequire(name),clipSlots:()=>[],createStudioClient:()=>({load:async()=>structuredClone(workspace),save:async next=>{
        saveAttempts.push(structuredClone(next));
        if(next.revision!==workspace.project.revision)throw Object.assign(new Error('Revision conflict'),{statusCode:409});
        workspace.project=structuredClone({...next,revision:'fixture.scene.saved'});return structuredClone(workspace.project);}})}
      :name==='lucide-react'||name.startsWith('./')||name==='../../../../components/studio-navigation'||name==='../../../../components/probe-editor'?components:componentRequire(name)});
  const all=(tree,predicate)=>!tree||typeof tree!=='object'?[]:[...(predicate(tree)?[tree]:[]),...React.Children.toArray(tree.props?.children).flatMap(child=>all(child,predicate))];
  let scenePanel=null,sceneMounts=0;
  const render=()=>{cursor=0;const element=module.exports.ConnectedClipMap({}).props.children,tree=element.type(element.props);
    if(scene){const panel=all(tree,node=>node.type==='StudioCompositionPanel')[0];
      if(!panel)scenePanel=null;
      else{if(!scenePanel){scenePanel=mountScenePlacement();sceneMounts++;}scenePanel.render(panel.props);}
    }return tree;};
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
    registeredRooms:()=>structuredClone(workspace.catalog.administration.rooms),
    composition:()=>nodes(node=>node.type==='StudioCompositionPanel')[0]?.props.compositionId,
    scene:{mounts:()=>sceneMounts,isMounted:()=>Boolean(scenePanel),snapshot:()=>scenePanel.project(),
      hasPlacement:()=>scenePanel?.hasPlacement()??false,
      async open(){nodes(node=>node.type==='button'&&textWithoutControls(node)==='Öppna sceneditor')[0].props.onClick();await settle();},
      async leave(){nodes(node=>node.type==='button'&&textWithoutControls(node)==='Scenförhandsvisning')[0].props.onClick();await settle();},
      async click(label){scenePanel.click(label);await settle();},
      async edit(profile){assert.equal(scenePanel.disabled(),false);scenePanel.edit(profile);await settle();},
      remote(project){workspace.project=structuredClone(project);},
      async compare(){button('Jämför senaste revision').props.onClick();await settle();},
      async save(){const save=button('Spara utkast'),before=saveAttempts.length;assert.equal(Boolean(save.props.disabled),false,'draft save is enabled');
        save.props.onClick();await settle();
        assert.equal(saveAttempts.length,before+1,'one click sends the draft directly');return structuredClone(saveAttempts.at(-1));}},
    async dealer(id){select('Dealer').props.onChange({target:{value:id}});await settle();},
    async editDraft(){
      button('Öppna sceneditor').props.onClick();await settle();
      const inspector=one(nodes(node=>node.type==='aside'&&node.props['aria-label']==='Klipp och inställningar'),'clip inspector');
      assert.equal(inspector.props.hidden,false,'composition editor must open in the detail panel');
      const panel=one(all(inspector,node=>node.type==='StudioCompositionPanel'),'composition editor'),draft=structuredClone(panel.props.project);
      draft.dealers.find(row=>row.id==='nora').label='Nora draft';panel.props.onEdit(draft);await settle();
    },
    hasDraft:()=>all(select('Dealer'),node=>node.type==='option').some(node=>node.props.children==='Nora draft'),
    unmount(){for(const cleanup of cleanups)cleanup?.();}};
}

const sceneGeometry=project=>project.lanes[0].composition.blackjackTables[0];
function movedGeometry(source,offset){
  const next=structuredClone(source);
  for(const layout of ['mobile','desktop']){
    const value=next[layout];value.dealer={x:.2+offset,y:.1+offset};value.cardWidth=.05+offset/10;
    value.seats.forEach((seat,i)=>{seat.card={x:.1+i*.1,y:.2+offset};seat.bet={x:.15+i*.1,y:.4+offset};});
    value.anchors={cards:{target:'dealer',rect:{x:offset,y:offset,width:1,height:1}},bets:{target:'scene',rect:{x:-offset,y:offset,width:1,height:1}}};
    value.betMode='under-cards';
  }
  return next;
}
function geometryGroup(value,group){
  return group==='cards'?{dealer:value.dealer,width:value.cardWidth,points:value.seats.map(seat=>seat.card),anchor:value.anchors?.cards}
    :{points:value.seats.map(seat=>seat.bet),mode:value.betMode,anchor:value.anchors?.bets};
}

for(const selected of ['a','b'])test(`the receiving scene editor keeps room A while editing explicit template ${selected.toUpperCase()}`,async()=>{
  const h=harness(`/admin/scenes?operator=a&table=room-a&composition=scene-${selected}&dealer=astrid&game=blackjack`);
  const pane=await mountClipMap(h,{scene:true}),scene=pane.scene;
  try{
    const rooms=pane.registeredRooms(),before=scene.snapshot();
    assert.equal(pane.composition(),'scene-'+selected);assert.equal(scene.hasPlacement(),true);
    assert.deepEqual(pane.selection(),{operator:'a',room:'room-a',dealer:'astrid',game:'blackjack'});
    assert.equal(new URLSearchParams(h.location.search).get('composition'),'scene-'+selected);
    await scene.click('Redigera gemensam mall');
    const chosen=before.lanes.find(row=>row.id==='scene-'+selected),profile=movedGeometry(chosen.composition.blackjackTables[0],.15);
    await scene.edit(profile);
    const after=scene.snapshot();
    assert.deepEqual(after.lanes.find(row=>row.id==='scene-'+selected).composition.blackjackTables[0],profile);
    assert.deepEqual(after.lanes.find(row=>row.id!==chosen.id),before.lanes.find(row=>row.id!==chosen.id));
    const sent=await scene.save();assert.equal(sent.revision,before.revision);
    assert.deepEqual(sent.lanes.find(row=>row.id===chosen.id).composition.blackjackTables[0],profile);
    assert.deepEqual(sent.lanes.find(row=>row.id!==chosen.id),before.lanes.find(row=>row.id!==chosen.id));
    assert.equal(scene.snapshot().revision,'fixture.scene.saved');
    assert.deepEqual(pane.registeredRooms(),rooms,'editing and saving a template must not reassign its context room');
    assert.equal(pane.registeredRooms().find(row=>row.id==='room-a').compositionId,'scene-a');
    for(const [key,value] of Object.entries({operator:'a',table:'room-a',composition:'scene-'+selected,dealer:'astrid',game:'blackjack'}))assert.equal(new URLSearchParams(h.location.search).get(key),value);
  }finally{pane.unmount();}
});

test('an already mounted receiver accepts a composition-only link and history without replacing room ownership',async()=>{
  const h=harness('/admin/scenes?operator=a&table=room-a&composition=scene-a&dealer=astrid&game=blackjack');
  const pane=await mountClipMap(h,{scene:true});
  try{
    const rooms=pane.registeredRooms();
    assert.equal(h.api.navigate('/admin/scenes?composition=scene-b'),true);await pane.settle();
    assert.equal(pane.composition(),'scene-b');assert.equal(pane.scene.hasPlacement(),true);
    assert.deepEqual(pane.selection(),{operator:'a',room:'room-a',dealer:'astrid',game:'blackjack'});
    h.go(-1);await pane.settle();assert.equal(pane.composition(),'scene-a');
    h.go(1);await pane.settle();assert.equal(pane.composition(),'scene-b');
    assert.deepEqual(pane.registeredRooms(),rooms);
  }finally{pane.unmount();}
});

test('an unknown explicit receiver composition stays invalid instead of editing the context room template',async()=>{
  const h=harness('/admin/scenes?operator=a&table=room-a&composition=missing&dealer=astrid&game=blackjack');
  const pane=await mountClipMap(h,{scene:true});
  try{
    assert.equal(pane.composition(),'missing');assert.equal(pane.scene.hasPlacement(),false);
    assert.equal(new URLSearchParams(h.location.search).get('composition'),'missing');
    assert.equal(pane.selection().room,'room-a');assert.equal(pane.registeredRooms()[0].compositionId,'scene-a');
  }finally{pane.unmount();}
});

for(const existing of [false,true])test(`explicit scene game survives a different registered room game${existing?' in a mounted pane':''}`,async()=>{
  const target='/admin/scenes?operator=b&table=room-b&composition=scene-a&dealer=astrid&game=blackjack';
  const h=harness(existing?'/admin/clips?operator=b&table=room-b&game=roulette':target),pane=await mountClipMap(h,{scene:true});
  try{
    const rooms=pane.registeredRooms();
    if(existing){assert.equal(h.api.navigate(target),true);await pane.settle();}
    assert.deepEqual(pane.selection(),{operator:'b',room:'room-b',dealer:'astrid',game:'blackjack'});
    assert.equal(pane.composition(),'scene-a');assert.equal(pane.scene.hasPlacement(),true);
    assert.equal(new URLSearchParams(h.location.search).get('game'),'blackjack');
    const before=pane.scene.snapshot();await pane.scene.click('Redigera gemensam mall');
    await pane.scene.edit(movedGeometry(before.lanes[0].composition.blackjackTables[0],.12));
    assert.deepEqual(pane.scene.snapshot().lanes[1],before.lanes[1]);
    assert.deepEqual(pane.registeredRooms(),rooms);assert.equal(rooms.find(row=>row.id==='room-b').game,'roulette');
  }finally{pane.unmount();}
});

test('a receiver can edit an explicit library scene without assigning a company or room',async()=>{
  const h=harness('/admin/scenes?composition=scene-b&dealer=astrid&game=blackjack');
  const pane=await mountClipMap(h,{scene:true});
  try{
    const rooms=pane.registeredRooms(),original=pane.scene.snapshot();
    assert.equal(pane.composition(),'scene-b');assert.equal(pane.scene.hasPlacement(),true);
    assert.deepEqual(pane.selection(),{operator:'',room:'',dealer:'astrid',game:'blackjack'});
    await pane.scene.click('Redigera gemensam mall');await pane.scene.edit(movedGeometry(original.lanes[1].composition.blackjackTables[0],.1));
    assert.deepEqual(pane.scene.snapshot().lanes[0],original.lanes[0]);assert.deepEqual(pane.registeredRooms(),rooms);
    assert.equal(new URLSearchParams(h.location.search).has('table'),false);
  }finally{pane.unmount();}
});

test('a mounted receiver takes the new room game and template when the target omits both',async()=>{
  const h=harness('/admin/scenes?operator=a&table=room-a&composition=scene-a&dealer=astrid&game=blackjack');
  const pane=await mountClipMap(h,{scene:true});
  try{
    const rooms=pane.registeredRooms();
    assert.equal(h.api.navigate('/admin/scenes?operator=b&table=room-b'),true);await pane.settle();
    assert.deepEqual(pane.selection(),{operator:'b',room:'room-b',dealer:'astrid',game:'roulette'});
    assert.equal(pane.composition(),'scene-b');assert.equal(pane.scene.hasPlacement(),false,'roulette must not show the blackjack placement editor');
    const target=h.location.search,query=new URLSearchParams(target);
    assert.equal(query.get('game'),'roulette');assert.equal(query.get('composition'),'scene-b');
    h.go(-1);await pane.settle();assert.equal(pane.selection().game,'blackjack');assert.equal(pane.composition(),'scene-a');
    h.go(1);await pane.settle();assert.equal(pane.selection().game,'roulette');assert.equal(pane.composition(),'scene-b');
    assert.equal(h.location.search,target);assert.deepEqual(pane.registeredRooms(),rooms);
  }finally{pane.unmount();}
});

for(const layout of ['mobile','desktop'])for(const group of ['cards','bets'])test(`scene reset uses the saved ${layout} ${group} after unmount, retained drafts and a later save`,async()=>{
  const pane=await mountClipMap(harness('/admin/clips?operator=a&table=room-a&game=blackjack'),{scene:true}),scene=pane.scene;
  try{
    await scene.open();const saved=sceneGeometry(scene.snapshot());
    await scene.click('Redigera gemensam mall');const draftB=movedGeometry(saved,.1);await scene.edit(draftB);
    await scene.leave();assert.equal(scene.isMounted(),false,'switching away unmounts the real composition panel');
    await scene.open();assert.equal(scene.mounts(),2);assert.deepEqual(sceneGeometry(scene.snapshot()),draftB,'parent retains draft B');
    await scene.click('Redigera gemensam mall');await scene.click(layout==='mobile'?'Mobil':'Desktop');
    const draftC=movedGeometry(saved,.2);await scene.edit(draftC);
    const reset=group==='cards'?'Återställ sparade kort':'Återställ sparade marker',otherGroup=group==='cards'?'bets':'cards',otherLayout=layout==='mobile'?'desktop':'mobile';
    await scene.click(reset);let actual=sceneGeometry(scene.snapshot());
    assert.deepEqual(geometryGroup(actual[layout],group),geometryGroup(saved[layout],group),'reset returns saved A, never remount draft B');
    assert.deepEqual(geometryGroup(actual[layout],otherGroup),geometryGroup(draftC[layout],otherGroup),'other group keeps draft C');
    assert.deepEqual(actual[otherLayout],draftC[otherLayout],'other format keeps draft C');
    await scene.edit(movedGeometry(saved,.25));await scene.save();const newlySaved=sceneGeometry(scene.snapshot());assert.equal(scene.snapshot().revision,'fixture.scene.saved');
    const draftD=movedGeometry(saved,.3);await scene.edit(draftD);await scene.leave();await scene.open();assert.equal(scene.mounts(),3);
    await scene.click('Redigera gemensam mall');await scene.click(layout==='mobile'?'Mobil':'Desktop');await scene.click(reset);
    actual=sceneGeometry(scene.snapshot());
    assert.deepEqual(geometryGroup(actual[layout],group),geometryGroup(newlySaved[layout],group),'successful save advances the reset baseline');
    assert.deepEqual(geometryGroup(actual[layout],otherGroup),geometryGroup(draftD[layout],otherGroup));assert.deepEqual(actual[otherLayout],draftD[otherLayout]);
  }finally{pane.unmount();}
});

test('scene reset uses the compared server baseline while preserving the rebased draft',async()=>{
  const pane=await mountClipMap(harness('/admin/clips?operator=a&table=room-a&game=blackjack'),{scene:true}),scene=pane.scene;
  try{
    await scene.open();const remote=scene.snapshot(),saved=sceneGeometry(remote);
    await scene.click('Redigera gemensam mall');const draft=movedGeometry(saved,.1);await scene.edit(draft);
    remote.revision='fixture.scene.remote';remote.lanes[0].composition.blackjackTables=[movedGeometry(saved,.2)];scene.remote(remote);
    const sent=await scene.save();assert.notEqual(sent.revision,remote.revision);
    assert.equal(scene.snapshot().revision,sent.revision,'a rejected save must not advance the draft revision');
    assert.deepEqual(sceneGeometry(scene.snapshot()),draft,'a rejected save retains the local geometry');await scene.compare();
    assert.equal(scene.snapshot().revision,remote.revision);assert.deepEqual(sceneGeometry(scene.snapshot()),draft,'conflicting local points remain in the draft');
    await scene.leave();await scene.open();await scene.click('Redigera gemensam mall');await scene.click('Desktop');await scene.click('Återställ sparade kort');
    const actual=sceneGeometry(scene.snapshot());
    assert.deepEqual(geometryGroup(actual.desktop,'cards'),geometryGroup(sceneGeometry(remote).desktop,'cards'));
    assert.deepEqual(geometryGroup(actual.desktop,'bets'),geometryGroup(draft.desktop,'bets'));assert.deepEqual(actual.mobile,draft.mobile);
  }finally{pane.unmount();}
});

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
