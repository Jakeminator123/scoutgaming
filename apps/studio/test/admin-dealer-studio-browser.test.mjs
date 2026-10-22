import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname} from 'node:path';
import {build} from 'esbuild';
import {addDealer,createSeedProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {studioHistoryBootstrap} from '../lib/studio-history.mjs';
const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const origin='https://admin-dealer-studio.fixture.invalid';
const lab=dirname(dirname(fileURLToPath(import.meta.url)));
const shared={operator:'operator-a',table:'room-a',composition:'scene-a',game:'roulette'};
const href=(selection={})=>'/admin/dealer-studio?'+new URLSearchParams({...shared,dealer:'elin',view:'speech',...selection});
const fixtureProject=()=>addDealer(addDealer(createSeedProject(),'elin','Elin'),'lina','Lina');
function forge(dealer){return {dealer:{id:dealer,label:dealer==='elin'?'Elin':'Lina'},profile:{subject:'Saved identity',theme:'Room',tableStyle:'Felt',positions:{},anchors:{},avatar:null,voice:{presetId:'victoria'},language:'en',revision:1},groups:[],slots:['vila','redo'].map(pose=>({id:'pose/'+pose,group:'pose',kind:'image',label:pose,media:[],jobs:[],status:{level:'required',label:'Saknas',count:0}})),jobs:[],layers:[],speechLines:{},migrationReady:true,runwayConfigured:false,priceChecked:'fixture'};}
let source;
async function fixtureSource(){return source??=build({stdin:{contents:`import './client/admin/entry';
import {studioHistory} from './lib/studio-history.mjs';import {navigate} from './client/runtime/navigation';
const owner=window.__historyOwner=studioHistory(window);window.__navigate=navigate;window.__traversals=0;
if(window.__previousEntry){const accepted=location.href;owner.push(window.__previousEntry,true);owner.push(accepted);}
owner.guardTraversal(()=>{window.__traversals++;return true;});`,resolveDir:lab,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'""','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"'},alias:{react:fileURLToPath(new URL('../client/node_modules/react',import.meta.url)),'react-dom':fileURLToPath(new URL('../client/node_modules/react-dom',import.meta.url)),'next/navigation':fileURLToPath(new URL('../client/runtime/navigation.tsx',import.meta.url))},plugins:[{name:'dealer-studio-boundaries',setup(builder){
  builder.onResolve({filter:/\.module\.css$/},args=>({path:args.path,namespace:'fixture-css'}));
  builder.onLoad({filter:/.*/,namespace:'fixture-css'},()=>({contents:'export default {}'}));
  builder.onResolve({filter:/^\./},args=>{const importer=args.importer.replaceAll('\\','/');
    if(importer.endsWith('/client/admin/entry.tsx')&&((args.path.startsWith('./components/')&&!args.path.endsWith('/workspace-tools'))||args.path.startsWith('./app/')))return{path:args.path,namespace:'unused-admin'};
    if(importer.endsWith('/workspace-tools.tsx')&&(args.path.includes('/components/')&&!args.path.endsWith('/lab-studio')||args.path==='./connected-services'))return{path:args.path,namespace:'unused-admin'};
    if(importer.endsWith('/lab-studio.tsx')&&['./idle-policy-editor','./registered-idle-editor','./legacy-clip-editor','./media-family-editor','./dealer-registration','./dealer-media-library','./dealer-removal','./dealer-video-surface','./dealer-speech-slot-editor','./page-template.mjs'].includes(args.path))return{path:args.path,namespace:'media-boundary'};
  });
  builder.onLoad({filter:/.*/,namespace:'unused-admin'},()=>({contents:'export default ()=>null;export const StudioSidebar=()=>null,RegisteredStudio=()=>null,ConnectedClipMap=()=>null,ConnectedServices=()=>null,RegisteredMaterialLibrary=()=>null,AdminHome=()=>null,DealerDirectory=()=>null,ResourceConnections=()=>null,ResourceDeletion=()=>null,WorkspaceToolsHome=()=>null,AdminPublicationPage=()=>null,ControlActivityPage=()=>null,ControlPreviewPage=()=>null,ControlEventsPage=()=>null,ControlTreePage=()=>null,ControlProbePage=()=>null,ControlRepliesPage=()=>null,ControlVideosPage=()=>null,ControlGuidePage=()=>null,ControlOpenClawChat=()=>null;'}));
  builder.onLoad({filter:/.*/,namespace:'media-boundary'},args=>({loader:'tsx',contents:args.path==='./page-template.mjs'?'export const publishShellStatus=()=>{};export const PageTemplate=p=><><h1>{p.title}</h1>{p.primary}{p.children}</>;':args.path==='./dealer-media-library'?`export function DealerMediaLibrary(p){return <section aria-label="Isolerat mediaval"><output data-testid="category">{p.category}</output><output data-testid="slot">{p.slotId}</output><select aria-label="Klippkategori" value={p.category} onChange={e=>p.onCategoryChange(e.target.value)}>{['idle','all','deal','speech','reaction','action'].map(x=><option key={x}>{x}</option>)}</select><button onClick={()=>p.onConfigureSlot('speak.goodluck','goodluck')}>Öppna valt fack</button>{p.slotEditor}</section>;}`:'export const IdlePolicyEditor=()=>null,RegisteredIdleEditor=()=>null,LegacyClipEditor=()=>null,MediaFamilyEditor=()=>null,DealerRegistration=()=>null,DealerRemoval=()=>null,DealerClipPreview=()=>null,DealerSpeechSlotEditor=()=>null;'}));
}}]}).then(result=>result.outputFiles[0].text);}
async function withBrowser(run){const {chromium}=await import(pathToFileURL(browserModule).href);const browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});try{await run(browser);}finally{await browser.close();}}
async function openFixture(browser,start=href(),previousEntry=''){
  const context=await browser.newContext(),failures=[],reads=[],writes=[],dialogs=[],held=new Map();let saved=fixtureProject(),conflict=false;
  await context.addInitScript(studioHistoryBootstrap);
  await context.route('**/*',async route=>{try{
    const request=route.request(),url=new URL(request.url()),method=request.method();assert.equal(url.origin,origin,'no real media, provider, or product network');
    const entry={path:url.pathname,method,...(method!=='GET'?{body:request.postDataJSON()}:{})};(method==='GET'?reads:writes).push(entry);
    const gate=held.get(method+' '+url.pathname);if(gate){gate.started();await gate.promise;held.delete(method+' '+url.pathname);}
    if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:await fixtureSource()});
    if(url.pathname==='/api/admin/workspace/dealer-studio'){assert.equal(method,'GET');assert.equal(url.search,'');return route.fulfill({json:{project:saved,videos:{videos:[]},status:{configured:true,provider:'fixture'},connectedLane:true,operators:[],directory:null,storeAvailable:true}});}
    if(url.pathname==='/api/project'){
      if(method==='GET')return route.fulfill({json:{project:saved}});
      assert.equal(method,'PUT');assert.deepEqual(Object.keys(entry.body).sort(),['expectedRevision','project']);assert.equal(entry.body.expectedRevision,saved.revision);
      if(conflict){conflict=false;saved={...saved,revision:saved.revision+1,events:saved.events.map(row=>row.id==='idle.ready'?{...row,label:'Remote idle label'}:row)};return route.fulfill({status:409,json:{error:'project_revision_conflict'}});}
      saved={...entry.body.project,revision:saved.revision+1};return route.fulfill({json:{project:saved}});
    }
    if(url.pathname.startsWith('/api/forge/')){assert.equal(method,'GET','generation and provider writes are outside this fixture');const dealer=url.pathname.slice('/api/forge/'.length);assert.ok(['elin','lina'].includes(dealer));return route.fulfill({json:forge(dealer)});}
    assert.equal(method,'GET');assert.ok(['/admin/dealer-studio','/admin/rehearsal'].includes(url.pathname));
    return route.fulfill({contentType:'text/html',body:url.pathname==='/admin/rehearsal'?'<h1>Isolerad provspelningsdestination</h1>':'<div id="root"></div><script>window.__previousEntry='+JSON.stringify(previousEntry)+'</script><script src="/fixture.js"></script>'});
  }catch(error){failures.push(error);await route.fulfill({status:500,body:'Isolated fixture failed'});}});
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>failures.push(error));page.on('dialog',async dialog=>{dialogs.push(dialog.type());await dialog.dismiss();});
  await page.goto(origin+start);
  try{if(start.endsWith('#stream'))await page.getByRole('heading',{name:'Isolerad provspelningsdestination',exact:true}).waitFor();else{await page.getByRole('heading',{name:'Dealers & klipp',exact:true}).waitFor();await selected(page,new URL(start,origin).searchParams.get('dealer'));}}catch(error){await context.close();throw failures[0]??error;}
  return{page,reads,writes,dialogs,get saved(){return saved;},conflict(){conflict=true;},hold(method,path){let release,started;const promise=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);held.set(method+' '+path,{promise,release,started});return{release,seen};},snapshot:()=>page.evaluate(()=>({href:location.href,state:history.state,length:history.length})),async close(){for(const gate of held.values())gate.release();await context.close();assert.deepEqual(failures,[]);}};
}
const selected=(page,id)=>page.getByRole('group',{name:'Välj dealer',exact:true}).locator('button[aria-pressed="true"]').filter({hasText:id==='elin'?'Elin':id==='lina'?'Lina':'Astrid'}).waitFor();
const tab=(page,name)=>page.getByRole('navigation',{name:/^Studio för /}).getByRole('link',{name,exact:true});
const speechNotice=page=>page.getByText('Talformuläret har ändringar som inte lagts till i projektutkastet. Flikarna kan bytas. Innan du byter dealer eller lämnar sidan: använd talunderlaget eller ångra ändringarna under Tal & automatik.',{exact:true});
async function discardVoice(f){await f.page.getByRole('button',{name:'Ångra ändringar i talformuläret',exact:true}).click();await speechNotice(f.page).waitFor({state:'hidden'});}
const saveButton=page=>page.getByRole('button',{name:'Spara inställningar',exact:true}).first();
async function choose(f,id){await f.page.getByRole('group',{name:'Välj dealer',exact:true}).getByRole('button',{name:id==='elin'?'E Elin':'L Lina',exact:true}).click();await selected(f.page,id);}
async function voiceDraft(f){if(await tab(f.page,'Tal & automatik').getAttribute('aria-current')!=='page')await tab(f.page,'Tal & automatik').click();await f.page.getByLabel(/^Röst(?:Välj|$)/).selectOption('paow');await speechNotice(f.page).waitFor({state:'visible'});}
async function applyVoice(f){await voiceDraft(f);await f.page.getByRole('button',{name:'Använd talunderlag i utkastet',exact:true}).click();await f.page.getByText('Talprofilen finns i utkastet. Spara inställningarna för att behålla den. Sparandet startar inget talprov.',{exact:true}).waitFor();}
async function waitRequest(gate){let timer;try{await Promise.race([gate.seen,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('expected request did not start')),7000))]);}finally{clearTimeout(timer);}}
async function rejectTraversal(f,delta){const before=await f.snapshot(),count=await f.page.evaluate(()=>window.__traversals);await f.page.evaluate(delta=>history.go(delta),delta);await f.page.waitForFunction(count=>window.__traversals>count,count);await f.page.waitForURL(before.href);await f.page.waitForFunction(()=>!window.__historyOwner.isRestoring());assert.deepEqual(await f.snapshot(),before);}

