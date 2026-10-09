import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {platformConfiguration, platformRoute, backendPlatformPath, platformBackendHeaders, PLATFORM_SOCKET_ENDPOINTS} from '../lib/platform-routing.mjs';
import {platformUiDocument} from '../lib/server-ui.mjs';
import {operatorPlayPath} from '../lib/player-operator.mjs';
import {preparePlatformUi} from '../tools/prepare-platform-ui.mjs';
import {createRequire} from 'node:module';

const env = {CROUPIER_VERCEL_UI: '1', CROUPIER_VERCEL_UNIFIED_UI:'0', CROUPIER_STUDIO_NATIVE_ADMIN: '0', CROUPIER_STUDIO_NEON_POLICY: '0', CROUPIER_PUBLIC_ORIGIN: 'https://preview.example.test',
  CROUPIER_BACKEND_ORIGIN: 'https://isolated.onrender.com', CROUPIER_LAB_UI_ORIGIN: 'https://lab-ui.vercel.app', CROUPIER_VERCEL_INGRESS_SECRET: 'isolated-unit-secret-'.repeat(3)};
const config = platformConfiguration(env);

test('unified Studio configuration needs no second UI origin and retains distinct game authority', () => {
  const unifiedEnv = {...env, CROUPIER_VERCEL_UNIFIED_UI:'1', CROUPIER_STUDIO_NATIVE_ADMIN:'1'};
  delete unifiedEnv.CROUPIER_LAB_UI_ORIGIN;
  const unified = platformConfiguration(unifiedEnv);
  assert.equal(unified.labUiOrigin, unified.publicOrigin);
  assert.equal(unified.unifiedUi, true);
  for(const path of ['/administration','/administration/'])assert.deepEqual(platformRoute(new URL(path,unified.publicOrigin),unified),
    {kind:'redirect',destination:unified.publicOrigin+'/control/administration'});
  assert.equal(platformRoute(new URL('/administration/api',unified.publicOrigin),unified).kind,'frontend');
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
  for (const [path, destination] of [['/control','/studio/control'], ['/control/speech','/studio/control/speech'],
    ['/control/studio','/studio'], ['/control/admin','/studio/administration'], ['/control/ops','/studio/openclaw'], ['/control/lab','/studio'],
    ['/partner','/studio/partner'], ['/partner/demo-north','/studio/partner/demo-north'], ['/partner/demo-south/team','/studio/partner/demo-south/team']]) {
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

test('old workspace slugs redirect to one canonical document without granting another surface',()=>{
  const native=platformConfiguration({...env,CROUPIER_STUDIO_NATIVE_ADMIN:'1'});
  for(const [old,path]of [['/control/voice','/control/speech'],['/control/overview','/control'],['/partner/demo-north/overview','/partner/demo-north'],['/partner/demo-south/theme','/partner/demo-south/presentation'],['/partner/demo-south/bj','/partner/demo-south/tables']]){
    assert.deepEqual(platformRoute(new URL(old,native.publicOrigin),native),{kind:'redirect',destination:native.publicOrigin+path});
    assert.equal(platformRoute(new URL(path,native.publicOrigin),native).kind,'lab');
  }
  assert.equal(platformRoute(new URL('/partner/demo-south/presentation-events',native.publicOrigin),native).kind,'frontend');
});

test('unified player addresses preserve approved selectors and the existing signed launch handler',()=>{
  const unified=platformConfiguration({...env,CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_STUDIO_NEON_POLICY:'1'});
  for(const old of ['/blackjack','/blackjack/','/game','/play/blackjack/'])assert.deepEqual(platformRoute(new URL(old+'?dealer=astrid&lane=mobile-phone&returnTo=https://evil.invalid',unified.publicOrigin),unified),
    {kind:'redirect',destination:unified.publicOrigin+'/play/blackjack?dealer=astrid&lane=mobile-phone'});
  assert.deepEqual(platformRoute(new URL('/play/blackjack?launch=fixture.claim.signature&table=room-1',unified.publicOrigin),unified),
    {kind:'backend',destination:unified.backendOrigin+'/blackjack?launch=fixture.claim.signature&table=room-1'});
  assert.equal(platformRoute(new URL('/play/blackjack',unified.publicOrigin),unified).kind,'frontend');
  assert.equal(platformRoute(new URL('/play/%62lackjack',unified.publicOrigin),unified).kind,'reject');
  assert.deepEqual(platformRoute(new URL('/blackjack?operator=sg-test&dealer=astrid&returnTo=https://evil.invalid',unified.publicOrigin),unified),
    {kind:'redirect',destination:unified.publicOrigin+'/play/blackjack?dealer=astrid&operator=sg-test'});
  assert.deepEqual(platformRoute(new URL('/blackjack?operator=play&dealer=astrid',unified.publicOrigin),unified),
    {kind:'redirect',destination:unified.publicOrigin+'/play/blackjack?dealer=astrid'});
  for (const path of ['/play', '/play/', '/play/profil', '/play/profil/', '/play/historik', '/play/historik/']) {
    assert.equal(platformRoute(new URL(path, unified.publicOrigin), unified).kind, 'frontend', path);
    assert.equal(platformRoute(new URL(path, config.publicOrigin), config).kind, 'frontend', path);
    assert.equal(backendPlatformPath(path), false, path);
  }
});

test('new game document retains live session/policy checks, cookies and fail-closed errors',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'croupier-play-entry-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  await writeFile(join(directory,'game.html'),'<html><body>Fixture game</body></html>');
  const unifiedEnv={...env,CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_STUDIO_NEON_POLICY:'1'};
  const request=new Request(config.publicOrigin+'/play/blackjack?dealer=astrid',{headers:{cookie:'game_session=fixture'}});
  let calls=[];
  const fetchImpl=async(url,init)=>{calls.push(url);assert.equal(init.headers.get('cookie'),'game_session=fixture');assert.equal(init.cache,'no-store');return Response.json(url.endsWith('/api/auth/session')?{authenticated:true}:{gameLane:'mobile-phone'});};
  const ok=await platformUiDocument(request,{env:unifiedEnv,directory,fetchImpl});
  assert.equal(ok.status,200);assert.match(await ok.text(),/data-game-lane="mobile-phone"/);assert.equal(calls.length,2);
  const denied=await platformUiDocument(request,{env:unifiedEnv,directory,fetchImpl:async()=>Response.json({authenticated:false})});
  assert.equal(denied.status,303);assert.equal(denied.headers.get('location'),'/player-login?dealer=astrid');
  const failed=await platformUiDocument(request,{env:unifiedEnv,directory,fetchImpl:async()=>{throw Error('private upstream detail');}});
  assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/private upstream detail|Fixture game/);
});

test('lobby operator survives into the engine proxy; an invalid slug matches today and a launch partner wins',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'croupier-operator-proxy-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  await writeFile(join(directory,'game.html'),'<html><body>Fixture game</body></html>');
  const unifiedEnv={...env,CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_STUDIO_NEON_POLICY:'1'};
  const unified=platformConfiguration(unifiedEnv);
  const partner=`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({partner:'key-1',sub:'player-1'})).toString('base64url')}.sig`;
  const notPartner=`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({operator:'sg-test',sub:'player-1'})).toString('base64url')}.sig`;
  assert.equal(operatorPlayPath('sg-test'),'/play/blackjack?operator=sg-test');
  assert.deepEqual(platformRoute(new URL('/play/blackjack?operator=sg-test&launch=fixture.claim.signature&table=room-1',unified.publicOrigin),unified),
    {kind:'backend',destination:unified.backendOrigin+'/blackjack?operator=sg-test&launch=fixture.claim.signature&table=room-1'});
  assert.deepEqual(platformRoute(new URL('/play/blackjack?operator=play&launch=fixture.claim.signature&table=room-1',unified.publicOrigin),unified),
    {kind:'backend',destination:unified.backendOrigin+'/blackjack?launch=fixture.claim.signature&table=room-1'});
  assert.deepEqual(platformRoute(new URL(`/play/blackjack?operator=sg-test&launch=${partner}&table=room-1`,unified.publicOrigin),unified),
    {kind:'backend',destination:unified.backendOrigin+`/blackjack?launch=${partner}&table=room-1`});
  assert.deepEqual(platformRoute(new URL(`/blackjack?operator=sg-test&launch=${partner}`,unified.publicOrigin),unified),
    {kind:'redirect',destination:unified.publicOrigin+`/play/blackjack?launch=${partner}`});
  const kept=platformRoute(new URL(`/play/blackjack?operator=demo-north&launch=${notPartner}`,unified.publicOrigin),unified);
  assert.equal(kept.kind,'backend');assert.match(kept.destination,/operator=demo-north/);assert.doesNotMatch(kept.destination,/partner=/);
  const calls=[];let authenticated=true;
  const fetchImpl=async(url,init)=>{
    calls.push(String(url));
    assert.equal(init.headers.get('cookie'),'game_session=fixture');
    assert.equal(init.headers.get('x-croupier-vercel-secret'),unifiedEnv.CROUPIER_VERCEL_INGRESS_SECRET);
    assert.equal(init.cache,'no-store');
    if(String(url).includes('/blackjack?')){assert.equal(init.redirect,'manual');return new Response('<!doctype html><html data-game-operator="sg-test" data-game-lane="lane-a"></html>',{status:200,headers:{'content-type':'text/html; charset=utf-8'}});}
    return Response.json(String(url).endsWith('/api/auth/session')?{authenticated}:{gameLane:'mobile-phone'});
  };
  const request=path=>new Request(unified.publicOrigin+path,{headers:{cookie:'game_session=fixture'}});
  const options={env:unifiedEnv,directory,fetchImpl};
  const played=await platformUiDocument(request(operatorPlayPath('sg-test')),options);
  assert.equal(played.status,200);assert.match(await played.text(),/data-game-operator="sg-test"/);
  assert.deepEqual(calls,[unified.backendOrigin+'/api/auth/session',unified.backendOrigin+'/blackjack?operator=sg-test']);
  calls.length=0;authenticated=false;
  const login=await platformUiDocument(request(operatorPlayPath('sg-test')),options);
  assert.equal(login.status,303);assert.equal(login.headers.get('location'),'/player-login?operator=sg-test');
  assert.deepEqual(calls,[unified.backendOrigin+'/api/auth/session']);
  calls.length=0;authenticated=true;
  const plain=await platformUiDocument(request('/play/blackjack?dealer=astrid'),options);
  const invalid=await platformUiDocument(request('/play/blackjack?dealer=astrid&operator=play'),options);
  const duplicate=await platformUiDocument(request('/play/blackjack?dealer=astrid&operator=sg-test&operator=demo-north'),options);
  const plainText=await plain.text();
  assert.equal(await invalid.text(),plainText);assert.equal(await duplicate.text(),plainText);
  assert.equal(calls.some(url=>url.includes('/blackjack?')),false);
  calls.length=0;
  const partnerPage=await platformUiDocument(request(`/play/blackjack?dealer=astrid&operator=sg-test&launch=${partner}`),options);
  assert.equal(await partnerPage.text(),plainText);
  assert.equal(calls.some(url=>url.includes('/blackjack?')),false);
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
    assert.ok(prepared.files.includes('/composition-settings.mjs'));
    assert.ok(prepared.files.includes('/presentation-composition.mjs'));
    for (const name of ['compositor.js', 'geometry.js']) {
      assert.ok(prepared.files.includes('/composition-runtime/' + name));
      assert.equal(await readFile(join(directory, 'public/composition-runtime', name), 'utf8'),
        await readFile(new URL('../../../test-videoeditor/program/web/' + name, import.meta.url), 'utf8'));
    }
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
    for (const [path,location] of [['/bo','/control/administration'],['/bo/','/control/administration'],['/bo/index.html','/control/administration'],
      ['/bo/login.html','/control/login'],[`/bo/login.html?returnTo=${encodeURIComponent(`/api/bo/game-login?state=${state}`)}`,`/control/login?returnTo=${encodeURIComponent(`/api/bo/game-login?state=${state}`)}`],
      [`/bo/set-password.html?t=${token}`,`/control/set-password?t=${token}`]]) {
      const response = await platformUiDocument(new Request(config.publicOrigin + path),{env,directory:runtime});
      assert.equal(response.status,308,path); assert.equal(response.headers.get('location'),location,path);
    }
    assert.equal((await platformUiDocument(new Request(config.publicOrigin + '/bo/login.html?returnTo=https://attacker.invalid'),{env,directory:runtime})).headers.get('location'),'/control/login');
    assert.equal((await platformUiDocument(new Request(config.publicOrigin + '/bo/set-password.html?t=private.bad'),{env,directory:runtime})).headers.get('location'),'/control/set-password');
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
    for (const path of ['/control/speech', '/partner/demo-north']) {
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

test('public dealer media reaches the backend for Dragge and Paow, never for an unknown dealer', () => {
  for (const dealer of ['astrid', 'dragge', 'paow']) {
    for (const path of [`/dealers/${dealer}/poster.jpg`, `/dealers/${dealer}/rest.png`, `/dealers/${dealer}/audio/en/bank.json`, `/media/dealers/${dealer}/runtime/presentation/x.mp4`]) {
      assert.equal(backendPlatformPath(path), true, path);
      assert.deepEqual(platformRoute(new URL(path, config.publicOrigin), config), {kind:'backend', destination:config.backendOrigin + path});
    }
  }
  for (const path of ['/dealers/nova/poster.jpg', '/dealers/draggee/rest.png', '/media/dealers/paow/source/x.mp4']) assert.equal(backendPlatformPath(path), false, path);
});
