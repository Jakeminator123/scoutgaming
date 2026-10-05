import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as policy from '../lib/studio-access-policy.mjs';
import * as contract from '../lib/studio-admin-contract.mjs';
import * as navigation from '../lib/backoffice-navigation.mjs';
import * as gameLanes from '../../web/public/game-lanes.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const source = readFileSync(new URL('./studio-administration.tsx', import.meta.url), 'utf8');
const compiled = transformSync(source, {
  filename: 'studio-administration.tsx',
  jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
  module: { type: 'commonjs' },
}).code;

class Element { closest() { return this.form ?? null; } }
class Input extends Element { constructor(value = '') { super(); this.value = value; this.validationMessage = ''; this.reported = false; } setCustomValidity(message) { this.validationMessage = message; } reportValidity() { this.reported = true; return !this.validationMessage; } }
class Form extends Element {
  constructor(fields = {}) {
    super(); this.fields = fields; this.resets = 0;
    this.passwordInput = new Input(fields.password ?? '');
    this.confirmInput = new Input(fields.confirm ?? '');
    this.elements = { namedItem: name => name === 'password' ? this.passwordInput : name === 'confirm' ? this.confirmInput : null };
  }
  reset() { ++this.resets; }
}
class TestFormData {
  constructor(form) { this.form = form; }
  get(name) { return this.form.fields[name] ?? null; }
  has(name) { return Object.hasOwn(this.form.fields, name); }
}

function harness() {
  const hooks = []; let cursor = 0;
  const listeners = new Map(); const pending = [];
  const fakeReact = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = { current: initial }; return hooks[index]; },
    useMemo(fn, deps) {
      const index = cursor++; const old = hooks[index];
      if (!old || deps.some((value, i) => value !== old.deps[i])) hooks[index] = { value: fn(), deps };
      return hooks[index].value;
    },
    useEffect(fn, deps) {
      const index = cursor++; const old = hooks[index];
      if (!old || deps.some((value, i) => value !== old.deps[i])) {
        pending.push(() => { old?.cleanup?.(); const cleanup = fn(); hooks[index] = { deps, cleanup }; });
      }
    },
  };
  const window = {
    confirm: () => true,
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: (type, callback) => { if (listeners.get(type) === callback) listeners.delete(type); },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, window, DOMException, AbortController, URL,
    FormData: TestFormData, HTMLElement: Element, HTMLFormElement: Form, HTMLInputElement: Input,
    fetch() { throw new Error('Unexpected real fetch'); },
    require: name => name === 'react' ? fakeReact
      : name.endsWith('.module.css') ? { __esModule: true, default: {} }
        : name === '../lib/studio-access-policy.mjs' ? policy
          : name === '../lib/studio-admin-contract.mjs' ? contract
            : name === '../lib/backoffice-navigation.mjs' ? navigation
              : name === '../../web/public/game-lanes.mjs' ? gameLanes : require(name),
  });
  return {
    ...module.exports, listeners, window,
    render(props) { cursor = 0; return module.exports.StudioAdministration(props); },
    effects() { while (pending.length) pending.shift()(); },
    unmount() { for (const hook of hooks) hook?.cleanup?.(); },
  };
}

function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function buttons(tree, text) { return nodes(tree, node => node.type === 'button' && node.props.children === text); }
function reply(payload, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } }); }
function status(expected) { return error => error?.status === expected; }
const actor = role => ({ username: 'owner@example.test', role });
const allActions = contract.STUDIO_ADMIN_ENDPOINTS.map(endpoint => `${endpoint.method} ${endpoint.action}`);
const available = (method, action) => allActions.includes(`${method} ${action}`);
const config = () => ({
  revision: 'studio-v1', tiers: { classic: 'vera', high: 'astrid', vip: 'mei' },
  rooms: [{ id: 'room-one', name: 'Test room', tier: 'classic', state: 'preview' }],
  pitboss: { payout10x: true, streak5: false, randomWalkMin: 45 },
  tournaments: [{ id: 'tour-one', name: 'Existing tournament', format: 'Elimination', buyin: 0, pool: 100, starts: 'TBD', state: 'draft', entries: 0, cap: 10 }],
});
function resources() {
  return {
    overview: { payload: { players: 2, rooms: config().rooms, dealers: [{ key: 'vera' }] } },
    config: { payload: config() },
    players: { payload: { administration: true, players: [
      { id: 'player-active', name: 'Active', balance: 1000, currency: 'SEK', status: 'active', passwordChangeAllowed: true },
      { id: 'player-closed', name: 'Closed', balance: 42, currency: 'EUR', status: 'closed', passwordChangeAllowed: true },
    ] } },
    users: { payload: { users: [
      { username: actor('superadmin').username, role: 'superadmin', active: 1 },
      { username: 'other@example.test', role: 'staff', active: 1 },
    ] } },
    apikeys: { payload: { keys: [{ id: 'partner-one', name: 'Test partner', scopes: ['play'], key: 'MUST-NOT-RENDER', secret: 'MUST-NOT-RENDER', walletConfigured: true }] } },
    transactions: { payload: { tx: [{ player_id: 'player-closed', type: 'open', amount: 42, currency: 'EUR', at: '2026-10-02T00:00:00Z' }] } },
    voicelines: { payload: { dealers: [{ dealer: 'astrid', name: 'Astrid', lines: [{ key: 'goodluck', text: 'Lycka till', review: null, reviewable:true,identity:'exact-pair-fixture', preview: '/dealers/astrid/preview/goodluck.mp4', audio: '/dealers/astrid/audio/en/goodluck.mp3' }] }] } },
    shoes:{payload:{rules:{decks:8,total:416,cutAfter:312,burn:1},tableCount:2,shoes:2,activeRounds:1,cutReached:0,observedAt:'2026-10-03T02:00:00.000Z'}},
    emails:{payload:{previewOnly:true,templates:[{id:'welcome',name:'Welcome',heading:'Hello <script>',text:'Preview',fields:[['Account','[PLAYER EMAIL]']],action:'Take a seat'}]}},
  };
}
const viewProps = (role = 'superadmin', group = 'accounts') => ({ actor: actor(role), group, resources: resources(), busy: false, available, command() { throw new Error('Unexpected render mutation'); } });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('render never mutates or requests providers/accounts; six groups expose eleven implemented sections', () => {
  const h = harness(); let calls = 0;
  const props = { apiBase: '/studio/api/admin', availableActions: allActions, session: async () => { ++calls; return actor('superadmin'); }, fetchImpl: async () => { ++calls; throw new Error('no'); } };
  const html = renderToStaticMarkup(h.render(props));
  assert.equal(calls, 0);
  assert.doesNotMatch(html, /iframe|localStorage|MUST-NOT-RENDER/);
  assert.equal(navigation.BACKOFFICE_GROUPS.length, 6);
  const sections = navigation.BACKOFFICE_GROUPS.flatMap(group => {
    const tree = h.StudioAdministrationView(viewProps('superadmin', group.id));
    return nodes(tree, node => node.props?.['data-admin-section']).map(node => node.props['data-admin-section']);
  });
  assert.equal(sections.length, 11); assert.equal(new Set(sections).size, 11);
  assert.deepEqual([...sections].sort(), navigation.BACKOFFICE_SECTIONS.map(section => section.id).sort());
  assert.doesNotMatch(sections.join(' '), /clip-assign/);
});

