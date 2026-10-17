import {extendedDealerMediaFeatures} from '../../../packages/presentation/contracts/dealer-media-features.mjs';
import {StudioStorageError} from '../../../packages/studio-registry/server/document-contract.mjs';
import {PRESENTATION_RUNTIME_UPDATE_REQUIRED} from './presentation-runtime-readiness.mjs';

export async function assertNativeMediaReadiness(repository,metadata) {
  if(typeof repository?.withMutationContext==='function') {
    // Finish the bounded HTTP probe before grants, Blob IO or SQL. The real
    // write starts its own freshly checked context and verifies the same flags.
    await repository.withMutationContext(()=>{}, {metadata});
    return;
  }
  const features=extendedDealerMediaFeatures(metadata);
  if(features.mediaAlpha||features.rouletteMedia||features.recordedSpeech)
    throw new StudioStorageError(PRESENTATION_RUNTIME_UPDATE_REQUIRED,503);
}
