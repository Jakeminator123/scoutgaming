import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {platformConfiguration, platformRoute, backendPlatformPath, platformBackendHeaders, PLATFORM_SOCKET_ENDPOINTS} from '../lib/platform-routing.mjs';
import {platformUiDocument} from '../lib/server-ui.mjs';
import {preparePlatformUi} from '../tools/prepare-platform-ui.mjs';
import {createRequire} from 'node:module';

const env = {CROUPIER_VERCEL_UI: '1', CROUPIER_STUDIO_NATIVE_ADMIN: '0', CROUPIER_STUDIO_NEON_POLICY: '0', CROUPIER_PUBLIC_ORIGIN: 'https://preview.example.test',
  CROUPIER_BACKEND_ORIGIN: 'https://isolated.onrender.com', CROUPIER_LAB_UI_ORIGIN: 'https://lab-ui.vercel.app', CROUPIER_VERCEL_INGRESS_SECRET: 'isolated-unit-secret-'.repeat(3)};
const config = platformConfiguration(env);

test('unified Studio configuration needs no second UI origin and retains distinct game authority', () => {
  const unifiedEnv = {...env, CROUPIER_VERCEL_UNIFIED_UI:'1', CROUPIER_STUDIO_NATIVE_ADMIN:'1'};
  delete unifiedEnv.CROUPIER_LAB_UI_ORIGIN;
  const unified = platformConfiguration(unifiedEnv);
  assert.equal(unified.labUiOrigin, unified.publicOrigin);
  assert.equal(unified.unifiedUi, true);
  assert.throws(() => platformConfiguration({...unifiedEnv, CROUPIER_BACKEND_ORIGIN:unified.publicOrigin}));
  assert.throws(() => platformConfiguration({...unifiedEnv, CROUPIER_STUDIO_NATIVE_ADMIN:'0'}));
  assert.throws(() => platformConfiguration({...unifiedEnv, CROUPIER_VERCEL_UNIFIED_UI:'0'}));
});

