import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as policy from '../lib/studio-access-policy.mjs';
import * as contract from '../lib/studio-admin-contract.mjs';
import * as navigation from '../lib/backoffice-navigation.mjs';
import * as gameLanes from '../../web/public/game-lanes.mjs';
import { createStudioAdminApi } from '../lib/studio-admin-api.mjs';
import { createStudioNativeAuth } from '../lib/studio-native-auth.mjs';

const require = createRequire(import.meta.url);
const DealerClipPreview = () => React.createElement('div', {'data-keyed-preview': true});
const { transformSync } = require('next/dist/build/swc');
const navigationSource = readFileSync(new URL('./studio-navigation.tsx', import.meta.url), 'utf8');
const navigationModule = { exports: {} };
vm.runInNewContext(transformSync(navigationSource, {
  filename: 'studio-navigation.tsx',
  jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
  module: { type: 'commonjs' },
}).code, { module: navigationModule, exports: navigationModule.exports,
  require: name => name.endsWith('.module.css') ? { __esModule: true, default: {} } : require(name) });
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
  const hooks = []; let cursor = 0, generatedKeys = 0;
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
    crypto: { randomUUID: () => '10000000-0000-4000-8000-' + String(++generatedKeys).padStart(12, '0') },
    FormData: TestFormData, HTMLElement: Element, HTMLFormElement: Form, HTMLInputElement: Input,
    fetch() { throw new Error('Unexpected real fetch'); },
    require: name => name === './dealer-video-surface' ? {DealerClipPreview} : name === './studio-navigation' ? navigationModule.exports : name === 'react' ? fakeReact
      : name.endsWith('.module.css') ? { __esModule: true, default: {} }
        : name === '../lib/studio-access-policy.mjs' ? policy
          : name === '../lib/studio-admin-contract.mjs' ? contract
            : name === '../lib/backoffice-navigation.mjs' ? navigation
              : name === '../../web/public/game-lanes.mjs' ? gameLanes : require(name),
  });
  return {
    ...module.exports, listeners, window,
    get generatedKeys() { return generatedKeys; },
    renderLane(props) { cursor = 0; return module.exports.TechnicalLaneCreate(props); },
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

test('native administration preserves its standalone shell and embeds without a second main landmark', () => {
  const module = { exports: {} }, views = [];
  const nativeSource = readFileSync(new URL('./native-administration.tsx', import.meta.url), 'utf8');
  vm.runInNewContext(transformSync(nativeSource, {
    filename: 'native-administration.tsx',
    jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  }).code, { module, exports: module.exports,
    require: name => name === './studio-administration'
      ? { StudioAdministration: props => { views.push(props); return React.createElement('section', { 'data-native-view': true }); }, StudioAdminUiError: Error }
      : name === '../lib/studio-login-client.mjs'
        ? { createStudioLoginClient: () => assert.fail('render must not change the session'), StudioLoginUiError: Error }
        : name.endsWith('.module.css')
          ? { __esModule: true, default: { shell: 'standalone-shell', embedded: 'embedded-shell' } } : require(name),
  });
  const props = { apiBase: '/studio/api/admin', availableActions: ['GET overview'], gameOrigin: 'https://game.fixture.invalid', initialGroup: 'integrations', initialDealerId: 'astrid' };
  const standalone = renderToStaticMarkup(React.createElement(module.exports.NativeAdministration, props));
  assert.match(standalone, /^<main class="standalone-shell">/);
  assert.equal(renderToStaticMarkup(React.createElement(module.exports.NativeAdministration, { ...props, embedded: false })), standalone);
  const embedded = renderToStaticMarkup(React.createElement('main', { 'data-admin-shell': true }, React.createElement(module.exports.NativeAdministration, { ...props, embedded: true })));
  assert.equal([...embedded.matchAll(/<main\b/g)].length, 1, 'the surrounding Admin owns the page landmark');
  assert.match(embedded, /<div class="embedded-shell"><section data-native-view="true">/);
  for (const view of views) {
    for (const name of ['apiBase', 'availableActions', 'gameOrigin', 'initialGroup', 'initialDealerId']) assert.equal(view[name], props[name]);
    assert.equal(view.readIdentity, 'response-headers-v1');
    assert.equal(typeof view.session, 'function');
    assert.equal(view.sessionAction.type, 'button');
    assert.equal(view.sessionAction.props.children, 'Logga ut');
  }
  for (const view of views.slice(0, 2)) {
    assert.equal(view.roomsHref, undefined);
    assert.equal(view.companyTeamLabel, undefined);
  }
  assert.equal(views[2].roomsHref, '/admin/rooms?view=registered');
  assert.equal(views[2].companyTeamLabel, 'Bolag & team (äldre editor)');
});

function buttons(tree, text) { return nodes(tree, node => node.type === 'button' && node.props.children === text); }
function reply(payload, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } }); }
function nativeReply(payload, code = 200, current = actor('admin')) {
  const response = reply(payload, code);
  if (response.ok) {
    response.headers.set('X-Croupier-Studio-Actor', encodeURIComponent(current.username));
    response.headers.set('X-Croupier-Studio-Role', current.role);
  }
  return response;
}
function deferred() {
  let resolve;
  const promise = new Promise(accept => { resolve = accept; });
  return { promise, resolve };
}
function status(expected) { return error => error?.status === expected; }
const actor = role => ({ username: 'owner@example.test', role });
const allActions = contract.STUDIO_ADMIN_ENDPOINTS.map(endpoint => `${endpoint.method} ${endpoint.action}`);
const available = (method, action) => allActions.includes(`${method} ${action}`);
const savedDealers = ['vera','astrid','amira','mei','johanna'].map(id => ({ id, label: id[0].toUpperCase() + id.slice(1) }));
const savedGameLanes = [{schemaVersion:1,id:'mobile-phone',label:'Sparad Astrid',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'}];
const config = () => ({
  savedDealers, gameLane:'mobile-phone', gameLanes:structuredClone(savedGameLanes),
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

test('administration notices use the enclosing room destination and label team compatibility without changing its editor', () => {
  for (const group of ['tables', 'accounts', 'partners']) {
    const h = harness(), props = { apiBase: '/studio/api/admin', session: async () => actor('admin'), availableActions: allActions, initialGroup: group };
    const href = group === 'tables' ? '/control/rooms' : '/control/companies';
    const original = nodes(h.render(props), node => node.type === 'a' && node.props.href === href)[0];
    assert.ok(original, group);
    assert.equal(original.props.children, group === 'tables' ? 'Spelrum & publicering' : 'Bolag & team');
    const embedded = h.render({ ...props, roomsHref: '/admin/rooms?view=registered', companyTeamLabel: 'Bolag & team (äldre editor)' });
    const links = nodes(embedded, node => node.type === 'a');
    const target = links.find(node => node.props.href === (group === 'tables' ? '/admin/rooms?view=registered' : '/control/companies'));
    assert.ok(target, group);
    assert.equal(target.props.children, group === 'tables' ? 'Spelrum & publicering' : 'Bolag & team (äldre editor)');
    if (group === 'tables') {
      assert.equal(links.some(node => node.props.href === '/control/rooms'), false);
      assert.match(renderToStaticMarkup(embedded), /Bolagets spelbara rum och publicering hanteras via/);
    }
    h.unmount();
  }
});

// Real native authorization + admin response boundary over isolated in-memory
// rows. This never opens a database connection or mutates a real account.
function nativeReadFixture() {
  const origin = 'https://studio.fixture.invalid', scope = { environment: 'fixture', workspaceId: 'qa' };
  const clock = 2_000_000, bearer = 'b'.repeat(64);
  const user = { id: '7', username: actor('admin').username, role: 'admin', salt: 'fixture-salt', hash: 'c'.repeat(128) };
  const state = { user, epoch: 2, queries: 0, reads: 0, sessions: 0, invoked: 0 };
  const labSession = { craig_user_id: user.id, role: 'admin', source_stamp: createHash('sha256').update(`${user.salt}:${user.hash}`).digest('hex'), auth_epoch: 2, expires: clock + 60_000 };
  const boDb = {
    transaction: work => work(),
    prepare(sql) {
      async function rows(...args) {
        state.queries++;
        if (sql.includes('FROM lab_sessions')) return args[0] === createHash('sha256').update(bearer).digest('hex') && args[1] === clock ? [labSession] : [];
        if (sql.includes('FROM bo_auth_epochs')) return [{ epoch: state.epoch }];
        if (sql.includes('LEFT JOIN bo_auth_epochs')) return state.user && String(args[0]) === user.id ? [{ ...state.user, epoch: state.epoch }] : [];
        if (sql.includes('FROM users')) return state.user && String(args[0]) === user.id ? [state.user] : [];
        assert.fail('Unexpected native read fixture query');
      }
      return { all: rows, get: async (...args) => (await rows(...args))[0], run: () => assert.fail('Read transport cannot write') };
    },
  };
  const authorize = createStudioNativeAuth({ boDb, scope, now: () => clock });
  const data = resources(), handlers = new Map(Object.keys(data).map(action => [`GET /studio/api/admin/${action}`, () => { state.invoked++; return data[action].payload; }]));
  const server = createStudioAdminApi({ authorize, handlers, allowedOrigins: [origin], publicHosts: [new URL(origin).host] });
  const request = path => new Request(origin + path, { headers: { cookie: `lab_session=${bearer}` } });
  const props = { apiBase: '/studio/api/admin', readIdentity: 'response-headers-v1', availableActions: allActions,
    session: async () => { state.sessions++; const current = await authorize(request('/studio/api/auth/session')); return { username: current.user, role: current.role }; },
    fetchImpl: async (url, init) => { state.reads++; assert.equal(init.method, 'GET'); return server.handle(request(url)); },
  };
  return { state, props };
}

test('each work area retains native identity headers and only shows its own tabs', async () => {
  for (const readIdentity of ['session-preflight','response-headers-v1']) {
    for (const group of navigation.BACKOFFICE_GROUPS) {
      const h=harness(), f=nativeReadFixture(), props={...f.props,readIdentity,initialGroup:group.id};
      h.render(props);h.effects();await flush();const tree=h.render(props);
      const view=nodes(tree,node=>node.type===h.StudioAdministrationView)[0];
      assert.ok(view&&Object.values(view.props.resources).every(resource=>resource.payload),group.id);
      assert.equal(view.props.actor.role,'admin');
      assert.equal(f.state.sessions,readIdentity==='response-headers-v1'?0:f.state.reads+1);
      const expectedTabs={Drift:['Spelstatus & integritet','Betalningar & journal'],Administration:['Konton & åtkomst','API & integrationer'],Studio:['Talgranskning']};
      const menu=nodes(tree,node=>node.type==='nav'&&node.props['aria-label']==='Backoffice-grupper')[0];
      assert.deepEqual(nodes(menu,node=>node.type==='button').map(node=>node.props.children),expectedTabs[group.area],group.id);
      assert.equal(buttons(tree,'Spelmotor & rum').length,0,'retired room settings are never offered in the group menu');
      const html=renderToStaticMarkup(tree);
      if(group.area==='Administration')assert.match(html,/>SYSTEM</);
      if(group.id==='operations')assert.match(html,/<h1>Spelstatus &amp; integritet<\/h1>/);
      if(group.id==='accounts')assert.match(html,/<h1>Konton &amp; åtkomst<\/h1>/);
      h.unmount();
    }
  }
  const nativeSource=readFileSync(new URL('./native-administration.tsx',import.meta.url),'utf8');
  assert.match(nativeSource,/<StudioAdministration\b[^>]*readIdentity="response-headers-v1"/);
});

test('response identity is checked before body hydration; missing/malformed/different actors fail closed without session fallback', async () => {
  const h = harness();
  for (const headers of [
    {}, { 'X-Croupier-Studio-Actor': encodeURIComponent(actor('admin').username) },
    { 'X-Croupier-Studio-Actor': '%', 'X-Croupier-Studio-Role': 'admin' },
    { 'X-Croupier-Studio-Actor': 'x%0Ay', 'X-Croupier-Studio-Role': 'admin' },
    { 'X-Croupier-Studio-Actor': 'x'.repeat(255), 'X-Croupier-Studio-Role': 'admin' },
    { 'X-Croupier-Studio-Actor': 'owner@example.test', 'X-Croupier-Studio-Role': 'admin' },
    { 'X-Croupier-Studio-Actor': 'owner%40example.test', 'X-Croupier-Studio-Role': 'superadmin' },
    { 'X-Croupier-Studio-Actor': 'owner%40example.test', 'X-Croupier-Studio-Role': 'reader' },
    { 'X-Croupier-Studio-Actor': 'other%40example.test', 'X-Croupier-Studio-Role': 'admin' },
  ]) {
    let sessions = 0, bodies = 0;
    const response = new Response('{}', { headers }); response.json = async () => { bodies++; return resources().overview.payload; };
    const client = h.createStudioAdminClient({ apiBase: '/studio/api/admin', readIdentity: 'response-headers-v1', availableActions: allActions,
      session: async () => { sessions++; return actor('admin'); }, fetchImpl: async () => response });
    await assert.rejects(client.request('GET', 'overview', undefined, undefined, actor('admin')), status(403));
    assert.equal(sessions, 0); assert.equal(bodies, 0);
  }
  const unknown = h.createStudioAdminClient({ apiBase: '/studio/api/admin', readIdentity: 'unknown', availableActions: allActions,
    session: () => assert.fail('No guessed capability'), fetchImpl: () => assert.fail('No guessed capability') });
  await assert.rejects(unknown.request('GET', 'overview'), status(400));
});

test('two native server GETs reread role and epoch; revocation never leaks the second payload or promotes a player', async () => {
  for (const [revoke, expectedRole] of [[state => { state.epoch++; }, 'admin'], [state => { state.user.role = 'reader'; }, 'reader']]) {
    const h = harness(), f = nativeReadFixture(), client = h.createStudioAdminClient(f.props);
    const first = await client.request('GET', 'overview', undefined, undefined, actor('admin'));
    assert.equal(first.actor.username, actor('admin').username); assert.equal(first.actor.role, 'admin'); assert.ok(first.payload.players);
    const queries = f.state.queries;
    revoke(f.state);
    await assert.rejects(client.request('GET', 'overview', undefined, undefined, actor('admin')), status(401));
    assert.ok(f.state.queries > queries, 'the second GET must reauthorize from current rows');
    assert.equal(f.state.invoked, 1, 'revoked request never reaches its data handler');
    assert.equal(f.state.reads, 2); assert.equal(f.state.sessions, 0);
    assert.equal(f.state.user.role, expectedRole, 'no automatic promotion on denial');
  }
});

test('a server rejection after group preflight clears previously displayed native data and controls', async () => {
  for (const [statusCode, notice] of [[401, /Sessionen är avslutad/], [403, /Behörigheten saknas eller har ändrats/]]) {
    const h = harness(), f = nativeReadFixture(); let rejectReads = false;
    const props = { ...f.props, fetchImpl: async (url, init) => rejectReads ? reply({ error: 'private provider detail' }, statusCode) : f.props.fetchImpl(url, init) };
    h.render(props); h.effects(); await flush(); let tree = h.render(props);
    assert.match(renderToStaticMarkup(tree), /owner@example.test/);
    rejectReads = true;
    buttons(tree, 'Ladda om från servern')[0].props.onClick(); await flush(); tree = h.render(props);
    const html = renderToStaticMarkup(tree);
    assert.match(html, notice); assert.doesNotMatch(html, /Backoffice-grupper|owner@example.test|private provider detail/);
    assert.equal(nodes(tree, node => node.type === h.StudioAdministrationView).length, 0);
    h.unmount();
  }
});

test('native identity change or revocation between concurrent reads discards the entire group', async () => {
  for (const [change, notice] of [
    [state => { state.user.username = 'other@example.test'; }, /Behörigheten saknas eller har ändrats/],
    [state => { state.user.role = 'reader'; }, /Sessionen är avslutad/],
    [state => { state.epoch++; }, /Sessionen är avslutad/],
  ]) {
    const h = harness(), f = nativeReadFixture(); let release, bodies = 0;
    const firstDone = new Promise(resolve => { release = resolve; });
    const props = { ...f.props, fetchImpl: async (url, init) => {
      if (url.endsWith('/shoes')) await firstDone;
      const response = await f.props.fetchImpl(url, init);
      const json = response.json.bind(response); response.json = () => { bodies++; return json(); };
      if (url.endsWith('/overview')) { change(f.state); release(); }
      return response;
    } };
    h.render(props); h.effects(); await flush();
    const tree = h.render(props), html = renderToStaticMarkup(tree);
    assert.match(html, notice);
    assert.doesNotMatch(html, /Backoffice-grupper|owner@example.test|other@example.test/);
    assert.equal(nodes(tree, node => node.type === h.StudioAdministrationView).length, 0);
    assert.equal(f.state.sessions, 0); assert.equal(f.state.reads, 2);
    assert.equal(bodies, 0, 'all response identities must agree before any body is read');
    h.unmount();
  }
});

test('native read capability keeps write preflight, self-protection and revision checks intact', async () => {
  const h = harness(); let current = actor('admin'), sessions = 0, writes = 0;
  const client = h.createStudioAdminClient({ apiBase: '/studio/api/admin', readIdentity: 'response-headers-v1', availableActions: allActions,
    session: async () => { sessions++; return current; }, fetchImpl: async () => { writes++; return reply({ ok: true }); } });
  await client.request('POST', 'room', { expectedRevision: 'studio-v1' });
  await assert.rejects(client.request('POST', 'room', {}), status(409));
  await assert.rejects(client.request('POST', 'users/remove', { username: current.username }), status(403));
  await assert.rejects(client.request('POST', 'users/role', { username: current.username, role: 'admin' }), status(403));
  current = null;
  await assert.rejects(client.request('POST', 'room', { expectedRevision: 'studio-v1' }), status(401));
  assert.equal(sessions, 5); assert.equal(writes, 1);
});

test('native group waits for every header in either arrival order before reading or projecting bodies', async () => {
  for (const order of [['players', 'users'], ['users', 'players']]) {
    const h = harness(), pending = { players: deferred(), users: deferred() }, calls = []; let bodies = 0;
    const client = h.createStudioAdminClient({ apiBase: '/studio/api/admin', readIdentity: 'response-headers-v1', availableActions: allActions,
      session: () => assert.fail('Native groups have no session preflight'), fetchImpl: async (url, init) => {
        assert.equal(init.method, 'GET'); assert.equal(init.cache, 'no-store');
        const action = url.split('/').at(-1); calls.push(action); return pending[action].promise;
      } });
    const response = action => {
      const result = nativeReply(resources()[action].payload), json = result.json.bind(result);
      result.json = () => { bodies++; return json(); }; return result;
    };
    const loading = client.readGroup(['players', 'users']);
    assert.deepEqual(calls, ['players', 'users'], 'both reads start without waiting on identity or the first resource');
    pending[order[0]].resolve(response(order[0])); await flush(); assert.equal(bodies, 0);
    pending[order[1]].resolve(response(order[1]));
    const result = await loading;
    assert.deepEqual(JSON.parse(JSON.stringify(result.actor)), actor('admin'));
    assert.equal(result.results.length, 2); assert.equal(bodies, 2);
  }
});

test('any denied, malformed or mismatched native group response prevents every body read without fallback', async () => {
  for (const bad of [
    () => reply({ error: 'PRIVATE_ERROR_BODY' }, 401), () => reply({}, 403), () => reply({}, 404),
    () => reply(resources().users.payload),
    () => { const r = nativeReply(resources().users.payload); r.headers.set('X-Croupier-Studio-Actor', '%'); return r; },
    () => nativeReply(resources().users.payload, 200, { username: 'other@example.test', role: 'admin' }),
    () => nativeReply(resources().users.payload, 200, actor('reader')),
    () => nativeReply(resources().users.payload, 200, actor('superadmin')),
  ]) {
    const h = harness(), waiting = deferred(); let bodies = 0;
    const good = nativeReply(resources().players.payload), rejected = bad();
    for (const response of [good, rejected]) { const json = response.json.bind(response); response.json = () => { bodies++; return json(); }; }
    const client = h.createStudioAdminClient({ apiBase: '/studio/api/admin', readIdentity: 'response-headers-v1', availableActions: allActions,
      session: () => assert.fail('No session fallback'), fetchImpl: url => url.endsWith('/players') ? Promise.resolve(good) : waiting.promise });
    const loading = client.readGroup(['players', 'users']);
    await flush(); assert.equal(bodies, 0);
    const denied = assert.rejects(loading, error => [401, 403, 404].includes(error.status) && !error.message.includes('PRIVATE'));
    waiting.resolve(rejected); await denied; assert.equal(bodies, 0);
  }
});

test('native groups fail closed with no activated read or no usable payload, and safe errors require a fresh 2xx actor', async () => {
  const h = harness(); let fetches = 0;
  const unavailable = h.createStudioAdminClient({ apiBase: '/studio/api/admin', readIdentity: 'response-headers-v1', availableActions: [],
    session: () => assert.fail('No cached actor/session fallback'), fetchImpl: () => { fetches++; assert.fail('No inactive fetch'); } });
  await assert.rejects(unavailable.readGroup(['players', 'users']), status(501)); assert.equal(fetches, 0);
  for (const kind of ['status', 'body']) {
    let bodies = 0;
    const client = h.createStudioAdminClient({ apiBase: '/studio/api/admin', readIdentity: 'response-headers-v1', availableActions: allActions,
      session: () => assert.fail('No actor fallback'), fetchImpl: async () => {
        const response = kind === 'status' ? reply({ error: 'PRIVATE_DETAIL' }, 503) : nativeReply({});
        const json = response.json.bind(response); response.json = () => { bodies++; return json(); }; return response;
      } });
    await assert.rejects(client.readGroup(['players', 'users']), status(503)); assert.equal(bodies, kind === 'status' ? 0 : 2);
  }
  for (const failure of [501, 503]) {
    let errorBodies = 0;
    const client = h.createStudioAdminClient({ apiBase: '/studio/api/admin', readIdentity: 'response-headers-v1', availableActions: allActions,
      session: () => assert.fail('No actor fallback'), fetchImpl: async url => {
        if (url.endsWith('/players')) return nativeReply(resources().players.payload);
        const response = reply({ error: 'PRIVATE_DETAIL' }, failure); response.json = () => { errorBodies++; assert.fail('No error-body read'); }; return response;
      } });
    const result = await client.readGroup(['players', 'users']);
    assert.deepEqual(JSON.parse(JSON.stringify(result.actor)), actor('admin'));
    assert.equal(result.results.find(item => item.action === 'users').error.status, failure); assert.equal(errorBodies, 0);
  }
});

test('native all-error reload clears previous actor, data and controls instead of rendering with a stale actor', async () => {
  const h = harness(), f = nativeReadFixture(); let failed = false;
  const props = { ...f.props, fetchImpl: (url, init) => failed ? Promise.resolve(reply({}, 503)) : f.props.fetchImpl(url, init) };
  h.render(props); h.effects(); await flush(); let tree = h.render(props);
  assert.match(renderToStaticMarkup(tree), /owner@example.test/);
  failed = true; buttons(tree, 'Ladda om från servern')[0].props.onClick(); await flush(); tree = h.render(props);
  assert.match(renderToStaticMarkup(tree), /tillfälligt otillgänglig/);
  assert.doesNotMatch(renderToStaticMarkup(tree), /Backoffice-grupper|owner@example.test/);
  assert.equal(f.state.sessions, 0); h.unmount();
});

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
  let h; const requests = []; let identities = 0;
  const data = resources();
  const props = { apiBase: '/studio/api/admin', availableActions: allActions,
    session: async () => { ++identities; return actor('admin'); },
    fetchImpl: async (url, init) => {
      requests.push({ url, method: init.method });
      return reply(data[url.slice('/studio/api/admin/'.length)]?.payload);
    } };
  for (const [group, menu, reads] of [
    ['operations', 'Spelstatus & integritet', ['overview', 'shoes']],
    ['tables', 'Spelmotor & rum', ['config']],
    ['accounts', 'Konton & åtkomst', ['players', 'users']],
    ['partners', 'API & integrationer', ['apikeys', 'emails']],
    ['finance', 'Betalningar & journal', ['transactions']],
    ['media-review', 'Talgranskning', ['config', 'voicelines']],
  ]) {
    h=harness(); requests.length=0; identities=0;
    const scoped={...props,initialGroup:group};
    h.render(scoped);h.effects();await flush();const tree=h.render(scoped);
    assert.deepEqual(requests, reads.map(action => ({ url: `/studio/api/admin/${action}`, method: 'GET' })), group);
    assert.equal(identities, reads.length + 1, group);
    const view = nodes(tree, node => node.type === h.StudioAdministrationView)[0];
    assert.equal(view.props.group, group);
    assert.deepEqual(Object.keys(view.props.resources), reads, group);
    assert.ok(reads.every(action => view.props.resources[action].payload), group);
    h.unmount();
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
  const props = {initialGroup:'accounts',apiBase:'/api/admin',availableActions:allActions,session:async()=>actor('superadmin'),fetchImpl:async(url,init)=>
    init.method==='POST' ? reply({ok:true,key:{id:'partner-one',key,secret}}) : reply(url.endsWith('/config') ? config() : url.endsWith('/apikeys') ? resources().apikeys.payload : resources().overview.payload)};
  h.render(props); h.effects(); await flush(); let tree = h.render(props);
  buttons(tree,'API & integrationer')[0].props.onClick(); h.render(props); h.effects(); await flush(); tree = h.render(props);
  let native = nodes(tree,node=>node.type===h.StudioAdministrationView)[0];
  native.props.command('apikeys/create',{name:'Example'}); await flush(); tree = h.render(props);
  assert.match(renderToStaticMarkup(tree),new RegExp(secret));
  native = nodes(tree,node=>node.type===h.StudioAdministrationView)[0];
  assert.equal(JSON.stringify(native.props.resources).includes(secret),false);
  buttons(tree,'Ladda om från servern')[0].props.onClick(); await flush(); tree = h.render(props);
  assert.doesNotMatch(renderToStaticMarkup(tree),new RegExp(secret));
  nodes(tree,node=>node.type===h.StudioAdministrationView)[0].props.command('apikeys/create',{name:'Example'}); await flush(); tree=h.render(props);
  assert.match(renderToStaticMarkup(tree),new RegExp(secret));
  buttons(tree,'Konton & åtkomst')[0].props.onClick(); tree=h.render(props);
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
    assert.match(html,/Skapa spelarkonto|Bjud in adminpersonal – nivå 1/);assert.match(html,/Ditt eget konto: rollbyte och borttagning är spärrade/);
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
  assert.match(invitationHtml, /<summary>Bjud in adminpersonal – nivå 1<\/summary>/);
  assert.match(invitationHtml, /e-postadress/); assert.match(invitationHtml, /aktiveras.*väljer lösenord via mejlet/);
  assert.match(invitationHtml, /intern adminpersonal med behörighet till hela nivå 1, nivå 2 och nivå 3/);
  assert.match(invitationHtml, /<option value="admin">Administratör – nivå 1, 2 och 3<\/option>/);
  assert.match(invitationHtml, /72 timmar/);
  assert.match(renderToStaticMarkup(tree), /samma konto och lösenord på alla tre nivåerna/);
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

test('isolated legacy and active account forms emit established payloads with CAS and cleared password input', () => {
  const h = harness(); const calls = [];
  let tree = h.StudioAdministrationView({ ...viewProps('admin', 'tables'), command: (action, body) => calls.push({ action, body }) });
  const formFor = text => nodes(tree, node => node.type === 'form' && buttons(node, text).length)[0];
  formFor('Spara rum').props.onSubmit({ preventDefault() {}, currentTarget: new Form({ state: 'pending' }) });
  formFor('Spara dealer').props.onSubmit({ preventDefault() {}, currentTarget: new Form({ dealer: 'mei' }) });
  assert.equal(calls.length, 2); assert.ok(calls.every(call => call.body.expectedRevision === 'studio-v1'));
  formFor('Spara aktiv spelkonfiguration').props.onSubmit({ preventDefault() {}, currentTarget: new Form({ lane: 'mobile-phone' }) });
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
  for (const [group, action] of [['tables', 'Lägg till spelkonfiguration'], ['accounts', 'Skapa spelarkonto'], ['accounts', 'Ändra spelarstatus'], ['partners', 'Skapa partnernyckel']]) {
    let tree = h.StudioAdministrationView(viewProps('admin', group));
    if (group === 'tables') tree = h.renderLane(nodes(tree, node => node.type === h.TechnicalLaneCreate)[0].props);
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
  assert.equal(nodes(tree, node => node.type === DealerClipPreview).length, 1);
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

test('isolated legacy config: draft guard survives reload/conflict, protects native unload and cancelled local group change', async () => {
  const h = harness(); const props = { initialGroup:'tables', apiBase: '/api/admin', availableActions: allActions, session: async () => actor('superadmin'), fetchImpl: async (url, init) => init.method === 'POST' ? reply({ error: 'conflict' }, 409) : reply(url.endsWith('/config') ? config() : resources().overview.payload) };
  h.render(props); h.effects(); await flush(); let tree = h.render(props);
  const nativeView = () => nodes(tree, node => node.type === h.StudioAdministrationView)[0];
  const firstForm = new Form({ state: 'live' }); nativeView().props.onDirty(firstForm);
  let prevented = false; h.listeners.get('beforeunload')({ preventDefault() { prevented = true; }, returnValue: undefined }); assert.equal(prevented, true);
  h.window.confirm = () => false;
  buttons(tree, 'Spelstatus & integritet')[0].props.onClick(); tree = h.render(props);
  assert.equal(nodes(tree, node => node.type === h.StudioAdministrationView)[0].props.group, 'tables');
  nativeView().props.command('room', { id: 'room-one', state: 'live', expectedRevision: 'studio-v1' }, firstForm); await flush(); tree = h.render(props);
  assert.match(renderToStaticMarkup(tree), /Uppgifterna har ändrats|Osparade formulärfält/); assert.equal(firstForm.resets, 0);
  buttons(tree, 'Ladda om från servern')[0].props.onClick(); await flush(); tree = h.render(props);
  assert.match(renderToStaticMarkup(tree), /Osparade formulärfält/); assert.equal(firstForm.resets, 0); h.unmount();
});

test('two quick group changes invalidate abort-ignoring late reads before effect cleanup without clearing the latest busy state', async () => {
  for (const lateStatus of [200, 403]) {
    const h = harness(), pending = []; let holding = false, bodies = 0;
    const props = { apiBase: '/studio/api/admin', readIdentity: 'response-headers-v1', availableActions: allActions,
      session: () => assert.fail('No GET session'), fetchImpl: async (url, init) => {
        const action = url.split('/').at(-1);
        if (!holding) return nativeReply(resources()[action].payload);
        const waiting = deferred(); pending.push({ action, signal: init.signal, ...waiting }); return waiting.promise;
      } };
    const release = (entry, code = 200) => {
      const response = nativeReply(code === 200 ? resources()[entry.action].payload : {}, code), json = response.json.bind(response);
      response.json = () => { bodies++; return json(); }; entry.resolve(response);
    };
    h.render(props); h.effects(); await flush(); let tree = h.render(props); holding = true;
    buttons(tree, 'Betalningar & journal')[0].props.onClick(); h.render(props); h.effects(); await flush(); tree = h.render(props);
    assert.equal(pending.length, 1); assert.equal(tree.props['aria-busy'], true);
    assert.equal(buttons(tree, 'Spelstatus & integritet')[0].props.disabled, false);
    buttons(tree, 'Spelstatus & integritet')[0].props.onClick(); assert.equal(pending[0].signal.aborted, true, 'abort happens at accepted navigation, before effects');
    h.render(props); h.effects(); await flush(); tree = h.render(props); assert.equal(pending.length, 3);
    buttons(tree, 'Betalningar & journal')[0].props.onClick();
    assert.ok(pending.slice(1).every(entry => entry.signal.aborted));
    // Resolve stale reads in the click-to-effect window. These fetches ignore
    // cancellation and include both successful data and an authorization error.
    release(pending[0], lateStatus); release(pending[1]); release(pending[2]); await flush();
    tree = h.render(props);
    assert.equal(tree.props['aria-busy'], true, 'stale finally cannot finish the new group');
    const view = nodes(tree, node => node.type === h.StudioAdministrationView)[0];
    assert.equal(view.props.group, 'finance'); assert.equal(Object.keys(view.props.resources).length, 0);
    assert.equal(nodes(tree, node => node.props?.role === 'alert').length, 0); assert.equal(bodies, 0);
    h.effects(); await flush(); assert.equal(pending.length, 4);
    release(pending[3]); await flush(); tree = h.render(props);
    assert.equal(tree.props['aria-busy'], false); assert.equal(bodies, 1);
    const current = nodes(tree, node => node.type === h.StudioAdministrationView)[0];
    assert.equal(current.props.group, 'finance'); assert.ok(current.props.resources.transactions.payload); h.unmount();
  }
});

test('isolated legacy config: cancelled group change during a GET preserves its read, draft, unload guard and original revision', async () => {
  const h = harness(), waiting = deferred(), writes = []; let holding = false, signal;
  const props = { initialGroup:'tables', apiBase: '/studio/api/admin', readIdentity: 'response-headers-v1', availableActions: allActions,
    session: async () => actor('admin'), fetchImpl: async (url, init) => {
      if (init.method === 'POST') { writes.push(JSON.parse(init.body)); return reply({}, 409); }
      if (holding && url.endsWith('/config')) { signal = init.signal; return waiting.promise; }
      return nativeReply(resources()[url.split('/').at(-1)].payload);
    } };
  h.render(props); h.effects(); await flush(); let tree = h.render(props);
  const view = () => nodes(tree, node => node.type === h.StudioAdministrationView)[0], draft = new Form({ state: 'live' });
  const oldKey = view().key; view().props.onDirty(draft); tree = h.render(props); holding = true;
  buttons(tree, 'Ladda om från servern')[0].props.onClick(); await flush(); tree = h.render(props);
  h.window.confirm = () => false; buttons(tree, 'Spelstatus & integritet')[0].props.onClick(); tree = h.render(props);
  assert.equal(signal.aborted, false); assert.equal(view().props.group, 'tables'); assert.equal(view().key, oldKey);
  let prevented = false; h.listeners.get('beforeunload')({ preventDefault() { prevented = true; }, returnValue: undefined }); assert.equal(prevented, true);
  holding = false; waiting.resolve(nativeReply({ ...config(), revision: 'studio-v2' })); await flush(); tree = h.render(props);
  assert.equal(view().key, oldKey); assert.equal(draft.resets, 0); assert.match(renderToStaticMarkup(tree), /Osparade formulärfält/);
  view().props.command('room', { id: 'room-one', state: 'live', expectedRevision: 'studio-v2' }, draft); await flush(); tree = h.render(props);
  assert.equal(writes[0].expectedRevision, 'studio-v1'); assert.equal(draft.resets, 0);
  h.window.confirm = () => true; buttons(tree, 'Spelstatus & integritet')[0].props.onClick(); h.render(props); h.effects(); await flush(); tree = h.render(props);
  assert.equal(view().props.group, 'operations'); assert.doesNotMatch(renderToStaticMarkup(tree), /Osparade formulärfält/);
  prevented = false; h.listeners.get('beforeunload')({ preventDefault() { prevented = true; }, returnValue: undefined }); assert.equal(prevented, false); h.unmount();
});

test('POST and its reload block navigation and double writes; one-time results remain bound to the POST actor', async () => {
  for (const mode of ['same', 'different', 'mismatched']) {
    const h = harness(), posting = deferred(), pending = []; let written = false, writes = 0, sessions = 0, bodies = 0;
    const secret = `cs_${'s'.repeat(43)}`, key = `ck_live_${'k'.repeat(24)}`;
    const props = { initialGroup:'accounts', apiBase: '/studio/api/admin', readIdentity: 'response-headers-v1', availableActions: allActions,
      session: async () => { sessions++; return actor('admin'); }, fetchImpl: async (url, init) => {
        if (init.method === 'POST') { written = true; writes++; return posting.promise; }
        const action = url.split('/').at(-1);
        if (!written) return nativeReply(resources()[action].payload);
        const waiting = deferred(); pending.push({ action, ...waiting }); return waiting.promise;
      } };
    h.render(props); h.effects(); await flush(); let tree = h.render(props);
    buttons(tree, 'API & integrationer')[0].props.onClick(); h.render(props); h.effects(); await flush(); tree = h.render(props);
    const view = () => nodes(tree, node => node.type === h.StudioAdministrationView)[0];
    view().props.command('apikeys/create', { name: 'Fixture partner' });
    const duplicate = { name: 'Duplicate', password: 'discarded-fixture-password' }; view().props.command('apikeys/create', duplicate);
    await flush(); tree = h.render(props); assert.equal(writes, 1); assert.equal(Object.hasOwn(duplicate, 'password'), false);
    assert.equal(buttons(tree, 'Konton & åtkomst')[0].props.disabled, true); buttons(tree, 'Konton & åtkomst')[0].props.onClick();
    tree = h.render(props); assert.equal(view().props.group, 'partners');
    let prevented = false; h.listeners.get('beforeunload')({ preventDefault() { prevented = true; }, returnValue: undefined }); assert.equal(prevented, true);
    posting.resolve(reply({ ok: true, key: { id: 'partner-one', key, secret } })); await flush(); tree = h.render(props);
    assert.equal(pending.length, 2); assert.equal(tree.props['aria-busy'], true); assert.equal(buttons(tree, 'Konton & åtkomst')[0].props.disabled, true);
    buttons(tree, 'Konton & åtkomst')[0].props.onClick(); tree = h.render(props); assert.equal(view().props.group, 'partners');
    for (const [index, entry] of pending.entries()) {
      const username = mode === 'same' || mode === 'mismatched' && index === 0 ? actor('admin').username : 'other@example.test';
      const response = nativeReply(resources()[entry.action].payload, 200, { username, role: 'admin' }), json = response.json.bind(response);
      response.json = () => { bodies++; return json(); }; entry.resolve(response);
    }
    await flush(); tree = h.render(props); const html = renderToStaticMarkup(tree);
    assert.equal(writes, 1); assert.equal(sessions, 1, 'only the POST has a session preflight'); assert.equal(tree.props['aria-busy'], false);
    if (mode === 'same') { assert.match(html, new RegExp(secret)); assert.equal(bodies, 2); }
    else assert.doesNotMatch(html, new RegExp(secret));
    if (mode === 'mismatched') { assert.equal(bodies, 0); assert.doesNotMatch(html, /Backoffice-grupper/); }
    else { assert.equal(buttons(tree, 'Konton & åtkomst')[0].props.disabled, false); assert.equal(view().props.actor.username, mode === 'same' ? actor('admin').username : 'other@example.test'); }
    h.unmount();
  }
});

test('saving one form preserves other drafts; double command cannot send two writes and passwords are cleared', async () => {
  const h = harness(); let writes = 0; let submitted;
  const props = { initialGroup:'accounts', apiBase: '/api/admin', availableActions: allActions, session: async () => actor('admin'), fetchImpl: async (url, init) => {
    if (init.method === 'POST') { ++writes; submitted = JSON.parse(init.body); return reply({ ok: true }); }
    return reply(url.endsWith('/config') ? config() : url.endsWith('/players') ? resources().players.payload : url.endsWith('/users') ? resources().users.payload : resources().overview.payload);
  } };
  h.render(props); h.effects(); await flush(); let tree = h.render(props);
  buttons(tree, 'Konton & åtkomst')[0].props.onClick(); h.render(props); h.effects(); await flush(); tree = h.render(props);
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

test('isolated legacy config: reload cannot silently rebase an edited config form; only confirmed discard remounts it', async () => {
  const h = harness(); let revision = 'studio-v1'; const writes = [];
  const props = { initialGroup:'tables', apiBase: '/api/admin', availableActions: allActions, session: async () => actor('admin'), fetchImpl: async (url, init) => {
    if (init.method === 'POST') { writes.push(JSON.parse(init.body)); return reply({ error: 'conflict' }, 409); }
    return reply(url.endsWith('/config') ? { ...config(), revision } : resources().overview.payload);
  } };
  h.render(props); h.effects(); await flush(); let tree = h.render(props);
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

test('isolated legacy config: acknowledged write plus unavailable reload is not advertised as fully refreshed success', async () => {
  const h = harness(); let written = false;
  const props = { initialGroup:'tables', apiBase: '/api/admin', availableActions: allActions, session: async () => actor('admin'), fetchImpl: async (url, init) => {
    if (init.method === 'POST') { written = true; return reply({ ok: true }); }
    if (written) return reply({ error: 'SECRET_DB_ERROR' }, 503);
    return reply(url.endsWith('/config') ? config() : resources().overview.payload);
  } };
  h.render(props); h.effects(); await flush(); let tree = h.render(props);
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
  const props={initialGroup:'accounts',apiBase:'/studio/api/admin',availableActions:allActions,session:async()=>actor('admin'),fetchImpl:async(url,init)=>{
    if(init.method==='POST'){++writes;submitted=JSON.parse(init.body);await waiting;return reply({error:'PRIVATE SERVER TEXT'},503);}
    const key=url.slice(url.lastIndexOf('/')+1);return reply(resources()[key]?.payload||resources().overview.payload);
  }};
  h.render(props);h.effects();await flush();let tree=h.render(props);
  buttons(tree,'Konton & åtkomst')[0].props.onClick();h.render(props);h.effects();await flush();tree=h.render(props);
  const view=nodes(tree,node=>node.type===h.StudioAdministrationView)[0],body={playerId:'player-active',password:'fixture-new-password',reason:'Operator reset'};
  view.props.command('players/password',body,new Form({}));view.props.command('players/password',{...body},new Form({}));
  await flush();assert.equal(writes,1);assert.equal(submitted.password,'fixture-new-password');
  assert.doesNotMatch(renderToStaticMarkup(h.render(props)),/fixture-new-password/);
  release();await flush();await flush();tree=h.render(props);
  assert.equal(writes,1);assert.equal(Object.hasOwn(body,'password'),false);
  assert.doesNotMatch(renderToStaticMarkup(tree),/fixture-new-password|PRIVATE SERVER TEXT/);
  assert.match(renderToStaticMarkup(tree),/tillfälligt otillgänglig/);h.unmount();
});


const laneCreateProps = overrides => ({ savedDealers, lanes:savedGameLanes, activeDealer:'astrid', revision:'studio-v1', busy:false, command(){ throw Error('unexpected write'); }, ...overrides });
test('technical lane creation shows saved dealer labels and no free dealer or lane ID in the ordinary form', () => {
  const h=harness(), tree=h.renderLane(laneCreateProps()), html=renderToStaticMarkup(tree);
  assert.match(html, /Lägg till teknisk spelkonfiguration/);assert.match(html, /<select name="dealer"/);assert.match(html, /<option value="johanna">Johanna/);
  assert.match(html, /<option value="astrid" selected="">Astrid/);
  assert.doesNotMatch(html, /<input[^>]*name="(?:id|dealer|restoreId)"/);
  assert.match(html, /Återställ ett tidigare tekniskt ID/);assert.equal(h.generatedKeys,0,'rendering must not mint IDs');
  for (const role of ['reader','operator','staff']) {
    const view=h.StudioAdministrationView(viewProps(role,'tables'));
    assert.equal(nodes(view,node=>node.type===h.TechnicalLaneCreate).length,0);
  }
});

test('automatic technical ID is generated once, ignores unsolicited restore fields and survives retry until successful reset', () => {
  const h=harness(), calls=[], props=laneCreateProps({command:(action,body)=>calls.push({action,body})});
  let tree=h.renderLane(props); const form=new Form({name:'Johannas miljö',dealer:'johanna',restoreId:'unrequested-override'});
  nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){},currentTarget:form});
  tree=h.renderLane(props);nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){},currentTarget:form});
  assert.equal(h.generatedKeys,1);assert.equal(calls.length,2);assert.equal(calls[0].body.definition.id,calls[1].body.definition.id);
  assert.match(calls[0].body.definition.id,/^lane-[a-f0-9-]+$/);assert.notEqual(calls[0].body.definition.id,form.fields.restoreId);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{action:'game-lanes/create',body:{definition:{schemaVersion:1,id:'lane-10000000-0000-4000-8000-000000000001',label:'Johannas miljö',renderer:'portrait-video',dealer:'johanna',mediaCollection:'johanna-presentation'},expectedRevision:'studio-v1'}});
  nodes(tree,node=>node.type==='form')[0].props.onReset();tree=h.renderLane(props);
  nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){},currentTarget:form});
  assert.equal(h.generatedKeys,2);assert.notEqual(calls[2].body.definition.id,calls[0].body.definition.id);
});

test('exact prior ID restoration is explicit, validated, scoped to saved dealers and disabled while busy', () => {
  const h=harness(),calls=[],props=laneCreateProps({command:(action,body)=>calls.push({action,body})});
  let tree=h.renderLane(props);nodes(tree,node=>node.type==='input'&&node.props.type==='checkbox')[0].props.onChange({target:{checked:true}});
  tree=h.renderLane(props);assert.equal(nodes(tree,node=>node.type==='input'&&node.props.name==='restoreId').length,1);
  for(const fields of [{name:'Repair',dealer:'foreign',restoreId:'old-room-lane'},{name:'Repair',dealer:'amira',restoreId:'mobile-phone'},{name:'Repair',dealer:'amira',restoreId:'../../bad'}]){
    nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){},currentTarget:new Form(fields)});
  }
  assert.equal(calls.length,0);assert.equal(h.generatedKeys,0);
  const form=new Form({name:'Återställd Amira',dealer:'amira',restoreId:'room-lane-9c162457d38b353be86e2731'});
  nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){},currentTarget:form});
  assert.equal(calls.length,1);assert.equal(calls[0].body.definition.id,form.fields.restoreId);assert.equal(calls[0].body.definition.mediaCollection,'amira-presentation');
  tree=h.renderLane({...props,busy:true});nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){},currentTarget:form});
  assert.equal(calls.length,1);
});

