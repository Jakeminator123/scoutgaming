import { validateStudioScope } from '../../packages/studio-access/studio-scope.mjs';

// In-process startup only: no HTTP route, environment switch, reset, pool creation
// or SQL write. The separate owned-QA launcher supplies the real app adapters.
let state = 'unregistered', pending, pendingPool;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const needed = (value, code) => { if (!value) fail(code); };
const port = value => Number.isInteger(value) && value >= 1024 && value <= 65535;
const qaName = value => typeof value === 'string' && /^croupier_qa_[a-z0-9_]{1,42}$/.test(value);
const provider = /^(?:VERCEL(?:_|$)|RENDER(?:_|$)|RAILWAY_|FLY_|DYNO$|HEROKU_|NETLIFY(?:_|$)|CF_PAGES(?:_|$)|AWS_(?:LAMBDA|EXECUTION_ENV)|K_SERVICE$|K_REVISION$|GOOGLE_CLOUD_PROJECT$|GCP_PROJECT$|WEBSITE_INSTANCE_ID$)/;
const cloud = /^(?:BLOB_|NEON_|AWS_|AZURE_|GOOGLE_|GCP_|RUNPOD_|CARTESIA_|OPENAI_|ANTHROPIC_|RESEND_|SUPABASE_|UPSTASH_|TURSO_|DATABASE_URL$|PG(?:PASSWORD|PASSFILE|SERVICE|SERVICEFILE|HOST|HOSTADDR|PORT|DATABASE|USER)$|CROUPIER_(?:GAME|ZONES|STUDIO)_DATABASE_URL$)/;
const credential = /(?:^|_)(?:TOKEN|SECRET|PASSWORD|API_KEY|CREDENTIALS?)(?:_|$)/;
function processGuard() {
  needed(process.env.NODE_ENV !== 'production' && process.env.CROUPIER_CLOUD_RUNTIME !== '1'
    && (!process.env.CROUPIER_STUDIO_ENVIRONMENT_ID || process.env.CROUPIER_STUDIO_ENVIRONMENT_ID === 'test'), 'shared_room_qa_production_process');
  for (const [rawName, value] of Object.entries(process.env)) {
    if (value === undefined || value === '') continue;
    const name = rawName.toUpperCase();
    needed(!provider.test(name), 'shared_room_qa_provider_process');
    needed(!cloud.test(name) && !credential.test(name), 'shared_room_qa_cloud_credentials');
  }
}
function targetGuard(expected) {
  needed(expected && Object.keys(expected).sort().join(',') === 'database,host,port,role,systemIdentifier', 'shared_room_qa_target_invalid');
  needed(expected.host === '127.0.0.1' && port(expected.port),
    'shared_room_qa_loopback_required');
  needed(qaName(expected.database) && (expected.role === 'studio_qa' || qaName(expected.role))
    && typeof expected.systemIdentifier === 'string' && /^[1-9][0-9]{9,29}$/.test(expected.systemIdentifier), 'shared_room_qa_target_invalid');
  return Object.freeze({ ...expected });
}
function poolGuard(pool, target) {
  needed(typeof pool?.connect === 'function' && typeof pool?.query === 'function', 'shared_room_qa_pool_invalid');
  const options = pool.options;
  needed(options && options.host === target.host && options.port === target.port && options.database === target.database
    && options.user === target.role && (!options.ssl || options.ssl === false)
    && Number.isInteger(options.connectionTimeoutMillis) && options.connectionTimeoutMillis > 0 && options.connectionTimeoutMillis <= 10000
    && ['connectionString', 'hostaddr', 'service', 'stream'].every(key => options[key] === undefined), 'shared_room_qa_pool_target_invalid');
}
const has = (value, functions) => value && functions.every(name => typeof value[name] === 'function');
function portsGuard({ pool, storage, studioPolicyRuntime: runtime, studioMediaRuntime: media, privateMedia }) {
  needed(storage?.pool === pool && has(storage.db, ['prepare', 'assertInstalled']) && has(storage.boDb, ['prepare'])
    && has(storage.gamePool, ['query', 'connect']), 'shared_room_qa_storage_invalid');
  let scope, repositoryScope;
  try { scope = validateStudioScope(runtime?.scope); repositoryScope = validateStudioScope(runtime?.repository?.scope); }
  catch { fail('shared_room_qa_scope_invalid'); }
  needed(scope.environment === 'test' && /^shared-qa-[a-z0-9_-]{1,70}$/.test(scope.workspaceId)
    && scope.environment === repositoryScope.environment && scope.workspaceId === repositoryScope.workspaceId, 'shared_room_qa_scope_invalid');
  needed(has(runtime.repository, ['sharedTransaction']) && has(runtime.policy, ['readSaved', 'projectStore', 'readGameConfiguration']), 'shared_room_qa_policy_invalid');
  needed(has(media, ['videoRegistry', 'videoResponse', 'videoRegistryCaptured', 'videoResponseCaptured', 'publicMediaResponse', 'hasPublicMedia', 'readMetadata'])
    && typeof privateMedia === 'function', 'shared_room_qa_media_invalid');
}
const identitySql = `SELECT host(inet_server_addr()) AS address, inet_server_port() AS port,
  current_database() AS database, current_user AS role, session_user AS session_role,
  current_setting('listen_addresses') AS listeners,
  (SELECT system_identifier::text FROM pg_control_system()) AS system_identifier`;

