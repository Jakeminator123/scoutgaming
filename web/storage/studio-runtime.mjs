import { createRegisteredDealerIdle } from '../../packages/presentation/server/registered-dealer-idle.mjs';
import { createStudioRepository } from './studio-repository.mjs';
import { createStudioGamePolicy, studioGamePolicyConfiguration } from './studio-game-policy.mjs';
import { planStudioMigrations, isStudioMigrationPlanReady } from '../../ops/neon-studio/migrations.mjs';

export async function createRenderStudioPolicy({ storage, env = process.env, dealerIdle, schemaCheck = planStudioMigrations } = {}) {
  const config = studioGamePolicyConfiguration(env);
  if (!config) return null;
  if (env.CROUPIER_DATABASE !== 'postgres' || !storage?.pool || !storage?.db?.assertInstalled) {
    throw Object.assign(new Error('studio_game_storage_unavailable'), { statusCode: 503 });
  }
  await storage.db.assertInstalled();
  const plan = await schemaCheck({ pool: storage.pool });
  // The reader cutover requires the imported Neon catalogue schema.
  if (!isStudioMigrationPlanReady(plan)) {
    throw Object.assign(new Error('studio_game_schema_unavailable'), { statusCode: 503 });
  }
  const repository = createStudioRepository({ pool: storage.pool, scope: config.scope });
  if (!dealerIdle) {
    const {createStudioMediaRuntime} = await import('../../lab/lib/studio-media-runtime.mjs');
    dealerIdle = createRegisteredDealerIdle({registryLoader:createStudioMediaRuntime({repository,scope:config.scope,env}).videoRegistry});
  }
  const policy = createStudioGamePolicy({ repository, scope: config.scope, dealerIdle });
  await policy.readSaved(); // Missing import fails before listening; no seed.
  return Object.freeze({ policy, repository, scope: config.scope });
}
