import test from 'node:test';
import assert from 'node:assert/strict';
import {decorateGameEntryHtml} from '../services/game/public/game-entry-contract.mjs';
import {publicGamePath, approvedGameQuery, gameEntryRedirect, canonicalGameDestination, requestedGame, gameStartPath, legacyGameStartRedirect, rouletteRoomSearch, rouletteDocumentPath} from '../packages/navigation/game-entry.mjs';
import {dealerVersionPath} from '../services/game/public/dealer-version-switcher.mjs';
const origin = 'https://game.example.invalid';
test('canonical game address is /game and aliases preserve only unambiguous public selectors',() => {
  // The canonical entry is fixed (Neon is the registry): no variable selects another path.
  assert.equal(publicGamePath(),'/game');
  const url = new URL('/game?dealer=linnea&presentation=local&performance=staged&motion=smooth60&rehearsal=1&table=bj-1&returnTo=https://evil.invalid&playerId=forged#secret',origin);
  assert.equal(gameEntryRedirect(url),null,'the game start with context is served, not redirected');
  assert.equal(canonicalGameDestination(url),'/game?dealer=linnea&presentation=local&rehearsal=1&table=bj-1');
  assert.equal(canonicalGameDestination(new URL('/game?dealer=astrid&dealer=elin&presentation=evil&rehearsal=true&launch=a.b.c&launch=x.y.z',origin)),'/game');
  assert.equal(canonicalGameDestination(new URL('/play/roulette?game=roulette&operator=alpha&table=r-1&game=roulette',origin)),'/game?table=r-1&operator=alpha','a repeated game selector is ambiguous');
  assert.equal(canonicalGameDestination(new URL('/play/roulette?game=roulette&operator=alpha&table=r-1',origin)),'/game?game=roulette&table=r-1&operator=alpha');
  assert.equal(gameEntryRedirect(new URL('/game',origin)),'/lobby');
  assert.equal(gameEntryRedirect(new URL('/game/?operator=alpha&game=roulette&table=r-1',origin)),null);
  assert.equal(gameEntryRedirect(new URL('/game?operator=alpha&room=r-1',origin)),'/lobby?operator=alpha&room=r-1');
  assert.equal(gameEntryRedirect(new URL('/',origin)),null);
  assert.equal(gameEntryRedirect(new URL('/?dealer=elin',origin)),'/game?dealer=elin');
  assert.equal(gameEntryRedirect(new URL('/?rehearsal=1&motion=smooth60',origin)),'/game?rehearsal=1');
  assert.equal(approvedGameQuery('launch=a.b.c',{includeLaunch:false}).toString(),'');
  assert.equal(approvedGameQuery('game=poker&dealer=elin').toString(),'dealer=elin');
});