async function rejectExit(f,target){const before=await f.snapshot(),dialog=f.page.waitForEvent('dialog');await f.page.evaluate(target=>window.__navigate(target),target);assert.equal((await dialog).type(),'beforeunload');assert.deepEqual(await f.snapshot(),before);}
function contextOf(url){return Object.fromEntries(Object.entries(shared).map(([key])=>[key,new URL(url,origin).searchParams.get(key)]));}

test('actual Admin dealer studio restores exact selection, tabs, context and saved links after history and reload',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await openFixture(browser,href({view:'clips',category:'speech',event:'speak.goodluck',situation:'goodluck',variant:'selected-variant'}));try{
    await f.page.getByTestId('slot').waitFor();assert.equal(await f.page.getByTestId('slot').textContent(),'speak.goodluck/goodluck');
    for(const link of await f.page.getByRole('navigation',{name:'Studio för Elin',exact:true}).locator('a').evaluateAll(rows=>rows.map(row=>row.href))){assert.deepEqual(contextOf(link),shared);assert.equal(new URL(link).searchParams.get('variant'),'selected-variant');}
    await f.page.evaluate(()=>history.replaceState({...history.state,foreign:{keep:'entry-a'},__NA:true},''));const a=await f.snapshot();
    await tab(f.page,'Inställningar').click();await f.page.getByRole('heading',{name:'Inställningar · Elin',exact:true}).waitFor();const b=await f.snapshot();
    await choose(f,'lina');const c=await f.snapshot();assert.equal(f.writes.length,0);assert.equal(f.reads.filter(row=>row.path==='/admin/dealer-studio').length,1,'tabs and dealer selection stay in the same document');
    await f.page.goBack();await f.page.waitForURL(b.href);await selected(f.page,'elin');await f.page.getByRole('heading',{name:'Inställningar · Elin',exact:true}).waitFor();
    await f.page.goBack();await f.page.waitForURL(a.href);assert.equal(await f.page.getByTestId('slot').textContent(),'speak.goodluck/goodluck');assert.deepEqual((await f.snapshot()).state,a.state);
    await f.page.goForward();await f.page.waitForURL(b.href);await f.page.goForward();await f.page.waitForURL(c.href);await selected(f.page,'lina');
    await f.page.reload();await selected(f.page,'lina');await f.page.getByRole('heading',{name:'Inställningar · Lina',exact:true}).waitFor();assert.deepEqual(contextOf(f.page.url()),shared);
  }finally{await f.close();}
}));

