import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname} from 'node:path';
import {build} from 'esbuild';
import {addDealer,defaultPresentationLane,createSeedProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {studioHistoryBootstrap} from '../lib/studio-history.mjs';
const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const origin='https://admin-rehearsal.fixture.invalid';
const shared={operator:'operator-a',table:'room-a'};
const lab=dirname(dirname(fileURLToPath(import.meta.url)));
function fixtureProject(){const project=addDealer(addDealer(createSeedProject(),'elin','Elin'),'lina','Lina');project.lanes=['elin','lina'].map((dealer,index)=>({...defaultPresentationLane(dealer),id:'scene-'+(index?'b':'a'),label:index?'Scene B':'Scene A'}));return project;}
const href=(section='compositions',selection={})=>'/admin/'+section+'?'+new URLSearchParams({...shared,dealer:'elin',composition:'scene-a',game:'blackjack',...selection});
let source;
async function fixtureSource(){return source??=build({stdin:{contents:
  "import './client/admin/entry';import {studioHistory} from './lib/studio-history.mjs';import {navigate} from './client/runtime/navigation';const owner=window.__historyOwner=studioHistory(window);window.__navigate=navigate;window.__traversals=0;owner.guardTraversal(()=>{window.__traversals++;return true;});",
  resolveDir:lab,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'""','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"'},alias:{react:fileURLToPath(new URL('../client/node_modules/react',import.meta.url)),'react-dom':fileURLToPath(new URL('../client/node_modules/react-dom',import.meta.url)),'next/navigation':fileURLToPath(new URL('../client/runtime/navigation.tsx',import.meta.url))},plugins:[{name:'events-boundaries',setup(builder){
  // Playback bytes stay outside this navigation fixture; no game or media is opened.
  builder.onResolve({filter:/^\/composition-runtime\//},args=>({path:args.path,external:true}));
  builder.onResolve({filter:/\.module\.css$/},args=>({path:args.path,namespace:'fixture-css'}));
  builder.onLoad({filter:/.*/,namespace:'fixture-css'},()=>({contents:'export default {}'}));
  builder.onResolve({filter:/^\./},args=>{const importer=args.importer.replaceAll('\\','/');
    if(importer.endsWith('/client/admin/entry.tsx')&&((args.path.startsWith('./components/')&&!args.path.endsWith('/workspace-tools'))||args.path.startsWith('./app/')))return{path:args.path,namespace:'unused-admin'};
    if(importer.endsWith('/workspace-tools.tsx')&&(args.path.includes('/components/')&&!['/control-preview-page','/control-activity-page'].some(name=>args.path.endsWith(name))||args.path==='./connected-services'))return{path:args.path,namespace:'unused-admin'};
    if(args.path==='./composition-preview')return{path:args.path,namespace:'preview'};
    if(args.path==='./page-template.mjs')return{path:args.path,namespace:'template'};
  });
  builder.onLoad({filter:/.*/,namespace:'unused-admin'},()=>({contents:'export default ()=>null;export const StudioSidebar=()=>null,RegisteredStudio=()=>null,ConnectedClipMap=()=>null,ConnectedServices=()=>null,RegisteredMaterialLibrary=()=>null,AdminHome=()=>null,DealerDirectory=()=>null,ResourceConnections=()=>null,ResourceDeletion=()=>null,AdminPublicationPage=()=>null,ControlActivityPage=()=>null,ControlPreviewPage=()=>null,ControlEventsPage=()=>null,ControlTreePage=()=>null,ControlProbePage=()=>null,ControlRepliesPage=()=>null,ControlVideosPage=()=>null,ControlGuidePage=()=>null,ControlOpenClawChat=()=>null,LabStudio=()=>null;'}));
  builder.onLoad({filter:/.*/,namespace:'preview'},()=>({contents:'export const CompositionPreview=()=>null;'}));
  builder.onLoad({filter:/.*/,namespace:'template'},()=>({loader:'tsx',contents:'export const publishShellStatus=()=>{};export const PageTemplate=props=><><h1>{props.title}</h1><div>{props.intro}</div>{props.primary}{props.children}</>;'}));
}}]}).then(result=>result.outputFiles[0].text);}
async function withBrowser(run){const {chromium}=await import(pathToFileURL(browserModule).href);const browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});try{await run(browser);}finally{await browser.close();}}

async function openFixture(browser,start=href()){
  const context=await browser.newContext(),failures=[],reads=[],writes=[],dialogs=[];let saved=fixtureProject(),revision=0,heldKind='',releasePending,notifyPending;
  const pending=new Promise(resolve=>notifyPending=resolve),gate=new Promise(resolve=>releasePending=resolve);let conflict=false;
  const snapshot={operators:[{id:'operator-a',slug:'operator-a',name:'Operator A'}],rooms:[{id:'room-a',operatorId:'operator-a',name:'Room A'},{id:'room-b',operatorId:'operator-a',name:'Room B'}]};
  await context.addInitScript(studioHistoryBootstrap);
  await context.route('**/*',async route=>{try{const request=route.request(),url=new URL(request.url());assert.equal(url.origin,origin,'all transport stays isolated');
    if(request.method()==='POST'||request.method()==='PUT'){
      const body=request.postDataJSON();writes.push({path:url.pathname,body});notifyPending();if(heldKind===url.pathname)await gate;
      if(url.pathname==='/api/project'){assert.equal(request.method(),'PUT');assert.equal(body.expectedRevision,saved.revision);if(conflict)return route.fulfill({status:409,json:{error:'project_revision_conflict'}});saved={...body.project,revision:'fixture.'+(++revision)};return route.fulfill({json:{project:saved}});}
      if(url.pathname==='/api/studio-preview'){assert.deepEqual(Object.keys(body).sort(),['expectedProjectRevision','presentationLaneId']);assert.equal(body.expectedProjectRevision,saved.revision);assert.ok(saved.lanes.some(lane=>lane.id===body.presentationLaneId));const sessionId='11111111-1111-4111-8111-111111111111';return route.fulfill({status:201,json:{sessionId,presentationLaneId:body.presentationLaneId,projectRevision:saved.revision,expiresAt:new Date(Date.now()+60000).toISOString(),entryUrl:'/studio-preview/'+sessionId}});}
      assert.equal(url.pathname,'/api/layer-assets/upload');return route.fulfill({status:422,json:{error:'fixture_upload_rejected'}});
    }
    assert.equal(request.method(),'GET');reads.push(url.pathname);
    if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:await fixtureSource()});
    if(['/api/admin/workspace/compositions','/api/admin/workspace/rehearsal'].includes(url.pathname))return route.fulfill({json:{project:saved,videos:{videos:[]},status:{configured:true,provider:'neon'},operators:[],directory:null,storeAvailable:true}});
    if(url.pathname==='/api/admin/resource-lifecycle')return route.fulfill({json:snapshot});
    if(url.pathname==='/api/project')return route.fulfill({json:{project:saved}});
    if(url.pathname==='/api/inputs')return route.fulfill({json:{configured:false,missing:[],invalid:[],endpoint:null}});
    if(url.pathname==='/api/inputs/reference')return route.fulfill({json:{configured:false}});
    if(url.pathname==='/api/clip-controls')return route.fulfill({status:503,json:{error:'isolated_no_media'}});
    if(url.pathname==='/admin/rooms'||url.pathname.startsWith('/studio-preview/'))return route.fulfill({contentType:'text/html',body:'<h1>Verified destination</h1>'});
    assert.ok(['/admin/compositions','/admin/rehearsal'].includes(url.pathname));return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/fixture.js"></script>'});
  }catch(error){failures.push(error);await route.fulfill({status:500,body:'Isolated fixture failed'});}});
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>failures.push(error));page.on('dialog',async dialog=>{dialogs.push(dialog.type());await dialog.dismiss();});await page.goto(origin+start);
  try{await page.getByRole('heading',{name:start.startsWith('/admin/rehearsal')?'Provspelning & logg':'Sammansättningar',exact:true}).waitFor();}catch(error){await context.close();throw failures[0]??error;}
  return {page,reads,writes,dialogs,get saved(){return saved;},hold(path){heldKind=path;},conflict(){conflict=true;},started:pending,release(){releasePending();},snapshot:()=>page.evaluate(()=>({href:location.href,state:history.state,length:history.length})),mark:label=>page.evaluate(label=>history.replaceState({...history.state,foreign:{label,keep:['state']}},'',location.href),label),async close(){releasePending();await context.close();assert.deepEqual(failures,[]);}};
}
async function selection(page,lane,game){await page.waitForFunction(({lane,game})=>{const q=new URLSearchParams(location.search);return q.get('composition')===lane&&q.get('game')===game;},{lane,game});assert.equal(await page.getByRole('combobox',{name:/^Sammansättning/}).inputValue(),lane);assert.equal(await page.getByLabel('Spel för materialval',{exact:true}).inputValue(),game);}
async function writeSelection(page,lane,game){await page.getByRole('combobox',{name:/^Sammansättning/}).selectOption(lane);await page.getByLabel('Spel för materialval',{exact:true}).selectOption(game);await selection(page,lane,game);}
async function rejectTraversal(f,delta){const before=await f.snapshot(),count=await f.page.evaluate(()=>window.__traversals);await f.page.evaluate(delta=>history.go(delta),delta);await f.page.waitForFunction(count=>window.__traversals>count,count);await f.page.waitForURL(before.href);await f.page.waitForFunction(()=>!window.__historyOwner.isRestoring());assert.deepEqual(await f.snapshot(),before);}