test('unavailable or malformed saved dealer metadata never produces guessed selectable dealers', () => {
  for(const data of [undefined,null,[...savedDealers,savedDealers[0]],savedDealers.map(row=>({...row,private:'hidden'})),savedDealers.map(row=>({...row,label:'bad\nlabel'}))]){
    const h=harness(),tree=h.renderLane(laneCreateProps({savedDealers:data}));
    assert.equal(nodes(tree,node=>node.type==='form').length,0);assert.match(renderToStaticMarkup(tree),/Dealerlistan.*kunde inte läsas/);
    assert.equal(h.generatedKeys,0);
  }
});

test('technical ID generation handles collisions and invalid UUID source without inventing a fallback', () => {
  const h=harness(),keys=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002'];
  assert.equal(h.newTechnicalLaneId([{id:'lane-'+keys[0]}],()=>keys.shift()),'lane-10000000-0000-4000-8000-000000000002');
  assert.throws(()=>h.newTechnicalLaneId([],()=> 'bad'));
  assert.throws(()=>h.newTechnicalLaneId([{id:'lane-10000000-0000-4000-8000-000000000001'}],()=> '10000000-0000-4000-8000-000000000001'));
});

test('successful technical creation resets only its own form after authoritative reload and blocks double writes', async () => {
  const h=harness();let writes=0;
  const props={apiBase:'/api/admin',availableActions:allActions,initialGroup:'tables',session:async()=>actor('admin'),fetchImpl:async(url,init)=>{
    if(init.method==='POST'){writes++;return reply({ok:true});}
    return reply(config());
  }};
  h.render(props);h.effects();await flush();let tree=h.render(props),view=nodes(tree,node=>node.type===h.StudioAdministrationView)[0];
  const own=new Form(),other=new Form({state:'pending'});view.props.onDirty(own);view.props.onDirty(other);
  const body={definition:{...savedGameLanes[0],id:'new-generated-lane'},expectedRevision:'studio-v1'};
  view.props.command('game-lanes/create',body,own);view.props.command('game-lanes/create',body,own);
  await flush();tree=h.render(props);
  assert.equal(writes,1);assert.equal(own.resets,1);assert.equal(other.resets,0);
  assert.match(renderToStaticMarkup(tree),/Osparade formulärfält/);h.unmount();
});