test('actual rendered native administration forms explicitly use POST, including account passwords', () => {
  const h = harness(); let forms = 0;
  for (const group of navigation.BACKOFFICE_GROUPS) {
    const html = renderToStaticMarkup(h.StudioAdministrationView(viewProps('superadmin', group.id)));
    for (const form of html.matchAll(/<form\b[^>]*>/g)) { assert.match(form[0], /method="post"/); ++forms; }
  }
  assert.ok(forms >= 12); assert.match(renderToStaticMarkup(h.StudioAdministrationView(viewProps('superadmin', 'accounts'))), /type="password"/);
});

test('unknown identities/roles/groups fail closed, including inherited and prototype values', () => {
  const h = harness();
  for (const value of [null, [], {}, 'admin', actor('constructor'), actor('__proto__'), actor('player'), { username: '', role: 'reader' }, Object.create(actor('superadmin')), { username: 'x\u0000y', role: 'admin' }]) assert.equal(h.studioAdminActor(value), null);
  for (const group of ['constructor', '__proto__', '/accounts', 'accounts?x=1', 'accounts/', null]) {
    assert.match(renderToStaticMarkup(h.StudioAdministrationView({ ...viewProps(), group })), /Okänd session/);
  }
});

test('same-origin transport validates exact API base, method/action and explicit activation before fetch', async () => {
  const h = harness(); let calls = 0;
  const base = { apiBase: '/studio/api/admin', session: async () => actor('superadmin'), availableActions: allActions, fetchImpl: async () => { ++calls; return reply({ ok: true }); } };
  for (const apiBase of ['https://outside.test/api/admin', '//outside.test/api/admin', '/studio/studio/api/admin', '/api/admin/', '/api/admin?x=1', null]) await assert.rejects(h.createStudioAdminClient({ ...base, apiBase }).request('GET', 'config'), status(400));
  const client = h.createStudioAdminClient(base);
  for (const action of ['constructor', '__proto__', 'config/', 'config?token=hidden', '../config', 'https://outside.test/config', 'clip-assign', null, {}, []]) await assert.rejects(client.request('GET', action), status(400));
  for (const method of ['get', 'PUT', 'DELETE', null]) await assert.rejects(client.request(method, 'config'), status(400));
  await assert.rejects(client.request('GET', 'config', {}), status(400));
  await assert.rejects(h.createStudioAdminClient({ ...base, availableActions: [] }).request('GET', 'config'), status(501));
  assert.equal(calls, 0);
  for (const apiBase of ['/api/admin', '/studio/api/admin']) {
    let request;
    await h.createStudioAdminClient({ ...base, apiBase, fetchImpl: async (...args) => { request = args; return reply({ revision: 'studio-v1' }); } }).request('GET', 'config');
    assert.equal(request[0], `${apiBase}/config`);
    assert.equal(request[1].credentials, 'same-origin'); assert.equal(request[1].redirect, 'error'); assert.equal(request[1].cache, 'no-store');
  }
});

test('menu changes fetch only displayed resources and keep a live identity check for every read', async () => {
  const h = harness(); const requests = []; let identities = 0;
  const data = resources();
  const props = { apiBase: '/studio/api/admin', availableActions: allActions,
    session: async () => { ++identities; return actor('admin'); },
    fetchImpl: async (url, init) => {
      requests.push({ url, method: init.method });
      return reply(data[url.slice('/studio/api/admin/'.length)]?.payload);
    } };
  h.render(props); h.effects(); await flush(); let tree = h.render(props);
  for (const [group, menu, reads] of [
    ['operations', 'Drift & spelintegritet', ['overview', 'shoes']],
    ['tables', 'Spel, lanes & bord', ['config']],
    ['accounts', 'Konton', ['players', 'users']],
    ['partners', 'Partner', ['apikeys', 'emails']],
    ['finance', 'Betalningar & journal', ['transactions']],
    ['media-review', 'Talgranskning', ['config', 'voicelines']],
  ]) {
    if (group !== 'operations') {
      requests.length = 0; identities = 0;
      buttons(tree, menu)[0].props.onClick(); h.render(props); h.effects(); await flush(); tree = h.render(props);
    }
    assert.deepEqual(requests, reads.map(action => ({ url: `/studio/api/admin/${action}`, method: 'GET' })), group);
    assert.equal(identities, reads.length + 1, group);
    const view = nodes(tree, node => node.type === h.StudioAdministrationView)[0];
    assert.equal(view.props.group, group);
    assert.deepEqual(Object.keys(view.props.resources), reads, group);
    assert.ok(reads.every(action => view.props.resources[action].payload), group);
  }
  h.unmount();
});

