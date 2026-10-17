import { createStudioDocumentContract } from '../../packages/studio-registry/server/storage-contract.mjs';
import { validateProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { validateSocialPolicy } from '../../open-claw/lab/src/social.mjs';
import { gameLaneConfiguration } from '../../packages/presentation/contracts/game-lanes.mjs';
export * from '../../packages/studio-registry/server/storage-contract.mjs';
export const { validateDocumentValue, validateSnapshot } = createStudioDocumentContract({
  validateProject, validateSocialPolicy, gameLaneConfiguration,
});
