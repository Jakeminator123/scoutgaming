import { OpenClawAdminError } from './admin-error.mjs';

export const STUDIO_OPENCLAW_ADMIN_PATH = '/api/studio/openclaw/admin';
export const CROUPIER_ADMIN_AGENTS = Object.freeze(['croupier-director', 'croupier-chat', 'croupier-operator', 'croupier-social', 'croupier-speech']);
const modelRef = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,100}\/[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,150}$/.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names) => object(value) && Object.keys(value).every(key => names.includes(key)) && names.every(key => Object.hasOwn(value, key));
const fail = (code = 'openclaw_admin_invalid_request', statusCode = 400) => { throw new OpenClawAdminError(code, statusCode); };
export const validAdminHash = value => typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,256}$/.test(value);
function model(value) {
  if (!keys(value, ['primary', 'fallbacks']) || !modelRef(value.primary) || !Array.isArray(value.fallbacks)
    || value.fallbacks.length > 4 || !value.fallbacks.every(modelRef) || new Set([value.primary, ...value.fallbacks]).size !== value.fallbacks.length + 1) fail();
  return { primary:value.primary, fallbacks:[...value.fallbacks] };
}
export function validateOpenClawAdminPatch(input) {
  if (!keys(input, ['version', 'baseHash', 'agentId', 'model']) || input.version !== 1 || !validAdminHash(input.baseHash)
    || !CROUPIER_ADMIN_AGENTS.includes(input.agentId)) fail();
  return { version:1, baseHash:input.baseHash, agentId:input.agentId, model:model(input.model) };
}

export { model as normalizeOpenClawAdminModel, modelRef as isOpenClawModelRef };
