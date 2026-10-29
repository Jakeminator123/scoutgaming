import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname} from 'node:path';
import {build} from 'esbuild';
import {addDealer,defaultPresentationLane,createSeedProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {studioHistoryBootstrap} from '../lib/studio-history.mjs';
import {OPENCLAW_DASHBOARD_URL} from '../lib/openclaw-dashboard.mjs';
const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const skip=browserModule?false:'set CROUPIER_BROWSER_FIXTURE_MODULE to the Playwright module (CI:s browserjobb)';
// Admin AI efter omskrivningen 2026-10-22: Dialogtest ligger under Dealers › Röst och tal
// (/admin/dealers/{dealer}?flik=tal&verktyg=dialog) och agentmodellerna under System › AI-agenter
// (/admin/system?flik=agenter). De gamla adresserna /admin/dealer-agent och /admin/ai/models är bokmärken
// som Admin skriver om. Den riktiga Admin-appen (entry.tsx) monteras; bara tunga grannar stubbas.
const origin='https://admin-ai.fixture.invalid';
const shared={operator:'operator-a',table:'room-a',composition:'scene-a',game:'blackjack',event:'idle.ready',variant:'idle-a'};
const lab=dirname(dirname(fileURLToPath(import.meta.url)));
function fixtureProject(){const project=addDealer(addDealer(createSeedProject(),'elin','Elin'),'lina','Lina');project.revision??='revision-fixture';project.lanes=['elin','lina'].map((dealer,index)=>({...defaultPresentationLane(dealer),id:'scene-'+(index?'b':'a'),label:index?'Scene B':'Scene A'}));return project;}
const dialog=(dealer='elin',selection={})=>'/admin/dealers/'+dealer+'?'+new URLSearchParams({flik:'tal',verktyg:'dialog',...shared,...selection});
const models=(selection={})=>'/admin/system?'+new URLSearchParams({flik:'agenter',...shared,...selection});
let source;
async function fixtureSource(){return source??=build({stdin:{contents:
  "import './client/admin/entry';import {studioHistory} from './lib/studio-history.mjs';import {navigate} from './client/runtime/navigation';const owner=window.__historyOwner=studioHistory(window);window.__navigate=navigate;window.__move=href=>owner.canNavigate(href)&&owner.push(href);window.__aborts=[];const fetchNative=window.fetch.bind(window);window.fetch=(url,init)=>{init?.signal?.addEventListener('abort',()=>window.__aborts.push(String(url)),{once:true});return fetchNative(url,init);};window.__traversals=0;owner.guardTraversal(()=>{window.__traversals++;return true;});",
  resolveDir:lab,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'""','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"'},alias:{react:fileURLToPath(new URL('../client/node_modules/react',import.meta.url)),'react-dom':fileURLToPath(new URL('../client/node_modules/react-dom',import.meta.url)),'next/navigation':fileURLToPath(new URL('../client/runtime/navigation.tsx',import.meta.url))},plugins:[{name:'ai-boundaries',setup(builder){
  // Uppspelning, klippkarta, administration och media ligger utanför provet; inga spel eller media öppnas.
  builder.onResolve({filter:/^\/composition-runtime\//},args=>({path:args.path,external:true}));
  builder.onResolve({filter:/\.module\.css$/},args=>({path:args.path,namespace:'fixture-css'}));
  builder.onLoad({filter:/.*/,namespace:'fixture-css'},()=>({contents:'export default {}'}));
  builder.onResolve({filter:/^\./},args=>{const importer=args.importer.replaceAll('\\','/'),from=name=>importer.endsWith(name);
    if(from('/client/admin/entry.tsx')){
      // Klippkartan levererar dealerns arbetsyta till DealerHub; stubben ger samma register utan media.
      if(args.path==='./components/studio/connected-clip-map')return{path:args.path,namespace:'clip-map'};
      if(args.path.startsWith('./app/'))return{path:args.path,namespace:'clips'};
      if(args.path.startsWith('./components/')&&!args.path.startsWith('./components/ui/')&&!['./components/studio/dealer-hub','./components/studio/system-page'].includes(args.path))return{path:args.path,namespace:'unused-admin'};
    }
    if(from('/dealer-hub.tsx')&&['./dealer-identity-portrait','./taldrift-panel','./resource-connections','./saved-scene-preview','./scene-preview'].includes(args.path))return{path:args.path,namespace:'unused-admin'};
    if(from('/system-page.tsx')&&args.path==='./resource-connections')return{path:args.path,namespace:'unused-admin'};
    if(from('/workspace-tools.tsx')&&['/admin-publication-page','/control-replies-page'].some(name=>args.path.endsWith(name)))return{path:args.path,namespace:'unused-admin'};
    if(from('/connected-services.tsx')&&['/native-administration','/studio-administration','./connected-economy'].some(name=>args.path.endsWith(name)))return{path:args.path,namespace:'unused-admin'};
    if(args.path==='./composition-preview')return{path:args.path,namespace:'preview'};
  });
  builder.onLoad({filter:/.*/,namespace:'unused-admin'},()=>({contents:'export default ()=>null;export const StudioSidebar=()=>null,DealerDirectory=()=>null,ScenesPage=()=>null,CompaniesPage=()=>null,AdminHome=()=>null,DemoBuilder=()=>null,AdminHelp=()=>null,AdminLogout=()=>null,DealerAvatar=()=>null,TaldriftPanel=()=>null,ResourceConnections=()=>null,SavedScenePreview=()=>null,ScenePreview=()=>null,AdminPublicationPage=()=>null,ControlRepliesPage=()=>null,NativeAdministration=()=>null,StudioAdministration=()=>null,sharedStudioAdminRead=()=>null,ConnectedEconomy=()=>null;'}));
  builder.onLoad({filter:/.*/,namespace:'clips'},()=>({contents:'export default props=>props.children;'}));
  builder.onLoad({filter:/.*/,namespace:'clip-map'},()=>({resolveDir:lab,contents:'import {useEffect} from "react";const project='+JSON.stringify(fixtureProject())+';export function ConnectedClipMap({onWorkspaceChange}){useEffect(()=>{onWorkspaceChange({project,inventory:{videos:[]},catalog:{administration:{rooms:[],operators:[]}}},project);},[onWorkspaceChange]);return null;}'}));
  builder.onLoad({filter:/.*/,namespace:'preview'},()=>({contents:'export const CompositionPreview=()=>null;'}));
}}]}).then(result=>result.outputFiles[0].text);}
async function withBrowser(run){const {chromium}=await import(pathToFileURL(browserModule).href);const browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});try{await run(browser);}finally{await browser.close();}}

const snapshotModels=()=>({version:1,baseHash:'revision-a',gateway:{connected:true,version:'2026.9.5',applied:null},agents:[
  {id:'croupier-director',model:{primary:'provider/old',fallbacks:['provider/backup','other/backup']}},
  {id:'croupier-chat',model:{primary:'provider/old',fallbacks:[]}}],
  models:['old','new','backup'].map(id=>({id:'provider/'+id,provider:'fixture'})).concat([{id:'other/backup',provider:'fixture'}])});
const appDocument=path=>/^\/admin\/(?:dealer-agent|ai\/models|system|dealers\/[^/]+)$/.test(path);
async function openFixture(browser,start=dialog(),ready=f=>dialogReady(f,'elin')){
  const context=await browser.newContext(),failures=[],reads=[],writes=[],documents=[],dialogs=[],held=new Map();let saved=snapshotModels(),conflict=false;
  const project=fixtureProject();
  await context.addInitScript(studioHistoryBootstrap);
  await context.route('**/*',async route=>{try{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    if(url.origin===new URL(OPENCLAW_DASHBOARD_URL).origin){assert.equal(url.pathname,new URL(OPENCLAW_DASHBOARD_URL).pathname);return route.fulfill({contentType:'text/html',body:'<h1>Isolated dashboard handoff</h1>'});}
    assert.equal(url.origin,origin,'all requests are intercepted; unexpected destinations fail');
    if(request.isNavigationRequest()){
      assert.equal(method,'GET');documents.push(url.pathname+url.search);
      // Öppna spelbord lämnar Dialogtest med ett dokumentbyte; spelrummet (eller spelbordslistan vid
      // tvetydiga bord) ligger utanför provet.
      if(/^\/admin\/rooms(?:\/|$)/.test(url.pathname)||(url.pathname==='/admin/companies'&&url.searchParams.get('tab')==='spelbord'))return route.fulfill({contentType:'text/html',body:'<h1>Isolerat spelrum</h1>'});
      assert.ok(appDocument(url.pathname),'unexpected document '+url.pathname);
      return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/fixture.js"></script>'});
    }
    if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:await fixtureSource()});
    // System › AI-agenter läser också OpenAI-flaggan på sin egen adress; den räknas inte som modelläsning.
    if(url.pathname==='/studio/api/openclaw/admin'){assert.equal(method,'GET');return route.fulfill({json:{openaiKeyConfigured:true}});}
    const entry={path:url.pathname,method,...(method!=='GET'?{body:request.postDataJSON()}:{})};
    (method==='GET'?reads:writes).push(entry);
    const gate=held.get(method+' '+url.pathname);if(gate){held.delete(method+' '+url.pathname);gate.started();await gate.promise;}
    // Röst och tal läser arbetsytan för både Svarsbibliotek (stubbat) och Dialogtest.
    if(['/api/admin/workspace/dealer-agent','/api/admin/workspace/replies'].includes(url.pathname))return route.fulfill({json:{project,videos:{videos:[]},status:{configured:true,provider:'fixture'},connectedLane:false,operators:[],directory:null,storeAvailable:true}});
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
    assert.fail('unexpected request '+method+' '+url.pathname);
  }catch(error){failures.push(error);await route.fulfill({status:500,body:'Isolated fixture failed'});}});
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>failures.push(error));page.on('dialog',async dialog=>{dialogs.push(dialog.type());await dialog.dismiss();});
  const f={page,reads,writes,documents,dialogs,get saved(){return saved;},conflict(){conflict=true;},hold(method,path){let release,started;const promise=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);held.set(method+' '+path,{promise,release,started});return{release,seen};},snapshot:()=>page.evaluate(()=>({href:location.href,state:history.state,length:history.length})),async close(){for(const gate of held.values())gate.release();await context.close();assert.deepEqual(failures,[]);}};
  try{await page.goto(origin+start);await ready(f);}catch(error){await context.close();throw failures[0]??error;}
  return f;
}
async function waitRequest(gate){let timer;try{await Promise.race([gate.seen,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('expected isolated request did not start')),7000))]);}finally{clearTimeout(timer);}}
const dialogRegion=f=>f.page.getByRole('region',{name:'Dialogtest för vald dealer',exact:true});
const chatInput=f=>dialogRegion(f).getByRole('textbox',{name:'Meddelande',exact:true});
const sendButton=f=>dialogRegion(f).getByRole('button',{name:'Skicka',exact:true});
const roomButton=f=>f.page.getByRole('button',{name:'Öppna spelbord',exact:true});
const modelSelect=f=>f.page.getByRole('combobox',{name:/^Modell för croupier-director/});
const saveModel=f=>f.page.getByRole('button',{name:'Spara modell för croupier-director',exact:true});
const labels={elin:'Elin',lina:'Lina'};
// Deterministiskt: adressen, Dialogtests rubrik, dess navigering för just den dealern, regionen och meddelandefältet.
async function dialogReady(f,id){
  await f.page.waitForURL(url=>url.pathname==='/admin/dealers/'+id&&url.searchParams.get('flik')==='tal'&&url.searchParams.get('verktyg')==='dialog');
  await f.page.getByRole('heading',{level:1,name:'Dialogtest',exact:true}).waitFor();await f.page.getByRole('navigation',{name:'Studio för '+labels[id],exact:true}).waitFor();
  await dialogRegion(f).waitFor();await chatInput(f).waitFor();
}
// System › AI-agenter: fliken är vald och modellistan är hämtad.
async function modelsReady(f){
  await f.page.waitForURL(url=>url.pathname==='/admin/system'&&url.searchParams.get('flik')==='agenter');
  await f.page.getByRole('heading',{name:'Registrerade agentroller',exact:true}).waitFor();await modelSelect(f).waitFor();
}
async function rejectTraversal(f,delta){const before=await f.snapshot(),count=await f.page.evaluate(()=>window.__traversals);await f.page.evaluate(delta=>history.go(delta),delta);await f.page.waitForFunction(count=>window.__traversals>count,count);await f.page.waitForURL(before.href);await f.page.waitForFunction(()=>!window.__historyOwner.isRestoring());assert.deepEqual(await f.snapshot(),before);}
async function move(f,target){assert.equal(await f.page.evaluate(target=>window.__move(target),target),true);}
const contextOf=href=>{const query=new URL(href,origin).searchParams;return Object.fromEntries(['operator','table','composition','game','event','variant','room'].map(key=>[key,query.getAll(key)]));};
const reply=(f,dealer,text)=>dialogRegion(f).getByText('Svar för '+dealer+': '+text,{exact:true});
async function sendChat(f,text){await chatInput(f).fill(text);await sendButton(f).click();}
const studioLink=f=>f.page.getByRole('navigation',{name:/^Studio för /}).getByRole('link',{name:'Röst & tal',exact:true});
const savedNotice=(f,primary)=>f.page.getByRole('status').filter({hasText:'croupier-director: '+primary+' sparad och bekräftad i AI-agenternas inställningar.'});
const roomDocument=f=>f.documents.filter(path=>/^\/admin\/(?:rooms(?:[/?]|$)|companies(?:\?|$))/.test(path));

