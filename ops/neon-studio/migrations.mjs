import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, isAbsolute } from 'node:path';
import { StudioStorageError, canonicalStudioJson, studioStorageFailure } from '../../packages/studio-registry/server/document-contract.mjs';

const schema = 'croupier_studio';
const hash = text => createHash('sha256').update(text).digest('hex');
const refuse = (code, status = 409) => { throw new StudioStorageError(code, status); };
// Deliberately not a directory scan: a new version needs an explicit code review.
const sources = Object.freeze([
  { version: '001', file: '001-studio-metadata.sql', tables: ['storage_migrations', 'documents', 'document_history', 'audit_events', 'media_records'], indexes: [] },
  { version: '002', file: '002-generation-journals.sql', optional: true,
    tables: ['speech_execution_leases', 'speech_requests', 'gpu_budget_policies', 'gpu_sessions', 'gpu_reservations'],
    indexes: ['gpu_sessions_open_idx', 'gpu_sessions_provider_job_idx', 'gpu_reservations_day_idx'] },
  { version: '003', file: '003-operator-speech-qa.sql', optional: true,
    tables: ['operator_qa_campaigns', 'operator_qa_gate', 'operator_qa_attempts'], indexes: [] },
  { version: '004', file: '004-fullfile-reservations.sql', optional: true,
    tables: ['fullfile_budget_policies', 'fullfile_reservations'], indexes: ['fullfile_reservations_day_idx'] },
  { version: '005', file: '005-operators.sql', optional: true,
    tables: ['operators', 'operator_roles', 'operator_memberships', 'operator_packages'],
    indexes: ['operator_memberships_user_idx'] },
  { version: '006', file: '006-operator-audit.sql',
    tables: ['operator_audit_events'], indexes: ['operator_audit_events_time_idx'] },
  { version: '007', file: '007-partner-branding-drafts.sql',
    tables: ['operator_branding_drafts'], indexes: ['operator_branding_drafts_time_idx'] },
  { version: '008', file: '008-dealer-forge.sql',
    tables: ['forge_dealers', 'forge_jobs'], indexes: ['forge_jobs_dealer_idx'] },
  // 009/010 remain reserved for B18/B19. This reviewed evolution creates no tables.
  { version: '011', file: '011-gpu-daily-budget.sql', tables: [], indexes: [], fingerprintTables: ['gpu_budget_policies'] },
  // The runtime cutover requires the catalogue and reply metadata imported after
  // the additive bridge deployment. Missing 012 now blocks deployment readiness.
  { version: '012', file: '012-runtime-media-catalog.sql',
    tables: ['runtime_media_catalogs', 'speech_reply_records'], indexes: [] },
  // Applied and verified in production; missing admission storage now blocks readiness.
  { version: '013', file: '013-moving-speech-admission.sql',
    tables: ['moving_speech_bindings'], indexes: [] },
  // Applied and verified in production; budget amendments now require 014 at startup.
  { version:'014', file:'014-moving-speech-budget-amendments.sql',
    tables:['moving_speech_budget_amendments'], indexes:[], fingerprintTables:['moving_speech_bindings','moving_speech_budget_amendments'] },
  // Applied and verified in production; capacity proof is now required at startup.
  // This changes technical capacity only, not any existing budget grant.
  { version:'015', file:'015-moving-budget-capacity.sql', tables:[], indexes:[],
    fingerprintTables:['moving_speech_bindings','moving_speech_budget_amendments'] },
  // 016 belongs to the independently reviewed drift-control feature.
  // Additive capacity bridge: production SQL and a separate funded amendment
  // must be verified before 017 becomes required or the higher grant is used.
  { version:'017', file:'017-moving-budget-capacity.sql', deploymentOptional:true, tables:[], indexes:[],
    fingerprintTables:['moving_speech_bindings','moving_speech_budget_amendments'] },
]);
/** Accept only a verified planner result with every required version installed.
 * Deployment-optional versions may be pending; installed versions retain their proofs. */
