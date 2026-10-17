import { createPresentationSelection } from '../../packages/presentation/server/selection.mjs';
import { buildRuntimeCatalog, isDirectorSourceType, validateProject } from './studio-model.mjs';
import { selectionFor, videoFitsLine, videoFitsEvent } from './video-intake.mjs';
import { speechSlotSituation, speechSlotStandard, speechSlotVideoFits, OTHER_SPEECH_SLOT_IDS } from '../../web/public/speech-slot-bindings.mjs';
import { presentationDirector } from './studio-director.mjs';

// App-owned composition shared by Studio and the game; registry stays per operation.
export const { decisionCatalog, selectPresentation } = createPresentationSelection({
  projectModel: { buildRuntimeCatalog, isDirectorSourceType, validateProject },
  director: presentationDirector,
  videoRules: { selectionFor, videoFitsLine, videoFitsEvent },
  speechSlots: { speechSlotSituation, speechSlotStandard, speechSlotVideoFits, OTHER_SPEECH_SLOT_IDS },
});
