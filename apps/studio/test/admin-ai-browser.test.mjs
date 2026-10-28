import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname} from 'node:path';
import {build} from 'esbuild';
import {addDealer,defaultPresentationLane,createSeedProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {studioHistoryBootstrap} from '../lib/studio-history.mjs';
const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
// NOT RUN anywhere: the Admin AI pages were rewritten on 2026-10-22 (heading "Dialogtest"; no
// "Agentmodeller" heading or "Meddelande till OpenClaw" field). Rewrite these cases against the
// current pages before removing this skip; CI's browser job runs every file that reads the fixture.
const staleBrowserTest='NOT RUN: written for the Admin AI pages before the 2026-10-22 rewrite; needs a rewrite against the current pages';
import {OPENCLAW_DASHBOARD_URL} from '../lib/openclaw-dashboard.mjs';
const origin='https://admin-ai.fixture.invalid';
const shared={operator:'operator-a',table:'room-a'};
const lab=dirname(dirname(fileURLToPath(import.meta.url)));
function fixtureProject(){const project=addDealer(addDealer(createSeedProject(),'elin','Elin'),'lina','Lina');project.lanes=['elin','lina'].map((dealer,index)=>({...defaultPresentationLane(dealer),id:'scene-'+(index?'b':'a'),label:index?'Scene B':'Scene A'}));return project;}
const href=(section='dealer-agent',selection={})=>'/admin/'+section+'?'+new URLSearchParams({...shared,dealer:'elin',composition:'scene-a',game:'blackjack',event:'idle.ready',variant:'idle-a',...selection});
let source;
async function fixtureSource(){return source??=build({stdin:{contents:
  "import './client/admin/entry';import {studioHistory} from './lib/studio-history.mjs';import {navigate} from './client/runtime/navigation';const owner=window.__historyOwner=studioHistory(window);window.__navigate=navigate;window.__move=href=>owner.canNavigate(href)&&owner.push(href);window.__aborts=[];const fetchNative=window.fetch.bind(window);window.fetch=(url,init)=>{init?.signal?.addEventListener('abort',()=>window.__aborts.push(String(url)),{once:true});return fetchNative(url,init);};window.__traversals=0;owner.guardTraversal(()=>{window.__traversals++;return true;});",
  resolveDir:lab,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'""','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"'},alias:{react:fileURLToPath(new URL('../client/node_modules/react',import.meta.url)),'react-dom':fileURLToPath(new URL('../client/node_modules/react-dom',import.meta.url)),'next/navigation':fileURLToPath(new URL('../client/runtime/navigation.tsx',import.meta.url))},plugins:[{name:'ai-boundaries',setup(builder){
  // Playback bytes stay outside this navigation fixture; no game or media is opened.
  builder.onResolve({filter:/^\/composition-runtime\//},args=>({path:args.path,external:true}));
  builder.onResolve({filter:/\.module\.css$/},args=>({path:args.path,namespace:'fixture-css'}));
  builder.onLoad({filter:/.*/,namespace:'fixture-css'},()=>({contents:'export default {}'}));
  builder.onResolve({filter:/^\./},args=>{const importer=args.importer.replaceAll('\\','/');
    if(importer.endsWith('/client/admin/entry.tsx')&&((args.path.startsWith('./components/')&&!args.path.endsWith('/workspace-tools')&&!args.path.endsWith('/connected-services'))||args.path.startsWith('./app/')))return{path:args.path,namespace:'unused-admin'};
    if(importer.endsWith('/workspace-tools.tsx')&&(args.path.includes('/components/')&&!['/control-openclaw-chat'].some(name=>args.path.endsWith(name))))return{path:args.path,namespace:'unused-admin'};
    if(importer.endsWith('/connected-services.tsx')&&['/native-administration','/connected-economy'].some(name=>args.path.endsWith(name)))return{path:args.path,namespace:'unused-admin'};
    if(args.path==='./composition-preview')return{path:args.path,namespace:'preview'};
    if(args.path==='./page-template.mjs')return{path:args.path,namespace:'template'};
  });
  builder.onLoad({filter:/.*/,namespace:'unused-admin'},()=>({contents:'export default ()=>null;export const StudioSidebar=()=>null,RegisteredStudio=()=>null,ConnectedClipMap=()=>null,ConnectedServices=()=>null,RegisteredMaterialLibrary=()=>null,NativeAdministration=()=>null,ConnectedEconomy=()=>null,AdminHome=()=>null,DealerDirectory=()=>null,ResourceConnections=()=>null,AdminHelp=()=>null,AdminLogout=()=>null,ResourceDeletion=()=>null,AdminPublicationPage=()=>null,ControlActivityPage=()=>null,ControlPreviewPage=()=>null,ControlEventsPage=()=>null,ControlTreePage=()=>null,ControlProbePage=()=>null,ControlRepliesPage=()=>null,ControlVideosPage=()=>null,ControlGuidePage=()=>null,ControlOpenClawChat=()=>null,LabStudio=()=>null;'}));
  builder.onLoad({filter:/.*/,namespace:'preview'},()=>({contents:'export const CompositionPreview=()=>null;'}));
  builder.onLoad({filter:/.*/,namespace:'template'},()=>({loader:'tsx',contents:'export const publishShellStatus=()=>{};export const PageTemplate=props=><><h1>{props.title}</h1><div>{props.intro}</div>{props.tabs}{props.primary}{props.children}</>;'}));
}}]}).then(result=>result.outputFiles[0].text);}
async function withBrowser(run){const {chromium}=await import(pathToFileURL(browserModule).href);const browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});try{await run(browser);}finally{await browser.close();}}


const models=()=>({version:1,baseHash:'revision-a',gateway:{connected:true,version:'2026.9.5',applied:null},agents:[
  {id:'croupier-director',model:{primary:'provider/old',fallbacks:['provider/backup','other/backup']}},
  {id:'croupier-chat',model:{primary:'provider/old',fallbacks:[]}}],
  models:['old','new','backup'].map(id=>({id:'provider/'+id,provider:'fixture'})).concat([{id:'other/backup',provider:'fixture'}])});
async function openFixture(browser,start=href()){
  const context=await browser.newContext(),failures=[],reads=[],writes=[],dialogs=[],held=new Map();let saved=models(),conflict=false;
  const project=fixtureProject();
  await context.addInitScript(studioHistoryBootstrap);
  await context.route('**/*',async route=>{try{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    if(url.origin===new URL(OPENCLAW_DASHBOARD_URL).origin){assert.equal(url.pathname,new URL(OPENCLAW_DASHBOARD_URL).pathname);return route.fulfill({contentType:'text/html',body:'<h1>Isolated dashboard handoff</h1>'});}
    assert.equal(url.origin,origin,'all requests are intercepted; unexpected destinations fail');
    const entry={path:url.pathname,method,...(method!=='GET'?{body:request.postDataJSON()}:{})};
    (method==='GET'?reads:writes).push(entry);
    const gate=held.get(method+' '+url.pathname);if(gate){gate.started();await gate.promise;held.delete(method+' '+url.pathname);}
    if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:await fixtureSource()});
    if(url.pathname==='/api/admin/workspace/dealer-agent')return route.fulfill({json:{project,videos:{videos:[]},status:{configured:true,provider:'fixture'},operators:[],directory:null,storeAvailable:true}});
    if(url.pathname==='/api/clip-controls')return route.fulfill({status:503,json:{error:'isolated_no_media'}});
    if(url.pathname==='/api/chat'){
      assert.equal(method,'POST');assert.deepEqual(Object.keys(entry.body).sort(),['conversationId','dealerId','message']);assert.ok(['elin','lina'].includes(entry.body.dealerId));
      return route.fulfill({json:{reply:'Svar för '+entry.body.dealerId+': '+entry.body.message}});
    }
    if(url.pathname==='/api/openclaw/admin'){
      if(method==='GET')return route.fulfill({json:saved});
      if(method==='POST'){
        assert.deepEqual(entry.body,{version:1,action:'dashboard.open'});
        const browserUrl=OPENCLAW_DASHBOARD_URL+'#'+new URLSearchParams({bootstrapToken:'x'.repeat(48),bootstrapProfile:'owner',gatewayUrl:OPENCLAW_DASHBOARD_URL.replace('https:','wss:').replace(/\/$/,'')});
        return route.fulfill({json:{browserUrl,expiresAtMs:Date.now()+60000,remainingLifetimeMs:60000}});
      }
      assert.equal(method,'PATCH');assert.deepEqual(Object.keys(entry.body).sort(),['agentId','baseHash','model','version']);assert.equal(entry.body.version,1);assert.equal(entry.body.baseHash,saved.baseHash);
      const agent=saved.agents.find(row=>row.id===entry.body.agentId);assert.ok(agent);assert.deepEqual(entry.body.model.fallbacks,agent.model.fallbacks);
      if(conflict){conflict=false;saved={...saved,baseHash:'revision-concurrent'};return route.fulfill({status:409,json:{error:'openclaw_admin_conflict'}});}
      saved={...saved,baseHash:saved.baseHash+'-saved',agents:saved.agents.map(row=>row.id===entry.body.agentId?{...row,model:entry.body.model}:row)};
      return route.fulfill({json:{saved:true,baseHash:saved.baseHash,agentId:agent.id,model:entry.body.model,restartScheduled:false,verifiedAt:new Date().toISOString()}});
    }
    assert.equal(method,'GET');assert.ok(['/admin/dealer-agent','/admin/ai/models','/admin/rehearsal'].includes(url.pathname));
    return route.fulfill({contentType:'text/html',body:url.pathname==='/admin/rehearsal'?'<h1>Isolated rehearsal entry</h1>':'<div id="root"></div><script src="/fixture.js"></script>'});
  }catch(error){failures.push(error);await route.fulfill({status:500,body:'Isolated fixture failed'});}});
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>failures.push(error));page.on('dialog',async dialog=>{dialogs.push(dialog.type());await dialog.dismiss();});await page.goto(origin+start);
  try{await page.getByRole('heading',{name:start.startsWith('/admin/ai/models')?'Agentmodeller':'Intern agentchatt',exact:true}).waitFor();if(start.startsWith('/admin/ai/models'))await page.getByRole('combobox',{name:/^Modell för croupier-director/}).waitFor();}catch(error){await context.close();throw failures[0]??error;}
  return{page,reads,writes,dialogs,get saved(){return saved;},conflict(){conflict=true;},hold(method,path){let release,started;const promise=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);held.set(method+' '+path,{promise,release,started});return{release,seen};},snapshot:()=>page.evaluate(()=>({href:location.href,state:history.state,length:history.length})),async close(){for(const gate of held.values())gate.release();await context.close();assert.deepEqual(failures,[]);}};
}
async function waitRequest(gate){let timer;try{await Promise.race([gate.seen,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('expected isolated request did not start')),7000))]);}finally{clearTimeout(timer);}}
async function dealer(page,id){await page.waitForFunction(id=>new URLSearchParams(location.search).get('dealer')===id,id);await page.getByText('Arbeta med agentinställningar för '+(id==='elin'?'Elin':'Lina')+' och gå vidare till provspelning.',{exact:true}).waitFor();}
async function rejectTraversal(f,delta){const before=await f.snapshot(),count=await f.page.evaluate(()=>window.__traversals);await f.page.evaluate(delta=>history.go(delta),delta);await f.page.waitForFunction(count=>window.__traversals>count,count);await f.page.waitForURL(before.href);await f.page.waitForFunction(()=>!window.__historyOwner.isRestoring());assert.deepEqual(await f.snapshot(),before);}
async function move(f,target){assert.equal(await f.page.evaluate(target=>window.__move(target),target),true);}
const modelSelect=f=>f.page.getByRole('combobox',{name:/^Modell för croupier-director/});
const chatInput=f=>f.page.getByLabel('Meddelande till OpenClaw',{exact:true});

