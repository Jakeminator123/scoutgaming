#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const owner = randomUUID();
function run(command, args, { cwd, env = process.env, timeout = 60000 } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('isolated_qa_process_timeout')); }, timeout);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); code === 0 ? resolveRun(output) : reject(new Error(`isolated_qa_process_failed:${command}:${code}:${output.slice(-1800)}`)); });
  });
}
async function port() {
  const server = createServer(); await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const value = server.address().port; await new Promise(yes => server.close(yes)); return value;
}
// Uses only the caller's already-created loopback fixture cluster. The two
// databases are deliberately created without IF NOT EXISTS or reuse/cleanup SQL.
// A stale database fails CREATE DATABASE instead of becoming a test target.
export const STUDIO_ISOLATED_QA_SOURCES = Object.freeze([
      'packages/studio-registry/server/blob-reader.mjs', 'packages/studio-registry/server/managed-media-contract.mjs', 'packages/studio-registry/server/media-blob-index.mjs', 'packages/studio-registry/server/media-layout.mjs', 'packages/studio-registry/server/private-media-contract.mjs', 'packages/studio-registry/server/registry-core.mjs', 'packages/studio-registry/server/registry-reader.mjs', 'packages/studio-registry/server/storage-contract.mjs', 'packages/studio-registry/server/video-dealer-registration.mjs', 'packages/studio-registry/server/video-manifest.mjs', 'tools/media-blob-index-reader.mjs', 'lab/lib/video-local-readers.mjs', 'lab/lib/video-alpha-reader.mjs', 'web/blob-media.mjs', 'web/media-blob-index.mjs', 'web/package.json', 'web/package-lock.json',
      'ops/neon-studio/013-moving-speech-admission.sql','web/moving-speech-binding.mjs','web/moving-speech-session.mjs','web/moving-speech-transport.mjs',
      'ops/neon-studio/012-runtime-media-catalog.sql', 'test/fixtures/studio-runtime-sql-checks.mjs', 'test/fixtures/runtime-media-catalog.mjs',
      'ops/neon-studio/runtime-media-import.mjs', 'tools/media-layout.mjs',
      'packages/studio-registry/server/runtime-catalog.mjs', 'web/storage/speech-reply-repository.mjs', 'web/speech-reply-library.mjs',
      'media/layout.json', 'media/blob-index.json', 'media/catalog/presentation.json', 'media/catalog/legacy.json',
      'packages/studio-access/studio-native-auth.mjs', 'packages/studio-access/studio-access-policy.mjs', 'packages/studio-access/studio-scope.mjs', 'packages/studio-access/account-role.mjs',
      'ops/neon-studio/007-partner-branding-drafts.sql', 'test/partner-branding-postgres.mjs', 'lab/test/fixtures/cloud-presentation.mjs',
      'lab/lib/partner-branding-api.mjs', 'lab/lib/partner-presentation-choices.mjs', 'lab/lib/partner-package-view.mjs',
      'web/storage/partner-branding.mjs', 'web/game-entry-operator.mjs', 'web/operator-appearance-api.mjs',
      'packages/navigation/operator-entry.mjs', 'packages/navigation/operator-slug.mjs',
      'web/public/operator-appearance-boundary.mjs', 'web/storage/frozen-dealer-presentation.mjs', 'web/public/player-choices.mjs',
      'web/storage/presentation-package.mjs', 'web/storage/frozen-presentation-capture.mjs', 'web/storage/frozen-dealer-idle.mjs',
      'web/presentation-room-contract.mjs', 'web/public/game-lanes.mjs', 'packages/presentation/contracts/composition-settings.mjs',
      'web/presentation-layers.mjs', 'packages/presentation/contracts/studio-model.mjs',
      'packages/presentation/contracts/game-lane-id.mjs', 'packages/presentation/contracts/presentation-room.mjs',
      'packages/presentation/contracts/operator-lifecycle-key.mjs', 'packages/presentation/server/registered-dealer-idle.mjs',
      'packages/presentation/public-modules.mjs', 'packages/presentation/server/registered-idle-rules.mjs', 'lab/lib/registered-idle-rules.mjs',
      'packages/shared/studio-error.mjs', 'packages/presentation/server/selection.mjs', 'packages/presentation/server/video-bindings.mjs',
      'lab/lib/presentation-selection.mjs', 'lab/lib/presentation-video-bindings.mjs', 'lab/lib/studio-director.mjs',
      'ops/neon-game/007-roulette-tables.sql', 'test/roulette-postgres.mjs', 'web/games/roulette/room.mjs', 'web/games/roulette/storage.mjs', 'web/games/roulette/access.mjs', 'web/games/roulette/index.mjs', 'web/games/roulette/rules.mjs',
      'ops/neon-game/product-schema.sql', 'ops/neon-studio/001-studio-metadata.sql', 'ops/neon-studio/002-generation-journals.sql', 'ops/neon-studio/003-operator-speech-qa.sql', 'ops/neon-studio/004-fullfile-reservations.sql', 'ops/neon-studio/005-operators.sql', 'ops/neon-studio/006-operator-audit.sql',
      'test/partner-team-postgres.mjs', 'test/studio-isolated-partner-qa.mjs', 'lab/lib/partner-session.mjs', 'lab/lib/partner-team-api.mjs', 'lab/lib/operator-audit-context.mjs', 'lab/lib/operator-admin-api.mjs', 'lab/lib/operator-journal.mjs',
      'ops/neon-studio/011-gpu-daily-budget.sql', 'ops/neon-studio/migrations.mjs', 'web/storage/operator-store.mjs', 'ops/neon-studio/speech-ledger-snapshot.mjs', 'ops/neon-studio/speech-ledger-import.mjs', 'test/speech-ledger-import.mjs',
      'packages/studio-registry/server/repository.mjs',
      'web/storage/postgres-store.mjs', 'web/storage/studio-contract.mjs', 'packages/studio-registry/server/stored-media-types.mjs', 'packages/shared/media-file-types.mjs', 'web/storage/studio-repository.mjs', 'web/storage/studio-game-policy.mjs', 'web/storage/studio-runtime.mjs',
      'ops/neon-studio/retained-bank.mjs', 'test/studio-retained-bank.mjs',
      'web/storage/player-administration.mjs', 'web/studio-game-commands.mjs', 'packages/shared/studio-game-command.mjs', 'lab/lib/studio-game-authority.mjs', 'lab/lib/studio-native-auth.mjs',
      'lab/lib/studio-native-auth-actions.mjs', 'lab/lib/studio-admin-accounts.mjs', 'lab/lib/studio-admin-data.mjs', 'lab/lib/studio-admin-api.mjs', 'lab/lib/studio-document-api.mjs',
      'lab/lib/studio-admin-readouts.mjs', 'lab/lib/studio-voice-lines.mjs', 'lab/lib/studio-access-policy.mjs', 'lab/lib/studio-admin-contract.mjs',
      'lab/lib/voice-preview.mjs', 'lab/lib/media-blob-index.mjs', 'web/shoe-game.mjs', 'web/email-templates.mjs', 'packages/presentation/contracts/speech-lines.mjs',
      'web/postgres-speech-journal.mjs', 'web/speech-journal-runtime.mjs', 'web/speech-journal-constants.mjs', 'web/generated-speech-session.mjs', 'web/generated-speech-stream.mjs', 'web/generated-speech.mjs',
      'web/speech-blob-artifacts.mjs', 'web/postgres-operator-speech-qa.mjs', 'lab/lib/cloud-media-store.mjs', 'test/studio-postgres-integration.mjs', 'test/studio-cutover-integration.mjs', 'tools/studio-isolated-qa.mjs']);

