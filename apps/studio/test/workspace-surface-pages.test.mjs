import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { nextStudioLoginRedirect } from '../lib/next-page-navigation.mjs';
import { internalSessionPresent } from '../lib/partner-session.mjs';
import { resolveWorkspaceSurfacePath } from '../../../packages/navigation/workspace-surfaces.mjs';
import { publicAbsoluteUrl } from '../lib/lab-url.mjs';
import { partnerLoginReturnTo } from '../lib/partner-login-return.mjs';

const require = createRequire(import.meta.url);
const redirects = require('next/dist/client/components/redirect.js');
const { notFound } = require('next/dist/client/components/not-found.js');
const { addPathPrefix } = require('next/dist/shared/lib/router/utils/add-path-prefix.js');
const { transformSync } = require('next/dist/build/swc');
const navigation = { ...redirects, notFound };

function load(file, overrides) {
  const url = new URL(file, import.meta.url);
  const { code } = transformSync(readFileSync(url, 'utf8'), { filename: file,
    jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} }, localRequire = createRequire(url);
  vm.runInNewContext(code, { module, exports: module.exports, Request, URL,
    require: name => Object.hasOwn(overrides, name) ? overrides[name] : localRequire(name) }, { filename: file });
  return module.exports;
}

function pages(initialData, requestHeaders = new Headers({ host: 'studio.fixture.invalid', 'x-forwarded-host': 'game.fixture.invalid', cookie: 'bo_session=isolated-fixture' }), partnerData = initialData) {
  function PartnerOperatorWorkspace() { assert.fail('SSR returns the client element without executing its client work'); }
  function PartnerWorkspace() { assert.fail('SSR returns the level-two entrance without selecting a demo'); }
  const shared = load('../components/workspace-surface-page.tsx', {
    'next/headers': { headers: async () => requestHeaders },
    'next/navigation': navigation,
    '@/components/kevin-bo/partner-operator-workspace': { PartnerOperatorWorkspace },
    '@/components/partner-workspace': { PartnerWorkspace },
    '@/lib/lab-url.mjs': { publicAbsoluteUrl },
    '@/lib/partner-data.mjs': { partnerWorkspaceInitialData: partnerData },
    '@/lib/partner-session.mjs': { internalSessionPresent },
    '@/lib/partner-login-return.mjs': { partnerLoginReturnTo },
    '@/lib/next-page-navigation.mjs': { nextStudioLoginRedirect },
    '../../../packages/navigation/workspace-surfaces.mjs': { resolveWorkspaceSurfacePath },
  });
  const partner = load('../app/partner/[[...path]]/page.tsx', { '@/components/workspace-surface-page': shared });
  return { ...shared, PartnerOperatorWorkspace, PartnerWorkspace, partner };
}

async function renderPage(page, path, query) {
  const element = await page.default({ params: Promise.resolve(path === undefined ? {} : { path }), ...(query===undefined?{}:{searchParams:Promise.resolve(query)}) });
  return element.type(element.props);
}

function redirectLocation(error, basePath) {
  assert.equal(redirects.getRedirectStatusCodeFromError(error), 307);
  return addPathPrefix(redirects.getURLFromRedirectError(error), basePath);
}


test('the Partner catch-all uses exact public login returns outside the technical basePath after authorization 401', async () => {
  const authorized = [];
  const loaded = pages(async (request, options) => {
    authorized.push({ request, options });
    throw Object.assign(new Error('fixture login required'), { statusCode: 401 });
  });
  for (const [path, expected, returnTo = expected] of [[undefined, '/partner'], [['demo-north'], '/partner/demo-north'],
    [['demo-south', 'team'], '/partner/demo-south/team'], [['demo-south', 'reports'], '/partner/demo-south/reports']]) {
    for (const basePath of ['', '/studio']) {
      await assert.rejects(renderPage(loaded.partner, path), error => {
        const login = new URL(redirectLocation(error, basePath));
        assert.equal(login.origin, 'https://game.fixture.invalid');
        assert.equal(login.pathname, '/partner/login');
        assert.equal(login.searchParams.get('returnTo'), returnTo);
        assert.equal(login.searchParams.size, 1);
        return true;
      });
      const call = authorized.at(-1);
      assert.equal(new URL(call.request.url).pathname, '/studio' + expected);
      assert.equal(call.request.headers.get('cookie'), 'bo_session=isolated-fixture');
      assert.equal(call.request.headers.get('x-forwarded-host'), 'game.fixture.invalid');
      assert.equal(call.options.operatorSlug, path ? path[0] : undefined);
    }
  }
});