/** Verify the owned pool before importing or invoking an arbitrary QA fixture.
 * This does not register a capability or install any SQL/application state. */
export async function assertSharedRoomQaIdentity({ pool, expected } = {}) {
  processGuard();
  const target = targetGuard(expected);
  poolGuard(pool, target);
  let result;
  try { result = await pool.query({ text: identitySql, query_timeout: 5000 }); }
  catch { fail('shared_room_qa_identity_unavailable'); }
  const row = result?.rows?.length === 1 && result.rows[0];
  needed(row && row.address === '127.0.0.1' && row.listeners === '127.0.0.1'
    && row.port === target.port && row.database === target.database && row.role === target.role && row.session_role === target.role
    && row.system_identifier === target.systemIdentifier, 'shared_room_qa_identity_mismatch');
  processGuard(); poolGuard(pool, target);
  return target;
}

/** Register once before importing server.mjs. expected is an independently known
 * owned cluster identity, not values learned from this registration query. */
export async function registerSharedRoomQaContext({ pool, expected, httpPort, storage, studioPolicyRuntime, studioMediaRuntime, privateMedia } = {}) {
  needed(state === 'unregistered', 'shared_room_qa_already_registered');
  state = 'verifying';
  try {
    processGuard();
    const target = targetGuard(expected);
    needed(port(httpPort) && target.port !== httpPort, 'shared_room_qa_loopback_required');
    poolGuard(pool, target);
    const ports = { pool, storage, studioPolicyRuntime, studioMediaRuntime, privateMedia };
    portsGuard(ports);
    await assertSharedRoomQaIdentity({ pool, expected: target });
    needed(state === 'verifying', 'shared_room_qa_startup_race');
    processGuard(); poolGuard(pool, target); portsGuard(ports);
    pending = Object.freeze({ storage, studioPolicyRuntime, studioMediaRuntime, privateMedia,
      host: '127.0.0.1', port: httpPort, publicOrigin: `http://127.0.0.1:${httpPort}`, target });
    pendingPool = pool; state = 'ready';
  } catch (error) { pending = undefined; pendingPool = undefined; state = 'failed'; throw error; }
}

/** Production startup gets null and permanently seals late registration. Only
 * the first completed QA registration can supply the unchanged real ports. */
export function consumeSharedRoomQaContext() {
  if (state === 'unregistered' || state === 'production') { state = 'production'; return null; }
  if (state !== 'ready') { pending = undefined; pendingPool = undefined; state = 'failed'; fail('shared_room_qa_context_unavailable'); }
  const context = pending, pool = pendingPool; pending = undefined; pendingPool = undefined; state = 'consumed';
  try {
    processGuard(); poolGuard(pool, context.target);
    portsGuard({ pool, ...context });
    return context;
  } catch (error) { state = 'failed'; throw error; }
}
