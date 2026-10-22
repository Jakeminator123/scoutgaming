#!/usr/bin/env node
// Owned loopback QA only. No migrations, seeding, dotenv, credentials or provider adapters.
// The local fixture supplies readonly ports for an ALREADY prepared synthetic registry.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fields = new Map([
  ['--postgres-port', 'postgresPort'], ['--database', 'database'], ['--role', 'role'],
  ['--system-id', 'systemId'], ['--http-port', 'httpPort'], ['--fixture', 'fixture'], ['--media-root', 'mediaRoot'],
]);
const optionNames = [...fields.values()].sort().join(',');
const qaName = value => typeof value === 'string' && /^croupier_qa_[a-z0-9_]{1,42}$/.test(value);
const validPort = value => Number.isInteger(value) && value >= 1024 && value <= 65535;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const need = (value, code) => { if (!value) fail(code); };
const plain = value => value && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const localPath = value => typeof value === 'string' && value.length > 0 && value.length <= 4096
  && !/[\x00-\x1f]/.test(value) && !/^(?:[a-z][a-z0-9+.-]*:|[\\/]{2})/i.test(value.replace(/^[a-z]:[\\/]/i, '/'));
function checkedOptions(value) {
  need(plain(value) && Reflect.ownKeys(value).every(key => typeof key === 'string')
    && Object.keys(value).sort().join(',') === optionNames
    && Object.values(Object.getOwnPropertyDescriptors(value)).every(d => Object.hasOwn(d, 'value') && d.enumerable), 'shared_room_qa_arguments_invalid');
  need(validPort(value.postgresPort) && validPort(value.httpPort) && value.postgresPort !== value.httpPort, 'shared_room_qa_ports_invalid');
  need(qaName(value.database) && (value.role === 'studio_qa' || qaName(value.role))
    && typeof value.systemId === 'string' && /^[1-9][0-9]{9,29}$/.test(value.systemId), 'shared_room_qa_target_invalid');
  need(localPath(value.fixture) && value.fixture.endsWith('.mjs') && localPath(value.mediaRoot), 'shared_room_qa_paths_invalid');
  return Object.freeze({ ...value });
}
export function parseSharedRoomQaArgs(args) {
  need(Array.isArray(args), 'shared_room_qa_arguments_invalid');
  const value = Object.create(null);
  for (let i = 0; i < args.length; i += 2) {
    const name = fields.get(args[i]), argument = args[i + 1];
    need(name && !Object.hasOwn(value, name) && typeof argument === 'string' && argument !== ''
      && !argument.startsWith('--'), 'shared_room_qa_arguments_invalid');
    value[name] = name.endsWith('Port') ? (/^[1-9][0-9]{3,4}$/.test(argument) ? Number(argument) : NaN) : argument;
  }
  return checkedOptions(value);
}

const provider = /^(?:VERCEL(?:_|$)|RENDER(?:_|$)|RAILWAY_|FLY_|DYNO$|HEROKU_|NETLIFY(?:_|$)|CF_PAGES(?:_|$)|AWS_(?:LAMBDA|EXECUTION_ENV)|K_SERVICE$|K_REVISION$|GOOGLE_CLOUD_PROJECT$|GCP_PROJECT$|WEBSITE_INSTANCE_ID$)/;
const cloud = /^(?:BLOB_|NEON_|AWS_|AZURE_|GOOGLE_|GCP_|RUNPOD_|CARTESIA_|OPENAI_|ANTHROPIC_|RESEND_|SUPABASE_|UPSTASH_|TURSO_|DATABASE_URL$|PG[A-Z_]*$|CROUPIER_(?:GAME|ZONES|STUDIO)_DATABASE_URL$)/;
const credential = /(?:^|_)(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY|PRIVATE_KEY|CREDENTIALS?)(?:_|$)/;
const startup = /^(?:NODE_OPTIONS|NODE_PATH|NODE_EXTRA_CA_CERTS|NODE_TLS_REJECT_UNAUTHORIZED|LD_PRELOAD|LD_LIBRARY_PATH|DYLD_.+|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY)$/;
const configured = new Set(['CROUPIER_DATABASE', 'CROUPIER_STUDIO_NEON_POLICY', 'CROUPIER_SHARED_TABLE_ENABLED',
  'CROUPIER_PLAYER_ACCOUNTS', 'CROUPIER_PUBLIC_ORIGIN', 'CROUPIER_CLOUD_LAYOUT', 'CROUPIER_STUDIO_ENVIRONMENT_ID', 'CROUPIER_STUDIO_WORKSPACE_ID']);