test('Dialogtest and AI-agenter keep context on links and bookmarks, and an accepted dealer change isolates conversations',{skip},()=>withBrowser(async browser=>{
  // Det gamla bokmärket /admin/dealer-agent landar på Dialogtest under dealerns Röst och tal med hela kontexten.
  const bookmark='/admin/dealer-agent?'+new URLSearchParams({dealer:'elin',...shared,room:'room-a'});
  const f=await openFixture(browser,bookmark);try{
    assert.deepEqual(contextOf(f.page.url()),contextOf(bookmark));
    const studio=new URL(await studioLink(f).getAttribute('href'),origin);assert.equal(studio.pathname,'/admin/dealers/elin');assert.equal(studio.searchParams.get('flik'),'tal');
    for(const key of ['composition','game','operator','table','room'])assert.deepEqual(studio.searchParams.getAll(key),new URL(f.page.url()).searchParams.getAll(key),key);
    await sendChat(f,'First');await reply(f,'elin','First').waitFor();
    await move(f,dialog('lina',{composition:'scene-b',game:'roulette'}));await dialogReady(f,'lina');assert.equal(await reply(f,'elin','First').count(),0);assert.equal(await chatInput(f).inputValue(),'');
    await sendChat(f,'Second');await reply(f,'lina','Second').waitFor();
    const chats=f.writes.filter(row=>row.path==='/api/chat');assert.deepEqual(chats.map(row=>row.body.dealerId),['elin','lina']);assert.notEqual(chats[0].body.conversationId,chats[1].body.conversationId);
    await f.page.goBack();await dialogReady(f,'elin');assert.equal(await reply(f,'lina','Second').count(),0);await f.page.goForward();await dialogReady(f,'lina');await f.page.reload();await dialogReady(f,'lina');
    // Det gamla bokmärket /admin/ai/models landar på System › AI-agenter med samma kontext.
    const lina=new URL(f.page.url()),modelsBookmark='/admin/ai/models?'+new URLSearchParams([...lina.searchParams].filter(([key])=>!['flik','verktyg'].includes(key)).concat([['dealer','lina']]));
    await f.page.goto(origin+modelsBookmark);await modelsReady(f);assert.deepEqual(contextOf(f.page.url()),contextOf(modelsBookmark));assert.equal(new URL(f.page.url()).searchParams.get('dealer'),'lina');
    await f.page.goBack();await dialogReady(f,'lina');
    // Öppna spelbord lämnar Dialogtest för det valda spelbordets nav; bolag och spelbord följer med.
    await roomButton(f).click();await f.page.getByRole('heading',{name:'Isolerat spelrum',exact:true}).waitFor();
    const room=new URL(roomDocument(f).at(-1),origin);assert.equal(room.pathname,'/admin/rooms/room-a');assert.deepEqual(room.searchParams.getAll('operator'),['operator-a']);assert.deepEqual(room.searchParams.getAll('table'),['room-a']);
    assert.equal(f.reads.some(row=>row.path==='/api/voice'),false);assert.deepEqual(f.dialogs,[]);
  }finally{await f.close();}
}));

