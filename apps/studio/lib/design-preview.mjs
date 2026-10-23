import {studioRoots} from './studio-roots.mjs';
import { lstat, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseByteRange } from './preview-files.mjs';
import { designPreviewPages, designPreviewReturnTo } from './design-preview-paths.mjs';
import { adminDocumentHref } from '../../../packages/navigation/admin-workspace-routes.mjs';

const labRoot = studioRoots().appRoot;
export const designPreviewDirectory = resolve(labRoot, 'design-preview-build');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
export function designPreviewFile(segments = []) {
  if (!Array.isArray(segments) || segments.length > 8
    || segments.some(part => typeof part !== 'string' || !/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(part) || part.includes('..'))) return null;
  const path = segments.join('/');
  if (designPreviewPages.has(path)) return 'admin/index.html';
  if (path === 'lobby') return 'lobby/index.html';
  if (segments[0] !== '_assets' || !['admin', 'lobby', 'fonts'].includes(segments[1]) || segments.length < 3) return null;
  const file = segments.slice(1).join('/');
  return types[extname(file)] && extname(file) !== '.html' ? file : null;
}
// The public build contains only the lobby UI. Never expose the admin bundle,
// its catalog or arbitrary files through this independent address.
export function publicLobbyFile(segments = []) {
  if (!Array.isArray(segments)) return null;
  if (!segments.length) return 'public-lobby/index.html';
  if (segments[0] !== '_assets' || !['lobby', 'fonts'].includes(segments[1])) return null;
  const file = designPreviewFile(segments);
  return file?.startsWith('lobby/') ? 'public-lobby/' + file.slice(6) : file;
}
export const designPreviewHeaders = Object.freeze({
  'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-src 'none'; frame-ancestors 'self'; form-action 'none'; base-uri 'none'",
});
// Staff imports use the existing short-lived, path-bound private Blob grant.
const adminDocumentHeaders = Object.freeze({ ...designPreviewHeaders,
  'Content-Security-Policy': designPreviewHeaders['Content-Security-Policy']
    .replace("connect-src 'self'", "connect-src 'self' https://vercel.com/api/blob https://vercel.com/api/blob/")
    .replace("frame-src 'none'", "frame-src 'self'") });
// Only the public lobby document embeds the existing D-ID avatar. Assets and
// staff documents keep their own policies; no wildcard network access is added.
const publicLobbyDocumentHeaders = Object.freeze({ ...designPreviewHeaders,
  'Content-Security-Policy': designPreviewHeaders['Content-Security-Policy']
    .replace("connect-src 'self'", "connect-src 'self' https://api.d-id.com")
    .replace("media-src 'self' blob:", "media-src 'self' blob: https://agents-results.d-id.com") });
