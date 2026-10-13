import {createStudioMediaDeletion} from './studio-media-deletion.mjs';
import {STUDIO_MEDIA_TYPE_UNSUPPORTED,STUDIO_MEDIA_TYPE_MESSAGE} from '../../web/storage/studio-media-storage.mjs';
import {createHmac} from 'node:crypto';
import { createLayerUploadService } from './layer-upload-service.mjs';
import { wrapNativePresentationRepository, PRESENTATION_RUNTIME_UPDATE_REQUIRED, PRESENTATION_RUNTIME_UPDATE_MESSAGE } from './presentation-runtime-readiness.mjs';
import { createPostgresStore, validateGameConnection } from '../../web/storage/postgres-store.mjs';
import { createStudioRepository } from '../../web/storage/studio-repository.mjs';
import { planStudioMigrations } from '../../ops/neon-studio/migrations.mjs';
import { validateStudioScope } from '../../web/storage/studio-contract.mjs';
import { createStudioNativeAuth } from '../../packages/studio-access/studio-native-auth.mjs';
import { createStudioAdminApi } from './studio-admin-api.mjs';
import { createStudioAdminData } from './studio-admin-data.mjs';
import { createStudioGamePolicy, studioGamePolicyConfiguration } from '../../web/storage/studio-game-policy.mjs';
import { createRegisteredDealerIdle } from '../../web/storage/studio-runtime.mjs';
import { resolveMediaPath } from '../../tools/media-layout.mjs';
import { createRuntimeMetadataReader } from '../../tools/runtime-media-catalog.mjs';
import { createStudioAdminAccounts } from './studio-admin-accounts.mjs';
import { createStudioAdminReadouts } from './studio-admin-readouts.mjs';
import { createRegisteredVoiceLines } from './studio-voice-lines.mjs';
import { createStudioNativeAuthActions, createStudioLoginRateLimit } from './studio-native-auth-actions.mjs';
import { createStudioGameAuthority } from './studio-game-authority.mjs';
import { createStudioMediaRuntime, createStudioPublicMediaAvailability } from './studio-media-runtime.mjs';
import { createStudioUploadService } from './studio-upload-service.mjs';
import { normalizeNativeStudioRequest } from './studio-native-request.mjs';
import { createNativeStudioMail } from './studio-native-mail.mjs';
import { createPresentationRoomApi, PRESENTATION_ROOM_MUTATION } from './presentation-room-api.mjs';
import { presentationCapabilitiesForVersion } from '../../web/presentation-capability-contract.mjs';
import { isStudioRepliesReadQuery } from './studio-replies-query.mjs';
import { isPresentationRoomReadQuery } from './studio-admin-contract.mjs';
import { createOperatorPackageApi } from './operator-package-api.mjs';
import { createDesignCatalogReader } from './design-preview-catalog.mjs';
import { createOperatorAdminApi } from './operator-admin-api.mjs';
import { createResourceLifecycleApi } from './resource-lifecycle-api.mjs';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const unavailable = () => { throw Object.assign(new Error('studio_native_unavailable'), { statusCode: 503 }); };
const denied = () => { throw Object.assign(new Error('studio_request_rejected'), { statusCode: 403 }); };
// SQL is bundled source, not persistent user state. Explicit tracing preserves
// it outside the Lab project; no webpack asset URL is passed to Node fs.
const schemaRoot = () => resolve(process.cwd(), basename(process.cwd()) === 'lab' ? '..' : '.', 'ops');
export const nativeStudioAdminEnabled = (env = process.env) => env.CROUPIER_STUDIO_NATIVE_ADMIN === '1';

