import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, lstat, realpath, open, rename, unlink } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { StudioError } from './project-store.mjs';

const MAX_BYTES = 128 * 1024 * 1024;
const pending = new Map();
const MIME = { mp4: 'video/mp4', webm: 'video/webm' };
const PATH = /^croupier\/(videos|zones)\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/([a-f0-9]{64})\.(mp4|webm)$/;
const commonHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' };
const fail = (message, status = 503) => { throw new StudioError(message, status); };

export function isCloudMediaConfigured(env = process.env) {
  return env.CROUPIER_MEDIA_STORAGE === 'blob' && Boolean(env.BLOB_READ_WRITE_TOKEN?.trim());
}

/** Persist this server-owned reference, never a client-supplied URL or token. */
export function validatePrivateMedia(record) {
  const match = typeof record?.pathname === 'string' && PATH.exec(record.pathname);
  if (!match || Object.keys(record).some(key => !['provider', 'pathname', 'sha256', 'size', 'contentType'].includes(key))
    || record.provider !== 'vercel-blob' || record.sha256 !== match[2]
    || record.contentType !== MIME[match[3]] || !Number.isSafeInteger(record.size)
    || record.size < 16 || record.size > MAX_BYTES) fail('Ogiltig privat mediareferens.', 422);
  return record;
}

function tokenFor(options) {
  const env = options.env ?? process.env;
  if (!isCloudMediaConfigured(env)) fail('Privat medielagring är inte konfigurerad.');
  return env.BLOB_READ_WRITE_TOKEN;
}
async function clientFor(options) { return options.blobClient ?? await import('@vercel/blob'); }
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
  const env = options.env ?? process.env;
  const lab = basename(process.cwd()) === 'lab' ? process.cwd() : join(process.cwd(), 'lab');
  return resolve(options.cacheDir ?? join(env.LAB_STUDIO_DATA_DIR || env.CROUPIER_PRESENTATION_STUDIO_DIR || join(lab, 'data'), '.blob-cache'));
}
async function safeDirectory(dir) {
  await mkdir(dir, { recursive: true });
  const info = await lstat(dir), actual = await realpath(dir);
  const equal = process.platform === 'win32' ? actual.toLowerCase() === dir.toLowerCase() : actual === dir;
  if (!info.isDirectory() || info.isSymbolicLink() || !equal) fail('Ogiltig cachemapp för privat media.', 403);
}
function cachePath(record, options) {
  // Include pathname so records from separate upload namespaces never collide.
  return join(cacheDirectory(options), `${createHash('sha256').update(record.pathname).digest('hex')}.${record.contentType === MIME.mp4 ? 'mp4' : 'webm'}`);
}

async function downloadVerified(record, options) {
  validatePrivateMedia(record);
  const token = tokenFor(options), target = cachePath(record, options);
  await safeDirectory(cacheDirectory(options));
  try {
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink() || info.size !== record.size) fail('Den privata mediacachen är ogiltig.', 409);
    return target; // Every response still hashes the same descriptor it serves.
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const client = await clientFor(options);
  let result;
  try { result = await client.get(record.pathname, { access: 'private', token, useCache: false, abortSignal: AbortSignal.timeout(60000) }); }
  catch { fail('Den privata mediafilen kunde inte hämtas.'); }
  if (!result) fail('Den privata mediafilen saknas.', 404);
  let file, reader;
  const temporary = `${target}.${randomUUID()}.part`;
  try {
    if (result.statusCode !== 200 || !result.stream) fail('Den privata mediafilen kunde inte hämtas.');
    privateResult(result.blob, record);
    if (result.blob.size !== record.size || result.blob.contentType !== record.contentType) fail('Den privata mediafilens metadata har ändrats.', 409);
    file = await open(temporary, 'wx');
    reader = result.stream.getReader();
    let size = 0; const hash = createHash('sha256');
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > record.size || size > MAX_BYTES) fail('Den privata mediafilens storlek har ändrats.', 409);
      hash.update(value);
      let offset = 0;
      while (offset < value.byteLength) { const { bytesWritten } = await file.write(value, offset, value.byteLength - offset); offset += bytesWritten; }
    }
    if (size !== record.size || hash.digest('hex') !== record.sha256) fail('Den privata mediafilens hash stämmer inte.', 409);
    await file.sync(); await file.close(); file = null;
    await rename(temporary, target);
    return target;
  } finally {
    if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    else await result.stream?.cancel().catch(() => {});
    if (file) await file.close().catch(() => {});
    await unlink(temporary).catch(() => {});
  }
}
async function cachedFile(record, options) {
  const key = cachePath(record, options);
  if (!pending.has(key)) pending.set(key, downloadVerified(record, options).finally(() => pending.delete(key)));
  return pending.get(key);
}

