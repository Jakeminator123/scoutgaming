import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStudioMigrations, planStudioMigrations, applyStudioMigrations } from '../ops/neon-studio/migrations.mjs';
import { StudioStorageError } from '../web/storage/studio-contract.mjs';

const target = Object.freeze({ database: 'croupier_isolated_studio_test', role: 'studio_migrator', address: '127.0.0.1', port: 55432 });
const refusal = code => error => error instanceof StudioStorageError && error.code === code;
const copy = value => structuredClone(value);

// Deliberately synthetic catalog: proves fail-closed runner behavior and client
// lifecycle, not DDL/parser/Postgres isolation. Real PG is tested separately.
async function fixture() {
  const migrations = await loadStudioMigrations(), faults = new Map(), calls = [];
  let state = { present: false, relations: [], columns: [], constraints: [], indexes: [], ledger: [], extras: [], publicGrants: [] }, tail = Promise.resolve();
  const pool = {
    calls, connects: 0, releases: 0, commitRollback: false,
    snapshot: () => copy(state), change: edit => edit(state),
    failNext: (marker, error = new Error('private postgres host and password')) => faults.set(marker, error),
    async connect() {
      pool.connects++; let working, readOnly, releaseLock;
      const unlock = () => { releaseLock?.(); releaseLock = undefined; };
      return {
        async query(sql, values = []) {
          const migration = migrations.find(row => row.sql === sql);
          const marker = /\/\* studio-migrations:([a-z-]+) \*\//.exec(sql)?.[1] ?? (migration ? `ddl-${migration.version}` : sql.split(/\s/)[0]);
          calls.push({ sql, values: copy(values), marker });
          if (faults.has(marker)) { const error = faults.get(marker); faults.delete(marker); throw error; }
          const result = (rows = [], command = 'SELECT') => ({ rows: copy(rows), rowCount: rows.length, command });
          if (sql.startsWith('BEGIN')) { readOnly = sql.includes('READ ONLY'); working = copy(state); return result([], 'BEGIN'); }
          if (sql.startsWith('SET LOCAL')) return result([], 'SET');
          if (marker === 'lock') { const previous = tail; tail = new Promise(resolve => { releaseLock = resolve; }); await previous; working = copy(state); return result(); }
          if (sql === 'COMMIT') {
            if (pool.commitRollback) { pool.commitRollback = false; unlock(); return result([], 'ROLLBACK'); }
            if (!readOnly) state = working; unlock(); return result([], 'COMMIT');
          }
          if (sql === 'ROLLBACK') { working = undefined; unlock(); return result([], 'ROLLBACK'); }
          if (marker === 'target') return result([target]);
          if (marker === 'namespace') return result(working.present ? [{ oid: 1 }] : []);
          if (['relations', 'columns', 'constraints', 'indexes', 'extras'].includes(marker)) return result(working[marker]);
          if (marker === 'public-grants') return result(working.publicGrants);
          if (marker === 'ledger') return result(working.ledger);
          if (marker === 'record') {
            if (working.ledger.some(row => row.version === values[0])) throw Object.assign(new Error('duplicate ledger'), { code: '23505' });
            working.ledger.push({ version: values[0], checksum: values[1], structure_checksum: values[2] }); return result([], 'INSERT');
          }
          if (migration) {
            if (migration.version === '001') {
              if (working.present) throw new Error('would overwrite existing schema');
              working.present = true;
            }
            for (const table of migration.tables) {
              working.relations.push({ name: table, kind: 'r', table_name: null, is_constraint: false });
              const names = table === 'storage_migrations' ? ['version', 'checksum', 'structure_checksum', 'applied_at'] : ['fixture_column'];
              names.forEach((name, index) => working.columns.push({ table_name: table, position: index + 1, name, type: 'text', not_null: true, identity: '', generated: '', default_expression: null }));
              working.constraints.push({ table_name: table, name: `${table}_pkey`, kind: 'p', validated: true, deferrable: false, deferred: false, definition: `fixture primary key for ${table}` });
              working.relations.push({ name: `${table}_pkey`, kind: 'i', table_name: table, is_constraint: true });
              working.indexes.push({ table_name: table, name: `${table}_pkey`, valid: true, ready: true, definition: `fixture primary key index for ${table}` });
            }
            for (const name of migration.indexes) {
              const table = name.startsWith('fullfile_reservations') ? 'fullfile_reservations' : name.startsWith('gpu_reservations') ? 'gpu_reservations' : 'gpu_sessions';
              working.relations.push({ name, kind: 'i', table_name: table, is_constraint: false });
              working.indexes.push({ table_name: table, name, valid: true, ready: true, definition: `fixture explicit ${name}` });
            }
            for (const property of ['relations', 'indexes']) working[property].sort((a, b) => (a.table_name ?? '').localeCompare(b.table_name ?? '') || (a.name ?? '').localeCompare(b.name ?? ''));
            working.columns.sort((a, b) => a.table_name.localeCompare(b.table_name) || a.position - b.position);
            working.constraints.sort((a, b) => a.table_name.localeCompare(b.table_name) || a.name.localeCompare(b.name));
            return result([], 'CREATE');
          }
          throw new Error(`unknown fixture query ${marker}`);
        },
        release() { pool.releases++; unlock(); },
      };
    },
  };
  return pool;
}

