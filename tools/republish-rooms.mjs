#!/usr/bin/env node
// Publish a new revision through the product writer; never update historical package rows.
// Dry run is the default. Only --apply plus an exact database/scope confirmation may write.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOperatorStore } from '../packages/operators/server/operator-store.mjs';
import { packageRoomsFor } from '../packages/presentation/server/package-rooms.mjs';
import { migrationDatabaseGuard } from './check-migration-readiness.mjs';

export const REPUBLISH_ROOMS_ACTOR = 'tools/republish-rooms';
export const PACKAGE_ROOMS_STORAGE_VERSION = '023';
export const REPUBLISH_ROOMS_USAGE = `Användning: node tools/republish-rooms.mjs [--dry-run | --apply] [--operator <id>]

Publicerar om varje bolag vars nuvarande paket saknar rooms (Studio 023, plan L3) som en ny
paketversion (pkg+1). rooms är bolagets bord i administrationsdokumentet, i dokumentets ordning.
Gamla paketversioner ändras aldrig. En andra körning publicerar inget.

  --dry-run        standard: listar bolagen, skriver inget och kör inte publishWithin
  --apply          skriver bara med CROUPIER_REPUBLISH_CONFIRM=<databas>/<environment>/<workspace>
  --operator <id>  bara bolaget med detta id
  --help           den här texten

Miljö: CROUPIER_GAME_DATABASE_URL (Neon), CROUPIER_STUDIO_ENVIRONMENT_ID och
CROUPIER_STUDIO_WORKSPACE_ID. Studio 023 måste stå i ledgern och rooms-kolumnen måste finnas.
Målraden skrivs före arbetet; varje bolags resultat skrivs direkt. Provkörningen garanterar inte
att produktens publiceringskontroller godkänner en senare skarp körning.

Varje pkg+1 ger bolagets anslutna spelare 1008 och en ny socket. Kontrollera därför att borden
är tomma före --apply. Bolagets öppna utseendeutkast följer med till den nya versionen.
Spelinställningsutkast som byggde på den gamla versionen följer inte med; de sparas om i Admin.
Ordning: preview först (--dry-run, sedan --apply), därefter produktionen.
Exit 0: klar (även överhoppade bolag); 1: minst ett bolag misslyckades; 2: nekad/avbruten körning.`;

const MESSAGES = Object.freeze({
  republish_rooms_usage: 'Ogiltiga flaggor. Se node tools/republish-rooms.mjs --help.',
  republish_rooms_scope_required: 'CROUPIER_STUDIO_ENVIRONMENT_ID och CROUPIER_STUDIO_WORKSPACE_ID krävs.',
  republish_rooms_database_required: 'CROUPIER_GAME_DATABASE_URL krävs.',
  republish_rooms_host_rejected: 'CROUPIER_GAME_DATABASE_URL måste peka på en Neon-värd.',
  republish_rooms_confirm_required: 'Skarp körning kräver CROUPIER_REPUBLISH_CONFIRM=<databas>/<environment>/<workspace> för det lästa målet.',
  republish_rooms_migration_required: 'Studio 023 saknas i ledgern, inget är skrivet. Kör först node tools/check-migration-readiness.mjs --apply --only 023 (med --skip för väntande valfria före den).',
  republish_rooms_column_required: 'rooms-kolumnen saknas trots Studio 023 i ledgern, inget är skrivet.',
  republish_rooms_operator_not_found: 'Inget bolag med det id:t i scopet, inget är skrivet.',
  republish_rooms_not_written: 'Paketet skrevs utan rooms trots Studio 023 i ledgern. Körningen stoppades.',
  republish_rooms_operator_changed: 'Bolagets adress pekar på ett annat bolag än vid läsningen.',
  republish_rooms_unreachable: 'Databasen gick inte att läsa.',
});
const refuse = code => Object.assign(new Error(code), { code });
const token = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value) ? value : null;
const failureCode = error => typeof error?.code === 'string' && /^(?:studio|republish_rooms)_[a-z0-9_]+$/.test(error.code) ? error.code : 'republish_rooms_failed';

