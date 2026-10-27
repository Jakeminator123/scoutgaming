import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createPostgresStore } from '../../services/game/storage/postgres-store.mjs';

// Local PostgreSQL for module tests: PGlite (PostgreSQL compiled to WASM, in process),
// a devDependency of services/game only. `npm ci --omit=dev` keeps it out of the Render
// image; production is Neon PostgreSQL through `pg`. The async stores send PostgreSQL
// SQL, so a SQLite stand-in proved nothing about those statements; this runs them on a
// real PostgreSQL parser/planner/executor with the engine's own DDL from ops/neon-game,
// installed and marked ready the way tools/studio-isolated-qa.mjs does on a real cluster.
//
// The pool mimics `pg.Pool` for postgres-store.mjs: query(sql, values), connect() ->
// client {query, release}, end(). Parameters and rows use pg's own prepareValue/type
// parsers, so int8/numeric arrive as strings and normalizeRow is exercised as in prod.
//
// Limits (keep these tests honest):
// - One backend session. connect() hands out one client at a time (FIFO) and pool.query()
//   waits for it, so concurrent transactions are serialized, never interleaved. Code that
//   holds a client and then waits for another would deadlock; that wait fails after
//   `waitMs` with pglite_pool_wait_timeout instead of hanging.
// - It cannot prove network/TLS/connection limits, PgBouncer behavior, or cross-session
//   semantics: FOR UPDATE blocking, advisory-lock contention, serialization failures and
//   lock/statement timeouts between clients. Those stay in CI on Linux PostgreSQL
//   (tools/run-shared-table-qa.mjs, tools/studio-isolated-qa.mjs).
const gameRequire = createRequire(new URL('../../services/game/package.json', import.meta.url));
const pg = gameRequire('pg');
const { prepareValue } = gameRequire('pg/lib/utils');
const schemaFile = file => new URL(`../../ops/neon-game/${file}`, import.meta.url);
// Forward game migrations after product-schema.sql. 011 is an optional reviewed retirement.
export const GAME_MIGRATIONS = Object.freeze(['006-player-profile.sql', '007-roulette-tables.sql',
  '008-shared-wallet.sql', '009-shared-blackjack.sql', '010-presentation-receiver.sql']);
// PGlite spreads `parsers` over its own, so list every builtin oid that pg parses.
const parsers = Object.fromEntries(Object.values(pg.types.builtins).map(oid => [oid, pg.types.getTypeParser(oid, 'text')]));
const serializers = new Proxy({}, { get: () => value => value }); // already pg-prepared text
const options = { parsers, serializers };
const templates = new Map();

const loadPGlite = async () => (await import(pathToFileURL(gameRequire.resolve('@electric-sql/pglite')).href)).PGlite;

// Install the schema once per process and keep only its data directory: an open PGlite
// that has written keeps a 10s PostgreSQL timer alive and would delay the test exit.
async function template(migrations) {
  const key = JSON.stringify(migrations);
  if (!templates.has(key)) templates.set(key, (async () => {
    const db = await (await loadPGlite()).create();
    try {
      const product = (await readFile(schemaFile('product-schema.sql'), 'utf8')).replace(/\r\n/g, '\n');
      await db.exec(product);
      await db.query('INSERT INTO croupier_game.storage_migrations(version,checksum,source_hashes,applied_at) VALUES ($1,$2,$3,$4)',
        ['product-v1', createHash('sha256').update(product).digest('hex'), '{}', new Date(0).toISOString()]);
      for (const file of migrations) await db.exec(await readFile(schemaFile(file), 'utf8'));
      return await db.dumpDataDir('none');
    } finally { await db.close(); }
  })());
  return templates.get(key);
}

const shape = result => ({ command: result.command ?? null, rowCount: result.rowCount ?? null, rows: result.rows, fields: result.fields });

// Each pool is an independent database loaded from the per-process schema template.
// Call end(): an open PGlite that has written keeps the process alive for ~10s.
export async function createPglitePool({ migrations = GAME_MIGRATIONS, waitMs = 5000 } = {}) {
  const db = await (await loadPGlite()).create({ loadDataDir: await template(migrations) });
  let tail = Promise.resolve(), closed = false;
  async function run(sql, values) {
    if (closed) throw new Error('pglite_pool_closed');
    // pg uses the simple protocol (multi-statement, array result) only without values.
    if (!values?.length) {
      const results = (await db.exec(sql, options)).map(shape);
      return results.length === 1 ? results[0] : results;
    }
    return shape(await db.query(sql, values.map(value => prepareValue(value)), options));
  }
  function acquire() {
    let release, abandoned = false;
    const held = new Promise(resolve => { release = resolve; });
    const previous = tail; tail = previous.then(() => held);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { abandoned = true; reject(new Error('pglite_pool_wait_timeout: one session is held; a nested client or pool.query would deadlock')); }, waitMs);
      previous.then(() => { clearTimeout(timer); if (abandoned) release(); else resolve(release); });
    });
  }
  const pool = {
    pglite: db,
    async query(sql, values) {
      const release = await acquire();
      try { return await run(sql, values); }
      finally { try { if (!closed && db.isInTransaction()) await db.exec('ROLLBACK'); } finally { release(); } }
    },
    async connect() {
      const release = await acquire();
      let released = false;
      return {
        query: (sql, values) => released ? Promise.reject(new Error('pglite_client_released')) : run(sql, values),
        async release() {
          if (released) return; released = true;
          // A real pool would hand the open transaction to the next caller; isolate tests instead.
          try { if (!closed && db.isInTransaction()) await db.exec('ROLLBACK'); } finally { release(); }
        },
      };
    },
    async end() {
      if (closed) return; closed = true;
      await Promise.race([tail, new Promise(resolve => setTimeout(resolve, waitMs).unref())]);
      await db.close();
    },
  };
  return pool;
}

// The engine's own store (postgres-store.mjs) over a fresh PGlite database.
export async function createPgliteStore(options) {
  const pool = await createPglitePool(options);
  return createPostgresStore({ pool });
}
