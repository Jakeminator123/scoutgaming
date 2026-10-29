import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,resolve} from 'node:path';
import {build} from 'esbuild';
import {addDealer,createSeedProject,defaultPresentationLane} from '../../../packages/presentation/contracts/studio-model.mjs';
import {studioHistoryBootstrap} from '../lib/studio-history.mjs';

// The dealer page stacks three parts in Admin's scrolling <main>: DealerHub's head, the one ConnectedClipMap
// (Klippkarta, Röst och tal, Inställningar) and DealerHub's tail. None of them may be painted over another:
// on Röst och tal the map's save bar and its speech panel once lay on top of the tail's note and cards
// because the map's wrapper shrank to fit the viewport. The real Admin app and its built stylesheet are
// mounted; sidebar, other pages, Taldrift and the workspace tools are stubbed. No product service is contacted.
const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const skip=browserModule?false:'set CROUPIER_BROWSER_FIXTURE_MODULE to the Playwright module (CI:s browserjobb)';
const origin='https://admin-dealer-layout.fixture.invalid';
const studio=dirname(dirname(fileURLToPath(import.meta.url))),client=resolve(studio,'client');
function fixtureProject(){
  const project=addDealer(createSeedProject(),'jakob','Jakob');project.revision??='revision-fixture';
  project.lanes=[{...defaultPresentationLane('jakob'),id:'scene-a',label:'Scene A'}];return project;
}
const project=fixtureProject();
const catalog={schemaVersion:1,source:'registered',administration:{revisions:{project:project.revision},dealers:[{id:'jakob',name:'Jakob',archived:false}],operators:[],rooms:[]}};
let bundle,stylesheet;
async function fixtureBundle(){return bundle??=build({stdin:{contents:"import './client/admin/entry';",resolveDir:studio,loader:'tsx'},bundle:true,write:false,outfile:resolve(studio,'fixture.js'),platform:'browser',format:'iife',jsx:'automatic',
  define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'""','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"'},
  alias:{react:resolve(client,'node_modules/react'),'react-dom':resolve(client,'node_modules/react-dom'),'next/navigation':resolve(client,'runtime/navigation.tsx')},plugins:[{name:'dealer-page-boundaries',setup(builder){
    builder.onResolve({filter:/^\/composition-runtime\//},args=>({path:args.path,external:true}));
    builder.onResolve({filter:/\.module\.css$/},args=>({path:args.path,namespace:'fixture-css'}));
    builder.onLoad({filter:/.*/,namespace:'fixture-css'},()=>({contents:'export default {}'}));
    builder.onResolve({filter:/^\./},args=>{const importer=args.importer.replaceAll('\\','/'),from=name=>importer.endsWith(name);
      if(from('/client/admin/entry.tsx')){
        if(args.path.startsWith('./app/'))return{path:args.path,namespace:'clips'};
        if(args.path.startsWith('./components/')&&!args.path.startsWith('./components/ui/')&&!['./components/studio/dealer-hub','./components/studio/connected-clip-map'].includes(args.path))return{path:args.path,namespace:'unused'};
      }
      if(from('/dealer-hub.tsx')&&['./taldrift-panel','./workspace-tools','./resource-connections','./saved-scene-preview','./scene-preview'].includes(args.path))return{path:args.path,namespace:'unused'};
    });
    // Stand-ins with a real height, so the tail's cards have the size of a filled page.
    builder.onLoad({filter:/.*/,namespace:'unused'},()=>({resolveDir:studio,contents:'import {jsx} from "react/jsx-runtime";const block=()=>jsx("div",{style:{height:"180px"}});export default ()=>null;export const StudioSidebar=()=>null,AdminLogout=()=>null,AdminHome=()=>null,DemoBuilder=()=>null,DealerDirectory=()=>null,ScenesPage=()=>null,CompaniesPage=()=>null,SystemPage=()=>null,AdminHelp=()=>null,ResourceConnections=()=>null,SavedScenePreview=()=>null,ScenePreview=()=>null,TaldriftPanel=block,WorkspaceTool=block;'}));
    builder.onLoad({filter:/.*/,namespace:'clips'},()=>({resolveDir:studio,contents:'import {jsx} from "react/jsx-runtime";export default ({active,children})=>jsx("div",{className:"studio-workspace-mount",hidden:!active,children});'}));
  }}]}).then(result=>({js:result.outputFiles.find(file=>file.path.endsWith('.js')).text,css:result.outputFiles.find(file=>file.path.endsWith('.css'))?.text??''}));}
// The same stylesheet build.mjs writes to theme.css: Tailwind over globals.css, then runtime/preview.css.
async function adminStylesheet(){return stylesheet??=(async()=>{
  const require=createRequire(resolve(client,'build.mjs'));
  const postcss=require('postcss'),tailwind=require('@tailwindcss/postcss'),source=resolve(client,'admin'),from=resolve(source,'app/globals.css');
  const result=await postcss([tailwind({base:source})]).process(await readFile(from,'utf8'),{from});
  return result.css+'\n'+await readFile(resolve(client,'runtime/preview.css'),'utf8');
})();}
async function withBrowser(run){const {chromium}=await import(pathToFileURL(browserModule).href);const browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});try{await run(browser);}finally{await browser.close();}}
async function openDealer(browser,viewport,flik){
  const context=await browser.newContext({viewport}),failures=[],writes=[];
  await context.addInitScript(studioHistoryBootstrap);
  await context.route('**/*',async route=>{try{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    assert.equal(url.origin,origin,'all requests are intercepted; unexpected destinations fail');
    if(method!=='GET'){writes.push(method+' '+url.pathname);return route.fulfill({status:503,json:{error:'isolated_fixture'}});}
    if(request.isNavigationRequest())return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="sv" class="dark"><head><meta charset="utf-8"><link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/fixture.css"></head><body class="preview-admin font-sans antialiased"><div id="root"></div><script src="/fixture.js"></script></body></html>'});
    if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:(await fixtureBundle()).js});
    if(url.pathname==='/fixture.css')return route.fulfill({contentType:'text/css',body:(await fixtureBundle()).css});
    if(url.pathname==='/theme.css')return route.fulfill({contentType:'text/css',body:await adminStylesheet()});
    if(url.pathname==='/admin/_data/catalog')return route.fulfill({json:catalog});
    if(url.pathname==='/studio/api/project')return route.fulfill({json:{project}});
    if(url.pathname==='/studio/api/videos')return route.fulfill({json:{videos:[],uploadMode:'isolated'}});
    // Fonts and the speech panel's own reads (voices, recordings) are outside the layout under test.
    return route.fulfill({status:503,json:{error:'isolated_fixture'}});
  }catch(error){failures.push(error);await route.fulfill({status:500,body:'Isolated fixture failed'});}});
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>failures.push(error));
  await page.goto(origin+'/admin/dealers/jakob?'+new URLSearchParams({flik,game:'blackjack'}));
  await page.locator('.studio-save-actions').getByText('Projektutkast sparat',{exact:true}).waitFor();
  return {page,async close(){await context.close();assert.deepEqual(failures,[]);assert.deepEqual(writes,[],'the layout fixture never writes');}};
}
const overlap=(a,b)=>Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>0.5&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>0.5;
// The page's three parts and what each paints; boxes are in page coordinates (the scroll offset of <main> added).
// A part's extent includes content that overflows it, so a box that has shrunk below its content still counts in full.
const layout=page=>page.evaluate(()=>{
  const main=document.querySelector('main'),box=node=>{const rect=node.getBoundingClientRect();return {x:rect.x,y:rect.y+main.scrollTop,width:rect.width,height:Math.max(rect.height,node.scrollHeight)};};
  const painted=node=>node.getClientRects().length>0&&node.getBoundingClientRect().height>0;
  const map=document.querySelector('.studio-clip-workspace'),place=map.closest('main>div'),tail=place.nextElementSibling;
  const parts=[...map.querySelectorAll('.studio-save-actions,#studio-clip-inspector,.studio-map-stage')].filter(painted).map(node=>({name:node.id||node.className.split(' ')[0],box:box(node)}));
  // The floating Förhandsvisning tab is fixed to the window edge by design and is not part of the flow.
  const tailItems=tail?[...tail.querySelectorAll(':scope>*>*,:scope>*')].filter(node=>painted(node)&&![node,node.parentElement].some(row=>getComputedStyle(row).position==='fixed')).map(node=>({name:node.tagName+':'+(node.textContent??'').trim().slice(0,40),box:box(node)})):[];
  return {map:box(map),place:{...box(place),clientHeight:place.clientHeight,scrollHeight:place.scrollHeight},tailTop:tail?box(tail).y:null,parts,tailItems,
    head:box(place.previousElementSibling),width:document.documentElement.scrollWidth,viewport:innerWidth};
});
// elementFromPoint in the middle of Spara utkast (scrolled into view) must be the button itself.
const saveHit=page=>page.locator('.studio-save').evaluate(button=>{button.scrollIntoView({block:'center'});const rect=button.getBoundingClientRect(),hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);return {hit:hit===button||button.contains(hit),at:hit?.outerHTML.slice(0,120)};});

