import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {studioHistoryBootstrap} from '../lib/studio-history.mjs';

// The Admin kit in a real browser: the ⋯ menu (Radix), the dialog (native <dialog>) and the search
// palette keep their roles, focus, Esc and arrow keys. Isolated fixture; no product service is contacted.
const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const origin='https://admin-kit.fixture.invalid',admin=fileURLToPath(new URL('../client/admin/',import.meta.url));
const catalog={schemaVersion:1,source:'registered',administration:{dealers:[{id:'nora',name:'Nora',archived:false}],operators:[{id:'johns-bet',name:'Johns Bet',archivedAt:null}],rooms:[{id:'room-1',name:'Privé',operatorId:'johns-bet',state:'live'}]}};
let source;
const fixtureSource=()=>source??=build({stdin:{contents:`
import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {ActionMenu} from './components/ui/menu';import {Dialog,ConfirmDialog} from './components/ui/dialog';
import {CommandPalette} from './components/ui/command';import {Button} from './components/ui/kit';
window.__selected=[];window.__closed=0;
function App(){
  const [open,setOpen]=useState(false),[confirm,setConfirm]=useState(false);
  return <div className="preview-admin">
    <ActionMenu name="Nora" actions={[{id:'open',label:'Öppna dealern',onSelect:()=>window.__selected.push('open')},{id:'locked',label:'Godkänn',disabled:'Sparas inte ännu',onSelect:()=>window.__selected.push('locked')},{id:'archive',label:'Arkivera',tone:'danger',onSelect:()=>window.__selected.push('archive')}]}/>
    <Button id="open-dialog" onClick={()=>setOpen(true)}>Ny dealer</Button><Button id="open-confirm" onClick={()=>setConfirm(true)}>Arkivera</Button>
    <Dialog open={open} title="Ny dealer" onClose={()=>{window.__closed++;setOpen(false);}} footer={<Button onClick={()=>setOpen(false)}>Avbryt</Button>}><label>Namn<input id="name"/></label></Dialog>
    <ConfirmDialog open={confirm} title="Arkivera Nora?" confirmLabel="Flytta till papperskorgen" onConfirm={()=>{}} onCancel={()=>setConfirm(false)}/>
    <input aria-label="Utkast" defaultValue="Sparat"/><CommandPalette/>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:admin,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',
  define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'""','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"'},
  alias:{react:fileURLToPath(new URL('../client/node_modules/react',import.meta.url)),'react-dom':fileURLToPath(new URL('../client/node_modules/react-dom',import.meta.url))}}).then(result=>result.outputFiles[0].text);
async function withPage(run){
  await fixtureSource();
  const {chromium}=await import(pathToFileURL(browserModule).href);
  const browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});
  try{
    const context=await browser.newContext(),failures=[],writes=[],state={catalog:structuredClone(catalog),reads:0,status:200,beforeRead:null};
    await context.addInitScript(studioHistoryBootstrap);
    await context.route('**/*',async route=>{const url=new URL(route.request().url());
      if(url.origin!==origin){failures.push(Error('left the fixture: '+url.href));return route.abort();}
      if(route.request().method()!=='GET')writes.push(url.pathname);
      if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:await fixtureSource()});
      if(url.pathname==='/admin/_data/catalog'){state.reads++;const json=structuredClone(state.catalog),status=state.status;await state.beforeRead?.();return route.fulfill({status,json});}
      return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/fixture.js"></script>'});});
    const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>failures.push(error));
    await page.goto(origin+'/admin/dealers');await page.getByRole('button',{name:'Åtgärder för Nora'}).waitFor();
    try{await run(page,state);}finally{await context.close();assert.deepEqual(failures,[]);assert.deepEqual(writes,[],'the kit itself never writes');}
  }finally{await browser.close();}
}
const focused=page=>page.evaluate(()=>({tag:document.activeElement?.tagName,id:document.activeElement?.id,role:document.activeElement?.getAttribute('role'),text:document.activeElement?.textContent?.trim()}));
// Radix moves menu focus in its own handlers; wait for the expected item instead of reading focus at once.
const focusedText=async(page,text)=>{try{await page.waitForFunction(value=>document.activeElement?.textContent?.trim()===value,text,{timeout:3000});}catch{}return (await focused(page)).text;};

test('the ⋯ menu opens from the keyboard, moves with the arrow keys, skips a disabled entry and closes on Esc',{skip:!browserModule},()=>withPage(async page=>{
  const trigger=page.getByRole('button',{name:'Åtgärder för Nora'});
  assert.equal(await trigger.getAttribute('aria-haspopup'),'menu');
  await trigger.focus();await page.keyboard.press('Enter');
  const menu=page.getByRole('menu');await menu.waitFor();
  assert.equal(await page.getByRole('menuitem').count(),3);
  assert.equal(await page.getByRole('menuitem',{name:/Godkänn/}).getAttribute('aria-disabled'),'true');
  assert.equal(await focusedText(page,'Öppna dealern'),'Öppna dealern');
  await page.keyboard.press('ArrowDown');assert.equal(await focusedText(page,'Arkivera'),'Arkivera','the disabled entry is skipped');
  await page.keyboard.press('ArrowUp');assert.equal(await focusedText(page,'Öppna dealern'),'Öppna dealern');
  await page.keyboard.press('Escape');await menu.waitFor({state:'detached'});
  await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Åtgärder för Nora');
  await trigger.click();await page.getByRole('menuitem',{name:'Arkivera'}).click();
  assert.deepEqual(await page.evaluate(()=>window.__selected),['archive']);
}));

test('a dialog is modal: it opens on its first field, keeps focus inside, closes on Esc and returns focus',{skip:!browserModule},()=>withPage(async page=>{
  const opener=page.locator('#open-dialog');await opener.click();
  const dialog=page.getByRole('dialog',{name:'Ny dealer'});await dialog.waitFor();
  assert.equal((await focused(page)).id,'name','the dialog opens on its first field, not on the close button');
  // The page behind a modal dialog is inert: Tab moves between the dialog's own controls and never reaches the page.
  for(let index=0;index<6;index++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>{const node=document.activeElement;return Boolean(node&&node!==document.body&&!node.closest('dialog'));}),false,'focus never reaches the page behind');}
  await page.locator('#name').focus();
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>window.__closed),1);await page.waitForFunction(()=>document.activeElement?.id==='open-dialog');
  await page.locator('#open-confirm').click();const confirm=page.getByRole('dialog',{name:'Arkivera Nora?'});await confirm.waitFor();
  assert.equal((await focused(page)).text,'Avbryt','a destructive confirmation starts on the safe choice');
  await page.keyboard.press('Escape');await confirm.waitFor({state:'hidden'});
}));

test('Ctrl+K opens the search palette; typing filters, arrows choose and Enter jumps there',{skip:!browserModule},()=>withPage(async page=>{
  await page.keyboard.press('Control+k');
  const box=page.getByRole('combobox',{name:'Sök dealers, bolag, spelbord, miljöer och sidor'});await box.waitFor();
  assert.equal(await box.evaluate(node=>node===document.activeElement),true);
  await page.getByRole('option',{name:/Nora/}).waitFor();
  await box.fill('priv');
  assert.equal(await page.getByRole('option').count(),1);assert.equal(await page.getByRole('option').getAttribute('aria-selected'),'true');
  await box.fill('');await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('[role=option][aria-selected=true]').count(),1);
  await box.fill('nora');await page.keyboard.press('Enter');
  await page.waitForURL(origin+'/admin/dealers/nora?flik=klipp');
  assert.equal(await page.getByRole('combobox').count(),0,'the palette closes after the jump');
  await page.keyboard.press('Control+k');await box.waitFor();
  // En sen close-händelse från förra stängningen (webbläsaren skickar den vid nästa bildruta) får inte stänga den återöppnade paletten.
  await page.evaluate(()=>document.querySelector('dialog[aria-label="Sök i Admin"]').dispatchEvent(new Event('close')));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await box.count(),1,'en sen close-händelse lämnar den återöppnade paletten öppen');
  await page.keyboard.press('Escape');await box.waitFor({state:'detached'});
}));


test('reopening search refreshes renamed/deleted entries and routes companies and environments to their editors',{skip:!browserModule},()=>withPage(async(page,state)=>{
  await page.keyboard.press('Control+k');await page.getByRole('option',{name:/Nora/}).waitFor();await page.keyboard.press('Escape');
  state.catalog.administration.dealers=[{id:'archived',name:'Arkiverad dealer',archived:true}];
  state.catalog.administration.rooms=[{id:'archived-room',name:'Arkiverat bord',state:'archived'}];
  state.catalog.administration.operators.push({id:'archived-company',name:'Arkiverat bolag',archivedAt:'2026-01-01'});
  state.catalog.administration.compositions=[{id:'scene-a',name:'Miljö med samma namn'},{id:'scene-b',name:'Miljö med samma namn'}];
  await page.keyboard.press('Control+k');await page.getByRole('group',{name:'Bolag',exact:true}).getByRole('option',{name:/Johns Bet/}).waitFor();
  assert.equal(state.reads,2);assert.equal(await page.getByRole('option',{name:/Nora|Privé|Arkivera/}).count(),0);
  await page.getByRole('group',{name:'Bolag',exact:true}).getByRole('option',{name:/Johns Bet/}).click();await page.waitForURL(origin+'/admin/companies/johns-bet?flik=spelbord');
  await page.keyboard.press('Control+k');await page.getByRole('option',{name:/Miljö med samma namn/}).nth(1).click();
  await page.waitForURL(origin+'/admin/scenes?tab=miljoer&composition=scene-b');
  await page.reload();await page.keyboard.press('Control+k');await page.getByRole('option',{name:/Miljö med samma namn/}).nth(1).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('composition'),'scene-b','the exact environment survives document reload');
}));

test('closed search aborts old catalog reads and failed refresh never offers stale objects',{skip:!browserModule},()=>withPage(async(page,state)=>{
  let release,readStarted;const started=new Promise(resolve=>{readStarted=resolve;});
  state.beforeRead=()=>{state.beforeRead=null;readStarted();return new Promise(resolve=>{release=resolve;});};
  await page.keyboard.press('Control+k');await page.getByRole('status').waitFor();
  await started;
  assert.equal(state.reads,1);await page.keyboard.press('Escape');
  state.catalog.administration.dealers=[{id:'new',name:'Aktuell dealer',archived:false}];
  await page.keyboard.press('Control+k');await page.getByRole('option',{name:/Aktuell dealer/}).waitFor();release();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.getByRole('option',{name:/Nora/}).count(),0,'a late response cannot overwrite the next opening');
  await page.keyboard.press('Escape');state.status=503;
  await page.keyboard.press('Control+k');await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('option',{name:/Aktuell dealer|Johns Bet|Privé/}).count(),0);
  await page.getByRole('option',{name:/Hjälp/}).click();await page.waitForURL(origin+'/admin/guide');
}));

test('search navigation honors the draft guard and leaves both query and draft available after cancellation',{skip:!browserModule},()=>withPage(async page=>{
  await page.getByRole('textbox',{name:'Utkast'}).fill('Osparat materialval');
  await page.evaluate(()=>{window.__guard=event=>event.preventDefault();window.addEventListener('scout:navigate',window.__guard);});
  await page.keyboard.press('Control+k');await page.getByRole('group',{name:'Bolag',exact:true}).getByRole('option',{name:/Johns Bet/}).click();
  assert.equal(new URL(page.url()).pathname,'/admin/dealers');assert.equal(await page.getByRole('dialog',{name:'Sök i Admin'}).isVisible(),true);
  assert.equal(await page.getByRole('textbox',{name:'Utkast',includeHidden:true}).inputValue(),'Osparat materialval');
  await page.evaluate(()=>window.removeEventListener('scout:navigate',window.__guard));
  await page.getByRole('group',{name:'Bolag',exact:true}).getByRole('option',{name:/Johns Bet/}).click();await page.waitForURL(origin+'/admin/companies/johns-bet?flik=spelbord');
}));
