import { basename, join, resolve } from 'node:path';
import { createVideoRegistry } from '../../../packages/studio-registry/server/registry-core.mjs';
import { createNeonVideoRegistry as createRegistryReader } from '../../../packages/studio-registry/server/registry-reader.mjs';
import { createLocalVideoReaders } from '../../../packages/studio-registry/server/local-video-readers.mjs';
import { createMediaBlobIndex } from '../../../packages/studio-registry/server/media-blob-index.mjs';
import { getPrivateMedia } from '../blob-media.mjs';
import * as mediaBlobIndex from '../media-blob-index.mjs';
export { exactHttpsOrigin } from '../../../packages/studio-registry/server/registry-core.mjs';

const repositoryRoot = () => basename(process.cwd()) === 'lab' ? resolve(process.cwd(), '..') : process.cwd();
// Preserve the existing Studio API preview URL; game responses still project
// their own /api/presentation/videos/:id route at the HTTP boundary.
const previewUrl = id => (process.env.NEXT_PUBLIC_LAB_BASE_PATH === '/studio' ? '/studio' : '') + '/api/videos/' + id;
const localReaders = createLocalVideoReaders({
  defaultUploadDirectory: () => {
    const lab = basename(process.cwd()) === 'lab' ? process.cwd() : join(process.cwd(), 'lab');
    return join(lab, 'data', 'videos');
  },
});
function localRegistry() {
  return createVideoRegistry({ repositoryRoot: repositoryRoot(), previewUrl, ...localReaders, getPrivateMedia, mediaBlobIndex });
}
export function loadVideoRegistry(options) { return localRegistry().loadVideoRegistry(options); }
export function getVideoResponse(id, request, options) { return localRegistry().getVideoResponse(id, request, options); }
export function createNeonVideoRegistry({ repository, scope, env = process.env, options = {} } = {}) {
  const root = options.repositoryRoot ?? repositoryRoot();
  const cloudIndex = createMediaBlobIndex({ repositoryRoot: root, getPrivateMedia });
  const reader = createVideoRegistry({ repositoryRoot: root, previewUrl, uploadDirectory: () => null,
    readUploads: async () => { throw new Error('Explicit cloud registry records required.'); },
    readClassifications: async () => [], getPrivateMedia, mediaBlobIndex: cloudIndex });
  return createRegistryReader({ repository, scope, env, options: { ...options, repositoryRoot: root }, reader, getPrivateMedia });
}
