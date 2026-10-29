// L3 PR 4: tools/republish-rooms.mjs publishes every company whose current package lacks `rooms`
// again as pkg+1 through the product's own writer. Real PostgreSQL (PGlite) with every reviewed
// Studio migration, first without Studio 023 and then with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createPglitePool } from './fixtures/pglite-pool.mjs';
import { planStudioMigrations, applyStudioMigrations } from '../ops/neon-studio/migrations.mjs';
import { createOperatorStore } from '../packages/operators/server/operator-store.mjs';
import { countPackagesWithoutRooms, packageRoomsLine } from '../tools/check-migration-readiness.mjs';
import { REPUBLISH_ROOMS_ACTOR, parseRepublishArguments, republishLines, republishRooms } from '../tools/republish-rooms.mjs';

const script = fileURLToPath(new URL('../tools/republish-rooms.mjs', import.meta.url));
const cliEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, PATHEXT: process.env.PATHEXT };
const scope = { environment: 'qa', workspaceId: 'workspace-north' };
const actor = 'republish-test';
const clock = () => 1_700_000_000_000;
const room = (id, operatorId, state = 'live') => ({ schemaVersion: 2, id, name: `Table ${id}`, operatorId, presentationLaneId: 'lane-a', gameLaneId: 'game-a', state });
const refusal = code => error => error?.code === code;
const gameLanes = [{ schemaVersion: 1, id: 'game-a', label: 'Fixture', renderer: 'portrait-video', dealer: 'dragan', mediaCollection: 'dragan-presentation' }];
const administration = (rooms, extra = {}) => ({ rooms, gameLane: 'game-a', gameLanes, ...extra });

async function fixture(t, rooms) {
  const pool = await createPglitePool(); t.after(() => pool.end());
  await applyStudioMigrations({ pool, expectedTarget: (await planStudioMigrations({ pool })).target, confirm: true, deferOptional: ['023'] });
  const store = await createOperatorStore({ sql: pool, scope, now: clock });
  const saveDocument = value => pool.query(`INSERT INTO croupier_studio.documents (environment_id,workspace_id,kind,revision,value) VALUES ($1,$2,'administration','admin-1',$3::jsonb)
    ON CONFLICT (environment_id,workspace_id,kind) DO UPDATE SET value=EXCLUDED.value`, [scope.environment, scope.workspaceId, JSON.stringify(value)]);
  await saveDocument(administration(rooms));
  const publish = async (operatorId, tables) => store.publishPackage({ actor, operatorId, expectedRevision: (await store.getCurrentPackage(operatorId))?.revision ?? null,
    lanes: ['lane-a'], games: ['blackjack'], tables, branding: { name: operatorId } });
  const installRooms = async () => {
    const plan = await planStudioMigrations({ pool });
    assert.deepEqual((await applyStudioMigrations({ pool, expectedTarget: plan.target, confirm: true })).appliedNow, ['023']);
  };
  const rows = async () => (await pool.query(`SELECT operator_id, package_revision, to_jsonb(p)->>'rooms' AS rooms FROM croupier_studio.operator_packages p
    ORDER BY operator_id, package_revision`)).rows.map(row => [row.operator_id, Number(row.package_revision), row.rooms === null ? null : JSON.parse(row.rooms)]);
  const audits = async () => Number((await pool.query('SELECT count(*)::integer AS n FROM croupier_studio.operator_audit_events')).rows[0].n);
  return { pool, store, saveDocument, publish, installRooms, rows, audits };
}