test('chat draft and in-flight response guard actual Admin navigation and Back/Forward/multi-step history',{skip},()=>withBrowser(async browser=>{
  for(const mode of ['draft','request'])for(const delta of [-1,1,-2]){const f=await openFixture(browser);try{
    await move(f,dialog('lina'));await dialogReady(f,'lina');await move(f,dialog('elin',{game:'roulette'}));await dialogReady(f,'elin');
    if(delta===1){await f.page.goBack();await dialogReady(f,'lina');}
    await f.page.evaluate(()=>history.replaceState({...history.state,foreign:{keep:'owned-state'}},'',location.href));
    await chatInput(f).fill('Keep this question');let gate;
    if(mode==='request'){gate=f.hold('POST','/api/chat');await sendButton(f).click();await waitRequest(gate);}
    assert.equal(await f.page.evaluate(()=>window.__navigate('/admin/system?flik=agenter')),false);
    const before=f.page.url(),documents=f.documents.length;await roomButton(f).click();assert.equal(f.page.url(),before);assert.equal(f.documents.length,documents);assert.deepEqual(f.dialogs,[],'appens eget skydd stoppar, inte webbläsarens beforeunload-dialog');
    await rejectTraversal(f,delta);
    if(mode==='draft'){assert.equal(await chatInput(f).inputValue(),'Keep this question');await chatInput(f).fill('');}
    else{assert.equal(await sendButton(f).isDisabled(),true);gate.release();await dialogRegion(f).getByText(/^Svar för (?:elin|lina): Keep this question$/).waitFor();assert.equal(f.writes.length,1);}
    await f.page.evaluate(delta=>history.go(delta),delta);await dialogReady(f,delta===-1?'lina':'elin');assert.equal(new URL(f.page.url()).searchParams.get('table'),'room-a');
  }finally{await f.close();}}
}));

