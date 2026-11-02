import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createDealerRehearsal,mountDealerRehearsal} from '../../../services/game/public/dealer-rehearsal.mjs';
import {dealerVersionPath} from '../../../services/game/public/dealer-version-switcher.mjs';
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
  assert.equal(url.pathname,'/game');assert.equal(url.searchParams.get('game'),'blackjack');assert.equal(url.searchParams.get('dealer'),dealer);
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
test('only valid observer channels survive the dealer switch',()=>{
 const channel='00000000-0000-4000-8000-000000000001';
 const url=new URL(dealerVersionPath('linnea','v2','?labObserverOrigin=http://localhost:4188&labObserverChannel='+channel+'&launch=a.b.c'),'https://game.invalid');
 assert.equal(url.searchParams.get('labObserverChannel'),channel);assert.equal(url.searchParams.has('launch'),false);
});
test('rehearsal dealer changes keep the same published context',()=>{
 const controls={};
 const panel={addEventListener(){},querySelector:id=>controls[id]??=(id.includes('dealer')||id.includes('line')?{add(){},value:'linnea'}:{}),querySelectorAll:()=>Object.values(controls)};
 const document={createElement:tag=>tag==='details'?panel:{}};
 const location={search:'?rehearsal=1&launch=private'};
 mountDealerRehearsal({document,$:()=>({appendChild(){}}),location,entrySelection:{choices:{dealers:['astrid','linnea']}},
  DEALERS:{astrid:{key:'astrid',name:'Astrid'},linnea:{key:'linnea',name:'Linnea'}},DEALER:{key:'astrid'},VOICE_LINES:['goodluck'],LINES:{},
  localPresentationEnabled:true,state:{round:null,busy:false},tableReady:Promise.resolve()});
 controls['#rehearsal-dealer'].value='linnea';controls['#rehearsal-dealer'].onchange();
 const url=new URL(location.href,'https://game.invalid');assert.equal(url.searchParams.get('dealer'),'linnea');assert.equal(url.searchParams.get('table'),'room-north');
});

test('shared rehearsal describes its own playback path without consulting the legacy clip index',async()=>{
  const status={textContent:''};
  const controller=rehearsal({status,bank:{goodluck:{text:'Good luck.'}}});await Promise.resolve();controller.update();
  assert.match(status.textContent,/Good luck.*shared Studio presentation/);
  assert.doesNotMatch(status.textContent,/matching clip missing|voice only/);
});

test('shared rehearsal requires a completed real playback result even when the speech queue swallows errors',async()=>{
  for(const result of [true,false,undefined,'throw']){
    let calls=0;
    const controller=rehearsal({
      async speechTurn(fn){try{await fn(new AbortController().signal);}catch{}},
      async playRecorded(id){assert.equal(id,'goodluck');calls++;if(result==='throw')throw new Error('fixture playback failed');return result;}});
    const run=controller.play();
    if(result===true)assert.equal(await run,true);
    else await assert.rejects(run,/Shared Studio clip did not complete/);
    assert.equal(calls,1);
  }
});

test('shared rehearsal counts two completed clips and never counts a failed second play',async()=>{
  for(const failSecond of [false,true]){
    const controls=[{disabled:false},{disabled:false}],messages=[];let calls=0;
    const status={set textContent(value){messages.push(value);}};
    const controller=rehearsal({panel:{querySelectorAll:()=>controls},status,
      async playRecorded(){calls++;if(failSecond&&calls===2)throw new Error('interrupted');return true;}});
    await Promise.resolve();await controller.review(2);
    assert.equal(calls,2);assert.ok(controls.every(control=>control.disabled===false));
    assert.ok(messages.some(message=>message.startsWith('1/2 completed')));
    if(failSecond){assert.match(messages.at(-1),/Playback failed: interrupted/);assert.ok(messages.every(message=>!message.startsWith('2/2 completed')));}
    else assert.match(messages.at(-1),/^2\/2 completed/);
  }
});

test('rehearsal cannot start before server-owned table initialization and stays disabled on failure',async()=>{
  for(const failed of [false,true]){
    const controls=[{disabled:true},{disabled:true}];let plays=0,finish,fail;
    const tableReady=new Promise((resolve,reject)=>{finish=resolve;fail=reject;});
    const status={textContent:''};
    const controller=rehearsal({tableReady,panel:{querySelectorAll:()=>controls},status,async playRecorded(){plays++;return true;}});
    await controller.review(2);
    assert.equal(plays,0);assert.ok(controls.every(control=>control.disabled));
    if(failed)fail(new Error('table init failed'));else finish();
    await tableReady.catch(()=>{});await Promise.resolve();
    await controller.review(2);
    assert.equal(plays,failed?0:2);
    assert.ok(controls.every(control=>control.disabled===failed));
    if(failed)assert.match(status.textContent,/table could not start/);
  }
});

function rehearsal(overrides={}){
 const controls=[{disabled:true},{disabled:true}];
 return createDealerRehearsal({panel:{querySelectorAll:()=>controls},lineSelect:{value:'goodluck'},status:{textContent:''},
  bank:{},LINES:{},localPresentationEnabled:true,setMuted(){},state:{speaking:false},tableReady:Promise.resolve(),
  speechTurn:fn=>fn(new AbortController().signal),playRecorded:async()=>true,...overrides});
}

test('closing rehearsal prevents late readiness and a completed first clip from starting another review',async()=>{
  for(const duringPlayback of [false,true]){
    let resolveReady,resolvePlay,plays=0;
    const tableReady=new Promise(resolve=>{resolveReady=resolve;}),controls=[{disabled:true}],lineSelect={value:'goodluck'};
    const controller=rehearsal({tableReady,lineSelect,panel:{querySelectorAll:()=>controls},
      playRecorded:()=>{plays++;return new Promise(resolve=>{resolvePlay=resolve;});}});
    if(duringPlayback){resolveReady();await tableReady;}
    const review=controller.review(2);await Promise.resolve();
    await controller.review(2);assert.equal(plays,duringPlayback?1:0,'a second review cannot overlap playback');
    controller.close();resolveReady();resolvePlay?.(true);await review;await tableReady;
    assert.equal(plays,duringPlayback?1:0);assert.equal(controls[0].disabled,true);assert.equal(lineSelect.onchange,null);
  }
});
