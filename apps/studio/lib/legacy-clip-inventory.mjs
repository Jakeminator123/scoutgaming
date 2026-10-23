import { createLegacyClipInventory } from '../../../packages/presentation/server/legacy-clip-inventory.mjs';
import { validateContactTake, validateContinuation } from '../../../packages/presentation/contracts/performance-contact.mjs';
import { resolveMediaAbsolutePath, repositoryRoot } from '../../../tools/media-layout.mjs';

export const { loadLegacyClipInventory, legacyClipControls } = createLegacyClipInventory({
  // Only the offline fixture's explicit temporary directory; no checkout default.
  repositoryRoot, defaultDataDirectory: () => process.env.CROUPIER_DATA_DIR || null,
  resolveMediaAbsolutePath, validateContactTake, validateContinuation,
});
