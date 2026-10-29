#!/usr/bin/env node
// Database snapshot — READ-ONLY. Step 8 of the restore runbook in docs/ENVIRONMENT-RESTORATION.md
// (built for O02's restore-replay; its format id o02-db-snapshot/v1 is unchanged).
//
// Takes a content snapshot of croupier_game, croupier_studio and croupier_auth so that the
// source (S0) and a restore target (S1), or the source before and after a proof (S0 / S0′),
// can be compared byte for byte without copying any row out of the database:
//   per table    row count + sha256 over `to_jsonb(t)::text`, one row per line, ordered by
//                the primary key columns cast to text with COLLATE "C" (no PK: by the row text)
//   per sequence last_value from pg_sequences
//   total        sha256 over the canonical JSON of all table and sequence entries
// Everything runs inside one `BEGIN READ ONLY` transaction and ends with ROLLBACK. Catalog
// columns of type `name` are cast to text before sorting, and no UNION is used, so the 63-byte
// truncation documented in docs/ENVIRONMENT-RESTORATION.md cannot recur. The connection
// string is read from a file and never printed; the output holds no row data, only hashes.
//
// Usage, from the repository root:
//   node tools/db-snapshot.mjs --url-file <file with the connection string> --out s0.json [--label S0]
//   node tools/db-snapshot.mjs --compare s0.json s1.json
// Exit codes: 0 equal/ok, 1 differences found (--compare), 2 usage or connection failure.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SCHEMAS = Object.freeze(['croupier_game', 'croupier_studio', 'croupier_auth']);
const IDENT = /^[a-z_][a-z0-9_]*$/;

export const sha256 = text => createHash('sha256').update(text).digest('hex');
// Sorted object keys at every level, so two snapshots with the same content hash alike.
export const canonical = value => JSON.stringify(value, (_, x) => x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x);
const quote = ident => { if (!IDENT.test(ident)) throw new Error(`unsafe identifier ${ident}`); return `"${ident}"`; };

// ---------- SQL (each statement verified read-only against staging via Neon MCP) ----------
export const TABLES_SQL = `SELECT n.nspname::text AS schema, c.relname::text AS table,
  coalesce((SELECT string_agg(a.attname::text, ',' ORDER BY k.ord)
    FROM pg_index i JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
    WHERE i.indrelid = c.oid AND i.indisprimary), '') AS pk
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = ANY($1::text[]) AND c.relkind IN ('r','p')
  ORDER BY n.nspname::text COLLATE "C", c.relname::text COLLATE "C"`;
export const SEQUENCES_SQL = `SELECT schemaname::text AS schema, sequencename::text AS sequence, last_value::text AS last_value
  FROM pg_sequences WHERE schemaname = ANY($1::text[])
  ORDER BY schemaname::text COLLATE "C", sequencename::text COLLATE "C"`;
export function tableHashSql(schema, table, pk) {
  const keys = pk ? pk.split(',') : [];
  const order = keys.length ? keys.map(k => `(t.${quote(k)})::text COLLATE "C"`).join(', ') : 'to_jsonb(t)::text COLLATE "C"';
  return `SELECT count(*)::text AS rows, encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY ${order}), ''), 'UTF8')), 'hex') AS sha256 FROM ${quote(schema)}.${quote(table)} t`;
}

// ---------- snapshot over any pg-shaped query(sql, values) -> {rows} ----------
export async function snapshot(query, { schemas = SCHEMAS, label = null, at = new Date().toISOString() } = {}) {
  const tables = {};
  for (const row of (await query(TABLES_SQL, [schemas])).rows) {
    const { rows, sha256: sha } = (await query(tableHashSql(row.schema, row.table, row.pk))).rows[0];
    tables[`${row.schema}.${row.table}`] = { pk: row.pk || null, rows: Number(rows), sha256: sha };
  }
  const sequences = {};
  for (const row of (await query(SEQUENCES_SQL, [schemas])).rows) sequences[`${row.schema}.${row.sequence}`] = row.last_value ?? null;
  const body = { schemas: [...schemas], tables, sequences };
  return { kind: 'o02-db-snapshot/v1', label, at, ...body, totalSha256: sha256(canonical(body)) };
}

// ---------- compare two snapshots ----------
export function compare(a, b) {
  const differences = [];
  const keys = [...new Set([...Object.keys(a.tables ?? {}), ...Object.keys(b.tables ?? {})])].sort();
  for (const key of keys) {
    const x = a.tables?.[key], y = b.tables?.[key];
    if (!x || !y) differences.push({ table: key, kind: 'missing', missingIn: x ? 'b' : 'a' });
    else if (x.rows !== y.rows) differences.push({ table: key, kind: 'rows', a: x.rows, b: y.rows });
    else if (x.sha256 !== y.sha256) differences.push({ table: key, kind: 'content', rows: x.rows });
  }
  const seqs = [...new Set([...Object.keys(a.sequences ?? {}), ...Object.keys(b.sequences ?? {})])].sort();
  for (const key of seqs) {
    if (a.sequences?.[key] !== b.sequences?.[key]) differences.push({ sequence: key, kind: 'last_value', a: a.sequences?.[key] ?? null, b: b.sequences?.[key] ?? null });
  }
  return { equal: differences.length === 0 && a.totalSha256 === b.totalSha256, totalSha256: { a: a.totalSha256 ?? null, b: b.totalSha256 ?? null }, differences };
}

// ---------- CLI ----------
async function main(argv) {
  const arg = name => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
  const compareAt = argv.indexOf('--compare');
  if (compareAt >= 0) {
    const [fa, fb] = argv.slice(compareAt + 1, compareAt + 3);
    if (!fa || !fb) { console.error('usage: --compare a.json b.json'); return 2; }
    const result = compare(JSON.parse(readFileSync(resolve(fa), 'utf8')), JSON.parse(readFileSync(resolve(fb), 'utf8')));
    console.log(JSON.stringify(result, null, 2));
    return result.equal ? 0 : 1;
  }
  const urlFile = arg('url-file'), out = arg('out');
  if (!urlFile || !out) { console.error('usage: --url-file <file> --out <json> [--label <text>] | --compare a.json b.json'); return 2; }
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { Client } = createRequire(join(repo, 'services/game/package.json'))('pg');
  const client = new Client({ connectionString: readFileSync(resolve(urlFile), 'utf8').trim(), ssl: { rejectUnauthorized: true } });
  try { await client.connect(); } catch (error) { console.error('connection failed:', error.code ?? error.name); return 2; }
  try {
    await client.query('BEGIN READ ONLY');
    const who = (await client.query('SELECT current_database() AS db, current_user AS role')).rows[0];
    const result = await snapshot((sql, values) => client.query(sql, values), { label: arg('label') });
    result.database = who.db; result.role = who.role;
    writeFileSync(resolve(out), JSON.stringify(result, null, 2) + '\n');
    console.log(`${result.label ?? 'snapshot'} ${who.db} as ${who.role}: ${Object.keys(result.tables).length} tables, ${Object.keys(result.sequences).length} sequences, total ${result.totalSha256} -> ${out}`);
    return 0;
  } finally { await client.query('ROLLBACK').catch(() => {}); await client.end(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}
