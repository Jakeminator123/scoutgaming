import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {dealerVersionPath} from '../services/game/public/dealer-version-switcher.mjs';
const appSource=await readFile(new URL('../services/game/public/app.mjs',import.meta.url),'utf8');
const rehearsalSource=appSource.slice(appSource.indexOf('// Optional rehearsal'));
let oldDocument,oldLocation;
beforeEach(()=>{
 oldDocument=globalThis.document;oldLocation=globalThis.location;
 const registry=['astrid','elin','linnea','nora'].map(id=>({id,label:id}));
 globalThis.document={documentElement:{dataset:{gamePath:'/blackjack',gameLane:'chosen',gameDealer:'astrid',gamePresentation:'local',gameLocalDealer:'astrid',gameRegisteredDealers:JSON.stringify(registry),gameOperator:'north',gameRoomId:'room-north',gameChoices:JSON.stringify({dealers:registry.map(row=>row.id),dealerDefault:'astrid',tableColors:[],tableDefault:null,background:{enabled:false,mode:'baked',allowed:[],default:null}})}}};
 globalThis.location={pathname:'/blackjack',origin:'https://game.invalid'};
});
afterEach(()=>{globalThis.document=oldDocument;globalThis.location=oldLocation;});
test('every registered dealer stays on one player and the saved room',()=>{
 for(const dealer of ['astrid','elin','linnea','nora'])for(const version of ['original','v2']){
  const url=new URL(dealerVersionPath(dealer,version,'?launch=private&operator=foreign&table=foreign&performance=staged&rehearsal=1'),'https://game.invalid');
  assert.equal(url.pathname,'/blackjack');assert.equal(url.searchParams.get('dealer'),dealer);
  assert.equal(url.searchParams.get('lane'),'chosen');assert.equal(url.searchParams.get('table'),'room-north');assert.equal(url.searchParams.get('operator'),'north');
  assert.equal(url.searchParams.get('presentation'),'local');assert.equal(url.searchParams.get('rehearsal'),'1');
  assert.equal(url.searchParams.has('launch'),false);assert.equal(url.searchParams.has('performance'),false);
 }
 for(const id of ['vera','mei','amira','johanna','unknown'])assert.throws(()=>dealerVersionPath(id,'original'));
});
test('retired identities cannot become switcher choices through forged registration',()=>{
 for(const id of ['vera','mei','amira','johanna']){
  globalThis.document.documentElement.dataset.gameRegisteredDealers=JSON.stringify([{id,label:id}]);
  assert.throws(()=>dealerVersionPath(id,'original'),/Invalid dealer registry/);
 }
});
test('missing registration and a registered dealer outside this room cannot become fallback choices',()=>{
 globalThis.document.documentElement.dataset.gameChoices=JSON.stringify({dealers:['astrid'],dealerDefault:'astrid',tableColors:[],tableDefault:null,background:{enabled:false,mode:'baked',allowed:[],default:null}});
 assert.throws(()=>dealerVersionPath('linnea','original'),/available/);
 globalThis.document.documentElement.dataset.gameRegisteredDealers='[]';assert.throws(()=>dealerVersionPath('astrid','original'),/registered/);
});
test('only valid observer channels survive; no version controls or local engine are installed',()=>{
 const channel='00000000-0000-4000-8000-000000000001';
 const url=new URL(dealerVersionPath('linnea','v2','?labObserverOrigin=http://localhost:4188&labObserverChannel='+channel+'&launch=a.b.c'),'https://game.invalid');
 assert.equal(url.searchParams.get('labObserverChannel'),channel);assert.equal(url.searchParams.has('launch'),false);
 assert.doesNotMatch(appSource,/installDealerVersionSwitcher|V2_DEALERS|new DealerEngine|audio\/en\/bank\.json/);
});
test('rehearsal dealer changes keep the same published context',()=>{
 const handler=rehearsalSource.match(/dealerSelect\.onchange = \(\) => \{[^\n]+\};/)?.[0];assert.ok(handler);
 const location={search:'?rehearsal=1&launch=private'},dealerSelect={value:'linnea'};
 vm.runInNewContext(handler+';dealerSelect.onchange();',{location,dealerSelect,dealerVersionPath});
 const url=new URL(location.href,'https://game.invalid');assert.equal(url.searchParams.get('dealer'),'linnea');assert.equal(url.searchParams.get('table'),'room-north');
});
test('rehearsal never reads a local speech bank',async()=>{
 const statement=rehearsalSource.match(/const bank = [^\n]+;/)?.[0];assert.ok(statement);
 const bank=await vm.runInNewContext('(async()=>{'+statement+'return bank;})()',{fetch:()=>assert.fail('No local bank'),DEALER:{key:'astrid'}});
 assert.deepEqual(Object.keys(bank),[]);
});

