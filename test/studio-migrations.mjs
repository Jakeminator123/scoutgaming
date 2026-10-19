import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStudioMigrations, planStudioMigrations, applyStudioMigrations, isStudioMigrationPlanReady, planStudioMigrationVersions } from '../ops/neon-studio/migrations.mjs';
import { mkdtemp, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioStorageError } from '../packages/studio-registry/server/document-contract.mjs';
import { checkMigrationReadiness } from '../tools/check-migration-readiness.mjs';

const target = Object.freeze({ database: 'croupier_isolated_studio_test', role: 'studio_migrator', address: '127.0.0.1', port: 55432 });
const refusal = code => error => error instanceof StudioStorageError && error.code === code;
const copy = value => structuredClone(value);
const budgetCheck = ceiling => ({ table_name:'gpu_budget_policies', name:'gpu_budget_policies_daily_budget_micro_usd_check', kind:'c', validated:true, deferrable:false, deferred:false, definition:`CHECK (daily_budget_micro_usd >= 1 AND daily_budget_micro_usd <= ${ceiling})` });
const movingCheck = ceiling => ({table_name:'moving_speech_bindings',name:'moving_speech_bindings_budget_limit_micro_usd_check',kind:'c',validated:true,deferrable:false,deferred:false,definition:`CHECK (budget_limit_micro_usd >= 1 AND budget_limit_micro_usd <= ${ceiling})`});
const amendmentCheck = (column,ceiling) => ({table_name:'moving_speech_budget_amendments',name:`moving_speech_budget_amendments_${column}_check`,kind:'c',validated:true,deferrable:false,deferred:false,definition:`CHECK (${column} >= 1 AND ${column} <= ${ceiling})`});
const capacityChecks = ceiling => [movingCheck(ceiling),amendmentCheck('previous_limit_micro_usd',ceiling),amendmentCheck('budget_limit_micro_usd',ceiling)];
const setCapacity = (state,ceiling) => {
  for(const expected of capacityChecks(ceiling)) {
    const found=state.constraints.find(row=>row.table_name===expected.table_name&&row.name===expected.name);
    if(found)found.definition=expected.definition;
  }
};
const remove016 = state => {
  state.ledger=state.ledger.filter(row=>row.version!=='016');
  state.relations=state.relations.filter(row=>row.name!=='moving_drift_control'&&row.table_name!=='moving_drift_control');
  for(const key of ['columns','constraints','indexes'])state[key]=state[key].filter(row=>row.table_name!=='moving_drift_control');
};
const remove018 = state => {state.ledger=state.ledger.filter(row=>row.version!=='018');const row=state.constraints.find(row=>row.name===budgetCheck(0).name);if(row)row.definition=budgetCheck(20000000).definition;};
const remove017 = state => {remove018(state);state.ledger=state.ledger.filter(row=>row.version!=='017');setCapacity(state,40000000);};
const remove015 = state => {remove016(state);remove017(state);state.ledger=state.ledger.filter(row=>row.version!=='015');setCapacity(state,15000000);};
const remove014 = state => {
  remove015(state);
  state.ledger=state.ledger.filter(row=>row.version!=='014');
  state.relations=state.relations.filter(row=>row.name!=='moving_speech_budget_amendments'&&row.table_name!=='moving_speech_budget_amendments');
  for(const key of ['columns','constraints','indexes'])state[key]=state[key].filter(row=>row.table_name!=='moving_speech_budget_amendments');
  const old=state.constraints.find(row=>row.name===movingCheck(0).name);if(old)old.definition=movingCheck(5000000).definition;
};
const priorBudget = state => { const row=state.constraints.find(row=>row.name===budgetCheck(0).name); if(row)row.definition=budgetCheck(10000000).definition; };
const remove012 = state => {
  remove018(state);
  const gone=['moving_drift_control','moving_speech_budget_amendments','moving_speech_bindings','runtime_media_catalogs','speech_reply_records'];
  state.relations=state.relations.filter(row=>!gone.includes(row.name)&&!gone.includes(row.table_name));
  for(const key of ['columns','constraints','indexes'])state[key]=state[key].filter(row=>!gone.includes(row.table_name));
};
const remove013 = state => {
  remove014(state);
  state.ledger=state.ledger.filter(row=>row.version!=='013');
  state.relations=state.relations.filter(row=>row.name!=='moving_speech_bindings'&&row.table_name!=='moving_speech_bindings');
  for(const key of ['columns','constraints','indexes'])state[key]=state[key].filter(row=>row.table_name!=='moving_speech_bindings');
};

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
            working.ledger.push({ version: values[0], checksum: values[1], structure_checksum: values[2] });
            working.ledger.sort((a,b)=>a.version.localeCompare(b.version)); return result([], 'INSERT');
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
            if (migration.version === '013') working.constraints.push(movingCheck(5000000));
            if (migration.version === '014') {
              working.constraints.push(amendmentCheck('previous_limit_micro_usd',15000000),amendmentCheck('budget_limit_micro_usd',15000000));
              setCapacity(working,15000000);
            }
            if (migration.version === '015') setCapacity(working,40000000);
            if (migration.version === '017') setCapacity(working,45000000);
            if (migration.version === '002') working.constraints.push(budgetCheck(10000000));
            if (migration.version === '011') working.constraints.find(row=>row.name===budgetCheck(0).name).definition=budgetCheck(20000000).definition;
            if (migration.version === '018') working.constraints.find(row=>row.name===budgetCheck(0).name).definition=budgetCheck(40000000).definition;
            for (const name of migration.indexes) {
              const table = name.startsWith('forge_jobs') ? 'forge_jobs' : name.startsWith('operator_branding_drafts') ? 'operator_branding_drafts' : name.startsWith('operator_audit_events') ? 'operator_audit_events' : name.startsWith('operator_memberships') ? 'operator_memberships'
                : name.startsWith('fullfile_reservations') ? 'fullfile_reservations'
                  : name.startsWith('gpu_reservations') ? 'gpu_reservations' : 'gpu_sessions';
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
  assert.deepEqual(migrations.map(row => row.version), ['001', '002', '003', '004', '005', '006', '007', '008', '011', '012', '013', '014','015','016','017','018']);
  assert.deepEqual(migrations.map(row => row.file), ['001-studio-metadata.sql', '002-generation-journals.sql', '003-operator-speech-qa.sql', '004-fullfile-reservations.sql', '005-operators.sql', '006-operator-audit.sql', '007-partner-branding-drafts.sql', '008-dealer-forge.sql', '011-gpu-daily-budget.sql', '012-runtime-media-catalog.sql', '013-moving-speech-admission.sql','014-moving-speech-budget-amendments.sql','015-moving-budget-capacity.sql','016-moving-drift-control.sql','017-moving-budget-capacity.sql','018-gpu-daily-budget-40.sql']);
  assert.ok(migrations.every(row => /^[a-f0-9]{64}$/.test(row.checksum) && Object.isFrozen(row)));
  assert.equal(migrations[0].tables.includes('storage_migrations'), true);
  assert.equal(migrations[1].tables.includes('storage_migrations'), false);
  assert.ok(migrations.every(row => !/\bIF NOT EXISTS\b|\bBEGIN;|\bCOMMIT;/.test(row.sql)));
});