test('each request checks live identity, role floors and self-role/self-removal before a write', async () => {
  const h = harness(); let current = actor('superadmin'); let fetches = 0;
  const client = h.createStudioAdminClient({ apiBase: '/api/admin', availableActions: allActions, session: async () => current, fetchImpl: async () => { ++fetches; return reply({ ok: true }); } });
  await assert.rejects(client.request('POST', 'users/role', { username: current.username, role: 'reader' }), status(403));
  await assert.rejects(client.request('POST', 'users/remove', { username: current.username }), status(403));
  await assert.rejects(client.request('POST', 'users/remove', { username: ' OWNER@EXAMPLE.TEST ' }), status(403));
  await assert.rejects(client.request('POST', 'users/role', { username: 'other', role: '__proto__' }), status(400));
  current = actor('reader');
  await assert.rejects(client.request('POST', 'players/create', { username: 'test-one' }), status(401));
  await assert.rejects(client.request('GET', 'users'), status(401));
  current = { username: 'user', role: 'invalid' };
  await assert.rejects(client.request('GET', 'config'), status(401));
  assert.equal(fetches, 0);
});

test('all config mutations carry exact string revision; no numeric/missing/prototype CAS fallback', async () => {
  const h = harness(); let requests = [];
  const client = h.createStudioAdminClient({ apiBase: '/studio/api/admin', session: async () => actor('superadmin'), availableActions: allActions, fetchImpl: async (url, init) => { requests.push({ url, body: JSON.parse(init.body) }); return reply({ ok: true }); } });
  const configActions = ['room', 'tier', 'pitboss', 'tournament', 'voiceline-review', 'clip-landing', 'clip-never', 'gen-landing', 'gen-verdict'];
  for (const action of configActions) {
    for (const expectedRevision of [undefined, null, 0, 1, [], {}, 'bad revision', '/external', 'x'.repeat(101)]) await assert.rejects(client.request('POST', action, { expectedRevision }), status(409));
    await client.request('POST', action, { expectedRevision: 'studio-91ba0c61-3f45-4e9e-9efe-b40a3b201234' });
  }
  assert.equal(requests.length, configActions.length);
  assert.ok(requests.every(request => typeof request.body.expectedRevision === 'string'));
});

test('activated partner actions use explicit transient projections while paid speech QA stays gated', async () => {
  const h = harness(); let fetches = 0;
  const secret = `cs_${'s'.repeat(43)}`, key = `ck_live_${'k'.repeat(24)}`;
  const responses = {
    'apikeys/create': { ok:true,key:{id:'partner-one',key,secret,note:'ARBITRARY_TEXT'},leaked:'EXTRA_SECRET' },
    'apikeys/rotate': {ok:true,id:'partner-one',secret,leaked:'EXTRA_SECRET'},
    'apikeys/launch': {ok:true,url:'https://game.example.test/game?dealer=astrid&launch=a.b.c',playerRef:'game-player',curlLines:['EXTRA_SECRET']},
    'apikeys/credit': {ok:true,playerId:'partner-player',balance:100,currency:'EUR',secret:'EXTRA_SECRET'},
  };
  const client = h.createStudioAdminClient({ apiBase:'/api/admin',gameOrigin:'https://game.example.test', availableActions:allActions,
    session:async()=>actor('superadmin'),fetchImpl:async url=>{++fetches;return reply(responses[url.slice('/api/admin/'.length)]);}});
  for (const action of ['apikeys/create','apikeys/rotate','apikeys/launch','apikeys/credit']) {
    const response = await client.request('POST',action,{});
    assert.ok(response.payload.oneTime); assert.doesNotMatch(JSON.stringify(response),/EXTRA_SECRET|ARBITRARY_TEXT|curlLines/);
  }
  await assert.rejects(client.request('POST','speech-qa',{}),status(501));
  assert.equal(fetches,4);
  const html = renderToStaticMarkup(h.StudioAdministrationView(viewProps('superadmin', 'partners')));
  assert.doesNotMatch(html, /MUST-NOT-RENDER|wallet_url|type="password"/);
  assert.match(html,/Skapa partnernyckel|Rotera hemlighet/); assert.match(html, /Återkalla partnernyckel/);
});

test('partner result projection rejects malformed credentials and cross-origin/ambiguous launch URLs', () => {
  const h = harness();
  for (const payload of [{key:{id:'partner-one',key:'short',secret:`cs_${'s'.repeat(43)}`}},{key:{id:'partner-one',key:`ck_live_${'k'.repeat(24)}`,secret:'short'}}]) {
    assert.throws(()=>h.studioPartnerResult('apikeys/create',payload),status(503));
  }
  for (const url of ['https://outside.test/game?dealer=astrid&launch=a.b.c','http://game.example.test/game?dealer=astrid&launch=a.b.c',
    'https://game.example.test/other?dealer=astrid&launch=a.b.c','https://game.example.test/game?dealer=astrid&launch=a.b.c&launch=x.y.z',
    'https://game.example.test/game?dealer=wrong&launch=a.b.c','https://game.example.test/game?dealer=astrid&launch=bad',
    'https://game.example.test/game?dealer=astrid&launch=a.b.c#secret']) {
    assert.throws(()=>h.studioPartnerResult('apikeys/launch',{url,playerRef:'player'},'https://game.example.test'),status(503));
  }
  assert.throws(()=>h.studioPartnerResult('apikeys/credit',{playerId:'player',balance:NaN,currency:'EUR'}),status(503));
});