test('selected dealer speech review renders and submits only that dealers exact media pair', () => {
  const h = harness(), data = resources(), calls = [];
  data.voicelines.payload.dealers.push({ dealer: 'paow', name: 'PAOW', lines: [
    { key: 'paow.greeting', text: 'PAOW greeting only', review: null, reviewable: true, identity: 'paow-exact-pair-v2', preview: '/dealer/preview/paow.mp4' },
  ] });
  const tree = h.StudioAdministrationView({ ...viewProps('admin', 'media-review'), dealerId: 'paow', resources: data, command: (action, body) => calls.push({ action, body }) });
  const html = renderToStaticMarkup(tree);
  assert.match(html, /PAOW greeting only/);
  assert.doesNotMatch(html, /Astrid|Lycka till|exact-pair-fixture|goodluck/);
  const forms = nodes(tree, node => node.type === 'form');
  assert.equal(forms.length, 1);
  forms[0].props.onSubmit({ preventDefault() {}, currentTarget: new Form({ verdict: 'approved' }) });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ action: 'voiceline-review', body: {
    dealer: 'paow', line: 'paow.greeting', verdict: 'approved', expectedIdentity: 'paow-exact-pair-v2', expectedRevision: 'studio-v1',
  } }]);
});

test('a dealer without registered speech never falls back to another dealers review actions', () => {
  const h = harness();
  for (const dealerId of ['paow', 'missing-dealer']) {
    const tree = h.StudioAdministrationView({ ...viewProps('admin', 'media-review'), dealerId });
    const html = renderToStaticMarkup(tree);
    assert.match(html, /Inga registrerade talpar finns för vald dealer/);
    assert.doesNotMatch(html, /Astrid|Lycka till|<video|<audio|<form|Spara manuell granskning/);
  }
});