for(const viewport of [{width:1440,height:900},{width:390,height:844}])for(const flik of ['tal','klipp','installningar']){
  test(`the dealer page at ${viewport.width} px on ?flik=${flik}: the clip map never lies over the header or the tab's own content`,{skip},()=>withBrowser(async browser=>{
    const f=await openDealer(browser,viewport,flik);try{
      if(flik==='tal'){
        await f.page.getByText('Talkedjan byggs om',{exact:false}).waitFor();
        await f.page.locator('#studio-clip-inspector').getByRole('heading',{name:'Röst & tal',exact:true}).waitFor();
      }
      if(flik!=='klipp'){
        // Röst och tal and Inställningar are tabs, not a drawer: one title (the panel's own) and no Stäng.
        if(flik==='tal')assert.equal(await f.page.getByRole('heading',{name:'Röst & tal',exact:true}).count(),1,'one Röst & tal title');
        assert.equal(await f.page.locator('#studio-clip-inspector').getByRole('button',{name:'Stäng',exact:true}).count(),0,'the tab has no Stäng');
      }
      const view=await layout(f.page);
      assert.ok(view.head.y+view.head.height<=view.map.y+0.5,'the header ends before the clip map starts');
      assert.ok(view.place.scrollHeight<=view.place.clientHeight+1,`the clip map's place in the page (${view.place.clientHeight}px) holds all of it (${view.place.scrollHeight}px)`);
      if(view.tailTop!==null)assert.ok(view.map.y+view.map.height<=view.tailTop+0.5,'the tab content below starts after the clip map');
      for(const part of view.parts)for(const item of view.tailItems)assert.equal(overlap(part.box,item.box),false,`${part.name} lies over ${item.name}`);
      if(flik==='tal'){
        const names=view.tailItems.map(item=>item.name).join(' | ');
        for(const text of ['Talkedjan byggs om','Taldrift','Svarsbibliotek','Dialogtest'])assert.match(names,new RegExp(text),`the tab shows ${text}`);
        assert.ok(view.parts.some(part=>part.name==='studio-clip-inspector'),'the speech panel is part of the page');
      }
      assert.ok(view.width<=view.viewport,'no sideways scroll');
      const hit=await saveHit(f.page);assert.equal(hit.hit,true,'Spara utkast is what a click in its middle reaches, not '+hit.at);
    }finally{await f.close();}
  }));
}
