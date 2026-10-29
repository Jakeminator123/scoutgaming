#!/usr/bin/env node
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyStudioMigrations, loadStudioMigrations, planStudioMigrations } from '../ops/neon-studio/migrations.mjs';
import { planGameMigrations } from '../ops/neon-game/migrations.mjs';

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

// Två ledgrar med egna nummer: Studios `croupier_studio.storage_migrations` (001–021) och
// spelets `croupier_game.storage_migrations` (product-v1, game-0NN-*). Studio 012 och spel 012
// är olika migreringar, så rapporten namnger dem `studio-NNN` och `game-NNN`.
const studioLabel = version => `studio-${version}`;

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
 * under 019). Required versions can never be left out. Only the explicit skips
 * and optional versions after the selection are deferred, so a version that
 * becomes pending after planning makes the runner refuse under its lock. */
export function selectPendingMigrations({ registry, pending, optionalPending, only, skip = [] }) {
  const pattern = /^[0-9]{3}$/;
  const refuse = (code, versions = []) => ({ ok: false, code, versions });
  if (!Array.isArray(registry) || !Array.isArray(only) || !only.length || !Array.isArray(skip)
    || [...only, ...skip].some(version => typeof version !== 'string' || !pattern.test(version))) return refuse('migration_check_selection_invalid');
  const repeated = [...only, ...skip].filter((version, position, all) => all.indexOf(version) !== position);
  if (repeated.length) return refuse('migration_check_selection_invalid', repeated);
  const index = new Map(registry.map((row, position) => [row.version, position]));
  const byOrder = versions => [...new Set(versions)].sort((a, b) => index.get(a) - index.get(b));
  const unknown = [...only, ...skip].filter(version => !index.has(version));
  if (unknown.length) return refuse('migration_check_selection_unknown', unknown);
  const waiting = new Set([...pending, ...optionalPending]);
  const notPending = only.filter(version => !waiting.has(version));
  if (notPending.length) return refuse('migration_check_selection_not_pending', byOrder(notPending));
  const last = Math.max(...only.map(version => index.get(version)));
  const skipRequired = skip.filter(version => !registry[index.get(version)].deploymentOptional);
  if (skipRequired.length) return refuse('migration_check_skip_required', byOrder(skipRequired));
  const skipInvalid = skip.filter(version => !optionalPending.includes(version) || index.get(version) > last);
  if (skipInvalid.length) return refuse('migration_check_skip_invalid', byOrder(skipInvalid));
  const requiredLeft = pending.filter(version => !only.includes(version));
  if (requiredLeft.length) return refuse('migration_check_required_pending', byOrder(requiredLeft));
  const unordered = [...waiting].filter(version => index.get(version) < last && !only.includes(version) && !skip.includes(version));
  if (unordered.length) return refuse('migration_check_selection_order', byOrder(unordered));
  const objects = version => { const row = registry[index.get(version)]; return [...row.tables, ...(row.fingerprintTables ?? [])]; };
  const conflicts = skip.filter(skipped => only.some(version => index.get(version) > index.get(skipped)
    && objects(version).some(name => objects(skipped).includes(name))));
  if (conflicts.length) return refuse('migration_check_skip_conflict', byOrder(conflicts));
  const selected = byOrder(only);
  const deferOptional = registry.filter(row => row.deploymentOptional && (skip.includes(row.version) || index.get(row.version) > last)).map(row => row.version);
  return { ok: true, selected, deferOptional };
}

function gameList(labels) {
  if (!Array.isArray(labels) || labels.some(label => typeof label !== 'string' || !/^game-(?:[0-9]{3}|[a-z][a-z0-9-]{0,62})$/.test(label))) return null;
  return [...labels];
}

function presentGame(state) {
  const applied = gameList(state?.applied), pending = gameList(state?.pending), optionalPending = gameList(state?.optionalPending ?? []);
  if (!applied || !pending || !optionalPending) return null;
  return { applied, pending, optionalPending, ready: pending.length === 0 };
}

function fail(code, versions = []) {
  return { database: null, role: null, applied: [], pending: [], ready: false, exitCode: 2, code, versions, message: null };
}

function failureCode(error) {
  const code = ['StudioStorageError', 'GameMigrationError'].includes(error?.name) ? error.code : undefined;
  return typeof code === 'string' && /^(?:studio|game_migration)_[a-z0-9_]+$/.test(code) ? code : 'migration_check_unreachable';
}

