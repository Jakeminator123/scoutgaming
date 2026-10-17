import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile, open, stat, rename, utimes } from 'node:fs/promises';
import { writeFileSync,utimesSync,readSync } from 'node:fs';
import { join,dirname,resolve,basename } from 'node:path';
import { tmpdir } from 'node:os';
import { putPrivateMedia, getPrivateMedia, deletePrivateMedia, isCloudMediaConfigured, validatePrivateMedia, privateContentTypeMatches,mediaBlobPath,withVerifiedPrivateMediaFile } from '../lib/cloud-media-store.mjs';

const bytes = Buffer.from('0000ftypisom00000private-video-fixture-exact-bytes');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const contentType = 'video/mp4';
const env = { CROUPIER_MEDIA_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: 'fixture-server-only' };
const pathname = () => `croupier/videos/${randomUUID()}/${sha256}.mp4`;
const request = (headers = {}, method = 'GET') => new Request('http://localhost/media', { headers, method });

test('Blob UTF-8 metadata accepts only matching JSON/SVG essence and the single UTF-8 charset',()=>{
  for(const [actual,expected]of [['application/json; charset=utf-8','application/json'],['image/svg+xml;charset="UTF-8"','image/svg+xml'],['model/gltf+json; charset=utf-8','model/gltf+json'],['video/mp4','video/mp4']])assert.equal(privateContentTypeMatches(actual,expected),true);
  for(const actual of ['application/json; charset=iso-8859-1','application/json; charset=utf-8; x=y','text/html; charset=utf-8','application/json;','application/json;charset="utf-8'])assert.equal(privateContentTypeMatches(actual,'application/json'),false);
  assert.equal(privateContentTypeMatches('video/mp4; charset=utf-8','video/mp4'),false);
});

async function fixture(t) {
  const cacheDir = await mkdtemp(join(tmpdir(), 'croupier-private-media-'));
  t.after(() => {assert.equal(dirname(resolve(cacheDir)),resolve(tmpdir()));assert.match(basename(cacheDir),/^croupier-private-media-/);return rm(cacheDir, { recursive: true, force: true });});
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

async function hashReads(t,path){
  const handle=await open(path,'r'),prototype=Object.getPrototypeOf(handle);await handle.close();
  const original=prototype.createReadStream,reads={calls:0,bytes:0};
  t.mock.method(prototype,'createReadStream',function(options){
    const stream=original.call(this,options);
    if(options.autoClose===false&&options.start===0&&options.end===undefined){
      reads.calls++;const read=stream.read;
      stream.read=function(...args){const chunk=read.apply(this,args);if(chunk)reads.bytes+=chunk.length;return chunk;};
    }
    return stream;
  });return {reads,prototype};
}

test('private inspection uses the hashed descriptor and closes it after the callback',async t=>{
  const {options}=await fixture(t),record=await putPrivateMedia(pathname(),bytes,options);let fd;
  const inspected=await withVerifiedPrivateMediaFile(record,async handle=>{
    fd=handle.fd;const actual=Buffer.alloc(bytes.length);await handle.read(actual,0,actual.length,0);assert.deepEqual(actual,bytes);return {width:32};
  },options);
  assert.deepEqual(inspected,{width:32});assert.throws(()=>readSync(fd,Buffer.alloc(1),0,1,0),{code:'EBADF'});
});

test('private inspection rejects a same-size edit or pathname swap during its callback',async t=>{
  for(const swap of [false,true]){
    const {options}=await fixture(t),record=await putPrivateMedia(pathname(),bytes,options);
    const path=join(options.cacheDir,(await readdir(options.cacheDir)).find(name=>name.endsWith('.mp4')));let fd;
    await assert.rejects(withVerifiedPrivateMediaFile(record,async handle=>{
      fd=handle.fd;
      if(swap){const replacement=path+'.replacement';await writeFile(replacement,bytes);await rename(replacement,path);}
      else await writeFile(path,Buffer.alloc(bytes.length,0x7a));
      return {width:32};
    },options),error=>error.statusCode===409 || (swap&&process.platform==='win32'&&error.code==='EPERM'));
    // Windows may prevent replacement of an open descriptor itself. Linux must
    // reach the post-inspection inode check; neither platform may return a result.
    assert.throws(()=>readSync(fd,Buffer.alloc(1),0,1,0),{code:'EBADF'});
  }
});

test('unchanged Range/HEAD/304 reuse verified file identity without rereading the full file',async t=>{
  const {options}=await fixture(t),record=await putPrivateMedia(pathname(),bytes,options);
  const path=join(options.cacheDir,(await readdir(options.cacheDir)).find(name=>name.endsWith('.mp4'))),{reads}=await hashReads(t,path);
  const first=await getPrivateMedia(record,request({},'HEAD'),options);assert.equal(first.status,200);assert.equal(reads.calls,1);assert.equal(reads.bytes,bytes.length);
  for(const range of ['bytes=0-3','bytes=10-13','bytes=-4']){
    const response=await getPrivateMedia(record,request({range}),options);assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,4);
  }
  assert.equal((await getPrivateMedia(record,request({},'HEAD'),options)).status,200);
  const unchanged=await getPrivateMedia(record,request({'if-none-match':first.headers.get('etag')}),options);assert.equal(unchanged.status,304);assert.equal(unchanged.body,null);
  assert.deepEqual(reads,{calls:1,bytes:bytes.length},'only the first request reads the complete cache file');
});