test('the game selector is strict and the one game start is built, not guessed',() => {
  assert.equal(requestedGame(''),'blackjack');assert.equal(requestedGame('game=roulette'),'roulette');assert.equal(requestedGame(new URLSearchParams('game=blackjack&dealer=elin')),'blackjack');
  for (const query of ['game=poker','game=','game=Roulette','game=roulette&game=roulette','game=blackjack&game=roulette','game=roulette/']) assert.equal(requestedGame(query),null,query);
  assert.equal(gameStartPath({game:'blackjack',operator:'alpha',table:'room-1',dealer:'nora'}),'/game?game=blackjack&operator=alpha&table=room-1&dealer=nora');
  assert.equal(gameStartPath({game:'roulette',operator:'alpha',table:'r&1'}),'/game?game=roulette&operator=alpha&table=r%261');
  assert.equal(gameStartPath({operator:'alpha',lane:'mobile-phone'}),'/game?game=blackjack&operator=alpha&lane=mobile-phone');
  assert.throws(() => gameStartPath({game:'poker',operator:'alpha'}));assert.throws(() => gameStartPath({game:'roulette',operator:''}));
  assert.equal(rouletteRoomSearch('game=roulette&operator=alpha&table=r-1&dealer=astrid&lane=mobile-phone&launch=a.b.c&returnTo=https://evil.invalid'),'?operator=alpha&table=r-1&dealer=astrid');
  assert.equal(rouletteRoomSearch('operator=alpha&operator=beta'),'');
  // The roulette document keeps the engine's address: its client posts the page query as the room context.
  assert.equal(rouletteDocumentPath('game=roulette&operator=alpha&table=r-1&dealer=astrid&returnTo=https://evil.invalid'),'/play/roulette?operator=alpha&table=r-1&dealer=astrid');
  assert.equal(rouletteDocumentPath('game=roulette'),'/play/roulette');
});
test('observer survives only as complete valid same-cloud or loopback pair; launch remains a bounded opaque credential',() => {
  const channel = '00000000-0000-4000-8000-000000000001';
  for (const target of [origin,'http://localhost:4187']) {
    const query = new URLSearchParams({dealer:'astrid',labObserverOrigin:target,labObserverChannel:channel,launch:'eyJ.a.b'});
    assert.equal(approvedGameQuery(query,{origin}).get('labObserverOrigin'),target);
    assert.equal(approvedGameQuery(query,{origin}).get('launch'),'eyJ.a.b');
  }
  for (const query of [new URLSearchParams({labObserverOrigin:origin}),new URLSearchParams({labObserverChannel:channel}),
    new URLSearchParams({labObserverOrigin:'https://evil.invalid',labObserverChannel:channel}),new URLSearchParams({labObserverOrigin:origin,labObserverChannel:'forged'}),
    new URLSearchParams({launch:'x'.repeat(16385)})]) assert.equal(approvedGameQuery(query,{origin}).toString(),'');
});
test('retired dealers cannot enter public selectors or forged registered documents',()=>{
  for(const dealer of ['vera','mei','amira','johanna']){
    assert.equal(approvedGameQuery(new URLSearchParams({dealer})).has('dealer'),false);
    assert.throws(()=>decorateGameEntryHtml('<html>',{lane:'saved',dealer,presentation:'local',localDealer:dealer,registeredDealers:[{id:dealer,label:dealer}]}));
  }
});
test('server marker changes player links without new browser flags',t => {
  const html = '<!doctype html><html lang="sv"><body></body></html>';
  assert.match(decorateGameEntryHtml(html),/<html data-game-path="\/blackjack" lang="sv">/);
  const prior = globalThis.document;t.after(() => {if(prior === undefined) delete globalThis.document;else globalThis.document = prior;});
  globalThis.document = {documentElement:{dataset:{gamePath:'/blackjack',gameLane:'saved',gamePresentation:'local',gameRegisteredDealers:JSON.stringify(['elin','astrid','linnea'].map(id=>({id,label:id})))}}};
  for (const dealer of ['elin','astrid','linnea']) assert.equal(new URL(dealerVersionPath(dealer,'original'),'https://example.test').searchParams.get('dealer'),dealer);
  for(const dealer of ['vera','mei','amira','johanna','unknown'])assert.throws(()=>dealerVersionPath(dealer,'original'));
  assert.equal(dealerVersionPath('linnea','original','?performance=staged&motion=smooth60&labObserverOrigin=https://evil.invalid&labObserverChannel=00000000-0000-4000-8000-000000000001&launch=a.b.c'),'/game?game=blackjack&dealer=linnea&presentation=local&lane=saved');
  assert.equal(dealerVersionPath('astrid','v2','?game=roulette&game=poker'),'/game?game=blackjack&dealer=astrid&presentation=local&lane=saved','the switch stays in blackjack');
  globalThis.document.documentElement.dataset = {};
  assert.throws(()=>dealerVersionPath('linnea','original'));
});

test('offline decoration opts in to validated dealer metadata without claiming the Neon game URL', () => {
  const html = '<html lang="en"><body></body></html>';
  const selection = { lane:'saved',dealer:'linnea',presentation:'local',localDealer:'linnea',registeredDealers:[{id:'linnea',label:'Linnea'}] };
  const decorated = decorateGameEntryHtml(html, selection, { offline: true });
  assert.match(decorated, /data-game-lane="saved" data-game-dealer="linnea" data-game-presentation="local"/);
  assert.doesNotMatch(decorated, /data-game-path=/);
  assert.match(decorateGameEntryHtml(html, selection), /<html data-game-path="\/blackjack" data-game-lane="saved"/);
  assert.throws(() => decorateGameEntryHtml(html, { ...selection, dealer: '" onclick="bad' }, { offline: true }));
});


test('offline documents carry no retired comparison banner, whatever the environment names', () => {
  const html = '<html><head><title>Game</title></head><body><header id="hud-top"></header><a class="casino-return" href="/lobby">Till lobbyn</a></body></html>';
  assert.equal(decorateGameEntryHtml(html, undefined, { offline:true }), html);
  assert.equal(decorateGameEntryHtml(html), html.replace('<html>', '<html data-game-path="/blackjack">'));
});


