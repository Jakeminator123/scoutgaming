import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, lstat, open, realpath, writeFile, rename, unlink } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { readUploads, uploadDirectory } from './video-uploads.mjs';
import { readClassifications } from './video-classifications.mjs';
import { mediaDefinitionForPath, readLabVideoManifest } from './lab-video-manifest.mjs';
import { buildLabVideoManifest, manifestJson } from '../../pipeline/build-lab-video-manifest.mjs';
import { StudioError } from './project-store.mjs';

// Server-only: the browser receives logical IDs, never archive paths or credentials.
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const DEALERS = new Set(['astrid', 'vera', 'amira', 'mei']);
const EMIL_SOURCE = ['emil', 'dealklipp-v1'];
const verified = new Map();

class RegistryError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function repositoryRoot() {
  return basename(process.cwd()) === 'lab' ? resolve(process.cwd(), '..') : process.cwd();
}

function snapshotPath(options) {
  if (options.snapshotPath) return resolve(options.snapshotPath);
  return join(repositoryRoot(), ...EMIL_SOURCE, 'lab-video-manifest.json');
}

let pendingRescan;
/** Explicit local operator action: hash new files, then publish a complete manifest atomically. */
export async function rescanVideoRegistry() {
  if (pendingRescan) return pendingRescan;
  pendingRescan = (async () => {
    const selection = selectArchive({});
    if (selection.source !== 'emil-default') throw new StudioError('Mappimport stöds bara för den lokala Astrid-banken.', 403);
    let manifest;
    try { manifest = await buildLabVideoManifest({ root: selection.path }); }
    catch { throw new StudioError('Videoimporten misslyckades. Kontrollera att nya MP4-filer ligger i en tillåten mapp och är läsbara.', 422); }
    const target = join(selection.path, 'lab-video-manifest.json');
    const temporary = join(selection.path, `.lab-video-manifest-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, manifestJson(manifest), { flag: 'wx' });
      await rename(temporary, target);
    } finally { await unlink(temporary).catch(() => {}); }
    return loadVideoRegistry();
  })();
  try { return await pendingRescan; }
  finally { pendingRescan = null; }
}

function safeRelativeMediaPath(value, extension) {
  if (typeof value !== 'string' || value.length > 240 || value.includes('\\') || isAbsolute(value)) return false;
  const parts = value.split('/');
  return parts.every(part => part && part !== '.' && part !== '..')
    && value.toLowerCase().endsWith(`.${extension}`);
}

async function readEntries(options) {
  try {
    const snapshot = await readLabVideoManifest(snapshotPath(options));
    return { entries: new Map(snapshot.items.map(item => [item.id, item])), families: snapshot.families };
  } catch { throw new RegistryError(503, 'Video inventory unavailable.'); }
}

function selectArchive(options) {
  if (Object.hasOwn(options, 'archiveDir')) return { path: options.archiveDir, source: options.archiveDir ? 'explicit' : 'none' };
  if (process.env.LAB_VIDEO_ARCHIVE) return { path: process.env.LAB_VIDEO_ARCHIVE, source: 'environment' };
  return { path: join(repositoryRoot(), ...EMIL_SOURCE), source: 'emil-default' };
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
  const relativeFile = entry.relativePath ?? `${entry.id}.${entry.extension ?? 'mp4'}`;
  if (entry.familyId) {
    const placement = mediaDefinitionForPath(relativeFile);
    if (!placement || placement.definition.id !== entry.familyId || placement.role !== entry.role) throw new RegistryError(403, 'Unsafe local video file.');
  } else if (!safeRelativeMediaPath(relativeFile, entry.extension ?? 'mp4')) throw new RegistryError(403, 'Unsafe local video file.');
  const file = join(archive, ...relativeFile.split('/'));
  const info = await lstat(file, { bigint: true });
  if (info.isSymbolicLink() || !info.isFile()) throw new RegistryError(403, 'Unsafe local video file.');
  const canonical = await realpath(file);
  const distance = relative(archive, canonical);
  if (!samePath(file, canonical) || !distance || distance.startsWith('..') || isAbsolute(distance)) throw new RegistryError(403, 'Video file must be inside the archive.');
  if (info.size !== BigInt(entry.size)) throw new RegistryError(409, 'Video differs from the inventory.');
  await access(file, constants.R_OK);
  return { file, info };
}

function text(value, max = 100) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
}

function publicEntry(entry, available, integrity, family) {
  if (entry.classification) return {
    id: entry.id, label: entry.classification.label, dealer: entry.classification.dealerId,
    fileName: `${entry.id}.${entry.extension}`, verdict: 'unrated', bytes: entry.size,
    sha256: entry.sha256, available, previewUrl: `/api/videos/${entry.id}`,
    reviewStatus: 'unreviewed', integrity, suggestedEventId: entry.classification.eventId,
    bindingScope: 'lab-only', source: 'upload', classification: entry.classification, addedAt: entry.addedAt,
  };
  if (family) return {
    id: entry.id,
    label: `Astrid · ${family.situation} · ${entry.role === 'standard' ? 'standard' : 'variant'}`,
    dealer: family.dealerId,
    fileName: basename(entry.relativePath),
    verdict: 'unrated',
    bytes: entry.size,
    sha256: entry.sha256,
    available,
    previewUrl: `/api/videos/${entry.id}`,
    reviewStatus: 'unreviewed',
    integrity,
    bindingScope: 'shared-local',
    source: 'emil',
    familyId: family.id,
    role: entry.role,
    eventId: family.eventId,
    situation: family.situation,
    playbackType: family.playbackType,
  };
  const dealerHint = text(entry.placement?.dealer, 40).toLowerCase();
  const dealer = DEALERS.has(dealerHint) ? dealerHint : undefined;
  const hint = text(entry.placement?.label, 80);
  const eventId = text(entry.placement?.node, 80);
  return {
    id: entry.id,
    label: `${dealer ? dealer[0].toUpperCase() + dealer.slice(1) : 'Okänd dealer'} · ${hint || entry.id.slice(0, 8)}`,
    ...(dealer ? { dealer } : {}),
    fileName: entry.relativePath ? basename(entry.relativePath) : `${entry.id}.mp4`,
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
    source: entry.source === 'emil' ? 'emil' : 'archive',
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
      'Want är ett intake-omdöme, inte ett godkännande. Emils exakta familjer delas med Webs lokala presentationsläge.',
      'Manifestets familj väljer exakt destination eller replik. Kopplingen är inte visuell acceptans.',
      'Tillgänglig betyder läsbar fil med rätt storlek. SHA-256 kontrolleras före uppspelning.',
      'Standard och varianter kommer från Emils mappar. Variantpolicy sparas i labbprojektet.',
    ],
  };
  let entries, families = [];
  try { ({ entries, families } = await readEntries(options)); summary.snapshotReadable = true; }
  catch { summary.notes.push('Originalregistret kunde inte läsas.'); entries = new Map(); }
  let uploads = [];
  try { uploads = await readUploads(options); }
  catch { summary.notes.push('Uppladdningsregistret kunde inte läsas; befintliga filer är bevarade.'); }
  for (const entry of uploads) {
    if (entries.has(entry.id)) throw new RegistryError(503, 'Duplicate video identity.');
    entries.set(entry.id, entry);
  }
  let archive;
  try { archive = await archiveLocation(selection); summary.readable = true; }
  catch { summary.notes.push('Emils videomapp är inte tillgänglig. LAB_VIDEO_ARCHIVE kan ange en alternativ rot med samma manifeststruktur.'); }
  const videos = [];
  let classifications = [];
  try { classifications = await readClassifications(options); }
  catch { summary.notes.push('Kategorisering kunde inte läsas. Inga nya klassificeringar används.'); }
  const classified = new Map(classifications.map(item => [item.id, item]));
  const familyById = new Map(families.map(family => [family.id, family]));
  // Sequential metadata checks avoid opening hundreds of files at once.
  for (const entry of entries.values()) {
    let available = false, integrity = 'unavailable';
    const location = entry.classification ? uploadDirectory(options) : archive;
    if (location) {
      try {
        const { file, info } = await inspectFile(location, entry);
        available = true;
        integrity = verified.has(cacheKey(file, entry, info)) ? 'verified' : 'unchecked';
      } catch (error) {
        if (error.code === 'ENOENT') summary.missing += 1;
      }
    }
    const video = publicEntry(entry, available, integrity, familyById.get(entry.familyId));
    const recorded = classified.get(video.id);
    if (!video.familyId && recorded && recorded.sha256 === video.sha256) {
      video.classification = recorded.metadata;
      video.label = recorded.metadata.label;
      video.dealer = recorded.metadata.dealerId;
      video.suggestedEventId = recorded.metadata.eventId;
    }
    videos.push(video);
    summary.intakeCounts[video.verdict] += 1;
    if (available) summary.available += 1;
  }
  summary.total = videos.length;
  summary.unavailable = summary.total - summary.available;
  return { videos, families, summary };
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
    let entry, uploaded, snapshotFailed = false;
    try { entry = (await readEntries(options)).entries.get(id); }
    catch { snapshotFailed = true; }
    if (!entry) {
      uploaded = (await readUploads(options)).find(v => v.id === id);
      entry = uploaded;
    }
    if (!entry && snapshotFailed) throw new RegistryError(503, 'Video inventory unavailable.');
    if (!entry) return errorResponse(request, 404, 'Unknown video.');
    const archive = await archiveLocation(uploaded ? { path: uploadDirectory(options) } : selectArchive(options));
    const { file, info } = await inspectFile(archive, entry);
    // Validate and stream the same open file descriptor, not a second path lookup.
    handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const openedInfo = await handle.stat({ bigint: true });
    if (!openedInfo.isFile() || fingerprint(openedInfo) !== fingerprint(info)) throw new RegistryError(409, 'Video changed during verification.');
    const key = cacheKey(file, entry, openedInfo);
    // Windows timestamp precision can miss a rapid same-size rewrite. Hash every
    // requested preview so cached metadata can never authorize changed bytes.
    const hash = createHash('sha256');
    for await (const chunk of handle.createReadStream({ autoClose: false, start: 0 })) hash.update(chunk);
    if (hash.digest('hex') !== entry.sha256 || fingerprint(await handle.stat({ bigint: true })) !== fingerprint(openedInfo)) {
      for (const cached of verified.keys()) if (cached.startsWith(`${file}:`)) verified.delete(cached);
      throw new RegistryError(409, 'Video hash differs from the inventory.');
    }
    if (verified.size >= 512) verified.delete(verified.keys().next().value);
    verified.set(key, true);
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
      ...commonHeaders, 'Content-Type': entry.extension === 'webm' ? 'video/webm' : 'video/mp4', 'Accept-Ranges': 'bytes', ETag: etag,
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
