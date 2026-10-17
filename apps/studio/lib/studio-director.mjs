import { askDirector } from '../../../packages/director/openclaw.mjs';
import { normalizeInput, prepareDecision, finalizeDecision, SOURCE_TYPES } from '../../../packages/director/engine.mjs';
import { remoteRequest } from '../../../packages/presentation/server/director-transport.mjs';

export const presentationDirector = Object.freeze({ normalizeInput, prepareDecision, finalizeDecision, SOURCE_TYPES, askDirector, remoteRequest });
