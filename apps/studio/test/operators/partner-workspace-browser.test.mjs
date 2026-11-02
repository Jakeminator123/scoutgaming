import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname} from 'node:path';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {studioHistoryBootstrap} from '../../lib/studio-history.mjs';
import {PARTNER_PERMISSIONS} from '../../../../packages/studio-access/server/partner-access-policy.mjs';
import {defaultPresentationLane} from '../../../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings} from '../../../../packages/presentation/contracts/composition-settings.mjs';

// Partnerportalens riktiga skal och spelbordseditor i Chrome: Radix-flikar, kortval,
// granskningsdialogen, åtgärdsmenyn och ⌘K-paletten med tangentbordet. Allt nätverk
// går till en isolerad fixtur; spara → granska → publicera ska vara samma tre anrop.
const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;

test('partner styles leave surrounding content unchanged and load no external resource',{skip:!browserModule},()=>withBrowser(async browser=>{
  const page=await browser.newPage(),requests=[];
  await page.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
  try{
    await page.setContent('<!doctype html><main><h1>Other workspace</h1><nav><a href="#">Navigation</a></nav><section class="card"><h2>Content</h2><p class="sub">Description</p><button class="btn">Action</button><label>Input<input></label><table><tbody><tr><td>Value</td></tr></tbody></table></section></main>');
    await page.addStyleTag({content:':root{--sg-bg:#123456;--sg-text:#fedcba;--sg-surface:#345678;--sg-font-body:monospace}'});
    const styles=()=>page.locator('body,body *').evaluateAll(elements=>elements.map(element=>{
      const css=getComputedStyle(element);
      return Object.fromEntries(['display','position','color','backgroundColor','font','margin','padding','border','borderRadius','minHeight','width','height'].map(key=>[key,css[key]]));
    }));
    const before=await styles();
    await page.addStyleTag({content:await readFile(new URL('../../components/partner/partner-portal.css',import.meta.url),'utf8')});
    assert.deepEqual(await styles(),before,'portal CSS cannot change another workspace');
    await page.waitForTimeout(50);
    assert.deepEqual(requests,[]);
  }finally{await page.close();}
}));
const origin='https://partner-workspace.fixture.invalid',studio=dirname(dirname(dirname(fileURLToPath(import.meta.url))));
let source;
async function fixtureSource(){return source??=build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';
import './app/globals.css';import './app/scout-theme.css';
import {PartnerOperatorWorkspace} from './components/partner/partner-operator-workspace.jsx';
import {PartnerAppearance} from './components/partner-appearance';
const props=window.__PROPS__;createRoot(document.getElementById('root')).render(React.createElement(props.initial?PartnerAppearance:PartnerOperatorWorkspace,props));`,resolveDir:studio,loader:'jsx'},
  bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent',
  define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'""','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"0"'},
  }).then(result=>({js:result.outputFiles.find(file=>file.path.endsWith('.js')).text,css:result.outputFiles.find(file=>file.path.endsWith('.css')).text}));}

function fixtureState(){
  const lane={...defaultPresentationLane('astrid'),composition:defaultCompositionSettings(),operatorAdjustable:['dealer','branding']};
  lane.dealers=['astrid','elin'];lane.layers.dealer={enabled:true,default:'astrid',allowed:['astrid','elin']};
  const branding={lane:lane.id};
  const initial={operatorId:'north',packageRevision:7,lanes:[lane.id],branding,adjustable:lane.operatorAdjustable,canConfigure:true,
    dealerChoices:{[lane.id]:['astrid','elin']},roomDealerChoices:{'room-main':['astrid','elin'],'room-vip':['astrid','elin']},
    presentation:{schemaVersion:3,projectRevision:'r7',assets:[],lanes:[lane],playback:{},registeredDealers:[{id:'astrid',label:'Astrid',idle:null},{id:'elin',label:'Elin',idle:null}]},
    draft:null,draftRevision:0,history:[{revision:7,publishedAt:Date.UTC(2026,9,20),branding},{revision:6,publishedAt:Date.UTC(2026,9,10),branding}],
    rooms:[{id:'room-main',label:'Main',presentationLaneId:lane.id,game:'blackjack'},{id:'room-vip',label:'VIP',presentationLaneId:lane.id,game:'blackjack'}]};
  const operator={id:'north',slug:'north',name:'North',packageRevision:'7'};
  const table=(id,name)=>({id,name,operatorId:'north',game:'blackjack',state:'live',status:'active',presentationId:lane.id,dealer:{id:'astrid',label:'Astrid'},configVersion:null,settings:{language:'sv',limitPreset:'casual'},playUrl:'/game?game=blackjack&operator=north&table='+id});
  const snapshot={schemaVersion:2,preview:false,accessClass:'partner',viewer:{user:'north-admin',accessClass:'partner'},operator,operators:[operator],
    role:{id:'partner-admin',label:'administratör'},permissions:[...PARTNER_PERMISSIONS],view:'rooms',packageRevision:'7',generatedAt:'2026-10-28T12:00:00Z',
    tables:[table('room-main','Main'),table('room-vip','VIP')],team:[],invitations:0,draft:null,publications:[]};
  return {initial,snapshot};
}

async function fixture(browser,path,{material=false}={}){
  const {initial,snapshot}=fixtureState();
  if(material){
    initial.rooms[1].materialPublishable=true;
    initial.presentation.lanes[0].layers.background={enabled:true,mode:'image',default:'bg-green',allowed:['bg-green','bg-blue']};
    initial.presentation.assets=[{id:'bg-green',role:'background',label:'Grön'},{id:'bg-blue',role:'background',label:'Blå'}];
  }
  let server=structuredClone(initial);
  const context=await browser.newContext(),failures=[],writes=[];
  await context.addInitScript(studioHistoryBootstrap);
  await context.route('**/*',async route=>{try{
    const request=route.request(),url=new URL(request.url()),method=request.method();assert.equal(url.origin,origin,'the fixture never contacts real services');
    if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:(await fixtureSource()).js});
    if(url.pathname==='/fixture.css')return route.fulfill({contentType:'text/css',body:(await fixtureSource()).css});
    if(url.pathname==='/studio/api/partner/branding'){
      if(method==='GET')return route.fulfill({json:server});
      const body=JSON.parse(request.postData());writes.push(body);
      if(body.action==='save-draft'){server={...server,draftRevision:server.draftRevision+1,draft:{revision:server.draftRevision+1,basePackageRevision:server.packageRevision,branding:body.branding,updatedAt:Date.UTC(2026,9,28)}};return route.fulfill({json:server});}
      if(body.action==='review')return route.fulfill({json:{reviewToken:'fixture-review',draftRevision:server.draftRevision,packageRevision:server.packageRevision,branding:server.draft.branding,
        changes:[{roomId:'room-vip',key:material?'background':'roomOverrides.dealer',before:material?'bg-green':'astrid',after:material?'bg-blue':'elin'}],affectedRooms:['room-vip']}});
      if(body.action===(material?'publish-room-material':'publish')){
        if(material){assert.equal(body.roomId,'room-vip');assert.equal(body.reviewToken,'fixture-review');}
        server={...server,packageRevision:server.packageRevision+1,branding:server.draft.branding,draft:null,draftRevision:server.draftRevision+1};return route.fulfill({json:server});}
      return route.fulfill({status:409,json:{}});
    }
    if(url.pathname.includes('/preview'))return route.fulfill({status:404,json:{}});
    if(url.pathname.startsWith('/studio/api/'))return route.fulfill({status:404,json:{}});
    assert.equal(method,'GET');
    const props=material?{initial,apiBase:'/studio/api/partner',operatorSlug:'north',roomId:'room-vip',roomLayout:true,adminChoices:true,publication:'room'}
      :{surface:'partner',user:'north-admin',apiBase:'/studio/api/partner/snapshot',initialSnapshot:snapshot,initialView:'rooms',initialRoomId:new URL(path,origin).searchParams.get('room')};
    return route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html lang="sv"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script>window.__PROPS__=${JSON.stringify(props)}</script><script src="/fixture.js"></script></body></html>`});
  }catch(error){failures.push(error);await route.fulfill({status:500,body:'Isolated fixture failed'});}});
  // Bundle before navigating so a busy machine never turns the build into a navigation timeout.
  await fixtureSource();
  const page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(30000);page.on('pageerror',error=>failures.push(error));await page.goto(origin+path);
  return {page,writes,async close(){await context.close();assert.deepEqual(failures,[]);}};
}
async function withBrowser(run){const {chromium}=await import(pathToFileURL(browserModule).href),browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});try{await run(browser);}finally{await browser.close();}}

