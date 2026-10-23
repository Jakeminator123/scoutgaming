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
  'services/game/moving-drift-executor.mjs','services/game/moving-drift-observer.mjs',
  'services/game/moving-drift-diagnostics.mjs',
  'test/fixtures/moving-drift-executor-sql-checks.mjs',
  'packages/presentation/contracts/moving-drift-admin.mjs','apps/studio/lib/moving-drift-admin.mjs',
  'apps/studio/test/moving-drift-admin.test.mjs',
  'packages/presentation/contracts/moving-drift.mjs', 'services/game/moving-drift-controller.mjs',
  'services/game/postgres-moving-drift.mjs', 'ops/neon-studio/016-moving-drift-control.sql', 'test/postgres-moving-drift.mjs',
  'packages/operators/server/public-rooms.mjs',
  'packages/presentation/server/studio-policy-runtime.mjs',
  'packages/presentation/capability-contract.mjs',
  'packages/shared/blackjack-shoe-rules.mjs',
  'packages/presentation/server/generated-speech-provider.mjs','packages/presentation/contracts/speech-package.mjs','packages/presentation/contracts/astrid-voice-profile.mjs','packages/presentation/server/generated-speech-service.mjs','packages/presentation/server/generated-speech-runtime.mjs','packages/presentation/server/speech-journal-lease.mjs',
      "services/game/storage/legacy-clip-inventory.mjs",
      "services/game/storage/video-registry.mjs",
      "services/game/storage/studio-media-runtime.mjs",
      "packages/presentation/server/legacy-clip-inventory.mjs",
      "packages/studio-registry/server/local-video-readers.mjs",
      "packages/studio-registry/server/media-runtime.mjs",
      'packages/studio-registry/server/blob-reader.mjs', 'packages/studio-registry/server/managed-media-contract.mjs', 'packages/studio-registry/server/media-blob-index.mjs', 'packages/studio-registry/server/media-layout.mjs', 'packages/studio-registry/server/private-media-contract.mjs', 'packages/studio-registry/server/registry-core.mjs', 'packages/studio-registry/server/registry-reader.mjs', 'packages/studio-registry/server/storage-contract.mjs', 'packages/studio-registry/server/video-dealer-registration.mjs', 'packages/studio-registry/server/video-manifest.mjs', 'tools/media-blob-index-reader.mjs', 'apps/studio/lib/video-local-readers.mjs', 'services/game/blob-media.mjs', 'services/game/media-blob-index.mjs', 'services/game/package.json', 'services/game/package-lock.json',

      'packages/director/admin-error.mjs',
      'packages/director/astrid-observation.mjs',
      'packages/director/companion-personas.mjs',
      'packages/director/companion-search.mjs',
      'packages/director/companion.mjs',
      'packages/director/configuration.mjs',
      'packages/director/conversation-memory.mjs',
      'packages/director/dashboard-handoff-contract.mjs',
      'packages/director/engine.mjs',
      'packages/director/openclaw.mjs',
      'packages/director/product-probe.mjs',
      'packages/director/product-speech.mjs',
      'packages/director/generated-speech-text.mjs',
      'packages/director/social.mjs',
      'packages/director/speech-routing.mjs',
      'packages/director/studio-admin-contract.mjs',
      'packages/director/node/companion-store.mjs',
    'packages/director/node/settings-reader.mjs',
      'apps/studio/lib/director-settings.mjs',
      'services/game/director-settings.mjs',
      'services/openclaw/lab/src/settings.mjs',

      'services/game/moving-speech-limits.mjs',
      'services/game/moving-speech-timing.mjs',
      'services/game/moving-speech-capacity.mjs','test/fixtures/moving-capacity.mjs',
      'ops/neon-studio/015-moving-budget-capacity.sql',
      'ops/neon-studio/017-moving-budget-capacity.sql',
      'ops/neon-studio/014-moving-speech-budget-amendments.sql','services/game/moving-speech-budget.mjs','test/fixtures/moving-budget-sql-checks.mjs',
      'ops/neon-studio/013-moving-speech-admission.sql','services/game/moving-speech-binding.mjs','services/game/moving-speech-session.mjs','services/game/moving-speech-transport.mjs',
      'ops/neon-studio/012-runtime-media-catalog.sql', 'test/fixtures/studio-runtime-sql-checks.mjs', 'test/fixtures/runtime-media-catalog.mjs',
      'ops/neon-studio/runtime-media-import.mjs', 'tools/media-layout.mjs',
      'packages/studio-registry/server/runtime-catalog.mjs', 'packages/presentation/server/speech-reply-repository.mjs', 'packages/presentation/server/speech-reply-library.mjs',
      'media/layout.json', 'media/blob-index.json', 'media/catalog/presentation.json', 'media/catalog/legacy.json',
      'packages/studio-access/studio-native-auth.mjs', 'packages/studio-access/studio-access-policy.mjs', 'packages/studio-access/studio-scope.mjs', 'packages/studio-access/account-role.mjs',
      'ops/neon-studio/007-partner-branding-drafts.sql', 'test/partner-branding-postgres.mjs', 'apps/studio/test/fixtures/cloud-presentation.mjs',
      'apps/studio/lib/partner-branding-api.mjs', 'apps/studio/lib/partner-presentation-choices.mjs', 'apps/studio/lib/partner-package-view.mjs',
      'packages/operators/contracts/branding.mjs', 'packages/presentation/server/game-entry-selector.mjs', 'services/game/operator-appearance-api.mjs',
      'packages/navigation/operator-entry.mjs', 'packages/navigation/operator-slug.mjs',
      'services/game/public/operator-appearance-boundary.mjs', 'packages/presentation/server/frozen-dealer-presentation.mjs', 'packages/presentation/runtime/player-choices.mjs',
      'packages/presentation/server/presentation-package.mjs', 'packages/presentation/server/frozen-presentation-capture.mjs', 'packages/presentation/server/frozen-dealer-idle.mjs',
      'packages/presentation/server/package-rooms.mjs', 'packages/presentation/contracts/game-selection.mjs', 'packages/presentation/contracts/composition-settings.mjs',
      'packages/presentation/contracts/presentation-layers.mjs', 'packages/presentation/contracts/studio-model.mjs',
      'packages/presentation/contracts/game-lane-id.mjs', 'packages/presentation/contracts/presentation-room.mjs',
      'packages/presentation/contracts/operator-lifecycle-key.mjs', 'packages/presentation/server/registered-dealer-idle.mjs',
      'packages/presentation/public-modules.mjs', 'packages/presentation/server/registered-idle-rules.mjs',
      'packages/navigation/game-entry.mjs', 'packages/navigation/server/platform-routing.mjs',
      'packages/navigation/admin-workspace-routes.mjs', 'packages/navigation/workspace-surfaces.mjs',
      'packages/server-transport/paths.mjs', 'packages/server-transport/configuration.mjs',
      'packages/shared/studio-error.mjs', 'packages/presentation/server/selection.mjs', 'packages/presentation/server/video-bindings.mjs',
      'apps/studio/lib/presentation-selection.mjs', 'packages/presentation/server/default-video-bindings.mjs',
    'packages/presentation/server/director-transport.mjs', 'packages/presentation/server/idle-advice.mjs',
    'packages/presentation/contracts/probe-fixtures.mjs', 'services/game/presentation-selection.mjs', 'apps/studio/lib/studio-director.mjs',
      'ops/neon-game/007-roulette-tables.sql', 'test/roulette-postgres.mjs', 'services/game/games/roulette/room.mjs', 'services/game/games/roulette/storage.mjs', 'services/game/games/roulette/access.mjs', 'services/game/games/roulette/index.mjs', 'services/game/games/roulette/rules.mjs',
      'ops/neon-game/product-schema.sql', 'ops/neon-studio/001-studio-metadata.sql', 'ops/neon-studio/002-generation-journals.sql', 'ops/neon-studio/003-operator-speech-qa.sql', 'ops/neon-studio/004-fullfile-reservations.sql', 'ops/neon-studio/005-operators.sql', 'ops/neon-studio/006-operator-audit.sql',
      'test/partner-team-postgres.mjs', 'test/studio-isolated-partner-qa.mjs', 'apps/studio/lib/partner-session.mjs', 'apps/studio/lib/partner-team-api.mjs', 'apps/studio/lib/operator-audit-context.mjs', 'apps/studio/lib/operator-admin-api.mjs', 'apps/studio/lib/operator-journal.mjs',
      'ops/neon-studio/011-gpu-daily-budget.sql', 'ops/neon-studio/migrations.mjs', 'packages/operators/server/operator-store.mjs', 'ops/neon-studio/speech-ledger-snapshot.mjs', 'ops/neon-studio/speech-ledger-import.mjs', 'test/speech-ledger-import.mjs',
      'packages/studio-access/server/account-credentials.mjs', 'packages/studio-access/server/craig-identity.mjs', 'packages/studio-access/server/bo-auth-epoch.mjs', 'packages/studio-access/server/partner-access-policy.mjs',
      'packages/studio-access/display-name.mjs',
      'packages/storage/server/postgres-store.mjs', 'packages/operators/server/operator-lifecycle.mjs', 'packages/presentation/contracts/game-lanes.mjs',
      'packages/studio-registry/server/repository.mjs',
      'services/game/storage/postgres-store.mjs', 'packages/studio-registry/server/document-contract.mjs', 'packages/studio-registry/server/stored-media-types.mjs', 'packages/shared/media-file-types.mjs', 'packages/studio-registry/server/document-repository.mjs', 'packages/presentation/server/saved-game-policy.mjs', 'services/game/storage/studio-runtime.mjs',
      'ops/neon-studio/retained-bank.mjs', 'test/studio-retained-bank.mjs',
      'packages/storage/server/player-administration.mjs', 'services/game/studio-game-commands.mjs', 'packages/shared/studio-game-command.mjs', 'apps/studio/lib/studio-game-authority.mjs',
      'apps/studio/lib/studio-native-auth-actions.mjs', 'apps/studio/lib/studio-admin-accounts.mjs', 'apps/studio/lib/studio-admin-data.mjs', 'apps/studio/lib/studio-admin-api.mjs', 'apps/studio/lib/studio-document-api.mjs',
      'apps/studio/lib/studio-admin-readouts.mjs', 'apps/studio/lib/studio-voice-lines.mjs', 'apps/studio/lib/studio-access-policy.mjs', 'apps/studio/lib/studio-admin-contract.mjs',
      'apps/studio/lib/voice-preview.mjs', 'apps/studio/lib/media-blob-index.mjs', 'services/game/shoe-game.mjs', 'packages/shared/email-templates.mjs', 'packages/presentation/contracts/speech-lines.mjs',
      'services/game/postgres-speech-journal.mjs', 'services/game/speech-journal-runtime.mjs', 'packages/presentation/contracts/speech-journal-constants.mjs', 'services/game/generated-speech-session.mjs', 'services/game/generated-speech-stream.mjs', 'services/game/generated-speech-runtime.mjs',
      'services/game/speech-blob-artifacts.mjs', 'services/game/postgres-operator-speech-qa.mjs', 'apps/studio/lib/cloud-media-store.mjs', 'test/studio-postgres-integration.mjs', 'test/studio-cutover-integration.mjs', 'tools/studio-isolated-qa.mjs']);

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

