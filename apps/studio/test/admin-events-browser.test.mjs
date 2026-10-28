import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname} from 'node:path';
import {build} from 'esbuild';
import {addDealer,addVariant,createSeedProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {studioHistoryBootstrap} from '../lib/studio-history.mjs';
const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const origin='https://admin-events.fixture.invalid';
const shared={composition:'fixture-composition',operator:'fixture-operator',table:'fixture-table',room:'fixture-room',game:'roulette'};
const lab=dirname(dirname(fileURLToPath(import.meta.url)));
const eventId='deal.player.left';
function fixtureProject(){let project=addDealer(addDealer(createSeedProject(),'elin','Elin'),'lina','Lina');for(const dealer of project.dealers)for(const event of [eventId,'speak.other'])project=addVariant(project,dealer.id,event,'Browser alternative');return project;}
const href=(dealer,event,tab='variants',variant)=>'/admin/events?'+new URLSearchParams({...shared,dealer,...(event?{event,tab,...(variant?{variant}:{})}:{})});
let source;
async function fixtureSource(){return source??=build({stdin:{contents:
  "import './client/admin/entry';import {studioHistory} from './lib/studio-history.mjs';import {navigate} from './client/runtime/navigation';const owner=window.__historyOwner=studioHistory(window);window.__navigate=navigate;window.__traversals=0;owner.guardTraversal(()=>{window.__traversals++;return true;});",
  resolveDir:lab,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'""','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"'},alias:{react:fileURLToPath(new URL('../client/node_modules/react',import.meta.url)),'react-dom':fileURLToPath(new URL('../client/node_modules/react-dom',import.meta.url)),'next/navigation':fileURLToPath(new URL('../client/runtime/navigation.tsx',import.meta.url))},plugins:[{name:'events-boundaries',setup(builder){
  builder.onResolve({filter:/\.module\.css$/},args=>({path:args.path,namespace:'fixture-css'}));
  builder.onLoad({filter:/.*/,namespace:'fixture-css'},()=>({contents:'export default {}'}));
  builder.onResolve({filter:/^\./},args=>{const importer=args.importer.replaceAll('\\','/');
    if(importer.endsWith('/client/admin/entry.tsx')&&((args.path.startsWith('./components/')&&!args.path.endsWith('/workspace-tools'))||args.path.startsWith('./app/')))return{path:args.path,namespace:'unused-admin'};
    if(importer.endsWith('/workspace-tools.tsx')&&(args.path.includes('/components/')&&!['/control-events-page','/control-tree-page'].some(name=>args.path.endsWith(name))||args.path==='./connected-services'))return{path:args.path,namespace:'unused-admin'};
    if(args.path==='./events-preview')return{path:args.path,namespace:'preview'};
    if(args.path==='./page-template.mjs')return{path:args.path,namespace:'template'};
  });
  builder.onLoad({filter:/.*/,namespace:'unused-admin'},()=>({contents:'export default ()=>null;export const DealerMaterialPage=()=>null,PlayerAccountsPage=()=>null,AdminStaffPage=()=>null,StudioSidebar=()=>null,RegisteredStudio=()=>null,ConnectedClipMap=()=>null,ConnectedServices=()=>null,RegisteredMaterialLibrary=()=>null,AdminHome=()=>null,DealerDirectory=()=>null,ResourceConnections=()=>null,ResourceDeletion=()=>null,AdminPublicationPage=()=>null,ControlActivityPage=()=>null,ControlPreviewPage=()=>null,ControlProbePage=()=>null,ControlRepliesPage=()=>null,ControlVideosPage=()=>null,ControlGuidePage=()=>null,ControlOpenClawChat=()=>null,LabStudio=()=>null;'}));
  builder.onLoad({filter:/.*/,namespace:'preview'},()=>({contents:'export const EventsPreview=()=>null,EventsIdleNotice=()=>null,describeSocialActivity=value=>value,readableLogReason=value=>value;'}));
  builder.onLoad({filter:/.*/,namespace:'template'},()=>({loader:'tsx',contents:'export const publishShellStatus=()=>{};export const PageTemplate=props=><><h1>{props.title}</h1><div>{props.intro}</div>{props.primary}{props.children}</>;'}));
}}]}).then(result=>result.outputFiles[0].text);}
async function withBrowser(run){const {chromium}=await import(pathToFileURL(browserModule).href);const browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});try{await run(browser);}finally{await browser.close();}}
async function openFixture(browser,start=href('elin')){
  const context=await browser.newContext(),failures=[],reads=[],writes=[];let saved=fixtureProject(),hold=false,release,started,holdReads=false;const heldReads=[];
  const gate=new Promise(resolve=>release=resolve),pending=new Promise(resolve=>started=resolve);
  await context.addInitScript(studioHistoryBootstrap);
  await context.route('**/*',async route=>{try{const request=route.request(),url=new URL(request.url());assert.equal(url.origin,origin,'all requests stay isolated');
    if(url.pathname==='/api/project'&&request.method()==='PUT'){const body=request.postDataJSON();writes.push(body);assert.equal(body.expectedRevision,saved.revision);started();if(hold)await gate;saved={...body.project,revision:saved.revision+1};return route.fulfill({json:{project:saved}});}
    assert.equal(request.method(),'GET');
    if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:await fixtureSource()});
    if(url.pathname==='/api/admin/workspace/events'){reads.push(url.href);if(holdReads)await new Promise(resolve=>heldReads.push(resolve));return route.fulfill({json:{project:saved,videos:{videos:[]},status:{configured:true},operators:[],directory:null,storeAvailable:true}});}
    assert.equal(url.pathname,'/admin/events');return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/fixture.js"></script>'});
  }catch(error){failures.push(error);await route.fulfill({status:500,body:'Isolated fixture failed'});}});
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>failures.push(error));await page.goto(origin+start);
  try{await page.getByRole('heading',{name:new URL(origin+start).searchParams.has('event')?'Klippval & villkor':'Spelhändelser & villkor',exact:true}).waitFor();}catch(error){await context.close();throw failures[0]??error;}
  return {page,reads,writes,project:saved,pauseReads(){holdReads=true;},releaseRead(index){heldReads[index]?.();},snapshot:()=>page.evaluate(()=>({href:location.href,state:history.state,length:history.length})),mark:label=>page.evaluate(label=>history.replaceState({...history.state,foreign:{label,tree:['preserve']}},'',location.href),label),async saveHeld(){hold=true;await page.getByRole('button',{name:'Spara projekt',exact:true}).click();await pending;},async release(){release();await page.getByRole('button',{name:'Spara projekt',exact:true}).waitFor();},async close(){release();for(const resolve of heldReads)resolve();await context.close();assert.deepEqual(failures,[]);}};
}
async function waitForReads(f,count){const deadline=Date.now()+7000;while(f.reads.length<count&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(f.reads.length>=count,'workspace read '+count+' started');}
function contextOf(url){return Object.fromEntries([...new URL(url,origin).searchParams].filter(([key])=>key in shared));}
async function selected(page,dealer,event,tab){await page.waitForFunction(({dealer,event,tab})=>{const q=new URLSearchParams(location.search);return q.get('dealer')===dealer&&q.get('event')===event&&q.get('tab')===tab;},{dealer,event,tab});assert.match(await page.getByRole('group',{name:'Välj dealer',exact:true}).locator('[aria-pressed="true"]').innerText(),new RegExp(dealer==='elin'?'Elin':dealer==='lina'?'Lina':'Astrid'));assert.equal(await page.getByLabel('Välj klippfack').inputValue().then(value=>value.split('|')[0]),event);assert.equal(await page.getByRole('tab',{name:tab==='event'?'Event':tab==='triggers'?'Villkor':/^Varianter/}).getAttribute('aria-selected'),'true');assert.deepEqual(contextOf(page.url()),shared);}

// Actual Admin entry, adapter, tree/catalog/inspector and session; only API data and playback are isolated.
test('Admin tree stays an overview until edit, retains exact variant and room context through editing and reload',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await openFixture(browser);try{
    await f.mark('overview');const before=await f.snapshot();
    await f.page.getByRole('group',{name:'Välj dealer för spelhändelser'}).getByRole('button',{name:'Lina',exact:true}).click();
    assert.equal(new URL(f.page.url()).searchParams.get('dealer'),'lina');assert.equal(new URL(f.page.url()).searchParams.has('event'),false);assert.deepEqual(contextOf(f.page.url()),shared);
    assert.deepEqual((await f.snapshot()).state.foreign,before.state.foreign);assert.equal((await f.snapshot()).state.__scoutAdminHistory.index,before.state.__scoutAdminHistory.index);
    await f.page.getByText('Avancerat · äldre händelsegrupper och testanimationer',{exact:true}).click();
    await f.page.getByRole('button',{name:/Kort till vänster.*deal.player.left/}).click();
    assert.equal(new URL(f.page.url()).searchParams.has('event'),false,'selecting a tree node keeps overview responsibility');
    await f.page.getByRole('button',{name:/Browser alternative/}).click();
    assert.equal(new URL(f.page.url()).searchParams.has('event'),false);
    await f.page.getByRole('button',{name:'Redigera / testa varianten →',exact:true}).click();
    await selected(f.page,'lina',eventId,'variants');assert.equal(await f.page.getByLabel('Variantens namn',{exact:true}).inputValue(),'Browser alternative');
    const variant=new URL(f.page.url()).searchParams.get('variant');assert.ok(variant);await f.mark('editor');const editor=await f.snapshot();
    await f.page.getByRole('tab',{name:'Event',exact:true}).click();await selected(f.page,'lina',eventId,'event');assert.deepEqual((await f.snapshot()).state.foreign,editor.state.foreign);
    await f.page.getByRole('tab',{name:/^Varianter/}).click();await f.page.getByLabel('Variantens namn',{exact:true}).fill('Saved Admin variant');
    const readsBefore=f.reads.length;await f.page.getByRole('tab',{name:'Event',exact:true}).click();await f.page.getByRole('tab',{name:/^Varianter/}).click();assert.equal(await f.page.getByLabel('Variantens namn',{exact:true}).inputValue(),'Saved Admin variant');assert.equal(f.reads.length,readsBefore,'local query changes retain the draft without refetching workspace data');
    await f.page.getByRole('button',{name:'Spara projekt',exact:true}).click();await f.page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent==='Spara projekt'&&button.disabled));
    assert.equal(f.writes.length,1);assert.equal(f.writes[0].project.lines.find(line=>line.dealerId==='lina'&&line.eventId===eventId).variants.find(item=>item.id===variant).label,'Saved Admin variant');
    await f.page.reload();await selected(f.page,'lina',eventId,'variants');assert.equal(await f.page.getByLabel('Variantens namn',{exact:true}).inputValue(),'Saved Admin variant');assert.equal(new URL(f.page.url()).searchParams.get('variant'),variant);assert.ok(f.reads.length>=3);
  }finally{await f.close();}
}));