test('actual Admin chat/model links preserve context and accepted dealer history isolates conversations',{skip:staleBrowserTest},()=>withBrowser(async browser=>{
  const f=await openFixture(browser,href()+'&room=room-a');try{
    await dealer(f.page,'elin');
    const link=f.page.getByRole('link',{name:'Agentmodeller',exact:true}),url=new URL(await link.getAttribute('href'),origin);
    assert.equal(url.pathname,'/admin/ai/models');for(const key of ['dealer','composition','game','event','variant','operator','table','room'])assert.equal(url.searchParams.get(key),new URL(f.page.url()).searchParams.get(key));
    await chatInput(f).fill('First');await f.page.getByRole('button',{name:'Skicka ↑',exact:true}).click();await f.page.getByText('Svar för elin: First',{exact:true}).waitFor();
    await move(f,href('dealer-agent',{dealer:'lina',composition:'scene-b',game:'roulette'}));await dealer(f.page,'lina');assert.equal(await f.page.getByText('Svar för elin: First',{exact:true}).count(),0);assert.equal(await chatInput(f).inputValue(),'');
    await chatInput(f).fill('Second');await f.page.getByRole('button',{name:'Skicka ↑',exact:true}).click();await f.page.getByText('Svar för lina: Second',{exact:true}).waitFor();
    const chats=f.writes.filter(row=>row.path==='/api/chat');assert.deepEqual(chats.map(row=>row.body.dealerId),['elin','lina']);assert.notEqual(chats[0].body.conversationId,chats[1].body.conversationId);
    await f.page.goBack();await dealer(f.page,'elin');assert.equal(await f.page.getByText('Svar för lina: Second',{exact:true}).count(),0);await f.page.goForward();await dealer(f.page,'lina');await f.page.reload();await dealer(f.page,'lina');
    await f.page.getByRole('link',{name:'Agentmodeller',exact:true}).click();await modelSelect(f).waitFor();
    const back=new URL(await f.page.getByRole('link',{name:'Dealerns agent',exact:true}).getAttribute('href'),origin);assert.equal(back.pathname,'/admin/dealer-agent');assert.equal(back.searchParams.get('dealer'),'lina');assert.equal(back.searchParams.get('composition'),'scene-b');assert.equal(back.searchParams.get('game'),'roulette');assert.equal(back.searchParams.get('table'),'room-a');
    await f.page.getByRole('link',{name:'Dealerns agent',exact:true}).click();await dealer(f.page,'lina');assert.equal(f.reads.some(row=>row.path==='/api/voice'),false);assert.deepEqual(f.dialogs,[]);
  }finally{await f.close();}
}));