export function parseRepublishArguments(argv) {
  if (argv.length === 1 && argv[0] === '--help') return { help: true, dryRun: true, operatorId: null };
  const options = { help: false, dryRun: true, operatorId: null };
  let modeSeen = false;
  for (let index = 0; index < argv.length; index++) {
    if (['--dry-run', '--apply'].includes(argv[index]) && !modeSeen) {
      modeSeen = true;
      options.dryRun = argv[index] === '--dry-run';
    } else if (argv[index] === '--operator' && options.operatorId === null && token(argv[index + 1])) options.operatorId = argv[++index];
    else throw refuse('republish_rooms_usage');
  }
  return options;
}

export function republishScope(env = process.env) {
  const environment = env.CROUPIER_STUDIO_ENVIRONMENT_ID, workspaceId = env.CROUPIER_STUDIO_WORKSPACE_ID;
  if (!token(environment) || !token(workspaceId)) throw refuse('republish_rooms_scope_required');
  return { environment, workspaceId };
}

async function first(pool, text, values) {
  let result;
  try { result = await pool.query(text, values); } catch { throw refuse('republish_rooms_unreachable'); }
  return result?.rows?.[0] ?? null;
}

const targetLine = result => `republish-rooms: databas ${result.target.database ?? '?'}, roll ${result.target.role ?? '?'}, scope ${result.scope.environment}/${result.scope.workspaceId}, ${result.dryRun ? 'provkörning (--dry-run), inget skrivs' : 'skarp körning'}`;
const summaryLine = result => `summa: ${result.published.length} ${result.dryRun ? 'skulle publiceras' : 'publicerade'}, ${result.skipped.length} hoppades över, ${result.failed.length} misslyckades`;
function entryLines(kind, row, dryRun) {
  const name = `${row.slug} (${row.operatorId})`;
  if (kind === 'failed') return [`misslyckades: ${name}: paket ${row.fromRevision ?? '?'}: ${row.code}`];
  if (kind === 'skipped') return [`hoppas över: ${name}: paket ${row.fromRevision}, ${row.tables} bord: rooms går inte att härleda ur administrationsdokumentet`];
  return [`${dryRun ? 'skulle publiceras' : 'publicerat'}: ${name}: paket ${row.fromRevision} → ${row.toRevision}, ${row.tables} bord`,
    ...(row.settingsDrafts ? [`  obs: ${row.settingsDrafts} spelinställningsutkast byggde på paket ${row.fromRevision} och sparas om i Admin`] : [])];
}

/** A failed company does not stop the others. expectedRevision protects the snapshot against Admin
 * publishing before the writer acquires its lock. A dry run never enters that writer. */
