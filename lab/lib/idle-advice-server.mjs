import { basename, resolve } from 'node:path';
import { readSettings } from './director-settings.mjs';
import { presentationDirector } from './studio-director.mjs';
import { studioVideoRegistry } from './studio-server.mjs';
import { readLocalJson, jsonResponse, errorResponse } from './http-guard.mjs';
import { createIdleAdviceService } from '../../packages/presentation/server/idle-advice.mjs';
export { IDLE_ADVICE_LIMITS } from '../../packages/presentation/server/idle-advice.mjs';
import { buildRuntimeCatalog, validateProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { registeredIdlePolicy } from '../../packages/presentation/runtime/registered-idle-policy.mjs';
import { isDealerId } from '../../packages/presentation/contracts/dealer-identity.mjs';

const localSettings = () => {
  const directory = basename(process.cwd()) === 'lab' ? process.cwd() : resolve(process.cwd(), 'lab');
  return readSettings({ envFiles: [resolve(directory, '../.env'), resolve(directory, '.env.local')] });
};

export function createIdleAdviceServer({ settings, videoRegistry, registryLoader = studioVideoRegistry, fetchImpl = fetch, now = Date.now } = {}) {
  return createIdleAdviceService({ director: presentationDirector,
    projectModel: { buildRuntimeCatalog, validateProject, registeredIdlePolicy, isDealerId },
    settingsProvider: localSettings, settings, videoRegistry, registryLoader, fetchImpl, now });
}

const serviceKey = Symbol.for('croupier.lab.idle-advice.v1');
export const adviseIdle = globalThis[serviceKey] ??= createIdleAdviceServer();
export async function idleAdviceResponse(request, advise = adviseIdle) {
  try { return jsonResponse(await advise(await readLocalJson(request), { signal: request.signal })); }
  catch (error) { return errorResponse(error); }
}
