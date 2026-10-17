import { createRegisteredIdleRuleSelector } from '../../packages/presentation/server/registered-idle-rules.mjs';
import { presentationDirector } from './studio-director.mjs';

export const selectRegisteredIdleRule = createRegisteredIdleRuleSelector(presentationDirector);