test('plan is strictly read-only and does not bootstrap absent schema/ledger', async () => {
  const pool = await fixture(), before = pool.snapshot(), plan = await planStudioMigrations({ pool });
  assert.deepEqual(plan.target, target); assert.equal(plan.schemaPresent, false); assert.equal(plan.applied.length, 0);
  assert.deepEqual(plan.toApply.map(row => row.version), ['001', '002', '003', '004', '005', '006', '007', '008', '011', '012', '013','014','015','017']); assert.deepEqual(plan.pending, plan.toApply);
  assert.deepEqual(plan.optionalPending.map(row=>row.version), ['016','018']);
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
  assert.deepEqual(first.appliedNow, ['001', '002', '003', '004', '005', '006', '007', '008', '011', '012', '013', '014','015','016','017','018']); assert.deepEqual(first.toApply, []);
  assert.equal(pool.snapshot().ledger.length, 16);
  assert.ok(first.applied.every(row => /^[a-f0-9]{64}$/.test(row.checksum) && /^[a-f0-9]{64}$/.test(row.structureChecksum)));
  const before = pool.snapshot(), ddlCalls = pool.calls.filter(row => row.marker.startsWith('ddl-')).length;
  assert.deepEqual((await applyStudioMigrations({ pool, expectedTarget: plan.target, confirm: true })).appliedNow, []);
  assert.deepEqual(pool.snapshot(), before); assert.equal(pool.calls.filter(row => row.marker.startsWith('ddl-')).length, ddlCalls);
});

test('004 and 005 upgrade an exact 001/002/003 catalog while preserving all prior ledger bytes', async () => {
  const pool=await installed();
  pool.change(state=>{
    state.ledger=state.ledger.slice(0,3); priorBudget(state);
    const newTables=['moving_drift_control','moving_speech_budget_amendments','moving_speech_bindings','runtime_media_catalogs','speech_reply_records','fullfile_budget_policies','fullfile_reservations','operators','operator_roles','operator_memberships','operator_packages','operator_audit_events','operator_branding_drafts','forge_dealers','forge_jobs'];
    state.relations=state.relations.filter(row=>!newTables.includes(row.name)&&!newTables.includes(row.table_name));
    for(const key of ['columns','constraints','indexes'])state[key]=state[key].filter(row=>!newTables.includes(row.table_name));
  });
  const original=pool.snapshot().ledger;
  assert.deepEqual((await planStudioMigrations({pool})).toApply.map(row=>row.version),['004','005','006','007','008', '011', '012', '013','014','015','017']);
  assert.deepEqual((await applyStudioMigrations({pool,expectedTarget:target,confirm:true})).appliedNow,['004','005','006','007','008', '011', '012', '013', '014','015','016','017','018']);
  assert.deepEqual(pool.snapshot().ledger.slice(0,3),original);
});

