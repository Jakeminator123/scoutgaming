import * as savedGameDocumentContract from '../../studio-registry/server/document-contract.mjs';

import { createStudioRepository } from '../../studio-registry/server/document-repository.mjs';
import { createSavedGamePolicy, studioGamePolicyConfiguration } from './saved-game-policy.mjs';

const { createStudioGamePolicy } = createSavedGamePolicy({ documentContract: savedGameDocumentContract });

export function createStudioPolicyRuntime({ schemaCheck: defaultSchemaCheck, isSchemaReady, createDealerIdle } = {}) {
  if ([defaultSchemaCheck, isSchemaReady, createDealerIdle].some(port => typeof port !== 'function')) {
    throw new TypeError('Explicit Studio policy runtime ports required');
  }
  return async function createRenderStudioPolicy({ storage, env = process.env, dealerIdle, schemaCheck = defaultSchemaCheck } = {}) {
    const config = studioGamePolicyConfiguration(env);
    if (!config) return null;
    if (env.CROUPIER_DATABASE !== 'postgres' || !storage?.pool || !storage?.db?.assertInstalled) {
      throw Object.assign(new Error('studio_game_storage_unavailable'), { statusCode: 503 });
    }
    await storage.db.assertInstalled();
    const plan = await schemaCheck({ pool: storage.pool });
    // The reader cutover requires the imported Neon catalogue schema.
    if (!isSchemaReady(plan)) {
      throw Object.assign(new Error('studio_game_schema_unavailable'), { statusCode: 503 });
    }
    const repository = createStudioRepository({ pool: storage.pool, scope: config.scope });
    if (!dealerIdle) {
      dealerIdle = await createDealerIdle({repository,scope:config.scope,env});
    }
    const policy = createStudioGamePolicy({ repository, scope: config.scope, dealerIdle });
    await policy.readSaved(); // Missing import fails before listening; no seed.
    return Object.freeze({ policy, repository, scope: config.scope });
  };
}
