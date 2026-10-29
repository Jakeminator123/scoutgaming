#!/usr/bin/env node
// Engine HTTP harness: one owned loopback PostgreSQL cluster with TLS, then the
// `engine` suite from .githooks/pre-commit-full. Each test file creates its own
// database and role (test/fixtures/engine-qa.mjs) and starts services/game/server.mjs
// the way the cloud does: PostgreSQL with a verify-full TLS URL.
// No system install, service, credential, dotenv or network beyond loopback.
import { spawn } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { performance } from 'node:perf_hooks';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ENGINE_QA_ENV = 'CROUPIER_ENGINE_QA';
export const ENGINE_QA_DESCRIPTOR = 'croupier-engine-qa-v1';
export const ENGINE_QA_ADMIN = 'engine_qa_admin';
const started = performance.now();
const log = (phase, extra = {}) => console.log(JSON.stringify({ engineQa: phase, ms: Math.round(performance.now() - started), ...extra }));

function run(command, args, { cwd, env, timeout = 60000, quiet = false } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '', timedOut = false;
    child.stdout.on('data', chunk => { output = (output + chunk).slice(-16000); });
    child.stderr.on('data', chunk => { output = (output + chunk).slice(-16000); });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeout);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); code === 0 && !timedOut ? resolveRun(output)
      : reject(Object.assign(Error(`engine_qa_process_failed:${command.split(/[\\/]/).pop()}:${timedOut ? 'timeout' : code}${quiet ? '' : ':' + output.slice(-3000)}`), { exitCode: code, timedOut })); });
  });
}
async function freePort() {
  const server = createServer(); await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const port = server.address().port; await new Promise(yes => server.close(yes)); return port;
}

// The `engine` suite in the full-regression registry is the only file list.
export async function engineSuiteFiles(hook = join(repository, '.githooks/pre-commit-full')) {
  const files = (await readFile(hook, 'utf8')).split(/\r?\n/).filter(line => line.startsWith('run_node_tests engine '))
    .flatMap(line => line.trim().split(/\s+/).slice(3));
  if (!files.length || files.some(file => !/^test\/[a-z0-9-]+\.mjs$/.test(file) || !existsSync(join(repository, file)))) throw Error('engine_qa_suite_invalid');
  return files;
}
export function tapSummary(text) {
  const count = name => Number(new RegExp(`^# ${name} (\\d+)$`, 'm').exec(text)?.[1] ?? NaN);
  return { tests: count('tests'), pass: count('pass'), fail: count('fail'), cancelled: count('cancelled'), skipped: count('skipped'), todo: count('todo') };
}
// A harness run must execute every test. A skip here means the descriptor did
// not reach a file, which would otherwise look like a green run.
export function assertCompleteRun(summary) {
  const { tests, pass, fail, cancelled, skipped, todo } = summary;
  if (![tests, pass, fail, cancelled, skipped, todo].every(Number.isSafeInteger) || tests < 1
    || pass !== tests || fail || cancelled || skipped || todo) throw Error(`engine_qa_incomplete:${JSON.stringify(summary)}`);
  return summary;
}

