import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {access,lstat,open,realpath} from 'node:fs/promises';
import {basename,isAbsolute,join,relative,resolve} from 'node:path';
import {Readable} from 'node:stream';
import {MEDIA_FILE_TYPES} from '../../shared/media-file-types.mjs';
import {mediaDefinitionForPath,readLabVideoManifest,validateLabVideoManifest} from './video-manifest.mjs';
import {isEmptyRuntimeMediaCatalog,createEmptyRuntimeMediaCatalog} from './runtime-catalog.mjs';
import {isCloudMediaConfigured,mediaBlobPath} from './private-media-contract.mjs';
import {validateStudioMedia} from './storage-contract.mjs';
import {createMediaLayout} from './media-layout.mjs';
export function exactHttpsOrigin(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value && /^[a-z0-9.-]+$/i.test(url.hostname)
      && !url.username && !url.password;
  } catch { return false; }
}
const verified = new Map();

export function createVideoRegistry({repositoryRoot:defaultRepositoryRoot,previewUrl,uploadDirectory,readUploads,readClassifications,getPrivateMedia,mediaBlobIndex,isMediaConfigured=isCloudMediaConfigured}) {
  if(typeof isMediaConfigured!=='function')throw new TypeError('Explicit synchronous media configuration predicate required.');
  if(typeof defaultRepositoryRoot!=='string'||!isAbsolute(defaultRepositoryRoot)||![previewUrl,uploadDirectory,readUploads,readClassifications,getPrivateMedia].every(value=>typeof value==='function'))throw new TypeError('Explicit registry readers, root and URL formatter required.');
  const {normalizePresentationArchive,presentationBankRoot}=createMediaLayout({repositoryRoot:defaultRepositoryRoot});
  const {isMediaBlobIndexConfigured,verifiedMediaBlobStorage,getIndexedMediaBlobResponse,readMediaBlobIndex}=mediaBlobIndex;


  // Server-only: the browser receives logical IDs, never archive paths or credentials.
  const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  const DEALERS = new Set(['astrid', 'vera', 'amira', 'mei']);


  class RegistryError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }

  function snapshotPath(options) {
    if (options.snapshotPath) return resolve(options.snapshotPath);
    const selection = selectArchive(options);
    if (!selection.path || !isAbsolute(selection.path)) throw new RegistryError(403, 'Absolute video archive required.');
    return join(selection.path, 'lab-video-manifest.json');
  }

  function safeRelativeMediaPath(value, extension) {
    if (typeof value !== 'string' || value.length > 240 || value.includes('\\') || isAbsolute(value)) return false;
    const parts = value.split('/');
    return parts.every(part => part && part !== '.' && part !== '..')
      && value.toLowerCase().endsWith(`.${extension}`);
  }

  async function readEntries(options) {
    try {
      const snapshot = Object.hasOwn(options,'runtimeCatalog')
        ? isEmptyRuntimeMediaCatalog(options.runtimeCatalog) ? createEmptyRuntimeMediaCatalog().presentation
          : validateLabVideoManifest(options.runtimeCatalog?.presentation)
        : await readLabVideoManifest(snapshotPath(options));
      return { entries: new Map(snapshot.items.map(item => [item.id, item])), families: snapshot.families };
    } catch { throw new RegistryError(503, 'Video inventory unavailable.'); }
  }

  function selectArchive(options) {
    if (Object.hasOwn(options, 'archiveDir')) return { path: normalizePresentationArchive(options.archiveDir,options.repositoryRoot??defaultRepositoryRoot), source: options.archiveDir ? 'explicit' : 'none' };
    // Legacy folder variables no longer auto-register local dealer banks.
    return isMediaBlobIndexConfigured(options)
      ? { path: presentationBankRoot(options.repositoryRoot ?? defaultRepositoryRoot), source: 'blob-bank' }
      : { path: null, source: 'none' };
  }

  function samePath(a, b) {
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  }

  function bankBlobIdentity(selection,entry,options){
    const root=options.repositoryRoot??defaultRepositoryRoot;
    if(!selection.path||!isAbsolute(selection.path)||!samePath(resolve(selection.path),presentationBankRoot(root)))throw new RegistryError(503,'The active Blob bank requires the canonical video archive.');
    const placement=mediaDefinitionForPath(entry.relativePath);
    if(!placement||placement.definition.id!==entry.familyId||placement.role!==entry.role)throw new RegistryError(503,'Video does not match its registered family.');
    const logicalPath=`dealers/astrid/runtime/presentation/${entry.relativePath}`;
    return {logicalPath,expected:{access:'source',id:entry.id,sha256:entry.sha256,size:entry.size,contentType:'video/mp4',
      pathname:mediaBlobPath(logicalPath.slice(0,logicalPath.lastIndexOf('/')),entry.id,entry.sha256,'mp4')}};
  }

  async function archiveLocation(selection) {
    if (!selection.path || typeof selection.path !== 'string') throw new RegistryError(503, 'Local video archive is not configured.');
    if (!isAbsolute(selection.path)) throw new RegistryError(403, 'Absolute video archive required.');
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
    const contentType=entry.storage?.contentType??Object.entries(MEDIA_FILE_TYPES).find(([,extension])=>extension===entry.extension)?.[0];
    if (entry.classification) return {
      id: entry.id, label: entry.classification.label, dealer: entry.classification.dealerId,
      fileName: entry.retainedBank ? basename(entry.retainedBank.originalRelativePath) : `${entry.id}.${entry.extension}`, verdict: 'unrated', bytes: entry.size,
      sha256: entry.sha256, available, contentType, previewUrl: previewUrl(entry.id),
      reviewStatus: 'unreviewed', integrity, suggestedEventId: entry.classification.eventId,
      bindingScope: 'lab-only', source: entry.retainedBank ? 'emil' : 'upload', classification: entry.classification, addedAt: entry.addedAt,
      ...(entry.retainedBank ? {retainedBank:true} : {}),
      ...(entry.revision ? {revision:entry.revision} : {}),
      ...(entry.deletion ? {deletion:entry.deletion,available:false,integrity:'unavailable',previewUrl:null} : {}),
      storage: entry.storage ? 'private-blob' : 'disk',
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
      previewUrl: previewUrl(entry.id),
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
      previewUrl: previewUrl(entry.id),
      reviewStatus: 'unreviewed',
      integrity,
      ...(eventId && /^[a-zA-Z0-9._-]+$/.test(eventId) ? { suggestedEventId: eventId } : {}),
      bindingScope: 'lab-only',
      source: entry.source === 'emil' ? 'emil' : 'archive',
    };
  }

  /** Read-only inventory. Availability checks bytes/readability; preview verifies SHA-256. */
  async function validateRetainedEntry(entry) {
    if (!Object.hasOwn(entry,'retainedBank')) return;
    try {
      // Conditional import preserves legacy fixture dependencies when no retained
      // Neon record is in use. Both list and byte readers enforce the same tuple.
      validateStudioMedia({id:entry.id,sha256:entry.sha256,size:entry.size,contentType:`video/${entry.extension}`,
        pathname:entry.storage?.pathname,classification:entry.classification,retainedBank:entry.retainedBank});
      if (entry.storage?.provider !== 'vercel-blob' || entry.storage.sha256 !== entry.sha256
        || entry.storage.size !== entry.size || entry.storage.contentType !== `video/${entry.extension}`) throw Error('mismatch');
    } catch {throw new RegistryError(503,'Retained original media identity is unavailable.');}
  }

  async function loadVideoRegistry(options = {}) {
    const selection = selectArchive(options);
    const summary = {
      total: 0, available: 0, missing: 0, unavailable: 0,
      configured: Boolean(selection.path), readable: false, snapshotReadable: false,
      archiveSource: selection.source, intakeCounts: { want: 0, no: 0, unrated: 0 },
      notes: isEmptyRuntimeMediaCatalog(options.runtimeCatalog) ? [
        'Tom basbank. Uppladdade klipp läses från det sparade registret och privat Blob.',
        'Registrering är inte visuell acceptans; exakta bytes verifieras före uppspelning.',
      ] : [
        'Want är ett intake-omdöme, inte ett godkännande. Emils exakta familjer delas med Webs lokala presentationsläge.',
        'Manifestets familj väljer exakt destination eller replik. Kopplingen är inte visuell acceptans.',
        'Tillgänglig betyder läsbar fil med rätt storlek. SHA-256 kontrolleras före uppspelning.',
        'Standard och varianter kommer från Emils mappar. Variantpolicy sparas i labbprojektet.',
      ],
    };
    let entries, families = [];
    try { ({ entries, families } = selection.path || options.snapshotPath ? await readEntries(options) : {entries:new Map(),families:[]}); summary.snapshotReadable = true; }
    catch (error) { if (options.strict) throw error; summary.notes.push('Originalregistret kunde inte läsas.'); entries = new Map(); }
    let uploads = [];
    try { uploads = await (options.readUploads ?? readUploads)(options); }
    catch (error) { if (options.strict) throw error; summary.notes.push('Uppladdningsregistret kunde inte läsas; befintliga filer är bevarade.'); }
    uploads=uploads.filter(entry=>entry.deletion?.state!=='deleted');
    for (const entry of uploads) {
      await validateRetainedEntry(entry);
      if (entries.has(entry.id)) throw new RegistryError(503, 'Duplicate video identity.');
      entries.set(entry.id, entry);
    }
    let archive;
    const indexedBank=isMediaBlobIndexConfigured(options);
    if(indexedBank){
      summary.notes[2]='Tillgänglig betyder en exakt registerkoppling och konfigurerad privat mediekälla. SHA-256 kontrolleras före uppspelning.';
      try { readMediaBlobIndex(options); summary.readable=Boolean(selection.path&&isAbsolute(selection.path)&&samePath(resolve(selection.path),presentationBankRoot(options.repositoryRoot??defaultRepositoryRoot))&&(isMediaConfigured(options.env??process.env)===true)); }
      catch { summary.notes.push('Det aktiva Blob-indexet kunde inte verifieras. Lokal disk används inte som reserv.'); }
    }else{
      try { if(selection.path) archive = await archiveLocation(selection); summary.readable = Boolean(selection.path) || !options.snapshotPath; }
      catch { summary.notes.push('Emils videomapp är inte tillgänglig. LAB_VIDEO_ARCHIVE måste ange en absolut rot med samma manifeststruktur.'); }
    }
    const videos = [];
    let classifications = [];
    try { classifications = await (options.readClassifications ?? readClassifications)(options); }
    catch (error) { if (options.strict) throw error; summary.notes.push('Kategorisering kunde inte läsas. Inga nya klassificeringar används.'); }
    const classified = new Map(classifications.map(item => [item.id, item]));
    const familyById = new Map(families.map(family => [family.id, family]));
    // Sequential metadata checks avoid opening hundreds of files at once.
    for (const entry of entries.values()) {
      let available = false, integrity = 'unavailable';
      const location = entry.classification ? uploadDirectory(options) : archive;
      if (entry.storage) {
        // Immutable Blob references were hashed on upload. Availability here means
        // configured retrieval; playback still verifies all bytes before serving.
        available = isMediaConfigured(options.env ?? process.env,entry.storage)===true;
        integrity = available ? 'unchecked' : 'unavailable';
      } else if(indexedBank&&!entry.classification){
        try{
          const identity=bankBlobIdentity(selection,entry,options);
          const storage=verifiedMediaBlobStorage(identity.logicalPath,identity.expected,options);
          available=(isMediaConfigured(options.env??process.env,storage)===true);
          integrity=available?'unchecked':'unavailable';
        }catch{summary.missing+=1;}
      } else if (location) {
        try {
          const { file, info } = await inspectFile(location, entry);
          available = true;
          integrity = verified.has(cacheKey(file, entry, info)) ? 'verified' : 'unchecked';
        } catch (error) {
          if (error.code === 'ENOENT') summary.missing += 1;
        }
      }
      if(entry.deletion){available=false;integrity='unavailable';}
      const video = publicEntry(entry, available, integrity, familyById.get(entry.familyId));
      if(indexedBank&&!entry.classification)video.storage='private-blob';
      // Only an explicit upload to an exact family joins shared playback. Legacy
      // bank uploads remain lab-only, and standards are never replaced by intake.
      const uploadFamily = entry.classification?.familyId && familyById.get(entry.classification.familyId);
      if (uploadFamily) {
        uploadFamily.variantIds.push(entry.id);
        Object.assign(video, {
          familyId: uploadFamily.id, role: 'variant', eventId: uploadFamily.eventId,
          situation: uploadFamily.situation, playbackType: uploadFamily.playbackType,
          bindingScope: 'shared-local',
        });
      }
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

  /** Product callers authenticate before resolving a video ID through this reader. */
  async function getVideoResponse(id, request, options = {}) {
    if (!['GET', 'HEAD'].includes(request.method)) return errorResponse(request, 405, 'GET or HEAD only.', { Allow: 'GET, HEAD' });
    const origin = request.headers.get('origin');
    const fetchSite = request.headers.get('sec-fetch-site');
    const proxyOriginAllowed = origin && exactHttpsOrigin(options.trustedProxyOrigin)
      && origin === options.trustedProxyOrigin && (!fetchSite || fetchSite === 'same-origin');
    if (fetchSite === 'cross-site'
      || (origin && origin !== new URL(request.url).origin && !proxyOriginAllowed)) {
      return errorResponse(request, 403, 'Same-origin preview required.');
    }
    if (typeof id !== 'string' || !UUID.test(id)) return errorResponse(request, 404, 'Unknown video.');
    let handle;
    try {
      let entry, uploaded, snapshotFailed = false;
      try { entry = (await readEntries(options)).entries.get(id); }
      catch { snapshotFailed = true; }
      if (!entry) {
        uploaded = (await (options.readUploads ?? readUploads)(options)).find(v => v.id === id);
        if (uploaded?.deletion) return new Response(null,{status:410,headers:{'Cache-Control':'private, no-store'}});
        if (uploaded) await validateRetainedEntry(uploaded);
        entry = uploaded;
      }
      if (!entry && snapshotFailed) throw new RegistryError(503, 'Video inventory unavailable.');
      if (!entry) return errorResponse(request, 404, 'Unknown video.');
      if (uploaded?.storage) return getPrivateMedia(uploaded.storage, request, options);
      if(!uploaded&&isMediaBlobIndexConfigured(options)){
        const identity=bankBlobIdentity(selectArchive(options),entry,options);
        return getIndexedMediaBlobResponse(identity.logicalPath,identity.expected,request,options);
      }
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

  return {loadVideoRegistry,getVideoResponse};
}
