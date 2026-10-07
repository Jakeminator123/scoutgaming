import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { nextStudioLoginRedirect } from '../lib/next-page-navigation.mjs';
import { studioLoginDestination } from '../lib/studio-login-client.mjs';
import { normalizeNativeStudioPageRequest } from '../lib/studio-native-request.mjs';

const require = createRequire(import.meta.url);
const navigation = require('next/dist/client/components/redirect.js');
const { addPathPrefix } = require('next/dist/shared/lib/router/utils/add-path-prefix.js');
const { transformSync } = require('next/dist/build/swc');
const studioReturns = ['/studio', '/studio/administration', '/studio/openclaw', '/studio/operator-chat',
  '/studio/tree', '/studio/activity', '/studio/guide', '/studio/zones', '/studio/videos', '/studio/events', '/studio/probe'];

// These are the installed Next SSR error and path functions used by app-render,
// rather than a replacement redirect implementation or a running devserver.
function locationFromNext(error, basePath) {
  assert.equal(navigation.getRedirectStatusCodeFromError(error), 307);
  return addPathPrefix(navigation.getURLFromRedirectError(error), basePath);
}

test('Next SSR emits one basePath while public login returnTo survives unchanged', () => {
  for (const basePath of ['', '/studio']) {
    for (const returnTo of studioReturns) {
      let thrown;
      try { navigation.redirect(nextStudioLoginRedirect(returnTo)); } catch (error) { thrown = error; }
      const location = locationFromNext(thrown, basePath);
      const url = new URL(location, 'https://qa.example.invalid');
      assert.equal(url.pathname, `${basePath}/login`);
      assert.equal(url.searchParams.get('returnTo'), returnTo);
      assert.equal(studioLoginDestination(returnTo, basePath + '/api/auth'),
        basePath ? returnTo : returnTo.slice('/studio'.length) || '/');
    }
  }
});

test('malformed and foreign return targets cannot alter the SSR redirect destination', () => {
  for (const value of [null, [], {}, '/studio/administration?token=private', '/studio/studio',
    'https://attacker.invalid', '//attacker.invalid', '/studio\\login', '/studio/%2f..',
    '/studio#secret', '/blackjack', '/studio\r\nLocation: https://attacker.invalid']) {
    const target = nextStudioLoginRedirect(value);
    const url = new URL(addPathPrefix(target, '/studio'), 'https://qa.example.invalid');
    assert.equal(url.pathname, '/studio/login');
    assert.equal(url.search, '?returnTo=%2Fstudio');
  }
});