// Lobby teasers replay the same images and idle clips (each portrait about
// every 45 s). Only these media files may stay in the viewer's own browser.
// File names are not content-hashed: keep the lifetime short, never immutable,
// and keep `private` so shared caches never store them.
const lobbyMediaHeaders = Object.freeze({ ...designPreviewHeaders, 'Cache-Control': 'private, max-age=3600' });
const lobbyMediaFile = path => /^(?:public-)?lobby\/(?:images|videos)\/.+\.(?:png|jpe?g|webp|mp4)$/.test(path ?? '');
// Chrome fetches <video> as `Range: bytes=0-` and only stores a 206 with a
// strong validator. The ETag hashes the bytes (deploys may normalise mtimes);
// the digest is computed once per file path, size and mtime.
const mediaTags = new Map();
function mediaValidators(file, info) {
  const version = `${info.size}:${info.mtimeMs}`;
  let entry = mediaTags.get(file);
  if (entry?.version !== version) {
    const tag = (async () => {
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(file)) hash.update(chunk);
      return `"${hash.digest('base64url')}"`;
    })();
    entry = { version, tag };
    mediaTags.set(file, entry);
    tag.catch(() => { if (mediaTags.get(file)?.tag === tag) mediaTags.delete(file); });
  }
  return entry.tag.then(ETag => ({ ETag, 'Last-Modified': info.mtime.toUTCString() }));
}
const noneMatch = (header, tag) => header?.split(',').some(value => ['*', tag].includes(value.trim().replace(/^W\//, ''))) ?? false;

// Only the native Admin login redirect is translated. Absolute destinations
// must match the configured public origin; remote handoffs stay intact.
export function designPreviewAuthRedirect(destination, { publicOrigin = '', resource = false } = {}) {
  if (resource) return new Response(null, { status: 401, headers: designPreviewHeaders });
  if (typeof destination !== 'string') return null;
  const relative = destination.startsWith('/admin/login?');
  let login; try { login = new URL(destination, 'https://studio.invalid'); } catch { return null; }
  if (login.pathname !== '/admin/login' || login.username || login.password || login.hash
    || !relative && (login.protocol !== 'https:' || login.origin !== publicOrigin)) return null;
  const returnTo = designPreviewReturnTo(login.searchParams.get('returnTo')) ?? '/admin';
  return new Response(null, { status: 307, headers: { ...designPreviewHeaders,
    'Referrer-Policy': 'no-referrer',
    Location: `${relative ? '' : login.origin}/admin/login?returnTo=${encodeURIComponent(returnTo)}` } });
}

// Every document and asset goes through the same server-side staff authorization.
// Static serving accepts no mutations. Dealer import calls the native Studio APIs.
/** @param {Request} request
 * @param {string[]} segments
 * @param {{ authorize: (request: Request) => Promise<void>, root?: string }} options */
export async function serveDesignPreview(request, segments, { authorize, root = designPreviewDirectory }) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { ...designPreviewHeaders, Allow: 'GET, HEAD' } });
  if (typeof authorize !== 'function') throw new Error('design_preview_authorization_required');
  await authorize(new Request(request.url, { method: 'GET', headers: request.headers, signal: request.signal }));
  const url = new URL(request.url);
  const source = '/admin' + (segments.length ? '/' + segments.join('/') : '') + url.search + url.hash;
  const target = adminDocumentHref(source);
  if (target !== source) {
    return new Response(null, { status: 307, headers: { ...designPreviewHeaders, Location: target } });
  }
  const path = designPreviewFile(segments);
  return servePreviewFile(request, path, root, path === 'admin/index.html' ? adminDocumentHeaders
    : lobbyMediaFile(path) ? lobbyMediaHeaders : designPreviewHeaders);
}

export async function servePublicLobby(request, segments = [], { root = designPreviewDirectory } = {}) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { ...designPreviewHeaders, Allow: 'GET, HEAD' } });
  const path = publicLobbyFile(segments);
  const directory = path?.startsWith('fonts/') ? 'fonts' : 'public-lobby';
  return servePreviewFile(request, path ? path.slice(directory.length + 1) : null, resolve(root, directory), path === 'public-lobby/index.html'
    ? publicLobbyDocumentHeaders : lobbyMediaFile(path) ? lobbyMediaHeaders : designPreviewHeaders);
}

async function servePreviewFile(request, path, root, responseHeaders = designPreviewHeaders) {
  if (!path) return new Response(null, { status: 404, headers: designPreviewHeaders });
  let file, info, validators = null;
  try {
    const base = await realpath(root);
    file = await realpath(resolve(base, path));
    const distance = relative(base, file);
    if (!distance || distance === '..' || distance.startsWith('..' + sep) || isAbsolute(distance)) throw new Error('outside_preview');
    info = await lstat(file);
    if (!info.isFile()) throw new Error('not_file');
    // Only browser-cacheable lobby media carries validators.
    if (responseHeaders === lobbyMediaHeaders) validators = await mediaValidators(file, info);
  } catch { return new Response(null, { status: 404, headers: designPreviewHeaders }); }
  if (validators && noneMatch(request.headers.get('if-none-match'), validators.ETag))
    return new Response(null, { status: 304, headers: { ...responseHeaders, ...validators } });
  const headers = { ...responseHeaders, ...validators, 'Content-Type': types[extname(file)], 'Accept-Ranges': 'bytes' };
  // A stale If-Range (bytes cached before a redeploy) gets the whole new file.
  // Only the exact strong ETag matches; a date never does.
  const ifRange = request.headers.get('if-range');
  const stale = validators && ifRange !== null && ifRange.trim() !== validators.ETag;
  const range = parseByteRange(stale ? null : request.headers.get('range'), info.size);
  if (range && range.status !== 'ok') return new Response(null, { status: 416, headers: { ...headers,
    'Cache-Control': designPreviewHeaders['Cache-Control'], 'Content-Range': `bytes */${info.size}` } });
  const start = range?.start ?? 0, end = range?.end ?? info.size - 1;
  headers['Content-Length'] = String(end - start + 1);
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
  const body = request.method === 'HEAD' || info.size === 0 ? null : Readable.toWeb(createReadStream(file, { start, end }));
  return new Response(body, { status: range ? 206 : 200, headers });
}