test('chat draft and in-flight response guard actual Admin navigation and Back/Forward/multi-step history',{skip:staleBrowserTest},()=>withBrowser(async browser=>{
  for(const mode of ['draft','request'])for(const delta of [-1,1,-2]){const f=await openFixture(browser);try{
    await move(f,href('dealer-agent',{dealer:'lina'}));await dealer(f.page,'lina');await move(f,href('dealer-agent',{game:'roulette'}));await dealer(f.page,'elin');
    if(delta===1){await f.page.goBack();await dealer(f.page,'lina');}
    await f.page.evaluate(()=>history.replaceState({...history.state,foreign:{keep:'owned-state'}},'',location.href));
    await chatInput(f).fill('Keep this question');let gate;
    if(mode==='request'){gate=f.hold('POST','/api/chat');await f.page.getByRole('button',{name:'Skicka ↑',exact:true}).click();await waitRequest(gate);}
    assert.equal(await f.page.evaluate(()=>window.__navigate('/admin/ai/models')),false);const before=f.page.url();await f.page.getByRole('button',{name:'Öppna bordschatten →',exact:true}).click();assert.equal(f.page.url(),before);await rejectTraversal(f,delta);
    if(mode==='draft'){assert.equal(await chatInput(f).inputValue(),'Keep this question');await chatInput(f).fill('');}
    else{assert.equal(await f.page.getByRole('button',{name:'Skicka ↑',exact:true}).isDisabled(),true);gate.release();await f.page.getByText(/Svar för .*: Keep this question/).waitFor();assert.equal(f.writes.length,1);}
    await f.page.evaluate(delta=>history.go(delta),delta);await dealer(f.page,delta===-1?'lina':'elin');assert.equal(new URL(f.page.url()).searchParams.get('table'),'room-a');
  }finally{await f.close();}}
}));

