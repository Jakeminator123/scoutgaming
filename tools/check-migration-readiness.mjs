#!/usr/bin/env node
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyStudioMigrations, loadStudioMigrations, planStudioMigrations } from '../ops/neon-studio/migrations.mjs';

const requireLab = createRequire(new URL('../apps/studio/package.json', import.meta.url));

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

/** Choose exactly the operator's pending versions, in registry order.
 * The registry declares no dependencies, so order is the dependency: every
 * pending version before the last selected one must be selected too, or be an
 * optional version explicitly skipped that shares no table with a later
 * selected version (019 widens the same CHECK as 018, so 018 cannot be skipped
 * under 019). Required versions can never be left out. */
export function selectPendingMigrations({ registry, pending, optionalPending, only, skip = [] }) {
  const pattern = /^[0-9]{3}$/;
  if (!Array.isArray(registry) || !Array.isArray(only) || !only.length || !Array.isArray(skip)
    || [...only, ...skip].some(version => typeof version !== 'string' || !pattern.test(version))
    || new Set([...only, ...skip]).size !== only.length + skip.length) return { ok: false, code: 'migration_check_selection_invalid' };
  const index = new Map(registry.map((row, position) => [row.version, position]));
  if ([...only, ...skip].some(version => !index.has(version))) return { ok: false, code: 'migration_check_selection_unknown' };
  const waiting = new Set([...pending, ...optionalPending]);
  if (only.some(version => !waiting.has(version))) return { ok: false, code: 'migration_check_selection_not_pending' };
  const last = Math.max(...only.map(version => index.get(version)));
  if (skip.some(version => !optionalPending.includes(version) || index.get(version) > last)) return { ok: false, code: 'migration_check_skip_invalid' };
  if (pending.some(version => !only.includes(version))
    || [...waiting].some(version => index.get(version) < last && !only.includes(version) && !skip.includes(version))) {
    return { ok: false, code: 'migration_check_selection_order' };
  }
  const objects = version => { const row = registry[index.get(version)]; return [...row.tables, ...(row.fingerprintTables ?? [])]; };
  for (const skipped of skip) {
    const touched = objects(skipped);
    if (only.some(version => index.get(version) > index.get(skipped) && objects(version).some(name => touched.includes(name)))) {
      return { ok: false, code: 'migration_check_skip_conflict' };
    }
  }
  const selected = registry.map(row => row.version).filter(version => only.includes(version));
  const deferOptional = registry.filter(row => row.deploymentOptional && !only.includes(row.version)).map(row => row.version);
  return { ok: true, selected, deferOptional };
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
  // Deployment-optional versions never block readiness, but the operator must see them to run --apply.
  const optionalPending = versionList(state?.optionalPending ?? []);
  if (!database || !role || !applied || !pending || !optionalPending) return null;
  const ready = pending.length === 0;
  const report = { database, role, applied, pending, optionalPending, ready };
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

export async function checkMigrationReadiness({ pool, directory, connectionString, plan = planStudioMigrations, apply = false, confirm = false,
  applyMigrations = applyStudioMigrations, only, skip, registry, onPlan } = {}) {
  if (connectionString !== undefined) {
    const guard = migrationDatabaseGuard(connectionString);
    if (!guard.ok) return fail(guard.code);
  }
  if (apply === true && confirm !== true) return fail('migration_check_confirm_required');
  if (only === undefined && skip !== undefined) return fail('migration_check_selection_invalid');
  let planned;
  try { planned = await plan({ pool, directory }); } catch (error) { return fail(failureCode(error)); }
  const report = present(planned);
  if (!report) return fail('migration_check_unreachable');
  if (apply !== true && only === undefined) return report;
  let sources;
  try { sources = registry ?? await loadStudioMigrations({ directory }); } catch (error) { return fail(failureCode(error)); }
  let selected = sources.map(row => row.version).filter(version => report.pending.includes(version) || report.optionalPending.includes(version));
  let deferOptional = [];
  if (only !== undefined) {
    const selection = selectPendingMigrations({ registry: sources, pending: report.pending, optionalPending: report.optionalPending, only, skip });
    if (!selection.ok) return fail(selection.code);
    ({ selected, deferOptional } = selection);
    if (apply !== true) return { ...report, selected };
  }
  // The printed list is the exact list: the runner refuses any other pending set under its lock.
  if (typeof onPlan === 'function') onPlan(selected);
  let applied;
  try { applied = await applyMigrations({ pool, expectedTarget: planned?.target, confirm: true, deferOptional, expectedVersions: selected }); }
  catch (error) { return fail(failureCode(error)); }
  const result = present(applied, applied?.appliedNow ?? []);
  return result ? { ...result, selected } : fail('migration_check_unreachable');
}

/** Parse `--apply`, `--only <v>[,<v>]` and `--skip <v>[,<v>]` (repeatable, or `--only=<v>`). */
export function parseMigrationArgs(args) {
  let apply = false, only, skip;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--apply') { if (apply) return null; apply = true; continue; }
    const match = /^--(only|skip)(?:=(.*))?$/.exec(arg);
    if (!match) return null;
    const value = match[2] ?? args[++index];
    if (typeof value !== 'string' || !/^[0-9]{3}(?:,[0-9]{3})*$/.test(value)) return null;
    const list = value.split(',');
    if (match[1] === 'only') only = [...(only ?? []), ...list]; else skip = [...(skip ?? []), ...list];
  }
  if (skip !== undefined && only === undefined) return null;
  return { apply, only, skip };
}

function safeLine(text) {
  return typeof text === 'string' && text.length > 0 && !text.includes('postgres://') && !text.includes('@') && !text.includes('\n') && !text.includes('\r');
}

async function main() {
  const parsed = parseMigrationArgs(process.argv.slice(2));
  if (!parsed) {
    console.error('migration_check_usage');
    process.exit(2);
  }
  const { apply, only, skip } = parsed;
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
    const onPlan = versions => console.error(`migration_apply_plan ${versions.length ? versions.join(',') : 'none'}`);
    const result = await checkMigrationReadiness({ pool, apply, confirm: apply && confirmed, only, skip, onPlan });
    if (result.exitCode === 2) {
      console.error(safeLine(result.code) ? result.code : 'migration_check_unreachable');
      code = 2;
    } else {
      const output = { database: result.database, role: result.role, applied: result.applied, pending: result.pending, optionalPending: result.optionalPending, ready: result.ready };
      if (only !== undefined) output.selected = result.selected ?? [];
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
