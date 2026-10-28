import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPglitePool } from './fixtures/pglite-pool.mjs';
import { planStudioMigrations, applyStudioMigrations, isStudioMigrationPlanReady } from '../ops/neon-studio/migrations.mjs';
import { createOperatorStore } from '../packages/operators/server/operator-store.mjs';
import { createStudioRepository } from '../packages/studio-registry/server/document-repository.mjs';
import { StudioStorageError } from '../packages/studio-registry/server/document-contract.mjs';
import { createOperatorMaterialStore, MAX_OPERATOR_DAILY_AI_LIMIT } from '../apps/studio/lib/operator-material-store.mjs';

// Bolagets eget material (021) on real PostgreSQL SQL (PGlite, one session):
// the reviewed DDL, the tolerant reads and fixed write code without 021, the
// append-only journal, the policy and the daily AI cap. Cross-session lock
// contention stays with CI's isolated PostgreSQL (see the PGlite fixture).
const scope = { environment: 'isolated-materials', workspaceId: 'north-qa' };
const otherWorkspace = { environment: 'isolated-materials', workspaceId: 'south-qa' };
const day0 = Date.UTC(2026, 9, 28, 12);
const admin = () => ({ actorId: 'staff-1', accessClass: 'internal-admin', requestId: randomUUID() });
const partner = () => ({ actorId: 'partner-1', accessClass: 'partner', requestId: randomUUID() });
const code = (expected, status) => error => error instanceof StudioStorageError && error.code === expected && (status === undefined || error.statusCode === status);
const asset = (id, role = 'background', sha = 'a', extra = {}) => ({ schemaVersion: 1, id, role, label: role === 'table' ? 'Eget bord' : 'Egen bakgrund',
  sha256: sha.repeat(64), size: 4096, contentType: 'image/png', width: 1920, height: 1080,
  pathname: `croupier/media/${role === 'background' ? 'backgrounds' : 'tables'}/${id}/${sha.repeat(64)}.png`, ...extra });
const binding = { dealerId: 'paow', profileId: 'kevin-paow-c7138759', laneId: 'mobile-phone', templateSha256: 'c'.repeat(64) };

async function studioPool({ defer = [] } = {}) {
  const pool = await createPglitePool({ migrations: [] });
  const plan = await planStudioMigrations({ pool });
  const applied = await applyStudioMigrations({ pool, expectedTarget: plan.target, confirm: true, deferOptional: defer });
  for (const target of [scope, otherWorkspace]) {
    const operators = await createOperatorStore({ sql: pool, scope: target, now: () => day0 });
    for (const id of ['north', 'south']) await operators.createOperator({ actor: 'fixture', operatorId: id, slug: id, name: id });
  }
  return { pool, applied };
}
let clock = day0;
const storeFor = (pool, target = scope) => createOperatorMaterialStore({ sql: pool, scope: target, now: () => clock });