test('global model drafts and PATCH/readback protect actual Admin history without altering mutation scope',{skip:staleBrowserTest},()=>withBrowser(async browser=>{
  for(const delta of [-1,1,-2]){const f=await openFixture(browser,href('ai/models'));try{
    await move(f,href('ai/models',{dealer:'lina',game:'roulette'}));await move(f,href('ai/models',{composition:'scene-c'}));if(delta===1)await f.page.goBack();
    await f.page.evaluate(()=>history.replaceState({...history.state,foreign:{keep:'models'}},'',location.href));
    await modelSelect(f).selectOption('provider/new');assert.equal(await f.page.evaluate(()=>window.__navigate('/admin/dealer-agent')),false);await rejectTraversal(f,delta);
    assert.equal(await modelSelect(f).inputValue(),'provider/new');const patch=f.hold('PATCH','/api/openclaw/admin'),readback=f.hold('GET','/api/openclaw/admin');
    await f.page.getByRole('button',{name:'Spara modell för croupier-director',exact:true}).click();await waitRequest(patch);await rejectTraversal(f,delta);assert.equal(await f.page.evaluate(()=>window.__navigate('/admin/dealer-agent')),false);
    patch.release();await waitRequest(readback);await rejectTraversal(f,delta);assert.equal(await f.page.getByText(/sparad och bekräftad i OpenClaws inställningar/).count(),0);
    readback.release();await f.page.getByText(/sparad och bekräftad i OpenClaws inställningar/).waitFor();assert.equal(f.writes.length,1);
    assert.deepEqual(f.writes[0].body,{version:1,baseHash:'revision-a',agentId:'croupier-director',model:{primary:'provider/new',fallbacks:['provider/backup','other/backup']}});
    await f.page.evaluate(delta=>history.go(delta),delta);const target=delta===-1?href('ai/models',{dealer:'lina',game:'roulette'}):delta===1?href('ai/models',{composition:'scene-c'}):href('ai/models');await f.page.waitForURL(origin+target);await f.page.waitForFunction(()=>!window.__historyOwner.isRestoring());assert.equal(await modelSelect(f).inputValue(),'provider/new');const chatHref=new URL(await f.page.getByRole('link',{name:'Dealerns agent',exact:true}).getAttribute('href'),origin);assert.equal(chatHref.searchParams.get('dealer'),new URL(origin+target).searchParams.get('dealer'));await f.page.reload();await modelSelect(f).waitFor();assert.equal(await modelSelect(f).inputValue(),'provider/new');
  }finally{await f.close();}}
}));