test('actual Admin compositions preserves room, composition and game through query changes, draft/save and reload',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await openFixture(browser);try{
    await f.mark('selected');const before=await f.snapshot();await writeSelection(f.page,'scene-b','roulette');assert.deepEqual((await f.snapshot()).state.foreign,before.state.foreign);
    const link=()=>f.page.getByRole('link',{name:/Fortsätt till publicering|Spara och fortsätt/});const target=new URL(await link().getAttribute('href'),origin);assert.equal(target.pathname,'/admin/publication');assert.equal(target.searchParams.get('table'),'room-a');assert.equal(target.searchParams.get('operator'),'operator-a');assert.equal(target.searchParams.get('composition'),'scene-b');assert.equal(target.searchParams.get('game'),'roulette');
    await f.page.reload();await selection(f.page,'scene-b','roulette');const reads=f.reads.length;
    await f.page.getByLabel('Sammansättningens namn',{exact:true}).fill('Saved Scene B');await writeSelection(f.page,'scene-a','blackjack');await writeSelection(f.page,'scene-b','roulette');assert.equal(await f.page.getByLabel('Sammansättningens namn',{exact:true}).inputValue(),'Saved Scene B');assert.equal(f.reads.length,reads);
    await f.page.getByRole('button',{name:'Spara',exact:true}).click();await f.page.getByText('Sparad sammansättning',{exact:true}).waitFor();assert.equal(f.writes.length,1);assert.equal(f.writes[0].path,'/api/project');assert.equal(f.saved.lanes[0].label,'Scene A');assert.equal(f.saved.lanes[1].label,'Saved Scene B');
    await f.page.reload();await selection(f.page,'scene-b','roulette');assert.equal(await f.page.getByLabel('Sammansättningens namn',{exact:true}).inputValue(),'Saved Scene B');assert.deepEqual(f.dialogs,[]);
  }finally{await f.close();}
}));