test('actual Admin speech drafts veto Back, Forward and multistep dealer traversal without changing entries',{skip:!browserModule},()=>withBrowser(async browser=>{
  for(const delta of [-1,1,-2]){
    const f=await openFixture(browser,href({dealer:'astrid'}));try{
      await f.page.evaluate(()=>history.replaceState({...history.state,foreign:{label:'A'},__NA:true},''));const a=await f.snapshot();
      await choose(f,'elin');await f.page.evaluate(()=>history.replaceState({...history.state,foreign:{label:'B'}},''));const b=await f.snapshot();
      await choose(f,'lina');await f.page.evaluate(()=>history.replaceState({...history.state,foreign:{label:'C'}},''));const c=await f.snapshot();
      if(delta===1){await f.page.goBack();await f.page.waitForURL(b.href);await selected(f.page,'elin');}
      await voiceDraft(f);await rejectTraversal(f,delta);await rejectTraversal(f,delta);assert.equal(await f.page.getByLabel(/^Röst(?:Välj|$)/).inputValue(),'paow');
      await rejectExit(f,'/admin/rehearsal');assert.equal(f.writes.length,0);
      await discardVoice(f);
      await f.page.evaluate(delta=>history.go(delta),delta);await f.page.waitForURL((delta===1?c:delta===-1?b:a).href);await selected(f.page,delta===1?'lina':delta===-1?'elin':'astrid');
    }finally{await f.close();}
  }
}));