test('model conflict keeps the draft and requires fresh revision before retry; dashboard handoff releases only its verified request',{skip:staleBrowserTest},()=>withBrowser(async browser=>{
  const f=await openFixture(browser,href('ai/models'));try{
    await modelSelect(f).selectOption('provider/new');f.conflict();await f.page.getByRole('button',{name:'Spara modell för croupier-director',exact:true}).click();await f.page.getByRole('alert').filter({hasText:'Inställningarna har ändrats av någon annan'}).waitFor();
    assert.equal(await modelSelect(f).inputValue(),'provider/new');assert.equal(await f.page.evaluate(()=>window.__navigate('/admin/dealer-agent')),false);
    assert.equal(await f.page.getByRole('button',{name:/Öppna OpenClaws egen dashboard/}).isDisabled(),true);
    await f.page.getByRole('button',{name:'Hämta aktuella val',exact:true}).click();await f.page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.getAttribute('aria-label')==='Spara modell för croupier-director'&&!button.disabled));
    await f.page.getByRole('button',{name:'Spara modell för croupier-director',exact:true}).click();await f.page.getByText(/sparad och bekräftad i OpenClaws inställningar/).waitFor();assert.equal(f.writes[1].body.baseHash,'revision-concurrent');
    await move(f,href('ai/models',{dealer:'lina'}));const handoff=f.hold('POST','/api/openclaw/admin');await f.page.getByRole('button',{name:/Öppna OpenClaws egen dashboard/}).click();await waitRequest(handoff);await rejectTraversal(f,-1);assert.equal(await f.page.evaluate(()=>window.__navigate('/admin/dealer-agent')),false);
    handoff.release();await f.page.getByRole('heading',{name:'Isolated dashboard handoff',exact:true}).waitFor();assert.deepEqual(f.dialogs,[]);assert.equal(f.writes.length,3);
  }finally{await f.close();}
}));

