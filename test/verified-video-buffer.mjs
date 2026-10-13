import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createVerifiedVideoBuffer } from '../web/public/verified-video-buffer.mjs';
const media = text => ({ src: `/${text}`, sha256: createHash('sha256').update(text).digest('hex') });
const turn = () => new Promise(resolve => setImmediate(resolve));
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
  await turn(); first.abort(); await assert.rejects(a, { name: 'AbortError' }); assert.equal(signal.aborted, false);
  finish(); const lease = await b; lease.release(); cache.close();
  const second = new AbortController(), f = fixture({ fetchImpl: (_, options) => { signal = options.signal; return new Promise(resolve => { finish = () => resolve(new Response('bbb')); }); } });
  const cancelled = f.cache.acquire(media('bbb'), second.signal); await turn(); second.abort();
  await assert.rejects(cancelled, { name: 'AbortError' }); assert.equal(signal.aborted, true);
  const retry = f.cache.acquire(media('bbb')); await turn(); finish(); (await retry).release(); f.cache.close();
});
test('closing an outstanding fetch prevents a late URL from leaking', async () => {
  let finish, minted = 0;
  const { cache } = fixture({ fetchImpl: () => new Promise(resolve => { finish = () => resolve(new Response('aaa')); }), createUrl: () => { minted++; return 'blob:late'; } });
  const pending = cache.acquire(media('aaa')); await turn(); cache.close(); finish();
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(minted, 0);
});

function queuedFixture(options = {}) {
  const pending = new Map(), calls = [], signals = [];
  const f = fixture({ budget: 1024, fetchImpl: (src, { signal }) => {
    calls.push(src); signals.push(signal);
    return new Promise((resolve, reject) => pending.set(src, {
      finish: (body = src.slice(1)) => resolve(new Response(body)), reject,
    }));
  }, ...options });
  return { ...f, pending, calls, signals };
}

test('four transfers at most; playback precedes speculative fetches, FIFO within priority', async () => {
  const f = queuedFixture();
  const speculative = f.cache.acquire(media('idle'), undefined, { priority: 1 });
  const games = ['a','b','c','d','e'].map(id => f.cache.acquire(media(id)));
  await turn(); assert.deepEqual(f.calls, ['/a','/b','/c','/d']);
  f.pending.get('/a').finish(); (await games[0]).release(); await turn();
  assert.deepEqual(f.calls, ['/a','/b','/c','/d','/e']);
  f.pending.get('/b').finish(); (await games[1]).release(); await turn();
  assert.deepEqual(f.calls, ['/a','/b','/c','/d','/e','/idle']);
  for (const id of ['c','d','e','idle']) f.pending.get('/'+id).finish();
  for (const lease of await Promise.all([...games.slice(2), speculative])) lease.release();
  f.cache.close();
});

test('a shared queued load is promoted by playback without fetching twice', async () => {
  const f = queuedFixture({ parallel: 1 });
  const blocker = f.cache.acquire(media('block')); await turn();
  const background = f.cache.acquire(media('background'), undefined, { priority: 1 });
  const warm = f.cache.acquire(media('game'), undefined, { priority: 1 });
  const play = f.cache.acquire(media('game'));
  f.pending.get('/block').finish(); (await blocker).release(); await turn();
  assert.deepEqual(f.calls, ['/block','/game']);
  f.pending.get('/game').finish();
  const [a,b] = await Promise.all([warm,play]); assert.equal(a.src,b.src); a.release(); b.release();
  await turn(); f.pending.get('/background').finish(); (await background).release(); f.cache.close();
});

test('prepared video can promote its existing lease ahead of other speculative entries', async () => {
  const f = queuedFixture({ parallel: 1 });
  const blocker = f.cache.acquire(media('block')); await turn();
  const background = f.cache.acquire(media('background'), undefined, { priority: 1 });
  const warm = f.cache.acquire(media('game'), undefined, { priority: 1 });
  f.cache.prioritize(media('game'));
  f.pending.get('/block').finish(); (await blocker).release(); await turn();
  assert.deepEqual(f.calls, ['/block','/game']);
  f.pending.get('/game').finish(); (await warm).release(); await turn();
  f.pending.get('/background').finish(); (await background).release(); f.cache.close();
});

test('cancelling queued owners removes unneeded requests but preserves a shared waiter', async () => {
  const f = queuedFixture({ parallel: 1 });
  const blocker = f.cache.acquire(media('block')); await turn();
  const one = new AbortController(), last = new AbortController();
  const shared = f.cache.acquire(media('shared'), one.signal), survivor = f.cache.acquire(media('shared'));
  const removed = f.cache.acquire(media('removed'), last.signal);
  one.abort(); last.abort();
  await assert.rejects(shared, { name: 'AbortError' }); await assert.rejects(removed, { name: 'AbortError' });
  f.pending.get('/block').finish(); (await blocker).release(); await turn();
  assert.deepEqual(f.calls, ['/block','/shared']);
  f.pending.get('/shared').finish(); (await survivor).release(); await turn();
  assert.deepEqual(f.calls, ['/block','/shared']); f.cache.close();
});

test('close rejects active and queued owners promptly, with no late blob or fetch', async () => {
  const f = queuedFixture({ parallel: 1 });
  const active = f.cache.acquire(media('active')); await turn();
  const queued = f.cache.acquire(media('queued')); f.cache.close();
  await assert.rejects(active, { name: 'AbortError' }); await assert.rejects(queued, { name: 'AbortError' });
  assert.equal(f.signals[0].aborted, true);
  f.pending.get('/active').finish(); await turn(); await turn();
  assert.deepEqual(f.calls, ['/active']); assert.deepEqual(f.cache.snapshot(), { bytes: 0, entries: 0 });
  await assert.rejects(f.cache.acquire(media('closed')), { name: 'AbortError' });
});

test('failed verification frees a transfer slot and permits an exact retry', async () => {
  const f = queuedFixture({ parallel: 1 });
  const bad = f.cache.acquire(media('bad')), next = f.cache.acquire(media('next')); await turn();
  f.pending.get('/bad').finish('corrupt'); await assert.rejects(bad, /changed since review/); await turn();
  assert.deepEqual(f.calls, ['/bad','/next']);
  const retry = f.cache.acquire(media('bad'));
  f.pending.get('/next').finish(); (await next).release(); await turn();
  f.pending.get('/bad').finish(); (await retry).release();
  assert.deepEqual(f.calls, ['/bad','/next','/bad']); f.cache.close();
});

test('invalid queue options cannot silently strand playback', async () => {
  for (const parallel of [0,-1,1.5,Infinity,NaN]) assert.throws(() => fixture({ parallel }), /transfer limit/);
  const { cache } = fixture();
  await assert.rejects(cache.acquire(media('aaa'), undefined, { priority: NaN }), /priority/);
  cache.close();
});
