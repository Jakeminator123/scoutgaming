import { createMediaRuntimeServices } from '../../../packages/studio-registry/server/media-runtime.mjs';
import { createRuntimeMetadataReader } from '../../../tools/runtime-media-catalog.mjs';
import { createNeonVideoRegistry } from './neon-video-registry.mjs';
import { legacyClipControls } from './legacy-clip-inventory.mjs';
import { verifiedMediaBlobStorage, getPublicMediaBlobResponse } from './media-blob-index.mjs';
import { resolvePublicMedia, repositoryRoot } from '../../../tools/media-layout.mjs';
import { STUDIO_GAME_CONFIGURATION_SOURCE } from '../../../packages/presentation/server/saved-game-policy.mjs';

export const { createStudioMediaRuntime, createStudioPublicMediaAvailability } = createMediaRuntimeServices({
  repositoryRoot, createNeonVideoRegistry, legacyClipControls, verifiedMediaBlobStorage,
  getPublicMediaBlobResponse, resolvePublicMedia, createRuntimeMetadataReader,
  configurationSource: STUDIO_GAME_CONFIGURATION_SOURCE,
});
