import { createStudioRepository } from './studio-repository.mjs';
import { createStudioGamePolicy, studioGamePolicyConfiguration } from './studio-game-policy.mjs';
import { planStudioMigrations } from '../../ops/neon-studio/migrations.mjs';

export async function createRenderStudioPolicy({ storage, env = process.env, dealerIdle, schemaCheck = planStudioMigrations } = {}) {
  const config = studioGamePolicyConfiguration(env);
  if (!config) return null;
  if (env.CROUPIER_DATABASE !== 'postgres' || !storage?.pool || !storage?.db?.assertInstalled) {
    throw Object.assign(new Error('studio_game_storage_unavailable'), { statusCode: 503 });
  }
  await storage.db.assertInstalled();
  const plan = await schemaCheck({ pool: storage.pool });
  // 008 (Dealer Forge) is deployment-optional for the game runtime.
  if (plan.toApply.length || plan.applied.map(row => row.version).join(',') !== '001,002,003,004,005,006,007,008') {
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

import {isActiveDealerId} from '../dealer-identity.mjs';
import {ownDealerIdle} from '../../presentation-runtime/registered-idle.mjs';
export function createRegisteredDealerIdle({registryLoader} = {}) {
  if (typeof registryLoader !== 'function') throw new TypeError('Explicit cloud media registry required');
  return async (dealerId, project) => {
    if (!isActiveDealerId(dealerId)) return null;
    const video = ownDealerIdle(project, await registryLoader(), dealerId);
    return video ? {dealerId, mediaId:video.id, sha256:video.sha256, available:true} : null;
  };
}
