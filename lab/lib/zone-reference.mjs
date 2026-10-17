import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { readMediaLayout, resolveMediaPath, validateMediaLayout } from '../../tools/media-layout.mjs';
import {readRuntimeCatalog} from '../../packages/studio-registry/server/runtime-catalog.mjs';
import { getIndexedMediaBlobResponse, isMediaBlobIndexConfigured } from './media-blob-index.mjs';
import { assertLocalRequest, errorResponse } from './http-guard.mjs';
import { StudioError } from './project-store.mjs';

export const ZONE_REFERENCE_PATH = 'dealers/astrid/runtime/presentation/astrid_startbild_spel_1080x1920.png';
const root = basename(process.cwd()) === 'lab' ? resolve(process.cwd(), '..') : process.cwd();
const headers = { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300',
  'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' };
const unavailable = () => { throw new StudioError('Zonernas referensbild är inte tillgänglig.', 503); };

export async function zoneReferenceResponse(request, options = {}) {
  try {
    // The cloud gateway validates the live administrator before granting this
    // boundary. Check it before reading metadata, local bytes or private Blob.
    assertLocalRequest(request);
    const repositoryRoot = options.repositoryRoot ?? root;
    const env = options.env ?? process.env;
    const blobRequired = isMediaBlobIndexConfigured(options) || env.CROUPIER_MEDIA_STORAGE === 'blob'
      || env.NODE_ENV === 'production' || Boolean(env.LAB_PUBLIC_URL || env.CROUPIER_LAB_INTERNAL_SECRET);
    let runtimeCatalog, layout;
    if (blobRequired) {
      try {
        runtimeCatalog = options.runtimeCatalog ?? await readRuntimeCatalog(options.repository);
        layout = validateMediaLayout(runtimeCatalog.layout);
      } catch { unavailable(); }
    } else layout = readMediaLayout(repositoryRoot);
    const entry = layout.files.find(row => row.path === ZONE_REFERENCE_PATH);
    if (!entry || entry.access !== 'source') unavailable();
    if (blobRequired) {
      // The exact registered source is private, with no public asset alias.
      // Missing/mismatched Blob authority never falls back to a local PNG.
      const response = await getIndexedMediaBlobResponse(ZONE_REFERENCE_PATH,
        { access: 'source', sha256: entry.sha256, size: entry.size, contentType: 'image/png' }, request,
        { ...options, runtimeCatalog, repositoryRoot, trustedProxyOrigin: process.env.LAB_PUBLIC_URL });
      if (!response) throw new StudioError('Zonernas referensbild är inte tillgänglig.', 503);
      if (response.status === 503) response.headers.set('Cache-Control', 'no-store');
      if (response.ok || response.status === 304) response.headers.set('Cache-Control', headers['Cache-Control']);
      return response;
    }
    const image = await readFile(resolveMediaPath(`media/${ZONE_REFERENCE_PATH}`, { repositoryRoot }));
    if (image.length !== entry.size || createHash('sha256').update(image).digest('hex') !== entry.sha256) unavailable();
    return new Response(request.method === 'HEAD' ? null : image,
      { headers: { ...headers, 'Content-Length': String(image.length) } });
  } catch (error) { return errorResponse(error); }
}