test('partner forms retain explicit role/scopes/wallet boundaries and send only task fields', () => {
  const h = harness(), calls = [], data = resources();
  data.apikeys.payload.keys[0].scopes = ['launch','wallet']; data.apikeys.payload.keys[0].walletConfigured = false;
  const tree = h.StudioAdministrationView({...viewProps('admin','partners'),resources:data,command:(action,body)=>calls.push({action,body})});
  assert.equal(buttons(tree,'Skapa partnernyckel').length,1); assert.equal(buttons(tree,'Rotera hemlighet').length,1);
  const formFor = text => nodes(tree,node=>node.type==='form' && buttons(node,text).length)[0];
  formFor('Skapa spellänk').props.onSubmit({preventDefault(){},currentTarget:new Form({playerId:'partner-player',displayName:'Player',currency:'EUR',language:'en'})});
  formFor('Kreditera demo-saldo').props.onSubmit({preventDefault(){},currentTarget:new Form({playerId:'partner-player',amount:'12.50'})});
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
    {action:'apikeys/launch',body:{id:'partner-one',playerId:'partner-player',displayName:'Player',currency:'EUR',language:'en'}},
    {action:'apikeys/credit',body:{id:'partner-one',playerId:'partner-player',amount:12.5}},
  ]);
  data.apikeys.payload.keys[0].walletConfigured = true;
  assert.equal(buttons(h.StudioAdministrationView({...viewProps('admin','partners'),resources:data}),'Kreditera demo-saldo').length,0);
});

test('one-time credential display clears on explicit reload/group change and never enters account metadata', async () => {
  const h = harness(), secret = `cs_${'s'.repeat(43)}`, key = `ck_live_${'k'.repeat(24)}`;
  const props = {apiBase:'/api/admin',availableActions:allActions,session:async()=>actor('superadmin'),fetchImpl:async(url,init)=>
    init.method==='POST' ? reply({ok:true,key:{id:'partner-one',key,secret}}) : reply(url.endsWith('/config') ? config() : url.endsWith('/apikeys') ? resources().apikeys.payload : resources().overview.payload)};
  h.render(props); h.effects(); await flush(); let tree = h.render(props);
  buttons(tree,'Partner')[0].props.onClick(); h.render(props); h.effects(); await flush(); tree = h.render(props);
  let native = nodes(tree,node=>node.type===h.StudioAdministrationView)[0];
  native.props.command('apikeys/create',{name:'Example'}); await flush(); tree = h.render(props);
  assert.match(renderToStaticMarkup(tree),new RegExp(secret));
  native = nodes(tree,node=>node.type===h.StudioAdministrationView)[0];
  assert.equal(JSON.stringify(native.props.resources).includes(secret),false);
  buttons(tree,'Ladda om från servern')[0].props.onClick(); await flush(); tree = h.render(props);
  assert.doesNotMatch(renderToStaticMarkup(tree),new RegExp(secret));
  nodes(tree,node=>node.type===h.StudioAdministrationView)[0].props.command('apikeys/create',{name:'Example'}); await flush(); tree=h.render(props);
  assert.match(renderToStaticMarkup(tree),new RegExp(secret));
  buttons(tree,'Konton')[0].props.onClick(); tree=h.render(props);
  assert.doesNotMatch(renderToStaticMarkup(tree),new RegExp(secret)); h.unmount();
});

test('keys/invite responses are projected before state, and server errors never echo secret bodies', async () => {
  const h = harness(); let response = { keys: [{ id: 'partner-one', name: 'Safe name', key: 'SECRET_KEY', secret: 'SECRET_HMAC', scopes: ['play', 'other'], wallet_url: 'https://wallet.test/?secret=SECRET_URL' }] };
  const client = h.createStudioAdminClient({ apiBase: '/api/admin', availableActions: allActions, session: async () => actor('superadmin'), fetchImpl: async () => reply(response) });
  const keys = await client.request('GET', 'apikeys');
  assert.doesNotMatch(JSON.stringify(keys.payload), /SECRET|wallet_url|other/); assert.equal(keys.payload.keys[0].walletConfigured, true);
  assert.equal(h.partnerMetadata([{ id: 'native-key', wallet_configured: true }])[0].walletConfigured, true);
  response = { ok: true, emailSent: false, link: 'https://reset.test/?token=SECRET_INVITE', secret: 'SECRET' };
  const invite = await client.request('POST', 'users/invite', { email: 'other@example.test', role: 'reader' });
  assert.deepEqual(JSON.parse(JSON.stringify(invite.payload)), { ok: true, emailSent: false });
  for (const code of [400, 401, 403, 409, 422, 503]) {
    const denied = h.createStudioAdminClient({ apiBase: '/api/admin', availableActions: allActions, session: async () => actor('superadmin'), fetchImpl: async () => reply({ error: 'SECRET_DB_URL' }, code) });
    await assert.rejects(denied.request('GET', 'players'), error => error.status === code && !error.message.includes('SECRET'));
  }
});

test('malformed list payloads are unavailable, never a fabricated empty account/key/journal list', async () => {
  const h = harness();
  const client = h.createStudioAdminClient({ apiBase: '/api/admin', availableActions: allActions, session: async () => actor('superadmin'), fetchImpl: async () => reply({ ok: true }) });
  for (const action of ['players', 'users', 'transactions', 'apikeys', 'voicelines']) await assert.rejects(client.request('GET', action), status(503));
  const unconfirmed = h.createStudioAdminClient({ apiBase: '/api/admin', availableActions: allActions, session: async () => actor('superadmin'), fetchImpl: async () => reply({}) });
  await assert.rejects(unconfirmed.request('POST', 'users/remove', { username: 'other' }), status(503));
});

test('admin is the only Studio UI role; superadmin is a legacy alias and nonadmins have no controls', () => {
  const h = harness();
  for (const role of ['reader','staff','player']) for (const group of navigation.BACKOFFICE_GROUPS) {
    const tree = h.StudioAdministrationView(viewProps(role, group.id));
    assert.equal(nodes(tree, node => node.type === 'form' || node.type === 'button').length, 0);
    assert.match(renderToStaticMarkup(tree), /Okänd session/);
  }
  for (const role of ['admin','superadmin']) {
    const tree = h.StudioAdministrationView(viewProps(role,'accounts')),html=renderToStaticMarkup(tree);
    assert.match(html,/Skapa spelarkonto|Bjud in Studio-administratör/);assert.match(html,/Ditt eget konto: rollbyte och borttagning är spärrade/);
    assert.equal(buttons(tree,'Spara roll').length,1);assert.equal(buttons(tree,'Ta bort konto').length,1);
    assert.doesNotMatch(html,/<option[^>]*>(reader|staff|superadmin)<\/option>/);
    assert.match(html,/Administratör/);assert.match(html,/Spelare/);
  }
  assert.equal(h.studioAdminActor(actor('superadmin')).role,'admin');
});