test('the Partner catch-all rejects unknown paths before loading and unknown operators before rendering', async () => {
  let reads = 0;
  const loaded = pages(async () => { reads++; throw Object.assign(new Error('unknown operator'), { statusCode: 404 }); });
  for (const [surface, path] of [['partner', ['api', 'admin']],
    ['partner', ['login']], ['partner', ['demo-north', 'voice']], ['partner', ['demo-north', 'team', 'users']],
    ['partner', ['demo-north', '%74eam']]]) {
    await assert.rejects(renderPage(loaded[surface], path), error => error.digest === 'NEXT_HTTP_ERROR_FALLBACK;404');
  }
  assert.equal(reads, 0);
  await assert.rejects(renderPage(loaded.partner, ['unknown-operator']), error => error.digest === 'NEXT_HTTP_ERROR_FALLBACK;404');
  assert.equal(reads, 1);
});

test('Kevins retired partner addresses redirect to the new view before anything is read, keeping one safe room selector', async () => {
  let reads = 0;
  const loaded = pages(async () => { reads++; assert.fail('a legacy address never reaches the data layer'); });
  for (const [path, query, expected] of [
    [['north-casino', 'overview'], undefined, '/partner/north-casino'],
    [['north-casino', 'tables'], undefined, '/partner/north-casino/rooms'],
    [['north-casino', 'presentation'], { room: 'vip-room' }, '/partner/north-casino/rooms?room=vip-room'],
    [['north-casino', 'game-tables'], { scope: 'company' }, '/partner/north-casino/rooms?scope=company'],
    [['north-casino', 'backgrounds'], { room: ['a', 'b'] }, '/partner/north-casino/rooms'],
    [['north-casino', 'transactions'], undefined, '/partner/north-casino/reports'],
    [['north-casino', 'statistics'], undefined, '/partner/north-casino/reports'],
    [['north-casino', 'shoes'], undefined, '/partner/north-casino'],
    [['north-casino', 'roulette'], undefined, '/partner/north-casino/rooms'],
  ]) {
    await assert.rejects(renderPage(loaded.partner, path, query), error => {
      assert.equal(redirects.getURLFromRedirectError(error), expected, path.join('/'));
      return true;
    });
  }
  assert.equal(reads, 0);
});

test('permission, configuration and unexpected failures propagate without an unauthenticated shell or login downgrade', async () => {
  for (const statusCode of [403, 503, 500]) {
    const failure = Object.assign(new Error('fixture failure'), { statusCode });
    const loaded = pages(async () => { throw failure; });
    await assert.rejects(renderPage(loaded.partner), error => error === failure);
  }
});