test('Admin material choices save, review and publish only the selected room in desktop and mobile Chrome',{skip:!browserModule},()=>withBrowser(async browser=>{
  for(const width of [390,1280]){
    const f=await fixture(browser,'/admin/rooms/room-vip',{material:true}),{page}=f;
    try{
      await page.setViewportSize({width,height:900});
      const choices=page.locator('fieldset[data-kind="background"]');
      await choices.locator('summary').click();
      await page.getByRole('radio',{name:'Bakgrund: Blå',exact:true}).click();
      await page.locator('[data-action="save-draft"]').click();
      await page.getByRole('button',{name:'Publicera materialval',exact:true}).click();
      const dialog=page.getByRole('dialog',{name:'Granska och publicera'});await dialog.waitFor();
      assert.match(await dialog.textContent(),/Bara detta spelbords bakgrund och bordsgrafik publiceras/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'actions stay inside the viewport');
      await dialog.getByRole('button',{name:'Publicera nu',exact:true}).click();
      await page.getByRole('dialog',{name:'Publicerat · version 8'}).waitFor();
      assert.deepEqual(f.writes.map(row=>row.action),['save-draft','review','publish-room-material']);
      assert.deepEqual(f.writes[0].branding,{lane:fixtureState().initial.presentation.lanes[0].id,roomOverrides:{'room-vip':{background:'bg-blue'}}});
      assert.deepEqual(f.writes[2],{action:'publish-room-material',expectedDraftRevision:1,expectedPackageRevision:7,reviewToken:'fixture-review',roomId:'room-vip'});
    }finally{await f.close();}
  }
}));
// The bundle is built before navigating, but the first render still runs the whole shell, the editor's
// dynamic import and its branding GET; on a busy CI machine that has exceeded the 10 s default.
const FIRST_RENDER=30000;
// Radix moves roving focus in a timeout after the key press; wait for it instead of sampling at once.
const focusOn=(page,check)=>page.waitForFunction(check);
const focused=page=>page.evaluate(()=>({role:document.activeElement?.getAttribute('role'),label:document.activeElement?.getAttribute('aria-label'),text:document.activeElement?.textContent?.trim(),inDialog:Boolean(document.activeElement?.closest('[role="dialog"]'))}));
// Radix returns focus to the trigger after its close animation; poll briefly instead of sampling at once.
async function hasFocus(locator,message){for(let i=0;i<100;i++){if(await locator.evaluate(element=>element===document.activeElement))return;await new Promise(resolve=>setTimeout(resolve,20));}assert.fail(message);}