export function nativeStudioAdminConfiguration(env = process.env) {
  if (!nativeStudioAdminEnabled(env)) return null;
  if (!studioGamePolicyConfiguration(env)) unavailable();
  const origins = [env.CROUPIER_PUBLIC_ORIGIN, env.CROUPIER_LAB_UI_ORIGIN];
  for (const value of origins) {
    let url; try { url = new URL(value); } catch { unavailable(); }
    if (url.origin !== value || url.protocol !== 'https:' || url.username || url.password
      || ['localhost','127.0.0.1','[::1]'].includes(url.hostname)) unavailable();
  }
  if (new Set(origins).size !== 2 || !['', '/studio'].includes(env.CROUPIER_LAB_BASE_PATH || '')) unavailable();
  let scope, connectionString;
  try {
    scope = validateStudioScope({ environment: env.CROUPIER_STUDIO_ENVIRONMENT_ID, workspaceId: env.CROUPIER_STUDIO_WORKSPACE_ID });
    connectionString = validateGameConnection(env.CROUPIER_GAME_DATABASE_URL, env.CROUPIER_ZONES_DATABASE_URL);
  } catch { unavailable(); }
  if (!new URL(connectionString).hostname.endsWith('.neon.tech')) unavailable();
  return Object.freeze({ scope, connectionString, allowedOrigins: origins,
    publicHosts: origins.map(origin => new URL(origin).host),
    apiBase: env.CROUPIER_LAB_BASE_PATH === '/studio' ? '/studio/api/admin' : '/api/admin',
    authBase: env.CROUPIER_LAB_BASE_PATH === '/studio' ? '/studio/api/auth' : '/api/auth' });
}

export function assertNativeStudioRequest(request, config) {
  if (!config) unavailable();
  request = normalizeNativeStudioRequest(request, config);
  const url = new URL(request.url);
  if (!config.allowedOrigins.includes(url.origin) || !config.publicHosts.includes(url.host)
    || url.username || url.password || url.pathname.includes('%') || url.search && !isPresentationRoomReadQuery(request.method, url) && !isStudioRepliesReadQuery(request.method, url) || url.hash) denied();
  for (const header of ['host','x-forwarded-host']) {
    const host = request.headers.get(header); if (host !== null && host !== url.host) denied();
  }
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site'
    || request.headers.has('next-action')) denied();
}

// Fixed schema inventory only. No caller SQL, credentials, row contents,
// player IDs, card order or balances cross this capability.
export async function readAssistantDatabaseInventory(pool) {
  const result = await pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('croupier_game','croupier_auth','croupier_studio') AND table_type='BASE TABLE' ORDER BY table_schema, table_name LIMIT 501");
  return { source:'connected-neon-game-and-studio', partial:result.rows.length>500,
    tables:result.rows.slice(0,500).map(row=>({schema:row.table_schema,name:row.table_name})) };
}

