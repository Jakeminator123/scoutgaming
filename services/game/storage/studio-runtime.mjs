import { createStudioPolicyRuntime } from '../../../packages/presentation/server/studio-policy-runtime.mjs';
import { createRegisteredDealerIdle } from '../../../packages/presentation/server/registered-dealer-idle.mjs';
import { planStudioMigrations, isStudioMigrationPlanReady } from '../../../ops/neon-studio/migrations.mjs';

export const createRenderStudioPolicy = createStudioPolicyRuntime({
  schemaCheck: planStudioMigrations, isSchemaReady: isStudioMigrationPlanReady,
  async createDealerIdle({repository,scope,env}) {
    const {createStudioMediaRuntime} = await import('./studio-media-runtime.mjs');
    return createRegisteredDealerIdle({registryLoader:createStudioMediaRuntime({repository,scope,env}).videoRegistry});
  },
});