test('the styled table editor fits narrow screens and keeps actions, tabs and material choices reachable',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await fixture(browser,'/partner/north/rooms?room=room-vip');const {page}=f;
  try{
    const tabs=page.getByRole('tablist',{name:'Spelbordets inställningar'});
    await tabs.waitFor({timeout:FIRST_RENDER});
    for(const width of [320,390,1440]){
      await page.setViewportSize({width,height:900});
      await page.getByRole('tab',{name:'Utseende'}).click();
      const bounds=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
      assert.ok(bounds.content<=bounds.viewport+1,`${width}px: page must not scroll sideways (${JSON.stringify(bounds)})`);
      for(const action of ['save-draft','review']){
        const rect=await page.locator(`[data-action="${action}"]`).boundingBox();
        assert.ok(rect&&rect.x>=0&&rect.x+rect.width<=bounds.viewport+1,`${width}px: ${action} stays on screen`);
      }
      // Only the tab strip may scroll. Keyboard navigation must reveal the last tab.
      await page.getByRole('tab',{name:'Utseende'}).focus();await page.keyboard.press('End');
      await focusOn(page,()=>document.activeElement?.textContent?.trim()==='Historik');
      const history=await page.getByRole('tab',{name:'Historik'}).boundingBox();
      assert.ok(history.x>=0&&history.x+history.width<=bounds.viewport+1,`${width}px: last tab is reachable`);
      await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Publicerade versioner'}).waitFor();
      await page.getByRole('tab',{name:'Dealer'}).click();
      const disclosure=page.locator('fieldset[data-kind="dealer"] summary');
      await disclosure.press('Enter');await page.getByRole('radiogroup',{name:'Dealer'}).waitFor();
      const option=await page.getByRole('radio',{name:'Dealer: Elin'}).boundingBox();
      assert.ok(option&&option.x>=0&&option.x+option.width<=bounds.viewport+1,`${width}px: material choices stay on screen`);
      await disclosure.press('Enter');
    }
    assert.deepEqual(f.writes,[]);
  }finally{await f.close();}
}));