test('005 upgrades an exact 001/002/003/004 catalog while preserving all prior ledger bytes', async () => {
  const pool = await installed();
  pool.change(state => {
    state.ledger = state.ledger.slice(0, 4); priorBudget(state);
    const newTables = ['moving_drift_control','moving_speech_budget_amendments','moving_speech_bindings','runtime_media_catalogs','speech_reply_records','operators', 'operator_roles', 'operator_memberships', 'operator_packages','operator_audit_events','operator_branding_drafts','forge_dealers','forge_jobs'];
    state.relations = state.relations.filter(row => !newTables.includes(row.name) && !newTables.includes(row.table_name));
    for (const key of ['columns', 'constraints', 'indexes']) state[key] = state[key].filter(row => !newTables.includes(row.table_name));
  });
  const original = pool.snapshot().ledger;
  assert.deepEqual((await planStudioMigrations({ pool })).toApply.map(row => row.version), ['005', '006', '007', '008', '011', '012', '013','014','015','017']);
  assert.deepEqual((await applyStudioMigrations({ pool, expectedTarget: target, confirm: true })).appliedNow, ['005', '006', '007', '008', '011', '012', '013', '014','015','016','017','018']);
  assert.deepEqual(pool.snapshot().ledger.slice(0, 4), original);
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
  const expected = (await loadStudioMigrations()).length;
  assert.deepEqual(results.map(row => row.appliedNow.length).sort((a,b)=>a-b), [0, expected]);
  assert.equal(pool.snapshot().ledger.length, expected); assert.equal(pool.calls.filter(row => row.marker.startsWith('ddl-')).length, expected);
});

test('private database diagnostics never leak through planning/apply failures', async () => {
  const pool = await fixture(); pool.failNext('target');
  await assert.rejects(planStudioMigrations({ pool }), error => {
    assert.equal(error.message, 'studio_storage_unavailable'); assert.equal(error.code, 'studio_storage_unavailable');
    assert.equal(error.cause, undefined); assert.equal(error.statusCode, 503); return true;
  });
  assert.equal(pool.connects, pool.releases);
});

test('006 adds only the scoped journal while retaining every preexisting ledger fingerprint', async()=>{
 const pool=await installed();
 pool.change(state=>{
   state.ledger=state.ledger.slice(0,5); priorBudget(state);
   const gone=['moving_drift_control','moving_speech_budget_amendments','moving_speech_bindings','runtime_media_catalogs','speech_reply_records','operator_audit_events','operator_branding_drafts','forge_dealers','forge_jobs'];
   state.relations=state.relations.filter(row=>!gone.includes(row.name)&&!gone.includes(row.table_name));
   for(const key of ['columns','constraints','indexes'])state[key]=state[key].filter(row=>!gone.includes(row.table_name));
 });
 const original=pool.snapshot().ledger;
 assert.deepEqual((await planStudioMigrations({pool})).toApply.map(row=>row.version),['006','007','008', '011', '012', '013','014','015','017']);
 assert.deepEqual((await applyStudioMigrations({pool,expectedTarget:target,confirm:true})).appliedNow,['006','007','008', '011', '012', '013', '014','015','016','017','018']);
 assert.deepEqual(pool.snapshot().ledger.slice(0,5),original);
 pool.change(state=>state.ledger[5].checksum='f'.repeat(64));
 await assert.rejects(planStudioMigrations({pool}),refusal('studio_migration_checksum_mismatch'));
});

test('007 adds draft revisions without changing existing ledger fingerprints and rejects malformed installed007',async()=>{
 const pool=await installed();
 pool.change(state=>{
   state.ledger=state.ledger.slice(0,6); priorBudget(state);
   const gone=['moving_drift_control','moving_speech_budget_amendments','moving_speech_bindings','runtime_media_catalogs','speech_reply_records','operator_branding_drafts','forge_dealers','forge_jobs'];
   state.relations=state.relations.filter(row=>!gone.includes(row.name)&&!gone.includes(row.table_name));
   for(const key of ['columns','constraints','indexes'])state[key]=state[key].filter(row=>!gone.includes(row.table_name));
 });
 const original=pool.snapshot().ledger,plan=await planStudioMigrations({pool});
 assert.deepEqual(plan.toApply.map(row=>row.version),['007','008', '011', '012', '013','014','015','017']);
 assert.deepEqual(plan.pending.map(row=>row.version),['007','008', '011', '012', '013','014','015','017']);
 assert.deepEqual((await applyStudioMigrations({pool,expectedTarget:target,confirm:true})).appliedNow,['007','008', '011', '012', '013', '014','015','016','017','018']);
 assert.deepEqual(pool.snapshot().ledger.slice(0,6),original);
 assert.deepEqual((await planStudioMigrations({pool})).pending,[]);
 pool.change(state=>state.ledger[6].checksum='f'.repeat(64));
 await assert.rejects(planStudioMigrations({pool}),refusal('studio_migration_checksum_mismatch'));
});

