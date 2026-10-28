import { presentationPublicModules } from '../../../packages/presentation/public-modules.mjs';
import test from 'node:test';
import {createServer} from 'node:http';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {platformConfiguration, platformRoute, backendPlatformPath, platformBackendHeaders, PLATFORM_SOCKET_ENDPOINTS} from '../../../packages/navigation/server/platform-routing.mjs';
import {platformUiDocument} from '../lib/server-ui.mjs';
import {preparePlatformUi} from '../tools/prepare-platform-ui.mjs';
import {createRequire} from 'node:module';

const env = {CROUPIER_VERCEL_UI: '1', CROUPIER_VERCEL_UNIFIED_UI:'0', CROUPIER_STUDIO_NATIVE_ADMIN: '0', CROUPIER_STUDIO_NEON_POLICY: '0', CROUPIER_PUBLIC_ORIGIN: 'https://preview.example.test',
  CROUPIER_BACKEND_ORIGIN: 'https://isolated.onrender.com', CROUPIER_LAB_UI_ORIGIN: 'https://lab-ui.vercel.app', CROUPIER_VERCEL_INGRESS_SECRET: 'isolated-unit-secret-'.repeat(3)};
const config = platformConfiguration(env);
const roomMediaId='00000000-0000-4000-8000-000000000083';
const roomPresentationRequests=[
  ['/api/presentation/shared-room/room_a-2/binding?configVersion=cfg-1&windowId=unopened','GET'],
  ['/api/presentation/shared-room/room_a-2/config?operatorSlug=north&roomId=room_a-2&packageRevision=7&dealerId=astrid','GET'],
  ['/api/presentation/shared-room/room_a-2/idle-advice','POST'],
  ['/api/presentation/room-idle/north/room_a-2/7/astrid','GET'],
  [`/api/presentation/room-video/north/room_a-2/7/astrid/${roomMediaId}`,'GET'],
  [`/api/presentation/room-layers/north/room_a-2/7/${roomMediaId}`,'GET'],
];

test('published roulette browser contracts use exact backend routes without exposing source aliases', () => {
  for (const path of ['/roulette-idle-contract.mjs', '/material-catalog.mjs', '/background-materials.mjs']) {
    assert.equal(backendPlatformPath(path), true, path);
    assert.deepEqual(platformRoute(new URL(path + '?v=fixture', config.publicOrigin), config),
      {kind:'backend', destination:config.backendOrigin + path + '?v=fixture'}, path);
    for (const alias of [path + '/', path + '/extra', path + '.map', '/web/public' + path]) {
      assert.equal(backendPlatformPath(alias), false, alias);
      assert.equal(platformRoute(new URL(alias, config.publicOrigin), config).kind, 'frontend', alias);
    }
    const encoded = '/%'+path.charCodeAt(1).toString(16)+path.slice(2);
    assert.equal(backendPlatformPath(encoded), false, encoded);
    assert.equal(platformRoute(new URL(encoded, config.publicOrigin), config).kind, 'reject', encoded);
  }
  for (const path of presentationPublicModules.flatMap(row => row.paths).filter(path => path.startsWith('/packages/'))) {
    assert.equal(backendPlatformPath(path), true, path);
    assert.equal(platformRoute(new URL(path, config.publicOrigin), config).kind, 'backend', path);
    for (const suffix of ['/', '/extra', '.map']) assert.equal(backendPlatformPath(path + suffix), false, path + suffix);
  }
  for (const path of ['/packages/presentation/server/selection.mjs', '/packages/presentation/contracts/studio-model.mjs',
    '/packages/navigation/operator-entry.mjs', '/packages/navigation/admin-workspace-routes.mjs', '/packages/navigation/',
    '/packages/navigation/server/platform-routing.mjs','/apps/web/lib/platform-routing.mjs', '/game-entry.mjs',
    '/packages/presentation/contracts/policies/project.seed.json', '/public-operator-preview.mjs', '/storage/frozen-dealer-idle.mjs', '/server.mjs']) {
    assert.equal(backendPlatformPath(path), false, path);
    assert.equal(platformRoute(new URL(path, config.publicOrigin), config).kind, 'frontend', path);
  }
});

test('unified Studio configuration needs no second UI origin and retains distinct game authority', () => {
  const unifiedEnv = {...env, CROUPIER_VERCEL_UNIFIED_UI:'1', CROUPIER_STUDIO_NATIVE_ADMIN:'1'};
  delete unifiedEnv.CROUPIER_LAB_UI_ORIGIN;
  const unified = platformConfiguration(unifiedEnv);
  assert.equal(unified.labUiOrigin, unified.publicOrigin);
  assert.equal(unified.unifiedUi, true);
  for(const path of ['/administration','/administration/'])assert.deepEqual(platformRoute(new URL(path,unified.publicOrigin),unified),
    {kind:'redirect',destination:unified.publicOrigin+'/admin/drift'});
  assert.equal(platformRoute(new URL('/administration/api',unified.publicOrigin),unified).kind,'frontend');
  assert.throws(() => platformConfiguration({...unifiedEnv, CROUPIER_BACKEND_ORIGIN:unified.publicOrigin}));
  assert.throws(() => platformConfiguration({...unifiedEnv, CROUPIER_STUDIO_NATIVE_ADMIN:'0'}));
  assert.throws(() => platformConfiguration({...unifiedEnv, CROUPIER_VERCEL_UNIFIED_UI:'0'}));
});

