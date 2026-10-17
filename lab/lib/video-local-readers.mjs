import {mkdir,readFile,lstat,realpath} from 'node:fs/promises';
import {basename,join,resolve} from 'node:path';
import {StudioError} from '../../packages/shared/studio-error.mjs';
import {MAX_VIDEO_BYTES,validateVideoMetadata} from '../../packages/presentation/contracts/video-intake.mjs';
import {validatePrivateMedia,mediaBlobPath} from '../../packages/studio-registry/server/private-media-contract.mjs';
import {BASE_DEALER_IDS,registeredDealerIds} from '../../packages/presentation/contracts/dealer-identity.mjs';
export const MAX_INDEX_BYTES = 8 * 1024 * 1024;

export async function localDealerIds(options) {
  const project = options.projectStore ? await options.projectStore.load() : options.project;
  if (project === undefined) return new Set(BASE_DEALER_IDS);
  try { return registeredDealerIds(project); } catch { throw new StudioError('Dealerregistret kunde inte läsas.',503); }
}

export function uploadDirectory(options = {}) {
  const lab = basename(process.cwd()) === 'lab' ? process.cwd() : join(process.cwd(), 'lab');
  return resolve(options.uploadDir ?? join(lab, 'data', 'videos'));
}

export async function safeDirectory(dir, create = false) {
  if (create) await mkdir(dir, { recursive: true });
  const info = await lstat(dir), actual = await realpath(dir);
  const same = process.platform === 'win32' ? actual.toLowerCase() === dir.toLowerCase() : actual === dir;
  if (!info.isDirectory() || info.isSymbolicLink() || !same) throw new StudioError('Videomappen måste vara en vanlig lokal mapp.', 403);
}

export async function readUploads(options = {}) {
  const dir = uploadDirectory(options);
  try {
    await safeDirectory(dir);
    const file = join(dir, 'index.json'), info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_INDEX_BYTES) throw new Error('Invalid index');
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (data.schemaVersion !== 1 || !Array.isArray(data.videos) || data.videos.length > 5000) throw new Error('Invalid index');
    const ids = new Set(), dealers = await localDealerIds(options);
    for (const v of data.videos) {
      if (!/^[a-f0-9-]{36}$/.test(v.id) || ids.has(v.id) || !/^[a-f0-9]{64}$/.test(v.sha256) || !Number.isSafeInteger(v.size) || v.size < 16 || v.size > MAX_VIDEO_BYTES || !['mp4', 'webm'].includes(v.extension)) throw new Error('Invalid record');
      validateVideoMetadata(v.classification, { allowLegacySituation: true });
      if (!dealers.has(v.classification.dealerId)) throw new Error('Dealer is not registered');
      ids.add(v.id);
      if (v.storage !== undefined) {
        validatePrivateMedia(v.storage);
        if (![ `croupier/videos/${v.id}/${v.sha256}.${v.extension}`,mediaBlobPath(`dealers/${v.classification.dealerId}/review/uploads`,v.id,v.sha256,v.extension)].includes(v.storage.pathname)
          || v.storage.sha256 !== v.sha256 || v.storage.size !== v.size
          || v.storage.contentType !== `video/${v.extension}`) throw new Error('Invalid cloud record');
      }
    }
    return data.videos;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new StudioError('Det lokala uppladdningsregistret kunde inte läsas. Befintliga filer har bevarats.', 503);
  }
}

export const LIMIT = 8 * 1024 * 1024;

export const validClassificationVideoId = id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);

export async function readClassifications(options = {}) {
  const dir = uploadDirectory(options);
  try {
    await safeDirectory(dir);
    const file = join(dir, 'classifications.json'), info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > LIMIT) throw new Error('Invalid registry');
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (data.schemaVersion !== 1 || !Array.isArray(data.entries) || data.entries.length > 10000) throw new Error('Invalid registry');
    const ids = new Set();
    for (const row of data.entries) {
      if (!validClassificationVideoId(row.id) || ids.has(row.id) || !/^[a-f0-9]{64}$/.test(row.sha256)) throw new Error('Invalid entry');
      validateVideoMetadata(row.metadata); ids.add(row.id);
    }
    return data.entries;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new StudioError('Kategoriseringsregistret kunde inte läsas. Filerna är bevarade.', 503);
  }
}
