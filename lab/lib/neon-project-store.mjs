import {
  StudioStorageError, canonicalStudioJson, studioStorageFailure,
  validateActor, validateDocumentValue, validateRevision, validateStudioScope,
} from '../../web/storage/studio-contract.mjs';
import { normalizeProject } from '../../packages/presentation/contracts/studio-model.mjs';

function documentStore(kind, { repository, scope, actor } = {}) {
  const checkedScope = validateStudioScope(scope);
  if (!repository || typeof repository.readDocument !== 'function'
    || typeof repository.saveDocument !== 'function'
    || canonicalStudioJson(validateStudioScope(repository.scope)) !== canonicalStudioJson(checkedScope)) {
    throw new StudioStorageError('studio_scope_mismatch', 503);
  }
  // A read-only game consumer needs no write identity. A writer receives its
  // identity from authenticated server context, never from its request body.
  const checkedActor = actor === undefined ? null : validateActor(actor);
  const documentValue = document => {
    if (!document) throw new StudioStorageError('studio_document_missing', 503);
    if (document.kind !== kind || document.value?.revision !== document.revision) {
      throw new StudioStorageError('studio_corrupt_document', 503);
    }
    return validateDocumentValue(kind, document.value, document.revision, { allowLegacyRead: true });
  };
  return Object.freeze({
    async load() {
      try {
        const value = documentValue(await repository.readDocument(kind));
        return kind === 'project' ? normalizeProject(value, { allowIncompatibleAnimations: true, preserveMissingLanes: true }) : value;
      }
      catch (error) { throw studioStorageFailure(error); }
    },
    async save(next, expectedRevision) {
      if (checkedActor === null) throw new StudioStorageError('studio_writer_required', 403);
      validateRevision(expectedRevision);
      // Keep the caller's draft unchanged. The repository owns new revisions,
      // transactional CAS, history and audit; there is no second disk write.
      const checked = validateDocumentValue(kind, next, expectedRevision);
      try {
        return documentValue(await repository.saveDocument(kind, {
          value: checked, expectedRevision, actor: checkedActor,
        }));
      } catch (error) { throw studioStorageFailure(error); }
    },
  });
}

export const createNeonProjectStore = options => documentStore('project', options);
export const createNeonSocialStore = options => documentStore('social-policy', options);
