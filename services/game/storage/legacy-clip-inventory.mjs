import { createLegacyClipInventory } from '../../../packages/presentation/server/legacy-clip-inventory.mjs';
import { validateContactTake, validateContinuation } from '../../../packages/presentation/contracts/performance-contact.mjs';
import { resolveMediaAbsolutePath, repositoryRoot } from '../../../tools/media-layout.mjs';

export const { loadLegacyClipInventory, legacyClipControls } = createLegacyClipInventory({
  // Callers pass an explicit directory; no environment or checkout default.
  repositoryRoot, defaultDataDirectory: () => null,
  resolveMediaAbsolutePath, validateContactTake, validateContinuation,
});
