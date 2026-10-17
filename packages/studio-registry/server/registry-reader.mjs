import { MEDIA_FILE_TYPES } from '../../shared/media-file-types.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cloneStudioJson, canonicalStudioJson, StudioStorageError, studioStorageFailure, validateStudioScope, validateStudioMedia, validateRevision } from './storage-contract.mjs';
import {isCloudMediaConfigured,validatePrivateMedia} from './private-media-contract.mjs';
import { readRuntimeCatalog, capturedRuntimeCatalog } from './runtime-catalog.mjs';
import { savedVideoDealerOwnership } from './video-dealer-registration.mjs';
import {registeredDealerIds} from '../../presentation/contracts/dealer-identity.mjs';

// The preserved immutable bank lives in the scoped Neon catalog. Review records/classification
// come from Neon exclusively; an unavailable database never means an empty bank.
export function createNeonVideoRegistry({ repository, scope, env = process.env, options = {}, reader, getPrivateMedia } = {}) {
  if(typeof reader?.loadVideoRegistry!=='function'||typeof reader?.getVideoResponse!=='function'||typeof getPrivateMedia!=='function')throw new TypeError('Explicit registry and private media readers required.');
  const {loadVideoRegistry,getVideoResponse}=reader;
  scope = validateStudioScope(scope);
  if (!repository || typeof repository.listMedia !== 'function'
    || canonicalStudioJson(validateStudioScope(repository.scope)) !== canonicalStudioJson(scope)) {
    throw new StudioStorageError('studio_invalid_configuration');
  }
  function uploadsFrom(records, dealerIds, trashIds = new Set()) {
    if (!Array.isArray(records) || records.length > 5000) throw new StudioStorageError('studio_media_registry_unavailable');
    const seen = new Set();
    return records.map(source => {
      const row = cloneStudioJson(source);
      validateRevision(row.revision);
      const {revision, updatedAt, ...record} = row;
      const checked = validateStudioMedia(record);
      if (seen.has(checked.id)) throw new StudioStorageError('studio_media_registry_unavailable');
      seen.add(checked.id);
      if (checked.deletion?.state!=='deleted' && !dealerIds.has(checked.classification.dealerId) && !(checked.classification.archived && trashIds.has(checked.classification.dealerId))) throw new StudioStorageError('studio_dealer_not_registered', 503);
      const storage = validatePrivateMedia({provider:'vercel-blob', pathname:checked.pathname,
        sha256:checked.sha256, size:checked.size, contentType:checked.contentType});
      return {id:checked.id, sha256:checked.sha256, size:checked.size, extension:MEDIA_FILE_TYPES[checked.contentType],
        classification:checked.classification, addedAt:updatedAt, storage, revision,
        ...(checked.deletion ? {deletion:checked.deletion} : {}),
        ...(checked.retainedBank ? {retainedBank:checked.retainedBank} : {})};
    });
  }
  const checkedEnv = Object.freeze({ ...env });
  const checkedOptions = { ...options, env: checkedEnv, strict: true,
    cacheDir: options.cacheDir ?? join(tmpdir(), 'croupier-private-media'),
    // Ignore both retired local upload and classification files.
    readUploads: async () => {
      try {
        const {active:dealerIds,trash} = await savedVideoDealerOwnership(repository);
        const records = await repository.listMedia({ limit: 5000 });
        return uploadsFrom(records, dealerIds, trash);
      } catch (error) { throw studioStorageFailure(error); }
    },
    readClassifications: async () => [],
  };
  function cloudRequired() {
    if (!isCloudMediaConfigured(checkedEnv)) {
      throw new StudioStorageError('studio_media_storage_unavailable');
    }
  }
  return Object.freeze({
    async load() {
      cloudRequired();
      try {
        const runtimeCatalog=await readRuntimeCatalog(repository);
        const registry = await loadVideoRegistry({...checkedOptions,runtimeCatalog});
        if (!registry.summary.snapshotReadable || !registry.summary.readable) throw new StudioStorageError('studio_media_registry_unavailable');
        return registry;
      } catch (error) { throw studioStorageFailure(error); }
    },
    async loadCaptured(snapshot) {
      cloudRequired();
      // Detach every captured row BEFORE awaiting immutable bank/provider work.
      // Neither registration nor media metadata may be read from current Neon.
      let uploads,runtimeCatalog;
      try {
        if (canonicalStudioJson(validateStudioScope(snapshot?.scope)) !== canonicalStudioJson(scope)
          || snapshot.projectDocument?.kind !== 'project'
          || snapshot.projectDocument.value?.revision !== validateRevision(snapshot.projectDocument.revision)) {
          throw new StudioStorageError('studio_scope_mismatch', 409);
        }
        runtimeCatalog=capturedRuntimeCatalog(snapshot.runtimeCatalog);
        uploads = uploadsFrom(snapshot.mediaRows, registeredDealerIds(snapshot.projectDocument.value), new Set((snapshot.projectDocument.value.dealerTrash ?? []).map(entry => entry.dealer.id)));
        const registry = await loadVideoRegistry({...checkedOptions,runtimeCatalog, readUploads:async () => uploads});
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
      try {return await getVideoResponse(id, request, {...checkedOptions,runtimeCatalog:await readRuntimeCatalog(repository)});}
      catch(error){throw studioStorageFailure(error);}
    },
    async responseCaptured(id,request,snapshot) {
      cloudRequired();
      try {
        if(canonicalStudioJson(validateStudioScope(snapshot?.scope))!==canonicalStudioJson(scope)
          || snapshot.projectDocument?.kind!=='project'
          || snapshot.projectDocument.value?.revision!==validateRevision(snapshot.projectDocument.revision))throw new StudioStorageError('studio_scope_mismatch',409);
        const runtimeCatalog=capturedRuntimeCatalog(snapshot.runtimeCatalog);
        const uploads=uploadsFrom(snapshot.mediaRows,registeredDealerIds(snapshot.projectDocument.value),new Set((snapshot.projectDocument.value.dealerTrash??[]).map(entry=>entry.dealer.id)));
        return await getVideoResponse(id,request,{...checkedOptions,runtimeCatalog,readUploads:async()=>uploads});
      }catch(error){throw studioStorageFailure(error);}
    },
  });
}
