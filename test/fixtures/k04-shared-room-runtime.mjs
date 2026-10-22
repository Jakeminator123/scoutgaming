// Explicit isolated QA adapter. No DDL, seeds, media imports or approval writes.
import { constants } from 'node:fs';
import { lstat, realpath, open } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, parse } from 'node:path';
import { createHash } from 'node:crypto';
import { createStudioRepository } from '../../packages/studio-registry/server/document-repository.mjs';
import * as documentContract from '../../packages/studio-registry/server/document-contract.mjs';
import { canonicalStudioJson, validateStudioScope, validateRevision, validateStudioMedia } from '../../packages/studio-registry/server/storage-contract.mjs';
import { validatePrivateMedia } from '../../packages/studio-registry/server/private-media-contract.mjs';
import { validateRuntimeCatalogRecord } from '../../packages/studio-registry/server/runtime-catalog.mjs';
import { createVideoRegistry } from '../../packages/studio-registry/server/registry-core.mjs';
import { createNeonVideoRegistry } from '../../packages/studio-registry/server/registry-reader.mjs';
import { createMediaBlobIndex } from '../../packages/studio-registry/server/media-blob-index.mjs';
import { createMediaLayout } from '../../packages/studio-registry/server/media-layout.mjs';
import { createMediaRuntimeServices } from '../../packages/studio-registry/server/media-runtime.mjs';
import { createSavedGamePolicy, STUDIO_GAME_CONFIGURATION_SOURCE } from '../../packages/presentation/server/saved-game-policy.mjs';
import { createRegisteredDealerIdle } from '../../packages/presentation/server/registered-dealer-idle.mjs';
import { createRuntimeMetadataReader } from '../../tools/runtime-media-catalog.mjs';
import { legacyClipControls } from '../../services/game/storage/legacy-clip-inventory.mjs';

const MANIFEST = 'k04-qa-media.json';
const MANIFEST_LIMIT = 4 * 1024 * 1024;
// Bound verification memory to the existing browser verified-video-buffer budget.
const FILE_LIMIT = 96 * 1024 * 1024;
const fail = () => { throw new Error('k04_qa_media_invalid'); };
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const safePath = value => typeof value === 'string' && value.length > 0 && value.length <= 1000
  && !/[\\%:?#\u0000-\u0020\u007f]/.test(value) && !isAbsolute(value)
  && value.split('/').every(part => part && part !== '.' && part !== '..' && !/[. ]$/.test(part));
const tupleKey = value => canonicalStudioJson(validatePrivateMedia(value));
const storageOf = row => validatePrivateMedia({ provider: 'vercel-blob', pathname: row.pathname,
  sha256: row.sha256, size: row.size, contentType: row.contentType });
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' };
const response = status => new Response(null, { status, headers });

function testScope(value) {
  const scope = validateStudioScope(value);
  if (scope.environment !== 'test' || !/^shared-qa-[a-z0-9_-]{1,70}$/.test(scope.workspaceId)) fail();
  return Object.freeze(scope);
}
function testOrigin(value) {
  let url;
  try { url = new URL(value); } catch { fail(); }
  if (url.origin !== value || url.protocol !== 'http:' || url.hostname !== '127.0.0.1'
    || !/^\d+$/.test(url.port) || Number(url.port) < 1024 || Number(url.port) > 65535 || url.username || url.password) fail();
  return url.origin;
}
function originAllowed(request, origin) {
  try {
    const url = new URL(request.url), host = request.headers.get('host');
    return url.origin === origin && (!host || host === url.host)
      && (!request.headers.get('origin') || request.headers.get('origin') === origin)
      && !['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site'));
  } catch { return false; }
}
async function assertDirectory(root) {
  const start = parse(root).root;
  let current = start;
  for (const part of relative(start, root).split(/[\\/]/).filter(Boolean)) {
    current = join(current, part);
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink() || !samePath(await realpath(current), current)) fail();
  }
}
// Verify and buffer from one opened descriptor. No unverified streaming window,
// cached path trust, symlink traversal, or fallback to another local registry.
async function readVerified(root, path, expected, signal) {
  signal?.throwIfAborted();
  if (!safePath(path)) fail();
  await assertDirectory(root);
  let parent = root;
  const parts = path.split('/');
  for (const part of parts.slice(0, -1)) {
    parent = join(parent, part);
    const info = await lstat(parent);
    if (!info.isDirectory() || info.isSymbolicLink() || !samePath(await realpath(parent), parent)) fail();
  }
  const file = join(root, ...parts), before = await lstat(file);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1
    || !samePath(await realpath(file), file) || before.size < 1 || before.size > expected.limit
    || expected.size !== undefined && before.size !== expected.size) fail();
  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat(), pathInfo = await lstat(file);
    const sameFile = info => info.isFile() && info.dev === before.dev && info.ino === before.ino
      && info.size === before.size && info.mtimeMs === before.mtimeMs && info.ctimeMs === before.ctimeMs && info.nlink === 1;
    if (!sameFile(opened) || !sameFile(pathInfo) || pathInfo.isSymbolicLink()) fail();
    const bytes = Buffer.alloc(opened.size);
    let position = 0;
    while (position < bytes.length) {
      signal?.throwIfAborted();
      const { bytesRead } = await handle.read(bytes, position, Math.min(256 * 1024, bytes.length - position), position);
      if (!bytesRead) fail();
      position += bytesRead;
    }
    signal?.throwIfAborted();
    if (!sameFile(await handle.stat()) || !sameFile(await lstat(file))) fail();
    if (expected.sha256 && createHash('sha256').update(bytes).digest('hex') !== expected.sha256) fail();
    return bytes;
  } finally { await handle.close(); }
}
function mediaResponse(bytes, storage, request) {
  const etag = `"sha256-${storage.sha256}"`;
  const resultHeaders = { ...headers, ETag: etag, 'Content-Type': storage.contentType, 'Accept-Ranges': 'bytes' };
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: resultHeaders });
  let start = 0, end = bytes.length - 1, status = 200;
  const range = request.headers.get('range'), ifRange = request.headers.get('if-range');
  if (request.method === 'GET' && range && (!ifRange || ifRange === etag)) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const first = match?.[1] ? Number(match[1]) : null, last = match?.[2] ? Number(match[2]) : null;
    if (!match || first === null && last === null || first !== null && !Number.isSafeInteger(first)
      || last !== null && !Number.isSafeInteger(last) || first === null && last === 0) status = 416;
    else {
      start = first === null ? Math.max(0, bytes.length - last) : first;
      end = first !== null && last !== null ? Math.min(last, bytes.length - 1) : bytes.length - 1;
      status = start > end || start >= bytes.length ? 416 : 206;
    }
    if (status === 416) return new Response(null, { status, headers: { ...resultHeaders, 'Content-Range': `bytes */${bytes.length}` } });
    resultHeaders['Content-Range'] = `bytes ${start}-${end}/${bytes.length}`;
  }
  resultHeaders['Content-Length'] = String(end - start + 1);
  return new Response(request.method === 'HEAD' ? null : bytes.subarray(start, end + 1), { status, headers: resultHeaders });
}

