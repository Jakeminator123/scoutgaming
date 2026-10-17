import { createVideoBindingValidator } from '../../packages/presentation/server/video-bindings.mjs';
import { videoFitsLine } from '../../packages/presentation/contracts/video-intake.mjs';
import { speechSlotSituation, speechSlotVideoFits } from '../../packages/presentation/contracts/speech-slot-bindings.mjs';

// Persistence validation does not load selection orchestration or the Director.
export const validateVideoBindings = createVideoBindingValidator({
  videoRules: { videoFitsLine },
  speechSlots: { speechSlotSituation, speechSlotVideoFits },
});