test('changed media review remains invalidated and unavailable media cannot be approved', () => {
  const h = harness(), data = resources();
  const line = data.voicelines.payload.dealers[0].lines[0];
  line.reviewState = 'unbound-or-changed-media'; line.review = null; line.reviewable = false; line.identity = null;
  const html = renderToStaticMarkup(h.StudioAdministrationView({ ...viewProps('admin', 'media-review'), dealerId: 'astrid', resources: data }));
  assert.match(html, /Tidigare bedömning gäller inte för nuvarande mediepar/);
  assert.match(html, /ej granskad/);
  assert.doesNotMatch(html, /<form|Spara manuell granskning|>Godkänd</);
});

test('speech review navigation starts with the route-selected dealer', () => {
  const h = harness();
  const html = renderToStaticMarkup(h.render({ initialGroup: 'media-review', initialDealerId: 'paow', availableActions: allActions, session: async () => actor('admin') }));
  assert.match(html, /Studio för paow/);
  assert.match(html, /dealer=paow/);
  assert.doesNotMatch(html, /dealer=astrid/);
  h.unmount();
});

test('technical creation keeps an empty or unselected dealer registry explicit',()=>{
  const empty=harness(),tree=empty.renderLane(laneCreateProps({savedDealers:[],activeDealer:undefined}));
  assert.equal(nodes(tree,node=>node.type==='form').length,0);assert.match(renderToStaticMarkup(tree),/Inga dealers har registrerats/);
  assert.equal(empty.generatedKeys,0);
  for(const activeDealer of [undefined,'missing']){
    const h=harness(),calls=[],p=laneCreateProps({savedDealers:[{id:'johanna',label:'Johanna'}],activeDealer,command:(...args)=>calls.push(args)});
    const unselected=h.renderLane(p),dealer=nodes(unselected,node=>node.type==='select'&&node.props.name==='dealer')[0];
    assert.equal(dealer.props.defaultValue,'');
    assert.match(renderToStaticMarkup(unselected),/<option value=""[^>]*selected=""[^>]*>Välj dealer<\/option>/);
    nodes(unselected,node=>node.type==='form')[0].props.onSubmit({preventDefault(){},currentTarget:new Form({name:'Explicit room',dealer:''})});
    assert.equal(calls.length,0);assert.equal(h.generatedKeys,0);
  }
});

test('legacy config without a selected game lane never infers a dealer from a standard lane ID',()=>{
  const h=harness();
  for(const gameLane of [undefined,null,'original']){
    const data=resources();data.config.payload.gameLane=gameLane;
    const tree=h.StudioAdministrationView({...viewProps('admin','tables'),resources:data});
    const creator=nodes(tree,node=>node.type===h.TechnicalLaneCreate)[0];
    assert.equal(creator.props.activeDealer,undefined);
  }
});
