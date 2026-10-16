import test from 'node:test';
import assert from 'node:assert/strict';
import {publicGamePath,approvedGameQuery,gameEntryRedirect,canonicalGameDestination,decorateGameEntryHtml} from '../web/public/game-entry-contract.mjs';
import {dealerVersionPath} from '../web/public/dealer-version-switcher.mjs';
const env = {CROUPIER_STUDIO_NEON_POLICY:'1'},origin = 'https://game.example.invalid';
test('canonical game address is gated and aliases preserve only unambiguous public selectors',() => {
  assert.equal(publicGamePath({}),'/');assert.equal(publicGamePath({CROUPIER_PUBLIC_GAME_PATH:'/game'}),'/game');
  assert.equal(publicGamePath({...env,CROUPIER_PUBLIC_GAME_PATH:'/game'}),'/blackjack');
  assert.throws(() => publicGamePath({CROUPIER_PUBLIC_GAME_PATH:'/blackjack'}));
  const url = new URL('/game?dealer=linnea&presentation=local&performance=staged&motion=smooth60&rehearsal=1&table=bj-1&returnTo=https://evil.invalid&playerId=forged#secret',origin);
  assert.equal(gameEntryRedirect(url,{}),null);
  assert.equal(gameEntryRedirect(url,env),'/blackjack?dealer=linnea&presentation=local&rehearsal=1&table=bj-1');
  assert.equal(canonicalGameDestination(new URL('/game?dealer=astrid&dealer=elin&presentation=evil&rehearsal=true&launch=a.b.c&launch=x.y.z',origin)),'/blackjack');
  assert.equal(gameEntryRedirect(new URL('/blackjack?dealer=elin',origin),env),null);
  assert.equal(gameEntryRedirect(new URL('/',origin),env),null);
  assert.equal(gameEntryRedirect(new URL('/?dealer=elin',origin),env),'/blackjack?dealer=elin');
  assert.equal(gameEntryRedirect(new URL('/?rehearsal=1&motion=smooth60',origin),env),'/blackjack?rehearsal=1');
  assert.equal(approvedGameQuery('launch=a.b.c',{includeLaunch:false}).toString(),'');
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
    assert.throws(()=>decorateGameEntryHtml('<html>',env,{lane:'saved',dealer,presentation:'local',localDealer:dealer,registeredDealers:[{id:dealer,label:dealer}]}));
  }
});
test('server marker changes player links without new browser flags and keeps off mode byte-identical',t => {
  const html = '<!doctype html><html lang="sv"><body></body></html>';
  assert.equal(decorateGameEntryHtml(html,{}),html);assert.match(decorateGameEntryHtml(html,env),/<html data-game-path="\/blackjack" lang="sv">/);
  const prior = globalThis.document;t.after(() => {if(prior === undefined) delete globalThis.document;else globalThis.document = prior;});
  globalThis.document = {documentElement:{dataset:{gamePath:'/blackjack',gameLane:'saved',gamePresentation:'local',gameRegisteredDealers:JSON.stringify(['elin','astrid','linnea'].map(id=>({id,label:id})))}}};
  for (const dealer of ['elin','astrid','linnea']) assert.equal(new URL(dealerVersionPath(dealer,'original'),'https://example.test').searchParams.get('dealer'),dealer);
  for(const dealer of ['vera','mei','amira','johanna','unknown'])assert.throws(()=>dealerVersionPath(dealer,'original'));
  assert.equal(dealerVersionPath('linnea','original','?performance=staged&motion=smooth60&labObserverOrigin=https://evil.invalid&labObserverChannel=00000000-0000-4000-8000-000000000001&launch=a.b.c'),'/blackjack?dealer=linnea&presentation=local&lane=saved');
  assert.equal(dealerVersionPath('astrid','v2'),'/blackjack?dealer=astrid&presentation=local&lane=saved');
  globalThis.document.documentElement.dataset = {};
  assert.throws(()=>dealerVersionPath('linnea','original'));
});

