import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, isAbsolute } from 'node:path';
import { StudioStorageError, canonicalStudioJson, studioStorageFailure } from '../../web/storage/studio-contract.mjs';

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
  { version: '006', file: '006-operator-audit.sql', optional: true,
    tables: ['operator_audit_events'], indexes: ['operator_audit_events_time_idx'] },
]);
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
  const tables = [], indexes = []; let createsSchema = 0;
  for (const statement of statements(sql)) {
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
    || createsSchema !== (source.version === '001' ? 1 : 0)) refuse('studio_migration_invalid_source', 422);
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
    loaded.push(Object.freeze({ ...source, tables: Object.freeze([...source.tables]), indexes: Object.freeze([...source.indexes]), sql, checksum: hash(sql) }));
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
  const belongs = row => migration.tables.includes(row.table_name);
  return hash(canonicalStudioJson({
    relations: objects.relations.filter(row => migration.tables.includes(row.name) || belongs(row)),
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

async function inspect(client, migrations, objects) {
  objects ??= await catalog(client);
  if (!objects.present) return { objects, applied: [], toApply: migrations };
  const ledgerColumns = objects.columns.filter(row => row.table_name === 'storage_migrations').map(row => row.name);
  if (ledgerColumns.join(',') !== 'version,checksum,structure_checksum,applied_at') refuse('studio_migration_ambiguous_ledger');
  const rows = (await client.query(`/* studio-migrations:ledger */ SELECT version,checksum,structure_checksum
    FROM croupier_studio.storage_migrations ORDER BY version`)).rows;
  if (!rows.length || rows.length > migrations.length || rows.some((row, index) => row.version !== migrations[index]?.version)) refuse('studio_migration_ambiguous_ledger');
  for (let index = 0; index < rows.length; index++) {
    if (rows[index].checksum !== migrations[index].checksum) refuse('studio_migration_checksum_mismatch');
    if (typeof rows[index].structure_checksum !== 'string' || !/^[a-f0-9]{64}$/.test(rows[index].structure_checksum)) refuse('studio_migration_ambiguous_ledger');
  }
  const installed = migrations.slice(0, rows.length);
  verifyObjects(objects, installed);
  if (rows.some((row, index) => row.structure_checksum !== fingerprint(objects, installed[index]))) refuse('studio_migration_structure_mismatch');
  return { objects, applied: rows.map(row => ({ version: row.version, checksum: row.checksum, structureChecksum: row.structure_checksum })), toApply: migrations.slice(rows.length) };
}

function result(verifiedTarget, state) {
  // Preparation release only: no runtime consumer uses 006 yet. It is still
  // checksum/structure-verified when installed and apply explicitly installs it.
  // Only this exact reviewed optional migration may wait until after rollout.
  const optionalToApply = state.toApply.filter(row => row.version === '006' && row.optional === true)
    .map(({ version, file, checksum }) => ({ version, file, checksum }));
  const pending = state.toApply.filter(row => !(row.version === '006' && row.optional === true))
    .map(({ version, file, checksum }) => ({ version, file, checksum }));
  return { target: verifiedTarget, targetFingerprint: hash(canonicalStudioJson(verifiedTarget)), schemaPresent: state.objects.present,
    applied: state.applied, toApply: pending, pending, optionalToApply };
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
      verifyObjects(objects, migrations.filter(version => version.version <= migration.version));
      const structureChecksum = fingerprint(objects, migration);
      await client.query(`/* studio-migrations:record */ INSERT INTO croupier_studio.storage_migrations
        (version,checksum,structure_checksum) VALUES ($1,$2,$3)`, [migration.version, migration.checksum, structureChecksum]);
      appliedNow.push(migration.version);
    }
    return { ...result(verifiedTarget, await inspect(client, migrations)), appliedNow };
  });
}