export function isStudioMigrationPlanReady(plan) {
  if (plan?.schemaPresent !== true || !Array.isArray(plan.toApply) || plan.toApply.length
    || !Array.isArray(plan.applied)) return false;
  const versions = plan.applied.map(row => row?.version);
  const expected = sources.filter(row => !row.deploymentOptional || versions.includes(row.version)).map(row => row.version);
  return versions.length === expected.length && versions.every((version,index) => version === expected[index])
    && plan.applied.every(row => /^[a-f0-9]{64}$/.test(row.checksum ?? '') && /^[a-f0-9]{64}$/.test(row.structureChecksum ?? ''));
}

const budgetConstraint = 'gpu_budget_policies_daily_budget_micro_usd_check';
const budgetDefinition = ceiling => `CHECK (daily_budget_micro_usd >= 1 AND daily_budget_micro_usd <= ${ceiling})`;
const budgetAlter = 'ALTER TABLE croupier_studio.gpu_budget_policies DROP CONSTRAINT gpu_budget_policies_daily_budget_micro_usd_check, ADD CONSTRAINT gpu_budget_policies_daily_budget_micro_usd_check CHECK (daily_budget_micro_usd BETWEEN 1 AND 20000000)';
const movingBudgetConstraint = 'moving_speech_bindings_budget_limit_micro_usd_check';
const movingBudgetDefinition = ceiling => `CHECK (budget_limit_micro_usd >= 1 AND budget_limit_micro_usd <= ${ceiling})`;
const movingBudgetAlter = 'ALTER TABLE croupier_studio.moving_speech_bindings DROP CONSTRAINT moving_speech_bindings_budget_limit_micro_usd_check, ADD CONSTRAINT moving_speech_bindings_budget_limit_micro_usd_check CHECK (budget_limit_micro_usd BETWEEN 1 AND 15000000)';
const movingCapacityChecks = Object.freeze([
  ['moving_speech_bindings','budget_limit_micro_usd'],
  ['moving_speech_budget_amendments','previous_limit_micro_usd'],
  ['moving_speech_budget_amendments','budget_limit_micro_usd'],
].map(([table,column]) => Object.freeze({table,column,name:`${table}_${column}_check`})));
const movingCapacityDefinition = (column,ceiling) => `CHECK (${column} >= 1 AND ${column} <= ${ceiling})`;
const movingCapacityAlters = ceiling => movingCapacityChecks.map(({table,column,name}) =>
  `ALTER TABLE croupier_studio.${table} DROP CONSTRAINT ${name}, ADD CONSTRAINT ${name} CHECK (${column} BETWEEN 1 AND ${ceiling})`);
const migrationLock = Object.freeze([1129467987, 1398035778]);

function statements(sql) {
  const result = []; let part = '', quoted = false, comment = false;
  for (let index = 0; index < sql.length; index++) {
    const char = sql[index], next = sql[index + 1];
    if (comment) { if (char === '\n') { comment = false; part += '\n'; } continue; }
    if (!quoted && char === '-' && next === '-') { comment = true; index++; continue; }
    if (char === "'") {
      part += char;
      if (quoted && next === "'") { part += next; index++; continue; }
      quoted = !quoted; continue;
    }
    if (!quoted && char === ';') { if (part.trim()) result.push(part.trim()); part = ''; }
    else part += char;
  }
  if (quoted || part.trim()) refuse('studio_migration_invalid_source', 422);
  return result;
}

