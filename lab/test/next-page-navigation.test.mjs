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
    '/studio/control/lanes?tab=foreign', '/studio/control/lanes?token=private', '/studio/control/lanes?lane=x&lane=y',
    '/studio/control/lanes?lane=https%3A%2F%2Fattacker.invalid', '/studio#secret', '/blackjack', '/studio\r\nLocation: https://attacker.invalid']) {
    const target = nextStudioLoginRedirect(value);
    const url = new URL(addPathPrefix(target, '/studio'), 'https://qa.example.invalid');
    assert.equal(url.pathname, '/studio/login');
    assert.equal(url.search, '?returnTo=%2Fadmin');
  }
});

function load(file, overrides, env = {}) {
  const url = new URL(file, import.meta.url), source = readFileSync(url, 'utf8');
  const { code } = transformSync(source, { filename: file,
    jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' } });
  const module = { exports: {} }, localRequire = createRequire(url);
  vm.runInNewContext(code, { module, exports: module.exports, Request, Headers, URL, URLSearchParams, process: {env},
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
    for (const returnTo of [...studioReturns, '/studio/control/lanes?tab=companies', '/studio/control/lanes?lane=evening']) {
      const appPath = returnTo.slice('/studio'.length) || '/';
      for (const [host, extra] of [['game.fixture.invalid', {}], ['studio.fixture.invalid', {}],
        ['studio.fixture.invalid', {'x-forwarded-host': 'game.fixture.invalid'}]]) {
        const request = new Request('http://' + host + appPath,
          { headers: {host, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', 'sec-fetch-site': 'cross-site', ...extra} });
        await assert.rejects(guard.authorizeUiPage(request), error => {
          const login = new URL(locationFromNext(error, basePath), config.allowedOrigins[0]);
          assert.equal(login.pathname, basePath + '/login');
          const expectedReturn = returnTo === '/studio/control/lanes?tab=companies' ? '/control/companies' : returnTo === '/studio/control/lanes?lane=evening' ? '/control/rooms?composition=evening' : returnTo.startsWith('/studio/control/') ? returnTo.slice('/studio'.length) : returnTo;
          assert.equal(login.searchParams.get('returnTo'), expectedReturn);
          assert.equal(login.searchParams.size, 1);
          return true;
        });
        const normalized = new URL(authorized.at(-1));
        assert.equal(normalized.protocol, 'https:');
        assert.equal(normalized.pathname, basePath + (appPath === '/' ? '' : appPath.split('?')[0]) || '/');
        assert.equal(normalized.search, '', 'view query never changes the authorization request');
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
      const dataModule = load('../app/control-studio-data.tsx', {
        'next/headers': { headers: async () => new Headers({host: 'game.fixture.invalid'}) },
        '@/lib/ui-server': { studioUiInitialData: async request => {
          requests.push(request.url); return {project: {fixture: true}, videos: {videos: []}, status: {configured: false}};
        } },
      });
      function TreeSurface() { return null; }
      function EventsSurface() { return null; }
      const eventsPage = load('../app/control/events/page.tsx', {
        '@/components/control-tree-page': { ControlTreePage: TreeSurface },
        '@/components/control-events-page': { ControlEventsPage: EventsSurface },
        '@/components/studio-types': routes,
        '../../control-studio-data': dataModule,
      });
      const overview = await eventsPage.default({ searchParams: Promise.resolve({}) });
      assert.equal(overview.type, TreeSurface, '/control/events');
      assert.equal(requests.at(-1), 'http://game.fixture.invalid/control/events');
      const editor = await eventsPage.default({ searchParams: Promise.resolve({ event: 'idle.ready', dealer: ['mei'], variant: 'v2' }) });
      assert.equal(editor.type, EventsSurface);
      assert.equal(editor.props.initialDealerId, 'mei');
      assert.equal(editor.props.initialEventId, 'idle.ready');
      assert.equal(editor.props.initialVariantId, 'v2');
      const surfaces = [
        ['../app/control/videos/page.tsx', '@/components/control-videos-page', 'ControlVideosPage', '/control/videos'],
        ['../app/control/rehearsal/page.tsx', '@/components/control-activity-page', 'ControlActivityPage', '/control/rehearsal'],
        ['../app/control/guide/page.tsx', '@/components/control-guide-page', 'ControlGuidePage', '/control/guide'],
      ];
      for (const [file, specifier, exportName, path] of surfaces) {
        function Surface() { assert.fail('SSR delegates an element without invoking client work'); }
        const surface = load(file, {
          [specifier]: { [exportName]: Surface },
          '@/components/studio-types': routes,
          '../../control-studio-data': dataModule,
        });
        const element = await surface.default({ searchParams: Promise.resolve({}) });
        assert.equal(element.type, Surface, path);
        assert.equal(requests.at(-1), 'http://game.fixture.invalid' + path);
      }
      function Models() { assert.fail('SSR does not invoke model client work'); }
      const models = load('../app/control/openclaw/page.tsx', {
        'next/headers': { headers: async () => new Headers({host: 'game.fixture.invalid'}) },
        '@/lib/ui-server': {authorizeUiPage: async request => requests.push(request.url)},
        '@/components/openclaw-workspace': {OpenClawWorkspace: Models},
      });
      assert.equal((await models.default()).type, Models);
      assert.equal(requests.at(-1), 'http://game.fixture.invalid/control/openclaw');

      function ProbeSurface(props) { return props; }
      const probe = load('../app/control/probe/page.tsx', {
        '../../control-studio-data': dataModule,
        '@/components/control-probe-page': { ControlProbePage: ProbeSurface },
        '@/components/studio-types': routes,
      });
      const bareProbe = await probe.default();
      assert.equal(bareProbe.type, ProbeSurface);
      assert.equal(requests.at(-1), 'http://game.fixture.invalid/control/probe');
      const probed = await probe.default({ searchParams: Promise.resolve({ dealer: ['vera'], event: 'idle.ready' }) });
      assert.equal(probed.props.initialDealerId, 'vera');
      assert.equal(probed.props.initialEventId, 'idle.ready');

      function ChatSurface(props) { return props; }
      const chatRoute = load('../app/control/openclaw/page.tsx', {
        'next/headers': { headers: async () => new Headers({host: 'game.fixture.invalid'}) },
        '@/lib/ui-server': { authorizeUiPage: async () => assert.fail('chat tab loads studio data') },
        '@/components/openclaw-workspace': { OpenClawWorkspace: Models },
        '../../control-studio-data': dataModule,
        '@/components/control-openclaw-chat': { ControlOpenClawChat: ChatSurface },
        '@/components/studio-types': routes,
      });
      const chatElement = await chatRoute.default({ searchParams: Promise.resolve({ tab: 'chat', dealer: ['mei'] }) });
      assert.equal(chatElement.type, ChatSurface);
      assert.equal(chatElement.props.initialDealerId, 'mei');
      assert.equal(chatElement.props.standaloneVoicePreviewAvailable, process.env.CROUPIER_STUDIO_NATIVE_ADMIN !== '1' && process.env.CROUPIER_STUDIO_NEON_POLICY !== '1');
      assert.equal(requests.at(-1), 'http://game.fixture.invalid/control/openclaw');

      const operator = load('../app/control/operator-chat/page.tsx', {
        'next/headers': { headers: async () => new Headers({ host: 'studio.fixture.invalid', 'x-forwarded-host': 'game.fixture.invalid' }) },
        'next/navigation': navigation,
        '@/lib/lab-url.mjs': { publicAbsoluteUrl: require('../lib/lab-url.mjs').publicAbsoluteUrl },
        '@/components/studio-types': routes,
        '@/lib/ui-server': { authorizeUiPage: async request => { requests.push(request.url); } },
      });
      await assert.rejects(operator.default(), error => {
        const url = new URL(locationFromNext(error, basePath));
        assert.equal(url.protocol, 'https:');
        assert.equal(url.host, 'game.fixture.invalid');
        assert.equal(url.pathname, '/control/openclaw');
        assert.equal(url.search, '?tab=chat');
        return true;
      });
      await assert.rejects(operator.default({ searchParams: Promise.resolve({ dealer: 'vera', event: 'idle.ready' }) }), error => {
        const url = new URL(locationFromNext(error, basePath));
        assert.equal(url.pathname.startsWith('/studio'), false);
        assert.equal(url.searchParams.get('tab'), 'chat');
        assert.equal(url.searchParams.get('dealer'), 'vera');
        assert.equal(url.searchParams.get('event'), 'idle.ready');
        return true;
      });
      assert.equal(requests.at(-1), 'http://studio.fixture.invalid/control/operator-chat');

      const tree = load('../app/control/tree/page.tsx', {
        'next/headers': { headers: async () => new Headers({ host: 'studio.fixture.invalid', 'x-forwarded-host': 'game.fixture.invalid' }) },
        '@/lib/lab-url.mjs': { publicAbsoluteUrl: require('../lib/lab-url.mjs').publicAbsoluteUrl },
        '@/lib/ui-server': { authorizeUiPage: async request => { requests.push(request.url); } },
      });
      await assert.rejects(tree.default({ searchParams: Promise.resolve({ dealer: 'vera', event: 'idle.ready', variant: 'v2', extra: 'kept' }) }), error => {
        assert.equal(navigation.getRedirectStatusCodeFromError(error), 308);
        const url = new URL(navigation.getURLFromRedirectError(error));
        assert.equal(url.protocol, 'https:');
        assert.equal(url.host, 'game.fixture.invalid');
        assert.equal(url.pathname.startsWith('/studio'), false);
        assert.equal(url.pathname, '/control/events');
        assert.equal(url.searchParams.get('dealer'), 'vera');
        assert.equal(url.searchParams.get('event'), 'idle.ready');
        assert.equal(url.searchParams.get('variant'), 'v2');
        assert.equal(url.searchParams.get('extra'), 'kept');
        return true;
      });
      await assert.rejects(tree.default(), error => {
        const url = new URL(navigation.getURLFromRedirectError(error));
        assert.equal(navigation.getRedirectStatusCodeFromError(error), 308);
        assert.equal(url.pathname, '/control/events');
        assert.equal(url.search, '');
        return true;
      });
    }
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;
    else process.env.NEXT_PUBLIC_LAB_BASE_PATH = saved;
  }
});

test('OpenClaw chat SSR serializes only the standalone voice capability matching native and Neon server flags', async () => {
  for (const env of [{}, {CROUPIER_STUDIO_NATIVE_ADMIN: '0', CROUPIER_STUDIO_NEON_POLICY: '0'},
    {CROUPIER_STUDIO_NATIVE_ADMIN: '1'}, {CROUPIER_STUDIO_NEON_POLICY: '1'},
    {CROUPIER_STUDIO_NATIVE_ADMIN: '1', CROUPIER_STUDIO_NEON_POLICY: '1'}]) {
    function Chat() { return null; }
    const page = load('../app/control/openclaw/page.tsx', {
      'next/headers': {headers: async () => new Headers({host: 'game.fixture.invalid'})},
      '@/lib/ui-server': { authorizeUiPage: async () => assert.fail('chat tab loads studio data') },
      '@/components/openclaw-workspace': { OpenClawWorkspace() { assert.fail('chat tab does not render model settings'); } },
      '../../control-studio-data': { loadControlStudio: async () => ({project: {}, videos: {videos: []}, status: {configured: true}}) },
      '@/components/control-openclaw-chat': { ControlOpenClawChat: Chat },
      '@/components/studio-types': { firstQueryValue(value) { return Array.isArray(value) ? value[0] : value; } },
    }, env);
    const element = await page.default({ searchParams: Promise.resolve({ tab: 'chat' }) });
    assert.equal(element.type, Chat);
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
      '@/components/studio-types': {firstQueryValue:value=>Array.isArray(value)?value[0]:value},
      '../public-redirect': {redirectToPublicControl:()=>assert.fail('unauthorized page must not redirect to rooms')},
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
      '@/components/studio-types': {firstQueryValue:value=>Array.isArray(value)?value[0]:value},
      '../public-redirect': {redirectToPublicControl:()=>assert.fail('unauthorized page must not redirect to rooms')},
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
    assert.equal(url.searchParams.get('returnTo'), '/admin');
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

test('retired zone entries redirect to public composition without a doubled basePath', async () => {
  const { publicAbsoluteUrl } = require('../lib/lab-url.mjs');
  const publicRedirect = load('../app/control/public-redirect.ts', {
    'next/headers': { headers: async () => new Headers({ host: 'studio.fixture.invalid', 'x-forwarded-host': 'game.fixture.invalid' }) },
    'next/navigation': navigation,
    '@/lib/lab-url.mjs': { publicAbsoluteUrl },
  });
  for (const file of ['../app/zones/page.tsx']) {
    const page = load(file, {
      '../public-redirect': publicRedirect,
      '../control/public-redirect': publicRedirect,
    });
    await assert.rejects(page.default(), error => {
      assert.equal(navigation.getURLFromRedirectError(error), 'https://game.fixture.invalid/control/preview');
      assert.equal(navigation.getRedirectStatusCodeFromError(error), 307);
      return true;
    });
  }
});


test('old activity URLs retain only observation context and canonicalize the composition alias', async () => {
  const destinations = [];
  const page = load('../app/control/activity/page.tsx', { '../public-redirect': { redirectToPublicControl: async value => destinations.push(value) } });
  await page.default({ searchParams: Promise.resolve({ dealer: 'vera', event: 'speak.goodluck', operator: 'operator-one', table: 'room-1', lane: 'mobile-phone', token: 'private' }) });
  assert.equal(destinations[0], '/control/rehearsal?dealer=vera&operator=operator-one&table=room-1&composition=mobile-phone');
  await page.default({ searchParams: Promise.resolve({ dealer: ['vera', 'mei'], composition: 'chosen', lane: 'stale' }) });
  assert.equal(destinations[1], '/control/rehearsal?composition=chosen');
});


test('dealer pages retain allowlisted context through an expired session and normalize legacy selections', async () => {
  for (const basePath of ['', '/studio']) {
    const config = {allowedOrigins:['https://game.fixture.invalid','https://studio.fixture.invalid'],publicHosts:['game.fixture.invalid','studio.fixture.invalid'],apiBase:basePath+'/api/admin',authBase:basePath+'/api/auth'};
    const guard = load('../lib/ui-server.ts', {
      'next/navigation': navigation,
      './http-guard.mjs': {assertLocalPageRequest:()=>assert.fail('no local fallback')},
      './studio-server.mjs': {studioInitialData:()=>assert.fail('no legacy fallback')},
      './remote-ui.mjs': {remoteUiConfiguration:()=>null},
      './studio-native-runtime.mjs': {nativeStudioAdminEnabled:()=>true,nativeStudioAdminConfiguration:()=>config,assertNativeStudioRequest:()=>{},studioNativeRuntime:async()=>({authorize:async()=>{throw Object.assign(new Error('fixture authorization'),{statusCode:401});}})},
      './studio-native-request.mjs': {normalizeNativeStudioPageRequest},
      './next-page-navigation.mjs': {nextStudioLoginRedirect},
    });
    const data = load('../app/control-studio-data.tsx', {
      'next/headers': {headers:async()=>new Headers({host:'game.fixture.invalid','sec-fetch-mode':'navigate','sec-fetch-dest':'document'})},
      '@/lib/ui-server':guard,
    });
    const studioTypes = load('../components/studio-types.ts', {});
    for(const [route,component,exportName] of [['clips','@/components/lab-studio','LabStudio'],['rehearsal','@/components/control-activity-page','ControlActivityPage']]) {
      const page = load('../app/control/'+route+'/page.tsx', {'../../control-studio-data':data,'@/components/studio-types':studioTypes,[component]:{[exportName]:()=>assert.fail('expired session cannot render client work')}});
      for(const legacy of [false,true]) {
        const query={dealer:'vera',operator:'operator-42',table:'room-7',[legacy?'lane':'composition']:'desktop-wide',token:'do-not-copy',returnTo:'https://untrusted.invalid'};
        if(route==='clips')Object.assign(query,{view:'settings',category:'speech',event:'speak.goodluck',situation:'goodluck'});
        await assert.rejects(page.default({searchParams:Promise.resolve(query)}),error=>{
          assert.match(error.digest ?? '', /^NEXT_REDIRECT;/, error.message);
          const login = new URL(locationFromNext(error,basePath),'https://game.fixture.invalid');
          assert.equal(login.pathname,basePath+'/login');
          const destination = new URL(login.searchParams.get('returnTo'),'https://game.fixture.invalid');
          assert.equal(destination.pathname,'/control/'+route);
          assert.equal(destination.searchParams.get('dealer'),'vera');assert.equal(destination.searchParams.get('operator'),'operator-42');assert.equal(destination.searchParams.get('table'),'room-7');assert.equal(destination.searchParams.get('composition'),'desktop-wide');
          assert.equal(destination.searchParams.has('lane'),false);assert.equal(destination.searchParams.has('token'),false);assert.equal(destination.searchParams.has('returnTo'),false);
          if(route==='clips'){assert.equal(destination.searchParams.get('view'),'settings');assert.equal(destination.searchParams.get('category'),'speech');assert.equal(destination.searchParams.get('event'),'speak.goodluck');assert.equal(destination.searchParams.get('situation'),'goodluck');}
          return true;
        });
      }
    }
  }
});


test('legacy administration tables await the public room redirect after authorization', async () => {
  const calls=[];
  const publicRedirect=load('../app/control/public-redirect.ts', {
    'next/navigation': navigation,
    'next/headers': {headers:async()=>{calls.push('public-host');return new Headers({host:'studio.fixture.invalid','x-forwarded-host':'game.fixture.invalid'});}},
    '@/lib/lab-url.mjs': {publicAbsoluteUrl:require('../lib/lab-url.mjs').publicAbsoluteUrl},
  });
  const page=load('../app/control/administration/page.tsx', {
    'next/navigation': navigation,
    'next/headers': {headers:async()=>new Headers({host:'game.fixture.invalid'})},
    '@/components/native-administration': {NativeAdministration:()=>assert.fail('the retired room view must redirect')},
    '@/components/studio-types': {firstQueryValue:value=>Array.isArray(value)?value[0]:value},
    '../public-redirect':publicRedirect,
    '@/lib/studio-native-request.mjs': {normalizeNativeStudioPageRequest:request=>request},
    '@/lib/next-page-navigation.mjs': {nextStudioLoginRedirect},
    '@/lib/studio-native-runtime.mjs': {
      nativeStudioAdminConfiguration:()=>({}),assertNativeStudioRequest:()=>{},
      studioNativeRuntime:async()=>({authorize:async()=>{calls.push('authorize');return{};},api:{availableActions:()=>assert.fail('must await redirect before preparing page')},config:{allowedOrigins:['https://game.fixture.invalid']}}),
    },
  });
  await assert.rejects(page.default({searchParams:Promise.resolve({tab:'tables',operator:'operator-42',lane:'mobile-phone',dealer:'vera',table:'room-7',token:'do-not-copy'})}),error=>{
    const url=new URL(locationFromNext(error,''));
    assert.equal(url.origin,'https://game.fixture.invalid');assert.equal(url.pathname,'/control/rooms');
    assert.equal(url.searchParams.get('operator'),'operator-42');assert.equal(url.searchParams.get('composition'),'mobile-phone');assert.equal(url.searchParams.get('dealer'),'vera');assert.equal(url.searchParams.get('table'),'room-7');assert.equal(url.searchParams.has('token'),false);
    return true;
  });
  assert.deepEqual(calls,['authorize','public-host']);
});


test('actual Admin middleware preserves document access with Node transport before or after middleware', async t => {
  const {createServer} = await import('node:http');
  const {mkdtemp, mkdir, writeFile, rm} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const {NextRequest} = require('next/server.js');
  const routing = await import('../../apps/croupier-frontend/lib/platform-routing.mjs');
  const preview = await import('../lib/design-preview.mjs');
  const nativeRuntime = await import('../lib/studio-native-runtime.mjs');
  const {createStudioNativeAuth} = await import('../../packages/studio-access/studio-native-auth.mjs');
  const {createPublicationChain} = await import('../../test/fixtures/admin-publication-chain.mjs');
  const publicOrigin = 'https://admin.fixture.invalid';
  const f = await createPublicationChain(publicOrigin);
  const platform = {publicOrigin, labUiOrigin: publicOrigin, backendOrigin:'https://engine.fixture.invalid',
    unifiedUi:true, nativeStudio:true};
  const middleware = load('../middleware.ts', {
    '../apps/croupier-frontend/lib/platform-routing.mjs': {...routing, platformConfiguration:()=>platform},
  }, {CROUPIER_VERCEL_UNIFIED_UI:'1'}).middleware;
  const runtime = {...nativeRuntime, nativeStudioAdminEnabled:()=>true, nativeStudioAdminConfiguration:()=>f.config,
    studioNativeRuntime:async()=>({authorize:createStudioNativeAuth({boDb:f.auth.boDb,scope:f.config.scope,now:f.config.now})})};
  const guard = load('../lib/ui-server.ts', {'./studio-native-runtime.mjs':runtime});
  const root = await mkdtemp(join(tmpdir(),'croupier-admin-document-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'admin'));
  await writeFile(join(root,'admin/index.html'),'<!doctype html><html><body>Authorized Admin fixture</body></html>');
  const admin = load('../app/admin/[[...path]]/route.ts', {
    '../../../lib/ui-server':guard,'../../../lib/studio-native-runtime.mjs':runtime,
    '../../../lib/design-preview.mjs':{...preview,serveDesignPreview:(request,path,options)=>preview.serveDesignPreview(request,path,{...options,root})},
  });
  // Exercise a real local Node fetch hop: it rewrites Sec-Fetch-Mode to cors.
  // The synthetic accounts and tiny static document never touch production.
  const server = createServer((request,response)=>{
    response.writeHead(200,{'content-type':'application/json'});
    response.end(JSON.stringify(Object.fromEntries(['sec-fetch-mode','sec-fetch-dest','sec-fetch-site']
      .map(name=>[name,request.headers[name]??null]))));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const throughTransport = async headers => {
    const transport = await fetch('http://127.0.0.1:'+server.address().port,{headers});
    const metadata = await transport.json(), transported = new Headers(headers);
    assert.equal(metadata['sec-fetch-mode'],'cors');
    assert.equal(metadata['sec-fetch-dest'],'document');
    for (const [name,value] of Object.entries(metadata)) {
      if(value===null)transported.delete(name);else transported.set(name,value);
    }
    return transported;
  };
  for (const position of ['before','after']) for (const path of ['/admin','/admin/dealers','/studio/admin','/studio/admin/dealers']) {
    let incoming = new Headers({host:new URL(publicOrigin).host,cookie:f.auth.admin,
      'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'});
    if(position==='before') incoming = await throughTransport(incoming);
    const request = new NextRequest(publicOrigin+path,{headers:incoming});
    const routed = middleware(request);
    let headers = new Headers();
    assert.ok(routed.headers.get('x-middleware-override-headers'));
    for (const name of routed.headers.get('x-middleware-override-headers').split(','))
      headers.set(name,routed.headers.get('x-middleware-request-'+name));
    assert.equal(headers.get('cookie'),f.auth.admin);
    assert.equal(headers.has('origin'),false);
    if(position==='after') headers = await throughTransport(headers);
    const destination = routed.headers.get('x-middleware-rewrite') ?? publicOrigin+path;
    const segments = path.endsWith('/dealers') ? ['dealers'] : [];
    const response = await admin.GET(new Request(destination,{headers}),{params:Promise.resolve({path:segments})});
    assert.equal(response.status,200,position+' middleware: '+path+' must authorize the unchanged synthetic admin cookie after the proxy hop');
    assert.match(await response.text(),/Authorized Admin fixture/);
    const anonymous = new Headers(headers);anonymous.delete('cookie');
    const login = await admin.GET(new Request(destination,{headers:anonymous}),{params:Promise.resolve({path:segments})});
    assert.equal(login.status,307,'document normalization never grants a session');
    assert.match(login.headers.get('location'),/^\/login\?returnTo=/);
  }
});

test('retired Control pages use the central Admin destination with room and material context intact',async()=>{
  const {publicAbsoluteUrl}=require('../lib/lab-url.mjs');
  const redirects=load('../app/control/public-redirect.ts',{
    'next/headers':{headers:async()=>new Headers({host:'studio.fixture.invalid','x-forwarded-host':'game.fixture.invalid'})},
    'next/navigation':navigation,'@/lib/lab-url.mjs':{publicAbsoluteUrl},
  });
  for(const [section,destination] of [['library','assets'],['lanes','companies'],['preview','compositions'],['zones','compositions']]){
    const page=load('../app/control/'+section+'/page.tsx',{'../public-redirect':redirects});
    const query={dealer:'dragan',operator:'north',room:['one','two'],game:'roulette',lane:'portrait',role:'background',tab:section==='lanes'?'companies':'backgrounds',token:'private'};
    await assert.rejects(page.default({searchParams:Promise.resolve(query)}),error=>{
      assert.equal(navigation.getRedirectStatusCodeFromError(error),307);
      const url=new URL(navigation.getURLFromRedirectError(error));
      assert.equal(url.origin,'https://game.fixture.invalid');assert.equal(url.pathname,'/admin/'+destination);
      for(const [key,value] of [['dealer','dragan'],['operator','north'],['game','roulette'],['composition','portrait']])assert.equal(url.searchParams.get(key),value);
      assert.deepEqual(url.searchParams.getAll('room'),['one','two']);assert.equal(url.searchParams.has('lane'),false);assert.equal(url.searchParams.has('token'),false);
      if(section==='library')assert.equal(url.searchParams.get('tab'),'backgrounds');
      return true;
    });
  }
});