test('mtime or inode replacement invalidates the proof and rehashes unchanged bytes',async t=>{
  const {options}=await fixture(t),record=await putPrivateMedia(pathname(),bytes,options);
  const path=join(options.cacheDir,(await readdir(options.cacheDir)).find(name=>name.endsWith('.mp4'))),{reads}=await hashReads(t,path);
  assert.equal((await getPrivateMedia(record,request({},'HEAD'),options)).status,200);const original=await stat(path);
  await utimes(path,original.atime,new Date(original.mtimeMs+3000));
  assert.equal((await getPrivateMedia(record,request({},'HEAD'),options)).status,200);assert.equal(reads.calls,2);
  const oldInode=(await stat(path,{bigint:true})).ino,replacement=path+'.replacement';await writeFile(replacement,bytes);await rename(replacement,path);
  assert.notEqual((await stat(path,{bigint:true})).ino,oldInode);
  const response=await getPrivateMedia(record,request({range:'bytes=0-3'}),options);assert.equal(response.status,206);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(0,4));assert.equal(reads.calls,3);
  assert.equal((await getPrivateMedia(record,request({},'HEAD'),options)).status,200);assert.equal(reads.calls,3);
});

test('fingerprint changes during full verification cannot publish a memoized proof',async t=>{
  const {options}=await fixture(t),record=await putPrivateMedia(pathname(),bytes,options);
  const path=join(options.cacheDir,(await readdir(options.cacheDir)).find(name=>name.endsWith('.mp4'))),{reads,prototype}=await hashReads(t,path);
  const original=prototype.stat;let calls=0;
  t.mock.method(prototype,'stat',async function(...args){if(++calls===2){const info=await stat(path);await utimes(path,info.atime,new Date(info.mtimeMs+3000));}return original.apply(this,args);});
  assert.equal((await getPrivateMedia(record,request({},'HEAD'),options)).status,409);assert.equal(reads.calls,1);
  assert.equal((await getPrivateMedia(record,request({},'HEAD'),options)).status,200);assert.equal(reads.calls,2,'the failed proof is never reused');
});

test('changed bytes during a memoized response fail the stream and invalidate the proof',async t=>{
  const {options}=await fixture(t),record=await putPrivateMedia(pathname(),bytes,options);
  const path=join(options.cacheDir,(await readdir(options.cacheDir)).find(name=>name.endsWith('.mp4'))),{reads,prototype}=await hashReads(t,path);
  assert.equal((await getPrivateMedia(record,request({},'HEAD'),options)).status,200);
  const original=prototype.createReadStream;let changed=false;
  t.mock.method(prototype,'createReadStream',function(options){
    const stream=original.call(this,options),read=stream.read;
    if(options.end!==undefined)stream.read=function(...args){const chunk=read.apply(this,args);if(chunk&&!changed){changed=true;writeFileSync(path,Buffer.alloc(bytes.length,0x7a));
      // Windows may coalesce two fast writes into the same filesystem tick.
      // Make this deliberate in-flight file change observably deterministic.
      utimesSync(path,new Date(0),new Date(0));
    }return chunk;};
    return stream;
  });
  const response=await getPrivateMedia(record,request({range:'bytes=0-3'}),options);assert.equal(response.status,206);
  await assert.rejects(response.arrayBuffer(),/ändrades/);assert.equal(changed,true);
  assert.equal((await getPrivateMedia(record,request({},'HEAD'),options)).status,409);assert.equal(reads.calls,2);
});