function validateSql(source, sql) {
  if (source.version === '015' || source.version === '017') {
    const parts = statements(sql), expected = movingCapacityAlters(source.version === '015' ? 40000000 : 45000000);
    if (parts.length !== expected.length || parts.some((part,index) => part.replace(/\s+/g,' ') !== expected[index])) refuse('studio_migration_invalid_source',422);
    return;
  }
  if (source.version === '011') {
    const parts = statements(sql);
    if (parts.length !== 1 || parts[0].replace(/\s+/g, ' ') !== budgetAlter) refuse('studio_migration_invalid_source', 422);
    return;
  }
  const tables = [], indexes = []; let createsSchema = 0, movingAlter = 0;
  for (const statement of statements(sql)) {
    if (source.version === '014' && statement.replace(/\s+/g,' ') === movingBudgetAlter) { movingAlter++; continue; }
    const table = /^CREATE TABLE croupier_studio\.([a-z_]+)\s*\(/.exec(statement);
    const index = /^CREATE (?:UNIQUE )?INDEX ([a-z_]+) ON croupier_studio\.([a-z_]+)\s*\(/.exec(statement);
    if (table && source.tables.includes(table[1]) && !tables.includes(table[1])) tables.push(table[1]);
    else if (index && source.indexes.includes(index[1]) && source.tables.includes(index[2]) && !indexes.includes(index[1])) indexes.push(index[1]);
    else if (source.version === '001' && statement === 'CREATE SCHEMA croupier_studio') createsSchema++;
    else if (statement === 'REVOKE ALL ON SCHEMA croupier_studio FROM PUBLIC' && source.version === '001') { /* Explicit least privilege. */ }
    else if (/^REVOKE ALL ON [a-z_.,\s]+ FROM PUBLIC$/.test(statement)) {
      const targets = statement.slice('REVOKE ALL ON '.length, -' FROM PUBLIC'.length).split(',').map(value => value.trim());
      if (!targets.every(value => source.tables.some(name => value === `${schema}.${name}`))) refuse('studio_migration_invalid_source', 422);
    } else refuse('studio_migration_invalid_source', 422);
    // References may only address this schema. Dollar blocks, comments and
    // transaction statements are unsupported in these reviewed versions.
    const unquoted = statement.replace(/'(?:[^']|'')*'/g, "''");
    if (/\/\*|\$[a-z_]*\$|\b(?:BEGIN|COMMIT|ROLLBACK|IF\s+NOT\s+EXISTS|INSERT|UPDATE|DELETE|DROP|ALTER|GRANT)\b/i.test(unquoted)
      || [...unquoted.matchAll(/\b([a-z_][a-z_0-9]*)\.[a-z_][a-z_0-9]*/gi)].some(match => match[1] !== schema)) refuse('studio_migration_invalid_source', 422);
  }
  if (tables.sort().join(',') !== [...source.tables].sort().join(',') || indexes.sort().join(',') !== [...source.indexes].sort().join(',')
    || createsSchema !== (source.version === '001' ? 1 : 0) || movingAlter !== (source.version === '014' ? 1 : 0)) refuse('studio_migration_invalid_source', 422);
}

export async function loadStudioMigrations({ directory } = {}) {
  if (directory !== undefined && (typeof directory !== 'string' || !isAbsolute(directory))) refuse('studio_migration_invalid_source',422);
  const loaded = [];
  for (const source of sources) {
    let bytes;
    try { bytes = await readFile(directory ? join(directory, source.file) : new URL(source.file, import.meta.url), 'utf8'); }
    catch (error) { if (source.optional && error.code === 'ENOENT') continue; refuse('studio_migration_source_unavailable', 503); }
    if (Buffer.byteLength(bytes, 'utf8') > 1024 * 1024 || bytes.includes('\0')) refuse('studio_migration_invalid_source', 422);
    const sql = bytes.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    validateSql(source, sql);
    loaded.push(Object.freeze({ ...source, ...(source.fingerprintTables ? { fingerprintTables: Object.freeze([...source.fingerprintTables]) } : {}), tables: Object.freeze([...source.tables]), indexes: Object.freeze([...source.indexes]), sql, checksum: hash(sql) }));
  }
  return Object.freeze(loaded);
}

async function target(client) {
  const row = (await client.query(`/* studio-migrations:target */ SELECT current_database() AS database,
    current_user AS role, inet_server_addr()::text AS address, inet_server_port() AS port`)).rows[0];
  if (!row || typeof row.database !== 'string' || !row.database || typeof row.role !== 'string' || !row.role
    || row.address !== null && typeof row.address !== 'string' || row.port !== null && !Number.isInteger(row.port)) refuse('studio_migration_target_unverified', 503);
  return Object.freeze({ database: row.database, role: row.role, address: row.address, port: row.port });
}

async function catalog(client) {
  const namespace = (await client.query('/* studio-migrations:namespace */ SELECT oid FROM pg_namespace WHERE nspname=$1', [schema])).rows;
  if (!namespace.length) return { present: false, relations: [], columns: [], constraints: [], indexes: [] };
  const relations = (await client.query(`/* studio-migrations:relations */ SELECT c.relname AS name,c.relkind AS kind,
    t.relname AS table_name, EXISTS(SELECT 1 FROM pg_constraint co WHERE co.conindid=c.oid) AS is_constraint
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_index i ON i.indexrelid=c.oid
    LEFT JOIN pg_class t ON t.oid=i.indrelid WHERE n.nspname=$1 ORDER BY c.relname`, [schema])).rows;
  const extras = (await client.query(`/* studio-migrations:extras */
    SELECT 'function' AS kind,p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1
    UNION ALL SELECT 'type',t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname=$1 AND (t.typtype IN ('d','e','r','m') OR (t.typtype='b' AND t.typelem=0))
    UNION ALL SELECT 'operator',o.oprname FROM pg_operator o JOIN pg_namespace n ON n.oid=o.oprnamespace WHERE n.nspname=$1
    UNION ALL SELECT 'collation',co.collname FROM pg_collation co JOIN pg_namespace n ON n.oid=co.collnamespace WHERE n.nspname=$1
    UNION ALL SELECT 'extension',e.extname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE n.nspname=$1
    UNION ALL SELECT 'trigger',t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND NOT t.tgisinternal
    UNION ALL SELECT 'policy',p.polname FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1
    UNION ALL SELECT 'rule',r.rulename FROM pg_rewrite r JOIN pg_class c ON c.oid=r.ev_class JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1
    UNION ALL SELECT 'row-security',c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND (c.relrowsecurity OR c.relforcerowsecurity)`, [schema])).rows;
  if (extras.length) refuse('studio_migration_unexpected_structure');
  const publicGrants = (await client.query(`/* studio-migrations:public-grants */
    SELECT n.nspname AS name FROM pg_namespace n CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a
      WHERE n.nspname=$1 AND a.grantee=0
    UNION ALL SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname=$1 AND a.grantee=0`, [schema])).rows;
  if (publicGrants.length) refuse('studio_migration_public_privilege');
  const columns = (await client.query(`/* studio-migrations:columns */ SELECT c.relname AS table_name,a.attnum AS position,a.attname AS name,
    format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,a.attidentity AS identity,a.attgenerated AS generated,
    pg_get_expr(d.adbin,d.adrelid,true) AS default_expression FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname=$1 AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`, [schema])).rows;
  const constraints = (await client.query(`/* studio-migrations:constraints */ SELECT c.relname AS table_name,co.conname AS name,co.contype AS kind,
    co.convalidated AS validated,co.condeferrable AS deferrable,co.condeferred AS deferred,
    pg_get_constraintdef(co.oid,true) AS definition FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 ORDER BY c.relname,co.conname`, [schema])).rows;
  const indexes = (await client.query(`/* studio-migrations:indexes */ SELECT t.relname AS table_name,c.relname AS name,
    i.indisvalid AS valid,i.indisready AS ready,pg_get_indexdef(c.oid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
    JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1 ORDER BY t.relname,c.relname`, [schema])).rows;
  return { present: true, relations, columns, constraints, indexes };
}

function fingerprint(objects, migration) {
  const tables = migration.fingerprintTables ?? migration.tables;
  const belongs = row => tables.includes(row.table_name);
  return hash(canonicalStudioJson({
    relations: objects.relations.filter(row => tables.includes(row.name) || belongs(row)),
    columns: objects.columns.filter(belongs), constraints: objects.constraints.filter(belongs), indexes: objects.indexes.filter(belongs),
  }));
}

function verifyObjects(objects, migrations) {
  const tables = migrations.flatMap(version => version.tables), indexes = migrations.flatMap(version => version.indexes);
  const actualTables = objects.relations.filter(row => row.kind === 'r').map(row => row.name).sort();
  if (actualTables.join(',') !== [...tables].sort().join(',') || objects.relations.some(row => row.kind !== 'r'
    && !(row.kind === 'i' && tables.includes(row.table_name) && (row.is_constraint || indexes.includes(row.name))))
    || indexes.some(name => !objects.relations.some(row => row.name === name && row.kind === 'i'))
    || objects.indexes.some(row => !row.valid || !row.ready) || objects.constraints.some(row => !row.validated)) refuse('studio_migration_unexpected_structure');
}

/** Match the ordered ledger to reviewed sources, preserving pending optional gaps. */
export function planStudioMigrationVersions(migrations, versions) {
  const installed = [], pending = []; let next = 0;
  for (const version of versions) {
    while (next < migrations.length && migrations[next].version !== version) {
      const skipped = migrations[next++];
      if (!skipped.deploymentOptional) refuse('studio_migration_ambiguous_ledger');
      pending.push(skipped);
    }
    if (next === migrations.length) refuse('studio_migration_ambiguous_ledger');
    installed.push(migrations[next++]);
  }
  return { installed, toApply: [...pending, ...migrations.slice(next)] };
}

async function inspect(client, migrations, objects) {
  objects ??= await catalog(client);
  if (!objects.present) return { objects, applied: [], toApply: migrations };
  const ledgerColumns = objects.columns.filter(row => row.table_name === 'storage_migrations').map(row => row.name);
  if (ledgerColumns.join(',') !== 'version,checksum,structure_checksum,applied_at') refuse('studio_migration_ambiguous_ledger');
  const rows = (await client.query(`/* studio-migrations:ledger */ SELECT version,checksum,structure_checksum
    FROM croupier_studio.storage_migrations ORDER BY version`)).rows;
  if (!rows.length || rows.length > migrations.length) refuse('studio_migration_ambiguous_ledger');
  const {installed,toApply} = planStudioMigrationVersions(migrations,rows.map(row => row.version));
  for (let index = 0; index < rows.length; index++) {
    if (rows[index].checksum !== installed[index].checksum) refuse('studio_migration_checksum_mismatch');
    if (typeof rows[index].structure_checksum !== 'string' || !/^[a-f0-9]{64}$/.test(rows[index].structure_checksum)) refuse('studio_migration_ambiguous_ledger');
  }
  verifyObjects(objects, installed);
  // Preserve 002's historical fingerprint byte for byte. Only ledgered 011 may
  // project this exact constraint back to its historical 10 USD definition.
  const evolved = installed.some(row => row.version === '011');
  let historical = objects;
  if (evolved) {
    const matches = objects.constraints.filter(row => row.table_name === 'gpu_budget_policies' && row.name === budgetConstraint);
    if (matches.length !== 1 || matches[0].definition !== budgetDefinition(20000000)) refuse('studio_migration_structure_mismatch');
    historical = { ...objects, constraints: objects.constraints.map(row => row === matches[0] ? { ...row, definition: budgetDefinition(10000000) } : row) };
  }
  // Ledgered 017 projects only its three exact CHECKs back for 015's proof.
  let movingCapacityPrevious = objects;
  if (installed.some(row => row.version === '017')) {
    const replacements = new Map();
    for (const {table,column,name} of movingCapacityChecks) {
      const matches = objects.constraints.filter(row => row.table_name === table && row.name === name);
      if (matches.length !== 1 || matches[0].definition !== movingCapacityDefinition(column,45000000)) refuse('studio_migration_structure_mismatch');
      replacements.set(matches[0],{...matches[0],definition:movingCapacityDefinition(column,40000000)});
    }
    movingCapacityPrevious = {...objects,constraints:objects.constraints.map(row => replacements.get(row) ?? row)};
  }
  // Ledgered 015 projects only its three exact CHECKs back for 014's proof.
  // Historical ledger rows and source checksums are never rewritten.
  let movingPrevious = movingCapacityPrevious;
  if (installed.some(row => row.version === '015')) {
    const replacements = new Map();
    for (const {table,column,name} of movingCapacityChecks) {
      const matches = movingCapacityPrevious.constraints.filter(row => row.table_name === table && row.name === name);
      if (matches.length !== 1 || matches[0].definition !== movingCapacityDefinition(column,40000000)) refuse('studio_migration_structure_mismatch');
      replacements.set(matches[0],{...matches[0],definition:movingCapacityDefinition(column,15000000)});
    }
    movingPrevious = {...movingCapacityPrevious,constraints:movingCapacityPrevious.constraints.map(row => replacements.get(row) ?? row)};
  }
  // Ledgered 014 may project only this exact limit back for 013's old proof.
  let movingHistorical = movingPrevious;
  if (installed.some(row => row.version === '014')) {
    const matches = movingPrevious.constraints.filter(row => row.table_name === 'moving_speech_bindings' && row.name === movingBudgetConstraint);
    if (matches.length !== 1 || matches[0].definition !== movingBudgetDefinition(15000000)) refuse('studio_migration_structure_mismatch');
    movingHistorical = { ...movingPrevious, constraints:movingPrevious.constraints.map(row => row === matches[0] ? {...row,definition:movingBudgetDefinition(5000000)} : row) };
  }
  if (rows.some((row, index) => row.structure_checksum !== fingerprint(row.version === '013' ? movingHistorical : row.version === '014' ? movingPrevious : row.version === '015' ? movingCapacityPrevious : evolved && row.version === '002' ? historical : objects, installed[index]))) refuse('studio_migration_structure_mismatch');
  return { objects, applied: rows.map(row => ({ version: row.version, checksum: row.checksum, structureChecksum: row.structure_checksum })), toApply };
}

function result(verifiedTarget, state) {
  // Deployment-optional versions never block readiness or runtime start; apply still runs them.
  const pending = state.toApply.filter(row => !row.deploymentOptional).map(({ version, file, checksum }) => ({ version, file, checksum }));
  return { target: verifiedTarget, targetFingerprint: hash(canonicalStudioJson(verifiedTarget)), schemaPresent: state.objects.present,
    applied: state.applied, toApply: pending, pending,
    optionalPending: state.toApply.filter(row => row.deploymentOptional).map(({ version, file, checksum }) => ({ version, file, checksum })) };
}

async function withClient(pool, readOnly, work) {
  if (!pool || typeof pool.connect !== 'function') refuse('studio_migration_invalid_configuration', 503);
  let client, begun = false;
  try {
    client = await pool.connect();
    if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') refuse('studio_migration_invalid_configuration', 503);
    await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN'); begun = true;
    await client.query("SET LOCAL statement_timeout = '10000ms'; SET LOCAL lock_timeout = '3000ms'; SET LOCAL idle_in_transaction_session_timeout = '10000ms'");
    await client.query('SET LOCAL search_path = pg_catalog');
    if (!readOnly) await client.query('/* studio-migrations:lock */ SELECT pg_advisory_xact_lock($1::integer,$2::integer)', migrationLock);
    const value = await work(client);
    const committed = await client.query('COMMIT'); begun = false;
    if (committed?.command === 'ROLLBACK') refuse('studio_migration_rolled_back', 503);
    return value;
  } catch (error) {
    if (begun) try { await client.query('ROLLBACK'); } catch { /* Do not expose secondary driver diagnostics. */ }
    throw studioStorageFailure(error);
  } finally { try { client?.release?.(); } catch { /* Pool lifecycle belongs to the caller. */ } }
}

// Planning never bootstraps a schema, repairs a ledger or writes data.
export async function planStudioMigrations({ pool, directory } = {}) {
  const migrations = await loadStudioMigrations({ directory }); // No filesystem I/O under a database lock.
  return withClient(pool, true, async client => result(await target(client), await inspect(client, migrations)));
}

export async function applyStudioMigrations({ pool, expectedTarget, confirm } = {}) {
  if (confirm !== true || !expectedTarget) refuse('studio_migration_apply_requires_confirmation', 422);
  let expected;
  try { expected = canonicalStudioJson(expectedTarget); } catch { refuse('studio_migration_target_unverified', 422); }
  const migrations = await loadStudioMigrations();
  return withClient(pool, false, async client => {
    const verifiedTarget = await target(client);
    if (canonicalStudioJson(verifiedTarget) !== expected) refuse('studio_migration_target_mismatch');
    const before = await inspect(client, migrations), appliedNow = [];
    for (const migration of before.toApply) {
      await client.query(migration.sql);
      const objects = await catalog(client);
      const appliedVersions = new Set([...before.applied.map(row => row.version), ...appliedNow, migration.version]);
      verifyObjects(objects, migrations.filter(version => appliedVersions.has(version.version)));
      const structureChecksum = fingerprint(objects, migration);
      await client.query(`/* studio-migrations:record */ INSERT INTO croupier_studio.storage_migrations
        (version,checksum,structure_checksum) VALUES ($1,$2,$3)`, [migration.version, migration.checksum, structureChecksum]);
      appliedNow.push(migration.version);
    }
    return { ...result(verifiedTarget, await inspect(client, migrations)), appliedNow };
  });
}