test('republish-rooms: refused without 023; then one pkg+1 for the company without rooms, nothing on the second run; --dry-run writes nothing', async t => {
  const northA = room('north-a', 'north'), northB = room('north-b', 'north', 'pending'), southA = room('south-a', 'south');
  // Document order differs from id order, so a writer that sorts is caught.
  const f = await fixture(t, [northB, southA, northA]);
  for (const id of ['north', 'south']) await f.store.createOperator({ operatorId: id, slug: id, name: `Bolag ${id}`, status: 'active', actor });
  await f.publish('north', ['north-a', 'north-b']);
  await f.publish('south', ['south-a']);
  assert.deepEqual(packageRoomsLine(await countPackagesWithoutRooms({ pool: f.pool })), 'paket utan rooms: 2 (qa/workspace-north: 2)');
  // Without Studio 023 in the ledger the tool refuses, dry run or not, and writes nothing.
  const before = [await f.rows(), await f.audits()];
  for (const dryRun of [false, true]) await assert.rejects(republishRooms({ pool: f.pool, scope, dryRun }), refusal('republish_rooms_migration_required'));
  assert.deepEqual([await f.rows(), await f.audits()], before);

  await f.installRooms();
  // South is published again after 023 and so has rooms; north's current package (revision 1) has none.
  assert.deepEqual((await f.publish('south', ['south-a'])).rooms, [southA]);
  assert.deepEqual(packageRoomsLine(await countPackagesWithoutRooms({ pool: f.pool })), 'paket utan rooms: 1 (qa/workspace-north: 1)');
  // North's open appearance draft and a game-settings draft, both on revision 1.
  await f.store.saveBrandingDraft({ operatorId: 'north', actor, expectedDraftRevision: 0, expectedPackageRevision: 1, branding: { color: '#112233' } });
  const draft = await f.store.getBrandingDraft('north');
  await f.saveDocument(administration([northB, southA, northA], {
    roomGameConfigs: [{ roomId: 'north-a', operatorId: 'north', revision: 'room-config-x', basePackageRevision: 1, gameConfig: {} },
      { roomId: 'south-a', operatorId: 'south', revision: 'room-config-y', basePackageRevision: 2, gameConfig: {} }] }));

  // --dry-run lists north and writes nothing: no package row, journal entry or draft revision.
  const planned = [await f.rows(), await f.audits()];
  const dry = await republishRooms({ pool: f.pool, scope, dryRun: true });
  assert.deepEqual(dry.published, [{ operatorId: 'north', slug: 'north', fromRevision: 1, toRevision: 2, tables: 2, settingsDrafts: 1 }]);
  assert.deepEqual([dry.skipped, dry.failed], [[], []]);
  assert.deepEqual([await f.rows(), await f.audits()], planned);
  assert.deepEqual(await f.store.getBrandingDraft('north'), draft);
  assert.ok(republishLines(dry).includes('skulle publiceras: north (north): paket 1 → 2, 2 bord'));

  // The first run: exactly one pkg+1, north 1 → 2 with its rooms in document order; history untouched.
  const run = await republishRooms({ pool: f.pool, scope });
  assert.deepEqual(run.published, [{ operatorId: 'north', slug: 'north', fromRevision: 1, toRevision: 2, tables: 2, settingsDrafts: 1 }]);
  assert.deepEqual([run.skipped, run.failed], [[], []]);
  assert.deepEqual(await f.rows(), [['north', 1, null], ['north', 2, [northB, northA]], ['south', 1, null], ['south', 2, [southA]]]);
  const current = await f.store.getCurrentPackage('north');
  assert.deepEqual([current.revision, current.tables, current.lanes, current.games, current.branding], [2, ['north-a', 'north-b'], ['lane-a'], ['blackjack'], { name: 'north' }]);
  // The journal names the tool (a system actor), and the open appearance draft follows to revision 2 with the same choices.
  const journal = (await f.store.listAuditEvents('north', { actions: ['package.publish'] })).entries.find(entry => entry.afterRevision === 2);
  assert.deepEqual([journal.beforeRevision, journal.accessClass, journal.actor],
    [1, 'system', 'actor-' + createHash('sha256').update(REPUBLISH_ROOMS_ACTOR).digest('hex')]);
  const kept = await f.store.getBrandingDraft('north');
  assert.deepEqual([kept.revision, kept.action, kept.basePackageRevision, kept.branding], [draft.revision + 1, 'draft.save', 2, draft.branding]);
  const lines = republishLines(run);
  assert.equal(lines[0], 'republish-rooms: databas postgres, roll postgres, scope qa/workspace-north, skarp körning');
  assert.deepEqual(lines.slice(1), ['publicerat: north (north): paket 1 → 2, 2 bord', '  obs: 1 spelinställningsutkast byggde på paket 1 och sparas om i Admin',
    'summa: 1 publicerade, 0 hoppades över, 0 misslyckades']);
  assert.equal(packageRoomsLine(await countPackagesWithoutRooms({ pool: f.pool })), 'paket utan rooms: 0');

  // The second run publishes nothing, and neither does --operator for a company that has rooms.
  const settled = [await f.rows(), await f.audits()];
  for (const options of [{}, { operatorId: 'south' }, { operatorId: 'north', dryRun: true }]) {
    const again = await republishRooms({ pool: f.pool, scope, ...options });
    assert.deepEqual([again.published, again.skipped, again.failed], [[], [], []], JSON.stringify(options));
  }
  assert.deepEqual([await f.rows(), await f.audits()], settled);
  await assert.rejects(republishRooms({ pool: f.pool, scope, operatorId: 'east' }), refusal('republish_rooms_operator_not_found'));
});

