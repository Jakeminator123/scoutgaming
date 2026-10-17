import {MAX_INDEX_BYTES,localDealerIds,uploadDirectory,safeDirectory,readUploads} from './video-local-readers.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, open, rename, unlink, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import lockfile from 'proper-lockfile';
import { StudioError } from './project-store.mjs';
import { MAX_VIDEO_BYTES, validateVideoMetadata } from '../../../packages/presentation/contracts/video-intake.mjs';
import { assertLocalRequest } from './http-guard.mjs';
import { isCloudMediaConfigured, putPrivateMedia, getPrivateMedia, deletePrivateMedia, mediaBlobPath } from './cloud-media-store.mjs';
import {assertMediaAlpha} from './media-alpha.mjs';

/** Raw, bounded streaming upload. Client filenames never become filesystem paths. */
export async function uploadVideo(request, options = {}) {
  assertLocalRequest(request);
  // Custom metadata header makes browser uploads require same-origin access.
  const header = request.headers.get('x-video-metadata');
  if (!header || header.length > 12000) throw new StudioError('Videons kategorisering saknas.');
  let metadata;
  try { metadata = validateVideoMetadata(JSON.parse(decodeURIComponent(header)), {forWrite:true}); }
  catch (error) { throw new StudioError(error instanceof SyntaxError || error instanceof URIError ? 'Ogiltig kategorisering.' : error.message); }
  if (!(await localDealerIds(options)).has(metadata.dealerId)) throw new StudioError('Välj en registrerad dealer.',422);
  const type = request.headers.get('content-type')?.split(';')[0];
  const extension = { 'video/mp4': 'mp4', 'video/webm': 'webm' }[type];
  if (!extension) throw new StudioError('Välj en MP4- eller WebM-video.', 415);
  if (Number(request.headers.get('content-length')) > MAX_VIDEO_BYTES) throw new StudioError('Videon får vara högst 128 MB.', 413);
  if (!request.body) throw new StudioError('Videofil saknas.');
  const env = options.env ?? process.env;
  if (env.CROUPIER_MEDIA_STORAGE === 'blob' && !isCloudMediaConfigured(env)) throw new StudioError('Privat medielagring är inte konfigurerad.', 503);
  const cloud = isCloudMediaConfigured(env);
  const dir = uploadDirectory(options);
  await safeDirectory(dir, true);
  const id = randomUUID(), temp = join(dir, `${id}.part`), final = join(dir, `${id}.${extension}`);
  const reader = request.body.getReader();
  let handle, release, storage, committed = false, moved = false, compromised = false;
  try {
    handle = await open(temp, 'wx');
    const hash = createHash('sha256'); let size = 0, head = Buffer.alloc(0);
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_VIDEO_BYTES) throw new StudioError('Videon får vara högst 128 MB.', 413);
      if (head.length < 32) head = Buffer.concat([head, Buffer.from(value).subarray(0, 32 - head.length)]);
      hash.update(value);
      let offset = 0;
      while (offset < value.byteLength) { const { bytesWritten } = await handle.write(value, offset, value.byteLength - offset); offset += bytesWritten; }
    }
    const validHeader = extension === 'mp4' ? head.length >= 16 && head.toString('ascii', 4, 8) === 'ftyp' : head.length >= 16 && head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (!validHeader) throw new StudioError('Filen har inte rätt MP4/WebM-format.', 415);
    await handle.sync(); await handle.close(); handle = null;
    if(metadata.compositing?.mode==='alpha')await assertMediaAlpha(await readFile(temp),type);
    try { release = await lockfile.lock(dir, { lockfilePath: join(dir, '.index.lock'), retries: 0, onCompromised: () => { compromised = true; } }); }
    catch (error) { if (error.code === 'ELOCKED') throw new StudioError('En annan video sparas. Försök igen.', 423); throw error; }
    const videos = await readUploads(options), sha256 = hash.digest('hex');
    if (!(await localDealerIds(options)).has(metadata.dealerId)) throw new StudioError('Välj en registrerad dealer.',422);
    // Same bytes and classification are idempotent; different classifications may share source footage.
    const existing = videos.find(v => v.sha256 === sha256 && JSON.stringify(v.classification) === JSON.stringify(metadata));
    if (existing) {
      if (existing.storage) {
        const response = await getPrivateMedia(existing.storage, new Request('http://localhost/media', { method: 'HEAD' }), options);
        if (response.ok) return { id: existing.id, duplicate: true };
        // Do not mask a missing/corrupt cloud object by creating a second identity.
        throw new StudioError('Den befintliga privata videon kunde inte verifieras. Inga filer ersattes.', response.status);
      }
      const existingPath = join(dir, `${existing.id}.${existing.extension}`);
      try {
        const info = await lstat(existingPath);
        if (info.isFile() && !info.isSymbolicLink() && info.size === size) {
          const existingHash = createHash('sha256').update(await readFile(existingPath)).digest('hex');
          if (existingHash === sha256) return { id: existing.id, duplicate: true };
        }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (videos.length >= 5000) throw new StudioError('Videoregistret är fullt.', 409);
    const record = { id, sha256, size, extension, classification: metadata, addedAt: new Date().toISOString() };
    if (cloud) {
      // The bounded, validated staging file is the only upload source. Blob is
      // read back and hashed before its reference can enter the live registry.
      handle = await open(temp, 'r');
      const source = handle.createReadStream({ autoClose: false });
      try {
        storage = await putPrivateMedia(mediaBlobPath(`dealers/${metadata.dealerId}/review/uploads`,id,sha256,extension),
          source, { ...options, sha256, size, contentType: type });
      } finally { source.destroy(); await handle.close(); handle = null; }
      record.storage = storage;
    }
    const serialized = JSON.stringify({ schemaVersion: 1, videos: [...videos, record] }, null, 2) + '\n';
    if (Buffer.byteLength(serialized) > MAX_INDEX_BYTES) throw new StudioError('Videoregistret är fullt.', 409);
    const indexTemp = join(dir, `${id}.json.tmp`);
    try {
      if (!cloud) { await rename(temp, final); moved = true; }
      await writeFile(indexTemp, serialized, { flag: 'wx' });
      if (compromised) throw new StudioError('Skrivlåset ändrades. Försök igen.', 423);
      await rename(indexTemp, join(dir, 'index.json')); committed = true;
    } finally { await unlink(indexTemp).catch(() => {}); }
    return { id, duplicate: false };
  } finally {
    await reader.cancel().catch(() => {}); reader.releaseLock();
    if (handle) await handle.close().catch(() => {});
    try {
      if (cloud || !committed) await unlink(moved ? final : temp).catch(() => {});
      if (storage && !committed) await deletePrivateMedia(storage, options).catch(() => {});
    } finally { if (release) await release(); }
  }
}