test('authorized SSR passes only the selected live snapshot, view, operator and native API to the client', async () => {
  const requests = [], snapshot = { preview: false, operator: { id: 'john-id', slug: 'johns-spelbolag' } };
  const loaded = pages(async (request, options) => {
    requests.push({ request, options });
    return { snapshot, apiBase: '/studio/api/partner/snapshot', session: { user: 'fixture-admin', role: 'admin', accessClass: 'internal-admin', privateTestField: 'never-pass' } };
  });
  for (const [surface, path, view, uiSurface] of [['partner', ['johns-spelbolag', 'rooms'], 'rooms', 'partner'],
    ['partner', ['johns-spelbolag'], 'overview', 'partner'], ['partner', ['johns-spelbolag', 'players'], 'players', 'partner'],
    ['partner', ['johns-spelbolag', 'reports'], 'reports', 'partner'], ['partner', ['johns-spelbolag', 'help'], 'help', 'partner'],
    ['partner', ['johns-spelbolag', 'team'], 'team', 'partner'], ['partner', ['johns-spelbolag', 'integration'], 'integration', 'partner']]) {
    const element = await renderPage(loaded[surface], path);
    assert.equal(element.type, loaded.PartnerOperatorWorkspace);
    assert.equal(element.props.surface, uiSurface); assert.equal(element.props.initialView, view);
    assert.equal(element.props.initialSnapshot, snapshot); assert.equal(element.props.apiBase, '/studio/api/partner/snapshot');
    assert.equal(element.props.user, 'fixture-admin'); assert.equal(element.props.session, undefined);
    assert.equal(element.props.denied, undefined);
    assert.equal(JSON.stringify(element.props).includes('never-pass'), false, 'private session fields stay server-side');
    // The server reads the view so its permission is checked before the shell renders.
    assert.deepEqual({ ...requests.at(-1).options }, { operatorSlug: 'johns-spelbolag', view });
  }
});

test('a denied view reaches the client only as the 403 notice, with the snapshot the role may read', async () => {
  const denied = { view: 'team', permission: 'team.read', role: { id: 'partner-editor', label: 'redaktör' } };
  const snapshot = { preview: false, operator: { id: 'john-id', slug: 'johns-spelbolag' }, team: [], denied };
  const loaded = pages(async () => ({ snapshot, denied, apiBase: '/studio/api/partner/snapshot', session: { user: 'john-editor', accessClass: 'partner' } }));
  const element = await renderPage(loaded.partner, ['johns-spelbolag', 'team']);
  assert.equal(element.type, loaded.PartnerOperatorWorkspace);
  assert.deepEqual(element.props.denied, denied);
  assert.equal(element.props.initialView, 'team');
});

test('room deep links pass the exact query only after authorizing the registered operator',async()=>{
  const snapshot={preview:false,operator:{id:'north',slug:'north-casino'}},requests=[];
  const loaded=pages(async(request,options)=>{requests.push(options);return {snapshot,apiBase:'/studio/api/partner/snapshot',session:{user:'fixture-admin',accessClass:'internal-admin'}};});
  for(const room of ['vip-room',['main-room','vip-room']]){
    const element=await renderPage(loaded.partner,['north-casino','rooms'],{room});
    assert.equal(element.type,loaded.PartnerOperatorWorkspace);assert.equal(element.props.initialSnapshot,snapshot);
    assert.equal(JSON.stringify(element.props.initialRoomId),JSON.stringify(room));
    assert.equal(requests.at(-1).operatorSlug,'north-casino');
  }
  const denied=pages(async()=>{throw Object.assign(new Error('denied'),{statusCode:403});});
  await assert.rejects(renderPage(denied.partner,['north-casino','rooms'],{room:'vip-room'}),error=>error.statusCode===403);
});

test('expired N1 session keeps a safe exact room link through login recovery',async()=>{
  const loaded=pages(async()=>{throw Object.assign(new Error('expired'),{statusCode:401});},new Headers({host:'studio.fixture.invalid',cookie:'bo_jwt=expired'}));
  await assert.rejects(renderPage(loaded.partner,['north-casino','rooms'],{room:'vip-room'}),error=>{
    const login=new URL(redirectLocation(error,''),'https://studio.fixture.invalid');
    assert.equal(login.pathname,'/admin/login');assert.equal(login.searchParams.get('returnTo'),'/partner/north-casino/rooms?room=vip-room');return true;
  });
});

