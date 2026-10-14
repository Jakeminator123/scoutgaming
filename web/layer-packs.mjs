import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const previewBuildDirectory = resolve(root, 'lab/preview-build');
const runtimeRoot = resolve(root, 'packages/presentation/compositor');
const allowedRuntimeFiles = new Set(['player.js', 'compositor.js', 'bridge.js', 'geometry.js', 'lanes.js']);
const mime = new Map([
  ['.js', 'text/javascript'],
  ['.json', 'application/json'],
  ['.mp4', 'video/mp4'],
  ['.webp', 'image/webp'],
  ['.png', 'image/png'],
]);

function parseCookies(text = '') {
  const out = {};
  for (const chunk of text.split(';')) {
    const [key, value] = chunk.split('=');
    if (!key || value === undefined) continue;
    out[key.trim()] = value.trim();
  }
  return out;
}

function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match || (match[1] === '' && match[2] === '')) return { status: 'invalid' };
  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { status: 'invalid' };
    if (size === 0) return { status: 'unsatisfiable' };
    const length = Math.min(size, suffix);
    return { status: 'ok', start: size - length, end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end) return { status: 'invalid' };
  if (start >= size) return { status: 'unsatisfiable' };
  return { status: 'ok', start, end: Math.min(end, size - 1) };
}

function privateHeaders(type, extra = {}) {
  return {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...(type ? { 'Content-Type': type } : {}),
    ...extra,
  };
}

function within(base, file) {
  const rel = relative(resolve(base), resolve(file));
  return rel && rel !== '..' && !rel.startsWith(`..\\`) && !rel.startsWith(`../`);
}

function mediaPath(base, dealer, source) {
  if (typeof source !== 'string' || !source.startsWith('media/')) return source;
  return `/layer-packs/${dealer}/media/${source.slice('media/'.length)}`;
}

function manifestForDealer(catalog, dealer) {
  const lane = (catalog?.lanes || []).find(row => {
    const id = String(row?.scene?.dealer || '');
    return id === dealer || id.startsWith(`${dealer}-`) || String(row?.name || '').toLowerCase() === dealer;
  });
  if (!lane) return null;
  const dealerEntry = structuredClone(lane.dealer);
  const variantId = lane.scene?.variant || dealerEntry.active_variant;
  const variant = dealerEntry?.variants?.[variantId];
  if (!variant) return null;
  for (const clip of Object.values(variant.clips || {})) clip.src = mediaPath(previewBuildDirectory, dealer, clip.src);
  for (const poster of Object.values(variant.posters || {})) poster.src = mediaPath(previewBuildDirectory, dealer, poster.src);
  const assets = structuredClone(catalog.assets || []).map(asset => ({ ...asset, src: mediaPath(previewBuildDirectory, dealer, asset.src) }));
  return { dealer: dealerEntry, variant: variantId, scene: lane.scene, assets };
}

function serveFile(req, res, file, type) {
  const size = statSync(file).size;
  const range = parseRange(req.headers.range, size);
  if (!range) {
    res.writeHead(200, privateHeaders(type, { 'Content-Length': String(size), 'Accept-Ranges': 'bytes' }));
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file).pipe(res);
  }
  if (range.status !== 'ok') {
    res.writeHead(416, privateHeaders(type, { 'Content-Range': `bytes */${size}` }));
    return res.end();
  }
  res.writeHead(206, privateHeaders(type, {
    'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
    'Content-Length': String(range.end - range.start + 1),
    'Accept-Ranges': 'bytes',
  }));
  if (req.method === 'HEAD') return res.end();
  return createReadStream(file, { start: range.start, end: range.end }).pipe(res);
}

export function createLayerPacksRoute({ previewRoot = previewBuildDirectory } = {}) {
  const catalogFile = join(previewRoot, 'catalog.json');
  return async function layerPacksRoute(req, res, pathname) {
    if (!pathname.startsWith('/layer-packs/')) return false;
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, privateHeaders('application/json', { Allow: 'GET, HEAD' }));
      res.end('{"error":"method_not_allowed"}');
      return true;
    }
    if (parseCookies(req.headers.cookie).croupier_layer_preview !== '1') {
      res.writeHead(404, privateHeaders());
      res.end();
      return true;
    }
    const path = pathname.replace(/^\/layer-packs\//, '');
    const parts = path.split('/').filter(Boolean);
    if (!parts.length || parts.some(part => !/^[A-Za-z0-9._-]+$/.test(part))) {
      res.writeHead(404, privateHeaders());
      res.end();
      return true;
    }
    if (parts[0] === 'runtime') {
      const file = parts[1];
      if (parts.length !== 2 || !allowedRuntimeFiles.has(file)) {
        res.writeHead(404, privateHeaders());
        res.end();
        return true;
      }
      const runtimeFile = join(runtimeRoot, file);
      if (!existsSync(runtimeFile) || !within(runtimeRoot, runtimeFile)) {
        res.writeHead(503, privateHeaders('application/json'));
        res.end('{"error":"unavailable","message":"Lagerpaket saknas"}');
        return true;
      }
      serveFile(req, res, runtimeFile, mime.get(extname(runtimeFile)) || 'application/octet-stream');
      return true;
    }
    const dealer = parts[0].toLowerCase();
    // Both manifests and direct file requests require a current preview dealer.
    // A removed lane cannot keep serving files through its old URL namespace.
    if (!existsSync(catalogFile)) {
      res.writeHead(503, privateHeaders('application/json'));
      res.end('{"error":"unavailable","message":"Lagerpaket saknas"}');
      return true;
    }
    const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'));
    const manifest = manifestForDealer(catalog, dealer);
    if (!manifest) {
      res.writeHead(404, privateHeaders());
      res.end();
      return true;
    }
    if (parts.length === 2 && parts[1] === 'manifest.json') {
      const body = JSON.stringify(manifest);
      res.writeHead(200, privateHeaders('application/json', { 'Content-Length': String(Buffer.byteLength(body)) }));
      if (req.method === 'HEAD') res.end();
      else res.end(body);
      return true;
    }
    if (parts.length >= 3 && parts[1] === 'media') {
      const mediaFile = join(previewRoot, 'media', parts.slice(2).join('/'));
      if (!within(join(previewRoot, 'media'), mediaFile) || !existsSync(mediaFile)) {
        res.writeHead(404, privateHeaders());
        res.end();
        return true;
      }
      serveFile(req, res, mediaFile, mime.get(extname(mediaFile)) || 'application/octet-stream');
      return true;
    }
    res.writeHead(404, privateHeaders());
    res.end();
    return true;
  };
}
