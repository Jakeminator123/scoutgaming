import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname} from 'node:path';
import {build} from 'esbuild';
import {studioHistoryBootstrap} from '../lib/studio-history.mjs';
import {PARTNER_PERMISSIONS} from '../../../packages/studio-access/server/partner-access-policy.mjs';
import {defaultPresentationLane} from '../../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';

// Partnerportalens riktiga skal och spelbordseditor i Chrome: Radix-flikar, kortval,
// granskningsdialogen, åtgärdsmenyn och ⌘K-paletten med tangentbordet. Allt nätverk
// går till en isolerad fixtur; spara → granska → publicera ska vara samma tre anrop.
const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const origin='https://partner-workspace.fixture.invalid',studio=dirname(dirname(fileURLToPath(import.meta.url)));
let source;
async function fixtureSource(){return source??=build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';
import {PartnerOperatorWorkspace} from './components/kevin-bo/partner-operator-workspace.jsx';
const props=window.__PROPS__;createRoot(document.getElementById('root')).render(React.createElement(PartnerOperatorWorkspace,props));`,resolveDir:studio,loader:'jsx'},
  bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent',
  define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'""','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"0"'},
  plugins:[{name:'fixture-css',setup(builder){
    builder.onResolve({filter:/\.css$/},args=>({path:args.path,namespace:'fixture-css'}));
    builder.onLoad({filter:/.*/,namespace:'fixture-css'},args=>({contents:args.path.endsWith('.module.css')?'export default new Proxy({},{get:(_,key)=>String(key)});':'',loader:'js'}));
  }}]}).then(result=>result.outputFiles[0].text);}

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
  const snapshot={schemaVersion:2,preview:false,mode:'live',accessClass:'partner',viewer:{user:'north-admin',accessClass:'partner'},operator,operators:[operator],
    role:{id:'partner-admin',label:'administratör'},permissions:[...PARTNER_PERMISSIONS],view:'rooms',packageRevision:'7',generatedAt:'2026-10-28T12:00:00Z',
    presentations:[],tables:[table('room-main','Main'),table('room-vip','VIP')],team:[],invitations:0,draft:null,publications:[],summary:{activeTables:2}};
  return {initial,snapshot};
}

async function fixture(browser,path){
  const {initial,snapshot}=fixtureState();let server=structuredClone(initial);
  const context=await browser.newContext(),failures=[],writes=[];
  await context.addInitScript(studioHistoryBootstrap);
  await context.route('**/*',async route=>{try{
    const request=route.request(),url=new URL(request.url()),method=request.method();assert.equal(url.origin,origin,'the fixture never contacts real services');
    if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:await fixtureSource()});
    if(url.pathname==='/studio/api/partner/branding'){
      if(method==='GET')return route.fulfill({json:server});
      const body=JSON.parse(request.postData());writes.push(body);
      if(body.action==='save-draft'){server={...server,draftRevision:server.draftRevision+1,draft:{revision:server.draftRevision+1,basePackageRevision:server.packageRevision,branding:body.branding,updatedAt:Date.UTC(2026,9,28)}};return route.fulfill({json:server});}
      if(body.action==='review')return route.fulfill({json:{reviewToken:'fixture-review',draftRevision:server.draftRevision,packageRevision:server.packageRevision,branding:server.draft.branding,
        changes:[{roomId:'room-vip',key:'roomOverrides.dealer',before:'astrid',after:'elin'}],affectedRooms:['room-vip']}});
      if(body.action==='publish'){server={...server,packageRevision:server.packageRevision+1,branding:server.draft.branding,draft:null,draftRevision:server.draftRevision+1};return route.fulfill({json:server});}
      return route.fulfill({status:409,json:{}});
    }
    if(url.pathname.includes('/preview'))return route.fulfill({status:404,json:{}});
    if(url.pathname.startsWith('/studio/api/'))return route.fulfill({status:404,json:{}});
    assert.equal(method,'GET');
    return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="sv"><body><div id="root"></div><script>window.__PROPS__=${JSON.stringify({surface:'partner',user:'north-admin',apiBase:'/studio/api/partner/snapshot',initialSnapshot:snapshot,initialView:'rooms',initialRoomId:new URL(path,origin).searchParams.get('room')})}</script><script src="/fixture.js"></script></body></html>`});
  }catch(error){failures.push(error);await route.fulfill({status:500,body:'Isolated fixture failed'});}});
  // Bundle before navigating so a busy machine never turns the build into a navigation timeout.
  await fixtureSource();
  const page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(30000);page.on('pageerror',error=>failures.push(error));await page.goto(origin+path);
  return {page,writes,async close(){await context.close();assert.deepEqual(failures,[]);}};
}
async function withBrowser(run){const {chromium}=await import(pathToFileURL(browserModule).href),browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});try{await run(browser);}finally{await browser.close();}}
// Radix moves roving focus in a timeout after the key press; wait for it instead of sampling at once.
const focusOn=(page,check)=>page.waitForFunction(check);
const focused=page=>page.evaluate(()=>({role:document.activeElement?.getAttribute('role'),label:document.activeElement?.getAttribute('aria-label'),text:document.activeElement?.textContent?.trim(),inDialog:Boolean(document.activeElement?.closest('[role="dialog"]'))}));

test('the table editor works with the keyboard: tabs, card choices, review dialog, actions menu; save → review → publish keep their order',{skip:!browserModule},()=>withBrowser(async browser=>{
  const f=await fixture(browser,'/partner/north/rooms?room=room-vip');const {page}=f;
  try{
    await page.getByRole('heading',{level:1,name:'VIP'}).waitFor();
    const dealers=page.getByRole('radiogroup',{name:'Dealer'});await dealers.waitFor();
    // Tabs (Radix, manual activation): arrows move focus, Enter opens the panel.
    await page.getByRole('tab',{name:'Utseende'}).focus();await page.keyboard.press('ArrowRight');
    await focusOn(page,()=>document.activeElement?.textContent?.trim()==='Historik');await page.keyboard.press('Enter');
    await page.getByRole('heading',{name:'Publicerade versioner'}).waitFor();assert.equal(await dealers.isVisible(),false);
    await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter');await dealers.waitFor();
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
    assert.equal(await review.evaluate(element=>element===document.activeElement),true,'focus returns to the publish button');
    // Actions menu (Radix DropdownMenu): Enter opens, arrows move, Esc closes back to the trigger.
    const more=page.getByRole('button',{name:'Fler åtgärder'});await more.focus();await page.keyboard.press('Enter');
    const menu=page.getByRole('menu');await menu.waitFor();await page.keyboard.press('ArrowDown');
    await focusOn(page,()=>document.activeElement?.getAttribute('role')==='menuitem');
    await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});assert.equal(await more.evaluate(element=>element===document.activeElement),true);
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
    await page.getByRole('heading',{level:1,name:'VIP'}).waitFor();
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
