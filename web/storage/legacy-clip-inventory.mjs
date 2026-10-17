import { join } from 'node:path';
import { createLegacyClipInventory } from '../../packages/presentation/server/legacy-clip-inventory.mjs';
import { validateContactTake, validateContinuation } from '../public/performance-contact.mjs';
import { resolveMediaAbsolutePath, repositoryRoot } from '../../tools/media-layout.mjs';

export const { loadLegacyClipInventory, legacyClipControls } = createLegacyClipInventory({
  repositoryRoot, defaultDataDirectory: repository => process.env.CROUPIER_DATA_DIR || join(repository, 'web/data'),
  resolveMediaAbsolutePath, validateContactTake, validateContinuation,
});