function load(file, overrides, env = {}) {
  const url = new URL(file, import.meta.url), source = readFileSync(url, 'utf8');
  const { code } = transformSync(source, { filename: file,
    jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' } });
  const module = { exports: {} }, localRequire = createRequire(url);
  vm.runInNewContext(code, { module, exports: module.exports, Request, Headers, URL, process: {env},
    require: name => Object.hasOwn(overrides, name) ? overrides[name] : localRequire(name) }, { filename: file });
  return module.exports;
}

function nativeOverrides(status) {
  return {
    nativeStudioAdminEnabled: () => true,
    nativeStudioAdminConfiguration: () => ({ allowedOrigins: ['https://qa.example.invalid'] }),
    assertNativeStudioRequest: () => {},
    studioNativeRuntime: async () => ({
      config: { authBase: '/studio/api/auth', apiBase: '/studio/api/admin', allowedOrigins: ['https://qa.example.invalid'] },
      authorize: async () => { throw Object.assign(new Error('fixture authorization'), { statusCode: status }); },
    }),
  };
}

test('actual Studio SSR guard reaches mounted login after 401 and preserves other authorization failures', async () => {
  for (const status of [401, 403, 503]) {
    const guard = load('../lib/ui-server.ts', {
      'next/navigation': navigation,
      './http-guard.mjs': { assertLocalPageRequest: () => assert.fail('native failure cannot become local access') },
      './studio-server.mjs': { studioInitialData: () => assert.fail('no legacy data fallback') },
      './remote-ui.mjs': { remoteUiConfiguration: () => null },
      './studio-native-runtime.mjs': nativeOverrides(status),
      './studio-native-request.mjs': { normalizeNativeStudioPageRequest: request => request },
      './next-page-navigation.mjs': { nextStudioLoginRedirect },
    });
    await assert.rejects(guard.authorizeUiPage(new Request('https://qa.example.invalid/studio')), error => {
      if (status === 401) assert.equal(locationFromNext(error, '/studio'), '/studio/login?returnTo=%2Fstudio');
      else assert.equal(error.statusCode, status);
      return true;
    });
  }
});

test('actual native page guard returns every current view after public, standalone and rewritten document entry', async () => {
  for (const basePath of ['', '/studio']) {
    const config = { allowedOrigins: ['https://game.fixture.invalid', 'https://studio.fixture.invalid'],
      publicHosts: ['game.fixture.invalid', 'studio.fixture.invalid'],
      apiBase: basePath + '/api/admin', authBase: basePath + '/api/auth' };
    const authorized = [];
    const guard = load('../lib/ui-server.ts', {
      'next/navigation': navigation,
      './http-guard.mjs': { assertLocalPageRequest: () => assert.fail('native failure cannot become local access') },
      './studio-server.mjs': { studioInitialData: () => assert.fail('no legacy data fallback') },
      './remote-ui.mjs': { remoteUiConfiguration: () => null },
      './studio-native-runtime.mjs': { nativeStudioAdminEnabled: () => true, nativeStudioAdminConfiguration: () => config,
        assertNativeStudioRequest: () => {}, studioNativeRuntime: async () => ({ authorize: async request => {
          authorized.push(request.url); throw Object.assign(new Error('fixture authorization'), {statusCode: 401});
        } }) },
      './studio-native-request.mjs': { normalizeNativeStudioPageRequest },
      './next-page-navigation.mjs': { nextStudioLoginRedirect },
    });
    for (const returnTo of studioReturns) {
      const appPath = returnTo.slice('/studio'.length) || '/';
      for (const [host, extra] of [['game.fixture.invalid', {}], ['studio.fixture.invalid', {}],
        ['studio.fixture.invalid', {'x-forwarded-host': 'game.fixture.invalid'}]]) {
        const request = new Request('http://' + host + appPath,
          { headers: {host, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', 'sec-fetch-site': 'cross-site', ...extra} });
        await assert.rejects(guard.authorizeUiPage(request), error => {
          const login = new URL(locationFromNext(error, basePath), config.allowedOrigins[0]);
          assert.equal(login.pathname, basePath + '/login');
          assert.equal(login.searchParams.get('returnTo'), returnTo);
          assert.equal(login.searchParams.size, 1);
          return true;
        });
        const normalized = new URL(authorized.at(-1));
        assert.equal(normalized.protocol, 'https:');
        assert.equal(normalized.pathname, basePath + (appPath === '/' ? '' : appPath) || '/');
        if (extra['x-forwarded-host']) assert.equal(normalized.host, 'game.fixture.invalid');
      }
    }
  }
});

test('editor SSR authorization uses each real route and OpenClaw settings and chat reload render distinct surfaces', async () => {
  const saved = process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  try {
    for (const basePath of ['', '/studio']) {
      process.env.NEXT_PUBLIC_LAB_BASE_PATH = basePath;
      const routes = load('../components/studio-types.ts', {}), requests = [];
      function Editor() { assert.fail('SSR delegates an element without invoking client work'); }
      const page = load('../app/studio-page.tsx', {
        'next/headers': { headers: async () => new Headers({host: 'game.fixture.invalid'}) },
        '@/components/studio': {Studio: Editor}, '@/components/studio-types': routes,
        '@/lib/ui-server': { studioUiInitialData: async request => {
          requests.push(request.url); return {project: {fixture: true}, videos: {videos: []}, status: {configured: false}};
        } },
      });
      const paths = { tree: '/control/tree', lab: '/control/events', videos: '/control/videos', activity: '/control/activity', openclaw: '/control/operator-chat', guide: '/control/guide', probe: '/control/probe' };
      for (const [view, path] of Object.entries(paths)) {
        const element = await page.StudioPage({view});
        assert.equal(element.type, Editor); assert.equal(element.props.initialView, view);
        assert.equal(requests.at(-1), 'http://game.fixture.invalid' + path);
      }
      const chatPage = load('../app/control/operator-chat/page.tsx', {'../../studio-page': page});
      const chat = chatPage.default();
      assert.equal(chat.type, page.StudioPage); assert.equal(chat.props.view, 'openclaw');
      const reloadedChat = await chat.type(chat.props);
      assert.equal(reloadedChat.type, Editor); assert.equal(reloadedChat.props.initialView, 'openclaw');
      assert.equal(requests.at(-1), 'http://game.fixture.invalid/control/operator-chat');

      function Models() { assert.fail('SSR does not invoke model client work'); }
      const models = load('../app/control/openclaw/page.tsx', {
        'next/headers': { headers: async () => new Headers({host: 'game.fixture.invalid'}) },
        '@/lib/ui-server': {authorizeUiPage: async request => requests.push(request.url)},
        '@/components/openclaw-workspace': {OpenClawWorkspace: Models},
      });
      assert.equal((await models.default()).type, Models);
      assert.equal(requests.at(-1), 'http://game.fixture.invalid/control/openclaw');
    }
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;
    else process.env.NEXT_PUBLIC_LAB_BASE_PATH = saved;
  }
});

test('Studio SSR serializes only the standalone voice capability matching native and Neon server flags', async () => {
  for (const env of [{}, {CROUPIER_STUDIO_NATIVE_ADMIN: '0', CROUPIER_STUDIO_NEON_POLICY: '0'},
    {CROUPIER_STUDIO_NATIVE_ADMIN: '1'}, {CROUPIER_STUDIO_NEON_POLICY: '1'},
    {CROUPIER_STUDIO_NATIVE_ADMIN: '1', CROUPIER_STUDIO_NEON_POLICY: '1'}]) {
    const page = load('../app/studio-page.tsx', {
      'next/headers': {headers: async () => new Headers({host: 'game.fixture.invalid'})},
      '@/components/studio': {Studio() {}}, '@/components/studio-types': {viewPaths: {openclaw: '/operator-chat'}},
      '@/lib/ui-server': {studioUiInitialData: async () => ({project: {}, videos: {videos: []}, status: {configured: true}})},
    }, env);
    const element = await page.StudioPage({view: 'openclaw'});
    assert.equal(element.props.standaloneVoicePreviewAvailable,
      env.CROUPIER_STUDIO_NATIVE_ADMIN !== '1' && env.CROUPIER_STUDIO_NEON_POLICY !== '1');
    assert.ok(!Object.keys(element.props).some(key => key.startsWith('CROUPIER_')));
  }
});

test('actual administration page uses Next-local login with the exact public return destination', async () => {
  for (const status of [401, 403]) {
    const page = load('../app/control/administration/page.tsx', {
      'next/navigation': navigation,
      'next/headers': { headers: async () => new Headers({ host: 'qa.example.invalid' }) },
      '@/components/native-administration': {},
      '@/lib/studio-native-runtime.mjs': nativeOverrides(status),
      '@/lib/studio-native-request.mjs': { normalizeNativeStudioPageRequest: request => request },
      '@/lib/next-page-navigation.mjs': { nextStudioLoginRedirect },
    });
    await assert.rejects(page.default(), error => {
      if (status === 401) assert.equal(locationFromNext(error, '/studio'), '/studio/login?returnTo=%2Fstudio%2Fadministration');
      else assert.equal(error.statusCode, status);
      return true;
    });
  }
});

test('administration without native configuration fails before runtime initialization', async () => {
  const page = load('../app/control/administration/page.tsx', {
    'next/navigation': navigation,
    'next/headers': { headers: async () => new Headers({ host: 'qa.example.invalid' }) },
    '@/components/native-administration': {},
    '@/lib/studio-native-runtime.mjs': {
      nativeStudioAdminConfiguration: () => null,
      assertNativeStudioRequest: () => assert.fail('missing configuration cannot authorize'),
      studioNativeRuntime: () => assert.fail('missing configuration cannot initialize runtime'),
    },
    '@/lib/studio-native-request.mjs': { normalizeNativeStudioPageRequest: (_request, config) => {
      assert.equal(config, null);
      throw Object.assign(new Error('studio_native_unavailable'), { statusCode: 503 });
    } },
    '@/lib/next-page-navigation.mjs': { nextStudioLoginRedirect },
  });
  await assert.rejects(page.default(), error => error.statusCode === 503);
});

test('actual retired Lissabon page redirects to public /control', async () => {
  let target;
  const page = load('../app/lissabon/page.tsx', {
    '../control/public-redirect': { redirectToPublicControl: async pathname => { target = pathname; throw new Error('redirected'); } },
  });
  await assert.rejects(page.default(), /redirected/);
  assert.equal(target, '/control');
});

const authEntryConfig = authBase => ({
  allowedOrigins: ['https://game.fixture.invalid', 'https://studio.fixture.invalid'],
  publicHosts: ['game.fixture.invalid', 'studio.fixture.invalid'],
  authBase, apiBase: authBase === '/api/auth' ? '/api/admin' : '/studio/api/admin',
});
const entryRequest = (host, mode, extra = {}) => new Request('https://' + host + '/' + mode,
  { headers: { host, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', ...extra } });

test('standalone auth documents move to configured public Studio before rendering with exact state and token', async () => {
  const { nextStudioAuthEntryRedirect } = await import('../lib/next-page-navigation.mjs');
  for (const authBase of ['/api/auth', '/studio/api/auth']) {
    const config = authEntryConfig(authBase);
    for (const kind of ['game', 'lab']) {
      const returnTo = '/api/bo/' + kind + '-login?state=' + 'a'.repeat(64);
      const destination = nextStudioAuthEntryRedirect(entryRequest('studio.fixture.invalid', 'login'), config, { returnTo });
      let thrown; try { navigation.redirect(destination); } catch (error) { thrown = error; }
      const actual = new URL(locationFromNext(thrown, authBase === '/api/auth' ? '' : '/studio'));
      assert.equal(actual.origin, config.allowedOrigins[0]);
      assert.equal(actual.pathname, '/studio/login');
      assert.equal(actual.searchParams.get('returnTo'), returnTo);
      assert.equal(actual.searchParams.size, 1);
    }
    const token = 'b'.repeat(43);
    const destination = nextStudioAuthEntryRedirect(entryRequest('studio.fixture.invalid', 'set-password'), config, { mode: 'set-password', token });
    assert.equal(destination, config.allowedOrigins[0] + '/studio/set-password?t=' + token);
    assert.equal(nextStudioAuthEntryRedirect(entryRequest('game.fixture.invalid', 'set-password'), config, { mode: 'set-password', token }), null);
    assert.equal(nextStudioAuthEntryRedirect(entryRequest('studio.fixture.invalid', 'login', { 'x-forwarded-host': 'game.fixture.invalid', 'x-forwarded-proto': 'https' }), config, { returnTo: '/studio' }), null);
    assert.equal(nextStudioAuthEntryRedirect(entryRequest('studio.fixture.invalid', 'set-password', { 'x-forwarded-host': 'game.fixture.invalid', 'x-forwarded-proto': 'https' }), config, { mode: 'set-password', token }), null);
  }
});

test('auth-entry redirects reject spoofed origins and retain only validated returnTo or scalar bearer', async () => {
  const { nextStudioAuthEntryRedirect } = await import('../lib/next-page-navigation.mjs');
  const config = authEntryConfig('/studio/api/auth'), request = entryRequest('studio.fixture.invalid', 'login');
  for (const returnTo of ['https://attacker.invalid', '//attacker.invalid', '/studio?draft=private', '/api/bo/game-login?state=' + 'a'.repeat(63), ['x']]) {
    const url = new URL(nextStudioAuthEntryRedirect(request, config, { returnTo }));
    assert.equal(url.searchParams.get('returnTo'), '/studio');
    assert.equal(url.origin, config.allowedOrigins[0]);
  }
  for (const token of [null, ['b'.repeat(43)], 'b'.repeat(129), 'bearer/private']) {
    assert.equal(nextStudioAuthEntryRedirect(request, config, { mode: 'set-password', token }), config.allowedOrigins[0] + '/studio/set-password');
  }
  for (const headers of [{host: 'attacker.invalid'}, {host: 'studio.fixture.invalid', 'x-forwarded-host': 'attacker.invalid'}, {host: 'studio.fixture.invalid', origin: 'https://attacker.invalid'}, {host: 'studio.fixture.invalid', 'x-forwarded-proto': 'http'}]) {
    assert.throws(() => nextStudioAuthEntryRedirect(new Request('https://studio.fixture.invalid/login', { headers }), config), error => error.statusCode === 403);
  }
});

test('actual login and password SSR routes redirect standalone before any auth form and preserve public rewrite rendering', async () => {
  const { nextStudioAuthEntryRedirect } = await import('../lib/next-page-navigation.mjs');
  for (const authBase of ['/api/auth', '/studio/api/auth']) for (const mode of ['login', 'set-password']) {
    const config = authEntryConfig(authBase), token = 'b'.repeat(43), returnTo = '/api/bo/lab-login?state=' + 'a'.repeat(64);
    for (const [host, extra, moved] of [
      ['studio.fixture.invalid', {}, true], ['game.fixture.invalid', {}, false],
      ['studio.fixture.invalid', {'x-forwarded-host': 'game.fixture.invalid'}, false],
    ]) {
      const page = load('../app/' + mode + '/page.tsx', {
        'next/headers': { headers: async () => new Headers({host, ...extra}) },
        'next/navigation': navigation,
        '@/components/studio-login': { StudioLogin() { assert.fail('SSR returns an element, never auth work'); } },
        '@/lib/studio-native-runtime.mjs': {nativeStudioAdminEnabled: () => true, nativeStudioAdminConfiguration: () => config},
        '@/lib/next-page-navigation.mjs': { nextStudioAuthEntryRedirect },
        '@/lib/studio-login-client.mjs': { studioLoginReturnTo: value => value, studioPasswordToken: value => value },
      });
      const options = { searchParams: Promise.resolve({token: 'ignored', t: token, returnTo, gameOrigin: 'https://attacker.invalid'}) };
      if (moved) {
        await assert.rejects(page.default(options), error => {
          const destination = new URL(locationFromNext(error, authBase === '/api/auth' ? '' : '/studio'));
          assert.equal(destination.origin, config.allowedOrigins[0]); assert.equal(destination.pathname, '/studio/' + mode);
          assert.equal(destination.searchParams.get(mode === 'login' ? 'returnTo' : 't'), mode === 'login' ? returnTo : token);
          assert.equal(destination.searchParams.size, 1); return true;
        });
      } else {
        const element = await page.default(options);
        assert.equal(element.props.authBase, authBase);
        assert.equal(element.props.gameOrigin, config.allowedOrigins[0]);
        assert.equal(mode === 'login' ? element.props.returnTo : element.props.token, mode === 'login' ? returnTo : token);
      }
    }
  }
});

test('legacy auth aliases retain queries with exactly one configured Next basePath', async () => {
  const saved = { native: process.env.CROUPIER_STUDIO_NATIVE_ADMIN, base: process.env.CROUPIER_LAB_BASE_PATH };
  try {
    const config = (await import('../next.config.mjs')).default;
    for (const basePath of ['', '/studio']) {
      process.env.CROUPIER_STUDIO_NATIVE_ADMIN = '1'; process.env.CROUPIER_LAB_BASE_PATH = basePath;
      const rules = await config.redirects();
      for (const mode of ['login', 'set-password']) {
        const rule = rules.find(item => item.source === (basePath ? '/' : '/studio/') + mode);
        assert.equal(rule.basePath, false); assert.equal(rule.permanent, false);
        assert.equal(rule.destination, (basePath ? '/studio/' : '/') + mode);
        assert.ok(!rules.some(item => item.source === rule.destination), 'canonical route cannot loop back to the alias');
      }
    }
    process.env.CROUPIER_STUDIO_NATIVE_ADMIN = '0';
    assert.deepEqual(await config.redirects(), []);
  } finally {
    for (const [key, value] of [['CROUPIER_STUDIO_NATIVE_ADMIN', saved.native], ['CROUPIER_LAB_BASE_PATH', saved.base]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
