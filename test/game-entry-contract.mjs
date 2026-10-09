import test from 'node:test';
import assert from 'node:assert/strict';
import {publicGamePath,approvedGameQuery,gameEntryRedirect,canonicalGameDestination,decorateGameEntryHtml} from '../web/public/game-entry-contract.mjs';
import {dealerVersionPath} from '../web/public/dealer-version-switcher.mjs';
const env = {CROUPIER_STUDIO_NEON_POLICY:'1'},origin = 'https://game.example.invalid';
test('canonical game address is gated and aliases preserve only unambiguous public selectors',() => {
  assert.equal(publicGamePath({}),'/');assert.equal(publicGamePath({CROUPIER_PUBLIC_GAME_PATH:'/game'}),'/game');
  assert.equal(publicGamePath({...env,CROUPIER_PUBLIC_GAME_PATH:'/game'}),'/blackjack');
  assert.throws(() => publicGamePath({CROUPIER_PUBLIC_GAME_PATH:'/blackjack'}));
  const url = new URL('/game?dealer=mei&presentation=local&performance=staged&motion=smooth60&rehearsal=1&table=bj-1&returnTo=https://evil.invalid&playerId=forged#secret',origin);
  assert.equal(gameEntryRedirect(url,{}),null);
  assert.equal(gameEntryRedirect(url,env),'/blackjack?dealer=mei&presentation=local&performance=staged&motion=smooth60&rehearsal=1&table=bj-1');
  assert.equal(canonicalGameDestination(new URL('/game?dealer=astrid&dealer=vera&presentation=evil&rehearsal=true&launch=a.b.c&launch=x.y.z',origin)),'/blackjack');
  assert.equal(gameEntryRedirect(new URL('/blackjack?dealer=vera',origin),env),null);
  assert.equal(gameEntryRedirect(new URL('/',origin),env),null);
  assert.equal(gameEntryRedirect(new URL('/?dealer=vera',origin),env),'/blackjack?dealer=vera');
  assert.equal(gameEntryRedirect(new URL('/?rehearsal=1&motion=smooth60',origin),env),'/blackjack?motion=smooth60&rehearsal=1');
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
test('server marker changes player links without new browser flags and keeps off mode byte-identical',t => {
  const html = '<!doctype html><html lang="sv"><body></body></html>';
  assert.equal(decorateGameEntryHtml(html,{}),html);assert.match(decorateGameEntryHtml(html,env),/<html data-game-path="\/blackjack" lang="sv">/);
  const prior = globalThis.document;t.after(() => {if(prior === undefined) delete globalThis.document;else globalThis.document = prior;});
  globalThis.document = {documentElement:{dataset:{gamePath:'/blackjack'}}};
  for (const dealer of ['vera','astrid','amira','mei']) assert.equal(dealerVersionPath(dealer,'original'),'/blackjack?dealer='+dealer);
  assert.equal(dealerVersionPath('mei','original','?performance=staged&motion=smooth60&labObserverOrigin=https://evil.invalid&labObserverChannel=00000000-0000-4000-8000-000000000001&launch=a.b.c'),'/blackjack?dealer=mei&performance=staged&motion=smooth60');
  assert.equal(dealerVersionPath('astrid','v2'),'/v2/?dealer=astrid');
  globalThis.document.documentElement.dataset = {};
  assert.equal(dealerVersionPath('mei','original'),'/?dealer=mei');
});

test('offline decoration opts in to validated dealer metadata without claiming the Neon game URL', () => {
  const html = '<html lang="en"><body></body></html>';
  const selection = { lane: 'legacy', dealer: 'mei', presentation: 'original' };
  const decorated = decorateGameEntryHtml(html, {}, selection, { offline: true });
  assert.match(decorated, /data-game-lane="legacy" data-game-dealer="mei" data-game-presentation="original"/);
  assert.doesNotMatch(decorated, /data-game-path=/);
  assert.equal(decorateGameEntryHtml(html, {}, selection), html);
  assert.throws(() => decorateGameEntryHtml(html, {}, { ...selection, dealer: '" onclick="bad' }, { offline: true }));
  assert.match(decorateGameEntryHtml(html, env, selection, { offline: true }), /data-game-path="\/blackjack"/);
});
