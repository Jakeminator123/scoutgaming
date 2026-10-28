import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname} from 'node:path';
import {build} from 'esbuild';
import {studioHistoryBootstrap} from '../lib/studio-history.mjs';
const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const origin='https://admin-administration.fixture.invalid',studio=dirname(dirname(fileURLToPath(import.meta.url)));
let source;
async function fixtureSource(){return source??=build({stdin:{contents:`import './client/admin/entry';
import {studioHistory} from './lib/studio-history.mjs';import {navigate} from './client/runtime/navigation';
window.__historyOwner=studioHistory(window);window.__navigate=navigate;window.__traversals=0;
window.__historyOwner.guardTraversal(()=>{window.__traversals++;return true;});`,resolveDir:studio,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'""','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"'},alias:{react:fileURLToPath(new URL('../client/node_modules/react',import.meta.url)),'react-dom':fileURLToPath(new URL('../client/node_modules/react-dom',import.meta.url)),'next/navigation':fileURLToPath(new URL('../client/runtime/navigation.tsx',import.meta.url))},plugins:[{name:'unrelated-admin-surfaces',setup(builder){
  builder.onResolve({filter:/\.module\.css$/},args=>({path:args.path,namespace:'fixture-css'}));builder.onLoad({filter:/.*/,namespace:'fixture-css'},()=>({contents:'export default {}'}));
  builder.onResolve({filter:/^\./},args=>{const importer=args.importer.replaceAll('\\','/');
    if(importer.endsWith('/client/admin/entry.tsx')&&((args.path.startsWith('./components/')&&!['./components/studio/system-page','./components/studio/connected-services'].includes(args.path))||args.path.startsWith('./app/')))return{path:args.path,namespace:'unused'};
    if(importer.endsWith('/system-page.tsx')&&['./resource-connections'].includes(args.path))return{path:args.path,namespace:'unused'};
    if(importer.endsWith('/workspace-tools.tsx')&&args.path.includes('/components/'))return{path:args.path,namespace:'unused'};
    if(importer.endsWith('/connected-services.tsx')&&(args.path.endsWith('/openclaw-workspace')||args.path==='./connected-economy'))return{path:args.path,namespace:'unused'};
    if(args.path==='./moving-drift-controls'||args.path==='./dealer-video-surface')return{path:args.path,namespace:'unused'};
  });
  builder.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export default ()=>null;export const StudioSidebar=()=>null,ConnectedClipMap=()=>null,DealerHub=()=>null,ScenesPage=()=>null,CompaniesPage=()=>null,AdminHome=()=>null,DemoBuilder=()=>null,DealerDirectory=()=>null,ResourceConnections=()=>null,AdminHelp=()=>null,AdminLogout=()=>null,ResourceDeletion=()=>null,WorkspaceToolsHome=()=>null,AdminPublicationPage=()=>null,ControlActivityPage=()=>null,ControlPreviewPage=()=>null,ControlEventsPage=()=>null,ControlTreePage=()=>null,ControlProbePage=()=>null,ControlRepliesPage=()=>null,ControlVideosPage=()=>null,ControlGuidePage=()=>null,ControlOpenClawChat=()=>null,LabStudio=()=>null,OpenClawWorkspace=()=>null,ConnectedEconomy=()=>null,MovingDriftControls=()=>null,DealerClipPreview=()=>null;'}));
}}]}).then(result=>result.outputFiles[0].text);}
// The retired speech review (/admin/media-review) is gone; the N1 refusal
// belongs to every connected Administration page, here Integrationer.
async function fixture(browser){
  const context=await browser.newContext(),failures=[],reads=[],writes=[];
  await context.addInitScript(studioHistoryBootstrap);
  await context.route('**/*',async route=>{try{
    const request=route.request(),url=new URL(request.url()),method=request.method();assert.equal(url.origin,origin,'fixture never contacts real media or product services');
    (method==='GET'?reads:writes).push({path:url.pathname,method});
    if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:await fixtureSource()});
    if(url.pathname==='/studio/api/auth/session')return route.fulfill({status:401,json:{error:'unauthorized'}});
    assert.equal(method,'GET');assert.equal(url.pathname,'/admin/system','unexpected fixture path '+url.pathname);
    return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/fixture.js"></script>'});
  }catch(error){failures.push(error);await route.fulfill({status:500,body:'Isolated fixture failed'});}});
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>failures.push(error));await page.goto(origin+'/admin/system?flik=integration');
  return {page,reads,writes,async close(){await context.close();assert.deepEqual(failures,[]);}};
}
async function withBrowser(run){const {chromium}=await import(pathToFileURL(browserModule).href),browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});try{await run(browser);}finally{await browser.close();}}

test('actual Admin refuses the Administration surface when its N1 session expires',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await fixture(browser);try{await f.page.getByText('Din inloggning saknas eller har gått ut. Logga in igen.',{exact:true}).waitFor();assert.equal(f.writes.length,0);assert.equal(f.reads.some(row=>row.path.startsWith('/studio/api/admin/')),false);}finally{await f.close();}
}));