test('the table editor works with the keyboard: tabs, card choices, review dialog, actions menu; save → review → publish keep their order',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await fixture(browser,'/partner/north/rooms?room=room-vip');const {page}=f;
  try{
    // First render: the heading shows while the editor loads (bundle, dynamic import and the branding
    // GET), so wait for the editor's own tab list with a longer timeout than the later steps.
    await page.getByRole('heading',{level:1,name:'VIP'}).waitFor({timeout:FIRST_RENDER});
    const tabs=page.getByRole('tablist',{name:'Spelbordets inställningar'});await tabs.waitFor({timeout:FIRST_RENDER});
    assert.deepEqual((await tabs.getByRole('tab').allTextContents()).map(text=>text.trim()),['Utseende','Dealer','Spelinställningar','Tillgänglighet','Historik']);
    // Tabs (Radix, manual activation): arrows move focus, Enter opens the panel.
    const dealers=page.getByRole('radiogroup',{name:'Dealer'});
    await page.getByRole('tab',{name:'Utseende'}).focus();await page.keyboard.press('ArrowRight');
    await focusOn(page,()=>document.activeElement?.textContent?.trim()==='Dealer');await page.keyboard.press('Enter');
    const dealerDisclosure=page.locator('fieldset[data-kind="dealer"] summary');
    await dealerDisclosure.waitFor();assert.equal(await dealers.isVisible(),false,'current choice is shown before alternatives');
    await dealerDisclosure.focus();await page.keyboard.press('Enter');await dealers.waitFor();
    await page.getByRole('tab',{name:'Dealer'}).focus();
    await page.keyboard.press('End');
    await focusOn(page,()=>document.activeElement?.textContent?.trim()==='Historik');await page.keyboard.press('Enter');
    await page.getByRole('heading',{name:'Publicerade versioner'}).waitFor();assert.equal(await dealers.isVisible(),false);
    // Game settings and availability are read-only until the partner API can change them.
    await page.getByRole('tab',{name:'Spelinställningar'}).click();
    await page.getByRole('heading',{name:'Spelinställningar'}).waitFor();await page.getByText('Låst av Scoutgaming.').first().waitFor();
    await page.getByRole('tab',{name:'Dealer'}).focus();await page.keyboard.press('Enter');await dealers.waitFor();
    // Card choices (Radix RadioGroup): one tab stop, arrows choose, the status line follows.
    await page.getByRole('radio',{name:'Dealer: Astrid'}).focus();assert.equal(await page.getByRole('radio',{name:'Dealer: Astrid'}).getAttribute('aria-checked'),'true');
    // Radix checks the radio that receives arrow focus while the key is held, as a person presses it.
    await page.keyboard.down('ArrowRight');
    await focusOn(page,()=>document.activeElement?.getAttribute('aria-label')==='Dealer: Elin');await page.keyboard.up('ArrowRight');
    await page.waitForFunction(()=>document.querySelector('[aria-label="Dealer: Elin"]')?.getAttribute('aria-checked')==='true');
    await page.getByRole('status').filter({hasText:'osparade ändringar'}).waitFor();
    assert.equal(await page.locator('[data-action="review"]').isDisabled(),true,'unsaved edits are saved before review');
    await page.locator('[data-action="save-draft"]').click();
    await page.getByRole('status').filter({hasText:'utkast sparat'}).waitFor();
    const review=page.locator('[data-action="review"]');assert.equal((await review.textContent()).trim(),'Publicera · 1 ändring');
    // Review dialog (Radix Dialog): focus moves in and is trapped, Esc closes and returns focus.
    await review.click();const dialog=page.getByRole('dialog',{name:'Granska och publicera'});await dialog.waitFor();
    assert.equal((await focused(page)).inDialog,true);
    for(let i=0;i<6;i++){await page.keyboard.press('Tab');assert.equal((await focused(page)).inDialog,true,'focus stays in the dialog');}
    await dialog.getByText('Utkastet är gemensamt för bolagets spelbord',{exact:false}).waitFor();
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    await hasFocus(review,'focus returns to the publish button');
    // Actions menu (Radix DropdownMenu): Enter opens, arrows move, Esc closes back to the trigger.
    const more=page.getByRole('button',{name:'Fler åtgärder'});await more.focus();await page.keyboard.press('Enter');
    const menu=page.getByRole('menu');await menu.waitFor();await page.keyboard.press('ArrowDown');
    await focusOn(page,()=>document.activeElement?.getAttribute('role')==='menuitem');
    await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});await hasFocus(more,'focus returns to the actions button');
    // Publish from the dialog: the receipt replaces the step.
    await review.click();await dialog.waitFor();await page.locator('[data-action="publish"]').click();
    await page.getByRole('dialog',{name:'Publicerat · version 8'}).waitFor();
    // Reopening the dialog reviews again; the order is always save → review → publish and publish carries the last review.
    assert.deepEqual(f.writes.map(row=>row.action),['save-draft','review','review','publish']);
    assert.deepEqual(f.writes[0].branding,{lane:fixtureState().initial.presentation.lanes[0].id,roomOverrides:{'room-vip':{dealer:'elin'}}});
    assert.deepEqual(f.writes.map(row=>[row.expectedDraftRevision,row.expectedPackageRevision]),[[0,7],[1,7],[1,7],[1,7]]);
    assert.equal(f.writes[3].reviewToken,'fixture-review');
  }finally{await f.close();}
}));

