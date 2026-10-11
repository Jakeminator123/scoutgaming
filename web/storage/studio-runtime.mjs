import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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
  if (plan.toApply.length || !['001,002,003,004,005,006','001,002,003,004,005,006,007'].includes(plan.applied.map(row=>row.version).join(','))) {
    throw Object.assign(new Error('studio_game_schema_unavailable'), { statusCode: 503 });
  }
  const repository = createStudioRepository({ pool: storage.pool, scope: config.scope });
  const policy = createStudioGamePolicy({ repository, scope: config.scope, dealerIdle });
  await policy.readSaved(); // Missing import fails before listening; no seed.
  return Object.freeze({ policy, repository, scope: config.scope });
}

// Exact engine index entry, shared by all dealers. Metadata is bundled source;
// it is neither a duration heuristic nor an approval of a replacement take.
export function createRegisteredDealerIdle({ repositoryRoot = process.cwd(), pathFor, mediaAvailable, readMetadata } = {}) {
  return async dealerId => {
    if (!['vera','astrid','amira','mei'].includes(dealerId)) return null;
    const base = dealerId === 'vera' ? 'dealer' : `dealers/${dealerId}`;
    const path = pathFor ? pathFor(base, 'streams/index.json') : resolve(repositoryRoot, 'web/public', base, 'streams/index.json');
    try {
      const index = readMetadata ? await readMetadata(path) : JSON.parse(await readFile(path, 'utf8'));
      const clip = index?.clips?.['idle-1/idle/idle'];
      const exact = Boolean(clip && typeof clip.file === 'string' && clip.file && !clip.file.includes('..') && !clip.file.includes('\\'));
      return { dealerId, engineKey: 'idle-1/idle/idle', available: exact && (mediaAvailable ? await mediaAvailable(`${base}/streams/${clip.file}`) : true) };
    } catch { return null; }
  };
}