test('private JSON readback preserves exact bytes when SDK metadata appends charset=utf-8',async t=>{
  const {options}=await fixture(t),json=Buffer.from('{"schemaVersion":1,"unchanged":true}'),sha256=createHash('sha256').update(json).digest('hex');
  const get=options.blobClient.get;options.blobClient.get=async(...args)=>{const result=await get(...args);if(result)result.blob.contentType='application/json; charset=utf-8';return result;};
  const record=await putPrivateMedia(mediaBlobPath('game/runtime/metadata',randomUUID(),sha256,'json'),json,{...options,sha256,size:json.length,contentType:'application/json'});
  const response=await getPrivateMedia(record,request(),options);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/json');assert.deepEqual(Buffer.from(await response.arrayBuffer()),json);
});

test('SDK compressed/missing wire lengths still require exact decoded count and SHA before publishing',async t=>{
  for(const [headers,size]of [[new Headers({'content-encoding':'gzip','content-length':'10'}),10],[new Headers(),0]]){
    const {options}=await fixture(t),json=Buffer.from('{"schemaVersion":1,"unchanged":true}'),sha256=createHash('sha256').update(json).digest('hex');
    const get=options.blobClient.get;options.blobClient.get=async(...args)=>{const result=await get(...args);if(result){result.headers=headers;result.blob.size=size;result.blob.contentType='application/json; charset=utf-8';}return result;};
    const metadata=[];const updated={...options,sha256,size:json.length,contentType:'application/json',onMetadata:value=>metadata.push(value)};
    const record=await putPrivateMedia(mediaBlobPath('game/runtime/metadata',randomUUID(),sha256,'json'),json,updated);assert.equal(metadata[0].actualSize,size);assert.deepEqual(Buffer.from(await(await getPrivateMedia(record,request(),updated)).arrayBuffer()),json);
    const badGet=options.blobClient.get;options.blobClient.get=async(...args)=>{const result=await badGet(...args);if(result)result.stream=new Response(Buffer.from('wrong decoded body')).body;return result;};
    assert.equal((await getPrivateMedia(record,request(),{...updated,cacheDir:join(options.cacheDir,'fresh')})).status,409);
  }
});

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
  assert.equal((await getPrivateMedia(record,request({},'HEAD'),options)).status,200);
  await writeFile(join(options.cacheDir, cache), Buffer.alloc(bytes.length, 0x7a));
  assert.equal((await getPrivateMedia(record, request({ range: 'bytes=0-1' }), options)).status, 409);
  objects.set(record.pathname, Buffer.alloc(bytes.length, 0x79));
  assert.equal((await getPrivateMedia(record, request(), { ...options, cacheDir: join(options.cacheDir, 'fresh') })).status, 409);
  await deletePrivateMedia(record, options);
  assert.equal(objects.size, 0);
});

test('provider diagnostics expose only bounded name/code/status without message or URLs',async t=>{
  const {options}=await fixture(t),seen=[];options.blobClient.put=async()=>{const error=new Error('https://private.example/?token=secret');error.name='BlobAlreadyExistsError';error.code='already_exists';error.statusCode=409;throw error;};
  await assert.rejects(putPrivateMedia(pathname(),bytes,{...options,onProviderError:value=>seen.push(value)}),/kunde inte sparas/);
  assert.deepEqual(seen,[{errorName:'BlobAlreadyExistsError',errorCode:'already_exists',statusCode:409,errorCategory:'unclassified',errorOrigin:'media-store'}]);assert.ok(!JSON.stringify(seen).includes('secret'));
  options.blobClient.put=async()=>{const cause=new Error('private URL');cause.code='UND_ERR_CONNECT_TIMEOUT';const error=new TypeError('fetch failed',{cause});throw error;};
  await assert.rejects(putPrivateMedia(pathname(),bytes,{...options,onProviderError:value=>seen.push(value)}));
  assert.deepEqual(seen[1],{errorName:'TypeError',errorCode:null,statusCode:null,errorCategory:'fetch-failed',errorOrigin:'media-store',errorCauseName:'Error',errorCauseCode:'UND_ERR_CONNECT_TIMEOUT'});
  options.blobClient.put=async()=>{const error=new TypeError('Response body object should not be disturbed or locked https://private.example/?secret=do-not-print');error.stack='TypeError: do-not-print\n at fetch (C:/node_modules/undici/index.js:1:2)';throw error;};
  await assert.rejects(putPrivateMedia(pathname(),bytes,{...options,onProviderError:value=>seen.push(value)}));
  assert.deepEqual(seen[2],{errorName:'TypeError',errorCode:null,statusCode:null,errorCategory:'body-not-reusable',errorOrigin:'undici'});
  assert.ok(!JSON.stringify(seen).includes('do-not-print'));
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