test('global model drafts and PATCH/readback protect actual Admin history without altering mutation scope',{skip},()=>withBrowser(async browser=>{
  for(const delta of [-1,1,-2]){const f=await openFixture(browser,models(),modelsReady);try{
    await move(f,models({dealer:'lina',game:'roulette'}));await move(f,models({composition:'scene-c'}));if(delta===1)await f.page.goBack();
    await f.page.evaluate(()=>history.replaceState({...history.state,foreign:{keep:'models'}},'',location.href));
    await modelSelect(f).selectOption('provider/new');assert.equal(await f.page.evaluate(target=>window.__navigate(target),dialog('elin')),false);await rejectTraversal(f,delta);
    assert.equal(await modelSelect(f).inputValue(),'provider/new');const patch=f.hold('PATCH','/api/openclaw/admin'),readback=f.hold('GET','/api/openclaw/admin');
    await saveModel(f).click();await waitRequest(patch);await rejectTraversal(f,delta);assert.equal(await f.page.evaluate(target=>window.__navigate(target),dialog('elin')),false);
    patch.release();await waitRequest(readback);await rejectTraversal(f,delta);assert.equal(await savedNotice(f,'provider/new').count(),0);
    readback.release();await savedNotice(f,'provider/new').waitFor();assert.equal(f.writes.length,1);
    assert.deepEqual(f.writes[0].body,{version:1,baseHash:'revision-a',agentId:'croupier-director',model:{primary:'provider/new',fallbacks:['provider/backup','other/backup']}});
    await f.page.evaluate(delta=>history.go(delta),delta);const target=delta===-1?models({dealer:'lina',game:'roulette'}):delta===1?models({composition:'scene-c'}):models();
    await f.page.waitForURL(origin+target);await f.page.waitForFunction(()=>!window.__historyOwner.isRestoring());assert.equal(await modelSelect(f).inputValue(),'provider/new');
    await f.page.reload();await modelsReady(f);assert.equal(f.page.url(),origin+target);assert.equal(await modelSelect(f).inputValue(),'provider/new');
  }finally{await f.close();}}
}));

