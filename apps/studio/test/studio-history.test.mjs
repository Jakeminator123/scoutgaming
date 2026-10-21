import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname} from 'node:path';
import {build, transformSync} from 'esbuild';
import {addDealer,createSeedProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {studioHistory, studioHistoryBootstrap} from '../lib/studio-history.mjs';
import {studioNavigationContextFromQuery, studioNavigationHref} from '../lib/studio-navigation.mjs';

const require=createRequire(import.meta.url);
const fixtureProject=()=>addDealer(addDealer(createSeedProject(),'elin','Elin'),'lina','Lina');
const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const origin='https://lab-history.fixture.invalid';
const shared={operator:'fixture-operator',table:'fixture-room',composition:'fixture-scene',game:'roulette'};
const query=dealer=>new URLSearchParams({...shared,dealer,view:'speech'}).toString();
const lab=dirname(dirname(fileURLToPath(import.meta.url)));
const names={
  './idle-policy-editor':'IdlePolicyEditor','./registered-idle-editor':'RegisteredIdleEditor','./legacy-clip-editor':'LegacyClipEditor',
  './media-family-editor':'MediaFamilyEditor','./project-conflict':'ProjectConflict','./dealer-registration':'DealerRegistration',
  './dealer-media-library':'DealerMediaLibrary','./dealer-removal':'DealerRemoval','./dealer-forge-page':'DealerMaterialCreator',
  './dealer-video-surface':'DealerClipPreview','./dealer-speech-slot-editor':'DealerSpeechSlotEditor',
};
// Execute the real page's query/prop construction. Isolate its auth/data
// boundary: this verifies the request it authorizes, not successful login.
async function pageProps(kind,query){
  const code=transformSync(readFileSync(new URL('../app/control/'+kind+'/page.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
  const requests=[],data={project:fixtureProject(),videos:{videos:[],summary:{}}},module={exports:{}};
  const overrides={
    '@/components/studio-types':{firstQueryValue:value=>Array.isArray(value)?value[0]:value},
    '@/components/lab-studio':{LabStudio:()=>null},
    '../../control-studio-data':{loadControlStudio:async href=>{requests.push(href);return data;}},
    'next/headers':{headers:async()=>new Headers({host:new URL(origin).host})},
    '@/lib/ui-server':{studioUiInitialData:async request=>{requests.push(request.url);return data;}},
    '@/lib/studio-navigation.mjs':{studioNavigationContextFromQuery},
  };
  runInNewContext(code,{module,exports:module.exports,URLSearchParams,Request,process:{env:{CROUPIER_STREAM_LANE:'lissabon-stream-lane'}},require:name=>Object.hasOwn(overrides,name)?overrides[name]:require(name)});
  const element=await module.exports.default({searchParams:Promise.resolve(query)});
  return {props:element.props,requests};
}
// Installed Next history patch/listener, with a synthetic action queue that
// publishes its URL to the query hook. No RSC/server or live acceptance claimed.
const nextRouter=readFileSync(require.resolve('next/dist/client/components/app-router.js'),'utf8').replaceAll('\r\n','\n');
const copyStart=nextRouter.indexOf('function copyNextJsInternalHistoryState(data) {'),copyEnd=nextRouter.indexOf('\n}',copyStart)+2;
const patchStart=nextRouter.indexOf('        const originalPushState = window.history.pushState.bind(window.history);'),patchEnd=nextRouter.indexOf('\n    }, []);',patchStart);
assert.ok(copyStart>=0&&copyEnd>copyStart&&patchStart>=0&&patchEnd>patchStart,'review installed Next history contract after upgrades');
const nextPatch=nextRouter.slice(copyStart,copyEnd)+'\nfunction installNextHistory(){\n'+nextRouter.slice(patchStart,patchEnd)+'\n}';
let source;
async function fixtureSource(){
  return source??=build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';
    import {LabStudio} from './components/lab-studio';
    import {studioHistory} from './lib/studio-history.mjs';import {useSearchParams} from 'next/navigation';
    const owner=studioHistory(window),audit=window.__historyAudit;
    owner.guardTraversal(href=>{queueMicrotask(()=>audit.traversals.push({raw:href,accepted:owner.snapshotHref(),next:window.__nextQuery}));return true;});
    function QueryProbe(){const query=useSearchParams();return <output data-testid="query">{query.toString()}</output>;}
    const props=window.__fixtureProps;
    createRoot(document.getElementById('root')).render(<><QueryProbe/><LabStudio {...props}/></>);window.__historyOwner=owner;`,resolveDir:lab,loader:'tsx'},
    bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'""','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'""'},plugins:[{
    name:'isolated-editor-boundaries',setup(build){
      build.onResolve({filter:/\.module\.css$/},args=>({path:args.path,namespace:'fixture-css'}));
      build.onLoad({filter:/.*/,namespace:'fixture-css'},()=>({contents:'export default {}'}));
      build.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture-next'}));
      build.onLoad({filter:/.*/,namespace:'fixture-next'},()=>({contents:`import {useSyncExternalStore} from 'react';
        const listeners=new Set();window.__nextQuery=location.search;const audit=window.__historyAudit={notifications:[],traversals:[]};
        history.replaceState({__NA:true,_N:false,__PRIVATE_NEXTJS_INTERNALS_TREE:{fixture:['preserve-tree']}},'');
        const publish=(href,kind,tree)=>{window.__nextQuery=new URL(href,location.href).search;audit.notifications.push({href:String(href),kind,tree});listeners.forEach(fn=>fn());};
        const _react={startTransition:run=>run()},_routerreducertypes={ACTION_RESTORE:'restore'};
        const _useactionqueue={dispatchAppRouterAction:action=>publish(action.url,'write',action.historyState)};
        const _approuterinstance={dispatchTraverseAction:(href,tree)=>publish(href,'popstate',tree)};
        ${nextPatch}
        window.__disposeNextHistory=installNextHistory();
        const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
        export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(subscribe,()=>window.__nextQuery,()=>''));}`,resolveDir:lab}));
      build.onResolve({filter:/^\.\//},args=>{
        if(!/\/components\/(?:lab-studio|control-replies-page)\.tsx$/.test(args.importer.replaceAll('\\','/')))return;
        if(names[args.path]||args.path==='./dealer-speech-settings'||args.path==='./page-template.mjs')return {path:args.path,namespace:'fixture-child'};
      });
      build.onLoad({filter:/.*/,namespace:'fixture-child'},args=>({resolveDir:lab,loader:'tsx',contents:
        args.path==='./page-template.mjs'?'export const PageTemplate=props=>props.children;export const publishShellStatus=()=>{};':
        args.path==='./dealer-media-library'?'export const DealerMediaLibrary=props=>props.slotEditor;':
        args.path==='./dealer-speech-settings'?`import React from 'react';export function DealerSpeechSettings({onDraftChange}){return <div><button onClick={()=>onDraftChange(true)}>Fixture draft</button><button onClick={()=>onDraftChange(false)}>Fixture discard</button></div>;}`:
        'export const '+names[args.path]+'=()=>null;'}));
    },
  }]}).then(result=>result.outputFiles[0].text);
}
const reply=dealerId=>({id:'11111111-1111-4111-8111-111111111111',dealerId,exactText:'Isolated history fixture',language:'sv',createdAt:'2026-10-12T10:20:00.000Z',profileRevision:'a'.repeat(64),revision:1,categories:['player-greeting'],reviewStatus:'pending',media:{audio:{available:false,sha256:'b'.repeat(64),contentType:'audio/wav',size:100},video:{available:false,sha256:'c'.repeat(64),contentType:'video/mp4',size:200}}});
async function openFixture(browser,kind){
  const context=await browser.newContext(),failures=[];
  await context.addInitScript(studioHistoryBootstrap);
  await context.route('**/*',async route=>{try{
    const request=route.request(),url=new URL(request.url());assert.equal(url.origin,origin);assert.equal(request.method(),'GET','fixture never writes');
    if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:await fixtureSource()});
    if(url.pathname==='/api/replies')return route.fulfill({json:{items:[reply(url.searchParams.get('dealer'))],nextCursor:null}});
    assert.equal(url.pathname,'/control/'+kind);
    const {props}=await pageProps(kind,Object.fromEntries(url.searchParams));
    return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script>window.__fixtureProps='+JSON.stringify(props).replaceAll('<','\\u003c')+'</script><script src="/fixture.js"></script>'});
  }catch(error){failures.push(error);await route.fulfill({status:500,body:'Isolated history fixture failed'});}});
  const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>failures.push(error));
  await page.goto(origin+'/control/'+kind+'?'+query('astrid'));
  const selected=()=>kind==='clips'?page.getByRole('group',{name:'Välj dealer'}).locator('[aria-pressed="true"]'):page.getByLabel('Dealer i svarsbiblioteket');
  try{await selected().waitFor();}catch(error){await context.close();throw failures[0]??error;}
  const choose=async id=>{if(kind==='clips')await page.getByRole('group',{name:'Välj dealer'}).getByRole('button',{name:new RegExp(id==='elin'?'Elin':id==='lina'?'Lina':'Astrid')}).click();else await selected().selectOption(id);await page.waitForFunction(id=>new URL(location.href).searchParams.get('dealer')===id,id);};
  const snapshot=()=>page.evaluate(()=>({href:location.href,state:history.state,length:history.length}));
  const mark=label=>page.evaluate(label=>history.replaceState({...history.state,foreign:{label,tree:['preserve']}},'',location.href),label);
  const dirty=async()=>{if(kind==='clips')await page.getByRole('button',{name:'Fixture draft',exact:true}).click();else await page.getByLabel('Vänlig spelare',{exact:true}).check();};
  const discard=async()=>{if(kind==='clips')await page.getByRole('button',{name:'Fixture discard',exact:true}).click();else await page.getByRole('button',{name:'Ångra kategorival',exact:true}).click();};
  return {page,choose,snapshot,mark,dirty,discard,async close(){await context.close();assert.deepEqual(failures,[]);}};
}
async function withBrowser(run){const {chromium}=await import(pathToFileURL(browserModule).href);const browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});try{await run(browser);}finally{await browser.close();}}
const fiveFields=href=>Object.fromEntries([...new URL(href,origin).searchParams].filter(([key])=>key in shared||key==='dealer'));

test('shared Studio navigation retains five selectors and excludes unrelated parameters',()=>{
  const context=studioNavigationContextFromQuery(new URLSearchParams(query('elin')+'&token=secret&unrelated=value'));
  assert.deepEqual(fiveFields(studioNavigationHref('/admin/replies',context)),{...shared,dealer:'elin'});
  assert.equal(Object.keys(context).length,5);
});
for(const kind of ['clips'])test('actual '+kind+' page preserves five selectors at auth/data boundary and initial props',async()=>{
  const {props,requests}=await pageProps(kind,{...shared,dealer:['elin','astrid'],view:'speech',token:'secret',unrelated:'value'});
  assert.equal(requests.length,1);assert.deepEqual(fiveFields(requests[0]),{...shared,dealer:'elin'});
  assert.equal(new URL(requests[0],origin).searchParams.has('token'),false);assert.equal(new URL(requests[0],origin).searchParams.has('unrelated'),false);
  assert.deepEqual(kind==='clips'?{dealerId:props.initialDealerId,laneId:props.initialLaneId,operatorId:props.initialOperatorId,tableId:props.initialTableId,game:props.initialGame}:props.initialNavigationContext,{dealerId:'elin',laneId:shared.composition,operatorId:shared.operator,tableId:shared.table,game:shared.game});
});
test('one document owner keeps capture until subscription and guard release, including remount',()=>{
  const window=new EventTarget(),url=new URL(origin+'/admin/replies?'+query('astrid')),attached=new Map();let state={foreign:'keep'},notices=0;
  const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);
  window.addEventListener=(name,listener,options)=>{attached.set(name,(attached.get(name)??0)+1);add(name,listener,options);};
  window.removeEventListener=(name,listener,options)=>{attached.set(name,attached.get(name)-1);remove(name,listener,options);};
  Object.assign(window,{location:url,history:{get state(){return state;},replaceState(value){state=structuredClone(value);}}});
  const owner=studioHistory(window);assert.equal(studioHistory(window),owner);
  for(let i=0;i<2;i++){
    const unsubscribe=owner.subscribe(()=>notices++),release=owner.guardTraversal(()=>true);
    assert.equal(attached.get('popstate'),1);assert.equal(attached.get('hashchange'),1);assert.equal(state.foreign,'keep');
    window.dispatchEvent(new Event('popstate'));assert.equal(notices,i+1);
    unsubscribe();assert.equal(attached.get('popstate'),1);release();assert.equal(attached.get('popstate'),0);assert.equal(attached.get('hashchange'),0);
  }
});
for(const kind of ['clips'])test('independent Lab '+kind+' veto preserves Back, Forward, multi-step entries and accepted Next query',{skip:!browserModule},()=>withBrowser(async browser=>{
  for(const delta of [-1,1,-2]){
    const f=await openFixture(browser,kind);
    try{
      assert.deepEqual(await f.page.evaluate(()=>window.__historyAudit.notifications),[],'metadata does not notify Next');
      await f.mark('A');const a=await f.snapshot();await f.choose('elin');await f.mark('B');const b=await f.snapshot();await f.choose('lina');await f.mark('C');const c=await f.snapshot();
      assert.equal(await f.page.evaluate(()=>window.__historyAudit.notifications.length),2,'one Next query publication per push');
      const entries=[a,b,c],at=delta===1?1:2;
      if(at===1){await f.page.goBack();await f.page.waitForURL(b.href);}
      await f.dirty();const before=await f.snapshot(),queryBefore=await f.page.getByTestId('query').textContent();
      const notices=await f.page.evaluate(()=>{window.__historyAudit.traversals=[];return window.__historyAudit.notifications.length;});
      for(let attempt=0;attempt<2;attempt++){
        await f.page.evaluate(delta=>history.go(delta),delta);await f.page.waitForFunction(count=>window.__historyAudit.traversals.length>=count,attempt+1);await f.page.waitForURL(before.href);await f.page.waitForFunction(()=>!window.__historyOwner.isRestoring());
        assert.deepEqual(await f.snapshot(),before,'veto restores the same entry, foreign state and Next tree');
        assert.equal(await f.page.getByTestId('query').textContent(),queryBefore);
      }
      const audit=await f.page.evaluate(()=>window.__historyAudit),accepted=new URL(before.href);
      assert.equal(audit.notifications.length,notices,'neither rejected nor compensating pop reaches Next');
      assert.ok(audit.traversals.some(row=>row.raw!==row.accepted));
      for(const row of audit.traversals){assert.equal(row.accepted,accepted.pathname+accepted.search+accepted.hash);assert.equal(row.next,accepted.search);}
      await f.discard();await f.page.evaluate(at=>history.go(-at),at);await f.page.waitForURL(a.href);
      assert.deepEqual(await f.snapshot(),{...a,length:c.length});
      for(const entry of entries.slice(1)){await f.page.goForward();await f.page.waitForURL(entry.href);assert.deepEqual(await f.snapshot(),{...entry,length:c.length});}
    }finally{await f.close();}
  }
}));
for(const kind of ['clips'])test('independent Lab '+kind+' keeps five selectors through menu, Back, Forward and actual page reload',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await openFixture(browser,kind);
  try{
    await f.choose('elin');const target=f.page.url();assert.deepEqual(fiveFields(target),{...shared,dealer:'elin'});
    for(const href of await f.page.locator('nav[aria-label^="Studio för"] a').evaluateAll(links=>links.map(link=>link.href)))assert.deepEqual(fiveFields(href),{...shared,dealer:'elin'});
    assert.deepEqual(fiveFields('?'+await f.page.getByTestId('query').textContent()),{...shared,dealer:'elin'});
    await f.page.goBack();await f.page.waitForFunction(()=>new URL(location.href).searchParams.get('dealer')==='astrid');
    await f.page.goForward();await f.page.waitForURL(target);await f.page.reload();await f.page.getByTestId('query').waitFor();
    assert.deepEqual(fiveFields(f.page.url()),{...shared,dealer:'elin'});assert.deepEqual(fiveFields('?'+await f.page.getByTestId('query').textContent()),{...shared,dealer:'elin'});
    if(kind==='clips'){
      const idle=new URL(target);idle.searchParams.set('view','idle');await f.page.goto(idle.href);
      const links=f.page.getByRole('navigation',{name:'Fackets inställningar'}).locator('a');await links.first().waitFor();
      assert.equal(await links.count(),2);
      for(const href of await links.evaluateAll(rows=>rows.map(row=>row.href)))assert.deepEqual(fiveFields(href),{...shared,dealer:'elin'});
    }
  }finally{await f.close();}
}));

test('last consumer release/remount during compensation retains the accepted entry and settles cleanup',()=>{
  for(const remount of [false,true]){
    const window=new EventTarget(),entries=[{href:origin+'/control/clips?dealer=astrid',state:null}],queue=[];let index=0;
    const location={get href(){return entries[index].href;},get pathname(){return new URL(this.href).pathname;},get search(){return new URL(this.href).search;},get hash(){return new URL(this.href).hash;}};
    const history={get state(){return entries[index].state;},replaceState(state,unused,href=location.href){entries[index]={state:structuredClone(state),href:new URL(href,location.href).href};},pushState(state,unused,href){const target=new URL(href,location.href).href;entries.splice(index+1);entries.push({state:structuredClone(state),href:target});index++;},go(delta){queue.push(delta);}};
    Object.assign(window,{history,location});const owner=studioHistory(window);
    const step=()=>{index+=queue.shift();window.dispatchEvent(new Event('popstate'));};
    let release=owner.guardTraversal(()=>false),unsubscribe=owner.subscribe(()=>{});
    owner.push('?dealer=vera');owner.push('?dealer=mei');const before=structuredClone(entries);
    history.go(-1);step();assert.equal(owner.snapshotHref(),'/control/clips?dealer=mei');
    unsubscribe();release();
    if(remount){release=owner.guardTraversal(()=>false);unsubscribe=owner.subscribe(()=>{});}
    step();assert.equal(index,2);assert.equal(owner.isRestoring(),false);assert.deepEqual(entries,before);assert.deepEqual(queue,[]);
    if(remount){unsubscribe();release();}
    history.go(-1);step();assert.equal(index,1);assert.deepEqual(queue,[],'released guards must not veto later history');
  }
});

test('actual root layout installs the inert history proxy before Next hydration',()=>{
  const source=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8');
  const code=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,module={exports:{}};
  runInNewContext(code,{module,exports:module.exports,process:{env:{}},require:name=>name==='next/font/local'?()=>({variable:'fixture-font'}):name==='next/script'?()=>null:name==='@/components/workspace-navigation'?{WorkspaceNavigation:()=>null}:name==='@/lib/studio-history.mjs'?{studioHistoryBootstrap}:name.endsWith('.css')?{}:require(name)});
  const all=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(all):[node,...all(node.props?.children)];
  const script=all(module.exports.default({children:null})).find(node=>node.props?.id==='sg-history');
  assert.equal(script?.props.strategy,'beforeInteractive');assert.equal(script?.props.dangerouslySetInnerHTML.__html,studioHistoryBootstrap);
  const window=new EventTarget();let observed=0;
  runInNewContext(studioHistoryBootstrap,{window,Symbol});runInNewContext(studioHistoryBootstrap,{window,Symbol});
  assert.equal(window[Symbol.for('scout.studio-history')].handler,null);
  window.addEventListener('popstate',()=>observed++);window.dispatchEvent(new Event('popstate'));assert.equal(observed,1,'inactive proxy leaves other listeners alone');
});

test('unknown Lab destination fallback retains the accepted Next tree without publishing the rejected query',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await openFixture(browser,'clips');
  try{
    await f.page.evaluate(()=>{
      const foreign={...history.state,__PRIVATE_NEXTJS_INTERNALS_TREE:{route:'older-foreign'}};delete foreign.__scoutAdminHistory;
      history.pushState(foreign,'',location.href+'&older=1');
    });
    await f.choose('elin');await f.mark('accepted');
    await f.page.evaluate(()=>{history.replaceState({...history.state,__PRIVATE_NEXTJS_INTERNALS_TREE:{route:'accepted'}},'');window.__historyOwner.replaceContext(location.href);});
    const before=await f.snapshot(),queryBefore=await f.page.getByTestId('query').textContent();await f.dirty();
    const notices=await f.page.evaluate(()=>{window.__historyAudit.traversals=[];return window.__historyAudit.notifications.length;});
    await f.page.evaluate(()=>history.back());await f.page.waitForFunction(()=>window.__historyAudit.traversals.length===1);await f.page.waitForURL(before.href);
    const after=await f.snapshot();assert.equal(after.length,before.length);assert.deepEqual(after.state.foreign,before.state.foreign);
    assert.deepEqual(after.state.__PRIVATE_NEXTJS_INTERNALS_TREE,before.state.__PRIVATE_NEXTJS_INTERNALS_TREE);
    assert.equal(await f.page.getByTestId('query').textContent(),queryBefore);assert.equal(await f.page.evaluate(()=>window.__historyAudit.notifications.length),notices);
    // The unknown destination was replaced, but the original forward entry stays intact.
    await f.discard();await f.page.evaluate(()=>history.forward());await f.page.waitForFunction(session=>history.state.__scoutAdminHistory.session===session,before.state.__scoutAdminHistory.session);
    assert.deepEqual(await f.snapshot(),before);
  }finally{await f.close();}
}));

// Actual Admin workspace + its navigation adapter; only unrelated tools and API data are isolated.
let adminSource;
async function adminFixtureSource(){
  return adminSource??=build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';
    import {WorkspaceTool} from './client/admin/components/studio/workspace-tools';
    import {usePathname,useSearchParams,navigate} from './client/runtime/navigation';
    import {studioHistory} from './lib/studio-history.mjs';
    const owner=studioHistory(window),audit=window.__adminAudit={traversals:[]};
    owner.guardTraversal(href=>{queueMicrotask(()=>audit.traversals.push({raw:href,accepted:owner.snapshotHref()}));return true;});
    window.__historyOwner=owner;window.__adminNavigate=navigate;
    function App(){const path=usePathname(),search=useSearchParams();return <><output data-testid="path">{path}</output><output data-testid="query">{search.toString()}</output><WorkspaceTool section="replies"/></>;}
    createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:lab,loader:'tsx'},
    bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'""','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"'},
    alias:{react:fileURLToPath(new URL('../client/node_modules/react',import.meta.url)),'react-dom':fileURLToPath(new URL('../client/node_modules/react-dom',import.meta.url)),'next/navigation':fileURLToPath(new URL('../client/runtime/navigation.tsx',import.meta.url))},plugins:[{name:'admin-replies-boundaries',setup(builder){
      builder.onResolve({filter:/\.module\.css$/},args=>({path:args.path,namespace:'fixture-css'}));
      builder.onLoad({filter:/.*/,namespace:'fixture-css'},()=>({contents:'export default {}'}));
      builder.onResolve({filter:/^\./},args=>{
        const importer=args.importer.replaceAll('\\','/');
        if(importer.endsWith('/workspace-tools.tsx')&&(args.path.includes('/components/')&&!args.path.endsWith('/control-replies-page')||args.path==='./connected-services'))return{path:args.path,namespace:'unused-admin-tool'};
        if(importer.endsWith('/control-replies-page.tsx')&&['./page-template.mjs','./dealer-video-surface'].includes(args.path))return{path:args.path,namespace:'reply-child'};
      });
      builder.onLoad({filter:/.*/,namespace:'unused-admin-tool'},()=>({contents:'export const AdminPublicationPage=()=>null,ControlActivityPage=()=>null,ControlPreviewPage=()=>null,ControlEventsPage=()=>null,ControlTreePage=()=>null,ControlProbePage=()=>null,ControlVideosPage=()=>null,ControlGuidePage=()=>null,ControlOpenClawChat=()=>null,LabStudio=()=>null,ConnectedServices=()=>null;'}));
      builder.onLoad({filter:/.*/,namespace:'reply-child'},args=>({contents:args.path==='./page-template.mjs'?'export const PageTemplate=props=>props.children;':'export const DealerClipPreview=()=>null;'}));
    }}]}).then(result=>result.outputFiles[0].text);
}
async function openAdminReplies(browser){
  const context=await browser.newContext(),failures=[],reads=[],writes=[],saved=new Map();let hold=false,releaseWrite,startedWrite;
  const started=new Promise(resolve=>{startedWrite=resolve;}),gate=new Promise(resolve=>{releaseWrite=resolve;});
  const current=dealerId=>saved.get(dealerId)??{...reply(dealerId),exactText:'Reply: '+dealerId};
  await context.addInitScript(studioHistoryBootstrap);
  await context.route('**/*',async route=>{try{
    const request=route.request(),url=new URL(request.url());assert.equal(url.origin,origin,'all traffic remains isolated');
    if(request.method()==='PATCH'){
      assert.equal(url.pathname,'/api/replies/'+reply('astrid').id);assert.equal(url.search,'');
      const body=request.postDataJSON();assert.deepEqual(Object.keys(body).sort(),['categories','dealerId','expectedRevision']);writes.push(body);startedWrite();if(hold)await gate;
      const previous=current(body.dealerId);assert.equal(body.expectedRevision,previous.revision);const item={...previous,categories:body.categories,revision:previous.revision+1};saved.set(body.dealerId,item);return route.fulfill({json:{item}});
    }
    assert.equal(request.method(),'GET');
    if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:await adminFixtureSource()});
    if(url.pathname==='/api/admin/workspace/replies'){assert.equal(url.search,'');return route.fulfill({json:{project:fixtureProject(),videos:{videos:[]},status:{configured:true},operators:[],directory:null,storeAvailable:true}});}
    if(url.pathname==='/api/replies'){
      assert.deepEqual([...url.searchParams.keys()].sort(),url.searchParams.has('category')?['category','dealer']:['dealer']);
      const dealer=url.searchParams.get('dealer'),category=url.searchParams.get('category');reads.push({dealer,category});const item=current(dealer);return route.fulfill({json:{items:[category?{...item,categories:[category]}:item],nextCursor:null}});
    }
    assert.equal(url.pathname,'/admin/replies');return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/fixture.js"></script>'});
  }catch(error){failures.push(error);await route.fulfill({status:500,body:'Isolated Admin fixture failed'});}});
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>failures.push(error));
  await page.goto(origin+'/admin/replies?'+query('astrid'));
  const ready=async dealer=>{await page.getByText('Reply: '+dealer,{exact:true}).waitFor();assert.equal(await page.getByLabel('Dealer i svarsbiblioteket').inputValue(),dealer);assert.equal(reads.at(-1).dealer,dealer);assert.equal(await page.getByTestId('path').textContent(),'/admin/replies');};
  try{await ready('astrid');}catch(error){await context.close();throw failures[0]??error;}
  const snapshot=async()=>({...await page.evaluate(()=>({href:location.href,state:history.state,length:history.length})),query:await page.getByTestId('query').textContent(),dealer:await page.getByLabel('Dealer i svarsbiblioteket').inputValue()});
  return {page,reads,writes,ready,snapshot,
    choose:async dealer=>{await page.getByLabel('Dealer i svarsbiblioteket').selectOption(dealer);await ready(dealer);},
    mark:label=>page.evaluate(label=>history.replaceState({...history.state,foreign:{label,keep:['metadata']}},'',location.href),label),
    dirty:()=>page.getByLabel('Vänlig spelare',{exact:true}).check(),
    discard:()=>page.getByRole('button',{name:'Ångra kategorival',exact:true}).click(),
    async saveHeld(){hold=true;await page.getByRole('button',{name:'Spara kategorier',exact:true}).click();await started;},
    async release(){hold=false;releaseWrite();await page.getByText('Kategorierna är sparade.',{exact:true}).waitFor();},
    async close(){releaseWrite();await context.close();assert.deepEqual(failures,[]);}
  };
}

test('Admin Replies guards dirty and in-flight drafts through Back, Forward and multi-step history with actual Admin navigation',{skip:!browserModule},()=>withBrowser(async browser=>{
  for(const mode of ['dirty','saving'])for(const delta of [-1,1,-2]){
    const f=await openAdminReplies(browser);
    try{
      await f.mark('A');const a=await f.snapshot();await f.choose('elin');await f.mark('B');const b=await f.snapshot();await f.choose('lina');await f.mark('C');const c=await f.snapshot();
      const at=delta===1?1:2;if(at===1){await f.page.goBack();await f.page.waitForURL(b.href);await f.ready('elin');}
      await f.dirty();if(mode==='saving')await f.saveHeld();const before=await f.snapshot();
      if(mode==='saving'){assert.equal(await f.page.getByLabel('Dealer i svarsbiblioteket').isDisabled(),true);assert.equal(await f.page.getByLabel('Filtrera svarskategori').isDisabled(),true);}else{await f.page.getByLabel('Dealer i svarsbiblioteket').selectOption('astrid');await f.page.getByLabel('Filtrera svarskategori').selectOption('game-win');}
      const blockedDocument=f.page.waitForEvent('dialog');f.page.once('dialog',dialog=>dialog.dismiss());
      await f.page.evaluate(()=>window.__adminNavigate('/admin/replies?dealer=astrid'));assert.equal((await blockedDocument).type(),'beforeunload','Admin uses the editor document guard for drafts and writes');
      assert.deepEqual(await f.snapshot(),before);
      for(let attempt=0;attempt<2;attempt++){
        const count=await f.page.evaluate(()=>window.__adminAudit.traversals.length);await f.page.evaluate(delta=>history.go(delta),delta);
        await f.page.waitForFunction(count=>window.__adminAudit.traversals.length>count,count);await f.page.waitForURL(before.href);await f.page.waitForFunction(()=>!window.__historyOwner.isRestoring());
        assert.deepEqual(await f.snapshot(),before,'route, selected dealer, query and foreign history state remain accepted');
      }
      if(mode==='saving'){assert.equal(f.writes.length,1);assert.equal(f.writes[0].dealerId,before.dealer);await f.release();}else{assert.equal(f.writes.length,0);await f.discard();}
      await f.page.evaluate(at=>history.go(-at),at);await f.page.waitForURL(a.href);await f.ready('astrid');assert.deepEqual(await f.snapshot(),{...a,length:c.length});
      for(const entry of [b,c]){await f.page.goForward();await f.page.waitForURL(entry.href);await f.ready(entry.dealer);assert.deepEqual(await f.snapshot(),{...entry,length:c.length});}
    }finally{await f.close();}
  }
}));

test('Admin Replies retains category and room context through filtering, dealer changes, Back/Forward and actual workspace reload',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await openAdminReplies(browser);
  try{
    await f.page.getByLabel('Filtrera svarskategori').selectOption('player-question');await f.ready('astrid');await f.choose('elin');const target=f.page.url();
    assert.equal(new URL(target).pathname,'/admin/replies');assert.equal(new URL(target).searchParams.get('category'),'player-question');assert.deepEqual(fiveFields(target),{...shared,dealer:'elin'});
    for(const href of await f.page.locator('nav[aria-label^="Studio för"] a').evaluateAll(links=>links.map(link=>link.href)))assert.deepEqual(fiveFields(href),{...shared,dealer:'elin'});
    await f.page.goBack();await f.ready('astrid');assert.equal(await f.page.getByLabel('Filtrera svarskategori').inputValue(),'player-question');
    await f.page.goForward();await f.page.waitForURL(target);await f.ready('elin');await f.page.reload();await f.ready('elin');
    assert.deepEqual(fiveFields('?'+await f.page.getByTestId('query').textContent()),{...shared,dealer:'elin'});assert.equal(await f.page.getByLabel('Filtrera svarskategori').inputValue(),'player-question');
    assert.deepEqual(f.reads.at(-1),{dealer:'elin',category:'player-question'});assert.equal(f.writes.length,0);
  }finally{await f.close();}
}));
