import { createNeonVideoRegistry } from './neon-video-registry.mjs';
import { createStudioProjectBindings } from './studio-project-bindings.mjs';
import { legacyClipControls } from './legacy-clip-inventory.mjs';
import { verifiedMediaBlobStorage } from './media-blob-index.mjs';
import { resolvePublicMedia } from '../../tools/media-layout.mjs';
import { StudioStorageError } from '../../web/storage/studio-contract.mjs';

// Availability means the exact approved public asset has a verified private
// object pointer. Metadata on a deployed disk never substitutes for its bytes.
export function createStudioPublicMediaAvailability({ env = process.env, repositoryRoot } = {}) {
  const options = { env: Object.freeze({ ...env }), repositoryRoot };
  return async file => {
    if (typeof file !== 'string' || !file || file.startsWith('/') || file.includes('\\')
      || file.split('/').some(part => !part || part === '.' || part === '..')) return false;
    if (env.CROUPIER_MEDIA_STORAGE !== 'blob' || !env.BLOB_READ_WRITE_TOKEN || !env.CROUPIER_MEDIA_BLOB_INDEX) {
      throw new StudioStorageError('studio_media_storage_unavailable');
    }
    try {
      const row = resolvePublicMedia(`/${file}`, options);
      return Boolean(row && verifiedMediaBlobStorage(row.logicalPath, { access: 'public', sha256: row.sha256, size: row.size }, options));
    } catch { throw new StudioStorageError('studio_media_storage_unavailable'); }
  };
}

export function createStudioMediaRuntime({ repository, scope, env = process.env, repositoryRoot } = {}) {
  const videos = createNeonVideoRegistry({ repository, scope, env, options: { repositoryRoot } });
  const mediaAvailable = createStudioPublicMediaAvailability({ env, repositoryRoot });
  const controls = project => legacyClipControls(project, { repository: repositoryRoot, mediaAvailable,
    administration: async () => {
      const saved = await repository.readDocument('administration');
      if (!saved) throw new StudioStorageError('studio_document_missing');
      return saved.value;
    } });
  return Object.freeze({ videoRegistry: videos.load, videoResponse: videos.response, legacyControls: controls,
    validateProjectBindings: createStudioProjectBindings({ videoRegistry: videos.load, legacyControls: controls }) });
}
