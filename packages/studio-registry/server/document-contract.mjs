import { createStudioDocumentContract } from './storage-contract.mjs';
import { validateProject } from '../../presentation/contracts/studio-model.mjs';
import { validateSocialPolicy } from '../../director/social.mjs';
import { gameLaneConfiguration } from '../../presentation/contracts/game-lanes.mjs';
export * from './storage-contract.mjs';
export const { validateDocumentValue, validateSnapshot } = createStudioDocumentContract({
  validateProject, validateSocialPolicy, gameLaneConfiguration,
});
