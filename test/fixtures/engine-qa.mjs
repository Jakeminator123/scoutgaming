// Engine HTTP tests on PostgreSQL. tools/run-engine-qa.mjs owns the loopback TLS
// cluster and names its descriptor in CROUPIER_ENGINE_QA; without it every caller
// skips with ENGINE_QA_SKIP. Each database and role is created here, installed with
// the engine's own product-schema.sql (marked ready exactly as tools/studio-isolated-qa.mjs
// does) plus the forward game migrations, and dropped when the test ends.
import { spawn, spawnSync } from 'node:child_process';
import { createHash, createHmac, randomBytes, scryptSync } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPostgresStore } from '../../services/game/storage/postgres-store.mjs';

const gameRequire = createRequire(new URL('../../services/game/package.json', import.meta.url));
export const ENGINE_SERVER = fileURLToPath(new URL('../../services/game/server.mjs', import.meta.url));
export const ENGINE_DIRECTORY = fileURLToPath(new URL('../../services/game/', import.meta.url));
// Forward game migrations that every Neon database has after product-schema.sql.
export const GAME_MIGRATIONS = Object.freeze(['006-player-profile.sql', '007-roulette-tables.sql',
  '008-shared-wallet.sql', '009-shared-blackjack.sql', '010-presentation-receiver.sql']);

function descriptor() {
  const path = process.env.CROUPIER_ENGINE_QA;
  if (!path) return null;
  // A present but broken descriptor is a harness failure, never a skip.
  const value = JSON.parse(readFileSync(path, 'utf8'));
  if (value?.schema !== 'croupier-engine-qa-v1' || value.host !== '127.0.0.1' || !Number.isInteger(value.port)
    || !/^[a-z_]+$/.test(value.adminUser) || typeof value.caFile !== 'string' || !isAbsolute(value.caFile)) throw Error('engine_qa_descriptor_invalid');
  return Object.freeze(value);
}
const cluster = descriptor();
export const ENGINE_QA_SKIP = cluster ? false
  : 'engine HTTP test needs PostgreSQL: CI runs it through `node tools/run-engine-qa.mjs` on Linux (local: --postgres-bin <dir>)';

const OS_ENV = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'LD_LIBRARY_PATH'];
export const osEnvironment = () => Object.fromEntries(OS_ENV.filter(key => process.env[key]).map(key => [key, process.env[key]]));

export async function freePort() {
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(done => socket.close(done)); return port;
}

// pg is resolved only with a cluster, so a checkout without services/game/node_modules still skips.
const Pool = cluster ? gameRequire('pg').Pool : null;
const adminPool = () => new Pool({ host: cluster.host, port: cluster.port, user: cluster.adminUser, database: 'postgres',
  password: () => undefined, ssl: false, max: 1, connectionTimeoutMillis: 5000 });
async function installGameSchema(pool) {
  const schema = file => readFile(new URL(`../../ops/neon-game/${file}`, import.meta.url), 'utf8');
  const product = (await schema('product-schema.sql')).replace(/\r\n/g, '\n');
  await pool.query(product);
  await pool.query('INSERT INTO croupier_game.storage_migrations(version,checksum,source_hashes,applied_at) VALUES ($1,$2,$3,$4)',
    ['product-v1', createHash('sha256').update(product).digest('hex'), '{}', new Date().toISOString()]);
  for (const file of GAME_MIGRATIONS) await pool.query(await schema(file));
}

/** A fresh database owned by a fresh login role. `url` is what the engine receives;
 * `pool` (same role, same TLS) lets the test seed and inspect rows; `store` is the
 * engine's own async store over that pool (`db` = croupier_game, `boDb` = croupier_auth). */
