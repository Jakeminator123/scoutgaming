import { createVideoBindingValidator } from './video-bindings.mjs';
import { videoFitsLine } from '../contracts/video-intake.mjs';
import { speechSlotSituation, speechSlotVideoFits } from '../contracts/speech-slot-bindings.mjs';

// Persistence validation does not load selection orchestration or the Director.
export const validateVideoBindings = createVideoBindingValidator({
  videoRules: { videoFitsLine },
  speechSlots: { speechSlotSituation, speechSlotVideoFits },
});