test('Admin Events restores visible selection on accepted history and preserves dirty/in-flight entries across Back, Forward and multi-step traversal',{skip:!browserModule},()=>withBrowser(async browser=>{
  for(const mode of ['dirty','saving'])for(const delta of [-1,1,-2]){
    const f=await openFixture(browser);try{
      await f.mark('A-overview');const a=await f.snapshot();
      // The existing owner creates bookmark entries; real editor controls write each accepted selection.
      await f.page.evaluate(href=>window.__historyOwner.push(href),href('elin',eventId,'event'));
      await selected(f.page,'elin',eventId,'event');await f.mark('B-editor');const b=await f.snapshot();
      await f.page.evaluate(()=>window.__historyOwner.push(location.href));
      await f.page.getByRole('group',{name:'Välj dealer',exact:true}).getByRole('button',{name:/Lina/}).click();
      await f.page.getByLabel('Välj klippfack').selectOption('speak.other|placebets');
      await f.page.getByRole('tab',{name:/^Varianter/}).click();await f.page.getByRole('button',{name:/Browser alternative/}).click();
      await selected(f.page,'lina','speak.other','variants');assert.equal(await f.page.getByLabel('Välj klippfack').inputValue(),'speak.other|placebets');await f.mark('C-editor');const c=await f.snapshot();
      const at=delta===1?1:2;if(at===1){await f.page.goBack();await selected(f.page,'elin',eventId,'event');}
      const input=f.page.getByLabel(at===1?'Eventets visningsnamn':'Variantens namn',{exact:true});const original=await input.inputValue();await input.fill('Unsaved Admin edit');
      if(mode==='saving')await f.saveHeld();const before=await f.snapshot();
      assert.equal(await f.page.evaluate(()=>window.__navigate('/admin/events?dealer=astrid')),false,'Admin route changes cannot discard a draft or pending save');
      assert.deepEqual(await f.snapshot(),before);
      const count=await f.page.evaluate(()=>window.__traversals);await f.page.evaluate(delta=>history.go(delta),delta);
      await f.page.waitForFunction(count=>window.__traversals>count,count);await f.page.waitForURL(before.href);await f.page.waitForFunction(()=>!window.__historyOwner.isRestoring());
      assert.deepEqual(await f.snapshot(),before);assert.equal(await input.inputValue(),'Unsaved Admin edit');
      if(mode==='saving')await f.release();else await input.fill(original);
      await f.page.evaluate(at=>history.go(-at),at);await f.page.waitForURL(a.href);await f.page.getByRole('heading',{name:'Spelhändelser & villkor',exact:true}).waitFor();
      assert.equal(await f.page.getByRole('group',{name:'Välj dealer för spelhändelser'}).locator('[aria-pressed="true"]').innerText(),'Elin');
      await f.page.goForward();await selected(f.page,'elin',eventId,'event');assert.deepEqual((await f.snapshot()).state.foreign,b.state.foreign);
      await f.page.goForward();await selected(f.page,'lina','speak.other','variants');assert.equal(await f.page.getByLabel('Välj klippfack').inputValue(),'speak.other|placebets');assert.deepEqual((await f.snapshot()).state.foreign,c.state.foreign);assert.equal(new URL(f.page.url()).searchParams.get('variant'),new URL(c.href).searchParams.get('variant'));
      assert.equal(await f.page.getByLabel('Variantens namn',{exact:true}).inputValue(),mode==='saving'&&at===2?'Unsaved Admin edit':'Browser alternative');
    }finally{await f.close();}
  }
}));

test('Admin Events ignores superseded workspace reads during rapid overview/editor traversal',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await openFixture(browser);try{
    f.pauseReads();await f.page.evaluate(href=>window.__historyOwner.push(href),href('elin',eventId,'event'));
    await f.page.getByText('Läser sparade uppgifter…',{exact:true}).waitFor();await waitForReads(f,2);
    await f.page.evaluate(href=>window.__historyOwner.push(href),href('lina'));await waitForReads(f,3);
    f.releaseRead(1);await f.page.getByRole('heading',{name:'Spelhändelser & villkor',exact:true}).waitFor();f.releaseRead(0);
    await f.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await f.page.getByRole('group',{name:'Välj dealer för spelhändelser'}).locator('[aria-pressed="true"]').innerText(),'Lina');assert.equal(new URL(f.page.url()).searchParams.has('event'),false);assert.deepEqual(contextOf(f.page.url()),shared);assert.equal(f.writes.length,0);
  }finally{await f.close();}
}));