test('expired partner session keeps the actual room while N1 cookies retain login precedence',async()=>{
  for(const cookie of ['partner_session=expired','bo_jwt=expired; partner_session=present']){
    const loaded=pages(async()=>{throw Object.assign(new Error('expired'),{statusCode:401});},new Headers({host:'studio.fixture.invalid','x-forwarded-host':'game.fixture.invalid',cookie}));
    for(const basePath of ['','/studio']){
      await assert.rejects(renderPage(loaded.partner,['north-casino','rooms'],{room:'vip-room'}),error=>{
        const login=new URL(redirectLocation(error,basePath),'https://game.fixture.invalid');
        assert.equal(login.origin,'https://game.fixture.invalid');
        assert.equal(login.pathname,cookie.startsWith('bo_jwt')?'/admin/login':'/partner/login');
        assert.equal(login.searchParams.get('returnTo'),'/partner/north-casino/rooms?room=vip-room');
        assert.equal(login.searchParams.size,1);return true;
      });
    }
  }
});

test('expired N1 session sends malformed explicit room links to admin instead of selecting another room',async()=>{
  const loaded=pages(async()=>{throw Object.assign(new Error('expired'),{statusCode:401});},new Headers({host:'studio.fixture.invalid',cookie:'bo_jwt=expired'}));
  for(const [query,expected] of [[{},'/partner/north-casino/rooms'],
    [{room:['main-room','vip-room']},'/admin'],[{room:''},'/admin'],
    [{room:'../vip-room'},'/admin'],[{room:'https://outside.invalid'},'/admin']]){
    for(const basePath of ['','/studio']){
      await assert.rejects(renderPage(loaded.partner,['north-casino','rooms'],query),error=>{
        const login=new URL(redirectLocation(error,basePath),'https://studio.fixture.invalid');
        assert.equal(login.pathname,'/admin/login');
        assert.equal(login.searchParams.get('returnTo'),expected);
        assert.equal(login.searchParams.size,1);return true;
      });
    }
  }
});


test('level-two entrance exposes the real directory without private records or automatic operator selection', async () => {
  let reads = 0;
  const loaded = pages(async () => {
    reads++;
    return { apiBase: '/studio/api/partner/snapshot', session: { user: 'fixture-admin', accessClass: 'internal-admin', privateSession: 'never-pass' }, snapshot: {
      preview: false, operators: [{ slug: 'johns-spelbolag', name: 'Johns spelbolag', privateField: 'never-pass' }, { slug: 'sg-test', name: 'SG test game provider' }],
      players: [{ privatePlayer: true }], team: [{ privateTeam: true }],
    } };
  });
  const element = await renderPage(loaded.partner);
  assert.equal(reads, 1);
  assert.equal(element.type, loaded.PartnerWorkspace);
  assert.equal(element.props.user, 'fixture-admin');
  assert.equal(element.props.apiBase, '/studio/api/partner/snapshot');
  assert.equal(element.props.accessClass, 'internal-admin');
  assert.deepEqual(JSON.parse(JSON.stringify(element.props.operators)), [
    { slug: 'johns-spelbolag', name: 'Johns spelbolag' }, { slug: 'sg-test', name: 'SG test game provider' },
  ]);
  assert.equal(element.props.session, undefined);
  assert.doesNotMatch(JSON.stringify(element.props), /never-pass|privatePlayer|privateTeam/);
});

test('an admin cookie alone loads real partners and never invokes the fixture adapter, including failures', async () => {
  const adminHeaders = new Headers({ host: 'studio.fixture.invalid', 'x-forwarded-host': 'game.fixture.invalid', cookie: 'bo_jwt=isolated-admin' });
  let liveReads = 0;
  const snapshot = { preview: false, operators: [{ slug: 'johns-spelbolag', name: 'Johns spelbolag' }], operator: { slug: 'johns-spelbolag' } };
  const fixture = () => assert.fail('N2 cannot downgrade an admin request to demo data');
  const loaded = pages(fixture, adminHeaders, async request => {
    liveReads++;
    assert.equal(request.headers.get('cookie'), 'bo_jwt=isolated-admin');
    return { snapshot, apiBase: '/studio/api/partner/snapshot', session: { user: 'fixture-admin', accessClass: 'internal-admin' } };
  });
  assert.equal((await renderPage(loaded.partner)).props.accessClass, 'internal-admin');
  assert.equal((await renderPage(loaded.partner, ['johns-spelbolag'])).props.initialSnapshot, snapshot);
  assert.equal(liveReads, 2);
  for (const statusCode of [401, 403, 404, 503]) {
    const failure = Object.assign(new Error('live partner unavailable'), { statusCode });
    const failed = pages(fixture, adminHeaders, async () => { throw failure; });
    await assert.rejects(renderPage(failed.partner), error => statusCode === 401
      ? redirects.getURLFromRedirectError(error) === 'https://game.fixture.invalid/admin/login?returnTo=%2Fpartner'
      : statusCode === 404 ? error.digest === 'NEXT_HTTP_ERROR_FALLBACK;404' : error === failure);
  }
});