test('actual Admin saves with CAS, reloads the persisted project and recovers 409 without losing a draft',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await openFixture(browser);try{
    const originalRevision=f.saved.revision;await applyVoice(f);assert.equal(f.writes.length,0);await saveButton(f.page).click();await f.page.getByText('Sparat.',{exact:true}).waitFor();
    assert.equal(f.writes.length,1);assert.equal(f.writes[0].body.expectedRevision,originalRevision);assert.equal(f.saved.revision,originalRevision+1);
    await f.page.reload();await selected(f.page,'elin');assert.equal(await f.page.getByLabel(/^Röst(?:Välj|$)/).inputValue(),'paow');
    await f.page.getByLabel(/^Röstspråk/).selectOption('en');await f.page.getByRole('button',{name:'Använd talunderlag i utkastet',exact:true}).click();f.conflict();await saveButton(f.page).click();
    await f.page.getByText('Projektet har ändrats i en annan vy.',{exact:true}).waitFor();assert.equal(await f.page.getByLabel(/^Röstspråk/).inputValue(),'en');
    await rejectExit(f,'/admin/rehearsal');
    await f.page.getByRole('button',{name:'Hämta senaste · behåll mitt utkast',exact:true}).click();await f.page.getByText('Utkastet är sammanslaget. Granska dina val och spara.',{exact:true}).waitFor();
    await saveButton(f.page).click();await f.page.getByText('Sparat.',{exact:true}).waitFor();assert.equal(f.saved.events.find(row=>row.id==='idle.ready').label,'Remote idle label');
    await f.page.reload();await selected(f.page,'elin');assert.equal(await f.page.getByLabel(/^Röstspråk/).inputValue(),'en');
    await tab(f.page,'Provspelning & logg').click();await f.page.getByRole('heading',{name:'Isolerad provspelningsdestination',exact:true}).waitFor();assert.deepEqual(f.dialogs,['beforeunload']);assert.deepEqual(contextOf(f.page.url()),shared);
  }finally{await f.close();}
}));

