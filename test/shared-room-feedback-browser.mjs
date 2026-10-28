// Real browser DOM + main's real view/controller. Only snapshots, command
// transport and media are synthetic; no accounts, database, GPU or cloud writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const browserModule = process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const html = `<!doctype html><html lang="sv"><meta charset="utf-8"><title>Isolated shared-room feedback</title>
<style>[hidden]{display:none!important}#scene{position:relative;min-height:600px}button{min-height:44px}#actions-top,#actions{margin-top:120px}</style>
<body><input id="writing"><textarea id="text"></textarea><select id="choice"><option>H</option><option>S</option></select>
<div id="editable" contenteditable="true">Text</div><dialog id="modal"><button>Stäng</button></dialog>
<div id="scene"><div id="seats"></div><div id="chips"></div><span id="balance"></span><span id="total-bet"></span>
<span id="last-win"></span><p id="banner"></p><span id="limits"></span><button id="deal-now">Redo</button>
<div id="insurance"><button id="ins-yes">Ja</button><button id="ins-no">Nej</button></div>
${['actions-top','actions'].map(id => `<div id="${id}">${['hit','stand','double','split'].map(action => `<button data-act="${action}">${action}</button>`).join('')}</div>`).join('')}
</div><script type="module">
import {createSharedRoomView} from '/shared-room-view.mjs';
import {createSharedRoomController} from '/shared-room-controller.mjs';
const first=document.querySelector('#actions-top [data-act=hit]');first.setAttribute('title','Original hint');first.setAttribute('aria-keyshortcuts','X');
let version=0, snapshot, finishFilm, playing;
const calls=[], connection=new AbortController(), view=createSharedRoomView({document});
const commands={state:'idle',async send(intent){calls.push(structuredClone(intent));return {status:'ok',result:{op:intent.op,version:version+1}};},stop(){this.state='stopped';}};
const controller=createSharedRoomController({roomId:'feedback-room',commands,view,presentation:{restoreSnapshot(){},present(){return new Promise(resolve=>{finishFilm=resolve;});},close(){finishFilm?.();}}});
function current(extra={}) {
 const now=Date.now();return {contract:'blackjack-table/1',roomId:'feedback-room',version:++version,presentationVer:1,
 configVersion:'config-1',windowId:'window-1',phase:'round',roundId:'round-1',turnSeq:7,
 owners:['alice',null,null,null,null,null,null],seatGen:[1,0,0,0,0,0,0],bets:Array.from({length:7},()=>({main:0,pp:0,tp:0})),
 players:[{id:'alice',ready:false,leaving:false}],deadline:null,actionDeadline:now+60000,plan:{turnAt:now-1,endAt:now-1},serverNow:now,
 round:{phase:'decisions',active:0,hands:[{box:0,cards:[]}],dealer:[],legalActions:['hit','stand','double','split']},
 settings:{configVersion:'config-1',language:'sv',limits:{min:1,max:100,sideMax:10},chips:[1,5],refill:1000},
 me:{id:'alice',seats:[0],memberGen:1,available:1010,pausedUntil:0,insuranceDue:false,lastSettlement:{roundId:'round-1',returned:20}},...extra};
}
async function restore(extra={}) {snapshot=current(extra);await controller.restoreSnapshot(snapshot,{signal:connection.signal});}
window.fixture={calls,controller,view,commands,restore,
 async settle(delay=0){await restore({phase:'settled',round:null,actionDeadline:null,plan:{endAt:Date.now()+delay}});},
 startFilm(){playing=controller.present({});},async finishFilm(){finishFilm();await playing;},
 disconnect(){connection.abort();},get snapshot(){return snapshot;},
 read(){return {lastWin:document.getElementById('last-win').textContent,banner:document.getElementById('banner').textContent,
 balance:document.getElementById('balance').textContent,nextHidden:[...document.querySelectorAll('#shared-room-controls button')].find(n=>n.textContent==='Nästa runda').hidden};}};