export async function runPartnerDatabaseQa({ adminPool, pgPort, createPool, restartCluster, runChecks } = {}) {
  if (!Number.isInteger(pgPort) || pgPort < 1 || pgPort > 65535 || typeof adminPool?.query !== 'function'
    || typeof createPool !== 'function' || typeof restartCluster !== 'function' || typeof runChecks !== 'function') {
    throw new Error('partner_qa_invalid_configuration');
  }
  const target = (await adminPool.query("SELECT host(inet_server_addr()) AS address, current_user AS role, current_database() AS database, current_setting('listen_addresses') AS listeners, inet_server_port() AS port")).rows[0];
  if (!target || target.address !== '127.0.0.1' || target.listeners !== '127.0.0.1'
    || target.role !== 'studio_qa' || target.database !== 'postgres' || target.port !== pgPort) throw new Error('partner_qa_target_refused');
  await adminPool.query('CREATE DATABASE n2_qa_operators');
  await adminPool.query('CREATE DATABASE n2_qa_auth');
  let operatorPool, authPool;
  const open = database => createPool({ host: '127.0.0.1', port: pgPort, user: 'studio_qa', database,
    max: 4, connectionTimeoutMillis: 5000, query_timeout: 15000 });
  const close = async () => {
    const current = [operatorPool, authPool].filter(Boolean); operatorPool = null; authPool = null;
    const results = await Promise.allSettled(current.map(pool => pool.end()));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  };
  const reopen = () => { operatorPool = open('n2_qa_operators'); authPool = open('n2_qa_auth'); return { operatorPool, authPool }; };
  try {
    reopen();
    const result = await runChecks({ operatorPool, authPool, restart: async () => {
      await close(); await restartCluster(); return reopen();
    } });
    if (!Array.isArray(result?.checks) || !result.checks.length || result.checks.some(name => typeof name !== 'string' || !name)) {
      throw new Error('partner_qa_checks_missing');
    }
    return result.checks;
  } finally { await close(); }
}

