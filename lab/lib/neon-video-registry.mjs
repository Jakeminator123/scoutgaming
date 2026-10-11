import { MEDIA_FILE_TYPES } from './media-file-types.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cloneStudioJson, canonicalStudioJson, StudioStorageError, studioStorageFailure, validateStudioScope, validateStudioMedia, validateRevision } from '../../web/storage/studio-contract.mjs';
import { getVideoResponse, loadVideoRegistry } from './video-registry.mjs';
import { getPrivateMedia, isCloudMediaConfigured, validatePrivateMedia } from './cloud-media-store.mjs';
import { isMediaBlobIndexConfigured } from './media-blob-index.mjs';
import { savedVideoDealerIds } from './video-dealer-registration.mjs';
import {registeredDealerIds} from '../../web/dealer-identity.mjs';

// The deployed immutable bank is preserved. New review records/classification
// come from Neon exclusively; an unavailable database never means an empty bank.
export function createNeonVideoRegistry({ repository, scope, env = process.env, options = {} } = {}) {
  scope = validateStudioScope(scope);
  if (!repository || typeof repository.listMedia !== 'function'
    || canonicalStudioJson(validateStudioScope(repository.scope)) !== canonicalStudioJson(scope)) {
    throw new StudioStorageError('studio_invalid_configuration');
  }
  function uploadsFrom(records, dealerIds) {
    if (!Array.isArray(records) || records.length > 5000) throw new StudioStorageError('studio_media_registry_unavailable');
    const seen = new Set();
    return records.map(source => {
      const row = cloneStudioJson(source);
      validateRevision(row.revision);
      const {revision, updatedAt, ...record} = row;
      const checked = validateStudioMedia(record);
      if (seen.has(checked.id)) throw new StudioStorageError('studio_media_registry_unavailable');
      seen.add(checked.id);
      if (!dealerIds.has(checked.classification.dealerId)) throw new StudioStorageError('studio_dealer_not_registered', 503);
      const storage = validatePrivateMedia({provider:'vercel-blob', pathname:checked.pathname,
        sha256:checked.sha256, size:checked.size, contentType:checked.contentType});
      return {id:checked.id, sha256:checked.sha256, size:checked.size, extension:MEDIA_FILE_TYPES[checked.contentType],
        classification:checked.classification, addedAt:updatedAt, storage,
        ...(checked.retainedBank ? {retainedBank:checked.retainedBank} : {})};
    });
  }
  const checkedEnv = Object.freeze({ ...env });
  const checkedOptions = { ...options, env: checkedEnv, strict: true,
    cacheDir: options.cacheDir ?? join(tmpdir(), 'croupier-private-media'),
    // Ignore both retired local upload and classification files.
    readUploads: async () => {
      try {
        const dealerIds = await savedVideoDealerIds(repository);
        const records = await repository.listMedia({ limit: 5000 });
        return uploadsFrom(records, dealerIds);
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
    async loadCaptured(snapshot) {
      cloudRequired();
      // Detach every captured row BEFORE awaiting immutable bank/provider work.
      // Neither registration nor media metadata may be read from current Neon.
      let uploads;
      try {
        if (canonicalStudioJson(validateStudioScope(snapshot?.scope)) !== canonicalStudioJson(scope)
          || snapshot.projectDocument?.kind !== 'project'
          || snapshot.projectDocument.value?.revision !== validateRevision(snapshot.projectDocument.revision)) {
          throw new StudioStorageError('studio_scope_mismatch', 409);
        }
        uploads = uploadsFrom(snapshot.mediaRows, registeredDealerIds(snapshot.projectDocument.value));
        const registry = await loadVideoRegistry({...checkedOptions, readUploads:async () => uploads});
        if (!registry.summary.snapshotReadable || !registry.summary.readable) throw new StudioStorageError('studio_media_registry_unavailable');
        return registry;
      } catch (error) { throw studioStorageFailure(error); }
    },
    async verifyCapturedMedia(preconditions) {
      cloudRequired();
      const records = preconditions.map(item => validateStudioMedia(item.record));
      for (const record of records) {
        const response = await getPrivateMedia({provider:'vercel-blob', pathname:record.pathname,
          sha256:record.sha256, size:record.size, contentType:record.contentType},
          new Request('https://studio.invalid/api/captured-media', {method:'HEAD'}), checkedOptions);
        if (response.status !== 200) throw new StudioStorageError('studio_media_storage_unavailable');
      }
    },
    async response(id, request) {
      cloudRequired();
      return getVideoResponse(id, request, checkedOptions);
    },
  });
}