test('account creation distinguishes game-only players from emailed Studio administrator activation', () => {
  const h = harness(), calls = [];
  const tree = h.StudioAdministrationView({ ...viewProps('admin'), command: (action, body) => calls.push({ action, body }) });
  const playerDisclosure = nodes(tree, node => node.type === 'details' && buttons(node, 'Skapa spelarkonto').length)[0];
  const invitationDisclosure = nodes(tree, node => node.type === 'details' && buttons(node, 'Skicka inbjudan').length)[0];
  const playerHtml = renderToStaticMarkup(playerDisclosure), invitationHtml = renderToStaticMarkup(invitationDisclosure);
  assert.match(playerHtml, /<summary>Skapa spelarkonto<\/summary>/);
  assert.match(playerHtml, /ingen administratörsbehörighet eller Studioåtkomst/);
  assert.match(invitationHtml, /<summary>Bjud in Studio-administratör<\/summary>/);
  assert.match(invitationHtml, /e-postadress/); assert.match(invitationHtml, /aktiveras.*väljer lösenord via mejlet/);
  assert.equal(nodes(invitationDisclosure, node => node.type === 'input' && node.props.name === 'email')[0].props.type, 'email');
  assert.equal(calls.length, 0);
  nodes(invitationDisclosure, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {}, currentTarget: new Form({ email: 'new-admin@example.test', role: 'admin' }) });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ action: 'users/invite', body: { email: 'new-admin@example.test', role: 'admin' } }]);
});

test('missing mail capability explains why Studio invitations are unavailable while player creation stays game-only', () => {
  const h = harness(), props = viewProps('admin');
  const tree = h.StudioAdministrationView({ ...props, available: (method, action) => available(method, action) && !['users/invite', 'users/resend'].includes(action) });
  const html = renderToStaticMarkup(tree);
  assert.match(html, /E-post för Studio behöver konfigureras innan administratörsinbjudningar kan skickas/);
  assert.match(html, /Att skapa ett spelarkonto ger inte Studioåtkomst/);
  assert.equal(buttons(tree, 'Skicka inbjudan').length, 0);
  assert.equal(buttons(tree, 'Skicka nytt aktiverings-/återställningsmejl').length, 0);
  assert.equal(buttons(tree, 'Skapa spelarkonto').length, 1);
  assert.doesNotMatch(html, /users\/(invite|resend)|RESEND_API_KEY|CROUPIER_STUDIO_MAIL_FROM/);
  assert.doesNotMatch(renderToStaticMarkup(h.StudioAdministrationView(props)), /E-post för Studio behöver konfigureras/);
});

test('stored game-only user roles require an explicit new role rather than displaying a selected administrator role', () => {
  const h = harness();
  for (const role of ['reader', 'staff', 'player', 'admin', 'superadmin']) {
    const data = resources(), calls = [];
    data.users.payload.users = [{ username: 'other@example.test', role, active: 1 }];
    const tree = h.StudioAdministrationView({ ...viewProps('admin'), resources: data, command: (action, body) => calls.push({ action, body }) });
    const form = nodes(tree, node => node.type === 'form' && buttons(node, 'Spara roll').length)[0];
    const select = nodes(form, node => node.type === 'select' && node.props.name === 'role')[0];
    const html = renderToStaticMarkup(select), administrator = ['admin', 'superadmin'].includes(role);
    assert.match(html, /required=""/);
    assert.match(html, administrator ? /<option value="admin" selected="">Administratör/ : /<option value="" disabled="" selected="">Välj ny roll/);
    assert.equal(calls.length, 0); assert.equal(data.users.payload.users[0].role, role);
    form.props.onSubmit({ preventDefault() {}, currentTarget: new Form({ role: 'admin' }) });
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ action: 'users/role', body: { username: 'other@example.test', role: 'admin' } }]);
  }
});

test('player lifecycle is create/status, never hard delete or reopening closed accounts; inactive action is explicit', () => {
  const h = harness(); const tree = h.StudioAdministrationView(viewProps('admin', 'accounts'));
  assert.equal(buttons(tree, 'Ändra spelarstatus').length, 1);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Stängt konto – ingen återöppning/); assert.match(html, /12–128 tecken/); assert.doesNotMatch(html, /Ta bort spelare/);
  const unavailable = renderToStaticMarkup(h.StudioAdministrationView({ ...viewProps('admin', 'accounts'), available: (method, action) => available(method, action) && action !== 'players/status' }));
  assert.match(unavailable, /players\/status är ännu inte ansluten/); assert.doesNotMatch(unavailable, /Ändra spelarstatus/);
});

test('active forms emit established payloads, string CAS and cleared password input without render writes', () => {
  const h = harness(); const calls = [];
  let tree = h.StudioAdministrationView({ ...viewProps('admin', 'tables'), command: (action, body) => calls.push({ action, body }) });
  const formFor = text => nodes(tree, node => node.type === 'form' && buttons(node, text).length)[0];
  formFor('Spara rum').props.onSubmit({ preventDefault() {}, currentTarget: new Form({ state: 'pending' }) });
  formFor('Spara dealer').props.onSubmit({ preventDefault() {}, currentTarget: new Form({ dealer: 'mei' }) });
  assert.equal(calls.length, 2); assert.ok(calls.every(call => call.body.expectedRevision === 'studio-v1'));
  formFor('Spara aktiv lane').props.onSubmit({ preventDefault() {}, currentTarget: new Form({ lane: 'mobile-phone' }) });
  assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))), { action: 'game-lane', body: { lane: 'mobile-phone', expectedRevision: 'studio-v1' } });
  tree = h.StudioAdministrationView({ ...viewProps('admin'), command: (action, body) => calls.push({ action, body }) });
  const playerForm = new Form({ username: 'test-one', name: 'Tester', password: 'temporary-password', currency: 'SEK', reason: 'Demo' });
  formFor('Skapa spelarkonto').props.onSubmit({ preventDefault() {}, currentTarget: playerForm });
  assert.equal(playerForm.passwordInput.value, ''); assert.equal(calls.at(-1).body.password, 'temporary-password');
  assert.equal(calls.at(-1).action, 'players/create');
});