async function localMedia({ repository, scope, origin, mediaRoot }) {
  if (typeof mediaRoot !== 'string' || !isAbsolute(mediaRoot) || !samePath(resolve(mediaRoot), mediaRoot)) fail();
  const root = resolve(mediaRoot);
  const manifestBytes = await readVerified(root, MANIFEST, { limit: MANIFEST_LIMIT });
  let manifest;
  try { manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)); } catch { fail(); }
  if (!exact(manifest, ['schemaVersion', 'scope', 'origin', 'files']) || manifest.schemaVersion !== 1
    || canonicalStudioJson(testScope(manifest.scope)) !== canonicalStudioJson(scope) || manifest.origin !== origin
    || !Array.isArray(manifest.files) || manifest.files.length < 1 || manifest.files.length > 25000) fail();
  const identities = await repository.transaction(async repo => {
    const catalog = validateRuntimeCatalogRecord(await repo.readRuntimeCatalog());
    const rows = await repo.listMedia({ limit: 5000 });
    const media = new Map(rows.map(row => {
      const { revision, updatedAt, ...value } = row;
      validateRevision(revision); validateStudioMedia(value);
      return [row.id, { revision, storage: storageOf(row), deleted: Boolean(row.deletion) }];
    }));
    return { catalog, media };
  }, { readOnly: true });
  const bank = new Map(identities.catalog.value.blobIndex.files.map(row => [row.logicalPath, row]));
  const entries = new Map(), sources = new Set();
  for (const row of manifest.files) {
    if (!exact(row, ['source', 'storage', 'relativePath']) || !safePath(row.relativePath) || row.relativePath === MANIFEST) fail();
    const storage = structuredClone(validatePrivateMedia(row.storage)), key = tupleKey(storage);
    if (storage.size > FILE_LIMIT || entries.has(key)) fail();
    const source = row.source;
    let saved, sourceKey;
    if (exact(source, ['kind', 'id', 'revision']) && source.kind === 'media') {
      saved = identities.media.get(source.id);
      if (!saved || saved.deleted || saved.revision !== source.revision) fail();
      sourceKey = 'media:' + source.id;
    } else if (exact(source, ['kind', 'logicalPath', 'revision']) && source.kind === 'catalog') {
      const entry = bank.get(source.logicalPath);
      if (!entry || source.revision !== identities.catalog.revision) fail();
      saved = { storage: entry.storage };
      sourceKey = 'catalog:' + source.logicalPath;
    } else fail();
    if (sources.has(sourceKey) || tupleKey(saved.storage) !== key) fail();
    sources.add(sourceKey);
    await readVerified(root, row.relativePath, { ...storage, limit: FILE_LIMIT });
    entries.set(key, Object.freeze({ relativePath: row.relativePath, storage: Object.freeze(storage) }));
  }
  const has = storage => { try { return entries.has(tupleKey(storage)); } catch { return false; } };
  async function read(storage, request, internal = false) {
    request.signal?.throwIfAborted();
    if (!internal && !originAllowed(request, origin)) return response(403);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
    try {
      const entry = entries.get(tupleKey(storage));
      if (!entry) return response(503);
      const bytes = await readVerified(root, entry.relativePath, { ...entry.storage, limit: FILE_LIMIT }, request.signal);
      request.signal?.throwIfAborted();
      return mediaResponse(bytes, entry.storage, request);
    } catch (error) {
      request.signal?.throwIfAborted();
      if (error?.name === 'AbortError') throw error;
      return response(503);
    }
  }
  const privateMedia = (storage, request) => read(storage, request);
  // Only registry-reader's internally constructed HEAD can bypass HTTP origin.
  // This function is never returned by createQaFixture or used as a route port.
  const capturedReader = (storage, request) => request.method === 'HEAD'
    && request.url === 'https://studio.invalid/api/captured-media'
    ? read(storage, request, true) : privateMedia(storage, request);
  return { root, has, privateMedia, capturedReader,
    isMediaConfigured: (_env, storage) => storage === undefined || has(storage) };
}

