import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, lstat, open, readFile, realpath } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';

// Server-only: the browser receives logical IDs, never archive paths or credentials.
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const DEALERS = new Set(['astrid', 'vera', 'amira', 'mei']);
const LOCAL_ARCHIVE = 'C:/Users/jakem/CroupierAssets/bettalotto-generations';
const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;
const MAX_ENTRIES = 10_000;
const verified = new Map();

class RegistryError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function snapshotPath(options) {
  if (options.snapshotPath) return resolve(options.snapshotPath);
  // Next runs with lab/ as cwd; node tests may run with the repository as cwd.
  const root = basename(process.cwd()) === 'lab' ? dirname(process.cwd()) : process.cwd();
  return join(root, 'docs', 'animation-events', 'v3-video-map', 'snapshot.json');
}

async function readEntries(options) {
  const file = snapshotPath(options);
  const info = await lstat(file);
  if (!info.isFile() || info.size > MAX_SNAPSHOT_BYTES) throw new RegistryError(503, 'Video inventory unavailable.');
  const snapshot = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(snapshot.items) || snapshot.items.length > MAX_ENTRIES) throw new RegistryError(503, 'Video inventory unavailable.');
  const entries = new Map();
  for (const item of snapshot.items) {
    if (!item || !UUID.test(item.id) || !SHA256.test(item.sha256)
      || !Number.isSafeInteger(item.size) || item.size < 1 || entries.has(item.id)) {
      throw new RegistryError(503, 'Video inventory unavailable.');
    }
    entries.set(item.id, item);
  }
  return entries;
}

function selectArchive(options) {
  if (Object.hasOwn(options, 'archiveDir')) return { path: options.archiveDir, source: options.archiveDir ? 'explicit' : 'none' };
  if (process.env.LAB_VIDEO_ARCHIVE) return { path: process.env.LAB_VIDEO_ARCHIVE, source: 'environment' };
  return process.platform === 'win32'
    ? { path: LOCAL_ARCHIVE, source: 'local-default' }
    : { path: null, source: 'none' };
}

