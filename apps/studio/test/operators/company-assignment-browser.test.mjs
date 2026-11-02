import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {studioHistoryBootstrap} from '../../lib/studio-history.mjs';

const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const origin='https://company-assignment.fixture.invalid',studio=fileURLToPath(new URL('../../',import.meta.url));
const assignment=()=>({allow:{dealer:true,tableAsset:false,background:false,language:false,limit:false,pause:false},adjustable:{dealer:true,tableAsset:true,background:true},limitPresets:['casual'],languages:['sv'],options:{limitPresets:['casual'],languages:['sv','en']}});
const catalog=()=>({schemaVersion:1,source:'registered',readAt:'2026-10-31T12:00:00.000Z',administration:{revisions:{project:'project-1',administration:'admin-1'},
  operators:['alpha','beta'].map(id=>({id,slug:id,name:id==='alpha'?'Alpha':'Beta',status:'active',archivedAt:null,packageRevision:1,assignment:assignment(),packageLanes:['scene-1']})),
  rooms:[],dealers:[{id:'nora',name:'Nora',archived:false}],compositions:[{id:'scene-1',name:'Första miljön',dealerIds:['nora'],defaultDealerId:'nora'},{id:'scene-2',name:'Andra miljön',dealerIds:['nora'],defaultDealerId:'nora'}]}});