// Lazy initialization: importing/building does not connect, migrate, bootstrap
// identities, read old disk state, or silently change the active writer.
export async function createStudioNativeRuntime(config, { poolFactory, storeFactory = createPostgresStore,
  schemaCheck = async pool => {
    const plan = await planStudioMigrations({ pool, directory: resolve(schemaRoot(), 'neon-studio') });
    // 008 (Dealer Forge) is deployment-optional: the runtime starts before and after it is applied.
    if (plan.toApply.length || plan.applied.map(row => row.version).join(',') !== '001,002,003,004,005,006,007,008') unavailable();
  },
  repositoryFactory = createStudioRepository, authFactory = createStudioNativeAuth, dataFactory = createStudioAdminData,
  policyFactory = createStudioGamePolicy, accountsFactory = createStudioAdminAccounts, authActionsFactory = createStudioNativeAuthActions,
  env = process.env, fetchImpl = fetch,
} = {}) {
  if (!config) unavailable();
  poolFactory ??= async connectionString => {
    const { Pool } = await import('@neondatabase/serverless');
    return new Pool({ connectionString, max: 4, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 15_000 });
  };
  const pool = await poolFactory(config.connectionString);
  try {
    const store = storeFactory({ pool });
    await store.db.assertInstalled({ source: await readFile(resolve(schemaRoot(), 'neon-game/product-schema.sql'), 'utf8') });
    await schemaCheck(pool);
    const repository = wrapNativePresentationRepository(repositoryFactory({ pool, scope: config.scope }), { env, fetchImpl });
    const mutationTransaction = async (work, options = {}) => {
      const descriptors = options.presentationMutation === undefined ? [] : structuredClone(Array.isArray(options.presentationMutation) ? options.presentationMutation : [options.presentationMutation]);
      const documents = [...(options.presentationDocuments ?? [])];
      for (const kind of documents) {
        if (!['project','administration'].includes(kind)) unavailable();
        const saved = await repository.readDocument(kind);
        if (!saved) unavailable();
        descriptors.push({kind,value:saved.value});
      }
      return repository.withMutationContext(() => store.boDb.transaction(work), descriptors);
    };
    const repositoryRoot = resolve(schemaRoot(), '..');
    const media = createStudioMediaRuntime({ repository, scope: config.scope, env, repositoryRoot });
    const dealerIdle = createRegisteredDealerIdle({registryLoader:media.videoRegistry});
    const gamePolicy = policyFactory({ repository, scope: config.scope, dealerIdle });
    await gamePolicy.readSaved();
    const mediaDeletion=createStudioMediaDeletion({repository,mutationTransaction,env,options:{repositoryRoot}});
    const signer = await store.boDb.prepare("SELECT v FROM meta WHERE k='jwt_secret'").get();
    if (!/^[a-f0-9]{64}$/i.test(signer?.v || '')) unavailable();
    // Stable across instances sharing the native account store. Scope and a
    // fixed domain keep receipts separate from login JWTs and upload tickets.
    const speechReceiptKey=createHmac('sha256',Buffer.from(signer.v,'hex'))
      .update('croupier:studio-speech-build:receipt:v1\0')
      .update(config.scope.environment+'\0'+config.scope.workspaceId).digest();
    const uploads = createStudioUploadService({ repository, scope: config.scope, ticketKey: Buffer.from(signer.v, 'hex'), env });
    const layerUploads = createLayerUploadService({repository,scope:config.scope,ticketKey:Buffer.from(signer.v,'hex'),env});
    const authorize = authFactory({ boDb: store.boDb, scope: config.scope });
    const { handlers, gates } = dataFactory({ db: store.db, boDb: store.boDb, repository, scope: config.scope,
      gamePolicy, canAssignDealer: gamePolicy.canAssignDealer,voiceLines:createRegisteredVoiceLines({env,repositoryRoot}) });
    for(const [key,handler] of createStudioAdminReadouts({db:store.db,scope:config.scope}).handlers) {
      if(handlers.has(key))unavailable();handlers.set(key,handler);
    }
    const gameAuthority = createStudioGameAuthority({ env, scope: config.scope });
    const mail = createNativeStudioMail({ env });
    const accounts = accountsFactory({ boDb: store.boDb, gameDb: store.db, scope: config.scope, gameAuthority, mail, publicOrigin: env.CROUPIER_PUBLIC_ORIGIN });
    for (const [key, handler] of accounts.handlers) { if (handlers.has(key)) unavailable(); handlers.set(key, handler); }
    for (const [key, gate] of accounts.gates) gates.set(key, gate);
    const authActions = authActionsFactory({ boDb: store.boDb, gameDb: store.db, scope: config.scope, authorize, mail,
      publicOrigin: env.CROUPIER_PUBLIC_ORIGIN, allowedOrigins: config.allowedOrigins, authBase: config.authBase,
      rateLimit: createStudioLoginRateLimit({ boDb: store.boDb }),
      // Use Vercel's trusted connection header only; caller-supplied forwarded
      // chains cannot create unlimited login-rate buckets.
      clientAddress: request => request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'shared-unknown' });
    const videoRegistry = Object.freeze({ loadCaptured: media.videoRegistryCaptured, verifyCapturedMedia: media.verifyCapturedMedia });
    const preparations = new Map();
    const lanePackages = createOperatorPackageApi({
      pool, repository, videoRegistry, scope: config.scope,
      project: async () => (await gamePolicy.readSaved()).project,
      gameLanes: async () => (await gamePolicy.readGameConfiguration()).gameLanes,
    });
    for (const [key, handler] of lanePackages.handlers) { if (handlers.has(key)) unavailable(); handlers.set(key, handler); }
    const rooms = createPresentationRoomApi({ repository, videoRegistry, scope: config.scope,
      // Verify the negotiated format before reporting readiness. This metadata
      // never substitutes for the saved dealer registry or frozen media record.
      runtimeCapabilities: (presentation,game='blackjack') => repository.withMutationContext(async () => presentationCapabilitiesForVersion(presentation?.registeredDealers?.some(row=>row.rouletteStart||row.rouletteIdle)?15:game==='roulette'?9:presentation?.schemaVersion === 3 ? 4 : presentation?.schemaVersion === 2 ? 3 : 2),
        [game==='roulette'?{kind:'administration',value:{rooms:[{schemaVersion:2,game:'roulette'}]}}:PRESENTATION_ROOM_MUTATION, ...(presentation ? [{ kind: 'presentation-package', value: presentation }] : [])]),
    });
    for (const service of [lanePackages, rooms]) {
      for (const [key, prepare] of service.preparations ?? []) { if (preparations.has(key)) unavailable(); preparations.set(key, prepare); }
    }
    for (const [key, handler] of rooms.handlers) { if (handlers.has(key)) unavailable(); handlers.set(key, handler); }
    const operatorAdmin = createOperatorAdminApi({
      pool, boDb: store.boDb, gameDb: store.db, scope: config.scope, mail, publicOrigin: env.CROUPIER_PUBLIC_ORIGIN,
    });
    for (const [key, handler] of operatorAdmin.handlers) { if (handlers.has(key)) unavailable(); handlers.set(key, handler); }
    for (const [key, handler] of createResourceLifecycleApi({ repository, scope: config.scope }).handlers) {
      if (handlers.has(key)) unavailable(); handlers.set(key, handler);
    }
    const api = createStudioAdminApi({ authorize, handlers, gates, preparations, allowedOrigins: config.allowedOrigins,
      publicHosts: config.publicHosts, apiBase: config.apiBase, mutationTransaction });
    const native={ api, authorize, config, repository, gamePolicy, authActions, uploads, layerUploads, mediaDeletion,
      readDesignCatalog: createDesignCatalogReader({ pool, scope: config.scope, policy: gamePolicy }),
      listLaneOperators: lanePackages.listOperators,
      listOperatorDirectory: operatorAdmin.listOperatorDirectory,
      mutationTransaction, ...media,
      assistantDatabaseInventory: () => readAssistantDatabaseInventory(pool),
    };
    // Server-only capability: non-enumerable and copy-on-read. No endpoint
    // serializes this key, and a caller cannot mutate another handler's copy.
    Object.defineProperty(native,'speechReceiptKey',{get:()=>Buffer.from(speechReceiptKey)});
    return Object.freeze(native);
  } catch {
    try { await pool.end(); } catch { /* Preserve safe initialization failure. */ }
    unavailable();
  }
}

