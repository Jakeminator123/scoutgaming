import {adminDocumentHref} from '../../../packages/navigation/admin-workspace-routes.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { nextStudioLoginRedirect } from '../lib/next-page-navigation.mjs';
import { studioLoginDestination } from '../lib/studio-login-client.mjs';
import { normalizeNativeStudioPageRequest } from '../lib/studio-native-request.mjs';
import { legacyStudioDocumentHref } from '../lib/legacy-studio-document.mjs';

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
      try { navigation.redirect(nextStudioLoginRedirect(returnTo, 'https://qa.example.invalid')); } catch (error) { thrown = error; }
      const location = locationFromNext(thrown, basePath);
      const url = new URL(location, 'https://qa.example.invalid');
      assert.equal(url.pathname, '/admin/login');
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
    const target = nextStudioLoginRedirect(value, 'https://qa.example.invalid');
    const url = new URL(addPathPrefix(target, '/studio'), 'https://qa.example.invalid');
    assert.equal(url.pathname, '/admin/login');
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
      if (status === 401) assert.equal(locationFromNext(error, '/studio'), 'https://qa.example.invalid/admin/login?returnTo=%2Fstudio');
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
          assert.equal(login.pathname, '/admin/login');
          const expectedReturn = returnTo === '/studio/control/lanes?tab=companies' ? '/admin/companies' : returnTo === '/studio/control/lanes?lane=evening' ? '/admin/rooms?composition=evening' : returnTo.startsWith('/studio/control/') ? returnTo.slice('/studio'.length) : returnTo;
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

test('retired AI documents reach their resource across flags and mounts without redirecting writes', () => {
  const platform = require('../../../packages/navigation/server/platform-routing.mjs');
  const headers = {host:'studio.fixture.invalid','x-forwarded-host':'game.fixture.invalid'};
  for (const basePath of ['', '/studio']) for (const unified of [false,true]) for (const nativeStudio of [false,true]) {
    const config = {publicOrigin:'https://game.fixture.invalid',labUiOrigin:'https://game.fixture.invalid',backendOrigin:'https://engine.fixture.invalid',unifiedUi:unified,nativeStudio};
    const {middleware} = load('../middleware.ts', {'../../packages/navigation/server/platform-routing.mjs':{...platform,platformConfiguration:()=>config}},
      {CROUPIER_LAB_BASE_PATH:basePath,CROUPIER_VERCEL_UNIFIED_UI:unified?'1':'0'});
    for (const section of ['/openclaw','/operator-chat','/control/openclaw','/control/operator-chat','/control/ops']) for (const tab of ['', 'chat', 'models']) {
      const context = {dealer:'dragan',event:'idle.ready',operator:'north',room:'room-1',table:'room-1',game:'roulette',lane:'portrait',variant:'take-2',...(tab?{tab}:{})};
      const url = 'https://game.fixture.invalid'+basePath+section+'?'+new URLSearchParams(context)+'#selection';
      const target = section.endsWith('/operator-chat') || section.endsWith('/openclaw') && tab === 'chat' ? 'agent' : section.endsWith('/ops') ? 'drift' : 'models';
      for (const method of ['GET','HEAD']) {
        const request = new Request(url,{headers,method});
        const response = middleware(request), destination = new URL(response.headers.get('location'));
        assert.equal(response.status,307);assert.equal(destination.origin,config.publicOrigin);assert.equal(destination.pathname,({agent:'/admin/dealer-agent',drift:'/admin/drift',models:'/admin/ai/models'})[target]);
        // The OpenClaw page owns its tab; a legacy tab never competes with it.
        assert.deepEqual(destination.searchParams.getAll('tab'),target==='drift'?['speech']:[]);
        for (const [key,value] of Object.entries(context)) if (key !== 'tab') assert.equal(destination.searchParams.get(key==='lane'?'composition':key),value);
        assert.equal(destination.searchParams.has('lane'),false);assert.equal(destination.hash,'#selection');
        if(section.startsWith('/control/')) assert.equal(platform.platformRoute(new URL(url),config,request).destination,destination.href);
      }
      for (const options of [{method:'POST',body:'fixture',headers},{method:'PUT',body:'fixture',headers},{method:'DELETE',headers},{headers:{...headers,'next-action':'fixture'}}]) {
        const request = new Request(url,options);
        assert.equal(legacyStudioDocumentHref(request,{basePath}),null);
        assert.equal(middleware(request).headers.has('location'),false);
      }
      const bodyRequest = {url,method:'GET',body:{fixture:true},headers:new Headers(headers)};
      assert.equal(legacyStudioDocumentHref(bodyRequest,{basePath}),null);
      assert.equal(middleware(bodyRequest).headers.has('location'),false);
    }
    for (const section of ['/openclaw/extra','/operator-chat/extra','/api/openclaw/admin','/api/assistant']) {
      assert.equal(middleware(new Request(config.publicOrigin+basePath+section,{headers})).headers.has('location'),false);
    }
  }
});

