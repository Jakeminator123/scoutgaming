import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { nextStudioLoginRedirect } from '../lib/next-page-navigation.mjs';
import { studioLoginDestination } from '../lib/studio-login-client.mjs';

const require = createRequire(import.meta.url);
const navigation = require('next/dist/client/components/redirect.js');
const { addPathPrefix } = require('next/dist/shared/lib/router/utils/add-path-prefix.js');
const { transformSync } = require('next/dist/build/swc');

// These are the installed Next SSR error and path functions used by app-render,
// rather than a replacement redirect implementation or a running devserver.
function locationFromNext(error, basePath) {
  assert.equal(navigation.getRedirectStatusCodeFromError(error), 307);
  return addPathPrefix(navigation.getURLFromRedirectError(error), basePath);
}

test('Next SSR emits one basePath while public login returnTo survives unchanged', () => {
  for (const basePath of ['', '/studio']) {
    for (const returnTo of ['/studio', '/studio/administration']) {
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

function load(file, overrides) {
  const url = new URL(file, import.meta.url), source = readFileSync(url, 'utf8');
  const { code } = transformSync(source, { filename: file,
    jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' } });
  const module = { exports: {} }, localRequire = createRequire(url);
  vm.runInNewContext(code, { module, exports: module.exports, Request, Headers,
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

test('actual administration page uses Next-local login with the exact public return destination', async () => {
  for (const status of [401, 403]) {
    const page = load('../app/administration/page.tsx', {
      'next/navigation': navigation,
      'next/headers': { headers: async () => new Headers({ host: 'qa.example.invalid' }) },
      '@/lib/ui-server': { authorizeUiPage: () => assert.fail('no old auth fallback') },
      '@/lib/backoffice-navigation.mjs': {},
      '@/components/backoffice-panel': {},
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

test('actual retired Lissabon page redirects to the app root with one mounted prefix', () => {
  const page = load('../app/lissabon/page.tsx', { 'next/navigation': navigation });
  assert.throws(() => page.default(), error => {
    assert.equal(locationFromNext(error, '/studio'), '/studio/');
    assert.equal(locationFromNext(error, ''), '/');
    return true;
  });
});
