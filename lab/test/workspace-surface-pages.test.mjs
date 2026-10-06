import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { nextStudioLoginRedirect } from '../lib/next-page-navigation.mjs';
import { resolveWorkspaceSurfacePath } from '../lib/workspace-surfaces.mjs';
import { controlToolPath } from '../lib/control-workspace.mjs';

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

function pages(initialData, requestHeaders = new Headers({ host: 'studio.fixture.invalid', 'x-forwarded-host': 'game.fixture.invalid', cookie: 'bo_session=isolated-fixture' })) {
  function KevinBackoffice() { assert.fail('SSR returns the client element without executing its client work'); }
  function ControlWorkspace() { assert.fail('SSR returns the internal client element without executing it'); }
  const shared = load('../app/control/surface-page.tsx', {
    'next/headers': { headers: async () => requestHeaders },
    'next/navigation': navigation,
    '@/components/kevin-bo/kevin-backoffice': { KevinBackoffice },
    '@/components/control-workspace': { ControlWorkspace },
    '@/lib/control-workspace.mjs': { controlToolPath },
    '@/lib/partner-preview.mjs': { partnerPreviewInitialData: initialData },
    '@/lib/next-page-navigation.mjs': { nextStudioLoginRedirect },
    '@/lib/workspace-surfaces.mjs': { resolveWorkspaceSurfacePath },
  });
  const control = load('../app/control/[[...path]]/page.tsx', { '../surface-page': shared });
  const partner = load('../app/partner/[[...path]]/page.tsx', { '../../control/surface-page': shared });
  return { ...shared, KevinBackoffice, ControlWorkspace, control, partner };
}

async function renderPage(page, path) {
  const element = await page.default({ params: Promise.resolve(path === undefined ? {} : { path }) });
  return element.type(element.props);
}

function redirectLocation(error, basePath) {
  assert.equal(redirects.getRedirectStatusCodeFromError(error), 307);
  return addPathPrefix(redirects.getURLFromRedirectError(error), basePath);
}

test('real catch-all pages use exact public login returns and one Next basePath after authorization 401', async () => {
  const authorized = [];
  const loaded = pages(async (request, options) => {
    authorized.push({ request, options });
    throw Object.assign(new Error('fixture login required'), { statusCode: 401 });
  });
  for (const [surface, path, expected] of [['control', undefined, '/control'], ['control', ['voice'], '/control/voice'],
    ['partner', undefined, '/partner'], ['partner', ['demo-north', 'overview'], '/partner/demo-north/overview'],
    ['partner', ['demo-south', 'team'], '/partner/demo-south/team']]) {
    for (const basePath of ['', '/studio']) {
      await assert.rejects(renderPage(loaded[surface], path), error => {
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
      assert.equal(call.options.operatorSlug, surface === 'partner' && path ? path[0] : undefined);
    }
  }
});

test('real catch-all pages reject unknown paths before loading and unknown operators before rendering', async () => {
  let reads = 0;
  const loaded = pages(async () => { reads++; throw Object.assign(new Error('unknown operator'), { statusCode: 404 }); });
  for (const [surface, path] of [['control', ['unknown']], ['control', ['api', 'admin']], ['partner', ['api', 'admin']],
    ['partner', ['demo-north', 'voice']], ['partner', ['demo-north', 'team', 'users']],
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

test('authorized SSR passes only the selected snapshot, view, operator and native API to the client', async () => {
  const requests = [], snapshot = { preview: true, operator: { id: 'operator-demo-south', slug: 'demo-south' } };
  const loaded = pages(async (request, options) => {
    requests.push({ request, options });
    return { snapshot, apiBase: '/studio/api/partner-preview', session: { user: 'fixture-admin', role: 'admin', privateTestField: 'never-pass' } };
  });
  for (const [surface, path, view, uiSurface] of [['partner', ['demo-south', 'presentation'], 'theme', 'partner'],
    ['partner', ['demo-south', 'tables'], 'bj', 'partner'], ['partner', ['demo-south', 'integration'], 'api', 'partner']]) {
    const element = await renderPage(loaded[surface], path);
    assert.equal(element.type, loaded.KevinBackoffice);
    assert.equal(element.props.surface, uiSurface); assert.equal(element.props.initialView, view);
    assert.equal(element.props.initialSnapshot, snapshot); assert.equal(element.props.apiBase, '/studio/api/partner-preview');
    assert.equal(element.props.user, 'fixture-admin'); assert.equal(element.props.session, undefined);
    assert.deepEqual(Object.keys(element.props).sort(), ['apiBase', 'initialSnapshot', 'initialView', 'surface', 'user']);
    assert.equal(requests.at(-1).options.operatorSlug, surface === 'partner' ? 'demo-south' : undefined);
  }
});

test('control shows the real tool entrance without handing operator fixtures to the browser', async () => {
  const loaded = pages(async () => ({ snapshot: { privateFixture: true }, apiBase: '/studio/api/partner-preview', session: { user: 'fixture-admin' } }));
  for (const [path, view] of [[undefined, 'ops'], [['generations'], 'gen'], [['reports'], 'reports']]) {
    const element = await renderPage(loaded.control, path);
    assert.equal(element.type, loaded.ControlWorkspace);
    assert.equal(element.props.user, 'fixture-admin');
    assert.equal(element.props.initialView, view);
    assert.deepEqual(Object.keys(element.props).sort(), ['initialView', 'user']);
  }
});

test('old internal tool documents authorize then lead to the real tool with one basePath', async () => {
  let reads = 0;
  const loaded = pages(async () => { reads++; return { session: { user: 'fixture-admin' } }; });
  for (const [section, destination] of [['voice', '/#clips'], ['clips', '/#deal'], ['lanes', '/administration'],
    ['media', '/videos'], ['presentation-events', '/tree'], ['team', '/administration']]) {
    for (const basePath of ['', '/studio']) {
      await assert.rejects(renderPage(loaded.control, [section]), error => {
        assert.equal(redirectLocation(error, basePath), basePath + destination);
        return true;
      });
    }
  }
  assert.equal(reads, 12);
});

test('legacy control entrances redirect once to existing app-local authenticated tools', async () => {
  const loaded = pages(async () => assert.fail('existing destination retains its own guard; no preview snapshot is loaded'));
  for (const [section, destination] of [['studio', '/'], ['admin', '/administration'], ['ops', '/openclaw'], ['lab', '/']]) {
    for (const basePath of ['', '/studio']) {
      await assert.rejects(renderPage(loaded.control, [section]), error => {
        assert.equal(redirectLocation(error, basePath), basePath + destination);
        return true;
      });
    }
  }
});
