#!/usr/bin/env node
// L3 PR 4 (claude/2026-10-29-plan-l3-spelbord.md; Jakob 29 Oct: no DML backfill). Every company whose
// current package has no `rooms` (Studio 023) is published again as a new package revision (pkg+1)
// whose `rooms` are its tables' rooms in the administration document, through the product's own
// writer (publishPackage → publishWithin, which also carries the open appearance draft over).
// Historical package rows are never changed: they are immutable and the migration runner refuses
// UPDATE. Idempotent: a company whose current package has `rooms` is left alone, so a second run
// publishes nothing. Output: codes, scope, slugs, revisions and counts only, never a connection
// string, a driver message or document contents.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOperatorStore } from '../packages/operators/server/operator-store.mjs';
import { packageRoomsFor } from '../packages/presentation/server/package-rooms.mjs';
import { migrationDatabaseGuard } from './check-migration-readiness.mjs';

export const REPUBLISH_ROOMS_ACTOR = 'tools/republish-rooms';
export const PACKAGE_ROOMS_STORAGE_VERSION = '023';
export const REPUBLISH_ROOMS_USAGE = `Användning: node tools/republish-rooms.mjs [--dry-run] [--operator <id>]

Publicerar om varje bolag vars nuvarande paket saknar rooms (Studio 023, plan L3) som en ny
paketversion (pkg+1). rooms är bolagets bord i administrationsdokumentet, i dokumentets ordning.
Gamla paketversioner ändras aldrig. En andra körning publicerar inget.

  --dry-run        listar bolagen som skulle publiceras och skriver inget
  --operator <id>  bara bolaget med detta id
  --help           den här texten

Miljö: CROUPIER_GAME_DATABASE_URL (Neon), CROUPIER_STUDIO_ENVIRONMENT_ID och
CROUPIER_STUDIO_WORKSPACE_ID. Studio 023 måste stå i ledgern, annars nekar verktyget.

Varje pkg+1 ger bolagets anslutna spelare 1008 och en ny socket. Kör därför verktyget när borden
är tomma. Bolagets öppna utseendeutkast följer med till den nya versionen. Spelinställningsutkast
som byggde på den gamla versionen följer inte med; de sparas om i Admin (utskriften säger hur många).
Ordning: preview först (--dry-run, sedan skarpt), därefter produktionen.`;

const MESSAGES = Object.freeze({
  republish_rooms_usage: 'Okänd flagga. Se node tools/republish-rooms.mjs --help.',
  republish_rooms_scope_required: 'CROUPIER_STUDIO_ENVIRONMENT_ID och CROUPIER_STUDIO_WORKSPACE_ID krävs.',
  republish_rooms_database_required: 'CROUPIER_GAME_DATABASE_URL krävs.',
  republish_rooms_host_rejected: 'CROUPIER_GAME_DATABASE_URL måste peka på en Neon-värd.',
  republish_rooms_migration_required: 'Studio 023 saknas i ledgern, inget är skrivet. Kör först node tools/check-migration-readiness.mjs --apply --only 023.',
  republish_rooms_operator_not_found: 'Inget bolag med det id:t i scopet, inget är skrivet.',
  republish_rooms_not_written: 'Paketet skrevs utan rooms trots Studio 023 i ledgern. Körningen stoppades.',
  republish_rooms_unreachable: 'Databasen gick inte att läsa.',
});
const refuse = code => Object.assign(new Error(code), { code });
const token = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value) ? value : null;
const failureCode = error => typeof error?.code === 'string' && /^(?:studio|republish_rooms)_[a-z0-9_]+$/.test(error.code) ? error.code : 'republish_rooms_failed';

