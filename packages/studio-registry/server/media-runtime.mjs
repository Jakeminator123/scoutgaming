import { createHash } from 'node:crypto';
import { StudioStorageError } from '../../studio-access/studio-scope.mjs';
import { readRuntimeCatalog } from './runtime-catalog.mjs';
import { createStudioProjectBindings } from '../../presentation/server/studio-project-bindings.mjs';

function metadataBytes(row, runtimeCatalog) {
  const source = runtimeCatalog.legacy?.entries?.['media/' + row.path];
  if (typeof source !== 'string' || row.size < 2 || row.size > 4 * 1024 * 1024) throw new StudioStorageError('studio_media_registry_unavailable');
  const bytes = Buffer.from(source, 'utf8');
  if (bytes.length !== row.size || createHash('sha256').update(bytes).digest('hex') !== row.sha256) throw new StudioStorageError('studio_media_registry_unavailable');
  return bytes;
}

function metadataResponse(row, bytes, request, options) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' };
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
  const origin = request.headers.get('origin');
  const site=request.headers.get('sec-fetch-site');
  const proxyAllowed=options.trustedProxyOrigin&&origin===options.trustedProxyOrigin&&(!site||site==='same-origin');
  if (site === 'cross-site' || origin && origin !== new URL(request.url).origin&&!proxyAllowed) return new Response(null, { status: 403, headers });
  const etag = `"sha256-${row.sha256}"`;
  Object.assign(headers, { ETag: etag, 'Content-Type': 'application/json', 'Accept-Ranges': 'bytes' });
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  let start = 0, end = bytes.length - 1, status = 200;
  const range = request.headers.get('range'), ifRange = request.headers.get('if-range');
  if (request.method === 'GET' && range && (!ifRange || ifRange === etag)) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const first = match?.[1] ? Number(match[1]) : null, last = match?.[2] ? Number(match[2]) : null;
    if (!match || first === null && last === null || first !== null && !Number.isSafeInteger(first) || last !== null && !Number.isSafeInteger(last) || first === null && last === 0) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${bytes.length}` } });
    start = first === null ? Math.max(0, bytes.length - last) : first;
    end = first !== null && last !== null ? Math.min(last, bytes.length - 1) : bytes.length - 1;
    if (start > end || start >= bytes.length) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${bytes.length}` } });
    status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${bytes.length}`;
  }
  headers['Content-Length'] = String(end - start + 1);
  return new Response(request.method === 'HEAD' ? null : bytes.subarray(start, end + 1), { status, headers });
}

// Apps bind their own registry, Blob and local metadata adapters.
export function createMediaRuntimeServices({ repositoryRoot: defaultRoot, createNeonVideoRegistry, legacyClipControls,
  verifiedMediaBlobStorage, getPublicMediaBlobResponse, resolvePublicMedia, createRuntimeMetadataReader,
  configurationSource: STUDIO_GAME_CONFIGURATION_SOURCE }) {
// Availability means the exact approved public asset has a verified private
// object pointer. Metadata on a deployed disk never substitutes for its bytes.
function createStudioPublicMediaAvailability({ env = process.env, repositoryRoot, repository, runtimeCatalog } = {}) {
  const options = { env: Object.freeze({ ...env }), repositoryRoot };
  return async file => {
    if (typeof file !== 'string' || !file || file.startsWith('/') || file.includes('\\')
      || file.split('/').some(part => !part || part === '.' || part === '..')) return false;
    if (options.env.CROUPIER_MEDIA_STORAGE !== 'blob' || !options.env.BLOB_READ_WRITE_TOKEN) {
      throw new StudioStorageError('studio_media_storage_unavailable');
    }
    try {
      const current = { ...options, runtimeCatalog: runtimeCatalog ?? await readRuntimeCatalog(repository) };
      const row = resolvePublicMedia(`/${file}`, current);
      return Boolean(row && verifiedMediaBlobStorage(row.logicalPath, { access: 'public', sha256: row.sha256, size: row.size }, current));
    } catch { throw new StudioStorageError('studio_media_storage_unavailable'); }
  };
}

function createStudioMediaRuntime({ repository, scope, env = process.env, repositoryRoot } = {}) {
  const options = { env: Object.freeze({ ...env }), repositoryRoot: repositoryRoot ?? defaultRoot,
    trustedProxyOrigin:env.CROUPIER_VERCEL_FRONTEND_ORIGIN };
  const videos = createNeonVideoRegistry({ repository, scope, env, options: { repositoryRoot } });
  const controls = async project => {
    const runtimeCatalog = await readRuntimeCatalog(repository);
    const mediaAvailable = createStudioPublicMediaAvailability({ ...options, runtimeCatalog });
    const result = await legacyClipControls(project, { repository: options.repositoryRoot, mediaAvailable, readMetadata: createRuntimeMetadataReader(options.repositoryRoot, { runtimeCatalog }),
      administration: async () => {
        const saved = await repository.readDocument('administration');
        if (!saved) throw new StudioStorageError('studio_document_missing');
        return saved.value;
      } });
    // This factory obtains project and administration from the scoped Neon
    // repository. Preserve the saved revision while attributing that source.
    // The ordinary legacy resolver continues to describe its disk project.
    return { ...result, runtime: { ...result.runtime, source: STUDIO_GAME_CONFIGURATION_SOURCE } };
  };
  const publicMediaResponse = async (pathname, request) => {
    // Immutable media aliases occupy these namespaces. Ordinary code, pages and
    // unrelated 404s must not fetch/validate the entire Neon media catalog.
    let path;
    try { path = decodeURIComponent(pathname); } catch { return null; }
    if (/\.(?:m?js|css|html?|woff2?|ttf|map)$/i.test(path)) return null;
    if (!/^\/(?:media|dealers|assets|bo|kevin-cards|lab|review|sfx)\//.test(path)
      && !['/scene.jpg', '/dealer-fallback.png', '/speech-media.json'].includes(path)) return null;
    const current = { ...options, runtimeCatalog: await readRuntimeCatalog(repository) };
    const row = resolvePublicMedia(pathname, current);
    if (!row) return null;
    if (row.path.endsWith('.json')) return metadataResponse(row, metadataBytes(row, current.runtimeCatalog), request,current);
    return getPublicMediaBlobResponse(pathname, request, current);
  };
  const hasPublicMedia = createStudioPublicMediaAvailability({ ...options, repository });
  const readMetadata = async file => {
    if (typeof file !== 'string' || !file.endsWith('.json') || file.startsWith('/') || /[\\:?#]/.test(file)
      || file.split('/').some(part => !part || part === '.' || part === '..')) throw new StudioStorageError('studio_media_registry_unavailable');
    const current = { ...options, runtimeCatalog: await readRuntimeCatalog(repository) };
    const row = resolvePublicMedia('/' + file, current);
    if (!row) return null;
    const bytes = metadataBytes(row, current.runtimeCatalog);
    try { return JSON.parse(bytes.toString('utf8')); } catch { throw new StudioStorageError('studio_media_registry_unavailable'); }
  };
  return Object.freeze({ videoRegistry: videos.load, videoRegistryCaptured: videos.loadCaptured, verifyCapturedMedia: videos.verifyCapturedMedia,
    videoResponse: videos.response, videoResponseCaptured: videos.responseCaptured, publicMediaResponse, hasPublicMedia, readMetadata, legacyControls: controls,
    validateProjectBindings: createStudioProjectBindings({ videoRegistry: videos.load, legacyControls: controls }) });
}

  return { createStudioMediaRuntime, createStudioPublicMediaAvailability };
}
