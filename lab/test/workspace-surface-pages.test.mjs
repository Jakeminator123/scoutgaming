import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { nextStudioLoginRedirect } from '../lib/next-page-navigation.mjs';
import { resolveWorkspaceSurfacePath } from '../lib/workspace-surfaces.mjs';
import { controlToolPath } from '../lib/control-workspace.mjs';
import { publicAbsoluteUrl } from '../lib/lab-url.mjs';

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
  vm.runInNewContext(code, { module, exports: module.exports, Request,
    require: name => Object.hasOwn(overrides, name) ? overrides[name] : localRequire(name) }, { filename: file });
  return module.exports;
}

function pages(initialData, requestHeaders = new Headers({ host: 'studio.fixture.invalid', 'x-forwarded-host': 'game.fixture.invalid', cookie: 'bo_session=isolated-fixture' }), partnerData = initialData, nativeRuntime = { nativeStudioAdminEnabled: () => false }) {
  function KevinBackoffice() { assert.fail('SSR returns the client element without executing its client work'); }
  function ControlWorkspace() { assert.fail('SSR returns the internal client element without executing it'); }
  function PartnerWorkspace() { assert.fail('SSR returns the level-two entrance without selecting a demo'); }
  const shared = load('../app/control/surface-page.tsx', {
    '../../lib/studio-native-runtime.mjs': nativeRuntime,
    'next/headers': { headers: async () => requestHeaders },
    'next/navigation': navigation,
    '@/components/kevin-bo/kevin-backoffice': { KevinBackoffice },
    '@/components/control-workspace': { ControlWorkspace },
    '@/components/partner-workspace': { PartnerWorkspace },
    '@/lib/control-workspace.mjs': { controlToolPath },
    '@/lib/lab-url.mjs': { publicAbsoluteUrl },
    '@/lib/partner-preview.mjs': { partnerPreviewInitialData: initialData },
    '@/lib/partner-data.mjs': { partnerWorkspaceInitialData: partnerData },
    '@/lib/next-page-navigation.mjs': { nextStudioLoginRedirect },
    '@/lib/workspace-surfaces.mjs': { resolveWorkspaceSurfacePath },
  });
  const control = load('../app/control/[[...path]]/page.tsx', { '../surface-page': shared });
  const partner = load('../app/partner/[[...path]]/page.tsx', { '../../control/surface-page': shared });
  return { ...shared, KevinBackoffice, ControlWorkspace, PartnerWorkspace, control, partner };
}

async function renderPage(page, path) {
  const element = await page.default({ params: Promise.resolve(path === undefined ? {} : { path }) });
  return element.type(element.props);
}

function redirectLocation(error, basePath) {
  assert.equal(redirects.getRedirectStatusCodeFromError(error), 307);
  return addPathPrefix(redirects.getURLFromRedirectError(error), basePath);
}

function canonicalControlPath(error, basePath) {
  const location = redirectLocation(error, basePath);
  const url = new URL(location);
  assert.equal(url.pathname.startsWith('/studio'), false);
  return url.pathname + url.search + url.hash;
}