test('shared rehearsal describes its own playback path without consulting the legacy clip index',()=>{
  const update=rehearsalSource.match(/const update = \(\) => \{[\s\S]*?\n  \};/)?.[0];
  assert.ok(update);
  const status={textContent:''};
  vm.runInNewContext(`${update}; update();`,{rehearsalInitialized:true,localPresentationEnabled:true,lineSelect:{value:'goodluck'},bank:{goodluck:{text:'Good luck.'}},LINES:{},status});
  assert.match(status.textContent,/Good luck.*shared Studio presentation/);
  assert.doesNotMatch(status.textContent,/matching clip missing|voice only/);
});

test('shared rehearsal requires a completed real playback result even when the speech queue swallows errors',async()=>{
  const play=rehearsalSource.match(/const play = async \(\) => \{[\s\S]*?\n  \};/)?.[0];
  assert.ok(play);
  for(const result of [true,false,undefined,'throw']){
    let calls=0;
    const run=vm.runInNewContext(`${play}; play();`,{localPresentationEnabled:true,lineSelect:{value:'goodluck'},setMuted(){},astridSpeak:null,DEALER:{base:'dealers/astrid'},Audio:class{},bank:{},LINES:{},
      async speechTurn(fn){try{await fn(new AbortController().signal);}catch{}},
      async playRecorded(id){assert.equal(id,'goodluck');calls++;if(result==='throw')throw new Error('fixture playback failed');return result;}});
    if(result===true)assert.equal(await run,true);
    else await assert.rejects(run,/Shared Studio clip did not complete/);
    assert.equal(calls,1);
  }
});

test('shared rehearsal counts two completed clips and never counts a failed second play',async()=>{
  const review=rehearsalSource.match(/const review = async count => \{[\s\S]*?\n  \};/)?.[0];
  assert.ok(review);
  for(const failSecond of [false,true]){
    const controls=[{disabled:false},{disabled:false}],messages=[];let calls=0;
    const status={set textContent(value){messages.push(value);}};
    await vm.runInNewContext(`${review}; review(2);`,{rehearsalInitialized:true,localPresentationEnabled:true,lineSelect:{value:'goodluck'},panel:{querySelectorAll:()=>controls},status,speaking:false,update(){},
      async play(){calls++;if(failSecond&&calls===2)throw new Error('interrupted');return true;}});
    assert.equal(calls,2);assert.ok(controls.every(control=>control.disabled===false));
    assert.ok(messages.some(message=>message.startsWith('1/2 completed')));
    if(failSecond){assert.match(messages.at(-1),/Playback failed: interrupted/);assert.ok(messages.every(message=>!message.startsWith('2/2 completed')));}
    else assert.match(messages.at(-1),/^2\/2 completed/);
  }
});

test('rehearsal cannot start before server-owned table initialization and stays disabled on failure',async()=>{
  const review=rehearsalSource.match(/const review = async count => \{[\s\S]*?\n  \};/)?.[0];
  const settle=rehearsalSource.match(/settleRehearsalInitialization = failed => \{[\s\S]*?\n  \};/)?.[0];
  const bind=appSource.match(/tableReady\.then\(\(\) => settleRehearsalInitialization\?\.\(false\), \(\) => settleRehearsalInitialization\?\.\(true\)\);/)?.[0];
  assert.ok(review&&settle&&bind);
  for(const failed of [false,true]){
    const controls=[{disabled:true},{disabled:true}];let plays=0,finish,fail;
    const tableReady=new Promise((resolve,reject)=>{finish=resolve;fail=reject;});
    const context=vm.createContext({rehearsalInitialized:false,settleRehearsalInitialization:null,initialControls:controls,tableReady,
      localPresentationEnabled:true,lineSelect:{value:'goodluck'},panel:{querySelectorAll:()=>controls},status:{textContent:''},speaking:false,
      update(){},async play(){plays++;return true;}});
    vm.runInContext(`${review}; ${settle}; ${bind};`,context);
    await vm.runInContext('review(2)',context);
    assert.equal(plays,0);assert.ok(controls.every(control=>control.disabled));
    if(failed)fail(new Error('table init failed'));else finish();
    await tableReady.catch(()=>{});await Promise.resolve();
    await vm.runInContext('review(2)',context);
    assert.equal(plays,failed?0:2);
    assert.ok(controls.every(control=>control.disabled===failed));
    if(failed)assert.match(context.status.textContent,/table could not start/);
  }
});
