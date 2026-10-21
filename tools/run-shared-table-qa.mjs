#!/usr/bin/env node
// Narrow J07 runner; lifecycle follows studio-isolated-qa.mjs, without its unrelated suites.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function run(command, args, { cwd, env, timeout = 60000 } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '', timedOut = false;
    child.stdout.on('data', chunk => { output = (output + chunk).slice(-16000); });
    child.stderr.on('data', chunk => { output = (output + chunk).slice(-16000); });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeout);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); code === 0 && !timedOut ? resolveRun(output)
      : reject(Object.assign(Error(`shared_table_qa_process_failed:${command}:${timedOut ? 'timeout' : code}:${output.slice(-3000)}`), { exitCode: code, timedOut })); });
  });
}
async function freePort() {
  const server = createServer(); await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const port = server.address().port; await new Promise(yes => server.close(yes)); return port;
}
export async function runSharedTableQa({ postgresBin, downloadPostgres = false } = {}) {
  if (process.platform !== 'linux' || process.getuid?.() === 0) throw Error('shared_table_qa_requires_nonroot_linux');
  if (downloadPostgres && postgresBin) throw Error('choose_download_or_existing_binaries');
  if (!downloadPostgres && (!postgresBin || !postgresBin.startsWith('/'))) throw Error('explicit_postgres_bin_required');
  const root = await mkdtemp(join(tmpdir(), 'croupier-shared-table-qa-')), owner = randomUUID();
  const data = join(root, 'data'), pgRoot = join(root, 'pg');
  await writeFile(join(root, '.croupier-qa-owned'), owner, { mode: 0o600 });
  const guarded = async path => {
    if (await realpath(root) !== root || await readFile(join(root, '.croupier-qa-owned'), 'utf8') !== owner
      || !(path === root || path.startsWith(root + sep)) || (await lstat(root)).isSymbolicLink()) throw Error('shared_table_qa_path_guard');
  };
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(CROUPIER_|DATABASE_|PG|BLOB_|RESEND_|RUNPOD_|CARTESIA_|OPENCLAW_)/.test(key)) delete env[key];
  const pools = new Set(); let active = false, started = false, stop;
  const closePools = async () => { await Promise.all([...pools].map(pool => pool.end())); pools.clear(); };
  try {
    await guarded(root);
    if (downloadPostgres) {
      const packages = join(root, 'packages'), lists = join(packages, 'lists'), cache = join(packages, 'cache');
      await mkdir(join(lists, 'partial'), { recursive: true }); await mkdir(cache);
      const status = join(cache, 'dpkg-status'); await writeFile(status, '', { mode: 0o600 });
      const apt = ['-o', `Dir::State::lists=${lists}`, '-o', `Dir::State::status=${status}`, '-o', `Dir::Cache=${cache}`, '-o', 'Debug::NoLocking=1'];
      console.log('Preparing task-owned PostgreSQL16 packages; no system install or service.');
      await run('apt-get', [...apt, 'update'], { cwd: packages, env, timeout: 120000 });
      await run('apt-get', [...apt, 'download', 'postgresql-16', 'postgresql-client-16', 'libpq5'], { cwd: packages, env, timeout: 120000 });
      await mkdir(pgRoot);
      for (const file of await readdir(packages)) {
        if (['lists', 'cache'].includes(file)) continue;
        if (!/^[a-z0-9][a-z0-9+_.~-]*\.deb$/.test(file)) throw Error('unexpected_isolated_package');
        await run('dpkg-deb', ['-x', join(packages, file), pgRoot], { env });
      }
      postgresBin = join(pgRoot, 'usr/lib/postgresql/16/bin'); env.LD_LIBRARY_PATH = join(pgRoot, 'usr/lib/x86_64-linux-gnu');
    }
    const binary = name => join(postgresBin, name);
    const version = (await run(binary('postgres'), ['--version'], { env })).trim();
    await run(binary('initdb'), ['-D', data, '--username=studio_qa', '--auth=trust', '--no-locale', '--encoding=UTF8',
      ...(downloadPostgres ? ['-L', join(pgRoot, 'usr/share/postgresql/16')] : [])], { env });
    const pgPort = await freePort();
    await writeFile(join(data, 'postgresql.auto.conf'), `listen_addresses='127.0.0.1'\nport=${pgPort}\nunix_socket_directories='${root}'\njit=off\n`, { mode: 0o600 });
    const start = async () => { await guarded(data); started = true; await run(binary('pg_ctl'), ['-D', data, '-l', join(root, 'postgres.log'), '-w', 'start'], { env }); active = true; };
    stop = async () => { if (active || started) {
      await guarded(data);
      // A failed pg_ctl start may still have created a live postmaster.
      const running = await run(binary('pg_ctl'), ['-D', data, 'status'], { env }).then(() => true, error => {
        if (error.exitCode === 3 && !error.timedOut) return false; // pg_ctl: server not running.
        throw error; // An unknown status must never permit deleting possibly live data.
      });
      if (running) await run(binary('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], { env });
      active = false; started = false;
    } };
    const { Pool } = createRequire(new URL('../services/game/package.json', import.meta.url))('pg');
    const createPool = ({ queryTimeoutMs = 15000 } = {}) => {
      const pool = new Pool({ host: '127.0.0.1', port: pgPort, user: 'studio_qa', database: 'postgres', max: 2,
        connectionTimeoutMillis: 5000, ...(queryTimeoutMs === null ? {} : { query_timeout: queryTimeoutMs }) });
      pools.add(pool); return pool;
    };
    await start(); let pool = createPool();
    const restart = async () => { await closePools(); await stop(); await start(); return createPool(); };
    console.log(JSON.stringify({ node: process.version, postgres: version, target: 'owned-loopback-cluster', port: pgPort }));
    const { checkPostgresSharedTableGuards, runPostgresSharedTableChecks } = await import('../test/postgres-shared-table.mjs');
    const guards = await checkPostgresSharedTableGuards({ pool });
    for (const file of ['product-schema.sql', '008-shared-wallet.sql', '009-shared-blackjack.sql'])
      await pool.query(await readFile(join(repository, 'ops/neon-game', file), 'utf8'));
    const { runSharedWalletSqlChecks } = await import('../test/fixtures/shared-wallet-sql-checks.mjs');
    const wallet = await runSharedWalletSqlChecks({ pool, createPool });
    const table = await runPostgresSharedTableChecks({ pool, createPool, restart }); pool = table.pool;
    await closePools(); await stop();
    const checks = [...guards.checks, ...wallet.checks, ...table.checks];
    console.log(JSON.stringify({ acceptance: 'isolated-shared-table-sql-two-client-process-restart', checks, count: checks.length, clusterStopped: true }));
    return { checks };
  } finally {
    try { await closePools(); } finally { if (stop) await stop(); }
    if (active || started) throw Error('shared_table_qa_cleanup_refused_running_cluster');
    await guarded(root); await rm(root, { recursive: true, force: false });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = args.length === 1 && args[0] === '--download-postgres' ? { downloadPostgres: true }
    : args.length === 2 && args[0] === '--postgres-bin' ? { postgresBin: args[1] } : null;
  if (!options) { console.error('Usage: node tools/run-shared-table-qa.mjs --download-postgres | --postgres-bin /absolute/bin'); process.exitCode = 1; }
  else runSharedTableQa(options).catch(error => { console.error(error.stack); process.exitCode = 1; });
}
