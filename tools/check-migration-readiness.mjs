#!/usr/bin/env node
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyStudioMigrations, planStudioMigrations } from '../ops/neon-studio/migrations.mjs';

const requireLab = createRequire(new URL('../lab/package.json', import.meta.url));

export function migrationDatabaseGuard(connectionString) {
  if (typeof connectionString !== 'string' || connectionString.length === 0 || connectionString.length > 4096) {
    return { ok: false, code: 'migration_check_unconfigured' };
  }
  let url;
  try { url = new URL(connectionString); } catch { return { ok: false, code: 'migration_check_unconfigured' }; }
  const host = url.hostname;
  const neon = typeof host === 'string' && host.length > '.neon.tech'.length && host.endsWith('.neon.tech') && /^[a-z0-9.-]+$/i.test(host);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !neon) return { ok: false, code: 'migration_check_host_rejected' };
  return { ok: true };
}

function safeToken(value) {
  return typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(value) ? value : null;
}

function versionList(rows) {
  if (!Array.isArray(rows)) return null;
  const versions = [];
  for (const row of rows) {
    const version = typeof row === 'string' ? row : row && typeof row === 'object' ? row.version : undefined;
    if (typeof version !== 'string' || !/^[0-9]{3}$/.test(version)) return null;
    versions.push(version);
  }
  return versions;
}

function fail(code) {
  return { database: null, role: null, applied: [], pending: [], ready: false, exitCode: 2, code, message: null };
}

function failureCode(error) {
  const code = error?.name === 'StudioStorageError' ? error.code : undefined;
  return typeof code === 'string' && /^studio_[a-z0-9_]+$/.test(code) ? code : 'migration_check_unreachable';
}

function present(state, appliedNow) {
  const database = safeToken(state?.target?.database);
  const role = safeToken(state?.target?.role);
  const applied = versionList(state?.applied);
  const pending = versionList(state?.pending ?? state?.toApply);
  if (!database || !role || !applied || !pending) return null;
  const ready = pending.length === 0;
  const report = { database, role, applied, pending, ready };
  if (appliedNow !== undefined) {
    const now = versionList(appliedNow);
    if (!now) return null;
    report.appliedNow = now;
  }
  if (!ready) {
    return { ...report, exitCode: 1, code: null, message: `Migration ${pending.join(', ')} saknas i måldatabasen. Kör migrationen innan deploy.` };
  }
  return { ...report, exitCode: 0, code: null, message: null };
}

export async function checkMigrationReadiness({ pool, directory, connectionString, plan = planStudioMigrations, apply = false, confirm = false, applyMigrations = applyStudioMigrations } = {}) {
  if (connectionString !== undefined) {
    const guard = migrationDatabaseGuard(connectionString);
    if (!guard.ok) return fail(guard.code);
  }
  if (apply === true && confirm !== true) return fail('migration_check_confirm_required');
  let planned;
  try { planned = await plan({ pool, directory }); } catch (error) { return fail(failureCode(error)); }
  if (apply !== true) return present(planned) ?? fail('migration_check_unreachable');
  let applied;
  try { applied = await applyMigrations({ pool, expectedTarget: planned?.target, confirm: true }); }
  catch (error) { return fail(failureCode(error)); }
  return present(applied, applied?.appliedNow ?? []) ?? fail('migration_check_unreachable');
}

function safeLine(text) {
  return typeof text === 'string' && text.length > 0 && !text.includes('postgres://') && !text.includes('@') && !text.includes('\n') && !text.includes('\r');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) {
    console.error('migration_check_usage');
    process.exit(2);
  }
  const apply = args.includes('--apply');
  const connectionString = process.env.CROUPIER_GAME_DATABASE_URL;
  const confirmed = process.env.CROUPIER_MIGRATION_CONFIRM === 'apply-pending';
  const guard = migrationDatabaseGuard(connectionString);
  if (!guard.ok) {
    console.error(guard.code);
    process.exit(2);
  }
  if (apply && !confirmed) {
    console.error('migration_check_confirm_required');
    process.exit(2);
  }
  let pool;
  let code = 2;
  try {
    const { Pool } = requireLab('@neondatabase/serverless');
    pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
    const result = await checkMigrationReadiness({ pool, apply, confirm: apply && confirmed });
    if (result.exitCode === 2) {
      console.error(safeLine(result.code) ? result.code : 'migration_check_unreachable');
      code = 2;
    } else {
      const output = { database: result.database, role: result.role, applied: result.applied, pending: result.pending, ready: result.ready };
      if (apply) output.appliedNow = result.appliedNow ?? [];
      const line = JSON.stringify(output);
      if (!safeLine(line)) {
        console.error('migration_check_unreachable');
        code = 2;
      } else if (result.exitCode === 1 && safeLine(result.message)) {
        console.log(line);
        console.error(result.message);
        code = 1;
      } else if (result.exitCode === 0) {
        console.log(line);
        code = 0;
      } else {
        console.error('migration_check_unreachable');
        code = 2;
      }
    }
  } catch {
    console.error('migration_check_unreachable');
    code = 2;
  } finally {
    if (pool) {
      try { await pool.end(); } catch { /* Never print driver shutdown details. */ }
    }
  }
  process.exit(code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error('migration_check_unreachable');
    process.exit(2);
  });
}
