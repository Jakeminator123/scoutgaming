import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { putPrivateMedia, getPrivateMedia, deletePrivateMedia, isCloudMediaConfigured, validatePrivateMedia } from '../lib/cloud-media-store.mjs';

const bytes = Buffer.from('0000ftypisom00000private-video-fixture-exact-bytes');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const contentType = 'video/mp4';
const env = { CROUPIER_MEDIA_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: 'fixture-server-only' };
const pathname = () => `croupier/videos/${randomUUID()}/${sha256}.mp4`;
const request = (headers = {}, method = 'GET') => new Request('http://localhost/media', { headers, method });

async function fixture(t) {
  const cacheDir = await mkdtemp(join(tmpdir(), 'croupier-private-media-'));
  t.after(() => rm(cacheDir, { recursive: true, force: true }));
  const objects = new Map(), calls = [];
  const blobClient = {
    async put(path, body, options) {
      calls.push({ method: 'put', path, options });
      assert.equal(options.access, 'private'); assert.equal(options.allowOverwrite, false); assert.equal(options.token, env.BLOB_READ_WRITE_TOKEN);
      if (objects.has(path)) throw new Error('exists');
      const chunks = [];
      if (body instanceof Uint8Array) chunks.push(body); else for await (const chunk of body) chunks.push(chunk);
      objects.set(path, Buffer.concat(chunks));
      return { pathname: path, url: `https://fixture.private.blob.vercel-storage.com/${path}`, contentType };
    },
    async get(path, options) {
      calls.push({ method: 'get', path, options });
      assert.equal(options.access, 'private'); assert.equal(options.token, env.BLOB_READ_WRITE_TOKEN);
      if (!objects.has(path)) return null;
      const value = objects.get(path);
      return { statusCode: 200, stream: new Response(value).body, blob: { pathname: path, url: `https://fixture.private.blob.vercel-storage.com/${path}`, contentType, size: value.length } };
    },
    async del(path) { calls.push({ method: 'del', path }); objects.delete(path); },
  };
  return { options: { env, blobClient, cacheDir, sha256, size: bytes.length, contentType }, objects, calls };
}

test('private upload reads back exact hash; reload serves full/ranges/HEAD without exposing credentials or blob URLs', async t => {
  const { options, calls } = await fixture(t);
  const record = await putPrivateMedia(pathname(), bytes, options);
  assert.deepEqual(calls.map(call => call.method), ['put', 'get']);
  assert.ok(!JSON.stringify(record).includes('https://')); assert.ok(!JSON.stringify(record).includes(env.BLOB_READ_WRITE_TOKEN));
  for (const [header, start, end] of [['bytes=0-15', 0, 16], ['bytes=16-', 16, bytes.length], ['bytes=-5', bytes.length - 5, bytes.length], ['bytes=0-999', 0, bytes.length]]) {
    const response = await getPrivateMedia(record, request({ range: header }), options);
    assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), `bytes ${start}-${end - 1}/${bytes.length}`);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end));
  }
  const head = await getPrivateMedia(record, request({}, 'HEAD'), options);
  assert.equal(head.status, 200); assert.equal(head.body, null); assert.equal(head.headers.get('content-length'), String(bytes.length));
  const ifRange = await getPrivateMedia(record, request({ range: 'bytes=0-1', 'if-range': 'old-hash' }), options);
  assert.equal(ifRange.status, 200); assert.deepEqual(Buffer.from(await ifRange.arrayBuffer()), bytes);
  const fresh = { ...options, cacheDir: join(options.cacheDir, 'restarted-process') };
  const reloaded = await getPrivateMedia(JSON.parse(JSON.stringify(record)), request(), fresh);
  assert.equal(reloaded.status, 200); assert.deepEqual(Buffer.from(await reloaded.arrayBuffer()), bytes);
  assert.equal(calls.filter(call => call.method === 'get').length, 2);
});