test('008 (Dealer Forge) is pinned: pending blocks readiness until applied, ledger before it untouched',async()=>{
 const pool=await installed();
 pool.change(state=>{
   state.ledger=state.ledger.slice(0,7); priorBudget(state);
   const gone=['moving_drift_control','moving_speech_budget_amendments','moving_speech_bindings','runtime_media_catalogs','speech_reply_records','forge_dealers','forge_jobs'];
   state.relations=state.relations.filter(row=>!gone.includes(row.name)&&!gone.includes(row.table_name));
   for(const key of ['columns','constraints','indexes'])state[key]=state[key].filter(row=>!gone.includes(row.table_name));
 });
 const original=pool.snapshot().ledger,plan=await planStudioMigrations({pool});
 assert.deepEqual(plan.applied.map(row=>row.version),['001','002','003','004','005','006','007']);
 assert.deepEqual(plan.toApply.map(row=>row.version),['008', '011', '012', '013','014','015','017']); assert.deepEqual(plan.pending.map(row=>row.version),['008', '011', '012', '013','014','015','017']);
 assert.deepEqual(plan.optionalPending.map(row=>row.version),['016','018']);
 assert.deepEqual((await applyStudioMigrations({pool,expectedTarget:target,confirm:true})).appliedNow,['008', '011', '012', '013', '014','015','016','017','018']);
 assert.deepEqual(pool.snapshot().ledger.slice(0,7),original);
 const after=await planStudioMigrations({pool});
 assert.deepEqual(after.applied.map(row=>row.version).at(-1),'018'); assert.deepEqual(after.optionalPending,[]);
 pool.change(state=>state.ledger[7].checksum='f'.repeat(64));
 await assert.rejects(planStudioMigrations({pool}),refusal('studio_migration_checksum_mismatch'));
});

 test('011 preserves historical ledger, rejects unledgered widening and unrelated drift', async () => {
   const pool=await installed();
   const complete=pool.snapshot();
   pool.change(state=>{state.ledger=state.ledger.slice(0,8); remove012(state); priorBudget(state);});
   const original=pool.snapshot().ledger;
   assert.deepEqual((await planStudioMigrations({pool})).pending.map(row=>row.version),['011', '012', '013','014','015','017']);
   await applyStudioMigrations({pool,expectedTarget:target,confirm:true});
   assert.deepEqual(pool.snapshot().ledger.slice(0,8),original);
   assert.deepEqual(pool.snapshot().ledger,complete.ledger);
   for (const change of [state=>{remove012(state);state.ledger=state.ledger.slice(0,8);},state=>{priorBudget(state);},state=>{state.constraints.find(row=>row.name===budgetCheck(0).name).definition=budgetCheck(21000000).definition;}]) {
     const broken=await installed(); broken.change(change);
     await assert.rejects(planStudioMigrations({pool:broken}),refusal('studio_migration_structure_mismatch'));
   }
 });