test('Admin compositions retains draft and pending-save ownership across Back, Forward and multi-step history',{skip:!browserModule},()=>withBrowser(async browser=>{
  for(const mode of ['dirty','saving'])for(const delta of [-1,1,-2]){const f=await openFixture(browser);try{
    await f.mark('A');const a=await f.snapshot();await f.page.evaluate(()=>window.__historyOwner.push(location.href));await writeSelection(f.page,'scene-b','roulette');await f.mark('B');const b=await f.snapshot();await f.page.evaluate(()=>window.__historyOwner.push(location.href));await writeSelection(f.page,'scene-a','blackjack');await f.mark('C');
    const at=delta===1?1:2;if(at===1){await f.page.goBack();await selection(f.page,'scene-b','roulette');}
    const name=f.page.getByLabel('Sammansättningens namn',{exact:true}),original=await name.inputValue();await name.fill('Draft retained');
    if(mode==='saving'){f.hold('/api/project');await f.page.getByRole('button',{name:'Spara',exact:true}).click();await waitWrite(f);}
    assert.equal(await f.page.evaluate(()=>window.__navigate('/admin/rehearsal')),false);await rejectTraversal(f,delta);assert.equal(await name.inputValue(),'Draft retained');
    if(mode==='saving'){f.release();await f.page.getByText('Sparad sammansättning',{exact:true}).waitFor();}else await name.fill(original);
    await f.page.evaluate(at=>history.go(-at),at);await f.page.waitForURL(a.href);await selection(f.page,'scene-a','blackjack');await f.page.goForward();await selection(f.page,'scene-b','roulette');assert.deepEqual((await f.snapshot()).state.foreign,b.state.foreign);await f.page.goForward();await selection(f.page,'scene-a','blackjack');assert.equal(new URL(f.page.url()).searchParams.get('table'),'room-a');
  }finally{await f.close();}}
}));

