import {studioRoots} from './studio-roots.mjs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createLocalVideoReaders, assertLocalVideoDirectory } from '../../../packages/studio-registry/server/local-video-readers.mjs';
export { MAX_INDEX_BYTES, LIMIT, validClassificationVideoId, localDealerIds } from '../../../packages/studio-registry/server/local-video-readers.mjs';

export const { uploadDirectory, readUploads, readClassifications } = createLocalVideoReaders({
  defaultUploadDirectory: () => {
    const lab = studioRoots().appRoot;
    return join(lab, 'data', 'videos');
  },
});
// Creation belongs to the Studio writer; shared/game readers only inspect.
export async function safeDirectory(dir, create = false) {
  if (create) await mkdir(dir, { recursive: true });
  return assertLocalVideoDirectory(dir);
}
