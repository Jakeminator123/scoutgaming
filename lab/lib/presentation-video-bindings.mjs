import { createVideoBindingValidator } from '../../packages/presentation/server/video-bindings.mjs';
import { videoFitsLine } from './video-intake.mjs';
import { speechSlotSituation, speechSlotVideoFits } from '../../web/public/speech-slot-bindings.mjs';

// Persistence validation does not load selection orchestration or the Director.
export const validateVideoBindings = createVideoBindingValidator({
  videoRules: { videoFitsLine },
  speechSlots: { speechSlotSituation, speechSlotVideoFits },
});