let source;
const fixtureSource=()=>source??=build({stdin:{contents:`
import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {CompaniesPage} from './client/admin/components/studio/companies-page';
import {RegisteredStudio} from './client/admin/components/studio/registered-studio';
window.__changes=0;
function App(){const [id,setId]=useState('alpha'),[standalone,setStandalone]=useState(false),[disabled,setDisabled]=useState(false);
  window.__switch=setId;window.__standalone=()=>setStandalone(true);window.__disable=setDisabled;
  return standalone?<RegisteredStudio mode="package" operatorId={id}/>:<CompaniesPage page="company" id={id} active disabled={disabled} onChanged={()=>window.__changes++}/>;
}createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:studio,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty','.module.css':'empty'},
  define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'""','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"'},
  alias:{react:fileURLToPath(new URL('../../client/node_modules/react',import.meta.url)),'react-dom':fileURLToPath(new URL('../../client/node_modules/react-dom',import.meta.url))},
  plugins:[{name:'unrelated-company-editors',setup(builder){
    builder.onLoad({filter:/\.module\.css$/},()=>({contents:'export default {}',loader:'js'}));
    builder.onResolve({filter:/\/(?:company-team|company-create|partner-journal-loader\.mjs|partner-appearance-loader\.mjs|room-game-config)$|^\.\/(?:scene-preview|room-picture|room-release|permanent-delete)$/},args=>({path:args.path,namespace:'unused'}));
    builder.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export const CompanyTeam=()=>null,CompanyCreate=()=>null,PartnerJournal=()=>null,PartnerAppearanceLoader=()=>null,RoomGameConfig=()=>null,ScenePreview=()=>null,RoomPicture=()=>null,RoomRelease=()=>null,TrashPermanentDelete=()=>null;'}));
  }}]}).then(result=>result.outputFiles[0].text);

async function withPage(run,prepare=()=>{}){
  await fixtureSource();
  const {chromium}=await import(pathToFileURL(browserModule).href),browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});
  try{
    const context=await browser.newContext(),failures=[],state={catalog:catalog(),reads:0,completedReads:[],lifecycleReads:0,status:200,lifecycleStatus:200,writes:[],beforeRead:null,beforeLifecycle:null,assignmentStatus:200,loseReceipt:false};
    prepare(state);
    await context.addInitScript(studioHistoryBootstrap);
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin){failures.push(Error('left the fixture: '+url.href));return route.abort();}
      if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript; charset=utf-8',body:await fixtureSource()});
      if(url.pathname==='/admin/_data/catalog'){
        const request=++state.reads,json=structuredClone(state.catalog),status=state.status;
        await state.beforeRead?.(request);
        await route.fulfill({status,json,headers:{'x-fixture-catalog-read':String(request)}}).catch(()=>{});
        state.completedReads.push(request);return;
      }
      if(url.pathname==='/api/admin/resource-lifecycle'){
        state.lifecycleReads++;await state.beforeLifecycle?.();
        return route.fulfill({status:state.lifecycleStatus,json:{administrationRevision:state.catalog.administration.revisions.administration,
          operators:state.catalog.administration.operators.map(row=>({...row,lanes:row.packageLanes,roomCount:0,archivedRoomCount:0})),rooms:[]}});
      }
      if(url.pathname==='/api/admin/operator-package'){
        const body=route.request().postDataJSON();state.writes.push(body);
        const operator=state.catalog.administration.operators.find(row=>row.id===body.operatorId);
        assert.equal(body.expectedPackageRevision,operator.packageRevision,'writes use the current company CAS revision');
        if(body.assignment&&state.assignmentStatus!==200)return route.fulfill({status:state.assignmentStatus,json:{ok:false}});
        operator.packageRevision++;
        if(body.lanes)operator.packageLanes=body.lanes;
        if(body.assignment)operator.assignment={...operator.assignment,...body.assignment};
        if(state.loseReceipt){state.loseReceipt=false;return route.abort('failed');}
        return route.fulfill({json:{ok:true,operatorId:operator.id,packageRevision:operator.packageRevision,lanes:operator.packageLanes,assignment:operator.assignment}});
      }
      if(url.pathname==='/api/project')return route.fulfill({json:{project:{}}});
      if(url.pathname.startsWith('/api/')){failures.push(Error('unexpected API: '+url.pathname));return route.fulfill({status:404,json:{}});}
      return route.fulfill({contentType:'text/html; charset=utf-8',body:'<meta charset="utf-8"><div id="root"></div><script src="/fixture.js"></script>'});
    });
    const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',error=>failures.push(error));
    await page.goto(origin+'/admin/companies/alpha?flik=tilldelning');
    try{await run(page,state);}finally{await context.close();assert.deepEqual(failures,[]);}
  }finally{await browser.close();}
}
const ready=async page=>{await update(page).waitFor();await page.waitForFunction(()=>!document.querySelector('fieldset[disabled]'));};
const update=page=>page.locator('#room-publication').getByRole('button',{name:'Uppdatera',exact:true});
const publish=page=>page.getByRole('button',{name:'Publicera',exact:true});
const scene=page=>page.locator('input[name="lanes"][value="scene-2"]');

test('company assignment owns one catalog read, refreshes live props, preserves lane drafts and the disabled gate',{skip:!browserModule},()=>withPage(async(page,state)=>{
  await ready(page);assert.equal(state.reads,1);
  await scene(page).check();
  state.catalog.administration.compositions[1].name='Uppdaterad miljö';
  state.catalog.administration.operators[0].packageRevision=2;
  await update(page).click();await page.getByText('Uppdaterad miljö',{exact:true}).waitFor();
  assert.equal(state.reads,2);assert.equal(await scene(page).isChecked(),true);
  await page.evaluate(()=>window.__disable(true));await page.waitForFunction(()=>document.querySelector('fieldset').disabled);
  assert.equal(await publish(page).isDisabled(),true);
  await page.evaluate(()=>window.__disable(false));await ready(page);assert.equal(state.reads,2);
}));

test('one catalog refresh follows publishing and its lifecycle readback, with the next CAS revision usable',{skip:!browserModule},()=>withPage(async(page,state)=>{
  await ready(page);await scene(page).check();await publish(page).click();
  await page.getByText('Senast publicerat · version 2',{exact:true}).waitFor();await ready(page);
  assert.equal(state.reads,2);assert.equal(state.writes.length,1);assert.equal(await page.evaluate(()=>window.__changes),1);
  await scene(page).uncheck();await publish(page).click();await page.getByText('Senast publicerat · version 3',{exact:true}).waitFor();await ready(page);
  assert.equal(state.reads,3);assert.equal(state.writes[1].expectedPackageRevision,2);
}));

test('failed publication readback still refreshes catalog and blocks stale writes until lifecycle retry',{skip:!browserModule},()=>withPage(async(page,state)=>{
  await ready(page);state.lifecycleStatus=503;await scene(page).check();await publish(page).click();
  await page.getByRole('alert').filter({hasText:'Spelbord och arkiv kunde inte hämtas. Försök igen.'}).waitFor();
  await page.waitForFunction(()=>document.body.textContent.includes('Tilldelning version 2'));
  assert.equal(state.reads,2);assert.equal(await publish(page).isDisabled(),true);
  state.lifecycleStatus=200;await update(page).click();await ready(page);
  await scene(page).uncheck();await publish(page).click();await page.getByText('Senast publicerat · version 3',{exact:true}).waitFor();
  assert.equal(state.writes[1].expectedPackageRevision,2);
}));

test('combined edits commit one revision and refresh once',{skip:!browserModule},()=>withPage(async(page,state)=>{
  await ready(page);await scene(page).check();await page.locator('input[name="allow-pause"]').check();await publish(page).click();
  await page.getByText('Senast publicerat · version 2',{exact:true}).waitFor();await ready(page);
  assert.equal(state.reads,2);assert.equal(state.writes.length,1);
  assert.equal(state.writes[0].action,'publish-company-assignment');assert.equal(state.writes[0].expectedPackageRevision,1);
  assert.equal(state.catalog.administration.operators[0].assignment.allow.pause,true);
  assert.deepEqual(state.catalog.administration.operators[1],catalog().administration.operators[1]);
}));

test('rejected combined edits preserve both drafts and the published revision',{skip:!browserModule},()=>withPage(async(page,state)=>{
  await ready(page);state.assignmentStatus=422;
  await scene(page).check();await page.locator('input[name="allow-pause"]').check();await publish(page).click();
  await page.getByRole('alert').filter({hasText:'Tilldelningen godtogs inte'}).waitFor();await ready(page);
  assert.equal(state.reads,1);assert.equal(state.writes.length,1);
  assert.equal(state.catalog.administration.operators[0].packageRevision,1);
  assert.deepEqual(state.catalog.administration.operators[0].packageLanes,['scene-1']);
  assert.equal(state.catalog.administration.operators[0].assignment.allow.pause,false);
  assert.equal(await scene(page).isChecked(),true);assert.equal(await page.locator('input[name="allow-pause"]').isChecked(),true);
}));

test('a lost combined receipt blocks retry until authoritative readback',{skip:!browserModule},()=>withPage(async(page,state)=>{
  await ready(page);state.loseReceipt=true;
  await scene(page).check();await page.locator('input[name="allow-pause"]').check();await publish(page).click();
  await page.getByRole('alert').filter({hasText:'kunde inte bekräftas'}).waitFor();
  assert.equal(state.writes.length,1);assert.equal(state.catalog.administration.operators[0].packageRevision,2);
  assert.equal(await publish(page).isDisabled(),true);
  assert.equal(await scene(page).isChecked(),true);assert.equal(await page.locator('input[name="allow-pause"]').isChecked(),true);
  await update(page).click();await page.waitForFunction(()=>document.body.textContent.includes('Tilldelning version 2'));await ready(page);
  assert.equal(state.reads,2);assert.equal(await publish(page).isDisabled(),true);
  await page.locator('input[name="allow-pause"]').uncheck();await publish(page).click();
  await page.getByText('Senast publicerat · version 3',{exact:true}).waitFor();await ready(page);
  assert.equal(state.writes[1].action,'publish-assignment');assert.equal(state.writes[1].expectedPackageRevision,2);
}));

test('catalog error disables the existing draft, retry validates and recovers without a child fetch',{skip:!browserModule},()=>withPage(async(page,state)=>{
  await ready(page);await scene(page).check();state.status=403;await update(page).click();
  await page.getByRole('alert').filter({hasText:'Din inloggning saknas'}).waitFor();
  assert.equal(await publish(page).isDisabled(),true);assert.equal(await scene(page).isChecked(),true);
  state.status=200;await page.getByRole('button',{name:'Försök igen',exact:true}).click();await ready(page);
  assert.equal(state.reads,3);assert.equal(await scene(page).isChecked(),true);assert.equal(await publish(page).isEnabled(),true);
}));

test('an invalid shared catalog never reaches the assignment editor, and retry recovers with one read',{skip:!browserModule},()=>withPage(async(page,state)=>{
  await page.getByRole('alert').filter({hasText:'Katalogens form kunde inte verifieras.'}).waitFor();
  assert.equal(await publish(page).count(),0);assert.equal(state.reads,1);
  state.catalog=catalog();await page.getByRole('button',{name:'Försök igen',exact:true}).click();await ready(page);
  assert.equal(state.reads,2);
},state=>{delete state.catalog.administration.compositions;}));

test('switching companies keeps their separate lane drafts and never transfers a draft to the other company',{skip:!browserModule},()=>withPage(async(page,state)=>{
  await ready(page);await scene(page).check();
  await page.evaluate(()=>window.__switch('beta'));await page.getByRole('heading',{name:/^Beta/,level:1}).waitFor();await ready(page);
  assert.equal(await scene(page).isChecked(),false);
  await page.evaluate(()=>window.__switch('alpha'));await page.getByRole('heading',{name:/^Alpha/,level:1}).waitFor();await ready(page);
  assert.equal(await scene(page).isChecked(),true);assert.equal(state.writes.length,0);
}));

test('a company switch aborts the old read, ignores its late response and publishes only the selected company',{skip:!browserModule},()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  let releaseRefresh;const refreshGate=new Promise(resolve=>{releaseRefresh=resolve;});
  return withPage(async(page,state)=>{
    try{
      await page.exposeFunction('__catalogReads',()=>({started:state.reads,completed:state.completedReads}));
      await page.waitForFunction(async()=>(await window.__catalogReads()).started===1);
      state.catalog.administration.compositions[1].name='Betas aktuella miljö';
      const aborted=page.waitForEvent('requestfailed',{predicate:request=>new URL(request.url()).pathname==='/admin/_data/catalog'});
      await page.evaluate(()=>window.__switch('beta'));await ready(page);
      assert.match((await aborted).failure().errorText,/aborted/i);
      release();await page.waitForFunction(async()=>(await window.__catalogReads()).completed.includes(1));
      await page.getByRole('heading',{name:/^Beta/,level:1}).waitFor();
      await page.getByText('Betas aktuella miljö',{exact:true}).waitFor();
      state.catalog.administration.compositions[1].name='Katalogen efter publicering';
      await scene(page).check();await publish(page).click();
      await page.waitForFunction(async()=>(await window.__catalogReads()).started===3);
      assert.equal(await page.getByText('Katalogen efter publicering',{exact:true}).count(),0,'the held refresh has not reached the editor');
      const refreshed=page.waitForResponse(response=>response.headers()['x-fixture-catalog-read']==='3');
      releaseRefresh();await (await refreshed).finished();
      await page.getByText('Katalogen efter publicering',{exact:true}).waitFor();await ready(page);
      assert.equal(await page.evaluate(()=>window.__changes),1);assert.equal(state.reads,3);
      assert.equal(state.writes[0].operatorId,'beta');assert.equal(state.catalog.administration.operators[0].packageRevision,1);
    }finally{release();releaseRefresh();}
  },state=>{state.beforeRead=async request=>{if(request===1)await gate;if(request===3)await refreshGate;};});
});

test('standalone package editor still reads its own catalog and manual refresh reads it again',{skip:!browserModule},()=>withPage(async(page,state)=>{
  await ready(page);await page.evaluate(()=>window.__standalone());await ready(page);
  await page.waitForFunction(()=>document.body.textContent.includes('Miljöer som Alpha får använda'));
  assert.equal(state.reads,2);await update(page).click();await ready(page);assert.equal(state.reads,3);
}));
