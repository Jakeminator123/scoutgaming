import {createHash,randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {mkdir,lstat,realpath,open,rename,unlink} from 'node:fs/promises';
import {join,resolve,isAbsolute} from 'node:path';
import {Readable} from 'node:stream';
import {StudioError} from '../../shared/studio-error.mjs';
import {MAX_BYTES,validatePrivateMedia,isCloudMediaConfigured,privateContentTypeMatches} from './private-media-contract.mjs';
const pending = new Map();
const verifiedFiles = new Map();
const MAX_VERIFIED_FILES = 1024;
const fail = (message, status = 503) => { throw new StudioError(message, status); };
const readAborted = () => new StudioError('Den privata medialäsningen avbröts.',408);
const checkReadSignal = signal => { if(signal?.aborted)throw readAborted(); };
async function waitForDownload(promise,signal) {
  checkReadSignal(signal);
  if(!signal)return promise;
  let abort;
  try {
    return await Promise.race([promise,new Promise((_,reject)=>{
      abort=()=>reject(readAborted());signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted)abort();
    })]);
  } finally {signal.removeEventListener('abort',abort);}
}
export function createBlobMediaStore({clientFactory,defaultCacheDir}) {
  if(typeof clientFactory!=='function'||typeof defaultCacheDir!=='string'||!isAbsolute(defaultCacheDir)) throw new TypeError('Explicit Blob provider and cache root required.');

  const commonHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' };

  function tokenFor(options) {
    const env = options.env ?? process.env;
    if (!isCloudMediaConfigured(env)) fail('Privat medielagring är inte konfigurerad.');
    return env.BLOB_READ_WRITE_TOKEN;
  }
  async function clientFor(options) { return options.blobClient ?? await clientFactory(); }
  function privateResult(result, record) {
    let url;
    try { url = new URL(result?.url); } catch { fail('Lagringen returnerade en ogiltig mediareferens.'); }
    if (url.protocol !== 'https:' || !/^[a-z0-9]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname)
      || url.username || url.password || url.port || url.search || url.hash
      || url.pathname !== `/${record.pathname}` || result.pathname !== record.pathname) {
      fail('Lagringen returnerade inte den privata mediafilen.');
    }
  }
  function cacheDirectory(options) {
    return resolve(options.cacheDir ?? defaultCacheDir);
  }
  async function safeDirectory(dir) {
    await mkdir(dir, { recursive: true });
    const info = await lstat(dir), actual = await realpath(dir);
    const equal = process.platform === 'win32' ? actual.toLowerCase() === dir.toLowerCase() : actual === dir;
    if (!info.isDirectory() || info.isSymbolicLink() || !equal) fail('Ogiltig cachemapp för privat media.', 403);
  }
  function cachePath(record, options) {
    // Include pathname so records from separate upload namespaces never collide.
    return join(cacheDirectory(options), `${createHash('sha256').update(record.pathname).digest('hex')}.${record.pathname.split('.').at(-1)}`);
  }

  async function downloadVerified(record, options) {
    checkReadSignal(options.signal);
    validatePrivateMedia(record);
    const token = tokenFor(options), target = cachePath(record, options);
    await safeDirectory(cacheDirectory(options));
    try {
      const info = await lstat(target);
      if (!info.isFile() || info.isSymbolicLink() || info.size !== record.size) fail('Den privata mediacachen är ogiltig.', 409);
      checkReadSignal(options.signal);
      return target; // Every response still hashes the same descriptor it serves.
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const client = await clientFor(options);
    const timeout=AbortSignal.timeout(60000),signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
    checkReadSignal(signal);
    let result;
    try { result = await client.get(record.pathname, { access: 'private', token, useCache: false, abortSignal: signal }); }
    catch { checkReadSignal(signal);fail('Den privata mediafilen kunde inte hämtas.'); }
    if (!result) {checkReadSignal(signal);fail('Den privata mediafilen saknas.', 404);}
    let file, reader,abortRead;
    const temporary = `${target}.${randomUUID()}.part`;
    try {
      checkReadSignal(signal);
      if (result.statusCode !== 200 || !result.stream) fail('Den privata mediafilen kunde inte hämtas.');
      privateResult(result.blob, record);
      const encoding=result.headers?.get?.('content-encoding')?.trim().toLowerCase()??null;
      const length=result.headers?.get?.('content-length')??null;
      options.onMetadata?.({actualSize:result.blob.size,contentType:result.blob.contentType,contentEncoding:encoding,contentLength:length});
      // SDK get() exposes the HTTP wire length. The stream is already decoded
      // by fetch, so a recognised encoding (or absent size header) is proved
      // below by the exact decoded byte count and SHA, never by wire length.
      const decodedBody=['gzip','br','deflate'].includes(encoding)||Boolean(result.headers&&length===null&&result.blob.size===0);
      if ((!decodedBody&&result.blob.size!==record.size) || !privateContentTypeMatches(result.blob.contentType,record.contentType)) fail('Den privata mediafilens metadata har ändrats.', 409);
      file = await open(temporary, 'wx');
      reader = result.stream.getReader();
      // Cancel the body as well as the provider request: a stream may already
      // have arrived when the caller cancels, or be waiting for its next chunk.
      abortRead=()=>{void reader.cancel().catch(()=>{});};
      signal.addEventListener('abort',abortRead,{once:true});
      checkReadSignal(signal);
      let size = 0; const hash = createHash('sha256');
      for (;;) {
        checkReadSignal(signal);
        const { done, value } = await reader.read();checkReadSignal(signal); if (done) break;
        size += value.byteLength;
        if (size > record.size || size > MAX_BYTES) fail('Den privata mediafilens storlek har ändrats.', 409);
        hash.update(value);
        let offset = 0;
        while (offset < value.byteLength) { checkReadSignal(signal);const { bytesWritten } = await file.write(value, offset, value.byteLength - offset); offset += bytesWritten; }
      }
      if (size !== record.size || hash.digest('hex') !== record.sha256) fail('Den privata mediafilens hash stämmer inte.', 409);
      await file.sync(); await file.close(); file = null;
      checkReadSignal(signal);
      await rename(temporary, target);
      return target;
    } catch(error) {
      checkReadSignal(signal);throw error;
    } finally {
      if(abortRead)signal.removeEventListener('abort',abortRead);
      if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      else await result.stream?.cancel().catch(() => {});
      if (file) await file.close().catch(() => {});
      await unlink(temporary).catch(() => {});
    }
  }
  async function cachedFile(record, options) {
    checkReadSignal(options.signal);
    const key = cachePath(record, options);
    if(pending.has(key))return waitForDownload(pending.get(key),options.signal);
    const download=downloadVerified(record, options).finally(() => pending.delete(key));
    pending.set(key,download);
    // The owning caller awaits cleanup before retry; another caller may stop
    // waiting without cancelling an in-flight download that it does not own.
    return download;
  }

  function providerErrorCategory(error){
    const message=typeof error?.message==='string'?error.message.slice(0,2048):'';
    if(/body.*(?:disturbed|locked)/i.test(message))return 'body-not-reusable';
    if(/body.*(?:already.*(?:read|consumed)|unusable)|already.*consumed/i.test(message))return 'body-consumed';
    if(/stream.*locked|locked.*stream/i.test(message))return 'body-locked';
    if(/^(?:fetch failed|Failed to fetch|Network request failed|network error|Network request timed out|terminated)$/i.test(message))return 'fetch-failed';
    if(['AbortError','BlobRequestAbortedError'].includes(error?.name)||/^The request was aborted\.$/.test(message))return 'request-aborted';
    return error?.name==='TypeError'?'unclassified-type-error':'unclassified';
  }
  function providerErrorOrigin(error){
    const frames=typeof error?.stack==='string'?error.stack.slice(0,16384).split('\n').slice(1):[];
    for(const frame of frames){
      if(/[\\/]undici[\\/]|node:internal\/deps\/undici/.test(frame))return 'undici';
      if(/[\\/]@vercel[\\/]blob[\\/]/.test(frame))return 'vercel-blob-sdk';
      if(/node:(?:internal\/streams|stream)/.test(frame))return 'node-stream';
      if(/[\\/](?:cloud-media-store|blob-reader)\.mjs:\d+/.test(frame))return 'media-store';
    }
    return null;
  }
  /** Upload immutable bytes, then read and hash them back before publishing metadata. */
  async function putPrivateMedia(pathname, body, options = {}) {
    const { sha256, size, contentType } = options;
    const record = validatePrivateMedia({ provider: 'vercel-blob', pathname, sha256, size, contentType });
    const token = tokenFor(options), client = await clientFor(options);
    if (body instanceof Uint8Array && (body.byteLength !== size || createHash('sha256').update(body).digest('hex') !== sha256)) fail('Videons hash stämmer inte.', 409);
    let created = false;
    try {
      const result = await client.put(pathname, body, { access: 'private', token, addRandomSuffix: false, allowOverwrite: false,
        contentType, cacheControlMaxAge: 60, abortSignal: AbortSignal.timeout(60000) });
      created = true; privateResult(result, record);
      await cachedFile(record, options);
      return record;
    } catch (error) {
      const safeLabel=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value)?value:null;
      options.onProviderError?.({errorName:safeLabel(error.name),errorCode:safeLabel(error.code),statusCode:Number.isInteger(error.statusCode)?error.statusCode:Number.isInteger(error.status)?error.status:null,
        errorCategory:providerErrorCategory(error),errorOrigin:providerErrorOrigin(error),
        ...(error.cause?{errorCauseName:safeLabel(error.cause.name),errorCauseCode:safeLabel(error.cause.code)}:{})});
      if (created) await deletePrivateMedia(record, options).catch(() => {});
      if (error instanceof StudioError) throw error;
      fail('Videon kunde inte sparas i privat medielagring.');
    }
  }

  /** Only call for a newly created upload whose metadata transaction failed. */
  async function deletePrivateMedia(record, options = {}) {
    validatePrivateMedia(record);
    const token = tokenFor(options), client = await clientFor(options);
    try { await client.del(record.pathname, { token, abortSignal: AbortSignal.timeout(15000) }); }
    catch { fail('Den nya privata mediafilen kunde inte återställas.'); }
    const path=cachePath(record,options);verifiedFiles.delete(path);
    await unlink(path).catch(() => {});
  }

  function parseRange(header, size) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(header);
    if (!match || (!match[1] && !match[2])) return null;
    const first = match[1] ? Number(match[1]) : null, last = match[2] ? Number(match[2]) : null;
    if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last)) || (first === null && last === 0)) return null;
    const start = first === null ? Math.max(0, size - last) : first;
    const end = first !== null && last !== null ? Math.min(last, size - 1) : size - 1;
    return start <= end && start < size ? { start, end } : null;
  }
  function errorResponse(request, status, message, headers = {}) {
    return new Response(request.method === 'HEAD' ? null : JSON.stringify({ error: message }), {
      status, headers: { ...commonHeaders, 'Content-Type': 'application/json; charset=utf-8', ...headers },
    });
  }
  const fingerprint = info => `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
  async function assertCurrentFile(handle,path,stamp){
    const [opened,current,actual]=await Promise.all([handle.stat({bigint:true}),lstat(path,{bigint:true}),realpath(path)]);
    const plain=process.platform==='win32'?actual.toLowerCase()===path.toLowerCase():actual===path;
    if(!plain||!opened.isFile()||!current.isFile()||current.isSymbolicLink()||fingerprint(opened)!==stamp||fingerprint(current)!==stamp)fail('Den privata mediafilen ändrades.',409);
  }
  async function verifyCachedFile(handle,path,record,opened){
    const stamp=fingerprint(opened),prior=verifiedFiles.get(path);
    if(prior?.sha256!==record.sha256||prior?.stamp!==stamp){
      verifiedFiles.delete(path);
      const hash=createHash('sha256');
      for await(const chunk of handle.createReadStream({autoClose:false,start:0}))hash.update(chunk);
      if(hash.digest('hex')!==record.sha256)fail('Den privata mediafilens hash stämmer inte.',409);
    }
    // A memoized proof applies only to the exact descriptor just opened. Also
    // reject a change during verification, including unchanged-size mutations.
    await assertCurrentFile(handle,path,stamp);
    verifiedFiles.delete(path);verifiedFiles.set(path,{sha256:record.sha256,stamp});
    if(verifiedFiles.size>MAX_VERIFIED_FILES)verifiedFiles.delete(verifiedFiles.keys().next().value);
    return stamp;
  }

  /** Server-only inspection of the same open descriptor that passed the full hash.
   * The callback must finish all descriptor users before returning (including workers).
   * Never hand the cache pathname to a parser that could reopen different bytes.
   */
  async function withVerifiedPrivateMediaFile(record, inspect, options = {}) {
    let handle,path;
    try {
      checkReadSignal(options.signal);
      validatePrivateMedia(record); tokenFor(options);
      path=await cachedFile(record,options);
      checkReadSignal(options.signal);
      const info=await lstat(path,{bigint:true});
      if(!info.isFile() || info.isSymbolicLink() || info.size!==BigInt(record.size))fail('Den privata mediacachen är ogiltig.',409);
      handle=await open(path,constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const opened=await handle.stat({bigint:true});
      if(!opened.isFile() || fingerprint(opened)!==fingerprint(info))fail('Den privata mediafilen ändrades.',409);
      const stamp=await verifyCachedFile(handle,path,record,opened);
      checkReadSignal(options.signal);
      const result=await inspect(handle);
      await assertCurrentFile(handle,path,stamp);
      checkReadSignal(options.signal);
      return result;
    } catch(error) {
      if(path)verifiedFiles.delete(path);
      throw error;
    } finally {if(handle)await handle.close();}
  }

  /** Caller must authenticate and resolve the record by an allowed logical ID first. */
  async function getPrivateMedia(record, request, options = {}) {
    if (!['GET', 'HEAD'].includes(request.method)) return errorResponse(request, 405, 'GET or HEAD only.', { Allow: 'GET, HEAD' });
    const origin = request.headers.get('origin'), site = request.headers.get('sec-fetch-site');
    const proxyAllowed = options.trustedProxyOrigin && origin === options.trustedProxyOrigin && (!site || site === 'same-origin');
    if (site === 'cross-site' || (origin && origin !== new URL(request.url).origin && !proxyAllowed)) return errorResponse(request, 403, 'Same-origin media required.');
    let handle,path;
    try {
      validatePrivateMedia(record); tokenFor(options);
      const etag = `"sha256-${record.sha256}"`;
      let range = { start: 0, end: record.size - 1 }, status = 200;
      const rangeHeader = request.method === 'GET' && request.headers.get('range'), ifRange = request.headers.get('if-range');
      if (rangeHeader && (!ifRange || ifRange === etag)) {
        range = parseRange(rangeHeader, record.size);
        if (!range) return errorResponse(request, 416, 'Invalid video byte range.', { 'Content-Range': `bytes */${record.size}` });
        status = 206;
      }
      path = await cachedFile(record, options);const info = await lstat(path, { bigint: true });
      if (!info.isFile() || info.isSymbolicLink() || info.size !== BigInt(record.size)) fail('Den privata mediacachen är ogiltig.', 409);
      handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const opened = await handle.stat({ bigint: true });
      if (!opened.isFile() || fingerprint(opened) !== fingerprint(info)) fail('Den privata mediafilen ändrades.', 409);
      const verifiedStamp=await verifyCachedFile(handle,path,record,opened);
      const headers = { ...commonHeaders, 'Content-Type': record.contentType, 'Accept-Ranges': 'bytes', ETag: etag,
        'Content-Length': String(range.end - range.start + 1), ...(status === 206 ? { 'Content-Range': `bytes ${range.start}-${range.end}/${record.size}` } : {}) };
      if(request.headers.get('if-none-match')===etag){await handle.close();handle=null;delete headers['Content-Length'];delete headers['Content-Range'];return new Response(null,{status:304,headers});}
      if (request.method === 'HEAD') { await handle.close(); handle = null; return new Response(null, { status, headers }); }
      const served=handle,fileStream=served.createReadStream({start:range.start,end:range.end,autoClose:false});
      const stream=Readable.from((async function*(){
        try{
          for await(const chunk of fileStream)yield chunk;
          await assertCurrentFile(served,path,verifiedStamp);
        }catch(error){verifiedFiles.delete(path);throw error;}
        finally{fileStream.destroy();await served.close().catch(()=>{});}
      })(),{objectMode:false});handle=null;
      return new Response(Readable.toWeb(stream), { status, headers });
    } catch (error) {
      if(path)verifiedFiles.delete(path);
      if (handle) await handle.close().catch(() => {});
      const status = error instanceof StudioError ? error.statusCode : 503;
      return errorResponse(request, status, error instanceof StudioError ? error.message : 'Privat media kunde inte läsas.');
    }
  }

  async function deleteManagedMediaObject(storage,options={}) {
    const token=tokenFor(options),client=await clientFor(options);
    try{await client.del(storage.pathname,{token,abortSignal:AbortSignal.timeout(15000)});}
    catch(error){if(typeof client.BlobNotFoundError!=='function'||!(error instanceof client.BlobNotFoundError))throw Object.assign(Error('studio_media_delete_failed'),{code:'studio_media_delete_failed',statusCode:503});}
    const path=cachePath(storage,options);verifiedFiles.delete(path);await unlink(path).catch(()=>{});
  }

  return {getPrivateMedia,withVerifiedPrivateMediaFile,putPrivateMedia,deletePrivateMedia,deleteManagedMediaObject};
}