test('actual unified Studio middleware preserves auth transport and rejects encoded document aliases', async () => {
  const require = createRequire(new URL('../package.json', import.meta.url));
  const {transpileModule, ModuleKind, ScriptTarget} = require('typescript');
  const {NextRequest} = require('next/server');
  const source = await readFile(new URL('../../../lab/middleware.ts', import.meta.url), 'utf8');
  const compiled = transpileModule(source, {compilerOptions:{module:ModuleKind.CommonJS, target:ScriptTarget.ES2022}}).outputText;
  const module = {exports:{}};
  new Function('require', 'module', 'exports', compiled)(name => require(name === '../apps/croupier-frontend/lib/platform-routing.mjs' ? './lib/platform-routing.mjs' : name), module, module.exports);
  const unifiedEnv = {...env, CROUPIER_VERCEL_UNIFIED_UI:'1', CROUPIER_STUDIO_NATIVE_ADMIN:'1'};
  const previous = Object.fromEntries(Object.keys(unifiedEnv).map(key => [key, process.env[key]]));
  Object.assign(process.env, unifiedEnv);
  try {
    const headers = {cookie:'bo_session=isolated-fixture', 'x-croupier-vercel-secret':'spoof',
      'x-croupier-lab-authorized':'spoof', forwarded:'host=foreign.example'};
    for (const path of ['/studio/api/project', '/studio/api/partner-preview', '/studio/activity', '/studio/login']) {
      const response = module.exports.middleware(new NextRequest(config.publicOrigin + path, {headers,nextConfig:{basePath:'/studio'}}));
      assert.equal(response.headers.get('x-middleware-rewrite'), null, path);
      assert.equal(response.headers.get('x-middleware-request-cookie'), headers.cookie);
      assert.equal(response.headers.get('x-middleware-request-x-croupier-vercel-secret'), null);
      assert.equal(response.headers.get('x-middleware-request-x-croupier-lab-authorized'), null);
      assert.equal(response.headers.get('x-middleware-request-forwarded'), null);
      assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
    }
    const transport = module.exports.middleware(new NextRequest(config.publicOrigin + '/studio/api/inputs', {headers}));
    assert.equal(transport.headers.get('x-middleware-rewrite'), config.backendOrigin + '/studio/api/inputs');
    assert.equal(transport.headers.get('x-middleware-request-x-croupier-vercel-secret'), config.secret);
    const workspace = module.exports.middleware(new NextRequest(config.publicOrigin + '/partner/demo-north/team?_rsc=fixture', {headers}));
    assert.equal(workspace.headers.get('x-middleware-rewrite'), config.publicOrigin + '/studio/partner/demo-north/team?_rsc=fixture');
    for (const path of ['/studio/api/%61dmin/users', '/partner/demo-north/%74eam']) {
      assert.equal(module.exports.middleware(new NextRequest(config.publicOrigin + path)).status, 400, path);
    }
    for (const path of ['/api/internal', '/partner/api/admin']) {
      assert.equal(module.exports.middleware(new NextRequest(config.publicOrigin + path)).status, 404, path);
    }
    delete process.env.CROUPIER_VERCEL_UNIFIED_UI;
    assert.equal(module.exports.middleware(new NextRequest(config.publicOrigin + '/studio/activity')).headers.get('x-middleware-request-cookie'), null);
  } finally {
    for (const [key,value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test('generated workspace chunks allow encoded bracket folders without widening encoded route access', () => {
  for (const surface of ['control', 'partner']) {
    const path = `/studio/_next/static/chunks/app/${surface}/%5B%5B...path%5D%5D/page-99ec07720d222a1e.js`;
    assert.deepEqual(platformRoute(new URL(path + '?dpl=fixture', config.publicOrigin), config),
      {kind:'lab', destination:config.labUiOrigin + path + '?dpl=fixture'});
    assert.equal(backendPlatformPath(path), false);
  }
  for (const path of [
    '/studio/_next/static/chunks/app/partner/%255B%255B...path%255D%255D/page-a1.js',
    '/studio/_next/static/chunks/app/partner/%5B%5B...path%5D%5D%2Fpage-a1.js',
    '/studio/_next/static/chunks/app/partner/%5B%5B...path%5D%5D/page-a1.js/extra',
    '/studio/_next/static/chunks/app/other/%5B%5B...path%5D%5D/page-a1.js',
    '/studio/_next/static/chunks/app/partner/%5B%5B...path%5D%5D/page-a1.html',
    '/studio/api/%61dmin/users', '/partner/demo-north/%74eam',
  ]) assert.equal(platformRoute(new URL(path, config.publicOrigin), config).kind, 'reject', path);
});

test('new document surfaces rewrite to native Studio without creating customer or API aliases', () => {
  const native = platformConfiguration({...env, CROUPIER_STUDIO_NATIVE_ADMIN:'1'});
  for (const [path, destination] of [['/control','/studio/control'], ['/control/voice','/studio/control/voice'],
    ['/control/studio','/studio'], ['/control/admin','/studio/administration'], ['/control/ops','/studio/openclaw'], ['/control/lab','/studio'],
    ['/partner','/studio/partner'], ['/partner/demo-north/overview','/studio/partner/demo-north/overview'], ['/partner/demo-south/team','/studio/partner/demo-south/team']]) {
    assert.deepEqual(platformRoute(new URL(path + '?_rsc=fixture', native.publicOrigin), native),
      {kind:'lab', destination:native.labUiOrigin + destination + '?_rsc=fixture'}, path);
    assert.equal(platformRoute(new URL(path, config.publicOrigin), config).kind, 'frontend', 'native preview remains opt-in');
    assert.equal(backendPlatformPath(path), false, path);
  }
  for (const path of ['/control/api/admin', '/partner/api/admin', '/partner/demo-north/voice', '/partner/demo-north/team/users',
    '/partner/demo-north/api/users', '/control/unknown', '/partner/demo-north/unknown']) {
    assert.equal(platformRoute(new URL(path, native.publicOrigin), native).kind, 'frontend', path);
    assert.equal(backendPlatformPath(path), false, path);
  }
  assert.equal(platformRoute(new URL('/partner/demo-north/%74eam', native.publicOrigin), native).kind, 'reject');
  for (const path of ['/studio/api/admin/users', '/studio/api/partner-preview', '/studio/partner', '/studio/control']) {
    assert.equal(platformRoute(new URL(path, native.publicOrigin), native).kind, 'lab', path);
  }
});

test('native Studio routes use the Vercel data writer while game commands stay on Render', () => {
  const native = platformConfiguration({...env,CROUPIER_STUDIO_NATIVE_ADMIN:'1'});
  for (const path of ['/studio/api/project','/studio/api/social','/studio/api/videos','/studio/api/videos/upload','/studio/api/videos/classify','/studio/api/videos/one']) {
    assert.equal(platformRoute(new URL(path,native.publicOrigin),native).kind,'lab',path);
  }
  assert.equal(platformRoute(new URL('/studio/api/social/profile',native.publicOrigin),native).kind,'backend');
  for (const path of ['/api/studio-game/command','/api/table','/api/presentation/config']) assert.equal(platformRoute(new URL(path,native.publicOrigin),native).kind,'backend',path);
  assert.equal(backendPlatformPath('/api/studio-game/commands'),false);
});

test('platform tracing keeps player documents without retired BO HTML', async () => {
  const source = await readFile(new URL('../next.config.mjs', import.meta.url), 'utf8');
  assert.match(source, /'\/game': \['\.\/runtime-ui\/game\.html'\]/);
  assert.match(source, /'\/player-login': \['\.\/runtime-ui\/blackjack\.html'\]/);
  assert.doesNotMatch(source, /runtime-ui\/bo|\/bo\/\[\[\.\.\.path\]\]/);
});

test('platform routes preserve exact backend boundaries, public origin and query correlation', () => {
  assert.equal(platformConfiguration({}), null);
  assert.throws(() => platformConfiguration({...env, CROUPIER_BACKEND_ORIGIN: env.CROUPIER_PUBLIC_ORIGIN}));
  for (const path of ['/api/table', '/api/bo/config', '/api/bo/game-login', '/api/bo/lab-login', '/api/bo/speech-qa', '/studio/api/videos/id', '/api/presentation/videos/abc']) {
    assert.equal(platformRoute(new URL(path + '?requestId=a%20b', config.publicOrigin), config).kind, 'backend');
  }
  for (const kind of ['game','lab']) {
    const path = `/api/bo/${kind}-login?state=${'a'.repeat(64)}`;
    assert.deepEqual(platformRoute(new URL(path,config.publicOrigin),config),{kind:'backend',destination:config.backendOrigin+path});
  }
  for (const path of ['/speech-stream', '/lipsync-worker']) {
    const route = platformRoute(new URL(path, config.publicOrigin), config);
    assert.equal(route.kind, 'socket');
    assert.equal(route.destination, config.publicOrigin + PLATFORM_SOCKET_ENDPOINTS[path]);
    assert.equal(platformRoute(new URL(PLATFORM_SOCKET_ENDPOINTS[path], config.publicOrigin), config).kind, 'reject');
  }
  for (const path of ['/api/auth/lab/check', '/api/auth/access', '/__vercel/lab/session', '/api/internal', '/studio/api/unknown', '/api/bo/login', '/api/bo/users', '/api/bo/users/role', '/api/bo/%75sers', '/studio/api/../project', '//api/bo/users']) assert.equal(backendPlatformPath(path), false, path);
  assert.equal(platformRoute(new URL('/studio/activity', config.publicOrigin), config).kind, 'lab');
  assert.equal(platformRoute(new URL('/game', config.publicOrigin), config).kind, 'frontend');
  assert.equal(platformRoute(new URL('/game?launch=one-use', config.publicOrigin), config).kind, 'backend');
  const headers = platformBackendHeaders(new Headers({'x-croupier-vercel-secret': 'spoof', 'x-croupier-lab-authorized': 'spoof', origin: config.publicOrigin, cookie: 'player_session=test'}), config);
  assert.equal(headers.get('x-croupier-vercel-secret'), config.secret);
  assert.equal(headers.get('x-croupier-lab-authorized'), null);
  assert.equal(headers.get('origin'), config.publicOrigin);
  assert.equal(headers.get('cookie'), 'player_session=test');
});

test('cookie-owned P6 playback context has one exact backend route without a presentation catch-all', () => {
  const path = '/api/presentation/native-p6-playback-context';
  assert.equal(backendPlatformPath(path), true);
  assert.deepEqual(platformRoute(new URL(path, config.publicOrigin), config), {kind:'backend', destination:config.backendOrigin + path});
  for (const extra of [path + '/', path + '/owner', path + 's', '/api/presentation/native-p6',
    '/api/presentation/unknown', '/api/presentation/native-p6-%70layback-context', path + '\\owner']) {
    assert.equal(backendPlatformPath(extra), false, extra);
  }
  for (const extra of [path + '/', path + '/owner', path + 's', '/api/presentation/native-p6', '/api/presentation/unknown']) {
    assert.equal(platformRoute(new URL(extra, config.publicOrigin), config).kind, 'frontend', extra);
  }
});

test('prepared player uses the actual shared player and redirects retired BO documents to native Studio', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-vercel-ui-'));
  try {
    const prepared = await preparePlatformUi({env, output: directory});
    assert.ok(prepared.files.includes('/app.mjs'));
    assert.ok(prepared.files.every(path => !path.startsWith('/bo/')));
    assert.ok(prepared.files.includes('/casino.mjs'));
    assert.ok(prepared.files.includes('/vendor/three/GLTFLoader.js'));
    assert.ok(prepared.files.every(path => !/\.(mp4|webm|png|jpg|wav|mp3)$/.test(path)));
    assert.match(await readFile(join(directory, 'public/blackjack-entry.mjs'), 'utf8'), /\/game\/\?dealer=astrid&presentation=local/);
    const game = await platformUiDocument(new Request(config.publicOrigin + '/game'), {env, directory: join(directory, 'runtime-ui')});
    assert.equal(game.status, 200); assert.match(await game.text(), /src="app.mjs"/);
    assert.match(game.headers.get('cache-control'), /no-store/);
    for (const path of ['/v2', '/casino.html']) assert.equal((await platformUiDocument(new Request(config.publicOrigin + path), {env, directory: join(directory, 'runtime-ui')})).status, 200);
    const runtime = join(directory, 'runtime-ui'), state = 'a'.repeat(64), token = 'b'.repeat(43);
    for (const [path,location] of [['/bo','/studio/administration'],['/bo/','/studio/administration'],['/bo/index.html','/studio/administration'],
      ['/bo/login.html','/studio/login'],[`/bo/login.html?returnTo=${encodeURIComponent(`/api/bo/game-login?state=${state}`)}`,`/studio/login?returnTo=${encodeURIComponent(`/api/bo/game-login?state=${state}`)}`],
      [`/bo/set-password.html?t=${token}`,`/studio/set-password?t=${token}`]]) {
      const response = await platformUiDocument(new Request(config.publicOrigin + path),{env,directory:runtime});
      assert.equal(response.status,308,path); assert.equal(response.headers.get('location'),location,path);
    }
    assert.equal((await platformUiDocument(new Request(config.publicOrigin + '/bo/login.html?returnTo=https://attacker.invalid'),{env,directory:runtime})).headers.get('location'),'/studio/login');
    assert.equal((await platformUiDocument(new Request(config.publicOrigin + '/bo/set-password.html?t=private.bad'),{env,directory:runtime})).headers.get('location'),'/studio/set-password');
    assert.equal((await platformUiDocument(new Request(config.publicOrigin + '/bo',{method:'POST'}),{env,directory:runtime})).status,405);
    assert.equal((await platformUiDocument(new Request(config.publicOrigin + '/bo/generations.json'), {env, directory})).status, 404);
  } finally {await rm(directory, {recursive: true, force: true});}
});

test('actual Next middleware disables rewrite caching for backend and authenticated Lab without leaking ingress to the UI zone', async () => {
  const require = createRequire(new URL('../package.json', import.meta.url));
  const {transpileModule, ModuleKind, ScriptTarget} = require('typescript');
  const {NextRequest} = require('next/server');
  const compiled = transpileModule(await readFile(new URL('../middleware.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ModuleKind.CommonJS, target: ScriptTarget.ES2022}}).outputText;
  const module = {exports: {}};
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports);
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  try {
    for (const path of ['/api/bo/config', '/studio/api/project', '/studio/activity', '/api/presentation/native-p6-playback-context']) {
      const response = module.exports.middleware(new NextRequest(config.publicOrigin + path));
      assert.equal(response.headers.get('x-vercel-enable-rewrite-caching'), '0', path);
      assert.equal(response.headers.get('cdn-cache-control'), 'no-store', path);
      if (path === '/studio/activity') {
        assert.match(response.headers.get('x-middleware-rewrite'), /^https:\/\/lab-ui\.vercel\.app/);
        assert.equal(response.headers.get('x-middleware-request-x-croupier-vercel-secret'), null);
      } else assert.equal(response.headers.get('x-middleware-request-x-croupier-vercel-secret'), config.secret);
    }
    const contextPath = '/api/presentation/native-p6-playback-context';
    const context = module.exports.middleware(new NextRequest(config.publicOrigin + contextPath, {method:'GET', headers:{
      cookie:'player_session=isolated-unit-session', 'x-croupier-vercel-secret':'spoof', 'x-croupier-native-p6-owner':'spoof',
      'x-croupier-public-origin':'https://foreign.example', 'x-forwarded-host':'foreign.example', 'x-forwarded-proto':'http',
      forwarded:'host=foreign.example',
    }}));
    assert.equal(context.headers.get('x-middleware-rewrite'), config.backendOrigin + contextPath);
    assert.equal(context.headers.get('x-middleware-request-cookie'), 'player_session=isolated-unit-session');
    assert.equal(context.headers.get('x-middleware-request-x-croupier-vercel-secret'), config.secret);
    assert.equal(context.headers.get('x-middleware-request-x-croupier-public-origin'), config.publicOrigin);
    assert.equal(context.headers.get('x-middleware-request-x-forwarded-host'), new URL(config.publicOrigin).host);
    assert.equal(context.headers.get('x-middleware-request-x-forwarded-proto'), 'https');
    assert.equal(context.headers.get('x-middleware-request-forwarded'), null);
    assert.equal(context.headers.get('x-middleware-request-x-croupier-native-p6-owner'), null);
    assert.equal(context.headers.get('cdn-cache-control'), 'no-store');
    assert.equal(context.headers.get('x-vercel-enable-rewrite-caching'), '0');
    for (const extra of [contextPath + '/owner', contextPath + 's', '/api/presentation/unknown']) {
      const unmatched = module.exports.middleware(new NextRequest(config.publicOrigin + extra));
      assert.equal(unmatched.headers.get('x-middleware-rewrite'), null, extra);
      assert.equal(unmatched.headers.get('x-middleware-request-x-croupier-vercel-secret'), null, extra);
    }
    const ordinary = module.exports.middleware(new NextRequest(config.publicOrigin));
    assert.equal(ordinary.headers.get('x-vercel-enable-rewrite-caching'), null);
    process.env.CROUPIER_STUDIO_NATIVE_ADMIN = '1';
    for (const path of ['/control/voice', '/partner/demo-north/overview']) {
      const response = module.exports.middleware(new NextRequest(config.publicOrigin + path + '?_rsc=fixture', {headers:{
        cookie:'bo_session=isolated-admin-fixture', rsc:'1', 'x-croupier-vercel-secret':'spoof', 'x-croupier-lab-authorized':'spoof',
      }}));
      assert.equal(response.headers.get('x-middleware-rewrite'), config.labUiOrigin + '/studio' + path + '?_rsc=fixture');
      assert.equal(response.headers.get('x-middleware-request-cookie'), 'bo_session=isolated-admin-fixture');
      assert.equal(response.headers.get('x-middleware-request-rsc'), '1');
      assert.equal(response.headers.get('x-middleware-request-x-croupier-vercel-secret'), null);
      assert.equal(response.headers.get('x-middleware-request-x-croupier-lab-authorized'), null);
      assert.equal(response.headers.get('x-middleware-request-x-forwarded-host'), new URL(config.publicOrigin).host);
      assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
      assert.equal(response.headers.get('x-vercel-enable-rewrite-caching'), '0');
    }
    for (const path of ['/speech-stream', '/lipsync-worker']) {
      const socket = module.exports.middleware(new NextRequest(config.publicOrigin + path));
      assert.equal(socket.headers.get('x-middleware-rewrite'), config.publicOrigin + PLATFORM_SOCKET_ENDPOINTS[path]);
      assert.equal(socket.headers.get('cdn-cache-control'), 'no-store');
      assert.equal(socket.headers.get('x-vercel-enable-rewrite-caching'), '0');
      assert.equal(socket.headers.get('x-middleware-request-x-croupier-vercel-secret'), null);
      const direct = module.exports.middleware(new NextRequest(config.publicOrigin + PLATFORM_SOCKET_ENDPOINTS[path]));
      assert.equal(direct.status, 400);
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {if (value === undefined) delete process.env[key]; else process.env[key] = value;}
  }
});