test('Partner never renders a missing identity even if the adapter returns a session shell', async () => {
  for (const user of ['', undefined, null]) {
    const loaded = pages(async () => ({ session: { user } }));
    await assert.rejects(renderPage(loaded.partner), /workspace_identity_unavailable/);
  }
});

test('expired or invalid N1 credentials recover through N1 login with the exact safe partner return, even with a customer cookie', async () => {
  for (const cookie of ['bo_jwt=expired', 'lab_session=invalid', 'bo_jwt=', 'bo_jwt=bad; bo_jwt=duplicate',
    `bo_jwt=expired; partner_session=${'ab'.repeat(32)}`]) {
    let reads = 0;
    const loaded = pages(() => assert.fail('no diagnostic downgrade'), new Headers({ host: 'studio.fixture.invalid', cookie }), async () => {
      reads++;
      throw Object.assign(new Error('N1 login required'), { statusCode: 401 });
    });
    for (const [path, expected] of [[undefined, '/partner'], [['johns-spelbolag'], '/partner/johns-spelbolag'],
      [['johns-spelbolag', 'team'], '/partner/johns-spelbolag/team']]) {
      for (const basePath of ['', '/studio']) {
        await assert.rejects(renderPage(loaded.partner, path), error => {
          const login = new URL(redirectLocation(error, basePath), 'https://game.fixture.invalid');
          assert.equal(login.pathname, '/admin/login');
          assert.equal(login.searchParams.get('returnTo'), expected);
          assert.equal(login.searchParams.size, 1);
          return true;
        });
      }
    }
    assert.equal(reads, 6);
  }
});

test('missing, expired or invalid partner credentials still recover through partner login and never N1 login', async () => {
  for (const cookie of ['', 'partner_session=expired', 'not_bo_jwt=invalid', 'bo_jwt_extra=invalid']) {
    const loaded = pages(() => assert.fail('no fixture read'), new Headers({ host: 'studio.fixture.invalid', 'x-forwarded-host': 'game.fixture.invalid', cookie }),
      async () => { throw Object.assign(new Error('partner login required'), { statusCode: 401 }); });
    await assert.rejects(renderPage(loaded.partner, ['johns-spelbolag', 'team']), error => {
      const login = new URL(redirects.getURLFromRedirectError(error));
      assert.equal(login.origin + login.pathname, 'https://game.fixture.invalid/partner/login');
      assert.equal(login.searchParams.get('returnTo'), '/partner/johns-spelbolag/team');
      assert.equal(login.searchParams.size, 1);
      return true;
    });
  }
});



test('authorized partner menus pass raw room and scope together without masking explicit invalid room values',async()=>{
  const snapshot={preview:false,operator:{id:'north',slug:'north-casino'}},requests=[];
  const loaded=pages(async(request,options)=>{requests.push(options);return {snapshot,apiBase:'/studio/api/partner/snapshot',session:{user:'fixture-admin',accessClass:'internal-admin'}};});
  for(const menu of ['rooms','team','integration','overview']){
    for(const query of [{scope:'company'},{scope:['company','company']},{scope:''},{scope:'unknown'},
      {scope:'company',room:''},{scope:'company',room:['vip-room','other-room']},{scope:'company',room:'foreign-room'}]){
      const element=await renderPage(loaded.partner,menu==='overview'?['north-casino']:['north-casino',menu],query);
      assert.equal(element.props.initialRoomScope,query.scope);
      assert.equal(element.props.initialRoomId,query.room);
      assert.equal(element.props.initialSnapshot,snapshot);
      assert.deepEqual({...requests.at(-1)},{operatorSlug:'north-casino',view:menu});
    }
  }
  const denied=pages(async()=>{throw Object.assign(new Error('denied'),{statusCode:403});});
  await assert.rejects(renderPage(denied.partner,['north-casino','team'],{scope:'company'}),error=>error.statusCode===403);
});