export async function runIsolatedStudioQa({ postgresBin, downloadPostgres = false, movingDriftOnly = false } = {}) {
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
    const { Pool } = createRequire(new URL('../services/game/package.json', import.meta.url))('pg');
    const open = (max=8) => new Pool({ connectionString: `postgresql://studio_qa@127.0.0.1:${pgPort}/postgres`, max, connectionTimeoutMillis: 5000, query_timeout: 15000 });
    await start(); pool = open();
    const restart = async () => { await pool.end(); await stop(); await start(); pool = open(); return pool; };
    if (movingDriftOnly) {
      const {loadStudioMigrations,planStudioMigrations} = await import('../ops/neon-studio/migrations.mjs');
      const driftSources = [...STUDIO_ISOLATED_QA_SOURCES,'packages/presentation/contracts/moving-drift.mjs','services/game/moving-drift-controller.mjs',
        'services/game/postgres-moving-drift.mjs','test/postgres-moving-drift.mjs','test/fixtures/moving-budget-sql-checks.mjs',
        'tools/studio-isolated-qa.mjs','ops/neon-studio/migrations.mjs',
        ...(await loadStudioMigrations()).map(row=>'ops/neon-studio/'+row.file)];
      const sourceDigest = async () => createHash('sha256').update((await Promise.all(driftSources.map(file=>readFile(join(repository,file))))).map(bytes=>createHash('sha256').update(bytes).digest('hex')).join('\n')).digest('hex');
      const before = await sourceDigest();
      const initial = await planStudioMigrations({pool});
      if (initial.schemaPresent) throw new Error('isolated_drift_fixture_not_empty');
      const {runMovingBudgetMigrationSqlChecks,runMovingDriftMigrationAfterBudgetSqlChecks} = await import('../test/fixtures/moving-budget-sql-checks.mjs');
      await runMovingBudgetMigrationSqlChecks({pool});
      if (JSON.stringify(await planStudioMigrations({pool})) !== JSON.stringify(initial)) throw new Error('isolated_drift_historical_fixture_not_rolled_back');
      const migration = await runMovingDriftMigrationAfterBudgetSqlChecks({pool,restart}); pool = migration.pool;
      const productSql=(await readFile(join(repository,'ops/neon-game/product-schema.sql'),'utf8')).replace(/\r\n/g,'\n');
      await pool.query(productSql);
      await pool.query('INSERT INTO croupier_game.storage_migrations(version,checksum,source_hashes,applied_at) VALUES ($1,$2,$3,$4)',
        ['product-v1',createHash('sha256').update(productSql).digest('hex'),'{}',new Date().toISOString()]);
      const {runMovingDriftPostgresChecks} = await import('../test/postgres-moving-drift.mjs');
      const drift = await runMovingDriftPostgresChecks({pool,restart,createPool:()=>open(1)}); pool = drift.pool;
      const {runMovingDriftExecutorSqlChecks}=await import('../test/fixtures/moving-drift-executor-sql-checks.mjs');
      const execution=await runMovingDriftExecutorSqlChecks({pool});
      if (await sourceDigest() !== before) throw new Error('isolated_qa_sources_changed_rerun_required');
      const integrationChecks = ['drift-historical014-015-017-rollback',...migration.checks,...drift.checks,...execution.checks];
      console.log(JSON.stringify({acceptance:'isolated-moving-drift-sql-restart',sourceDigest:before,checks:integrationChecks}));
      return {integrationChecks};
    }
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
    const {runMovingDriftPostgresChecks} = await import('../test/postgres-moving-drift.mjs');
    const drift = await runMovingDriftPostgresChecks({pool,restart,createPool:()=>open(1)}); pool = drift.pool;
    const {runMovingDriftExecutorSqlChecks}=await import('../test/fixtures/moving-drift-executor-sql-checks.mjs');
    const execution=await runMovingDriftExecutorSqlChecks({pool});
    const integrationChecks = [...current.checks, ...imported.checks, ...partnerChecks, ...roulette.checks, ...drift.checks,...execution.checks];
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
  const movingDriftOnly = args.includes('--moving-drift');
  if (movingDriftOnly) args.splice(args.indexOf('--moving-drift'),1);
  const options = args.length === 1 && args[0] === '--download-postgres' ? { downloadPostgres: true }
    : args.length === 2 && args[0] === '--postgres-bin' ? { postgresBin: args[1] } : null;
  if (!options) { console.error('Usage: node tools/studio-isolated-qa.mjs [--moving-drift] --download-postgres | --postgres-bin /absolute/bin'); process.exitCode = 1; }
  else runIsolatedStudioQa({...options,movingDriftOnly}).catch(error => { console.error(error.message); process.exitCode = 1; });
}