async function installed() {
  const pool = await fixture(), plan = await planStudioMigrations({ pool });
  await applyStudioMigrations({ pool, expectedTarget: plan.target, confirm: true });
  return pool;
}

test('Studio migration sources are fixed, ordered, bounded and independent of runtime environment', async () => {
  const migrations = await loadStudioMigrations();
  assert.deepEqual(migrations.map(row => row.version), ['001', '002', '003', '004']);
  assert.deepEqual(migrations.map(row => row.file), ['001-studio-metadata.sql', '002-generation-journals.sql', '003-operator-speech-qa.sql', '004-fullfile-reservations.sql']);
  assert.ok(migrations.every(row => /^[a-f0-9]{64}$/.test(row.checksum) && Object.isFrozen(row)));
  assert.equal(migrations[0].tables.includes('storage_migrations'), true);
  assert.equal(migrations[1].tables.includes('storage_migrations'), false);
  assert.ok(migrations.every(row => !/\bIF NOT EXISTS\b|\bBEGIN;|\bCOMMIT;/.test(row.sql)));
});

test('plan is strictly read-only and does not bootstrap absent schema/ledger', async () => {
  const pool = await fixture(), before = pool.snapshot(), plan = await planStudioMigrations({ pool });
  assert.deepEqual(plan.target, target); assert.equal(plan.schemaPresent, false); assert.equal(plan.applied.length, 0);
  assert.deepEqual(plan.toApply.map(row => row.version), ['001', '002', '003', '004']); assert.deepEqual(plan.pending, plan.toApply);
  assert.deepEqual(pool.snapshot(), before);
  assert.equal(pool.calls[0].sql, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(pool.calls.some(row => row.marker === 'lock' || row.marker.startsWith('ddl-') || row.marker === 'record'), false);
  assert.equal(pool.connects, pool.releases);
});

test('apply needs explicit confirmation and an exactly matching freshly verified target', async () => {
  const pool = await fixture();
  await assert.rejects(applyStudioMigrations({ pool, expectedTarget: target }), refusal('studio_migration_apply_requires_confirmation'));
  assert.equal(pool.connects, 0);
  await assert.rejects(applyStudioMigrations({ pool, expectedTarget: { ...target, database: 'production' }, confirm: true }), refusal('studio_migration_target_mismatch'));
  assert.equal(pool.snapshot().present, false); assert.equal(pool.calls.some(row => row.marker.startsWith('ddl-')), false);
  const lock = pool.calls.find(row => row.marker === 'lock'); assert.equal(lock.values.length, 2);
  assert.ok(lock.values.every(Number.isInteger)); assert.equal(pool.connects, pool.releases);
});

test('explicit apply records immutable source and structure checksums once; subsequent apply is a no-op', async () => {
  const pool = await fixture(), plan = await planStudioMigrations({ pool });
  const first = await applyStudioMigrations({ pool, expectedTarget: plan.target, confirm: true });
  assert.deepEqual(first.appliedNow, ['001', '002', '003', '004']); assert.deepEqual(first.toApply, []);
  assert.equal(pool.snapshot().ledger.length, 4);
  assert.ok(first.applied.every(row => /^[a-f0-9]{64}$/.test(row.checksum) && /^[a-f0-9]{64}$/.test(row.structureChecksum)));
  const before = pool.snapshot(), ddlCalls = pool.calls.filter(row => row.marker.startsWith('ddl-')).length;
  assert.deepEqual((await applyStudioMigrations({ pool, expectedTarget: plan.target, confirm: true })).appliedNow, []);
  assert.deepEqual(pool.snapshot(), before); assert.equal(pool.calls.filter(row => row.marker.startsWith('ddl-')).length, ddlCalls);
});

test('004 upgrades an exact 001/002/003 catalog while preserving all prior ledger bytes', async () => {
  const pool=await installed();
  pool.change(state=>{
    state.ledger=state.ledger.slice(0,3);
    const newTables=['fullfile_budget_policies','fullfile_reservations'];
    state.relations=state.relations.filter(row=>!newTables.includes(row.name)&&!newTables.includes(row.table_name));
    for(const key of ['columns','constraints','indexes'])state[key]=state[key].filter(row=>!newTables.includes(row.table_name));
  });
  const original=pool.snapshot().ledger;
  assert.deepEqual((await planStudioMigrations({pool})).toApply.map(row=>row.version),['004']);
  assert.deepEqual((await applyStudioMigrations({pool,expectedTarget:target,confirm:true})).appliedNow,['004']);
  assert.deepEqual(pool.snapshot().ledger.slice(0,3),original);
});

test('checksum drift is refused without repairing, backfilling or replaying the ledger', async () => {
  const pool = await installed(); pool.change(state => { state.ledger[0].checksum = '0'.repeat(64); });
  const before = pool.snapshot(), ddlCalls = pool.calls.filter(row => row.marker.startsWith('ddl-')).length;
  await assert.rejects(planStudioMigrations({ pool }), refusal('studio_migration_checksum_mismatch'));
  await assert.rejects(applyStudioMigrations({ pool, expectedTarget: target, confirm: true }), refusal('studio_migration_checksum_mismatch'));
  assert.deepEqual(pool.snapshot(), before); assert.equal(pool.calls.filter(row => row.marker.startsWith('ddl-')).length, ddlCalls);
});

test('unledgered schema, missing structure checksum, unknown and gapped versions fail closed', async () => {
  for (const change of [state => { state.ledger = []; }, state => { state.ledger[0].structure_checksum = null; },
    state => { state.ledger[1].version = '099'; }, state => { state.ledger.shift(); }, state => { state.columns = state.columns.filter(row => row.name !== 'structure_checksum'); }]) {
    const pool = await installed(); pool.change(change); const before = pool.snapshot();
    await assert.rejects(planStudioMigrations({ pool }), refusal('studio_migration_ambiguous_ledger'));
    assert.deepEqual(pool.snapshot(), before);
  }
});

test('unexpected relations/functions/privileges and altered columns/constraints/indexes block migration', async () => {
  for (const [change, code] of [
    [state => { state.relations.push({ name: 'unexpected', kind: 'r', table_name: null, is_constraint: false }); }, 'studio_migration_unexpected_structure'],
    [state => { state.extras.push({ kind: 'function', name: 'unexpected' }); }, 'studio_migration_unexpected_structure'],
    [state => { state.publicGrants.push({ name: 'documents' }); }, 'studio_migration_public_privilege'],
    [state => { state.columns.find(row => row.table_name === 'documents').type = 'integer'; }, 'studio_migration_structure_mismatch'],
    [state => { state.constraints[0].definition = 'different constraint'; }, 'studio_migration_structure_mismatch'],
    [state => { state.indexes[0].definition = 'different index'; }, 'studio_migration_structure_mismatch'],
    [state => { state.indexes[0].valid = false; }, 'studio_migration_unexpected_structure'],
  ]) {
    const pool = await installed(); pool.change(change); const before = pool.snapshot();
    await assert.rejects(planStudioMigrations({ pool }), refusal(code)); assert.deepEqual(pool.snapshot(), before);
  }
});

test('DDL and ledger insertion roll back together, including failure in the second version', async () => {
  for (const marker of ['record', 'ddl-002']) {
    const pool = await fixture(), before = pool.snapshot(); pool.failNext(marker);
    await assert.rejects(applyStudioMigrations({ pool, expectedTarget: target, confirm: true }), refusal('studio_storage_unavailable'));
    assert.deepEqual(pool.snapshot(), before); assert.equal(pool.connects, pool.releases);
    assert.ok(pool.calls.some(row => row.sql === 'ROLLBACK'));
  }
});

test('COMMIT returning rollback cannot report installed migrations', async () => {
  const pool = await fixture(); pool.commitRollback = true;
  await assert.rejects(applyStudioMigrations({ pool, expectedTarget: target, confirm: true }), refusal('studio_migration_rolled_back'));
  assert.equal(pool.snapshot().present, false); assert.equal(pool.snapshot().ledger.length, 0);
});

test('concurrent explicit applies share the short global lock and ledger every version once', async () => {
  const pool = await fixture(), plan = await planStudioMigrations({ pool });
  const results = await Promise.all([1, 2].map(() => applyStudioMigrations({ pool, expectedTarget: plan.target, confirm: true })));
  assert.deepEqual(results.map(row => row.appliedNow.length).sort(), [0, 4]);
  assert.equal(pool.snapshot().ledger.length, 4); assert.equal(pool.calls.filter(row => row.marker.startsWith('ddl-')).length, 4);
});

test('private database diagnostics never leak through planning/apply failures', async () => {
  const pool = await fixture(); pool.failNext('target');
  await assert.rejects(planStudioMigrations({ pool }), error => {
    assert.equal(error.message, 'studio_storage_unavailable'); assert.equal(error.code, 'studio_storage_unavailable');
    assert.equal(error.cause, undefined); assert.equal(error.statusCode, 503); return true;
  });
  assert.equal(pool.connects, pool.releases);
});