test('foreign origins, bad ranges and arbitrary URLs/paths are rejected before provider access', async t => {
  const { options, calls } = await fixture(t);
  const record = { provider: 'vercel-blob', pathname: pathname(), sha256, size: bytes.length, contentType };
  for (const headers of [{ origin: 'https://other.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await getPrivateMedia(record, request(headers), options)).status, 403);
  }
  assert.equal((await getPrivateMedia(record, request({}, 'POST'), options)).status, 405);
  for (const range of ['bytes=0-1,4-5', 'bytes=999-', 'bytes=-0', 'bytes=3-1', 'x=0-1']) {
    const response = await getPrivateMedia(record, request({ range }), options);
    assert.equal(response.status, 416); assert.equal(response.headers.get('content-range'), `bytes */${bytes.length}`);
  }
  for (const path of ['https://evil.example/a.mp4', '../secret', `croupier/videos/${randomUUID()}/wrong.mp4`]) {
    assert.throws(() => validatePrivateMedia({ ...record, pathname: path }), /mediareferens/);
  }
  assert.equal(calls.length, 0);
  assert.equal(isCloudMediaConfigured({ BLOB_READ_WRITE_TOKEN: 'alone' }), false);
  assert.equal((await getPrivateMedia(record, request(), { ...options, env: { CROUPIER_MEDIA_STORAGE: 'blob' } })).status, 503);
  assert.equal(calls.length, 0);
});

test('provider tampering cannot publish metadata, and rollback only deletes newly created object', async t => {
  const { options, calls, objects } = await fixture(t);
  const get = options.blobClient.get;
  options.blobClient.get = async (...args) => {
    const result = await get(...args);
    result.stream = new Response(Buffer.alloc(bytes.length, 0x61)).body;
    return result;
  };
  await assert.rejects(putPrivateMedia(pathname(), bytes, options), /hash/);
  assert.equal(objects.size, 0); assert.equal(calls.at(-1).method, 'del');
  assert.deepEqual(await readdir(options.cacheDir), []);
  const occupied = pathname(); objects.set(occupied, bytes);
  await assert.rejects(putPrivateMedia(occupied, bytes, options), /kunde inte sparas/);
  assert.equal(objects.has(occupied), true); assert.equal(calls.at(-1).method, 'put');
});

test('same-size local cache corruption blocks all response bytes; cloud mismatch after restart also blocks', async t => {
  const { options, objects } = await fixture(t);
  const record = await putPrivateMedia(pathname(), bytes, options);
  const cache = (await readdir(options.cacheDir)).find(name => name.endsWith('.mp4'));
  assert.deepEqual(await readFile(join(options.cacheDir, cache)), bytes);
  await writeFile(join(options.cacheDir, cache), Buffer.alloc(bytes.length, 0x7a));
  assert.equal((await getPrivateMedia(record, request({ range: 'bytes=0-1' }), options)).status, 409);
  objects.set(record.pathname, Buffer.alloc(bytes.length, 0x79));
  assert.equal((await getPrivateMedia(record, request(), { ...options, cacheDir: join(options.cacheDir, 'fresh') })).status, 409);
  await deletePrivateMedia(record, options);
  assert.equal(objects.size, 0);
});

test('public provider URL is rejected and upstream errors never disclose credentials', async t => {
  const { options, objects } = await fixture(t);
  const put = options.blobClient.put;
  options.blobClient.put = async (...args) => { const result = await put(...args); result.url = result.url.replace('.private.', '.public.'); return result; };
  await assert.rejects(putPrivateMedia(pathname(), bytes, options), /privata mediafilen/);
  assert.equal(objects.size, 0);
  options.blobClient.get = async () => { throw new Error(`Provider failed with ${env.BLOB_READ_WRITE_TOKEN}`); };
  const record = { provider: 'vercel-blob', pathname: pathname(), sha256, size: bytes.length, contentType };
  const response = await getPrivateMedia(record, request(), options);
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes(env.BLOB_READ_WRITE_TOKEN));
});