export async function runIsolatedStudioQa({ postgresBin, downloadPostgres = false } = {}) {
  if (process.platform !== 'linux' || process.getuid?.() === 0) throw new Error('isolated_qa_requires_nonroot_linux');
  const root = await mkdtemp(join(tmpdir(), 'croupier-studio-qa-'));
  await writeFile(join(root, '.croupier-qa-owned'), owner, { mode: 0o600 });
  const guarded = async path => {
    if (await realpath(root) !== root || await readFile(join(root, '.croupier-qa-owned'), 'utf8') !== owner
      || !(path === root || path.startsWith(root + sep)) || (await lstat(root)).isSymbolicLink()) throw new Error('isolated_qa_path_guard');
  };
  const pgRoot = join(root, 'pg'), data = join(root, 'data');
  let active = false, pool;
  const env = { ...process.env }; for (const key of Object.keys(env)) if (/^(CROUPIER_|BLOB_|RESEND_|RUNPOD_|CARTESIA_|OPENCLAW_)/.test(key)) delete env[key];
  try {
    await guarded(root);
    if (downloadPostgres) {
      if (postgresBin) throw new Error('choose_download_or_existing_binaries');
      const packages = join(root, 'packages'); await mkdir(packages);
      console.log('Preparing isolated PostgreSQL packages; no system install or service.');
      const lists = join(packages, 'lists'), cache = join(packages, 'cache');
      await mkdir(join(lists, 'partial'), { recursive: true }); await mkdir(cache);
      // Host-installed versions may have no download source in these lists
      // (for example GitHub's PGDG libpq). Select from verified repositories
      // using task-owned empty dpkg state; never read or modify host status.
      const status = join(cache, 'dpkg-status'); await writeFile(status, '', { mode: 0o600 });
      const aptScope = ['-o', `Dir::State::lists=${lists}`, '-o', `Dir::State::status=${status}`, '-o', `Dir::Cache=${cache}`, '-o', 'Debug::NoLocking=1'];
      // Existing system APT metadata can be stale. Refresh only task-owned
      // lists/cache, retaining APT signature/hash verification without sudo.
      await run('apt-get', [...aptScope, 'update'], { cwd: packages, env, timeout: 120000 });
      await run('apt-get', [...aptScope, 'download', 'postgresql-16', 'postgresql-client-16', 'libpq5'], { cwd: packages, env, timeout: 120000 });
      await mkdir(pgRoot);
      for (const file of await readdir(packages)) {
        if (['lists', 'cache'].includes(file)) continue;
        if (!/^[a-z0-9][a-z0-9+_.~-]*\.deb$/.test(file)) throw new Error('unexpected_isolated_package');
        await run('dpkg-deb', ['-x', join(packages, file), pgRoot], { env });
      }
      postgresBin = join(pgRoot, 'usr/lib/postgresql/16/bin');
      env.LD_LIBRARY_PATH = join(pgRoot, 'usr/lib/x86_64-linux-gnu');
    }
    if (!postgresBin || !postgresBin.startsWith('/')) throw new Error('explicit_postgres_bin_required');
    const binary = name => join(postgresBin, name);
    const share = downloadPostgres ? join(pgRoot, 'usr/share/postgresql/16') : undefined;
    await run(binary('initdb'), ['-D', data, '--username=studio_qa', '--auth=trust', '--no-locale', '--encoding=UTF8', ...(share ? ['-L', share] : [])], { env });
    const pgPort = await port();
    await writeFile(join(data, 'postgresql.auto.conf'), `listen_addresses='127.0.0.1'\nport=${pgPort}\nunix_socket_directories='${root}'\njit=off\n`, { mode: 0o600 });
    const start = async () => { await guarded(data); await run(binary('pg_ctl'), ['-D', data, '-l', join(root, 'postgres.log'), '-w', 'start'], { env }); active = true; };
    const stop = async () => { if (active) { await guarded(data); await run(binary('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], { env }); active = false; } };
    const { Pool } = createRequire(new URL('../web/package.json', import.meta.url))('pg');
    const open = () => new Pool({ connectionString: `postgresql://studio_qa@127.0.0.1:${pgPort}/postgres`, max: 8, connectionTimeoutMillis: 5000, query_timeout: 15000 });
    await start(); pool = open();
    const restart = async () => { await pool.end(); await stop(); await start(); pool = open(); return pool; };
    const sql = (await readFile(join(repository, 'ops/neon-game/product-schema.sql'), 'utf8')).replace(/\r\n/g, '\n');
    await pool.query(sql);
    await pool.query('INSERT INTO croupier_game.storage_migrations(version,checksum,source_hashes,applied_at) VALUES ($1,$2,$3,$4)',
      ['product-v1', createHash('sha256').update(sql).digest('hex'), '{}', new Date().toISOString()]);
    await run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=studio.croupier-qa.invalid',
      '-addext', 'subjectAltName=DNS:studio.croupier-qa.invalid,DNS:render.croupier-qa.invalid', '-keyout', join(root, 'fixture.key'), '-out', join(root, 'fixture.crt')], { env });

    const sourceHashes = async () => Object.fromEntries(await Promise.all(STUDIO_ISOLATED_QA_SOURCES.map(async file => [file, createHash('sha256').update(await readFile(join(repository, file))).digest('hex')])));
    const before = await sourceHashes();
    // The acceptance count is TAP metadata; Node's default reporter varies
    // across versions and execution contexts. Require the parsed format.
    const retainedUnitOutput = await run(process.execPath, ['--test', '--test-reporter=tap', join(repository,'test/studio-retained-bank.mjs')], {env});
    const retainedContractChecks = Number(/# tests (\d+)/.exec(retainedUnitOutput)?.[1]);
    if (!Number.isSafeInteger(retainedContractChecks) || retainedContractChecks < 4) throw new Error('retained_contract_checks_missing');
    const { runStudioPostgresChecks } = await import('../test/studio-postgres-integration.mjs');
    const existing = await runStudioPostgresChecks({ pool, restart }); pool = existing.pool;
    const { runStudioCutoverChecks } = await import('../test/studio-cutover-integration.mjs');
    const current = await runStudioCutoverChecks({ pool, restart, tls: { key: await readFile(join(root, 'fixture.key')), cert: await readFile(join(root, 'fixture.crt')) } });
    pool = current.pool;
    const { runSpeechLedgerImportSqlChecks } = await import('../test/speech-ledger-import.mjs');
    const imported = await runSpeechLedgerImportSqlChecks({ pool, restart }); pool = imported.pool;
    const { runPartnerTeamPostgresChecks } = await import('../test/partner-team-postgres.mjs');
    const { runPartnerBrandingPostgresChecks } = await import('../test/partner-branding-postgres.mjs');
    const partnerChecks = await runPartnerDatabaseQa({ adminPool: pool, pgPort, createPool: options => new Pool(options),
      restartCluster: restart, runChecks: async configuration => {
        const team = await runPartnerTeamPostgresChecks(configuration);
        const branding = await runPartnerBrandingPostgresChecks({ ...configuration, operatorPool: team.operatorPool, authPool: team.authPool });
        return { ...branding, checks: [...team.checks, ...branding.checks] };
      } });
    const { runRoulettePostgresChecks } = await import('../test/roulette-postgres.mjs');
    const roulette = await runRoulettePostgresChecks({pool,restart}); pool = roulette.pool;
    const integrationChecks = [...current.checks, ...imported.checks, ...partnerChecks, ...roulette.checks];
    if (JSON.stringify(await sourceHashes()) !== JSON.stringify(before)) throw new Error('isolated_qa_sources_changed_rerun_required');
    console.log(JSON.stringify({ acceptance: 'isolated-studio-sql-restart-https', postgres: 'localhost/studio_qa/postgres', retainedContractChecks, legacyChecks: existing.checks, integrationChecks, sourceHashes: before }, null, 2));
    await pool.end(); pool = null; await stop();
    return { legacyChecks: existing.checks, integrationChecks };
  } finally {
    try { await pool?.end(); } catch {}
    if (active && postgresBin) { await guarded(data); await run(join(postgresBin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], { env }); active = false; }
    if (active) throw new Error('isolated_qa_cleanup_refused_running_cluster');
    await guarded(root); await rm(root, { recursive: true, force: false });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = args.length === 1 && args[0] === '--download-postgres' ? { downloadPostgres: true }
    : args.length === 2 && args[0] === '--postgres-bin' ? { postgresBin: args[1] } : null;
  if (!options) { console.error('Usage: node tools/studio-isolated-qa.mjs --download-postgres | --postgres-bin /absolute/bin'); process.exitCode = 1; }
  else runIsolatedStudioQa(options).catch(error => { console.error(error.message); process.exitCode = 1; });
}
