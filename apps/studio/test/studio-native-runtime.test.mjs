import { fixtureDatabaseUrl } from '../../../test/fixtures/database-url.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStudioMigrations } from '../../../ops/neon-studio/migrations.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import {execFileSync} from 'node:child_process';
import { nativeStudioAdminConfiguration, assertNativeStudioRequest, createStudioNativeRuntime, createNativeStudioRequestHandlers, handleNativeAdmin, handleNativeSession,nativeStudioErrorResponse,readAssistantDatabaseInventory } from '../lib/studio-native-runtime.mjs';
import {StudioStorageError} from '../../../packages/studio-registry/server/document-contract.mjs';
import {createStudioMemoryPool} from '../../../test/fixtures/studio-memory-pool.mjs';
import {layerBlobFixture,layerVideo} from '../../../test/fixtures/layer-media.mjs';

test('repository and app cwd reach real traced build roots and installed product SQL', () => {
  const repo = fileURLToPath(new URL('../../../', import.meta.url));
  const app = fileURLToPath(new URL('../', import.meta.url));
  const runtime = new URL('../lib/studio-native-runtime.mjs', import.meta.url).href;
  const preview = new URL('../lib/preview-files.mjs', import.meta.url).href;
  const next = new URL('../next.config.mjs', import.meta.url).href;
  const schema = new URL('../../../ops/neon-game/product-schema.sql', import.meta.url).href;
  for (const cwd of [repo, app]) execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import {readFileSync, realpathSync} from 'node:fs';
    import {dirname, join} from 'node:path';
    import {fileURLToPath} from 'node:url';
    const {createStudioNativeRuntime} = await import(${JSON.stringify(runtime)});
    const {previewBuildDirectory} = await import(${JSON.stringify(preview)});
    const {default: config} = await import(${JSON.stringify(next)});
    assert.equal(realpathSync(config.outputFileTracingRoot), realpathSync(${JSON.stringify(repo)}));
    assert.equal(realpathSync(join(dirname(previewBuildDirectory), 'next.config.mjs')),
      realpathSync(fileURLToPath(${JSON.stringify(next)})));
    const expected = readFileSync(new URL(${JSON.stringify(schema)}), 'utf8');
    assert.match(expected, /CREATE SCHEMA IF NOT EXISTS croupier_game/);
    let received, closed = 0;
    const injected = {end: async () => { closed++; }};
    await assert.rejects(createStudioNativeRuntime({connectionString:'injected', scope:{environment:'fixture',workspaceId:'croupier'}}, {
      env: {}, poolFactory: async connection => { assert.equal(connection,'injected'); return injected; },
      storeFactory: ({pool}) => { assert.equal(pool,injected); return {db:{assertInstalled: async ({source}) => { received=source; throw Error('isolated_stop_before_query'); }}}; },
    }), error => error.statusCode === 503);
    assert.equal(received, expected); assert.equal(closed, 1);
  `], {cwd, stdio:'pipe', timeout:10000});
});

test('unsupported media format returns its fixed typed 415 without database details',async()=>{
  const error=new StudioStorageError('studio_media_content_type_unsupported',415);error.detail='private-db-detail';
  const response=nativeStudioErrorResponse(error),body=await response.json();
  assert.equal(response.status,415);assert.equal(body.code,'studio_media_content_type_unsupported');assert.match(body.error,/MP4 och WebM/);
  assert.equal(JSON.stringify(body).includes('private-db-detail'),false);assert.equal(response.headers.get('cache-control'),'private, no-store');
});

const env = { CROUPIER_STUDIO_NATIVE_ADMIN: '1', CROUPIER_PUBLIC_ORIGIN: 'https://public.example.invalid',
  CROUPIER_STUDIO_NEON_POLICY: '1',
  CROUPIER_LAB_UI_ORIGIN: 'https://studio.example.invalid', CROUPIER_LAB_BASE_PATH: '/studio',
  CROUPIER_STUDIO_ENVIRONMENT_ID: 'fixture', CROUPIER_STUDIO_WORKSPACE_ID: 'croupier',
  CROUPIER_GAME_DATABASE_URL: fixtureDatabaseUrl('postgres://fixture.neon.tech/fixture?sslmode=require', 'fixture') };

test('native runtime binds byte inspection to its own environment and preserves caller cancellation',async t=>{
  const blob=await layerBlobFixture(cleanup=>t.after(cleanup),layerVideo(),'video/mp4');
  const nativeEnv={...env,...blob.options.env,CROUPIER_BACKEND_ORIGIN:'https://engine.example.invalid',CROUPIER_VERCEL_INGRESS_SECRET:'fixture-ingress-'.repeat(4)};
  const pool={...createStudioMemoryPool(),query:async()=>{throw Error('unexpected initialization query');},end:async()=>{}},empty=()=>({handlers:new Map(),gates:new Map()});
  const boDb={prepare:()=>({get:async()=>({v:'ab'.repeat(32)})}),transaction:work=>work()};
  const native=await createStudioNativeRuntime(nativeStudioAdminConfiguration(nativeEnv),{
    env:nativeEnv,poolFactory:async()=>pool,storeFactory:()=>({db:{assertInstalled:async()=>{}},boDb}),schemaCheck:async()=>{},
    authFactory:()=>async()=>({user:'fixture-admin',role:'admin',scope:{environment:'fixture',workspaceId:'croupier'}}),
    dataFactory:empty,accountsFactory:empty,authActionsFactory:()=>({handle:async()=>new Response(null),availableActions:[]}),
    policyFactory:()=>({readSaved:async()=>({project:{}}),canAssignDealer:async()=>true,readGameConfiguration:async()=>({gameLanes:[]})}),
    fetchImpl:()=>{throw Error('unexpected runtime request');},
  });
  const id='10000000-0000-4000-8000-000000000001',record={id,provider:'vercel-blob',pathname:`croupier/videos/${id}/${blob.sha256}.mp4`,sha256:blob.sha256,size:blob.size,contentType:blob.contentType};
  const measured=await native.inspectMediaTiming(record,{...blob.options,env:{}});
  assert.equal(measured.mediaId,id);assert.equal(measured.sha256,blob.sha256);assert.equal(measured.endUs,1000000);
  assert.equal(measured.recordedSpeechIdentitySha256,null);
  const controller=new AbortController();controller.abort();
  await assert.rejects(native.inspectMediaTiming(record,{...blob.options,signal:controller.signal}),error=>error.statusCode===408);
});

test('assistant inventory reads only table names in the actual game, auth and Studio schemas', async () => {
  const schemas = ['../../../ops/neon-game/product-schema.sql','../../../ops/neon-studio/001-studio-metadata.sql']
    .flatMap(path => [...readFileSync(new URL(path, import.meta.url),'utf8').matchAll(/CREATE SCHEMA (?:IF NOT EXISTS )?(\w+);/g)].map(match=>match[1])).sort();
  assert.deepEqual(schemas,['croupier_auth','croupier_game','croupier_studio']);
  let calls=0;
  const pool={async query(sql,...parameters) {
    calls++;assert.equal(parameters.length,0);
    assert.match(sql,/^SELECT table_schema, table_name FROM information_schema\.tables WHERE table_schema IN \(/);
    const allowed=[...sql.matchAll(/'(croupier_\w+)'/g)].map(match=>match[1]).sort();
    assert.deepEqual(allowed,schemas);assert.match(sql,/AND table_type='BASE TABLE' ORDER BY table_schema, table_name LIMIT 501$/);
    assert.doesNotMatch(sql,/CALLER_SQL|public|SELECT \*/);
    return {rows:schemas.map(schema=>({table_schema:schema,table_name:'fixture_table',privateRow:'PRIVATE'}))};
  }};
  const inventory=await readAssistantDatabaseInventory(pool,{sql:'CALLER_SQL',schema:'public'});
  assert.equal(calls,1);assert.equal(inventory.partial,false);
  assert.deepEqual(inventory.tables,schemas.map(schema=>({schema,name:'fixture_table'})));
  assert.doesNotMatch(JSON.stringify(inventory),/PRIVATE|privateRow/);
});

test('assistant table inventory bounds returned metadata and reports truncation', async () => {
  const rows=Array.from({length:501},(_,i)=>({table_schema:'croupier_studio',table_name:`fixture_${i}`}));
  const inventory=await readAssistantDatabaseInventory({query:async()=>({rows})});
  assert.equal(inventory.tables.length,500);assert.equal(inventory.partial,true);
});
test('native mode is explicit, scoped and never substitutes zone/general database', () => {
  assert.equal(nativeStudioAdminConfiguration({}), null);
  const config = nativeStudioAdminConfiguration(env);
  assert.deepEqual(config.scope, { environment: 'fixture', workspaceId: 'croupier' });
  for (const change of [{ CROUPIER_GAME_DATABASE_URL: undefined }, { CROUPIER_STUDIO_ENVIRONMENT_ID: undefined },
    { CROUPIER_STUDIO_NEON_POLICY: undefined },
    { CROUPIER_STUDIO_WORKSPACE_ID: undefined }, { CROUPIER_ZONES_DATABASE_URL: env.CROUPIER_GAME_DATABASE_URL },
    { CROUPIER_PUBLIC_ORIGIN: 'http://public.example.invalid' }, { CROUPIER_LAB_UI_ORIGIN: env.CROUPIER_PUBLIC_ORIGIN }]) {
    assert.throws(() => nativeStudioAdminConfiguration({ ...env, ...change }), error => error.statusCode === 503);
  }
});
test('explicit unified UI trusts only its public origin without a secondary alias', () => {
  for (const secondary of [undefined, env.CROUPIER_PUBLIC_ORIGIN, env.CROUPIER_LAB_UI_ORIGIN, 'invalid-unused-alias']) {
    const config = nativeStudioAdminConfiguration({ ...env, CROUPIER_VERCEL_UNIFIED_UI: '1', CROUPIER_LAB_UI_ORIGIN: secondary });
    assert.equal(config.unifiedUi, true);
    assert.deepEqual(config.allowedOrigins, [env.CROUPIER_PUBLIC_ORIGIN]);
    assert.deepEqual(config.publicHosts, [new URL(env.CROUPIER_PUBLIC_ORIGIN).host]);
    assert.doesNotThrow(() => assertNativeStudioRequest(new Request(env.CROUPIER_PUBLIC_ORIGIN + '/studio/api/auth/session'), config));
    assert.throws(() => assertNativeStudioRequest(new Request(env.CROUPIER_LAB_UI_ORIGIN + '/studio/api/auth/session'), config), error => error.statusCode === 403);
  }
  for (const value of [undefined, '0', 'true']) {
    assert.throws(() => nativeStudioAdminConfiguration({ ...env, CROUPIER_VERCEL_UNIFIED_UI: value, CROUPIER_LAB_UI_ORIGIN: undefined }), error => error.statusCode === 503);
  }
});
test('unified UI retains exact HTTPS, scope, Neon and policy requirements', () => {
  for (const change of [
    ...['http://public.example.invalid', 'https://localhost', 'https://127.0.0.1', 'https://[::1]',
      'https://public.example.invalid/', 'https://user@public.example.invalid'].map(value => ({ CROUPIER_PUBLIC_ORIGIN: value })),
    { CROUPIER_STUDIO_ENVIRONMENT_ID: undefined }, { CROUPIER_STUDIO_WORKSPACE_ID: undefined },
    { CROUPIER_STUDIO_NEON_POLICY: undefined }, { CROUPIER_GAME_DATABASE_URL: undefined },
    { CROUPIER_ZONES_DATABASE_URL: env.CROUPIER_GAME_DATABASE_URL }, { CROUPIER_LAB_BASE_PATH: '/unexpected' },
  ]) {
    assert.throws(() => nativeStudioAdminConfiguration({ ...env, CROUPIER_VERCEL_UNIFIED_UI: '1', CROUPIER_LAB_UI_ORIGIN: undefined, ...change }), error => error.statusCode === 503);
  }
});
test('exact trusted request host/origin before DB initialization', () => {
  const config = nativeStudioAdminConfiguration(env);
  assert.doesNotThrow(() => assertNativeStudioRequest(new Request(`${env.CROUPIER_PUBLIC_ORIGIN}/studio/api/auth/session`), config));
  for (const headers of [{ origin: 'https://evil.invalid' }, { host: 'evil.invalid' }, { 'x-forwarded-host': 'evil.invalid' }, { 'sec-fetch-site': 'cross-site' }, { 'next-action': 'anything' }]) {
    assert.throws(() => assertNativeStudioRequest(new Request(`${env.CROUPIER_PUBLIC_ORIGIN}/studio/api/auth/session`, { headers }), config), error => error.statusCode === 403);
  }
});
test('factory asserts installed schema; DB failure closes pool and never constructs a disk fallback', async () => {
  let closed = 0, constructed = 0;
  const config = nativeStudioAdminConfiguration(env);
  await assert.rejects(createStudioNativeRuntime(config, {
    poolFactory: async () => ({ end: async () => closed++ }),
    storeFactory: () => ({ db: { assertInstalled: async () => { throw Error('PRIVATE'); } } }),
    repositoryFactory: () => { constructed++; },
  }), error => error.statusCode === 503 && !error.message.includes('PRIVATE'));
  assert.equal(closed, 1); assert.equal(constructed, 0);
});
test('disabled active route does not instantiate DB or acknowledge a mutation', async () => {
  const previous = process.env.CROUPIER_STUDIO_NATIVE_ADMIN;
  delete process.env.CROUPIER_STUDIO_NATIVE_ADMIN;
  try {
    const response = await handleNativeAdmin(new Request(`${env.CROUPIER_PUBLIC_ORIGIN}/studio/api/admin/room`, { method: 'POST' }));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  } finally {
    if (previous === undefined) delete process.env.CROUPIER_STUDIO_NATIVE_ADMIN; else process.env.CROUPIER_STUDIO_NATIVE_ADMIN = previous;
  }
});
test('bundled source paths load all reviewed migrations without asset URLs', async () => {
  const directory = resolve(fileURLToPath(new URL('../../../ops/neon-studio/', import.meta.url)));
  const expected = await loadStudioMigrations();
  const actual = await loadStudioMigrations({ directory });
  assert.deepEqual(actual.map(row => row.checksum), expected.map(row => row.checksum));
  assert.equal(actual.filter(row => !row.deploymentOptional).at(-1).file, '017-moving-budget-capacity.sql');
  assert.deepEqual(actual.filter(row => row.deploymentOptional).map(row => row.version), ['016', '018', '019', '020']);
  await assert.rejects(loadStudioMigrations({ directory: '../relative' }));
});

const sessionRequest = (method = 'GET', headers = {}) => new Request(`${env.CROUPIER_PUBLIC_ORIGIN}/studio/api/auth/session`, {method, headers});
const adminRequest = headers => new Request(`${env.CROUPIER_PUBLIC_ORIGIN}/studio/api/admin/room`, {headers});
function timing(response, phase) {
  const value = response.headers.get('server-timing');
  assert.match(value, new RegExp(`^studio_runtime;dur=([0-9]+\\.[0-9]{2}), ${phase};dur=([0-9]+\\.[0-9]{2})$`));
  const durations = value.split(', ').map(item => Number(item.split('=')[1]));
  assert.ok(durations.every(value => Number.isFinite(value) && value >= 0));
  return durations;
}

test('native admin times awaited runtime and API separately while preserving response and ignoring request timing inputs', async () => {
  let time = 0, runtimeCalls = 0, apiCalls = 0;
  const handlers = createNativeStudioRequestHandlers({configuration: () => nativeStudioAdminConfiguration(env), clock: () => time,
    runtime: async () => { runtimeCalls++; await Promise.resolve(); time += 37.125; return {
      api: {handle: async request => {
        apiCalls++; assert.equal(new URL(request.url).pathname, '/studio/api/admin/room');
        await Promise.resolve(); time += 81.375;
        return Response.json({fixture: true}, {status: 201, headers: {'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff', 'Set-Cookie': 'fixture=opaque; HttpOnly; Secure'}});
      }},
    }; },
  });
  const response = await handlers.handleNativeAdmin(adminRequest({'Server-Timing': 'PRIVATE;dur=Infinity',
    'x-studio-runtime-ms': '-1', 'x-studio-api-ms': 'PRIVATE'}));
  assert.deepEqual(timing(response, 'studio_api'), [37.13, 81.38]);
  assert.equal(runtimeCalls, 1); assert.equal(apiCalls, 1);
  assert.equal(response.status, 201); assert.deepEqual(await response.json(), {fixture: true});
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('set-cookie'), 'fixture=opaque; HttpOnly; Secure');
  assert.ok(!response.headers.get('server-timing').includes('PRIVATE'));
  assert.equal(handleNativeAdmin.length, 1); assert.equal(handleNativeSession.length, 1);
});

test('session timing measures fresh authorize on every request, including safe 401/403 responses', async () => {
  let time = 0, authorizations = 0;
  const handlers = createNativeStudioRequestHandlers({configuration: () => nativeStudioAdminConfiguration(env), clock: () => time,
    runtime: async () => {await Promise.resolve(); time += 4; return {
      authorize: async () => {
        authorizations++; await Promise.resolve(); time += 19;
        if (authorizations > 1) throw Object.assign(Error('PRIVATE user/token/SQL'), {statusCode: authorizations === 2 ? 401 : 403});
        return {user: 'fixture-user', role: 'admin'};
      }, api: {availableActions: () => ['room.read']},
    }; },
  });
  for (const [status, body] of [[200, {username: 'fixture-user', role: 'admin', availableActions: ['room.read'], gameOrigin: env.CROUPIER_PUBLIC_ORIGIN}],
    [401, {error: 'studio_login_required'}], [403, {error: 'studio_request_rejected'}]]) {
    const response = await handlers.handleNativeSession(sessionRequest());
    assert.equal(response.status, status); assert.deepEqual(timing(response, 'studio_auth'), [4, 19]);
    assert.deepEqual(await response.json(), body);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(!response.headers.get('server-timing').includes('fixture-user'));
  }
  assert.equal(authorizations, 3);
});

test('runtime and API rejections retain their elapsed stage and sanitized error response', async () => {
  for (const failingStage of ['runtime', 'api']) {
    let time = 0, apiCalls = 0;
    const handlers = createNativeStudioRequestHandlers({configuration: () => nativeStudioAdminConfiguration(env), clock: () => time,
      runtime: async () => {
        await Promise.resolve(); time += 13;
        if (failingStage === 'runtime') throw Error('PRIVATE connection string');
        return {api: {handle: async () => {apiCalls++; await Promise.resolve(); time += 29; throw Error('PRIVATE SQL query');}}};
      },
    });
    const response = await handlers.handleNativeAdmin(adminRequest());
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), {error: 'studio_native_unavailable'});
    assert.deepEqual(timing(response, 'studio_api'), failingStage === 'runtime' ? [13, 0] : [13, 29]);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(apiCalls, failingStage === 'runtime' ? 0 : 1);
  }
});

test('Origin denial and session method rejection still precede runtime initialization', async () => {
  const handlers = createNativeStudioRequestHandlers({configuration: () => nativeStudioAdminConfiguration(env),
    runtime: async () => assert.fail('rejected request must not initialize runtime')});
  for (const kind of ['Admin', 'Session']) {
    const response = await handlers[`handleNative${kind}`](kind === 'Admin'
      ? adminRequest({Origin: 'https://evil.invalid'}) : sessionRequest('GET', {Origin: 'https://evil.invalid'}));
    assert.equal(response.status, 403); assert.deepEqual(await response.json(), {error: 'studio_request_rejected'});
    assert.deepEqual(timing(response, kind === 'Admin' ? 'studio_api' : 'studio_auth'), [0, 0]);
  }
  const response = await handlers.handleNativeSession(sessionRequest('POST'));
  assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET');
  assert.equal(await response.text(), ''); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(timing(response, 'studio_auth'), [0, 0]);
});

test('timing durations remain finite and nonnegative for invalid or backward trusted clocks', async () => {
  for (const readings of [[20, 10, 40, 30], [NaN, Infinity, -Infinity, NaN], [0, Number.MAX_VALUE, 0, Number.MAX_VALUE]]) {
    const handlers = createNativeStudioRequestHandlers({configuration: () => nativeStudioAdminConfiguration(env), clock: () => readings.shift(),
      runtime: async () => ({api: {handle: async () => Response.json({fixture: true})}})});
    const response = await handlers.handleNativeAdmin(adminRequest());
    assert.equal(response.status, 200); timing(response, 'studio_api');
  }
});