test('011 source admits only the exact reviewed constraint and is never deployment-optional', async t=>{
 const migrations=await loadStudioMigrations(), evolution=migrations.find(row=>row.version==='011');
 assert.equal(evolution.version,'011'); assert.equal(evolution.deploymentOptional,undefined);
 const directory=await mkdtemp(join(tmpdir(),'croupier-budget-source-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 for(const migration of migrations)await copyFile(new URL('../ops/neon-studio/'+migration.file,import.meta.url),join(directory,migration.file));
 for(const sql of [evolution.sql.replace('20000000','21000000'),evolution.sql+'DROP TABLE croupier_studio.gpu_reservations;' ,evolution.sql.replaceAll('gpu_budget_policies_daily_budget_micro_usd_check','wrong_check')]){
  await writeFile(join(directory,evolution.file),sql);
  await assert.rejects(loadStudioMigrations({directory}),refusal('studio_migration_invalid_source'));
 }
});

test('012 is required for runtime readiness; applying it preserves all earlier ledger fingerprints',async()=>{
  const migrations=await loadStudioMigrations(),bridge=migrations.find(row=>row.version==='012');
  assert.equal(bridge.deploymentOptional,undefined);
  assert.deepEqual(bridge.tables,['runtime_media_catalogs','speech_reply_records']);
  assert.deepEqual(bridge.indexes,[]);
  assert.match(bridge.sql,/PRIMARY KEY \(environment_id, workspace_id\)/);
  assert.match(bridge.sql,/PRIMARY KEY \(environment_id, workspace_id, dealer_id, id\)/);
  assert.match(bridge.sql,/value->>'dealerId' = dealer_id/);
  assert.match(bridge.sql,/value->>'id' = id::text/);
  assert.match(bridge.sql,/value->>'revision' = revision::text/);
  const pool=await installed();
  pool.change(state=>{state.ledger=state.ledger.slice(0,9);remove012(state);});
  const original=pool.snapshot().ledger;
  const before=await planStudioMigrations({pool});
  assert.equal(before.applied.at(-1).version,'011');
  assert.deepEqual(before.pending.map(row=>row.version),['012','013','014','015','017']);
  assert.deepEqual(before.optionalPending.map(row=>row.version),['016','018']);
  const blocked=await checkMigrationReadiness({pool});
  assert.equal(blocked.ready,false);assert.equal(blocked.exitCode,1);
  assert.deepEqual(blocked.pending,['012','013','014','015','017']);assert.deepEqual(blocked.optionalPending,['016','018']);
  const applied=await applyStudioMigrations({pool,expectedTarget:target,confirm:true});
  assert.deepEqual(applied.appliedNow,['012', '013', '014','015','016','017','018']);assert.deepEqual(applied.optionalPending,[]);
  assert.deepEqual(pool.snapshot().ledger.slice(0,9),original);
  assert.deepEqual((await planStudioMigrations({pool})).applied.map(row=>row.version),migrations.map(row=>row.version));
  const ready=await checkMigrationReadiness({pool});
  assert.equal(ready.ready,true);assert.equal(ready.exitCode,0);
  assert.deepEqual(ready.pending,[]);assert.deepEqual(ready.optionalPending,[]);
});

test('012 rejects unledgered tables or changed source/structure fingerprints',async()=>{
  for(const [edit,code] of [
    [state=>state.ledger.pop(),'studio_migration_unexpected_structure'],
    [state=>{state.ledger.at(-1).checksum='f'.repeat(64);},'studio_migration_checksum_mismatch'],
    [state=>{state.columns.find(row=>row.table_name==='runtime_media_catalogs').type='jsonb';},'studio_migration_structure_mismatch'],
  ]) {
    const pool=await installed();pool.change(remove013);pool.change(edit);const before=pool.snapshot();
    await assert.rejects(planStudioMigrations({pool}),refusal(code));assert.deepEqual(pool.snapshot(),before);
  }
});

test('013 is required for readiness and adds only moving bindings without rewriting prior ledger',async()=>{
  const pool=await installed();pool.change(remove013);const before=pool.snapshot().ledger;
  const ready=await checkMigrationReadiness({pool});
  assert.equal(ready.ready,false);assert.equal(ready.exitCode,1);assert.deepEqual(ready.pending,['013','014','015','017']);assert.deepEqual(ready.optionalPending,['016','018']);
  const planned=await planStudioMigrations({pool});assert.deepEqual(planned.toApply.map(row=>row.version),['013','014','015','017']);
  assert.equal(isStudioMigrationPlanReady(planned),false);assert.deepEqual(planned.optionalPending.map(row=>row.version),['016','018']);
  const applied=await applyStudioMigrations({pool,expectedTarget:target,confirm:true});
  assert.deepEqual(applied.appliedNow,['013', '014','015','016','017','018']);assert.deepEqual(pool.snapshot().ledger.slice(0,10),before);
  const migration=(await loadStudioMigrations()).find(row=>row.version==='013');
  assert.equal(migration.deploymentOptional,undefined);
  assert.equal((await checkMigrationReadiness({pool})).ready,true);
  assert.equal(isStudioMigrationPlanReady(await planStudioMigrations({pool})),true);
  assert.deepEqual(migration.tables,['moving_speech_bindings']);assert.deepEqual(migration.indexes,[]);
  assert.match(migration.sql,/reserved_micro_usd BETWEEN 1 AND 5000000/);
});


test('runtime readiness rejects missing required013 even if a caller labels it optional',async()=>{
  const pool=await fixture();assert.equal(isStudioMigrationPlanReady(await planStudioMigrations({pool})),false);
  const complete=await applyStudioMigrations({pool,expectedTarget:target,confirm:true});
  assert.equal(isStudioMigrationPlanReady(complete),true);
  const optionalPending=copy(complete);optionalPending.applied=optionalPending.applied.filter(row=>row.version!=='013');
  optionalPending.optionalPending=[{version:'013'}];assert.equal(isStudioMigrationPlanReady(optionalPending),false);
  for(const mutate of [
    value=>{value.applied=value.applied.filter(row=>row.version!=='012');},
    value=>value.applied.push({...value.applied.at(-1),version:'999'}),
    value=>value.applied.push({...value.applied.at(-1)}),
    value=>{value.applied[0].checksum='invalid';},
    value=>{value.applied.at(-1).structureChecksum='invalid';},
    value=>{value.toApply=[{version:'012'}];},
    value=>{value.schemaPresent=false;},
    value=>{value.applied.reverse();},
  ]){
    const invalid=copy(complete);mutate(invalid);assert.equal(isStudioMigrationPlanReady(invalid),false);
  }
  for(const malformed of [null,{}, {schemaPresent:true,toApply:[],applied:null}])assert.equal(isStudioMigrationPlanReady(malformed),false);
});

test('014 blocks missing schema, preserves 013 history and rejects unledgered or altered widening',async()=>{
  const pool=await installed(),complete=pool.snapshot();pool.change(remove014);
  const old=pool.snapshot().ledger,plan=await planStudioMigrations({pool});
  assert.equal(isStudioMigrationPlanReady(plan),false);assert.deepEqual(plan.toApply.map(row=>row.version),['014','015','017']);
  const mislabeled=copy(plan);mislabeled.toApply=[];mislabeled.optionalPending=[{version:'014'}];
  assert.equal(isStudioMigrationPlanReady(mislabeled),false);
  const blocked=await checkMigrationReadiness({pool});
  assert.equal(blocked.ready,false);assert.deepEqual(blocked.pending,['014','015','017']);
  assert.deepEqual(plan.optionalPending.map(row=>row.version),['016','018']);
  const applied=await applyStudioMigrations({pool,expectedTarget:target,confirm:true});
  assert.deepEqual(applied.appliedNow,['014','015','016','017','018']);assert.deepEqual(pool.snapshot().ledger.slice(0,11),old);
  assert.deepEqual(pool.snapshot().ledger,complete.ledger);
  for(const mutate of [
    state=>{state.ledger.pop();},
    state=>{state.constraints.find(row=>row.name===movingCheck(0).name).definition=movingCheck(16000000).definition;},
    state=>{state.constraints.find(row=>row.name===movingCheck(0).name).definition=movingCheck(5000000).definition;},
  ]) { const broken=await installed();broken.change(mutate);await assert.rejects(planStudioMigrations({pool:broken})); }
  const unledgered=await installed();unledgered.change(remove014);
  unledgered.change(state=>{state.constraints.find(row=>row.name===movingCheck(0).name).definition=movingCheck(15000000).definition;});
  await assert.rejects(planStudioMigrations({pool:unledgered}),refusal('studio_migration_structure_mismatch'));
});

test('014 source allows only its reviewed limit evolution and creates no budget grant',async t=>{
  const migrations=await loadStudioMigrations(),evolution=migrations.find(row=>row.version==='014');
  const directory=await mkdtemp(join(tmpdir(),'croupier-moving-budget-source-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  for(const migration of migrations)await copyFile(new URL('../ops/neon-studio/'+migration.file,import.meta.url),join(directory,migration.file));
  assert.equal(evolution.deploymentOptional,undefined);
  assert.equal(/\b(?:INSERT|UPDATE|DELETE)\b/.test(evolution.sql),false);
  for(const sql of [evolution.sql.replaceAll('15000000','16000000'),evolution.sql+'DROP TABLE croupier_studio.gpu_reservations;',evolution.sql.replaceAll('moving_speech_bindings_budget_limit_micro_usd_check','wrong_check')]){
    await writeFile(join(directory,evolution.file),sql);
    await assert.rejects(loadStudioMigrations({directory}),refusal('studio_migration_invalid_source'));
  }
});

test('015 is required for readiness and preserves historical proofs without accepting unledgered widening',async()=>{
  const pool=await installed(),complete=pool.snapshot();pool.change(remove015);
  const old=pool.snapshot().ledger,plan=await planStudioMigrations({pool});
  assert.deepEqual(plan.toApply.map(row=>row.version),['015','017']);assert.deepEqual(plan.optionalPending.map(row=>row.version),['016','018']);
  assert.equal(isStudioMigrationPlanReady(plan),false);
  const mislabeled=copy(plan);mislabeled.toApply=[];mislabeled.pending=[];mislabeled.optionalPending=[{version:'015'}];
  assert.equal(isStudioMigrationPlanReady(mislabeled),false,'caller cannot relabel required015 as optional');
  const readiness=await checkMigrationReadiness({pool});
  assert.equal(readiness.ready,false);assert.equal(readiness.exitCode,1);
  assert.deepEqual(readiness.pending,['015','017']);assert.deepEqual(readiness.optionalPending,['016','018']);
  const applied=await applyStudioMigrations({pool,expectedTarget:target,confirm:true});
  assert.deepEqual(applied.appliedNow,['015','016','017','018']);assert.equal(isStudioMigrationPlanReady(applied),true);
  const ready=await checkMigrationReadiness({pool});assert.equal(ready.ready,true);assert.equal(ready.exitCode,0);
  assert.deepEqual(pool.snapshot().ledger.slice(0,old.length),old);
  assert.deepEqual(pool.snapshot().ledger,complete.ledger);
  for(const check of capacityChecks(40000000)) {
    const broken=await installed();broken.change(remove017);broken.change(state=>{
      state.constraints.find(row=>row.table_name===check.table_name&&row.name===check.name).definition=check.definition.replaceAll('40000000','40000001');
    });
    await assert.rejects(planStudioMigrations({pool:broken}),refusal('studio_migration_structure_mismatch'));
  }
  const unledgered=await installed();unledgered.change(remove016);unledgered.change(remove017);unledgered.change(state=>{state.ledger.pop();});
  await assert.rejects(planStudioMigrations({pool:unledgered}),refusal('studio_migration_structure_mismatch'));
  const altered=await installed();altered.change(state=>{
    state.constraints.find(row=>row.table_name==='moving_speech_budget_amendments'&&row.kind==='p').definition='changed unrelated constraint';
  });
  await assert.rejects(planStudioMigrations({pool:altered}),refusal('studio_migration_structure_mismatch'));
});

test('015 source changes only the three reviewed capacities and never grants or rewrites budget',async t=>{
  const migrations=await loadStudioMigrations(),evolution=migrations.find(row=>row.version==='015');
  const directory=await mkdtemp(join(tmpdir(),'croupier-moving-capacity-source-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  for(const migration of migrations)await copyFile(new URL('../ops/neon-studio/'+migration.file,import.meta.url),join(directory,migration.file));
  assert.equal(evolution.deploymentOptional,undefined);
  assert.equal(/\b(?:INSERT|UPDATE|DELETE|GRANT)\b/.test(evolution.sql),false);
  for(const sql of [evolution.sql.replaceAll('40000000','40000001'),evolution.sql+'DELETE FROM croupier_studio.gpu_reservations;',
    evolution.sql.replaceAll('moving_speech_budget_amendments_previous_limit_micro_usd_check','wrong_check'),
    evolution.sql.replace(/ALTER TABLE[^;]+;/,'')]) {
    await writeFile(join(directory,evolution.file),sql);
    await assert.rejects(loadStudioMigrations({directory}),refusal('studio_migration_invalid_source'));
  }
});

test('017 is required for readiness and preserves every013/014/015 proof at exactly45USD',async()=>{
  const pool=await installed(),complete=pool.snapshot();pool.change(remove017);
  const old=pool.snapshot().ledger,plan=await planStudioMigrations({pool});
  assert.equal(isStudioMigrationPlanReady(plan),false);assert.deepEqual(plan.toApply.map(row=>row.version),['017']);
  assert.deepEqual(plan.optionalPending.map(row=>row.version),['018']);
  const mislabeled=copy(plan);mislabeled.toApply=[];mislabeled.pending=[];mislabeled.optionalPending=[{version:'017'}];
  assert.equal(isStudioMigrationPlanReady(mislabeled),false,'caller cannot relabel required017 as optional');
  const before=await checkMigrationReadiness({pool});
  assert.equal(before.ready,false);assert.equal(before.exitCode,1);assert.deepEqual(before.pending,['017']);assert.deepEqual(before.optionalPending,['018']);
  const applied=await applyStudioMigrations({pool,expectedTarget:target,confirm:true});
  assert.deepEqual(applied.appliedNow,['017','018']);assert.equal(isStudioMigrationPlanReady(applied),true);
  assert.deepEqual(pool.snapshot().ledger.slice(0,old.length),old);
  assert.deepEqual(pool.snapshot().ledger,complete.ledger);
  for(const check of capacityChecks(45000000)){
    const broken=await installed();broken.change(state=>{
      state.constraints.find(row=>row.table_name===check.table_name&&row.name===check.name).definition=check.definition.replaceAll('45000000','45000001');
    });
    await assert.rejects(planStudioMigrations({pool:broken}),refusal('studio_migration_structure_mismatch'));
  }
  const unledgered=await installed();unledgered.change(state=>{state.ledger.pop();});
  await assert.rejects(planStudioMigrations({pool:unledgered}),refusal('studio_migration_structure_mismatch'));
  const changedProof=await installed();changedProof.change(state=>{state.ledger.find(row=>row.version==='015').structure_checksum='f'.repeat(64);});
  await assert.rejects(planStudioMigrations({pool:changedProof}),refusal('studio_migration_structure_mismatch'));
});

test('the ledger version planner permits actual optional016 before installed017, but no required gap',async()=>{
  const migrations=await loadStudioMigrations(),installed=migrations.filter(row=>row.version!=='016'),versions=installed.map(row=>row.version);
  const optional=migrations.find(row=>row.version==='016');
  assert.equal(optional.deploymentOptional,true);
  const plan=planStudioMigrationVersions(migrations,versions);
  assert.deepEqual(plan.installed,installed,'installed sources and checksums are preserved');
  assert.deepEqual(plan.toApply,[optional],'the actual optional migration remains explicitly pending');
  assert.throws(()=>planStudioMigrationVersions(migrations.map(row=>row.version==='016'?{...row,deploymentOptional:false}:row),versions),refusal('studio_migration_ambiguous_ledger'));
  assert.throws(()=>planStudioMigrationVersions(migrations,versions.filter(version=>version!=='015')),refusal('studio_migration_ambiguous_ledger'));
});

test('017 SQL only raises the three reviewed capacities to45USD without modifying historical data',async t=>{
  const migrations=await loadStudioMigrations(),evolution=migrations.find(row=>row.version==='017');
  assert.equal(evolution.deploymentOptional,undefined);
  assert.equal(evolution.checksum,'116e00730d93dd0605e73f162f0e7d7487fb6b2fdd2e98be87b360cb2561532b');
  assert.equal(/\b(?:INSERT|UPDATE|DELETE|GRANT)\b/.test(evolution.sql),false);
  const directory=await mkdtemp(join(tmpdir(),'croupier-moving-45-source-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  for(const migration of migrations)await copyFile(new URL('../ops/neon-studio/'+migration.file,import.meta.url),join(directory,migration.file));
  for(const sql of [evolution.sql.replaceAll('45000000','45000001'),evolution.sql+'DELETE FROM croupier_studio.gpu_reservations;',
    evolution.sql.replaceAll('moving_speech_budget_amendments_previous_limit_micro_usd_check','wrong_check'),evolution.sql.replace(/ALTER TABLE[^;]+;/,'')]){
    await writeFile(join(directory,evolution.file),sql);
    await assert.rejects(loadStudioMigrations({directory}),refusal('studio_migration_invalid_source'));
  }
});


test('016 is deployment-optional, preserves required readiness and retains installed structure proofs',async()=>{
  const pool=await installed(),complete=pool.snapshot();pool.change(remove016);
  const before=pool.snapshot().ledger,plan=await planStudioMigrations({pool});
  assert.equal(isStudioMigrationPlanReady(plan),true);assert.deepEqual(plan.toApply,[]);
  assert.deepEqual(plan.optionalPending.map(row=>row.version),['016']);
  const readiness=await checkMigrationReadiness({pool});
  assert.equal(readiness.ready,true);assert.deepEqual(readiness.optionalPending,['016']);
  const applied=await applyStudioMigrations({pool,expectedTarget:target,confirm:true});
  assert.deepEqual(applied.appliedNow,['016']);
  assert.deepEqual(pool.snapshot().ledger.filter(row=>row.version!=='016'),before);
  assert.deepEqual(pool.snapshot(),complete);
  pool.change(state=>state.columns.find(row=>row.table_name==='moving_drift_control').type='integer');
  await assert.rejects(planStudioMigrations({pool}),refusal('studio_migration_structure_mismatch'));
});

test('deferOptional can install017 before016 without changing existing source or structure proofs',async()=>{
  const pool=await fixture(),migrations=await loadStudioMigrations();
  const deferred=await applyStudioMigrations({pool,expectedTarget:target,confirm:true,deferOptional:['016']});
  assert.deepEqual(deferred.appliedNow,migrations.filter(row=>row.version!=='016').map(row=>row.version));
  assert.deepEqual(deferred.optionalPending.map(row=>row.version),['016']);
  assert.equal(isStudioMigrationPlanReady(deferred),true);
  const before=pool.snapshot().ledger,plan=await planStudioMigrations({pool});
  assert.deepEqual(plan.applied.map(row=>row.version),before.map(row=>row.version));
  assert.deepEqual(plan.toApply,[]);assert.deepEqual(plan.optionalPending.map(row=>row.version),['016']);
  const applied=await applyStudioMigrations({pool,expectedTarget:target,confirm:true});
  assert.deepEqual(applied.appliedNow,['016']);assert.deepEqual(applied.optionalPending,[]);
  assert.deepEqual(pool.snapshot().ledger.filter(row=>row.version!=='016'),before);
  assert.equal(isStudioMigrationPlanReady(applied),true);
  assert.deepEqual((await applyStudioMigrations({pool,expectedTarget:target,confirm:true})).appliedNow,[]);
});

test('required017 cannot be deferred alone or together with optional016',async()=>{
  for(const deferOptional of [['017'],['016','017']]){
    const pool=await fixture();
    await assert.rejects(applyStudioMigrations({pool,expectedTarget:target,confirm:true,deferOptional}),
      error=>refusal('studio_migration_invalid_defer_optional')(error)&&error.statusCode===422);
    assert.equal(pool.connects,0);assert.deepEqual(pool.calls,[]);assert.deepEqual(pool.snapshot().ledger,[]);
  }
});

test('invalid deferOptional arguments are rejected before any transaction or database connection',async()=>{
  for(const deferOptional of [null,{},'016',[16],['999'],['015'],['016','016'],['016','015']]){
    const pool=await fixture();
    await assert.rejects(applyStudioMigrations({pool,expectedTarget:target,confirm:true,deferOptional}),error=>refusal('studio_migration_invalid_defer_optional')(error)&&error.statusCode===422);
    assert.equal(pool.connects,0);assert.deepEqual(pool.calls,[]);assert.deepEqual(pool.snapshot().ledger,[]);
  }
});