test('retired document addresses redirect permanently to /game by game and drop experiment flags; V2 is gone', () => {
  for (const [path,game] of [['/play/blackjack','blackjack'],['/play/blackjack/','blackjack'],['/blackjack','blackjack'],['/blackjack/','blackjack'],['/roulette','roulette'],['/roulette/','roulette']]) {
    const url=new URL(path+'?dealer=elin&rehearsal=1&performance=staged&motion=smooth60&scene=rigged-review&game=poker',origin);
    assert.equal(legacyGameStartRedirect(url),'/game?game='+game+'&dealer=elin&rehearsal=1',path);
    assert.equal(legacyGameStartRedirect(new URL(path,origin)),'/game?game='+game,path);
  }
  for (const path of ['/v2','/v2/','/v2/index.html','/game','/','/play','/play/profil','/play/roulette','/play/roulette/','/blackjack/extra','/casino.html','/demo']) {
    assert.equal(legacyGameStartRedirect(new URL(path+'?dealer=elin',origin)),null,path);
    assert.equal(gameEntryRedirect(new URL(path+'?dealer=elin',origin)),path==='/'?'/game?dealer=elin':null,path);
  }
});

test('the initial document selects the presentation before client JavaScript runs',async () => {
  const {readFile}=await import('node:fs/promises');
  const source=await readFile(new URL('../services/game/public/index.html',import.meta.url),'utf8');
  for (const dealer of ['astrid','elin','linnea']) {
    const presentation='local';
    const html=decorateGameEntryHtml(source,{lane:'mobile-phone',dealer,presentation,localDealer:dealer,registeredDealers:[{id:dealer,label:dealer}]});
    assert.match(html,/data-presentation-startup="pending"/);
    assert.ok(html.includes('data-presentation="'+(presentation==='original'?'indexed':presentation)+'"'));
    assert.ok(html.indexOf('href="local-presentation.css"')<html.indexOf('</head>'));
    assert.ok(html.indexOf('id="presentation-loading"')<html.indexOf('id="scene"'));
  }
});

test('only the selected first frame can reveal the scene and a redirect prevents startup',async()=>{
  const {createPresentationStartup}=await import('../services/game/public/presentation-startup.mjs');
  const make=()=>{
    const status={hidden:false,textContent:'loading',setAttribute(){},append(){}};
    const document={documentElement:{dataset:{}},querySelector:()=>status,createElement:()=>({})};
    let timeout,cleared=0;
    const startup=createPresentationStartup({document,dealerId:'paow',setTimer:fn=>(timeout=fn,1),clearTimer:()=>cleared++});
    return {startup,document,status,get cleared(){return cleared;},timeout:()=>timeout()};
  };
  const frame=make();
  assert.equal(frame.startup.ready('elin'),false);assert.equal(frame.document.documentElement.dataset.presentationStartup,'pending');
  assert.equal(frame.startup.ready('paow'),true);assert.equal(frame.status.hidden,true);assert.equal(frame.cleared,1);
  const failed=make();failed.timeout();assert.equal(failed.startup.state,'failed');assert.equal(failed.status.hidden,false);
  assert.equal(failed.startup.ready('paow'),true);
  const redirected=make();let target,continued=false;
  redirected.startup.navigate('/blackjack?dealer=linnea',url=>{target=url;}).then(()=>{continued=true;});
  assert.equal(target,'/blackjack?dealer=linnea');assert.equal(redirected.startup.ready('paow'),false);
  await Promise.resolve();assert.equal(continued,false);assert.equal(redirected.startup.state,'navigating');
  const closed=make();closed.startup.close();assert.equal(closed.startup.ready('paow'),false);
});
test('mobile recovery exposes a reload button outside the hidden scene after timeout', async()=>{
  const {createPresentationStartup}=await import('../services/game/public/presentation-startup.mjs');
  const buttons=[],status={hidden:false,textContent:'loading',setAttribute(){},append:button=>buttons.push(button)};
  const document={documentElement:{dataset:{}},querySelector:selector=>{assert.equal(selector,'#presentation-loading');return status;},createElement:tag=>{assert.equal(tag,'button');return {};}};
  let timeout,reloads=0;
  const startup=createPresentationStartup({document,dealerId:'paow',setTimer:fn=>(timeout=fn,1),clearTimer(){},reload:()=>reloads++});
  timeout(); assert.equal(startup.state,'failed'); assert.equal(buttons.length,1);
  assert.equal(buttons[0].textContent,'Ladda om'); buttons[0].onclick(); assert.equal(reloads,1);
  assert.equal(startup.ready('other'),false); assert.equal(startup.ready('paow'),true);
});

