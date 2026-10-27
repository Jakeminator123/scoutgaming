import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';

// Postgres-shaped async repository over plain in-memory rows, for tests that
// need no real database. Only the exact SQL texts in `statements` are answered;
// any other statement throws, so a changed query cannot pass silently.
//
// - `tables`: object of named tables (arrays, Maps, ...). Its property values are
//   snapshotted when a transaction starts and restored in place if it fails, so
//   handlers may close over this same object.
// - `statements`: { [exact SQL]: (...args) => rows[] | {changes} }. `get` returns a
//   clone of the first row, `all` a clone of the rows, `run` the handler result.
// - `transactional`: `true` or a list of exact SQL texts that must execute inside
//   the caller's own transaction (bound per async context, not a shared flag).
// - `nested`: 'reject' (default) fails a transaction opened inside another;
//   'join' runs nested work in the outer transaction like the production store.
export const duplicateKey = () => { throw Object.assign(new Error('duplicate key value'), {code: '23505'}); };

export function createStatementDb({tables = {}, statements, transactional = [], nested = 'reject'}) {
  const context = new AsyncLocalStorage();
  let tail = Promise.resolve();
  const mustBeTransactional = sql => transactional === true || transactional.includes(sql);
  return {
    tables,
    inTransaction: () => context.getStore() === true,
    prepare(sql) {
      const answer = Object.hasOwn(statements, sql) ? statements[sql] : null;
      if (!answer) throw new Error('unexpected SQL: ' + sql);
      const execute = args => {
        if (mustBeTransactional(sql)) assert.equal(context.getStore(), true, 'statement runs inside a transaction: ' + sql);
        return answer(...args);
      };
      return {
        get: async (...args) => structuredClone(execute(args)[0]),
        all: async (...args) => structuredClone(execute(args)),
        run: async (...args) => execute(args),
      };
    },
    async transaction(work) {
      if (context.getStore()) {
        assert.equal(nested, 'join', 'transactions are not nested');
        return work();
      }
      // Top-level transactions are serialized, so each snapshot is consistent.
      const previous = tail;
      let release;
      tail = new Promise(resolve => { release = resolve; });
      await previous;
      const snapshot = structuredClone(tables);
      try { return await context.run(true, work); }
      catch (error) { for (const key of Object.keys(snapshot)) tables[key] = snapshot[key]; throw error; }
      finally { release(); }
    },
  };
}
