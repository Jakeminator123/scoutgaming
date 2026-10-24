import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createVerifiedVideoBuffer } from '../services/game/public/verified-video-buffer.mjs';
const media = text => ({ src: `/${text}`, sha256: createHash('sha256').update(text).digest('hex') });
function fixture(options = {}) {
  const revoked = [], fetched = [];
  const cache = createVerifiedVideoBuffer({ budget: 6, fetchImpl: async src => { fetched.push(src); return new Response(src.slice(1)); },
    createUrl: blob => `blob:${blob.size}:${Math.random()}`, revokeUrl: url => revoked.push(url), ...options });
  return { cache, revoked, fetched };
}
test('verified cache shares concurrent loads and pins active URLs during bounded eviction', async () => {
  const { cache, revoked, fetched } = fixture();
  const [a, again] = await Promise.all([cache.acquire(media('aaa')), cache.acquire(media('aaa'))]);
  assert.equal(fetched.length, 1); assert.equal(a.src, again.src);
  const b = await cache.acquire(media('bbb')); b.release();
  const c = await cache.acquire(media('ccc'));
  assert.deepEqual(revoked, [b.src]); assert.equal(cache.snapshot().bytes, 6);
  a.release(); again.release(); c.release();
  const cached = await cache.acquire(media('aaa')); assert.equal(cached.cached, true); cached.release();
  cache.close(); assert.equal(new Set(revoked).size, 3);
});
test('corrupt and oversized films never become object URLs', async () => {
  const { cache, revoked } = fixture();
  await assert.rejects(cache.acquire({ ...media('aaa'), src: '/bad' }), /changed since review/);
  await assert.rejects(cache.acquire(media('toolarge')), /budget/);
  assert.deepEqual(cache.snapshot(), { bytes: 0, entries: 0 }); assert.equal(revoked.length, 0);
});
test('one cancelled waiter cannot poison another and last-owner cancellation permits immediate retry', async () => {
  let finish, signal;
  const { cache } = fixture({ fetchImpl: (_, options) => { signal = options.signal; return new Promise(resolve => { finish = () => resolve(new Response('aaa')); }); } });
  const first = new AbortController(), a = cache.acquire(media('aaa'), first.signal), b = cache.acquire(media('aaa'));
  first.abort(); await assert.rejects(a, { name: 'AbortError' }); assert.equal(signal.aborted, false);
  finish(); const lease = await b; lease.release(); cache.close();
  const second = new AbortController(), f = fixture({ fetchImpl: (_, options) => { signal = options.signal; return new Promise(resolve => { finish = () => resolve(new Response('bbb')); }); } });
  const cancelled = f.cache.acquire(media('bbb'), second.signal); second.abort();
  await assert.rejects(cancelled, { name: 'AbortError' }); assert.equal(signal.aborted, true);
  const retry = f.cache.acquire(media('bbb')); finish(); (await retry).release(); f.cache.close();
});
test('closing an outstanding fetch prevents a late URL from leaking', async () => {
  let finish, minted = 0;
  const { cache } = fixture({ fetchImpl: () => new Promise(resolve => { finish = () => resolve(new Response('aaa')); }), createUrl: () => { minted++; return 'blob:late'; } });
  const pending = cache.acquire(media('aaa')); cache.close(); finish();
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(minted, 0);
});

test('mobile recovery verifies a film without AbortSignal.any', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'any');
  Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true });
  t.after(() => Object.defineProperty(AbortSignal, 'any', descriptor));
  const { cache } = fixture();
  t.after(() => cache.close());
  const lease = await cache.acquire(media('aaa'));
  assert.equal(lease.cached, false); lease.release();
});

test('mobile recovery keeps the fetch timeout and retries the exact hash after it', async t => {
  const timeout = new AbortController();
  t.mock.method(AbortSignal, 'timeout', ms => { assert.equal(ms, 15000); return timeout.signal; });
  let attempts = 0;
  const { cache, fetched } = fixture({ fetchImpl: (src, {signal}) => {
    fetched.push(src);
    if (++attempts > 1) return Promise.resolve(new Response('aaa'));
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once:true}));
  } });
  t.after(() => cache.close());
  const first = cache.acquire(media('aaa'));
  timeout.abort(new DOMException('Timed out', 'TimeoutError'));
  await assert.rejects(first, {name:'TimeoutError'});
  assert.deepEqual(cache.snapshot(), {bytes:0,entries:0});
  t.mock.method(AbortSignal, 'timeout', () => new AbortController().signal);
  const retried = await cache.acquire(media('aaa'));
  assert.deepEqual(fetched, ['/aaa','/aaa']); retried.release();
});
