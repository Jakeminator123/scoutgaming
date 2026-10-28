import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPglitePool } from './fixtures/pglite-pool.mjs';
import { SCHEMAS, SEQUENCES_SQL, TABLES_SQL, canonical, compare, sha256, snapshot, tableHashSql } from '../tools/o02-snapshot.mjs';

// tools/o02-snapshot.mjs is the S0/S1 parity instrument of O02-PLAN.md §3.3 (R2, R6, R9).
// These tests pin its canonicalisation and comparison on a real PostgreSQL parser (PGlite);
// the SQL itself was also run statement by statement, read-only, against staging.

test('catalog SQL casts name-typed columns to text, sorts with COLLATE "C" and uses no UNION', () => {
  for (const sql of [TABLES_SQL, SEQUENCES_SQL]) {
    assert.doesNotMatch(sql, /\bUNION\b/i, 'UNION would inherit the 63-byte name type');
    assert.match(sql, /COLLATE "C"/);
  }
  assert.match(TABLES_SQL, /n\.nspname::text/); assert.match(TABLES_SQL, /c\.relname::text/);
  assert.match(SEQUENCES_SQL, /schemaname::text/); assert.match(SEQUENCES_SQL, /sequencename::text/);
  assert.deepEqual([...SCHEMAS], ['croupier_game', 'croupier_studio', 'croupier_auth']);
});

test('table hash orders by every primary-key column as text with COLLATE "C", or by the row text without a key', () => {
  assert.match(tableHashSql('croupier_game', 'shared_table_configs', 'room_id,version'),
    /ORDER BY \(t\."room_id"\)::text COLLATE "C", \(t\."version"\)::text COLLATE "C"\), ''\), 'UTF8'\)\), 'hex'\) AS sha256 FROM "croupier_game"\."shared_table_configs" t$/);
  assert.match(tableHashSql('croupier_studio', 'storage_migrations', ''), /ORDER BY to_jsonb\(t\)::text COLLATE "C"\)/);
  for (const bad of ['players; DROP', 'Players', 'a"b']) assert.throws(() => tableHashSql('croupier_game', bad, 'id'), /unsafe identifier/);
  assert.throws(() => tableHashSql('croupier_game', 'players', 'id,na me'), /unsafe identifier/);
});

test('canonical JSON sorts keys at every level so equal content hashes alike', () => {
  assert.equal(canonical({ b: 1, a: { d: [{ z: 1, y: 2 }], c: null } }), '{"a":{"c":null,"d":[{"y":2,"z":1}]},"b":1}');
  assert.equal(sha256(canonical({ b: 1, a: 2 })), sha256(canonical({ a: 2, b: 1 })));
});

test('compare reports missing tables, row-count and content differences and changed sequences', () => {
  const base = { totalSha256: 'x', tables: { 't.a': { rows: 2, sha256: 'aa' }, 't.b': { rows: 1, sha256: 'bb' } }, sequences: { 's.q': '5' } };
  assert.deepEqual(compare(base, structuredClone(base)), { equal: true, totalSha256: { a: 'x', b: 'x' }, differences: [] });
  const other = { totalSha256: 'y', tables: { 't.a': { rows: 3, sha256: 'ab' }, 't.b': { rows: 1, sha256: 'bc' }, 't.c': { rows: 0, sha256: 'cc' } }, sequences: { 's.q': '6' } };
  assert.deepEqual(compare(base, other), { equal: false, totalSha256: { a: 'x', b: 'y' }, differences: [
    { table: 't.a', kind: 'rows', a: 2, b: 3 }, { table: 't.b', kind: 'content', rows: 1 }, { table: 't.c', kind: 'missing', missingIn: 'a' },
    { sequence: 's.q', kind: 'last_value', a: '5', b: '6' }] });
  // Same per-table facts but a different total hash is still unequal: the total covers pk names too.
  assert.equal(compare(base, { ...structuredClone(base), totalSha256: 'z' }).equal, false);
});

test('PGlite: a snapshot is deterministic, hashes rows in PK order and detects inserts, edits and sequence moves', async t => {
  const pool = await createPglitePool(); t.after(() => pool.end());
  const query = (sql, values) => pool.query(sql, values);
  const s0 = await snapshot(query, { schemas: ['croupier_game'], label: 'S0', at: '2026-10-28T00:00:00.000Z' });
  assert.equal(s0.kind, 'o02-db-snapshot/v1'); assert.equal(s0.label, 'S0');
  assert.ok(Object.keys(s0.tables).length >= 15, 'product schema plus forward migrations');
  assert.deepEqual(s0.tables['croupier_game.players'], { pk: 'id', rows: 0, sha256: sha256('') }, 'empty table hashes the empty string');
  assert.equal(s0.tables['croupier_game.shared_table_configs'].pk, 'room_id,version');
  assert.equal(s0.tables['croupier_game.storage_migrations'].rows, 1, 'product-v1 ledger row');
  assert.ok(Object.hasOwn(s0.sequences, 'croupier_game.transactions_id_seq'));
  const again = await snapshot(query, { schemas: ['croupier_game'], label: 'S0b', at: s0.at });
  assert.equal(again.totalSha256, s0.totalSha256, 'label is outside the total hash');
  assert.equal(compare(s0, again).equal, true);
  // Two players inserted in reverse key order: the hash must follow COLLATE "C" key order, not insert order.
  await query("INSERT INTO croupier_game.players (id,name,created_at) VALUES ('p-b','B','2026-10-28T00:00:01.000Z'), ('p-a','A','2026-10-28T00:00:00.000Z')");
  await query("INSERT INTO croupier_game.transactions (player_id,type,amount,currency,meta,at) VALUES ('p-a','open',1000,'USD','synthetic','2026-10-28T00:00:00.000Z')");
  const s1 = await snapshot(query, { schemas: ['croupier_game'], label: 'S1', at: s0.at });
  const expected = (await query('SELECT to_jsonb(t)::text AS j FROM croupier_game.players t ORDER BY (t."id")::text COLLATE "C"')).rows.map(r => r.j);
  assert.equal(expected.length, 2); assert.match(expected[0], /"id": ?"p-a"/);
  assert.equal(s1.tables['croupier_game.players'].sha256, createHash('sha256').update(expected.join('\n')).digest('hex'));
  assert.equal(s1.tables['croupier_game.players'].rows, 2);
  assert.notEqual(s1.totalSha256, s0.totalSha256);
  const d = compare(s0, s1);
  assert.equal(d.equal, false);
  assert.deepEqual(d.differences.filter(x => x.table === 'croupier_game.players'), [{ table: 'croupier_game.players', kind: 'rows', a: 0, b: 2 }]);
  assert.deepEqual(d.differences.filter(x => x.sequence), [{ sequence: 'croupier_game.transactions_id_seq', kind: 'last_value', a: null, b: '1' }]);
  // An edit that keeps the row count is a content difference.
  await query("UPDATE croupier_game.players SET balance = 999 WHERE id = 'p-a'");
  const s2 = await snapshot(query, { schemas: ['croupier_game'], at: s0.at });
  assert.deepEqual(compare(s1, s2).differences.filter(x => x.table === 'croupier_game.players'), [{ table: 'croupier_game.players', kind: 'content', rows: 2 }]);
  // Schemas that do not exist yield no tables instead of failing (restore targets may lack a schema).
  const none = await snapshot(query, { schemas: ['croupier_missing'], at: s0.at });
  assert.deepEqual(none.tables, {}); assert.deepEqual(none.sequences, {});
});
