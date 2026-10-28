import test from 'node:test';
import assert from 'node:assert/strict';
import {playerAccountKind, playerAreaData, playerAreaModel, playerAreaPage, playerAreaRequest, PLAYER_RESULTS_PATH} from '../lib/player-area.mjs';

const env = {
  CROUPIER_VERCEL_UI: '1',
  CROUPIER_PUBLIC_ORIGIN: 'https://preview.example.test',
  CROUPIER_BACKEND_ORIGIN: 'https://isolated.onrender.com',
  CROUPIER_LAB_UI_ORIGIN: 'https://lab-ui.vercel.app',
  CROUPIER_VERCEL_INGRESS_SECRET: 'isolated-unit-secret-'.repeat(3),
};

const request = new Request('https://preview.example.test/play', {headers: {cookie: 'player_session=fixture'}});

test('player account kind uses only session flags the payload can carry', () => {
  assert.equal(playerAccountKind(null), null);
  assert.equal(playerAccountKind({authenticated: true, guest: false}), 'konto');
  assert.equal(playerAccountKind({authenticated: false, guest: true}), 'gäst');
  assert.equal(playerAccountKind({authenticated: true, partnerKeyId: 'key-1'}), 'partner-start');
  assert.equal(PLAYER_RESULTS_PATH, '/api/history');
});

test('legacy catalogue redirects without reading private account data', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({url: String(url), method: init.method});
    return new Response('{"error":"secret-stack-trace"}', {status: 401, headers: {'content-type': 'application/json'}});
  };
  const data = await playerAreaData(request, env, {fetchImpl});
  assert.equal(data.session, null);
  assert.equal(data.player, null);
  assert.equal(data.results, null);
  assert.deepEqual(calls, [{url: env.CROUPIER_BACKEND_ORIGIN + '/api/auth/session', method: 'GET'}]);
  const page = await playerAreaPage(request, env, 'lobby', {fetchImpl: async () => { throw Error('no legacy data read'); }});
  assert.equal(page.redirect, '/lobby');
  assert.equal(page.html, '');
});

test('authenticated fixture renders the name, balance and both account links', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({url: String(url), method: init.method, cookie: init.headers.get('cookie'), secret: init.headers.get('x-croupier-vercel-secret'), body: init.body ?? null, cache: init.cache, redirect: init.redirect});
    if (String(url).endsWith('/api/auth/session')) return Response.json({authenticated: true, guest: false, sharedCredentials: true, playerAccounts: true});
    if (String(url).endsWith('/api/player')) return Response.json({id: 'player-1', name: 'Ada & Co', currency: 'SEK', balance: 2500, error: 'must-not-leak'});
    return new Response('secret-stack-trace', {status: 404});
  };
  const page = await playerAreaPage(request, env, 'profil', {fetchImpl});
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, env.CROUPIER_BACKEND_ORIGIN + '/api/auth/session');
  assert.equal(calls[1].url, env.CROUPIER_BACKEND_ORIGIN + '/api/player');
  assert.equal(calls[1].method, 'POST');
  assert.equal(calls[1].body, '{}');
  assert.equal(calls[1].cookie, 'player_session=fixture');
  assert.equal(calls[1].secret, env.CROUPIER_VERCEL_INGRESS_SECRET);
  assert.equal(calls[1].cache, 'no-store');
  assert.equal(calls[1].redirect, 'error');
  assert.match(page.html, /Ada &amp; Co/);
  assert.match(page.html, /SEK/);
  assert.match(page.html, /href="\/play\/historik"/);
  assert.match(page.html, /href="\/lobby"/);
  assert.doesNotMatch(page.html, /must-not-leak|player-1|secret-stack-trace/);
});

test('profile and history redirect when the session is missing', async () => {
  const fetchImpl = async () => new Response(null, {status: 401});
  const profil = await playerAreaPage(request, env, 'profil', {fetchImpl});
  const historik = await playerAreaPage(request, env, 'historik', {fetchImpl});
  assert.equal(profil.redirect, '/player-login?returnTo=/play/profil');
  assert.equal(historik.redirect, '/player-login?returnTo=/play/historik');
  assert.equal(profil.html, '');
  assert.equal(historik.html, '');
});

test('backend 503 renders an unavailable notice without upstream text', async () => {
  const fetchImpl = async () => { throw new Error('secret-stack-trace'); };
  const thrown = await playerAreaPage(request, env, 'profil', {fetchImpl});
  assert.equal(thrown.redirect, null);
  assert.match(thrown.html, /Spelkontot kan inte läsas just nu/);
  assert.doesNotMatch(thrown.html, /secret-stack-trace|Error:|at player-area/);
  const denied = await playerAreaPage(request, env, 'profil', {fetchImpl: async () => new Response('secret-stack-trace', {status: 503})});
  assert.match(denied.html, /Spelkontot kan inte läsas just nu/);
  assert.doesNotMatch(denied.html, /secret-stack-trace/);
});