test('offline decoration opts in to validated dealer metadata without claiming the Neon game URL', () => {
  const html = '<html lang="en"><body></body></html>';
  const selection = { lane:'saved',dealer:'linnea',presentation:'local',localDealer:'linnea',registeredDealers:[{id:'linnea',label:'Linnea'}] };
  const decorated = decorateGameEntryHtml(html, {}, selection, { offline: true });
  assert.match(decorated, /data-game-lane="saved" data-game-dealer="linnea" data-game-presentation="local"/);
  assert.doesNotMatch(decorated, /data-game-path=/);
  assert.equal(decorateGameEntryHtml(html, {}, selection), html);
  assert.throws(() => decorateGameEntryHtml(html, {}, { ...selection, dealer: '" onclick="bad' }, { offline: true }));
  assert.match(decorateGameEntryHtml(html, env, selection, { offline: true }), /data-game-path="\/blackjack"/);
});


test('isolated comparison documents are visibly labelled only with server-owned loopback isolation', () => {
  const html = '<html><head><title>Game</title></head><body><header id="hud-top"><div id="game-title">Game</div><button id="sound-btn">Sound</button></header><a class="casino-return" href="/play">Till lobbyn</a></body></html>';
  const qa = { PUBLIC_URL:'http://localhost:4194', CROUPIER_QA_ALLOWED_PORTS:'4194,4192' };
  const marked = decorateGameEntryHtml(html, qa, undefined, { offline:true });
  assert.match(marked, /data-local-comparison="true"/);
  assert.match(marked, /<title>Isolerad mediarepetition/);
  assert.match(marked, /<header id="hud-top"><aside id="local-comparison-notice"/);
  assert.match(marked, /https:\/\/www\.scoutgaming\.tech\/play/);
  assert.match(marked, /rel="noopener noreferrer"/);
  assert.match(marked, /class="casino-return" href="https:\/\/www\.scoutgaming\.tech\/play" target="_blank" rel="noopener noreferrer">Publicerad lobby/);
  assert.doesNotMatch(marked, /href="\/play"/);
  assert.match(marked, /<button id="sound-btn">Sound<\/button>/);
  for (const value of [{}, {...qa,PUBLIC_URL:'https://www.scoutgaming.tech'}, {...qa,PUBLIC_URL:'http://localhost:9999'}, {...qa,PUBLIC_URL:'http://localhost:4194/path'}, {...qa,CROUPIER_QA_ALLOWED_PORTS:'4194,0'}, {...qa,...env}]) {
    assert.doesNotMatch(decorateGameEntryHtml(html,value,undefined,{offline:true}), /local-comparison-notice|data-local-comparison=/);
  }
  assert.equal(decorateGameEntryHtml(html,qa),html);
});


test('all retired V2 aliases choose the one canonical entry and drop experiment flags', () => {
  for (const path of ['/v2','/v2/','/v2/index.html']) {
    const url=new URL(path+'?dealer=elin&rehearsal=1&performance=staged&motion=smooth60&scene=rigged-review',origin);
    assert.equal(gameEntryRedirect(url,env),'/blackjack?dealer=elin&rehearsal=1');
    assert.equal(gameEntryRedirect(url,{}),'/?dealer=elin&rehearsal=1');
  }
});

test('the initial document selects the presentation before client JavaScript runs',async () => {
  const {readFile}=await import('node:fs/promises');
  const source=await readFile(new URL('../web/public/index.html',import.meta.url),'utf8');
  for (const [dealer,presentation] of [['astrid','local'],['elin','local'],['linnea','local'],['paow','layered']]) {
    const html=decorateGameEntryHtml(source,env,{lane:presentation==='layered'?'layer-preview':'mobile-phone',dealer,presentation,...(presentation==='local'?{localDealer:dealer,registeredDealers:[{id:dealer,label:dealer}]}:{})});
    assert.match(html,/data-presentation-startup="pending"/);
    assert.ok(html.includes('data-presentation="'+(presentation==='original'?'indexed':presentation)+'"'));
    assert.ok(html.indexOf('href="local-presentation.css"')<html.indexOf('</head>'));
    assert.ok(html.indexOf('id="presentation-loading"')<html.indexOf('id="scene"'));
  }
});

test('only the selected first frame can reveal the scene and a redirect prevents startup',async()=>{
  const {createPresentationStartup}=await import('../web/public/presentation-startup.mjs');
  const make=()=>{
    const status={hidden:false,textContent:'loading',setAttribute(){}};
    const document={documentElement:{dataset:{}},querySelector:()=>status};
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
