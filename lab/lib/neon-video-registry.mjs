import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalStudioJson, StudioStorageError, studioStorageFailure, validateStudioScope, validateStudioMedia, validateRevision } from '../../web/storage/studio-contract.mjs';
import { getVideoResponse, loadVideoRegistry } from './video-registry.mjs';
import { isCloudMediaConfigured, validatePrivateMedia } from './cloud-media-store.mjs';
import { isMediaBlobIndexConfigured } from './media-blob-index.mjs';
import { savedVideoDealerIds } from './video-dealer-registration.mjs';

// The deployed immutable bank is preserved. New review records/classification
// come from Neon exclusively; an unavailable database never means an empty bank.
export function createNeonVideoRegistry({ repository, scope, env = process.env, options = {} } = {}) {
  scope = validateStudioScope(scope);
  if (!repository || typeof repository.listMedia !== 'function'
    || canonicalStudioJson(validateStudioScope(repository.scope)) !== canonicalStudioJson(scope)) {
    throw new StudioStorageError('studio_invalid_configuration');
  }
  const checkedEnv = Object.freeze({ ...env });
  const checkedOptions = { ...options, env: checkedEnv, strict: true,
    cacheDir: options.cacheDir ?? join(tmpdir(), 'croupier-private-media'),
    // Ignore both retired local upload and classification files.
    readUploads: async () => {
      try {
        const dealerIds = await savedVideoDealerIds(repository);
        const records = await repository.listMedia({ limit: 5000 });
        return records.map(row => {
          validateRevision(row.revision);
          const { revision, updatedAt, ...record } = row;
          const checked = validateStudioMedia(record);
          if (!dealerIds.has(checked.classification.dealerId)) throw new StudioStorageError('studio_dealer_not_registered',503);
          const storage = validatePrivateMedia({ provider: 'vercel-blob',
            pathname: checked.pathname, sha256: checked.sha256, size: checked.size, contentType: checked.contentType });
          return { id: checked.id, sha256: checked.sha256, size: checked.size,
            extension: checked.contentType.slice(6), classification: checked.classification, addedAt: updatedAt, storage,
            ...(checked.retainedBank ? {retainedBank:checked.retainedBank} : {}) };
        });
      } catch (error) { throw studioStorageFailure(error); }
    },
    readClassifications: async () => [],
  };
  function cloudRequired() {
    if (!isCloudMediaConfigured(checkedEnv) || !isMediaBlobIndexConfigured(checkedOptions)) {
      throw new StudioStorageError('studio_media_storage_unavailable');
    }
  }
  return Object.freeze({
    async load() {
      cloudRequired();
      try {
        const registry = await loadVideoRegistry(checkedOptions);
        if (!registry.summary.snapshotReadable || !registry.summary.readable) throw new StudioStorageError('studio_media_registry_unavailable');
        return registry;
      } catch (error) { throw studioStorageFailure(error); }
    },
    async response(id, request) {
      cloudRequired();
      return getVideoResponse(id, request, checkedOptions);
    },
  });
}
