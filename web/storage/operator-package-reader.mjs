// Read-only operator context for the game entry. Lookups go through the
// operator store, so scope, row ownership and stored JSON are validated exactly
// as for the writers. A failed or slow read returns null: the caller keeps
// today's entry and the player never sees a storage error. Only successful
// reads are cached, at most 30 s per slug.
import { createOperatorStore } from './operator-store.mjs';
import { StudioStorageError } from './studio-contract.mjs';
import { isOperatorSlug } from '../../packages/navigation/operator-slug.mjs';

export const OPERATOR_PACKAGE_CACHE_MAX_MS = 30_000;
const MAX_ENTRIES = 256;

export function createOperatorPackageReader({
  sql, scope, ttlMs = OPERATOR_PACKAGE_CACHE_MAX_MS, timeoutMs = 3000, now = Date.now,
  log = console.warn, storeFactory = createOperatorStore,
} = {}) {
  if (!Number.isFinite(ttlMs) || ttlMs < 0 || ttlMs > OPERATOR_PACKAGE_CACHE_MAX_MS) throw new TypeError('Operator package cache is at most 30 s');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError('Invalid operator package timeout');
  if (typeof now !== 'function' || typeof log !== 'function' || typeof storeFactory !== 'function') throw new TypeError('Invalid operator package reader');
  const cache = new Map();
  let store, failing = false;
  function openStore() {
    store ??= Promise.resolve().then(() => storeFactory({ sql, scope })).catch(error => { store = undefined; throw error; });
    return store;
  }
  function bounded(work) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new StudioStorageError('studio_operator_package_timeout')), timeoutMs);
      timer.unref?.();
    });
    return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
  }
  async function lookup(slug) {
    const operators = await openStore();
    const operator = await operators.getOperatorBySlug(slug);
    // A suspended operator is not offered as game context.
    if (!operator || operator.slug !== slug || operator.status !== 'active') return Object.freeze({ operator: null, package: null });
    const current = await operators.getCurrentPackage(operator.id);
    if (current && current.operatorId !== operator.id) throw new StudioStorageError('studio_corrupt_operator');
    return Object.freeze({ operator: Object.freeze({ id: operator.id, slug: operator.slug }), package: current ?? null });
  }
  function remember(slug, entry, at) {
    if (cache.size >= MAX_ENTRIES) {
      for (const [key, value] of cache) if (at - value.at >= ttlMs) cache.delete(key);
      if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
    }
    cache.set(slug, entry);
  }
  // { operator, package } for an active operator (package null when none is
  // published), { operator: null } for an unknown slug, null when unreadable.
  async function resolve(slug) {
    if (!isOperatorSlug(slug)) return Object.freeze({ operator: null, package: null });
    const at = now();
    const hit = cache.get(slug);
    if (hit && at - hit.at >= 0 && at - hit.at < ttlMs) return hit.promise;
    cache.delete(slug);
    const entry = { at };
    entry.promise = bounded(lookup(slug)).then(value => {
      failing = false;
      return value;
    }, error => {
      if (cache.get(slug) === entry) cache.delete(slug);
      if (!failing) {
        failing = true;
        log('[operator-package] read failed; game entry keeps the saved lane catalogue',
          error instanceof StudioStorageError ? error.code : 'operator_package_unavailable');
      }
      return null;
    });
    if (ttlMs > 0) remember(slug, entry, at);
    return entry.promise;
  }
  return Object.freeze({ resolve });
}