await restore();window.fixture.ready=true;
</script></body></html>`;

test('shared-room feedback: keyboard authority and result timing in Chrome', {
  skip: !browserModule && 'Browser acceptance NOT RUN: set CROUPIER_BROWSER_FIXTURE_MODULE to installed Playwright.', timeout:60000,
}, async t => {
  let browser;
  const errors=[];
  t.after(async () => {await browser?.close();});
  // Inline the exact product modules into data URLs: no listening port, network
  // or external origin is needed for this DOM/controller acceptance test.
  const source=async name=>readFile(new URL(`../services/game/public/${name}`,import.meta.url),'utf8');
  const moduleUrl=text=>`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
  let viewSource=await source('shared-room-view.mjs');
  for(const name of ['shared-room-shortcuts.mjs','shared-room-results.mjs'])
    viewSource=viewSource.replace(`'./${name}'`,JSON.stringify(moduleUrl(await source(name))));
  const documentHtml=html.replace("'/shared-room-view.mjs'",JSON.stringify(moduleUrl(viewSource)))
    .replace("'/shared-room-controller.mjs'",JSON.stringify(moduleUrl(await source('shared-room-controller.mjs'))));
  const {chromium}=await import(browserModule);
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  const fresh=async()=>{await page.goto('about:blank');await page.setContent(documentHtml);await page.waitForFunction(()=>window.fixture?.ready);};
  const hit='#actions-top [data-act="hit"]';
  const count=()=>page.evaluate(()=>fixture.calls.length);

  await t.test('H/S/D/P uses one existing command with server round and turn ids',async()=>{
    for(const [key,action] of [['h','hit'],['s','stand'],['d','double'],['p','split']]){
      await fresh();await page.focus(hit);await page.keyboard.press(key);
      assert.deepEqual(await page.evaluate(()=>fixture.calls),[{op:'act',roundId:'round-1',turnSeq:7,box:0,handIndex:0,action}]);
      await page.keyboard.press('h');assert.equal(await count(),1,'a pending command blocks another decision');
    }
  });
  await t.test('ordinary focus, editing, modifiers, IME, repeats and prevented keys cannot act',async()=>{
    await fresh();await page.keyboard.press('h');assert.equal(await count(),0);
    for(const selector of ['#writing','#text','#choice','#editable']){await page.focus(selector);await page.keyboard.press('h');assert.equal(await count(),0,selector);}
    await page.focus(hit);
    for(const properties of [{repeat:true},{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{prevented:true}]){
      const prevented=await page.evaluate(({selector,properties})=>{
        const e=new KeyboardEvent('keydown',{key:'h',bubbles:true,cancelable:true,...properties});
        if(properties.prevented)e.preventDefault();document.querySelector(selector).dispatchEvent(e);return e.defaultPrevented;
      },{selector:hit,properties});
      assert.equal(prevented,Boolean(properties.prevented));assert.equal(await count(),0);
    }
  });
  await t.test('only the focused visible panel can act, including after the legacy panel is retired',async()=>{
    await fresh();await page.evaluate(()=>{const old=document.getElementById('actions');old.hidden=true;old.inert=true;old.style.display='none';});
    await page.focus(hit);await page.keyboard.press('s');assert.equal(await count(),1);
    assert.equal(await page.evaluate(()=>fixture.calls[0].action),'stand');
    await fresh();await page.focus(hit);
    for(const state of ['hidden','inert','aria-disabled','display','visibility']){
      await page.evaluate(state=>{const p=document.getElementById('actions-top');if(state==='hidden'||state==='inert')p[state]=true;
        else if(state==='aria-disabled')p.setAttribute(state,'true');else p.style[state]=state==='display'?'none':'hidden';},state);
      await page.evaluate(()=>document.querySelector('#actions-top [data-act=hit]').dispatchEvent(new KeyboardEvent('keydown',{key:'s',bubbles:true,cancelable:true})));
      assert.equal(await count(),0,state);
      await fresh();await page.focus(hit);
    }
  });
  await t.test('open modal and unavailable target never consume the shortcut',async()=>{
    await fresh();await page.focus(hit);
    await page.evaluate(()=>document.getElementById('modal').setAttribute('open',''));
    await page.keyboard.press('s');assert.equal(await count(),0);
    await fresh();await page.evaluate(()=>fixture.restore({round:{phase:'decisions',active:0,hands:[{box:0}],legalActions:['hit','stand']}}));
    await page.focus(hit);const consumed=await page.evaluate(()=>{const e=new KeyboardEvent('keydown',{key:'p',bubbles:true,cancelable:true});document.activeElement.dispatchEvent(e);return e.defaultPrevented;});
    assert.equal(consumed,false);assert.equal(await count(),0);
  });
  await t.test('DOM manipulation cannot bypass controller legality, disconnect, pause or server deadlines',async()=>{
    for(const mode of ['illegal','disconnected','paused','early','expired']){
      await fresh();await page.evaluate(async mode=>{
        const s=fixture.snapshot;
        if(mode==='illegal')await fixture.restore({round:{...s.round,legalActions:['stand']}});
        if(mode==='paused')await fixture.restore({me:{...s.me,pausedUntil:Date.now()+60000}});
        if(mode==='early')await fixture.restore({plan:{turnAt:Date.now()+60000,endAt:Date.now()+60000}});
        if(mode==='expired')await fixture.restore({actionDeadline:Date.now()-1});
        if(mode==='disconnected')fixture.disconnect();
        document.getElementById('actions-top').hidden=false;
        for(const node of document.querySelectorAll('#actions-top [data-act]'))node.disabled=false;
      },mode);
      await page.focus(hit);await page.keyboard.press('h');assert.equal(await count(),0,mode);
    }
  });
  await t.test('decisions at turnAt stay available during presentation; busy is not a blanket keyboard gate',async()=>{
    await fresh();await page.evaluate(()=>fixture.startFilm());await page.focus(hit);await page.keyboard.press('h');
    assert.equal(await count(),1);await page.evaluate(()=>fixture.finishFilm());
  });
  await t.test('view close removes listeners and restores existing accessibility hints',async()=>{
    await fresh();assert.equal(await page.getAttribute(hit,'aria-keyshortcuts'),'H');
    await page.evaluate(()=>fixture.view.close());await page.focus(hit);
    assert.equal(await page.getAttribute(hit,'aria-keyshortcuts'),'X');assert.equal(await page.getAttribute(hit,'title'),'Original hint');
    assert.equal(await page.getAttribute('#actions-top [data-act=stand]','aria-keyshortcuts'),null);
    const consumed=await page.evaluate(()=>{const e=new KeyboardEvent('keydown',{key:'h',bubbles:true,cancelable:true});document.activeElement.dispatchEvent(e);return e.defaultPrevented;});
    assert.equal(consumed,false);assert.equal(await count(),0);
  });
  await t.test('result and Next round wait for server end AND film, at mobile and desktop widths',async()=>{
    for(const width of [320,390,1440]){
      await page.setViewportSize({width,height:900});await fresh();
      await page.evaluate(async()=>{await fixture.settle(100);fixture.startFilm();});
      await page.waitForTimeout(150);
      let state=await page.evaluate(()=>fixture.read());
      assert.equal(state.lastWin,'–');assert.equal(state.banner,'Rundan pågår');assert.equal(state.nextHidden,true);
      assert.match(state.balance,/1\s?010 demo/,'server wallet is never shadowed');
      await page.evaluate(()=>fixture.finishFilm());state=await page.evaluate(()=>fixture.read());
      assert.equal(state.lastWin,'20');assert.equal(state.banner,'Rundan är avslutad');assert.equal(state.nextHidden,false);
      await page.getByRole('button',{name:'Nästa runda',exact:true}).click();
      assert.equal((await page.evaluate(()=>fixture.read())).lastWin,'20','sending next does not hide completed winnings');
    }
  });
  await t.test('late reconnect reveals completed result without replay; a new window keeps last winnings',async()=>{
    await fresh();await page.evaluate(()=>fixture.settle(-1000));
    assert.equal((await page.evaluate(()=>fixture.read())).lastWin,'20');
    await page.evaluate(()=>fixture.restore({phase:'bets',plan:null,round:null,actionDeadline:null,roundId:null}));
    assert.equal((await page.evaluate(()=>fixture.read())).lastWin,'20');
  });
  assert.deepEqual(errors,[]);
});