/**
 * Read-only fixture for the already identity-checked loopback QA launcher.
 * mediaRoot must contain k04-qa-media.json (UTF-8, <=4 MiB):
 * {schemaVersion:1,scope:{environment:'test',workspaceId:'shared-qa-<id>'},
 *  origin:'http://127.0.0.1:<port>',files:[{relativePath:'takes/exact.mp4',
 *  storage:{provider:'vercel-blob',pathname,sha256,size,contentType},source:
 *  {kind:'media',id,revision} OR {kind:'catalog',logicalPath,revision}}]}.
 * Each tuple/revision must already exist in scoped SQL media/runtime_catalog.
 * Files <=96 MiB (browser byte budget) are verified at startup and each read.
 * Unmapped identities remain unavailable. No classification, timing, dealer,
 * room, package, speech approval or registry data is supplied by this manifest.
 * Required product+Studio schema, project/administration and identities are
 * prepared externally; this factory never creates or seeds any database object.
 */
export async function createQaFixture({ pool, scope, origin, mediaRoot } = {}) {
  scope = testScope(scope); origin = testOrigin(origin);
  const repository = createStudioRepository({ pool, scope });
  const local = await localMedia({ repository, scope, origin, mediaRoot });
  const env = Object.freeze({}); // No token, env bypass or cloud credential.
  const layout = createMediaLayout({ repositoryRoot: local.root });
  const blobs = createMediaBlobIndex({ repositoryRoot: local.root, getPrivateMedia: local.privateMedia });
  const verifiedMediaBlobStorage = (logicalPath, expected, options) => {
    const storage = blobs.verifiedMediaBlobStorage(logicalPath, expected, options);
    if (!local.has(storage)) fail();
    return storage;
  };
  const reader = createVideoRegistry({ repositoryRoot: local.root, previewUrl: id => '/api/presentation/videos/' + id,
    uploadDirectory: () => null, readUploads: async () => { fail(); }, readClassifications: async () => [],
    getPrivateMedia: local.privateMedia, mediaBlobIndex: blobs, isMediaConfigured: local.isMediaConfigured });
  const registryFactory = options => createNeonVideoRegistry({ ...options, reader,
    getPrivateMedia: local.capturedReader, isMediaConfigured: local.isMediaConfigured });
  const { createStudioMediaRuntime } = createMediaRuntimeServices({ repositoryRoot: local.root,
    createNeonVideoRegistry: registryFactory, legacyClipControls, verifiedMediaBlobStorage,
    getPublicMediaBlobResponse: blobs.getPublicMediaBlobResponse, resolvePublicMedia: layout.resolvePublicMedia,
    createRuntimeMetadataReader, configurationSource: STUDIO_GAME_CONFIGURATION_SOURCE,
    isMediaConfigured: local.isMediaConfigured });
  const media = createStudioMediaRuntime({ repository, scope, env, repositoryRoot: local.root });
  const guard = callback => async (...args) => {
    const request = args[1];
    request.signal?.throwIfAborted();
    if (!originAllowed(request, origin)) return response(403);
    const result = await callback(...args);
    request.signal?.throwIfAborted();
    return result;
  };
  const studioMediaRuntime = Object.freeze({ ...media, videoResponse: guard(media.videoResponse),
    videoResponseCaptured: guard(media.videoResponseCaptured), publicMediaResponse: guard(media.publicMediaResponse) });
  const { createStudioGamePolicy } = createSavedGamePolicy({ documentContract });
  const policy = createStudioGamePolicy({ repository, scope,
    dealerIdle: createRegisteredDealerIdle({ registryLoader: media.videoRegistry }) });
  await policy.readSaved();
  return Object.freeze({ studioPolicyRuntime: Object.freeze({ repository, scope, policy }), studioMediaRuntime,
    privateMedia: local.privateMedia });
}