test('retired tournament, pitboss and empty legacy galleries are absent while source data remains intact', () => {
  const h = harness(); const data = resources(); const original = JSON.stringify(data);
  data.emails.payload.templates.push({ id: 'tournament-invite', name: 'Tournament invite' });
  const html = navigation.BACKOFFICE_GROUPS.map(group => renderToStaticMarkup(h.StudioAdministrationView({ ...viewProps('admin', group.id), resources: data }))).join('');
  assert.doesNotMatch(html, /Pit bosses|Turneringar|Skapa turneringsutkast|Spara pit bosses|Existing tournament|Tournament invite|Äldre klipp och granskning|Genererat material|data-admin-section="(pit|tours|clips|gens)"/);
  data.emails.payload.templates.pop(); assert.equal(JSON.stringify(data), original);
  assert.equal(data.config.payload.tournaments.length, 1); assert.equal(data.config.payload.pitboss.randomWalkMin, 45);
});

test('secondary lane and account forms remain functional inside closed disclosures', () => {
  const h = harness();
  for (const [group, action] of [['tables', 'Lägg till lane med porträttvideo'], ['accounts', 'Skapa spelarkonto'], ['accounts', 'Ändra spelarstatus'], ['partners', 'Skapa partnernyckel']]) {
    const tree = h.StudioAdministrationView(viewProps('admin', group));
    const disclosure = nodes(tree, node => node.type === 'details' && buttons(node, action).length)[0];
    assert.ok(disclosure, action); assert.notEqual(disclosure.props.open, true);
    assert.ok(nodes(disclosure, node => node.type === 'form' && node.props.method === 'post').length);
  }
});

test('config writes disappear without valid revision while read data and honest limitations remain', () => {
  const h = harness();
  for (const revision of [undefined, 1, {}, 'bad revision']) {
    const data = resources(); data.config.payload.revision = revision;
    const html = renderToStaticMarkup(h.StudioAdministrationView({ ...viewProps('superadmin', 'tables'), resources: data }));
    assert.match(html, /konfigurationsrevision saknas/); assert.doesNotMatch(html, /<form/); assert.match(html, /Test room/);
  }
  const html = renderToStaticMarkup(h.StudioAdministrationView(viewProps('superadmin', 'operations')));
  assert.match(html, /Certifieringsunderlag: saknas/); assert.match(html,/Cut card efter 312/);assert.doesNotMatch(html, /CERTIFIED|VALID/);
});

test('media preview allowlist refuses external/query/traversal URLs and manual review uses exact line/dealer/revision', () => {
  const h = harness();
  for (const url of ['https://outside.test/a.mp4', '//outside.test/a.mp4', '/dealers/astrid/../a.mp4', '/dealer/a.mp4?token=secret', '/api/admin/config.mp4', '/dealer//a.mp4', 'javascript:alert(1)', null]) assert.equal(h.studioAdminMediaUrl(url), null);
  assert.equal(h.studioAdminMediaUrl('/dealer/preview/line.mp4'), '/dealer/preview/line.mp4');
  const calls = [];
  const tree = h.StudioAdministrationView({ ...viewProps('admin', 'media-review'), command: (action, body) => calls.push({ action, body }) });
  assert.equal(nodes(tree, node => node.type === 'video' && node.props.preload === 'none').length, 1);
  nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {}, currentTarget: new Form({ verdict: 'approved' }) });
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { action: 'voiceline-review', body: { dealer: 'astrid', line: 'goodluck', verdict: 'approved',expectedIdentity:'exact-pair-fixture', expectedRevision: 'studio-v1' } });
  assert.match(renderToStaticMarkup(tree), /Betald speech-QA körs inte/);
});

test('native mail previews escape content, render placeholders and never send or navigate',()=>{
  const h=harness();const tree=h.StudioAdministrationView(viewProps('admin','partners'));
  const html=renderToStaticMarkup(tree);
  assert.match(html,/Hello &lt;script&gt;/);assert.match(html,/\[PLAYER EMAIL\]/);
  assert.doesNotMatch(html,/<iframe|<script|srcDoc|dangerouslySetInnerHTML/);
  assert.equal(buttons(tree,'Take a seat').length,0);assert.match(html,/Take a seat/);
});

test('revoked session clears old account data/controls, and explicit reload recovers without a local fallback', async () => {
  const h = harness(); let current = actor('admin'); let count = 0;
  const data = resources();
  const props = { apiBase: '/api/admin', availableActions: ['GET overview', 'GET shoes'], session: async () => current, fetchImpl: async url => { ++count; return reply(data[url.slice('/api/admin/'.length)].payload); } };
  h.render(props); h.effects(); await flush();
  let tree = h.render(props); assert.match(renderToStaticMarkup(tree), /owner@example.test/); assert.equal(count, 2);
  current = null;
  buttons(tree, 'Ladda om från servern')[0].props.onClick(); await flush(); tree = h.render(props);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Sessionen är avslutad/); assert.doesNotMatch(html, /owner@example.test|Backoffice-grupper/); assert.equal(count, 2);
  current = actor('admin'); buttons(tree, 'Ladda om från servern')[0].props.onClick(); await flush();
  assert.match(renderToStaticMarkup(h.render(props)), /owner@example.test · Administratör/); assert.equal(count, 4); h.unmount();
});