/** Upload immutable bytes, then read and hash them back before publishing metadata. */
export async function putPrivateMedia(pathname, body, options = {}) {
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
    if (created) await deletePrivateMedia(record, options).catch(() => {});
    if (error instanceof StudioError) throw error;
    fail('Videon kunde inte sparas i privat medielagring.');
  }
}

/** Only call for a newly created upload whose metadata transaction failed. */
export async function deletePrivateMedia(record, options = {}) {
  validatePrivateMedia(record);
  const token = tokenFor(options), client = await clientFor(options);
  try { await client.del(record.pathname, { token, abortSignal: AbortSignal.timeout(15000) }); }
  catch { fail('Den nya privata mediafilen kunde inte återställas.'); }
  await unlink(cachePath(record, options)).catch(() => {});
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

/** Caller must authenticate and resolve the record by an allowed logical ID first. */
export async function getPrivateMedia(record, request, options = {}) {
  if (!['GET', 'HEAD'].includes(request.method)) return errorResponse(request, 405, 'GET or HEAD only.', { Allow: 'GET, HEAD' });
  const origin = request.headers.get('origin'), site = request.headers.get('sec-fetch-site');
  const proxyAllowed = options.trustedProxyOrigin && origin === options.trustedProxyOrigin && (!site || site === 'same-origin');
  if (site === 'cross-site' || (origin && origin !== new URL(request.url).origin && !proxyAllowed)) return errorResponse(request, 403, 'Same-origin media required.');
  let handle;
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
    const path = await cachedFile(record, options), info = await lstat(path, { bigint: true });
    if (!info.isFile() || info.isSymbolicLink() || info.size !== BigInt(record.size)) fail('Den privata mediacachen är ogiltig.', 409);
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat({ bigint: true });
    if (fingerprint(opened) !== fingerprint(info)) fail('Den privata mediafilen ändrades.', 409);
    const hash = createHash('sha256');
    for await (const chunk of handle.createReadStream({ autoClose: false, start: 0 })) hash.update(chunk);
    if (hash.digest('hex') !== record.sha256 || fingerprint(await handle.stat({ bigint: true })) !== fingerprint(opened)) fail('Den privata mediafilens hash stämmer inte.', 409);
    const headers = { ...commonHeaders, 'Content-Type': record.contentType, 'Accept-Ranges': 'bytes', ETag: etag,
      'Content-Length': String(range.end - range.start + 1), ...(status === 206 ? { 'Content-Range': `bytes ${range.start}-${range.end}/${record.size}` } : {}) };
    if (request.method === 'HEAD') { await handle.close(); handle = null; return new Response(null, { status, headers }); }
    const stream = handle.createReadStream({ start: range.start, end: range.end, autoClose: true }); handle = null;
    return new Response(Readable.toWeb(stream), { status, headers });
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    const status = error instanceof StudioError ? error.statusCode : 503;
    return errorResponse(request, status, error instanceof StudioError ? error.message : 'Privat media kunde inte läsas.');
  }
}