test('aborted old-dealer chat cannot contaminate a new session, and invalid dealer or mixed rooms never silently change scope',{skip:staleBrowserTest},()=>withBrowser(async browser=>{
  const f=await openFixture(browser);try{
    const pending=f.hold('POST','/api/chat');await chatInput(f).fill('Old dealer request');await f.page.getByRole('button',{name:'Skicka ↑',exact:true}).click();await waitRequest(pending);
    // Force a component boundary to exercise late-response cleanup separately from guarded navigation.
    await f.page.evaluate(target=>window.__historyOwner.push(target),href('dealer-agent',{dealer:'lina'}));await dealer(f.page,'lina');await f.page.waitForFunction(()=>window.__aborts.some(url=>url.endsWith('/api/chat')));pending.release();
    await chatInput(f).fill('New dealer request');await f.page.getByRole('button',{name:'Skicka ↑',exact:true}).click();await f.page.getByText('Svar för lina: New dealer request',{exact:true}).waitFor();assert.equal(await f.page.getByText('Svar för elin: Old dealer request',{exact:true}).count(),0);assert.notEqual(f.writes[0].body.conversationId,f.writes[1].body.conversationId);
    await move(f,href('dealer-agent',{dealer:'unknown'}));await f.page.getByRole('heading',{name:'Välj dealer',exact:true}).waitFor();assert.equal(await chatInput(f).count(),0);assert.equal(f.writes.length,2);
    await move(f,href()+'&table=room-b&room=room-c&operator=other');await dealer(f.page,'elin');
    const target=new URL(await f.page.getByRole('link',{name:'Agentmodeller',exact:true}).getAttribute('href'),origin);assert.deepEqual(target.searchParams.getAll('table'),['room-a','room-b']);assert.deepEqual(target.searchParams.getAll('operator'),['operator-a','other']);assert.equal(target.searchParams.get('room'),'room-c');
    await f.page.getByRole('link',{name:'Agentmodeller',exact:true}).click();await modelSelect(f).waitFor();await modelSelect(f).selectOption('provider/new');await f.page.getByRole('button',{name:'Spara modell för croupier-director',exact:true}).click();await f.page.getByText(/sparad och bekräftad i OpenClaws inställningar/).waitFor();
    assert.deepEqual(Object.keys(f.writes.at(-1).body).sort(),['agentId','baseHash','model','version']);const back=new URL(await f.page.getByRole('link',{name:'Dealerns agent',exact:true}).getAttribute('href'),origin);assert.deepEqual(back.searchParams.getAll('table'),['room-a','room-b']);assert.equal(back.searchParams.get('room'),'room-c');
  }finally{await f.close();}
}));
