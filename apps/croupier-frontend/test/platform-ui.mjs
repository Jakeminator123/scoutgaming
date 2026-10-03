import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {platformConfiguration, platformRoute, backendPlatformPath, platformBackendHeaders, PLATFORM_SOCKET_ENDPOINTS} from '../lib/platform-routing.mjs';
import {platformUiDocument} from '../lib/server-ui.mjs';
import {preparePlatformUi} from '../tools/prepare-platform-ui.mjs';
import {createRequire} from 'node:module';

const env = {CROUPIER_VERCEL_UI: '1', CROUPIER_PUBLIC_ORIGIN: 'https://preview.example.test',
  CROUPIER_BACKEND_ORIGIN: 'https://isolated.onrender.com', CROUPIER_LAB_UI_ORIGIN: 'https://lab-ui.vercel.app', CROUPIER_VERCEL_INGRESS_SECRET: 'isolated-unit-secret-'.repeat(3)};
const config = platformConfiguration(env);

test('native Studio routes use the Vercel data writer while game commands stay on Render', () => {
  const native = platformConfiguration({...env,CROUPIER_STUDIO_NATIVE_ADMIN:'1'});
  for (const path of ['/studio/api/project','/studio/api/social','/studio/api/videos','/studio/api/videos/upload','/studio/api/videos/classify','/studio/api/videos/one']) {
    assert.equal(platformRoute(new URL(path,native.publicOrigin),native).kind,'lab',path);
  }
  assert.equal(platformRoute(new URL('/studio/api/social/profile',native.publicOrigin),native).kind,'backend');
  for (const path of ['/api/studio-game/command','/api/table','/api/presentation/config']) assert.equal(platformRoute(new URL(path,native.publicOrigin),native).kind,'backend',path);
  assert.equal(backendPlatformPath('/api/studio-game/commands'),false);
});

test('platform routes preserve exact backend boundaries, public origin and query correlation', () => {
  assert.equal(platformConfiguration({}), null);
  assert.throws(() => platformConfiguration({...env, CROUPIER_BACKEND_ORIGIN: env.CROUPIER_PUBLIC_ORIGIN}));
  for (const path of ['/api/table', '/api/bo/users/role', '/studio/api/videos/id', '/api/presentation/videos/abc']) {
    assert.equal(platformRoute(new URL(path + '?requestId=a%20b', config.publicOrigin), config).kind, 'backend');
  }
  for (const path of ['/speech-stream', '/lipsync-worker']) {
    const route = platformRoute(new URL(path, config.publicOrigin), config);
    assert.equal(route.kind, 'socket');
    assert.equal(route.destination, config.publicOrigin + PLATFORM_SOCKET_ENDPOINTS[path]);
    assert.equal(platformRoute(new URL(PLATFORM_SOCKET_ENDPOINTS[path], config.publicOrigin), config).kind, 'reject');
  }
  for (const path of ['/api/auth/lab/check', '/api/auth/access', '/__vercel/lab/session', '/api/internal', '/studio/api/unknown', '/api/bo/%75sers', '/studio/api/../project', '//api/bo/users']) assert.equal(backendPlatformPath(path), false, path);
  assert.equal(platformRoute(new URL('/studio/activity', config.publicOrigin), config).kind, 'lab');
  assert.equal(platformRoute(new URL('/game', config.publicOrigin), config).kind, 'frontend');
  assert.equal(platformRoute(new URL('/game?launch=one-use', config.publicOrigin), config).kind, 'backend');
  const headers = platformBackendHeaders(new Headers({'x-croupier-vercel-secret': 'spoof', 'x-croupier-lab-authorized': 'spoof', origin: config.publicOrigin, cookie: 'player_session=test'}), config);
  assert.equal(headers.get('x-croupier-vercel-secret'), config.secret);
  assert.equal(headers.get('x-croupier-lab-authorized'), null);
  assert.equal(headers.get('origin'), config.publicOrigin);
  assert.equal(headers.get('cookie'), 'player_session=test');
});