test('N1 and partner login recovery retain company or exact room context on every recognized operator menu',async()=>{
  for(const cookie of ['partner_session=expired','bo_jwt=expired; partner_session=present']){
    const loaded=pages(async()=>{throw Object.assign(new Error('expired'),{statusCode:401});},new Headers({host:'studio.fixture.invalid','x-forwarded-host':'game.fixture.invalid',cookie}));
    for(const menu of ['rooms','team','integration','overview']){
      const segments=menu==='overview'?['north-casino']:['north-casino',menu];
      const path='/partner/'+segments.join('/'),canonical=resolveWorkspaceSurfacePath(path).canonicalPath;
      for(const query of [{scope:'company'},{room:'vip-room'}]){
        for(const basePath of ['','/studio']){
          await assert.rejects(renderPage(loaded.partner,segments,query),error=>{
            const login=new URL(redirectLocation(error,basePath),'https://game.fixture.invalid');
            assert.equal(login.pathname,cookie.startsWith('bo_jwt')?'/admin/login':'/partner/login');
            assert.equal(login.searchParams.get('returnTo'),canonical+'?'+new URLSearchParams(query));return true;
          });
        }
      }
    }
  }
});

test('login recovery rejects duplicate, mixed or malformed scope instead of converting it to company defaults',async()=>{
  for(const cookie of ['partner_session=expired','bo_jwt=expired']){
    const loaded=pages(async()=>{throw Object.assign(new Error('expired'),{statusCode:401});},new Headers({host:'studio.fixture.invalid',cookie}));
    for(const query of [{scope:['company','company']},{scope:''},{scope:'Company'},{scope:'%63ompany'},
      {scope:'company',room:''},{scope:'company',room:['vip-room','other-room']},{scope:'company',room:'foreign-room'},
      {scope:'company',room:'vip-room'}]){
      await assert.rejects(renderPage(loaded.partner,['north-casino','team'],query),error=>{
        const login=new URL(redirectLocation(error,''),'https://studio.fixture.invalid');
        assert.equal(login.searchParams.get('returnTo'),cookie.startsWith('bo_jwt')?'/admin':'/partner');return true;
      });
    }
  }
});

test('a Partner cookie uses live scoped data and never exposes the server session', async () => {
  let reads = 0;
  const snapshot = { preview: false, operator: { id: 'north', slug: 'north' }, operators: [{ slug: 'north', name: 'North' }] };
  const loaded = pages(async () => {
    reads++;
    return { snapshot, apiBase: '/studio/api/partner/snapshot', session: { user: 'north-member', accessClass: 'partner', privateField: 'never-pass' } };
  }, new Headers({ host: 'studio.fixture.invalid', cookie: 'partner_session=isolated' }));
  const workspace = await renderPage(loaded.partner, ['north']);
  assert.equal(workspace.type, loaded.PartnerOperatorWorkspace);
  assert.equal(workspace.props.initialSnapshot, snapshot);
  assert.equal(workspace.props.initialView, 'overview');
  assert.equal(workspace.props.apiBase, '/studio/api/partner/snapshot');
  assert.equal(workspace.props.user, 'north-member');
  assert.equal(workspace.props.session, undefined);
  const entrance = await renderPage(loaded.partner);
  assert.equal(entrance.type, loaded.PartnerWorkspace);
  assert.equal(entrance.props.accessClass, 'partner');
  assert.deepEqual(JSON.parse(JSON.stringify(entrance.props.operators)), [{ slug: 'north', name: 'North' }]);
  assert.doesNotMatch(JSON.stringify(entrance.props), /privateField|never-pass/);
  assert.equal(reads, 2);
});
