// Server-internal bridge only. Public adapters receive their existing scoped
// repository/database/table ports, never this transaction or its raw client.
import { AsyncLocalStorage } from 'node:async_hooks';

const transactions = new AsyncLocalStorage();
const transactionOwners = new AsyncLocalStorage();
const owners = new WeakMap();
const object = value => value && (typeof value === 'object' || typeof value === 'function');

function identity(pool) {
  const seen = new Set();
  while (owners.has(pool)) {
    if (seen.has(pool)) throw new Error('PostgreSQL pool alias cycle');
    seen.add(pool); pool = owners.get(pool);
  }
  return pool;
}

export function registerPostgresPoolAlias(alias, pool) {
  if (!object(alias) || !object(pool) || alias === pool || identity(pool) === alias
    || owners.has(alias) && identity(alias) !== identity(pool)) throw new TypeError('Invalid PostgreSQL pool alias');
  owners.set(alias, identity(pool));
}

export function poisonSharedPostgresTransaction(error, state = transactions.getStore()) {
  if (state && !state.closed && !state.failed) state.failed = error;
  return error;
}

export function runPostgresTransactionOwner(state, work) {
  return transactionOwners.run(state, work);
}

export function assertSharedPostgresOwner(state = null) {
  const owner = transactionOwners.getStore();
  if (owner && owner !== state) throw poisonSharedPostgresTransaction(new Error('Shared PostgreSQL transaction must own the outer unit'), owner);
}

export function sharedPostgresTransaction(pool) {
  const state = transactions.getStore();
  if (!state) return null;
  if (state.closed) throw new Error('Shared PostgreSQL transaction is closed');
  if (state.failed) throw state.failed;
  if (identity(pool) !== state.poolIdentity) throw poisonSharedPostgresTransaction(new Error('Shared PostgreSQL pool mismatch'), state);
  return state;
}

export function runSharedPostgresTransaction(state, work) {
  assertSharedPostgresOwner(state);
  const existing = transactions.getStore();
  if (existing) {
    sharedPostgresTransaction(state.pool);
    if (existing !== state) throw poisonSharedPostgresTransaction(new Error('Shared PostgreSQL transaction mismatch'), existing);
    return work();
  }
  if (state.closed || state.readOnly || !state.scopeKey || typeof work !== 'function') throw new Error('Invalid shared PostgreSQL transaction');
  state.poolIdentity = identity(state.pool);
  return transactions.run(state, work);
}

export function sharedPostgresClient(pool) {
  const state = sharedPostgresTransaction(pool);
  if (!state) throw new Error('No shared PostgreSQL transaction');
  return Object.freeze({ async query(sql, values = []) {
    if (sharedPostgresTransaction(pool) !== state) throw poisonSharedPostgresTransaction(new Error('Shared PostgreSQL client escaped'), state);
    try { return await state.client.query(sql, values); }
    catch (error) { throw poisonSharedPostgresTransaction(error, state); }
  } });
}