test('history stays honest when no public results route exists', async () => {
  const fetchImpl = async url => String(url).endsWith('/api/auth/session')
    ? Response.json({authenticated: true, guest: false, sharedCredentials: true})
    : Response.json({name: 'Ada', currency: 'EUR', balance: 40});
  const page = await playerAreaPage(request, env, 'historik', {fetchImpl});
  assert.equal(page.redirect, null);
  assert.match(page.html, /Egen historik/);
  assert.match(page.html, /Inga avslutade rundor ännu/);
  assert.match(page.html, /Ada/);
  assert.match(page.html, /EUR/);
  assert.match(page.html, /Till spellobbyn/);
  assert.doesNotMatch(page.html, /Ingen serverdata har lästs/);
  const profil = await playerAreaPage(request, env, 'profil', {fetchImpl});
  assert.match(profil.html, /Egen profil/);
  assert.match(profil.html, /Kontotyp · konto/);
  assert.match(profil.html, /Till spellobbyn/);
  assert.match(profil.html, /href="\/lobby"/);
});

test('history renders two currencies and the latest outcome in Swedish', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({url: String(url), method: init.method, body: init.body ?? null});
    if (String(url).endsWith('/api/auth/session')) return Response.json({authenticated: true, guest: false, sharedCredentials: true});
    if (String(url).endsWith('/api/player')) return Response.json({name: 'Ada', currency: 'SEK', balance: 10});
    if (String(url).endsWith('/api/history')) return Response.json({
      currencies: [
        {currency: 'SEK', rounds: 2, won: 10, lost: 4, net: 6, wagered: 20, returned: 26},
        {currency: 'EUR', rounds: 1, won: 0, lost: 5, net: -5, wagered: 5, returned: 0},
      ],
      lastRound: {currency: 'EUR', net: -5, outcome: 'loss', roundId: 'native-ledger-9'},
      id: 'player-must-not-leak',
    });
    return new Response('secret-stack-trace', {status: 404});
  };
  const page = await playerAreaPage(request, env, 'historik', {fetchImpl});
  assert.equal(calls[2].url, env.CROUPIER_BACKEND_ORIGIN + '/api/history');
  assert.equal(calls[2].method, 'POST');
  assert.equal(calls[2].body, '{}');
  assert.match(page.html, /SEK: 2 rundor/);
  assert.match(page.html, /EUR: 1 rundor/);
  assert.match(page.html, /förlust/);
  assert.doesNotMatch(page.html, /player-must-not-leak|native-ledger-9|secret-stack-trace|Inga avslutade rundor/);
  for (const [outcome, label] of [['win', 'vinst'], ['push', 'lika']]) {
    const model = playerAreaModel({
      session: {authenticated: true, guest: false},
      player: {name: 'Ada', currency: 'SEK', balance: 1},
      results: {currencies: [{currency: 'SEK', rounds: 1, won: 0, lost: 0, net: 0, wagered: 1, returned: 1}], lastRound: {currency: 'SEK', net: 0, outcome}},
    }, 'historik');
    assert.ok(model.historyLines.some(line => line.includes(label)), label);
  }
});

test('history keeps the empty state when every currency has zero rounds', () => {
  const model = playerAreaModel({
    session: {authenticated: true, guest: false},
    player: {name: 'Ada', currency: 'SEK', balance: 10},
    results: {
      currencies: [
        {currency: 'SEK', rounds: 0, won: 0, lost: 0, net: 0, wagered: 0, returned: 0},
        {currency: 'EUR', rounds: 0, won: 0, lost: 0, net: 0, wagered: 0, returned: 0},
      ],
      lastRound: null,
    },
  }, 'historik');
  assert.equal(model.historyLines.length, 0);
  assert.match(model.empty, /Inga avslutade rundor ännu/);
});


test('a stray backoffice handoff flag never starts the retired BO handoff or a player read',async()=>{
  for(const surface of ['profil','historik']) {
    const path=surface==='lobby'?'/play?operator=swedish-games':'/play/'+surface;
    const calls=[];
    const page=await playerAreaPage(new Request('https://preview.example.test'+path,{headers:{cookie:'bo_jwt=verified; player_session=other'}}),env,surface,{fetchImpl:async(url)=>{
      calls.push(new URL(url).pathname);
      assert.equal(new URL(url).pathname,'/api/auth/session');
      return Response.json({authenticated:false,guest:false,sharedCredentials:true,backofficeHandoff:true});
    }});
    assert.equal(String(page.redirect??'').includes('/api/auth/bo/'),false,'the engine has no BO handoff any more');
    assert.equal(page.data.player,null);
    assert.deepEqual(calls,['/api/auth/session']);
  }
});