export async function runEngineQa({ postgresBin, downloadPostgres = false, files, concurrency = 2, testTimeoutMs = 540000 } = {}) {
  if (!['linux', 'win32'].includes(process.platform) || process.getuid?.() === 0) throw Error('engine_qa_requires_nonroot_linux_or_windows');
  if (downloadPostgres && (postgresBin || process.platform !== 'linux')) throw Error('choose_download_on_linux_or_existing_binaries');
  if (!downloadPostgres && (!postgresBin || !isAbsolute(postgresBin))) throw Error('explicit_postgres_bin_required');
  files ??= await engineSuiteFiles();
  const root = await realpath(await mkdtemp(join(tmpdir(), 'croupier-engine-qa-'))), owner = randomUUID();
  const data = join(root, 'data'), pgRoot = join(root, 'pg');
  await writeFile(join(root, '.croupier-qa-owned'), owner, { mode: 0o600 });
  const guarded = async path => {
    if (await realpath(root) !== root || await readFile(join(root, '.croupier-qa-owned'), 'utf8') !== owner
      || !(path === root || path.startsWith(root + sep)) || (await lstat(root)).isSymbolicLink()) throw Error('engine_qa_path_guard');
  };
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(CROUPIER_|DATABASE_|PG|BLOB_|RESEND_|RUNPOD_|CARTESIA_|OPENCLAW_|ELEVENLABS_|NODE_EXTRA_CA_CERTS$|NODE_TLS_REJECT_UNAUTHORIZED$)/i.test(key)) delete env[key];
  let active = false, startedCluster = false, stop, binary;
  try {
    await guarded(root);
    if (downloadPostgres) {
      const packages = join(root, 'packages'), lists = join(packages, 'lists'), cache = join(packages, 'cache');
      await mkdir(join(lists, 'partial'), { recursive: true }); await mkdir(cache);
      const status = join(cache, 'dpkg-status'); await writeFile(status, '', { mode: 0o600 });
      const apt = ['-o', `Dir::State::lists=${lists}`, '-o', `Dir::State::status=${status}`, '-o', `Dir::Cache=${cache}`, '-o', 'Debug::NoLocking=1'];
      log('download-postgres', { note: 'task-owned PostgreSQL16 packages; no system install or service' });
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
    binary = name => join(postgresBin, process.platform === 'win32' ? name + '.exe' : name);
    const version = (await run(binary('postgres'), ['--version'], { env })).trim();
    await run(binary('initdb'), ['-D', data, `--username=${ENGINE_QA_ADMIN}`, '--auth=trust', '--no-locale', '--encoding=UTF8',
      ...(downloadPostgres ? ['-L', join(pgRoot, 'usr/share/postgresql/16')] : [])], { env });
    // Loopback certificate for sslmode=verify-full: IP SAN for 127.0.0.1, self-signed,
    // so the same file is the trust anchor passed as sslrootcert. Valid one day.
    const key = join(root, 'tls', 'server.key'), cert = join(root, 'tls', 'server.crt');
    await mkdir(join(root, 'tls'), { mode: 0o700 });
    await run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=croupier-engine-qa',
      '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost', '-keyout', key, '-out', cert], { env });
    await chmod(key, 0o600);
    const pgPort = await freePort(), slash = value => value.replace(/\\/g, '/');
    await writeFile(join(data, 'postgresql.auto.conf'), [`listen_addresses='127.0.0.1'`, `port=${pgPort}`,
      `unix_socket_directories=''`, 'jit=off', 'max_connections=200', 'ssl=on',
      `ssl_cert_file='${slash(cert)}'`, `ssl_key_file='${slash(key)}'`, `password_encryption='scram-sha-256'`, ''].join('\n'), { mode: 0o600 });
    // First match wins: only the harness admin is trusted; every engine role needs TLS and SCRAM.
    await writeFile(join(data, 'pg_hba.conf'), [`host all ${ENGINE_QA_ADMIN} 127.0.0.1/32 trust`,
      'hostssl all all 127.0.0.1/32 scram-sha-256', ''].join('\n'), { mode: 0o600 });
    const pgStart = async () => { await guarded(data); startedCluster = true;
      await run(binary('pg_ctl'), ['-D', data, '-l', join(root, 'postgres.log'), '-w', '-t', '60', 'start'], { env, timeout: 90000 }); active = true; };
    stop = async () => { if (active || startedCluster) {
      await guarded(data);
      const running = await run(binary('pg_ctl'), ['-D', data, 'status'], { env, quiet: true }).then(() => true, error => {
        if (error.exitCode === 3 && !error.timedOut) return false; // pg_ctl: server not running.
        throw error; // Unknown status must never permit deleting possibly live data.
      });
      if (running) await run(binary('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], { env });
      active = false; startedCluster = false;
    } };
    await pgStart();
    const descriptor = join(root, 'engine-qa.json');
    await writeFile(descriptor, JSON.stringify({ schema: ENGINE_QA_DESCRIPTOR, host: '127.0.0.1', port: pgPort,
      adminUser: ENGINE_QA_ADMIN, caFile: cert, postgres: version }), { mode: 0o600 });
    log('postgres-ready', { readiness: `postgresql://127.0.0.1:${pgPort}/postgres`, postgres: version, tls: 'hostssl scram-sha-256, verify-full via sslrootcert',
      node: process.version, files, env: [ENGINE_QA_ENV] });
    const tap = join(root, 'engine.tap');
    const testStart = performance.now();
    let failure;
    try {
      await new Promise((resolveRun, reject) => {
        const child = spawn(process.execPath, ['--test', `--test-concurrency=${concurrency}`, '--test-reporter=spec', '--test-reporter-destination=stdout',
          '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...files],
        { cwd: repository, env: { ...env, [ENGINE_QA_ENV]: descriptor }, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
        const timer = setTimeout(() => { child.kill('SIGTERM'); reject(Error('engine_qa_tests_timeout')); }, testTimeoutMs);
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('exit', code => { clearTimeout(timer); code === 0 ? resolveRun() : reject(Error(`engine_qa_tests_failed:${code}`)); });
      });
    } catch (error) { failure = error; }
    const summary = tapSummary(existsSync(tap) ? await readFile(tap, 'utf8') : '');
    log('tests-finished', { durationMs: Math.round(performance.now() - testStart), ...summary });
    if (failure) {
      const pgLog = await readFile(join(root, 'postgres.log'), 'utf8').catch(() => '');
      console.error('[engine-qa] postgres.log tail (owned test cluster):\n' + pgLog.slice(-4000));
      throw failure;
    }
    assertCompleteRun(summary);
    await stop();
    log('cluster-stopped', { acceptance: 'engine-http-postgres-tls', ...summary });
    return summary;
  } finally {
    if (stop) await stop();
    if (active || startedCluster) throw Error('engine_qa_cleanup_refused_running_cluster');
    await guarded(root); await rm(root, { recursive: true, force: false });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = args.length === 1 && args[0] === '--download-postgres' ? { downloadPostgres: true }
    : args.length >= 2 && args[0] === '--postgres-bin' ? { postgresBin: args[1], ...(args.length > 2 ? { files: args.slice(2) } : {}) } : null;
  if (!options) { console.error('Usage: node tools/run-engine-qa.mjs --download-postgres | --postgres-bin /absolute/bin [test files]'); process.exitCode = 1; }
  else runEngineQa(options).catch(error => { console.error(error.stack); process.exitCode = 1; });
}
