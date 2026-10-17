import { createPresentationSelection } from '../../../packages/presentation/server/selection.mjs';
import { buildRuntimeCatalog, isDirectorSourceType, validateProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { selectionFor, videoFitsLine, videoFitsEvent } from '../../../packages/presentation/contracts/video-intake.mjs';
import { speechSlotSituation, speechSlotStandard, speechSlotVideoFits, OTHER_SPEECH_SLOT_IDS } from '../../../packages/presentation/contracts/speech-slot-bindings.mjs';
import { presentationDirector } from './studio-director.mjs';

// Studio-owned composition; registry stays explicit per operation.
export const { decisionCatalog, selectPresentation } = createPresentationSelection({
  projectModel: { buildRuntimeCatalog, isDirectorSourceType, validateProject },
  director: presentationDirector,
  videoRules: { selectionFor, videoFitsLine, videoFitsEvent },
  speechSlots: { speechSlotSituation, speechSlotStandard, speechSlotVideoFits, OTHER_SPEECH_SLOT_IDS },
});