export async function republishRooms({ pool, scope, dryRun = true, confirm, operatorId = null, now = Date.now, onLine = () => {}, signal } = {}) {
  scope = republishScope({ CROUPIER_STUDIO_ENVIRONMENT_ID: scope?.environment, CROUPIER_STUDIO_WORKSPACE_ID: scope?.workspaceId });
  const target = await first(pool, '/* republish-rooms:target */ SELECT current_database() AS database, current_user AS role');
  const result = { target: { database: token(target?.database), role: token(target?.role) },
    scope, dryRun, published: [], skipped: [], failed: [] };
  onLine(targetLine(result));
  if (!result.target.database || !result.target.role) throw refuse('republish_rooms_unreachable');
  if (!dryRun && confirm !== `${result.target.database}/${scope.environment}/${scope.workspaceId}`) throw refuse('republish_rooms_confirm_required');
  const ledger = await first(pool, `/* republish-rooms:ledger */ SELECT count(*)::integer AS ledgered
    FROM croupier_studio.storage_migrations WHERE version=$1`, [PACKAGE_ROOMS_STORAGE_VERSION]);
  if (Number(ledger?.ledgered) !== 1) throw refuse('republish_rooms_migration_required');
  const column = await first(pool, `/* republish-rooms:column */ SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='croupier_studio' AND table_name='operator_packages' AND column_name='rooms') AS present`);
  if (column?.present !== true) throw refuse('republish_rooms_column_required');
  const store = await createOperatorStore({ sql: pool, scope, now });
  let owners;
  if (operatorId !== null) {
    const owner = await store.getOperatorById(operatorId);
    if (!owner) throw refuse('republish_rooms_operator_not_found');
    owners = [owner];
  } else owners = await store.listOperators();
  const record = (kind, row) => {
    result[kind].push(row);
    for (const line of entryLines(kind, row, dryRun)) onLine(line);
  };
  const checkConnection = () => { if (signal?.aborted) throw refuse('republish_rooms_unreachable'); };
  for (const owner of owners) {
    checkConnection();
    const entry = { operatorId: owner.id, slug: owner.slug, fromRevision: null };
    try {
      const { operator: current, package: pack } = await store.getCurrentPresentationContext(owner.slug);
      if (current && current.id !== owner.id) throw refuse('republish_rooms_operator_changed');
      if (!pack || pack.rooms !== null) continue;
      const legacy = await first(pool, `/* republish-rooms:administration */ SELECT value FROM croupier_studio.documents
        WHERE environment_id=$1 AND workspace_id=$2 AND kind='administration'`, [scope.environment, scope.workspaceId]);
      const administration = legacy?.value;
      Object.assign(entry, { fromRevision: pack.revision, tables: pack.tables.length });
      const input = { actor: REPUBLISH_ROOMS_ACTOR, operatorId: owner.id, expectedRevision: pack.revision,
        lanes: [...pack.lanes], games: [...pack.games], tables: [...pack.tables], branding: structuredClone(pack.branding) };
      const rooms = packageRoomsFor(administration, input);
      if (!rooms) { record('skipped', entry); continue; }
      entry.settingsDrafts = (Array.isArray(administration?.roomGameConfigs) ? administration.roomGameConfigs : [])
        .filter(row => row?.operatorId === owner.id && row.basePackageRevision === pack.revision).length;
      if (dryRun) { record('published', { ...entry, toRevision: pack.revision + 1 }); continue; }
      checkConnection();
      const saved = await store.publishPackage({ ...input, rooms });
      if (!Array.isArray(saved.rooms)) throw refuse('republish_rooms_not_written');
      record('published', { ...entry, toRevision: saved.revision, tables: saved.rooms.length });
    } catch (error) {
      if (error?.code === 'republish_rooms_not_written' || signal?.aborted) throw error;
      record('failed', { ...entry, code: failureCode(error) });
    }
  }
  checkConnection();
  onLine(summaryLine(result));
  return result;
}

export function republishLines(result) {
  return [targetLine(result), ...['published', 'skipped', 'failed'].flatMap(kind => result[kind].flatMap(row => entryLines(kind, row, result.dryRun))), summaryLine(result)];
}

const createPool = connectionString => {
  const { Pool } = createRequire(new URL('../apps/studio/package.json', import.meta.url))('@neondatabase/serverless');
  return new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
};

/** Injectable IO/pool lets the actual CLI orchestration be tested against an isolated database. */
export async function runRepublishCli({ argv = process.argv.slice(2), env = process.env, makePool = createPool,
  stdout = line => console.log(line), stderr = line => console.error(line) } = {}) {
  let pool;
  try {
    const options = parseRepublishArguments(argv);
    if (options.help) { stdout(REPUBLISH_ROOMS_USAGE); return 0; }
    const scope = republishScope(env);
    const connectionString = env.CROUPIER_GAME_DATABASE_URL, guard = migrationDatabaseGuard(connectionString);
    if (!guard.ok) throw refuse(guard.code === 'migration_check_host_rejected' ? 'republish_rooms_host_rejected' : 'republish_rooms_database_required');
    pool = makePool(connectionString);
    const controller = new AbortController();
    pool.on('error', () => controller.abort()); // Never print asynchronous driver errors or credentials.
    const result = await republishRooms({ pool, scope, dryRun: options.dryRun, confirm: env.CROUPIER_REPUBLISH_CONFIRM,
      operatorId: options.operatorId, onLine: stdout, signal: controller.signal });
    return result.failed.length ? 1 : 0;
  } catch (error) {
    const failure = typeof error?.code === 'string' ? error.code : '';
    stderr(Object.hasOwn(MESSAGES, failure) ? `${failure}: ${MESSAGES[failure]}`
      : /^studio_[a-z0-9_]+$/.test(failure) ? failure : `republish_rooms_unreachable: ${MESSAGES.republish_rooms_unreachable}`);
    return 2;
  } finally {
    if (pool) try { await pool.end(); } catch { /* Never print driver shutdown details. */ }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await runRepublishCli());