export async function handleNativeAuthAction(request) {
  try {
    const config = nativeStudioAdminConfiguration(); request = normalizeNativeStudioRequest(request, config); assertNativeStudioRequest(request, config);
    return (await studioNativeRuntime()).authActions.handle(request);
  } catch (error) { return nativeStudioErrorResponse(error); }
}

let runtimePromise;
export async function studioNativeRuntime() {
  const config = nativeStudioAdminConfiguration();
  if (!config) unavailable();
  runtimePromise ??= createStudioNativeRuntime(config).catch(error => { runtimePromise = undefined; throw error; });
  return runtimePromise;
}
export function nativeStudioErrorResponse(error) {
  const status = [400,401,403,404,405,409,413,415,422,423,503].includes(error?.statusCode) ? error.statusCode : 503;
  const readiness = status === 503 && error?.code === PRESENTATION_RUNTIME_UPDATE_REQUIRED;
  const lifecycleCodes=new Set(['studio_dealer_background_required','studio_conflict','studio_dealer_not_registered','studio_dealer_base_protected','studio_dealer_missing','studio_dealer_in_use','studio_dealer_published',
    'studio_dealer_delete_pending','studio_dealer_speech_enabled','studio_dealer_restore_conflict','studio_dealer_archived','studio_dealer_lifecycle_required',
    'studio_media_delete_coverage_incomplete','studio_media_upload_grant_active','studio_media_owned_elsewhere','studio_media_delete_failed','studio_media_already_deleted','studio_media_deletion_pending','studio_media_archive_required','studio_media_published','studio_retained_media_immutable']);
  const body = status===415&&error?.code===STUDIO_MEDIA_TYPE_UNSUPPORTED ? {error:STUDIO_MEDIA_TYPE_MESSAGE,code:STUDIO_MEDIA_TYPE_UNSUPPORTED} : lifecycleCodes.has(error?.code) ? {error:error.code,code:error.code} : readiness ? { error: PRESENTATION_RUNTIME_UPDATE_MESSAGE,
    code: PRESENTATION_RUNTIME_UPDATE_REQUIRED }
    : { error: status === 409 && error?.code === 'studio_media_in_use' ? 'studio_media_in_use' : status === 401 ? 'studio_login_required' : status === 403 ? 'studio_request_rejected' : 'studio_native_unavailable' };
  return Response.json(body,
    { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}

// Test dependencies are trusted server-side functions, never request metadata.
// Keep Next's exported route handlers below as one-argument functions.
export function createNativeStudioRequestHandlers({ configuration = nativeStudioAdminConfiguration,
  runtime = studioNativeRuntime, clock = () => performance.now() } = {}) {
  async function handle(request, phase, work) {
    const times = { studio_runtime: 0, [phase]: 0 };
    const measure = async (name, action) => {
      const start = clock();
      try { return await action(); }
      finally {
        const elapsed = clock() - start;
        times[name] = Number.isFinite(elapsed) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, elapsed)) : 0;
      }
    };
    let response;
    try {
      const config = configuration(); request = normalizeNativeStudioRequest(request, config); assertNativeStudioRequest(request, config);
      response = await work(request, config, measure);
    } catch (error) { response = nativeStudioErrorResponse(error); }
    const headers = new Headers(response.headers);
    // Constant phase names and finite nonnegative milliseconds only. Preserve
    // response body, status, cookies and cache/security headers without reading it.
    headers.set('Server-Timing', `studio_runtime;dur=${times.studio_runtime.toFixed(2)}, ${phase};dur=${times[phase].toFixed(2)}`);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  return Object.freeze({
    handleNativeAdmin: request => handle(request, 'studio_api', async (current, _config, measure) => {
      const native = await measure('studio_runtime', runtime);
      return measure('studio_api', () => native.api.handle(current));
    }),
    handleNativeSession: request => handle(request, 'studio_auth', async (current, config, measure) => {
      if (current.method !== 'GET' || new URL(current.url).pathname !== `${config.authBase}/session`) {
        return new Response(null, { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'private, no-store' } });
      }
      const native = await measure('studio_runtime', runtime);
      return measure('studio_auth', async () => {
        const session = await native.authorize(current);
        return Response.json({ username: session.user, role: session.role, availableActions: native.api.availableActions(session), gameOrigin: config.allowedOrigins[0] },
          { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
      });
    }),
  });
}
const nativeRequestHandlers = createNativeStudioRequestHandlers();
export async function handleNativeAdmin(request) { return nativeRequestHandlers.handleNativeAdmin(request); }
export async function handleNativeSession(request) { return nativeRequestHandlers.handleNativeSession(request); }
