import test from 'node:test';
import assert from 'node:assert/strict';
import {playerAreaPage} from '../lib/player-area.mjs';
import {backendPlatformPath} from '../../../packages/navigation/server/platform-routing.mjs';
import {
  OPERATOR_STORAGE_KEY, clearedOperatorLocation, lobbyOperatorName, operatorChoice, operatorPlayPath,
} from '../lib/player-operator.mjs';
import { choicesStorageKey, lobbyChoiceText, parseStoredChoices } from '../lib/player-choices.mjs';

const env = {
  CROUPIER_VERCEL_UI: '1',
  CROUPIER_PUBLIC_ORIGIN: 'https://preview.example.test',
  CROUPIER_BACKEND_ORIGIN: 'https://isolated.onrender.com',
  CROUPIER_LAB_UI_ORIGIN: 'https://lab-ui.vercel.app',
  CROUPIER_VERCEL_INGRESS_SECRET: 'isolated-unit-secret-'.repeat(3),
};
const request = new Request('https://preview.example.test/play', {headers: {cookie: 'player_session=fixture'}});
const company = {slug: 'sg-test', name: 'SG test game provider'};

function sessionFetch(extra) {
  return async (url, init) => {
    const path = String(url);
    if (path.endsWith('/api/auth/session')) return Response.json({authenticated: true, guest: false, sharedCredentials: true, playerAccounts: true});
    if (path.endsWith('/api/player')) return Response.json({name: 'Ada', currency: 'SEK', balance: 2500});
    return extra(path, init);
  };
}

test('profile form shows the current name, leaves balance as text and has one lime button', async () => {
  const page = await playerAreaPage(request, env, 'profil', {fetchImpl: sessionFetch(path => {
    if (path.endsWith('/api/profile')) return Response.json({displayName: 'Ada', locale: 'sv', currency: 'SEK', balance: 2500, editable: true});
    return new Response('secret-stack-trace', {status: 404});
  })});
  assert.match(page.html, /name="displayName" value="Ada"/);
  assert.match(page.html, /Spara profil/);
  assert.match(page.html, /Svenska/);
  assert.match(page.html, /English/);
  assert.equal((page.html.match(/bg-lime/g) || []).length, 1);
  assert.match(page.html, /role="alert"/);
  assert.match(page.html, /data-profile-saved/);
  const saldo = page.html.slice(page.html.indexOf('data-field="Saldo"'), page.html.indexOf('</dd>', page.html.indexOf('data-field="Saldo"')));
  assert.match(saldo, /SEK/);
  assert.doesNotMatch(saldo, /<input/);
  assert.doesNotMatch(page.html, /name="balance"|name="currency"|secret-stack-trace/);
  assert.match(page.html, /href="\/lobby"/);
  assert.deepEqual(page.model.links, [{href:'/play/historik', label:'Spelhistorik'}]);
});

test('profile without the columns says it is not available yet and still shows the balance as text', async () => {
  const page = await playerAreaPage(request, env, 'profil', {fetchImpl: sessionFetch(path => {
    if (path.endsWith('/api/profile')) return Response.json({displayName: 'Ada', locale: null, currency: 'SEK', balance: 2500, editable: false});
    return new Response('secret-stack-trace', {status: 404});
  })});
  assert.match(page.html, /Inte tillgängligt än/);
  assert.match(page.html, /data-field="Saldo"/);
  assert.doesNotMatch(page.html, /bg-lime|name="displayName"|secret-stack-trace/);
});

test('lobby operator choice prefers the query, then storage, and drops an unknown slug', () => {
  assert.equal(OPERATOR_STORAGE_KEY, 'croupier.operator');
  assert.equal(operatorChoice({search: '?operator=sg-test', stored: 'demo-north'}), 'sg-test');
  assert.equal(operatorChoice({search: '', stored: 'sg-test'}), 'sg-test');
  assert.equal(operatorChoice({search: '?operator=play', stored: 'sg-test'}), '');
  assert.equal(operatorChoice({search: '?operator=sg-test&operator=demo-north', stored: 'sg-test'}), '');
  assert.equal(lobbyOperatorName({search: '', stored: 'sg-test', payload: company}), 'SG test game provider');
  assert.equal(lobbyOperatorName({search: '?operator=sg-test', stored: null, payload: {...company, status: 'active'}}), '');
  assert.equal(lobbyOperatorName({search: '?operator=missing', stored: 'sg-test', payload: null}), '');
  assert.equal(operatorPlayPath('sg-test'), '/play/blackjack?operator=sg-test');
  assert.equal(clearedOperatorLocation('https://preview.example.test/play?operator=sg-test&dealer=astrid'), '/play?dealer=astrid');
  assert.equal(clearedOperatorLocation('/play?operator=sg-test'), '/play');
});

test('legacy stored choices remain readable while the lobby uses verified room and dealer names', () => {
  const stored = parseStoredChoices(JSON.stringify({ dealer: 'astrid', tableColor: '#112233', background: 'stad' }));
  assert.equal(choicesStorageKey('sg-test'), 'croupier.choices.sg-test');
  assert.equal(choicesStorageKey(''), 'croupier.choices.default');
  assert.equal(lobbyChoiceText(stored), 'Dealer Astrid · bord #112233');
  assert.equal(lobbyChoiceText(parseStoredChoices('{"dealer":"ghost"}')), '');
});

test('profile and public operator paths stay on the game backend', () => {
  assert.equal(backendPlatformPath('/api/profile'), true);
  assert.equal(backendPlatformPath('/api/operators/sg-test'), true);
  assert.equal(backendPlatformPath('/api/operators'), true);
  for (const path of ['/api/operators/', '/api/operators/private/users', '/api/operators%2f', '/api/operator']) {
    assert.equal(backendPlatformPath(path), false, path);
  }
  assert.equal(backendPlatformPath('/api/operators/sg-test/name'), false);
  assert.equal(backendPlatformPath('/api/operators/SG-test'), false);
});
