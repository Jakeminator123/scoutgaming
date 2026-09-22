// Shared read-only media mount for authenticated BO and the token-protected API.
// Only catalogue UUIDs (and their exact declared thumbnail suffix) are served.
import { constants, openSync, closeSync, lstatSync, fstatSync, realpathSync, createReadStream } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const FILE = new RegExp(`^(${UUID})(\\.mp4|-thumb\\.(?:jpg|jpeg|png|webp))$`);
const MIME = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const same = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

export function openGenerationMedia({ directory, catalog, fileName }) {
  const match = typeof fileName === 'string' && FILE.exec(fileName);
  if (!match || !Array.isArray(catalog)) return null;
  const entry = catalog.find(item => item?.id === match[1]);
  if (!entry) return null;
  if (match[2] !== '.mp4') {
    // Match the BO's thumbnail filename derivation exactly; never serve an
    // arbitrary image or the original remote thumbnail URL as a filesystem path.
    const suffix = typeof entry.thumb === 'string' && entry.thumb ? entry.thumb.match(/\.\w+$/)?.[0] || '.jpg' : null;
    if (!suffix || fileName !== `${entry.id}-thumb${suffix}`) return null;
  }
  let fd;
  try {
    const base = resolve(directory), rootStat = lstatSync(base);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return null;
    const canonicalRoot = realpathSync(base), file = join(base, fileName), before = lstatSync(file);
    if (!before.isFile() || before.isSymbolicLink() || !same(dirname(realpathSync(file)), canonicalRoot)) return null;
    fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const current = fstatSync(fd), after = lstatSync(file);
    if (!current.isFile() || after.isSymbolicLink() || !same(dirname(realpathSync(file)), canonicalRoot)
      || current.dev !== before.dev || current.ino !== before.ino || current.dev !== after.dev || current.ino !== after.ino) {
      closeSync(fd); return null;
    }
    return { fd, fileName: basename(fileName), size: current.size, mtimeMs: current.mtimeMs, dev: current.dev, ino: current.ino,
      contentType: MIME[extname(fileName)], id: entry.id };
  } catch { if (fd !== undefined) try { closeSync(fd); } catch {} return null; }
}

export function closeGenerationMedia(media) {
  if (media?.fd !== undefined) { closeSync(media.fd); media.fd = undefined; }
}

export function serveGenerationMedia(req, res, media, headers = {}) {
  const base = { 'Content-Type': media.contentType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff', ETag: `"${media.size}-${Math.round(media.mtimeMs)}"`, ...headers };
  if (!['GET', 'HEAD'].includes(req.method)) {
    closeGenerationMedia(media); res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
  }
  let start = 0, end = media.size - 1, status = 200;
  const raw = req.headers.range;
  if (raw) {
    const range = /^bytes=(\d*)-(\d*)$/.exec(raw);
    const first = range?.[1] ? Number(range[1]) : null, last = range?.[2] ? Number(range[2]) : null;
    if (!range || first === null && last === null || first !== null && !Number.isSafeInteger(first) || last !== null && !Number.isSafeInteger(last)
      || first === null && last === 0) {
      closeGenerationMedia(media); res.writeHead(416, { ...base, 'Content-Range': `bytes */${media.size}` }); res.end(); return;
    }
    start = first === null ? Math.max(0, media.size - last) : first;
    end = first !== null && last !== null ? Math.min(last, media.size - 1) : media.size - 1;
    if (start > end || start >= media.size) {
      closeGenerationMedia(media); res.writeHead(416, { ...base, 'Content-Range': `bytes */${media.size}` }); res.end(); return;
    }
    status = 206; base['Content-Range'] = `bytes ${start}-${end}/${media.size}`;
  }
  res.writeHead(status, { ...base, 'Content-Length': Math.max(0, end - start + 1) });
  if (req.method === 'HEAD' || media.size === 0) { closeGenerationMedia(media); res.end(); return; }
  const stream = createReadStream('', { fd: media.fd, autoClose: true, start, end });
  media.fd = undefined;
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