function samePath(a, b) {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

async function archiveLocation(selection) {
  if (!selection.path || typeof selection.path !== 'string') throw new RegistryError(503, 'Local video archive is not configured.');
  const absolute = resolve(selection.path);
  const info = await lstat(absolute);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new RegistryError(403, 'Unsafe local video archive.');
  const canonical = await realpath(absolute);
  if (!samePath(absolute, canonical)) throw new RegistryError(403, 'Archive symlinks are not allowed.');
  await access(canonical, constants.R_OK);
  return canonical;
}

function fingerprint(info) {
  return `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
}

function cacheKey(path, entry, info) {
  return `${path}:${entry.sha256}:${fingerprint(info)}`;
}

async function inspectFile(archive, entry) {
  const file = join(archive, `${entry.id}.mp4`);
  const info = await lstat(file, { bigint: true });
  if (info.isSymbolicLink() || !info.isFile()) throw new RegistryError(403, 'Unsafe local video file.');
  const canonical = await realpath(file);
  if (!samePath(file, canonical) || !samePath(dirname(canonical), archive)) throw new RegistryError(403, 'Video file must be inside the archive.');
  if (info.size !== BigInt(entry.size)) throw new RegistryError(409, 'Video differs from the inventory.');
  await access(file, constants.R_OK);
  return { file, info };
}

function text(value, max = 100) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
}

function publicEntry(entry, available, integrity) {
  const dealer = DEALERS.has(entry.placement?.dealer) ? entry.placement.dealer : undefined;
  const hint = text(entry.placement?.label, 80);
  const eventId = text(entry.placement?.node, 80);
  return {
    id: entry.id,
    label: `${dealer ? dealer[0].toUpperCase() + dealer.slice(1) : 'Okänd dealer'} · ${hint || entry.id.slice(0, 8)}`,
    ...(dealer ? { dealer } : {}),
    fileName: `${entry.id}.mp4`,
    verdict: ['want', 'no'].includes(entry.verdict) ? entry.verdict : 'unrated',
    bytes: entry.size,
    sha256: entry.sha256,
    ...(Number.isFinite(entry.duration) && entry.duration > 0 ? { duration: entry.duration } : {}),
    available,
    previewUrl: `/api/videos/${entry.id}`,
    reviewStatus: 'unreviewed',
    integrity,
    ...(eventId && /^[a-zA-Z0-9._-]+$/.test(eventId) ? { suggestedEventId: eventId } : {}),
    bindingScope: 'lab-only',
  };
}

/** Read-only inventory. Availability checks bytes/readability; preview verifies SHA-256. */
export async function loadVideoRegistry(options = {}) {
  const selection = selectArchive(options);
  const summary = {
    total: 0, available: 0, missing: 0, unavailable: 0,
    configured: Boolean(selection.path), readable: false, snapshotReadable: false,
    archiveSource: selection.source, intakeCounts: { want: 0, no: 0, unrated: 0 },
    notes: [
      'Want är ett intake-omdöme, inte ett godkännande. Alla kopplingar här är endast för labbet.',
      'Dealer och event är sorteringsförslag, inte verifierat videoinnehåll.',
      'Tillgänglig betyder läsbar fil med rätt storlek. SHA-256 kontrolleras före uppspelning.',
    ],
  };
  let entries;
  try { entries = await readEntries(options); summary.snapshotReadable = true; }
  catch { summary.notes.push('Videoregistret kunde inte läsas.'); return { videos: [], summary }; }
  let archive;
  try { archive = await archiveLocation(selection); summary.readable = true; }
  catch { summary.notes.push('Det lokala videoarkivet är inte tillgängligt. Ange LAB_VIDEO_ARCHIVE på servern.'); }
  const videos = [];
  // Sequential metadata checks avoid opening hundreds of files at once.
  for (const entry of entries.values()) {
    let available = false, integrity = 'unavailable';
    if (archive) {
      try {
        const { file, info } = await inspectFile(archive, entry);
        available = true;
        integrity = verified.has(cacheKey(file, entry, info)) ? 'verified' : 'unchecked';
      } catch (error) {
        if (error.code === 'ENOENT') summary.missing += 1;
      }
    }
    const video = publicEntry(entry, available, integrity);
    videos.push(video);
    summary.intakeCounts[video.verdict] += 1;
    if (available) summary.available += 1;
  }
  summary.total = videos.length;
  summary.unavailable = summary.total - summary.available;
  return { videos, summary };
}

const commonHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function errorResponse(request, status, message, headers = {}) {
  return new Response(request.method === 'HEAD' ? null : JSON.stringify({ error: message }), {
    status, headers: { ...commonHeaders, 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return null;
  if (first === null && last === 0) return null;
  const start = first === null ? Math.max(0, size - last) : first;
  const end = first !== null && last !== null ? Math.min(last, size - 1) : size - 1;
  return start <= end && start < size ? { start, end } : null;
}

/** Only allowlisted UUIDs resolve to media; no URLs, arbitrary paths, or symlinks. */
export async function getVideoResponse(id, request, options = {}) {
  if (!['GET', 'HEAD'].includes(request.method)) return errorResponse(request, 405, 'GET or HEAD only.', { Allow: 'GET, HEAD' });
  if (request.headers.get('sec-fetch-site') === 'cross-site'
    || (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin)) {
    return errorResponse(request, 403, 'Same-origin preview required.');
  }
  if (typeof id !== 'string' || !UUID.test(id)) return errorResponse(request, 404, 'Unknown video.');
  let handle;
  try {
    let entries;
    try { entries = await readEntries(options); }
    catch { throw new RegistryError(503, 'Video inventory unavailable.'); }
    const entry = entries.get(id);
    if (!entry) return errorResponse(request, 404, 'Unknown video.');
    const archive = await archiveLocation(selectArchive(options));
    const { file, info } = await inspectFile(archive, entry);
    // Validate and stream the same open file descriptor, not a second path lookup.
    handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const openedInfo = await handle.stat({ bigint: true });
    if (!openedInfo.isFile() || fingerprint(openedInfo) !== fingerprint(info)) throw new RegistryError(409, 'Video changed during verification.');
    const key = cacheKey(file, entry, openedInfo);
    if (!verified.has(key)) {
      const hash = createHash('sha256');
      for await (const chunk of handle.createReadStream({ autoClose: false, start: 0 })) hash.update(chunk);
      if (hash.digest('hex') !== entry.sha256 || fingerprint(await handle.stat({ bigint: true })) !== fingerprint(openedInfo)) {
        throw new RegistryError(409, 'Video hash differs from the inventory.');
      }
      if (verified.size >= 512) verified.delete(verified.keys().next().value);
      verified.set(key, true);
    }
    const etag = `"sha256-${entry.sha256}"`;
    let range = { start: 0, end: entry.size - 1 }, status = 200;
    const rangeHeader = request.method === 'GET' && request.headers.get('range');
    const ifRange = request.headers.get('if-range');
    if (rangeHeader && (!ifRange || ifRange === etag)) {
      range = parseRange(rangeHeader, entry.size);
      if (!range) {
        await handle.close(); handle = null;
        return errorResponse(request, 416, 'Invalid video byte range.', { 'Content-Range': `bytes */${entry.size}` });
      }
      status = 206;
    }
    const headers = {
      ...commonHeaders, 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', ETag: etag,
      'Content-Length': String(range.end - range.start + 1),
      ...(status === 206 ? { 'Content-Range': `bytes ${range.start}-${range.end}/${entry.size}` } : {}),
    };
    if (request.method === 'HEAD') {
      await handle.close(); handle = null;
      return new Response(null, { status, headers });
    }
    const stream = handle.createReadStream({ start: range.start, end: range.end, autoClose: true });
    handle = null; // The stream owns the descriptor; cancellation closes it too.
    return new Response(Readable.toWeb(stream), { status, headers });
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    const status = error instanceof RegistryError ? error.status : error.code === 'ENOENT' ? 404 : ['EACCES', 'EPERM', 'ELOOP'].includes(error.code) ? 403 : 503;
    const message = error instanceof RegistryError ? error.message : status === 404 ? 'Local video unavailable.' : 'Local preview unavailable.';
    return errorResponse(request, status, message);
  }
}
