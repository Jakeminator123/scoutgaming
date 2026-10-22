import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname} from 'node:path';
import {build} from 'esbuild';
import {studioHistoryBootstrap} from '../lib/studio-history.mjs';
const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const origin='https://admin-administration.fixture.invalid',studio=dirname(dirname(fileURLToPath(import.meta.url)));
const href=dealer=>'/admin/media-review?dealer='+dealer+'&composition=scene-a&operator=north&table=room-a&room=room-a&game=roulette#selection';
const dealers=[{id:'elin',label:'Elin'},{id:'lina',label:'Lina'}];
let source;
async function fixtureSource(){return source??=build({stdin:{contents:`import './client/admin/entry';
import {studioHistory} from './lib/studio-history.mjs';import {navigate} from './client/runtime/navigation';
window.__historyOwner=studioHistory(window);window.__navigate=navigate;window.__traversals=0;
window.__historyOwner.guardTraversal(()=>{window.__traversals++;return true;});`,resolveDir:studio,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'""','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"'},alias:{react:fileURLToPath(new URL('../client/node_modules/react',import.meta.url)),'react-dom':fileURLToPath(new URL('../client/node_modules/react-dom',import.meta.url)),'next/navigation':fileURLToPath(new URL('../client/runtime/navigation.tsx',import.meta.url))},plugins:[{name:'unrelated-admin-surfaces',setup(builder){
  builder.onResolve({filter:/\.module\.css$/},args=>({path:args.path,namespace:'fixture-css'}));builder.onLoad({filter:/.*/,namespace:'fixture-css'},()=>({contents:'export default {}'}));
  builder.onResolve({filter:/^\./},args=>{const importer=args.importer.replaceAll('\\','/');
    if(importer.endsWith('/client/admin/entry.tsx')&&((args.path.startsWith('./components/')&&!['./components/studio/workspace-tools','./components/studio/connected-services'].includes(args.path))||args.path.startsWith('./app/')))return{path:args.path,namespace:'unused'};
    if(importer.endsWith('/workspace-tools.tsx')&&args.path.includes('/components/'))return{path:args.path,namespace:'unused'};
    if(importer.endsWith('/connected-services.tsx')&&(args.path.endsWith('/openclaw-workspace')||args.path==='./connected-economy'))return{path:args.path,namespace:'unused'};
    if(args.path==='./moving-drift-controls'||args.path==='./dealer-video-surface')return{path:args.path,namespace:'unused'};
  });
  builder.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export default ()=>null;export const StudioSidebar=()=>null,RegisteredStudio=()=>null,ConnectedClipMap=()=>null,RegisteredMaterialLibrary=()=>null,AdminHome=()=>null,DealerDirectory=()=>null,ResourceConnections=()=>null,ResourceDeletion=()=>null,WorkspaceToolsHome=()=>null,AdminPublicationPage=()=>null,ControlActivityPage=()=>null,ControlPreviewPage=()=>null,ControlEventsPage=()=>null,ControlTreePage=()=>null,ControlProbePage=()=>null,ControlRepliesPage=()=>null,ControlVideosPage=()=>null,ControlGuidePage=()=>null,ControlOpenClawChat=()=>null,LabStudio=()=>null,OpenClawWorkspace=()=>null,ConnectedEconomy=()=>null,MovingDriftControls=()=>null,DealerClipPreview=()=>null;'}));
}}]}).then(result=>result.outputFiles[0].text);}
async function fixture(browser,{denied=false}={}){
  const context=await browser.newContext(),failures=[],reads=[],writes=[],dialogs=[];let revision='review-1',hold=null,conflict=false,acceptDialogs=false;
  const verdicts={elin:null,lina:null};
  await context.addInitScript(studioHistoryBootstrap);
  await context.route('**/*',async route=>{try{
    const request=route.request(),url=new URL(request.url()),method=request.method();assert.equal(url.origin,origin,'fixture never contacts real media or product services');
    const entry={path:url.pathname,method,...(method==='POST'?{body:request.postDataJSON()}:{})};(method==='GET'?reads:writes).push(entry);
    if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:await fixtureSource()});
    if(url.pathname==='/api/admin/workspace/media-review')return route.fulfill({json:{project:{revision:1,dealers},videos:{videos:[]},status:{configured:true,provider:'fixture'}}});
    if(url.pathname==='/studio/api/auth/session')return route.fulfill({status:denied?401:200,json:denied?{error:'unauthorized'}:{username:'fixture-admin',role:'admin',availableActions:['GET config','GET voicelines','POST voiceline-review'],gameOrigin:origin}});
    const headers={'x-croupier-studio-actor':'fixture-admin','x-croupier-studio-role':'admin'};
    if(url.pathname==='/studio/api/admin/config')return route.fulfill({headers,json:{revision,savedDealers:dealers}});
    if(url.pathname==='/studio/api/admin/voicelines')return route.fulfill({headers,json:{dealers:dealers.map(dealer=>({dealer:dealer.id,name:dealer.label,lines:[{key:dealer.id+'.line',text:dealer.label+' fixturetal',review:verdicts[dealer.id],reviewable:true,identity:dealer.id+'-exact-pair'}]}))}});
    if(url.pathname==='/studio/api/admin/voiceline-review'){
      assert.equal(method,'POST');assert.deepEqual(Object.keys(entry.body).sort(),['dealer','expectedIdentity','expectedRevision','line','verdict']);
      assert.equal(entry.body.line,entry.body.dealer+'.line');assert.equal(entry.body.expectedIdentity,entry.body.dealer+'-exact-pair');
      if(hold){hold.started();await hold.promise;hold=null;}
      if(conflict){conflict=false;revision='review-remote';return route.fulfill({status:409,json:{error:'conflict'}});}
      assert.equal(entry.body.expectedRevision,revision);verdicts[entry.body.dealer]=entry.body.verdict;revision+='-saved';return route.fulfill({json:{ok:true}});
    }
    assert.equal(method,'GET');assert.ok(['/admin/media-review','/admin/drift'].includes(url.pathname),'unexpected fixture path '+url.pathname);
    return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/fixture.js"></script>'});
  }catch(error){failures.push(error);await route.fulfill({status:500,body:'Isolated fixture failed'});}});
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>failures.push(error));page.on('dialog',async dialog=>{dialogs.push(dialog.type());await (acceptDialogs?dialog.accept():dialog.dismiss());});await page.goto(origin+href('elin'));
  return {page,reads,writes,dialogs,verdicts,snapshot:()=>page.evaluate(()=>({href:location.href,state:history.state,length:history.length})),conflict(){conflict=true;},acceptDialogs(){acceptDialogs=true;},hold(){let release,started;const promise=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);hold={promise,release,started};return{release,seen};},async close(){hold?.release();await context.close();assert.deepEqual(failures,[]);}};
}
async function withBrowser(run){const {chromium}=await import(pathToFileURL(browserModule).href),browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});try{await run(browser);}finally{await browser.close();}}
const dealer=page=>page.getByRole('combobox',{name:/^Dealer/}),review=page=>page.getByRole('combobox',{name:/^Bedömning/});
async function selected(f,id){await f.page.waitForFunction(id=>new URLSearchParams(location.search).get('dealer')===id,id);await f.page.getByText((id==='elin'?'Elin':'Lina')+' fixturetal',{exact:true}).waitFor();assert.equal(await dealer(f.page).inputValue(),id);}
async function rejectedTraversal(f){const before=await f.snapshot(),count=await f.page.evaluate(()=>window.__traversals);await f.page.evaluate(()=>history.back());await f.page.waitForFunction(count=>window.__traversals>count,count);await f.page.waitForURL(before.href);await f.page.waitForFunction(()=>!window.__historyOwner.isRestoring());assert.deepEqual(await f.snapshot(),before);}