test('republish-rooms: a company whose rooms cannot be derived is skipped, never published with rooms null; --operator limits the run', async t => {
  const f = await fixture(t, [room('north-a', 'north'), room('west-a', 'west')]);
  for (const id of ['east', 'north', 'west']) await f.store.createOperator({ operatorId: id, slug: id, name: `Bolag ${id}`, status: 'active', actor });
  await f.publish('east', ['east-a']);
  await f.publish('north', ['north-a']);
  await f.publish('west', ['west-a']);
  await f.installRooms();
  const before = await f.rows();
  // --operator: only north is published; east (no room for its table) and west are not touched.
  const limited = await republishRooms({ pool: f.pool, scope, operatorId: 'north' });
  assert.deepEqual(limited.published.map(row => [row.operatorId, row.fromRevision, row.toRevision]), [['north', 1, 2]]);
  assert.deepEqual((await f.rows()).filter(row => row[0] !== 'north'), before.filter(row => row[0] !== 'north'));
  for (let pass = 0; pass < 2; pass++) {
    const run = await republishRooms({ pool: f.pool, scope });
    assert.deepEqual(run.published.map(row => row.operatorId), pass ? [] : ['west']);
    assert.deepEqual(run.skipped, [{ operatorId: 'east', slug: 'east', fromRevision: 1, tables: 1 }]);
    assert.ok(republishLines(run).includes('hoppas över: east (east): paket 1, 1 bord: rooms går inte att härleda ur administrationsdokumentet'));
  }
  assert.deepEqual((await f.rows()).filter(row => row[0] === 'east'), [['east', 1, null]]);
  assert.equal(packageRoomsLine(await countPackagesWithoutRooms({ pool: f.pool })), 'paket utan rooms: 1 (qa/workspace-north: 1)');
});

test('republish-rooms stops after one company when a package is written without rooms although 023 is ledgered', async t => {
  const f = await fixture(t, [room('north-a', 'north'), room('west-a', 'west')]);
  for (const id of ['north', 'west']) {
    await f.store.createOperator({ operatorId: id, slug: id, name: `Bolag ${id}`, status: 'active', actor });
    await f.publish(id, [`${id}-a`]);
  }
  // A ledger row without the column (never written by the runner) must not give every company a useless pkg+1.
  await f.pool.query("INSERT INTO croupier_studio.storage_migrations (version,checksum,structure_checksum) VALUES ('023',$1,$1)", ['0'.repeat(64)]);
  const before = await f.rows();
  await assert.rejects(republishRooms({ pool: f.pool, scope }), error => error.code === 'republish_rooms_not_written' && Array.isArray(error.result?.published));
  assert.equal((await f.rows()).length, before.length + 1);
});

test('republish-rooms CLI: --help names 1008 and empty tables; usage, scope and host are refused before any database', () => {
  assert.deepEqual(parseRepublishArguments(['--dry-run', '--operator', 'north']), { help: false, dryRun: true, operatorId: 'north' });
  assert.deepEqual(parseRepublishArguments([]), { help: false, dryRun: false, operatorId: null });
  for (const args of [['--force'], ['--operator'], ['--operator', '--dry-run'], ['--dry-run', '--dry-run'], ['--help', '--dry-run'], ['north']]) {
    assert.throws(() => parseRepublishArguments(args), refusal('republish_rooms_usage'), args.join(' '));
  }
  const run = (args, env = {}) => spawnSync(process.execPath, [script, ...args], { env: { ...cliEnv, ...env }, encoding: 'utf8', timeout: 10000 });
  const help = run(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /1008/); assert.match(help.stdout, /borden\s+är tomma/); assert.match(help.stdout, /preview först \(--dry-run, sedan skarpt\)/);
  const scoped = { CROUPIER_STUDIO_ENVIRONMENT_ID: 'production', CROUPIER_STUDIO_WORKSPACE_ID: 'croupier' };
  for (const [args, env, code] of [
    [['--force'], scoped, 'republish_rooms_usage'],
    [['--dry-run'], {}, 'republish_rooms_scope_required'],
    [['--dry-run'], scoped, 'republish_rooms_database_required'],
    [['--dry-run'], { ...scoped, CROUPIER_GAME_DATABASE_URL: 'postgres://u:p@localhost/db' }, 'republish_rooms_host_rejected'],
  ]) {
    const refused = run(args, env);
    assert.equal(refused.status, 2, code);
    assert.equal(refused.stdout, '');
    assert.equal(refused.stderr.trim().split(':')[0], code);
    assert.equal(refused.stderr.includes('postgres://') || refused.stderr.includes('@'), false);
  }
});
