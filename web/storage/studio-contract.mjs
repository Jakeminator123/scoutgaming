import { createStudioDocumentContract } from '../../packages/studio-registry/server/storage-contract.mjs';
import { validateProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { validateSocialPolicy } from '../../packages/director/social.mjs';
import { gameLaneConfiguration } from '../public/game-lanes.mjs';
export * from '../../packages/studio-registry/server/storage-contract.mjs';
export const { validateDocumentValue, validateSnapshot } = createStudioDocumentContract({
  validateProject, validateSocialPolicy, gameLaneConfiguration,
});