test('actual unified Studio middleware preserves auth transport and rejects encoded document aliases', async () => {
  const require = createRequire(new URL('../package.json', import.meta.url));
  const {transpileModule, ModuleKind, ScriptTarget} = require('typescript');
  const {NextRequest} = require('next/server');
  const middlewareUrl = new URL('../../studio/middleware.ts', import.meta.url);
  const requireMiddlewareSource = createRequire(middlewareUrl);
  // The frontend service owns Next; Studio dependencies are installed separately.
  const requireMiddleware = specifier => specifier === 'next/server'
    ? require(specifier) : requireMiddlewareSource(specifier);
  const source = await readFile(middlewareUrl, 'utf8');
  const compiled = transpileModule(source, {compilerOptions:{module:ModuleKind.CommonJS, target:ScriptTarget.ES2022}}).outputText;
  const module = {exports:{}};
  new Function('require', 'module', 'exports', compiled)(requireMiddleware, module, module.exports);
  const unifiedEnv = {...env, CROUPIER_VERCEL_UNIFIED_UI:'1', CROUPIER_STUDIO_NATIVE_ADMIN:'1', CROUPIER_LAB_BASE_PATH:'/studio'};
  const previous = Object.fromEntries(Object.keys(unifiedEnv).map(key => [key, process.env[key]]));
  Object.assign(process.env, unifiedEnv);
  try {
    const headers = {cookie:'bo_session=isolated-fixture', 'x-croupier-vercel-secret':'spoof',
      'x-croupier-lab-authorized':'spoof', forwarded:'host=foreign.example'};
    for (const path of ['/studio/api/project', '/studio/api/partner-preview', '/studio/admin', '/studio/admin/login']) {
      const response = module.exports.middleware(new NextRequest(config.publicOrigin + path, {headers,nextConfig:{basePath:'/studio'}}));
      assert.equal(response.headers.get('x-middleware-rewrite'), null, path);
      assert.equal(response.headers.get('x-middleware-request-cookie'), headers.cookie);
      assert.equal(response.headers.get('x-middleware-request-x-croupier-vercel-secret'), null);
      assert.equal(response.headers.get('x-middleware-request-x-croupier-lab-authorized'), null);
      assert.equal(response.headers.get('x-middleware-request-forwarded'), null);
      assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
    }
    for (const prefix of ['', '/studio']) for (const old of ['/login','/control/login']) {
      const response = module.exports.middleware(new NextRequest(config.publicOrigin+prefix+old+'?returnTo='+encodeURIComponent('/admin?room=room-7'),{nextConfig:{basePath:'/studio'}}));
      assert.equal(response.status,307);
      assert.equal(response.headers.get('location'),config.publicOrigin+'/admin/login?returnTo='+encodeURIComponent('/admin?room=room-7'));
      assert.equal(response.headers.get('referrer-policy'),'no-referrer');
      assert.equal(response.headers.get('cache-control'),'no-store');
    }
    const resetToken='fixture_restore_'.repeat(3);
    for (const prefix of ['', '/studio']) for (const old of ['/set-password','/control/set-password']) {
      for(const query of ['t='+resetToken,'token='+resetToken]) {
        const response=module.exports.middleware(new NextRequest(config.publicOrigin+prefix+old+'?'+query+'&foreign=discard',{nextConfig:{basePath:'/studio'}}));
        assert.equal(response.headers.get('location'),config.publicOrigin+'/admin/set-password?t='+resetToken);
        assert.equal(response.headers.get('referrer-policy'),'no-referrer');
      }
      for(const query of ['t=short','t='+resetToken+'&t='+resetToken,'t='+resetToken+'&token='+resetToken]) {
        const response=module.exports.middleware(new NextRequest(config.publicOrigin+prefix+old+'?'+query,{nextConfig:{basePath:'/studio'}}));
        assert.equal(response.headers.get('location'),config.publicOrigin+'/admin/set-password');
      }
    }
    for (const old of ['/control/login','/studio/login','/control/set-password','/studio/set-password']) {
      const response=module.exports.middleware(new NextRequest(config.publicOrigin+old,{method:'POST',body:'password=discard'}));
      assert.equal(response.status,400);assert.equal(response.headers.get('location'),null);
    }
    const navigation = {...headers, 'sec-fetch-site':'cross-site', 'sec-fetch-mode':'navigate', 'sec-fetch-dest':'document'};
    const document = module.exports.middleware(new NextRequest(config.publicOrigin + '/admin?dealer=paow', {headers:navigation}));
    assert.equal(document.headers.get('x-middleware-rewrite'), config.publicOrigin + '/studio/admin?dealer=paow');
    // Known document metadata is normalized before a fetch hop can replace navigate with cors.
    assert.equal(document.headers.get('x-middleware-request-sec-fetch-site'), null);
    assert.equal(document.headers.get('x-middleware-request-cookie'), headers.cookie);
    const foreign = module.exports.middleware(new NextRequest(config.publicOrigin + '/admin', {headers:{...navigation,origin:'https://foreign.example'}}));
    assert.equal(foreign.headers.get('x-middleware-request-origin'), 'https://foreign.example');
    for (const [path, init] of [
      ['/studio/api/project', {headers:navigation}],
      ['/admin/_data/catalog', {headers:navigation}],
      ['/admin', {headers:{...navigation,'sec-fetch-dest':'iframe'}}],
      ['/admin', {headers:{...navigation,'next-action':'fixture'}}],
      ['/admin', {method:'POST',headers:navigation,body:'mutation'}],
      ['/control/replies', {method:'POST',headers:navigation,body:'mutation'}],
      ['/control/replies', {headers:{...navigation,'next-action':'fixture'}}],
    ]) {
      const response = module.exports.middleware(new NextRequest(config.publicOrigin + path, init));
      if (path.startsWith('/control/')) assert.equal(response.status,400,path);
      else assert.equal(response.headers.get('x-middleware-request-sec-fetch-site'), 'cross-site', path);
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
    for (const prefix of ['', '/studio']) for (const old of ['/login','/control/login','/set-password','/control/set-password']) {
      const query=old.endsWith('set-password')?'t='+resetToken:'returnTo='+encodeURIComponent('/admin/publication?room=room-7');
      const response=module.exports.middleware(new NextRequest('https://standalone.fixture.invalid'+prefix+old+'?'+query,{headers:{host:'standalone.fixture.invalid'},nextConfig:{basePath:'/studio'}}));
      const mode=old.endsWith('set-password')?'set-password':'login';
      // The legacy returnTo is kept but canonicalised: the retired publication page is Spelbolag & rum.
      const expected=old.endsWith('set-password')?query:'returnTo='+encodeURIComponent('/admin/rooms?room=room-7');
      assert.equal(response.headers.get('location'),config.publicOrigin+'/admin/'+mode+'?'+expected);
      assert.equal(response.headers.get('referrer-policy'),'no-referrer');
    }
    assert.equal(module.exports.middleware(new NextRequest(config.publicOrigin + '/studio/activity')).headers.get('x-middleware-request-cookie'), null);
  } finally {
    for (const [key,value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test('generated workspace chunks allow encoded bracket folders without widening encoded route access', () => {
  for (const surface of ['partner']) {
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
    '/studio/_next/static/chunks/app/control/%5B%5B...path%5D%5D/page-a1.js',
  ]) assert.equal(platformRoute(new URL(path, config.publicOrigin), config).kind, 'reject', path);
});

test('unknown document paths cannot create customer or API aliases', () => {
  const native = platformConfiguration({...env, CROUPIER_STUDIO_NATIVE_ADMIN:'1'});
  for (const path of ['/control/api/admin', '/partner/api/admin', '/partner/demo-north/voice', '/partner/demo-north/team/users',
    '/partner/demo-north/api/users', '/control/unknown', '/partner/demo-north/unknown']) {
    assert.equal(platformRoute(new URL(path, native.publicOrigin), native).kind, path.startsWith('/control/')?'reject':'frontend', path);
    assert.equal(backendPlatformPath(path), false, path);
  }
  assert.equal(platformRoute(new URL('/partner/demo-north/%74eam', native.publicOrigin), native).kind, 'reject');
  for (const path of ['/studio/api/admin/users', '/studio/api/partner-preview', '/studio/partner', '/studio/admin']) {
    assert.equal(platformRoute(new URL(path, native.publicOrigin), native).kind, 'lab', path);
  }
});

test('catalogue aliases keep scoped choices and reject mutation requests',()=>{
  const unified=platformConfiguration({...env,CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_STUDIO_NEON_POLICY:'1'});
  for(const path of ['/play','/play/']){
    const url=new URL(path+'?operator=alpha&table=room-one&dealer=nora&launch=private&returnTo=https://evil.invalid',unified.publicOrigin);
    for(const method of ['GET','HEAD']) assert.deepEqual(platformRoute(url,unified,new Request(url,{method})),
      {kind:'redirect',destination:unified.publicOrigin+'/lobby?operator=alpha&room=room-one&dealer=nora'});
    for(const method of ['POST','PUT','PATCH','DELETE'])assert.deepEqual(platformRoute(url,unified,new Request(url,{method})),{kind:'reject'});
    assert.deepEqual(platformRoute(url,unified,new Request(url,{headers:{'next-action':'fixture'}})),{kind:'reject'});
  }
  // Retired catalogue and document aliases are plain frontend 404s now; nothing links to them.
  for(const path of ['/demo','/demo/','/casino.html','/v2','/v2/','/bo','/bo/login.html','/labb-lissabon','/roulette-test','/roulette-test/app.mjs','/api/roulette-test/spin']){
    assert.deepEqual(platformRoute(new URL(path+'?operator=alpha',unified.publicOrigin),unified),{kind:'frontend'},path);
    assert.equal(backendPlatformPath(path),false,path);
  }
  const url=new URL('/game?game=blackjack&operator=alpha',unified.publicOrigin);
  assert.deepEqual(platformRoute(url,unified,new Request(url)),{kind:'redirect',destination:unified.publicOrigin+'/lobby?operator=alpha'});
  assert.deepEqual(platformRoute(url,unified,new Request(url,{method:'POST'})),{kind:'reject'});
  for(const path of ['/blackjack','/play/blackjack']){
    const legacy=new URL(path+'?operator=alpha',unified.publicOrigin);
    assert.deepEqual(platformRoute(legacy,unified,new Request(legacy)),{kind:'redirect',status:308,destination:unified.publicOrigin+'/game?game=blackjack&operator=alpha'});
    assert.deepEqual(platformRoute(legacy,unified,new Request(legacy,{method:'POST'})),{kind:'reject'});
  }
});

test('one game start: /play/blackjack, /blackjack and /roulette are 308 aliases and the game selector is strict',()=>{
  const unified=platformConfiguration({...env,CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_STUDIO_NEON_POLICY:'1'});
  for(const [old,destination] of [
    ['/play/blackjack?operator=alpha&table=room-one&dealer=nora&returnTo=https://evil.invalid','/game?game=blackjack&dealer=nora&table=room-one&operator=alpha'],
    ['/play/blackjack/?dealer=astrid','/game?game=blackjack&dealer=astrid'],
    ['/blackjack/?game=roulette&dealer=astrid','/game?game=blackjack&dealer=astrid'],
    ['/roulette','/game?game=roulette'],['/roulette/?operator=alpha&table=roulette-room','/game?game=roulette&table=roulette-room&operator=alpha']]){
    assert.deepEqual(platformRoute(new URL(old,unified.publicOrigin),unified),{kind:'redirect',status:308,destination:unified.publicOrigin+destination},old);
  }
  // A roulette room opens the engine's /play/roulette document with exactly the room selectors in the
  // browser URL: the roulette client posts its own query as the room context and the engine accepts
  // only operator/table/dealer there, so game=roulette must never reach that document.
  const wheel=platformRoute(new URL('/game?game=roulette&operator=alpha&table=roulette-room&dealer=nora&lane=mobile-phone&returnTo=https://evil.invalid',unified.publicOrigin),unified);
  assert.deepEqual(wheel,{kind:'redirect',destination:unified.publicOrigin+'/play/roulette?operator=alpha&table=roulette-room&dealer=nora'});
  assert.deepEqual(platformRoute(new URL(wheel.destination),unified),{kind:'backend',destination:unified.backendOrigin+'/play/roulette?operator=alpha&table=roulette-room&dealer=nora'});
  assert.deepEqual(platformRoute(new URL('/game?game=roulette&table=roulette-room&operator=alpha&operator=beta',unified.publicOrigin),unified),
    {kind:'redirect',destination:unified.publicOrigin+'/play/roulette?table=roulette-room'});
  for(const [dirty,clean] of [['/play/roulette?game=roulette&operator=alpha&table=roulette-room&utm_source=mail','/play/roulette?operator=alpha&table=roulette-room'],
    ['/play/roulette/?dealer=nora&table=roulette-room&operator=alpha','/play/roulette?operator=alpha&table=roulette-room&dealer=nora']]){
    assert.deepEqual(platformRoute(new URL(dirty,unified.publicOrigin),unified),{kind:'redirect',destination:unified.publicOrigin+clean},dirty);
    assert.deepEqual(platformRoute(new URL(clean,unified.publicOrigin),unified),{kind:'backend',destination:unified.backendOrigin+clean},clean);
  }
  for(const bare of ['/play/roulette','/play/roulette/','/play/roulette?utm_source=mail','/play/roulette?dealer=nora&dealer=astrid'])
    assert.deepEqual(platformRoute(new URL(bare,unified.publicOrigin),unified),{kind:'redirect',status:308,destination:unified.publicOrigin+'/game?game=roulette'},bare);
  assert.deepEqual(platformRoute(new URL('/game?game=roulette',unified.publicOrigin),unified),{kind:'redirect',destination:unified.publicOrigin+'/lobby'});
  assert.deepEqual(platformRoute(new URL('/game?game=roulette&operator=alpha',unified.publicOrigin),unified),{kind:'redirect',destination:unified.publicOrigin+'/lobby?operator=alpha'});
  const wheelUrl=new URL('/play/roulette?operator=alpha&table=roulette-room',unified.publicOrigin);
  assert.deepEqual(platformRoute(wheelUrl,unified,new Request(wheelUrl,{method:'POST'})),{kind:'reject'});
  for(const asset of ['/play/roulette','/roulette/app.mjs','/roulette/assets/roulette-bord.png','/roulette-rules.mjs','/api/roulette/table'])
    assert.equal(backendPlatformPath(asset),true,asset+' stays a signed transport path');
  for(const asset of ['/roulette/app.mjs','/roulette/assets/roulette-bord.png','/roulette-rules.mjs','/api/roulette/table'])
    assert.deepEqual(platformRoute(new URL(asset,unified.publicOrigin),unified),{kind:'backend',destination:unified.backendOrigin+asset},asset);
  assert.deepEqual(platformRoute(new URL('/game?game=blackjack&operator=alpha&table=room-one',unified.publicOrigin),unified),{kind:'frontend'});
  for(const query of ['game=poker','game=roulette&game=roulette','game=','game=Blackjack']){
    const url=new URL('/game?'+query+'&operator=alpha&table=room-one',unified.publicOrigin);
    assert.deepEqual(platformRoute(url,unified),{kind:'reject'},query);
    assert.deepEqual(platformRoute(url,unified,new Request(url)),{kind:'reject'},query);
  }
});

test('unified player addresses preserve approved selectors and the existing signed launch handler',()=>{
  const unified=platformConfiguration({...env,CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_STUDIO_NEON_POLICY:'1'});
  for(const old of ['/blackjack','/blackjack/','/play/blackjack','/play/blackjack/'])assert.deepEqual(platformRoute(new URL(old+'?dealer=astrid&lane=mobile-phone&returnTo=https://evil.invalid',unified.publicOrigin),unified),
    {kind:'redirect',status:308,destination:unified.publicOrigin+'/game?game=blackjack&dealer=astrid&lane=mobile-phone'});
  for(const path of ['/game','/game/'])assert.deepEqual(platformRoute(new URL(path+'?dealer=astrid&lane=mobile-phone&returnTo=https://evil.invalid',unified.publicOrigin),unified),{kind:'frontend'});
  const launched=platformRoute(new URL('/play/blackjack?launch=fixture.claim.signature&table=room-1',unified.publicOrigin),unified);
  assert.deepEqual(launched,{kind:'redirect',status:308,destination:unified.publicOrigin+'/game?game=blackjack&table=room-1&launch=fixture.claim.signature'});
  assert.deepEqual(platformRoute(new URL(launched.destination),unified),
    {kind:'backend',destination:unified.backendOrigin+'/game?game=blackjack&table=room-1&launch=fixture.claim.signature'});
  assert.deepEqual(platformRoute(new URL('/play/blackjack',unified.publicOrigin),unified),{kind:'redirect',status:308,destination:unified.publicOrigin+'/game?game=blackjack'});
  assert.deepEqual(platformRoute(new URL('/game?game=blackjack',unified.publicOrigin),unified),{kind:'redirect',destination:unified.publicOrigin+'/lobby'});
  assert.equal(platformRoute(new URL('/play/%62lackjack',unified.publicOrigin),unified).kind,'reject');
  assert.equal(platformRoute(new URL('/%67ame?dealer=astrid',unified.publicOrigin),unified).kind,'reject');
  assert.deepEqual(platformRoute(new URL('/blackjack?operator=sg-test&dealer=astrid&returnTo=https://evil.invalid',unified.publicOrigin),unified),
    {kind:'redirect',status:308,destination:unified.publicOrigin+'/game?game=blackjack&dealer=astrid&operator=sg-test'});
  assert.deepEqual(platformRoute(new URL('/blackjack?operator=play&dealer=astrid',unified.publicOrigin),unified),
    {kind:'redirect',status:308,destination:unified.publicOrigin+'/game?game=blackjack&dealer=astrid'});
  for (const path of ['/play/profil', '/play/profil/', '/play/historik', '/play/historik/']) {
    assert.equal(platformRoute(new URL(path, unified.publicOrigin), unified).kind, 'frontend', path);
    assert.equal(platformRoute(new URL(path, config.publicOrigin), config).kind, 'frontend', path);
    assert.equal(backendPlatformPath(path), false, path);
  }
});

test('new game document retains live session/policy checks, cookies and fail-closed errors',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'croupier-play-entry-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  await writeFile(join(directory,'game.html'),'<html><body>Fixture game</body></html>');
  const unifiedEnv={...env,CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_STUDIO_NEON_POLICY:'1'};
  const request=new Request(config.publicOrigin+'/game?game=blackjack&dealer=astrid',{headers:{cookie:'game_session=fixture'}});
  let calls=[];
  const fetchImpl=async(url,init)=>{calls.push(url);assert.equal(init.headers.get('cookie'),'game_session=fixture');assert.equal(init.cache,'no-store');return url.endsWith('/api/auth/session')?Response.json({authenticated:true}):new Response('<html data-game-lane="saved-johanna" data-game-dealer="johanna"></html>');};
  const ok=await platformUiDocument(request,{env:unifiedEnv,directory,fetchImpl});
  assert.equal(ok.status,200);assert.match(await ok.text(),/data-game-lane="saved-johanna"/);assert.equal(calls.length,2);
  const denied=await platformUiDocument(request,{env:unifiedEnv,directory,fetchImpl:async()=>Response.json({authenticated:false})});
  assert.equal(denied.status,303);assert.equal(denied.headers.get('location'),'/player-login?game=blackjack&dealer=astrid');
  const failed=await platformUiDocument(request,{env:unifiedEnv,directory,fetchImpl:async()=>{throw Error('private upstream detail');}});
  assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/private upstream detail|Fixture game/);
  // The route never guesses a game; a roulette room goes to the engine's document address without a session read.
  for(const query of ['game=poker&dealer=astrid','game=blackjack&game=blackjack&dealer=astrid']){
    const response=await platformUiDocument(new Request(config.publicOrigin+'/game?'+query),{env:unifiedEnv,directory,fetchImpl:()=>assert.fail('no session read for '+query)});
    assert.equal(response.status,404,query);
  }
  const wheel=await platformUiDocument(new Request(config.publicOrigin+'/game?game=roulette&operator=sg-test&table=room-1&lane=mobile-phone'),{env:unifiedEnv,directory,fetchImpl:()=>assert.fail('no session read for roulette')});
  assert.equal(wheel.status,307);assert.equal(wheel.headers.get('location'),'/play/roulette?operator=sg-test&table=room-1');
  for(const path of ['/play/blackjack?dealer=astrid','/blackjack?dealer=astrid','/play/roulette','/v2','/bo','/casino.html','/demo'])
    assert.equal((await platformUiDocument(new Request(config.publicOrigin+path),{env:unifiedEnv,directory,fetchImpl:()=>assert.fail('retired document '+path)})).status,404,path);
});

test('lobby operator survives into the engine proxy; an invalid slug matches today and a launch partner wins',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'croupier-operator-proxy-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  await writeFile(join(directory,'game.html'),'<html><body>Fixture game</body></html>');
  const unifiedEnv={...env,CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_STUDIO_NEON_POLICY:'1'};
  const unified=platformConfiguration(unifiedEnv);
  const partner=`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({partner:'key-1',sub:'player-1'})).toString('base64url')}.sig`;
  const notPartner=`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({operator:'sg-test',sub:'player-1'})).toString('base64url')}.sig`;
  assert.deepEqual(platformRoute(new URL('/game?operator=sg-test&launch=fixture.claim.signature&table=room-1',unified.publicOrigin),unified),
    {kind:'backend',destination:unified.backendOrigin+'/game?operator=sg-test&launch=fixture.claim.signature&table=room-1'});
  assert.deepEqual(platformRoute(new URL('/game?operator=play&launch=fixture.claim.signature&table=room-1',unified.publicOrigin),unified),
    {kind:'backend',destination:unified.backendOrigin+'/game?launch=fixture.claim.signature&table=room-1'});
  assert.deepEqual(platformRoute(new URL(`/game?operator=sg-test&launch=${partner}&table=room-1`,unified.publicOrigin),unified),
    {kind:'backend',destination:unified.backendOrigin+`/game?launch=${partner}&table=room-1`});
  const legacyLaunch=platformRoute(new URL(`/blackjack?operator=sg-test&launch=${partner}`,unified.publicOrigin),unified);
  assert.deepEqual(legacyLaunch,{kind:'redirect',status:308,destination:unified.publicOrigin+`/game?game=blackjack&operator=sg-test&launch=${partner}`});
  assert.deepEqual(platformRoute(new URL(legacyLaunch.destination),unified),{kind:'backend',destination:unified.backendOrigin+`/game?game=blackjack&launch=${partner}`});
  const kept=platformRoute(new URL(`/game?operator=demo-north&launch=${notPartner}`,unified.publicOrigin),unified);
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
  const played=await platformUiDocument(request('/game?game=blackjack&operator=sg-test&table=room-1'),options);
  assert.equal(played.status,200);assert.match(await played.text(),/data-game-operator="sg-test"/);
  assert.deepEqual(calls,[unified.backendOrigin+'/api/auth/session',unified.backendOrigin+'/blackjack?table=room-1&operator=sg-test']);
  calls.length=0;authenticated=false;
  const login=await platformUiDocument(request('/game?operator=sg-test&table=room-1'),options);
  assert.equal(login.status,303);assert.equal(login.headers.get('location'),'/player-login?table=room-1&operator=sg-test');
  assert.deepEqual(calls,[unified.backendOrigin+'/api/auth/session']);
  calls.length=0;authenticated=true;
  const plain=await platformUiDocument(request('/game?dealer=astrid'),options);
  const invalid=await platformUiDocument(request('/game?dealer=astrid&operator=play'),options);
  const duplicate=await platformUiDocument(request('/game?dealer=astrid&operator=sg-test&operator=demo-north'),options);
  const plainText=await plain.text();
  assert.equal(await invalid.text(),plainText);assert.equal(await duplicate.text(),plainText);
  assert.equal(calls.some(url=>url.includes('/blackjack?')),true);assert.ok(calls.every(url=>!url.includes('/api/bo/config')));
  calls.length=0;
  const partnerPage=await platformUiDocument(request(`/game?dealer=astrid&operator=sg-test&launch=${partner}`),options);
  assert.equal(await partnerPage.text(),plainText);
  assert.equal(calls.some(url=>url.includes('/blackjack?')),true);assert.ok(calls.every(url=>!url.includes('/api/bo/config')));
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
  const {default:nextConfig} = await import('../next.config.mjs');
  const tracing = nextConfig.outputFileTracingIncludes;
  for (const [route, document] of [['/game','./runtime-ui/game.html'], ['/player-login','./runtime-ui/blackjack.html']]) {
    assert.ok(tracing[route]?.includes(document), `${route} must package its player document`);
  }
  // Middleware owns canonical launch and retirement; Next must not resurrect
  // a second document or redirect path for these entries.
  const middlewareEntries = new Set(['/v2', '/blackjack', '/play/blackjack']);
  for (const [route, files] of Object.entries(tracing)) {
    assert.ok(!middlewareEntries.has(route), `${route} belongs to middleware`);
    assert.doesNotMatch(route, /^\/bo(?:\/|$)/);
    for (const file of files) assert.doesNotMatch(file, /(?:^|[/\\])runtime-ui[/\\]bo(?:[/\\.]|$)/);
  }
  for (const redirect of await nextConfig.redirects()) {
    assert.ok(!middlewareEntries.has(redirect.source), `${redirect.source} belongs to middleware`);
    assert.doesNotMatch(redirect.source, /^\/bo(?:\/|$)/);
    const destination = new URL(redirect.destination, 'https://frontend.example.test');
    assert.equal(destination.origin, 'https://frontend.example.test', 'bookmarks must stay on the current frontend');
    assert.doesNotMatch(destination.pathname, /^\/control(?:\/|$)/);
  }
});

test('platform routes preserve exact backend boundaries, public origin and query correlation', () => {
  assert.equal(platformConfiguration({}), null);
  assert.throws(() => platformConfiguration({...env, CROUPIER_BACKEND_ORIGIN: env.CROUPIER_PUBLIC_ORIGIN}));
  for (const path of ['/api/table', '/studio/api/videos/id', '/api/presentation/videos/abc']) {
    assert.equal(platformRoute(new URL(path + '?requestId=a%20b', config.publicOrigin), config).kind, 'backend');
  }
  // The retired Admin-to-player handoff and BO endpoints have no backend ingress.
  for (const path of ['/api/bo/config', '/api/bo/speech-qa', `/api/bo/game-login?state=${'a'.repeat(64)}`, `/api/bo/lab-login?state=${'a'.repeat(64)}`]) {
    assert.equal(backendPlatformPath(new URL(path, config.publicOrigin).pathname), false, path);
    assert.equal(platformRoute(new URL(path, config.publicOrigin), config).kind, 'frontend', path);
  }
  for (const path of ['/speech-stream', '/lipsync-worker']) {
    const route = platformRoute(new URL(path, config.publicOrigin), config);
    assert.equal(route.kind, 'socket');
    assert.equal(route.destination, config.publicOrigin + PLATFORM_SOCKET_ENDPOINTS[path]);
    assert.equal(platformRoute(new URL(PLATFORM_SOCKET_ENDPOINTS[path], config.publicOrigin), config).kind, 'reject');
  }
  for (const path of ['/api/auth/lab/check', '/api/auth/access', '/__vercel/lab/session', '/api/internal', '/studio/api/unknown', '/studio/api/original-media', '/studio/api/original-media/player', '/api/bo/login', '/api/bo/users', '/api/bo/users/role', '/api/bo/%75sers', '/studio/api/../project', '//api/bo/users']) assert.equal(backendPlatformPath(path), false, path);
  assert.equal(platformRoute(new URL('/studio/activity', config.publicOrigin), config).kind, 'lab');
  assert.equal(platformRoute(new URL('/game', config.publicOrigin), config).kind, 'frontend');
  assert.equal(platformRoute(new URL('/game?launch=one-use', config.publicOrigin), config).kind, 'backend');
  const headers = platformBackendHeaders(new Headers({'x-croupier-vercel-secret': 'spoof', 'x-croupier-lab-authorized': 'spoof', origin: config.publicOrigin, cookie: 'player_session=test'}), config);
  assert.equal(headers.get('x-croupier-vercel-secret'), config.secret);
  assert.equal(headers.get('x-croupier-lab-authorized'), null);
  assert.equal(headers.get('origin'), config.publicOrigin);
  assert.equal(headers.get('cookie'), 'player_session=test');
});

test('retired QA and unknown presentation paths have no backend ingress', () => {
  const path = '/api/presentation/native-p6-playback-context';
  for (const extra of [path, path + '/', path + '/owner', path + 's', '/api/presentation/native-p6',
    '/api/presentation/unknown', '/api/presentation/native-p6-%70layback-context', path + '\\owner']) {
    assert.equal(backendPlatformPath(extra), false, extra);
  }
  for (const extra of [path, path + '/', path + '/owner', path + 's', '/api/presentation/native-p6', '/api/presentation/unknown']) {
    assert.equal(platformRoute(new URL(extra, config.publicOrigin), config).kind, 'frontend', extra);
  }
});

test('prepared player uses the actual shared player and redirects retired BO documents to native Studio', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-vercel-ui-'));
  try {
    const prepared = await preparePlatformUi({env, output: directory});
    assert.ok(prepared.files.includes('/app.mjs'));
      assert.ok(prepared.files.includes('/dealer-identity.mjs'));
      assert.equal(await readFile(join(directory,'public','dealer-identity.mjs'),'utf8'),await readFile(new URL('../../../packages/presentation/contracts/dealer-identity.mjs',import.meta.url),'utf8'));
    assert.ok(prepared.files.includes('/web/public/dealer-identity.mjs'));
    assert.equal(await readFile(join(directory,'public/web/public/dealer-identity.mjs'),'utf8'), await readFile(join(directory,'public/dealer-identity.mjs'),'utf8'));
    assert.ok(prepared.files.includes('/composition-settings.mjs'));
    assert.ok(prepared.files.includes('/presentation-composition.mjs'));
    for (const name of ['compositor.js', 'geometry.js']) {
      assert.ok(prepared.files.includes('/composition-runtime/' + name));
      assert.equal(await readFile(join(directory, 'public/composition-runtime', name), 'utf8'),
        await readFile(new URL('../../../packages/presentation/compositor/' + name, import.meta.url), 'utf8'));
    }
    assert.ok(prepared.files.every(path => !path.startsWith('/bo/')));
    assert.equal(prepared.files.includes('/casino.mjs'), false);
    assert.equal(prepared.files.includes('/casino-navigation.mjs'), false);
    await assert.rejects(readFile(join(directory, 'runtime-ui/casino.html'), 'utf8'));
    assert.ok(prepared.files.every(path => !/\.(mp4|webm|png|jpg|wav|mp3)$/.test(path)));
    assert.equal(await readFile(join(directory, 'public/blackjack-entry.mjs'), 'utf8'),await readFile(new URL('../../../services/game/public/blackjack-entry.mjs',import.meta.url),'utf8'));
    const game = await platformUiDocument(new Request(config.publicOrigin + '/game'), {env, directory: join(directory, 'runtime-ui')});
    assert.equal(game.status, 200); assert.match(await game.text(), /src="app.mjs"/);
    assert.match(game.headers.get('cache-control'), /no-store/);
    // Retired document addresses have no frontend document any more.
    const runtime = join(directory, 'runtime-ui'), state = 'a'.repeat(64);
    for (const path of ['/casino.html','/v2','/v2/','/bo','/bo/','/bo/index.html','/bo/login.html',`/bo/login.html?returnTo=${encodeURIComponent(`/api/bo/game-login?state=${state}`)}`,
      '/bo/set-password.html?t='+'b'.repeat(43),'/bo/generations.json','/demo','/blackjack','/play/blackjack','/play/roulette','/labb-lissabon']) {
      const response = await platformUiDocument(new Request(config.publicOrigin + path),{env,directory:runtime});
      assert.equal(response.status,404,path); assert.equal(response.headers.get('location'),null,path);
    }
    assert.equal((await platformUiDocument(new Request(config.publicOrigin + '/game',{method:'POST'}),{env,directory:runtime})).status,405);
  } finally {await rm(directory, {recursive: true, force: true});}
});

test('new frontend serves its built public module graph when the older backend refuses those paths', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-public-deploy-order-'));
  const require = createRequire(new URL('../package.json', import.meta.url));
  const {transpileModule, ModuleKind, ScriptTarget} = require('typescript');
  const {NextRequest} = require('next/server');
  const {serveStatic} = require('next/dist/server/serve-static.js');
  const compiled = transpileModule(await readFile(new URL('../middleware.ts', import.meta.url), 'utf8'),
    {compilerOptions:{module:ModuleKind.CommonJS, target:ScriptTarget.ES2022}}).outputText;
  const module = {exports:{}};
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports);
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  let backendRequests = 0;
  const backend = createServer((req,res) => { backendRequests++; res.writeHead(421); res.end('old backend refuses new module'); });
  let frontend;
  try {
    const prepared = await preparePlatformUi({env, output:directory});
    backend.listen(0,'127.0.0.1'); await once(backend,'listening');
    const backendOrigin = 'http://127.0.0.1:'+backend.address().port;
    frontend = createServer(async(req,res) => {
      try {
        const response = module.exports.middleware(new NextRequest(config.publicOrigin+req.url, {method:req.method,headers:req.headers}));
        const rewrite = response.headers.get('x-middleware-rewrite');
        if (rewrite) {
          const upstream = await fetch(backendOrigin+new URL(rewrite).pathname, {method:req.method});
          res.writeHead(upstream.status); res.end(await upstream.text()); return;
        }
        if (response.headers.get('x-middleware-next') !== '1') { res.writeHead(response.status,Object.fromEntries(response.headers)); res.end(); return; }
        const path = new URL(req.url,config.publicOrigin).pathname;
        await serveStatic(req,res,join(directory,'public',path.slice(1)));
      } catch (error) { res.writeHead(error.statusCode ?? 500); res.end(); }
    });
    frontend.listen(0,'127.0.0.1'); await once(frontend,'listening');
    const origin = 'http://127.0.0.1:'+frontend.address().port;
    const pending = ['/app.mjs', '/shared-room-app.mjs', ...presentationPublicModules.flatMap(row => row.paths)];
    assert.deepEqual(pending.filter(path => !prepared.files.includes(path)), [], 'every declared public URL must be built');
    for (const path of ['/packages/navigation/game-entry.mjs','/packages/navigation/operator-slug.mjs']) assert.ok(pending.includes(path),path);
    const visited = new Set();
    while (pending.length) {
      const path = pending.shift(); if (visited.has(path)) continue; visited.add(path);
      const response = await fetch(origin+path+'?revision=new-frontend');
      assert.equal(response.status,200,path);
      const body = await response.text();
      assert.equal(body,await readFile(join(directory,'public',path.slice(1)),'utf8'),path);
      assert.match(response.headers.get('content-type'),path.endsWith('.json')?/application\/json/:/(?:text|application)\/javascript/,path);
      const head = await fetch(origin+path,{method:'HEAD'});
      assert.equal(head.status,200,path); assert.equal(await head.text(),'',path);
      for (const header of ['content-type','content-length']) assert.equal(head.headers.get(header),response.headers.get(header),path+' '+header);
      if (path.endsWith('.json')) { JSON.parse(body); continue; }
      const imports = [
        ...body.matchAll(/^\s*(?:import|export)\s+(?:[\w\s{},*$]+?\s+from\s*)?['"]([^'"]+)['"]/gm),
        ...body.matchAll(/^\s*(?:import|export)[^'"\n]*?\bfrom\s*['"]([^'"]+)['"]/gm),
        ...body.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
      ];
      for (const match of imports) pending.push(new URL(match[1],origin+path).pathname);
    }
    assert.ok([...visited].some(path => path.endsWith('.json')),'the public JSON contract is exercised');
    assert.ok(visited.has('/abort-signals.mjs'),'the actual game import graph must serve its signal helper');
    for (const path of ['/packages/navigation/server/platform-routing.mjs','/packages/navigation/operator-entry.mjs',
      '/packages/presentation/server/selection.mjs','/packages/presentation/contracts/studio-model.mjs',
      '/packages/navigation/game-entry.mjs/extra','/packages/navigation/game-entry.mjs.bak']) {
      assert.equal((await fetch(origin+path)).status,404,path);
    }
    assert.equal((await fetch(origin+'/packages/navigation/%67ame-entry.mjs')).status,400);
    for (const method of ['POST','PUT','DELETE','OPTIONS']) {
      const response = await fetch(origin+'/packages/navigation/game-entry.mjs',{method});
      assert.equal(response.status,405,method); assert.equal(response.headers.get('allow'),'GET, HEAD');
    }
    for (const method of ['GET','POST']) assert.equal((await fetch(origin+'/packages/navigation/game-entry.mjs',
      {method,headers:{'next-action':'synthetic-action'}})).status,405,method+' action');
    assert.equal(backendRequests,0,'public modules must not depend on the backend release');
    assert.equal((await fetch(origin+'/api/profile')).status,421,'authenticated APIs retain the real backend route');
    assert.ok(backendRequests > 0); // Fetch may retry an idempotent request after 421.
  } finally {
    frontend?.closeAllConnections(); if (frontend?.listening) await new Promise(resolve => frontend.close(resolve));
    backend.closeAllConnections(); if (backend.listening) await new Promise(resolve => backend.close(resolve));
    for (const [key,value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key]=value;
    await rm(directory,{recursive:true,force:true});
  }
});
test('actual /play/{game} route handlers are permanent redirects to /game and the retired route files are gone', async () => {
  const require = createRequire(new URL('../package.json', import.meta.url));
  const {transpileModule, ModuleKind, ScriptTarget} = require('typescript');
  const load = async name => {
    const routeUrl = new URL(`../app/${name}/route.ts`, import.meta.url);
    const compiled = transpileModule(await readFile(routeUrl, 'utf8'), {compilerOptions: {module: ModuleKind.CommonJS, target: ScriptTarget.ES2022}}).outputText;
    const module = {exports: {}};
    new Function('require', 'module', 'exports', compiled)(createRequire(routeUrl), module, module.exports);
    return module.exports;
  };
  const blackjack = await load('play/blackjack');
  const plain = await blackjack.GET(new Request(config.publicOrigin + '/play/blackjack'));
  assert.equal(plain.status, 308);
  assert.equal(plain.headers.get('location'), '/game?game=blackjack');
  assert.match(plain.headers.get('cache-control'), /no-store/);
  const kept = await blackjack.HEAD(new Request(config.publicOrigin + '/play/blackjack?operator=sg-test&dealer=astrid&returnTo=https://evil.invalid'));
  assert.equal(kept.status, 308);
  assert.equal(kept.headers.get('location'), '/game?game=blackjack&dealer=astrid&operator=sg-test');
  assert.equal(await kept.text(), '');
  const lobby = await load('play');
  assert.equal((await lobby.GET(new Request(config.publicOrigin + '/play?operator=sg-test'))).headers.get('location'), '/lobby?operator=sg-test');
  const routes = await readdir(new URL('../app/', import.meta.url));
  for (const name of ['casino.html', 'v2', 'blackjack', 'bo', 'labb-lissabon', 'demo']) assert.equal(routes.includes(name), false, name);
  // The roulette document is the engine's /play/roulette behind the platform rewrite; the frontend has no roulette route.
  assert.deepEqual((await readdir(new URL('../app/play/', import.meta.url))).sort(), ['blackjack', 'historik', 'profil', 'route.ts']);
  assert.equal((await readdir(new URL('../lib/', import.meta.url))).some(name => name.startsWith('game-url')), false, 'no Render game URL default remains');
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
    for (const path of ['/api/table', '/studio/api/project', '/studio/activity', '/api/presentation/select']) {
      const response = module.exports.middleware(new NextRequest(config.publicOrigin + path));
      assert.equal(response.headers.get('x-vercel-enable-rewrite-caching'), '0', path);
      assert.equal(response.headers.get('cdn-cache-control'), 'no-store', path);
      if (path === '/studio/activity') {
        assert.match(response.headers.get('x-middleware-rewrite'), /^https:\/\/lab-ui\.vercel\.app/);
        assert.equal(response.headers.get('x-middleware-request-x-croupier-vercel-secret'), null);
      } else assert.equal(response.headers.get('x-middleware-request-x-croupier-vercel-secret'), config.secret);
    }
    for(const [path,method]of roomPresentationRequests){
      const response=module.exports.middleware(new NextRequest(config.publicOrigin+path,{method,headers:{cookie:'player_session=isolated',range:'bytes=2-7','if-none-match':'"frozen"','x-croupier-vercel-secret':'spoof'}}));
      assert.equal(response.headers.get('x-middleware-rewrite'),config.backendOrigin+path);
      assert.equal(response.headers.get('x-middleware-request-cookie'),'player_session=isolated');
      assert.equal(response.headers.get('x-middleware-request-range'),'bytes=2-7');
      assert.equal(response.headers.get('x-middleware-request-if-none-match'),'"frozen"');
      assert.equal(response.headers.get('x-middleware-request-x-croupier-vercel-secret'),config.secret);
      assert.equal(response.headers.get('x-vercel-enable-rewrite-caching'),'0');assert.equal(response.headers.get('cdn-cache-control'),'no-store');
    }
    const contextPath = '/api/presentation/select';
    const context = module.exports.middleware(new NextRequest(config.publicOrigin + contextPath, {method:'GET', headers:{
      cookie:'player_session=isolated-unit-session', 'x-croupier-vercel-secret':'spoof', 'x-croupier-player-owner':'spoof',
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
    assert.equal(context.headers.get('x-middleware-request-x-croupier-player-owner'), null);
    assert.equal(context.headers.get('cdn-cache-control'), 'no-store');
    assert.equal(context.headers.get('x-vercel-enable-rewrite-caching'), '0');
    for (const extra of ['/api/presentation/native-p6-playback-context', contextPath + '/owner', contextPath + 's', '/api/presentation/unknown']) {
      const unmatched = module.exports.middleware(new NextRequest(config.publicOrigin + extra));
      assert.equal(unmatched.headers.get('x-middleware-rewrite'), null, extra);
      assert.equal(unmatched.headers.get('x-middleware-request-x-croupier-vercel-secret'), null, extra);
    }
    const ordinary = module.exports.middleware(new NextRequest(config.publicOrigin));
    assert.equal(ordinary.headers.get('x-vercel-enable-rewrite-caching'), null);
    process.env.CROUPIER_STUDIO_NATIVE_ADMIN = '1';
    for (const path of ['/admin', '/partner/demo-north']) {
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

test('frozen registered idle has one exact backend address and preserves the existing player/transport headers',()=>{
  const path='/api/presentation/registered-idle/north/room-johanna/7/johanna';
  assert.equal(backendPlatformPath(path),true);assert.deepEqual(platformRoute(new URL(path,config.publicOrigin),config),{kind:'backend',destination:config.backendOrigin+path});
  const headers=platformBackendHeaders(new Headers({cookie:'player_session=fixture',range:'bytes=0-15','x-presentation-capability-version':'3'}),config);
  assert.equal(headers.get('cookie'),'player_session=fixture');assert.equal(headers.get('range'),'bytes=0-15');assert.equal(headers.get('x-croupier-vercel-secret'),config.secret);
  for(const bad of ['/api/presentation/registered-idle','/api/presentation/registered-idle/north/room/7','/api/presentation/registered-idle/north/room/0/johanna',path+'/',path+'/record','/api/presentation/registered-idle/north/room/7/%6aohanna','/api/presentation/registered-idle/north/room/7/../johanna'])assert.equal(backendPlatformPath(bad),false,bad);
});

test('frozen event media has one exact authenticated backend route',()=>{
  const path='/api/presentation/registered-video/north/room-johanna/7/johanna/00000000-0000-4000-8000-000000000083';
  assert.equal(backendPlatformPath(path),true);
  assert.deepEqual(platformRoute(new URL(path,config.publicOrigin),config),{kind:'backend',destination:config.backendOrigin+path});
  const headers=platformBackendHeaders(new Headers({cookie:'player_session=fixture',range:'bytes=0-15'}),config);
  assert.equal(headers.get('cookie'),'player_session=fixture');assert.equal(headers.get('range'),'bytes=0-15');
  for(const bad of [path+'/',path+'/record',path.replace('/7/','/0/'),path.replace('/johanna/','/%6aohanna/'),path.replace(/83$/,'xyz'),path.replace('/north/','/../')]) assert.equal(backendPlatformPath(bad),false,bad);
});

test('active shared presentation routes preserve exact queries, player cookies and media validators through signed transport',()=>{
  for(const [path,method]of roomPresentationRequests){
    assert.equal(backendPlatformPath(path),true,path);
    const url=new URL(path,config.publicOrigin);
    assert.deepEqual(platformRoute(url,config,new Request(url,{method})),{kind:'backend',destination:config.backendOrigin+path});
    if(path.includes('/room-'))assert.deepEqual(platformRoute(url,config,new Request(url,{method:'HEAD'})),{kind:'backend',destination:config.backendOrigin+path});
  }
  const headers=platformBackendHeaders(new Headers({cookie:'player_session=isolated',range:'bytes=2-7','if-range':'"frozen"','if-none-match':'"frozen"','x-croupier-vercel-secret':'spoof'}),config);
  for(const [name,value]of [['cookie','player_session=isolated'],['range','bytes=2-7'],['if-range','"frozen"'],['if-none-match','"frozen"']])assert.equal(headers.get(name),value);
  assert.equal(headers.get('x-croupier-vercel-secret'),config.secret);
});

test('active room presentation routes reject adjacent namespaces, invalid identities and noncanonical paths',()=>{
  const base='/api/presentation/shared-room/room-a',media='/api/presentation/room-video/north/room-a/7/astrid/'+roomMediaId;
  const bad=[base,base+'/',base+'/select',base+'/bindings',base+'/binding/extra',base+'/config/extra',base+'/idle-advice/extra',
    '/api/presentation/shared-room//binding','/api/presentation/shared-room/Room-a/binding',
    '/api/presentation/shared-room/'+'a'.repeat(129)+'/binding',base.replace('room-a','room%2Da')+'/binding',base+'/../room-b/binding',
    '/api/presentation/shared-room/room/a/binding','/api/presentation/unknown','/api/presentation/room-anything/north/room-a/7/astrid',
    media+'/',media+'/extra',media.replace('/7/','/0/'),media.replace('/7/','/01/'),media.replace('/7/','/9007199254740992/'),
    media.replace('/north/','/North/'),media.replace('/room-a/','/room%2Da/'),media.replace('/room-a/','/../'),
    media.replace('/astrid/','/astrid_/'),media.replace(roomMediaId,roomMediaId.toUpperCase().replace('0000','ABCD')),media.replace(roomMediaId,'not-a-uuid'),
    '/api/presentation/room-idle/north/room-a/7/astrid/'+roomMediaId,'/api/presentation/room-video/north/room-a/7/astrid',
    '/api/presentation/room-layers/north/room-a/7/astrid/'+roomMediaId,'/api/presentation/room-layers/north/room-a/7/'+roomMediaId+'/extra'];
  for(const path of bad)assert.equal(backendPlatformPath(path),false,path);
});

test('published room catalogue uses an exact operator route through existing backend transport',()=>{
  const path='/api/operators/sg-test/rooms';
  assert.equal(backendPlatformPath(path),true);
  assert.deepEqual(platformRoute(new URL(path,config.publicOrigin),config),{kind:'backend',destination:config.backendOrigin+path});
  const headers=platformBackendHeaders(new Headers({cookie:'player_session=fixture','x-croupier-vercel-secret':'spoof'}),config);
  assert.equal(headers.get('cookie'),'player_session=fixture');
  assert.equal(headers.get('x-croupier-vercel-secret'),config.secret);
  for(const bad of [path+'/',path+'/private','/api/operators/sg-test/packages','/api/operators/sg-test/draft','/api/operators/%73g-test/rooms','/api/operators/sg-test/../rooms','/api/operators//rooms'])assert.equal(backendPlatformPath(bad),false,bad);
});

test('Studio preview transports only explicit session paths without acquiring ordinary player context', () => {
  const id='10000000-0000-4000-8000-000000000001', base='/api/studio-preview/'+id;
  const paths=['/api/studio-preview','/studio-preview/'+id,base,...['player','table','session','presentation/config',
    'presentation/legacy-config','presentation/select','presentation/idle-advice','videos/'+id,'layers/'+id].map(tail=>base+'/'+tail)];
  for(const path of paths) {
    assert.equal(backendPlatformPath(path),true,path);
    assert.deepEqual(platformRoute(new URL(path+'?dealer=amira',config.publicOrigin),config),
      {kind:'backend',destination:config.backendOrigin+path+'?dealer=amira'});
  }
  for(const path of ['/studio-preview','/studio-preview/not-a-session',base+'/chat',base+'/deposit',base+'/currency',base+'/auth/logout',
    base+'/../table',base+'/videos/private/file',base+'/layers/'+id+'/extra',base+'/',base+'/presentation/select/extra',
    '/api/studio-preview//'+id,base.replace('/api/','/api/%73')]) assert.equal(backendPlatformPath(path),false,path);
});
test('bare game start enters the existing lobby without reading a player session or saved global lane',async()=>{
  const unifiedEnv={...env,CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_STUDIO_NEON_POLICY:'1'};
  const unified=platformConfiguration(unifiedEnv);
  for(const path of ['/play/blackjack','/play/blackjack/','/blackjack','/blackjack/','/play/blackjack?utm_source=bookmark&returnTo=https://evil.invalid']){
    assert.deepEqual(platformRoute(new URL(path,unified.publicOrigin),unified),{kind:'redirect',status:308,destination:unified.publicOrigin+'/game?game=blackjack'});
  }
  for(const path of ['/game','/game/','/game?game=blackjack','/game?game=roulette','/game?utm_source=bookmark&returnTo=https://evil.invalid']){
    assert.deepEqual(platformRoute(new URL(path,unified.publicOrigin),unified),{kind:'redirect',destination:unified.publicOrigin+'/lobby'});
    for(const method of ['GET','HEAD']){
      const response=await platformUiDocument(new Request(unified.publicOrigin+path,{method}),{
        env:unifiedEnv,fetchImpl:()=>assert.fail('bare entry must not read player auth, account or global policy'),
      });
      assert.equal(response.status,303,path);assert.equal(response.headers.get('location'),'/lobby');
      assert.equal(await response.text(),'');
    }
  }
  for(const query of ['table=room-one&operator=sg-test','dealer=amira','lane=mobile-phone',
    'presentation=local','rehearsal=1','performance=staged','motion=smooth60','launch=fixture.claim.signature',
    'launch=invalid','operator=sg-test&operator=north','labObserverChannel=invalid']){
    const route=platformRoute(new URL('/game?'+query,unified.publicOrigin),unified);
    assert.notEqual(route.destination,unified.publicOrigin+'/lobby',query);
  }
  assert.equal(backendPlatformPath('/api/operators'),true);
  for(const path of ['/api/operators/','/api/operators/private/users','/api/operators%2f','/api/operator'])assert.equal(backendPlatformPath(path),false,path);
});

test('published room login retains operator, room and dealer while the administrator portal keeps its own session',async()=>{
  const unifiedEnv={...env,CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_STUDIO_NEON_POLICY:'1'};
  const calls=[];
  const response=await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/game?game=blackjack&operator=sg-test&table=room-one&dealer=linnea'),{
    env:unifiedEnv,fetchImpl:async(url)=>{calls.push(url);return Response.json({authenticated:false});},
  });
  assert.equal(response.status,303);
  const location=new URL(response.headers.get('location'),env.CROUPIER_PUBLIC_ORIGIN);
  assert.equal(location.pathname,'/player-login');assert.equal(location.searchParams.get('operator'),'sg-test');assert.equal(location.searchParams.get('game'),'blackjack');
  assert.equal(location.searchParams.get('table'),'room-one');assert.equal(location.searchParams.get('dealer'),'linnea');
  assert.deepEqual(calls,[env.CROUPIER_BACKEND_ORIGIN+'/api/auth/session']);
});

test('an operator-only Blackjack bookmark opens that company lobby without consuming player authentication',async()=>{
  const unifiedEnv={...env,CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_STUDIO_NEON_POLICY:'1'};
  const unified=platformConfiguration(unifiedEnv);
  for(const path of ['/play/blackjack?operator=sg-test','/blackjack?operator=sg-test&utm_source=partner']){
    assert.deepEqual(platformRoute(new URL(path,unified.publicOrigin),unified),{kind:'redirect',status:308,destination:unified.publicOrigin+'/game?game=blackjack&operator=sg-test'});
  }
  for(const path of ['/game?game=blackjack&operator=sg-test','/game?operator=sg-test&utm_source=partner']){
    assert.deepEqual(platformRoute(new URL(path,unified.publicOrigin),unified),{kind:'redirect',destination:unified.publicOrigin+'/lobby?operator=sg-test'});
    const response=await platformUiDocument(new Request(unified.publicOrigin+path),{env:unifiedEnv,fetchImpl:()=>assert.fail('company lobby entry must not create a game session')});
    assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/lobby?operator=sg-test');
  }
});

test('anonymous room preview proxy has exact descriptor/media paths without a generic operator catch-all',()=>{
  const base='/api/operators/north/rooms/room-north/preview';
  assert.equal(backendPlatformPath(base),true);
  assert.deepEqual(platformRoute(new URL(base+'?dealer=johanna&revision=7',config.publicOrigin),config),
    {kind:'backend',destination:config.backendOrigin+base+'?dealer=johanna&revision=7'});
  const transport=platformBackendHeaders(new Headers({range:'bytes=0-15','if-none-match':'"preview-etag"','x-croupier-vercel-secret':'spoof'}),config);
  assert.equal(transport.get('range'),'bytes=0-15');assert.equal(transport.get('if-none-match'),'"preview-etag"');
  assert.equal(transport.get('x-croupier-vercel-secret'),config.secret);

  const media=base+'/media/7/johanna/dealer/10000000-0000-4000-8000-000000000001';
  for(const kind of ['dealer','table','background'])assert.equal(backendPlatformPath(media.replace('/dealer/','/'+kind+'/')),true);
  for(const path of [base+'/',base+'/draft',base+'/media',media+'/',media+'/private',media.replace('/7/','/0/'),media.replace('/dealer/','/speech/'),media.replace('/north/','/%6eorth/'),media.replace('/room-north/','/../')])assert.equal(backendPlatformPath(path),false,path);
});

test('shared dealer voice has only two exact transport paths and preserves untrusted context for backend validation',()=>{
  for(const path of ['/api/dealer/observation','/api/dealer/transcription']) {
    assert.equal(backendPlatformPath(path),true);
    const route=platformRoute(new URL(config.publicOrigin+path+'?dealer=vera'),config);
    assert.equal(route.kind,'backend');assert.equal(route.destination,config.backendOrigin+path+'?dealer=vera');
    for(const suffix of ['/extra','-extra'])assert.equal(backendPlatformPath(path+suffix),false);
  }
  assert.equal(backendPlatformPath('/api/dealer/%6fbservation'),false);
  const context=JSON.stringify({operatorSlug:'north',roomId:'paow-room',packageRevision:7,dealerId:'paow'});
  const headers=platformBackendHeaders({'x-dealer-presentation-context':context,'x-astrid-dealer':'paow',cookie:'fixture-player-session',origin:config.publicOrigin,'x-croupier-lab-authorized':'spoof'},config);
  assert.equal(headers.get('x-dealer-presentation-context'),context);assert.equal(headers.get('x-astrid-dealer'),'paow');
  assert.equal(headers.get('cookie'),'fixture-player-session');assert.equal(headers.get('origin'),config.publicOrigin);
  assert.equal(headers.get('x-croupier-lab-authorized'),null);assert.equal(headers.get('x-croupier-vercel-secret'),config.secret);
});

test('static redirects leave credentials and APIs to their authenticated handlers',async()=>{
 const require=createRequire(new URL('../package.json',import.meta.url));
 const {unstable_getResponseFromNextConfig,getRedirectUrl}=require('next/experimental/testing/server');
 const keys=Object.keys(env),saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 try{
  for(const native of [true,false]){
   Object.assign(process.env,env,{CROUPIER_STUDIO_NATIVE_ADMIN:native?'1':'0',CROUPIER_VERCEL_UNIFIED_UI:native?'1':'0'});
   const {default:nextConfig}=await import('../next.config.mjs?return-navigation-'+native);
   for(const path of ['/control/login?returnTo=%2Fadmin','/control/set-password?t=fixture','/api/auth/session','/api/table']){
    const response=await unstable_getResponseFromNextConfig({url:config.publicOrigin+path,nextConfig});
    assert.equal(getRedirectUrl(response),null,path);
   }
  }
 }finally{for(const [key,value]of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