test('actual Admin project draft and pending save veto an earlier same-document route and dealer change',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await openFixture(browser,href(),'/admin/tools?dealer=elin');try{
    await applyVoice(f);await rejectTraversal(f,-1);await rejectExit(f,'/admin/tools');
    const gate=f.hold('PUT','/api/project');await saveButton(f.page).click();await waitRequest(gate);const before=await f.snapshot();
    await tab(f.page,'Inställningar').click();await f.page.getByRole('group',{name:'Välj dealer',exact:true}).getByRole('button',{name:'L Lina',exact:true}).click();assert.deepEqual(await f.snapshot(),before);await selected(f.page,'elin');await rejectTraversal(f,-1);
    gate.release();await f.page.getByText('Sparat.',{exact:true}).waitFor();assert.equal(f.writes.length,1);await f.page.reload();await selected(f.page,'elin');assert.equal(await f.page.getByLabel(/^Röst(?:Välj|$)/).inputValue(),'paow');
  }finally{await f.close();}
}));

test('actual material profile draft remains mounted across Admin tabs and blocks dealer and route exits',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await openFixture(browser);try{
    await tab(f.page,'Skapa material').click();await f.page.getByLabel('Identitet i prompten',{exact:true}).fill('Unsaved identity');
    await tab(f.page,'Tal & automatik').click();await f.page.getByRole('heading',{name:'Tal & automatik · Elin',exact:true}).waitFor();
    assert.equal(await f.page.getByLabel('Identitet i prompten',{exact:true}).inputValue(),'Unsaved identity');await rejectExit(f,'/admin/rehearsal');
    await f.page.getByRole('group',{name:'Välj dealer',exact:true}).getByRole('button',{name:'L Lina',exact:true}).click();await selected(f.page,'elin');await f.page.getByLabel('Identitet i prompten',{exact:true}).waitFor();assert.equal(await f.page.getByLabel('Identitet i prompten',{exact:true}).inputValue(),'Unsaved identity');
    await f.page.getByRole('button',{name:'Ångra materialutkast',exact:true}).click();await choose(f,'lina');assert.equal(f.writes.length,0,'no profile, job, provider or media mutation');
  }finally{await f.close();}
}));

test('Admin editor links and legacy hash handoff retain explicit ambiguous room and operator selectors',{skip:!browserModule},()=>withBrowser(async browser=>{
  const start=href({view:'idle'})+'&room=room-b&table=room-c&operator=operator-b';
  const f=await openFixture(browser,start);try{
    const expected=new URL(start,origin).searchParams;
    for(const href of await f.page.locator('a[href*="/admin/rehearsal"],nav[aria-label="Fackets inställningar"] a').evaluateAll(rows=>rows.map(row=>row.href))){const target=new URL(href);for(const key of ['operator','table','room'])assert.deepEqual(target.searchParams.getAll(key),expected.getAll(key));assert.equal(target.searchParams.get('game'),'roulette');}
  }finally{await f.close();}
  const legacy=await openFixture(browser,start+'#stream');try{
    const target=new URL(legacy.page.url()),expected=new URL(start,origin).searchParams;assert.equal(target.pathname,'/admin/rehearsal');for(const key of ['operator','table','room'])assert.deepEqual(target.searchParams.getAll(key),expected.getAll(key));assert.equal(target.searchParams.get('game'),'roulette');assert.equal(legacy.writes.length,0);
  }finally{await legacy.close();}
}));

test('unknown Admin history fallback retains the accepted selection and foreign state while a speech draft is pending',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await openFixture(browser,href({dealer:'astrid'}));try{
    await f.page.evaluate(()=>{const foreign={...history.state,__NA:true,foreign:{label:'unknown'}};delete foreign.__scoutAdminHistory;history.pushState(foreign,'',location.href+'&older=1');});
    // Foreign metadata is registered with the owner before its unknown-entry fallback is exercised.
    await choose(f,'elin');await f.page.evaluate(()=>{history.replaceState({...history.state,foreign:{label:'accepted'}},'');window.__historyOwner.replaceContext(location.href);});const before=await f.snapshot();await voiceDraft(f);
    const count=await f.page.evaluate(()=>window.__traversals);await f.page.evaluate(()=>history.back());await f.page.waitForFunction(count=>window.__traversals>count,count);await f.page.waitForURL(before.href);await f.page.waitForFunction(()=>!window.__historyOwner.isRestoring());await selected(f.page,'elin');
    const after=await f.snapshot();assert.equal(after.length,before.length);assert.deepEqual(after.state.foreign,before.state.foreign);assert.equal(after.state.__NA,true);assert.equal(await f.page.getByLabel(/^Röst(?:Välj|$)/).inputValue(),'paow');
    await discardVoice(f);await f.page.goForward();await f.page.waitForFunction(session=>history.state.__scoutAdminHistory.session===session,before.state.__scoutAdminHistory.session);assert.deepEqual(await f.snapshot(),before);
  }finally{await f.close();}
}));