/** `game` är spel-ledgerns rapport när den lästs; den blockerar på samma sätt som Studio. */
function present(state, appliedNow, game) {
  const database = safeToken(state?.target?.database);
  const role = safeToken(state?.target?.role);
  const applied = versionList(state?.applied);
  const pending = versionList(state?.pending ?? state?.toApply);
  // Deployment-optional versions never block readiness, but the operator must see them to run --apply.
  const optionalPending = versionList(state?.optionalPending ?? []);
  if (!database || !role || !applied || !pending || !optionalPending) return null;
  const ready = pending.length === 0 && (game === undefined || game.ready);
  const report = { database, role, applied, pending, optionalPending, ready };
  if (game !== undefined) report.game = game;
  if (appliedNow !== undefined) {
    const now = versionList(appliedNow);
    if (!now) return null;
    report.appliedNow = now;
  }
  if (!ready) {
    const missing = [...pending.map(studioLabel), ...(game?.pending ?? [])];
    return { ...report, exitCode: 1, code: null, message: `Migration ${missing.join(', ')} saknas i måldatabasen. Kör migrationen innan deploy.` };
  }
  return { ...report, exitCode: 0, code: null, message: null };
}

/** Studio-ledgern läses alltid. Spel-ledgern läses när `planGame` anges (CLI:t anger alltid
 * planGameMigrations); `--apply`, `--only` och `--skip` gäller bara Studios versioner. */
export async function checkMigrationReadiness({ pool, directory, connectionString, plan = planStudioMigrations, apply = false, confirm = false,
  applyMigrations = applyStudioMigrations, only, skip, registry, onPlan, planGame } = {}) {
  if (connectionString !== undefined) {
    const guard = migrationDatabaseGuard(connectionString);
    if (!guard.ok) return fail(guard.code);
  }
  if (apply === true && confirm !== true) return fail('migration_check_confirm_required');
  if (only === undefined && skip !== undefined) return fail('migration_check_selection_invalid');
  let planned;
  try { planned = await plan({ pool, directory }); } catch (error) { return fail(failureCode(error)); }
  let game;
  if (planGame !== undefined) {
    if (typeof planGame !== 'function') return fail('migration_check_unreachable');
    try { game = presentGame(await planGame({ pool })); } catch (error) { return fail(failureCode(error)); }
    if (!game) return fail('migration_check_unreachable');
  }
  const report = present(planned, undefined, game);
  if (!report) return fail('migration_check_unreachable');
  if (apply !== true && only === undefined) return report;
  let sources;
  try { sources = registry ?? await loadStudioMigrations({ directory }); } catch (error) { return fail(failureCode(error)); }
  let selected = sources.map(row => row.version).filter(version => report.pending.includes(version) || report.optionalPending.includes(version));
  let deferOptional = [];
  if (only !== undefined) {
    const selection = selectPendingMigrations({ registry: sources, pending: report.pending, optionalPending: report.optionalPending, only, skip });
    if (!selection.ok) return fail(selection.code, selection.versions);
    ({ selected, deferOptional } = selection);
    if (apply !== true) return { ...report, selected };
  }
  // The printed list is the exact list: the runner refuses any other pending set under its lock.
  if (typeof onPlan === 'function') onPlan(selected);
  let applied;
  try { applied = await applyMigrations({ pool, expectedTarget: planned?.target, confirm: true, deferOptional, expectedVersions: selected }); }
  catch (error) { return fail(failureCode(error)); }
  const result = present(applied, applied?.appliedNow ?? [], game);
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

/** Rapportraden: båda ledgrarna i samma listor, namngivna `studio-NNN` och `game-NNN`. */
export function readinessOutput(result, { only, apply = false } = {}) {
  const game = result.game ?? { applied: [], pending: [], optionalPending: [] };
  const output = { database: result.database, role: result.role,
    applied: [...result.applied.map(studioLabel), ...game.applied],
    pending: [...result.pending.map(studioLabel), ...game.pending],
    optionalPending: [...result.optionalPending.map(studioLabel), ...game.optionalPending],
    ready: result.ready };
  if (only !== undefined) output.selected = (result.selected ?? []).map(studioLabel);
  if (apply) output.appliedNow = (result.appliedNow ?? []).map(studioLabel);
  return output;
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
    const result = await checkMigrationReadiness({ pool, apply, confirm: apply && confirmed, only, skip, onPlan, planGame: planGameMigrations });
    if (result.exitCode === 2) {
      const named = Array.isArray(result.versions) && result.versions.length && result.versions.every(version => /^[0-9]{3}$/.test(version))
        ? `${result.code} ${result.versions.join(',')}` : result.code;
      console.error(safeLine(named) ? named : 'migration_check_unreachable');
      code = 2;
    } else {
      const line = JSON.stringify(readinessOutput(result, { only, apply }));
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