test('the ⌘K palette finds a table by name and opens its editor with the keyboard; the list opens from the breadcrumb',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await fixture(browser,'/partner/north/rooms?room=room-vip');const {page}=f;
  try{
    await page.getByRole('heading',{level:1,name:'VIP'}).waitFor({timeout:FIRST_RENDER});
    await page.getByRole('tablist',{name:'Spelbordets inställningar'}).waitFor({timeout:FIRST_RENDER});
    await page.keyboard.press('Control+k');const input=page.getByRole('combobox');await input.waitFor();
    assert.equal(await input.evaluate(element=>element===document.activeElement),true);
    await page.keyboard.type('Main');await page.keyboard.press('Enter');
    await page.getByRole('heading',{level:1,name:'Main'}).waitFor();assert.match(page.url(),/\/partner\/north\/rooms\?room=room-main$/);
    await page.getByRole('navigation',{name:'Brödsmulor'}).getByRole('link',{name:'Spelbord'}).click();
    await page.getByRole('heading',{level:1,name:'Spelbord'}).waitFor();assert.match(page.url(),/\/partner\/north\/rooms$/);
    await page.getByRole('button',{name:'Öppna VIP'}).click();await page.getByRole('heading',{level:1,name:'VIP'}).waitFor();
    assert.deepEqual(f.writes,[]);
  }finally{await f.close();}
}));
