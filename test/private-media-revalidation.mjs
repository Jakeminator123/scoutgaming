import test from 'node:test';
import assert from 'node:assert/strict';
import {revalidatePrivateMedia} from '../packages/studio-registry/server/private-media-revalidation.mjs';

const sha256 = 'a'.repeat(64), etag = `"sha256-${sha256}"`;
const request = (headers = {}, method = 'GET') => new Request('https://game.invalid/video', {method, headers});
const media = (status = 200, tag = etag) => new Response([304, 416, 503].includes(status) ? null : 'original-bytes', {
  status, headers: {ETag: tag, 'Content-Type':'video/mp4', 'Accept-Ranges':'bytes',
    ...(status === 206 ? {'Content-Range':'bytes 0-13/100', 'Content-Length':'14'} : {})},
});

test('verified full and partial bodies retain original bytes, range and private revalidation', async () => {
  for (const status of [200,206]) {
    const response = await revalidatePrivateMedia(media(status), request(), sha256);
    assert.equal(response.status, status);
    assert.equal(await response.text(), 'original-bytes');
    assert.equal(response.headers.get('etag'), etag);
    assert.equal(response.headers.get('cache-control'), 'private, no-cache, must-revalidate');
    if (status === 206) assert.equal(response.headers.get('content-range'), 'bytes 0-13/100');
  }
});

test('matching conditional GET/HEAD return no body, release streams and remove range lengths', async () => {
  for (const method of ['GET','HEAD']) for (const condition of [etag, `W/${etag}`, `"other", ${etag}`, '*']) {
    let cancelled = false;
    const stream = new ReadableStream({cancel() { cancelled = true; }});
    const response = await revalidatePrivateMedia(new Response(stream, {status:206,
      headers:{ETag:etag, 'Content-Length':'14', 'Content-Range':'bytes 0-13/100'}}), request({'if-none-match':condition}, method), sha256);
    assert.equal(response.status,304); assert.equal(await response.text(),'');
    assert.equal(cancelled,true); assert.equal(response.headers.has('content-length'),false);
    assert.equal(response.headers.has('content-range'),false);
  }
});

test('nonmatching validators preserve data, and failures or unverified identities never enable reuse', async () => {
  const changed = await revalidatePrivateMedia(media(), request({'if-none-match':'"old-hash"'}), sha256);
  assert.equal(changed.status,200); assert.equal(await changed.text(),'original-bytes');
  for (const [status,hash,tag] of [[404,sha256,etag],[416,sha256,etag],[503,sha256,etag],
    [200,'b'.repeat(64),etag],[200,undefined,etag],[200,sha256,'"unverified"']]) {
    const response = await revalidatePrivateMedia(media(status,tag),request({'if-none-match':etag}),hash);
    assert.equal(response.status,status);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    await response.body?.cancel();
  }
  const unsafe304 = await revalidatePrivateMedia(media(304,'"wrong-hash"'),request({'if-none-match':etag}),sha256);
  assert.equal(unsafe304.status,503); assert.equal(unsafe304.headers.get('cache-control'),'private, no-store');
  const checked304 = await revalidatePrivateMedia(media(304),request({'if-none-match':etag}),sha256);
  assert.equal(checked304.status,304); assert.equal(checked304.headers.get('cache-control'),'private, no-cache, must-revalidate');
});
