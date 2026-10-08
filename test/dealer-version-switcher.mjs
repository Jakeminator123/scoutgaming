import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {dealerVersionPath, installDealerVersionSwitcher} from '../web/public/dealer-version-switcher.mjs';
test('comparison routes keep original and V2 presentations separate',()=>{
  for(const key of ['astrid','amira']){
    assert.equal(dealerVersionPath(key,'v2'),`/v2/?dealer=${key}`);
    assert.equal(dealerVersionPath(key,'original'),`/?dealer=${key}`);
  }
});
test('dealers without V2 stay on their original presentation',()=>{
  for(const key of ['vera','mei'])assert.equal(dealerVersionPath(key,'v2'),`/?dealer=${key}`);
  assert.equal(dealerVersionPath('unknown','v2'),'/?dealer=vera');
  for(const key of ['dragge','paow'])assert.equal(dealerVersionPath(key,'original'),`/?dealer=${key}&lane=mobile-phone-${key}&presentation=local`);
});
test('version switching keeps only the explicit observation channel, never launch credentials',()=>{
  const search='?launch=private&labObserverOrigin=http%3A%2F%2F127.0.0.1%3A4188&labObserverChannel=channel-1234567890';
  const path=dealerVersionPath('astrid','v2',search),url=new URL(path,'http://localhost');
  assert.equal(url.pathname,'/v2/');
  assert.equal(url.searchParams.get('labObserverOrigin'),'http://127.0.0.1:4188');
  assert.equal(url.searchParams.get('labObserverChannel'),'channel-1234567890');
  assert.equal(url.searchParams.has('launch'),false);
});

test('shared presentation survives a dealer round trip and rehearsal without copying launch or review flags',()=>{
  const initial='?dealer=astrid&presentation=local&rehearsal=1&table=high&launch=private&scene=rigged-review&performance=staged';
  for(const dealer of ['vera','amira','mei']){
    const away=new URL(dealerVersionPath(dealer,'original',initial),'http://localhost');
    assert.equal(away.pathname,'/');
    assert.deepEqual([...away.searchParams.keys()],['dealer','presentation','rehearsal']);
    assert.equal(away.searchParams.get('presentation'),'local');
    assert.equal(dealerVersionPath('astrid','original',away.search),'/?dealer=astrid&presentation=local&rehearsal=1');
  }
  assert.equal(dealerVersionPath('astrid','v2',initial),'/v2/?dealer=astrid&rehearsal=1');
  assert.equal(dealerVersionPath('astrid','original','?presentation=unknown'),'/?dealer=astrid');
});

test('shared presentation keeps the normal dealer picker without adding V2 controls',t=>{
  for(const [name,value] of Object.entries({location:{search:'?dealer=astrid&presentation=local'},document:{querySelector(){assert.fail('shared presentation must not replace normal dealer handlers');}}})){
    const previous=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{value,configurable:true});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,name,previous);else delete globalThis[name];});
  }
  installDealerVersionSwitcher({dealer:'astrid',version:'original',isBusy:()=>false});
});

const appSource=await readFile(new URL('../web/public/app.mjs',import.meta.url),'utf8');
test('clean Mobile Phone Lane keeps local presentation when changing dealers and never pins them to Astrid',t=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{value:{documentElement:{dataset:{gamePath:'/blackjack',gamePresentation:'local'}},
    querySelector(){assert.fail('Mobile Phone Lane must keep normal dealer handlers');}},configurable:true});
  const oldLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
  Object.defineProperty(globalThis,'location',{value:{search:''},configurable:true});
  t.after(()=>{for(const [key,value] of [['document',previous],['location',oldLocation]]){
    if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];
  }});
  installDealerVersionSwitcher({dealer:'astrid',version:'original',isBusy:()=>false});
  for(const search of ['', '?lane=mobile-phone']){
    const away=new URL(dealerVersionPath('mei','original',search),'https://game.invalid');
    assert.equal(away.pathname,'/blackjack');assert.equal(away.searchParams.get('dealer'),'mei');
    assert.equal(away.searchParams.get('presentation'),'local');assert.equal(away.searchParams.has('lane'),false);
    const back=new URL(dealerVersionPath('astrid','original',away.search),'https://game.invalid');
    assert.equal(back.searchParams.get('presentation'),'local');assert.equal(back.searchParams.get('dealer'),'astrid');
  }
});
const rehearsalSource=appSource.slice(appSource.indexOf('// Optional rehearsal'));
test('the rehearsal selector preserves shared presentation and explicit V2 review routes',()=>{
  const handler=rehearsalSource.match(/dealerSelect\.onchange = \(\) => \{[^\n]+\};/)?.[0];
  assert.ok(handler);
  for(const dealerV2Route of [false,true]){
    const location={search:'?dealer=astrid&presentation=local&rehearsal=1&launch=private'},dealerSelect={value:'amira'};
    vm.runInNewContext(`${handler}; dealerSelect.onchange();`,{location,dealerSelect,dealerV2Route,dealerVersionPath});
    assert.equal(location.href,dealerV2Route?'/v2/?dealer=amira&rehearsal=1':'/?dealer=amira&presentation=local&rehearsal=1');
  }
});

test('changing the table tier carries shared presentation and the requested table, without launch credentials',()=>{
  const setTable=appSource.match(/function setTable\(id\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(setTable);
  const location={search:'?dealer=astrid&presentation=local&rehearsal=1&launch=private'};
  vm.runInNewContext(`${setTable}; setTable('other-tier');`,{location,URLSearchParams,dealerVersionPath,TABLES:[{id:'other-tier',dealer:'amira'}],table:{id:'current'},round:null,busy:false,DEALER:{key:'astrid'}});
  assert.deepEqual([...new URLSearchParams(location.search)],[['dealer','amira'],['presentation','local'],['rehearsal','1'],['table','other-tier']]);
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