test('prepared player uses the actual shared player and keeps BO HTML behind live identity checks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-vercel-ui-'));
  try {
    const prepared = await preparePlatformUi({env, output: directory});
    assert.ok(prepared.files.includes('/app.mjs'));
    assert.ok(prepared.files.includes('/bo/bo.mjs'));
    assert.ok(prepared.files.includes('/bo/player-admin.mjs'));
    assert.ok(prepared.files.includes('/casino.mjs'));
    assert.ok(prepared.files.includes('/vendor/three/GLTFLoader.js'));
    assert.ok(prepared.files.every(path => !/\.(mp4|webm|png|jpg|wav|mp3)$/.test(path)));
    assert.match(await readFile(join(directory, 'public/blackjack-entry.mjs'), 'utf8'), /\/game\/\?dealer=astrid&presentation=local/);
    const game = await platformUiDocument(new Request(config.publicOrigin + '/game'), {env, directory: join(directory, 'runtime-ui')});
    assert.equal(game.status, 200); assert.match(await game.text(), /src="app.mjs"/);
    assert.match(game.headers.get('cache-control'), /no-store/);
    for (const path of ['/v2', '/casino.html']) assert.equal((await platformUiDocument(new Request(config.publicOrigin + path), {env, directory: join(directory, 'runtime-ui')})).status, 200);
    const bo = new Request(config.publicOrigin + '/bo/', {headers: {cookie: 'bo_jwt=isolated'}});
    let calls = 0;
    const fetchImpl = async (url, options) => {
      calls++; assert.equal(url, config.backendOrigin + '/api/bo/me');
      assert.equal(options.headers.get('cookie'), 'bo_jwt=isolated');
      assert.equal(options.headers.get('x-croupier-vercel-secret'), config.secret);
      return Response.json(calls === 1 ? {user: 'reader', role: 'reader'} : {});
    };
    const accepted = await platformUiDocument(bo, {env, fetchImpl, directory: join(directory, 'runtime-ui')});
    assert.equal(accepted.status, 200); assert.match(await accepted.text(), /bo.mjs/);
    const revoked = await platformUiDocument(bo, {env, fetchImpl, directory: join(directory, 'runtime-ui')});
    assert.equal(revoked.status, 302); assert.equal(revoked.headers.get('location'), '/bo/login.html');
    assert.equal(await revoked.text(), '');
    assert.equal((await platformUiDocument(bo, {env, fetchImpl: async () => {throw Error('offline');}, directory})).status, 503);
    assert.equal((await platformUiDocument(new Request(config.publicOrigin + '/bo/generations.json'), {env, directory})).status, 404);
  } finally {await rm(directory, {recursive: true, force: true});}
});

test('actual Next middleware disables rewrite caching for backend and authenticated Lab without leaking ingress to the UI zone', async () => {
  const require = createRequire(new URL('../package.json', import.meta.url));
  const {transpileModule, ModuleKind} = require('typescript');
  const {NextRequest} = require('next/server');
  const compiled = transpileModule(await readFile(new URL('../middleware.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ModuleKind.CommonJS}}).outputText;
  const module = {exports: {}};
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports);
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  try {
    for (const path of ['/api/bo/me', '/studio/api/project', '/studio/activity']) {
      const response = module.exports.middleware(new NextRequest(config.publicOrigin + path));
      assert.equal(response.headers.get('x-vercel-enable-rewrite-caching'), '0', path);
      assert.equal(response.headers.get('cdn-cache-control'), 'no-store', path);
      if (path === '/studio/activity') {
        assert.match(response.headers.get('x-middleware-rewrite'), /^https:\/\/lab-ui\.vercel\.app/);
        assert.equal(response.headers.get('x-middleware-request-x-croupier-vercel-secret'), null);
      } else assert.equal(response.headers.get('x-middleware-request-x-croupier-vercel-secret'), config.secret);
    }
    const ordinary = module.exports.middleware(new NextRequest(config.publicOrigin));
    assert.equal(ordinary.headers.get('x-vercel-enable-rewrite-caching'), null);
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