/** --dry-run and --operator <id>, each at most once; --help alone. */
export function parseRepublishArguments(argv) {
  if (argv.length === 1 && argv[0] === '--help') return { help: true, dryRun: false, operatorId: null };
  const options = { help: false, dryRun: false, operatorId: null };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--dry-run' && !options.dryRun) options.dryRun = true;
    else if (argv[index] === '--operator' && options.operatorId === null && token(argv[index + 1])) options.operatorId = argv[++index];
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

/** One pkg+1 per company whose current package lacks `rooms`. A company whose rooms cannot be derived
 * (a table without its room in the document, or a list breaking the readers' invariant) is skipped,
 * never published with `rooms` null. A failed company does not stop the others. */
export async function republishRooms({ pool, scope, dryRun = false, operatorId = null, now = Date.now } = {}) {
  const target = await first(pool, '/* republish-rooms:target */ SELECT current_database() AS database, current_user AS role');
  const ledger = await first(pool, `/* republish-rooms:ledger */ SELECT count(*)::integer AS ledgered
    FROM croupier_studio.storage_migrations WHERE version=$1`, [PACKAGE_ROOMS_STORAGE_VERSION]);
  if (Number(ledger?.ledgered) !== 1) throw refuse('republish_rooms_migration_required');
  const store = await createOperatorStore({ sql: pool, scope, now });
  let owners;
  if (operatorId !== null) {
    const owner = await store.getOperatorById(operatorId);
    if (!owner) throw refuse('republish_rooms_operator_not_found');
    owners = [owner];
  } else owners = await store.listOperators();
  const result = { target: { database: token(target?.database), role: token(target?.role) },
    scope: { environment: token(scope?.environment), workspaceId: token(scope?.workspaceId) }, dryRun, published: [], skipped: [], failed: [] };
  for (const owner of owners) {
    const entry = { operatorId: owner.id, slug: owner.slug, fromRevision: null };
    try {
      // One statement: the package and the administration document from the same snapshot.
      const { package: pack, administration } = await store.getCurrentPresentationContext(owner.slug);
      if (!pack || pack.rooms !== null) continue;
      Object.assign(entry, { fromRevision: pack.revision, tables: pack.tables.length });
      const input = { actor: REPUBLISH_ROOMS_ACTOR, operatorId: owner.id, expectedRevision: pack.revision,
        lanes: [...pack.lanes], games: [...pack.games], tables: [...pack.tables], branding: structuredClone(pack.branding) };
      const rooms = packageRoomsFor(administration, input);
      if (!rooms) { result.skipped.push(entry); continue; }
      // Only a pause or an opening moves the game-settings drafts made on this revision (PR 4b).
      entry.settingsDrafts = (Array.isArray(administration?.roomGameConfigs) ? administration.roomGameConfigs : [])
        .filter(row => row?.operatorId === owner.id && row.basePackageRevision === pack.revision).length;
      if (dryRun) { result.published.push({ ...entry, toRevision: pack.revision + 1 }); continue; }
      const saved = await store.publishPackage({ ...input, rooms });
      if (!Array.isArray(saved.rooms)) throw refuse('republish_rooms_not_written');
      result.published.push({ ...entry, toRevision: saved.revision, tables: saved.rooms.length });
    } catch (error) {
      // The column is missing although 023 is ledgered: stop before another company gets a useless pkg+1.
      if (error?.code === 'republish_rooms_not_written') throw Object.assign(error, { result });
      result.failed.push({ ...entry, code: failureCode(error) });
    }
  }
  return result;
}

/** What Jakob reads: what was (or would be) published, skipped or refused, and a summary. */
export function republishLines(result) {
  const name = row => `${row.slug} (${row.operatorId})`;
  const lines = [`republish-rooms: databas ${result.target.database ?? '?'}, roll ${result.target.role ?? '?'}, scope ${result.scope.environment}/${result.scope.workspaceId}, ${result.dryRun ? 'provkörning (--dry-run), inget skrivs' : 'skarp körning'}`];
  for (const row of result.published) {
    lines.push(`${result.dryRun ? 'skulle publiceras' : 'publicerat'}: ${name(row)}: paket ${row.fromRevision} → ${row.toRevision}, ${row.tables} bord`);
    if (row.settingsDrafts) lines.push(`  obs: ${row.settingsDrafts} spelinställningsutkast byggde på paket ${row.fromRevision} och sparas om i Admin`);
  }
  for (const row of result.skipped) lines.push(`hoppas över: ${name(row)}: paket ${row.fromRevision}, ${row.tables} bord: rooms går inte att härleda ur administrationsdokumentet`);
  for (const row of result.failed) lines.push(`misslyckades: ${name(row)}: paket ${row.fromRevision ?? '?'}: ${row.code}`);
  lines.push(`summa: ${result.published.length} ${result.dryRun ? 'skulle publiceras' : 'publicerade'}, ${result.skipped.length} hoppades över, ${result.failed.length} misslyckades`);
  return lines;
}

async function main() {
  let pool, code = 2;
  try {
    const options = parseRepublishArguments(process.argv.slice(2));
    if (options.help) {
      console.log(REPUBLISH_ROOMS_USAGE);
      code = 0;
    } else {
      const scope = republishScope();
      const connectionString = process.env.CROUPIER_GAME_DATABASE_URL, guard = migrationDatabaseGuard(connectionString);
      // Neon hosts only, exactly as the migration readiness check.
      if (!guard.ok) throw refuse(guard.code === 'migration_check_host_rejected' ? 'republish_rooms_host_rejected' : 'republish_rooms_database_required');
      const { Pool } = createRequire(new URL('../apps/studio/package.json', import.meta.url))('@neondatabase/serverless');
      pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
      const result = await republishRooms({ pool, scope, dryRun: options.dryRun, operatorId: options.operatorId });
      for (const line of republishLines(result)) console.log(line);
      code = result.failed.length ? 1 : 0;
    }
  } catch (error) {
    if (error?.result) for (const line of republishLines(error.result)) console.log(line);
    const failure = typeof error?.code === 'string' ? error.code : '';
    // A storage refusal (e.g. a corrupt company row) keeps its own code; anything else is unreachable.
    console.error(Object.hasOwn(MESSAGES, failure) ? `${failure}: ${MESSAGES[failure]}`
      : /^studio_[a-z0-9_]+$/.test(failure) ? failure : `republish_rooms_unreachable: ${MESSAGES.republish_rooms_unreachable}`);
  } finally {
    if (pool) try { await pool.end(); } catch { /* Never print driver shutdown details. */ }
  }
  process.exit(code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
