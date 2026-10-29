import {studioRoots} from './studio-roots.mjs';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createPostgresStore, validateGameConnection } from '../../../packages/storage/server/postgres-store.mjs';
import { createStudioPolicyRuntime } from '../../../packages/presentation/server/studio-policy-runtime.mjs';
import { createRegisteredDealerIdle } from '../../../packages/presentation/server/registered-dealer-idle.mjs';
import { planStudioMigrations, isStudioMigrationPlanReady } from '../../../ops/neon-studio/migrations.mjs';
import { createNeonSocialStore } from './neon-project-store.mjs';
import { createStudioMediaRuntime, createStudioPublicMediaAvailability } from './studio-media-runtime.mjs';
import { StudioError } from './project-store.mjs';

const createRenderStudioPolicy = createStudioPolicyRuntime({
  schemaCheck: planStudioMigrations, isSchemaReady: isStudioMigrationPlanReady,
  async createDealerIdle({repository,scope,env}) {
    return createRegisteredDealerIdle({registryLoader:createStudioMediaRuntime({repository,scope,env}).videoRegistry});
  },
});

export const renderStudioPolicyEnabled = (env = process.env) => env.CROUPIER_STUDIO_NEON_POLICY === '1';
export function assertRenderStudioWritable() {
  throw new StudioError('studio_writes_moved_to_native',410);
}
const readonly = store => Object.freeze({load: () => store.load(),save: async () => {throw new StudioError('studio_writes_moved_to_native',410);}});

// The protected internal Render Lab keeps its existing ingress authentication.
// Its read runtime shares Neon policy/media but never becomes a second writer,
// creates an account, imports old JSON, or initializes a missing document.
export async function createStudioRenderPersistence({env = process.env,poolFactory,
  storeFactory = createPostgresStore,policyFactory = createRenderStudioPolicy,
  mediaFactory = createStudioMediaRuntime,schemaCheck = planStudioMigrations,readText = readFile,
  repositoryRoot = studioRoots().repositoryRoot,
} = {}) {
  if (!renderStudioPolicyEnabled(env)) throw new StudioError('studio_read_storage_unavailable',503);
  env = Object.freeze({...env});
  let connectionString;
  try {
    connectionString = validateGameConnection(env.CROUPIER_GAME_DATABASE_URL,env.CROUPIER_ZONES_DATABASE_URL);
    if (env.CROUPIER_DATABASE !== 'postgres' || !new URL(connectionString).hostname.endsWith('.neon.tech')) throw new Error('invalid');
  } catch {throw new StudioError('studio_read_storage_unavailable',503);}
  poolFactory ??= async connection => {
    const {Pool} = await import('@neondatabase/serverless');
    return new Pool({connectionString:connection,max:4,connectionTimeoutMillis:10000,idleTimeoutMillis:15000});
  };
  const pool = await poolFactory(connectionString);
  try {
    const storage = storeFactory({pool});
    const source = await readText(resolve(repositoryRoot,'ops/neon-game/product-schema.sql'),'utf8');
    const checkedStorage = {...storage,db:{...storage.db,assertInstalled: () => storage.db.assertInstalled({source})}};
    const shared = await policyFactory({storage:checkedStorage,env,
      schemaCheck:({pool:checkedPool}) => schemaCheck({pool:checkedPool,directory:resolve(repositoryRoot,'ops/neon-studio')})});
    if (!shared?.policy?.projectStore || !shared.repository || !shared.scope) throw new Error('missing policy');
    const media = mediaFactory({...shared,env,repositoryRoot});
    return Object.freeze({...media,projectStore:readonly(shared.policy.projectStore()),
      socialStore:readonly(createNeonSocialStore({repository:shared.repository,scope:shared.scope})),
      scope:shared.scope,configurationSource:'neon/croupier_studio'});
  } catch {
    try {await pool.end();} catch { /* Preserve failure; no disk fallback. */ }
    throw new StudioError('studio_read_storage_unavailable',503);
  }
}

let persistence;
export async function studioRenderPersistence() {
  if (!renderStudioPolicyEnabled()) throw new StudioError('studio_read_storage_unavailable',503);
  persistence ??= createStudioRenderPersistence().catch(error => {persistence = undefined;throw error;});
  return persistence;
}