export function validateSharedRoomQaEnvironment(env) {
  need(env && typeof env === 'object' && !Array.isArray(env), 'shared_room_qa_environment_invalid');
  for (const [rawName, value] of Object.entries(env)) {
    if (value === undefined || value === '') continue;
    const name = rawName.toUpperCase();
    need(name !== 'NODE_ENV' || ['test', 'development'].includes(value), 'shared_room_qa_production_process');
    need(!provider.test(name), 'shared_room_qa_provider_process');
    need(!cloud.test(name) && !credential.test(name), 'shared_room_qa_cloud_credentials');
    need(!startup.test(name) && (!name.startsWith('CROUPIER_') || configured.has(name)), 'shared_room_qa_environment_invalid');
    if (name === 'CROUPIER_STUDIO_ENVIRONMENT_ID') need(value === 'test', 'shared_room_qa_production_process');
    if (name === 'CROUPIER_STUDIO_WORKSPACE_ID') need(/^shared-qa-[a-z0-9_]{1,42}$/.test(value), 'shared_room_qa_environment_invalid');
  }
}
const osNames = new Set(['PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR',
  'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'LANG', 'LC_ALL', 'TZ']);
function settings(value) {
  const origin = 'http://127.0.0.1:' + value.httpPort;
  return { NODE_ENV: 'test', CROUPIER_DATABASE: 'postgres', CROUPIER_STUDIO_NEON_POLICY: '1',
    CROUPIER_SHARED_TABLE_ENABLED: '1', CROUPIER_PLAYER_ACCOUNTS: '1', HOST: '127.0.0.1', PORT: String(value.httpPort),
    PUBLIC_URL: origin, CROUPIER_PUBLIC_ORIGIN: origin, BO_URL: origin, LAB_PUBLIC_URL: origin,
    CROUPIER_CLOUD_LAYOUT: 'single-origin', CROUPIER_STUDIO_ENVIRONMENT_ID: 'test',
    CROUPIER_STUDIO_WORKSPACE_ID: 'shared-qa-' + value.database.slice('croupier_qa_'.length) };
}
export function createSharedRoomQaEnvironment(env, options) {
  validateSharedRoomQaEnvironment(env);
  const value = checkedOptions(options), output = Object.create(null);
  for (const [name, content] of Object.entries(env)) if (osNames.has(name.toUpperCase()) && typeof content === 'string') output[name] = content;
  return { ...output, ...settings(value) };
}
async function fixturePaths(value) {
  try {
    const fixture = await realpath(resolve(value.fixture)), mediaRoot = await realpath(resolve(value.mediaRoot));
    need(localPath(fixture) && localPath(mediaRoot) && fixture.endsWith('.mjs'), 'shared_room_qa_paths_invalid');
    need((await stat(fixture)).isFile() && (await stat(mediaRoot)).isDirectory(), 'shared_room_qa_paths_invalid');
    return { fixture, mediaRoot };
  } catch { fail('shared_room_qa_paths_invalid'); }
}

/** Worker entrypoint. Call in an isolated process with createSharedRoomQaEnvironment.
 * No imported fixture or application module runs until the owned DB identity matches. */
export async function runSharedRoomK04Qa(options) {
  validateSharedRoomQaEnvironment(process.env);
  const value = checkedOptions(options);
  need(Object.entries(settings(value)).every(([name, content]) => process.env[name] === content), 'shared_room_qa_environment_invalid');
  const paths = await fixturePaths(value);
  const expected = Object.freeze({ host: '127.0.0.1', port: value.postgresPort,
    database: value.database, role: value.role, systemIdentifier: value.systemId });
  const scope = Object.freeze({ environment: 'test', workspaceId: settings(value).CROUPIER_STUDIO_WORKSPACE_ID });
  let pool, storage, runtime;
  try {
    const { assertSharedRoomQaIdentity, registerSharedRoomQaContext } = await import('../services/game/shared-room-qa-context.mjs');
    const requireGame = createRequire(new URL('../services/game/package.json', import.meta.url));
    const { Pool } = requireGame('pg');
    pool = new Pool({ host: expected.host, port: expected.port, database: expected.database, user: expected.role,
      // A callback deliberately bypasses pgpass and inherited/default password discovery.
      password: () => undefined, ssl: false, max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 1000,
      query_timeout: 10000, application_name: 'croupier-shared-room-k04-qa' });
    await assertSharedRoomQaIdentity({ pool, expected });
    const { createPostgresStore } = await import('../services/game/storage/postgres-store.mjs');
    storage = createPostgresStore({ pool });
    try { await storage.db.assertInstalled(); } catch { fail('shared_room_qa_product_schema_unavailable'); }
    const { planStudioMigrations, isStudioMigrationPlanReady } = await import('../ops/neon-studio/migrations.mjs');
    let studioPlan;
    try { studioPlan = await planStudioMigrations({ pool }); } catch { fail('shared_room_qa_studio_schema_unavailable'); }
    need(isStudioMigrationPlanReady(studioPlan), 'shared_room_qa_studio_schema_unavailable');
    const fixture = await import(pathToFileURL(paths.fixture).href);
    need(typeof fixture.createQaFixture === 'function', 'shared_room_qa_fixture_invalid');
    const ports = await fixture.createQaFixture({ pool, scope, origin: settings(value).PUBLIC_URL, mediaRoot: paths.mediaRoot });
    need(plain(ports) && Object.keys(ports).sort().join(',') === 'privateMedia,studioMediaRuntime,studioPolicyRuntime'
      && ports.studioPolicyRuntime?.scope?.environment === scope.environment
      && ports.studioPolicyRuntime?.scope?.workspaceId === scope.workspaceId
      && ports.studioPolicyRuntime?.repository?.scope?.environment === scope.environment
      && ports.studioPolicyRuntime?.repository?.scope?.workspaceId === scope.workspaceId, 'shared_room_qa_fixture_invalid');
    try { await ports.studioPolicyRuntime.policy.readSaved(); } catch { fail('shared_room_qa_fixture_unavailable'); }
    await registerSharedRoomQaContext({ pool, expected, httpPort: value.httpPort, storage, ...ports });
    const server = await import('../services/game/server.mjs');
    runtime = server.sharedRoomQaRuntime;
    need(runtime && typeof runtime.close === 'function' && typeof runtime.ready?.then === 'function', 'shared_room_qa_server_unavailable');
    const listening = await runtime.ready;
    need(listening?.origin === settings(value).PUBLIC_URL && listening.host === expected.host && listening.port === value.httpPort,
      'shared_room_qa_listener_mismatch');
    return runtime;
  } catch (error) {
    try {
      if (runtime?.close) await runtime.close();
      else if (storage) await storage.close();
      else if (pool) await pool.end();
    } catch { fail('shared_room_qa_cleanup_failed'); }
    // Never expose a driver, fixture or server error message/stack.
    const known = ['shared_room_qa_identity_unavailable', 'shared_room_qa_identity_mismatch',
      'shared_room_qa_fixture_invalid', 'shared_room_qa_server_unavailable', 'shared_room_qa_listener_mismatch',
      'shared_room_qa_product_schema_unavailable', 'shared_room_qa_studio_schema_unavailable', 'shared_room_qa_fixture_unavailable'];
    fail(known.includes(error?.code) ? error.code : 'shared_room_qa_bootstrap_failed');
  }
}

const cleanupBudget = value => need(Number.isInteger(value) && value >= 1 && value <= 85000, 'shared_room_qa_cleanup_budget_invalid');
const cleanupFailure = target => target.stderr.write('shared_room_qa_cleanup_failed\n');

/** Own child only. A short bounded budget is injectable for lifecycle tests. */
export function waitForSharedRoomQaChild(child, { processTarget = process, forceAfterMs = 85000 } = {}) {
  cleanupBudget(forceAfterMs);
  return new Promise((resolveExit, rejectExit) => {
    let force, stopping = false, forced = false, reported = false;
    const report = () => { if (!reported) { reported = true; cleanupFailure(processTarget); } };
    const detach = () => {
      clearTimeout(force); processTarget.off('SIGINT', stop); processTarget.off('SIGTERM', stop);
      child.off('error', onError); child.off('exit', onExit);
    };
    const stop = () => {
      if (stopping) return;
      stopping = true;
      if (child.connected) child.send({ type: 'shared_room_qa_shutdown' }, () => {});
      force = setTimeout(() => { forced = true; report(); child.kill('SIGKILL'); }, forceAfterMs);
    };
    const onError = () => { detach(); rejectExit(Object.assign(new Error('shared_room_qa_child_failed'), { code: 'shared_room_qa_child_failed' })); };
    const onExit = (code, signal) => {
      detach();
      if (forced || signal) { report(); resolveExit(1); }
      else resolveExit(Number.isInteger(code) ? code : 1);
    };
    processTarget.on('SIGINT', stop); processTarget.on('SIGTERM', stop);
    child.once('error', onError); child.once('exit', onExit);
  });
}

/** The worker owns a deadline too: loss of its parent must not orphan a listener,
 * including when bootstrap has not returned a runtime to close yet. */
export function createSharedRoomQaWorkerLifecycle({ processTarget = process, forceAfterMs = 85000 } = {}) {
  cleanupBudget(forceAfterMs);
  let runtime, closing = false, finished = false, force, closeStarted = false, resolveStopped;
  const stopped = new Promise(resolve => { resolveStopped = resolve; });
  const detach = () => {
    clearTimeout(force); processTarget.off('SIGINT', stop); processTarget.off('SIGTERM', stop);
    processTarget.off('disconnect', stop); processTarget.off('message', message);
  };
  const failed = () => {
    if (finished) return;
    finished = true; detach(); cleanupFailure(processTarget);
    resolveStopped({ completed: false }); processTarget.exit(1);
  };
  const close = () => {
    if (!runtime || closeStarted || finished) return;
    closeStarted = true;
    void Promise.resolve().then(() => runtime.close()).then(result => {
      if (finished) return;
      if (result?.completed !== true) { failed(); return; }
      finished = true; detach(); resolveStopped({ completed: true });
      if (processTarget.connected) processTarget.disconnect();
    }).catch(failed);
  };
  const stop = () => {
    if (closing || finished) return;
    closing = true;
    // Keep this timer referenced: an unsettled bootstrap promise alone keeps no process alive.
    force = setTimeout(failed, forceAfterMs); close();
  };
  const message = value => { if (value?.type === 'shared_room_qa_shutdown') stop(); };
  processTarget.on('SIGINT', stop); processTarget.on('SIGTERM', stop);
  processTarget.once('disconnect', stop); processTarget.on('message', message);
  if (processTarget.connected === false) stop();
  return Object.freeze({
    attach(value) { if (finished) return; runtime = value; if (closing) close(); },
    get stopping() { return closing; }, stopped,
  });
}

const usage = 'node tools/run-shared-room-k04-qa.mjs --postgres-port <port> --database croupier_qa_<id> --role <studio_qa|croupier_qa_id> --system-id <system_identifier> --http-port <port> --fixture <local.mjs> --media-root <local-directory>';
const workerSource = `import {runSharedRoomK04Qa,createSharedRoomQaWorkerLifecycle} from ${JSON.stringify(import.meta.url)};
const lifetime = createSharedRoomQaWorkerLifecycle();
try {
  const runtime = await runSharedRoomK04Qa(JSON.parse(process.argv[1]));
  lifetime.attach(runtime);
  if (!lifetime.stopping) console.log('shared_room_k04_qa_ready');
} catch (error) {
  console.error(error.code?.startsWith('shared_room_qa_') ? error.code : 'shared_room_qa_bootstrap_failed');
  process.exit(1);
}
`;
async function cli() {
  if (process.argv.length === 3 && process.argv[2] === '--help') { console.log(usage); return; }
  const value = parseSharedRoomQaArgs(process.argv.slice(2)), env = createSharedRoomQaEnvironment(process.env, value);
  const child = spawn(process.execPath, ['--input-type=module', '--eval', workerSource, JSON.stringify(value)],
    { cwd: root, env, stdio: ['ignore', 'inherit', 'inherit', 'ipc'], windowsHide: true });
  process.exitCode = await waitForSharedRoomQaChild(child);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  cli().catch(error => {
    console.error(error?.code?.startsWith('shared_room_qa_') ? error.code : 'shared_room_qa_launch_failed');
    process.exitCode = 1;
  });
}