async function waitWrite(f){let timer;try{await Promise.race([f.started,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('expected isolated write did not start')),7000))]);}finally{clearTimeout(timer);}}

test('Admin composition request guards retain ownership and allow the exact acknowledged preview/save destination',{skip:!browserModule},()=>withBrowser(async browser=>{
  for(const kind of ['preview','upload','continue','conflict']){const f=await openFixture(browser);try{
    await f.page.evaluate(()=>window.__historyOwner.push(location.href));await f.mark(kind);
    if(kind==='preview'){
      f.hold('/api/studio-preview');await f.page.getByRole('button',{name:'Provspela',exact:true}).click();await waitWrite(f);
      assert.equal(await f.page.getByRole('button',{name:'Startar provspelning…',exact:true}).isDisabled(),true);assert.equal(await f.page.evaluate(()=>window.__navigate('/admin/rehearsal')),false);await rejectTraversal(f,-1);
      f.release();await f.page.waitForURL(origin+'/studio-preview/11111111-1111-4111-8111-111111111111');assert.deepEqual(f.dialogs,[]);assert.equal(f.writes.length,1);
    }else if(kind==='upload'){
      f.hold('/api/layer-assets/upload');await f.page.getByRole('tab',{name:'Bord',exact:true}).click();await f.page.locator('summary').filter({hasText:'Ladda upp bord'}).click();
      await f.page.getByLabel('Ladda upp bord',{exact:true}).setInputFiles({name:'isolated.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64')});await waitWrite(f);
      assert.equal(await f.page.evaluate(()=>window.__navigate('/admin/rehearsal')),false);await rejectTraversal(f,-1);f.release();await f.page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent==='Provspela'&&!button.disabled));assert.deepEqual(f.writes.map(row=>row.path),['/api/layer-assets/upload']);
    }else{
      if(kind==='conflict')f.conflict();await f.page.getByLabel('Sammansättningens namn',{exact:true}).fill('Save before leaving');await f.page.getByRole('link',{name:'Spara och fortsätt',exact:true}).click();await waitWrite(f);
      if(kind==='continue'){await f.page.waitForURL(url=>url.pathname==='/admin/rooms');const url=new URL(f.page.url());assert.equal(url.searchParams.get('table'),'room-a');assert.equal(url.searchParams.get('composition'),'scene-a');assert.equal(url.searchParams.get('game'),'blackjack');assert.equal(f.saved.lanes[0].label,'Save before leaving');assert.deepEqual(f.dialogs,[]);}
      else{await f.page.getByRole('button',{name:'Spara',exact:true}).waitFor();await f.page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent==='Spara'&&button.disabled));assert.equal(new URL(f.page.url()).pathname,'/admin/compositions');assert.equal(await f.page.getByLabel('Sammansättningens namn',{exact:true}).inputValue(),'Save before leaving');assert.equal(f.saved.lanes[0].label,'Scene A');assert.equal(f.reads.includes('/admin/publication'),false);}
      assert.equal(f.writes.length,1);
    }
  }finally{await f.close();}}
}));