test('021 installs on PostgreSQL, stays optional for readiness and its constraints refuse invalid rows', async t => {
  const without = await studioPool({ defer: ['021'] }); t.after(() => without.pool.end());
  assert.equal(isStudioMigrationPlanReady(without.applied), true, 'missing 021 never blocks readiness');
  assert.deepEqual(without.applied.optionalPending.map(row => row.version), ['021']);
  assert.equal(await storeFor(without.pool).available(), false);
  const { pool, applied } = await studioPool(); t.after(() => pool.end());
  assert.equal(isStudioMigrationPlanReady(applied), true); assert.deepEqual(applied.optionalPending, []);
  assert.equal(await storeFor(pool).available(), true);
  const id = randomUUID();
  const insert = values => pool.query(`INSERT INTO croupier_studio.operator_materials
    (environment_id,workspace_id,operator_id,material_id,revision,state,source,role,asset,table_binding,event_id,actor_id,access_class,occurred_at_ms,request_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, values);
  const row = (patch = {}) => Object.values({ env: scope.environment, ws: scope.workspaceId, operator: 'north', id, revision: 1, state: 'pending', source: 'upload',
    role: 'background', asset: JSON.stringify(asset(id)), binding: null, event: randomUUID(), actor: 'staff-1', access: 'internal-admin', at: 1, request: randomUUID(), ...patch });
  for (const [patch, sqlState] of [[{ state: 'deleted' }, '23514'], [{ state: 'approved' }, '23514'], [{ revision: 2 }, '23514'],
    [{ asset: JSON.stringify(asset(randomUUID())) }, '23514'], [{ role: 'table' }, '23514'], [{ binding: JSON.stringify(binding) }, '23514'],
    [{ source: 'scraped' }, '23514'], [{ access: 'player' }, '23514'], [{ operator: 'unknown' }, '23503']]) {
    await assert.rejects(insert(row(patch)), error => error.code === sqlState, JSON.stringify(patch));
  }
  await insert(row());
  await assert.rejects(insert(row()), error => error.code === '23505', 'one revision per material');
  const policy = values => pool.query(`INSERT INTO croupier_studio.operator_material_policies
    (environment_id,workspace_id,operator_id,revision,daily_ai_limit,blocked,actor_id,access_class,updated_at_ms) VALUES ($1,$2,'south',1,$3,false,'staff-1',$4,1)`, values);
  for (const values of [[scope.environment, scope.workspaceId, -1, 'internal-admin'], [scope.environment, scope.workspaceId, MAX_OPERATOR_DAILY_AI_LIMIT + 1, 'internal-admin'],
    [scope.environment, scope.workspaceId, 1, 'partner']]) await assert.rejects(policy(values), error => error.code === '23514');
});

test('without 021 reads are empty and writes fail with operator_materials_unavailable, never aborting a transaction', async t => {
  const { pool } = await studioPool({ defer: ['021'] }); t.after(() => pool.end());
  const store = storeFor(pool);
  assert.deepEqual(await store.listMaterials('north'), []);
  assert.deepEqual(await store.listApprovedMaterials('north'), []);
  assert.deepEqual(await store.getPolicy('north'), { operatorId: 'north', revision: 0, dailyAiLimit: 0, blocked: false, updatedAtMs: null });
  assert.equal(await store.countAiAttempts('north'), 0);
  const materialId = randomUUID();
  for (const write of [
    () => store.appendMaterial({ actor: 'partner-1', audit: partner(), operatorId: 'north', materialId, expectedRevision: 0, state: 'pending', source: 'upload', asset: asset(materialId) }),
    () => store.setPolicy({ actor: 'staff-1', audit: admin(), operatorId: 'north', expectedRevision: 0, dailyAiLimit: 10, blocked: false }),
    () => store.reserveAiAttempt({ actor: 'partner-1', audit: partner(), operatorId: 'north', attemptId: randomUUID() }),
  ]) await assert.rejects(write(), code('operator_materials_unavailable', 503));
  // Inside a caller's transaction the readiness probe never references a missing
  // relation, so the publication continues and commits.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    assert.deepEqual(await createOperatorMaterialStore({ sql: client, scope }).listMaterials('north'), []);
    assert.equal((await client.query('SELECT 1 AS alive')).rows[0].alive, 1);
    assert.equal((await client.query('COMMIT')).command, 'COMMIT');
  } finally { await client.release(); }
  // The repository's guarded transaction client demands scope-first parameters.
  const repository = createStudioRepository({ pool, scope });
  assert.deepEqual(await repository.transaction(() => repository.withTransactionClient(sql =>
    createOperatorMaterialStore({ sql, scope }).listMaterials('north'))), []);
});

test('the material journal is append-only, server-validated, decided only by Scoutgaming and scoped per company', async t => {
  const { pool } = await studioPool(); t.after(() => pool.end());
  const store = storeFor(pool), materialId = randomUUID(), tableId = randomUUID();
  const create = (id, extra = {}) => store.appendMaterial({ actor: 'partner-1', audit: partner(), operatorId: 'north', materialId: id, expectedRevision: 0,
    state: 'pending', source: 'upload', asset: asset(id), ...extra });
  for (const extra of [{ asset: { ...asset(materialId), contentType: 'video/mp4', pathname: asset(materialId).pathname.replace('.png', '.mp4') } },
    { asset: asset(randomUUID()) }, { asset: asset(materialId, 'table') }, { tableBinding: binding }, { asset: asset(materialId, 'table', 'a', { game: 'blackjack' }), tableBinding: binding },
    { state: 'approved', audit: admin() }, { source: 'scraped' }, { asset: { ...asset(materialId), extra: true } }]) {
    await assert.rejects(create(materialId, extra), code('studio_invalid_data', 422), JSON.stringify(Object.keys(extra)));
  }
  clock = day0 + 1;
  const pending = await create(materialId);
  assert.deepEqual([pending.revision, pending.state, pending.source, pending.role, pending.tableBinding], [1, 'pending', 'upload', 'background', null]);
  await assert.rejects(create(materialId), code('studio_conflict', 409), 'an id is created once');
  const table = await create(tableId, { source: 'ai', asset: asset(tableId, 'table', 'b'), tableBinding: binding });
  assert.deepEqual(table.tableBinding, binding);
  const decide = (state, expectedRevision, audit = admin(), id = materialId) => store.appendMaterial({ actor: 'staff-1', audit, operatorId: 'north', materialId: id, expectedRevision, state });
  await assert.rejects(decide('approved', 1, partner()), code('studio_forbidden', 403), 'a company cannot approve its own material');
  await assert.rejects(store.appendMaterial({ actor: 'staff-1', audit: admin(), operatorId: 'north', materialId, expectedRevision: 1, state: 'approved', asset: asset(materialId, 'background', 'd') }),
    code('studio_invalid_data', 422), 'the asset never changes after creation');
  clock = day0 + 2;
  const approved = await decide('approved', 1);
  assert.deepEqual([approved.revision, approved.state, approved.asset], [2, 'approved', pending.asset]);
  for (const [state, revision] of [['approved', 1], ['pending', 2], ['rejected', 2], ['approved', 2]]) await assert.rejects(decide(state, revision), code('studio_conflict', 409), `${state}@${revision}`);
  assert.deepEqual((await store.listApprovedMaterials('north')).map(row => row.materialId), [materialId]);
  assert.deepEqual((await store.listMaterials('north')).map(row => [row.materialId, row.state]), [[tableId, 'pending'], [materialId, 'approved']],
    'current state per material, ordered by its latest decision');
  await decide('rejected', 1, admin(), tableId);
  clock = day0 + 3;
  const revoked = await decide('revoked', 2);
  assert.equal(revoked.revision, 3);
  await assert.rejects(decide('approved', 3), code('studio_conflict', 409), 'revoked is final');
  assert.deepEqual(await store.listApprovedMaterials('north'), []);
  const journal = (await pool.query('SELECT material_id,revision,state FROM croupier_studio.operator_materials ORDER BY material_id,revision')).rows;
  assert.deepEqual(journal.filter(row => row.material_id === materialId).map(row => [Number(row.revision), row.state]), [[1, 'pending'], [2, 'approved'], [3, 'revoked']]);
  assert.deepEqual(await store.listMaterials('south'), [], 'another company sees nothing');
  assert.deepEqual(await storeFor(pool, otherWorkspace).listMaterials('north'), [], 'another workspace sees nothing');
  await assert.rejects(storeFor(pool, otherWorkspace).appendMaterial({ actor: 'staff-1', audit: admin(), operatorId: 'north', materialId, expectedRevision: 3, state: 'revoked' }),
    code('studio_conflict', 409), 'the same ids in another workspace are a different company');
  // A row that is not the store's own canonical form is never trusted.
  await pool.query(`UPDATE croupier_studio.operator_materials SET asset=$1 WHERE material_id=$2 AND revision=3`, [JSON.stringify(asset(materialId), null, 1), materialId]);
  await assert.rejects(store.listMaterials('north'), code('studio_corrupt_operator_material', 503));
});

test('policy defaults to off; the daily AI cap is counted under the company lock before any provider call', async t => {
  const { pool } = await studioPool(); t.after(() => pool.end());
  const store = storeFor(pool);
  clock = day0;
  const reserve = (attemptId = randomUUID(), audit = partner()) => store.reserveAiAttempt({ actor: 'partner-1', audit, operatorId: 'north', attemptId });
  await assert.rejects(reserve(), code('operator_ai_limit_reached', 429), 'standard limit 0 means off');
  await assert.rejects(store.setPolicy({ actor: 'partner-1', audit: partner(), operatorId: 'north', expectedRevision: 0, dailyAiLimit: 10, blocked: false }),
    code('studio_invalid_data', 422), 'only Scoutgaming sets the limit');
  for (const dailyAiLimit of [-1, MAX_OPERATOR_DAILY_AI_LIMIT + 1, 1.5]) {
    await assert.rejects(store.setPolicy({ actor: 'staff-1', audit: admin(), operatorId: 'north', expectedRevision: 0, dailyAiLimit, blocked: false }), code('studio_invalid_data', 422));
  }
  const first = await store.setPolicy({ actor: 'staff-1', audit: admin(), operatorId: 'north', expectedRevision: 0, dailyAiLimit: 2, blocked: false });
  assert.deepEqual([first.revision, first.dailyAiLimit, first.blocked], [1, 2, false]);
  await assert.rejects(store.setPolicy({ actor: 'staff-1', audit: admin(), operatorId: 'north', expectedRevision: 0, dailyAiLimit: 3, blocked: false }), code('studio_conflict', 409));
  const attempt = randomUUID();
  assert.deepEqual(await reserve(attempt), { attemptId: attempt, day: '2026-10-28', used: 1, limit: 2 });
  await assert.rejects(reserve(attempt), code('studio_conflict', 409), 'an attempt id counts once');
  assert.equal((await reserve()).used, 2);
  await assert.rejects(reserve(), code('operator_ai_limit_reached', 429));
  assert.equal(await store.countAiAttempts('north'), 2);
  assert.equal(await store.countAiAttempts('south'), 0, 'the cap is per company');
  clock = day0 + 24 * 3600 * 1000;
  assert.equal((await reserve()).used, 1, 'a new UTC day starts at zero');
  assert.equal(await store.countAiAttempts('north', { day: '2026-10-28' }), 2);
  const blocked = await store.setPolicy({ actor: 'staff-1', audit: admin(), operatorId: 'north', expectedRevision: 1, dailyAiLimit: 2, blocked: true });
  assert.equal(blocked.revision, 2);
  await assert.rejects(reserve(), code('operator_materials_blocked', 403));
  const materialId = randomUUID();
  await assert.rejects(store.appendMaterial({ actor: 'partner-1', audit: partner(), operatorId: 'north', materialId, expectedRevision: 0, state: 'pending', source: 'ai', asset: asset(materialId) }),
    code('operator_materials_blocked', 403), 'a blocked company proposes nothing new');
  assert.deepEqual(await store.getPolicy('north'), { operatorId: 'north', revision: 2, dailyAiLimit: 2, blocked: true, updatedAtMs: clock });
  await assert.rejects(store.reserveAiAttempt({ actor: 'partner-1', audit: partner(), operatorId: 'missing', attemptId: randomUUID() }), code('studio_operator_not_found', 404));
});