export async function createEngineDatabase(t) {
  if (!cluster) throw Error('engine_qa_not_configured');
  const name = 'croupier_engine_' + randomBytes(6).toString('hex'), password = randomBytes(24).toString('hex');
  const admin = adminPool(), engines = new Set();
  let pool;
  // Engines on this database stop first, whatever order node:test runs its after hooks in.
  const drop = async () => {
    await Promise.allSettled([...engines].map(stop => stop()));
    await pool?.end().catch(() => {});
    try { await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`); await admin.query(`DROP ROLE IF EXISTS ${name}`); }
    finally { await admin.end(); }
  };
  t.after(drop);
  const started = Date.now();
  await admin.query(`CREATE ROLE ${name} LOGIN PASSWORD '${password}'`);
  await admin.query(`CREATE DATABASE ${name} OWNER ${name}`);
  const url = new URL(`postgresql://${name}:${password}@${cluster.host}:${cluster.port}/${name}`);
  url.searchParams.set('sslmode', 'verify-full'); url.searchParams.set('sslrootcert', cluster.caFile);
  pool = new Pool({ connectionString: url.href, max: 4, connectionTimeoutMillis: 5000, query_timeout: 15000 });
  await installGameSchema(pool);
  t.diagnostic(`engine-qa database ${name}: product-v1 + ${GAME_MIGRATIONS.length} migrations over verify-full TLS in ${Date.now() - started}ms`);
  const store = createPostgresStore({ pool });
  return { name, url: url.href, pool, store, password, engines, query: async (sql, values) => (await pool.query(sql, values)).rows };
}

/** Starts services/game/server.mjs against `database` and waits for its readiness line.
 * Only OS paths, the fixed Postgres selection and `env` reach the child. */
export async function startEngine(t, { database, env = {}, preload = [], port, timeoutMs = 30000 } = {}) {
  port ??= await freePort();
  const started = Date.now();
  const child = spawn(process.execPath, [...preload.flatMap(url => ['--import', String(url)]), ENGINE_SERVER], {
    cwd: ENGINE_DIRECTORY, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...osEnvironment(), HOST: '127.0.0.1', PORT: String(port), ...env,
      CROUPIER_DATABASE: 'postgres', CROUPIER_GAME_DATABASE_URL: database.url },
  });
  let stdout = '', stderr = '', stopping = false;
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  // Diagnostics never carry the database password; the engine never prints it either.
  const tail = () => stderr.replaceAll(database.password, '[redacted]').slice(-2000);
  const stop = async () => {
    stopping = true;
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit'); child.kill('SIGTERM');
    const force = setTimeout(() => child.kill('SIGKILL'), 5000);
    try { await exited; } finally { clearTimeout(force); }
  };
  database.engines.add(stop);
  t.after(stop);
  await new Promise((ready, reject) => {
    const failure = reason => { clearTimeout(timer); reject(Error(`engine_qa_server_${reason} after ${Date.now() - started}ms: ${tail()}`)); };
    const timer = setTimeout(() => failure('timeout'), timeoutMs);
    child.once('error', () => failure('spawn_failed'));
    child.once('exit', code => failure('exited_' + code));
    child.stdout.on('data', () => { if (stdout.includes('croupier demo on')) { clearTimeout(timer); child.removeAllListeners('exit'); child.removeAllListeners('error'); ready(); } });
  });
  t.diagnostic(`engine-qa server ready on 127.0.0.1:${port} (database ${database.name}) in ${Date.now() - started}ms`);
  child.once('exit', (code, signal) => { if (!stopping) t.diagnostic(`engine-qa server exited unexpectedly (${code ?? signal}): ${tail()}`); });
  return { port, origin: `http://127.0.0.1:${port}`, child, stop, output: () => stdout + stderr };
}

/** Runs the engine expecting it to refuse startup; returns its exit and output. */
export function engineBootFailure({ database, port, env = {}, timeoutMs = 20000 }) {
  const result = spawnSync(process.execPath, [ENGINE_SERVER], { cwd: ENGINE_DIRECTORY, encoding: 'utf8', timeout: timeoutMs, windowsHide: true,
    env: { ...osEnvironment(), HOST: '127.0.0.1', PORT: String(port), ...env, CROUPIER_DATABASE: 'postgres', CROUPIER_GAME_DATABASE_URL: database.url } });
  return { error: result.error, status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** CRAIG account row exactly as BO invitations store it (scrypt, 64-byte hex). */
export async function insertCraigUser(database, { id, username, email = null, password, salt = randomBytes(16).toString('hex'), role, createdAt = new Date().toISOString() }) {
  const hash = password === null ? null : scryptSync(password, salt, 64).toString('hex');
  const [row] = await database.query(id === undefined
    ? 'INSERT INTO croupier_auth.users (username,email,salt,hash,role,created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id'
    : 'INSERT INTO croupier_auth.users (id,username,email,salt,hash,role,created_at) VALUES ($7,$1,$2,$3,$4,$5,$6) RETURNING id',
  [username, email, salt, hash, role, createdAt, ...(id === undefined ? [] : [id])]);
  // Explicit historical IDs must not collide with later engine-created accounts.
  if (id !== undefined) await database.query("SELECT setval(pg_get_serial_sequence('croupier_auth.users','id'),(SELECT max(id) FROM croupier_auth.users))");
  return { id: String(row.id), salt, hash };
}
/** Synchronous HS256 signer with the engine's own CRAIG secret (created at its first start). */
export async function engineSigner(database) {
  const [row] = await database.query("SELECT v FROM croupier_auth.meta WHERE k='jwt_secret'");
  if (!row) throw Error('engine_qa_secret_missing_start_engine_first');
  const secret = Buffer.from(row.v, 'hex');
  return claims => {
    const message = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url');
    return message + '.' + createHmac('sha256', secret).update(message).digest('base64url');
  };
}
/** Current BO cookie for a CRAIG account: audience, role, source stamp and auth epoch. */
export async function backofficeCookie(database, id, { exp = Date.now() / 1000 + 3600 } = {}) {
  const [account] = await database.query('SELECT username,salt,hash,role FROM croupier_auth.users WHERE id=$1', [id]);
  const [epoch] = await database.query('SELECT epoch FROM croupier_auth.bo_auth_epochs WHERE user_id=$1', [id]);
  const source_stamp = createHash('sha256').update(`${account.salt}:${account.hash}`).digest('hex');
  return 'bo_jwt=' + (await engineSigner(database))({ sub: account.username, role: account.role, aud: 'backoffice', source_stamp, auth_epoch: Number(epoch?.epoch ?? 0), exp });
}