test('actual Admin rehearsal follows room/dealer context through history and reload without opening a game',{skip:!browserModule},()=>withBrowser(async browser=>{
  const start=new URL(href('rehearsal'),origin);start.searchParams.delete('table');start.searchParams.set('room','room-a');
  const f=await openFixture(browser,start.pathname+start.search);try{
    const current=f.page.getByRole('region',{name:'Aktuell provspelning',exact:true});await current.getByRole('heading',{name:'Room A',exact:true}).waitFor();assert.match(await current.innerText(),/Elin/);
    const links=f.page.getByRole('navigation',{name:'Studio för Elin'}).locator('a');for(const target of await links.evaluateAll(rows=>rows.map(row=>row.href))){const url=new URL(target);assert.equal(url.searchParams.get('table'),'room-a');assert.equal(url.searchParams.get('game'),'blackjack');assert.equal(url.searchParams.get('composition'),'scene-a');}
    await f.page.evaluate(href=>window.__historyOwner.push(href),href('rehearsal',{dealer:'lina',table:'room-b',composition:'scene-b',game:'roulette'}));await current.getByRole('heading',{name:'Room B',exact:true}).waitFor();assert.match(await current.innerText(),/Lina/);
    await f.page.goBack();await current.getByRole('heading',{name:'Room A',exact:true}).waitFor();assert.match(await current.innerText(),/Elin/);await f.page.goForward();await current.getByRole('heading',{name:'Room B',exact:true}).waitFor();await f.page.reload();await current.getByRole('heading',{name:'Room B',exact:true}).waitFor();assert.match(await current.innerText(),/Lina/);
    const active=f.page.getByRole('navigation',{name:'Studio för Lina'}).getByRole('link',{name:'Provspelning & logg'});assert.equal(new URL(await active.getAttribute('href'),origin).pathname,'/admin/rehearsal');assert.equal(new URL(await active.getAttribute('href'),origin).searchParams.get('game'),'roulette');assert.equal(f.writes.length,0);
  }finally{await f.close();}
}));

test('Admin preserves explicit missing and ambiguous rooms without silently selecting a valid room',{skip:!browserModule},()=>withBrowser(async browser=>{
  for(const section of ['compositions','rehearsal'])for(const suffix of ['&table=room-b','&room=room-b']){const f=await openFixture(browser,href(section)+suffix);try{
    await f.page.getByRole('alert').filter({hasText:'Länken anger flera rum'}).waitFor();assert.equal(f.writes.length,0);
    if(section==='rehearsal'){assert.equal(await f.page.getByRole('region',{name:'Händelselogg i realtid'}).count(),0);assert.equal(f.reads.includes('/api/inputs/reference'),false);}
    else{const link=f.page.getByRole('link',{name:'Fortsätt till publicering',exact:true});assert.equal(await link.getAttribute('aria-disabled'),'true');const old=f.page.url();await link.click({force:true});assert.equal(f.page.url(),old);const target=new URL(await link.getAttribute('href'),origin);assert.ok(target.searchParams.getAll('table').length>1||target.searchParams.get('room')==='room-b');}
  }finally{await f.close();}}
  const f=await openFixture(browser,href('rehearsal',{table:'missing-room'}));try{await f.page.getByRole('region',{name:'Aktuell provspelning'}).getByRole('heading',{name:'Valt spelrum',exact:true}).waitFor();assert.equal(new URL(f.page.url()).searchParams.get('table'),'missing-room');assert.equal(await f.page.getByRole('heading',{name:/^Room [AB]$/}).count(),0);assert.equal(f.writes.length,0);}finally{await f.close();}
}));