const authEntryConfig = authBase => ({
  allowedOrigins: ['https://game.fixture.invalid', 'https://studio.fixture.invalid'],
  publicHosts: ['game.fixture.invalid', 'studio.fixture.invalid'],
  authBase, apiBase: authBase === '/api/auth' ? '/api/admin' : '/studio/api/admin',
});
const entryRequest = (host, mode, extra = {}) => new Request('https://' + host + '/admin/' + mode,
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
      assert.equal(actual.pathname, '/admin/login');
      assert.equal(actual.searchParams.get('returnTo'), returnTo);
      assert.equal(actual.searchParams.size, 1);
    }
    const token = 'b'.repeat(43);
    const destination = nextStudioAuthEntryRedirect(entryRequest('studio.fixture.invalid', 'set-password'), config, { mode: 'set-password', token });
    assert.equal(destination, config.allowedOrigins[0] + '/admin/set-password?t=' + token);
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
    assert.equal(nextStudioAuthEntryRedirect(request, config, { mode: 'set-password', token }), config.allowedOrigins[0] + '/admin/set-password');
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
      const page = load('../app/admin/' + mode + '/page.tsx', {
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
          assert.equal(destination.origin, config.allowedOrigins[0]); assert.equal(destination.pathname, '/admin/' + mode);
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

test('legacy auth bookmarks use the central validator and reject writes or duplicate credentials', () => {
  for (const basePath of ['', '/studio']) for (const entry of ['/login','/studio/login','/control/login','/studio/control/login']) {
    const request = (query, options={}) => new Request('https://game.fixture.invalid'+entry+query,options);
    const target='/admin/rooms?operator=north&table=room-one&composition=scene-one';
    assert.equal(legacyStudioDocumentHref(request('?returnTo='+encodeURIComponent(target)),{basePath}),'/admin/login?returnTo='+encodeURIComponent(target));
    for(const value of ['//outside.invalid','/admin/login','/admin/set-password']) assert.equal(legacyStudioDocumentHref(request('?returnTo='+encodeURIComponent(value)),{basePath}),'/admin/login?returnTo=%2Fadmin');
    assert.equal(legacyStudioDocumentHref(request('?returnTo=%2Fadmin&returnTo=%2Fpartner'),{basePath}),'/admin/login?returnTo=%2Fadmin');
    for(const options of [{method:'POST',body:'secret'}, {headers:{'next-action':'fixture'}}]) assert.equal(legacyStudioDocumentHref(request('',options),{basePath}),null);
    const password=entry.replace('login','set-password'),token='b'.repeat(43);
    const reset=query=>new Request('https://game.fixture.invalid'+password+query);
    assert.equal(legacyStudioDocumentHref(reset('?t='+token),{basePath}),'/admin/set-password?t='+token);
    assert.equal(legacyStudioDocumentHref(reset('?t='+token+'&t='+token),{basePath}),'/admin/set-password');
    assert.equal(legacyStudioDocumentHref(reset('?t=invalid&returnTo=https://outside.invalid'),{basePath}),'/admin/set-password');
  }
});

test('Activity bookmarks retain only unambiguous observation identities across native and mounted middleware',()=>{
  const platform=require('../../../packages/navigation/server/platform-routing.mjs');
  const headers={host:'studio.fixture.invalid','x-forwarded-host':'game.fixture.invalid'};
  for(const basePath of ['', '/studio'])for(const unified of [false,true])for(const nativeStudio of [false,true]){
    const config={publicOrigin:'https://game.fixture.invalid',labUiOrigin:'https://game.fixture.invalid',backendOrigin:'https://engine.fixture.invalid',unifiedUi:unified,nativeStudio};
    const {middleware}=load('../middleware.ts',{'../../packages/navigation/server/platform-routing.mjs':{...platform,platformConfiguration:()=>config}},
      {CROUPIER_LAB_BASE_PATH:basePath,CROUPIER_VERCEL_UNIFIED_UI:unified?'1':'0'});
    for(const section of ['/activity','/control/activity'])for(const duplicate of [false,true]){
      const query=new URLSearchParams({dealer:'saga',operator:'north',table:'room-1',room:'room-1',game:'roulette',lane:'portrait',event:'idle.ready',token:'private',unknown:'omit'});
      if(duplicate)for(const key of ['dealer','operator','table','room','game'])query.append(key,'ambiguous');
      const url='https://game.fixture.invalid'+basePath+section+'?'+query+'#observation';
      for(const method of ['GET','HEAD']){
        const request=new Request(url,{method,headers});
        const response=middleware(request);assert.equal(response.status,307);
        const destination=new URL(response.headers.get('location'));
        assert.equal(destination.origin,config.publicOrigin);assert.equal(destination.pathname,"/admin/rooms");
        assert.equal(destination.hash,'#observation');assert.equal(destination.searchParams.get('composition'),'portrait');
        for(const key of ['dealer','operator','table','room','game'])assert.equal(destination.searchParams.get(key),duplicate?null:query.get(key));
        for(const key of ['event','token','unknown','lane'])assert.equal(destination.searchParams.has(key),false);
        if(section==='/control/activity')assert.equal(platform.platformRoute(new URL(url),config,request).destination,destination.href);
      }
      for(const options of [{method:'POST',body:'fixture',headers},{method:'PUT',body:'fixture',headers},{method:'DELETE',headers},{headers:{...headers,'next-action':'fixture'}}]){
        const request=new Request(url,options);assert.equal(legacyStudioDocumentHref(request,{basePath}),null);
        assert.equal(middleware(request).headers.has('location'),false);
      }
    }
  }
});

test('old activity URLs retain only observation context and canonicalize the composition alias', () => {
  const destination=query=>legacyStudioDocumentHref(new Request('https://qa.invalid/control/activity?'+query));
  assert.equal(destination('dealer=vera&event=speak.goodluck&operator=operator-one&table=room-1&lane=mobile-phone&token=private'), "/admin/rooms?dealer=vera&operator=operator-one&table=room-1&composition=mobile-phone");
  assert.equal(destination('dealer=vera&dealer=mei&composition=chosen&lane=stale'), "/admin/rooms?composition=chosen");
});


test('Editor and Administration bookmarks reach Admin and retain allowlisted context through an expired session', async () => {
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
      for(const section of [{path:'/control/clips',target:'/admin/clips'}, {path:'/control/administration',target:'/admin/media-review',tab:'media-review'}]) for(const legacy of [false,true]) {
        const query={...(section.tab?{tab:section.tab}:{}),[legacy&&section.path==='/control/clips'?'dealerId':'dealer']:'vera',operator:'operator-42',table:'room-7',[legacy?'lane':'composition']:'desktop-wide',token:'do-not-copy',returnTo:'https://untrusted.invalid',view:'settings',category:'speech',event:'speak.goodluck',situation:'goodluck'};
        const target=legacyStudioDocumentHref(new Request('https://game.fixture.invalid'+basePath+section.path+'?'+new URLSearchParams(query)),{basePath});
        assert.equal(new URL(target,'https://game.fixture.invalid').pathname,section.target);
        const request=new Request('https://game.fixture.invalid'+basePath+target,{headers:{host:'game.fixture.invalid','sec-fetch-mode':'navigate','sec-fetch-dest':'document'}});
        await assert.rejects(guard.authorizeUiPage(request),error=>{
          assert.match(error.digest ?? '', /^NEXT_REDIRECT;/, error.message);
          const login = new URL(locationFromNext(error,basePath),'https://game.fixture.invalid');
          assert.equal(login.pathname,'/admin/login');
          const destination = new URL(login.searchParams.get('returnTo'),'https://game.fixture.invalid');
          assert.equal(destination.pathname,section.target);
          assert.equal(destination.searchParams.get('dealer'),'vera');assert.equal(destination.searchParams.get('operator'),'operator-42');assert.equal(destination.searchParams.get('table'),'room-7');assert.equal(destination.searchParams.get('composition'),'desktop-wide');
          assert.equal(destination.searchParams.has('lane'),false);assert.equal(destination.searchParams.has('token'),false);assert.equal(destination.searchParams.has('returnTo'),false);
          assert.equal(destination.searchParams.get('view'),section.path==='/control/clips'?null:'settings');if(section.path==='/control/clips')assert.equal(destination.searchParams.get('panel'),'dealer');assert.equal(destination.searchParams.get('category'),'speech');assert.equal(destination.searchParams.get('event'),'speak.goodluck');assert.equal(destination.searchParams.get('situation'),'goodluck');
          return true;
        });
      }
  }
});


test('actual Admin middleware preserves document access with Node transport before or after middleware', async t => {
  const {createServer} = await import('node:http');
  const {mkdtemp, mkdir, writeFile, rm} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const {NextRequest} = require('next/server.js');
  const routing = await import('../../../packages/navigation/server/platform-routing.mjs');
  const preview = await import('../lib/design-preview.mjs');
  const nativeRuntime = await import('../lib/studio-native-runtime.mjs');
  const {createStudioNativeAuth} = await import('../../../packages/studio-access/studio-native-auth.mjs');
  const {createPublicationChain} = await import('../../../test/fixtures/admin-publication-chain.mjs');
  const publicOrigin = 'https://admin.fixture.invalid';
  const f = await createPublicationChain(publicOrigin);
  const platform = {publicOrigin, labUiOrigin: publicOrigin, backendOrigin:'https://engine.fixture.invalid',
    unifiedUi:true, nativeStudio:true};
  const middleware = load('../middleware.ts', {
    '../../packages/navigation/server/platform-routing.mjs': {...routing, platformConfiguration:()=>platform},
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
  for (const position of ['before','after']) for (const path of ['/admin','/admin/dealers','/studio/admin','/studio/admin/dealers','/admin/rooms?operator=north&room=room-1&composition=portrait&game=roulette','/studio/admin/companies?operator=north','/admin/compositions?dealer=dragan&composition=portrait&operator=north&table=room-1&game=roulette','/studio/admin/rehearsal?dealer=astrid&composition=portrait&operator=north&table=room-1&game=roulette','/admin/events?dealer=dragan','/studio/admin/events?dealer=astrid&event=idle.ready&tab=triggers&variant=take-1&operator=north&table=room-1&composition=portrait','/admin/guide?dealer=dragan','/studio/admin/videos?dealer=dragan&event=idle.ready&variant=take-2&composition=portrait','/admin/probe?dealer=dragan&event=idle.ready','/studio/admin/probe?dealer=astrid&operator=north&table=room-1&composition=portrait','/admin/replies?dealer=dragan&category=greeting','/studio/admin/replies?dealer=astrid&operator=north&table=room-1&composition=portrait','/admin/ai/models?operator=north&dealer=dragan','/studio/admin/ai/models','/admin/clips?dealer=dragan','/studio/admin/clips','/admin/clips?dealer=dragan&view=clips&event=idle.ready&category=speech&game=roulette','/studio/admin/clips?dealer=astrid&composition=portrait&operator=north&table=room-1','/admin/dealer-agent?dealer=dragan&event=idle.ready','/studio/admin/dealer-agent?dealer=astrid&composition=portrait&operator=north&table=room-1'].map(adminDocumentHref)) {
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
    const segments = new URL(destination).pathname.replace(/^\/(?:studio\/)?admin\/?/,'').split('/').filter(Boolean);
    const response = await admin.GET(new Request(destination,{headers}),{params:Promise.resolve({path:segments})});
    assert.equal(response.status,200,position+' middleware: '+path+' must authorize the unchanged synthetic admin cookie after the proxy hop');
    assert.match(await response.text(),/Authorized Admin fixture/);
    const anonymous = new Headers(headers);anonymous.delete('cookie');
    const login = await admin.GET(new Request(destination,{headers:anonymous}),{params:Promise.resolve({path:segments})});
    assert.equal(login.status,307,'document normalization never grants a session');
    assert.ok(login.headers.get('location').startsWith(publicOrigin+'/admin/login?returnTo='));
    assert.equal(new URL(login.headers.get('location'),publicOrigin).searchParams.get('returnTo'),path.replace(/^\/studio(?=\/admin)/,''));
  }
});

test('retired Control URLs use the central Admin destination with room and material context intact',()=>{
  for(const [section,destination] of [['library','assets'],['lanes','companies'],['preview','scenes'],['zones','scenes']]){
    const query='dealer=dragan&operator=north&room=one&room=two&game=roulette&lane=portrait&role=background&token=private&tab='+(section==='lanes'?'companies':'backgrounds');
    for(const basePath of ['','/studio']) {
      const target=legacyStudioDocumentHref(new Request('https://game.fixture.invalid'+basePath+'/control/'+section+'?'+query),{basePath});
      const url=new URL(target,'https://game.fixture.invalid');
      assert.equal(url.pathname,'/admin/'+destination);
      for(const [key,value] of [['dealer','dragan'],['operator','north'],['game','roulette'],['composition','portrait']])assert.equal(url.searchParams.get(key),value);
      assert.deepEqual(url.searchParams.getAll('room'),['one','two']);assert.equal(url.searchParams.has('lane'),false);assert.equal(url.searchParams.has('token'),false);
      if(section==='library')assert.equal(url.searchParams.get('tab'),'backgrounds');
    }
  }
});

test('actual middleware centralizes exact legacy documents without changing native routing or write requests',()=>{
  const platform=require('../../../packages/navigation/server/platform-routing.mjs');
  const headers={host:'studio.fixture.invalid','x-forwarded-host':'game.fixture.invalid'};
  for(const basePath of ['','/studio']) for(const unified of [false,true]) {
    const config={publicOrigin:'https://game.fixture.invalid',labUiOrigin:'https://game.fixture.invalid',backendOrigin:'https://engine.fixture.invalid',unifiedUi:unified,nativeStudio:unified};
    const {middleware}=load('../middleware.ts',{
      '../../packages/navigation/server/platform-routing.mjs':{...platform,platformConfiguration:()=>config},
    },{CROUPIER_LAB_BASE_PATH:basePath,CROUPIER_VERCEL_UNIFIED_UI:unified?'1':'0'});
    const request=(path,options={})=>new Request('https://game.fixture.invalid'+basePath+path,{headers,...options});
    if(unified && basePath==='/studio') {
      const response=middleware(request('/videos',{headers:{host:'studio.fixture.invalid','x-forwarded-host':'other.fixture.invalid','x-forwarded-proto':'http'}}));
      assert.equal(response.headers.get('location'),'https://game.fixture.invalid/admin/clips');
    }
    // Unified routing historically only admits these old Studio documents under /studio.
    if(!unified || basePath==='/studio') for(const [path,target] of [
      ['activity','activity'],['administration','administration'],['events','events'],['guide','guide'],
      ['lissabon',''],['openclaw','openclaw'],['operator-chat','operator-chat'],['probe','clips?panel=room'],
      ['tree','tree'],['videos','clips'],['zones','preview'],
    ]) for(const method of ['GET','HEAD']) {
      const response=middleware(request('/'+path+'?dealer=dragan&token=private',{method,headers}));
      assert.equal(response.status,307,path);
      const admin=({events:'clips',tree:'clips',activity:'rooms',zones:'scenes',administration:'drift',openclaw:'ai/models','operator-chat':'dealer-agent',probe:'clips?panel=room',videos:'clips'}[path]??path);
      assert.equal(response.headers.get('location'),['guide','videos','probe','events','tree','activity','zones','openclaw','operator-chat','administration'].includes(path)?'https://game.fixture.invalid/admin/'+admin+(admin.includes('?')?'&':'?')+'dealer=dragan':'https://game.fixture.invalid/control'+(target?'/'+target:''));
    }
    const control=middleware(request('/control/library?room=one&room=two&lane=portrait&token=private'));
    assert.equal(control.status,307);
    const target=new URL(control.headers.get('location'));
    assert.equal(target.pathname,'/admin/assets');assert.deepEqual(target.searchParams.getAll('room'),['one','two']);
    assert.equal(target.searchParams.get('composition'),'portrait');
    assert.equal(target.searchParams.has('token'),unified,'native mapping retains its existing query policy');
    for(const path of ['/api/videos','/preview/compositor.js','/events/extra']) {
      assert.equal(legacyStudioDocumentHref(request(path),{basePath}),null,path);
      assert.equal(middleware(request(path)).headers.has('location'),false,path);
    }
    for(const options of [{method:'POST',body:'fixture',headers},{headers:{...headers,'next-action':'fixture'}}]) {
      assert.equal(legacyStudioDocumentHref(request('/control/library',options),{basePath}),null);
      assert.equal(middleware(request('/control/library',options)).headers.has('location'),false);
    }
  }
});


test('retired publication and tool documents redirect with context in every native and mount configuration',()=>{
  const platform=require('../../../packages/navigation/server/platform-routing.mjs');
  const headers={host:'studio.fixture.invalid','x-forwarded-host':'game.fixture.invalid'};
  for(const basePath of ['','/studio']) for(const unified of [false,true]) for(const nativeStudio of [false,true]){
    const config={publicOrigin:'https://game.fixture.invalid',labUiOrigin:'https://game.fixture.invalid',backendOrigin:'https://engine.fixture.invalid',unifiedUi:unified,nativeStudio};
    const {middleware}=load('../middleware.ts',{'../../packages/navigation/server/platform-routing.mjs':{...platform,platformConfiguration:()=>config}},
      {CROUPIER_LAB_BASE_PATH:basePath,CROUPIER_VERCEL_UNIFIED_UI:unified?'1':'0'});
    for(const [section,target]of [['rooms','rooms'],['companies','companies'],['lanes','rooms'],['guide','guide'],['videos','clips'],['probe','clips?panel=room'],['replies','replies'],['events','clips'],['tree','clips'],['compositions','scenes'],['rehearsal','rooms'],['preview','scenes'],['zones','scenes'],['clips','clips']]){
      const url='https://game.fixture.invalid'+basePath+'/control/'+section+'?operator=north&room=room-1&table=room-1&dealer=dragan&game=roulette&lane=portrait&event=idle.ready&variant=take-2&situation=dealer-hole&category=greeting';
      for(const method of ['GET','HEAD']){
        const response=middleware(new Request(url,{headers,method}));
        assert.equal(response.status,307);const destination=new URL(response.headers.get('location'));
        const [pathname,query]=target.split('?');
        assert.equal(destination.origin,config.publicOrigin);assert.equal(destination.pathname,'/admin/'+pathname);
        for(const [key,value]of new URLSearchParams(query))assert.deepEqual(destination.searchParams.getAll(key),[value]);
        for(const [key,value]of Object.entries({operator:'north',room:'room-1',table:'room-1',dealer:'dragan',game:'roulette',composition:'portrait',event:'idle.ready',variant:'take-2',situation:'dealer-hole',category:'greeting'}))assert.equal(destination.searchParams.get(key),value);
        assert.equal(destination.searchParams.has('lane'),false);
      }
      for(const options of [{method:'POST',body:'fixture',headers},{headers:{...headers,'next-action':'fixture'}}])assert.equal(middleware(new Request(url,options)).headers.has('location'),false);
    }
    const companies=middleware(new Request('https://game.fixture.invalid'+basePath+'/control/lanes?tab=companies&operator=north',{headers}));
    assert.equal(new URL(companies.headers.get('location')).pathname,'/admin/companies');
  }
});

test('historical tool documents reach Admin with context before unified frontend rejection',()=>{
  const platform=require('../../../packages/navigation/server/platform-routing.mjs');
  const headers={host:'studio.fixture.invalid','x-forwarded-host':'game.fixture.invalid'};
  for(const basePath of ['', '/studio'])for(const unified of [false,true])for(const nativeStudio of [false,true]){
    const config={publicOrigin:'https://game.fixture.invalid',labUiOrigin:'https://game.fixture.invalid',backendOrigin:'https://engine.fixture.invalid',unifiedUi:unified,nativeStudio};
    const {middleware}=load('../middleware.ts',{'../../packages/navigation/server/platform-routing.mjs':{...platform,platformConfiguration:()=>config}},
      {CROUPIER_LAB_BASE_PATH:basePath,CROUPIER_VERCEL_UNIFIED_UI:unified?'1':'0'});
    for(const [section,target] of [['events','clips'],['tree','clips'],['compositions','scenes'],['rehearsal','rooms'],['preview','scenes'],['zones','scenes'],['clips','clips']])for(const selected of [false,true]){
      const context={dealer:'saga',operator:'north',table:'room-1',game:'roulette',lane:'portrait',...(selected?{event:'idle.ready',variant:'take-2',situation:'box1',tab:'variants'}:{})};
      const query=new URLSearchParams({...context,token:'private',unknown:'omit'});query.append('room','one');query.append('room','two');
      const url='https://game.fixture.invalid'+basePath+'/'+section+'?'+query;
      for(const method of ['GET','HEAD']){
        const response=middleware(new Request(url,{method,headers}));assert.equal(response.status,307);
        const destination=new URL(response.headers.get('location'));
        assert.equal(destination.origin,config.publicOrigin);assert.equal(destination.pathname,'/admin/'+target.split('?')[0]);for(const [key,value]of new URLSearchParams(target.split('?')[1]))assert.equal(destination.searchParams.get(key),value);
        for(const [key,value]of Object.entries(context))assert.equal(destination.searchParams.get(key==='lane'?'composition':key),value);
        assert.deepEqual(destination.searchParams.getAll('room'),['one','two']);
        assert.equal(destination.searchParams.has('event'),selected);
        for(const key of ['token','unknown','lane'])assert.equal(destination.searchParams.has(key),false);
      }
      for(const options of [{method:'POST',body:'fixture',headers},{method:'PUT',body:'fixture',headers},{method:'DELETE',headers},{headers:{...headers,'next-action':'fixture'}}]){
        const request=new Request(url,options);assert.equal(legacyStudioDocumentHref(request,{basePath}),null);
        assert.equal(middleware(request).headers.has('location'),false);
      }
    }
  }
});


test('retired Administration entries preserve context across mounts and flags without redirecting writes',()=>{
  const platform=require('../../../packages/navigation/server/platform-routing.mjs');
  const headers={host:'studio.fixture.invalid','x-forwarded-host':'game.fixture.invalid'};
  for(const basePath of ['', '/studio'])for(const unified of [false,true])for(const nativeStudio of [false,true]){
    const config={publicOrigin:'https://game.fixture.invalid',labUiOrigin:'https://studio.fixture.invalid',backendOrigin:'https://engine.fixture.invalid',unifiedUi:unified,nativeStudio};
    const {middleware}=load('../middleware.ts',{'../../packages/navigation/server/platform-routing.mjs':{...platform,platformConfiguration:()=>config}},{CROUPIER_LAB_BASE_PATH:basePath,CROUPIER_VERCEL_UNIFIED_UI:unified?'1':'0'});
    for(const entry of ['/administration','/control/administration'])for(const [tab,target]of Object.entries({operations:'/admin/drift',accounts:'/admin/admin/accounts',partners:'/admin/admin/api',finance:'/admin/ekonomi',tables:'/admin/rooms','media-review':'/admin/media-review'})){
      const query='tab='+tab+'&dealer=elin&operator=north&table=room-a&room=one&room=two&lane=portrait&game=roulette';
      const url=config.publicOrigin+basePath+entry+'?'+query+'#selected';
      for(const method of ['GET','HEAD']){
        const request=new Request(url,{method,headers}),response=middleware(request),destination=new URL(response.headers.get('location'));
        assert.equal(response.status,307);assert.equal(destination.pathname,target);assert.equal(destination.origin,config.publicOrigin);
        assert.equal(destination.searchParams.get('dealer'),'elin');assert.equal(destination.searchParams.get('operator'),'north');assert.equal(destination.searchParams.get('table'),'room-a');assert.deepEqual(destination.searchParams.getAll('room'),['one','two']);assert.equal(destination.searchParams.get('composition'),'portrait');assert.equal(destination.searchParams.get('game'),'roulette');assert.equal(destination.hash,'#selected');
        if(entry.startsWith('/control/'))assert.equal(platform.platformRoute(new URL(url),config,request).destination,destination.href);
      }
      for(const options of [{method:'POST',body:'fixture',headers},{method:'DELETE',headers},{headers:{...headers,'next-action':'fixture'}}]){
        const request=new Request(url,options);assert.equal(legacyStudioDocumentHref(request,{basePath}),null);assert.equal(middleware(request).headers.has('location'),false);
      }
    }
  }
});