test('model conflict keeps the draft and requires fresh revision before retry; dashboard handoff releases only its verified request',{skip},()=>withBrowser(async browser=>{
  const f=await openFixture(browser,models(),modelsReady);try{
    await modelSelect(f).selectOption('provider/new');f.conflict();await saveModel(f).click();await f.page.getByRole('alert').filter({hasText:'Inställningarna har ändrats av någon annan'}).waitFor();
    assert.equal(await modelSelect(f).inputValue(),'provider/new');assert.equal(await f.page.evaluate(target=>window.__navigate(target),dialog('elin')),false);
    const dashboard=f.page.getByRole('button',{name:'Öppna AI-agenternas egen dashboard ↗',exact:true});assert.equal(await dashboard.isDisabled(),true);assert.equal(await saveModel(f).isDisabled(),true);
    await f.page.getByRole('button',{name:'Hämta aktuella val',exact:true}).click();
    await saveModel(f).click();await savedNotice(f,'provider/new').waitFor();assert.equal(f.writes[1].body.baseHash,'revision-concurrent');
    await move(f,models({dealer:'lina'}));const handoff=f.hold('POST','/api/openclaw/admin');await dashboard.click();await waitRequest(handoff);await rejectTraversal(f,-1);assert.equal(await f.page.evaluate(target=>window.__navigate(target),dialog('elin')),false);
    handoff.release();await f.page.getByRole('heading',{name:'Isolated dashboard handoff',exact:true}).waitFor();assert.deepEqual(f.dialogs,[]);assert.equal(f.writes.length,3);
  }finally{await f.close();}
}));