test('a lower role or different identity mid-load fails closed instead of retaining stale controls', async () => {
  for (const [changedActor, notice] of [
    [actor('reader'), /Sessionen är avslutad/],
    [{ username: 'other@example.test', role: 'admin' }, /Behörigheten saknas eller har ändrats/],
  ]) {
    const h = harness(); let identities = 0; const data = resources();
    const props = { apiBase: '/api/admin', availableActions: ['GET overview', 'GET shoes'],
      session: async () => ++identities === 1 ? actor('superadmin') : changedActor,
      fetchImpl: async url => reply(data[url.slice('/api/admin/'.length)].payload) };
    h.render(props); h.effects(); await flush();
    const html = renderToStaticMarkup(h.render(props));
    assert.match(html, notice); assert.doesNotMatch(html, /Backoffice-grupper|owner@example.test|other@example.test|superadmin/); h.unmount();
  }
});

test('unmount aborts read transaction before fetch; no background mutation or late UI result', async () => {
  const h = harness(); let release; let calls = 0;
  const waiting = new Promise(resolve => { release = resolve; });
  const props = { apiBase: '/api/admin', availableActions: ['GET config', 'GET overview'], session: async () => { await waiting; return actor('admin'); }, fetchImpl: async () => { ++calls; return reply(config()); } };
  h.render(props); h.effects(); h.unmount(); release(); await flush();
  assert.equal(calls, 0); assert.equal(h.listeners.has('beforeunload'), false);
});

test('draft guard survives reload/conflict, protects native unload and cancelled local group change', async () => {
  const h = harness(); const props = { apiBase: '/api/admin', availableActions: allActions, session: async () => actor('superadmin'), fetchImpl: async (url, init) => init.method === 'POST' ? reply({ error: 'conflict' }, 409) : reply(url.endsWith('/config') ? config() : resources().overview.payload) };
  h.render(props); h.effects(); await flush(); let tree = h.render(props);
  buttons(tree, 'Spel, lanes & bord')[0].props.onClick(); h.render(props); h.effects(); await flush(); tree = h.render(props);
  const nativeView = () => nodes(tree, node => node.type === h.StudioAdministrationView)[0];
  const firstForm = new Form({ state: 'live' }); nativeView().props.onDirty(firstForm);
  let prevented = false; h.listeners.get('beforeunload')({ preventDefault() { prevented = true; }, returnValue: undefined }); assert.equal(prevented, true);
  h.window.confirm = () => false;
  buttons(tree, 'Konton')[0].props.onClick(); tree = h.render(props);
  assert.equal(nodes(tree, node => node.type === h.StudioAdministrationView)[0].props.group, 'tables');
  nativeView().props.command('room', { id: 'room-one', state: 'live', expectedRevision: 'studio-v1' }, firstForm); await flush(); tree = h.render(props);
  assert.match(renderToStaticMarkup(tree), /Uppgifterna har ändrats|Osparade formulärfält/); assert.equal(firstForm.resets, 0);
  buttons(tree, 'Ladda om från servern')[0].props.onClick(); await flush(); tree = h.render(props);
  assert.match(renderToStaticMarkup(tree), /Osparade formulärfält/); assert.equal(firstForm.resets, 0); h.unmount();
});

test('saving one form preserves other drafts; double command cannot send two writes and passwords are cleared', async () => {
  const h = harness(); let writes = 0; let submitted;
  const props = { apiBase: '/api/admin', availableActions: allActions, session: async () => actor('admin'), fetchImpl: async (url, init) => {
    if (init.method === 'POST') { ++writes; submitted = JSON.parse(init.body); return reply({ ok: true }); }
    return reply(url.endsWith('/config') ? config() : url.endsWith('/players') ? resources().players.payload : url.endsWith('/users') ? resources().users.payload : resources().overview.payload);
  } };
  h.render(props); h.effects(); await flush(); let tree = h.render(props);
  buttons(tree, 'Konton')[0].props.onClick(); h.render(props); h.effects(); await flush(); tree = h.render(props);
  const native = nodes(tree, node => node.type === h.StudioAdministrationView)[0];
  const saved = new Form({ username: 'test-one' }), other = new Form({ reason: 'Unsaved draft' });
  native.props.onDirty(saved); native.props.onDirty(other);
  const body = { username: 'test-one', password: 'temporary-password' };
  native.props.command('players/create', body, saved); native.props.command('players/create', { username: 'duplicate' }, saved);
  await flush(); tree = h.render(props);
  assert.equal(writes, 1); assert.equal(submitted.password, 'temporary-password'); assert.equal(Object.hasOwn(body, 'password'), false);
  assert.equal(saved.resets, 1); assert.equal(other.resets, 0);
  assert.match(renderToStaticMarkup(tree), /Osparade formulärfält/); h.unmount();
});

test('reload cannot silently rebase an edited config form; only confirmed discard remounts it', async () => {
  const h = harness(); let revision = 'studio-v1'; const writes = [];
  const props = { apiBase: '/api/admin', availableActions: allActions, session: async () => actor('admin'), fetchImpl: async (url, init) => {
    if (init.method === 'POST') { writes.push(JSON.parse(init.body)); return reply({ error: 'conflict' }, 409); }
    return reply(url.endsWith('/config') ? { ...config(), revision } : resources().overview.payload);
  } };
  h.render(props); h.effects(); await flush(); let tree = h.render(props);
  buttons(tree, 'Spel, lanes & bord')[0].props.onClick(); h.render(props); h.effects(); await flush(); tree = h.render(props);
  const native = () => nodes(tree, node => node.type === h.StudioAdministrationView)[0];
  const draft = new Form({ state: 'live' }); native().props.onDirty(draft); tree = h.render(props);
  const oldKey = native().key;
  revision = 'studio-v2'; buttons(tree, 'Ladda om från servern')[0].props.onClick(); await flush(); tree = h.render(props);
  assert.equal(native().props.resources.config.payload.revision, 'studio-v2'); assert.equal(native().key, oldKey);
  native().props.command('room', { id: 'room-one', state: 'live', expectedRevision: 'studio-v2' }, draft); await flush(); tree = h.render(props);
  assert.equal(writes[0].expectedRevision, 'studio-v1'); assert.equal(draft.resets, 0);
  h.window.confirm = () => false; buttons(tree, 'Kasta formulärutkast och läs om')[0].props.onClick(); tree = h.render(props);
  assert.equal(native().key, oldKey); assert.match(renderToStaticMarkup(tree), /Osparade formulärfält/);
  h.window.confirm = () => true; buttons(tree, 'Kasta formulärutkast och läs om')[0].props.onClick(); await flush(); tree = h.render(props);
  assert.notEqual(native().key, oldKey); assert.doesNotMatch(renderToStaticMarkup(tree), /Osparade formulärfält/); h.unmount();
});

