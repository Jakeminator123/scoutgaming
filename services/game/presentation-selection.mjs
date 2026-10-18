import { createPresentationSelection } from '../../packages/presentation/server/selection.mjs';
import { buildRuntimeCatalog, isDirectorSourceType, validateProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { selectionFor, videoFitsLine, videoFitsEvent } from '../../packages/presentation/contracts/video-intake.mjs';
import { speechSlotSituation, speechSlotStandard, speechSlotVideoFits, OTHER_SPEECH_SLOT_IDS } from '../../packages/presentation/contracts/speech-slot-bindings.mjs';
import { normalizeInput, prepareDecision, finalizeDecision, SOURCE_TYPES } from '../../packages/director/engine.mjs';
import { askDirector } from '../../packages/director/openclaw.mjs';
import { remoteRequest } from '../../packages/presentation/server/director-transport.mjs';
import { createRegisteredIdleRuleSelector } from '../../packages/presentation/server/registered-idle-rules.mjs';
import { createIdleAdviceService } from '../../packages/presentation/server/idle-advice.mjs';
import { registeredIdlePolicy } from '../../packages/presentation/runtime/registered-idle-policy.mjs';
import { isDealerId } from '../../packages/presentation/contracts/dealer-identity.mjs';

const presentationDirector = Object.freeze({ normalizeInput, prepareDecision, finalizeDecision, SOURCE_TYPES, askDirector, remoteRequest });

// Game-owned composition; the API supplies current or frozen registry per operation.
export const { decisionCatalog, selectPresentation } = createPresentationSelection({
  projectModel: { buildRuntimeCatalog, isDirectorSourceType, validateProject },
  director: presentationDirector,
  videoRules: { selectionFor, videoFitsLine, videoFitsEvent },
  speechSlots: { speechSlotSituation, speechSlotStandard, speechSlotVideoFits, OTHER_SPEECH_SLOT_IDS },
});

export const selectRegisteredIdleRule = createRegisteredIdleRuleSelector(presentationDirector);

export function createIdleAdviceServer({ settings, videoRegistry, registryLoader, fetchImpl = fetch, now = Date.now } = {}) {
  return createIdleAdviceService({ director: presentationDirector,
    projectModel: { buildRuntimeCatalog, validateProject, registeredIdlePolicy, isDealerId },
    settingsProvider: () => settings, settings, videoRegistry, registryLoader, fetchImpl, now });
}