test('aborted old-dealer chat cannot contaminate a new session, and an unknown dealer or mixed rooms never silently change scope',{skip},()=>withBrowser(async browser=>{
  const f=await openFixture(browser);try{
    const pending=f.hold('POST','/api/chat');await sendChat(f,'Old dealer request');await waitRequest(pending);
    // Tvinga ett komponentbyte för att prova städningen av sena svar skilt från den skyddade navigeringen.
    await f.page.evaluate(target=>window.__historyOwner.push(target),dialog('lina'));await dialogReady(f,'lina');await f.page.waitForFunction(()=>window.__aborts.some(url=>url.endsWith('/api/chat')));pending.release();
    await sendChat(f,'New dealer request');await reply(f,'lina','New dealer request').waitFor();assert.equal(await reply(f,'elin','Old dealer request').count(),0);assert.notEqual(f.writes[0].body.conversationId,f.writes[1].body.conversationId);
    // En okänd dealer i adressen visar ingen chatt och väljer ingen annan dealer i tysthet.
    await move(f,dialog('unknown'));await f.page.getByRole('heading',{level:1,name:'Dealer',exact:true}).waitFor();assert.equal(await dialogRegion(f).count(),0);assert.equal(await chatInput(f).count(),0);assert.equal(f.writes.length,2);
    const mixed=dialog('elin')+'&table=room-b&room=room-c&operator=other';await move(f,mixed);await dialogReady(f,'elin');
    const studio=new URL(await studioLink(f).getAttribute('href'),origin);assert.deepEqual(studio.searchParams.getAll('table'),['room-a','room-b']);assert.deepEqual(studio.searchParams.getAll('operator'),['operator-a','other']);assert.equal(studio.searchParams.get('room'),'room-c');
    await roomButton(f).click();await f.page.getByRole('heading',{name:'Isolerat spelrum',exact:true}).waitFor();
    // Tvetydiga bord väljs aldrig tyst: länken går till bolagets spelbordslista, inte till första bordet.
    const room=new URL(roomDocument(f).at(-1),origin);assert.equal(room.pathname,'/admin/companies');assert.equal(room.searchParams.get('tab'),'spelbord');assert.deepEqual(room.searchParams.getAll('table'),['room-a','room-b']);assert.equal(room.searchParams.get('room'),'room-c');
    // Modellvalet är globalt: blandade spelbord i adressen ändrar inte vad PATCH gäller.
    const modelsBookmark='/admin/ai/models'+new URL(mixed,origin).search.replace(/^\?flik=tal&verktyg=dialog&?/,'?');await f.page.goto(origin+modelsBookmark);await modelsReady(f);
    assert.deepEqual(new URL(f.page.url()).searchParams.getAll('table'),['room-a','room-b']);assert.equal(new URL(f.page.url()).searchParams.get('room'),'room-c');
    await modelSelect(f).selectOption('provider/new');await saveModel(f).click();await savedNotice(f,'provider/new').waitFor();
    assert.deepEqual(f.writes.at(-1).body,{version:1,baseHash:'revision-a',agentId:'croupier-director',model:{primary:'provider/new',fallbacks:['provider/backup','other/backup']}});
  }finally{await f.close();}
}));
