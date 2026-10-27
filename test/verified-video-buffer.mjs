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
test('one cancelled waiter cannot poison another; the last owner leaving cancels the fetch after a short grace', async t => {
  let finish, signal;
  const { cache } = fixture({ fetchImpl: (_, options) => { signal = options.signal; return new Promise(resolve => { finish = () => resolve(new Response('aaa')); }); } });
  const first = new AbortController(), a = cache.acquire(media('aaa'), first.signal), b = cache.acquire(media('aaa'));
  first.abort(); await assert.rejects(a, { name: 'AbortError' }); assert.equal(signal.aborted, false);
  finish(); const lease = await b; lease.release(); cache.close();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let fetches = 0;
  const second = new AbortController(), f = fixture({ fetchImpl: (src, options) => { fetches++; signal = options.signal; return new Promise(resolve => { finish = () => resolve(new Response(src.slice(1))); }); } });
  const cancelled = f.cache.acquire(media('bbb'), second.signal); second.abort();
  await assert.rejects(cancelled, { name: 'AbortError' }); assert.equal(signal.aborted, false, 'a restarted owner may still join these bytes');
  t.mock.timers.tick(4999); const rejoined = f.cache.acquire(media('bbb')); t.mock.timers.tick(5000);
  assert.equal(signal.aborted, false); finish(); (await rejoined).release(); assert.equal(fetches, 1, 'the restarted owner reused the same download');
  const third = new AbortController(), gone = f.cache.acquire(media('ccc'), third.signal); third.abort();
  await assert.rejects(gone, { name: 'AbortError' }); t.mock.timers.tick(4999); assert.equal(signal.aborted, false);
  t.mock.timers.tick(1); assert.equal(signal.aborted, true, 'an abandoned download is cancelled after the grace');
  assert.equal(f.cache.snapshot().entries, 1, 'only the verified bbb remains');
  const retry = f.cache.acquire(media('ccc')); finish(); (await retry).release(); assert.equal(fetches, 3); f.cache.close();
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

// K04 at 400 kbit/s: the 912 KB idle clip needed ~18 s, so a whole-file limit could never
// finish it. Silence, not length, bounds a download; arriving bytes are reported.
const turn = () => new Promise(resolve => setImmediate(resolve));
function streamed(text, { length = true } = {}) {
  let push, end; const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream({ start(controller) { push = chunk => controller.enqueue(chunk); end = () => controller.close(); } });
  return { bytes, push: (from, to) => push(bytes.slice(from, to)), end: () => end(),
    response: new Response(body, { headers: length ? { 'content-length': String(bytes.byteLength) } : {} }) };
}

test('a slow download that keeps receiving bytes is never cut by a whole-file limit and reports its bytes', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // A platform timeout signal follows the same test clock, so a whole-download limit would fire here.
  t.mock.method(AbortSignal, 'timeout', ms => { const clock = new AbortController(); setTimeout(() => clock.abort(new DOMException('Timed out', 'TimeoutError')), ms); return clock.signal; });
  const text = 'abcdef', body = streamed(text), progress = [];
  const { cache } = fixture({ budget: 64, fetchImpl: async () => body.response });
  t.after(() => cache.close());
  const lease = cache.acquire(media(text), undefined, { onProgress: value => progress.push(value) });
  let settled = false; void lease.then(() => { settled = true; }, () => { settled = true; });
  await turn();
  for (let i = 0; i < text.length; i++) {
    t.mock.timers.tick(10000); body.push(i, i + 1); await turn();
    assert.equal(settled, false, 'a progressing download stays open after ' + (i + 1) * 10 + ' s');
  }
  body.end(); const verified = await lease;
  assert.equal(verified.cached, false); verified.release();
  assert.deepEqual(progress.map(row => row.received), [1, 2, 3, 4, 5, 6]);
  assert.ok(progress.every(row => row.total === 6));
});

test('a download that receives nothing for fifteen seconds fails as stalled and the exact hash is retried afresh', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const text = 'aaa', silent = streamed(text, { length: false });
  let attempts = 0;
  const { cache, fetched, revoked } = fixture({ fetchImpl: async src => { fetched.push(src); return ++attempts === 1 ? silent.response : new Response(text); } });
  t.after(() => cache.close());
  const first = cache.acquire(media(text));
  await turn(); silent.push(0, 1); await turn();
  let settled = false; void first.then(() => { settled = true; }, () => { settled = true; });
  t.mock.timers.tick(14999); await turn(); assert.equal(settled, false, 'one received byte renews the silence window');
  t.mock.timers.tick(1);
  await assert.rejects(first, { name: 'TimeoutError', code: 'local_film_download_stalled' });
  assert.deepEqual(cache.snapshot(), { bytes: 0, entries: 0 }); assert.deepEqual(revoked, []);
  const retried = await cache.acquire(media(text));
  assert.deepEqual(fetched, ['/aaa', '/aaa']); retried.release();
});

test('a missing or server-declared unavailable file fails as non-retryable; other failures stay retryable', async () => {
  const json = (status, error) => Response.json({ error }, { status });
  const cases = [
    [new Response('<!doctype html>', { status: 404, headers: { 'content-type': 'text/html' } }), { status: 404, retryable: false }],
    [json(404, 'studio_presentation_idle_media_unavailable'), { status: 404, retryable: false, serverCode: 'studio_presentation_idle_media_unavailable' }],
    [new Response(null, { status: 410 }), { status: 410, retryable: false }],
    [json(503, 'studio_presentation_idle_media_unavailable'), { status: 503, retryable: false, serverCode: 'studio_presentation_idle_media_unavailable' }],
    [json(503, 'shared_room_presentation_unavailable'), { status: 503, retryable: true, serverCode: 'shared_room_presentation_unavailable' }],
    [new Response('busy', { status: 500 }), { status: 500, retryable: true }],
  ];
  for (const [response, expected] of cases) {
    const minted = [];
    const { cache } = fixture({ fetchImpl: async () => response, createUrl: blob => { minted.push(blob); return 'blob:never'; } });
    const error = await cache.acquire(media('aaa')).then(() => null, value => value);
    assert.equal(error.message, 'Local film unavailable'); assert.equal(error.code, 'local_film_unavailable');
    for (const [key, value] of Object.entries(expected)) assert.equal(error[key], value, key + ' for ' + expected.status);
    if (!expected.serverCode) assert.equal(error.serverCode, undefined);
    assert.deepEqual(minted, []); assert.deepEqual(cache.snapshot(), { bytes: 0, entries: 0 }); cache.close();
  }
});

test('a prepared owner and the step that plays it observe one shared download', async t => {
  const text = 'abc', body = streamed(text), seen = [];
  const { cache, fetched } = fixture({ fetchImpl: async src => { fetched.push(src); return body.response; } });
  t.after(() => cache.close());
  const prepared = cache.acquire(media(text));
  await turn(); body.push(0, 1); await turn();
  const stop = cache.observe(media(text).sha256, value => seen.push(value.received));
  assert.deepEqual(seen, [1], 'a late observer receives the bytes already loaded');
  body.push(1, 3); await turn(); body.end();
  const lease = await prepared; stop(); lease.release();
  assert.deepEqual(seen, [1, 3]); assert.deepEqual(fetched, ['/abc']);
  assert.equal(typeof cache.observe('0'.repeat(64), () => {}), 'function', 'an unknown hash has nothing to observe');
});