test('real catch-all pages use exact public login returns and one Next basePath after authorization 401', async () => {
  const authorized = [];
  const loaded = pages(async (request, options) => {
    authorized.push({ request, options });
    throw Object.assign(new Error('fixture login required'), { statusCode: 401 });
  });
  for (const [path, expected] of [[undefined, '/control'], [['voice'], '/control/voice']]) {
    for (const basePath of ['', '/studio']) {
      await assert.rejects(renderPage(loaded.control, path), error => {
        const login = new URL(redirectLocation(error, basePath), 'https://game.fixture.invalid');
        assert.equal(login.pathname, basePath + '/login');
        assert.equal(login.searchParams.get('returnTo'), expected);
        assert.equal(login.searchParams.size, 1);
        return true;
      });
      const call = authorized.at(-1);
      assert.equal(new URL(call.request.url).pathname, '/studio' + expected);
      assert.equal(call.request.headers.get('cookie'), 'bo_session=isolated-fixture');
      assert.equal(call.request.headers.get('x-forwarded-host'), 'game.fixture.invalid');
      assert.equal(call.options.operatorSlug, undefined);
    }
  }
  for (const [path, expected] of [[undefined, '/partner'], [['demo-north', 'overview'], '/partner/demo-north/overview'],
    [['demo-south', 'team'], '/partner/demo-south/team']]) {
    for (const basePath of ['', '/studio']) {
      await assert.rejects(renderPage(loaded.partner, path), error => {
        const login = new URL(redirectLocation(error, basePath));
        assert.equal(login.origin, 'https://game.fixture.invalid');
        assert.equal(login.pathname, '/partner/login');
        assert.equal(login.search, '');
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

test('real catch-all pages reject unknown paths before loading and unknown operators before rendering', async () => {
  let reads = 0;
  const loaded = pages(async () => { reads++; throw Object.assign(new Error('unknown operator'), { statusCode: 404 }); });
  for (const [surface, path] of [['control', ['unknown']], ['control', ['api', 'admin']], ['partner', ['api', 'admin']],
    ['partner', ['login']], ['partner', ['demo-north', 'voice']], ['partner', ['demo-north', 'team', 'users']],
    ['partner', ['demo-north', '%74eam']]]) {
    await assert.rejects(renderPage(loaded[surface], path), error => error.digest === 'NEXT_HTTP_ERROR_FALLBACK;404');
  }
  assert.equal(reads, 0);
  await assert.rejects(renderPage(loaded.partner, ['unknown-operator', 'overview']), error => error.digest === 'NEXT_HTTP_ERROR_FALLBACK;404');
  assert.equal(reads, 1);
});

test('permission, configuration and unexpected failures propagate without an unauthenticated shell or login downgrade', async () => {
  for (const statusCode of [403, 503, 500]) {
    const failure = Object.assign(new Error('fixture failure'), { statusCode });
    const loaded = pages(async () => { throw failure; });
    for (const surface of ['control', 'partner']) await assert.rejects(renderPage(loaded[surface]), error => error === failure);
  }
});

test('authorized SSR passes only the selected live snapshot, view, operator and native API to the client', async () => {
  const requests = [], snapshot = { preview: false, operator: { id: 'john-id', slug: 'johns-spelbolag' } };
  const loaded = pages(async (request, options) => {
    requests.push({ request, options });
    return { snapshot, apiBase: '/studio/api/partner/snapshot', session: { user: 'fixture-admin', role: 'admin', accessClass: 'internal-admin', privateTestField: 'never-pass' } };
  });
  for (const [surface, path, view, uiSurface] of [['partner', ['johns-spelbolag', 'presentation'], 'theme', 'partner'],
    ['partner', ['johns-spelbolag', 'tables'], 'bj', 'partner'], ['partner', ['johns-spelbolag', 'integration'], 'api', 'partner']]) {
    const element = await renderPage(loaded[surface], path);
    assert.equal(element.type, loaded.KevinBackoffice);
    assert.equal(element.props.surface, uiSurface); assert.equal(element.props.initialView, view);
    assert.equal(element.props.initialSnapshot, snapshot); assert.equal(element.props.apiBase, '/studio/api/partner/snapshot');
    assert.equal(element.props.user, 'fixture-admin'); assert.equal(element.props.session, undefined);
    assert.deepEqual(Object.keys(element.props).sort(), ['apiBase', 'initialSnapshot', 'initialView', 'surface', 'user']);
    assert.equal(requests.at(-1).options.operatorSlug, 'johns-spelbolag');
  }
});

test('control shows the overview and disconnected preview addresses are not found', async () => {
  const loaded = pages(async () => ({ snapshot: { privateFixture: true, operators: [
    { id: 'sg-test', slug: 'sg-test', name: 'SG test game provider', privateField: 'never-pass' },
  ] }, apiBase: '/studio/api/partner-preview', session: { user: 'fixture-admin' } }));
  const element = await renderPage(loaded.control, undefined);
  assert.equal(element.type, loaded.ControlWorkspace);
  assert.equal(element.props.user, 'fixture-admin');
  assert.equal(element.props.initialView, 'ops');
  assert.equal(element.props.operatorStatus, 'demo');
  assert.deepEqual(Object.keys(element.props).sort(), ['initialView', 'operatorStatus', 'operators', 'user']);
  assert.deepEqual(JSON.parse(JSON.stringify(element.props.operators)), [{ id: 'sg-test', slug: 'sg-test', name: 'SG test game provider' }]);
  // 'preview' left this list in 1f1c14d6: /control/preview is the staff layer-preview page (its own route wins).
  for (const path of [['generations'], ['reports'], ['pit-bosses'], ['presentation'], ['table-design'], ['roulette'], ['baccarat'], ['statistics']]) {
    await assert.rejects(renderPage(loaded.control, path), error => error.digest === 'NEXT_HTTP_ERROR_FALLBACK;404');
  }
});

test('level-two entrance exposes the real directory without private records or automatic operator selection', async () => {
  let reads = 0;
  const loaded = pages(async () => {
    reads++;
    return { session: { user: 'fixture-admin', accessClass: 'internal-admin', privateSession: 'never-pass' }, snapshot: {
      preview: false, operators: [{ slug: 'johns-spelbolag', name: 'Johns spelbolag', privateField: 'never-pass' }, { slug: 'sg-test', name: 'SG test game provider' }],
      players: [{ privatePlayer: true }], team: [{ privateTeam: true }],
    } };
  });
  const element = await renderPage(loaded.partner);
  assert.equal(reads, 1);
  assert.equal(element.type, loaded.PartnerWorkspace);
  assert.deepEqual(JSON.parse(JSON.stringify(element.props)), { user: 'fixture-admin', accessClass: 'internal-admin', operators: [
    { slug: 'johns-spelbolag', name: 'Johns spelbolag' }, { slug: 'sg-test', name: 'SG test game provider' },
  ] });
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
      ? redirects.getURLFromRedirectError(error) === 'https://game.fixture.invalid/partner/login'
      : statusCode === 404 ? error.digest === 'NEXT_HTTP_ERROR_FALLBACK;404' : error === failure);
  }
});

test('neither workspace renders a missing identity even if the adapter returns a session shell', async () => {
  for (const user of ['', undefined, null]) {
    const loaded = pages(async () => ({ session: { user } }));
    for (const surface of ['control', 'partner']) {
      await assert.rejects(renderPage(loaded[surface]), /workspace_identity_unavailable/);
    }
  }
});

test('old internal tool documents authorize then lead to the real tool with one basePath', async () => {
  let reads = 0;
  const loaded = pages(async () => { reads++; return { session: { user: 'fixture-admin' } }; });
  for (const [section, destination] of [['voice', '/control/clips#clips'], ['clips', '/control/clips#deal'], ['lanes', '/control/administration?tab=tables'],
    ['media', '/control/videos'], ['presentation-events', '/control/events'], ['team', '/control/administration?tab=accounts'], ['backgrounds', '/control/preview']]) {
    for (const basePath of ['', '/studio']) {
      await assert.rejects(renderPage(loaded.control, [section]), error => {
        assert.equal(canonicalControlPath(error, basePath), destination);
        return true;
      });
    }
  }
  assert.equal(reads, 14);
});

test('a partner cookie never authorizes control and a partner session skips the fixture preview', async () => {
  let previews = 0;
  let partners = 0;
  const partnerHeaders = new Headers({ host: 'studio.fixture.invalid', 'x-forwarded-host': 'game.fixture.invalid', cookie: `partner_session=${'ab'.repeat(32)}` });
  const snapshot = { preview: false, operator: { id: 'operator-demo-north', slug: 'demo-north', name: 'Demo North' }, operators: [{ id: 'operator-demo-north', slug: 'demo-north', name: 'Demo North' }] };
  const loaded = pages(async () => { previews++; throw Object.assign(new Error('admin login required'), { statusCode: 401 }); }, partnerHeaders, async () => {
    partners++;
    return { snapshot, apiBase: '/studio/api/partner/snapshot', session: { user: 'north-partner', role: 'partner', accessClass: 'partner' } };
  });
  for (const basePath of ['', '/studio']) {
    await assert.rejects(renderPage(loaded.control), error => {
      const login = new URL(redirectLocation(error, basePath), 'https://game.fixture.invalid');
      assert.equal(login.pathname, basePath + '/login');
      assert.equal(login.searchParams.get('returnTo'), '/control');
      return true;
    });
  }
  assert.equal(partners, 0);
  assert.equal(previews, 2);
  const element = await renderPage(loaded.partner, ['demo-north', 'overview']);
  assert.equal(element.type, loaded.KevinBackoffice);
  assert.equal(element.props.initialSnapshot, snapshot);
  assert.equal(element.props.initialSnapshot.preview, false);
  assert.equal(element.props.apiBase, '/studio/api/partner/snapshot');
  assert.equal(element.props.user, 'north-partner');
  assert.equal(element.props.initialView, 'ops');
  assert.equal(element.props.surface, 'partner');
  assert.deepEqual(Object.keys(element.props).sort(), ['apiBase', 'initialSnapshot', 'initialView', 'surface', 'user']);
  assert.equal(previews, 2);
  assert.equal(partners, 1);
  const entrance = await renderPage(loaded.partner);
  assert.equal(entrance.type, loaded.PartnerWorkspace);
  assert.equal(entrance.props.accessClass, 'partner');
  assert.deepEqual(JSON.parse(JSON.stringify(entrance.props.operators)), [{ slug: 'demo-north', name: 'Demo North' }]);
});

test('legacy control entrances redirect once to canonical public control tools', async () => {
  const loaded = pages(async () => assert.fail('existing destination retains its own guard; no preview snapshot is loaded'));
  for (const [section, destination] of [['studio', '/control'], ['admin', '/control/administration'], ['ops', '/control/openclaw'], ['lab', '/control']]) {
    for (const basePath of ['', '/studio']) {
      await assert.rejects(renderPage(loaded.control, [section]), error => {
        assert.equal(canonicalControlPath(error, basePath), destination);
        return true;
      });
    }
  }
});


test('live company reads distinguish verified empty stores from failures and never substitute demos', async () => {
  const demo = { id: 'demo-north', slug: 'demo-north', name: 'Demo North' };
  const live = { id: 'live-one', slug: 'live-one', name: 'Live One', privateField: 'never-pass' };
  for (const [listed, expectedStatus, expectedOperators] of [[[], 'live', []], [[live], 'live', [{ id: live.id, slug: live.slug, name: live.name }]], [null, 'unavailable', []], [[{ id: 'invalid' }], 'unavailable', []]]) {
    const loaded = pages(async () => ({ session: { user: 'fixture-admin' }, snapshot: { operators: [demo] } }), undefined, undefined,
      { nativeStudioAdminEnabled: () => true, studioNativeRuntime: async () => ({ listLaneOperators: async () => listed }) });
    const element = await renderPage(loaded.control);
    assert.equal(element.props.operatorStatus, expectedStatus);
    assert.deepEqual(JSON.parse(JSON.stringify(element.props.operators)), expectedOperators);
  }
  for (const runtime of [async () => { throw new Error('private failure detail'); }, async () => ({}), async () => ({ listLaneOperators: async () => { throw new Error('private failure detail'); } })]) {
    const loaded = pages(async () => ({ session: { user: 'fixture-admin' }, snapshot: { operators: [demo] } }), undefined, undefined,
      { nativeStudioAdminEnabled: () => true, studioNativeRuntime: runtime });
    const element = await renderPage(loaded.control);
    assert.equal(element.props.operatorStatus, 'unavailable');
    assert.deepEqual(JSON.parse(JSON.stringify(element.props.operators)), []);
    assert.doesNotMatch(JSON.stringify(element.props), /private failure detail|Demo North/);
  }
});

test('retired internal task links select the relevant existing administrative workflow', async () => {
  const loaded = pages(async () => ({ session: { user: 'fixture-admin' } }));
  for (const [section, tab] of [['players', 'accounts'], ['team', 'accounts'], ['transactions', 'finance'], ['game-tables', 'tables'], ['lanes', 'tables'], ['shoes', 'operations'], ['legacy-rooms', 'tables'], ['integration', 'partners']]) {
    await assert.rejects(renderPage(loaded.control, [section]), error => {
      assert.equal(canonicalControlPath(error, ''), `/control/administration?tab=${tab}`);
      return true;
    });
  }
});