test('first-frame readiness is one-shot, follows scene reveal, and supports late layout initialization',async()=>{
  const {createPresentationStartup}=await import('../services/game/public/presentation-startup.mjs');
  const status={hidden:false,textContent:'loading',setAttribute(){},append(){}};
  const document={documentElement:{dataset:{}},querySelector:()=>status,createElement:()=>({})};
  const startup=createPresentationStartup({document,dealerId:'dragan',setTimer:()=>1,clearTimer(){}});
  let readyCount=0;
  startup.whenReady.then(()=>{assert.equal(document.documentElement.dataset.presentationStartup,'ready');assert.equal(status.hidden,true);readyCount++;});
  assert.equal(startup.ready('other'),false);startup.waitForGesture('dragan',true);
  await Promise.resolve();assert.equal(readyCount,0,'a tap prompt is not a presented frame');
  startup.fail();await Promise.resolve();assert.equal(readyCount,0,'failure cannot reveal a scene');
  assert.equal(startup.ready('dragan'),true);await Promise.resolve();assert.equal(readyCount,1);
  assert.equal(startup.ready('dragan'),false);await Promise.resolve();assert.equal(readyCount,1);
  let lateReady=false;startup.whenReady.then(()=>{lateReady=true;});await Promise.resolve();assert.equal(lateReady,true);
  for(const stop of ['close','navigate']){
    const stopped=createPresentationStartup({document,dealerId:'dragan',setTimer:()=>1,clearTimer(){}});
    let notified=false;stopped.whenReady.then(()=>{notified=true;});
    if(stop==='close')stopped.close();else stopped.navigate('/other',()=>{});
    assert.equal(stopped.ready('dragan'),false);await Promise.resolve();assert.equal(notified,false);
  }
});

test('gesture waits pause only the selected pending startup and resume a fresh bounded load watch', async()=>{
  const {createPresentationStartup}=await import('../services/game/public/presentation-startup.mjs');
  const timers=[],cleared=[],buttons=[],status={hidden:false,textContent:'loading',setAttribute(){},append:button=>buttons.push(button)};
  const document={documentElement:{dataset:{}},querySelector:()=>status,createElement:()=>({})};
  const startup=createPresentationStartup({document,dealerId:'dragan',
    setTimer:(callback,ms)=>(timers.push({callback,ms}),timers.length),clearTimer:id=>cleared.push(id)});
  assert.equal(startup.waitForGesture('other',true),false);assert.equal(startup.waitForGesture('dragan','yes'),false);
  assert.equal(startup.waitForGesture('dragan',true),true);assert.deepEqual(cleared,[1]);
  timers[0].callback();assert.equal(startup.state,'pending','a queued cleared timeout cannot report failure');
  assert.equal(startup.ready('other'),false);assert.equal(status.hidden,false);
  assert.equal(startup.waitForGesture('dragan',false),true);assert.equal(timers.length,2);assert.equal(timers[1].ms,30000);
  startup.waitForGesture('dragan',false);assert.equal(timers.length,2,'duplicate callbacks cannot extend the load watch');
  timers[0].callback();assert.equal(startup.state,'pending','resuming does not revive the old timeout');
  timers[1].callback();assert.equal(startup.state,'failed');assert.equal(buttons.length,1);
  assert.equal(startup.waitForGesture('dragan',true),false,'a late gesture callback cannot hide a real failure');
  assert.equal(startup.ready('dragan'),true);assert.equal(startup.waitForGesture('dragan',true),false);
  startup.close();assert.equal(startup.waitForGesture('dragan',true),false);
  const navigating=createPresentationStartup({document,dealerId:'dragan',setTimer:()=>1,clearTimer(){}});
  navigating.navigate('/other',()=>{});assert.equal(navigating.waitForGesture('dragan',true),false);
});
test('the engine names the game on every /game return and never carries a launch credential',async () => {
  const {publicGameStart} = await import('../services/game/game-start.mjs');
  const channel = '00000000-0000-4000-8000-000000000001';
  assert.equal(publicGameStart('dealer=linnea&table=bj-1&launch=a.b.c&returnTo=https://evil.invalid',{origin}),'/game?game=blackjack&dealer=linnea&table=bj-1');
  assert.equal(publicGameStart('game=roulette&operator=north&table=r-1',{origin}),'/game?game=roulette&table=r-1&operator=north');
  assert.equal(publicGameStart('labObserverOrigin='+encodeURIComponent(origin)+'&labObserverChannel='+channel,{origin}),'/game?game=blackjack&labObserverOrigin='+encodeURIComponent(origin)+'&labObserverChannel='+channel);
  for (const query of ['game=poker','game=','game=Roulette','game=roulette&game=roulette','game=blackjack&game=roulette']) assert.equal(publicGameStart(query,{origin}),null,query);
  // A partner launch is blackjack only; a roulette launch is refused instead of opening another game.
  assert.equal(publicGameStart('game=roulette&table=r-1',{origin,games:['blackjack']}),null);
  assert.equal(publicGameStart(new URLSearchParams('game=blackjack&dealer=astrid'),{origin,games:['blackjack']}),'/game?game=blackjack&dealer=astrid');
});