test('acknowledged write plus unavailable reload is not advertised as fully refreshed success', async () => {
  const h = harness(); let written = false;
  const props = { apiBase: '/api/admin', availableActions: allActions, session: async () => actor('admin'), fetchImpl: async (url, init) => {
    if (init.method === 'POST') { written = true; return reply({ ok: true }); }
    if (written) return reply({ error: 'SECRET_DB_ERROR' }, 503);
    return reply(url.endsWith('/config') ? config() : resources().overview.payload);
  } };
  h.render(props); h.effects(); await flush(); let tree = h.render(props);
  buttons(tree, 'Spel, lanes & bord')[0].props.onClick(); h.render(props); h.effects(); await flush(); tree = h.render(props);
  const native = nodes(tree, node => node.type === h.StudioAdministrationView)[0]; const form = new Form({ state: 'live' });
  native.props.onDirty(form); native.props.command('room', { id: 'room-one', state: 'live', expectedRevision: 'studio-v1' }, form);
  await flush(); tree = h.render(props); const html = renderToStaticMarkup(tree);
  assert.match(html, /Skicka inte samma åtgärd igen/); assert.doesNotMatch(html, /Tillgänglig serverdata har lästs om|SECRET_DB_ERROR/); assert.equal(form.resets, 0); h.unmount();
});


test('Backoffice password form confirms twice, clears both fields and excludes closed accounts', () => {
  const h=harness(),calls=[];
  const tree=h.StudioAdministrationView({...viewProps('admin'),command:(action,body)=>calls.push({action,body})});
  const forms=nodes(tree,node=>node.type==='form' && buttons(node,'Spara nytt lösenord').length);
  assert.equal(forms.length,1);
  const mismatch=new Form({password:'fixture-new-password',confirm:'different-password',reason:'Operator reset'});
  forms[0].props.onSubmit({preventDefault(){},currentTarget:mismatch});
  assert.equal(calls.length,0);assert.equal(mismatch.passwordInput.value,'');assert.equal(mismatch.confirmInput.value,'');
  assert.equal(mismatch.confirmInput.reported,true);assert.match(mismatch.confirmInput.validationMessage,/stämmer inte/);
  const form=new Form({password:'fixture-new-password',confirm:'fixture-new-password',reason:' Operator reset '});
  forms[0].props.onSubmit({preventDefault(){},currentTarget:form});
  assert.equal(form.passwordInput.value,'');assert.equal(form.confirmInput.value,'');
  assert.equal(calls.length,1);assert.equal(calls[0].action,'players/password');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body)),{playerId:'player-active',password:'fixture-new-password',reason:'Operator reset'});
  assert.doesNotMatch(renderToStaticMarkup(tree),/fixture-new-password|different-password/);
  const blocked=resources();blocked.players.payload.players[0].status='blocked';
  assert.equal(buttons(h.StudioAdministrationView({...viewProps('admin'),resources:blocked}),'Spara nytt lösenord').length,1);
  const craigOnly=resources();craigOnly.players.payload.players[0].passwordChangeAllowed=false;
  assert.equal(buttons(h.StudioAdministrationView({...viewProps('admin'),resources:craigOnly}),'Spara nytt lösenord').length,0);
  delete craigOnly.players.payload.players[0].passwordChangeAllowed;
  assert.equal(buttons(h.StudioAdministrationView({...viewProps('admin'),resources:craigOnly}),'Spara nytt lösenord').length,0);
  const unavailable=h.StudioAdministrationView({...viewProps('admin'),available:(method,action)=>available(method,action)&&action!=='players/password'});
  assert.equal(buttons(unavailable,'Spara nytt lösenord').length,0);assert.match(renderToStaticMarkup(unavailable),/players\/password är ännu inte ansluten/);
});

test('password command is single dispatch, never stores the password and does not retry an uncertain failure', async () => {
  const h=harness();let writes=0,release,submitted;
  const waiting=new Promise(resolve=>{release=resolve;});
  const props={apiBase:'/studio/api/admin',availableActions:allActions,session:async()=>actor('admin'),fetchImpl:async(url,init)=>{
    if(init.method==='POST'){++writes;submitted=JSON.parse(init.body);await waiting;return reply({error:'PRIVATE SERVER TEXT'},503);}
    const key=url.slice(url.lastIndexOf('/')+1);return reply(resources()[key]?.payload||resources().overview.payload);
  }};
  h.render(props);h.effects();await flush();let tree=h.render(props);
  buttons(tree,'Konton')[0].props.onClick();h.render(props);h.effects();await flush();tree=h.render(props);
  const view=nodes(tree,node=>node.type===h.StudioAdministrationView)[0],body={playerId:'player-active',password:'fixture-new-password',reason:'Operator reset'};
  view.props.command('players/password',body,new Form({}));view.props.command('players/password',{...body},new Form({}));
  await flush();assert.equal(writes,1);assert.equal(submitted.password,'fixture-new-password');
  assert.doesNotMatch(renderToStaticMarkup(h.render(props)),/fixture-new-password/);
  release();await flush();await flush();tree=h.render(props);
  assert.equal(writes,1);assert.equal(Object.hasOwn(body,'password'),false);
  assert.doesNotMatch(renderToStaticMarkup(tree),/fixture-new-password|PRIVATE SERVER TEXT/);
  assert.match(renderToStaticMarkup(tree),/tillfälligt otillgänglig/);h.unmount();
});