test('actual Admin media review preserves dealer history, router state and drafts through save and conflict',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await fixture(browser);try{
    await selected(f,'elin');await f.page.evaluate(()=>{history.replaceState({...history.state,foreign:{keep:'review'},__NA:true},'');window.__historyOwner.replaceContext(location.pathname+location.search+location.hash);});const first=await f.snapshot();
    await dealer(f.page).selectOption('lina');await selected(f,'lina');const second=await f.snapshot();assert.deepEqual(second.state.foreign,first.state.foreign);assert.equal(second.state.__NA,true);
    await f.page.goBack();await selected(f,'elin');assert.deepEqual((await f.snapshot()).state,first.state);await f.page.goForward();await selected(f,'lina');
    await f.page.reload();await selected(f,'lina');for(const key of ['composition','operator','table','room','game'])assert.equal(new URL(f.page.url()).searchParams.get(key),new URL(origin+href('elin')).searchParams.get(key));
    await dealer(f.page).selectOption('elin');await selected(f,'elin');await dealer(f.page).selectOption('lina');await selected(f,'lina');
    await f.page.getByText('Lina fixturetal',{exact:true}).click();await review(f.page).selectOption('approved');assert.equal(await dealer(f.page).isDisabled(),true);
    assert.equal(await f.page.evaluate(()=>window.__navigate('/admin/drift')),false);await rejectedTraversal(f);assert.equal(await review(f.page).inputValue(),'approved');assert.equal(f.writes.length,0);
    const unload=f.page.waitForEvent('dialog');await f.page.evaluate(()=>location.assign('/admin/drift'));await unload;await f.page.waitForFunction(()=>location.pathname==='/admin/media-review');assert.ok(f.dialogs.includes('beforeunload'));assert.equal(await review(f.page).inputValue(),'approved');
    const pending=f.hold();await f.page.getByRole('button',{name:'Spara manuell granskning',exact:true}).click();await pending.seen;
    assert.equal(await f.page.evaluate(()=>window.__navigate('/admin/drift')),false);await rejectedTraversal(f);pending.release();
    await f.page.getByText('Servern bekräftade åtgärden. Tillgänglig serverdata har lästs om.',{exact:true}).waitFor();assert.equal(await dealer(f.page).isDisabled(),false);assert.equal(f.verdicts.lina,'approved');assert.equal(f.verdicts.elin,null);assert.equal(f.writes.length,1);
    await f.page.reload();await selected(f,'lina');await f.page.getByText('Lina fixturetal',{exact:true}).click();assert.equal(await review(f.page).inputValue(),'approved');
    await review(f.page).selectOption('rejected');f.conflict();await f.page.getByRole('button',{name:'Spara manuell granskning',exact:true}).click();await f.page.getByText('Uppgifterna har ändrats eller åtgärden krockar med ett pågående spel. Ladda om och kontrollera innan du försöker igen.',{exact:true}).waitFor();assert.equal(await review(f.page).inputValue(),'rejected');assert.equal(await dealer(f.page).isDisabled(),true);assert.equal(f.verdicts.lina,'approved');
    f.acceptDialogs();await f.page.getByRole('button',{name:'Kasta formulärutkast och läs om',exact:true}).click();await f.page.waitForFunction(()=>{const field=document.querySelector('select[name=verdict]');return field&&!field.disabled;});await f.page.getByText('Lina fixturetal',{exact:true}).click();assert.equal(await review(f.page).inputValue(),'approved');
    assert.deepEqual(f.writes.map(row=>row.body.dealer),['lina','lina']);assert.equal(f.reads.filter(row=>row.path==='/api/admin/workspace/media-review').length,3,'local dealer/history navigation never remounts the workspace');
  }finally{await f.close();}
}));

test('actual Admin refuses the Administration surface when its N1 session expires',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await fixture(browser,{denied:true});try{await f.page.getByText('Din N1-session saknas eller har gått ut. Logga in igen.',{exact:true}).waitFor();assert.equal(await dealer(f.page).count(),0);assert.equal(f.writes.length,0);assert.equal(f.reads.some(row=>row.path.startsWith('/studio/api/admin/')),false);}finally{await f.close();}
}));
