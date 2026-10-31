import { createMediaRuntimeServices } from '../../../packages/studio-registry/server/media-runtime.mjs';
import { createNeonVideoRegistry } from './neon-video-registry.mjs';
import { verifiedMediaBlobStorage, getPublicMediaBlobResponse } from './media-blob-index.mjs';
import { resolvePublicMedia, repositoryRoot } from '../../../tools/media-layout.mjs';

export const { createStudioMediaRuntime, createStudioPublicMediaAvailability } = createMediaRuntimeServices({
  repositoryRoot, createNeonVideoRegistry, verifiedMediaBlobStorage,
  getPublicMediaBlobResponse, resolvePublicMedia,
});
